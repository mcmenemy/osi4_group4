import { useCallback, useEffect, useMemo, useState } from 'react'
import ScorecardTable from './ScorecardTable'
import SurvivalMap from './SurvivalMap'
import { chipEstimate, chipNote } from './chipEstimate'
import { useModeText } from './mode'
import { PLAIN_LABELS, SHORT_LABELS, type RequirementKey, type Scorecard } from './scorecard'
import { baseLayout, logAxis, useTheme, type Theme } from './chartTheme'
import Plot, { type PlotPoint } from './Plot'
import RecordDetail, { SidePanel } from './RecordDetail'
import {
  COVERAGE_COLUMNS,
  MATERIAL_CLASSES,
  SETTING_LABELS,
  classLabel,
  methodLabel,
  sourceLabel,
  withPrefix,
  type MaterialRecord,
  type References,
  type TargetWindow,
} from './records'

interface Props {
  records: MaterialRecord[]
  references: References | null
  targetWindow: TargetWindow | null
}

const CAVEAT = 'Values are extracted from papers by an LLM and are partly unreviewed.'
const PLAIN_CAVEAT = 'Numbers were pulled from papers by AI, and not all have been checked by a person yet.'

// Chart caption in the current mode, with the matching caveat.
function useCaption() {
  const t = useModeText()
  return (normal: string, hardcore: string) => `${t(normal, hardcore)} ${t(PLAIN_CAVEAT, CAVEAT)}`
}

export default function MapsTab({ records, references, targetWindow }: Props) {
  const [selected, setSelected] = useState<MaterialRecord[] | null>(null)
  const [index, setIndex] = useState(0)
  const byId = useMemo(() => new Map(records.map((r) => [r.record_id, r])), [records])
  const t = useModeText()
  const paperCount = useMemo(
    () => new Set(records.map((r) => r.source.doi || r.source.title || r.source.file)).size,
    [records],
  )

  const openIds = useCallback(
    (ids: string[]) => {
      const list = ids.map((id) => byId.get(id)).filter((r): r is MaterialRecord => !!r)
      if (list.length) {
        setSelected(list)
        setIndex(0)
      }
    },
    [byId],
  )
  const onPoint = useCallback(
    (p: PlotPoint) => {
      if (typeof p.customdata === 'string') openIds([p.customdata])
    },
    [openIds],
  )

  return (
    <div className="container tab">
      <p className="kicker">Maps</p>
      <h1 className="section-title">{t('Which materials could help the neurons?', "Where the evidence is, and where it isn't")}</h1>
      <p className="stat-line">
        <strong>{records.length}</strong> {t('results', 'records')} <span>{t('pulled from', 'extracted from')}</span>{' '}
        <strong>{paperCount}</strong> {t('published papers', 'published papers')}
      </p>
      <p className="lede">
        {t(
          "First, how neurons fare on each material. Then a scorecard of every material family against what a well fill needs: ✓ means published research shows it does, ? means nobody we found has measured it, and the chip's current material, SU-8 (a hard, epoxy-based plastic), is pinned at the top. Click any point or row to see where it came from.",
          'Survival against material properties first, then the well-fill scorecard. Click any point to see its values, the exact quotes they came from, and the source.',
        )}
      </p>
      {records.length === 0 && (
        <p className="notice">
          No extracted records yet. Add PDFs to <code>data/papers</code> and run{' '}
          <code>scripts/extract_batch.py</code>; the reference markers below still show.
        </p>
      )}

      <SurvivalMap onOpenRecord={(id) => openIds([id])} references={references} />
      <ScorecardSection records={records} onOpenRecords={openIds} />

      <h2 className="details-heading">{t('The underlying numbers', 'Details for materials scientists')}</h2>
      <p className="muted">
        {t(
          'Charts of the measurements behind the table, mostly for materials scientists. Click any point to see where it came from.',
          'The underlying property maps. Click any point for its values, quotes, and source.',
        )}
      </p>
      <StiffnessByFamily records={records} onPoint={onPoint} />
      <StiffnessConductivity records={records} references={references} targetWindow={targetWindow} onPoint={onPoint} />
      <CellOutcomes records={records} references={references} onPoint={onPoint} />
      <Degradation records={records} onPoint={onPoint} />
      <MixedConductors records={records} onPoint={onPoint} />
      <Coverage records={records} onCell={openIds} />

      {selected && (
        <SidePanel label="Record details" onClose={() => setSelected(null)}>
          {selected.length > 1 && (
            <div className="panel-picker">
              <p className="muted">{selected.length} records in this cell</p>
              <div className="pills">
                {selected.map((r, i) => (
                  <button key={r.record_id} type="button" className="pill" aria-pressed={i === index}
                    onClick={() => setIndex(i)}>
                    {r.material} · {sourceLabel(r.source)}
                  </button>
                ))}
              </div>
            </div>
          )}
          <RecordDetail record={selected[index]} />
        </SidePanel>
      )}
    </div>
  )
}

