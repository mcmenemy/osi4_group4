"""Neuron-loss simulations for the API: precomputed example results, the parameter sweep,
the microwell study, and small live runs.

The precomputed parts take minutes, so `scripts/precompute_sim.py` computes them ahead
of time into three files in `app/data/` (examples, sweep, microwell), which can be
computed in parallel. Precomputed numbers are averaged over several random seeds
(different wiring, input patterns, noise and dropout order), because a single run can be
lucky or unlucky. Every saved result records a hash of its specs and of the simulation
code, so stale results are detected.
"""

import hashlib
import json
from collections import Counter
from dataclasses import replace
from pathlib import Path

import numpy as np

from app import circuit, microwell

DATA = Path(__file__).parent / "data"
FILES = {
    "examples": DATA / "sim_examples.json",
    "sweep": DATA / "sim_sweep.json",
    "microwell": DATA / "sim_microwell.json",
}
MODEL_FILES = ("circuit.py", "decoding.py", "info.py", "macro_phi.py", "microwell.py")

TRIALS = 20  # per input, so 80 trials per dropout level (live and precomputed alike)
EXAMPLE_SEEDS = (1, 2, 3, 4, 5)
SWEEP_SEEDS = (1, 2, 3)
MICROWELL_SEEDS = (1, 2, 3)
LIVE_PHI_STATES = 4
RECIPROCITY_SWEEP = (0.0, 1.0, 2.0)
TIMESCALE_SWEEP = (0.5, 1.0, 2.0)


def model_sha() -> str:
    """Hash of the simulation source code: any change marks saved results as stale."""
    digest = hashlib.sha256()
    for name in MODEL_FILES:
        digest.update((Path(__file__).parent / name).read_bytes())
    return digest.hexdigest()[:16]


def spec_sha(spec: circuit.CircuitSpec) -> str:
    return hashlib.sha256(repr(spec).encode()).hexdigest()[:16]


def precompute_spec(spec: circuit.CircuitSpec) -> circuit.CircuitSpec:
    return replace(spec, trials_per_condition=TRIALS)


def _mean(values: list) -> float | None:
    present = [v for v in values if v is not None]
    return round(float(np.mean(present)), 4) if present else None


def _sd(values: list) -> float | None:
    present = [v for v in values if v is not None]
    return round(float(np.std(present)), 4) if present else None


def average_runs(runs: list[dict]) -> dict:
    """Average several seeds' results level by level.

    Numbers are averaged; transfer entropy counts as significant when it was in the
    majority of seeds; the most common main complex is reported. Accuracy and function
    retained also get their standard deviation across seeds.
    """
    first = runs[0]

    def level(k: int) -> dict:
        lvs = [r["levels"][k] for r in runs]
        out = {
            "host_lost": lvs[0]["host_lost"],
            "alive": lvs[0]["alive"],
            "rates_hz": {pop: _mean([lv["rates_hz"][pop] for lv in lvs]) for pop in lvs[0]["rates_hz"]},
            "input_gain": _mean([lv["input_gain"] for lv in lvs]),
            "accuracy": _mean([lv["accuracy"] for lv in lvs]),
            "accuracy_sd": _sd([lv["accuracy"] for lv in lvs]),
            "accuracy_implant": _mean([lv["accuracy_implant"] for lv in lvs]),
            "accuracy_implant_sd": _sd([lv["accuracy_implant"] for lv in lvs]),
        }
        if "te" in lvs[0]:
            out["te"] = None
            if lvs[0]["te"] is not None:
                te = {}
                for direction in ("host_to_implant", "implant_to_host"):
                    values = [lv["te"][direction] for lv in lvs]
                    n_sig = sum(v["significant"] for v in values)
                    te[direction] = {
                        "bits": _mean([v["bits"] for v in values]),
                        "null_95": _mean([v["null_95"] for v in values]),
                        "significant": n_sig * 2 > len(values),
                        "significant_seeds": n_sig,
                    }
                out["te"] = {**te, "bin_ms": lvs[0]["te"]["bin_ms"], "history_bins": lvs[0]["te"]["history_bins"]}
        if "phi" in lvs[0]:
            phis = [lv["phi"] for lv in lvs]
            out["phi"] = {
                "nodes": phis[0]["nodes"],
                "cm": phis[0]["cm"],
                "mean_phi_s": _mean([ph["mean_phi_s"] for ph in phis]),
                "implant_in_complex": _mean([ph["implant_in_complex"] for ph in phis]),
                "host_in_complex": _mean([ph["host_in_complex"] for ph in phis]),
                "top_complex": Counter(ph["top_complex"] for ph in phis).most_common(1)[0][0],
                "states_observed": _mean([ph["states_observed"] for ph in phis]),
                "states_analyzed": _mean([ph["states_analyzed"] for ph in phis]),
                "coverage": _mean([ph["coverage"] for ph in phis]),
                "bin_ms": phis[0]["bin_ms"],
            }
        return out

    retained = [r["retained_function"] for r in runs]
    return {
        **{key: first[key] for key in ("id", "name", "settings", "chance", "n_trials", "task_ms", "sizes", "feedback", "brian2_version")},
        "seeds": [r["seed"] for r in runs],
        "levels": [level(k) for k in range(len(first["levels"]))],
        "retained_function": _mean(retained),
        "retained_sd": _sd(retained),
        "total_ms": sum(r["total_ms"] for r in runs),
    }


