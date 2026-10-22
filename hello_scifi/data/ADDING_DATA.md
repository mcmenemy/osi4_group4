# Adding data

How to add papers, extract records, fix mistakes, and curate material facts on your own machine. Written for teammates and for an LLM assistant helping them: follow the steps in order, and use the wanted list and gap notes at the end to decide what's worth adding.

All commands run from `hello_scifi/backend` unless noted.

## 0. One-time setup

```bash
cd hello_scifi/backend
uv sync
cp .env.example .env          # paste your ANTHROPIC_API_KEY after the = sign
```

`EXTRACTION_MODEL` in `.env` picks the model (default `claude-opus-5-5`). Extracting one paper costs roughly $0.10–0.40. To try the pipeline without a key, set `MOCK_LLM=1`: you get one clearly labeled fake record.

## 1. Get the PDFs

PDFs live in `hello_scifi/data/papers/` and are **never committed**: the repo is public and many papers aren't open access. Name each file `<firstauthor><year>.pdf` in lowercase (e.g. `georges2006.pdf`). The filename is how the scripts know a paper has been done.

**Open-access papers:** add a row to `data/papers.csv` (key, title, first author, year, and the DOI and/or PMC id if you have them; leave the rest blank), then:

```bash
UNPAYWALL_EMAIL=you@ncsu.edu uv run python scripts/fetch_papers.py
```

It tries the CSV's direct link, Europe PMC / PMC open access, then Unpaywall. It never logs in or scrapes paywalled sites. It fills in missing DOIs from NCBI or Crossref, but only on a close title match, and it records the result in the CSV.

**Everything else:** the fetcher writes `data/papers/NEEDS_MANUAL.txt` with an NC State proxy link for each paper it couldn't get. Download those yourself (Zotero works well), save each as `data/papers/<key>.pdf`, then:

```bash
uv run python scripts/fetch_papers.py --rescan
```

Note: free-to-read PMC papers that aren't in PMC's open-access subset usually land in the manual list. Europe PMC's PDF links sit behind a bot check, and PMC's open-access service currently returns 404.

Scanned PDFs without a text layer won't work; the extraction needs selectable text.

## 2. Extract records

```bash
uv run --env-file .env python scripts/extract_batch.py                    # every PDF not yet extracted
uv run --env-file .env python scripts/extract_batch.py --only georges2006.pdf
uv run --env-file .env python scripts/extract_batch.py --force --only georges2006.pdf   # redo one paper
```

`--env-file .env` loads your API key; without it every paper fails with "Could not resolve authentication method". Check that filenames have no stray spaces (e.g. `" wu2019.pdf"`): the script treats each file as a separate paper.

Records are written to `data/records/<record_id>.json`, one per material or formulation. The summary prints records, fields filled, and flags per paper.

**Extraction isn't deterministic.** On important papers, run `--force --only` a second time and compare the results. In one case the first pass missed the paper's only viability sentence and the second caught it.

## 3. Check what came out

Restart the backend so it reloads the records, then look at the **Records** tab (filter "Flagged only") and the **Maps** scorecard. Things to check:

| Flag | Meaning | What to do |
|---|---|---|
| `unverified_quote:<field>` | The evidence quote wasn't found in the PDF text | Open the PDF. If the value is real, fix the record with an override; if not, drop it. |
| `out_of_range:<field>` | The normalized value is implausible (e.g. viability > 100%) | Usually a unit problem. Fix the unit with an override. |
| `material_key:unmatched` | The material matches no family in `materials.yaml` | Add a pattern to an existing family, or add a new family (section 5). |
| `material_key:model_said_<key>` | The model chose a different family than the name patterns | Decide which is right. Set `material_key` in an override if needed. |
| `cell_category:check_<category>` | The cell type's keywords suggest a different category | E.g. neural stem cells tagged as primary neurons. Set the category in an override. |

