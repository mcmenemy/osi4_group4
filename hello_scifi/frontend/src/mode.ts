import { createContext, useCallback, useContext, useState } from 'react'

// "Science mode": Normal is a plain-language, news-style version of the app's copy; Hardcore is the
// full version with every caveat. Data values, quotes and server-generated details don't change.
export type Mode = 'normal' | 'hardcore'

const STORAGE_KEY = 'science-mode'
const DEFAULT_MODE: Mode = 'normal'

function storedMode(): Mode {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    return v === 'normal' || v === 'hardcore' ? v : DEFAULT_MODE
  } catch {
    return DEFAULT_MODE
  }
}

export function useModeState(): { mode: Mode; setMode: (m: Mode) => void } {
  const [mode, setModeState] = useState<Mode>(storedMode)
  const setMode = useCallback((m: Mode) => {
    setModeState(m)
    try {
      window.localStorage.setItem(STORAGE_KEY, m)
    } catch {
      // Storage can be blocked (private windows); the toggle still works for this visit.
    }
  }, [])
  return { mode, setMode }
}

export const ModeContext = createContext<{ mode: Mode; setMode: (m: Mode) => void }>({
  mode: DEFAULT_MODE,
  setMode: () => {},
})

export const useMode = () => useContext(ModeContext)

// Pick the copy for the current mode: `const t = useModeText(); t('plain words', 'precise words')`.
export function useModeText() {
  const { mode } = useMode()
  return useCallback(<T,>(normal: T, hardcore: T): T => (mode === 'normal' ? normal : hardcore), [mode])
}
