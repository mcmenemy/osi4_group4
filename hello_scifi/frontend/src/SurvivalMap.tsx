import { useEffect, useMemo, useState } from 'react'
import { baseLayout, logAxis, useTheme } from './chartTheme'
import { useModeText } from './mode'
import Plot, { type PlotPoint } from './Plot'
import { withPrefix } from './records'

// Mirrors backend/app/survival_map.py.
type TierKey = 'in_vivo' | 'neurons_in_dish' | 'cell_lines'
type Measure = 'viability' | 'retention' | 'occupancy' | 'neurite_outgrowth'
type YMode = 'percent' | 'score'

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
  measure: Measure
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
const MEASURES: { key: Measure; label: string; plain: string; axis: string }[] = [
  { key: 'viability', label: 'Viability', plain: 'Cells alive', axis: 'Viability (%)' },
  { key: 'retention', label: 'Retention', plain: 'Cells kept', axis: 'Retention (%)' },
  { key: 'neurite_outgrowth', label: 'Neurite outgrowth', plain: 'Cells growing fibers', axis: 'Cells with neurites (%)' },
]
const MIN_DAYS = [0, 7, 21]
const MAX_FAMILY_COLORS = 5

function formatX(v: number, unit: string): string {
  if (unit === 'Pa' || unit === 'S/m') return withPrefix(v, unit)
  return `${Number(v.toPrecision(3))}${unit ? ` ${unit}` : ''}`
}

// Duration is shown as marker size (how much a point says about lasting survival), not folded into y.
const sizeFor = (days: number | null, fullDays: number) => 10 + 12 * Math.min((days ?? 0) / fullDays, 1)

