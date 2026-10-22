"""Neuron-loss simulation: host, graft and device populations as host neurons die.

Each architecture is a small spiking circuit (Brian2, numpy code generation, no compiler
needed). For each step of the dropout schedule a share of host neurons is removed, and we
measure how much task function the surviving system still carries: the accuracy of a
linear decoder retrained on the surviving neurons (host + graft + device).

The task is short-term memory. Each trial briefly shows one of four inputs, each driving
a random quarter of the host neurons, and the readout must say which one it was from
spikes 10-60 ms after the input has gone. Input only ever enters through the host. The
host holds the trace through recurrent excitation over slow (NMDA-like) synapses, so as
neurons die it forgets faster. An implant can only take over if it received the input
through the host and can hold it itself, which takes slow, recurrent dynamics.

Implant neurons keep themselves responsive as host input fades: each copy scales the
gain of its host -> implant synapses to hold the implant's average firing near a target
rate, like homeostatic plasticity in living neurons or automatic gain control in
electronics. Feedback from the implant into the host has a fixed strength.

All dropout levels run side by side in one Brian2 network: one copy of the circuit per
level, with identical wiring and input, differing only in which host neurons are dead.
That is much faster than one run per level, because numpy code generation spends most
of its time on per-time-step overhead rather than per-neuron work.

These are integration proxies and retained task function, not consciousness.
"""

import threading
import time
from dataclasses import dataclass, field, replace

import brian2
import numpy as np
from brian2 import (
    Network,
    NeuronGroup,
    SpikeMonitor,
    Synapses,
    TimedArray,
    defaultclock,
    ms,
    mV,
    network_operation,
    prefs,
    seed,
)

from app import decoding

prefs.codegen.target = "numpy"

POPULATIONS = ("host", "graft", "device")
N_CLASSES = 4  # which of four inputs was shown
DT_MS = 0.25
V_THRESHOLD_MV = -50.0
V_RESET_MV = -60.0
REFRACTORY_MS = 2.0
WARMUP_MS = 1000  # no stimulus; lets activity and adaptive gains settle first
BLOCK_MS = 50  # stimulus timing resolution
STIM_MS = 50  # stimulus on for this long at the start of each trial...
GAP_MS = 150  # ...then off for this long
READOUT_MS = (60, 110)  # spikes counted 10-60 ms after the input ends (memory)
STIM_FRACTION = 0.25  # share of host neurons each input drives
STIM_DRIVE_MV = 6.0
INTRA_DELAY_MS = 1.0
INTER_DELAY_MS = 2.0
RATE_TRACE_MS = 100  # time constant of each neuron's running rate estimate
GAIN_UPDATE_MS = 10
MAX_TOTAL_NEURONS = 3000  # across all copies; keeps live runs bounded

# Brian2 keeps global state, so only one simulation runs at a time.
_lock = threading.Lock()


@dataclass(frozen=True)
class Population:
    """One population of leaky integrate-and-fire neurons.

    Synapses onto a neuron add to a synaptic current that decays with that neuron's
    tau_syn_ms: slow (50 ms, NMDA-like) for living tissue and the ionic gel, fast (5 ms)
    for electronics. Weights are the jump in that current, in mV.
    """

    n: int
    tau_ms: float = 10.0
    sigma_mv: float = 3.0  # membrane noise
    v_drive_mv: float = -54.0  # resting drive; the spike threshold is -50 mV
    frac_inh: float = 0.2
    recurrent_p: float = 0.1
    w_exc_mv: float = 0.5
    w_inh_mv: float = -2.0
    tau_syn_ms: float = 5.0


@dataclass(frozen=True)
class Projection:
    """Connections from the excitatory neurons of one population to another population."""

    pre: str
    post: str
    p: float
    w_mv: float

    @property
    def is_feedback(self) -> bool:
        """Implant -> host."""
        return self.post == "host" and self.pre != "host"

    @property
    def is_input(self) -> bool:
        """Host -> implant: scaled by the implant's adaptive input gain."""
        return self.pre == "host" and self.post != "host"


