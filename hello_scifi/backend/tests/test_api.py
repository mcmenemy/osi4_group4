"""API tests. Claude is mocked, so these run without an API key and cost nothing."""

import pytest
from fastapi.testclient import TestClient

from app import llm, main

client = TestClient(main.app)


@pytest.fixture(autouse=True)
def reset_rate_limit():
    main._recent_requests.clear()


@pytest.fixture
def fake_claude(monkeypatch):
    calls = []

    async def fake_make_scifi(text: str) -> str:
        calls.append(text)
        return f"In the year 3000, {text}"

    monkeypatch.setattr(llm, "make_scifi", fake_make_scifi)
    return calls


def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_scifi_returns_rewrite(fake_claude):
    response = client.post("/api/scifi", json={"text": "I made toast."})
    assert response.status_code == 200
    assert response.json() == {"scifi": "In the year 3000, I made toast."}
    assert fake_claude == ["I made toast."]


@pytest.mark.parametrize("text", ["", "   ", "x" * (main.MAX_CHARS + 1)])
def test_scifi_rejects_bad_input(fake_claude, text):
    response = client.post("/api/scifi", json={"text": text})
    assert response.status_code == 422
    assert fake_claude == []


def test_scifi_refusal(monkeypatch):
    async def refuse(text: str) -> str:
        raise llm.RefusalError

    monkeypatch.setattr(llm, "make_scifi", refuse)
    response = client.post("/api/scifi", json={"text": "hello"})
    assert response.status_code == 422
    assert "declined" in response.json()["detail"]


def test_rate_limit(fake_claude):
    for _ in range(main.RATE_LIMIT):
        assert client.post("/api/scifi", json={"text": "hi"}).status_code == 200
    assert client.post("/api/scifi", json={"text": "hi"}).status_code == 429


def test_scifi_missing_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    response = client.post("/api/scifi", json={"text": "hello"})
    assert response.status_code == 503
    assert "API key" in response.json()["detail"]


def make_score(is_substrate=True, score=2) -> llm.SubstrateScore:
    c = llm.Criterion(score=score, reason="Because.")
    return llm.SubstrateScore(
        is_substrate=is_substrate,
        name="Test gel",
        summary="A test substrate.",
        maintainability=c,
        **{key: c for key in llm.FRAMEWORKS},
    )


@pytest.fixture
def fake_scorer(monkeypatch):
    calls = []
    result = {"value": make_score()}

    async def fake_score_substrate(description: str) -> llm.SubstrateScore:
        calls.append(description)
        return result["value"]

    monkeypatch.setattr(llm, "score_substrate", fake_score_substrate)
    return calls, result


def test_score_returns_scores_and_carry_over(fake_scorer):
    calls, _ = fake_scorer
    response = client.post("/api/score", json={"description": "An ionic gel."})
    assert response.status_code == 200
    data = response.json()
    assert set(data["scores"]) == set(llm.FRAMEWORKS)
    assert data["carry_over"] == 2 * len(llm.FRAMEWORKS)
    assert data["maintainability"] == {"score": 2, "reason": "Because."}
    assert calls == ["An ionic gel."]


def test_score_clamps_out_of_range_scores(fake_scorer):
    _, result = fake_scorer
    result["value"] = make_score(score=7)
    data = client.post("/api/score", json={"description": "x"}).json()
    assert all(s["score"] == 3 for s in data["scores"].values())
    assert data["carry_over"] == 18


def test_score_rejects_non_substrate(fake_scorer):
    _, result = fake_scorer
    result["value"] = make_score(is_substrate=False)
    response = client.post("/api/score", json={"description": "Tell me a joke."})
    assert response.status_code == 422
    assert "substrate" in response.json()["detail"]


@pytest.mark.parametrize("description", ["", "   ", "x" * (main.MAX_DESCRIPTION_CHARS + 1)])
def test_score_rejects_bad_input(fake_scorer, description):
    calls, _ = fake_scorer
    response = client.post("/api/score", json={"description": description})
    assert response.status_code == 422
    assert calls == []


def test_score_missing_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    response = client.post("/api/score", json={"description": "A gel."})
    assert response.status_code == 503
