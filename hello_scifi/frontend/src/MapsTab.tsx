import { useCallback, useMemo, useState } from 'react'
import { baseLayout, logAxis, useTheme, type Theme } from './chartTheme'
import Plot, { type PlotPoint } from './Plot'
import RecordDetail, { SidePanel } from './RecordDetail'
import {
  COVERAGE_COLUMNS,
  MATERIAL_CLASSES,
  SETTING_LABELS,
  classLabel,
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

export default function MapsTab({ records, references, targetWindow }: Props) {
  const [selected, setSelected] = useState<MaterialRecord[] | null>(null)
  const [index, setIndex] = useState(0)
  const byId = useMemo(() => new Map(records.map((r) => [r.record_id, r])), [records])

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
      <h1 className="section-title">Where the evidence is, and where it isn't</h1>
      <p className="lede">
        {records.length} record{records.length === 1 ? '' : 's'} from the literature. Click any point to see its values, the exact quotes
        they came from, and the source.
      </p>
      {records.length === 0 && (
        <p className="notice">
          No extracted records yet. Add PDFs to <code>data/papers</code> and run{' '}
          <code>scripts/extract_batch.py</code>; the reference markers below still show.
        </p>
      )}

      <StiffnessConductivity records={records} references={references} targetWindow={targetWindow} onPoint={onPoint} />
      <CellOutcomes records={records} references={references} onPoint={onPoint} />
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

function classColor(t: Theme, key: string): string {
  const i = MATERIAL_CLASSES.findIndex((m) => m.key === key)
  return i >= 0 ? t.categorical[i] : t.other
}

function hoverFor(r: MaterialRecord, lines: string[]): string {
  const flagged = r.flags.length ? `<br>⚠ ${r.flags.length} flag(s)` : ''
  return `<b>${r.material}</b><br>${sourceLabel(r.source)} · ${classLabel(r.material_class)}<br>${lines.join('<br>')}${flagged}<extra></extra>`
}

/* 1. Stiffness vs conductivity */

function StiffnessConductivity({
  records,
  references,
  targetWindow,
  onPoint,
}: Props & { onPoint: (p: PlotPoint) => void }) {
  const t = useTheme()
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
            `E = ${withPrefix(r.properties.youngs_modulus!.value_si!, 'Pa')}`,
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
        fillcolor: t.muted,
        opacity: 0.14,
        line: { width: 0 },
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
        font: { size: 11, color: t.muted },
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
        xaxis: logAxis(t, "Young's modulus (Pa)", [10, 1e12]),
        yaxis: logAxis(t, 'Conductivity (S/m)', [1e-4, 1e6]),
        shapes,
        annotations,
      },
    }
  }, [points, references, targetWindow, t])

  return (
    <figure className="map-card">
      <figcaption>
        <h2>Stiffness vs. conductivity</h2>
        <p>
          Each point is one material with both values reported; gray bands are reference materials and the dashed box is
          the soft-and-conductive target window. {CAVEAT}
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
                {r.conductivity_s_m && `, ${r.conductivity_s_m[0]}–${r.conductivity_s_m[1]} S/m`} ({r.status}). {r.citation}
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
            `E = ${withPrefix(r.properties.youngs_modulus!.value_si!, 'Pa')}`,
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
    if (outcome === 'viability' && sci && su8) {
      const x = Math.sqrt(su8.modulus_pa[0] * su8.modulus_pa[1])
      traces.push({
        type: 'scatter',
        mode: 'lines+markers',
        name: 'Science Corp SU-8 wells (well occupancy)',
        x: [x, x],
        y: [sci.occupancy_at_loading_percent, sci.occupancy_at_3_weeks_percent],
        marker: { symbol: ['star-open', 'star'], size: 16, color: t.accent },
        line: { color: t.accent, width: 2, dash: 'dot' },
        hovertemplate: [
          `<b>${sci.label}</b><br>${sci.occupancy_at_loading_percent}% of wells occupied at loading<br>${sci.measure}<br>${sci.citation}<extra></extra>`,
          `<b>${sci.label}</b><br>${sci.occupancy_at_3_weeks_percent}% at ~${Math.round(sci.days / 7)} weeks<br>${sci.measure}<br>${sci.citation}<extra></extra>`,
        ],
      })
      annotations.push({
        x: Math.log10(x),
        y: sci.occupancy_at_3_weeks_percent,
        text: `Science Corp SU-8: ${sci.occupancy_at_loading_percent}% → ${sci.occupancy_at_3_weeks_percent}% of wells<br>occupied at ~3 weeks (well occupancy, not viability)`,
        showarrow: true,
        arrowcolor: t.accent,
        ax: -150,
        ay: 30,
        font: { size: 11, color: t.fg },
        align: 'right',
      })
    }
    return {
      data: traces,
      layout: {
        ...baseLayout(t),
        xaxis: logAxis(t, "Young's modulus (Pa)", [10, 1e12]),
        yaxis: {
          title: { text: outcome === 'viability' ? 'Viability (%)' : 'Neurite length (µm)', font: { color: t.muted } },
          gridcolor: t.border,
          linecolor: t.muted,
          zeroline: false,
          ...(outcome === 'viability' ? { range: [0, 105] } : { rangemode: 'tozero' }),
        },
        annotations,
      },
    }
  }, [points, references, outcome, value, t])

  return (
    <figure className="map-card">
      <figcaption>
        <h2>Cell outcome vs. stiffness</h2>
        <p>
          Each point is a reported cell outcome on a material of known stiffness, colored by cell type, shaped by setting.
          {outcome === 'viability' && ' The star pair is the Science Corp microwell reference, which measures well occupancy rather than viability.'}{' '}
          {CAVEAT}
        </p>
      </figcaption>
      <div className="pills" role="group" aria-label="Outcome">
        <button type="button" className="pill" aria-pressed={outcome === 'viability'} onClick={() => setOutcome('viability')}>
          Viability
        </button>
        <button type="button" className="pill" aria-pressed={outcome === 'neurite'} onClick={() => setOutcome('neurite')}>
          Neurite length
        </button>
      </div>
      <Plot data={data} layout={layout} height={480} label="Scatter of cell outcome against Young's modulus" onClick={onPoint} />
      <p className="muted small">{points.length} records have both a modulus and this outcome.</p>
    </figure>
  )
}

/* 3. Coverage heatmap */

function Coverage({ records, onCell }: { records: MaterialRecord[]; onCell: (ids: string[]) => void }) {
  const t = useTheme()
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
        <h2>Coverage: what's been measured, and the untested gaps</h2>
        <p>
          Each cell counts the records that report that property for that group; “untested” cells are combinations no
          extracted paper reports. Click a cell to list its records. {CAVEAT}
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
