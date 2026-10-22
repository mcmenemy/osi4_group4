import { api, type Preset, type SimOverview } from './types'

// Each view asks for the data it needs; these share one request per endpoint.
let presets: Promise<Preset[]> | null = null
let sim: Promise<SimOverview> | null = null

export function loadPresets(): Promise<Preset[]> {
  presets ??= api<Preset[]>('/api/presets').catch((err) => {
    presets = null // let a later call retry
    throw err
  })
  return presets
}

export function loadSim(): Promise<SimOverview> {
  sim ??= api<SimOverview>('/api/sim').catch((err) => {
    sim = null
    throw err
  })
  return sim
}
