import { DATA_DESTINATION } from './dataDestination'
import { useMode, useModeText, type Mode } from './mode'

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

export default function GapsTab() {
  const { mode } = useMode()
  const t = useModeText()

  return (
    <div className="container narrow tab gaps">
      <p className="kicker">Gaps &amp; next steps</p>
      <h1 className="section-title">{t("Where we'd go next", 'Next steps')}</h1>
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
