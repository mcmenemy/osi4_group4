"""Rubric math, Claude output handling and the scoring API. Claude is mocked, so these run
without an API key and cost nothing."""

import asyncio
import copy

import pytest
from fastapi.testclient import TestClient

from app import main, presets, rubric, scoring

client = TestClient(main.app)


@pytest.fixture(autouse=True)
def reset_limits():
    main._recent_requests.clear()
    main._score_cache.clear()
    main._daily_scores["count"] = 0


def fake_raw(verdict: str = "met", is_substrate: bool = True) -> dict:
    """A complete flat answer in the shape Claude returns."""
    return {
        "is_substrate": is_substrate,
        "interpretation": "A test substrate.",
        "judgements": [
            {"criterion": key, "reasoning": f"Because {key}.", "verdict": verdict}
            for key in rubric.criterion_keys()
        ],
        "summaries": [{"framework": f.id, "summary": f"{f.name} fits."} for f in rubric.ALL_SCORED],
    }


# --- scoring formula ---------------------------------------------------------


def verdicts_for(framework: rubric.Framework, *values: str) -> dict[str, str]:
    return {c.id: v for c, v in zip(framework.criteria, values, strict=True)}


def framework(fid: str) -> rubric.Framework:
    return next(f for f in rubric.ALL_SCORED if f.id == fid)


def test_all_met_scores_three_and_all_not_met_scores_zero():
    for f in rubric.ALL_SCORED:
        assert rubric.framework_score(f, {c.id: "met" for c in f.criteria}) == 3
        assert rubric.framework_score(f, {c.id: "not_met" for c in f.criteria}) == 0


def test_score_rounds_half_up():
    # Maintainability has no core criteria: 2.5 of 4 points -> 1.875 -> 2.
    m = rubric.MAINTAINABILITY
    assert rubric.framework_score(m, verdicts_for(m, "met", "met", "partial", "not_met")) == 2
    # 2 of 4 points -> exactly 1.5 -> rounds up to 2.
    assert rubric.framework_score(m, verdicts_for(m, "met", "met", "not_met", "not_met")) == 2
    # 1.5 of 4 points -> 1.125 -> 1.
    assert rubric.framework_score(m, verdicts_for(m, "met", "partial", "not_met", "not_met")) == 1


def test_core_not_met_caps_at_zero():
    iit = framework("iit")
    # Everything met except integration (core): a feedforward system has Φ = 0.
    assert rubric.framework_score(iit, verdicts_for(iit, "met", "not_met", "met", "met")) == 0


def test_core_partial_or_unclear_caps_at_two():
    gw = framework("global_workspace")
    assert rubric.framework_score(gw, verdicts_for(gw, "met", "partial", "met", "met")) == 2
    assert rubric.framework_score(gw, verdicts_for(gw, "met", "unclear", "met", "met")) == 2


def test_every_framework_has_a_core_criterion_and_unique_keys():
    for f in rubric.FRAMEWORKS:
        assert any(c.core for c in f.criteria), f.id
    keys = rubric.criterion_keys()
    assert len(keys) == len(set(keys))


def test_combined_support_is_the_mean():
    assert rubric.combined_support([3, 2, 1, 0, 0, 0]) == 1.0
    assert rubric.combined_support([3, 3, 3, 3, 3, 2]) == 2.83


# --- Claude output handling --------------------------------------------------


def test_normalize_reshapes_flat_lists():
    out = rubric.normalize_judgement(fake_raw())
    assert set(out["frameworks"]) == {f.id for f in rubric.FRAMEWORKS}
    assert out["frameworks"]["iit"]["criteria"]["integration"]["verdict"] == "met"
    assert out["maintainability"]["summary"] == "Maintainability fits."


def test_normalize_rejects_missing_or_repeated_items():
    missing = fake_raw()
    missing["judgements"].pop()
    with pytest.raises(rubric.IncompleteJudgementError):
        rubric.normalize_judgement(missing)

    repeated = fake_raw()
    repeated["judgements"].append(repeated["judgements"][0])
    with pytest.raises(rubric.IncompleteJudgementError):
        rubric.normalize_judgement(repeated)

    no_summary = fake_raw()
    no_summary["summaries"].pop()
    with pytest.raises(rubric.IncompleteJudgementError):
        rubric.normalize_judgement(no_summary)


