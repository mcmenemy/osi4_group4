// Organic artificial neuron (OAN) model, after Sarkar et al., "An organic artificial
// spiking neuron for in situ neuromorphic sensing and biointerfacing", Nat. Electron.
// 5, 774–783 (2022), Supplementary Figs. 1–8.
//
// Circuit: Vin → load R → node V (load capacitor C to ground) → OEND to ground.
// OEND = R1 in series with two parallel paths: (T1 channel + R2) and (T2 channel).
//   T1: depletion-mode PEDOT:PSS OECT, gated by the voltage across R1 (I·R1).
//   T2: enhancement-mode p(g2T-TT) OECT, gated by T1's drain-source voltage.
// When T1 turns off, its V_DS rises and turns T2 on, so current jumps to the low-
// resistance path. That positive feedback gives the S-shaped NDR, and with the load
// RC the node relaxes back and forth across it: spiking.
//
// Channel conductance uses the Bernards–Malliaras linear regime,
//   g = μC* · (W·d / L) · (gate overdrive),
// and each gate charges through the electrolyte with τ = C*·W·L·d · R_ion.
// This is a phenomenological reconstruction, not the authors' simulation: the SI
// gives thresholds and resistors but not every transistor parameter, so T2's
// effective threshold and both μC* values are calibrated to the published firing
// window (≈1.7–1.8 V) and power (≈143 µW at C = 10 µF).

export interface Transistor {
  muC: number // μC*, F cm⁻¹ V⁻¹ s⁻¹
  vth: number // threshold, V
}

export interface OanParams {
  t1: Transistor
  t2: Transistor
  widthUm: number
  lengthUm: number
  thicknessNm: number
  cStar: number // volumetric capacitance, F cm⁻³ (sets the ionic time constant)
  r1: number // Ω
  r2: number // Ω
  rLoad: number // Ω
  cLoad: number // F
  vin: number // V
  naclMm: number // electrolyte concentration
  dopamineShift: number // V, lowers T1's threshold
}

export const SARKAR_2022: OanParams = {
  t1: { muC: 50, vth: 0.6 },
  t2: { muC: 200, vth: 0.2 },
  widthUm: 50,
  lengthUm: 20,
  thicknessNm: 100,
  cStar: 39,
  r1: 6e3,
  r2: 10e3,
  rLoad: 10e3,
  cLoad: 1e-6,
  vin: 1.8,
  naclMm: 100,
  dopamineShift: 0,
}

// Electrolyte resistance at 100 mM; scales as 1/concentration.
const R_ION_100MM = 20e3
// Nernst-like threshold shift with cation concentration, V per decade.
const NERNST_SLOPE = 0.059
const SOFTNESS = 0.03

function softplus(x: number): number {
  const s = x / SOFTNESS
  return s > 30 ? x : SOFTNESS * Math.log1p(Math.exp(s))
}

interface Derived {
  k1: number
  k2: number
  vth1: number
  tau: number
}

function derive(p: OanParams): Derived {
  // W·d/L in cm (μm → cm is 1e-4, nm → cm is 1e-7).
  const geom = (p.widthUm * 1e-4 * p.thicknessNm * 1e-7) / (p.lengthUm * 1e-4)
  const volume = p.widthUm * 1e-4 * p.lengthUm * 1e-4 * p.thicknessNm * 1e-7
  return {
    k1: p.t1.muC * geom,
    k2: p.t2.muC * geom,
    vth1: p.t1.vth - NERNST_SLOPE * Math.log10(p.naclMm / 100) - p.dopamineShift,
    tau: p.cStar * volume * R_ION_100MM * (100 / p.naclMm),
  }
}

// OEND current and the two gate drives, for node voltage v and gate states y1, y2.
function oend(v: number, y1: number, y2: number, p: OanParams, d: Derived) {
  const g1 = d.k1 * softplus(d.vth1 - y1) + 1e-9
  const g2 = d.k2 * softplus(y2 - p.t2.vth)
  const rPath1 = 1 / g1 + p.r2
  const i = v / (p.r1 + 1 / (1 / rPath1 + g2))
  const vB = v - i * p.r1
  return { i, vg1: i * p.r1, vds1: vB / rPath1 / g1 }
}

export interface Trace {
  tMs: number[]
  iUa: number[] // OEND output current, µA
  v: number[]
}

export interface Simulation {
  trace: Trace
  rateHz: number
  powerUw: number
  spiking: boolean
}

const TRACE_POINTS = 600