@dataclass(frozen=True)
class CircuitSpec:
    id: str
    name: str
    description: str
    host: Population
    graft: Population | None = None
    device: Population | None = None
    projections: tuple[Projection, ...] = ()
    dropout: tuple[float, ...] = (0.0, 0.2, 0.4, 0.6, 0.8, 0.9)
    trials_per_condition: int = 20
    implant_target_hz: float = 15.0  # implant rate its adaptive input gain aims for
    adapt_tau_ms: float = 300.0  # how quickly that gain adapts
    max_gain: float = 8.0
    # Share of graft neurons alive (cells lost in the wells before the run); the same
    # dead neurons in every dropout level.
    graft_survival: float = 1.0
    seed: int = 1
    settings: dict = field(default_factory=lambda: {"reciprocity": 1.0, "timescale": 1.0})

    def population(self, name: str) -> Population | None:
        return getattr(self, name)

    @property
    def has_feedback(self) -> bool:
        return any(p.is_feedback and p.p > 0 for p in self.projections)

    @property
    def has_input(self) -> bool:
        return any(p.is_input and p.p > 0 for p in self.projections)


def with_settings(spec: CircuitSpec, reciprocity: float, timescale: float) -> CircuitSpec:
    """Scale feedback and implant speed for the sweep.

    reciprocity multiplies the connection probability of every projection from the
    implant back into the host (0 = one-way implant). timescale multiplies the membrane
    and synaptic time constants of the graft and device populations (2 = twice as slow).
    """
    projections = tuple(
        replace(p, p=min(1.0, p.p * reciprocity)) if p.is_feedback else p for p in spec.projections
    )

    def slowed(pop: Population | None) -> Population | None:
        if pop is None:
            return None
        return replace(pop, tau_ms=pop.tau_ms * timescale, tau_syn_ms=pop.tau_syn_ms * timescale)

    graft, device = slowed(spec.graft), slowed(spec.device)
    return replace(
        spec,
        projections=projections,
        graft=graft,
        device=device,
        settings={"reciprocity": reciprocity, "timescale": timescale},
    )


@dataclass
class Layout:
    """Where each population sits inside one copy of the circuit."""

    sizes: dict[str, int]
    offsets: dict[str, int]
    n_per_copy: int
    is_inh: np.ndarray  # per neuron of one copy

    @classmethod
    def of(cls, spec: CircuitSpec) -> "Layout":
        sizes, offsets, start, inh = {}, {}, 0, []
        for name in POPULATIONS:
            pop = spec.population(name)
            n = pop.n if pop else 0
            sizes[name], offsets[name] = n, start
            n_inh = int(round(n * pop.frac_inh)) if pop else 0
            # The last n_inh neurons of each population are inhibitory.
            inh.extend([False] * (n - n_inh) + [True] * n_inh)
            start += n
        return cls(sizes, offsets, start, np.array(inh, dtype=bool))

    def indices(self, name: str) -> np.ndarray:
        return np.arange(self.offsets[name], self.offsets[name] + self.sizes[name])


@dataclass
class Wiring:
    """Synapses of one copy, as parallel arrays."""

    pre: np.ndarray
    post: np.ndarray
    w_mv: np.ndarray
    delay_ms: np.ndarray
    input: np.ndarray  # bool: host -> implant, scaled by the adaptive input gain

    def __len__(self) -> int:
        return len(self.pre)


