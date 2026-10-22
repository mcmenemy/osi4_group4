import { Fragment, useMemo, useState, type KeyboardEvent } from 'react'
import { useModeText } from './mode'
import { MATERIAL_CLASSES, classLabel, sourceLabel, type MaterialRecord } from './records'
import {
  PLAIN_LABELS,
  PLAIN_STATES,
  SHORT_LABELS,
  STATE_ORDER,
  type BestSurvival,
  type RequirementKey,
  type ScoreRow,
  type Scorecard,
  type State,
} from './scorecard'

const PAGE_SIZE = 10
const REQS: RequirementKey[] = ['survival', 'soft', 'in_vivo_brain', 'clear_degradable', 'conductive']

type View = 'evidence' | 'promising' | 'gaps' | 'custom'
type SortKey = 'label' | 'score' | 'papers' | 'survival' | 'gaps' | RequirementKey

// Points from material properties alone (not cell evidence).
const PROPERTY_REQS: RequirementKey[] = ['soft', 'clear_degradable', 'conductive']
const propertyPoints = (row: ScoreRow) =>
  row.breakdown.filter((b) => PROPERTY_REQS.includes(b.requirement)).reduce((sum, b) => sum + b.points, 0)
interface Sort {
  key: SortKey
  dir: 1 | -1
}

const VIEWS: { key: Exclude<View, 'custom'>; label: string; plain: string; sort: Sort }[] = [
  { key: 'evidence', label: 'Most evidence', plain: 'Best studied', sort: { key: 'papers', dir: -1 } },
  { key: 'promising', label: 'Most promising', plain: 'Most promising', sort: { key: 'score', dir: -1 } },
  { key: 'gaps', label: 'Biggest gaps', plain: 'Most worth testing', sort: { key: 'gaps', dir: -1 } },
]

const STATE_ICON: Record<State, string> = { met: '✓', partial: '◐', unknown: '?', fails: '✕' }

function sortValue(row: ScoreRow, key: SortKey): number | string {
  switch (key) {
    case 'label':
      return row.label.toLowerCase()
    case 'score':
      return row.score
    case 'papers':
      // Most evidence: neuron records first, then all records, then papers.
      return row.neuron_record_count * 1e6 + row.record_count * 1e3 + row.paper_count
    case 'survival':
      return row.best_survival?.value ?? -1
    case 'gaps':
      // Biggest gaps: promising on properties, thin on neuron evidence.
      return propertyPoints(row) - row.neuron_record_count
    default:
      return STATE_ORDER[row.requirements[key].state]
  }
}

function sortRows(rows: ScoreRow[], sort: Sort): ScoreRow[] {
  return [...rows].sort((a, b) => {
    const va = sortValue(a, sort.key)
    const vb = sortValue(b, sort.key)
    if (va < vb) return -sort.dir
    if (va > vb) return sort.dir
    return b.score - a.score || a.label.localeCompare(b.label)
  })
}

interface Props {
  card: Scorecard
  records: MaterialRecord[]
  loading: boolean
  onOpenRecords: (ids: string[]) => void
}

