"""Smoke tests for the data and extraction routes under MOCK_LLM=1 (no API key, no cost)."""

import pytest
from fastapi.testclient import TestClient

from app import main

client = TestClient(main.app)


@pytest.fixture(autouse=True)
def mock_llm(monkeypatch):
    monkeypatch.setenv("MOCK_LLM", "1")
    main._recent_requests.clear()


def test_records_references_and_window_load():
    assert client.get("/api/records").status_code == 200
    refs = client.get("/api/references").json()
    assert {r["id"] for r in refs["stiffness"]} >= {"brain", "su8", "silicon"}
    assert all(r["citation"] and r["status"] for r in refs["stiffness"])
    assert client.get("/api/target-window").json()["modulus_pa"]
    assert client.get("/api/proposal").status_code == 404  # retired with the Proposal tab


def test_extract_without_input_returns_verified_mock_record():
    response = client.post("/api/extract")
    assert response.status_code == 200
    data = response.json()
    assert data["mock"] is True
    record = data["records"][0]
    assert record["material"].startswith("MOCK")
    assert record["properties"]["youngs_modulus"]["evidence_verified"] is True
    assert record["flags"] == []


def test_extract_pasted_text_flags_quotes_not_in_that_text():
    response = client.post("/api/extract", data={"text": "An unrelated paragraph about gels."})
    assert response.status_code == 200
    assert response.json()["records"][0]["flags"]


def test_extract_rejects_unreadable_pdf():
    response = client.post("/api/extract", files={"file": ("x.pdf", b"not a pdf", "application/pdf")})
    assert response.status_code == 422


def test_scorecard_endpoint_returns_baseline_and_accepts_weights():
    data = client.get("/api/scorecard").json()
    assert data["baseline"]["material_key"] == "su8"
    assert {"ranked", "no_neuron_evidence", "summary", "weights"} <= data.keys()
    assert client.get("/api/scorecard", params={"survival": 1}).json()["weights"]["survival"] == 1
    assert client.get("/api/scorecard", params={"survival": 99}).status_code == 422
