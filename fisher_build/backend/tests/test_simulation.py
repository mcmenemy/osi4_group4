"""Neuron-loss simulation: the decoder, transfer entropy and PyPhi pieces on data with a
known answer, plus small real Brian2 runs and the API."""

import logging
from dataclasses import replace

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app import circuit, decoding, info, macro_phi, main, microwell, simulation

logging.getLogger("brian2").setLevel(logging.ERROR)
client = TestClient(main.app)


@pytest.fixture(autouse=True)
def reset_limits():
    main._recent_requests.clear()


# --- decoder -----------------------------------------------------------------


def test_decoder_reads_a_clear_signal():
    rng = np.random.default_rng(0)
    y = np.repeat([0, 1], 40)
    x = rng.normal(size=(80, 10))
    x[:, 0] += 3 * y  # one informative neuron
    assert decoding.cv_accuracy(x, y, 2) > 0.9


def test_decoder_is_at_chance_on_noise():
    rng = np.random.default_rng(1)
    y = np.repeat([0, 1], 100)
    x = rng.normal(size=(200, 20))
    assert 0.35 < decoding.cv_accuracy(x, y, 2) < 0.65


def test_decoder_needs_a_mixing_feature_for_xor():
    a, b = np.repeat([0, 0, 1, 1], 30), np.tile(np.repeat([0, 1], 30), 2)
    y = a ^ b
    noise = np.random.default_rng(2).normal(scale=0.1, size=(120, 3))
    separate = np.column_stack([a, b, np.zeros(120)]) + noise
    mixed = np.column_stack([a, b, a * b]) + noise  # an AND neuron makes XOR linear
    assert decoding.cv_accuracy(separate, y, 2) < 0.75
    assert decoding.cv_accuracy(mixed, y, 2) > 0.95


def test_decoder_with_no_neurons_returns_chance():
    assert decoding.cv_accuracy(np.zeros((20, 0)), np.repeat([0, 1], 10), 2) == 0.5


def test_folds_are_stratified():
    y = np.repeat([0, 1], 10)
    folds = decoding.stratified_folds(y, 5)
    for f in range(5):
        assert np.bincount(y[folds == f]).tolist() == [2, 2]


# --- transfer entropy --------------------------------------------------------


def test_gaussian_entropy_matches_the_formula():
    rng = np.random.default_rng(3)
    x = rng.normal(scale=2.0, size=(20000, 1))
    expected = 0.5 * np.log(2 * np.pi * np.e * 4.0)
    assert info.gaussian_entropy(x) == pytest.approx(expected, abs=0.02)


def test_te_finds_the_direction_of_a_coupling():
    rng = np.random.default_rng(4)
    x = rng.normal(size=3000)
    y = np.zeros(3000)
    y[1:] = 0.8 * x[:-1] + 0.6 * rng.normal(size=2999)  # x drives y one step later
    forward = info.te_with_null(x, y, rng)
    backward = info.te_with_null(y, x, rng)
    assert forward["significant"] and forward["bits"] > 0.5
    assert not backward["significant"] and abs(backward["bits"]) < 0.05


def test_te_on_a_constant_signal_is_undefined():
    out = info.te_with_null(np.zeros(500), np.arange(500.0), np.random.default_rng(0))
    assert out == {"bits": None, "null_95": None, "significant": False}


def test_copnorm_gives_standard_normal_marginals():
    z = info.copnorm(np.random.default_rng(5).exponential(size=5000))
    assert abs(z.mean()) < 0.02 and abs(z.std() - 1) < 0.03


# --- PyPhi macro model -------------------------------------------------------


