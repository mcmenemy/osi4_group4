# 10x Sci-Fi (hello world)

A test app for trying out the hackathon stack end to end. You type some text, and Claude rewrites it as science fiction turned up ten times. Below that, **package checks** run small [Brian2](https://brian2.readthedocs.io/) and [PyPhi](https://pyphi.readthedocs.io/) examples on the server to confirm those libraries work in the same stack (see [Package checks](#package-checks)).

- **Backend:** Python 3.13 + FastAPI (`backend/`). It calls Claude (Haiku 5.5 by default) with the Anthropic Python SDK.
- **Frontend:** React + TypeScript, built with Vite (`frontend/`).
- **Deploy:** a single Docker container on Render. FastAPI serves both `/api` and the built React app.

```
Browser ──> /api/scifi (FastAPI) ──> Claude API
        └─> everything else: React app (Vite dev server locally, static files in prod)
```

## Prerequisites

You need Git and an SSH key on GitHub first (see [GIT_START.md](../GIT_START.md)). Then install:

| Tool | macOS | Windows (PowerShell) |
|------|-------|----------------------|
| [uv](https://docs.astral.sh/uv/) (Python + packages) | `brew install uv` | `powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 \| iex"` |
| [Node.js](https://nodejs.org/) LTS | `brew install node` | `winget install OpenJS.NodeJS.LTS` |

You don't need to install Python yourself. uv downloads Python 3.13 automatically the first time you run it. Open a new terminal after installing so the commands are on your `PATH`.

You'll also need an **Anthropic API key**. Create one at [platform.claude.com](https://platform.claude.com) under API Keys. Never commit it.

## Local setup (one time)

```bash
# Backend
cd hello_scifi/backend
uv sync                     # creates .venv and installs dependencies
cp .env.example .env        # Windows: copy .env.example .env
# then open .env and paste your key after ANTHROPIC_API_KEY=

# Frontend
cd ../frontend
npm install
```

## Run locally

Use two terminals.

**Terminal 1: backend** (http://localhost:8000)

```bash
cd hello_scifi/backend
uv run uvicorn app.main:app --reload --env-file .env
```

**Terminal 2: frontend** (http://localhost:5173)

```bash
cd hello_scifi/frontend
npm run dev
```

Open http://localhost:5173. Vite forwards every `/api/...` request to the backend on port 8000, so you don't need to configure CORS. Both servers reload automatically when you save a file.

The interactive API docs are at http://localhost:8000/docs.

## Tests and checks

```bash
# Backend tests. Claude is mocked, so no API key is needed and nothing is billed.
cd hello_scifi/backend
uv run pytest
uv run pytest tests/test_api.py::test_rate_limit   # run a single test

# Frontend lint and type-check/build
cd hello_scifi/frontend
npm run lint
npm run build
```

## Package checks

These are hello-world tests of the libraries the real project depends on. They're generic examples, not project code. Each check runs on the backend and shows its result in the browser, so it proves the library installs and runs locally *and* in the deployed container.

### Brian2

`POST /api/sim/hello` runs a tutorial-style network (`backend/app/sim.py`): leaky integrate-and-fire neurons, 80% excitatory and 20% inhibitory, sparse random connections, driven by noise. While it runs, neurons drop out: every 10 ms, each surviving neuron has a chance of dying set by the **dropout rate** (% per second). The page plots a spike raster, the firing rate per surviving neuron, and the number of neurons alive over time. It also reports the run time, so you can see how fast simulations are on whatever machine is running the backend.

| Input | Range | Default |
|-------|-------|---------|
| Neurons | 10–1000 | 200 |
| Duration | 100–2000 ms | 1000 ms |
| Dropout rate | 0–500 %/s | 50 %/s |

Notes:
- Brian2 runs in its `numpy` mode (no C++ compiler needed). The deploy image has no compiler, and using the same mode locally keeps timings comparable.
- Brian2 isn't thread-safe, so simulations run one at a time. They share the per-IP rate limit with the sci-fi endpoint.
- The first run after the server starts is slower (about 1 s vs. 0.3 s on a laptop for the defaults) while Brian2 generates its code.
- The largest run (1000 neurons, 2 s) peaked at about 180 MB of memory locally, so it fits on a 512 MB Render instance.
- `uv run pytest tests/test_sim.py` runs real (tiny) simulations, so it confirms Brian2 is installed correctly.

### PyPhi

`POST /api/phi/hello` (`backend/app/phi.py`) computes integrated information under IIT 4.0 for a small binary network. You can pick one of PyPhi's built-in examples (the IIT 4.0 paper's Fig. 1A network is the default) or a **random network**: 3–7 nodes in a ring plus random extra connections. In the random network, each node turns on with a probability equal to the fraction of its inputs that are on, blurred toward 50% by the noise setting. The page shows:
- **φ_s** (system integrated information): whether the network exists as one whole. 0 means some partition makes no difference.
- **Φ** (structure integrated information): the sum of φ over all distinctions and relations. Shown only when *Full structure* is ticked.

These are different quantities; don't report one as the other. The page also draws the network (filled = ON) with the connections cut by the minimum partition shown dashed, lists the top distinctions, and keeps a run-history table so you can compare run times across network sizes.

Notes:
- PyPhi's stable release on PyPI (1.2.0) doesn't work on Python 3.10+. We use the release candidate **2.0.0rc4**, which requires **Python 3.13**. That's why the backend runs on 3.13.
- Run time grows very fast. φ_s alone takes 0.3 s at 6 nodes and 1.3 s at 7 on a laptop. The full structure takes milliseconds up to 5 nodes but 1–2 minutes at 6, so the full structure is limited to 5 nodes and φ_s-only runs to 7.
- φ_s = 0 is common for small networks, including PyPhi's classic OR/AND/XOR example under IIT 4.0. That's a valid result, not an error.
- In distinction labels, uppercase means the node is ON and lowercase means OFF.
- With both Brian2 and PyPhi loaded, the server peaked at about 310 MB locally, under the 512 MB of a Render instance.
- `uv run pytest tests/test_phi.py` runs real (tiny) analyses, so it confirms PyPhi is installed correctly.

## Configuration

These are environment variables. Locally they live in `backend/.env`; on Render, set them in the dashboard.

| Variable | Default | Purpose |
|----------|---------|---------|
| `ANTHROPIC_API_KEY` | (required) | Your Claude API key |
| `CLAUDE_MODEL` | `claude-haiku-5-5` | Switch to `claude-sonnet-5-5` or `claude-opus-5-5` for better writing at a higher cost |
| `RATE_LIMIT_PER_MINUTE` | `10` | Requests allowed per visitor IP per minute |

Because the site is public, the backend guards against runaway spend: input is capped at 2,000 characters, output tokens are capped, and each IP is rate-limited. The rate limiter keeps its counts in memory, so they reset whenever the server restarts. That's fine for a single small instance.

## Deploy to Render

The `Dockerfile` builds the React app, then packages it with the FastAPI backend into one image.

1. Push your changes to `main` on GitHub.
2. In the [Render dashboard](https://dashboard.render.com), choose **New → Web Service** and connect the `mcmenemy/osi4_group4` repo. You'll need to authorize Render's GitHub app for the repo the first time.
3. Fill in the settings:
   - **Root Directory:** `hello_scifi`
   - **Language / Runtime:** Docker (Render detects the `Dockerfile`)
   - **Branch:** `main`
   - **Instance type:** Free while testing; Starter (about $7/month) so it doesn't sleep
4. Under **Environment Variables**, add `ANTHROPIC_API_KEY`. You can optionally add `CLAUDE_MODEL` too.
5. Under **Advanced**, set **Health Check Path** to `/api/health`.
6. Click **Create Web Service**. The first build takes a few minutes. Your app is then live at `https://<service-name>.onrender.com`.

After that, Render rebuilds and redeploys automatically on every push to `main`. On the Free instance, the service sleeps after a period of inactivity, so the first request after a while can take about 30 seconds.

### Testing the production build without Docker

```bash
cd hello_scifi/frontend && npm run build
cd ../backend
FRONTEND_DIST=../frontend/dist uv run uvicorn app.main:app --env-file .env
# open http://localhost:8000
```

On Windows PowerShell, set the variable first with `$env:FRONTEND_DIST="../frontend/dist"`, then run the `uv run` line.

## Project layout

```
hello_scifi/
├── Dockerfile            # multi-stage: build React → Python image serving both
├── backend/
│   ├── app/main.py       # FastAPI routes, rate limit, serves the frontend in prod
│   ├── app/llm.py        # Claude call and system prompt
│   ├── app/sim.py        # Brian2 package check
│   ├── app/phi.py        # PyPhi package check
│   └── tests/            # test_api.py (Claude mocked); test_sim.py, test_phi.py (real runs)
└── frontend/
    ├── vite.config.ts    # dev proxy /api → :8000
    ├── src/App.tsx       # the UI
    ├── src/SimCheck.tsx  # Brian2 check: inputs and SVG plots
    └── src/PhiCheck.tsx  # PyPhi check: network diagram, results, run history
```
