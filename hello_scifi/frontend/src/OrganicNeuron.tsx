import { useDeferredValue, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { SARKAR_2022, firingWindow, simulate, staticCurve, type OanParams } from './oan'
import type { MapCell, MapRequest, MapRow } from './oanMap.worker'

// Design-map grid: T1 threshold (formulation knob, e.g. DEMTA de-doping) × T1 μC*.
const MAP_VTHS = Array.from({ length: 16 }, (_, k) => 0.3 + k * 0.035)
const MAP_MUCS = Array.from({ length: 12 }, (_, k) => 10 * Math.pow(30, k / 11))
const DOSE_SHIFTS_MV = Array.from({ length: 31 }, (_, k) => k * 5)

const PRESETS: { label: string; params: OanParams }[] = [
  { label: 'Sarkar et al. 2022', params: SARKAR_2022 },
  {
    label: 'DEMTA-doped T1 (Vth 0.42 V)',
    params: { ...SARKAR_2022, t1: { ...SARKAR_2022.t1, vth: 0.42 }, vin: 1.33 },
  },
  {
    label: 'Larger channels (200×80 µm)',
    params: { ...SARKAR_2022, widthUm: 200, lengthUm: 80, vin: 1.82 },
  },
]

type Metric = 'windowMv' | 'rateHz' | 'powerUw'

const METRICS: { key: Metric; label: string; unit: string; bins: number[] }[] = [
  { key: 'windowMv', label: 'Firing window', unit: 'mV', bins: [50, 100, 150] },
  { key: 'rateHz', label: 'Firing rate', unit: 'Hz', bins: [50, 100, 200] },
  { key: 'powerUw', label: 'Power', unit: 'µW', bins: [50, 100, 150] },
]

export default function OrganicNeuron() {
  const [params, setParams] = useState<OanParams>(SARKAR_2022)
  const deferred = useDeferredValue(params)
  const stale = deferred !== params

  const sim = useMemo(() => simulate(deferred), [deferred])
  const curve = useMemo(() => staticCurve(deferred), [deferred])
  const fireWindow = useMemo(() => firingWindow(deferred), [deferred])
  const dose = useMemo(
    () => DOSE_SHIFTS_MV.map((mv) => simulate({ ...deferred, dopamineShift: mv / 1000 }, false).rateHz),
    [deferred],
  )

  function update(patch: Partial<OanParams>) {
    setParams((p) => ({ ...p, ...patch }))
  }

  return (
    <section id="neuron" className="neuron">
      <div className="container">
        <p className="kicker">Organic neuromorphic row · a closer look</p>
        <h2 className="section-title">Build an organic neuron</h2>
        <p className="lede">
          The OECT row is the one most likely to move under real measurement. This is a circuit
          model of the organic artificial neuron from{' '}
          <a href="https://www.nature.com/articles/s41928-022-00859-y">Sarkar et al. 2022</a>: two
          organic electrochemical transistors whose competition makes it spike. Change the film's
          properties and see what kind of neuron that material makes.
        </p>

        <div className="neuron-layout">
          <Controls params={params} fireWindow={fireWindow} onChange={update} onPreset={setParams} />

          <div className={stale ? 'neuron-results stale' : 'neuron-results'}>
            <dl className="tiles">
              <Tile label="Firing rate" value={sim.spiking ? `${sim.rateHz.toFixed(0)} Hz` : '—'} />
              <Tile label="Mean power" value={`${sim.powerUw.toFixed(0)} µW`} />
              <Tile
                label="Firing window"
                value={fireWindow ? `${fireWindow[0].toFixed(2)}–${fireWindow[1].toFixed(2)} V` : 'none'}
              />
              <Tile
                label="State"
                value={sim.spiking ? 'Spiking' : fireWindow ? 'Quiet: bias outside window' : 'Quiet: no window'}
              />
            </dl>
            <SpikeTrace sim={sim} />
            <PhasePlane params={deferred} curve={curve} sim={sim} />
          </div>
        </div>

        <div className="neuron-lower">
          <DoseResponse rates={dose} shiftMv={deferred.dopamineShift * 1000} />
          <DesignMap params={deferred} />
        </div>

        <p className="footnote">
          A phenomenological reconstruction from the paper's supplementary circuit, not the
          authors' simulation. Thresholds and resistors are from the paper; T2's effective threshold
          and both μC* values are calibrated so the model reproduces the published firing window
          (≈1.7–1.8 V) and power (≈143 µW at C = 10 µF). Gate dynamics use the OECT ionic time
          constant τ = C*·W·L·d·R<sub>ion</sub>. Ion and dopamine effects are modeled as threshold
          shifts on T1.
        </p>
      </div>
    </section>
  )
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

/* Controls */

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  log?: boolean
  format: (v: number) => string
  onChange: (v: number) => void
  hint?: string
}

function Slider({ label, value, min, max, step, log, format, onChange, hint }: SliderProps) {
  const toPos = (v: number) => (log ? Math.log(v / min) / Math.log(max / min) : (v - min) / (max - min))
  const fromPos = (t: number) => (log ? min * Math.pow(max / min, t) : min + t * (max - min))
  const pos = toPos(value)
  return (
    <label className="slider">
      <span className="slider-head">
        <span>
          {label}
          {hint && <span className="hint"> {hint}</span>}
        </span>
        <output>{format(value)}</output>
      </span>
      <input
        type="range"
        min={0}
        max={1000}
        value={Math.round(pos * 1000)}
        onChange={(e) => {
          const raw = fromPos(Number(e.target.value) / 1000)
          onChange(step ? Math.round(raw / step) * step : raw)
        }}
      />
    </label>
  )
}

const fmt = {
  muC: (v: number) => `${v.toFixed(0)} F/cm·V·s`,
  volt: (v: number) => `${v.toFixed(3)} V`,
  vth: (v: number) => `${(v * 1000).toFixed(0)} mV`,
  um: (v: number) => `${v.toFixed(0)} µm`,
  nm: (v: number) => `${v.toFixed(0)} nm`,
  ohm: (v: number) => `${(v / 1000).toFixed(1)} kΩ`,
  farad: (v: number) => (v >= 1e-6 ? `${(v * 1e6).toFixed(2)} µF` : `${(v * 1e9).toFixed(0)} nF`),
  mm: (v: number) => `${v.toFixed(0)} mM`,
}

function Controls({
  params: p,
  fireWindow,
  onChange,
  onPreset,
}: {
  params: OanParams
  fireWindow: [number, number] | null
  onChange: (patch: Partial<OanParams>) => void
  onPreset: (p: OanParams) => void
}) {
  return (
    <div className="controls">
      <div className="pills">
        {PRESETS.map((preset) => (
          <button key={preset.label} type="button" className="pill" onClick={() => onPreset(preset.params)}>
            {preset.label}
          </button>
        ))}
      </div>

      <fieldset>
        <legend>T1 · PEDOT:PSS (depletion)</legend>
        <Slider label="μC*" log min={5} max={500} value={p.t1.muC} format={fmt.muC}
          onChange={(v) => onChange({ t1: { ...p.t1, muC: v } })} />
        <Slider label="Threshold" hint="doping lowers it" min={0.2} max={0.9} step={0.005}
          value={p.t1.vth} format={fmt.vth} onChange={(v) => onChange({ t1: { ...p.t1, vth: v } })} />
      </fieldset>

      <fieldset>
        <legend>T2 · p(g2T-TT) (enhancement)</legend>
        <Slider label="μC*" log min={5} max={500} value={p.t2.muC} format={fmt.muC}
          onChange={(v) => onChange({ t2: { ...p.t2, muC: v } })} />
        <Slider label="Effective threshold" min={0} max={0.5} step={0.005} value={p.t2.vth}
          format={fmt.vth} onChange={(v) => onChange({ t2: { ...p.t2, vth: v } })} />
      </fieldset>

      <fieldset>
        <legend>Film and channel</legend>
        <Slider label="Volumetric capacitance C*" log min={10} max={300} value={p.cStar}
          format={(v) => `${v.toFixed(0)} F/cm³`} onChange={(v) => onChange({ cStar: v })} />
        <Slider label="Thickness" log min={20} max={1000} value={p.thicknessNm} format={fmt.nm}
          onChange={(v) => onChange({ thicknessNm: v })} />
        <Slider label="Width" log min={10} max={1000} value={p.widthUm} format={fmt.um}
          onChange={(v) => onChange({ widthUm: v })} />
        <Slider label="Length" log min={5} max={500} value={p.lengthUm} format={fmt.um}
          onChange={(v) => onChange({ lengthUm: v })} />
      </fieldset>

      <fieldset>
        <legend>Circuit</legend>
        <Slider label="Input voltage" min={0.8} max={3} step={0.005} value={p.vin} format={fmt.volt}
          onChange={(v) => onChange({ vin: v })} />
        {fireWindow && (
          <button type="button" className="link-btn"
            onClick={() => onChange({ vin: Math.round(((fireWindow[0] + fireWindow[1]) / 2) * 200) / 200 })}>
            Bias at window center
          </button>
        )}
        <Slider label="Load capacitor" log min={10e-9} max={10e-6} value={p.cLoad} format={fmt.farad}
          onChange={(v) => onChange({ cLoad: v })} />
        <Slider label="Load resistor" log min={2e3} max={50e3} value={p.rLoad} format={fmt.ohm}
          onChange={(v) => onChange({ rLoad: v })} />
        <Slider label="R1" log min={1e3} max={30e3} value={p.r1} format={fmt.ohm}
          onChange={(v) => onChange({ r1: v })} />
        <Slider label="R2" log min={1e3} max={30e3} value={p.r2} format={fmt.ohm}
          onChange={(v) => onChange({ r2: v })} />
      </fieldset>

      <fieldset>
        <legend>Biology</legend>
        <Slider label="NaCl" log min={20} max={300} value={p.naclMm} format={fmt.mm}
          onChange={(v) => onChange({ naclMm: v })} />
        <Slider label="Dopamine threshold shift" min={0} max={0.15} step={0.001} value={p.dopamineShift}
          format={fmt.vth} onChange={(v) => onChange({ dopamineShift: v })} />
      </fieldset>
    </div>
  )
}

/* Charts */

const W = 600

function useHoverIndex(n: number, padLeft: number, plotW: number) {
  const [index, setIndex] = useState<number | null>(null)
  return {
    index,
    handlers: {
      onPointerMove(event: PointerEvent<SVGSVGElement>) {
        const rect = event.currentTarget.getBoundingClientRect()
        const px = ((event.clientX - rect.left) / rect.width) * W
        const k = Math.round(((px - padLeft) / plotW) * (n - 1))
        setIndex(k >= 0 && k < n ? k : null)
      },
      onPointerLeave() {
        setIndex(null)
      },
    },
  }
}

function SpikeTrace({ sim }: { sim: ReturnType<typeof simulate> }) {
  const H = 170
  const pad = { l: 48, r: 10, t: 10, b: 24 }
  const plotW = W - pad.l - pad.r
  const plotH = H - pad.t - pad.b
  const { tMs, iUa } = sim.trace
  const tMax = tMs[tMs.length - 1] || 1
  const iMax = Math.max(...iUa, 1) * 1.1
  const x = (t: number) => pad.l + (t / tMax) * plotW
  const y = (i: number) => pad.t + plotH - (i / iMax) * plotH
  const { index, handlers } = useHoverIndex(tMs.length, pad.l, plotW)
  const points = tMs.map((t, k) => `${x(t)},${y(iUa[k])}`).join(' ')
  return (
    <figure className="chart">
      <figcaption>
        Output current (µA)
        <span className="chart-readout">
          {index !== null ? `t = ${tMs[index].toFixed(1)} ms · ${iUa[index].toFixed(1)} µA` : ''}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Output current over time" {...handlers}>
        <line className="grid" x1={pad.l} x2={W - pad.r} y1={y(iMax / 1.1)} y2={y(iMax / 1.1)} />
        <line className="axis" x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} />
        <text className="tick" x={pad.l - 6} y={y(iMax / 1.1) + 4} textAnchor="end">
          {(iMax / 1.1).toFixed(0)}
        </text>
        <text className="tick" x={pad.l - 6} y={y(0) + 4} textAnchor="end">0</text>
        <text className="tick" x={pad.l} y={H - 6}>0 ms</text>
        <text className="tick" x={W - pad.r} y={H - 6} textAnchor="end">{tMax.toFixed(0)} ms</text>
        <polyline className="line s1" points={points} />
        {index !== null && (
          <>
            <line className="crosshair" x1={x(tMs[index])} x2={x(tMs[index])} y1={pad.t} y2={y(0)} />
            <circle className="dot s1" cx={x(tMs[index])} cy={y(iUa[index])} r={4} />
          </>
        )}
      </svg>
    </figure>
  )
}

