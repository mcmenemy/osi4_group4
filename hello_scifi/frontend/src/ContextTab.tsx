import MindSection from './MindSection'
import OrganicNeuron from './OrganicNeuron'
import PhiCheck from './PhiCheck'
import SimCheck from './SimCheck'

export default function ContextTab() {
  return (
    <>
      <div className="container tab context-intro">
        <p className="kicker">Context</p>
        <p className="lede">
          Why the device side matters: if a patient loses cortex, what sits behind the implant decides how much function
          it could ever carry. This benchmark scores candidate substrates across theories of mind.
        </p>
      </div>
      <MindSection />
      <OrganicNeuron />
      <section className="checks">
        <div className="container narrow">
          <p className="kicker">Stack tests</p>
          <p className="muted">
            Hello-world runs of the simulation libraries, to confirm they work in the deployed stack. Not project results.
          </p>
          <SimCheck />
          <PhiCheck />
        </div>
      </section>
    </>
  )
}
