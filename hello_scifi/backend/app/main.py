"""FastAPI app: the /api routes, plus the built React frontend in production."""

import logging
import os
import time
from collections import defaultdict, deque
from pathlib import Path
from typing import Literal

import anthropic
from fastapi import FastAPI, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from app import llm, phi, sim

logger = logging.getLogger(__name__)

MAX_CHARS = 2000
RATE_LIMIT = int(os.environ.get("RATE_LIMIT_PER_MINUTE", "10"))
# Set by the Dockerfile; unset in local dev, where Vite serves the frontend.
FRONTEND_DIST = os.environ.get("FRONTEND_DIST")

app = FastAPI(title="10x Sci-Fi")


class ScifiRequest(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_CHARS)


class ScifiResponse(BaseModel):
    scifi: str


class SimRequest(BaseModel):
    n_neurons: int = Field(200, ge=10, le=sim.MAX_NEURONS)
    duration_ms: int = Field(1000, ge=100, le=sim.MAX_DURATION_MS)
    dropout_per_s: float = Field(50, ge=0, le=sim.MAX_DROPOUT_PER_S)
    seed: int = 42


class PhiRequest(BaseModel):
    source: Literal["iit4_fig1a", "grid3", "basic", "random"] = "iit4_fig1a"
    n_nodes: int = Field(4, ge=phi.MIN_NODES, le=phi.MAX_NODES)
    noise: float = Field(0.1, ge=0, le=0.5)
    seed: int = 0
    full: bool = True


# In-memory, per-process limiter. Good enough for a single small instance;
# it resets on restart and isn't shared across instances.
_recent_requests: dict[str, deque[float]] = defaultdict(deque)


def check_rate_limit(client_ip: str) -> None:
    now = time.monotonic()
    window = _recent_requests[client_ip]
    while window and now - window[0] > 60:
        window.popleft()
    if len(window) >= RATE_LIMIT:
        raise HTTPException(429, "Too many requests. Try again in a minute.")
    window.append(now)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/scifi")
async def scifi(body: ScifiRequest, request: Request) -> ScifiResponse:
    if not body.text.strip():
        raise HTTPException(422, "Text can't be empty.")
    check_rate_limit(request.client.host if request.client else "unknown")
    try:
        return ScifiResponse(scifi=await llm.make_scifi(body.text))
    except llm.MissingKeyError:
        logger.error("ANTHROPIC_API_KEY is not set")
        raise HTTPException(503, "The server isn't configured with an Anthropic API key.")
    except llm.RefusalError:
        raise HTTPException(422, "Claude declined to rewrite that text. Try something else.")
    except anthropic.RateLimitError:
        raise HTTPException(503, "Claude is busy right now. Try again shortly.")
    except anthropic.APIError:
        logger.exception("Claude API call failed")
        raise HTTPException(502, "Couldn't reach Claude. Try again later.")


@app.post("/api/sim/hello")
async def sim_hello(body: SimRequest, request: Request) -> dict:
    """Brian2 package check: run a small spiking network with neuron dropout."""
    check_rate_limit(request.client.host if request.client else "unknown")
    # Brian2 is CPU-bound and blocking, so keep it off the event loop.
    return await run_in_threadpool(
        sim.run_network, body.n_neurons, body.duration_ms, body.dropout_per_s, body.seed
    )


@app.post("/api/phi/hello")
async def phi_hello(body: PhiRequest, request: Request) -> dict:
    """PyPhi package check: integrated information for a small binary network."""
    if body.full and body.source == "random" and body.n_nodes > phi.MAX_FULL_NODES:
        raise HTTPException(
            422,
            f"The full structure is limited to {phi.MAX_FULL_NODES} nodes. "
            "Untick it to compute φ_s only.",
        )
    check_rate_limit(request.client.host if request.client else "unknown")
    return await run_in_threadpool(
        phi.run_phi, body.source, body.n_nodes, body.noise, body.seed, body.full
    )


if FRONTEND_DIST:
    dist = Path(FRONTEND_DIST)
    app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    async def frontend(path: str) -> FileResponse:
        file = dist / path
        if path and file.is_file() and dist.resolve() in file.resolve().parents:
            return FileResponse(file)
        return FileResponse(dist / "index.html")
