export type Verdict = 'met' | 'partial' | 'unclear' | 'not_met'

export interface CriterionResult {
  id: string
  name: string
  core: boolean
  verdict: Verdict
  reasoning: string
  /** How many runs gave each verdict (presets are judged several times). */
  votes: Partial<Record<Verdict, number>>
  /** Share of runs that gave the consensus verdict (1 = all agreed). */
  agreement: number
}

export interface FrameworkResult {
  id: string
  name: string
  score: number
  summary: string
  criteria: CriterionResult[]
}

export interface ScoreResult {
  is_substrate: boolean
  interpretation: string
  frameworks: FrameworkResult[]
  maintainability: FrameworkResult
  combined_support: number
  frameworks_supporting: number
  /** Independent Claude runs behind this result, and on how many criteria they all agreed. */
  runs: number
  unanimous: number
  criteria_total: number
  model: string
  rubric_version?: string
  scored_at?: string
}

export interface Preset {
  id: string
  name: string
  description: string
  result: ScoreResult | null
}

export interface RubricCriterion {
  id: string
  name: string
  question: string
  core: boolean
}

export interface RubricFramework {
  id: string
  name: string
  claim: string
  reference: string
  criteria: RubricCriterion[]
}

export interface Rubric {
  version: string
  verdict_points: Record<Verdict, number>
  max_score: number
  frameworks: RubricFramework[]
  maintainability: RubricFramework
}

/** fetch() that throws the API's error message on a non-2xx response. */
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  let data: unknown = null
  try {
    data = await response.json()
  } catch {
    // Non-JSON error page (e.g. the backend isn't running); handled below.
  }
  if (!response.ok) {
    const detail = (data as { detail?: unknown } | null)?.detail
    throw new Error(
      typeof detail === 'string' ? detail : `Request failed (${response.status}). Is the backend running?`,
    )
  }
  return data as T
}

// --- Neuron-loss simulation ---

export interface TeValue {
  bits: number | null
  null_95: number | null
  significant: boolean
  /** Precomputed results only: in how many seeds it was significant. */
  significant_seeds?: number
}

export interface SimLevel {
  host_lost: number
  alive: Record<string, number>
  rates_hz: Record<string, number>
  input_gain: number | null
  accuracy: number
  /** Precomputed results only: standard deviation across seeds. */
  accuracy_sd?: number
  accuracy_implant: number | null
  accuracy_implant_sd?: number | null
  te: { host_to_implant: TeValue; implant_to_host: TeValue; bin_ms: number; history_bins: number } | null
  phi: {
    nodes: string[]
    cm: number[][]
    mean_phi_s: number
    implant_in_complex: number
    host_in_complex: number
    top_complex: string
    states_observed: number
    states_analyzed: number
    coverage: number
    bin_ms: number
  }
}

export interface SimResult {
  id: string
  name: string
  settings: { reciprocity: number; timescale: number }
  chance: number
  n_trials: number
  levels: SimLevel[]
  retained_function: number
  /** Precomputed results only: standard deviation across seeds, and which seeds. */
  retained_sd?: number
  seeds?: number[]
  feedback: boolean
  total_ms: number
}

export interface SimExample {
  id: string
  name: string
  description: string
  sizes: Record<string, number>
  taus_ms: Record<string, number>
  projections: { pre: string; post: string; p: number; w_mv: number }[]
  feedback: boolean
  result: SimResult | null
}

export interface SweepCell {
  reciprocity: number
  timescale: number
  retained: Record<string, number>
  ranking: string[]
}

export interface Sweep {
  reciprocity: number[]
  timescale: number[]
  seeds: number
  cells: SweepCell[]
  summary: {
    default_ranking: string[]
    same_ranking: number
    same_winner: number
    beats_no_implant: Record<string, number>
    winners: Record<string, number>
    mean_rank: Record<string, number>
    total: number
  }
}

export interface MicrowellCell {
  survival: number
  outgrowth: number
  conductive: boolean
  retained: number
  retained_sd: number
  accuracy: number[]
  graft_rate_hz: number | null
}

export interface Microwell {
  survival: number[]
  outgrowth: number[]
  seeds: number
  cells: MicrowellCell[]
  bare: MicrowellCell & {
    reference: {
      citation: string
      url: string
      occupancy_at_loading: number
      occupancy_at_3_weeks: number
    }
  }
}

export interface SimOverview {
  examples: SimExample[]
  sweep: Sweep | null
  microwell: Microwell | null
  task: {
    dropout: number[]
    chance: number
    stim_ms: number
    readout_ms: number[]
    n_classes: number
    trials: number
    example_seeds: number
    sweep_seeds: number
  }
  live: { reciprocity: number[]; timescale: number[]; phi_max_states: number }
}
