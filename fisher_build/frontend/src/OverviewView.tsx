import { useEffect, useState } from 'react'
import { loadPresets, loadSim } from './data'
import type { Preset, SimOverview } from './types'

export type Tab = 'overview' | 'score' | 'sim' | 'microwell' | 'rubric'

const pct = (v: number) => `${Math.round(v * 100)}%`

interface Finding {
  tab: Tab
  label: string
  value: string
  text: string
}

/** Headline results, computed from the saved data so they stay true when it's recomputed. */
function findings(presets: Preset[], sim: SimOverview | null): Finding[] {
  const out: Finding[] = []
  const scored = presets.filter((p) => p.result && p.id !== 'healthy_cortex')
  if (scored.length) {
    const top = scored.reduce((a, b) => (b.result!.combined_support > a.result!.combined_support ? b : a))
    const bottom = scored.reduce((a, b) => (b.result!.combined_support < a.result!.combined_support ? b : a))
    const cortex = presets.find((p) => p.id === 'healthy_cortex')?.result
    out.push({
      tab: 'score',
      label: 'Theory support',
      value: `${top.result!.combined_support.toFixed(2)} / 3`,
      text:
        `${top.name} gets the most support across six theories of mind` +
        (cortex ? ` (healthy cortex: ${cortex.combined_support.toFixed(2)})` : '') +
        `, but scores ${top.result!.maintainability.score}/3 on maintainability. ${bottom.name} gets the least ` +
        `(${bottom.result!.combined_support.toFixed(2)}).`,
    })
  }
  const examples = sim?.examples.filter((e) => e.result) ?? []
  const host = examples.find((e) => e.id === 'host_only')?.result
  const implants = examples.filter((e) => e.id !== 'host_only')
  if (host && implants.length) {
    const best = implants.reduce((a, b) => (b.result!.retained_function > a.result!.retained_function ? b : a))
    const beaten = implants.filter((e) => e.result!.retained_function <= host.retained_function)
    const helps = best.result!.retained_function > host.retained_function
    out.push({
      tab: 'sim',
      label: 'Memory kept as neurons die',
      value: pct(helps ? best.result!.retained_function : host.retained_function),
      text: helps
        ? `With the ${best.name.toLowerCase()}, the circuit keeps ${pct(best.result!.retained_function)} of its ` +
          `short-term memory function across 0–90% host loss, vs ${pct(host.retained_function)} with no implant.` +
          (beaten.length ? ` ${beaten.map((e) => e.name).join(' and ')} did no better than no implant.` : '')
        : `With no implant the circuit keeps ${pct(host.retained_function)} of its short-term memory function ` +
          `across 0–90% host loss, and none of the implants kept more.`,
    })
  }
  if (sim?.sweep) {
    const s = sim.sweep.summary
    const names = Object.fromEntries((sim.examples ?? []).map((e) => [e.id, e.name]))
    out.push({
      tab: 'sim',
      label: 'Robustness',
      value: `${s.same_winner} / ${s.total}`,
      text:
        `${names[s.default_ranking[0]]} ranks first in ${s.same_winner} of ${s.total} settings of feedback ` +
        `strength and implant speed, averaged over ${sim.sweep.seeds} random seeds each.`,
    })
  }
  if (sim?.microwell) {
    const w = sim.microwell
    const best = w.cells.reduce((a, b) => (b.retained > a.retained ? b : a))
    out.push({
      tab: 'microwell',
      label: 'Bare vs gel microwells',
      value: `${pct(w.bare.retained)} → ${pct(best.retained)}`,
      text:
        `Graft function retained at bare-well survival (${pct(w.bare.survival)}, from Brown et al.), and the best ` +
        `what-if gel condition in our map (survival ${pct(best.survival)}, outgrowth ×${best.outgrowth}` +
        `${best.conductive ? ', conductive' : ''}).`,
    })
  }
  return out
}

export default function OverviewView({ onNavigate, onStartDemo }: { onNavigate: (tab: Tab) => void; onStartDemo: () => void }) {
  const [presets, setPresets] = useState<Preset[]>([])
  const [sim, setSim] = useState<SimOverview | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    loadPresets()
      .then(setPresets)
      .catch((err: Error) => setError(err.message))
    loadSim()
      .then(setSim)
      .catch((err: Error) => setError(err.message))
  }, [])

  const items = findings(presets, sim)

  return (
    <section className="overview">
      <p className="lede">
        Brain–computer interfaces are starting to connect to the brain through living, grafted
        neurons. For a patient who keeps losing cortex to neurodegeneration, the question moves to
        the device side: <strong>what could an implant be made of to take over part of the lost
        tissue's work?</strong> Theories of mind disagree about what a physical system needs, so we
        test candidates two ways.
      </p>
      <div className="two-ways">
        <div>
          <h3>1. Theory scoring</h3>
          <p>
            Claude judges each candidate substrate against 25 criteria from six theories of mind,
            three separate times; our code turns the verdicts into scores.
          </p>
        </div>
        <div>
          <h3>2. Simulation</h3>
          <p>
            A spiking network stands in for the patient's cortex. We kill off host neurons and
            measure how much function survives with different implants, plus PyPhi and information
            flow.
          </p>
        </div>
      </div>

      <button type="button" className="primary demo-start" onClick={onStartDemo}>
        ▶ Start the 2-minute guided demo
      </button>

      <h2 id="findings">Key findings</h2>
      {error && <p className="error">{error}</p>}
      {!error && items.length === 0 && <p className="hint">Loading results…</p>}
      <div className="findings">
        {items.map((f) => (
          <article key={f.label} className="finding">
            <p className="finding-label">{f.label}</p>
            <p className="finding-value">{f.value}</p>
            <p>{f.text}</p>
            <button type="button" className="link" onClick={() => onNavigate(f.tab)}>
              See the details →
            </button>
          </article>
        ))}
      </div>
      <p className="hint">
        Numbers on this page are computed from the saved results. All of this is a structured way to
        compare and debate architectures, with simulation proxies for function and integration, not
        a claim that any substrate is conscious.
      </p>
    </section>
  )
}
