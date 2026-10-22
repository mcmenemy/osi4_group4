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
        <p className="kicker">For fun · our earlier framing</p>
        <h2 className="section-title">What can carry a mind?</h2>
        <p className="lede">
          For a patient losing cortex, could anything on the device side take over some of the lost
          function? We score candidate substrates 0–3 under six theories of mind (carry-over, 0–18) and
          on how hard each is to keep running in a patient (maintainability, 0–3). The scores are
          provisional judgment calls, made to be argued with.
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
            {substrate.key === 'gel_neuron' && <BridgeNote />}
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
                  className={[s.key === substrate.key && 'active', s.key === 'custom' && 'custom', s.key === 'gel_neuron' && 'bridge']
                    .filter(Boolean)
                    .join(' ')}
                >
                  <th scope="row">
                    <button type="button" className="cell-btn" onClick={() => select(s.key)}>
                      {s.name}
                    </button>
                    {s.key === 'gel_neuron' && <span className="bridge-tag">our first step</span>}
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

        <aside className="bridge-callout">
          <h3>From this table to the microwell experiment</h3>
          <p>
            Pure neural tissue tops every framework but is the hardest to keep alive; silicon is easy to maintain but
            carries little. The <strong>gel–neuron hybrid</strong> sits between them, and it's the least grounded row:
            our draft found no published system that couples a computing gel bidirectionally to living neurons. Filling Science Corp's microwells with a soft
            gel is the first measurable step toward it, which is why the rest of this app maps soft, conductive, and
            degradable materials and their effects on neurons.
          </p>
          <p className="bridge-links">
            <a href="#/maps">See the materials maps →</a> <a href="#/gaps">Gaps &amp; next steps →</a>
          </p>
        </aside>

        <CustomScore result={custom} onResult={handleCustom} />
      </div>
    </section>
  )
}

function BridgeNote() {
  return (
    <p className="bridge-note">
      This is the row our project starts to measure: a gel-filled microwell is the first step toward a gel–neuron
      hybrid. <a href="#/gaps">Gaps &amp; next steps →</a>
    </p>
  )
}
