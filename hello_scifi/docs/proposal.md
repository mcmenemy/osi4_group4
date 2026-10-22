# Draft proposal: neurons in gel-filled vs. bare microwells

*First draft for the team to edit. Numbers in brackets are placeholders to decide.*

## Motivation

Science Corporation's cortical biohybrid implant holds about 90,000 neurons in SU-8 microwells coated with poly-D-lysine and laminin. SU-8 is a rigid epoxy with a stiffness in the gigapascal range, roughly a million times stiffer than brain tissue. In their preprint, 77% of wells held a cell at loading (DAPI) and 52% held neurons expressing a fluorescent label at about three weeks (two different counts, so not a strict survival rate), and neurites mostly stayed in superficial cortex, with only sparse axons detected deeper (Brown et al., bioRxiv 2024).

Soft hydrogels, including conductive PEDOT:PSS gels, are the leading approach for keeping grafted cells alive and integrated. We have not found a published head-to-head comparison of neurons in bare microwells vs. the same microwells filled with a soft gel. Our literature maps (Maps tab) show which gel formulations have been characterized for stiffness, conductivity, and neural cell outcomes, and where the gaps are.

## Question

Does filling SU-8 microwells with a soft, temporary hydrogel improve neuron survival and outgrowth over three weeks?

Science's implant stimulates and reads out optically (light through the coverslip, two-photon imaging), so the first gel should be **clear, degradable, and non-conductive**: it only needs to protect cells through the first days after implantation (when most graft cell death happens) and get out of the way as neurites grow. A **conductive gel** (e.g. PEDOT:PSS-based) is a separate, permanent-interface design that only makes sense for future wells with electrodes; it absorbs visible light and its conductive polymer generally doesn't degrade, so it belongs in a follow-up study.

## Aims

1. **Survival.** Compare the fraction of occupied wells and the number of live neurons per well in bare vs. gel-filled microwells at days 1, 7, and 21 in vitro.
2. **Outgrowth.** Measure neurite length and the fraction of neurites that leave the well, for each condition.
3. **Optical access.** Measure light transmission through each gel at the stimulation and imaging wavelengths while it is present, so a cloudy gel doesn't look like empty wells or block stimulation.
4. **Search.** Use the results to seed a self-driving-lab search over gel formulations for the best survival at acceptable impedance.

## Conditions

| Variable | Levels (to decide) |
|---|---|
| Well fill | Bare SU-8 (PDL + laminin, as in Brown et al.) vs. clear degradable gel |
| Gel type | GelMA or thiolated hyaluronic acid (e.g. HyStem), both widely used and tunable |
| Stiffness | [2-3] levels spanning roughly 0.5-50 kPa, set by polymer and crosslinker concentration; measure each in-house and record the method (compression vs. shear rheology G′) |
| Degradation time | [2] levels, e.g. mostly gone by ~1 week vs. ~3 weeks, set by crosslinking or protease-sensitive linkers |
| Follow-up only | Conductive gel, for electrode-bearing wells |

Keep the cell source (e.g. [primary rodent cortical neurons or iPSC-derived neurons]), seeding density, and coating the same across conditions.

## Readouts

- **Survival:** well occupancy (same definition as Brown et al.) and live/dead counts at days 1, 7, 21.
- **Neurite outgrowth:** total neurite length per neuron and the number of neurites crossing the well rim, from imaging at day 7 and 21.
- **Optical transmission:** at the stimulation and imaging wavelengths, at day 0 and while the gel persists.
- **Gel properties:** stiffness (with test method), degradation time, and swelling of each formulation in culture medium, so results land on the same axes as the literature maps.

## How a self-driving lab would search formulations

After the bare vs. gel comparison, the formulation space (polymer, crosslinker, degradable linkers, and later conductive fillers and additives such as ethylene glycol or ionic liquids) is too large to test by hand. A self-driving lab such as the Seifrid lab's could:

1. Start from the literature maps: the "target window" region and the untested cells of the coverage heatmap give the initial candidates.
2. Make and characterize each gel automatically (stiffness, degradation, swelling, transparency; conductivity and impedance for the conductive follow-up).
3. Run a short neuron assay on promising gels (e.g. day-7 survival and outgrowth).
4. Use Bayesian optimization to choose the next formulation, trading off survival and outgrowth against degradation time and optical clarity.

Every measurement goes into the same record schema as the extracted literature, so lab results and published values sit on the same maps.

## Risks and open questions

- Gels can swell, degrade, or delaminate from SU-8 over three weeks; we need an attachment strategy and a stability readout.
- A gel fill could block neurites from leaving the well instead of helping them; outgrowth across the rim is a key readout.
- Degradation byproducts or swelling could push cells out of a 15 µm-deep well; track swelling and occupancy together.
- Conductive gels (follow-up) add conductivity on top of stiffness and leave non-degrading polymer behind; test them separately.
- The literature values are extracted automatically and partly unreviewed; the Review tab tracks which ones have been checked.
