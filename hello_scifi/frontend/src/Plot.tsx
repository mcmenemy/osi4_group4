import { useEffect, useRef, useState } from 'react'

// Thin wrapper around Plotly, loaded on demand so it isn't in the main bundle.

export interface PlotPoint {
  customdata?: unknown
  x?: unknown
  y?: unknown
}

interface PlotlyElement extends HTMLDivElement {
  on?: (event: string, handler: (e: { points: PlotPoint[] }) => void) => void
  removeAllListeners?: (event: string) => void
}

interface Props {
  data: object[]
  layout: object
  height: number
  label: string
  onClick?: (point: PlotPoint) => void
}

export default function Plot({ data, layout, height, label, onClick }: Props) {
  const ref = useRef<PlotlyElement>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    import('plotly.js-dist-min')
      .then(async ({ default: Plotly }) => {
        const el = ref.current
        if (cancelled || !el) return
        await Plotly.react(el, data, { height, ...layout }, {
          responsive: true,
          displaylogo: false,
          modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d', 'toggleSpikelines'],
        })
        el.removeAllListeners?.('plotly_click')
        if (onClick) el.on?.('plotly_click', (e) => e.points[0] && onClick(e.points[0]))
      })
      .catch(() => setError('The chart library failed to load.'))
    return () => {
      cancelled = true
    }
  }, [data, layout, height, onClick])

  useEffect(() => {
    const el = ref.current
    return () => {
      // Purge only if the element really left the page: in dev, StrictMode unmounts and remounts the
      // same element, and an async purge would otherwise erase the chart the remount just drew.
      if (el)
        void import('plotly.js-dist-min').then(({ default: Plotly }) => {
          if (!el.isConnected) Plotly.purge(el)
        })
    }
  }, [])

  return error ? <p className="error">{error}</p> : <div ref={ref} className="plot" role="img" aria-label={label} style={{ minHeight: height }} />
}