export default function ScorecardTable({ card, records, loading, onOpenRecords }: Props) {
  const [view, setView] = useState<View>('evidence')
  const [sort, setSort] = useState<Sort>(VIEWS[0].sort)
  const [classes, setClasses] = useState<string[]>([])
  const [neuronOnly, setNeuronOnly] = useState(false)
  const [page, setPage] = useState(0)
  const [expanded, setExpanded] = useState<string | null>(null)
  const t = useModeText()

  const byId = useMemo(() => new Map(records.map((r) => [r.record_id, r])), [records])
  const presentClasses = useMemo(
    () => MATERIAL_CLASSES.filter((c) => [...card.ranked, ...card.no_neuron_evidence].some((r) => r.material_class === c.key)),
    [card],
  )

  const rows = useMemo(() => {
    const keep = (r: ScoreRow) => classes.length === 0 || classes.includes(r.material_class)
    const ranked = sortRows(card.ranked.filter(keep), sort).map((r) => ({ row: r, group: 'ranked' as const }))
    const rest = neuronOnly
      ? []
      : sortRows(card.no_neuron_evidence.filter(keep), sort).map((r) => ({ row: r, group: 'none' as const }))
    const controls = neuronOnly
      ? []
      : (card.controls ?? []).filter(keep).map((r) => ({ row: r, group: 'control' as const }))
    return [...ranked, ...rest, ...controls]
  }, [card, sort, classes, neuronOnly])

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const current = Math.min(page, pages - 1)
  const visible = rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE)

  function chooseView(v: (typeof VIEWS)[number]) {
    setView(v.key)
    setSort(v.sort)
    setPage(0)
  }

  function sortBy(key: SortKey) {
    setView('custom')
    setPage(0)
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === 'label' ? 1 : -1 }))
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('input, button')) return
    if (e.key === 'ArrowRight') setPage(Math.min(current + 1, pages - 1))
    if (e.key === 'ArrowLeft') setPage(Math.max(current - 1, 0))
  }

  const s = card.summary
  const from = rows.length ? current * PAGE_SIZE + 1 : 0
  const to = Math.min(rows.length, (current + 1) * PAGE_SIZE)
  const headerArrow = (key: SortKey) => (sort.key === key ? (sort.dir === 1 ? ' ▲' : ' ▼') : '')

  return (
    <div className={loading ? 'scorecard stale' : 'scorecard'} tabIndex={0} onKeyDown={onKey} aria-label="Candidate well fills">
      {t(
        <p className="confidence">
          Early days: <strong>{s.ranked_materials}</strong> material{s.ranked_materials === 1 ? ' has' : 's have'} been tested
          with neurons so far, and <strong>{s.unknown_cells}</strong> boxes are still unknown. More papers will change this.
          Click a row to see why.
        </p>,
        <p className="confidence">
          Ranking based on <strong>{s.ranked_materials}</strong> material{s.ranked_materials === 1 ? '' : 's'} and{' '}
          <strong>{s.neuron_records}</strong> neuron record{s.neuron_records === 1 ? '' : 's'};{' '}
          <strong>{s.unknown_cells}</strong> cells unknown. Add papers to firm this up.
        </p>,
      )}

      <div className="scorecard-controls">
        <div className="pills" role="group" aria-label="View">
          {VIEWS.map((v) => (
            <button key={v.key} type="button" className="pill" aria-pressed={view === v.key} onClick={() => chooseView(v)}>
              {t(v.plain, v.label)}
            </button>
          ))}
        </div>
        <div className="pills" role="group" aria-label="Material class">
          {presentClasses.map((c) => (
            <button key={c.key} type="button" className="pill" aria-pressed={classes.includes(c.key)}
              onClick={() => {
                setPage(0)
                setClasses((cs) => (cs.includes(c.key) ? cs.filter((x) => x !== c.key) : [...cs, c.key]))
              }}>
              {t(c.plain, c.label)}
            </button>
          ))}
        </div>
        <label className="check">
          <input type="checkbox" checked={neuronOnly} onChange={(e) => {
            setPage(0)
            setNeuronOnly(e.target.checked)
          }} /> {t('Only materials tested with neurons', 'Neuron evidence only')}
        </label>
      </div>

      <div className="table-scroll">
        <table className="scorecard-table">
          <thead>
            <tr>
              <th scope="col"><button type="button" className="th-btn" onClick={() => sortBy('label')}>Material{headerArrow('label')}</button></th>
              {REQS.map((k) => (
                <th key={k} scope="col" className="state-col">
                  <button type="button" className="th-btn" onClick={() => sortBy(k)}>{t(PLAIN_LABELS, SHORT_LABELS)[k]}{headerArrow(k)}</button>
                </th>
              ))}
              <th scope="col" className="num"><button type="button" className="th-btn" onClick={() => sortBy('papers')}>Papers{headerArrow('papers')}</button></th>
              <th scope="col" className="num"><button type="button" className="th-btn" onClick={() => sortBy('score')}>Score{headerArrow('score')}</button></th>
              <th scope="col" className="survival-col">
                <button type="button" className="th-btn" onClick={() => sortBy('survival')}>{t('Best neuron result', 'Best survival, 0–100%')}{headerArrow('survival')}</button>
              </th>
            </tr>
          </thead>
          <tbody>
            {card.baseline && (
              <ScoreRowView row={card.baseline} baseline expanded={expanded === card.baseline.material_key}
                onToggle={() => setExpanded((e) => (e === card.baseline!.material_key ? null : card.baseline!.material_key))}
                byId={byId} onOpenRecords={onOpenRecords} />
            )}
            {visible.map(({ row, group }, i) => {
              const first = i === 0 || visible[i - 1].group !== group
              return (
                <Fragment key={row.material_key}>
                  {first && group !== 'ranked' && (
                    <tr className="group-row">
                      <td colSpan={9}>
                        {group === 'none'
                          ? t('Not yet tested with neurons, so not ranked', 'No neuron evidence yet: not ranked, shown for their gaps')
                          : t('For comparison only (for example, ordinary lab dishes)', 'Controls: comparison surfaces, never ranked as well fills')}
                      </td>
                    </tr>
                  )}
                  <ScoreRowView row={row} expanded={expanded === row.material_key}
                    onToggle={() => setExpanded((e) => (e === row.material_key ? null : row.material_key))}
                    byId={byId} onOpenRecords={onOpenRecords} unranked={group !== 'ranked'} />
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="pager">
        <button type="button" className="pill" onClick={() => setPage(Math.max(current - 1, 0))} disabled={current === 0} aria-label="Previous page">←</button>
        <span>{from}–{to} of {rows.length}</span>
        <button type="button" className="pill" onClick={() => setPage(Math.min(current + 1, pages - 1))} disabled={current >= pages - 1} aria-label="Next page">→</button>
        <span className="muted small">{t('Arrow keys turn the page.', 'Arrow keys page when the table is focused.')}</span>
      </div>

      {t(
      <ul className="legend scorecard-legend">
        <li><span className="state met">✓</span> yes</li>
        <li><span className="state partial">◐</span> partly</li>
        <li><span className="state unknown">?</span> not known yet</li>
        <li><span className="state fails">✕</span> no</li>
        <li><span className="badge curated">curated</span> looked up by our team rather than pulled from a paper by AI</li>
        <li><span className="badge unverified">unverified</span> not double-checked against the source yet</li>
        <li><span className="badge some">some</span> true for some materials in the family, not all</li>
        <li>Survival dot: further right is better; hollow means the result was in non-neuron cells</li>
      </ul>,
      <ul className="legend scorecard-legend">
        <li><span className="state met">✓</span> met</li>
        <li><span className="state partial">◐</span> partial</li>
        <li><span className="state unknown">?</span> unknown</li>
        <li><span className="state fails">✕</span> fails</li>
        <li><span className="badge curated">curated</span> from data/materials.yaml, not extracted</li>
        <li><span className="badge unverified">unverified</span> citation not yet checked</li>
        <li><span className="badge some">some</span> met by some family members, not all</li>
        <li>Survival marker: ● viability · ■ occupancy · ◆ retention · ▲ neurite outgrowth; hollow = non-neuron cells</li>
      </ul>,
      )}
    </div>
  )
}

function ScoreRowView({
  row,
  baseline,
  unranked,
  expanded,
  onToggle,
  byId,
  onOpenRecords,
}: {
  row: ScoreRow
  baseline?: boolean
  unranked?: boolean
  expanded: boolean
  onToggle: () => void
  byId: Map<string, MaterialRecord>
  onOpenRecords: (ids: string[]) => void
}) {
  const t = useModeText()
  return (
    <>
      <tr className={['score-row', baseline && 'baseline', unranked && 'unranked', expanded && 'open'].filter(Boolean).join(' ')}
        onClick={onToggle} aria-expanded={expanded}>
        <th scope="row">
          <span className="caret">{expanded ? '▾' : '▸'}</span>
          <span className="mat-label">{row.label}</span>
          {baseline && <span className="badge baseline-badge">{t('today’s chip', 'baseline')}</span>}
          <span className="mat-class">{classLabel(row.material_class as never, t(true, false))}</span>
        </th>
        {REQS.map((k) => {
          const req = row.requirements[k]
          return (
            <td key={k} className="state-col" title={`${req.state}: ${req.detail}`}>
              <span className={`state ${req.state}`} role="img" aria-label={t(PLAIN_STATES[req.state], req.state)}>{STATE_ICON[req.state]}</span>
              {req.state === 'met' && req.coverage === 'some members' && (
                <span className="badge some" title={`${req.members_met} of ${req.members_measured} members`}>some</span>
              )}
              <SourceBadge req={req} />
            </td>
          )
        })}
        <td className="num">{row.paper_count}</td>
        <td className="num score-cell">{unranked || baseline ? <span className="muted">{row.score.toFixed(1)}</span> : row.score.toFixed(1)}</td>
        <td className="survival-col"><SurvivalDot s={row.best_survival} /></td>
      </tr>
      {expanded && (
        <tr className="detail-row">
          <td colSpan={9}>
            <RowDetail row={row} byId={byId} onOpenRecords={onOpenRecords} />
          </td>
        </tr>
      )}
    </>
  )
}

function markerPath(measure: BestSurvival['measure'], x: number, y: number) {
  const r = 5
  switch (measure) {
    case 'occupancy':
      return <rect x={x - r} y={y - r} width={r * 2} height={r * 2} />
    case 'retention':
      return <polygon points={`${x},${y - r - 1} ${x + r + 1},${y} ${x},${y + r + 1} ${x - r - 1},${y}`} />
    case 'neurite_outgrowth':
      return <polygon points={`${x},${y - r - 1} ${x + r + 1},${y + r} ${x - r - 1},${y + r}`} />
    default:
      return <circle cx={x} cy={y} r={r} />
  }
}

function SurvivalDot({ s }: { s: BestSurvival | null }) {
  const W = 140
  const pad = 8
  const x = (v: number) => pad + (Math.max(0, Math.min(100, v)) / 100) * (W - pad * 2)
  return (
    <span className="survival-dot">
      <svg viewBox={`0 0 ${W} 22`} width={W} height={22} role="img"
        aria-label={s && s.value != null ? s.label : 'No survival data'}>
        <line className="dot-axis" x1={pad} x2={W - pad} y1={11} y2={11} />
        {[0, 50, 100].map((t) => <line key={t} className="dot-tick" x1={x(t)} x2={x(t)} y1={7} y2={15} />)}
        {s && s.value != null && <g className={s.is_neuron ? 'dot-mark' : 'dot-mark hollow'}>{markerPath(s.measure, x(s.value), 11)}</g>}
      </svg>
      <span className="dot-label">{s && s.value != null ? s.label : 'none'}</span>
    </span>
  )
}

function RowDetail({
  row,
  byId,
  onOpenRecords,
}: {
  row: ScoreRow
  byId: Map<string, MaterialRecord>
  onOpenRecords: (ids: string[]) => void
}) {
  const s = row.best_survival
  return (
    <div className="row-detail">
      {row.note && <p className="muted">{row.note}</p>}
      <table className="breakdown">
        <thead>
          <tr>
            <th>Requirement</th>
            <th>State</th>
            <th className="num">Weight × state × evidence</th>
            <th className="num">Points</th>
            <th>Why</th>
            <th>Records</th>
          </tr>
        </thead>
        <tbody>
          {row.breakdown.map((b) => {
            const req = row.requirements[b.requirement]
            return (
              <tr key={b.requirement}>
                <td>{b.label}</td>
                <td>
                  <span className={`state ${b.state}`}>{STATE_ICON[b.state]}</span> {b.state}
                  {req.coverage && req.members_measured ? <span className="badge some">{req.members_met} of {req.members_measured} members</span> : null}
                  <SourceBadge req={req} />
                </td>
                <td className="num">{b.weight} × {b.state_value} × {b.multiplier}</td>
                <td className="num">{b.points.toFixed(2)}</td>
                <td>{req.detail}</td>
                <td>
                  {req.records.length > 0 ? (
                    <button type="button" className="link-btn" onClick={() => onOpenRecords(req.records)}>
                      {req.records.length} record{req.records.length === 1 ? '' : 's'}
                    </button>
                  ) : '—'}
                </td>
              </tr>
            )
          })}
          {row.paper_bonus > 0 && (
            <tr>
              <td>Independent papers</td>
              <td colSpan={2} />
              <td className="num">{row.paper_bonus.toFixed(2)}</td>
              <td>{row.paper_count} papers</td>
              <td />
            </tr>
          )}
        </tbody>
      </table>

      {s && s.evidence && (
        <figure className="evidence">
          <blockquote>“{s.evidence}”</blockquote>
          <figcaption>
            Best survival: {s.label}{s.location && ` · ${s.location}`} ·{' '}
            {byId.get(s.record_id) ? sourceLabel(byId.get(s.record_id)!.source) : s.record_id}{' '}
            <button type="button" className="link-btn" onClick={() => onOpenRecords([s.record_id])}>open record</button>
          </figcaption>
        </figure>
      )}

      {(['transparency', 'degradable'] as const).map((k) => {
        const fact = row.curated[k]
        return fact && fact.citation && fact.value !== 'unknown' ? (
          <p key={k} className="small muted">
            <span className="badge curated">curated</span>
            {!fact.verified && <span className="badge unverified">unverified</span>} {k}: <strong>{fact.value}</strong>.{' '}
            {fact.citation}
          </p>
        ) : null
      })}
      {row.record_ids.length > 0 && (
        <button type="button" className="link-btn" onClick={() => onOpenRecords(row.record_ids)}>
          All {row.record_count} records for this material →
        </button>
      )}
    </div>
  )
}

function SourceBadge({ req }: { req: { source: string | null; verified?: boolean } }) {
  if (req.source !== 'curated') return null
  return (
    <>
      <span className="badge curated">curated</span>
      {req.verified === false && <span className="badge unverified">unverified</span>}
    </>
  )
}
