"""Brian2 package check. Runs a real (tiny) simulation, so it proves Brian2 is installed and working."""

import pytest
from fastapi.testclient import TestClient

from app import main, sim

client = TestClient(main.app)


@pytest.fixture(autouse=True)
def reset_rate_limit():
    main._recent_requests.clear()


def test_sim_runs_with_numpy_target():
    out = sim.run_network(n_neurons=50, duration_ms=200, dropout_per_s=0, rng_seed=1)
    assert out["codegen_target"] == "numpy"
    assert out["n_spikes"] > 0
    assert len(out["rate_hz"]) == len(out["alive"]) == 200 // sim.BIN_MS
    assert out["alive"] == [50] * len(out["alive"])


def test_dropout_removes_neurons_during_run():
    out = sim.run_network(n_neurons=200, duration_ms=1000, dropout_per_s=200, rng_seed=1)
    assert out["alive"][0] > out["alive"][-1]
    assert out["alive"] == sorted(out["alive"], reverse=True)


def test_same_seed_is_reproducible():
    a = sim.run_network(n_neurons=50, duration_ms=200, dropout_per_s=100, rng_seed=7)
    b = sim.run_network(n_neurons=50, duration_ms=200, dropout_per_s=100, rng_seed=7)
    assert a["raster"] == b["raster"]
    assert a["alive"] == b["alive"]


def test_sim_endpoint():
    response = client.post("/api/sim/hello", json={"n_neurons": 50, "duration_ms": 200})
    assert response.status_code == 200
    assert response.json()["n_neurons"] == 50


@pytest.mark.parametrize(
    "body",
    [{"n_neurons": sim.MAX_NEURONS + 1}, {"duration_ms": 50}, {"dropout_per_s": -1}],
)
def test_sim_endpoint_rejects_out_of_range(body):
    assert client.post("/api/sim/hello", json=body).status_code == 422
