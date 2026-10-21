import { useState, type FormEvent, type PointerEvent } from 'react'

// Brian2 package check: runs a small spiking network on the backend and plots it.

type SimResult = {
  brian2_version: string
  codegen_target: string
  n_neurons: number
  duration_ms: number
  n_synapses: number
  n_spikes: number
  build_ms: number
  sim_ms: number
  bin_ms: number
  rate_hz: number[]
  alive: number[]
  raster_neurons: number
  raster: { t_ms: number[]; i: number[] }
}

const WIDTH = 600
const PAD = { left: 44, right: 8 }
const PLOT_W = WIDTH - PAD.left - PAD.right

export default function SimCheck() {
  const [nNeurons, setNNeurons] = useState(200)
  const [durationMs, setDurationMs] = useState(1000)
  const [dropoutPerS, setDropoutPerS] = useState(50)
  const [result, setResult] = useState<SimResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [hoverBin, setHoverBin] = useState<number | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/sim/hello', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          n_neurons: nNeurons,
          duration_ms: durationMs,
          dropout_per_s: dropoutPerS,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(typeof data.detail === 'string' ? data.detail : 'Check the input ranges.')
      }
      setResult(data)
      setHoverBin(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="sim">
      <h2>Package check: Brian2</h2>
      <p className="tagline">
        Runs a small spiking network on the server while neurons drop out, to confirm Brian2 works
        end to end and to time it on this machine.
      </p>

      <form onSubmit={handleSubmit} className="sim-inputs">
        <label>
          Neurons <span className="hint">10–1000</span>
          <input type="number" min={10} max={1000} value={nNeurons}
            onChange={(e) => setNNeurons(Number(e.target.value))} />
        </label>
        <label>
          Duration (ms) <span className="hint">100–2000</span>
          <input type="number" min={100} max={2000} step={100} value={durationMs}
            onChange={(e) => setDurationMs(Number(e.target.value))} />
        </label>
        <label>
          Dropout (%/s) <span className="hint">chance per surviving neuron</span>
          <input type="number" min={0} max={500} step={10} value={dropoutPerS}
            onChange={(e) => setDropoutPerS(Number(e.target.value))} />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Simulating…' : 'Run simulation'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {result && (
        <div className={loading ? 'sim-result stale' : 'sim-result'}>
          <Stats result={result} />
          <Readout result={result} bin={hoverBin} />
          <Raster result={result} hoverBin={hoverBin} onHover={setHoverBin} />
          <LineChart title="Firing rate per surviving neuron (Hz)" values={result.rate_hz}
            result={result} hoverBin={hoverBin} onHover={setHoverBin} />
          <LineChart title="Neurons alive" values={result.alive} yMax={result.n_neurons}
            result={result} hoverBin={hoverBin} onHover={setHoverBin} showTimeAxis />
        </div>
      )}
    </section>
  )
}

