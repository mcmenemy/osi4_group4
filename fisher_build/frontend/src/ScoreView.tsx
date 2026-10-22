import { useEffect, useState, type FormEvent } from 'react'
import { loadPresets } from './data'
import type { DemoStep } from './demoSteps'
import { api, type FrameworkResult, type Preset, type ScoreResult, type Verdict } from './types'

const MAX_CHARS = 2000
const MIN_CHARS = 20
const PRESET_RUNS = 3

const VERDICT_LABEL: Record<Verdict, string> = {
  met: 'Met',
  partial: 'Partly',
  unclear: 'Unclear',
  not_met: 'Not met',
}

export function ScoreBadge({ score, max = 3 }: { score: number; max?: number }) {
  return (
    <span className={`badge s${score}`} title={`${score} out of ${max}`}>
      <span className="pips" aria-hidden="true">
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className={i < score ? 'pip on' : 'pip'} />
        ))}
      </span>
      {score}/{max}
    </span>
  )
}

function totalVotes(votes: Partial<Record<Verdict, number>>): number {
  return Object.values(votes).reduce((sum, n) => sum + (n ?? 0), 0)
}

function votesText(votes: Partial<Record<Verdict, number>>): string {
  return Object.entries(votes)
    .map(([verdict, n]) => `${VERDICT_LABEL[verdict as Verdict]}: ${n}`)
    .join(', ')
}

function FrameworkCard({ framework, note }: { framework: FrameworkResult; note?: string }) {
  return (
    <details className="framework" id={`fw-${framework.id}`}>
      <summary>
        <span className="fw-name">{framework.name}</span>
        <ScoreBadge score={framework.score} />
        <span className="fw-summary">{framework.summary}</span>
      </summary>
      {note && <p className="note">{note}</p>}
      <ul className="criteria">
        {framework.criteria.map((c) => (
          <li key={c.id}>
            <span className={`verdict v-${c.verdict}`}>{VERDICT_LABEL[c.verdict]}</span>
            <div>
              <strong>{c.name}</strong>
              {c.core && <span className="core" title="The theory treats this as necessary">core</span>}
              {c.agreement < 1 && (
                <span className="split" title={`Runs disagreed. ${votesText(c.votes)}`}>
                  {c.votes[c.verdict] ?? 0} of {totalVotes(c.votes)} runs
                </span>
              )}
              <p>{c.reasoning}</p>
            </div>
          </li>
        ))}
      </ul>
    </details>
  )
}

function ResultView({ title, result }: { title: string; result: ScoreResult }) {
  if (!result.is_substrate) {
    return (
      <section className="result">
        <h2>{title}</h2>
        <p className="error">That doesn't look like a substrate description. {result.interpretation}</p>
      </section>
    )
  }
  return (
    <section className="result" id="score-result" aria-live="polite">
      <h2>{title}</h2>
      <p className="interpretation">{result.interpretation}</p>

      <dl className="totals">
        <div>
          <dt>Combined support</dt>
          <dd>
            <span className="big">{result.combined_support.toFixed(2)}</span> / 3
            <span className="meter" aria-hidden="true">
              <span style={{ width: `${(result.combined_support / 3) * 100}%` }} />
            </span>
          </dd>
          <dd className="hint">Mean of the six framework scores</dd>
        </div>
        <div>
          <dt>Frameworks scoring 2 or more</dt>
          <dd>
            <span className="big">{result.frameworks_supporting}</span> of {result.frameworks.length}
          </dd>
        </div>
        <div>
          <dt>Maintainability</dt>
          <dd>
            <ScoreBadge score={result.maintainability.score} />
          </dd>
          <dd className="hint">Higher = easier to keep running</dd>
        </div>
      </dl>

      <h3>Framework scores</h3>
      <p className="hint">Click a framework to see each criterion and Claude's reasoning.</p>
      {result.frameworks.map((f) => (
        <FrameworkCard key={f.id} framework={f} />
      ))}
      <h3>Maintainability</h3>
      <FrameworkCard
        framework={result.maintainability}
        note="Not a theory of mind: how practical the substrate is to keep working in a patient."
      />
      <p className="meta">
        {result.runs > 1
          ? `Judged ${result.runs} times independently by ${result.model}. All runs agreed on ${result.unanimous} of ${result.criteria_total} criteria; where they split, the majority verdict is used and marked.`
          : `Judged once by ${result.model} (presets are judged ${PRESET_RUNS} times and use the majority).`}
        {result.scored_at && ` Scored ${result.scored_at.slice(0, 10)}`}
        {result.rubric_version && `, rubric ${result.rubric_version}`}. Scores come from the
        verdicts by a fixed formula (see How scoring works).
      </p>
    </section>
  )
}

