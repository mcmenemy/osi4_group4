# What can carry a mind? (fisher_build)

A full working build of the project in [the main README](../README.md): score candidate
substrates against six theories of mind, and simulate what happens as a patient's host
neurons die with different implants attached. It uses the same stack as
[`hello_scifi/`](../hello_scifi/README.md): a FastAPI backend on Python 3.13, a React +
TypeScript frontend built with Vite, and one Docker image for Render.

The app has five tabs:

1. **Overview.** The question, the key findings (computed from the saved results, so they
   stay true when results are recomputed), and a **guided demo** for judges: a 9-step
   walkthrough that switches tabs, opens the right panels and highlights what to look at.
2. **Score a substrate.** Pick one of eight preset substrates, or describe your own. Claude
   judges every criterion of six frameworks (functionalism, global workspace, IIT, active
   inference, EM field theory, Orch-OR) plus maintainability, and explains each verdict.
   Presets are judged three separate times and scored on the majority verdict, with
   disagreements marked; they load instantly. Custom text is judged once, live (about
   20-30 seconds). A table compares all presets at a glance.
3. **Simulate neuron loss.** A Brian2 spiking network stands in for the patient's cortex
   and has to perform a short-term memory task. We remove 0-90% of host neurons and
   measure how much of that function survives with no implant, a one-way electronic
   readout, a closed-loop neuromorphic chip, an engineered neural tissue graft, or a
   gel–neuron hybrid. Each architecture also gets transfer entropy (host → implant and
   back) and PyPhi φ_s on a rolled-up 4-node model, and a reciprocity × timescale sweep
   checks whether the ranking holds.
4. **Microwell study.** Ties the simulation to the team's proposed bare vs gel-filled
   microwell experiment ([proposal](../hello_scifi/docs/proposal.md)): maps of how much
   function the graft keeps for each graft survival × outgrowth, with and without
   conductive gel, next to a bare-well reference from Brown et al. (2024).
5. **How scoring works.** The rubric, the formula and the references.

Everything is labelled as a structured comparison and as proxies for function and
integration, not as a claim that anything is conscious.

## How scoring works

- Claude (default `claude-opus-5-5`) returns a verdict for each of 25 criteria: met,
  partly met, unclear, or not met, each with one or two sentences of reasoning. It uses
  structured outputs, so the answer always has the right shape, and the code checks that
  every criterion came back exactly once (it retries once if not).
- **Our code, not Claude, turns verdicts into scores**, so a score can't disagree with
  the reasoning shown next to it. Met = 1 point, partly or unclear = ½, not met = 0.
  The share of points is scaled to 0-3 and rounded half up.
- **Core criteria** are the ones a theory treats as necessary (for example, IIT's
  "reentrant architecture"). Core not met → that framework scores 0. Core only partly
  met or unclear → capped at 2.
- **Combined support** is the mean of the six framework scores. **Maintainability** is
  scored the same way but kept separate; higher means easier to keep running.
- **Consistency.** Each preset is judged 3 times independently. Each criterion uses the
  majority verdict (with no majority, the middle one), and the app marks criteria where
  the runs split ("2 of 3 runs") and shows how many criteria were unanimous. This shows
  where Claude was unsure instead of hiding it.

The rubric lives in [`backend/app/rubric.py`](backend/app/rubric.py) and is marked
`draft-1`: **Patrick should review it.** To change it, edit the criteria text, bump
`RUBRIC_VERSION`, and re-score the presets (below). Changing only the scoring formula
(`VERDICT_POINTS`, the core-criterion caps) takes effect immediately without calling
Claude again, because scores are recomputed from the saved verdicts.

## How the simulation works

- **Task (short-term memory).** Each trial flashes one of four inputs for 50 ms; each
  input drives a random quarter of the host neurons. The readout must say which input it
  was from spikes 10-60 ms *after* it has gone. Input only ever enters through the host,
  which holds the trace through recurrent excitation over slow (NMDA-like, 50 ms)
  synapses, so the more neurons die, the faster it forgets. An implant can only take over
  if it picked the input up from the host and can hold it itself.
