import { useEffect, useState } from 'react'

// Chart colors and fonts come from the CSS tokens in App.css, so charts match the theme.

export interface Theme {
  fg: string
  muted: string
  border: string
  panel: string
  bg: string
  accent: string
  blue: string
  categorical: string[]
  other: string
  seqLow: string
  seqHigh: string
  tissue: string
  tissueLine: string
  font: string
}

function readTheme(): Theme {
  const css = getComputedStyle(document.documentElement)
  const v = (name: string) => css.getPropertyValue(name).trim()
  return {
    fg: v('--fg'),
    muted: v('--muted'),
    border: v('--border'),
    panel: v('--panel'),
    bg: v('--bg'),
    accent: v('--accent'),
    blue: v('--blue'),
    categorical: [1, 2, 3, 4, 5, 6].map((i) => v(`--cat-${i}`)),
    other: v('--cat-other'),
    seqLow: v('--seq-low'),
    seqHigh: v('--seq-high'),
    tissue: v('--tissue'),
    tissueLine: v('--tissue-line'),
    font: getComputedStyle(document.body).fontFamily,
  }
}

// Re-reads the CSS tokens when the OS theme changes, so charts follow light/dark mode.
export function useTheme(): Theme {
  const [theme, setTheme] = useState(readTheme)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setTheme(readTheme())
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return theme
}

export function baseLayout(t: Theme): object {
  return {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { family: t.font, color: t.fg, size: 12 },
    margin: { l: 70, r: 20, t: 20, b: 60 },
    hoverlabel: { bgcolor: t.panel, bordercolor: t.border, font: { color: t.fg } },
    legend: { orientation: 'h', y: -0.2, x: 0, font: { size: 12, color: t.muted } },
  }
}

export function logAxis(t: Theme, title: string, range?: [number, number]): object {
  return {
    type: 'log',
    title: { text: title, font: { color: t.muted } },
    gridcolor: t.border,
    linecolor: t.muted,
    zeroline: false,
    exponentformat: 'power',
    ...(range ? { range: range.map(Math.log10) } : {}),
  }
}