export function simulate(p: OanParams, withTrace = true): Simulation {
  const d = derive(p)
  // Resolve both the load RC and the gates' ionic charging, which gives the hysteresis.
  const rEff = 1 / (1 / p.rLoad + 1 / p.r1)
  const dt = Math.min(p.cLoad * rEff, d.tau) / 10
  const duration = Math.min(Math.max(0.3, 60 * p.cLoad * p.rLoad), 3)
  const n = Math.ceil(duration / dt)
  const decay = Math.exp(-dt / d.tau)
  const settle = Math.floor(n / 3)

  let v = 0
  let y1 = 0
  let y2 = 0
  const cur = new Float64Array(n - settle)
  const volt = new Float64Array(n - settle)
  let powerSum = 0
  for (let k = 0; k < n; k++) {
    const o = oend(v, y1, y2, p, d)
    v += (dt * ((p.vin - v) / p.rLoad - o.i)) / p.cLoad
    y1 = o.vg1 + (y1 - o.vg1) * decay
    y2 = o.vds1 + (y2 - o.vds1) * decay
    if (k >= settle) {
      cur[k - settle] = o.i
      volt[k - settle] = v
      powerSum += (p.vin / p.rLoad) * (p.vin - v)
    }
  }

  let lo = Infinity
  let hi = -Infinity
  for (const i of cur) {
    lo = Math.min(lo, i)
    hi = Math.max(hi, i)
  }
  const mid = (lo + hi) / 2
  let spikes = 0
  if (hi - lo > 0.2 * hi) {
    for (let k = 1; k < cur.length; k++) if (cur[k - 1] < mid && cur[k] >= mid) spikes++
  }
  const window = cur.length * dt

  const trace: Trace = { tMs: [], iUa: [], v: [] }
  if (withTrace) {
    // Show the last ~8 cycles (or 200 ms when quiet), downsampled for drawing.
    const span = Math.min(cur.length, spikes > 0 ? Math.ceil((8 / (spikes / window)) / dt) : Math.ceil(0.2 / dt))
    const start = cur.length - span
    const step = Math.max(1, Math.floor(span / TRACE_POINTS))
    for (let k = start; k < cur.length; k += step) {
      trace.tMs.push((k - start) * dt * 1e3)
      trace.iUa.push(cur[k] * 1e6)
      trace.v.push(volt[k])
    }
  }

  return {
    trace,
    rateHz: spikes / window,
    powerUw: (powerSum / cur.length) * 1e6,
    spiking: spikes > 0,
  }
}

// Static V(I) characteristic (gates at equilibrium), the S-shaped curve.
export function staticCurve(p: OanParams, points = 160): { iUa: number[]; v: number[] } {
  const d = derive(p)
  const iMax = (2.2 * Math.max(d.vth1, 0.05)) / p.r1
  const out = { iUa: [] as number[], v: [] as number[] }
  for (let k = 1; k <= points; k++) {
    const i = (iMax * k) / points
    const g1 = d.k1 * softplus(d.vth1 - i * p.r1) + 1e-9
    const rPath1 = 1 / g1 + p.r2
    // Current through the parallel pair grows monotonically with v_B: bisect.
    let lo = 0
    let hi = 50
    for (let it = 0; it < 60; it++) {
      const vB = (lo + hi) / 2
      const f = vB * (1 / rPath1 + d.k2 * softplus(vB / rPath1 / g1 - p.t2.vth)) - i
      if (f > 0) hi = vB
      else lo = vB
    }
    out.iUa.push(i * 1e6)
    out.v.push(lo + i * p.r1)
  }
  return out
}

// Range of Vin over which the neuron spikes. The load line can only cut the NDR
// branch of the static curve for Vin in a narrow band, so scan just that band.
export function firingWindow(p: OanParams, step = 0.01): [number, number] | null {
  const sc = staticCurve(p)
  let from = Infinity
  let to = -Infinity
  for (let k = 1; k < sc.v.length; k++) {
    if (sc.v[k] < sc.v[k - 1]) {
      const vin = sc.v[k] + sc.iUa[k] * 1e-6 * p.rLoad
      from = Math.min(from, vin)
      to = Math.max(to, vin)
    }
  }
  if (!Number.isFinite(from)) return null
  let lo: number | null = null
  let hi: number | null = null
  for (let vin = from - 0.05; vin <= to + 0.05; vin += step) {
    if (simulate({ ...p, vin }, false).spiking) {
      lo ??= vin
      hi = vin
    }
  }
  return lo === null || hi === null ? null : [lo, hi]
}
