"""Candidate well-fill scorecard: one row per material family, scored against requirements.

Rows are ranked on requirement states (met / partial / unknown / fails), never on raw numbers,
so different survival measures (viability vs. occupancy) are never compared directly. All
weights, thresholds, and multipliers live in data/scorecard.yaml.
"""

import os
from collections import defaultdict
from functools import lru_cache
from pathlib import Path

import yaml

from app.materials import fallback_key, load_materials, match_material, material
from app.schemas import Record

_DATA_DIR = Path(os.environ.get("DATA_DIR", Path(__file__).resolve().parents[2] / "data"))

REQUIREMENTS = [
    ("survival", "Neuron survival ≥3 wk"),
    ("soft", "Stiffness ≤100 kPa"),
    ("in_vivo_brain", "In vivo in brain"),
    ("clear_degradable", "Clear & degradable"),
    ("conductive", "Conductive (future recording layer)"),
]
NEURON_CATEGORIES = {"primary_neuron", "sc_neuron", "neuron_like_line"}
_STATE_ORDER = {"met": 3, "partial": 2, "fails": 1, "unknown": 0}


@lru_cache
def load_config() -> dict:
    return yaml.safe_load((_DATA_DIR / "scorecard.yaml").read_text())


def family_key(r: Record) -> str:
    # Older records may predate material_key; match them by name the same way extraction does.
    return r.material_key or match_material(r.material) or fallback_key(r.material)


def multiplier_for(cell_category: str | None, setting: str | None, cfg: dict) -> float:
    m = cfg["evidence_multipliers"]
    if not cell_category:
        return m["no_cells"]
    if cell_category in ("primary_neuron", "sc_neuron"):
        return {"in_vivo": m["neuron_in_vivo"], "in_vitro_3d": m["neuron_in_vitro_3d"]}.get(
            setting or "", m["neuron_in_vitro_2d"]
        )
    if cell_category == "neuron_like_line":
        return m["neuron_like_line"]
    return m["other_cells"]


def evidence_multiplier(record: Record, cfg: dict) -> float:
    bio = record.biology
    return multiplier_for(bio.cell_category if bio else None, bio.setting if bio else None, cfg)


def _requirement(
    state: str, source: str | None, records: list[str], detail: str, multiplier: float, **extra
) -> dict:
    return {"state": state, "source": source, "records": records, "detail": detail, "multiplier": multiplier, **extra}


def _unknown(detail: str = "No evidence yet") -> dict:
    return _requirement("unknown", None, [], detail, 0.0)


def _coverage(met: int, measured: int) -> dict:
    """How many family members meet a requirement; "met" for a family can mean only some do."""
    if measured == 0:
        return {}
    return {
        "members_met": met,
        "members_measured": measured,
        "coverage": "all members" if met == measured else "some members" if met else "no members",
    }


def fmt_pa(pa: float) -> str:
    for factor, unit in ((1e9, "GPa"), (1e6, "MPa"), (1e3, "kPa")):
        if pa >= factor:
            return f"{pa / factor:.3g} {unit}"
    return f"{pa:.3g} Pa"


def _survival_state(s, th: dict) -> str | None:
    pct, days = s.value_si, s.culture_days
    if s.measure in ("viability", "retention") and pct is not None:
        if pct < th["survival_fail_percent"]:
            return "fails"
        if days is not None and days >= th["survival_days"] and pct >= th["survival_min_percent"]:
            return "met"
        return "partial"
    if s.measure in ("occupancy", "neurite_outgrowth"):
        return "partial"  # cells present, but not shown to be healthy
    return None


def _survival(recs: list[Record], cfg: dict) -> tuple[dict, dict | None]:
    th = cfg["thresholds"]
    sv = cfg["state_values"]
    # Best = highest (points, state, evidence multiplier, latest timepoint, value); later timepoints win
    # ties because a 3-week result says more about survival than a day-1 one.
    best: tuple | None = None
    ids, members_met = [], 0
    for r in recs:
        if not r.biology or not r.biology.survival:
            continue
        ids.append(r.record_id)
        record_met = False
        for s in r.biology.survival:
            state = _survival_state(s, th)
            if state is None:
                continue
            record_met |= state == "met"
            setting = s.setting or r.biology.setting
            mult = multiplier_for(r.biology.cell_category, setting, cfg)
            days = s.culture_days
            when = f"{days:g} d" if days is not None else "time not stated"
            detail = f"{s.value}% {s.measure.replace('_', ' ')}, {(setting or 'setting not stated').replace('_', ' ')}, {when}"
            info = {
                "value": s.value_si,
                "measure": s.measure,
                "setting": setting,
                "cell_category": r.biology.cell_category,
                "culture_days": days,
                "is_neuron": r.biology.cell_category in NEURON_CATEGORIES,
                "record_id": r.record_id,
                "evidence": s.evidence,
                "location": s.location,
                "label": detail,
            }
            key = (sv[state] * mult, _STATE_ORDER[state], mult, days or 0, s.value_si or 0)
            if best is None or key > best[0]:
                best = (key, _requirement(state, "extracted", [], detail, mult), info)
        members_met += record_met
    if best is None:
        return _unknown(), None
    req, info = best[1], best[2]
    req["records"] = ids
    req.update(_coverage(members_met, len(ids)))
    return req, info


