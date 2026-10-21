"""PyPhi package check: integrated information (IIT 4.0) for a small binary network.

A generic test that PyPhi installs and runs in the full stack, and a way to measure
how run time grows with network size. It is not project code: the networks are
PyPhi's built-in examples or small random ones, not macro-nodes from a simulation.

Two different quantities are reported, and they must not be confused:
- phi_s: system integrated information. Whether the system exists as one whole.
- big_phi: structure integrated information (Φ). The sum of φ over all distinctions
  and relations. Only computed when the full cause-effect structure is requested.
"""

import itertools
import os
import threading
import time

# Silence PyPhi's import-time banners; must be set before the import.
os.environ.setdefault("PYPHI_WELCOME_OFF", "1")
os.environ.setdefault("PYPHI_AGENT_NOTE_OFF", "1")

import numpy as np  # noqa: E402
import pyphi  # noqa: E402

MIN_NODES = 3
MAX_NODES = 7  # φ_s alone: ~1 s locally at 7 nodes
MAX_FULL_NODES = 5  # the full structure jumps from ms at 5 nodes to ~1-2 min at 6
MAX_DISTINCTIONS_SHOWN = 12

EXAMPLES = {
    "iit4_fig1a": ("IIT 4.0 paper, Fig. 1A (3 nodes)", pyphi.examples.iit4_2023_fig1a_system),
    "grid3": ("Grid of 3 nodes", pyphi.examples.grid3_system),
    "basic": ("OR / AND / XOR gates (3 nodes)", pyphi.examples.basic_system),
}

# PyPhi keeps global config and caches, so only one analysis runs at a time.
_lock = threading.Lock()


def random_substrate(n_nodes: int, noise: float, rng_seed: int) -> tuple[pyphi.Substrate, tuple[int, ...]]:
    """A ring (so every node is reachable) plus random extra connections.

    Each node turns on with probability equal to the fraction of its inputs that are
    on, blurred toward 50% by `noise`.
    """
    rng = np.random.default_rng(rng_seed)
    cm = np.zeros((n_nodes, n_nodes), dtype=int)
    for i in range(n_nodes):
        cm[i, (i + 1) % n_nodes] = 1
    extra = rng.random((n_nodes, n_nodes)) < 0.3
    np.fill_diagonal(extra, False)
    cm |= extra.astype(int)

    tpm = np.zeros([2] * n_nodes + [n_nodes])
    for state in itertools.product([0, 1], repeat=n_nodes):
        on = np.array(state)
        for j in range(n_nodes):
            p_on = on[np.flatnonzero(cm[:, j])].mean()
            tpm[state + (j,)] = noise / 2 + (1 - noise) * p_on

    labels = [chr(ord("A") + i) for i in range(n_nodes)]
    current = tuple(int(v) for v in rng.integers(0, 2, n_nodes))
    return pyphi.Substrate(tpm=tpm, cm=cm, node_labels=labels), current


def run_phi(source: str, n_nodes: int, noise: float, rng_seed: int, full: bool) -> dict:
    with _lock:
        return _run(source, n_nodes, noise, rng_seed, full)


def _run(source: str, n_nodes: int, noise: float, rng_seed: int, full: bool) -> dict:
    if source == "random":
        substrate, state = random_substrate(n_nodes, noise, rng_seed)
        title = f"Random network ({n_nodes} nodes)"
    else:
        title, make_system = EXAMPLES[source]
        system = make_system()
        substrate, state = system.substrate, tuple(int(v) for v in system.state)

    started = time.perf_counter()
    result = pyphi.analyze(
        substrate, state, compute=None if full else "sia", progress=False, parallel=False
    )
    elapsed_ms = (time.perf_counter() - started) * 1000
    sia = result.sia if full else result

    labels = list(substrate.node_labels)
    partition = getattr(sia, "partition", None)
    out = {
        "pyphi_version": pyphi.__version__,
        "formalism": str(getattr(result, "formalism", "")),
        "title": title,
        "nodes": labels,
        "cm": np.asarray(substrate.cm).astype(int).tolist(),
        "state": list(state),
        "phi_s": float(sia.phi),
        "intrinsic_information": float(sia.intrinsic_information),
        "mip": None,
        "full": full,
        "big_phi": None,
        "sum_phi_distinctions": None,
        "sum_phi_relations": None,
        "n_distinctions": None,
        "distinctions": [],
        "elapsed_ms": round(elapsed_ms, 1),
    }
    if partition is not None:
        out["mip"] = {
            "parts": [[labels[i] for i in part] for part in partition.parts],
            "cut_edges": sorted([labels[a], labels[b]] for a, b in partition.removed_edges()),
        }
    if full:
        ces = result.ces
        distinctions = sorted(ces.distinctions, key=lambda d: d.phi, reverse=True)
        out.update(
            big_phi=float(result.big_phi),
            sum_phi_distinctions=float(ces.sum_phi_distinctions),
            sum_phi_relations=float(ces.sum_phi_relations),
            n_distinctions=len(distinctions),
            distinctions=[
                {
                    "mechanism": d.mechanism_label,
                    "phi": round(float(d.phi), 4),
                    "cause": d.cause_purview_label,
                    "effect": d.effect_purview_label,
                }
                for d in distinctions[:MAX_DISTINCTIONS_SHOWN]
            ],
        )
    return out
