import './App.css'
import MindSection from './MindSection'
import OrganicNeuron from './OrganicNeuron'
import Overview from './Overview'
import PhiCheck from './PhiCheck'
import SimCheck from './SimCheck'

// Placeholder until the team picks a project name.
const PROJECT_NAME = 'OSI4 Group4'

export default function App() {
  return (
    <>
      <header className="site-header">
        <div className="container header-inner">
          <a className="brand" href="#overview">
            {PROJECT_NAME}
          </a>
          <nav aria-label="Sections">
            <a href="#overview">Overview</a>
            <a href="#mind">What carries a mind?</a>
            <a href="#neuron">Organic neuron</a>
            <a href="#checks" className="nav-secondary">
              Package checks
            </a>
            <a href="#score" className="nav-cta">
              Score yours
            </a>
          </nav>
        </div>
      </header>

      <main>
        <Overview />
        <MindSection />
        <OrganicNeuron />
        <section id="checks" className="checks">
          <div className="container narrow">
            <p className="kicker">Stack tests</p>
            <p className="muted">
              Hello-world runs of the simulation libraries, to confirm they work in the deployed
              stack. Not project results.
            </p>
            <SimCheck />
            <PhiCheck />
          </div>
        </section>
      </main>
    </>
  )
}
