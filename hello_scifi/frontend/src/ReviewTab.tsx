import { useState } from 'react'
import RecordDetail from './RecordDetail'
import { sourceLabel, type FieldEntry, type MaterialRecord } from './records'

// Demo only: nothing here is saved. In the full app, expert reviewers would log in to curate.
const INERT = 'Disabled in the demo'

export default function ReviewTab({ records }: { records: MaterialRecord[] }) {
  const [index, setIndex] = useState(0)
  const flagged = records.filter((r) => r.flags.length > 0).length

  const banner = (
    <div className="demo-banner" role="note">
      <strong>Demo only:</strong> changes made here are not saved and do not change the data. In the full app, expert
      reviewers will log in to curate records.
    </div>
  )

  if (records.length === 0) {
    return (
      <div className="container tab">
        {banner}
        <h1 className="section-title">Review extracted records</h1>
        <p className="notice">No records to review yet.</p>
      </div>
    )
  }

  const i = Math.min(index, records.length - 1)
  const record = records[i]
  const go = (next: number) => setIndex((next + records.length) % records.length)
  const nextFlagged = () => {
    for (let k = 1; k <= records.length; k++) {
      const j = (i + k) % records.length
      if (records[j].flags.length) return go(j)
    }
  }

  const fieldExtra = (_entry: FieldEntry) => (
    <span className="edit-line">
      <button type="button" className="link-btn" disabled title={INERT}>
        Edit field
      </button>
    </span>
  )

  return (
    <div className="container tab">
      {banner}
      <p className="kicker">Review</p>
      <h1 className="section-title">Review extracted records</h1>
      <p className="lede">
        A reviewer checks each value against its quote, then accepts, rejects, or corrects it. This is what that would
        look like.
      </p>

      <p className="pending-count">
        <strong>{records.length}</strong> records pending review, <strong>{flagged}</strong> of them flagged by the
        validators.
      </p>

      <div className="review-nav">
        <button type="button" className="pill" onClick={() => go(i - 1)}>← Previous</button>
        <span>
          Record {i + 1} of {records.length} · {sourceLabel(record.source)}
          {record.flags.length > 0 && <span className="badge warn"> ⚠ {record.flags.length} flag(s)</span>}
        </span>
        <button type="button" className="pill" onClick={() => go(i + 1)}>Next →</button>
        <button type="button" className="pill" onClick={nextFlagged} disabled={flagged === 0}>Next flagged</button>
      </div>

      <div className="review-layout">
        <RecordDetail record={record} fieldExtra={fieldExtra} />
        <aside className="review-actions inert" aria-disabled="true">
          <div className="decide">
            <button type="button" className="accept" disabled title={INERT}>Accept</button>
            <button type="button" className="reject" disabled title={INERT}>Reject</button>
          </div>
          <label>
            Reviewer note
            <textarea rows={5} disabled placeholder="Notes are disabled in the demo." />
          </label>
          <button type="button" disabled title={INERT}>Export reviews</button>
          <p className="small muted">Review controls are disabled in this demo.</p>
        </aside>
      </div>
    </div>
  )
}
