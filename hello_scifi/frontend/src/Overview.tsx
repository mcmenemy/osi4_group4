import BiohybridArt from './BiohybridArt'
import type { MaterialRecord, References } from './records'

const TAB_LINKS = [
  { href: '#/maps', title: 'Maps', text: 'Stiffness, conductivity and cell outcomes from the literature, with the untested gaps marked.' },
  { href: '#/records', title: 'Records', text: 'Every extracted value with the exact quote and source it came from.' },
  { href: '#/extract', title: 'Extract', text: 'Upload a paper and watch the pipeline pull out source-linked records.' },
  { href: '#/review', title: 'Review', text: 'Accept, reject, or correct records one at a time.' },
  { href: '#/proposal', title: 'Proposal', text: 'Draft study: neurons in gel-filled vs. bare microwells.' },
  { href: '#/context', title: 'Context', text: 'Why the device side matters: a benchmark across theories of mind.' },
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
              epoxy, gigapascal stiffness) coated with poly-D-lysine and laminin. In their preprint, wells with labeled
              neurons dropped from 77% at loading to 52% at ~3 weeks, and neurites mostly stayed in superficial cortex
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
                  <dt>Wells with labeled neurons</dt>
                  <dd>
                    <span className="big-num">{sci.occupancy_at_loading_percent}%</span> at loading →{' '}
                    <span className="big-num">{sci.occupancy_at_3_weeks_percent}%</span> at ~3 weeks
                  </dd>
                </div>
                <div>
                  <dt>Neurons per implant</dt>
                  <dd>{sci.neurons}</dd>
                </div>
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
