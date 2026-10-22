import { useEffect, useState } from 'react'
import './App.css'
import ContextTab from './ContextTab'
import ExtractTab from './ExtractTab'
import MapsTab from './MapsTab'
import Overview from './Overview'
import ProposalTab from './ProposalTab'
import RecordsTab from './RecordsTab'
import ReviewTab from './ReviewTab'
import ScifiPage from './ScifiPage'
import { getJson, type MaterialRecord, type References, type TargetWindow } from './records'

// Placeholder until the team picks a project name.
const PROJECT_NAME = 'OSI4 Group4'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'maps', label: 'Maps' },
  { id: 'records', label: 'Records' },
  { id: 'extract', label: 'Extract' },
  { id: 'review', label: 'Review' },
  { id: 'proposal', label: 'Proposal' },
  { id: 'context', label: 'Big picture' },
] as const

const HIDDEN_ROUTES = ['scifi'] as const

type Route = (typeof TABS)[number]['id'] | (typeof HIDDEN_ROUTES)[number]

const ROUTES: readonly string[] = [...TABS.map((t) => t.id), ...HIDDEN_ROUTES]

// Tabs use "#/name". Other hashes (like "#score") are in-page anchors and keep the current tab.
function routeFromHash(current: Route): Route {
  const hash = window.location.hash
  if (!hash || hash === '#' || hash === '#/') return 'overview'
  if (!hash.startsWith('#/')) return current
  const id = hash.slice(2)
  return ROUTES.includes(id) ? (id as Route) : 'overview'
}

export default function App() {
  const [route, setRoute] = useState<Route>(() => routeFromHash('overview'))
  const [records, setRecords] = useState<MaterialRecord[]>([])
  const [references, setReferences] = useState<References | null>(null)
  const [targetWindow, setTargetWindow] = useState<TargetWindow | null>(null)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    const onHash = () => {
      setRoute((current) => {
        const next = routeFromHash(current)
        if (next !== current) window.scrollTo(0, 0)
        return next
      })
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    Promise.all([
      getJson<MaterialRecord[]>('/api/records'),
      getJson<References>('/api/references'),
      getJson<TargetWindow>('/api/target-window'),
    ])
      .then(([r, ref, w]) => {
        setRecords(r)
        setReferences(ref)
        setTargetWindow(w)
      })
      .catch(() => setLoadError("Couldn't load the records. Is the backend running?"))
  }, [])

  return (
    <>
      <header className="site-header">
        <div className="container header-inner">
          <a className="brand" href="#/">
            {PROJECT_NAME}
          </a>
          <nav aria-label="Tabs" className="tabs-nav">
            {TABS.map((t) => (
              <a key={t.id} href={`#/${t.id}`} aria-current={route === t.id ? 'page' : undefined}>
                {t.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main>
        {loadError && (
          <div className="container">
            <p className="error">{loadError}</p>
          </div>
        )}
        {route === 'overview' && <Overview records={records} references={references} />}
        {route === 'maps' && <MapsTab records={records} references={references} targetWindow={targetWindow} />}
        {route === 'records' && <RecordsTab records={records} />}
        {route === 'extract' && <ExtractTab />}
        {route === 'review' && <ReviewTab records={records} />}
        {route === 'proposal' && <ProposalTab />}
        {route === 'context' && <ContextTab />}
        {route === 'scifi' && <ScifiPage />}
      </main>
    </>
  )
}