def build_wiring(spec: CircuitSpec, layout: Layout, rng: np.random.Generator) -> Wiring:
    parts: list[tuple] = []

    def connect(pre_idx, post_idx, p, w_of_pre, delay_ms, no_self, is_input):
        if p <= 0 or len(pre_idx) == 0 or len(post_idx) == 0:
            return
        mask = rng.random((len(pre_idx), len(post_idx))) < p
        if no_self:
            mask &= pre_idx[:, None] != post_idx[None, :]
        i, j = np.nonzero(mask)
        parts.append((pre_idx[i], post_idx[j], w_of_pre[i], np.full(len(i), delay_ms), np.full(len(i), is_input)))

    for name in POPULATIONS:
        pop = spec.population(name)
        if not pop:
            continue
        idx = layout.indices(name)
        w = np.where(layout.is_inh[idx], pop.w_inh_mv, pop.w_exc_mv)
        connect(idx, idx, pop.recurrent_p, w, INTRA_DELAY_MS, no_self=True, is_input=False)

    for proj in spec.projections:
        if not spec.population(proj.pre) or not spec.population(proj.post):
            continue
        idx = layout.indices(proj.pre)
        exc = idx[~layout.is_inh[idx]]
        w = np.full(len(exc), proj.w_mv)
        connect(exc, layout.indices(proj.post), proj.p, w, INTER_DELAY_MS, False, proj.is_input)

    if not parts:
        return Wiring(*(np.zeros(0, dtype=int) for _ in range(2)), np.zeros(0), np.zeros(0), np.zeros(0, dtype=bool))
    pre, post, w, delay, is_input = (np.concatenate(col) for col in zip(*parts))
    return Wiring(pre.astype(int), post.astype(int), w, delay, is_input.astype(bool))


def run(spec: CircuitSpec, measures: bool = True, phi_max_states: int | None = None) -> dict:
    """Simulate every dropout level of one architecture.

    measures=False skips transfer entropy and PyPhi (used by the parameter sweep).
    phi_max_states limits PyPhi to the most common network states (for live runs).
    """
    with _lock:
        return _run(spec, measures, phi_max_states)


