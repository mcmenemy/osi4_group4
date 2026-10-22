import { useEffect, useState, type FormEvent } from 'react'
import LineChart, { type Series } from './LineChart'
import { loadSim } from './data'
import { api, type SimExample, type SimLevel, type SimOverview, type SimResult } from './types'

const COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)']
const pct = (v: number) => `${Math.round(v * 100)}%`
const QUARTERS = [0, 0.25, 0.5, 0.75, 1]

type Readout = 'all' | 'implant'

/** Each architecture keeps one colour everywhere, by its position in the example list. */
function colorOf(examples: SimExample[], id: string): string {
  return COLORS[Math.max(examples.findIndex((e) => e.id === id), 0) % COLORS.length]
}

function seriesFor(
  examples: SimExample[],
  include: (e: SimExample) => boolean,
  value: (level: SimLevel) => number | null,
  err?: (level: SimLevel) => number | null | undefined,
): Series[] {
  return examples
    .filter((e) => e.result && include(e))
    .map((e) => ({
      id: e.id,
      label: e.name,
      color: colorOf(examples, e.id),
      points: e.result!.levels.map((lv) => ({ x: lv.host_lost, y: value(lv), err: err?.(lv) })),
    }))
}

function Legend({
  examples,
  shown,
  toggle,
}: {
  examples: SimExample[]
  shown: Set<string>
  toggle: (id: string) => void
}) {
  return (
    <fieldset className="legend">
      <legend>Architectures</legend>
      {examples.map((e) => (
        <label key={e.id} title={e.description}>
          <input type="checkbox" checked={shown.has(e.id)} onChange={() => toggle(e.id)} />
          <span className="swatch" style={{ background: colorOf(examples, e.id) }} />
          {e.name}
        </label>
      ))}
    </fieldset>
  )
}

function TeChart({ result, color }: { result: SimResult; color: string }) {
  const levels = result.levels.filter((lv) => lv.te)
  if (!levels.length) return <p className="hint">No implant, so no host ↔ implant information flow.</p>
  const series: Series[] = [
    {
      id: 'h2i',
      label: 'Host → implant',
      color,
      points: levels.map((lv) => ({
        x: lv.host_lost,
        y: lv.te!.host_to_implant.bits,
        hollow: !lv.te!.host_to_implant.significant,
        note: lv.te!.host_to_implant.significant ? 'above chance' : 'not above chance',
      })),
    },
    {
      id: 'i2h',
      label: 'Implant → host',
      color: 'var(--muted)',
      dashed: true,
      points: levels.map((lv) => ({
        x: lv.host_lost,
        y: lv.te!.implant_to_host.bits,
        hollow: !lv.te!.implant_to_host.significant,
        note: lv.te!.implant_to_host.significant ? 'above chance' : 'not above chance',
      })),
    },
  ]
  const top = Math.max(0.05, ...series.flatMap((s) => s.points.map((p) => p.y ?? 0)))
  return (
    <>
      <LineChart series={series} yMin={0} yMax={Math.ceil(top * 20) / 20} yLabel="Transfer entropy (bits)" formatY={(v) => v.toFixed(2)} />
      <p className="chart-key">
        <span className="key-line" style={{ borderColor: color }} /> Host → implant
        <span className="key-line dashed" /> Implant → host
        <span className="key-dot" /> filled = above the shuffled-timing null (95th percentile) in most seeds, open = not
      </p>
    </>
  )
}

