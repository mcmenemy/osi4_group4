// Mirrors backend/app/schemas.py. Keep the two in sync.

export type Confidence = 'low' | 'medium' | 'high'
export type MaterialClass =
  | 'conductive_hydrogel'
  | 'nonconductive_hydrogel'
  | 'omiec_film'
  | 'oect_device'
  | 'biohybrid_device'
  | 'other'
export type Setting = 'in_vitro_2d' | 'in_vitro_3d' | 'in_vivo'

export interface FieldValue {
  value: number | string | null
  unit: string | null
  value_si: number | null
  evidence: string | null
  location: string | null
  confidence: Confidence | null
  test_method?: string | null
  evidence_verified: boolean | null
}

export interface OtherOutcome extends FieldValue {
  name: string
}

export interface SurvivalValue extends FieldValue {
  measure: 'viability' | 'occupancy' | 'retention' | 'neurite_outgrowth'
  timepoint: string | null
  culture_days: number | null
  setting: Setting | null
}

export interface Source {
  doi: string | null
  title: string | null
  first_author: string | null
  year: number | null
  url: string | null
  file: string | null
}

export interface FormulationItem {
  component: string
  amount: string | null
  unit: string | null
  evidence: string | null
  evidence_verified: boolean | null
}

export interface ProcessingStep {
  step: string
  parameter: string | null
  value: string | null
  unit: string | null
  evidence: string | null
  evidence_verified: boolean | null
}

export interface Stability {
  description: FieldValue | null
  duration_days: FieldValue | null
  conditions: string | null
}

export interface Properties {
  youngs_modulus: FieldValue | null
  conductivity: FieldValue | null
  water_content: FieldValue | null
  swelling_ratio: FieldValue | null
  impedance_1khz: FieldValue | null
  electrode_area: FieldValue | null
  volumetric_capacitance: FieldValue | null
  mu_c_star: FieldValue | null
  ionic_time_constant: FieldValue | null
  degradation_time?: FieldValue | null
  stability: Stability | null
}

export interface Biology {
  cell_type: string | null
  cell_category?: string | null
  species: string | null
  setting: Setting | null
  tissue_site?: 'brain' | 'spinal_cord' | 'peripheral_nerve' | 'other' | 'not_applicable' | null
  coating: string | null
  culture_days: FieldValue | null
  viability_percent: FieldValue | null
  neurite_length: FieldValue | null
  other_outcomes: OtherOutcome[]
  survival?: SurvivalValue[]
}

export interface MaterialRecord {
  record_id: string
  source: Source
  material_class: MaterialClass
  material: string
  material_key?: string | null
  electrode_material?: string | null
  formulation: FormulationItem[]
  processing: ProcessingStep[]
  properties: Properties
  biology: Biology | null
  notes: string | null
  flags: string[]
  extraction_model: string | null
  extracted_at: string | null
  schema_version: string
}

export interface StiffnessReference {
  id: string
  label: string
  kind: 'tissue' | 'rigid' | 'hydrogel'
  test_method?: string
  url?: string
  modulus_pa: [number, number]
  conductivity_s_m: [number, number] | null
  status: string
  citation: string
}

export interface ScienceReference {
  label: string
  material: string
  neurons: string
  occupancy_at_loading_percent: number
  occupancy_at_3_weeks_percent: number
  days: number
  measure: string
  outcome: string
  cells?: string
  modulus_ref: string
  status: string
  citation: string
  url: string
}

export interface References {
  stiffness: StiffnessReference[]
  science_corp: ScienceReference
}

export interface TargetWindow {
  label: string
  modulus_pa: [number, number]
  conductivity_s_m: [number, number]
  note: string
}

// `plain` is the Normal-mode name (see mode.ts).
export const MATERIAL_CLASSES: { key: MaterialClass; label: string; plain: string }[] = [
  { key: 'conductive_hydrogel', label: 'Conductive hydrogel', plain: 'Conductive gel' },
  { key: 'nonconductive_hydrogel', label: 'Non-conductive hydrogel', plain: 'Gel' },
  { key: 'omiec_film', label: 'OMIEC film', plain: 'Conductive plastic film' },
  { key: 'oect_device', label: 'OECT device', plain: 'Transistor device' },
  { key: 'biohybrid_device', label: 'Biohybrid device', plain: 'Living-cell device' },
  { key: 'other', label: 'Other', plain: 'Other' },
]

export const classLabel = (c: MaterialClass, plain = false) => {
  const m = MATERIAL_CLASSES.find((x) => x.key === c)
  return m ? (plain ? m.plain : m.label) : c
}

export const SETTING_LABELS: Record<Setting, string> = {
  in_vitro_2d: 'In vitro 2D',
  in_vitro_3d: 'In vitro 3D',
  in_vivo: 'In vivo',
}

// Every value-bearing field of a record, with a stable path (used by Review edits) and label.
export interface FieldEntry {
  path: string
  label: string
  normalizedUnit: string
  field: FieldValue
}

const PROPERTY_FIELDS: { key: keyof Omit<Properties, 'stability'>; label: string; unit: string }[] = [
  { key: 'youngs_modulus', label: "Young's modulus", unit: 'Pa' },
  { key: 'conductivity', label: 'Conductivity', unit: 'S/m' },
  { key: 'water_content', label: 'Water content', unit: '%' },
  { key: 'swelling_ratio', label: 'Swelling ratio', unit: '' },
  { key: 'impedance_1khz', label: 'Impedance at 1 kHz', unit: 'Ω' },
  { key: 'electrode_area', label: 'Electrode area', unit: 'm²' },
  { key: 'volumetric_capacitance', label: 'Volumetric capacitance C*', unit: 'F/cm³' },
  { key: 'mu_c_star', label: 'μC*', unit: 'F cm⁻¹ V⁻¹ s⁻¹' },
  { key: 'ionic_time_constant', label: 'Ionic time constant', unit: 's' },
  { key: 'degradation_time', label: 'Degradation time', unit: 'days' },
]