- **Neuron loss.** Each dropout level (0, 20, 40, 60, 80, 90% of host neurons) runs as its
  own copy of the circuit with identical wiring and input, all in one Brian2 network.
  Dead neurons never fire.
- **Function preserved** is the cross-validated accuracy of a ridge-regularized linear
  decoder retrained on the surviving neurons (host + graft + device) at each level.
  **Function retained** averages the accuracy above chance across levels (0-100%).
- **Implants** keep themselves responsive as host input fades: each one scales the gain of
  its host → implant synapses to hold its own firing rate near a target, like homeostatic
  plasticity in living neurons or automatic gain control in electronics. Living tissue
  and the gel have slow synapses (50 ms); electronics have fast ones (5 ms).
- **Seeds.** Precomputed results average 5 random seeds (different wiring, inputs, noise
  and dropout order), and the charts show ± one standard deviation as error bars; the
  sweep and the microwell maps average 3. A single run can be lucky: an early version of
  this model looked like implants helped, until averaging over seeds showed it was noise.
  That's why the task is now memory, where the effect is robust.
- **Information flow** is Gaussian-copula transfer entropy (the method of Ince et al. 2017,
  the same approach as the `gcmi` package) between host and implant population rates, with
  a shuffled-timing null for significance.
- **Integration** is PyPhi 2.0.0rc4 (IIT 4.0) on a rolled-up model: the host as two nodes
  and the implant as two nodes, each ON when its population fires above its own average.
  Connectivity comes from the real synapses and transition probabilities from the
  simulation. We report the main complex's φ_s and how often it includes the implant.
- **Sweep.** Feedback ×0, ×1, ×2 (implant → host connection probability) times implant
  speed ×2, ×1, ×0.5 (membrane and synapse time constants), for every architecture.