const WEIGHT_KEYS: RequirementKey[] = ['survival', 'soft', 'in_vivo_brain', 'clear_degradable', 'conductive']

function ScorecardSection({ records, onOpenRecords }: { records: MaterialRecord[]; onOpenRecords: (ids: string[]) => void }) {
  const [card, setCard] = useState<Scorecard | null>(null)
  const [weights, setWeights] = useState<Record<RequirementKey, number> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Scoring happens on the server; refetch (debounced) when the weights change.
  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams()
      if (weights) for (const [k, v] of Object.entries(weights)) params.set(k, String(v))
      setLoading(true)
      fetch(`/api/scorecard?${params}`, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((data: Scorecard) => {
          setCard(data)
          setError('')
        })
        .catch((e) => e.name !== 'AbortError' && setError("Couldn't load the scorecard."))
        .finally(() => setLoading(false))
    }, weights ? 200 : 0)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [weights])

  const current = weights ?? card?.weights
  const t = useModeText()
  return (
    <section className="scorecard-section">
      {error && <p className="error">{error}</p>}
      {card && <ScorecardTable card={card} records={records} loading={loading} onOpenRecords={onOpenRecords} />}
      {card && current && (
        <details className="weights-panel">
          <summary>{t('Change what matters most', 'Adjust weights')}</summary>
          {t(
            <p className="muted small">
              How much each need counts is our team's judgment call, not a measurement. Move the sliders, then pick Most
              promising to see the ranking change.
            </p>,
            <p className="muted small">
              Weights are team judgment, not measurements. The table re-sorts as you move them (switch the view to Most
              promising to see the ranking change). Defaults live in <code>data/scorecard.yaml</code>.
            </p>,
          )}
          <div className="weights-grid">
            {WEIGHT_KEYS.map((k) => (
              <label key={k} className="slider">
                <span className="slider-head">
                  <span>{t(PLAIN_LABELS, SHORT_LABELS)[k]}</span>
                  <output>{current[k]}</output>
                </span>
                <input type="range" min={0} max={5} step={0.5} value={current[k]}
                  onChange={(e) => setWeights({ ...current, [k]: Number(e.target.value) })} />
              </label>
            ))}
          </div>
          <button type="button" className="link-btn" onClick={() => setWeights({ ...card.default_weights })}>
            {t('Reset', 'Reset to defaults')}
          </button>
        </details>
      )}
    </section>
  )
}

function classColor(t: Theme, key: string): string {
  const i = MATERIAL_CLASSES.findIndex((m) => m.key === key)
  return i >= 0 ? t.categorical[i] : t.other
}

function hoverFor(r: MaterialRecord, lines: string[]): string {
  const flagged = r.flags.length ? `<br>⚠ ${r.flags.length} flag(s)` : ''
  return `<b>${r.material}</b><br>${sourceLabel(r.source)} · ${classLabel(r.material_class)}<br>${lines.join('<br>')}${flagged}<extra></extra>`
}

const STIFFNESS_AXIS = "Stiffness (Pa): Young's modulus, or G′ where noted"

function stiffnessLine(r: MaterialRecord): string {
  const f = r.properties.youngs_modulus!
  const m = methodLabel(f.test_method)
  return `Stiffness = ${withPrefix(f.value_si!, 'Pa')}${m ? ` (${m})` : ''}`
}

/* Stiffness by material family: extracted values filled, literature-typical ranges hollow */

