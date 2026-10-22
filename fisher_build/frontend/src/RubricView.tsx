import { useEffect, useState } from 'react'
import { api, type Rubric, type RubricFramework } from './types'

function FrameworkRubric({ framework }: { framework: RubricFramework }) {
  return (
    <article className="rubric-fw">
      <h3>{framework.name}</h3>
      <p>{framework.claim}</p>
      <ul>
        {framework.criteria.map((c) => (
          <li key={c.id}>
            <strong>{c.name}</strong>
            {c.core && <span className="core">core</span>} {c.question}
          </li>
        ))}
      </ul>
      <p className="meta">Reference: {framework.reference}</p>
    </article>
  )
}

export default function RubricView() {
  const [rubric, setRubric] = useState<Rubric | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api<Rubric>('/api/rubric')
      .then(setRubric)
      .catch((err: Error) => setError(err.message))
  }, [])

  if (error) return <p className="error">{error}</p>
  if (!rubric) return <p className="hint">Loading the rubric…</p>

  return (
    <section className="rubric">
      <h2>How scoring works</h2>
      <ol className="steps">
        <li>
          Claude reads the substrate description and, for every criterion below, gives a verdict
          (met, partly met, unclear or not met) with a short reason. It judges each theory on its
          own terms, not whether the theory is right.
        </li>
        <li>
          Our code, not Claude, turns the verdicts into a 0–3 score per framework: met = 1 point,
          partly or unclear = ½, not met = 0. The share of points earned is scaled to 0–3 and
          rounded.
        </li>
        <li>
          Core criteria are ones the theory treats as necessary. If a core criterion is not met,
          the framework scores 0. If it is only partly met or unclear, the score is capped at 2.
        </li>
        <li>
          Combined support is the mean of the six framework scores. Maintainability is scored the
          same way but kept separate, because it isn't a theory of mind.
        </li>
      </ol>
      <p className="hint">
        This is a structured way to compare and debate architectures, not a predictor of
        consciousness. Rubric version: {rubric.version}.
      </p>
      {rubric.frameworks.map((f) => (
        <FrameworkRubric key={f.id} framework={f} />
      ))}
      <FrameworkRubric framework={rubric.maintainability} />
    </section>
  )
}
