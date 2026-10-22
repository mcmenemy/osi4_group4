# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`osi4_group4` is the public repo for our OSI Hackathon @ NC State project (Oct 21–22, 2026). It builds a source-linked materials dataset and scorecard for improving neuron retention in Science Corporation's SU-8 microwell biohybrid implant (Brown et al., bioRxiv 2024): which soft, degradable (and later conductive) materials could fill or coat the wells. Audiences: Science Corp and the Seifrid lab (NC State MSE). `README.md` holds the framing; keep this file consistent with it. The earlier "What can carry a mind?" plan is in `docs/earlier-plan.md` and survives as the app's For fun tab.

Everything the app uses lives under `hello_scifi/` (named after the original stack test). Render builds from `hello_scifi/` as its root, so anything the app reads at runtime must be under it; the Dockerfile copies `data/` and sets `DATA_DIR`.

## Architecture

- **Schema:** `backend/app/schemas.py` (Pydantic), mirrored in `frontend/src/records.ts`; keep them in sync. Every value is a `FieldValue` with a verbatim evidence quote, location, confidence, `value_si` and `evidence_verified`. Survival values carry their own measure (viability / occupancy / retention / neurite_outgrowth), setting and `culture_days`; never compare across measures.
- **Extraction:** `backend/app/extraction/`: `pdf_text.py` (pypdfium2), `prompts.py` (editable prompt), `extract.py` (chunked structured output; `MOCK_LLM=1` returns a canned record), `validate.py` (quote checks, SI units, sanity ranges), `vocab.py` (material_key and cell_category checks), `revalidate.py` (re-checks stored records; never deletes flags it didn't compute).
- **Data (no database):** `data/records/*.json` are committed and loaded at startup. `data/materials.yaml` is the material-family vocabulary plus curated facts, each with a citation and `verified: true/false`. `data/overrides.yaml` holds team corrections applied at load. `data/reviews/*.json` drop rejected records and apply edits before scoring. `data/papers/*.pdf` are gitignored (public repo). `data/references.json` holds the map reference bands.
- **Scorecard:** `backend/app/scorecard.py`, settings in `data/scorecard.yaml`; served by `/api/scorecard`, computed server-side. Rank on requirement states, not raw numbers. Only primary_neuron / sc_neuron / neuron_like_line records count as neuron evidence. `control: true` families are never ranked; `candidate: true` families always appear.
- **Survival map:** `backend/app/survival_map.py` (`/api/survival-map`), drawn by `frontend/src/SurvivalMap.tsx` on Maps. One point per neuron survival result, score = % × time factor × measure weight (settings under `survival_score` in `data/scorecard.yaml`), in three tiers (in vivo / primary or stem-cell neurons in a dish / cell lines). The x value comes from the same record, or (hollow, optional) the family median or curated range.
- **Frontend tabs:** Overview, Maps (scorecard first, then Plotly charts), Records (`#/records?id=<record_id>` opens one), Extract, Review (demo only; nothing saved), Gaps & next steps (gap bullets computed from `/api/scorecard`; dataset destination in `frontend/src/dataDestination.ts`), For fun (theory-of-mind benchmark, `/api/score`).
- **Science mode:** the toggle on the Overview switches all UI copy between Normal (plain language, news-style, acronyms spelled out) and Hardcore (full detail and caveats); `frontend/src/mode.ts`, used as `t(normal, hardcore)`. When you change copy, update both versions, and keep Normal true even when it's simpler (e.g. well occupancy is "wells holding neurons", never "neuron activity"). Data values, quotes and server-generated text are the same in both modes.

## Rules

- Don't invent data. Hand-entered values need a citation; mark them `verified: false` until someone has read the source. Check numbers against the PDFs before putting them in copy.
- Fix extraction mistakes with `data/overrides.yaml` or the prompt, not by tweaking the scorer.
- Never commit PDFs. Check `git status` for `.pdf` before committing.
- Extraction is non-deterministic; re-run important papers and compare.

## Commands

```bash
cd hello_scifi/backend && uv run pytest                                     # backend tests (Claude mocked)
cd hello_scifi/backend && uv run pytest tests/test_scorecard.py::test_in_vivo_brain_needs_brain_tissue_site
cd hello_scifi/backend && uv run uvicorn app.main:app --reload --env-file .env   # API on :8000
cd hello_scifi/frontend && npm run dev                                      # :5173, proxies /api to :8000
cd hello_scifi/frontend && npm run lint && npm run build

cd hello_scifi/backend && uv run python scripts/fetch_papers.py [--rescan]   # open-access PDFs from data/papers.csv
cd hello_scifi/backend && uv run --env-file .env python scripts/extract_batch.py [--force] [--only x.pdf] [--revalidate]   # needs the key from .env
cd hello_scifi/backend && uv run python scripts/list_unverified.py           # curated facts still to check
```

The full data workflow for teammates is in `hello_scifi/data/ADDING_DATA.md`. The backend dev server reloads only on `.py` changes; touch a `.py` file after changing records or YAML. In production the Dockerfile builds the frontend and FastAPI serves it next to `/api`. The Brian2/PyPhi package-check routes (`/api/sim/hello`, `/api/phi/hello`) and the `#/scifi` page are leftovers from the stack test and aren't in the nav.
