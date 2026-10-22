"""PyPhi (IIT 4.0) on a coarse-grained, rolled-up model of the simulated circuit.

PyPhi only handles a handful of binary nodes, so each node is a whole population:
the host split into two halves (H1, H2) and the implant as two nodes (graft and device,
or two halves of a single implant population). In each 10 ms bin a node is ON when its
population fires above its own average.

Connectivity between nodes comes from the circuit's actual synapses. Each node's
transition probabilities are estimated from the simulation, conditioned only on the
nodes that connect to it, with add-one smoothing so unseen input patterns default to
50/50. We then compute the maximal complex (the subset of nodes with the highest φ_s)
in every observed state, weighted by how often that state occurred. Live runs analyze
only the most common states (max_states) to stay fast; coverage reports the share of
time those states account for.

Results depend on this grouping. Compare architectures under the same grouping rather
than reading absolute values, and read φ_s as an integration proxy, not consciousness.
"""

import itertools
import os
import threading
from collections import Counter

os.environ.setdefault("PYPHI_WELCOME_OFF", "1")
os.environ.setdefault("PYPHI_AGENT_NOTE_OFF", "1")

import numpy as np  # noqa: E402
import pyphi  # noqa: E402

BIN_MS = 10

# PyPhi keeps global config and caches, so only one analysis runs at a time.
_lock = threading.Lock()


def node_groups(layout, implant_names: list[str]) -> tuple[list[str], list[np.ndarray]]:
    host = layout.indices("host")
    half = len(host) // 2
    labels, groups = ["H1", "H2"], [host[:half], host[half:]]
    if len(implant_names) == 2:
        labels += ["G", "D"]
        groups += [layout.indices("graft"), layout.indices("device")]
    elif len(implant_names) == 1:
        implant = layout.indices(implant_names[0])
        mid = len(implant) // 2
        letter = "G" if implant_names[0] == "graft" else "D"
        labels += [f"{letter}1", f"{letter}2"]
        groups += [implant[:mid], implant[mid:]]
    return labels, groups


def binarize(t_ms, i, groups, duration_ms) -> np.ndarray:
    """(n_bins, n_nodes) array: 1 where a node's spike count is above its own mean."""
    n_bins = int(duration_ms // BIN_MS)
    states = np.zeros((n_bins, len(groups)), dtype=int)
    for k, members in enumerate(groups):
        sel = np.isin(i, members)
        counts, _ = np.histogram(t_ms[sel], bins=n_bins, range=(0, n_bins * BIN_MS))
        states[:, k] = counts > counts.mean()
    return states


def node_connectivity(groups, pre: np.ndarray, post: np.ndarray) -> np.ndarray:
    """cm[a, b] = 1 if any synapse runs from a neuron in group a to one in group b."""
    group_of = np.full(max(int(g.max()) for g in groups) + 1, -1)
    for k, members in enumerate(groups):
        group_of[members] = k
    n = len(groups)
    cm = np.zeros((n, n), dtype=int)
    valid = (pre < len(group_of)) & (post < len(group_of))
    a, b = group_of[pre[valid]], group_of[post[valid]]
    ok = (a >= 0) & (b >= 0)
    cm[a[ok], b[ok]] = 1
    return cm


def estimate_tpm(states: np.ndarray, cm: np.ndarray) -> np.ndarray:
    """State-by-node TPM, shape [2]*n + [n]: P(node j ON at t+1 | state at t).

    Each node's probability depends only on its inputs (cm[:, j]), counted from the
    simulated transitions with add-one smoothing.
    """
    n = states.shape[1]
    now, nxt = states[:-1], states[1:]
    tpm = np.zeros([2] * n + [n])
    for j in range(n):
        parents = np.flatnonzero(cm[:, j])
        on, total = Counter(), Counter()
        for row, nxt_j in zip(map(tuple, now[:, parents]), nxt[:, j]):
            total[row] += 1
            on[row] += int(nxt_j)
        for state in itertools.product((0, 1), repeat=n):
            key = tuple(state[p] for p in parents)
            tpm[state + (j,)] = (on[key] + 1) / (total[key] + 2)
    return tpm


def analyze(t_ms, i, layout, implant_names, pre, post, duration_ms, max_states: int | None = None) -> dict:
    labels, groups = node_groups(layout, implant_names)
    states = binarize(t_ms, i, groups, duration_ms)
    cm = node_connectivity(groups, pre, post)
    tpm = estimate_tpm(states, cm)
    implant_nodes = set(range(2, len(labels)))

    with _lock:
        substrate = pyphi.Substrate(tpm=tpm, cm=cm, node_labels=labels)
        frequency = Counter(map(tuple, states))
        analyzed = frequency.most_common(max_states)
        total = sum(count for _, count in analyzed)
        mean_phi = implant_share = host_share = 0.0
        complexes = Counter()
        for state, count in analyzed:
            weight = count / total
            complex_ = substrate.maximal_complex(state, parallel=False, progress=False)
            members = set(complex_.node_indices) if complex_ else set()
            mean_phi += weight * (float(complex_.phi) if complex_ else 0.0)
            implant_share += weight * bool(members & implant_nodes)
            host_share += weight * bool(members & {0, 1})
            complexes["".join(labels[m] + " " for m in sorted(members)).strip() or "none"] += count

    return {
        "nodes": labels,
        "cm": cm.tolist(),
        "mean_phi_s": round(mean_phi, 4),
        "implant_in_complex": round(implant_share, 3),
        "host_in_complex": round(host_share, 3),
        "top_complex": complexes.most_common(1)[0][0],
        "states_observed": len(frequency),
        "states_analyzed": len(analyzed),
        "coverage": round(total / len(states), 3),
        "bin_ms": BIN_MS,
    }
