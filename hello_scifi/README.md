# Hackathon app

The app behind [the project](../README.md): it builds a source-linked dataset of materials that could fill or coat Science Corp's SU-8 microwells to keep more neurons alive, and charts how neurons survive on each material against Science Corp's chip. An LLM pipeline extracts structured records from papers on soft and conductive hydrogels, OECT/OMIEC materials, and neurons on soft substrates; every value keeps its verbatim quote. Tabs:

- **Overview:** the Science Corp microwell device, why it matters, the two well-occupancy numbers, and what the app does.
- **Maps:** neuron survival against a chosen material property, with Science Corp's chip and brain tissue as references; more property maps under "Advanced metrics". Click any point or cell for values, evidence quotes and sources.
- **Records:** searchable table of every record (`#/records?id=<record_id>` opens one).
- **Extract:** run the extraction live on an uploaded PDF or pasted text.
- **Review:** a demo of expert review. Nothing is saved there (see [Reviewing records](#reviewing-records)).
- **Gaps & next steps:** the team's proposed design directions, how to help, and where the dataset goes. The destination text and URL live in `frontend/src/dataDestination.ts`.
- **For fun:** the team's earlier "What can carry a mind?" benchmark, with "Score your own substrate" (uses `/api/score`).

The Brian2 and PyPhi **package checks** are no longer in the UI; their API routes (`/api/sim/hello`, `/api/phi/hello`) still exist (see [Package checks](#package-checks-legacy)). The original 10x Sci-Fi stack test still works at `#/scifi`; it's just not in the nav.

- **Backend:** Python 3.13 + FastAPI (`backend/`). It calls Claude with the Anthropic Python SDK.
- **Frontend:** React + TypeScript, built with Vite (`frontend/`).
- **Deploy:** a single Docker container on Render. FastAPI serves both `/api` and the built React app.

```
Browser ──> /api/* (FastAPI) ──> Claude API (extraction, scoring)
        │          └─> data/records/*.json, data/references.json (loaded at startup)
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

## Package checks (legacy)

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

## Literature pipeline

Records are JSON files in `data/records/`, committed to the repo and loaded when the server starts. There's no database. **To add papers, fix records, or curate material facts, follow [`data/ADDING_DATA.md`](data/ADDING_DATA.md)**; it also lists the papers we still want and which gaps they fill. In short:

```bash
cd hello_scifi/backend
uv run python scripts/fetch_papers.py                          # open-access PDFs from data/papers.csv
uv run --env-file .env python scripts/extract_batch.py          # extract new PDFs in data/papers/
uv run python scripts/extract_batch.py --revalidate             # re-check records after editing materials.yaml
uv run python scripts/list_unverified.py                        # curated facts nobody has checked yet
```

How extraction works (`backend/app/extraction/`):

- `pdf_text.py` pulls text per page with pypdfium2 and adds `[page N]` markers so the model can cite locations.
- `extract.py` splits long papers into chunks, asks Claude for structured output matching `app/schemas.py`, and merges chunk results per material and formulation. The prompt is in `prompts.py`.
- `validate.py` checks every evidence quote against the source text (whitespace, hyphenation and symbol differences are normalized, with a fuzzy fallback), converts units to SI, and range-checks values. `vocab.py` checks the model's material family and cell category against fixed lists. Problems become `flags`; nothing is dropped.

### Scorecard

`/api/scorecard` (`backend/app/scorecard.py`) groups records by material family (`data/materials.yaml`) and scores each family against five requirements: neuron survival at ≥3 weeks, stiffness ≤100 kPa, in vivo in brain, clear and degradable, and conductive (low weight; only for future electrode layers). Each requirement is met, partial, unknown or fails. The score multiplies each requirement's weight by its state and by the strength of the cell evidence (in vivo neurons count more than a neuron-like cell line). Weights, thresholds and multipliers are team judgment and live in `data/scorecard.yaml`. Only families with neuron records are ranked; the SU-8 baseline is returned separately. The app no longer displays the ranking; its family rows feed the stiffness-by-family chart.

### Reviewing records

The Review tab is a demo: its controls are disabled and nothing is saved. Until there's a login, corrections go through the repo: put fixes in `data/overrides.yaml` (team corrections applied when records load), or commit a review file to `data/reviews/` (same format the old export used: `{"reviews": {"<record_id>": {"status": "accepted" | "rejected", "edits": {...}}}}`). The scorecard drops rejected records and applies edits.

### Reference markers

`data/references.json` holds the hand-entered reference values on the maps (brain tissue, SU-8, dry PEDOT:PSS, polyimide, silicon, plus GelMA and HyStem culture hydrogels) and the Science Corp numbers. Each carries a citation and a status saying how far it has been checked. `data/target_window.json` sets the shaded soft-and-conductive region; its bounds are a team choice, not a literature value.

## Configuration

These are environment variables. Locally they live in `backend/.env`; on Render, set them in the dashboard.

| Variable | Default | Purpose |
|----------|---------|---------|
| `ANTHROPIC_API_KEY` | (required) | Your Claude API key |
| `CLAUDE_MODEL` | `claude-haiku-5-5` | Switch to `claude-sonnet-5-5` or `claude-opus-5-5` for better writing at a higher cost |
| `RATE_LIMIT_PER_MINUTE` | `10` | Requests allowed per visitor IP per minute |
| `EXTRACTION_MODEL` | `claude-opus-5-5` | Model for literature extraction (batch script and the Extract tab) |
| `MOCK_LLM` | unset | Set to `1` to return a canned example record from extraction, so the UI works without a key |
| `DATA_DIR` | `hello_scifi/data` | Where records and curated tables live; the Dockerfile sets it to `/app/data` |

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
│   ├── app/schemas.py    # record schema (mirrored in frontend/src/records.ts)
│   ├── app/extraction/   # PDF text, prompt, Claude extraction, quote/unit validation
│   ├── app/data.py       # loads data/records, references, docs
│   ├── scripts/extract_batch.py
│   ├── app/llm.py        # Claude calls for the sci-fi demo and benchmark scoring
│   ├── app/sim.py        # Brian2 package check
│   ├── app/phi.py        # PyPhi package check
│   └── tests/            # API, schema, units, quote checks (Claude mocked); sim/phi real runs
├── data/                 # papers/ (local PDFs, gitignored), records/, references.json, target_window.json
└── frontend/
    ├── vite.config.ts    # dev proxy /api → :8000
    ├── src/App.tsx       # tabs and data loading
    ├── src/MapsTab.tsx   # Plotly maps (Plotly is loaded lazily)
    ├── src/SimCheck.tsx  # Brian2 check: inputs and SVG plots
    └── src/PhiCheck.tsx  # PyPhi check: network diagram, results, run history
```
