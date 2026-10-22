# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current direction (Oct 21, 2026 pivot)

The app now builds an evidence base for a gel-filled vs. bare microwell neuron study (audiences: Science Corp and the Seifrid lab). Key pieces, all under `hello_scifi/`:
- Record schema: `backend/app/schemas.py`, mirrored in `frontend/src/records.ts`; keep them in sync. Every value is a FieldValue with a verbatim evidence quote.
- Extraction: `backend/app/extraction/` (prompt in `prompts.py`), batch run via `backend/scripts/extract_batch.py`. `MOCK_LLM=1` returns a canned record; `EXTRACTION_MODEL` picks the model.
- Data: `data/records/*.json` are committed and loaded at startup (no database). `data/papers/*.pdf` are gitignored (public repo). Hand-entered values in `data/references.json` must carry a citation or be labeled "approximate, to verify". Don't invent data.
- Render builds from `hello_scifi/` (Root Directory), so anything the app reads must live under it; the Dockerfile copies `data/` and sets `DATA_DIR`.
- Tabs: Overview, Maps (scorecard first), Records, Extract, Review (demo, nothing saved), Gaps & next steps, For fun. The theory-of-mind benchmark described below lives on For fun; keep the other tabs focused on the microwell work.

## Project

`osi4_group4` is the public project repo for the OSI 4 hackathon (Oct 21–22, 2026), seeded from the private `osi4_prep` planning repo. The project ("What can carry a mind?") is a scoring tool: given a text description of a candidate substrate that could take on brain function for a patient losing tissue to neurodegeneration (digital computers, quantum computers, neuromorphic chips, OECT networks, ionic hydrogels, engineered neural tissue, gel–neuron hybrids, user submissions), score it 0–3 against each theory-of-mind framework with criterion-level reasoning, plus a combined support score and a maintainability score (how hard the substrate is to keep running). The v1 frameworks are functionalism, global workspace, IIT, active inference, EM field theory and Orch-OR, and the MVP may cut these to 2–3. It is a structured way to compare and debate architectures, not a predictor. App plan (see README "App Plan"):
- **Main view:** architecture dropdowns (presets scored ahead of time and cached) plus a custom-text box scored live by the LLM.
- **Advanced tab (reach goal):** takes a hybrid circuit spec (host, graft and device populations, connectivity, dropout schedule, readout task), simulates host-neuron loss, and plots degradation curves. The graft is the device neurons that connect to the host; the rest of the device is more neurons or another substrate, depending on the architecture. Build order, each step demoable on its own:
  1. Brian2 simulation plus the degradation curve (use the `numpy` codegen target in deployed containers). Function preserved = accuracy of a linear decoder retrained on surviving neurons after each dropout step; task input enters through the host.
  2. Information shift (transfer entropy, host to device and back): gcmi first (Gaussian copula, numpy-only, fast enough to run live). IDTxl's pure-Python `PythonKraskovCMI` estimator (no Java) is an optional, slower offline check.
  3. PyPhi: Φ and the main complex on a coarse-grained, rolled-up model of the Brian2 network (each node = one population, binarized by activity; φ_s up to ~6–7 nodes, full Φ up to ~5). Compare architectures under the same grouping, not absolute values. Riskiest step, so it goes last.
  - Sweep each architecture across reciprocity and timescale settings and check that the ranking holds.
  - Example specs for judges are computed ahead of time. Outputs are labeled as integration proxies and retained task information, not consciousness.
  - Orch-OR, EM field theory and the quantum computer substrate aren't simulated.
- Prep feasibility tests for these libraries are package checks in `hello_scifi/` (see below); the README's prep task checklist tracks which are done.

`README.md` is the source of truth for project framing, team roles and open questions; keep this file consistent with it.

## Current state

This is the project repo, so project code belongs here. `hello_scifi/` is still the stack test, not the project itself. The project question may also narrow as research goes on, so treat the README summary as a starting point, not a spec.

- `GIT_START.md`: SSH key, clone and Claude Code setup for macOS and Windows.
- `refs/`: one reference paper per framework, committed directly to git (no LFS; `.gitattributes` marks `*.pdf` binary). Files are named `YYYY_Short_Title.pdf`, and each needs a row in the `refs/README.md` table. The repo is public, so only openly licensed PDFs (e.g. CC BY) are committed; other papers get a web link in the table instead.
- `hello_scifi/`: hello-world stack test (FastAPI backend, React/Vite/TS frontend, Claude via the Anthropic Python SDK, one Docker image deployed on Render). Full setup and deploy steps are in `hello_scifi/README.md`. It also hosts **package checks**: generic hello-world runs of the project's libraries, exposed through the API and plotted in the UI, to prove they work in the full stack. Done so far:
  - Brian2 (`backend/app/sim.py`, `POST /api/sim/hello`, `frontend/src/SimCheck.tsx`): `numpy` code generation, one simulation at a time behind a lock.
  - PyPhi (`backend/app/phi.py`, `POST /api/phi/hello`, `frontend/src/PhiCheck.tsx`): PyPhi 2.0.0rc4 (IIT 4.0), which needs Python 3.13, so the backend is on 3.13. Report φ_s (`.phi`, system integrated information) and Φ (`.big_phi`, structure integrated information) as distinct quantities. Run with `progress=False, parallel=False`. The full structure is capped at 5 nodes because run time explodes at 6.
  New checks (gcmi next) should follow the same pattern and stay generic, not project code.

## hello_scifi commands

```bash
cd hello_scifi/backend && uv run pytest                                  # all backend tests (Claude mocked)
cd hello_scifi/backend && uv run pytest tests/test_api.py::test_rate_limit
cd hello_scifi/backend && uv run uvicorn app.main:app --reload --env-file .env   # :8000
cd hello_scifi/frontend && npm run dev                                   # :5173, proxies /api to :8000
cd hello_scifi/frontend && npm run lint && npm run build
```

In production, the `Dockerfile` builds the frontend and sets `FRONTEND_DIST`, and FastAPI serves the static files next to `/api`. Without `FRONTEND_DIST`, the backend serves only `/api`. The Claude call and prompt live in `backend/app/llm.py`; the model comes from `CLAUDE_MODEL` (default `claude-haiku-5-5`).
