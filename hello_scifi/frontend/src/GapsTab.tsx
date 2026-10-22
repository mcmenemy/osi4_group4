import { useEffect, useState } from 'react'
import { DATA_DESTINATION } from './dataDestination'
import { useMode, useModeText, type Mode } from './mode'
import type { RequirementKey, ScoreRow, Scorecard } from './scorecard'

const EXPERIMENTS: Record<Mode, { title: string; detail: string }[]> = {
  hardcore: [
    {
      title: 'A thin degradable coating on SU-8 vs. the PDL/laminin baseline',
      detail: 'Same wells, same cells; measures well occupancy and live/dead at days 1, 7 and 21 with and without the coating.',
    },
    {
      title: 'A degradable cap layer over the wells, dissolving in ~1 vs. ~3 weeks',
      detail: 'Holds cells in place through the first days after implantation; measures occupancy and whether neurites still leave the wells.',
    },
    {
      title: 'Gel fills first in a larger-well model (20–40 µm wells)',
      detail: 'A 10 µm well is nearly filled by one soma, so gel fills are easier to test in bigger wells; measures survival and outgrowth vs. gel stiffness.',
    },
  ],
  normal: [
    {
      title: 'Coat the wells with a thin layer that dissolves',
      detail: "Same wells and same neurons, with and without the coating. Count how many wells still hold healthy neurons after 1 day, 1 week and 3 weeks.",
    },
    {
      title: 'Cover the wells with a dissolving lid',
      detail: 'It would hold the neurons in place for the first days after implantation, then go away. Compare a lid that lasts about 1 week with one that lasts about 3, and check that neurons still grow out into the brain.',
    },
    {
      title: 'Test gel fills in bigger wells first',
      detail: "One neuron nearly fills today's 10-micrometer wells, leaving no room for gel. Wells 2–4 times wider would show whether softer or stiffer gels help neurons survive and grow.",
    },
  ],
}

// Design directions proposed by the team (opinion, not data). Keep both modes in sync.
const DIRECTIONS: Record<Mode, { title: string; detail: string }[]> = {
  hardcore: [
    {
      title: 'A gel layer at the bottom of the well',
      detail:
        "A gel at the base of the well could help neurons grow out into the brain itself. It may improve survival by giving the neuron an immediately more brain-like surface to grow on, but it could also slow outgrowth if it acts as an extra barrier between the well and the tissue.",
    },
    {
      title: 'Larger wells with a hydrogel around each neuron',
      detail:
        "A larger well leaves room for a hydrogel around the neuron, so the whole cell is in direct contact with a more brain-like substrate than the rigid scaffold used now. This may improve survival, although the stiff scaffold would likely keep the gel from behaving as it would in an all-gel structure.",
    },
    {
      title: 'Gel channels connecting neighbouring wells',
      detail:
        "The current system is feed-forward: each added neuron sends its signal directly into the brain without interacting with the others. In future biohybrid implants, wells could be linked through gels, letting individual neurons connect to each other. That may not be desirable for a proof of concept of connectivity like the one in Brown et al., but a more complex architecture could let future implants carry more meaningful neural representations.",
    },
  ],
  normal: [
    {
      title: 'Put a soft gel at the bottom of each well',
      detail:
        "The gel could help neurons grow down and out into the brain. It might help them survive by giving them something that feels more like brain tissue straight away, but it could also get in the way if the neurons have to push through it to reach the brain.",
    },
    {
      title: 'Make the wells bigger and surround each neuron with gel',
      detail:
        "With more room, the whole neuron could sit in soft gel instead of touching the hard walls of the implant. That might help it survive, though the hard walls around the gel would probably stop the gel from acting quite like it would on its own.",
    },
    {
      title: 'Link the wells together with gel',
      detail:
        "Right now each added neuron talks only to the brain, not to its neighbours. Joining wells with gel would let the added neurons connect to one another. That isn't needed to show the basic idea works, which is what Brown et al. set out to do, but it could let future implants hold richer, more brain-like patterns of activity.",
    },
  ],
}

function names(rows: ScoreRow[], limit = 4): string {
  const labels = rows.map((r) => r.label.replace(/ \(.*\)$/, ''))
  return labels.length > limit ? `${labels.slice(0, limit).join(', ')} and ${labels.length - limit} more` : labels.join(', ')
}