function StiffnessByFamily({ records, onPoint }: { records: MaterialRecord[]; onPoint: (p: PlotPoint) => void }) {
  const t = useTheme()
  const cap = useCaption()
  const m = useModeText()
  const [card, setCard] = useState<Scorecard | null>(null)
  useEffect(() => {
    fetch('/api/scorecard')
      .then((r) => (r.ok ? r.json() : null))
      .then(setCard)
      .catch(() => setCard(null))
  }, [])

  const { data, layout, rowCount } = useMemo(() => {
    const rows = card ? [...(card.baseline ? [card.baseline] : []), ...card.ranked, ...card.no_neuron_evidence] : []
    const families = rows.filter(
      (row) =>
        row.curated.literature_typical_stiffness_kpa?.citation ||
        records.some((r) => row.record_ids.includes(r.record_id) && r.properties.youngs_modulus?.value_si),
    )
    const labels = families.map((f) => f.label)
    const traces: object[] = []
    // Literature-typical ranges (curated): a line between two hollow markers.
    for (const f of families) {
      const typ = f.curated.literature_typical_stiffness_kpa
      if (!typ?.citation) continue
      const xs = typ.range.map((k) => k * 1e3)
      traces.push({
        type: 'scatter',
        mode: 'lines+markers',
        x: xs,
        y: [f.label, f.label],
        line: { color: t.muted, width: 2 },
        marker: { symbol: 'circle-open', size: 11, color: t.muted, line: { width: 2 } },
        name: 'Literature-typical range (curated)',
        legendgroup: 'typical',
        showlegend: !traces.some((tr) => (tr as { legendgroup?: string }).legendgroup === 'typical'),
        hovertemplate: `<b>${f.label}</b><br>Literature-typical ${typ.range[0]}–${typ.range[1]} kPa${typ.method ? ` (${typ.method.replace('_', ' ')})` : ''}<br>${typ.citation}<br>${typ.verified ? 'verified' : 'unverified citation'}<extra></extra>`,
      })
    }
    // Extracted values: one filled marker per record.
    const pts = records.filter((r) => r.properties.youngs_modulus?.value_si)
    const family = (r: MaterialRecord) => families.find((f) => f.record_ids.includes(r.record_id))
    const plotted = pts.filter(family)
    traces.push({
      type: 'scatter',
      mode: 'markers',
      name: 'Extracted from a paper',
      x: plotted.map((r) => r.properties.youngs_modulus!.value_si),
      y: plotted.map((r) => family(r)!.label),
      customdata: plotted.map((r) => r.record_id),
      hovertemplate: plotted.map((r) => hoverFor(r, [stiffnessLine(r)])),
      marker: { size: 12, color: t.categorical[0], line: { width: 2, color: t.panel } },
    })
    return {
      rowCount: labels.length,
      data: traces,
      layout: {
        ...baseLayout(t),
        margin: { l: 230, r: 20, t: 10, b: 60 },
        xaxis: logAxis(t, STIFFNESS_AXIS, [10, 1e12]),
        yaxis: { type: 'category', categoryarray: [...labels].reverse(), automargin: true, gridcolor: t.border },
        shapes: [
          {
            type: 'line', x0: 1e5, x1: 1e5, yref: 'paper', y0: 0, y1: 1,
            line: { color: t.accent, width: 1.5, dash: 'dash' },
          },
        ],
        annotations: [
          { x: 5, xref: 'x', xanchor: 'left', y: 1, yref: 'paper', yanchor: 'top', showarrow: false, text: ' 100 kPa', font: { size: 11, color: t.accent } },
        ],
      },
    }
  }, [card, records, t])

  return (
    <figure className="map-card">
      <figcaption>
        <h2>{m('How soft is each material?', 'Stiffness by material family')}</h2>
        <p>
          {cap(
            'Filled dots are measurements from papers; hollow markers joined by a line are typical ranges from the wider literature. Brain tissue is very soft, so further left is better: the dashed line is our “soft enough” cutoff of 100 kilopascals (kPa).',
            'Filled points are moduli extracted from papers; hollow markers joined by a line are literature-typical ranges from data/materials.yaml for families without an extracted value. The dashed line is the 100 kPa requirement.',
          )}
        </p>
      </figcaption>
      <Plot data={data} layout={layout} height={Math.max(300, 120 + rowCount * 34)} label="Stiffness of each material family" onClick={onPoint} />
    </figure>
  )
}

/* 1. Stiffness vs conductivity */

