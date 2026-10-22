import { useEffect, type ReactNode } from 'react'
import {
  SETTING_LABELS,
  classLabel,
  fieldEntries,
  formatReported,
  formatSi,
  methodLabel,
  sourceLabel,
  sourceUrl,
  type FieldEntry,
  type MaterialRecord,
} from './records'

function Verified({ ok }: { ok: boolean | null }) {
  if (ok === null) return null
  return ok ? (
    <span className="badge ok" title="The quote was found in the source text">✓ quote found in source</span>
  ) : (
    <span className="badge warn" title="The quote was not found in the source text">⚠ quote not found in source</span>
  )
}

function Evidence({ quote, location, verified }: { quote: string | null; location?: string | null; verified: boolean | null }) {
  if (!quote) return <p className="evidence missing">No evidence quote.</p>
  return (
    <figure className="evidence">
      <blockquote>“{quote}”</blockquote>
      <figcaption>
        {location && <span>{location}</span>}
        <Verified ok={verified} />
      </figcaption>
    </figure>
  )
}

interface Props {
  record: MaterialRecord
  // Extra controls per field (the Review tab's edit buttons).
  fieldExtra?: (entry: FieldEntry) => ReactNode
}

export default function RecordDetail({ record: r, fieldExtra }: Props) {
  const url = sourceUrl(r.source)
  const entries = fieldEntries(r)
  return (
    <article className="record-detail">
      <header>
        <p className="kicker">{classLabel(r.material_class)}</p>
        <h3>{r.material}</h3>
        <p className="muted">
          {url ? (
            <a href={url} target="_blank" rel="noreferrer">
              {sourceLabel(r.source)}
            </a>
          ) : (
            sourceLabel(r.source)
          )}
          {r.source.title && <> · {r.source.title}</>}
        </p>
        {r.electrode_material && (
          <p className="small">Electrode material: <strong>{r.electrode_material}</strong> (its electrical values describe the electrode, not this material family)</p>
        )}
        {r.flags.length > 0 && (
          <ul className="flag-list">
            {r.flags.map((f) => (
              <li key={f} className="badge warn">
                {f.replace('unverified_quote:', 'unverified quote: ').replace('out_of_range:', 'out of range: ')}
              </li>
            ))}
          </ul>
        )}
      </header>

      {entries.length > 0 && (
        <section>
          <h4>Values</h4>
          <dl className="fields">
            {entries.map((e) => {
              const si = formatSi(e)
              return (
                <div key={e.path} className="field">
                  <dt>
                    {e.label}
                    {e.field.confidence && <span className={`conf ${e.field.confidence}`}>{e.field.confidence}</span>}
                    {e.field.test_method && <span className="conf">{methodLabel(e.field.test_method)}</span>}
                  </dt>
                  <dd>
                    <span className="value">{formatReported(e.field)}</span>
                    {si && si !== formatReported(e.field) && <span className="si"> = {si}</span>}
                    {fieldExtra?.(e)}
                    <Evidence quote={e.field.evidence} location={e.field.location} verified={e.field.evidence_verified} />
                  </dd>
                </div>
              )
            })}
          </dl>
        </section>
      )}

      {r.biology && (
        <section>
          <h4>Cells</h4>
          <p>
            {[
              r.biology.cell_type,
              r.biology.cell_category?.replace(/_/g, ' '),
              r.biology.species,
              r.biology.setting && SETTING_LABELS[r.biology.setting],
              r.biology.tissue_site && r.biology.tissue_site !== 'not_applicable' && r.biology.tissue_site.replace('_', ' '),
            ]
              .filter(Boolean)
              .join(' · ') || 'Not specified'}
            {r.biology.coating && <> · coating: {r.biology.coating}</>}
          </p>
        </section>
      )}

      {r.formulation.length > 0 && (
        <section>
          <h4>Formulation</h4>
          <ul className="steps-list">
            {r.formulation.map((f, i) => (
              <li key={i}>
                <strong>{f.component}</strong> {[f.amount, f.unit].filter(Boolean).join(' ')}
                <Evidence quote={f.evidence} verified={f.evidence_verified} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {r.processing.length > 0 && (
        <section>
          <h4>Processing</h4>
          <ul className="steps-list">
            {r.processing.map((p, i) => (
              <li key={i}>
                <strong>{p.step}</strong>
                {p.parameter && <> · {p.parameter}</>} {[p.value, p.unit].filter(Boolean).join(' ')}
                <Evidence quote={p.evidence} verified={p.evidence_verified} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {r.notes && (
        <section>
          <h4>Notes</h4>
          <p>{r.notes}</p>
        </section>
      )}

      <p className="meta">
        {r.record_id} · extracted by {r.extraction_model ?? 'unknown'}
        {r.extracted_at && ` on ${r.extracted_at.slice(0, 10)}`}
        {r.source.file && ` from ${r.source.file}`}
      </p>
    </article>
  )
}

export function SidePanel({ onClose, children, label }: { onClose: () => void; children: ReactNode; label: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="panel-backdrop" onClick={onClose}>
      <aside className="side-panel" aria-label={label} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="panel-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        {children}
      </aside>
    </div>
  )
}
