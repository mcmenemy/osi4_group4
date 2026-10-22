import MindSection from './MindSection'

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
    </>
  )
}