def run_seeds(spec: circuit.CircuitSpec, seeds: tuple[int, ...], measures: bool) -> dict:
    runs = [{**circuit.run(replace(spec, seed=s), measures=measures), "seed": s} for s in seeds]
    return average_runs(runs)


def example_info(spec: circuit.CircuitSpec) -> dict:
    """What the frontend shows about an architecture."""
    return {
        "id": spec.id,
        "name": spec.name,
        "description": spec.description,
        "sizes": {
            name: spec.population(name).n for name in circuit.POPULATIONS if spec.population(name)
        },
        "taus_ms": {
            name: spec.population(name).tau_ms for name in circuit.POPULATIONS if spec.population(name)
        },
        "projections": [
            {"pre": p.pre, "post": p.post, "p": p.p, "w_mv": p.w_mv} for p in spec.projections
        ],
        "feedback": spec.has_feedback,
    }


# --- saved results -----------------------------------------------------------


def load(part: str) -> dict:
    path = FILES[part]
    return json.loads(path.read_text(encoding="utf-8")) if path.is_file() else {}


def save(part: str, data: dict) -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    FILES[part].write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")


def _shas(specs) -> str:
    return hashlib.sha256("".join(spec_sha(s) for s in specs).encode()).hexdigest()[:16]


def stale_examples(saved: dict) -> list[str]:
    """Example ids whose saved result doesn't match the current spec and code."""
    sha = model_sha()
    return [
        spec.id
        for spec in circuit.EXAMPLES
        if spec.id not in saved
        or saved[spec.id].get("spec_sha") != spec_sha(precompute_spec(spec))
        or saved[spec.id].get("model_sha") != sha
    ]


def examples_specs_sha() -> str:
    return _shas(precompute_spec(s) for s in circuit.EXAMPLES)


def microwell_specs() -> list[circuit.CircuitSpec]:
    return [precompute_spec(microwell.spec_for(*cell)) for cell in microwell.grid()]


def is_current(part: str, data: dict) -> bool:
    """Whether a saved sweep or microwell result matches the current specs and code."""
    specs_sha = examples_specs_sha() if part == "sweep" else _shas(microwell_specs())
    return bool(data) and data.get("model_sha") == model_sha() and data.get("specs_sha") == specs_sha


# --- the three precomputed parts ---------------------------------------------


def run_example(spec: circuit.CircuitSpec) -> dict:
    s = precompute_spec(spec)
    return {**run_seeds(s, EXAMPLE_SEEDS, measures=True), "spec_sha": spec_sha(s), "model_sha": model_sha()}


def ranking(retained: dict[str, float]) -> list[str]:
    """Architecture ids from most to least function retained (ties keep example order)."""
    order = [s.id for s in circuit.EXAMPLES]
    return sorted(retained, key=lambda sid: (-retained[sid], order.index(sid)))


def analyze_sweep(cells: list[dict]) -> dict:
    """Does the ranking between architectures hold across reciprocity and timescale settings?"""
    default = next(c for c in cells if c["reciprocity"] == 1.0 and c["timescale"] == 1.0)
    default_ranking = default["ranking"]
    ids = default_ranking
    mean_rank = {sid: sum(c["ranking"].index(sid) + 1 for c in cells) / len(cells) for sid in ids}
    winners: dict[str, int] = {}
    for c in cells:
        winners[c["ranking"][0]] = winners.get(c["ranking"][0], 0) + 1
    return {
        "default_ranking": default_ranking,
        "same_ranking": sum(c["ranking"] == default_ranking for c in cells),
        "same_winner": sum(c["ranking"][0] == default_ranking[0] for c in cells),
        "beats_no_implant": {
            sid: sum(c["retained"][sid] > c["retained"]["host_only"] for c in cells)
            for sid in ids
            if sid != "host_only"
        },
        "winners": winners,
        "mean_rank": {sid: round(r, 2) for sid, r in mean_rank.items()},
        "total": len(cells),
    }


