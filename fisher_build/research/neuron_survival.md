# What helps grafted neurons survive

Evidence for the team's database on biohybrid brain implants like Science Corp's SU-8 microwell
implant: what helps the implanted neurons stay alive, and where each claim comes from.

- **S01-S32** come from the team's 10 seed papers ([list](../../hello_scifi/data/papers/README.md)).
- **S33-S41** come from five extra papers on the hyaluronic acid (HyStem) and GelMA gels that the
  [proposal](../../hello_scifi/docs/proposal.md) now names.
- The structured version, with locations, recipes and caveats for every entry, is
  [`neuron_survival.json`](neuron_survival.json). The IDs match.

Compiled by Fisher White with Claude, 2026-10-21 and 22. Every DOI was checked against Crossref.
Quotes from the papers aren't copied here; each entry in the JSON gives the section or figure
to check instead.

## How sure is each claim?

| Label | Meaning |
|---|---|
| Measured | The paper measured it, and we read that paper in full. |
| Method step | The paper's methods used it, but nobody tested whether it helps. |
| Cited by a seed paper | A seed paper describes another study. We checked that study exists but didn't read it. |
| Abstract only | We could only read the abstract. |
| No evidence found | We searched and found nothing direct. |
| (our inference) | Our own suggestion, not a published result. |

**Survival is measured differently in every paper** (well occupancy, live/dead staining, graft
volume, cell counts), so numbers from different papers can't be compared directly.

## Words used here

- **Graft**: cells transplanted into the body (here, neurons placed on or in the brain).
- **Apoptosis**: programmed cell death, the main way grafted neurons die.
- **Hypoxia**: too little oxygen.
- **Blood-brain barrier**: the tight lining of brain blood vessels; damaging it lets immune
  cells and blood in.
- **Microglia**: the brain's own immune cells. **Astrocytes** are support cells that also form
  scars (**gliosis**) around injuries and implants.
- **Hydrogel (gel)**: a water-filled polymer network, soft like tissue.
- **HA (hyaluronic acid)**: a natural part of brain tissue; HyStem is a commercial HA gel kit.
- **GelMA**: gelatin made light-curable; it sets when light hits a photoinitiator.
- **MMP**: enzymes that cells release to cut through their surroundings. An "MMP-cleavable"
  gel can be broken down by the cells inside it.
- **Laminin / IKVAV / RGD**: laminin is a protein neurons grip onto; IKVAV is a short piece of
  it. RGD is a grip sequence from fibronectin.
- **Pa / kPa**: units of stiffness. Brain is roughly 1-30 kPa by indentation; brain-like gels
  measured by shear rheology are around 300 Pa (G′). The two methods give different numbers.
- **DIV**: days in vitro (days in the dish).
- **Immunodeficient (nude, NSG)**: animals bred without parts of their immune system, so human
  cells aren't rejected.

## The short version: what this means for the microwell experiment

1. **Most grafted neurons die in the first few days**, from low oxygen and inflammation
   (S01, S26). That supports the proposal's temporary gel that protects cells early and then
   gets out of the way.
2. **HyStem-type HA gel has the best direct support.** HyStem-HP, a clear HA–heparin–gelatin
   gel, doubled graft survival in the brain at 2 weeks and kept microglia out of the graft
   (S33, S37). A tuned HA gel gave about 5 times more surviving neurons (S39).
3. **The gel's benefit may only show under stress.** HA gels made no difference in
   immune-deficient mice but helped when there was an immune response. In culture, HyStem-HP
   helped most when growth factors were withdrawn. An in vitro test in rich medium could miss
   the effect, so consider adding a stress condition (S34; our inference).
4. **Go soft.** Brain-like gels near 300 Pa caused no more inflammation than salt buffer;
   gels above 1 kPa caused more glial and microglial reaction (S35). The proposal's 0.5-50 kPa
   range could add a level near 300 Pa (our inference).
5. **Use crosslinks the cells can cut (MMP-cleavable).** They let blood vessels grow into the
   gel within 2 weeks. More cells break the gel down faster, so measure degradation at the real
   loading density (S36, S04, S05).
6. **Keep the gel layer thin** above the 15 µm wells, ideally well under 75 µm, because
   neurons survive poorly that far from a blood vessel (S02, S04).
7. **Laminin cues help.** An IKVAV peptide gel tripled graft size (S08), and collagen–laminin
   3D environments slowed neuron loss over weeks (S09, S10).
8. **GelMA is untested for this.** We found no study of primary neuron survival inside GelMA,
   and it adds a light-curing step. If it's used, record the photoinitiator and light dose and
   include a light-only control (S41).
9. **Change only the gel.** Keep SU-8 processing, the PDL + laminin coating, cell source, cell
   maturity and loading protocol identical across conditions (S20, S22, S23, S24, S40).
