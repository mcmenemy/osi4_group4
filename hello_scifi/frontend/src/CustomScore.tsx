import { useState, type FormEvent } from 'react'
import { FRAMEWORKS, carryOver, type FrameworkKey, type Substrate } from './benchmark'

const MAX_CHARS = 1500

interface Criterion {
  score: number
  reason: string
}

interface ScoreResponse {
  name: string
  summary: string
  scores: Record<FrameworkKey, Criterion>
  carry_over: number
  maintainability: Criterion
}

interface Props {
  result: Substrate | null
  onResult: (substrate: Substrate) => void
}

function toSubstrate(data: ScoreResponse): Substrate {
  const scores = {} as Record<FrameworkKey, number>
  const reasons = {} as Record<FrameworkKey, string>
  for (const f of FRAMEWORKS) {
    scores[f.key] = data.scores[f.key].score
    reasons[f.key] = data.scores[f.key].reason
  }
  return {
    key: 'custom',
    name: data.name,
    summary: data.summary,
    scores,
    reasons,
    maintainability: data.maintainability.score,
    maintainabilityReason: data.maintainability.reason,
  }
}

export default function CustomScore({ result, onResult }: Props) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: text }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(typeof data.detail === 'string' ? data.detail : 'Request failed.')
      }
      onResult(toSubstrate(data))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div id="score" className="custom-score">
      <h3>Score your own substrate</h3>
      <p className="muted">
        Describe a material, device, or architecture in a paragraph. Claude scores it with the same
        rubric, and it joins the table above. Say how it's wired: connectivity matters more than
        what it's made of.
      </p>
      <form onSubmit={handleSubmit}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="A layer of engineered cortical neurons grown on a soft, perfusable hydrogel scaffold, with reciprocal connections to the host and to an OECT array underneath."
          maxLength={MAX_CHARS}
          rows={4}
        />
        <div className="row">
          <span className="count">
            {text.length} / {MAX_CHARS}
          </span>
          <button type="submit" disabled={loading || !text.trim()}>
            {loading ? 'Scoring…' : 'Score it'}
          </button>
        </div>
      </form>

      {error && <p className="error">{error}</p>}

      {result && (
        <article className="score-result" aria-live="polite">
          <header>
            <h4>{result.name}</h4>
            <p className="totals">
              <span>
                Carry-over <strong>{carryOver(result.scores)}</strong>
                /18
              </span>
              <span>
                Maintainability <strong>{result.maintainability}</strong>/3
              </span>
            </p>
          </header>
          <p>{result.summary}</p>
          <dl className="reasons">
            {FRAMEWORKS.map((f) => (
              <div key={f.key}>
                <dt>
                  {f.name} <span className={`score s${result.scores[f.key]}`}>{result.scores[f.key]}</span>
                </dt>
                <dd>{result.reasons[f.key]}</dd>
              </div>
            ))}
            {result.maintainabilityReason && (
              <div>
                <dt>
                  Maintainability <span className={`score s${result.maintainability}`}>{result.maintainability}</span>
                </dt>
                <dd>{result.maintainabilityReason}</dd>
              </div>
            )}
          </dl>
        </article>
      )}
    </div>
  )
}
