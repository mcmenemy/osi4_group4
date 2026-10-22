import { useEffect, useMemo, useState } from 'react'
import { baseLayout, logAxis, useTheme } from './chartTheme'
import { useModeText } from './mode'
import Plot, { type PlotPoint } from './Plot'
import { withPrefix } from './records'

// Mirrors backend/app/survival_map.py.
type TierKey = 'in_vivo' | 'neurons_in_dish' | 'cell_lines'

interface XValue {
  value: number
  source: 'record' | 'family' | 'curated'
  range?: [number, number]
  n?: number
  citation?: string
}

interface SurvivalPoint {
  id: string
  record_id: string
  material: string
  material_key: string
  family_label: string
  baseline: boolean
  source: string
  measure: string
  percent: number
  days: number | null
  setting: string | null
  cell_type: string | null
  tier: TierKey
  score: number
  time_factor: number
  measure_weight: number
  days_stated: boolean
  x: Record<string, XValue>
}

interface SurvivalMapData {
  properties: { key: string; label: string; unit: string; log: boolean }[]
  tiers: { key: TierKey; label: string }[]
  config: { full_credit_days: number; unknown_days: number; measure_weights: Record<string, number> }
  points: SurvivalPoint[]
}

const TIER_SYMBOL: Record<TierKey, string> = { in_vivo: 'diamond', neurons_in_dish: 'circle', cell_lines: 'triangle-up' }
const TIER_PLAIN: Record<TierKey, string> = {
  in_vivo: 'In living animals',
  neurons_in_dish: 'Real neurons in a dish',
  cell_lines: 'Lab-grown neuron-like cells',
}
const MAX_FAMILY_COLORS = 5

function formatX(v: number, unit: string): string {
  if (unit === 'Pa' || unit === 'S/m') return withPrefix(v, unit)
  return `${Number(v.toPrecision(3))}${unit ? ` ${unit}` : ''}`
}