10. **For the conductive-gel follow-up:** make the conductive gel before the cells go in,
    neutralize it (PEDOT:PSS is acidic), and put the cells in a separate cell-friendly top layer
    (S11, S15, S16, S17).
11. **Later ideas:** dexamethasone released from the gel, co-loaded astrocytes, L1 coatings,
    TNF-α blockade (S21, S27, S29, S31).

## Everything we found

### Placement and delivery

| ID | What helps | What was found | Evidence | Source |
|---|---|---|---|---|
| S01 | Put the graft on the brain surface instead of injecting it | 77% of wells filled at loading, 52% with labeled neurons at ~3 weeks; authors say brain grafts usually keep under 25% and credit avoiding blood-vessel damage | Measured | Brown 2024 |
| S02 | Spread the cells thinly (one cell layer) | Authors suggest a thin, even graft avoids the bad conditions inside a lump of injected cells | Measured (authors' explanation) | Brown 2024 |
| S03 | Keep mechanical force on the graft low during delivery | Constructs left in place as the needle was withdrawn survived 1 week and 1 month | Method step | Adewole 2021 |

### Blood and oxygen supply

| ID | What helps | What was found | Evidence | Source |
|---|---|---|---|---|
| S04 | Keep neurons within about 75 µm of a blood vessel | Transplanted neurons reported to survive poorly beyond 75 µm from a vessel | Cited by a seed paper | Somaa 2017 → Casper 2003 |
| S05 | Let host blood vessels grow into the graft | Grafts were vascularized by host vessels; vessel area 13.9-14.5% vs 25.4% in normal cortex | Measured | Somaa 2017 |
| S06 | Put holes in the device so vessels can reach the cells | Openings let vessels grow through from behind; human cells survived 4 weeks | Measured | Rochford 2023 |
| S07 | Supply oxygen directly with a device | Oxygen-generating devices listed as a way to keep large cell implants alive | Cited by a seed paper | Boufidis 2025 → Lee 2023, Krishnan 2023 |

### Gel and scaffold

| ID | What helps | What was found | Evidence | Source |
|---|---|---|---|---|
| S08 | Inject cells in a laminin-mimicking peptide gel (IKVAV) | Grafts 3× larger (10.7 vs 3.5 mm³), 3.6× more cells, more neurons (69.6% vs 49.7%); gel alone didn't help | Measured | Somaa 2017 |
| S09 | Grow neurons as 3D aggregates inside a hydrogel tube with a collagen–laminin core | Viability fell 15.2-18.6% from day 10 to 28, vs 45% for flat cultures | Measured | Adewole 2021 |
| S10 | Hydrogel-encased neurons survive in the brain with a mild glial reaction | Survived 1 week and 1 month in rat cortex, active at 5 and 10 days | Measured | Adewole 2021 |
| S11 | Use a gelatin-containing gel as the cell layer | Astrocytes 1.5× denser in PVA–gelatin on a conductive gel; not toxic | Measured (astrocytes, not neurons) | Boulingre 2025 |
| S12 | Hold cells on the device with a fibrin gel | Human cells in fibrin survived 4 weeks and stayed attached | Measured | Rochford 2023 |
| S13 | A thin fibrin coating that dissolves within a week | Fewer reactive astrocytes; fibrin gone within 7 days | Cited by a seed paper | Boufidis 2025 → De Faveri 2014 |
| S14 | Make sure the gel lasts as long as the cells need it | Neuron support lasted 1 month, then fell as the alginate gel broke down; PVA–gelatin can lose 30% of its mass in 28 days | Cited by a seed paper | Boufidis 2025 → Purcell 2009; Boulingre 2025 |

### Candidate gels in the current proposal (HyStem HA, GelMA)

| ID | What helps | What was found | Evidence | Source |
|---|---|---|---|---|
| S33 | Deliver cells in a HyStem-HP hyaluronic acid–heparin–gelatin gel | 2× graft survival at 2 weeks (8,000 vs 4,000 of 100,000 cells), no immune drugs; clear gel | Measured | Zhong 2010 |
| S34 | Expect the gel's benefit to show mostly when there is an immune or stress challenge | No gain in immune-deficient mice (38,000 vs 30,000, not significant); gain with an immune response, and in culture when growth factors were withdrawn | Measured | Lam 2014, Moshayedi 2016, Zhong 2010 |
| S35 | Make the gel about as soft as brain (around 300 Pa) | ~300 Pa gels caused no extra inflammation; >1,000 Pa gels raised glial and microglial reactions | Measured | Lam 2014, Moshayedi 2016 |
| S36 | Use crosslinks that the cells' own enzymes can cut, so vessels can grow in | MMP-cleavable gels filled with vessels by 2 weeks; uncuttable gels had very few; more cells broke the gel down faster | Measured | Moshayedi 2016 |
| S37 | Rely on the gel to calm the immune response around the graft | Gel kept microglia out of the graft (19 vs 31 cells/mm³) | Measured | Zhong 2010, Lam 2014 |
| S38 | A viscous gel protects cells pushed through a thin needle | Gel helped at high cell density through fine needles; no effect of injection speed | Measured | Lam 2014 |
| S39 | Mature neurons inside an HA gel (with RGD and heparin) and transplant them in it | About 5× more dopamine neurons survived than neurons from flat plates | Abstract only | Adil 2017 |
| S41 | GelMA: no direct neuron-survival evidence found | Only PC12 cells on GelMA surfaces (already in the team's references); light-curing adds a stress | No evidence found | Wu 2019 (team reference) |

### Conductive materials (for the follow-up)

| ID | What helps | What was found | Evidence | Source |
|---|---|---|---|---|
| S15 | Do not polymerize a conductive polymer around living neurons | Neurons lasted about a week inside PEDOT, then died | Cited by a seed paper | Boufidis 2025 → Richardson-Burns 2007 |
| S16 | Layered design: conductive gel underneath, cell-friendly biodegradable gel on top | Fixed progenitor viability loss, but little neurite growth and no synapses | Cited by a seed paper | Boufidis 2025 → Goding 2017 |
| S17 | Neutralize PEDOT:PSS before adding cells | PEDOT:PSS gels are pH 1-2 in water until soaked in buffer | Measured (cell link is our inference) | Lu 2019 |
| S18 | Prefer pure, stable conductive gels without nano-fillers, but expect them to be stiffer than brain | Stable 3 months, but 2-10 MPa, far stiffer than brain | Measured (no cells) | Lu 2019 |

### Surface coatings and materials

| ID | What helps | What was found | Evidence | Source |
|---|---|---|---|---|
| S19 | Use soft materials to reduce scarring and neuron loss around the implant | Soft PEG/PVA coatings reduce scarring and neuron loss; kPa-soft gel electronics with sham-level inflammation at 6 weeks | Cited by a seed paper | Boufidis 2025 → Spencer 2017; Liu 2019 (team record) |
| S20 | Coat the wells with poly-D-lysine and laminin | Science Corp's coating: 0.1 mg/mL each, at least 1 hour | Method step | Brown 2024 |
| S21 | Adhesion-protein coatings (laminin, L1) on implants | Laminin reduced scarring at 1 month; L1 raised nearby neuron density over 16 weeks | Cited by a seed paper | Boufidis 2025 → He 2006, Golabchi 2020 |
| S22 | Post-treat SU-8 to make it less toxic | Extra UV flood exposure (~1.86 J) and hard bake after patterning | Method step | Brown 2024 → Nemani 2013 |

### Cell source and preparation

| ID | What helps | What was found | Evidence | Source |
|---|---|---|---|---|
| S23 | Use embryonic neurons from a genetically matched donor | Same-strain embryonic neurons needed no immune drugs; authors think this helped survival | Measured (authors' judgement) | Brown 2024 |
| S24 | Prepare and load cells gently | Papain digestion, kynurenic acid in the dissection medium, 300 g spin, 2 h plus overnight rest | Method step | Brown 2024 |
| S25 | Keep the cell-loaded device sterile instead of re-sterilizing it | Cell-loaded devices weren't re-sterilized; the gel layer was autoclaved before cells were added | Method step | Rochford 2023, Boulingre 2025 |
| S40 | Transplant less mature cells | Immature progenitors survived transplant best; mature neurons died most | Abstract only | Payne 2019 |

### Inflammation and immune response

| ID | What helps | What was found | Evidence | Source |
|---|---|---|---|---|
| S26 | Protect the graft during the first few days | Graft neurons die mainly in the first days, from low oxygen and immune attack | Measured (review in Brown's discussion) | Brown 2024 → Emgård 1999, Sortwell 2000 |
| S27 | Give an anti-inflammatory drug (dexamethasone) | 2 mg/kg at surgery; dexamethasone-coated probes reduced neuron loss | Method step + cited | Brown 2024 → Zhong 2007, Boehler 2017 |
| S28 | Use immunodeficient hosts (stand-in for immunosuppression) when grafting human cells | Human cells were grafted into nude rats to help them survive | Measured | Rochford 2023, Somaa 2017 |
| S29 | Block TNF-α signaling (with cell sorting) after grafting | TNF-α blocker plus cell sorting enabled efficient engraftment of dopamine neurons | Cited by a seed paper (abstract) | Brown 2024 → Kim 2024 |
| S30 | Co-transplant regulatory T cells with the neurons | Under 10% survived without them; Tregs calmed inflammation and protected the graft | Cited by a seed paper (abstract) | Brown 2024 → Park 2023 |

### Support cells and growth factors

| ID | What helps | What was found | Evidence | Source |
|---|---|---|---|---|
| S31 | Add support cells (stem cells or astrocytes) that release protective factors | Co-implanted stem cells and astrocytes released factors that protected neurons | Cited by a seed paper | Boufidis 2025 → Purcell 2009, Azemi 2010 |
| S32 | Release growth factors from the gel | Gels can release nerve growth factors and anti-inflammatory drugs | Cited by a seed paper | Boufidis 2025 → Winter 2007, Kennedy 1989 |

## Errors found in the team's records

Checked against `main` at commit 130d5c7, after the records were re-extracted. These are
Joshua's files, so they are listed here for him rather than edited.

| Record | Problem |
|---|---|
| `adewole-2020-agarose-microcolumn-3-w-fd563a.json` | Pairs 80.3% viability with 40 DIV. In the paper, 80.3% is at 10 DIV; at 28 DIV it was 68.1%, and 40 DIV was only a qualitative observation. |
| `somaa-2017-fmoc-ddikvav-self-assemb-c79b23.json` | Resting membrane potential stored as 61 mV; the paper says −61 mV. |
| `boulingre-2025-ch-bh-multi-layered-coat-a1ec32.json`, `boulingre-2025-pva-gel-biosynthetic-hyd-95a03b.json` | Cell spreading stored as "mm2 per cell"; the paper says µm² per cell. |
| all `adewole-2020-*` records | Cite the 2020 preprint; the peer-reviewed version is *Sci. Adv.* 7, eaay5347 (2021), doi:10.1126/sciadv.aay5347 (same numbers). |
| `brown-2024-su-8-microwell-scaffold-6cfd3b.json` | Its stability quote is flagged unverified, but the sentence is in the paper (Results, paragraph 3). |

## Papers worth adding to the database next

Highest value for the current proposal first. All DOIs checked against Crossref.

| Paper | Why | DOI |
|---|---|---|
| Zhong et al. 2010, *Neurorehabil. Neural Repair* | HyStem-HP gel doubled graft survival in brain | [10.1177/1545968310361958](https://doi.org/10.1177/1545968310361958) |
| Moshayedi et al. 2016, *Biomaterials* | HA gel stiffness, MMP-cleavable crosslinks, vessels, survival | [10.1016/j.biomaterials.2016.07.028](https://doi.org/10.1016/j.biomaterials.2016.07.028) |
| Lam et al. 2014, *Adv. Funct. Mater.* | Soft vs stiff HA gel inflammation; no survival gain in immune-deficient mice | [10.1002/adfm.201401483](https://doi.org/10.1002/adfm.201401483) |
| Adil et al. 2017, *Biomaterials* | HA–RGD–heparin gel, about 5× neuron survival | [10.1016/j.biomaterials.2017.05.008](https://doi.org/10.1016/j.biomaterials.2017.05.008) |
| Payne et al. 2019, *Biomaterials* | Cell maturity at transplant decides survival | [10.1016/j.biomaterials.2018.11.020](https://doi.org/10.1016/j.biomaterials.2018.11.020) |
| Casper et al. 2003, *Exp. Neurol.* | The 75 µm blood-vessel distance | [10.1016/s0014-4886(03)00336-4](https://doi.org/10.1016/s0014-4886(03)00336-4) |
| Purcell et al. 2009, *J. Neural Eng.* | Gel breakdown cost neuron survival later | [10.1088/1741-2560/6/2/026005](https://doi.org/10.1088/1741-2560/6/2/026005) |
| De Faveri et al. 2014, *Front. Neuroeng.* | Fibrin coating that dissolves in a week | [10.3389/fneng.2014.00007](https://doi.org/10.3389/fneng.2014.00007) |
| Nemani et al. 2013, *Mater. Sci. Eng. C* | Making SU-8 less toxic | [10.1016/j.msec.2013.07.001](https://doi.org/10.1016/j.msec.2013.07.001) |
| Kim et al. 2024, *Cell* | TNF-α blockade improves graft survival | [10.1016/j.cell.2024.05.030](https://doi.org/10.1016/j.cell.2024.05.030) |
| Park et al. 2023, *Nature* | Regulatory T cells protect grafts | [10.1038/s41586-023-06300-4](https://doi.org/10.1038/s41586-023-06300-4) |

The full citation for every source, including the seed papers, is in the JSON
(`seed_papers_read`, `other_papers_read` and each entry's `original`).

## Limits

- Most results come from cells injected into stroke cavities or tissue, not neurons in surface
  microwells. How well they carry over is our inference and is marked as such.
- Liu 2019 and Keene 2020 are paywalled; only their abstracts and the team's records were used.
  Papers marked "Cited by a seed paper" or "Abstract only" were not read in full.
- The GelMA search was limited, not a systematic review.
