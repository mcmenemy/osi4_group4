"""FastAPI app: the /api routes, plus the built React frontend in production."""

import logging
import os
import time
from collections import OrderedDict, defaultdict, deque
from datetime import date
from pathlib import Path

import anthropic
from fastapi import FastAPI, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from app import circuit, rubric, scoring, simulation

logger = logging.getLogger(__name__)

MAX_CHARS = 2000
MIN_CHARS = 20
# Live scoring calls Claude, so it gets a tighter per-visitor limit and a daily cap.
SCORE_RATE_LIMIT = int(os.environ.get("SCORE_RATE_LIMIT_PER_MINUTE", "3"))
DAILY_SCORE_LIMIT = int(os.environ.get("DAILY_SCORE_LIMIT", "200"))
# Live simulations are CPU-heavy and run one at a time.
SIM_RATE_LIMIT = int(os.environ.get("SIM_RATE_LIMIT_PER_MINUTE", "2"))
SCORE_CACHE_SIZE = 200
# Set by the Dockerfile; unset in local dev, where Vite serves the frontend.
FRONTEND_DIST = os.environ.get("FRONTEND_DIST")

app = FastAPI(title="What Can Carry a Mind?")


class ScoreRequest(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_CHARS)


class SimRequest(BaseModel):
    id: str
    reciprocity: float = Field(1.0, ge=min(simulation.RECIPROCITY_SWEEP), le=max(simulation.RECIPROCITY_SWEEP))
    timescale: float = Field(1.0, ge=min(simulation.TIMESCALE_SWEEP), le=max(simulation.TIMESCALE_SWEEP))


# In-memory, per-process limiters. Good enough for a single small instance;
# they reset on restart and aren't shared across instances.
_recent_requests: dict[str, dict[str, deque[float]]] = defaultdict(lambda: defaultdict(deque))
_daily_scores: dict[str, int] = {"date": date.today().toordinal(), "count": 0}
# Identical custom text is answered from here instead of calling Claude again.
_score_cache: OrderedDict[str, dict] = OrderedDict()


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def check_rate_limit(ip: str, bucket: str, limit: int) -> None:
    now = time.monotonic()
    window = _recent_requests[bucket][ip]
    while window and now - window[0] > 60:
        window.popleft()
    if len(window) >= limit:
        raise HTTPException(429, "Too many requests. Try again in a minute.")
    window.append(now)


def check_daily_limit() -> None:
    today = date.today().toordinal()
    if _daily_scores["date"] != today:
        _daily_scores.update(date=today, count=0)
    if _daily_scores["count"] >= DAILY_SCORE_LIMIT:
        raise HTTPException(503, "The live scorer has reached today's limit. Try a preset instead.")
    _daily_scores["count"] += 1


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/rubric")
async def get_rubric() -> dict:
    return rubric.as_dict()


@app.get("/api/presets")
async def get_presets() -> list[dict]:
    """Preset substrates with their precomputed scores (result is null if not scored yet)."""
    return scoring.preset_results()


@app.post("/api/score")
async def score(body: ScoreRequest, request: Request) -> dict:
    """Score a custom substrate description live with Claude."""
    text = " ".join(body.text.split())
    if len(text) < MIN_CHARS:
        raise HTTPException(422, f"Describe the substrate in at least {MIN_CHARS} characters.")
    if text in _score_cache:
        _score_cache.move_to_end(text)
        return _score_cache[text]
    check_rate_limit(client_ip(request), "score", SCORE_RATE_LIMIT)
    check_daily_limit()
    try:
        result = await scoring.score(text)
    except scoring.MissingKeyError:
        logger.error("ANTHROPIC_API_KEY is not set")
        raise HTTPException(503, "The server isn't configured with an Anthropic API key.")
    except scoring.RefusalError:
        raise HTTPException(422, "Claude declined to score that text. Try describing it differently.")
    except scoring.IncompleteError:
        raise HTTPException(502, "Claude's answer was incomplete. Try again.")
    except anthropic.RateLimitError:
        raise HTTPException(503, "Claude is busy right now. Try again shortly.")
    except anthropic.APIError:
        logger.exception("Claude API call failed")
        raise HTTPException(502, "Couldn't reach Claude. Try again later.")
    _score_cache[text] = result
    if len(_score_cache) > SCORE_CACHE_SIZE:
        _score_cache.popitem(last=False)
    return result


@app.get("/api/sim")
async def sim_overview() -> dict:
    """Example architectures with their precomputed results and the parameter sweep."""
    return simulation.overview()


@app.post("/api/sim/run")
async def sim_run(body: SimRequest, request: Request) -> dict:
    """Run one example architecture live with the given reciprocity and timescale."""
    if body.id not in circuit.EXAMPLES_BY_ID:
        raise HTTPException(422, f"Unknown architecture '{body.id}'.")
    check_rate_limit(client_ip(request), "sim", SIM_RATE_LIMIT)
    # Brian2 and PyPhi are CPU-bound and blocking, so keep them off the event loop.
    return await run_in_threadpool(simulation.run_live, body.id, body.reciprocity, body.timescale)


if FRONTEND_DIST:
    dist = Path(FRONTEND_DIST)
    app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    async def frontend(path: str) -> FileResponse:
        file = dist / path
        if path and file.is_file() and dist.resolve() in file.resolve().parents:
            return FileResponse(file)
        return FileResponse(dist / "index.html")
