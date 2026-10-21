# What can carry a mind?

Project repo for our [OSI Hackathon @ NC State](https://ncsu-osi-hackathon-materials-2026.github.io/) project (Oct 21–22, 2026). The planning docs, references and hello-world stack test were brought over from our private prep repo.

## Background
[Science Corporation](https://science.xyz) is building brain–computer interfaces that connect to the brain through living neurons instead of wires.

- **Biohybrid cortical implant (mice, 2024).** A thin device about 5 mm across sits on the surface of the cortex and holds roughly 90,000 engineered neurons in microwells. The neurons grow out of the device and into the host brain. In mice, the grafted neurons survived, integrated with host tissue, and could be stimulated with light to guide trained behavior. The pitch is a better trade-off between how many neurons you can reach and how much tissue you damage. This is a preprint, not yet peer-reviewed: [Optogenetic stimulation of a cortical biohybrid implant guides goal directed behavior (bioRxiv, 2024)](https://www.biorxiv.org/content/10.1101/2024.11.22.624907.full.pdf).
- **PRIMA retinal implant (patients).** This is a wireless photovoltaic implant for geographic atrophy, a neurodegenerative form of age-related macular degeneration. A 38-patient multicenter trial reported in the *New England Journal of Medicine* (October 2025) found that most patients regained enough central vision to read letters and words. PRIMA has a CE mark and launched in Europe in 2026. In the US it has FDA Breakthrough Device designation but is not yet approved. Sources: [Science press release on the NEJM results](https://www.businesswire.com/news/home/20251020014793/en/Science-Corp.s-PRIMA-BCI-Implant-Restores-Functional-Central-Vision), [Fighting Blindness update (Aug 2026)](https://www.fightingblindness.org/news/prima-retinal-implant-restores-sight-in-patients-with-geographic-atrophy-from-amd-4402).
- **Local fab.** Science runs a MEMS foundry in Research Triangle Park, acquired from MEMSCAP. It announced a $65M, 50+ job expansion in Durham to manufacture BCI devices and PRIMA ([Axios Raleigh](https://www.axios.com/local/raleigh/2024/07/11/medical-device-company-science-corp-chip-making-triangle), [BusinessNC](https://businessnc.com/med-tech-company-to-add-50-jobs-spent-65-million-in-durham/)).

**Why neurodegeneration.** PRIMA already replaces lost function, vision, in a degenerative disease, but it does so by handing signals to the surviving neurons. The biohybrid implant goes further and adds new neurons that become part of the brain's circuitry. Extend that idea to a patient who is gradually losing cortex to Alzheimer's, ALS, or another neurodegenerative disease. The interface could stay intact while the tissue it connects to keeps shrinking. At that point, reading and writing signals is not the hard question. The hard question is whether anything on the device side could take over some of the lost function as the tissue disappears, and what that device-side substrate would need to be.

## Project Summary
Biohybrid neural interfaces are approaching the clinic. As they mature, the open question moves to the other side of the implant: for a patient losing brain tissue to neurodegeneration, what device-side substrate could take on part of their brain function? Leading theories of mind disagree about what a physical system needs, so we score candidate substrates against several of them at once.

- **Input:** a text description of a substrate (digital computer, quantum computer, neuromorphic chip, OECT network, ionic hydrogel, engineered neural tissue, gel–neuron hybrid, or anything a user submits).
- **Output:** a 0–3 score per framework with criterion-level reasoning, a combined support score, and a maintainability score (how hard the substrate is to keep running; a cortical-neuron graft may score best on the frameworks but be the hardest to maintain).
- **Frameworks (v1):** functionalism, global workspace, integrated information theory, active inference, EM field theory, Orch-OR.

It's a structured way to compare and debate architectures, not a predictor.

## App Plan
**Main view (MVP):** pick an architecture from dropdowns, or type a custom description, and get the framework scores. This view gives people and judges context and something to think about. It's high-level and mostly inferred by an LLM using a rubric Patrick approves. Dropdown presets are scored ahead of time and cached, so they're instant and consistent. Only custom text needs a live LLM call.

**Advanced tab (reach goal):** the input is a *hybrid circuit spec* (host, graft, and device populations, connectivity, a neuron dropout schedule, a readout task). The *graft* is the neurons in the device that connect to the host; the rest of the device may hold more neurons or another substrate, depending on the architecture. The tab simulates host neurons dropping out and plots how much task function the surviving system retains, one degradation curve per architecture. It ships with example specs for judges to pick from, since most users won't want to learn the spec format.

Build in this order; each step is demoable on its own:
1. **[Brian2](https://brian2.readthedocs.io/en/stable/resources/tutorials/index.html)**: spiking simulation of host, graft, and device populations as host neurons are removed, plus the degradation curve. This is the core.
2. **Information shift (transfer entropy, host → device and back):**
   - Try first: [gcmi](https://github.com/robince/gcmi), Gaussian-copula transfer entropy on population firing rates. It's numpy-only and takes milliseconds, so it can run live.
   - If time: [IDTxl](https://github.com/pwollstadt/IDTxl) with its pure-Python `PythonKraskovCMI` estimator (no Java). It's slower but nonlinear and peer-reviewed. Run it offline on one or two example specs to confirm the gcmi results.
3. **[PyPhi](https://pyphi.readthedocs.io/en/latest/)**: Φ (IIT) and which nodes belong to the main complex as the host degrades. Riskiest step; do it last.
   - **Node limit:** PyPhi only handles a handful of binary nodes. The package check found φ_s practical up to ~6–7 nodes, and the full Φ structure up to ~5 (1–2 min at 6). So PyPhi runs on a **coarse-grained, rolled-up model** of the Brian2 network: each node is a whole population (e.g. a host region, the graft, the device), switched ON/OFF by its activity in a time window. Results are relative to that grouping, so compare architectures under the same grouping rather than reading absolute values.

Notes:
- **Function preserved** = accuracy of a simple linear decoder, retrained on the surviving neurons (host + graft + device) after each dropout step. Task input enters through the host.
- Sweep each architecture across reciprocity and timescale settings, and show whether the ranking between architectures holds across the sweep.
- Compute the example specs' results ahead of time for the demo.
- Label outputs as integration proxies and retained task information, not consciousness.
- Orch-OR and EM field theory can't be simulated with these tools, and the UI should say so. The quantum computer substrate is left out of the simulation for the same reason.

**Prep tasks: package checks (Fisher and/or Joshua).** Add a generic hello-world for each library to the [`hello_scifi/` package checks](hello_scifi/README.md#package-checks): install it, run a tiny example through the API, show the result in the UI, and note the run time and memory.
- [x] **Brian2** (done 2026-10-20): spiking network with neuron dropout during the run. Locally about 0.3–0.8 s and under 200 MB for up to 1,000 neurons over 2 s. On Render the same 1,000-neuron, 2 s run took 7.5 s (7.2 s on a second run): memory fits, but CPU is about 9× slower, so precompute the demo or use a faster instance.
- [ ] **gcmi**: transfer entropy between two population firing-rate signals.
- [x] **PyPhi** (done locally 2026-10-20): IIT 4.0 φ_s and Φ for built-in examples and small random networks. Needs PyPhi 2.0.0rc4 (the 1.2.0 release is broken on modern Python), which requires Python 3.13, so the backend moved to 3.13. φ_s alone is fast up to ~7 nodes (0.3 s at 6, 1.3 s at 7 locally). The full Φ structure is milliseconds up to 5 nodes but 1–2 min at 6, so a live ~6 macro-node analysis should compute φ_s only. φ_s = 0 is common in small networks.
- [ ] **IDTxl** (optional, if time): the same transfer entropy with `PythonKraskovCMI`, to compare against gcmi.
- [ ] **Render**: Brian2 timing recorded (above). Still to do: deploy the PyPhi check and record its run times there.

## Team
- **Joshua McMenemy:** DevOps and frontend
- **Fisher White:** LLM scoring pipeline and simulation
- **Patrick Seebold:** theory of mind frameworks and rubric validation
- **Matthew Huang:** TBD
- **Rahin Islam:** TBD

Setup complete: Fisher White (2026-10-19)

## Open Questions & Ideas
Add anything here: frameworks to add or drop, substrates to test, demo ideas, scope cuts.
- Which 2–3 theory of mind frameworks are the MVP if we run short on time?

## Next Steps
- Please commit to this repo, even if it's just adding a sentence to the README. That way we know everyone's development setup works.

## Getting Started
New here? Follow [GIT_START.md](GIT_START.md) to set up an SSH key for GitHub, clone this repo, and install Claude Code (macOS and Windows).

Research papers live in [`refs/`](refs/README.md).

A hello-world test app (FastAPI + React + Claude, deployed to Render) lives in [`hello_scifi/`](hello_scifi/README.md). It's for trying out the stack and deployment, not the project itself.

## Git Test: Add your name below

Matthew Huang

Rahin Islam

Joshua McMenemy

Fisher White
