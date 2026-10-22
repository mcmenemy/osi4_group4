# Better wells for living implants

**Live site: [osi4-group4.onrender.com](https://osi4-group4.onrender.com/)**

Our [OSI Hackathon @ NC State](https://ncsu-osi-hackathon-materials-2026.github.io/) project (Oct 21–22, 2026). Audiences: Science Corporation and the Seifrid lab (NC State MSE: organic mixed ionic-electronic conductors and self-driving labs).

## The problem

Science Corporation's cortical biohybrid implant is an SU-8 microwell array: 10 µm wells, 15 µm deep, on a 15 µm pitch, about 118,000 wells per 5×5 mm die. Each well is loaded by centrifugation with one embryonic mouse cortical neuron, and the graft is stimulated optogenetically with an external light source; the chip has no electrodes. In their preprint, 77% of wells held cells at loading (DAPI, 24 h, in vitro, n=23) and about 52% showed fluorescent neurons roughly three weeks after implantation (n=13). Those are well occupancy counts, not viability ([Brown et al., bioRxiv 2024](https://www.biorxiv.org/content/10.1101/2024.11.22.624907v1)).

The wells are bare, rigid epoxy coated with poly-D-lysine and laminin. Soft, degradable hydrogels are the usual way to help grafted cells survive and integrate, but we haven't found a published comparison of neurons in bare vs. gel-filled or gel-coated microwells. The authors also note that embryonic mouse cells aren't a translational option; a human-compatible cell source is a separate problem we don't address.

## What we built

A web app plus a literature pipeline that turns papers into a source-linked materials dataset:

- **Extraction:** Claude reads papers on soft and conductive hydrogels, OECT/OMIEC materials, and neurons on soft substrates, and returns structured records. Every value carries a verbatim quote and page, and the quote is checked against the PDF text.
- **Survival chart:** neuron survival on each material against its stiffness, conductivity or degradation time, with Science Corp's chip as an estimated reference and brain tissue's stiffness shaded.
- **Next steps:** the team's proposed design directions for the wells (a gel layer, larger gel-filled wells, gel links between wells), clearly marked as proposals rather than results.

Tabs: **Overview**, **Maps** (survival chart, with more charts under "Advanced metrics"), **Records**, **Gaps & next steps**, **For fun** (our earlier theory-of-mind benchmark), and, after a divider, **Extract** (live demo) and **Review** (demo).

## Where things are

| Path | What |
|---|---|
| [`hello_scifi/`](hello_scifi/README.md) | The app: FastAPI backend + React frontend, one Docker image on Render. Run, test and deploy instructions are in its README. |
| [`hello_scifi/data/ADDING_DATA.md`](hello_scifi/data/ADDING_DATA.md) | **How to add papers and data**, plus the papers we still want and why. Start here if you want to help. |
| `hello_scifi/data/records/` | Extracted records (JSON, committed). |
| `hello_scifi/data/materials.yaml` | Material families and hand-curated facts with citations. |
| `hello_scifi/data/overrides.yaml` | Team corrections applied on top of extracted records. |
| `hello_scifi/data/papers.csv` | Papers to fetch; PDFs themselves are never committed. |
| [`docs/earlier-plan.md`](docs/earlier-plan.md) | The original "What can carry a mind?" plan (now the For fun tab). |
| [`refs/`](refs/README.md) | Reference papers for that earlier plan. |
| [`GIT_START.md`](GIT_START.md) | SSH key, clone, and Claude Code setup. |

## Quick start

```bash
git clone git@github.com:mcmenemy/osi4_group4.git
cd osi4_group4/hello_scifi/backend && uv sync && cp .env.example .env   # add your ANTHROPIC_API_KEY to .env
uv run uvicorn app.main:app --reload --env-file .env                      # API on :8000
cd ../frontend && npm install && npm run dev                              # app on :5173
```

No API key? Set `MOCK_LLM=1` in `.env`: extraction returns a labeled example record, and everything else works from the committed data. Full details are in [`hello_scifi/README.md`](hello_scifi/README.md).

## Helping with the data

The quickest ways to help, in order of impact (details in [`ADDING_DATA.md`](hello_scifi/data/ADDING_DATA.md)):

1. **Download the papers in the wanted list** (several need NC State library access) and run the extraction.
2. **Verify curated values:** `uv run python scripts/list_unverified.py` lists facts in `materials.yaml` whose citations nobody has checked yet.
3. **Check flagged records:** quotes the validator couldn't match, cell types that look miscategorized, materials outside the vocabulary.

Paper PDFs stay out of git (the repo is public and many papers aren't open access). Only the extracted records are committed.

## Team

- **Joshua McMenemy:** DevOps and frontend
- **Fisher White:** LLM scoring pipeline and simulation
- **Patrick Seebold:** theory of mind frameworks and rubric validation
- **Matthew Huang:** TBD
- **Rahin Islam:** TBD

Roles are from the planning phase; update them as the work shifts.

## Background

[Science Corporation](https://science.xyz) builds brain-computer interfaces, including the biohybrid implant above and the PRIMA retinal implant, with which most patients in a 38-patient trial regained enough central vision to read letters and words (*New England Journal of Medicine*, October 2025; [press release](https://www.businesswire.com/news/home/20251020014793/en/Science-Corp.s-PRIMA-BCI-Implant-Restores-Functional-Central-Vision)). It runs a device fab in Research Triangle Park ([Axios Raleigh](https://www.axios.com/local/raleigh/2024/07/11/medical-device-company-science-corp-chip-making-triangle)).

## Git Test: Add your name below

Matthew Huang

Rahin Islam

Joshua McMenemy

Fisher White