def _run(spec: CircuitSpec, measures: bool, phi_max_states: int | None) -> dict:
    started = time.perf_counter()
    layout = Layout.of(spec)
    n_copies = len(spec.dropout)
    n_per = layout.n_per_copy
    n_total = n_per * n_copies
    if n_total > MAX_TOTAL_NEURONS:
        raise ValueError(f"{n_total} neurons across dropout levels; the limit is {MAX_TOTAL_NEURONS}.")
    assert STIM_MS % BLOCK_MS == 0 and GAP_MS % BLOCK_MS == 0 and WARMUP_MS % BLOCK_MS == 0

    rng = np.random.default_rng(spec.seed)
    # Memory task: each trial shows one of N_CLASSES inputs, equally often, in random order.
    labels = np.repeat(np.arange(N_CLASSES), spec.trials_per_condition)
    rng.shuffle(labels)
    n_trials = len(labels)
    trial_ms = STIM_MS + GAP_MS
    task_ms = n_trials * trial_ms

    # Which host neurons each input drives (the same in every copy).
    host_idx = layout.indices("host")
    patterns = rng.random((N_CLASSES, len(host_idx))) < STIM_FRACTION

    # Dropout: one random order of host neurons; level k removes the first share of it,
    # so each level's dead set contains the previous level's.
    kill_order = rng.permutation(host_idx)
    alive_mask = np.ones((n_copies, n_per))
    for k, frac in enumerate(spec.dropout):
        alive_mask[k, kill_order[: int(round(frac * len(host_idx)))]] = 0
    if spec.graft_survival < 1:
        # Its own generator, so graft survival doesn't shift any other random draw.
        graft_idx = layout.indices("graft")
        n_dead = int(round((1 - spec.graft_survival) * len(graft_idx)))
        alive_mask[:, np.random.default_rng([spec.seed, 1]).permutation(graft_idx)[:n_dead]] = 0

    wiring = build_wiring(spec, layout, rng)

    # Per-neuron parameters for one copy, tiled across copies below.
    params = {key: np.zeros(n_per) for key in ("tau", "sigma", "v_drive", "tau_syn")}
    for name in POPULATIONS:
        pop = spec.population(name)
        if pop:
            idx = layout.indices(name)
            params["tau"][idx] = pop.tau_ms
            params["sigma"][idx] = pop.sigma_mv
            params["v_drive"][idx] = pop.v_drive_mv
            params["tau_syn"][idx] = pop.tau_syn_ms

    # Stimulus as a 2D TimedArray: one row per BLOCK_MS, one column per neuron.
    warmup_blocks, stim_blocks, trial_blocks = WARMUP_MS // BLOCK_MS, STIM_MS // BLOCK_MS, trial_ms // BLOCK_MS
    blocks = np.zeros((warmup_blocks + trial_blocks * n_trials, n_per))
    for t, label in enumerate(labels):
        first = warmup_blocks + t * trial_blocks
        blocks[first : first + stim_blocks, host_idx[patterns[label]]] = STIM_DRIVE_MV
    stim = TimedArray(np.tile(blocks, (1, n_copies)) * mV, dt=BLOCK_MS * ms)

    seed(spec.seed)
    defaultclock.dt = DT_MS * ms
    neurons = NeuronGroup(
        n_total,
        """
        dv/dt = alive * ((v_drive + stim(t, i) + I_syn - v) / tau + sigma * xi * tau**-0.5) : volt (unless refractory)
        dI_syn/dt = -I_syn / tau_syn : volt
        tau_syn : second (constant)
        da/dt = -a / rate_trace : 1
        tau : second (constant)
        sigma : volt (constant)
        v_drive : volt (constant)
        alive : 1 (constant)
        in_gain : 1
        """,
        threshold="v > v_threshold and alive > 0",
        reset="v = v_reset; a += 1",
        refractory=REFRACTORY_MS * ms,
        method="euler",
        namespace={
            "stim": stim,
            "v_threshold": V_THRESHOLD_MV * mV,
            "v_reset": V_RESET_MV * mV,
            "rate_trace": RATE_TRACE_MS * ms,
        },
    )
    neurons.tau = np.tile(params["tau"], n_copies) * ms
    neurons.sigma = np.tile(params["sigma"], n_copies) * mV
    neurons.v_drive = np.tile(params["v_drive"], n_copies) * mV
    neurons.tau_syn = np.tile(params["tau_syn"], n_copies) * ms
    neurons.alive = alive_mask.ravel()
    neurons.in_gain = 1.0
    v0 = rng.uniform(V_RESET_MV, V_THRESHOLD_MV, n_total)
    neurons.v = np.where(alive_mask.ravel() > 0, v0, V_RESET_MV) * mV

    offsets = (np.arange(n_copies) * n_per)[:, None]
    objects = [neurons]
    for is_input, on_pre in ((False, "I_syn_post += w"), (True, "I_syn_post += w * in_gain_post")):
        sel = wiring.input == is_input
        if not sel.any():
            continue
        syn = Synapses(neurons, neurons, "w : volt", on_pre=on_pre)
        syn.connect(i=(wiring.pre[sel][None, :] + offsets).ravel(), j=(wiring.post[sel][None, :] + offsets).ravel())
        syn.w = np.tile(wiring.w_mv[sel], n_copies) * mV
        syn.delay = np.tile(wiring.delay_ms[sel], n_copies) * ms
        objects.append(syn)

    # Adaptive input gain: every copy has its own gain on host -> implant synapses,
    # nudged to hold the implant's mean rate at the target (an integral controller),
    # clipped to [0, max_gain]. Only living implant neurons count toward the rate.
    implant_idx = np.concatenate(
        [layout.indices(n) for n in ("graft", "device") if layout.sizes[n]] or [np.zeros(0, dtype=int)]
    )
    implant_alive = alive_mask[:, implant_idx] > 0
    gains = np.ones(n_copies)
    gain_history = []
    if spec.has_input:

        @network_operation(dt=GAIN_UPDATE_MS * ms)
        def adapt_input_gain(t):
            a = np.asarray(neurons.a[:]).reshape(n_copies, n_per)[:, implant_idx]
            n_alive = np.maximum(implant_alive.sum(axis=1), 1)
            rates = (a * implant_alive).sum(axis=1) / n_alive / (RATE_TRACE_MS / 1000)
            step = GAIN_UPDATE_MS / spec.adapt_tau_ms * (spec.implant_target_hz - rates) / spec.implant_target_hz
            gains[:] = np.clip(gains + step, 0, spec.max_gain)
            neurons.in_gain[:] = np.repeat(gains, n_per)
            if t >= WARMUP_MS * ms:
                gain_history.append(gains.copy())

        objects.append(adapt_input_gain)

    spikes = SpikeMonitor(neurons)
    objects.append(spikes)
    net = Network(*objects)
    built = time.perf_counter()
    net.run((WARMUP_MS + task_ms) * ms)
    simulated = time.perf_counter()

    # Keep only task-period spikes, with times measured from the first trial.
    spike_t = np.asarray(spikes.t / ms) - WARMUP_MS
    spike_i = np.asarray(spikes.i)
    keep = spike_t >= 0
    spike_t, spike_i = spike_t[keep], spike_i[keep]
    copy_of = spike_i // n_per
    local = spike_i % n_per

    implant_names = [n for n in ("graft", "device") if layout.sizes[n]]
    is_implant = np.zeros(n_per, dtype=bool)
    for name in implant_names:
        is_implant[layout.indices(name)] = True
    mean_gain = np.mean(gain_history, axis=0) if gain_history else None

    levels = []
    for k, frac in enumerate(spec.dropout):
        mask = copy_of == k
        t_k, i_k = spike_t[mask], local[mask]
        alive_k = alive_mask[k] > 0
        counts = trial_counts(t_k, i_k, n_trials, trial_ms, n_per)
        present = [n for n in POPULATIONS if layout.sizes[n]]
        level = {
            "host_lost": frac,
            "alive": {n: int(alive_k[layout.indices(n)].sum()) for n in present},
            "rates_hz": {n: round(rate_hz(i_k, layout.indices(n), alive_k, task_ms), 2) for n in present},
            "input_gain": round(float(mean_gain[k]), 3) if mean_gain is not None else None,
            "accuracy": round(decoding.cv_accuracy(counts[:, alive_k], labels, N_CLASSES), 4),
            "accuracy_implant": (
                round(decoding.cv_accuracy(counts[:, is_implant & alive_k], labels, N_CLASSES), 4)
                if implant_names
                else None
            ),
        }
        if measures:
            from app import info, macro_phi  # imported lazily: the sweep doesn't need them

            level["te"] = (
                info.host_implant_te(t_k, i_k, layout, implant_names, task_ms, seed=spec.seed + k)
                if implant_names
                else None
            )
            level["phi"] = macro_phi.analyze(
                t_k, i_k, layout, implant_names, wiring.pre, wiring.post, task_ms, phi_max_states
            )
        levels.append(level)

    chance = 1 / N_CLASSES
    return {
        "id": spec.id,
        "name": spec.name,
        "settings": spec.settings,
        "chance": chance,
        "n_trials": n_trials,
        "task_ms": task_ms,
        "sizes": {n: layout.sizes[n] for n in POPULATIONS if layout.sizes[n]},
        "n_synapses_per_copy": len(wiring),
        "feedback": spec.has_feedback,
        "levels": levels,
        "retained_function": retained_function([lv["accuracy"] for lv in levels], chance),
        "brian2_version": brian2.__version__,
        "build_ms": round((built - started) * 1000),
        "sim_ms": round((simulated - built) * 1000),
        "total_ms": round((time.perf_counter() - started) * 1000),
    }


