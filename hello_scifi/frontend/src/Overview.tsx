import { useEffect, useState } from 'react'
import type { MaterialRecord } from './records'
import type { ScoreRow, Scorecard, State } from './scorecard'

// Our own schematics of the device and findings in Brown et al., bioRxiv 2024
// (doi:10.1101/2024.11.22.624907); not reproductions of their figures. If an image fails to load,
// a labeled placeholder shows instead.
const FIGURES: { src: string; alt: string; caption: string; credit: string }[] = [
  {
    src: '/figures/microwell_schematic.png',
    alt: 'Schematic of an SU-8 microwell array: top view with most wells holding one neuron and some empty, and a side view of wells about 10 µm wide and 15 µm deep',
    caption:
      'One neuron per well: top view and cross-section of a loaded SU-8 microwell array (not to scale; occupancy illustrative).',
    credit: 'Original schematic based on Brown et al., bioRxiv 2024',
  },
  {
    src: '/figures/graft_schematic.png',
    alt: 'Schematic cross-section of cortex under the implant: grafted neurites are dense near the surface and only a few thin axons reach deeper',
    caption:
      'Where grafted neurites go: most processes stay in superficial cortex, with sparse axons deeper (conceptual, not to scale).',
    credit: 'Original schematic based on findings in Brown et al., bioRxiv 2024',
  },
]

const PREVIEW_ROWS = 5
const STATE_ICON: Record<State, string> = { met: '✓', partial: '◐', unknown: '?', fails: '✕' }

export default function Overview({ records }: { records: MaterialRecord[] }) {
  const brown = records.find((r) => r.source.file === 'brown2024.pdf')
  const brownLink = brown ? `#/records?id=${encodeURIComponent(brown.record_id)}` : '#/records'

  return (
    <section className="overview container tab">
      <p className="kicker">OSI Hackathon @ NC State · Oct 21–22, 2026</p>
      <h1 className="section-title">Better wells for living implants</h1>

      <div className="overview-layout">
        <div className="overview-text">
          <h2>The device</h2>
          <p>
            Science Corporation's cortical biohybrid implant is an SU-8 microwell array: 10 µm wells, 15 µm deep, on a
            15 µm pitch, about 118,000 wells per 5×5 mm die. Each well is loaded by centrifugation with one embryonic
            mouse cortical neuron, and the graft is driven optogenetically with an external light source; there are no
            electrodes on the chip. Each neuron nearly fills its well.
          </p>

          <h2>Why it matters</h2>
          <p>
            Neurons that grow from a device into the brain could be a platform for treating neurodegeneration and for
            brain-computer interfaces. The authors note that embryonic mouse cells are not a translational option, so a
            human-compatible cell source (for example, stem-cell-derived neurons) is a prerequisite this app does not
            address.
          </p>

          <h2>The two numbers</h2>
          <p>
            <a href={brownLink}>77% of wells held cells at loading</a> (DAPI, 24 h, in vitro, n=23);{' '}
            <a href={brownLink}>about 52% of wells showed fluorescent neurons roughly three weeks later</a> (n=13).
            These are well occupancy counts, not viability (Brown et al., bioRxiv 2024).
          </p>

          <h2>What this app does</h2>
          <p>
            It extracts materials data on soft and conductive hydrogels, OECT/OMIEC materials, and neurons on soft
            substrates from papers into a source-linked dataset, every value with its quote, to find materials that could
            improve how many wells keep healthy neurons.
          </p>
        </div>

        <div className="overview-figures">
          {FIGURES.map((f) => (
            <Figure key={f.src} figure={f} />
          ))}
        </div>
      </div>

      <ScorecardPreview />

      <p className="next-pointer">
        What's missing and what we'd test next: <a href="#/gaps">Gaps &amp; next steps →</a>
      </p>

      <p className="footnote">
        Earlier framing: a benchmark scoring substrates against theories of mind; see{' '}
        <a href="#/fun">For fun</a>.
      </p>
    </section>
  )
}

function Figure({ figure: f }: { figure: (typeof FIGURES)[number] }) {
  const [failed, setFailed] = useState(false)
  return (
    <figure className="figure">
      {failed ? (
        <div className="figure-placeholder" role="img" aria-label={`${f.alt} (image unavailable)`}>
          Image unavailable
        </div>
      ) : (
        <img src={f.src} alt={f.alt} loading="lazy" onError={() => setFailed(true)} />
      )}
      <figcaption>
        {f.caption} <span className="figure-credit">{f.credit}.</span>
      </figcaption>
    </figure>
  )
}

function ScorecardPreview() {
  const [card, setCard] = useState<Scorecard | null>(null)
  useEffect(() => {
    fetch('/api/scorecard')
      .then((r) => (r.ok ? r.json() : null))
      .then(setCard)
      .catch(() => setCard(null))
  }, [])
  if (!card) return null

  // Same default as the Maps tab: most neuron evidence first, not a headline ranking.
  const rows: ScoreRow[] = [...card.ranked]
    .sort((a, b) => b.neuron_record_count - a.neuron_record_count || b.record_count - a.record_count)
    .slice(0, PREVIEW_ROWS)
  const reqs = ['survival', 'soft', 'in_vivo_brain', 'clear_degradable'] as const
  const heads = ['Survival ≥3 wk', '≤100 kPa', 'In vivo brain', 'Clear & degradable']

  return (
    <aside className="scorecard-preview">
      <div className="preview-head">
        <h2>Candidate well fills, so far</h2>
        <a href="#/maps">Full scorecard on Maps →</a>
      </div>
      <p className="muted small">
        {card.summary.ranked_materials} materials with neuron evidence from {card.summary.neuron_records} neuron records;{' '}
        {card.summary.unknown_cells} requirement cells still unknown. Sorted by amount of evidence.
      </p>
      <div className="table-scroll">
        <table className="preview-table">
          <thead>
            <tr>
              <th>Material</th>
              {heads.map((h) => (
                <th key={h} className="state-col">{h}</th>
              ))}
              <th>Best survival</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.material_key}>
                <th scope="row">{r.label}</th>
                {reqs.map((k) => (
                  <td key={k} className="state-col">
                    <span className={`state ${r.requirements[k].state}`} role="img" aria-label={r.requirements[k].state}>
                      {STATE_ICON[r.requirements[k].state]}
                    </span>
                  </td>
                ))}
                <td className="small">{r.best_survival?.label ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </aside>
  )
}
