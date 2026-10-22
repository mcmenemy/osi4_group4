import { useEffect, useState } from 'react'
import './App.css'
import DemoBar from './Demo'
import { DEMO_STEPS } from './demoSteps'
import MicrowellView from './MicrowellView'
import OverviewView, { type Tab } from './OverviewView'
import RubricView from './RubricView'
import ScoreView from './ScoreView'
import SimView from './SimView'

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'score', label: 'Score a substrate' },
  { id: 'sim', label: 'Simulate neuron loss' },
  { id: 'microwell', label: 'Microwell study' },
  { id: 'rubric', label: 'How scoring works' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('overview')
  const [demoStep, setDemoStep] = useState<number | null>(null)

  // A demo step switches tab and tells the Score view what to show...
  function goToStep(n: number | null) {
    setDemoStep(n)
    if (n === null) return
    const step = DEMO_STEPS[n]
    setTab(step.tab)
    window.dispatchEvent(new CustomEvent('demo-step', { detail: step }))
  }

  // ...then, once the tab has rendered, scrolls to and highlights its target.
  useEffect(() => {
    document.querySelectorAll('.demo-focus').forEach((el) => el.classList.remove('demo-focus'))
    if (demoStep === null) return
    const step = DEMO_STEPS[demoStep]
    const timer = window.setTimeout(() => {
      const target = document.getElementById(step.target)
      if (step.openFramework) document.getElementById(`fw-${step.openFramework}`)?.setAttribute('open', '')
      target?.classList.add('demo-focus')
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 150)
    return () => window.clearTimeout(timer)
  }, [demoStep])

  return (
    <main className={demoStep !== null ? 'with-demo' : undefined}>
      <header>
        <h1>What can carry a mind?</h1>
        <p className="tagline">
          Scoring candidate implant substrates against six theories of mind, and simulating what
          each could take over as a patient's neurons die.
        </p>
      </header>

      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? 'active' : ''}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* Views stay mounted so switching tabs keeps their state. */}
      <div hidden={tab !== 'overview'}>
        <OverviewView onNavigate={setTab} onStartDemo={() => goToStep(0)} />
      </div>
      <div hidden={tab !== 'score'}>
        <ScoreView />
      </div>
      <div hidden={tab !== 'sim'}>
        <SimView />
      </div>
      <div hidden={tab !== 'microwell'}>
        <MicrowellView />
      </div>
      <div hidden={tab !== 'rubric'}>
        <RubricView />
      </div>

      {demoStep !== null && (
        <DemoBar step={demoStep} onStep={goToStep} onExit={() => goToStep(null)} />
      )}

      <footer>
        OSI Hackathon @ NC State, Oct 2026. Outputs are structured comparisons and simulation
        proxies, not claims that any substrate is conscious.
      </footer>
    </main>
  )
}
