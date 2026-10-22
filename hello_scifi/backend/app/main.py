"""FastAPI app: the /api routes, plus the built React frontend in production."""

import logging
import os
import time
from collections import defaultdict, deque
from pathlib import Path
from typing import Literal

import anthropic
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from app import data, llm, phi, scorecard, sim, survival_map
from app.extraction import extract, pdf_text
from app.schemas import Record

logger = logging.getLogger(__name__)

MAX_CHARS = 2000
MAX_DESCRIPTION_CHARS = 1500
MAX_UPLOAD_BYTES = 20 * 1024 * 1024
# Live extraction on the public site is capped; longer papers go through scripts/extract_batch.py.
MAX_EXTRACT_CHARS = 200_000
RATE_LIMIT = int(os.environ.get("RATE_LIMIT_PER_MINUTE", "10"))
# Set by the Dockerfile; unset in local dev, where Vite serves the frontend.
FRONTEND_DIST = os.environ.get("FRONTEND_DIST")

app = FastAPI(title="OSI4 Group4")


class ScifiRequest(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_CHARS)


class ScifiResponse(BaseModel):
    scifi: str


class ScoreRequest(BaseModel):
    description: str = Field(min_length=1, max_length=MAX_DESCRIPTION_CHARS)


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


@app.post("/api/score")
async def score(body: ScoreRequest, request: Request) -> dict:
    """Score a user-described substrate against the benchmark rubric."""
    if not body.description.strip():
        raise HTTPException(422, "Description can't be empty.")
    check_rate_limit(request.client.host if request.client else "unknown")
    try:
        result = await llm.score_substrate(body.description)
    except llm.MissingKeyError:
        logger.error("ANTHROPIC_API_KEY is not set")
        raise HTTPException(503, "The server isn't configured with an Anthropic API key.")
    except (llm.RefusalError, llm.IncompleteError):
        raise HTTPException(422, "Claude couldn't score that description. Try rewording it.")
    except anthropic.RateLimitError:
        raise HTTPException(503, "Claude is busy right now. Try again shortly.")
    except anthropic.APIError:
        logger.exception("Claude API call failed")
        raise HTTPException(502, "Couldn't reach Claude. Try again later.")
    if not result.is_substrate:
        raise HTTPException(
            422, "That doesn't read like a substrate. Describe a material, device, or architecture."
        )

    def criterion(c: llm.Criterion) -> dict:
        return {"score": min(max(c.score, 0), 3), "reason": c.reason}

    scores = {key: criterion(getattr(result, key)) for key in llm.FRAMEWORKS}
    return {
        "name": result.name,
        "summary": result.summary,
        "scores": scores,
        "carry_over": sum(s["score"] for s in scores.values()),
        "maintainability": criterion(result.maintainability),
    }


@app.get("/api/records")
async def records() -> list[Record]:
    return data.load_records()


@app.get("/api/scorecard")
async def scorecard_endpoint(
    survival: float | None = None,
    soft: float | None = None,
    in_vivo_brain: float | None = None,
    clear_degradable: float | None = None,
    conductive: float | None = None,
) -> dict:
    """Candidate well fills, scored server-side. Query params override the default weights."""
    overrides = {
        "survival": survival,
        "soft": soft,
        "in_vivo_brain": in_vivo_brain,
        "clear_degradable": clear_degradable,
        "conductive": conductive,
    }
    for name, value in overrides.items():
        if value is not None and not 0 <= value <= 10:
            raise HTTPException(422, f"Weight {name} must be between 0 and 10.")
    return scorecard.build_scorecard(data.reviewed_records(), overrides)


@app.get("/api/survival-map")
async def survival_map_endpoint() -> dict:
    """One scored point per neuron survival result, with the properties it can be plotted against."""
    return survival_map.build_survival_map(data.reviewed_records())


@app.get("/api/references")
async def references() -> object:
    return data.load_json("references.json")


@app.get("/api/target-window")
async def target_window() -> object:
    return data.load_json("target_window.json")


@app.post("/api/extract")
async def extract_endpoint(
    request: Request,
    file: UploadFile | None = File(None),
    text: str | None = Form(None),
) -> dict:
    """Run extraction live on an uploaded PDF or pasted text. Results are not saved."""
    if file is not None:
        content = await file.read(MAX_UPLOAD_BYTES + 1)
        if len(content) > MAX_UPLOAD_BYTES:
            raise HTTPException(413, "PDF is larger than 20 MB.")
        try:
            pages = await run_in_threadpool(pdf_text.pdf_pages, content)
        except Exception:
            raise HTTPException(422, "Couldn't read that PDF.")
        source_text = pdf_text.with_page_markers(pages)
    elif text and text.strip():
        pages = [text]
        source_text = text
    elif extract.mock_enabled():
        pages = [extract.MOCK_TEXT]
        source_text = extract.MOCK_TEXT
    else:
        raise HTTPException(422, "Upload a PDF or paste some text.")
    if not source_text.strip():
        raise HTTPException(422, "No text found. Scanned PDFs without a text layer aren't supported.")
    if len(source_text) > MAX_EXTRACT_CHARS:
        raise HTTPException(
            413, "That paper is too long for the live demo. Use scripts/extract_batch.py instead."
        )
    check_rate_limit(request.client.host if request.client else "unknown")
    if not extract.mock_enabled() and not os.environ.get("ANTHROPIC_API_KEY"):
        raise HTTPException(503, "The server isn't configured with an Anthropic API key.")
    try:
        results = await extract.extract_records(source_text)
    except extract.ExtractionError:
        raise HTTPException(422, "Claude couldn't extract records from that text.")
    except anthropic.RateLimitError:
        raise HTTPException(503, "Claude is busy right now. Try again shortly.")
    except anthropic.APIError:
        logger.exception("Claude API call failed")
        raise HTTPException(502, "Couldn't reach Claude. Try again later.")
    return {"records": results, "pages": pages, "mock": extract.mock_enabled()}


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