function PhasePlane({
  params,
  curve,
  sim,
}: {
  params: OanParams
  curve: ReturnType<typeof staticCurve>
  sim: ReturnType<typeof simulate>
}) {
  const H = 260
  const pad = { l: 48, r: 10, t: 10, b: 30 }
  const plotW = W - pad.l - pad.r
  const plotH = H - pad.t - pad.b
  const vMax = Math.max(params.vin, ...curve.v) * 1.05
  const iMax = Math.max(...curve.iUa, ...sim.trace.iUa) * 1.05
  const x = (v: number) => pad.l + (v / vMax) * plotW
  const y = (i: number) => pad.t + plotH - (i / iMax) * plotH
  const sCurve = curve.v.map((v, k) => `${x(v)},${y(curve.iUa[k])}`).join(' ')
  const orbit = sim.trace.v.map((v, k) => `${x(v)},${y(sim.trace.iUa[k])}`).join(' ')
  // Load line: I = (Vin − V) / R, clipped to the plot.
  const iAtZero = (params.vin / params.rLoad) * 1e6
  const loadEnd = iAtZero > iMax ? params.vin - (iMax * 1e-6) * params.rLoad : 0
  const [hover, setHover] = useState<{ v: number; i: number } | null>(null)
  return (
    <figure className="chart">
      <figcaption>
        Current vs voltage at the neuron
        <span className="chart-readout">
          {hover ? `${hover.v.toFixed(2)} V · ${hover.i.toFixed(1)} µA` : ''}
        </span>
      </figcaption>
      <ul className="legend">
        <li><span className="swatch s1" /> Static curve (S-shaped NDR)</li>
        <li><span className="swatch dashed" /> Load line</li>
        <li><span className="swatch s2" /> Spiking orbit</li>
      </ul>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Static current–voltage curve, load line, and spiking orbit"
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          const px = ((e.clientX - r.left) / r.width) * W
          const py = ((e.clientY - r.top) / r.height) * H
          setHover({ v: ((px - pad.l) / plotW) * vMax, i: ((pad.t + plotH - py) / plotH) * iMax })
        }}
        onPointerLeave={() => setHover(null)}
      >
        <line className="axis" x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} />
        <line className="axis" x1={pad.l} x2={pad.l} y1={pad.t} y2={y(0)} />
        {[0, 0.5, 1].map((f) => (
          <text key={f} className="tick" x={x(f * vMax)} y={H - 12} textAnchor={f === 0 ? 'start' : f === 1 ? 'end' : 'middle'}>
            {(f * vMax).toFixed(1)} V
          </text>
        ))}
        <text className="tick" x={pad.l - 6} y={y(iMax / 1.05) + 4} textAnchor="end">
          {(iMax / 1.05).toFixed(0)}
        </text>
        <text className="tick" x={pad.l - 6} y={y(0) + 4} textAnchor="end">0</text>
        <text className="tick" x={pad.l - 6} y={y(iMax / 2.1) + 4} textAnchor="end">µA</text>
        <line className="load-line" x1={x(params.vin)} y1={y(0)} x2={x(loadEnd)}
          y2={y(((params.vin - loadEnd) / params.rLoad) * 1e6)} />
        <polyline className="line s1" points={sCurve} />
        {sim.spiking && <polyline className="line s2 thin" points={orbit} />}
      </svg>
    </figure>
  )
}

