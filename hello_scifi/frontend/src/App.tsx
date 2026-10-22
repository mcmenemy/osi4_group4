import { Fragment, useEffect, useState } from 'react'
import './App.css'
import ExtractTab from './ExtractTab'
import FunTab from './FunTab'
import GapsTab from './GapsTab'
import MapsTab from './MapsTab'
import Overview from './Overview'
import RecordsTab from './RecordsTab'
import ReviewTab from './ReviewTab'
import ScifiPage from './ScifiPage'
import { ModeContext, useModeState } from './mode'
import { getJson, type MaterialRecord, type References, type TargetWindow } from './records'

const PROJECT_NAME = 'Neuron Nursery'

const REPO_URL = 'https://github.com/mcmenemy/osi4_group4'

// Tabs after the divider (`secondary`) show how the data is made, not the story.
const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'maps', label: 'Maps' },
  { id: 'records', label: 'Records' },
  { id: 'gaps', label: 'Gaps & next steps' },
  { id: 'fun', label: 'For fun' },
  { id: 'extract', label: 'Extract', secondary: true },
  { id: 'review', label: 'Review', secondary: true },
] as const

const HIDDEN_ROUTES = ['scifi'] as const

type Route = (typeof TABS)[number]['id'] | (typeof HIDDEN_ROUTES)[number]

const ROUTES: readonly string[] = [...TABS.map((t) => t.id), ...HIDDEN_ROUTES]
// Old links keep working: the benchmark moved to For fun and the proposal became Gaps & next steps.
const REDIRECTS: Record<string, Route> = { context: 'fun', 'big-picture': 'fun', proposal: 'gaps' }

// Tabs use "#/name" (optionally "#/name?id=..."). Other hashes are in-page anchors and keep
// the current tab.
function routeFromHash(current: Route): Route {
  const hash = window.location.hash
  if (!hash || hash === '#' || hash === '#/') return 'overview'
  if (!hash.startsWith('#/')) return current
  const id = hash.slice(2).split('?')[0]
  if (REDIRECTS[id]) return REDIRECTS[id]
  return ROUTES.includes(id) ? (id as Route) : 'overview'
}

function hashParam(name: string): string | null {
  const query = window.location.hash.split('?')[1]
  return query ? new URLSearchParams(query).get(name) : null
}

export default function App() {
  const [route, setRoute] = useState<Route>(() => routeFromHash('overview'))
  const [recordId, setRecordId] = useState<string | null>(() => hashParam('id'))
  const [records, setRecords] = useState<MaterialRecord[]>([])
  const [references, setReferences] = useState<References | null>(null)
  const [targetWindow, setTargetWindow] = useState<TargetWindow | null>(null)
  const [loadError, setLoadError] = useState('')
  const modeState = useModeState()

  useEffect(() => {
    const onHash = () => {
      setRecordId(hashParam('id'))
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
    <ModeContext.Provider value={modeState}>
      <header className="site-header">
        <div className="container header-inner">
          <a className="brand" href="#/">
            <span className="brand-logo" aria-hidden="true" />
            {PROJECT_NAME}
          </a>
          <nav aria-label="Tabs" className="tabs-nav">
            {TABS.map((t, i) => (
              <Fragment key={t.id}>
                {'secondary' in t && !('secondary' in TABS[i - 1]) && <span className="tabs-sep" aria-hidden="true" />}
                <a href={`#/${t.id}`} aria-current={route === t.id ? 'page' : undefined}>
                  {t.label}
                </a>
              </Fragment>
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
        {route === 'overview' && <Overview records={records} />}
        {route === 'maps' && <MapsTab records={records} references={references} targetWindow={targetWindow} />}
        {route === 'records' && <RecordsTab records={records} openId={recordId} />}
        {route === 'extract' && <ExtractTab />}
        {route === 'review' && <ReviewTab records={records} />}
        {route === 'gaps' && <GapsTab />}
        {route === 'fun' && <FunTab />}
        {route === 'scifi' && <ScifiPage />}
      </main>

      <footer className="site-footer">
        <div className="container">
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            Source code on GitHub
          </a>
        </div>
      </footer>
    </ModeContext.Provider>
  )
}