export default function SurvivalMap({ onOpenRecord }: { onOpenRecord: (id: string) => void }) {
  const theme = useTheme()
  const t = useModeText()
  const [data, setData] = useState<SurvivalMapData | null>(null)
  const [error, setError] = useState('')
  const [prop, setProp] = useState('youngs_modulus')
  const [yMode, setYMode] = useState<YMode>('percent')
  const [measure, setMeasure] = useState<Measure>('viability')
  const [minDays, setMinDays] = useState(0)
  const [tiers, setTiers] = useState<TierKey[]>(['in_vivo', 'neurons_in_dish', 'cell_lines'])
  const [familyLevel, setFamilyLevel] = useState(true)

  useEffect(() => {
    fetch('/api/survival-map')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setData)
      .catch(() => setError("Couldn't load the survival map."))
  }, [])

  const property = data?.properties.find((p) => p.key === prop)

  // Every filter except the x axis; the x-axis buttons count against this.
  const filtered = useMemo(
    () =>
      (data?.points ?? []).filter(
        (p) =>
          tiers.includes(p.tier) &&
          (yMode === 'score' || p.measure === measure) &&
          (minDays === 0 || (p.days != null && p.days >= minDays)),
      ),
    [data, tiers, yMode, measure, minDays],
  )
  const hasX = (p: SurvivalPoint, key: string) => !!p.x[key] && (familyLevel || p.x[key].source === 'record')
  const shown = filtered.filter((p) => hasX(p, prop))

  // Colors follow the family, ranked by how many points it has overall, so filters never repaint.
  const colorOf = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of data?.points ?? []) if (!p.baseline) counts.set(p.material_key, (counts.get(p.material_key) ?? 0) + 1)
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_FAMILY_COLORS).map(([k]) => k)
    return (p: SurvivalPoint) => (p.baseline ? theme.accent : top.includes(p.material_key) ? theme.categorical[top.indexOf(p.material_key)] : theme.other)
  }, [data, theme])

  const measureInfo = MEASURES.find((m) => m.key === measure)!
  // Science Corp's chip has no viability measurement, only well occupancy at loading and at ~3 weeks in vivo.
  // Their ratio estimates the share of loaded neurons still detected: a rough, conservative stand-in.
  const baselinePts = (data?.points ?? []).filter((p) => p.baseline && p.measure === 'occupancy').sort((a, b) => (a.days ?? 0) - (b.days ?? 0))
  const [chipLoad, chipLater] = [baselinePts[0], baselinePts[baselinePts.length - 1]]
  const chipEstimate = chipLoad && chipLater && chipLoad !== chipLater ? (chipLater.percent / chipLoad.percent) * 100 : null
  const showChip = yMode === 'percent' && measure === 'viability' && chipEstimate != null

  let plot: { data: object[]; layout: object } | null = null
  if (data && property && shown.length) {
    const full = data.config.full_credit_days
    const groups = new Map<string, SurvivalPoint[]>()
    for (const p of shown) groups.set(p.family_label, [...(groups.get(p.family_label) ?? []), p])
    const resultLine = (p: SurvivalPoint) => {
      const days = p.days_stated ? `${p.days} d` : 'time not stated'
      const base = `${p.percent}% ${p.measure.replace('_', ' ')} at ${days}`
      return yMode === 'score'
        ? `${base}<br>Score ${p.score.toFixed(1)} = ${p.percent} × ${p.time_factor} (time${p.days_stated ? '' : `, counted as ${data.config.unknown_days} d`}) × ${p.measure_weight} (measure)`
        : base
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
      y: pts.map((p) => (yMode === 'score' ? p.score : p.percent)),
      customdata: pts.map((p) => p.record_id),
      hovertemplate: pts.map(
        (p) =>
          `<b>${p.family_label}</b><br>${p.material}<br>${p.source} · ${p.cell_type ?? 'cells'} · ${TIER_PLAIN[p.tier]}<br>${resultLine(p)}<br>${xLine(p.x[prop])}<extra></extra>`,
      ),
      marker: {
        size: pts.map((p) => sizeFor(p.days, full)),
        color: pts.map(colorOf),
        symbol: pts.map((p) => TIER_SYMBOL[p.tier] + (p.x[prop].source === 'record' ? '' : '-open')),
        line: { width: 2, color: pts.map((p) => (p.x[prop].source === 'record' ? theme.panel : colorOf(p))) },
      },
    }))
    // Symbol and size key, in gray so it doesn't read as a family.
    const key = (name: string, marker: object) =>
      traces.push({ type: 'scatter', mode: 'markers', x: [null], y: [null], hoverinfo: 'skip', name, marker: { color: theme.muted, ...marker } })
    for (const tier of data.tiers.filter((x) => tiers.includes(x.key)))
      key(t(TIER_PLAIN[tier.key], tier.label), { symbol: TIER_SYMBOL[tier.key], size: 10 })
    if (familyLevel)
      key(t('Hollow: property from other papers', 'Hollow: family-level or curated x value'), { symbol: 'circle-open', size: 10, line: { width: 2 } })
    key(t('Small: under a day · large: 3+ weeks', `Size: experiment length (largest at ≥${full} d)`), { symbol: 'circle', size: 14 })

    // Today's chip as a target line (estimated; see the footnote under the chart).
    const shapes: object[] = []
    const annotations: object[] = []
    const ref = (y: number, text: string) => {
      shapes.push({ type: 'line', xref: 'paper', x0: 0, x1: 1, y0: y, y1: y, line: { color: theme.accent, width: 1.5, dash: 'dash' } })
      annotations.push({ xref: 'paper', x: 0, xanchor: 'left', y, yanchor: 'bottom', showarrow: false, text, font: { size: 11, color: theme.accent } })
    }
    if (showChip)
      ref(chipEstimate!, t(
        `Science Corp's chip, in mice at 3 weeks: about ${chipEstimate!.toFixed(0)}%*`,
        `Science Corp SU-8 chip, in vivo ~${chipLater!.days} d: est. ${chipEstimate!.toFixed(0)}%*`,
      ))
    const bestBaseline = data.points.filter((p) => p.baseline).sort((a, b) => b.score - a.score)[0]
    if (yMode === 'score' && bestBaseline) ref(bestBaseline.score, `SU-8 baseline score: ${bestBaseline.score.toFixed(1)}`)

    const xs = shown.map((p) => p.x[prop].value)
    const xTitle = `${property.label}${property.unit ? ` (${property.unit})` : ''}`
    plot = {
      data: traces,
      layout: {
        ...baseLayout(theme),
        xaxis: property.log
          ? logAxis(theme, xTitle, [Math.min(...xs) / 3, Math.max(...xs) * 3])
          : { title: { text: xTitle, font: { color: theme.muted } }, gridcolor: theme.border, zeroline: false },
        yaxis: {
          title: { text: yMode === 'score' ? 'Weighted survival score (0–100)' : measureInfo.axis, font: { color: theme.muted } },
          range: [0, 105], gridcolor: theme.border, zeroline: false,
        },
        shapes,
        annotations,
      },
    }
  }

  const cfg = data?.config
  const countBy = (pred: (p: SurvivalPoint) => boolean) => (data?.points ?? []).filter(pred).length

  return (
    <figure className="map-card survival-map">
      <figcaption>
        <h2>{t('Do neurons last longer on some materials?', 'Neuron survival vs. material properties')}</h2>
        {cfg &&
          t(
            <p>
              Each point is one result from a paper: what share of neurons survived on a material. Bigger points come
              from longer experiments, which say more about whether neurons last. The dashed line is our estimate for
              Science Corp's chip today. Pick a property to see whether it lines up with survival. Numbers were pulled from papers by AI, and not all have been checked by a person yet.
            </p>,
            <p>
              One point per survival result, plotted as the reported %, one measure at a time (measures aren't
              comparable). Marker size is experiment length, full size at ≥{cfg.full_credit_days} d; use the minimum-days
              filter for long-term evidence only. Filled points have the property from the same paper; hollow points use
              the family median or curated literature range, so cells and property come from different formulations.
              The dashed line is an estimate for Science Corp's chip (see the note under the chart). Values are
              extracted by an LLM and partly unreviewed.
            </p>,
          )}
      </figcaption>

      {error && <p className="error">{error}</p>}
      {data && (
        <div className="survival-controls">
          <div className="pills" role="group" aria-label={t('Show', 'Y axis')}>
            <span className="control-label">{t('Show', 'Y axis')}</span>
            {yMode === 'percent' &&
              MEASURES.map((m) => (
                <button key={m.key} type="button" className="pill" aria-pressed={measure === m.key} onClick={() => setMeasure(m.key)}>
                  {t(m.plain, m.label)}{' '}
                  <span className="pill-count">{countBy((p) => p.measure === m.key && tiers.includes(p.tier))}</span>
                </button>
              ))}
            <button type="button" className="pill" aria-pressed={yMode === 'score'}
              onClick={() => setYMode((y) => (y === 'score' ? 'percent' : 'score'))}>
              {yMode === 'score' ? t('← Back to percentages', '← Reported %') : t('Weighted score', 'Weighted score')}
            </button>
          </div>
          <div className="pills" role="group" aria-label={t('Experiment length', 'Minimum days')}>
            <span className="control-label">{t('Experiment length', 'Minimum days')}</span>
            {MIN_DAYS.map((d) => (
              <button key={d} type="button" className="pill" aria-pressed={minDays === d} onClick={() => setMinDays(d)}>
                {d === 0 ? t('Any', 'Any') : d === 21 ? t('3+ weeks', '≥21 d') : t(`${d}+ days`, `≥${d} d`)}
              </button>
            ))}
          </div>
          <div className="pills" role="group" aria-label={t('Compare against', 'X axis')}>
            <span className="control-label">{t('Compare against', 'X axis')}</span>
            {data.properties.map((p) => (
              <button key={p.key} type="button" className="pill" aria-pressed={prop === p.key} onClick={() => setProp(p.key)}>
                {p.label} <span className="pill-count">{filtered.filter((pt) => hasX(pt, p.key)).length}</span>
              </button>
            ))}
          </div>
          <div className="pills" role="group" aria-label={t('Which results', 'Evidence tiers')}>
            <span className="control-label">{t('Which results', 'Tiers')}</span>
            {data.tiers.map((tier) => (
              <button key={tier.key} type="button" className="pill" aria-pressed={tiers.includes(tier.key)}
                onClick={() => setTiers((ts) => (ts.includes(tier.key) ? ts.filter((x) => x !== tier.key) : [...ts, tier.key]))}>
                {t(TIER_PLAIN[tier.key], tier.label)}{' '}
                <span className="pill-count">{countBy((p) => p.tier === tier.key)}</span>
              </button>
            ))}
          </div>
          <label className="check">
            <input type="checkbox" checked={familyLevel} onChange={(e) => setFamilyLevel(e.target.checked)} />{' '}
            {t('Also use property values from other papers on the same material (hollow)', 'Include family-level pairing (hollow points)')}
          </label>
          {yMode === 'score' && cfg && (
            <p className="muted small">
              {t(
                'The weighted score multiplies survival by how long the experiment ran, so it rewards long studies as much as good materials. Use it to rank, not to compare.',
                `Weighted score = % × min(days / ${cfg.full_credit_days}, 1) × measure weight (${Object.entries(cfg.measure_weights).map(([k, v]) => `${k.replace('_', ' ')} ${v}`).join(', ')}); missing timepoints count as day ${cfg.unknown_days}. It mixes study length with outcome, so long studies score higher regardless of material. Settings in data/scorecard.yaml.`,
              )}
            </p>
          )}
        </div>
      )}

      {plot && (
        <Plot data={plot.data} layout={plot.layout} height={480} label="Scatter of neuron survival against the chosen material property"
          onClick={(p: PlotPoint) => typeof p.customdata === 'string' && onOpenRecord(p.customdata)} />
      )}
      {plot && showChip && chipLoad && chipLater && (
        <p className="small muted chip-note">
          {t(
            `* An estimate, not a direct measurement. Science Corp counted wells holding neurons: ${chipLoad.percent}% when the chip was loaded and ${chipLater.percent}% about three weeks after implantation in mice, so roughly ${chipEstimate!.toFixed(0)}% of the loaded neurons were still there (${chipLater.percent} ÷ ${chipLoad.percent}). Neurons that moved out of their wells or stopped glowing count as lost, so the real number may be higher. Their result comes from living brains over 3 weeks; most dots here come from a few days in a dish, which is an easier test.`,
            `* Estimated, not a viability measurement: ${chipLater.percent}% of wells with fluorescent neurons at ~${chipLater.days} d in vivo (n=13) ÷ ${chipLoad.percent}% of wells with DAPI+ cells at 24 h in vitro (n=23) ≈ ${chipEstimate!.toFixed(0)}% of loaded neurons still detected (Brown et al., bioRxiv 2024). The two counts come from different chips, so this is approximate. It is conservative: cells that migrated out of wells or lost reporter fluorescence count as lost, and it doesn't separate death from loss. It is an in vivo 3-week figure, while most points here are in vitro over days, so the comparison favors the gels.`,
          )}
        </p>
      )}
      {data && property && shown.length === 0 && (
        <p className="notice">
          {t(
            `No results match these choices yet. Try a different property, a shorter experiment length, or more kinds of results.`,
            `No points under these settings.${familyLevel ? '' : ' Try including family-level pairing.'}${minDays ? ' Try a lower minimum.' : ''}${tiers.length < 3 ? ' Try more tiers.' : ''} Otherwise this needs papers that report both ${yMode === 'score' ? 'survival' : measureInfo.label.toLowerCase()} and ${property.label.toLowerCase()}.`,
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