function DoseResponse({ rates, shiftMv }: { rates: number[]; shiftMv: number }) {
  const H = 300
  const pad = { l: 48, r: 12, t: 12, b: 30 }
  const plotW = W - pad.l - pad.r
  const plotH = H - pad.t - pad.b
  const maxShift = DOSE_SHIFTS_MV[DOSE_SHIFTS_MV.length - 1]
  const rMax = Math.max(...rates, 10) * 1.1
  const x = (mv: number) => pad.l + (mv / maxShift) * plotW
  const y = (r: number) => pad.t + plotH - (r / rMax) * plotH
  const { index, handlers } = useHoverIndex(rates.length, pad.l, plotW)
  return (
    <figure className="chart">
      <figcaption>
        Dopamine response: firing rate vs T1 threshold shift
        <span className="chart-readout">
          {index !== null ? `${DOSE_SHIFTS_MV[index]} mV shift · ${rates[index].toFixed(0)} Hz` : ''}
        </span>
      </figcaption>
      <p className="chart-note">
        Dopamine lowers T1's threshold. Biased just below the window it excites the neuron; a larger
        shift pushes it past the window and inhibits it, as the paper reports.
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Firing rate against dopamine threshold shift" {...handlers}>
        <line className="axis" x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} />
        <text className="tick" x={pad.l - 6} y={y(rMax / 1.1) + 4} textAnchor="end">{(rMax / 1.1).toFixed(0)}</text>
        <text className="tick" x={pad.l - 6} y={y(0) + 4} textAnchor="end">0 Hz</text>
        {[0, 50, 100, 150].map((mv) => (
          <text key={mv} className="tick" x={x(mv)} y={H - 12} textAnchor={mv === 0 ? 'start' : mv === 150 ? 'end' : 'middle'}>
            {mv} mV
          </text>
        ))}
        <line className="crosshair current" x1={x(shiftMv)} x2={x(shiftMv)} y1={pad.t} y2={y(0)} />
        <polyline className="line s1" points={rates.map((r, k) => `${x(DOSE_SHIFTS_MV[k])},${y(r)}`).join(' ')} />
        {rates.map((r, k) => (
          <circle key={k} className={k === index ? 'dot s1' : 'dot s1 small'} cx={x(DOSE_SHIFTS_MV[k])} cy={y(r)}
            r={k === index ? 5 : 2.5} />
        ))}
      </svg>
    </figure>
  )
}