// Gap bullets computed from the live scorecard, so they update as records are added.
function gapBullets(card: Scorecard, mode: Mode): string[] {
  const t = <T,>(normal: T, hardcore: T) => (mode === 'normal' ? normal : hardcore)
  const candidates = [...card.ranked, ...card.no_neuron_evidence]
  const state = (r: ScoreRow, k: RequirementKey) => r.requirements[k].state
  const bullets: string[] = []

  const stiffNoSurvival = candidates.filter((r) => state(r, 'soft') !== 'unknown' && state(r, 'survival') === 'unknown')
  if (stiffNoSurvival.length)
    bullets.push(
      t(
        `${stiffNoSurvival.length} materials have been measured for softness but never tested for keeping neurons alive (${names(stiffNoSurvival)}).`,
        `${stiffNoSurvival.length} materials have a stiffness value but no neuron survival result, so we can't yet plot neuron outcome against stiffness for them (${names(stiffNoSurvival)}).`,
      ),
    )

  const metSurvival = candidates.filter((r) => state(r, 'survival') === 'met')
  const one = metSurvival.length === 1
  bullets.push(
    metSurvival.length
      ? t(
          `Only ${metSurvival.length} material${one ? '' : 's'} (${names(metSurvival)}) ${one ? 'has' : 'have'} been shown to keep at least half of the neurons alive for 3 weeks or more.`,
          `Only ${metSurvival.length} material${one ? '' : 's'} (${names(metSurvival)}) ${one ? 'shows' : 'show'} viability or retention of at least 50% at 3 weeks or more.`,
        )
      : t(
          'No material has yet been shown to keep at least half of the neurons alive for 3 weeks or more.',
          'No material yet shows neuron viability or retention of at least 50% at 3 weeks or more.',
        ),
  )

  const clearUnknown = candidates.filter((r) => state(r, 'clear_degradable') === 'unknown')
  if (clearUnknown.length)
    bullets.push(
      t(
        `For ${clearUnknown.length} of ${candidates.length} materials, we don't yet know whether they let light through (needed to switch the neurons on) or dissolve over time, including ${names(clearUnknown, 3)}.`,
        `Transparency or degradation is unknown for ${clearUnknown.length} of ${candidates.length} materials, including ${names(clearUnknown, 3)}.`,
      ),
    )

  const unverified = candidates.filter((r) =>
    Object.values(r.requirements).some((q) => q.source === 'curated' && q.verified === false),
  )
  if (unverified.length)
    bullets.push(
      t(
        `${unverified.length} materials rely on facts our team looked up but hasn't yet double-checked against the source.`,
        `${unverified.length} materials rely on curated values whose citations haven't been checked yet.`,
      ),
    )

  if (card.no_neuron_evidence.length)
    bullets.push(
      t(
        `${card.no_neuron_evidence.length} materials haven't been tested with neurons at all (${names(card.no_neuron_evidence)}).`,
        `${card.no_neuron_evidence.length} materials have no neuron evidence at all (${names(card.no_neuron_evidence)}).`,
      ),
    )
  return bullets.slice(0, 5)
}

export default function GapsTab() {
  const [card, setCard] = useState<Scorecard | null>(null)
  const [error, setError] = useState('')
  const { mode } = useMode()
  const t = useModeText()
  useEffect(() => {
    fetch('/api/scorecard')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setCard)
      .catch(() => setError("Couldn't load the scorecard."))
  }, [])

  return (
    <div className="container narrow tab gaps">
      <p className="kicker">Gaps &amp; next steps</p>
      <h1 className="section-title">{t("What we still don't know, and what to test next", "What we're missing, and what we'd test next")}</h1>
      <p className="muted">
        {t('Why this matters is on the ', 'The motivation is on the ')}<a href="#/overview">Overview</a>
        {t('; this page is what the research says to do next.', '; this page is what the data says to do about it.')}
      </p>

      <h2>{t('Three directions we suggest exploring', 'Three design directions to explore')}</h2>
      <p>
        {t(
          'The implant in Brown et al. holds each neuron in a hard, rigid well with just enough room for the neuron. We suggest three ways to explore improving how many neurons survive and grow into the brain:',
          'The implant in Brown et al. (bioRxiv 2024) uses a hard SU-8 structure with just enough room for the neuron. We suggest three directions to explore for improving neuron survival and uptake:',
        )}
      </p>
      <ol className="experiments">
        {DIRECTIONS[mode].map((d) => (
          <li key={d.title}>
            <strong>{d.title}.</strong> {d.detail}
          </li>
        ))}
      </ol>
      <p className="muted small">
        {t('These are our ideas, not tested results.', 'These are our proposals, not results from the dataset.')}
      </p>

      <h2>{t('The biggest unknowns', 'Biggest gaps in the data')}</h2>
      {error && <p className="error">{error}</p>}
      {card && (
        <ul>
          {gapBullets(card, mode).map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}
      <p className="muted small">
        {t('These update automatically as we add papers.', 'Generated from the current scorecard, so these update as records are added.')}
      </p>

      <h2>{t('Experiments we would run next', 'Next best experiments')}</h2>
      <p className="muted small">
        {t('Ideas based on the unknowns above, not tested plans.', 'These are suggestions from the gaps in the data, not validated designs.')}
      </p>
      <ol className="experiments">
        {EXPERIMENTS[mode].map((e) => (
          <li key={e.title}>
            <strong>{e.title}.</strong> {e.detail}
          </li>
        ))}
      </ol>

      <h2>Help us fill the gaps</h2>
      <p>
        {t(
          "If you know this field, we'd welcome corrections, papers we've missed, and checks of the facts we looked up; the ",
          "If you know this area, we'd welcome corrections to records, papers we've missed, and checks of the curated values; the ",
        )}
        <a href="#/review">Review</a> tab shows what that would look like.
      </p>

      <h2>Where the data goes</h2>
      <p>
        {t(DATA_DESTINATION.plain, DATA_DESTINATION.text).split('{url}')[0]}
        <a href={DATA_DESTINATION.url} target="_blank" rel="noreferrer">
          {DATA_DESTINATION.url}
        </a>
        {t(DATA_DESTINATION.plain, DATA_DESTINATION.text).split('{url}')[1]}
      </p>
    </div>
  )
}
