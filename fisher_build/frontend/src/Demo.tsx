import { DEMO_STEPS } from './demoSteps'

export default function DemoBar({
  step,
  onStep,
  onExit,
}: {
  step: number
  onStep: (step: number) => void
  onExit: () => void
}) {
  const last = DEMO_STEPS.length - 1
  return (
    <aside className="demo-bar" aria-live="polite" aria-label="Guided demo">
      <p className="demo-progress">
        Demo {step + 1} / {DEMO_STEPS.length}
      </p>
      <p className="demo-text">{DEMO_STEPS[step].text}</p>
      <div className="demo-buttons">
        <button type="button" className="secondary" onClick={() => onStep(step - 1)} disabled={step === 0}>
          Back
        </button>
        {step < last ? (
          <button type="button" className="primary" onClick={() => onStep(step + 1)}>
            Next
          </button>
        ) : (
          <button type="button" className="primary" onClick={onExit}>
            Finish
          </button>
        )}
        <button type="button" className="link" onClick={onExit}>
          Exit demo
        </button>
      </div>
    </aside>
  )
}
