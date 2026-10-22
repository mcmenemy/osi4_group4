// Mirrors backend/app/scorecard.py.

export type State = 'met' | 'partial' | 'unknown' | 'fails'
export type RequirementKey = 'survival' | 'soft' | 'in_vivo_brain' | 'clear_degradable' | 'conductive'
export type SurvivalMeasure = 'viability' | 'occupancy' | 'retention' | 'neurite_outgrowth'

export interface Requirement {
  state: State
  source: 'extracted' | 'curated' | null
  records: string[]
  detail: string
  multiplier: number
  range?: string
  coverage?: 'all members' | 'some members' | 'no members'
  members_met?: number
  members_measured?: number
  verified?: boolean
}

export interface BestSurvival {
  value: number | null
  measure: SurvivalMeasure
  setting: string | null
  cell_category: string | null
  culture_days: number | null
  is_neuron: boolean
  record_id: string
  evidence: string | null
  location: string | null
  label: string
}

export interface BreakdownTerm {
  requirement: RequirementKey
  label: string
  weight: number
  state: State
  state_value: number
  multiplier: number
  points: number
}

export interface CuratedFact {
  value: string
  citation: string | null
  verified?: boolean
  note?: string
}

export interface ScoreRow {
  material_key: string
  label: string
  material_class: string
  note: string | null
  curated: {
    transparency: CuratedFact | null
    degradable: CuratedFact | null
    literature_typical_stiffness_kpa: { range: [number, number]; citation: string; verified?: boolean; method?: string; note?: string } | null
  }
  requirements: Record<RequirementKey, Requirement>
  unknown_count: number
  best_survival: BestSurvival | null
  record_ids: string[]
  record_count: number
  neuron_record_count: number
  paper_count: number
  paper_bonus: number
  score: number
  breakdown: BreakdownTerm[]
}

export interface Scorecard {
  weights: Record<RequirementKey, number>
  default_weights: Record<RequirementKey, number>
  requirements: { key: RequirementKey; label: string }[]
  baseline: ScoreRow | null
  ranked: ScoreRow[]
  no_neuron_evidence: ScoreRow[]
  summary: { materials: number; ranked_materials: number; neuron_records: number; unknown_cells: number }
}

export const STATE_ORDER: Record<State, number> = { met: 3, partial: 2, unknown: 1, fails: 0 }

export const SHORT_LABELS: Record<RequirementKey, string> = {
  survival: 'Survival ≥3 wk',
  soft: '≤100 kPa',
  in_vivo_brain: 'In vivo brain',
  clear_degradable: 'Clear & degradable',
  conductive: 'Conductive',
}
