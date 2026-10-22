import { useEffect, useState } from 'react'
import { loadSim } from './data'
import type { Microwell, MicrowellCell, SimOverview } from './types'

const pct = (v: number) => `${Math.round(v * 100)}%`
const points = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(Math.round(v * 100))} points`

function cellAt(wells: Microwell, survival: number, outgrowth: number, conductive: boolean) {
  return wells.cells.find(
    (c) => c.survival === survival && c.outgrowth === outgrowth && c.conductive === conductive,
  )
}

const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length

/** Change in function retained from the lowest to the highest survival, averaged over outgrowth. */
function survivalEffect(wells: Microwell, conductive: boolean) {
  const s0 = wells.survival[0]
  const s1 = wells.survival[wells.survival.length - 1]
  const at = (s: number, o: number) => cellAt(wells, s, o, conductive)?.retained ?? 0
  return mean(wells.outgrowth.map((o) => at(s1, o) - at(s0, o)))
}

/** Function retained at each outgrowth level, averaged over survival (it needn't be monotonic). */
function byOutgrowth(wells: Microwell, conductive: boolean) {
  return wells.outgrowth.map((o) => ({
    outgrowth: o,
    retained: mean(wells.survival.map((s) => cellAt(wells, s, o, conductive)?.retained ?? 0)),
  }))
}

function Heatmap({ wells, conductive, lo, hi }: { wells: Microwell; conductive: boolean; lo: number; hi: number }) {
  const rows = [...wells.outgrowth].reverse() // most outgrowth on top
  return (
    <figure className="heatmap">
      <figcaption>{conductive ? 'Conductive gel' : 'No conductive gel (bare wells or plain gel)'}</figcaption>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Outgrowth ↓ / survival →</th>
              {wells.survival.map((s) => (
                <th key={s} scope="col">
                  {pct(s)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o}>
                <th scope="row">×{o}</th>
                {wells.survival.map((s) => {
                  const cell = cellAt(wells, s, o, conductive)
                  if (!cell) return <td key={s}>—</td>
                  const t = hi > lo ? (cell.retained - lo) / (hi - lo) : 0.5
                  return (
                    <td
                      key={s}
                      className="heat"
                      style={{
                        background: `color-mix(in srgb, var(--accent) ${Math.round(15 + t * 75)}%, var(--panel))`,
                        color: t > 0.55 ? '#fff' : 'var(--fg)',
                      }}
                      title={`Survival ${pct(s)}, outgrowth ×${o}: ${pct(cell.retained)} ± ${Math.round(cell.retained_sd * 100)} function retained`}
                    >
                      {pct(cell.retained)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}

export default function MicrowellView() {
  const [overview, setOverview] = useState<SimOverview | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    loadSim()
      .then(setOverview)
      .catch((err: Error) => setError(err.message))
  }, [])

  if (error) return <p className="error">{error}</p>
  if (!overview) return <p className="hint">Loading the microwell study…</p>
  const wells = overview.microwell
  if (!wells) {
    return (
      <p className="error">
        The microwell study hasn't been computed for this version. Run scripts/precompute_sim.py.
      </p>
    )
  }

  const all = wells.cells.map((c) => c.retained)
  const lo = Math.min(...all, wells.bare.retained)
  const hi = Math.max(...all, wells.bare.retained)
  const outgrowthLine = (conductive: boolean) =>
    byOutgrowth(wells, conductive)
      .map((o) => `${pct(o.retained)} at ×${o.outgrowth}`)
      .join(', ')
  const plainLevels = byOutgrowth(wells, false).map((o) => o.retained)
  const mostOutgrowthIsBest = plainLevels[plainLevels.length - 1] >= Math.max(...plainLevels)
  const gelEffect = mean(
    wells.cells
      .filter((c) => c.conductive)
      .map((c) => c.retained - (cellAt(wells, c.survival, c.outgrowth, false)?.retained ?? c.retained)),
  )
  const best = wells.cells.reduce((a: MicrowellCell, b) => (b.retained > a.retained ? b : a))
  const noImplant = overview.examples.find((e) => e.id === 'host_only')?.result?.retained_function
  const ref = wells.bare.reference
  const noise = Math.round(Math.max(...wells.cells.map((c) => c.retained_sd), wells.bare.retained_sd) * 100)

  return (
    <section className="microwell">
      <h2>Bare vs gel-filled microwells</h2>
      <p>
        The team's proposed experiment asks whether filling the implant's SU-8 microwells with a
        soft hydrogel, and making that gel conductive, helps grafted neurons survive and grow out
        into the brain. The materials can't be simulated here, so we ask the next question: if a
        gel delivered a given <strong>survival</strong> and <strong>outgrowth</strong>, how much
        short-term memory function would the patient keep as host neurons die? This uses the
        engineered-graft architecture from the Simulate tab.
      </p>

      <div className="callout" id="microwell-bare">
        <strong>Bare-well reference: {pct(wells.bare.retained)}</strong> function retained (±{' '}
        {Math.round(wells.bare.retained_sd * 100)}
        {noImplant !== undefined && <>, vs {pct(noImplant)} with no implant</>}).
        <p className="hint">
          Survival {pct(wells.bare.survival)}: well occupancy fell from{' '}
          {pct(ref.occupancy_at_loading)} at loading to {pct(ref.occupancy_at_3_weeks)} at about
          three weeks (
          <a href={ref.url} target="_blank" rel="noreferrer">
            {ref.citation}
          </a>
          ), used as an approximate proxy for graft survival (occupancy is not a cell count; to
          verify). Outgrowth ×{wells.bare.outgrowth}: an assumption, because the paper reports that
          neurites mostly stayed in superficial cortex but gives no number.
        </p>
      </div>

      <div id="microwell-maps" className="heatmaps">
        <Heatmap wells={wells} conductive={false} lo={lo} hi={hi} />
        <Heatmap wells={wells} conductive lo={lo} hi={hi} />
      </div>
      <p className="hint">
        Cells show function retained (mean memory accuracy above chance across 0–90% host loss),
        averaged over {wells.seeds} seeds; hover for the spread. Survival is the share of graft
        neurons alive. Outgrowth multiplies how many host ↔ graft connections form (×1 = the
        Simulate tab's graft). Conductive gel adds slow, densely coupled gel units around the graft.
        Differences smaller than about {noise} points are within seed-to-seed noise.
      </p>

      <h3>What the map says</h3>
      <ul className="findings-list">
        <li>
          Raising graft survival from {pct(wells.survival[0])} to{' '}
          {pct(wells.survival[wells.survival.length - 1])} changes function retained by{' '}
          <strong>{points(survivalEffect(wells, false))}</strong> without conductive gel and{' '}
          <strong>{points(survivalEffect(wells, true))}</strong> with it (averaged over outgrowth levels).
        </li>
        <li>
          {!mostOutgrowthIsBest && 'More outgrowth is not simply better. '}Averaged over survival
          levels, function retained is{' '}
          {outgrowthLine(false)} without conductive gel, and {outgrowthLine(true)} with it.
        </li>
        <li>
          Adding conductive gel changes it by <strong>{points(gelEffect)}</strong> on average across
          the grid.
        </li>
        <li>
          The best condition in the grid (survival {pct(best.survival)}, outgrowth ×{best.outgrowth},{' '}
          {best.conductive ? 'conductive gel' : 'no conductive gel'}) keeps{' '}
          <strong>{pct(best.retained)}</strong>, against {pct(wells.bare.retained)} for the bare-well
          reference.
        </li>
      </ul>
      <p className="hint">
        These are model predictions to help choose what the experiment should measure and how big
        an improvement would matter, not evidence about real gels. Gel survival and outgrowth are
        exactly what the proposed experiment would measure.
      </p>
    </section>
  )
}
