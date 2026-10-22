import BiohybridArt from './BiohybridArt'
import { FRAMEWORKS } from './benchmark'

const MILESTONES = [
  { label: '2024 · mice use a graft' },
  { label: '2025 · NEJM trial' },
  { label: '2026 · FDA designation' },
  { label: 'RTP · $65M device fab', highlight: true },
]

export default function Overview() {
  return (
    <section id="overview" className="overview">
      <div className="hero">
        <BiohybridArt />
        <div className="container hero-text">
          <p className="kicker">OSI Hackathon @ NC State · Oct 21–22, 2026</p>
          <h1>What can carry a mind?</h1>
          <p className="lede">
            A benchmark for deciding what should sit on the other side of a brain implant made of
            living neurons.
          </p>
        </div>
      </div>

      <div className="container">
        <ol className="steps">
          <li>
            <h2>Biohybrid neural interfaces are reaching the clinic.</h2>
            <p>
              Implants that connect to the brain through living neurons instead of wires already
              work in mice. <a href="https://science.xyz">Science Corporation</a>'s cortical
              implant holds about 90,000 engineered neurons that grow into the host cortex. The same
              company's PRIMA retinal implant is in patients, and its fab is 20 minutes from
              campus.
            </p>
            <ul className="chips">
              {MILESTONES.map((m) => (
                <li key={m.label} className={m.highlight ? 'chip highlight' : 'chip'}>
                  {m.label}
                </li>
              ))}
            </ul>
          </li>
          <li>
            <h2>How much of a patient's brain function could the device take on?</h2>
            <p>
              For someone losing cortex to neurodegeneration, the question isn't whether the device
              can read and write. It's whether anything on the device side could do cognition{' '}
              <em>with</em> the brain as tissue is lost. Nobody knows.
            </p>
          </li>
          <li>
            <h2>Theories of mind disagree about what a substrate needs.</h2>
            <p>
              Six peer-reviewed frameworks each define what a physical system must do to carry
              cognition or experience. No single one is settled. Together, they make a rubric.
            </p>
            <ul className="chips">
              {FRAMEWORKS.map((f) => (
                <li key={f.key} className="chip">
                  {f.name}
                </li>
              ))}
            </ul>
          </li>
        </ol>

        <a className="next-link" href="#mind">
          So what carries a mind? See the scores ↓
        </a>
      </div>
    </section>
  )
}