def test_tpm_follows_inputs_only():
    rng = np.random.default_rng(6)
    a = rng.integers(0, 2, 2001)
    b = np.zeros(2001, dtype=int)
    b[1:] = a[:-1]  # B copies A with one step delay
    states = np.column_stack([a, b])
    cm = np.array([[0, 1], [0, 0]])  # A -> B only; A has no inputs
    tpm = macro_phi.estimate_tpm(states, cm)
    assert tpm[(1, 0, 1)] > 0.99 and tpm[(0, 1, 1)] < 0.01  # P(B on) follows A
    # A has no parents, so its probability is the same in every state.
    assert np.allclose(tpm[..., 0], tpm[0, 0, 0])


def test_node_connectivity_from_synapses():
    groups = [np.array([0, 1]), np.array([2, 3])]
    cm = macro_phi.node_connectivity(groups, pre=np.array([0, 2]), post=np.array([3, 3]))
    assert cm.tolist() == [[0, 1], [0, 1]]


# --- Brian2 circuit ----------------------------------------------------------

TINY = replace(
    circuit.EXAMPLES_BY_ID["neural_graft"],
    host=replace(circuit.HOST, n=60),
    graft=replace(circuit.EXAMPLES_BY_ID["neural_graft"].graft, n=30),
    dropout=(0.0, 0.5),
    trials_per_condition=6,
)


@pytest.fixture(scope="module")
def tiny_run():
    return circuit.run(TINY, measures=True)


def test_tiny_run_shape(tiny_run):
    assert [lv["host_lost"] for lv in tiny_run["levels"]] == [0.0, 0.5]
    assert tiny_run["levels"][0]["alive"] == {"host": 60, "graft": 30}
    assert tiny_run["levels"][1]["alive"] == {"host": 30, "graft": 30}
    assert tiny_run["n_trials"] == 24
    for lv in tiny_run["levels"]:
        assert 0 <= lv["accuracy"] <= 1
        assert lv["rates_hz"]["host"] > 0
        assert lv["te"]["host_to_implant"]["bits"] is not None
        assert lv["phi"]["nodes"] == ["H1", "H2", "G1", "G2"]
        assert 0 <= lv["phi"]["implant_in_complex"] <= 1


def test_same_seed_is_reproducible(tiny_run):
    again = circuit.run(TINY, measures=False)
    assert [lv["accuracy"] for lv in again["levels"]] == [lv["accuracy"] for lv in tiny_run["levels"]]
    assert [lv["rates_hz"] for lv in again["levels"]] == [lv["rates_hz"] for lv in tiny_run["levels"]]


def test_dead_neurons_never_fire():
    spec = replace(TINY, dropout=(0.9,))
    out = circuit.run(spec, measures=False)
    assert out["levels"][0]["alive"]["host"] == 6
    # rates_hz is per surviving neuron; total host spikes must come from 6 neurons only.
    assert out["levels"][0]["rates_hz"]["host"] < 200


def test_with_settings_scales_feedback_and_speed():
    spec = circuit.EXAMPLES_BY_ID["gel_neuron_hybrid"]
    s = circuit.with_settings(spec, reciprocity=0.0, timescale=2.0)
    assert s.graft.tau_ms == 2 * spec.graft.tau_ms and s.device.tau_ms == 2 * spec.device.tau_ms
    assert s.graft.tau_syn_ms == 2 * spec.graft.tau_syn_ms
    assert s.host == spec.host
    for before, after in zip(spec.projections, s.projections, strict=True):
        assert after.p == (0.0 if before.is_feedback else before.p)
    assert not s.has_feedback and s.settings == {"reciprocity": 0.0, "timescale": 2.0}


def test_too_many_neurons_is_rejected():
    spec = replace(TINY, host=replace(circuit.HOST, n=600), dropout=(0, 0.2, 0.4, 0.6, 0.8))
    with pytest.raises(ValueError):
        circuit.run(spec, measures=False)


def test_graft_survival_kills_graft_neurons_in_every_level():
    out = circuit.run(replace(TINY, graft_survival=0.6), measures=False)
    assert [lv["alive"]["graft"] for lv in out["levels"]] == [18, 18]  # 60% of 30
    assert [lv["alive"]["host"] for lv in out["levels"]] == [60, 30]