- **Microwell study.** The engineered-graft circuit with graft survival from 40% to 100%
  (graft neurons die before the run), outgrowth ×0.25 to ×2 (scales host ↔ graft
  connections), and with or without conductive gel units. The bare-well reference uses
  survival 0.675 = 52% / 77% well occupancy from Brown et al. as an approximate proxy (to
  verify: occupancy isn't a cell count) and outgrowth ×0.5, which is an assumption.
  Survival and outgrowth in gel are unknown; measuring them is the team's experiment.
  Details in [`backend/app/microwell.py`](backend/app/microwell.py).

Model details and parameters are in [`backend/app/circuit.py`](backend/app/circuit.py).
The architectures model circuit-level properties only. A digital computer running the
same spiking model as the neuromorphic chip would behave identically here; the physical
differences between substrates are what the scoring tab is for.

## Run it locally (Windows, Git Bash)

You need [uv](https://docs.astral.sh/uv/) and [Node.js](https://nodejs.org/) LTS (see
[hello_scifi's prerequisites](../hello_scifi/README.md#prerequisites)), plus an Anthropic
API key for live custom scoring. Presets and simulations work without a key.

One-time setup:

```bash
cd ~/osi4_group4/fisher_build/backend && uv sync
cp .env.example .env
cd ~/osi4_group4/fisher_build/frontend && npm install
```

Open `backend/.env` (for example `notepad .env`) and paste your key after
`ANTHROPIC_API_KEY=`. Never commit `.env`; the repo's `.gitignore` already blocks it.

Run it in two Git Bash windows:

```bash
cd ~/osi4_group4/fisher_build/backend && uv run uvicorn app.main:app --reload --env-file .env
```

```bash
cd ~/osi4_group4/fisher_build/frontend && npm run dev
```

Open http://localhost:5173. If `hello_scifi`'s backend is already using port 8000, stop
it first (Ctrl+C in its window).

## Tests

```bash
cd ~/osi4_group4/fisher_build/backend && uv run pytest
```

Claude is mocked, so tests need no key and cost nothing. They check the scoring formula,
the API, the decoder, transfer entropy and the PyPhi model against inputs with known
answers, run small real Brian2 simulations, and **fail if the saved preset scores or
simulation results are out of date** with the code. Frontend checks:

```bash
cd ~/osi4_group4/fisher_build/frontend && npm run lint && npm run build
```

## Updating the saved results

Preset scores (calls Claude 3 times per changed preset, about 1 minute and roughly $0.25
per preset with Opus):

```bash
cd ~/osi4_group4/fisher_build/backend && uv run --env-file .env python -m scripts.score_presets
```

Simulation results (no key needed). There are three parts, saved to separate files; each
takes 15-30 minutes, so run them in three Git Bash windows at once:

```bash
cd ~/osi4_group4/fisher_build/backend && uv run python -m scripts.precompute_sim --part examples
```

```bash
cd ~/osi4_group4/fisher_build/backend && uv run python -m scripts.precompute_sim --part sweep
```

```bash
cd ~/osi4_group4/fisher_build/backend && uv run python -m scripts.precompute_sim --part microwell
```

Both scripts only redo what is missing or outdated; add `--all` to redo everything.
Commit the updated files in `backend/app/data/`.

## Deploy to Render

Same steps as [hello_scifi's deploy guide](../hello_scifi/README.md#deploy-to-render),
with these differences:

- **Root Directory:** `fisher_build`
- **Environment variables:** `ANTHROPIC_API_KEY` (required for custom scoring). Optional:
  `SCORING_MODEL` (default `claude-opus-5-5`), `SCORING_EFFORT` (default `medium`),
  `SCORE_RATE_LIMIT_PER_MINUTE` (default 3 per visitor), `DAILY_SCORE_LIMIT` (default
  200 live scores per day, to cap spend), `SIM_RATE_LIMIT_PER_MINUTE` (default 2).
- Live simulation runs are CPU-heavy. On Render's free instance one takes roughly a minute
  (Brian2 was about 9× slower there than on a laptop), so the tab shows precomputed
  results first and live runs are optional.

## Project layout

```
fisher_build/
├── Dockerfile                 # builds the React app, then serves it from FastAPI
├── backend/
│   ├── app/main.py            # API routes, rate limits, serves the frontend in production
│   ├── app/rubric.py          # frameworks, criteria, scoring formula (Patrick: edit here)
│   ├── app/presets.py         # the eight preset substrate descriptions
│   ├── app/scoring.py         # Claude call (structured output) and preset cache
│   ├── app/circuit.py         # Brian2 host/graft/device simulation and example architectures
│   ├── app/decoding.py        # cross-validated ridge decoder
│   ├── app/info.py            # Gaussian-copula transfer entropy
│   ├── app/macro_phi.py       # PyPhi on the rolled-up 4-node model
│   ├── app/microwell.py       # bare vs gel microwell conditions (with the Brown et al. reference)
│   ├── app/simulation.py      # seed averaging, precomputed results, sweep, live runs
│   ├── app/data/              # preset_scores.json, sim_examples/sweep/microwell.json (committed)
│   ├── scripts/               # score_presets.py, precompute_sim.py
│   └── tests/                 # test_scoring.py, test_simulation.py
└── frontend/src/
    ├── App.tsx                # tabs and the guided demo
    ├── OverviewView.tsx       # key findings, computed from the saved results
    ├── ScoreView.tsx          # presets, custom text, results, comparison table
    ├── SimView.tsx            # simulation charts, sweep table, live runs
    ├── MicrowellView.tsx      # survival x outgrowth maps
    ├── RubricView.tsx         # "How scoring works"
    ├── Demo.tsx, demoSteps.ts # the guided demo's bar and its steps
    ├── LineChart.tsx          # small SVG line chart with error bars
    ├── data.ts                # shared loading of presets and simulation results
    └── types.ts               # API types and fetch helper
```

## Known limits

- The rubric is a draft until Patrick reviews it, and Claude's verdicts are judgements,
  not measurements. The 3-run consensus shows where Claude was unsure; live custom scores
  are a single run.
- The microwell maps say what a given survival and outgrowth would mean in the model, not
  what real gels do. Only the bare-well survival proxy comes from data.
- The simulation is a toy model with hand-picked parameters. It shows how architectures
  compare under the same assumptions, not what a real implant would do.
- φ_s values depend on the 4-node grouping; compare architectures, don't read absolute
  values. Live runs analyze only the most common network states, so their φ_s can
  differ slightly from the precomputed charts.
- Rate limits and the live-score cache are in memory and reset when the server restarts.