function Stats({ result }: { result: SimResult }) {
  const items = [
    ['Sim time', `${Math.round(result.sim_ms)} ms`],
    ['Build time', `${Math.round(result.build_ms)} ms`],
    ['Spikes', result.n_spikes.toLocaleString()],
    ['Synapses', result.n_synapses.toLocaleString()],
    ['Brian2', `${result.brian2_version} · ${result.codegen_target}`],
  ]
  return (
    <dl className="stats">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Readout({ result, bin }: { result: SimResult; bin: number | null }) {
  const b = bin ?? result.alive.length - 1
  return (
    <p className="readout">
      <span>{bin === null ? 'End of run' : `t = ${b * result.bin_ms}–${(b + 1) * result.bin_ms} ms`}</span>
      <strong>{result.rate_hz[b].toFixed(1)} Hz</strong> per surviving neuron ·{' '}
      <strong>{result.alive[b]}</strong> of {result.n_neurons} alive
    </p>
  )
}

type HoverProps = {
  result: SimResult
  hoverBin: number | null
  onHover: (bin: number | null) => void
}

function x(t_ms: number, duration: number) {
  return PAD.left + (t_ms / duration) * PLOT_W
}

// Shared crosshair: snaps the pointer to the nearest time bin.
function hoverHandlers({ result, onHover }: HoverProps) {
  return {
    onPointerMove(event: PointerEvent<SVGSVGElement>) {
      const rect = event.currentTarget.getBoundingClientRect()
      const px = ((event.clientX - rect.left) / rect.width) * WIDTH
      const t = ((px - PAD.left) / PLOT_W) * result.duration_ms
      const bin = Math.floor(t / result.bin_ms)
      onHover(bin >= 0 && bin < result.alive.length ? bin : null)
    },
    onPointerLeave() {
      onHover(null)
    },
  }
}

function Crosshair({ result, hoverBin, height }: { result: SimResult; hoverBin: number | null; height: number }) {
  if (hoverBin === null) return null
  const cx = x((hoverBin + 0.5) * result.bin_ms, result.duration_ms)
  return <line className="crosshair" x1={cx} x2={cx} y1={0} y2={height} />
}

function Raster(props: HoverProps) {
  const { result, hoverBin } = props
  const height = 140
  const n = result.raster_neurons
  return (
    <figure>
      <figcaption>
        Spike raster{n < result.n_neurons ? ` (first ${n} of ${result.n_neurons} neurons)` : ''}
      </figcaption>
      <svg viewBox={`0 0 ${WIDTH} ${height}`} role="img"
        aria-label={`Spike raster of ${result.n_spikes} spikes`} {...hoverHandlers(props)}>
        <line className="axis" x1={PAD.left} x2={WIDTH - PAD.right} y1={height} y2={height} />
        <text className="tick" x={PAD.left - 6} y={10} textAnchor="end">{n}</text>
        <text className="tick" x={PAD.left - 6} y={height - 2} textAnchor="end">0</text>
        {result.raster.t_ms.map((t, k) => (
          <rect key={k} className="spike" x={x(t, result.duration_ms)}
            y={height - ((result.raster.i[k] + 1) / n) * height} width={1.2}
            height={Math.max(height / n, 1)} />
        ))}
        <Crosshair result={result} hoverBin={hoverBin} height={height} />
      </svg>
    </figure>
  )
}

function LineChart(props: HoverProps & { title: string; values: number[]; yMax?: number; showTimeAxis?: boolean }) {
  const { result, hoverBin, title, values, showTimeAxis } = props
  const height = 90
  const bottom = showTimeAxis ? 18 : 6
  const plotH = height - bottom - 6
  const yMax = props.yMax ?? Math.max(...values, 1)
  const y = (v: number) => 6 + plotH - (v / yMax) * plotH
  const points = values
    .map((v, b) => `${x((b + 0.5) * result.bin_ms, result.duration_ms)},${y(v)}`)
    .join(' ')
  return (
    <figure>
      <figcaption>{title}</figcaption>
      <svg viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-label={title} {...hoverHandlers(props)}>
        <line className="grid" x1={PAD.left} x2={WIDTH - PAD.right} y1={y(yMax)} y2={y(yMax)} />
        <line className="axis" x1={PAD.left} x2={WIDTH - PAD.right} y1={y(0)} y2={y(0)} />
        <text className="tick" x={PAD.left - 6} y={y(yMax) + 4} textAnchor="end">{Math.round(yMax)}</text>
        <text className="tick" x={PAD.left - 6} y={y(0) + 4} textAnchor="end">0</text>
        <polyline className="series" points={points} />
        {showTimeAxis &&
          [0, 0.5, 1].map((f) => (
            <text key={f} className="tick" x={x(f * result.duration_ms, result.duration_ms)}
              y={height - 4} textAnchor={f === 0 ? 'start' : f === 1 ? 'end' : 'middle'}>
              {Math.round(f * result.duration_ms)} ms
            </text>
          ))}
        {hoverBin !== null && (
          <circle className="marker" cx={x((hoverBin + 0.5) * result.bin_ms, result.duration_ms)}
            cy={y(values[hoverBin])} r={4} />
        )}
        <Crosshair result={result} hoverBin={hoverBin} height={height - bottom} />
      </svg>
    </figure>
  )
}
