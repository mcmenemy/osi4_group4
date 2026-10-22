"""Scorecard states and ranking rules."""

from app.scorecard import build_scorecard
from app.schemas import Biology, FieldValue, Properties, Record, Source, SurvivalValue


def rec(rid, key, *, cells=None, setting=None, survival=(), modulus=None, in_brain=None, paper="p1") -> Record:
    bio = None
    if cells:
        bio = Biology(
            cell_type=cells,
            cell_category=cells,
            setting=setting,
            in_brain=in_brain,
            survival=[
                SurvivalValue(measure=m, value=str(v), value_si=v, timepoint_days=d, evidence="q") for m, v, d in survival
            ],
        )
    props = Properties(youngs_modulus=FieldValue(value=str(modulus), unit="Pa", value_si=modulus) if modulus else None)
    return Record(
        record_id=rid, source=Source(title=paper), material_class="nonconductive_hydrogel",
        material=key, material_key=key, properties=props, biology=bio,
    )


def test_brown_style_occupancy_is_partial_and_baseline_is_separate():
    card = build_scorecard(
        [rec("brown", "su8", cells="primary_neuron", setting="in_vivo", in_brain=True, survival=[("occupancy", 52, 21)])]
    )
    base = card["baseline"]
    assert base["material_key"] == "su8"
    assert all(r["material_key"] != "su8" for r in card["ranked"] + card["no_neuron_evidence"])
    assert base["requirements"]["survival"]["state"] == "partial"
    assert base["best_survival"]["measure"] == "occupancy"
    assert "52% occupancy, in vivo, 21 d" in base["requirements"]["survival"]["detail"]


def test_viability_at_three_weeks_is_met_and_short_or_low_is_not():
    card = build_scorecard(
        [
            rec("a", "gelma", cells="primary_neuron", setting="in_vitro_3d", survival=[("viability", 80, 21)]),
            rec("b", "agarose", cells="primary_neuron", setting="in_vitro_3d", survival=[("viability", 90, 7)]),
            rec("c", "fibrin", cells="primary_neuron", setting="in_vitro_3d", survival=[("viability", 20, 21)]),
        ]
    )
    states = {r["material_key"]: r["requirements"]["survival"]["state"] for r in card["ranked"]}
    assert states == {"gelma": "met", "agarose": "partial", "fibrin": "fails"}


def test_materials_without_neuron_records_are_not_ranked():
    card = build_scorecard(
        [
            rec("a", "gelma", cells="primary_neuron", setting="in_vitro_2d", survival=[("viability", 80, 21)]),
            rec("b", "pedot_pss_hydrogel", modulus=2e6),
            rec("c", "fibrin", cells="glia", setting="in_vitro_2d", survival=[("viability", 95, 21)]),
        ]
    )
    assert [r["material_key"] for r in card["ranked"]] == ["gelma"]
    assert {r["material_key"] for r in card["no_neuron_evidence"]} == {"pedot_pss_hydrogel", "fibrin"}


def test_evidence_multiplier_and_weight_override():
    in_vivo = rec("a", "gelma", cells="primary_neuron", setting="in_vivo", survival=[("viability", 80, 21)])
    line = rec("b", "agarose", cells="neuron_like_line", setting="in_vitro_2d", survival=[("viability", 80, 21)])
    card = build_scorecard([in_vivo, line])
    survival_points = {
        r["material_key"]: next(b["points"] for b in r["breakdown"] if b["requirement"] == "survival") for r in card["ranked"]
    }
    assert survival_points == {"gelma": 3.0, "agarose": 0.9}  # 3 x 1.0 x 1.0 vs 3 x 1.0 x 0.3
    zeroed = build_scorecard([in_vivo, line], {"survival": 0})
    assert all(b["points"] == 0 for r in zeroed["ranked"] for b in r["breakdown"] if b["requirement"] == "survival")


def test_soft_uses_extracted_modulus_before_curated():
    card = build_scorecard(
        [rec("a", "gelma", cells="primary_neuron", setting="in_vitro_2d", survival=[("viability", 80, 7)], modulus=5e5)]
    )
    soft = card["ranked"][0]["requirements"]["soft"]
    assert soft["state"] == "partial" and soft["source"] == "extracted"
    curated = build_scorecard([rec("b", "gelma", cells="primary_neuron", setting="in_vitro_2d", survival=[("viability", 80, 7)])])
    soft = curated["ranked"][0]["requirements"]["soft"]
    assert soft["source"] == "curated" and soft["state"] == "met"


def test_uncurated_clear_degradable_is_unknown():
    card = build_scorecard([rec("a", "agarose", cells="primary_neuron", setting="in_vitro_2d", survival=[("viability", 80, 7)])])
    assert card["ranked"][0]["requirements"]["clear_degradable"]["state"] == "unknown"