export default function SurvivalMap({ onOpenRecord }: { onOpenRecord: (id: string) => void }) {
  const theme = useTheme()
  const t = useModeText()
  const [data, setData] = useState<SurvivalMapData | null>(null)
  const [error, setError] = useState('')
  const [prop, setProp] = useState('youngs_modulus')
  const [tiers, setTiers] = useState<TierKey[]>(['in_vivo', 'neurons_in_dish', 'cell_lines'])
  const [familyLevel, setFamilyLevel] = useState(true)

  useEffect(() => {
    fetch('/api/survival-map')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setData)
      .catch(() => setError("Couldn't load the survival map."))
  }, [])

  const property = data?.properties.find((p) => p.key === prop)
  const usable = (p: SurvivalPoint, key: string, family: boolean) => !!p.x[key] && (family || p.x[key].source === 'record')

  // Colors follow the family, ranked by how many points it has overall, so filters never repaint.
  const colorOf = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of data?.points ?? []) if (!p.baseline) counts.set(p.material_key, (counts.get(p.material_key) ?? 0) + 1)
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_FAMILY_COLORS).map(([k]) => k)
    return (p: SurvivalPoint) => (p.baseline ? theme.accent : top.includes(p.material_key) ? theme.categorical[top.indexOf(p.material_key)] : theme.other)
  }, [data, theme])

  const shown = useMemo(
    () => (data?.points ?? []).filter((p) => tiers.includes(p.tier) && usable(p, prop, familyLevel)),
    [data, tiers, prop, familyLevel],
  )

  const plot = useMemo(() => {
    if (!data || !property) return null
    const groups = new Map<string, SurvivalPoint[]>()
    for (const p of shown) groups.set(p.family_label, [...(groups.get(p.family_label) ?? []), p])
    const scoreLine = (p: SurvivalPoint) => {
      const days = p.days_stated ? `${p.days} d` : `time not stated (counted as ${data.config.unknown_days} d)`
      return `${p.percent}% ${p.measure.replace('_', ' ')} at ${days}<br>Score ${p.score.toFixed(1)} = ${p.percent} × ${p.time_factor} (time) × ${p.measure_weight} (measure)`
    }
    const xLine = (x: XValue) => {
      const v = formatX(x.value, property.unit)
      if (x.source === 'record') return `${property.label} ${v} (same paper)`
      const range = x.range ? `, range ${formatX(x.range[0], property.unit)}–${formatX(x.range[1], property.unit)}` : ''
      return x.source === 'family'
        ? `${property.label} ${v}: family median of ${x.n} record(s)${range} (not this paper)`
        : `${property.label} ${v}: literature-typical${range}, ${x.citation} (curated)`
    }
    const traces: object[] = [...groups.entries()].map(([label, pts]) => ({
      type: 'scatter',
      mode: 'markers',
      name: label,
      x: pts.map((p) => p.x[prop].value),
      y: pts.map((p) => p.score),
      customdata: pts.map((p) => p.record_id),
      hovertemplate: pts.map(
        (p) =>
          `<b>${p.family_label}</b><br>${p.material}<br>${p.source} · ${p.cell_type ?? 'cells'} · ${TIER_PLAIN[p.tier]}<br>${scoreLine(p)}<br>${xLine(p.x[prop])}<extra></extra>`,
      ),
      marker: {
        size: 12,
        color: pts.map(colorOf),
        symbol: pts.map((p) => TIER_SYMBOL[p.tier] + (p.x[prop].source === 'record' ? '' : '-open')),
        line: { width: 2, color: pts.map((p) => (p.x[prop].source === 'record' ? theme.panel : colorOf(p))) },
      },
    }))
    // Symbol key, in gray so it doesn't read as a family.
    for (const tier of data.tiers.filter((x) => tiers.includes(x.key))) {
      traces.push({
        type: 'scatter', mode: 'markers', x: [null], y: [null], hoverinfo: 'skip',
        name: t(TIER_PLAIN[tier.key], tier.label),
        marker: { symbol: TIER_SYMBOL[tier.key], size: 10, color: theme.muted },
      })
    }
    if (familyLevel)
      traces.push({
        type: 'scatter', mode: 'markers', x: [null], y: [null], hoverinfo: 'skip',
        name: t('Hollow: property from other papers', 'Hollow: family-level or curated x value'),
        marker: { symbol: 'circle-open', size: 10, color: theme.muted, line: { width: 2 } },
      })

    const baseline = data.points.filter((p) => p.baseline).sort((a, b) => b.score - a.score)[0]
    const xs = shown.map((p) => p.x[prop].value)
    const xAxis = property.log
      ? logAxis(theme, `${property.label}${property.unit ? ` (${property.unit})` : ''}`,
          xs.length ? [Math.min(...xs) / 3, Math.max(...xs) * 3] : undefined)
      : { title: { text: `${property.label}${property.unit ? ` (${property.unit})` : ''}`, font: { color: theme.muted } }, gridcolor: theme.border, zeroline: false }
    return {
      data: traces,
      layout: {
        ...baseLayout(theme),
        xaxis: xAxis,
        yaxis: { title: { text: 'Survival score (0–100)', font: { color: theme.muted } }, range: [0, 100], gridcolor: theme.border, zeroline: false },
        shapes: baseline
          ? [{ type: 'line', xref: 'paper', x0: 0, x1: 1, y0: baseline.score, y1: baseline.score, line: { color: theme.accent, width: 1.5, dash: 'dash' } }]
          : [],
        annotations: baseline
          ? [{
              xref: 'paper', x: 0, xanchor: 'left', y: baseline.score, yanchor: 'bottom', showarrow: false,
              text: t(`Today's chip (SU-8), in mice: ${baseline.score.toFixed(0)}`, `SU-8 baseline, in vivo occupancy: ${baseline.score.toFixed(1)}`),
              font: { size: 11, color: theme.accent },
            }]
          : [],
      },
    }
  }, [data, property, shown, prop, tiers, familyLevel, colorOf, theme, t])

  const count = (key: string) => (data?.points ?? []).filter((p) => tiers.includes(p.tier) && usable(p, key, familyLevel)).length
  const cfg = data?.config

  return (
    <figure className="map-card survival-map">
      <figcaption>
        <h2>{t('Do neurons last longer on some materials?', 'Survival score vs. material properties')}</h2>
        {cfg &&
          t(
            <p>
              Each point is one result from a paper: how well neurons survived on a material, as a score from 0 to 100. A
              result only gets full credit if it lasted at least 3 weeks, and counts for less if it measured something
              less direct than survival. Pick a property to see whether it lines up with survival. The dashed line is
              Science Corp's chip today. Numbers were pulled from papers by AI, and not all have been checked by a person
              yet.
            </p>,
            <p>
              One point per survival result. Score = reported % × min(days / {cfg.full_credit_days}, 1) × measure weight
              ({Object.entries(cfg.measure_weights).map(([k, v]) => `${k.replace('_', ' ')} ${v}`).join(', ')}); a
              missing timepoint counts as day {cfg.unknown_days}. Weights live in <code>data/scorecard.yaml</code>.
              Filled points have the property from the same paper; hollow points use the family median or the curated
              literature range, so the cells and the property come from different formulations. Values are extracted by
              an LLM and partly unreviewed.
            </p>,
          )}
      </figcaption>

      {error && <p className="error">{error}</p>}
      {data && (
        <div className="survival-controls">
          <div className="pills" role="group" aria-label={t('Compare against', 'X axis')}>
            <span className="control-label">{t('Compare against', 'X axis')}</span>
            {data.properties.map((p) => (
              <button key={p.key} type="button" className="pill" aria-pressed={prop === p.key} onClick={() => setProp(p.key)}>
                {p.label} <span className="pill-count">{count(p.key)}</span>
              </button>
            ))}
          </div>
          <div className="pills" role="group" aria-label={t('Which results', 'Evidence tiers')}>
            <span className="control-label">{t('Which results', 'Tiers')}</span>
            {data.tiers.map((tier) => (
              <button key={tier.key} type="button" className="pill" aria-pressed={tiers.includes(tier.key)}
                onClick={() => setTiers((ts) => (ts.includes(tier.key) ? ts.filter((x) => x !== tier.key) : [...ts, tier.key]))}>
                {t(TIER_PLAIN[tier.key], tier.label)}{' '}
                <span className="pill-count">{data.points.filter((p) => p.tier === tier.key).length}</span>
              </button>
            ))}
          </div>
          <label className="check">
            <input type="checkbox" checked={familyLevel} onChange={(e) => setFamilyLevel(e.target.checked)} />{' '}
            {t('Also use property values from other papers on the same material (hollow)', 'Include family-level pairing (hollow points)')}
          </label>
        </div>
      )}

      {plot && shown.length > 0 && (
        <Plot data={plot.data} layout={plot.layout} height={480} label="Scatter of survival score against the chosen material property"
          onClick={(p: PlotPoint) => typeof p.customdata === 'string' && onOpenRecord(p.customdata)} />
      )}
      {data && property && shown.length === 0 && (
        <p className="notice">
          {t(
            `No survival results can be paired with ${property.label.toLowerCase()} yet. Papers that measure both are on the wanted list.`,
            `No survival results pair with ${property.label.toLowerCase()} under these settings.${familyLevel ? '' : ' Try including family-level pairing.'}${tiers.length < 3 ? ' Try more tiers.' : ''} Otherwise this needs papers that report both, or a family that has both survival and ${property.label.toLowerCase()} data.`,
          )}
        </p>
      )}
      {data && (
        <p className="muted small">
          {shown.length} of {data.points.length} {t('results shown.', 'survival results shown.')}
        </p>
      )}
    </figure>
  )
}
