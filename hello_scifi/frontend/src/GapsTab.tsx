import { useEffect, useState } from 'react'
import { DATA_DESTINATION } from './dataDestination'
import type { RequirementKey, ScoreRow, Scorecard } from './scorecard'

const EXPERIMENTS = [
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
]

function names(rows: ScoreRow[], limit = 4): string {
  const labels = rows.map((r) => r.label.replace(/ \(.*\)$/, ''))
  return labels.length > limit ? `${labels.slice(0, limit).join(', ')} and ${labels.length - limit} more` : labels.join(', ')
}

// Gap bullets computed from the live scorecard, so they update as records are added.
function gapBullets(card: Scorecard): string[] {
  const candidates = [...card.ranked, ...card.no_neuron_evidence]
  const state = (r: ScoreRow, k: RequirementKey) => r.requirements[k].state
  const bullets: string[] = []

  const stiffNoSurvival = candidates.filter((r) => state(r, 'soft') !== 'unknown' && state(r, 'survival') === 'unknown')
  if (stiffNoSurvival.length)
    bullets.push(
      `${stiffNoSurvival.length} materials have a stiffness value but no neuron survival result, so we can't yet plot neuron outcome against stiffness for them (${names(stiffNoSurvival)}).`,
    )

  const metSurvival = candidates.filter((r) => state(r, 'survival') === 'met')
  bullets.push(
    metSurvival.length
      ? `Only ${metSurvival.length} material${metSurvival.length === 1 ? '' : 's'} (${names(metSurvival)}) ${metSurvival.length === 1 ? 'shows' : 'show'} viability or retention of at least 50% at 3 weeks or more.`
      : 'No material yet shows neuron viability or retention of at least 50% at 3 weeks or more.',
  )

  const clearUnknown = candidates.filter((r) => state(r, 'clear_degradable') === 'unknown')
  if (clearUnknown.length)
    bullets.push(
      `Transparency or degradation is unknown for ${clearUnknown.length} of ${candidates.length} materials, including ${names(clearUnknown, 3)}.`,
    )

  const unverified = candidates.filter((r) =>
    Object.values(r.requirements).some((q) => q.source === 'curated' && q.verified === false),
  )
  if (unverified.length)
    bullets.push(`${unverified.length} materials rely on curated values whose citations haven't been checked yet.`)

  if (card.no_neuron_evidence.length)
    bullets.push(
      `${card.no_neuron_evidence.length} materials have no neuron evidence at all (${names(card.no_neuron_evidence)}).`,
    )
  return bullets.slice(0, 5)
}

export default function GapsTab() {
  const [card, setCard] = useState<Scorecard | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    fetch('/api/scorecard')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setCard)
      .catch(() => setError("Couldn't load the scorecard."))
  }, [])

  return (
    <div className="container narrow tab gaps">
      <p className="kicker">Gaps &amp; next steps</p>
      <h1 className="section-title">What we're missing, and what we'd test next</h1>
      <p className="muted">
        The motivation is on the <a href="#/overview">Overview</a>; this page is what the data says to do about it.
      </p>

      <h2>Biggest gaps in the data</h2>
      {error && <p className="error">{error}</p>}
      {card && (
        <ul>
          {gapBullets(card).map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}
      <p className="muted small">Generated from the current scorecard, so these update as records are added.</p>

      <h2>Next best experiments</h2>
      <p className="muted small">
        These are suggestions from the gaps in the data, not validated designs.
      </p>
      <ol className="experiments">
        {EXPERIMENTS.map((e) => (
          <li key={e.title}>
            <strong>{e.title}.</strong> {e.detail}
          </li>
        ))}
      </ol>

      <h2>Help us fill the gaps</h2>
      <p>
        If you know this area, we'd welcome corrections to records, papers we've missed, and checks of the curated
        values; the <a href="#/review">Review</a> tab shows what that would look like.
      </p>

      <h2>Where the data goes</h2>
      <p>
        {DATA_DESTINATION.text.split('{url}')[0]}
        <a href={DATA_DESTINATION.url} target="_blank" rel="noreferrer">
          {DATA_DESTINATION.url}
        </a>
        {DATA_DESTINATION.text.split('{url}')[1]}
      </p>
    </div>
  )
}
