import { useEffect, useState } from 'react'
import type { MaterialRecord } from './records'
import ModeToggle from './ModeToggle'
import { useModeText } from './mode'
import { PLAIN_LABELS, PLAIN_STATES, SHORT_LABELS, type ScoreRow, type Scorecard, type State } from './scorecard'

const STATE_NAMES: Record<State, string> = { met: 'met', partial: 'partial', unknown: 'unknown', fails: 'fails' }

// Our own schematics of the device and findings in Brown et al., bioRxiv 2024
// (doi:10.1101/2024.11.22.624907); not reproductions of their figures. If an image fails to load,
// a labeled placeholder shows instead.
const FIGURES: {
  src: string
  alt: string
  title: string
  caption: string
  plainCaption: string
  credit: string
}[] = [
  {
    src: '/figures/microwell_schematic.png',
    alt: 'Schematic of an SU-8 microwell array: top view with most wells holding one neuron and some empty, and a side view of wells about 10 µm wide and 15 µm deep',
    title: 'One neuron per well',
    caption:
      'Schematic of a loaded SU-8 microwell array (not to scale; occupancy illustrative). Top view: wells (green) and loaded neurons (gray); some wells stay empty. Side view: wells about 10 µm wide and 15 µm deep, coated with PDL + laminin, with no hydrogel. One embryonic cortical neuron nearly fills a well, so there is little room for anything else inside it.',
    plainCaption:
      'The chip is a grid of tiny wells (green), each about 10 micrometers across, roughly a tenth the width of a human hair. Each well holds one neuron (gray), and some end up empty. One neuron nearly fills its well.',
    credit: 'Original schematic based on the device described in Brown et al., bioRxiv 2024',
  },
  {
    src: '/figures/graft_schematic.png',
    alt: 'Schematic cross-section of cortex under the implant: grafted neurites are dense near the surface and only a few thin axons reach deeper',
    title: 'Where grafted neurites go',
    caption:
      'Conceptual cross-section of the cortex under an implant (not to scale). The SU-8 wells open toward the brain. Dense neurites stay near the surface; only a few thin axons reach deeper. Gray: grafted neurons in wells. Orange: their neurites. Blue dots: host cell nuclei.',
    plainCaption:
      'With the chip on the brain, the wells face down into it. The implanted neurons (gray) grow fibers (orange) into the brain: most stay near the surface, and a few reach deeper. Blue dots are the brain’s own cells.',
    credit: 'Original conceptual schematic based on findings in Brown et al., bioRxiv 2024; not a reproduction of any figure',
  },
]

const PREVIEW_ROWS = 5
const STATE_ICON: Record<State, string> = { met: '✓', partial: '◐', unknown: '?', fails: '✕' }

export default function Overview({ records }: { records: MaterialRecord[] }) {
  const t = useModeText()
  const brown = records.find((r) => r.source.file === 'brown2024.pdf')
  const brownLink = brown ? `#/records?id=${encodeURIComponent(brown.record_id)}` : '#/records'

  return (
    <section className="overview container tab">
      <div className="overview-top">
        <p className="kicker">OSI Hackathon @ NC State · Oct 21–22, 2026</p>
        <ModeToggle />
      </div>
      <h1 className="section-title">Better wells for living implants</h1>

      <div className="overview-layout">
        {t(
          <div className="overview-text">
            <h2>The idea</h2>
            <p>
              Science Corporation, a brain-computer interface company, is testing a new kind of brain implant: a chip
              smaller than a fingernail covered in about 118,000 microscopic wells, each holding a single living neuron.
              Once the chip sits on the brain, those neurons grow connections into it, and they can be switched on with
              light. The chip itself has no electrodes.
            </p>

            <h2>Why it matters</h2>
            <p>
              Connecting new neurons to the brain, instead of pushing metal electrodes into it, could one day help treat
              brain disease and power brain-computer interfaces. The approach has shown promising early results in mice.
              It still has to be tested in people, which will also need a source of human-compatible neurons; the mouse
              cells used so far won't work for patients.
            </p>
            <p>
              Science Corp has taken a device into people before: its PRIMA retinal implant let most patients in a
              38-person trial read letters and words again (<em>New England Journal of Medicine</em>, 2025).
            </p>

            <h2>The catch</h2>
            <p>
              Not every well keeps its neuron. <a href={brownLink}>About 3 in 4 wells held a cell</a> when the chip was
              loaded. <a href={brownLink}>Three weeks after implantation in mice, about half did</a>: roughly a third
              fewer.
            </p>

            <h2>What we built</h2>
            <p>
              Soft, gel-like materials often help transplanted cells survive, but we found no published test of them in wells like these. We
              used AI to read research papers on such materials and pull out the numbers that matter: how soft they are,
              how long they last in the body, and how well neurons do on them. Every number links to the sentence it came
              from. Then we score each material on whether it could make the wells a better home for neurons.
            </p>
          </div>,
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
              substrates from papers into a source-linked dataset, every value with its quote, to find materials that
              could improve how many wells keep healthy neurons.
            </p>
          </div>,
        )}

        <div className="overview-figures">
          {FIGURES.map((f) => (
            <Figure key={f.src} figure={f} />
          ))}
        </div>
      </div>

      <ScorecardPreview />

      <p className="next-pointer">
        {t("What we still don't know, and what we'd test next:", "What's missing and what we'd test next:")}{' '}
        <a href="#/gaps">Gaps &amp; next steps →</a>
      </p>

      <p className="footnote">
        {t(
          'Where this started: a just-for-fun ranking of what could carry a mind; see ',
          'Earlier framing: a benchmark scoring substrates against theories of mind; see ',
        )}
        <a href="#/fun">For fun</a>.
      </p>
    </section>
  )
}

function Figure({ figure: f }: { figure: (typeof FIGURES)[number] }) {
  const t = useModeText()
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
        <strong>{f.title}.</strong> {t(f.plainCaption, f.caption)} <span className="figure-credit">{f.credit}.</span>
      </figcaption>
    </figure>
  )
}

function ScorecardPreview() {
  const t = useModeText()
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
  const heads = reqs.map((k) => t(PLAIN_LABELS, SHORT_LABELS)[k])

  return (
    <aside className="scorecard-preview">
      <div className="preview-head">
        <h2>{t('Which materials look promising so far', 'Candidate well fills, so far')}</h2>
        <a href="#/maps">{t('See all materials →', 'Full scorecard on Maps →')}</a>
      </div>
      <p className="muted small">
        {t(
          `${card.summary.ranked_materials} materials have been tested with neurons, across ${card.summary.neuron_records} results. ✓ means yes, ✕ no, ◐ partly, and ? means nobody has measured it yet (${card.summary.unknown_cells} boxes so far). Best-studied first.`,
          `${card.summary.ranked_materials} materials with neuron evidence from ${card.summary.neuron_records} neuron records; ${card.summary.unknown_cells} requirement cells still unknown. Sorted by amount of evidence.`,
        )}
      </p>
      <div className="table-scroll">
        <table className="preview-table">
          <thead>
            <tr>
              <th>Material</th>
              {heads.map((h) => (
                <th key={h} className="state-col">{h}</th>
              ))}
              <th>{t('Best neuron result', 'Best survival')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.material_key}>
                <th scope="row">{r.label}</th>
                {reqs.map((k) => (
                  <td key={k} className="state-col">
                    <span className={`state ${r.requirements[k].state}`} role="img" aria-label={t(PLAIN_STATES, STATE_NAMES)[r.requirements[k].state]}>
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