def trial_counts(t_ms: np.ndarray, i: np.ndarray, n_trials: int, trial_ms: int, n: int) -> np.ndarray:
    """Spike counts per trial and neuron in the readout window."""
    trial = (t_ms // trial_ms).astype(int)
    phase = t_ms - trial * trial_ms
    in_window = (phase >= READOUT_MS[0]) & (phase < READOUT_MS[1]) & (trial < n_trials)
    counts = np.zeros((n_trials, n))
    np.add.at(counts, (trial[in_window], i[in_window]), 1)
    return counts


def rate_hz(i: np.ndarray, idx: np.ndarray, alive: np.ndarray, duration_ms: float) -> float:
    n_alive = int(alive[idx].sum())
    if n_alive == 0:
        return 0.0
    return int(np.isin(i, idx).sum()) / n_alive / (duration_ms / 1000)


def retained_function(accuracies: list[float], chance: float) -> float:
    """Mean accuracy above chance across dropout levels, as a share of perfect (0-1)."""
    above = [(a - chance) / (1 - chance) for a in accuracies]
    return round(float(np.clip(np.mean(above), 0, 1)), 4)


# --- Example architectures ---------------------------------------------------

# Tuned so a healthy host recalls the input ~90% of the time and its memory fades as
# neurons die (about chance with 90% gone).
HOST = Population(n=200, tau_ms=10, sigma_mv=3.0, v_drive_mv=-54.0, recurrent_p=0.1, w_exc_mv=0.2, w_inh_mv=-0.8, tau_syn_ms=50)

EXAMPLES: tuple[CircuitSpec, ...] = (
    CircuitSpec(
        id="host_only",
        name="No implant",
        description="Baseline: the patient's host circuit alone, losing neurons with no implant.",
        host=HOST,
    ),
    CircuitSpec(
        id="one_way_readout",
        name="One-way electronic readout",
        description=(
            "Electrodes record many host neurons and feed an electronic device that computes "
            "on them but never stimulates back. Device units are fast, low-noise integrators "
            "with automatic gain control and no recurrent wiring, like a conventional digital "
            "decoder."
        ),
        host=HOST,
        device=Population(n=100, tau_ms=20, sigma_mv=0.5, v_drive_mv=-56.0, frac_inh=0.0, recurrent_p=0.0, tau_syn_ms=5),
        projections=(Projection("host", "device", p=0.5, w_mv=1.2),),
    ),
    CircuitSpec(
        id="closed_loop_chip",
        name="Closed-loop neuromorphic chip",
        description=(
            "A spiking chip with fast, low-noise recurrent circuits (5 ms synapses) that records "
            "many host neurons and stimulates the host back, raising its input gain as host "
            "signals fade. A digital computer running the same spiking model in real time would "
            "behave the same here; the substrate difference only matters to the frameworks."
        ),
        host=HOST,
        device=Population(n=100, tau_ms=5, sigma_mv=1.0, v_drive_mv=-56.0, recurrent_p=0.1, w_exc_mv=0.6, w_inh_mv=-2.4, tau_syn_ms=5),
        projections=(
            Projection("host", "device", p=0.5, w_mv=1.2),
            Projection("device", "host", p=0.1, w_mv=0.06),
        ),
    ),
    CircuitSpec(
        id="neural_graft",
        name="Engineered neural tissue graft",
        description=(
            "Living graft neurons with their own dense recurrent network and slow, NMDA-like "
            "synapses like the host's. They receive synapses from the host and project back into "
            "it, and homeostatic plasticity makes them more sensitive as host input fades."
        ),
        host=HOST,
        graft=Population(n=100, tau_ms=15, sigma_mv=2.0, v_drive_mv=-56.0, recurrent_p=0.15, w_exc_mv=0.2, w_inh_mv=-0.8, tau_syn_ms=50),
        projections=(
            Projection("host", "graft", p=0.25, w_mv=0.15),
            Projection("graft", "host", p=0.1, w_mv=0.06),
        ),
    ),
    CircuitSpec(
        id="gel_neuron_hybrid",
        name="Gel–neuron hybrid",
        description=(
            "Graft neurons embedded in a conductive gel. The gel adds slow, densely coupled "
            "units that pool activity across the graft and feed it back, a rough stand-in for "
            "field and ionic coupling. The graft neurons adapt like the plain graft."
        ),
        host=HOST,
        graft=Population(n=60, tau_ms=15, sigma_mv=2.0, v_drive_mv=-56.0, recurrent_p=0.15, w_exc_mv=0.2, w_inh_mv=-0.8, tau_syn_ms=50),
        device=Population(n=40, tau_ms=50, sigma_mv=1.0, v_drive_mv=-53.0, frac_inh=0.0, recurrent_p=0.5, w_exc_mv=0.1, tau_syn_ms=50),
        projections=(
            Projection("host", "graft", p=0.25, w_mv=0.15),
            Projection("graft", "host", p=0.1, w_mv=0.06),
            Projection("graft", "device", p=0.3, w_mv=0.4),
            Projection("device", "graft", p=0.3, w_mv=0.09),
        ),
    ),
)

EXAMPLES_BY_ID = {spec.id: spec for spec in EXAMPLES}