function StiffnessConductivity({
  records,
  references,
  targetWindow,
  onPoint,
}: Props & { onPoint: (p: PlotPoint) => void }) {
  const t = useTheme()
  const cap = useCaption()
  const m = useModeText()
  const points = useMemo(
    () =>
      records.filter(
        (r) => r.properties.youngs_modulus?.value_si != null && r.properties.conductivity?.value_si != null,
      ),
    [records],
  )
  const { data, layout } = useMemo(() => {
    const traces: object[] = MATERIAL_CLASSES.map((c) => {
      const rs = points.filter((r) => r.material_class === c.key)
      return {
        type: 'scatter',
        mode: 'markers',
        name: c.label,
        x: rs.map((r) => r.properties.youngs_modulus!.value_si),
        y: rs.map((r) => r.properties.conductivity!.value_si),
        customdata: rs.map((r) => r.record_id),
        hovertemplate: rs.map((r) =>
          hoverFor(r, [
            stiffnessLine(r),
            `σ = ${withPrefix(r.properties.conductivity!.value_si!, 'S/m')}`,
            r.biology ? 'Has cell data' : 'No cell data',
          ]),
        ),
        marker: {
          size: 12,
          color: classColor(t, c.key),
          symbol: rs.map((r) => (r.biology ? 'diamond' : 'circle')),
          line: { width: 2, color: t.panel },
        },
        showlegend: rs.length > 0,
      }
    })
    // Symbol key (gray, so it doesn't read as a class).
    traces.push(
      { type: 'scatter', mode: 'markers', x: [null], y: [null], name: 'Has cell data', marker: { symbol: 'diamond', size: 10, color: t.muted }, hoverinfo: 'skip' },
      { type: 'scatter', mode: 'markers', x: [null], y: [null], name: 'No cell data', marker: { symbol: 'circle', size: 10, color: t.muted }, hoverinfo: 'skip' },
    )

    const shapes: object[] = []
    const annotations: object[] = []
    references?.stiffness.forEach((ref, i) => {
      const box = ref.conductivity_s_m
      shapes.push({
        type: 'rect',
        xref: 'x',
        yref: box ? 'y' : 'paper',
        x0: ref.modulus_pa[0],
        x1: ref.modulus_pa[1],
        y0: box ? box[0] : 0,
        y1: box ? box[1] : 1,
        fillcolor: ref.kind === 'hydrogel' ? t.categorical[2] : t.muted,
        opacity: ref.kind === 'hydrogel' ? 0.12 : 0.14,
        line: ref.kind === 'hydrogel' ? { width: 1, color: t.categorical[2], dash: 'dot' } : { width: 0 },
        layer: 'below',
      })
      const mid = Math.sqrt(ref.modulus_pa[0] * ref.modulus_pa[1])
      annotations.push({
        x: Math.log10(mid),
        y: box ? Math.log10(box[1]) : 1 - (i % 4) * 0.07,
        xref: 'x',
        yref: box ? 'y' : 'paper',
        text: ref.label,
        showarrow: false,
        yanchor: 'bottom',
        font: { size: 11, color: ref.kind === 'hydrogel' ? t.categorical[2] : t.muted },
        hovertext: `${ref.label}: ${withPrefix(ref.modulus_pa[0], 'Pa')}–${withPrefix(ref.modulus_pa[1], 'Pa')} (${ref.status}). ${ref.citation}`,
      })
    })
    if (targetWindow) {
      shapes.push({
        type: 'rect',
        x0: targetWindow.modulus_pa[0],
        x1: targetWindow.modulus_pa[1],
        y0: targetWindow.conductivity_s_m[0],
        y1: targetWindow.conductivity_s_m[1],
        fillcolor: t.accent,
        opacity: 0.1,
        line: { color: t.accent, width: 1.5, dash: 'dash' },
        layer: 'below',
      })
      annotations.push({
        x: Math.log10(targetWindow.modulus_pa[0]),
        y: Math.log10(targetWindow.conductivity_s_m[1]),
        xanchor: 'left',
        yanchor: 'top',
        text: targetWindow.label,
        showarrow: false,
        font: { size: 11, color: t.accent },
        hovertext: targetWindow.note,
      })
    }
    return {
      data: traces,
      layout: {
        ...baseLayout(t),
        xaxis: logAxis(t, STIFFNESS_AXIS, [10, 1e12]),
        yaxis: logAxis(t, 'Conductivity (S/m)', [1e-4, 1e6]),
        shapes,
        annotations,
      },
    }
  }, [points, references, targetWindow, t])

  return (
    <figure className="map-card">
      <figcaption>
        <h2>{m('Soft and electrically conductive?', 'Stiffness vs. conductivity')}</h2>
        <p>
          {cap(
            'This only matters for a future chip with electrodes that record from the neurons. Each dot is a material with both values reported. Shaded bands show familiar materials and tissues for reference; the dashed box is the goal: soft and conductive.',
            'Each point is one material with both values reported, using the conductivity the paper states (electronic for conductive gels and films); gray bands are rigid and tissue references, dotted bands are common cell-culture hydrogels, and the dashed box is the future recording-layer window (soft and ≥10 S/m), which only matters once wells carry electrodes.',
          )}
        </p>
      </figcaption>
      <Plot data={data} layout={layout} height={520} label="Log-log scatter of Young's modulus against conductivity" onClick={onPoint} />
      {references && (
        <details className="refs">
          <summary>Reference markers and their sources</summary>
          <ul>
            {references.stiffness.map((r) => (
              <li key={r.id}>
                <strong>{r.label}</strong>: {withPrefix(r.modulus_pa[0], 'Pa')}–{withPrefix(r.modulus_pa[1], 'Pa')}
                {r.conductivity_s_m && `, ${r.conductivity_s_m[0]}–${r.conductivity_s_m[1]} S/m`}
                {r.test_method && `, ${methodLabel(r.test_method)}`} ({r.status}). {r.citation}{' '}
                {r.url && (
                  <a href={r.url} target="_blank" rel="noreferrer">
                    Source
                  </a>
                )}
              </li>
            ))}
            {targetWindow && (
              <li>
                <strong>{targetWindow.label}</strong>: {targetWindow.note}
              </li>
            )}
          </ul>
        </details>
      )}
      <p className="muted small">{points.length} of {records.length} records have both values.</p>
    </figure>
  )
}