def test_schema_lists_every_criterion():
    schema = rubric.output_schema()
    enum = schema["properties"]["judgements"]["items"]["properties"]["criterion"]["enum"]
    assert enum == rubric.criterion_keys()
    assert all(key in scoring.SYSTEM_PROMPT for key in enum)


def test_judge_retries_an_incomplete_answer_once(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test")
    incomplete = fake_raw()
    incomplete["judgements"].pop()
    answers = [incomplete, fake_raw()]

    async def fake_ask(description):
        return answers.pop(0), "claude-test"

    monkeypatch.setattr(scoring, "_ask", fake_ask)
    judgement, model = asyncio.run(scoring.judge("x"))
    assert model == "claude-test" and answers == []
    assert judgement["frameworks"]["iit"]["summary"] == "Integrated information theory fits."


def test_judge_gives_up_after_two_incomplete_answers(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test")
    incomplete = fake_raw()
    incomplete["summaries"].pop()

    async def fake_ask(description):
        return copy.deepcopy(incomplete), "claude-test"

    monkeypatch.setattr(scoring, "_ask", fake_ask)
    with pytest.raises(scoring.IncompleteError):
        asyncio.run(scoring.judge("x"))


def test_build_result_computes_scores_from_verdicts():
    raw = fake_raw("met")
    for item in raw["judgements"]:
        if item["criterion"].startswith("orch_or."):
            item["verdict"] = "not_met"
    result = scoring.build_result(rubric.normalize_judgement(raw))
    scores = {f["id"]: f["score"] for f in result["frameworks"]}
    assert scores["orch_or"] == 0 and scores["iit"] == 3
    assert result["combined_support"] == 2.5
    assert result["frameworks_supporting"] == 5
    assert result["maintainability"]["score"] == 3
    # A single run counts as unanimous everywhere.
    assert result["runs"] == 1 and result["unanimous"] == result["criteria_total"] == 25


# --- consensus across runs ---------------------------------------------------


def test_consensus_verdict_uses_the_majority():
    assert scoring.consensus_verdict(["met", "met", "partial"]) == "met"
    assert scoring.consensus_verdict(["not_met", "partial", "not_met"]) == "not_met"


def test_consensus_verdict_without_a_majority_takes_the_middle():
    assert scoring.consensus_verdict(["met", "partial", "not_met"]) == "partial"
    assert scoring.consensus_verdict(["met", "unclear", "partial"]) == "partial"
    assert scoring.consensus_verdict(["not_met", "unclear", "partial"]) == "unclear"


def run_with(verdict_for: dict[str, str], default: str = "met", tag: str = "") -> dict:
    raw = fake_raw(default)
    for item in raw["judgements"]:
        item["verdict"] = verdict_for.get(item["criterion"], default)
        item["reasoning"] = f"{tag}{item['verdict']}"
    for item in raw["summaries"]:
        item["summary"] = f"{tag}summary"
    return rubric.normalize_judgement(raw)


def test_consensus_combines_runs():
    runs = [
        run_with({"iit.integration": "not_met"}, tag="A:"),
        run_with({"iit.integration": "partial"}, tag="B:"),
        run_with({"iit.integration": "partial", "iit.exclusion": "unclear"}, tag="C:"),
    ]
    combined = scoring.consensus(runs)
    integration = combined["frameworks"]["iit"]["criteria"]["integration"]
    assert integration["verdict"] == "partial"
    assert integration["votes"] == {"not_met": 1, "partial": 2}
    assert integration["reasoning"] == "B:partial"  # first run that gave the consensus verdict
    # Run B matches the consensus on every IIT criterion, so its summary is used.
    assert combined["frameworks"]["iit"]["summary"] == "B:summary"
    assert combined["runs"] == 3

    result = scoring.build_result(combined)
    iit = next(f for f in result["frameworks"] if f["id"] == "iit")
    by_id = {c["id"]: c for c in iit["criteria"]}
    assert by_id["integration"]["agreement"] == pytest.approx(0.667, abs=1e-3)
    assert by_id["exclusion"]["verdict"] == "met" and by_id["exclusion"]["agreement"] == pytest.approx(0.667, abs=1e-3)
    assert iit["score"] == 2  # core criterion only partly met caps IIT at 2
    assert result["runs"] == 3 and result["unanimous"] == 23 and result["criteria_total"] == 25


# --- preset cache ------------------------------------------------------------


def test_every_preset_has_a_current_cached_score():
    """Fails if a preset description or the rubric changed without re-running
    `uv run --env-file .env python -m scripts.score_presets`."""
    cache = scoring.load_preset_cache()
    stale = [p.id for p in presets.PRESETS if not scoring.is_current(p, cache.get(p.id))]
    assert stale == []
    for entry in cache.values():
        assert len(entry["judgements"]) == scoring.PRESET_RUNS
        for judgement in entry["judgements"]:
            assert set(judgement["frameworks"]) == {f.id for f in rubric.FRAMEWORKS}


def test_editing_a_description_marks_its_cache_stale():
    preset = presets.PRESETS[0]
    entry = scoring.load_preset_cache()[preset.id]
    edited = presets.Preset(preset.id, preset.name, preset.description + " Edited.")
    assert scoring.is_current(preset, entry)
    assert not scoring.is_current(edited, entry)
    assert not scoring.is_current(preset, {**entry, "judgements": entry["judgements"][:1]})


# --- API ---------------------------------------------------------------------


def test_presets_endpoint_returns_scored_presets():
    response = client.get("/api/presets")
    assert response.status_code == 200
    data = response.json()
    assert [p["id"] for p in data] == [p.id for p in presets.PRESETS]
    for preset in data:
        result = preset["result"]
        assert result is not None
        assert len(result["frameworks"]) == len(rubric.FRAMEWORKS)
        assert all(0 <= f["score"] <= 3 for f in result["frameworks"])


def test_rubric_endpoint():
    data = client.get("/api/rubric").json()
    assert [f["id"] for f in data["frameworks"]] == [f.id for f in rubric.FRAMEWORKS]
    assert data["maintainability"]["id"] == "maintainability"


@pytest.fixture
def fake_score(monkeypatch):
    calls = []

    async def fake(text):
        calls.append(text)
        return {**scoring.build_result(rubric.normalize_judgement(fake_raw())), "model": "fake"}

    monkeypatch.setattr(scoring, "score", fake)
    return calls


TEXT = "A sheet of living neurons grown on a flexible electrode mesh."


def test_score_endpoint_scores_and_caches(fake_score):
    first = client.post("/api/score", json={"text": TEXT})
    assert first.status_code == 200
    assert first.json()["combined_support"] == 3.0
    # Same text with different spacing is answered from the cache.
    again = client.post("/api/score", json={"text": "  " + TEXT.replace(" ", "  ")})
    assert again.status_code == 200
    assert fake_score == [TEXT]


@pytest.mark.parametrize("text", ["", "too short", "x" * (main.MAX_CHARS + 1)])
def test_score_rejects_bad_input(fake_score, text):
    assert client.post("/api/score", json={"text": text}).status_code == 422
    assert fake_score == []


def test_score_rate_limit(fake_score):
    for i in range(main.SCORE_RATE_LIMIT):
        assert client.post("/api/score", json={"text": f"{TEXT} {i}"}).status_code == 200
    assert client.post("/api/score", json={"text": f"{TEXT} again"}).status_code == 429


def test_score_daily_limit(fake_score, monkeypatch):
    monkeypatch.setattr(main, "DAILY_SCORE_LIMIT", 1)
    assert client.post("/api/score", json={"text": TEXT}).status_code == 200
    response = client.post("/api/score", json={"text": TEXT + " two"})
    assert response.status_code == 503
    assert "limit" in response.json()["detail"]


def test_score_missing_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    response = client.post("/api/score", json={"text": TEXT})
    assert response.status_code == 503
    assert "API key" in response.json()["detail"]


def test_score_refusal(monkeypatch):
    async def refuse(text):
        raise scoring.RefusalError

    monkeypatch.setattr(scoring, "score", refuse)
    response = client.post("/api/score", json={"text": TEXT})
    assert response.status_code == 422
    assert "declined" in response.json()["detail"]
