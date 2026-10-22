import { useState } from 'react'
import RecordDetail from './RecordDetail'
import { sourceLabel, type FieldEntry, type MaterialRecord } from './records'
import { downloadJson, emptyReview, readReviewer, saveReviewer, useReviews, type ReviewStatus } from './reviews'

export default function ReviewTab({ records }: { records: MaterialRecord[] }) {
  const { reviews, update } = useReviews()
  const [index, setIndex] = useState(0)
  const [reviewer, setReviewer] = useState(readReviewer)
  const [editing, setEditing] = useState<string | null>(null)

  if (records.length === 0) {
    return (
      <div className="container tab">
        <p className="kicker">Review</p>
        <h1 className="section-title">Review extracted records</h1>
        <p className="notice">No records to review yet.</p>
      </div>
    )
  }

  const i = Math.min(index, records.length - 1)
  const record = records[i]
  const review = { ...emptyReview(), ...reviews[record.record_id] }
  const statusOf = (r: MaterialRecord): ReviewStatus => reviews[r.record_id]?.status ?? 'pending'
  const counts = { accepted: 0, rejected: 0, pending: 0 }
  for (const r of records) counts[statusOf(r)]++

  function go(next: number) {
    setEditing(null)
    setIndex((next + records.length) % records.length)
  }

  function nextPending() {
    for (let k = 1; k <= records.length; k++) {
      const j = (i + k) % records.length
      if (statusOf(records[j]) === 'pending') return go(j)
    }
  }

  function decide(status: ReviewStatus) {
    update(record.record_id, { status })
    nextPending()
  }

  function exportReviews() {
    downloadJson(`reviews-${(reviewer || 'anonymous').replace(/\W+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`, {
      reviewer: reviewer || null,
      exported_at: new Date().toISOString(),
      schema_version: '0.1.0',
      counts,
      reviews: Object.fromEntries(
        records.filter((r) => reviews[r.record_id]).map((r) => [r.record_id, reviews[r.record_id]]),
      ),
    })
  }

  const fieldExtra = (entry: FieldEntry) => {
    const edit = review.edits[entry.path]
    if (editing === entry.path) {
      return (
        <FieldEditor
          initial={edit ?? { value: String(entry.field.value ?? ''), unit: entry.field.unit ?? '' }}
          onSave={(value, unit) => {
            update(record.record_id, { edits: { ...review.edits, [entry.path]: { value, unit } } })
            setEditing(null)
          }}
          onCancel={() => setEditing(null)}
        />
      )
    }
    return (
      <span className="edit-line">
        {edit && <span className="badge edited">edited → {edit.value} {edit.unit}</span>}
        <button type="button" className="link-btn" onClick={() => setEditing(entry.path)}>
          Edit field
        </button>
      </span>
    )
  }

  const done = counts.accepted + counts.rejected

  return (
    <div className="container tab">
      <p className="kicker">Review</p>
      <h1 className="section-title">Review extracted records</h1>
      <p className="lede">
        Check each value against its quote, then accept, reject, or correct it. Reviews are saved in this browser; export
        them as JSON to commit.
      </p>

      <div className="review-bar">
        <div className="progress" aria-label="Review progress">
          <div className="progress-track">
            <span className="seg accepted" style={{ width: `${(counts.accepted / records.length) * 100}%` }} />
            <span className="seg rejected" style={{ width: `${(counts.rejected / records.length) * 100}%` }} />
          </div>
          <p className="small">
            <strong>{done}</strong> of {records.length} reviewed · <span className="badge accepted">{counts.accepted} accepted</span>{' '}
            <span className="badge rejected">{counts.rejected} rejected</span>{' '}
            <span className="badge pending">{counts.pending} pending</span>
          </p>
        </div>
        <label className="reviewer">
          Reviewer
          <input value={reviewer} placeholder="Your name"
            onChange={(e) => {
              setReviewer(e.target.value)
              saveReviewer(e.target.value)
            }} />
        </label>
        <button type="button" onClick={exportReviews}>Export reviews as JSON</button>
      </div>

      <div className="review-nav">
        <button type="button" className="pill" onClick={() => go(i - 1)}>← Previous</button>
        <span>
          Record {i + 1} of {records.length} · {sourceLabel(record.source)} ·{' '}
          <span className={`badge ${review.status}`}>{review.status}</span>
        </span>
        <button type="button" className="pill" onClick={() => go(i + 1)}>Next →</button>
        <button type="button" className="pill" onClick={nextPending} disabled={counts.pending === 0}>Next pending</button>
      </div>

      <div className="review-layout">
        <RecordDetail record={record} fieldExtra={fieldExtra} />
        <aside className="review-actions">
          <div className="decide">
            <button type="button" className="accept" onClick={() => decide('accepted')}>Accept</button>
            <button type="button" className="reject" onClick={() => decide('rejected')}>Reject</button>
          </div>
          {review.status !== 'pending' && (
            <button type="button" className="link-btn" onClick={() => update(record.record_id, { status: 'pending' })}>
              Reset to pending
            </button>
          )}
          <label>
            Reviewer note
            <textarea rows={5} value={review.note} placeholder="What's wrong or worth knowing about this record?"
              onChange={(e) => update(record.record_id, { note: e.target.value })} />
          </label>
          {Object.keys(review.edits).length > 0 && (
            <p className="small muted">{Object.keys(review.edits).length} field edit(s) saved for this record.</p>
          )}
        </aside>
      </div>
    </div>
  )
}

function FieldEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: { value: string; unit: string }
  onSave: (value: string, unit: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(initial.value)
  const [unit, setUnit] = useState(initial.unit)
  return (
    <span className="field-editor">
      <input aria-label="Corrected value" value={value} onChange={(e) => setValue(e.target.value)} />
      <input aria-label="Corrected unit" value={unit} onChange={(e) => setUnit(e.target.value)} className="unit" />
      <button type="button" className="link-btn" onClick={() => onSave(value, unit)}>Save</button>
      <button type="button" className="link-btn" onClick={onCancel}>Cancel</button>
    </span>
  )
}