def test_graft_survival_leaves_the_wiring_alone(tiny_run):
    """Killing graft neurons must not reshuffle the wiring (it uses its own generator)."""
    out = circuit.run(replace(TINY, graft_survival=0.6), measures=False)
    assert out["n_synapses_per_copy"] == tiny_run["n_synapses_per_copy"]


def test_microwell_specs():
    bare = microwell.spec_for(microwell.BARE_SURVIVAL, microwell.BARE_OUTGROWTH, conductive=False)
    graft = circuit.EXAMPLES_BY_ID["neural_graft"]
    assert microwell.BARE_SURVIVAL == 0.675  # 52% / 77% well occupancy (Brown et al.)
    assert bare.graft_survival == 0.675 and bare.device is None
    for before, after in zip(graft.projections, bare.projections, strict=True):
        assert after.p == pytest.approx(before.p * 0.5)  # every projection here is host <-> graft

    gel = microwell.spec_for(1.0, 2.0, conductive=True)
    assert gel.device == circuit.EXAMPLES_BY_ID["gel_neuron_hybrid"].device
    host_graft = [p for p in gel.projections if {p.pre, p.post} == {"host", "graft"}]
    gel_links = [p for p in gel.projections if "device" in (p.pre, p.post)]
    assert [p.p for p in host_graft] == [min(1.0, p.p * 2) for p in graft.projections]
    assert len(gel_links) == 2  # graft -> gel and gel -> graft, unscaled
    assert microwell.grid()[-1] == (0.675, 0.5, False)


def test_retained_function():
    assert circuit.retained_function([1.0, 1.0], 0.5) == 1.0
    assert circuit.retained_function([0.5, 0.5], 0.5) == 0.0
    assert circuit.retained_function([1.0, 0.5], 0.5) == 0.5
    assert circuit.retained_function([0.3, 0.3], 0.5) == 0.0  # below chance clips to 0


# --- precomputed results and sweep -------------------------------------------


def test_precomputed_results_are_current():
    """Fails if a spec or the simulation code changed without re-running
    `uv run python -m scripts.precompute_sim`."""
    assert simulation.stale_examples(simulation.load("examples")) == []
    assert simulation.is_current("sweep", simulation.load("sweep"))
    assert simulation.is_current("microwell", simulation.load("microwell"))


def test_precomputed_results_have_every_measure():
    data = simulation.load("examples")
    for spec in circuit.EXAMPLES:
        result = data[spec.id]
        assert result["seeds"] == list(simulation.EXAMPLE_SEEDS)
        assert len(result["levels"]) == len(spec.dropout)
        for lv in result["levels"]:
            assert "phi" in lv and "te" in lv and lv["accuracy_sd"] is not None


def test_precomputed_microwell_grid_is_complete():
    wells = simulation.load("microwell")
    grid = {(c["survival"], c["outgrowth"], c["conductive"]) for c in wells["cells"]}
    assert len(grid) == len(wells["cells"]) == len(microwell.grid()) - 1
    assert (wells["bare"]["survival"], wells["bare"]["outgrowth"]) == (microwell.BARE_SURVIVAL, microwell.BARE_OUTGROWTH)
    assert all(0 <= c["retained"] <= 1 for c in wells["cells"])


