import { useMemo, useState, type FormEvent } from 'react'
import RecordDetail from './RecordDetail'
import { fieldEntries, type MaterialRecord } from './records'

interface ExtractResponse {
  records: MaterialRecord[]
  pages: string[]
  mock: boolean
}

export default function ExtractTab() {
  const [file, setFile] = useState<File | null>(null)
  const [text, setText] = useState('')
  const [result, setResult] = useState<ExtractResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setResult(null)
    const body = new FormData()
    if (file) body.append('file', file)
    else if (text.trim()) body.append('text', text)
    try {
      const response = await fetch('/api/extract', { method: 'POST', body })
      const data = await response.json()
      if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Extraction failed.')
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container tab">
      <p className="kicker">Extract</p>
      <h1 className="section-title">Run the extraction live</h1>
      <p className="lede">
        Upload a paper or paste a passage. Claude pulls out materials values, each with a verbatim quote, and the server
        checks every quote against the text. Results here aren't saved; the committed records come from the batch script.
      </p>

      <form className="extract-form" onSubmit={handleSubmit}>
        <label className="file-input">
          <span>PDF</span>
          <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <p className="muted small">or paste text</p>
        <textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} disabled={!!file}
          placeholder="e.g. The PEDOT:PSS hydrogel had a Young's modulus of 2 MPa and a conductivity of 20 S/m in PBS…" />
        <div className="row">
          <span className="muted small">
            {file ? `${file.name} (${(file.size / 1e6).toFixed(1)} MB)` : `${text.length.toLocaleString()} characters`}
          </span>
          <button type="submit" disabled={loading}>
            {loading ? 'Extracting… (up to a minute)' : file || text.trim() ? 'Extract' : 'Extract (example)'}
          </button>
        </div>
      </form>

      {error && <p className="error">{error}</p>}
      {result && <ExtractResult result={result} />}
    </div>
  )
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function ExtractResult({ result }: { result: ExtractResponse }) {
  const quotes = useMemo(() => {
    const qs: string[] = []
    for (const r of result.records) {
      for (const e of fieldEntries(r)) if (e.field.evidence) qs.push(e.field.evidence)
      for (const f of r.formulation) if (f.evidence) qs.push(f.evidence)
      for (const p of r.processing) if (p.evidence) qs.push(p.evidence)
    }
    return qs.map((q) => q.replace(/\s+/g, ' ').trim()).filter((q) => q.length >= 4)
  }, [result])

  const pattern = useMemo(
    () => (quotes.length ? new RegExp(`(${quotes.map(escapeRegExp).sort((a, b) => b.length - a.length).join('|')})`, 'gi') : null),
    [quotes],
  )

  return (
    <div className="extract-result">
      {result.mock && (
        <p className="notice">MOCK_LLM is on: this is a canned example record, not an extraction of your input.</p>
      )}
      <h2>{result.records.length} record{result.records.length === 1 ? '' : 's'}</h2>
      <div className="extract-grid">
        <div>
          {result.records.map((r) => (
            <RecordDetail key={r.record_id} record={r} />
          ))}
        </div>
        <div className="source-text">
          <h3>Source text, with evidence highlighted</h3>
          <p className="muted small">Quotes that couldn't be matched exactly aren't highlighted; check their flags.</p>
          {result.pages.map((page, i) => {
            const flat = page.replace(/\s+/g, ' ')
            const parts = pattern ? flat.split(pattern) : [flat]
            return (
              <section key={i}>
                {result.pages.length > 1 && <p className="kicker">Page {i + 1}</p>}
                <p>
                  {parts.map((part, j) => (j % 2 === 1 ? <mark key={j}>{part}</mark> : part))}
                </p>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