/* 2. Cell outcome vs stiffness */

const SETTING_SYMBOLS: Record<string, string> = { in_vitro_2d: 'circle', in_vitro_3d: 'square', in_vivo: 'diamond' }
const MAX_CELL_TYPES = 5

function CellOutcomes({
  records,
  references,
  onPoint,
}: {
  records: MaterialRecord[]
  references: References | null
  onPoint: (p: PlotPoint) => void
}) {
  const t = useTheme()
  const cap = useCaption()
  const m = useModeText()
  const [outcome, setOutcome] = useState<'viability' | 'neurite'>('viability')
  const value = useCallback(
    (r: MaterialRecord) =>
      outcome === 'viability' ? r.biology?.viability_percent?.value_si : r.biology?.neurite_length?.value_si,
    [outcome],
  )
  const points = useMemo(
    () => records.filter((r) => r.properties.youngs_modulus?.value_si != null && value(r) != null),
    [records, value],
  )
  const brownId = records.find((r) => r.source.file === 'brown2024.pdf')?.record_id

  const { data, layout } = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of points) {
      const k = r.biology?.cell_type ?? 'Unspecified'
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_CELL_TYPES).map(([k]) => k)
    const group = (r: MaterialRecord) => {
      const k = r.biology?.cell_type ?? 'Unspecified'
      return top.includes(k) ? k : 'Other cell types'
    }
    const groups = [...top, ...(points.some((r) => group(r) === 'Other cell types') ? ['Other cell types'] : [])]
    const toY = (v: number) => (outcome === 'viability' ? v : v * 1e6)
    const traces: object[] = groups.map((g, i) => {
      const rs = points.filter((r) => group(r) === g)
      return {
        type: 'scatter',
        mode: 'markers',
        name: g,
        x: rs.map((r) => r.properties.youngs_modulus!.value_si),
        y: rs.map((r) => toY(value(r)!)),
        customdata: rs.map((r) => r.record_id),
        hovertemplate: rs.map((r) =>
          hoverFor(r, [
            stiffnessLine(r),
            outcome === 'viability' ? `Viability ${value(r)}%` : `Neurite length ${Number(toY(value(r)!).toPrecision(3))} µm`,
            `${r.biology?.cell_type ?? 'cells'} · ${r.biology?.setting ? SETTING_LABELS[r.biology.setting] : 'setting not stated'}`,
          ]),
        ),
        marker: {
          size: 12,
          color: g === 'Other cell types' ? t.other : t.categorical[i],
          symbol: rs.map((r) => SETTING_SYMBOLS[r.biology?.setting ?? ''] ?? 'x'),
          line: { width: 2, color: t.panel },
        },
      }
    })
    for (const [setting, symbol] of Object.entries(SETTING_SYMBOLS)) {
      traces.push({
        type: 'scatter', mode: 'markers', x: [null], y: [null],
        name: SETTING_LABELS[setting as keyof typeof SETTING_LABELS],
        marker: { symbol, size: 10, color: t.muted }, hoverinfo: 'skip',
      })
    }

    const annotations: object[] = []
    const sci = references?.science_corp
    const su8 = references?.stiffness.find((r) => r.id === sci?.modulus_ref)
    const shapes: object[] = []
    if (outcome === 'viability' && sci && su8) {
      // Same estimate and caveat as the survival map (chipEstimate.ts), not the two raw occupancy counts.
      const x = Math.sqrt(su8.modulus_pa[0] * su8.modulus_pa[1])
      const est = chipEstimate(sci.occupancy_at_loading_percent, sci.occupancy_at_3_weeks_percent)
      traces.push({
        type: 'scatter',
        mode: 'markers',
        name: m("Science Corp's chip (estimate*)", 'Science Corp SU-8 chip (est.*)'),
        x: [x],
        y: [est],
        customdata: brownId ? [brownId] : undefined,
        hovertemplate:
          `<b>${sci.label}</b><br>~${est.toFixed(0)}% of loaded neurons still detected at ~${sci.days} d in vivo*<br>` +
          `(${sci.occupancy_at_3_weeks_percent}% ÷ ${sci.occupancy_at_loading_percent}% of wells)<br>${sci.citation}<extra></extra>`,
        marker: { symbol: 'star', size: 20, color: t.accent, line: { width: 1.5, color: t.panel } },
      })
      shapes.push({ type: 'line', xref: 'paper', x0: 0, x1: 1, y0: est, y1: est, line: { color: t.accent, width: 1.5, dash: 'dash' } })
      annotations.push({
        xref: 'paper', x: 0, xanchor: 'left', y: est, yanchor: 'bottom', showarrow: false,
        text: m(`Science Corp's chip, in mice at 3 weeks: about ${est.toFixed(0)}%*`, `Science Corp SU-8 chip, in vivo ~${sci.days} d: est. ${est.toFixed(0)}%*`),
        font: { size: 11, color: t.accent },
      })
    }
    return {
      data: traces,
      layout: {
        ...baseLayout(t),
        xaxis: logAxis(t, STIFFNESS_AXIS, [10, 1e12]),
        yaxis: {
          title: { text: outcome === 'viability' ? 'Viability (%)' : 'Neurite length (µm)', font: { color: t.muted } },
          gridcolor: t.border,
          linecolor: t.muted,
          zeroline: false,
          ...(outcome === 'viability' ? { range: [0, 105] } : { rangemode: 'tozero' }),
        },
        shapes,
        annotations,
      },
    }
  }, [points, references, outcome, value, t, m, brownId])

  return (
    <figure className="map-card">
      <figcaption>
        <h2>{m('Do neurons do better on softer materials?', 'Cell outcome vs. stiffness')}</h2>
        <p>
          {cap(
            `Each dot is a cell result on a material of known softness, colored by cell type; the shape shows whether it was in a dish or in an animal.${outcome === 'viability' ? " The star and dashed line are our estimate for Science Corp's chip (see the note under the chart)." : ''}`,
            `Each point is a reported cell outcome on a material of known stiffness, colored by cell type, shaped by setting.${outcome === 'viability' ? ' The star and dashed line are the estimated Science Corp chip reference (note under the chart).' : ''}`,
          )}
        </p>
      </figcaption>
      <div className="pills" role="group" aria-label="Outcome">
        <button type="button" className="pill" aria-pressed={outcome === 'viability'} onClick={() => setOutcome('viability')}>
          {m('Survival', 'Viability')}
        </button>
        <button type="button" className="pill" aria-pressed={outcome === 'neurite'} onClick={() => setOutcome('neurite')}>
          {m('Fiber growth', 'Neurite length')}
        </button>
      </div>
      <Plot data={data} layout={layout} height={480} label="Scatter of cell outcome against Young's modulus" onClick={onPoint} />
      {outcome === 'viability' && references?.science_corp && (
        <p className="small muted chip-note">
          {(({ plain, hardcore }) => m(plain, hardcore))(
            chipNote(references.science_corp.occupancy_at_loading_percent, references.science_corp.occupancy_at_3_weeks_percent, references.science_corp.days),
          )}
        </p>
      )}
      <p className="muted small">{points.length} records have both a modulus and this outcome.</p>
    </figure>
  )
}

