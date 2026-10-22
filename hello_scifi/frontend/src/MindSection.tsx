import { useState } from 'react'
import CustomScore from './CustomScore'
import { FRAMEWORKS, SUBSTRATES, carryOver, type FrameworkKey, type Substrate } from './benchmark'

export default function MindSection() {
  const [substrateKey, setSubstrateKey] = useState('gel_neuron')
  const [frameworkKey, setFrameworkKey] = useState<FrameworkKey>('iit')
  const [custom, setCustom] = useState<Substrate | null>(null)

  const all = custom ? [...SUBSTRATES, custom] : SUBSTRATES
  const ranked = [...all].sort((a, b) => carryOver(b.scores) - carryOver(a.scores))
  const substrate = all.find((s) => s.key === substrateKey) ?? SUBSTRATES[0]
  const framework = FRAMEWORKS.find((f) => f.key === frameworkKey)!
  const cellScore = substrate.scores[framework.key]

  function select(sKey: string, fKey?: FrameworkKey) {
    setSubstrateKey(sKey)
    if (fKey) setFrameworkKey(fKey)
  }

  function handleCustom(result: Substrate) {
    setCustom(result)
    setSubstrateKey(result.key)
  }

  return (
    <section id="mind" className="mind">
      <div className="container">
        <p className="kicker">The benchmark</p>
        <h2 className="section-title">What carries a mind?</h2>
        <p className="lede">
          Each candidate device-side substrate is scored 0–3 under six theories of mind.
          Carry-over is the sum (0–18). Maintainability (0–3) is how hard the substrate is to keep
          running inside a patient. All scores are provisional judgment calls, made to be argued
          with.
        </p>

        <div className="explorer">
          <fieldset>
            <legend>Substrate</legend>
            <div className="pills">
              {all.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  className="pill"
                  aria-pressed={s.key === substrate.key}
                  onClick={() => select(s.key)}
                >
                  {s.key === 'custom' ? `Yours: ${s.name}` : s.name}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Framework</legend>
            <div className="pills">
              {FRAMEWORKS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className="pill"
                  aria-pressed={f.key === framework.key}
                  onClick={() => setFrameworkKey(f.key)}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="explainer" aria-live="polite">
            <div>
              <h3>{substrate.name}</h3>
              <p>{substrate.summary}</p>
            </div>
            <div>
              <h3>{framework.name}</h3>
              <p>{framework.summary}</p>
            </div>
            <div className="verdict">
              <span className={`score big s${cellScore}`}>
                {cellScore}
                {framework.key === 'functionalism' && substrate.conditional ? '*' : ''}
              </span>
              <p>
                <strong>
                  {substrate.name} under {framework.name}:
                </strong>{' '}
                {substrate.reasons[framework.key]}
              </p>
            </div>
          </div>
        </div>

        <div className="table-scroll">
          <table className="benchmark">
            <caption>Substrate scores, ranked by carry-over. Select a cell to explain it.</caption>
            <thead>
              <tr>
                <th scope="col">Device-side substrate</th>
                {FRAMEWORKS.map((f) => (
                  <th
                    key={f.key}
                    scope="col"
                    className={f.key === framework.key ? 'num active' : 'num'}
                  >
                    {f.name}
                  </th>
                ))}
                <th scope="col" className="num total">
                  Carry-over
                </th>
                <th scope="col" className="num total">
                  Maintain.
                </th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((s) => (
                <tr
                  key={s.key}
                  className={[s.key === substrate.key && 'active', s.key === 'custom' && 'custom']
                    .filter(Boolean)
                    .join(' ')}
                >
                  <th scope="row">
                    <button type="button" className="cell-btn" onClick={() => select(s.key)}>
                      {s.name}
                    </button>
                  </th>
                  {FRAMEWORKS.map((f) => (
                    <td
                      key={f.key}
                      className={f.key === framework.key ? 'num active' : 'num'}
                    >
                      <button
                        type="button"
                        className={`cell-btn score s${s.scores[f.key]}`}
                        aria-label={`${s.name}, ${f.name}: ${s.scores[f.key]} of 3`}
                        onClick={() => select(s.key, f.key)}
                      >
                        {s.scores[f.key]}
                        {f.key === 'functionalism' && s.conditional ? '*' : ''}
                      </button>
                    </td>
                  ))}
                  <td className="num total">{carryOver(s.scores)}</td>
                  <td className="num total">{s.maintainability}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="footnote">
          * Functionalism scores any substrate 3 <em>conditional on</em> functional equivalence
          being achieved, which is unproven for every row. That asterisk is the whole upload debate
          in one character.
        </p>

        <CustomScore result={custom} onResult={handleCustom} />
      </div>
    </section>
  )
}