Also look for things no validator catches:
- a value attached to the wrong material or state (e.g. a dry film's conductivity on a swollen gel);
- review papers reporting other people's results (treat them as second-hand);
- survival numbers with the wrong measure (viability vs. occupancy vs. retention).

After editing `materials.yaml`, re-check the records without calling the API:

```bash
uv run python scripts/extract_batch.py --revalidate
```

This recomputes SI units, quote checks and family matching. It never deletes flags it didn't compute itself.

## 4. Fix mistakes with overrides (not by editing records)

Put corrections in `data/overrides.yaml`. They're applied every time records load, so a re-extraction can't undo them, and each one says why. Match by source PDF (applies to every record from that paper) or by `record_id`:

```yaml
by_file:
  rochford2023.pdf:
    material_class: biohybrid_device
    material_key: fibrin
    electrode_material: PEDOT:PSS
    note: PEDOT:PSS array + fibrin cell layer; the array's values describe the electrode.

by_record:
  banerjee-2009-calcium-alginate-hydrogel-0-25-ab12cd:
    material_key: alginate
    note: Reviewer correction.
```

Top-level record fields (`material_class`, `material_key`, `electrode_material`) and `source` fields can be overridden. For value-level corrections or rejecting a record, commit a review file to `data/reviews/` instead: `{"reviews": {"<record_id>": {"status": "rejected"}}}` drops a record from the scorecard.

## 5. Curate material facts (`materials.yaml`)

`data/materials.yaml` defines the material families (the scorecard's rows) and hand-curated facts that papers rarely state.

- **Adding a family:** give it a `key`, `label`, `class`, and regex `patterns` that match material names. Order matters: put specific families above general ones. Add `candidate: true` if it's a plausible well fill that should always appear, or `control: true` for comparison surfaces like culture plastic.
- **Curated facts:** `transparency` (clear / translucent / opaque / unknown), `degradable` (yes / no / tunable / unknown), and `literature_typical_stiffness_kpa` (a range, used only when no paper in the dataset reports a modulus). Each needs a `citation`; a value without one counts as unknown.
- **Verifying:** every cited fact has `verified: false` until someone reads the source and confirms it. Then set it to `verified: true`. To see what's left:

```bash
uv run python scripts/list_unverified.py
```

Each one is a lookup plus a citation, a good first task. Don't mark something verified from memory or from an AI summary; read the source.

## 6. Commit

```bash
uv run pytest -q                       # backend tests should pass
git add data/records data/papers.csv data/materials.yaml data/overrides.yaml data/reviews
git status                             # make sure no .pdf files are staged
git commit -m "Add records from <papers>"
```

Pushing to `main` redeploys the site on Render.

## 7. What to add next

The live version of this is the app's **Gaps & next steps** tab and the unknown cells on the **Maps** scorecard. The notes below are a snapshot from Oct 22, 2026: 7 ranked materials, 13 neuron records, 56 unknown cells.

### Papers we already want (listed in `data/papers.csv`, need downloading)

| File | Paper | DOI | Gap it fills |
|---|---|---|---|
| `georges2006.pdf` | Georges et al. 2006, *Biophys. J.*: brain-soft matrices select neuronal over glial growth in mixed cortical cultures | 10.1529/biophysj.105.073114 | Neuron outcome vs. stiffness on soft gels (polyacrylamide, fibrin), primary cortical cells |
| `flanagan2002.pdf` | Flanagan et al. 2002, *NeuroReport*: neurite branching on deformable substrates | 10.1097/01.wnr.0000048003.96487.97 | Neurite outgrowth vs. stiffness |
| `saha2008.pdf` | Saha et al. 2008, *Biophys. J.*: substrate modulus directs neural stem cell behavior | 10.1529/biophysj.108.132217 | Stem-cell neurons vs. modulus; relevant to the cell-source question |
| `seidlits2010.pdf` | Seidlits et al. 2010, *Biomaterials*: hyaluronic acid hydrogels with tunable mechanics, neural progenitor differentiation | 10.1016/j.biomaterials.2010.01.125 | First neuron data for the hyaluronic acid row (currently curated values only) |
| `wu2019.pdf` | Wu et al. 2019, *Biosci. Rep.*: GelMA stiffness and PC12 neurite outgrowth | 10.1042/BSR20181748 | First neuron data for the GelMA row (PC12 is a neuron-like line, scored at 0.3) |
| `lampe2013.pdf` | Lampe et al. 2013, *Acta Biomater.*: 3D engineered protein hydrogels for tailored control of neurite growth | 10.1016/j.actbio.2012.10.033 | Stiffness and protease-degradable gels vs. neurite growth |
| `chapla2024.pdf` | Chapla et al. 2024, *Cell. Mol. Bioeng.*: neurogenic cell behavior in a highly compliant synthetic hydrogel | 10.1007/s12195-024-00794-2 | Very soft (sub-kPa) degradable synthetic gels with neural cells |

### Gaps by row (where a new paper changes the scorecard)

- **Survival at ≥3 weeks** (the most important requirement): only agarose has a "met" result. Fibrin, GelMA, hyaluronic acid, chitosan, the peptide gels and the PEDOT:PSS hydrogels have no neuron survival data at all. Look for viability or retention of neurons in or on the gel at 21 days or later, ideally in vivo in brain.
- **In vivo in brain:** unknown for alginate, chitosan, GelMA and hyaluronic acid. Look for these gels implanted in rodent cortex with neurons or neural progenitors.
- **Stiffness:** unknown for agarose, fibrin and the peptide gels. Look for compression or rheology moduli of the formulations actually used with cells.
- **Clear & degradable:** unknown for agarose, chitosan, the peptide gels and the PEDOT families. Often in materials or methods papers rather than cell papers; good for curating `materials.yaml` too.
- **No neuron evidence at all:** PVA–PEDOT gels and the OMIEC films. Lower priority: they matter for a future electrode layer, not the first experiment.

### What makes a paper useful

Most useful first:
1. It measures **both** a material property (stiffness, degradation, transparency) **and** a neuron outcome (viability, retention, neurite outgrowth) on the **same** material, with the numbers in the text or a table, not only in figures.
2. **Primary research**, not a review. Reviews give second-hand values that are hard to verify.
3. **Primary or stem-cell-derived neurons**, with timepoints of **21 days or more**, ideally **in vivo in brain**.
4. **Open access** if possible, so teammates can fetch it without library access.

Search terms that tend to work: "hydrogel stiffness cortical neuron viability", "neural progenitor encapsulation hydrogel modulus", "injectable hydrogel cortical transplantation neuron survival", "GelMA / hyaluronic acid / fibrin / alginate / self-assembling peptide hydrogel neuron 3D culture", "hydrogel degradation rate neural tissue engineering", "microwell neuron culture hydrogel".

Before adding a paper, check `data/papers.csv` and `data/records/` (search by DOI) so you don't duplicate one.