/* 3. Stiffness vs degradation time */

function Degradation({ records, onPoint }: { records: MaterialRecord[]; onPoint: (p: PlotPoint) => void }) {
  const t = useTheme()
  const cap = useCaption()
  const m = useModeText()
  const points = useMemo(
    () =>
      records.filter(
        (r) => r.properties.youngs_modulus?.value_si != null && r.properties.degradation_time?.value_si != null,
      ),
    [records],
  )
  const onlyDegradation = records.filter((r) => r.properties.degradation_time?.value_si != null).length
  const { data, layout } = useMemo(() => {
    const traces = MATERIAL_CLASSES.map((c) => {
      const rs = points.filter((r) => r.material_class === c.key)
      return {
        type: 'scatter',
        mode: 'markers',
        name: c.label,
        x: rs.map((r) => r.properties.youngs_modulus!.value_si),
        y: rs.map((r) => r.properties.degradation_time!.value_si),
        customdata: rs.map((r) => r.record_id),
        hovertemplate: rs.map((r) =>
          hoverFor(r, [stiffnessLine(r), `Degrades in ${Number(r.properties.degradation_time!.value_si!.toPrecision(3))} days`]),
        ),
        marker: { size: 12, color: classColor(t, c.key), line: { width: 2, color: t.panel } },
        showlegend: rs.length > 0,
      }
    })
    return {
      data: traces,
      layout: {
        ...baseLayout(t),
        xaxis: logAxis(t, STIFFNESS_AXIS, [10, 1e12]),
        yaxis: logAxis(t, 'Degradation time (days)', [0.1, 1000]),
        shapes: [
          {
            // Brown et al. assess graft success at ~3 weeks; a temporary gel should last at least the first days.
            type: 'line', xref: 'paper', x0: 0, x1: 1, y0: 21, y1: 21,
            line: { color: t.accent, width: 1.5, dash: 'dash' },
          },
        ],
        annotations: [
          {
            xref: 'paper', x: 1, y: Math.log10(21), xanchor: 'right', yanchor: 'bottom', showarrow: false,
            text: '~3 weeks: Science Corp graft check', font: { size: 11, color: t.accent },
          },
        ],
      },
    }
  }, [points, t])

  return (
    <figure className="map-card">
      <figcaption>
        <h2>{m('How long does each material last?', 'Stiffness vs. degradation time')}</h2>
        <p>
          {cap(
            'A temporary gel should help neurons settle in, then dissolve. This plots how soft each material is against how long it lasts; the dashed line marks 3 weeks, when Science Corp checked its implants.',
            'For a temporary gel fill, how soft it is and how long it lasts; the dashed line marks the ~3-week point where Brown et al. assess the graft.',
          )}
        </p>
      </figcaption>
      <Plot data={data} layout={layout} height={440} label="Scatter of stiffness against degradation time" onClick={onPoint} />
      <p className="muted small">
        {points.length} records report both; {onlyDegradation} report a degradation time at all.
      </p>
    </figure>
  )
}