def _in_vivo_records(recs: list[Record]) -> list[Record]:
    return [
        r for r in recs
        if r.biology and (r.biology.setting == "in_vivo" or any(s.setting == "in_vivo" for s in r.biology.survival))
    ]


def _in_vivo_brain(recs: list[Record], cfg: dict) -> dict:
    """Met only for tissue_site = brain; spinal cord, peripheral nerve, or other sites are partial."""
    vivo = _in_vivo_records(recs)
    if not vivo:
        return _unknown()
    brain = [r for r in vivo if r.biology.tissue_site == "brain"]
    pool, state = (brain, "met") if brain else (vivo, "partial")
    best = max(pool, key=lambda r: multiplier_for(r.biology.cell_category, "in_vivo", cfg))
    site = (best.biology.tissue_site or "site not stated").replace("_", " ")
    cells = best.biology.cell_type or "cells not stated"
    return _requirement(
        state, "extracted", [r.record_id for r in pool], f"{site}: {cells}",
        multiplier_for(best.biology.cell_category, "in_vivo", cfg),
        **_coverage(len(brain), len(vivo)),
    )


DEVICE_CLASSES = {"biohybrid_device", "oect_device"}


def _property_members(recs: list[Record]) -> list[Record]:
    """Records whose property values describe this family's material.

    A device-level record with a separate electrode material (e.g. Rochford's PEDOT:PSS array under
    a fibrin cell layer) measures the electrode, not the cell carrier, so it's left out. A gel coating
    on a platinum electrode (material class: hydrogel) still reports the gel's own values.
    """
    return [r for r in recs if not (r.electrode_material and r.material_class in DEVICE_CLASSES)]


def _soft(recs: list[Record], fam: dict | None, cfg: dict) -> dict:
    th = cfg["thresholds"]

    def state_for(pa: float) -> str:
        if pa <= th["soft_max_pa"]:
            return "met"
        return "partial" if pa <= th["soft_partial_max_pa"] else "fails"

    measured = [
        r for r in _property_members(recs) if r.properties.youngs_modulus and r.properties.youngs_modulus.value_si
    ]
    if measured:
        values = sorted(r.properties.youngs_modulus.value_si for r in measured)
        softest = min(measured, key=lambda r: r.properties.youngs_modulus.value_si)
        methods = sorted({r.properties.youngs_modulus.test_method for r in measured if r.properties.youngs_modulus.test_method})
        span = fmt_pa(values[0]) if len(values) == 1 else f"{fmt_pa(values[0])} to {fmt_pa(values[-1])}"
        met = sum(1 for v in values if v <= th["soft_max_pa"])
        method = f" ({', '.join(m.replace('_', ' ') for m in methods)})" if methods else ""
        return _requirement(
            state_for(softest.properties.youngs_modulus.value_si), "extracted", [r.record_id for r in measured],
            f"{span}{method}; {met} of {len(values)} ≤ {fmt_pa(th['soft_max_pa'])}", 1.0,
            range=span, **_coverage(met, len(values)),
        )
    typical = (fam or {}).get("literature_typical_stiffness_kpa")
    if typical and typical.get("citation"):
        lo, hi = (float(x) for x in typical["range"])
        span = f"{fmt_pa(lo * 1e3)} to {fmt_pa(hi * 1e3)}"
        return _requirement(
            state_for(lo * 1e3), "curated", [], f"literature-typical {span}", cfg["curated_multiplier"],
            range=span, verified=bool(typical.get("verified")),
        )
    return _unknown()


def _curated(fam: dict | None, field: str) -> str | None:
    """A curated value counts only with a citation; "unknown" counts as no value."""
    entry = (fam or {}).get(field)
    if not entry or not entry.get("citation") or entry.get("value") in (None, "unknown"):
        return None
    return entry["value"]


def _clear_degradable(recs: list[Record], fam: dict | None, cfg: dict) -> dict:
    transparency = _curated(fam, "transparency")
    degradable = _curated(fam, "degradable")
    degraded = [r for r in recs if r.properties.degradation_time and r.properties.degradation_time.value_si]
    source = "curated"
    if degraded:
        degradable, source = "yes", "extracted"
    if transparency is None and degradable is None:
        return _unknown("Not curated yet: add a citation in data/materials.yaml")
    good_t = transparency == "clear"
    good_d = degradable in ("yes", "tunable")
    if transparency == "opaque" or degradable == "no":
        state = "fails"
    elif good_t and good_d:
        state = "met"
    else:
        state = "partial"
    detail = f"transparency: {transparency or 'unknown'}, degradable: {degradable or 'unknown'}"
    mult = 1.0 if source == "extracted" else cfg["curated_multiplier"]
    verified = all(((fam or {}).get(f) or {}).get("verified") for f in ("transparency", "degradable") if _curated(fam, f))
    return _requirement(state, source, [r.record_id for r in degraded], detail, mult, verified=verified)


