import BiohybridArt from './BiohybridArt'
import type { MaterialRecord, References } from './records'

const TAB_LINKS = [
  { href: '#/maps', title: 'Maps', text: 'Stiffness, conductivity and cell outcomes from the literature, with the untested gaps marked.' },
  { href: '#/proposal', title: 'Proposal', text: 'Draft study: neurons in gel-filled vs. bare microwells.' },
  { href: '#/context', title: 'Big picture', text: 'What can carry a mind? Score substrates across theories of mind, including your own.' },
  { href: '#/records', title: 'Records', text: 'Every extracted value with the exact quote and source it came from.' },
  { href: '#/extract', title: 'Extract', text: 'Upload a paper and watch the pipeline pull out source-linked records.' },
  { href: '#/review', title: 'Review', text: 'Accept, reject, or correct records one at a time.' },
]

export default function Overview({ records, references }: { records: MaterialRecord[]; references: References | null }) {
  const sci = references?.science_corp
  const papers = new Set(records.map((r) => r.source.doi ?? r.source.title ?? r.source.file)).size
  return (
    <section className="overview">
      <div className="hero">
        <BiohybridArt />
        <div className="container hero-text">
          <p className="kicker">OSI Hackathon @ NC State · Oct 21–22, 2026</p>
          <h1>Soft wells for living implants</h1>
          <p className="lede">
            Building the evidence base for the next experiment on biohybrid neural interfaces: gel-filled vs. bare
            microwells.
          </p>
        </div>
      </div>

      <div className="container">
        <div className="overview-grid">
          <div className="overview-text">
            <p>
              Science Corporation's cortical biohybrid implant holds ~90,000 neurons in microwells made of SU-8 (a rigid
              epoxy, gigapascal stiffness) coated with poly-D-lysine and laminin. In their preprint, 77% of wells held a cell at loading, and 52% held labeled neurons
              at ~3 weeks; and neurites mostly stayed in superficial cortex, with only sparse axons detected deeper
              (Brown et al., bioRxiv 2024).
            </p>
            <p>
              Soft hydrogels, including conductive PEDOT:PSS gels, are the leading approach for keeping grafted cells
              alive and integrated, but we haven't found a published comparison of neurons in bare microwells vs.
              gel-filled microwells.
            </p>
            <p>
              This app builds the evidence base for that experiment: an LLM pipeline extracts structured, source-linked
              records from papers on conductive hydrogels, OECT/OMIEC materials and neurons on soft substrates, and
              visualizes them as materials maps whose empty regions are untested candidate formulations.
            </p>
            <p>
              Longer term, a gel-filled well is a first step toward a gel–neuron hybrid, one of the two most promising rows in our{' '}
              <a href="#/context">“What can carry a mind?” benchmark</a> of what could sit behind a biohybrid implant.
            </p>
            <p className="muted">
              Built for Science Corporation and the Seifrid lab (NC State MSE: organic mixed ionic-electronic conductors
              and self-driving labs).
            </p>
            {records.length > 0 && (
              <p className="stat-line">
                <strong>{records.length}</strong> records from <strong>{papers}</strong> papers so far
              </p>
            )}
          </div>

          {sci && (
            <aside className="reference-card">
              <p className="kicker">Science Corp reference</p>
              <h2>SU-8 microwells</h2>
              <dl>
                <div>
                  <dt>Occupied microwells</dt>
                  <dd>
                    <span className="big-num">{sci.occupancy_at_loading_percent}%</span> at loading →{' '}
                    <span className="big-num">{sci.occupancy_at_3_weeks_percent}%</span> at ~3 weeks
                  </dd>
                </div>
                <div>
                  <dt>Neurons per implant</dt>
                  <dd>{sci.neurons}</dd>
                </div>
                {sci.cells && (
                  <div>
                    <dt>Cells</dt>
                    <dd>{sci.cells}</dd>
                  </div>
                )}
                <div>
                  <dt>Well material</dt>
                  <dd>{sci.material}</dd>
                </div>
                <div>
                  <dt>Outgrowth</dt>
                  <dd>{sci.outcome}</dd>
                </div>
              </dl>
              <p className="small muted">
                {sci.measure}. {sci.citation}.{' '}
                <a href={sci.url} target="_blank" rel="noreferrer">
                  Preprint
                </a>
              </p>
            </aside>
          )}
        </div>

        <nav className="tab-cards" aria-label="Sections">
          {TAB_LINKS.map((t) => (
            <a key={t.href} href={t.href} className="tab-card">
              <h3>{t.title} →</h3>
              <p>{t.text}</p>
            </a>
          ))}
        </nav>
      </div>
    </section>
  )
}
