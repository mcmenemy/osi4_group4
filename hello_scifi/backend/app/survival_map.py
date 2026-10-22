"""Survival map: one point per reported neuron survival result (as reported, in %), with the
material properties it can be plotted against.

A point's x value comes from its own record when the paper reports that property ("record");
otherwise from the family's median across other records ("family") or, for stiffness, the curated
literature range ("curated"). The frontend shows those as hollow and can hide them.
"""

from collections import defaultdict
from statistics import median

from app.materials import material
from app.scorecard import NEURON_CATEGORIES, _property_members, family_key
from app.schemas import Record

PROPERTIES = [
    {"key": "youngs_modulus", "label": "Stiffness", "unit": "Pa", "log": True},
    {"key": "conductivity", "label": "Conductivity", "unit": "S/m", "log": True},
    {"key": "degradation_time", "label": "Degradation time", "unit": "days", "log": True},
]

TIERS = [
    {"key": "in_vivo", "label": "In vivo"},
    {"key": "neurons_in_dish", "label": "Primary or stem-cell neurons in a dish"},
    {"key": "cell_lines", "label": "Neuron-like cell lines"},
]


def tier_for(cell_category: str | None, setting: str | None) -> str | None:
    if cell_category not in NEURON_CATEGORIES:
        return None
    if setting == "in_vivo":
        return "in_vivo"
    return "cell_lines" if cell_category == "neuron_like_line" else "neurons_in_dish"


def _value(record: Record, prop: str) -> float | None:
    field = getattr(record.properties, prop, None)
    return field.value_si if field and field.value_si is not None else None


def _family_values(recs: list[Record], key: str) -> dict[str, dict]:
    """Family-level value per property: median of extracted values, else curated stiffness."""
    out = {}
    members = _property_members(recs)
    for p in PROPERTIES:
        values = [v for r in members if (v := _value(r, p["key"])) is not None]
        if values:
            out[p["key"]] = {"value": median(values), "range": [min(values), max(values)], "n": len(values), "source": "family"}
    typical = (material(key) or {}).get("literature_typical_stiffness_kpa")
    if "youngs_modulus" not in out and typical and typical.get("citation"):
        lo, hi = (float(x) * 1e3 for x in typical["range"])
        out["youngs_modulus"] = {
            "value": (lo * hi) ** 0.5, "range": [lo, hi], "n": 0, "source": "curated",
            "citation": typical["citation"], "verified": bool(typical.get("verified")),
        }
    return out


def build_survival_map(records: list[Record]) -> dict:
    groups: dict[str, list[Record]] = defaultdict(list)
    for r in records:
        groups[family_key(r)].append(r)

    points = []
    for key, recs in groups.items():
        family = _family_values(recs, key)
        fam = material(key)
        for r in recs:
            bio = r.biology
            if not bio or not bio.survival:
                continue
            for i, s in enumerate(bio.survival):
                setting = s.setting or bio.setting
                tier = tier_for(bio.cell_category, setting)
                if tier is None or s.value_si is None or not 0 <= s.value_si <= 100:
                    continue
                x = {}
                for p in PROPERTIES:
                    own = _value(r, p["key"])
                    if own is not None:
                        x[p["key"]] = {"value": own, "source": "record"}
                    elif p["key"] in family:
                        x[p["key"]] = family[p["key"]]
                points.append(
                    {
                        "id": f"{r.record_id}#{i}",
                        "record_id": r.record_id,
                        "material": r.material,
                        "material_key": key,
                        "family_label": fam["label"] if fam else r.material,
                        "baseline": bool(fam and fam.get("baseline")),
                        "source": f"{r.source.first_author or r.source.title or r.source.file} {r.source.year or ''}".strip(),
                        "measure": s.measure,
                        "percent": s.value_si,
                        "days": s.culture_days,
                        "setting": setting,
                        "cell_category": bio.cell_category,
                        "cell_type": bio.cell_type,
                        "tier": tier,
                        "evidence": s.evidence,
                        "location": s.location,
                        "x": x,
                    }
                )
    return {"properties": PROPERTIES, "tiers": TIERS, "points": points}