/* 4. Mixed conductors: μC* vs C* */

const MOBILITIES = [0.001, 0.01, 0.1, 1, 10] // cm² V⁻¹ s⁻¹; μC* = μ · C*, so each is a straight line in log-log

function MixedConductors({ records, onPoint }: { records: MaterialRecord[]; onPoint: (p: PlotPoint) => void }) {
  const t = useTheme()
  const cap = useCaption()
  const m = useModeText()
  const points = useMemo(
    () =>
      records.filter(
        (r) => r.properties.volumetric_capacitance?.value_si != null && r.properties.mu_c_star?.value_si != null,
      ),
    [records],
  )
  const { data, layout } = useMemo(() => {
    const X: [number, number] = [10, 1000]
    const traces: object[] = MOBILITIES.map((mu) => ({
      type: 'scatter',
      mode: 'lines',
      x: X,
      y: X.map((c) => mu * c),
      line: { color: t.border, width: 1, dash: 'dot' },
      hoverinfo: 'skip',
      showlegend: false,
    }))
    traces.push(
      ...MATERIAL_CLASSES.map((c) => {
        const rs = points.filter((r) => r.material_class === c.key)
        return {
          type: 'scatter',
          mode: 'markers+text',
          name: c.label,
          x: rs.map((r) => r.properties.volumetric_capacitance!.value_si),
          y: rs.map((r) => r.properties.mu_c_star!.value_si),
          text: rs.map((r) => r.material),
          textposition: 'top center',
          textfont: { size: 10, color: t.muted },
          customdata: rs.map((r) => r.record_id),
          hovertemplate: rs.map((r) => {
            const cs = r.properties.volumetric_capacitance!.value_si!
            const mc = r.properties.mu_c_star!.value_si!
            return hoverFor(r, [`C* = ${cs} F cm⁻³`, `μC* = ${mc} F cm⁻¹ V⁻¹ s⁻¹`, `implied μ ≈ ${Number((mc / cs).toPrecision(2))} cm² V⁻¹ s⁻¹`])
          }),
          marker: { size: 11, color: classColor(t, c.key), line: { width: 2, color: t.panel } },
          showlegend: rs.length > 0,
        }
      }),
    )
    return {
      data: traces,
      layout: {
        ...baseLayout(t),
        xaxis: logAxis(t, 'Volumetric capacitance C* (F cm⁻³)', X),
        yaxis: logAxis(t, 'μC* (F cm⁻¹ V⁻¹ s⁻¹)', [0.05, 2000]),
        annotations: MOBILITIES.filter((mu) => mu * 1000 <= 2000 && mu * 1000 >= 0.05).map((mu) => ({
          x: Math.log10(1000),
          y: Math.log10(mu * 1000),
          xanchor: 'right',
          yanchor: 'bottom',
          showarrow: false,
          text: `μ = ${mu} cm²/Vs`,
          font: { size: 10, color: t.muted },
        })),
      },
    }
  }, [points, t])

  return (
    <figure className="map-card">
      <figcaption>
        <h2>{m('Materials for future electronics', 'Mixed conductors: μC* vs. C*')}</h2>
        <p>
          {cap(
            'For specialists: the standard comparison for conductive plastics used in bioelectronics (organic mixed ionic-electronic conductors). Higher is better for the tiny transistors that could one day sense neural signals. These are the kinds of materials the Seifrid lab at NC State optimizes with automated, robot-run experiments.',
            "The standard figure of merit for organic mixed ionic-electronic conductors: μC* (higher is better for transistors) against volumetric capacitance C*; dotted lines are constant electronic mobility μ = μC*/C*. These are the film materials a self-driving lab like the Seifrid lab's would optimize.",
          )}
        </p>
      </figcaption>
      <Plot data={data} layout={layout} height={480} label="Log-log scatter of μC* against volumetric capacitance" onClick={onPoint} />
      <p className="muted small">{points.length} records report both C* and μC*.</p>
    </figure>
  )
}

