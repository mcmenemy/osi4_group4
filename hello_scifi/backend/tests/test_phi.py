"""PyPhi package check. Runs real (tiny) analyses, so it proves PyPhi is installed and working."""

import pytest
from fastapi.testclient import TestClient

from app import main, phi

client = TestClient(main.app)


@pytest.fixture(autouse=True)
def reset_rate_limit():
    main._recent_requests.clear()


def test_paper_example_has_positive_phi():
    out = phi.run_phi("iit4_fig1a", 3, 0.1, 0, full=True)
    assert out["formalism"].startswith("IIT_4_0")
    assert out["phi_s"] > 0
    assert out["big_phi"] > out["phi_s"]
    assert out["n_distinctions"] > 0
    assert out["mip"]["cut_edges"]


def test_phi_s_only_skips_structure():
    out = phi.run_phi("random", 5, 0.1, 0, full=False)
    assert out["big_phi"] is None
    assert out["distinctions"] == []
    assert len(out["nodes"]) == 5


def test_random_network_is_reproducible():
    a = phi.run_phi("random", 4, 0.1, 3, full=True)
    b = phi.run_phi("random", 4, 0.1, 3, full=True)
    assert a["cm"] == b["cm"] and a["state"] == b["state"] and a["phi_s"] == b["phi_s"]


def test_phi_endpoint():
    response = client.post("/api/phi/hello", json={"source": "grid3"})
    assert response.status_code == 200
    assert response.json()["nodes"] == ["A", "B", "C"]


@pytest.mark.parametrize(
    "body",
    [
        {"source": "random", "n_nodes": phi.MAX_FULL_NODES + 1, "full": True},
        {"source": "random", "n_nodes": phi.MAX_NODES + 1, "full": False},
        {"source": "nope"},
    ],
)
def test_phi_endpoint_rejects_out_of_range(body):
    assert client.post("/api/phi/hello", json=body).status_code == 422
