"""Brian2 package check: a tutorial-style spiking network with neuron dropout during the run.

This is a generic test that Brian2 installs and runs in the full stack, and a way to
measure simulation speed on the deployed instance. It is not project code: one
population, no host/graft/device split, no task readout.
"""

import threading
import time

import brian2
import numpy as np
from brian2 import (
    Network,
    NeuronGroup,
    SpikeMonitor,
    StateMonitor,
    Synapses,
    defaultclock,
    ms,
    mV,
    prefs,
    seed,
)

# Pure-numpy code generation: no C++ compiler needed, which the deploy image doesn't have.
prefs.codegen.target = "numpy"

MAX_NEURONS = 1000
MAX_DURATION_MS = 2000
MAX_DROPOUT_PER_S = 500
RASTER_NEURONS = 200  # only the first N neurons' spikes are returned, to keep the payload small
BIN_MS = 10  # bin width for rate and alive-count series; also how often dropout is applied

# Brian2 keeps global state, so only one simulation runs at a time.
_lock = threading.Lock()

EQUATIONS = """
dv/dt = alive * ((v_drive - v) / tau + sigma * xi * tau**-0.5) : volt (unless refractory)
alive : 1
"""

PARAMS = {
    "tau": 10 * ms,
    "v_drive": -52 * mV,  # just below threshold; noise makes neurons fire irregularly
    "v_threshold": -50 * mV,
    "v_reset": -60 * mV,
    "sigma": 3 * mV,
    "w_exc": 0.3 * mV,
    "w_inh": -1.2 * mV,
}


def run_network(n_neurons: int, duration_ms: int, dropout_per_s: float, rng_seed: int) -> dict:
    with _lock:
        return _run(n_neurons, duration_ms, dropout_per_s, rng_seed)


def _run(n_neurons: int, duration_ms: int, dropout_per_s: float, rng_seed: int) -> dict:
    started = time.perf_counter()
    seed(rng_seed)
    defaultclock.dt = 0.1 * ms
    namespace = {
        **PARAMS,
        # Chance that a surviving neuron dies in each BIN_MS step.
        "p_drop": dropout_per_s / 100 * BIN_MS / 1000,
    }

    neurons = NeuronGroup(
        n_neurons,
        EQUATIONS,
        threshold="v > v_threshold and alive > 0",
        reset="v = v_reset",
        refractory=5 * ms,
        method="euler",
        namespace=namespace,
    )
    neurons.v = "v_reset + rand() * (v_threshold - v_reset)"
    neurons.alive = 1
    # Dead neurons stop integrating and never spike again, so their synapses go silent.
    neurons.run_regularly(
        "alive = alive * int(rand() >= p_drop)\nv = alive * v + (1 - alive) * v_reset",
        dt=BIN_MS * ms,
    )

    # Sparse random recurrent connections: 80% excitatory, 20% inhibitory neurons.
    synapses = Synapses(neurons, neurons, "w : volt", on_pre="v_post += w", namespace=namespace)
    synapses.connect(condition="i != j", p=0.1)
    n_exc = int(0.8 * n_neurons)
    synapses.w = np.where(synapses.i[:] < n_exc, PARAMS["w_exc"] / mV, PARAMS["w_inh"] / mV) * mV

    spikes = SpikeMonitor(neurons)
    alive_monitor = StateMonitor(neurons, "alive", record=True, dt=BIN_MS * ms)

    net = Network(neurons, synapses, spikes, alive_monitor)
    built = time.perf_counter()
    net.run(duration_ms * ms)
    finished = time.perf_counter()

    spike_times_ms = np.asarray(spikes.t / ms)
    spike_neurons = np.asarray(spikes.i)
    n_bins = int(np.ceil(duration_ms / BIN_MS))
    counts, _ = np.histogram(spike_times_ms, bins=n_bins, range=(0, n_bins * BIN_MS))
    alive_counts = alive_monitor.alive.sum(axis=0)[:n_bins]
    # Mean firing rate per surviving neuron, in Hz.
    rate_hz = np.where(alive_counts > 0, counts / np.maximum(alive_counts, 1) / (BIN_MS / 1000), 0)

    in_raster = spike_neurons < RASTER_NEURONS
    return {
        "brian2_version": brian2.__version__,
        "codegen_target": prefs.codegen.target,
        "n_neurons": n_neurons,
        "duration_ms": duration_ms,
        "dropout_per_s": dropout_per_s,
        "n_synapses": len(synapses),
        "n_spikes": int(spike_times_ms.size),
        "build_ms": round((built - started) * 1000, 1),
        "sim_ms": round((finished - built) * 1000, 1),
        "bin_ms": BIN_MS,
        "rate_hz": np.round(rate_hz, 2).tolist(),
        "alive": alive_counts.astype(int).tolist(),
        "raster_neurons": min(n_neurons, RASTER_NEURONS),
        "raster": {
            "t_ms": np.round(spike_times_ms[in_raster], 1).tolist(),
            "i": spike_neurons[in_raster].astype(int).tolist(),
        },
    }
