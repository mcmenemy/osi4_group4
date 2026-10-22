// Scans the design map off the main thread: for each (T1 threshold, T1 μC*) design,
// find its firing window, bias it at the window's center, and measure rate and power.
import { firingWindow, simulate, type OanParams } from './oan'

export interface MapRequest {
  params: OanParams
  vths: number[]
  muCs: number[]
}

export interface MapCell {
  windowMv: number
  rateHz: number
  powerUw: number
}

export interface MapRow {
  row: number
  cells: (MapCell | null)[]
}

self.onmessage = (event: MessageEvent<MapRequest>) => {
  const { params, vths, muCs } = event.data
  muCs.forEach((muC, row) => {
    const cells = vths.map((vth) => {
      const p = { ...params, t1: { muC, vth } }
      const w = firingWindow(p, 0.02)
      if (!w) return null
      const s = simulate({ ...p, vin: (w[0] + w[1]) / 2 }, false)
      return s.spiking ? { windowMv: (w[1] - w[0]) * 1000, rateHz: s.rateHz, powerUw: s.powerUw } : null
    })
    self.postMessage({ row, cells } satisfies MapRow)
  })
}
