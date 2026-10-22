import { useMode, type Mode } from './mode'

const OPTIONS: { key: Mode; label: string }[] = [
  { key: 'normal', label: 'Normal' },
  { key: 'hardcore', label: 'Hardcore' },
]

export default function ModeToggle() {
  const { mode, setMode } = useMode()
  return (
    <div className="mode-toggle">
      <div className="pills" role="group" aria-label="Science mode">
        <span className="mode-label">Science mode</span>
        {OPTIONS.map((o) => (
          <button key={o.key} type="button" className="pill" aria-pressed={mode === o.key} onClick={() => setMode(o.key)}>
            {o.label}
          </button>
        ))}
      </div>
      <p className="muted small">
        {mode === 'normal'
          ? 'The main points in plain language, across every tab. Switch to Hardcore for full detail and caveats.'
          : 'Full detail and every caveat, across every tab. Switch to Normal for a plain-language version.'}
      </p>
    </div>
  )
}
