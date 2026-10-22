import { useMemo, useState } from 'react'
import RecordDetail, { SidePanel } from './RecordDetail'
import { useModeText } from './mode'
import { MATERIAL_CLASSES, classLabel, sourceLabel, withPrefix, type MaterialRecord } from './records'

export default function RecordsTab({ records, openId }: { records: MaterialRecord[]; openId?: string | null }) {
  const [query, setQuery] = useState('')
  const [cls, setCls] = useState('')
  const [cellsOnly, setCellsOnly] = useState(false)
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [open, setOpen] = useState<MaterialRecord | null>(null)
  const t = useModeText()
  // Links like #/records?id=<record_id> (e.g. from the Overview) open that record until closed.
  const [dismissedId, setDismissedId] = useState<string | null>(null)
  const linked = openId && openId !== dismissedId ? (records.find((r) => r.record_id === openId) ?? null) : null
  const shown = open ?? linked

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return records.filter((r) => {
      if (cls && r.material_class !== cls) return false
      if (cellsOnly && !r.biology) return false
      if (flaggedOnly && r.flags.length === 0) return false
      if (!q) return true
      const hay = [r.material, r.source.title, r.source.first_author, r.biology?.cell_type, r.notes, ...r.formulation.map((f) => f.component)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [records, query, cls, cellsOnly, flaggedOnly])

  return (
    <div className="container tab">
      <p className="kicker">Records</p>
      <h1 className="section-title">{t('All the data, line by line', 'Every extracted record')}</h1>
      <p className="lede">
        {t(
          'Each row is one material from one research paper. Click a row to see every number next to the exact sentence it came from. Rows marked ⚠ need a person to double-check them.',
          'Search and filter, then select a row to see each value with its evidence quote and source.',
        )}
      </p>

      <div className="filters">
        <input type="search" placeholder="Search material, paper, cell type…" value={query}
          onChange={(e) => setQuery(e.target.value)} aria-label="Search records" />
        <select value={cls} onChange={(e) => setCls(e.target.value)} aria-label="Material class">
          <option value="">{t('All kinds of material', 'All classes')}</option>
          {MATERIAL_CLASSES.map((c) => (
            <option key={c.key} value={c.key}>{t(c.plain, c.label)}</option>
          ))}
        </select>
        <label className="check">
          <input type="checkbox" checked={cellsOnly} onChange={(e) => setCellsOnly(e.target.checked)} /> Has cell data
        </label>
        <label className="check">
          <input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} /> {t('Needs checking only', 'Flagged only')}
        </label>
        <span className="muted small">{rows.length} of {records.length}</span>
      </div>

      <div className="table-scroll">
        <table className="records-table">
          <thead>
            <tr>
              <th>Material</th>
              <th>{t('Kind', 'Class')}</th>
              <th>Source</th>
              <th className="num">{t('Stiffness', 'Modulus')}</th>
              <th className="num">Conductivity</th>
              <th>Cells</th>
              <th className="num">{t('Cells alive', 'Viability')}</th>
              <th>{t('Check', 'Flags')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const e = r.properties.youngs_modulus?.value_si
              const s = r.properties.conductivity?.value_si
              const v = r.biology?.viability_percent?.value_si
              return (
                <tr key={r.record_id} onClick={() => setOpen(r)} tabIndex={0}
                  onKeyDown={(ev) => ev.key === 'Enter' && setOpen(r)}>
                  <td><strong>{r.material}</strong></td>
                  <td>{classLabel(r.material_class, t(true, false))}</td>
                  <td>{sourceLabel(r.source)}</td>
                  <td className="num">{e != null ? withPrefix(e, 'Pa') : '—'}</td>
                  <td className="num">{s != null ? withPrefix(s, 'S/m') : '—'}</td>
                  <td>{r.biology?.cell_type ?? (r.biology ? 'yes' : '—')}</td>
                  <td className="num">{v != null ? `${v}%` : '—'}</td>
                  <td>{r.flags.length ? <span className="badge warn">⚠ {r.flags.length}</span> : ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {records.length === 0 && <p className="notice">No records yet. See the Extract tab or data/papers/README.md.</p>}

      {shown && (
        <SidePanel
          label="Record details"
          onClose={() => {
            setOpen(null)
            setDismissedId(openId ?? null)
          }}
        >
          <RecordDetail record={shown} />
        </SidePanel>
      )}
    </div>
  )
}