function SweepTable({ overview }: { overview: SimOverview }) {
  const sweep = overview.sweep
  if (!sweep) return <p className="error">The sweep hasn't been computed for this version. Run scripts/precompute_sim.py.</p>
  const names = Object.fromEntries(overview.examples.map((e) => [e.id, e.name]))
  const s = sweep.summary
  const winner = s.default_ranking[0]
  return (
    <>
      <p>
        At the default settings the ranking is{' '}
        {s.default_ranking.map((id, i) => (
          <span key={id}>
            {i > 0 && ' > '}
            <strong>{names[id]}</strong>
          </span>
        ))}
        . The full ranking is identical in <strong>{s.same_ranking} of {s.total}</strong> settings, and{' '}
        {names[winner]} comes first in <strong>{s.same_winner} of {s.total}</strong>.
      </p>
      <div className="table-wrap">
        <table className="sweep">
          <thead>
            <tr>
              <th rowSpan={2}>Architecture</th>
              {sweep.reciprocity.map((r) => (
                <th key={r} colSpan={sweep.timescale.length}>
                  Feedback ×{r}
                </th>
              ))}
              <th rowSpan={2}>Mean rank</th>
              <th rowSpan={2}>Beats no implant</th>
            </tr>
            <tr>
              {sweep.reciprocity.flatMap((r) =>
                sweep.timescale.map((t) => <th key={`${r}-${t}`}>speed ×{1 / t}</th>),
              )}
            </tr>
          </thead>
          <tbody>
            {overview.examples.map((e) => (
              <tr key={e.id}>
                <th scope="row">{e.name}</th>
                {sweep.cells.map((c) => (
                  <td
                    key={`${c.reciprocity}-${c.timescale}`}
                    className={c.ranking[0] === e.id ? 'best num' : 'num'}
                    title={`Rank ${c.ranking.indexOf(e.id) + 1} of ${c.ranking.length}`}
                  >
                    {pct(c.retained[e.id])}
                  </td>
                ))}
                <td className="num">{s.mean_rank[e.id]?.toFixed(1)}</td>
                <td className="num">{e.id === 'host_only' ? '—' : `${s.beats_no_implant[e.id]} / ${s.total}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">
        Cells show function retained (mean accuracy above chance across all dropout levels, as a
        share of perfect), averaged over {overview.task.sweep_seeds} seeds. Bold = best in that
        setting. Feedback scales how many implant → host connections there are (×0 makes every
        implant one-way). Speed scales the implant's membrane and synapse time constants (×2 =
        twice as fast, ×0.5 = twice as slow).
      </p>
    </>
  )
}

function LiveRun({ overview }: { overview: SimOverview }) {
  const architectures = overview.examples
  const [id, setId] = useState(architectures[architectures.length - 1]?.id ?? '')
  const [reciprocity, setReciprocity] = useState(1)
  const [timescale, setTimescale] = useState(1)
  const [result, setResult] = useState<SimResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function run(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      setResult(await api<SimResult>('/api/sim/run', { id, reciprocity, timescale }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const precomputed = overview.examples.find((e) => e.id === result?.id)?.result
  const color = result ? colorOf(overview.examples, result.id) : 'var(--accent)'
  return (
    <section>
      <h3 id="sim-live">Run your own setting</h3>
      <p className="hint">
        Runs one architecture live on the server: one seed with {overview.task.trials} trials per
        dropout level (the charts above average {overview.task.example_seeds} seeds), and PyPhi on
        the {overview.live.phi_max_states} most common network states. It takes several seconds on
        a laptop and up to a couple of minutes on the free server.
      </p>
      <form className="sim-inputs" onSubmit={run}>
        <label>
          Architecture
          <select value={id} onChange={(e) => setId(e.target.value)}>
            {architectures.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Feedback ×{reciprocity}
          <input
            type="range"
            min={overview.live.reciprocity[0]}
            max={overview.live.reciprocity[1]}
            step={0.25}
            value={reciprocity}
            onChange={(e) => setReciprocity(Number(e.target.value))}
          />
        </label>
        <label>
          Implant speed
          <select value={timescale} onChange={(e) => setTimescale(Number(e.target.value))}>
            <option value={0.5}>×2 (faster)</option>
            <option value={1}>×1 (default)</option>
            <option value={2}>×0.5 (slower)</option>
          </select>
        </label>
        <button type="submit" disabled={loading || !id}>
          {loading ? 'Simulating…' : 'Run simulation'}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      {result && (
        <div className="live-result">
          <p>
            <strong>{result.name}</strong>, feedback ×{result.settings.reciprocity}, speed ×
            {1 / result.settings.timescale}: function retained <strong>{pct(result.retained_function)}</strong>
            {precomputed && ` (default settings: ${pct(precomputed.retained_function)})`}. Took{' '}
            {(result.total_ms / 1000).toFixed(1)} s.
          </p>
          <LineChart
            series={[
              ...(precomputed
                ? [
                    {
                      id: 'default',
                      label: `${result.name} (default settings)`,
                      color: 'var(--muted)',
                      dashed: true,
                      points: precomputed.levels.map((lv) => ({ x: lv.host_lost, y: lv.accuracy })),
                    },
                  ]
                : []),
              {
                id: 'live',
                label: `${result.name} (your settings)`,
                color,
                points: result.levels.map((lv) => ({ x: lv.host_lost, y: lv.accuracy })),
              },
            ]}
            yMin={0}
            yMax={1}
            yTicks={QUARTERS}
            yLabel="Recall accuracy"
            formatY={pct}
            reference={{ y: result.chance, label: 'chance' }}
          />
          <p className="chart-key">
            <span className="key-line" style={{ borderColor: color }} /> your settings
            <span className="key-line dashed" /> default settings (precomputed, {overview.task.example_seeds}-seed average)
          </p>
        </div>
      )}
    </section>
  )
}

export default function SimView() {
  const [overview, setOverview] = useState<SimOverview | null>(null)
  const [error, setError] = useState('')
  const [shown, setShown] = useState<Set<string>>(new Set())
  const [readout, setReadout] = useState<Readout>('all')
  const [teArch, setTeArch] = useState('')

  useEffect(() => {
    loadSim()
      .then((data) => {
        setOverview(data)
        setShown(new Set(data.examples.map((e) => e.id)))
        const implants = data.examples.filter((e) => e.id !== 'host_only')
        setTeArch(implants[implants.length - 1]?.id ?? '')
      })
      .catch((err: Error) => setError(err.message))
  }, [])

  if (error) return <p className="error">{error}</p>
  if (!overview) return <p className="hint">Loading simulations…</p>

  const examples = overview.examples
  const missing = examples.filter((e) => !e.result)
  const toggle = (id: string) =>
    setShown((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const teExample = examples.find((e) => e.id === teArch)
  const isShown = (e: SimExample) => shown.has(e.id)
  const last = overview.task.dropout.length - 1
  const lossAt = (lv: number) => pct(overview.task.dropout[lv])

  return (
    <section className="sim">
      <h2>Simulate neuron loss</h2>
      <p>
        A small spiking network stands in for the patient's cortex. The function we test is{' '}
        <strong>short-term memory</strong>: each trial flashes one of {overview.task.n_classes}{' '}
        inputs for {overview.task.stim_ms} ms, and a linear readout must say which one it was{' '}
        {overview.task.readout_ms[0] - overview.task.stim_ms}–
        {overview.task.readout_ms[1] - overview.task.stim_ms} ms <em>after</em> it has gone. The
        input only ever enters through the host, which holds the trace through recurrent activity.
        We remove more and more host neurons and retrain the readout on whatever survives: host,
        graft and device. An implant can only take over if it picked the input up from the host and
        can hold it itself.
      </p>
      <p className="hint">
        Brian2 spiking simulation; information flow by Gaussian-copula transfer entropy; integration
        by PyPhi (IIT 4.0) on a 4-node rolled-up model. These are proxies for retained task
        function and integration, not measures of consciousness. Hover over a point for its value,
        and over an architecture name for its description.
      </p>
      {missing.length > 0 && (
        <p className="error">
          Missing precomputed results for {missing.map((e) => e.name).join(', ')}. Run
          scripts/precompute_sim.py.
        </p>
      )}

      <Legend examples={examples} shown={shown} toggle={toggle} />

      <h3 id="sim-function">1. How much function survives?</h3>
      <div className="mode compact" role="radiogroup" aria-label="Readout">
        {(['all', 'implant'] as const).map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={readout === r}
            className={readout === r ? 'active' : ''}
            onClick={() => setReadout(r)}
          >
            {r === 'all' ? 'Readout from all survivors' : 'Readout from the implant only'}
          </button>
        ))}
      </div>
      <LineChart
        series={seriesFor(
          examples,
          isShown,
          (lv) => (readout === 'all' ? lv.accuracy : lv.accuracy_implant),
          (lv) => (readout === 'all' ? lv.accuracy_sd : lv.accuracy_implant_sd),
        )}
        yMin={0}
        yMax={1}
        yTicks={QUARTERS}
        yLabel="Recall accuracy"
        formatY={pct}
        reference={{ y: overview.task.chance, label: `chance (${pct(overview.task.chance)})` }}
      />
      <div className="table-wrap">
        <table className="summary">
          <thead>
            <tr>
              <th>Architecture</th>
              <th>Function retained</th>
              <th>Accuracy at {lossAt(last - 1)} lost</th>
              <th>Accuracy at {lossAt(last)} lost</th>
              <th>Implant in main complex at {lossAt(last - 1)} lost</th>
            </tr>
          </thead>
          <tbody>
            {examples
              .filter((e) => e.result)
              .map((e) => {
                const lv = e.result!.levels
                return (
                  <tr key={e.id}>
                    <th scope="row">
                      <span className="swatch" style={{ background: colorOf(examples, e.id) }} />
                      {e.name}
                    </th>
                    <td className="num">
                      {pct(e.result!.retained_function)}
                      {e.result!.retained_sd !== undefined && (
                        <span className="sd"> ± {Math.round(e.result!.retained_sd * 100)}</span>
                      )}
                    </td>
                    <td className="num">{pct(lv[last - 1].accuracy)}</td>
                    <td className="num">{pct(lv[last].accuracy)}</td>
                    <td className="num">{e.id === 'host_only' ? '—' : pct(lv[last - 1].phi.implant_in_complex)}</td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>
      <p className="hint">
        Function retained = mean accuracy above chance across all dropout levels, as a share of
        perfect (± = standard deviation across seeds). Each point averages{' '}
        {overview.task.example_seeds} seeds (different wiring, inputs and noise), each
        cross-validated on {overview.task.trials} trials. Error bars show ± one standard deviation
        across seeds.
      </p>

      <h3 id="sim-phi">2. Where does integration sit? (PyPhi)</h3>
      <p>
        Each population is rolled up into a node: the host as two halves (H1, H2) and the implant
        as two nodes. PyPhi finds the <em>main complex</em>, the group of nodes with the most
        integrated information (φ<sub>s</sub>), in each network state. As the host degrades, does
        the main complex move onto the implant?
      </p>
      <div className="chart-pair">
        <figure>
          <figcaption>Share of time the implant is in the main complex</figcaption>
          <LineChart
            series={seriesFor(examples, (e) => isShown(e) && e.id !== 'host_only', (lv) => lv.phi.implant_in_complex)}
            yMin={0}
            yMax={1}
            yTicks={QUARTERS}
            yLabel="Implant in main complex"
            formatY={pct}
          />
        </figure>
        <figure>
          <figcaption>Integrated information of the main complex (mean φ<sub>s</sub>)</figcaption>
          <LineChart
            series={seriesFor(examples, isShown, (lv) => lv.phi.mean_phi_s)}
            yMin={0}
            yMax={Math.max(
              0.1,
              Math.ceil(
                Math.max(...examples.flatMap((e) => e.result?.levels.map((lv) => lv.phi.mean_phi_s) ?? [0])) * 10,
              ) / 10,
            )}
            yLabel="Mean φs"
            formatY={(v) => v.toFixed(2)}
          />
        </figure>
      </div>
      <p className="hint">
        φ<sub>s</sub> values depend on this coarse grouping, so compare architectures with each other
        rather than reading the numbers on their own. No implant has only the two host nodes, so its
        φ<sub>s</sub> isn't directly comparable. Weighted by how often each network state occurs.
      </p>

      <h3 id="sim-te">3. Which way does information flow? (transfer entropy)</h3>
      <label className="field inline">
        Architecture
        <select value={teArch} onChange={(e) => setTeArch(e.target.value)}>
          {examples
            .filter((e) => e.id !== 'host_only')
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
        </select>
      </label>
      {teExample?.result && <TeChart result={teExample.result} color={colorOf(examples, teExample.id)} />}
      <p className="hint">
        Transfer entropy from X to Y: how much X's last 10 ms tells you about Y's next 5 ms beyond
        what Y's own past already tells you, using population firing rates.
      </p>

      <h3 id="sim-sweep">4. Does the ranking hold?</h3>
      <SweepTable overview={overview} />

      <LiveRun overview={overview} />
    </section>
  )
}