function CompareTable({
  presets,
  selected,
  onSelect,
}: {
  presets: Preset[]
  selected: string
  onSelect: (id: string) => void
}) {
  const scored = presets.filter((p) => p.result)
  if (scored.length === 0) return null
  const columns = scored[0].result!.frameworks.map((f) => ({ id: f.id, name: f.name }))
  return (
    <section className="compare" id="compare">
      <h2>All presets at a glance</h2>
      <p className="hint">Click a row to open it above.</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Substrate</th>
              {columns.map((c) => (
                <th key={c.id}>{c.name}</th>
              ))}
              <th>Support</th>
              <th>Maintainability</th>
              <th title="Criteria on which all independent Claude runs gave the same verdict">Runs agree</th>
            </tr>
          </thead>
          <tbody>
            {scored.map((p) => (
              <tr
                key={p.id}
                className={p.id === selected ? 'selected' : undefined}
                onClick={() => onSelect(p.id)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelect(p.id)
                  }
                }}
              >
                <th scope="row">{p.name}</th>
                {p.result!.frameworks.map((f) => (
                  <td key={f.id} className={`cell s${f.score}`}>
                    {f.score}
                  </td>
                ))}
                <td className="num">{p.result!.combined_support.toFixed(2)}</td>
                <td className={`cell s${p.result!.maintainability.score}`}>
                  {p.result!.maintainability.score}
                </td>
                <td className="num">
                  {p.result!.unanimous}/{p.result!.criteria_total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default function ScoreView() {
  const [presets, setPresets] = useState<Preset[]>([])
  const [presetsError, setPresetsError] = useState('')
  const [mode, setMode] = useState<'preset' | 'custom'>('preset')
  const [selected, setSelected] = useState('')
  const [text, setText] = useState('')
  const [custom, setCustom] = useState<ScoreResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadPresets()
      .then((data) => {
        setPresets(data)
        if (data.length) setSelected((current) => current || data[0].id)
      })
      .catch((err: Error) => setPresetsError(err.message))
  }, [])

  // The guided demo (App.tsx) tells this view which preset or form to show.
  useEffect(() => {
    function onDemo(event: Event) {
      const step = (event as CustomEvent<DemoStep>).detail
      if (step.tab !== 'score') return
      if (step.customMode) setMode('custom')
      else setMode('preset')
      if (step.preset) setSelected(step.preset)
    }
    window.addEventListener('demo-step', onDemo)
    return () => window.removeEventListener('demo-step', onDemo)
  }, [])

  async function handleScore(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setCustom(null)
    try {
      setCustom(await api<ScoreResult>('/api/score', { text }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  function selectPreset(id: string) {
    setMode('preset')
    setSelected(id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const preset = presets.find((p) => p.id === selected)
  const trimmed = text.trim()

  return (
    <>
      <div className="mode" role="radiogroup" aria-label="Substrate source">
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'preset'}
          className={mode === 'preset' ? 'active' : ''}
          onClick={() => setMode('preset')}
        >
          Pick a preset
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'custom'}
          className={mode === 'custom' ? 'active' : ''}
          onClick={() => setMode('custom')}
        >
          Describe your own
        </button>
      </div>

      {mode === 'preset' && (
        <>
          {presetsError && <p className="error">{presetsError}</p>}
          <label className="field">
            Substrate
            <select value={selected} onChange={(e) => setSelected(e.target.value)}>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {preset && (
            <>
              <details className="description">
                <summary>Description Claude scored</summary>
                <p>{preset.description}</p>
              </details>
              {preset.result ? (
                <ResultView title={preset.name} result={preset.result} />
              ) : (
                <p className="error">
                  This preset hasn't been scored for the current rubric yet. Run
                  scripts/score_presets.py.
                </p>
              )}
            </>
          )}
        </>
      )}

      {mode === 'custom' && (
        <>
          <form id="custom-form" onSubmit={handleScore}>
            <label className="field">
              Describe a substrate: what it's made of, how its parts interact, how it connects
              to the brain, and what it needs to keep running.
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="A mesh of carbon-nanotube electrodes seeded with living neurons, wired so the neurons talk to each other and to the patient's cortex…"
                maxLength={MAX_CHARS}
                rows={6}
              />
            </label>
            <div className="row">
              <span className="count">
                {text.length} / {MAX_CHARS}
              </span>
              <button type="submit" disabled={loading || trimmed.length < MIN_CHARS}>
                {loading ? 'Scoring…' : 'Score it'}
              </button>
            </div>
          </form>
          {loading && (
            <p className="hint">Claude is judging 25 criteria. This usually takes 20–40 seconds.</p>
          )}
          {error && <p className="error">{error}</p>}
          {custom && <ResultView title="Your substrate" result={custom} />}
        </>
      )}

      <CompareTable presets={presets} selected={mode === 'preset' ? selected : ''} onSelect={selectPreset} />
    </>
  )
}