def run_sweep(progress=print) -> dict:
    """Retained function for every architecture at every reciprocity x timescale setting."""
    cache: dict[tuple, float] = {}
    cells = []
    for reciprocity in RECIPROCITY_SWEEP:
        for timescale in TIMESCALE_SWEEP:
            retained = {}
            for spec in circuit.EXAMPLES:
                s = circuit.with_settings(precompute_spec(spec), reciprocity, timescale)
                # Settings that don't change the spec (e.g. reciprocity for an implant with
                # no feedback, or anything for no implant) reuse the earlier run.
                key = (s.id, spec_sha(replace(s, settings={})))
                if key not in cache:
                    cache[key] = run_seeds(s, SWEEP_SEEDS, measures=False)["retained_function"]
                    progress(f"  sweep r={reciprocity} t={timescale} {s.id}: {cache[key]}")
                retained[spec.id] = cache[key]
            cells.append(
                {"reciprocity": reciprocity, "timescale": timescale, "retained": retained, "ranking": ranking(retained)}
            )
    return {
        "reciprocity": list(RECIPROCITY_SWEEP),
        "timescale": list(TIMESCALE_SWEEP),
        "seeds": len(SWEEP_SEEDS),
        "cells": cells,
        "summary": analyze_sweep(cells),
        "model_sha": model_sha(),
        "specs_sha": examples_specs_sha(),
    }


def run_microwell(progress=print) -> dict:
    """Function retained for each graft survival x outgrowth x gel condition."""
    cells = []
    for (survival, outgrowth, conductive), spec in zip(microwell.grid(), microwell_specs(), strict=True):
        result = run_seeds(spec, MICROWELL_SEEDS, measures=False)
        cells.append(
            {
                "survival": survival,
                "outgrowth": outgrowth,
                "conductive": conductive,
                "retained": result["retained_function"],
                "retained_sd": result["retained_sd"],
                "accuracy": [lv["accuracy"] for lv in result["levels"]],
                "graft_rate_hz": result["levels"][0]["rates_hz"].get("graft"),
            }
        )
        progress(f"  microwell s={survival} o={outgrowth} conductive={conductive}: {result['retained_function']}")
    bare = cells.pop()  # grid() lists the bare-well reference last
    return {
        "survival": list(microwell.SURVIVAL_GRID),
        "outgrowth": list(microwell.OUTGROWTH_GRID),
        "seeds": len(MICROWELL_SEEDS),
        "cells": cells,
        "bare": {**bare, "reference": microwell.REFERENCE},
        "model_sha": model_sha(),
        "specs_sha": _shas(microwell_specs()),
    }


# --- API ---------------------------------------------------------------------


def run_live(example_id: str, reciprocity: float, timescale: float) -> dict:
    """One seed, with PyPhi on the most common states only, to keep it quick."""
    spec = precompute_spec(circuit.EXAMPLES_BY_ID[example_id])
    return circuit.run(
        circuit.with_settings(spec, reciprocity, timescale), measures=True, phi_max_states=LIVE_PHI_STATES
    )


def overview() -> dict:
    """Everything the simulation tabs need on load. Stale parts come back as null."""
    examples = load("examples")
    stale = set(stale_examples(examples))
    sweep, wells = load("sweep"), load("microwell")
    return {
        "examples": [
            {**example_info(spec), "result": None if spec.id in stale else examples[spec.id]}
            for spec in circuit.EXAMPLES
        ],
        "sweep": sweep if is_current("sweep", sweep) else None,
        "microwell": wells if is_current("microwell", wells) else None,
        "task": {
            "dropout": list(circuit.EXAMPLES[0].dropout),
            "chance": 1 / circuit.N_CLASSES,
            "stim_ms": circuit.STIM_MS,
            "readout_ms": list(circuit.READOUT_MS),
            "n_classes": circuit.N_CLASSES,
            "trials": TRIALS * circuit.N_CLASSES,
            "example_seeds": len(EXAMPLE_SEEDS),
            "sweep_seeds": len(SWEEP_SEEDS),
        },
        "live": {
            "reciprocity": [min(RECIPROCITY_SWEEP), max(RECIPROCITY_SWEEP)],
            "timescale": [min(TIMESCALE_SWEEP), max(TIMESCALE_SWEEP)],
            "phi_max_states": LIVE_PHI_STATES,
        },
    }
