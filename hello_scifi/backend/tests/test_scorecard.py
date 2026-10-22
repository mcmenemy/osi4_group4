"""Scorecard states and ranking rules."""

from app.scorecard import build_scorecard
from app.schemas import Biology, FieldValue, Properties, Record, Source, SurvivalValue


def rec(
    rid, key, *, cells=None, setting=None, survival=(), modulus=None, site=None, paper="p1", electrode=None,
    conductivity=None, cls="nonconductive_hydrogel",
) -> Record:
    bio = None
    if cells:
        bio = Biology(
            cell_type=cells,
            cell_category=cells,
            setting=setting,
            tissue_site=site,
            # survival entries: (measure, value, days) or (measure, value, days, setting)
            survival=[
                SurvivalValue(
                    measure=sv[0], value=str(sv[1]), value_si=sv[1], culture_days=sv[2], evidence="q",
                    setting=sv[3] if len(sv) > 3 else setting,
                )
                for sv in survival
            ],
        )
    props = Properties(
        youngs_modulus=FieldValue(value=str(modulus), unit="Pa", value_si=modulus) if modulus else None,
        conductivity=FieldValue(value=str(conductivity), unit="S/m", value_si=conductivity) if conductivity else None,
    )
    return Record(
        record_id=rid, source=Source(title=paper), material_class=cls,
        material=key, material_key=key, properties=props, biology=bio, electrode_material=electrode,
    )


def test_brown_style_occupancy_is_partial_and_baseline_is_separate():
    card = build_scorecard(
        [rec(
                "brown", "su8", cells="primary_neuron", setting="in_vivo", site="brain",
                survival=[("occupancy", 77, 1, "in_vitro_2d"), ("occupancy", 52, 21, "in_vivo")],
            )]
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
    assert {"pedot_pss_hydrogel", "fibrin"} <= {r["material_key"] for r in card["no_neuron_evidence"]}


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


def test_candidate_families_without_records_are_listed_as_unknown():
    card = build_scorecard([])
    keys = {r["material_key"] for r in card["no_neuron_evidence"]}
    assert {"gelma", "hyaluronic_acid", "alginate"} <= keys
    gelma = next(r for r in card["no_neuron_evidence"] if r["material_key"] == "gelma")
    assert gelma["record_count"] == 0
    assert gelma["requirements"]["soft"]["source"] == "curated"


def test_each_survival_value_keeps_its_own_setting():
    card = build_scorecard(
        [
            rec(
                "brown", "su8", cells="primary_neuron", setting="in_vivo", site="brain",
                survival=[("occupancy", 77, 1, "in_vitro_2d"), ("occupancy", 52, 21, "in_vivo")],
            )
        ]
    )
    best = card["baseline"]["best_survival"]
    assert best["label"] == "52% occupancy, in vivo, 21 d"
    assert best["setting"] == "in_vivo"


def test_best_survival_prefers_the_higher_value_on_a_tie():
    card = build_scorecard(
        [
            rec("a", "peg", cells="neuron_like_line", setting="in_vitro_3d", survival=[("neurite_outgrowth", 23, 14)]),
            rec("b", "peg", cells="neuron_like_line", setting="in_vitro_3d", survival=[("neurite_outgrowth", 65, 14)]),
        ]
    )
    row = next(r for r in card["ranked"] if r["material_key"] == "peg")
    assert row["best_survival"]["value"] == 65


def test_in_vivo_brain_needs_brain_tissue_site():
    def state(site):
        card = build_scorecard(
            [rec("a", "fibrin", cells="primary_neuron", setting="in_vivo", site=site, survival=[("viability", 80, 7)])]
        )
        return card["ranked"][0]["requirements"]["in_vivo_brain"]["state"]

    assert state("brain") == "met"
    assert state("peripheral_nerve") == "partial"
    assert state("spinal_cord") == "partial"


def test_only_neuron_categories_count_toward_ranking():
    for category in ("tissue", "glia", "non_neural", "other"):
        card = build_scorecard([rec("a", "agarose", cells=category, setting="in_vivo", site="brain")])
        assert card["ranked"] == [], category
    line = build_scorecard([rec("a", "agarose", cells="neuron_like_line", setting="in_vitro_2d", survival=[("viability", 90, 21)])])
    assert [r["material_key"] for r in line["ranked"]] == ["agarose"]
    assert next(b for b in line["ranked"][0]["breakdown"] if b["requirement"] == "survival")["multiplier"] == 0.3


def test_family_range_and_some_members_coverage():
    card = build_scorecard(
        [
            rec("a", "pedot_pss_hydrogel", cells="primary_neuron", setting="in_vitro_2d", modulus=3.2e4),
            rec("b", "pedot_pss_hydrogel", modulus=2e6),
        ]
    )
    soft = card["ranked"][0]["requirements"]["soft"]
    assert soft["state"] == "met"
    assert soft["coverage"] == "some members"
    assert (soft["members_met"], soft["members_measured"]) == (1, 2)
    assert soft["range"] == "32 kPa to 2 MPa"


def test_electrode_values_do_not_set_family_properties():
    card = build_scorecard(
        [
            rec("cells", "fibrin", cells="primary_neuron", setting="in_vivo", site="peripheral_nerve"),
            rec("array", "fibrin", electrode="PEDOT:PSS", conductivity=5000.0, modulus=2e9, cls="biohybrid_device"),
        ]
    )
    row = card["ranked"][0]
    assert row["requirements"]["conductive"]["state"] == "unknown"
    assert row["requirements"]["soft"]["state"] == "unknown"


def test_gel_coating_on_an_electrode_keeps_its_own_values():
    card = build_scorecard(
        [rec("coat", "pva_pedot", electrode="Platinum", conductivity=0.234, cls="conductive_hydrogel")]
    )
    row = next(r for r in card["no_neuron_evidence"] if r["material_key"] == "pva_pedot")
    assert row["requirements"]["conductive"]["state"] == "partial"


def test_controls_are_never_ranked():
    card = build_scorecard(
        [rec("dish", "culture_plastic", cells="primary_neuron", setting="in_vitro_2d", survival=[("viability", 97, 10)])]
    )
    assert [r["material_key"] for r in card["controls"]] == ["culture_plastic"]
    assert all(r["material_key"] != "culture_plastic" for r in card["ranked"])
