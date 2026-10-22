export interface Point {
  x: number
  y: number | null
  /** Drawn as an open circle, e.g. a value that isn't statistically significant. */
  hollow?: boolean
  /** Error bar half-length (e.g. standard deviation across seeds). */
  err?: number | null
  note?: string
}

export interface Series {
  id: string
  label: string
  color: string
  points: Point[]
  dashed?: boolean
}

interface Props {
  series: Series[]
  yMin: number
  yMax: number
  yLabel: string
  formatY: (y: number) => string
  xLabel?: string
  reference?: { y: number; label: string }
  yTicks?: number[]
}

const W = 640
const H = 260
const M = { top: 12, right: 16, bottom: 40, left: 52 }
const STEPS = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1]

/** Round-number ticks (at most 6 intervals), so labels never show a rounded value. */
function niceTicks(min: number, max: number): number[] {
  const step = STEPS.find((s) => (max - min) / s <= 6) ?? STEPS[STEPS.length - 1]
  const ticks = []
  for (let t = Math.ceil(min / step) * step; t <= max + 1e-9; t += step) ticks.push(Number(t.toFixed(6)))
  return ticks
}

/** Lines over "% of host neurons lost" (x in 0-1), one per series. */
export default function LineChart({
  series,
  yMin,
  yMax,
  yLabel,
  formatY,
  xLabel = '% of host neurons lost',
  reference,
  yTicks,
}: Props) {
  const xs = [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort((a, b) => a - b)
  const xMax = xs.length ? Math.max(...xs) : 1
  const px = (x: number) => M.left + (x / (xMax || 1)) * (W - M.left - M.right)
  const py = (y: number) => M.top + (1 - (y - yMin) / (yMax - yMin || 1)) * (H - M.top - M.bottom)
  const ticks = yTicks ?? niceTicks(yMin, yMax)
  const clamp = (y: number) => Math.min(yMax, Math.max(yMin, y))
  // With error bars, nudge series apart sideways so bars at the same x don't hide each other.
  const hasErr = series.some((s) => s.points.some((p) => p.err))
  const dodge = (i: number) => (hasErr ? (i - (series.length - 1) / 2) * 3 : 0)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${yLabel} by ${xLabel}`}>
      {ticks.map((t) => (
        <g key={t}>
          <line className="grid" x1={M.left} x2={W - M.right} y1={py(t)} y2={py(t)} />
          <text className="tick" x={M.left - 6} y={py(t) + 4} textAnchor="end">
            {formatY(t)}
          </text>
        </g>
      ))}
      {xs.map((x) => (
        <text key={x} className="tick" x={px(x)} y={H - M.bottom + 16} textAnchor="middle">
          {Math.round(x * 100)}%
        </text>
      ))}
      <text className="axis-label" x={(M.left + W - M.right) / 2} y={H - 4} textAnchor="middle">
        {xLabel}
      </text>
      <text className="axis-label" transform={`translate(12 ${(M.top + H - M.bottom) / 2}) rotate(-90)`} textAnchor="middle">
        {yLabel}
      </text>
      <line className="axis" x1={M.left} x2={W - M.right} y1={H - M.bottom} y2={H - M.bottom} />
      {reference && (
        <g>
          <line className="reference" x1={M.left} x2={W - M.right} y1={py(reference.y)} y2={py(reference.y)} />
          {/* Left end: data there is near the top (healthy host), so the label stays clear. */}
          <text className="tick" x={M.left + 6} y={py(reference.y) - 5} textAnchor="start">
            {reference.label}
          </text>
        </g>
      )}
      {series.map((s, si) => {
        const pts = s.points.filter((p): p is Point & { y: number } => p.y !== null)
        const x = (p: Point) => px(p.x) + dodge(si)
        const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p).toFixed(1)},${py(p.y).toFixed(1)}`).join('')
        return (
          <g key={s.id}>
            <path d={d} fill="none" stroke={s.color} strokeWidth={2.5} strokeDasharray={s.dashed ? '6 4' : undefined} />
            {pts
              .filter((p) => p.err)
              .map((p) => {
                const top = py(clamp(p.y + p.err!))
                const bottom = py(clamp(p.y - p.err!))
                return (
                  <path
                    key={`err-${p.x}`}
                    className="error-bar"
                    d={`M${x(p) - 3},${top}H${x(p) + 3}M${x(p)},${top}V${bottom}M${x(p) - 3},${bottom}H${x(p) + 3}`}
                    stroke={s.color}
                  />
                )
              })}
            {pts.map((p) => (
              <circle
                key={p.x}
                cx={x(p)}
                cy={py(p.y)}
                r={4.5}
                fill={p.hollow ? 'var(--bg)' : s.color}
                stroke={s.color}
                strokeWidth={2}
              >
                <title>
                  {`${s.label}: ${formatY(p.y)}${p.err ? ` ± ${formatY(p.err)}` : ''} at ${Math.round(p.x * 100)}% lost${p.note ? ` (${p.note})` : ''}`}
                </title>
              </circle>
            ))}
          </g>
        )
      })}
    </svg>
  )
}