export const TEST_METHOD_LABELS: Record<string, string> = {
  compression: 'compression',
  tension: 'tension',
  shear_rheology: "shear rheology (G′)",
  indentation_afm: 'indentation / AFM',
  dma: 'DMA',
  other: 'other method',
}

export const methodLabel = (m?: string | null) => (m ? (TEST_METHOD_LABELS[m] ?? m) : null)

const BIOLOGY_FIELDS: { key: 'culture_days' | 'viability_percent' | 'neurite_length'; label: string; unit: string }[] = [
  { key: 'culture_days', label: 'Culture time', unit: 'days' },
  { key: 'viability_percent', label: 'Viability', unit: '%' },
  { key: 'neurite_length', label: 'Neurite length', unit: 'm' },
]

export function fieldEntries(r: MaterialRecord): FieldEntry[] {
  const out: FieldEntry[] = []
  for (const p of PROPERTY_FIELDS) {
    const f = r.properties[p.key]
    if (f) out.push({ path: `properties.${p.key}`, label: p.label, normalizedUnit: p.unit, field: f })
  }
  const st = r.properties.stability
  if (st?.description)
    out.push({ path: 'properties.stability.description', label: 'Stability', normalizedUnit: '', field: st.description })
  if (st?.duration_days)
    out.push({ path: 'properties.stability.duration_days', label: 'Stability duration', normalizedUnit: 'days', field: st.duration_days })
  if (r.biology) {
    for (const b of BIOLOGY_FIELDS) {
      const f = r.biology[b.key]
      if (f) out.push({ path: `biology.${b.key}`, label: b.label, normalizedUnit: b.unit, field: f })
    }
    ;(r.biology.survival ?? []).forEach((sv, i) => {
      const where = [sv.setting && SETTING_LABELS[sv.setting], sv.culture_days != null && `${sv.culture_days} d`]
        .filter(Boolean)
        .join(', ')
      out.push({
        path: `biology.survival.${i}`,
        label: `Survival: ${sv.measure.replace('_', ' ')}${where ? ` (${where})` : ''}`,
        normalizedUnit: '%',
        field: sv,
      })
    })
    r.biology.other_outcomes.forEach((o, i) =>
      out.push({ path: `biology.other_outcomes.${i}`, label: o.name || 'Other outcome', normalizedUnit: '', field: o }),
    )
  }
  return out
}

// Coverage-heatmap columns: which kinds of measurement a record has.
export const COVERAGE_COLUMNS: { key: string; label: string; has: (r: MaterialRecord) => boolean }[] = [
  ...PROPERTY_FIELDS.filter((p) => p.key !== 'electrode_area').map((p) => ({
    key: p.key,
    label: p.label.replace(' at 1 kHz', ' (1 kHz)').replace('Volumetric capacitance C*', 'C*'),
    has: (r: MaterialRecord) => r.properties[p.key]?.value != null,
  })),
  { key: 'stability', label: 'Stability', has: (r) => r.properties.stability != null },
  { key: 'viability', label: 'Cell viability', has: (r) => r.biology?.viability_percent?.value != null },
  { key: 'neurite', label: 'Neurite length', has: (r) => r.biology?.neurite_length?.value != null },
  { key: 'in_vivo', label: 'In vivo test', has: (r) => r.biology?.setting === 'in_vivo' },
]

export function sourceLabel(s: Source): string {
  const who = s.first_author ? `${s.first_author}${s.year ? ` ${s.year}` : ''}` : (s.title ?? 'Unknown source')
  return who
}

export function sourceUrl(s: Source): string | null {
  return s.url ?? (s.doi ? `https://doi.org/${s.doi}` : null)
}

const PREFIXES: [number, string][] = [
  [1e9, 'G'],
  [1e6, 'M'],
  [1e3, 'k'],
  [1, ''],
  [1e-3, 'm'],
  [1e-6, 'µ'],
  [1e-9, 'n'],
]

// 2.4e6 Pa → "2.4 MPa"
export function withPrefix(value: number, unit: string): string {
  if (value === 0) return `0 ${unit}`
  const abs = Math.abs(value)
  const [factor, prefix] = PREFIXES.find(([f]) => abs >= f) ?? PREFIXES[PREFIXES.length - 1]
  const scaled = value / factor
  return `${Number(scaled.toPrecision(3))} ${prefix}${unit}`
}

export function formatSi(entry: FieldEntry): string | null {
  const v = entry.field.value_si
  if (v == null) return null
  if (entry.normalizedUnit === 'Pa' || entry.normalizedUnit === 'Ω') return withPrefix(v, entry.normalizedUnit)
  if (entry.normalizedUnit === 'm') return withPrefix(v, 'm')
  return `${Number(v.toPrecision(3))} ${entry.normalizedUnit}`.trim()
}

export function formatReported(f: FieldValue): string {
  return [f.value ?? '—', f.unit ?? ''].join(' ').trim()
}

export async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url} returned ${response.status}`)
  return response.json() as Promise<T>
}