def test_average_runs_over_seeds():
    def fake(seed, acc, sig):
        te = {"bits": acc, "null_95": 0.1, "significant": sig}
        level = {
            "host_lost": 0.0,
            "alive": {"host": 10},
            "rates_hz": {"host": 10.0 * seed},
            "input_gain": None,
            "accuracy": acc,
            "accuracy_implant": None,
            "te": {"host_to_implant": te, "implant_to_host": te, "bin_ms": 5, "history_bins": 2},
            "phi": {
                "nodes": ["H1"], "cm": [[1]], "mean_phi_s": acc, "implant_in_complex": 0.0,
                "host_in_complex": 1.0, "top_complex": "H1" if seed < 3 else "H2",
                "states_observed": 4, "states_analyzed": 4, "coverage": 1.0, "bin_ms": 10,
            },
        }
        return {
            "id": "x", "name": "X", "settings": {}, "chance": 0.25, "n_trials": 8, "task_ms": 100,
            "sizes": {"host": 10}, "feedback": False, "brian2_version": "2", "seed": seed,
            "levels": [level], "retained_function": acc, "total_ms": 5,
        }

    out = simulation.average_runs([fake(1, 0.5, True), fake(2, 0.7, True), fake(3, 0.9, False)])
    lv = out["levels"][0]
    assert lv["accuracy"] == 0.7 and lv["accuracy_sd"] == pytest.approx(0.1633, abs=1e-4)
    assert lv["rates_hz"]["host"] == 20.0
    assert lv["te"]["host_to_implant"]["significant"] and lv["te"]["host_to_implant"]["significant_seeds"] == 2
    assert lv["phi"]["top_complex"] == "H1"
    assert out["retained_function"] == 0.7 and out["seeds"] == [1, 2, 3] and out["total_ms"] == 15


def test_sweep_summary():
    cells = [
        {"reciprocity": r, "timescale": 1.0, "retained": retained}
        for r, retained in (
            (0.0, {"host_only": 0.5, "a": 0.7, "b": 0.6}),
            (1.0, {"host_only": 0.5, "a": 0.6, "b": 0.7}),
        )
    ]
    for c in cells:
        c["ranking"] = sorted(c["retained"], key=lambda k: -c["retained"][k])
    summary = simulation.analyze_sweep(cells)
    assert summary["default_ranking"] == ["b", "a", "host_only"]
    assert summary["same_ranking"] == 1 and summary["same_winner"] == 1
    assert summary["beats_no_implant"] == {"b": 2, "a": 2}


def test_editing_a_spec_marks_it_stale(monkeypatch):
    data = simulation.load("examples")
    edited = replace(circuit.EXAMPLES[1], seed=99)
    monkeypatch.setattr(circuit, "EXAMPLES", (circuit.EXAMPLES[0], edited, *circuit.EXAMPLES[2:]))
    assert simulation.stale_examples(data) == [edited.id]


# --- API ---------------------------------------------------------------------


def test_sim_overview_endpoint():
    data = client.get("/api/sim").json()
    assert [e["id"] for e in data["examples"]] == [s.id for s in circuit.EXAMPLES]
    assert all(e["result"] is not None for e in data["examples"])
    assert data["sweep"]["summary"]["total"] == 9
    assert data["microwell"]["bare"]["reference"]["citation"].startswith("Brown")
    assert data["task"]["chance"] == 0.25


def test_sim_run_endpoint(monkeypatch):
    calls = []
    monkeypatch.setattr(simulation, "run_live", lambda *args: calls.append(args) or {"ok": True})
    response = client.post("/api/sim/run", json={"id": "neural_graft", "reciprocity": 0.5, "timescale": 2})
    assert response.status_code == 200 and calls == [("neural_graft", 0.5, 2.0)]


@pytest.mark.parametrize(
    "body",
    [{"id": "nope"}, {"id": "neural_graft", "reciprocity": 3}, {"id": "neural_graft", "timescale": 0.1}],
)
def test_sim_run_rejects_bad_input(body, monkeypatch):
    monkeypatch.setattr(simulation, "run_live", lambda *args: pytest.fail("should not run"))
    assert client.post("/api/sim/run", json=body).status_code == 422


def test_sim_run_rate_limit(monkeypatch):
    monkeypatch.setattr(simulation, "run_live", lambda *args: {"ok": True})
    for _ in range(main.SIM_RATE_LIMIT):
        assert client.post("/api/sim/run", json={"id": "host_only"}).status_code == 200
    assert client.post("/api/sim/run", json={"id": "host_only"}).status_code == 429