/* 5. Coverage heatmap */

function Coverage({ records, onCell }: { records: MaterialRecord[]; onCell: (ids: string[]) => void }) {
  const t = useTheme()
  const cap = useCaption()
  const m = useModeText()
  const [rowsBy, setRowsBy] = useState<'class' | 'material'>('class')

  const { data, layout, ids } = useMemo(() => {
    const rowKey = (r: MaterialRecord) => (rowsBy === 'class' ? classLabel(r.material_class) : r.material)
    const rows =
      rowsBy === 'class'
        ? MATERIAL_CLASSES.map((c) => c.label)
        : [...new Set(records.map(rowKey))].sort((a, b) => a.localeCompare(b)).slice(0, 30)
    const ids = rows.map((row) =>
      COVERAGE_COLUMNS.map((col) => records.filter((r) => rowKey(r) === row && col.has(r)).map((r) => r.record_id)),
    )
    const z = ids.map((row) => row.map((cell) => cell.length))
    const zMax = Math.max(1, ...z.flat())
    return {
      ids,
      data: [
        {
          type: 'heatmap',
          x: COVERAGE_COLUMNS.map((c) => c.label),
          y: rows,
          z,
          zmin: 0,
          zmax: zMax,
          xgap: 2,
          ygap: 2,
          // Zero (untested) gets the neutral surface color; counts run light → dark blue.
          colorscale: [
            [0, t.bg],
            [0.0001, t.seqLow],
            [1, t.seqHigh],
          ],
          text: z.map((row) => row.map((v) => (v === 0 ? 'untested' : String(v)))),
          texttemplate: '%{text}',
          textfont: { size: 10 },
          hovertemplate: '%{y}<br>%{x}: %{z} record(s)<extra></extra>',
          colorbar: { title: { text: 'Records', side: 'right' }, outlinewidth: 0, tickfont: { color: t.muted } },
        },
      ],
      layout: {
        ...baseLayout(t),
        margin: { l: rowsBy === 'class' ? 170 : 220, r: 20, t: 10, b: 120 },
        xaxis: { tickangle: -40, tickfont: { size: 11 }, side: 'bottom' },
        yaxis: { autorange: 'reversed', tickfont: { size: 11 } },
      },
    }
  }, [records, rowsBy, t])

  const onClick = useCallback(
    (p: PlotPoint) => {
      const r = (data[0] as { y: string[] }).y.indexOf(String(p.y))
      const c = COVERAGE_COLUMNS.findIndex((col) => col.label === p.x)
      if (r >= 0 && c >= 0) onCell(ids[r][c])
    },
    [data, ids, onCell],
  )
  const rowCount = (data[0] as { y: string[] }).y.length

  return (
    <figure className="map-card">
      <figcaption>
        <h2>{m("What's been measured, and what hasn't", "Coverage: what's been measured, and the untested gaps")}</h2>
        <p>
          {cap(
            'Darker boxes mean more results. “Untested” means we found no paper that measured it. Click a box to see the results.',
            'Each cell counts the records that report that property for that group; “untested” cells are combinations no extracted paper reports. Click a cell to list its records.',
          )}
        </p>
      </figcaption>
      <div className="pills" role="group" aria-label="Rows">
        <button type="button" className="pill" aria-pressed={rowsBy === 'class'} onClick={() => setRowsBy('class')}>
          By material class
        </button>
        <button type="button" className="pill" aria-pressed={rowsBy === 'material'} onClick={() => setRowsBy('material')}>
          By material
        </button>
      </div>
      <Plot data={data} layout={layout} height={Math.max(320, 140 + rowCount * 34)} label="Heatmap of record counts by group and property" onClick={onClick} />
    </figure>
  )
}
