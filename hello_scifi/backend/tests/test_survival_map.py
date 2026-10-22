from app.survival_map import build_survival_map, tier_for
from tests.test_scorecard import rec


def test_tiers():
    assert tier_for("primary_neuron", "in_vivo") == "in_vivo"
    assert tier_for("sc_neuron", "in_vitro_3d") == "neurons_in_dish"
    assert tier_for("neuron_like_line", "in_vitro_2d") == "cell_lines"
    assert tier_for("glia", "in_vitro_2d") is None


def test_x_values_from_record_family_or_none():
    card = build_survival_map(
        [
            rec("a", "gelma", cells="primary_neuron", setting="in_vitro_3d", survival=[("viability", 90, 21)], modulus=1000),
            rec("b", "gelma", cells="neuron_like_line", setting="in_vitro_2d", survival=[("viability", 80, 7)]),
            rec("c", "gelma", modulus=3000, conductivity=0.5),
            rec("d", "astro", cells="glia", setting="in_vitro_2d", survival=[("viability", 99, 21)]),
        ]
    )
    pts = {p["record_id"]: p for p in card["points"]}
    assert set(pts) == {"a", "b"}  # non-neuron cells are left out
    assert pts["a"]["x"]["youngs_modulus"] == {"value": 1000, "source": "record"}
    fam = pts["b"]["x"]["youngs_modulus"]
    assert fam["source"] == "family" and fam["value"] == 2000 and fam["n"] == 2
    assert pts["b"]["x"]["conductivity"]["source"] == "family"
    assert "degradation_time" not in pts["b"]["x"]