function binOf(value: number, bins: number[]) {
  let b = 0
  while (b < bins.length && value >= bins[b]) b++
  return b
}

function DesignMap({ params }: { params: OanParams }) {
  const [rows, setRows] = useState<(MapCell | null)[][]>([])
  const [running, setRunning] = useState(false)
  const [scannedFor, setScannedFor] = useState<OanParams | null>(null)
  const [metric, setMetric] = useState<Metric>('windowMv')
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null)
  const workerRef = useRef<Worker | null>(null)

  useEffect(() => () => workerRef.current?.terminate(), [])

  function scan() {
    workerRef.current?.terminate()
    const worker = new Worker(new URL('./oanMap.worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker
    setRows([])
    setRunning(true)
    setScannedFor(params)
    worker.onmessage = (event: MessageEvent<MapRow>) => {
      setRows((prev) => {
        const next = [...prev]
        next[event.data.row] = event.data.cells
        if (event.data.row === MAP_MUCS.length - 1) setRunning(false)
        return next
      })
    }
    worker.postMessage({ params, vths: MAP_VTHS, muCs: MAP_MUCS } satisfies MapRequest)
  }

  const m = METRICS.find((x) => x.key === metric)!
  const H = 330
  const pad = { l: 56, r: 10, t: 10, b: 34 }
  const cw = (W - pad.l - pad.r) / MAP_VTHS.length
  const ch = (H - pad.t - pad.b) / MAP_MUCS.length
  const done = rows.filter(Boolean).length
  // Other inputs changed since the scan, so the map no longer describes the current circuit.
  const outdated =
    scannedFor !== null &&
    JSON.stringify({ ...scannedFor, t1: null, vin: null }) !== JSON.stringify({ ...params, t1: null, vin: null })
  const col = Math.round((params.t1.vth - MAP_VTHS[0]) / (MAP_VTHS[1] - MAP_VTHS[0]))
  const row = Math.round((Math.log(params.t1.muC / MAP_MUCS[0]) / Math.log(30)) * 11)
  const inMap = col >= 0 && col < MAP_VTHS.length && row >= 0 && row < MAP_MUCS.length
  const hovered = hover ? rows[hover.r]?.[hover.c] : undefined

  return (
    <figure className="chart design-map">
      <figcaption>
        Design map: which T1 films make a working neuron?
        <span className="chart-readout">
          {hover
            ? `Vth ${(MAP_VTHS[hover.c] * 1000).toFixed(0)} mV · μC* ${MAP_MUCS[hover.r].toFixed(0)} → ` +
              (hovered === undefined
                ? 'not scanned'
                : hovered === null
                  ? "doesn't fire"
                  : `${hovered.windowMv.toFixed(0)} mV window · ${hovered.rateHz.toFixed(0)} Hz · ${hovered.powerUw.toFixed(0)} µW`)
            : ''}
        </span>
      </figcaption>
      <p className="chart-note">
        Each design is biased at the center of its own firing window. A wider window tolerates more
        drift in the film and the electrolyte. This is the search space a self-driving lab could
        explore by formulation and processing.
      </p>
      <div className="map-bar">
        <button type="button" onClick={scan} disabled={running}>
          {running ? `Scanning… ${done}/${MAP_MUCS.length} rows` : rows.length ? 'Rescan' : 'Scan design space'}
        </button>
        <div className="pills" role="group" aria-label="Map metric">
          {METRICS.map((x) => (
            <button key={x.key} type="button" className="pill" aria-pressed={x.key === metric}
              onClick={() => setMetric(x.key)}>
              {x.label}
            </button>
          ))}
        </div>
      </div>
      {outdated && !running && <p className="chart-note warn">Circuit settings changed since this scan. Rescan to update.</p>}
      <ul className="legend">
        <li><span className="swatch none" /> Doesn't fire</li>
        {[0, 1, 2, 3].map((b) => (
          <li key={b}>
            <span className={`swatch seq q${b}`} />
            {b === 0 ? `< ${m.bins[0]}` : b === 3 ? `≥ ${m.bins[2]}` : `${m.bins[b - 1]}–${m.bins[b]}`} {m.unit}
          </li>
        ))}
        <li><span className="swatch ring" /> Current design</li>
      </ul>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Design map of ${m.label.toLowerCase()}`}
        onPointerLeave={() => setHover(null)}>
        {MAP_MUCS.map((_, r) =>
          MAP_VTHS.map((__, c) => {
            const cell = rows[r]?.[c]
            const cls =
              cell === undefined ? 'cell pending' : cell === null ? 'cell none' : `cell seq q${binOf(cell[metric], m.bins)}`
            return (
              <rect key={`${r}-${c}`} className={cls} x={pad.l + c * cw + 1} y={pad.t + (MAP_MUCS.length - 1 - r) * ch + 1}
                width={cw - 2} height={ch - 2} rx={2} onPointerEnter={() => setHover({ r, c })} />
            )
          }),
        )}
        {inMap && (
          <rect className="cell-ring" x={pad.l + col * cw} y={pad.t + (MAP_MUCS.length - 1 - row) * ch}
            width={cw} height={ch} rx={3} />
        )}
        {[0, 5, 10, 15].map((c) => (
          <text key={c} className="tick" x={pad.l + (c + 0.5) * cw} y={H - 18} textAnchor="middle">
            {(MAP_VTHS[c] * 1000).toFixed(0)}
          </text>
        ))}
        <text className="tick" x={pad.l + (W - pad.l - pad.r) / 2} y={H - 3} textAnchor="middle">
          T1 threshold (mV)
        </text>
        {[0, 4, 8, 11].map((r) => (
          <text key={r} className="tick" x={pad.l - 6} y={pad.t + (MAP_MUCS.length - 1 - r + 0.5) * ch + 4} textAnchor="end">
            {MAP_MUCS[r].toFixed(0)}
          </text>
        ))}
        <text className="tick" x={12} y={pad.t + (H - pad.t - pad.b) / 2} textAnchor="middle"
          transform={`rotate(-90 12 ${pad.t + (H - pad.t - pad.b) / 2})`}>
          T1 μC*
        </text>
      </svg>
    </figure>
  )
}
