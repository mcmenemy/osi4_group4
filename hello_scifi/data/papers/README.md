# Papers

Drop paper PDFs in this folder, then run the extraction (see the main README):

```bash
cd hello_scifi/backend
uv run python scripts/extract_batch.py
```

**PDFs are not committed.** This repo is public and many papers aren't open access, so `*.pdf` here is gitignored and left out of the Docker image. Only the extracted records in `data/records/` (short evidence quotes plus values) are committed. Download each paper yourself; nothing here downloads papers automatically.

## Fetching open-access PDFs

`data/papers.csv` lists papers to fetch. From `hello_scifi/backend`:

```bash
UNPAYWALL_EMAIL=you@ncsu.edu uv run python scripts/fetch_papers.py   # email only used for the Unpaywall API
uv run python scripts/fetch_papers.py --rescan                         # after adding PDFs by hand
```

It tries the CSV's direct link, then Europe PMC / the PMC open-access service, then Unpaywall, and never logs in or scrapes paywalled sites. Anything it can't get is listed with an NC State proxy link in `NEEDS_MANUAL.txt`: download those with Zotero, save as `<key>.pdf` here, and run `--rescan`. Note: Europe PMC's PDF links sit behind a bot check and PMC's OA service endpoint currently returns 404, so free-to-read PMC papers usually need the manual route.

Use short lowercase filenames like `lu2019.pdf`. The filename is stored in each record's `source.file`, which is how the script knows a paper has already been extracted.

## Seed papers

| Paper | Link | Open access |
|---|---|---|
| Brown et al. 2024, cortical biohybrid implant (Science Corp), bioRxiv | https://www.biorxiv.org/content/10.1101/2024.11.22.624907v1 | Yes (preprint) |
| Lu et al. 2019, Pure PEDOT:PSS hydrogels, *Nat. Commun.* | https://pmc.ncbi.nlm.nih.gov/articles/PMC6401010/ | Yes |
| Liu et al. 2019, Soft and elastic hydrogel-based microelectronics for localized low-voltage neuromodulation, *Nat. Biomed. Eng.* | (search the title) | No (subscription; check for an author manuscript) |
| Boulingre et al. 2025, Multi-layered electrode constructs for neural tissue engineering (Green lab), *J. Mater. Chem. B* | https://pubs.rsc.org/en/content/articlehtml/2025/tb/d4tb02651a | To confirm (HTML is public; check the license) |
| Rochford et al. 2023, Biohybrid regenerative bioelectronics, *Sci. Adv.* | (search the title) | Yes (*Science Advances* is open access) |
| Somaa et al. 2017, Peptide-based scaffolds support human cortical progenitor graft integration, *Cell Reports* | https://www.doi.org/10.1016/j.celrep.2017.07.069 | Yes (*Cell Reports* is open access) |
| Adewole et al., Optically controlled living electrodes (Penn), bioRxiv | https://www.biorxiv.org/content/10.1101/333526v3.full.pdf | Yes (preprint) |
| Inal, Malliaras & Rivnay 2017, Benchmarking organic mixed conductors for transistors, *Nat. Commun.* | https://www.nature.com/articles/s41467-017-01812-w | Yes |
| Keene et al. 2020, A biohybrid synapse with neurotransmitter-mediated plasticity, *Nat. Mater.* | https://doi.org/10.1038/s41563-020-0703-y | No |
| Review: Bio-inspired electronics: soft, biohybrid, and living neural interfaces, *Nat. Commun.* 2025 | https://www.nature.com/articles/s41467-025-57016-0 | Yes |

For papers that aren't open access, use your institution's access for extraction. Their records are fine to commit; the PDFs are not.