def _conductive(recs: list[Record], cfg: dict) -> dict:
    th = cfg["thresholds"]
    measured = [r for r in _property_members(recs) if r.properties.conductivity and r.properties.conductivity.value_si]
    if not measured:
        return _unknown()
    values = sorted(r.properties.conductivity.value_si for r in measured)
    best = values[-1]
    state = "met" if best >= th["conductive_min_s_m"] else "partial" if best >= th["conductive_partial_min_s_m"] else "fails"
    span = f"{values[0]:.3g} S/m" if len(values) == 1 else f"{values[0]:.3g} to {values[-1]:.3g} S/m"
    met = sum(1 for v in values if v >= th["conductive_min_s_m"])
    return _requirement(
        state, "extracted", [r.record_id for r in measured], f"{span}; {met} of {len(values)} ≥ {th['conductive_min_s_m']} S/m",
        1.0, range=span, **_coverage(met, len(values)),
    )


def _row(key: str, recs: list[Record], cfg: dict, weights: dict) -> dict:
    fam = material(key)
    survival, best_survival = _survival(recs, cfg)
    reqs = {
        "survival": survival,
        "soft": _soft(recs, fam, cfg),
        "in_vivo_brain": _in_vivo_brain(recs, cfg),
        "clear_degradable": _clear_degradable(recs, fam, cfg),
        "conductive": _conductive(recs, cfg),
    }
    sv = cfg["state_values"]
    breakdown = []
    for name, label in REQUIREMENTS:
        req = reqs[name]
        points = weights[name] * sv[req["state"]] * req["multiplier"]
        breakdown.append(
            {
                "requirement": name,
                "label": label,
                "weight": weights[name],
                "state": req["state"],
                "state_value": sv[req["state"]],
                "multiplier": req["multiplier"],
                "points": round(points, 3),
            }
        )
    papers = {r.source.doi or r.source.title or r.source.file for r in recs}
    bonus = min(cfg["paper_bonus_cap"], cfg["paper_bonus_per_extra_paper"] * max(0, len(papers) - 1))
    neuron_records = [r for r in recs if r.biology and r.biology.cell_category in NEURON_CATEGORIES]
    return {
        "material_key": key,
        "label": fam["label"] if fam else recs[0].material,
        "material_class": fam["class"] if fam else recs[0].material_class,
        "candidate": bool(fam and fam.get("candidate")),
        "note": fam.get("note") if fam else None,
        "curated": {
            "transparency": (fam or {}).get("transparency"),
            "degradable": (fam or {}).get("degradable"),
            "literature_typical_stiffness_kpa": (fam or {}).get("literature_typical_stiffness_kpa"),
        },
        "requirements": reqs,
        "unknown_count": sum(1 for r in reqs.values() if r["state"] == "unknown"),
        "best_survival": best_survival,
        "record_ids": [r.record_id for r in recs],
        "record_count": len(recs),
        "neuron_record_count": len(neuron_records),
        "paper_count": len(papers),
        "paper_bonus": round(bonus, 3),
        "score": round(sum(b["points"] for b in breakdown) + bonus, 3),
        "breakdown": breakdown,
    }


def build_scorecard(records: list[Record], weight_overrides: dict[str, float] | None = None) -> dict:
    cfg = load_config()
    weights = {**cfg["weights"], **{k: v for k, v in (weight_overrides or {}).items() if v is not None}}
    groups: dict[str, list[Record]] = defaultdict(list)
    for r in records:
        groups[family_key(r)].append(r)

    # Candidate families stay on the card with no records yet; their unknowns are the to-do list.
    for fam in load_materials():
        if fam.get("candidate"):
            groups.setdefault(fam["key"], [])

    baseline = None
    ranked, no_neuron, controls = [], [], []
    for key, recs in groups.items():
        row = _row(key, recs, cfg, weights)
        fam = material(key)
        if fam and fam.get("baseline"):
            baseline = row
        elif fam and fam.get("control"):
            controls.append(row)  # e.g. culture plastic: a comparison, never a candidate well fill
        elif row["neuron_record_count"] > 0:
            ranked.append(row)
        else:
            no_neuron.append(row)
    if baseline is None and material("su8"):
        baseline = _row("su8", [], cfg, weights)  # always show the baseline, even with no records

    ranked.sort(key=lambda r: (-r["score"], r["label"]))
    no_neuron.sort(key=lambda r: (-r["record_count"], r["label"]))
    rows = ranked + no_neuron + ([baseline] if baseline else [])
    return {
        "weights": weights,
        "default_weights": cfg["weights"],
        "thresholds": cfg["thresholds"],
        "requirements": [{"key": k, "label": label} for k, label in REQUIREMENTS],
        "baseline": baseline,
        "ranked": ranked,
        "no_neuron_evidence": no_neuron,
        "controls": controls,
        "summary": {
            "materials": len(ranked) + len(no_neuron),
            "ranked_materials": len(ranked),
            "neuron_records": sum(r["neuron_record_count"] for r in rows if r is not baseline),
            "unknown_cells": sum(r["unknown_count"] for r in ranked + no_neuron),
        },
    }
