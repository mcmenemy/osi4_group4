import { useState, type FormEvent } from 'react'

// PyPhi package check: integrated information (IIT 4.0) for a small binary network.

type Source = 'iit4_fig1a' | 'grid3' | 'basic' | 'random'

type PhiResult = {
  pyphi_version: string
  formalism: string
  title: string
  nodes: string[]
  cm: number[][]
  state: number[]
  phi_s: number
  intrinsic_information: number
  mip: { parts: string[][]; cut_edges: [string, string][] } | null
  full: boolean
  big_phi: number | null
  sum_phi_distinctions: number | null
  sum_phi_relations: number | null
  n_distinctions: number | null
  distinctions: { mechanism: string; phi: number; cause: string; effect: string }[]
  elapsed_ms: number
}

type HistoryRow = { title: string; full: boolean; phi_s: number; big_phi: number | null; ms: number }

const SOURCES: { value: Source; label: string }[] = [
  { value: 'iit4_fig1a', label: 'IIT 4.0 paper, Fig. 1A (3 nodes)' },
  { value: 'grid3', label: 'Grid of 3 nodes' },
  { value: 'basic', label: 'OR / AND / XOR gates (3 nodes)' },
  { value: 'random', label: 'Random network' },
]
const MAX_FULL_NODES = 5

const fmt = (v: number | null) => (v === null ? '—' : v < 0.0005 && v > 0 ? v.toExponential(1) : v.toFixed(3))

export default function PhiCheck() {
  const [source, setSource] = useState<Source>('iit4_fig1a')
  const [nNodes, setNNodes] = useState(4)
  const [noise, setNoise] = useState(0.1)
  const [seed, setSeed] = useState(0)
  const [full, setFull] = useState(true)
  const [result, setResult] = useState<PhiResult | null>(null)
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const fullAllowed = source !== 'random' || nNodes <= MAX_FULL_NODES

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/phi/hello', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, n_nodes: nNodes, noise, seed, full: full && fullAllowed }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(typeof data.detail === 'string' ? data.detail : 'Check the input ranges.')
      }
      setResult(data)
      setHistory((rows) =>
        [{ title: data.title, full: data.full, phi_s: data.phi_s, big_phi: data.big_phi, ms: data.elapsed_ms }, ...rows].slice(0, 8),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="sim">
      <h2>Package check: PyPhi</h2>
      <p className="tagline">
        Computes integrated information (IIT 4.0) for a small binary network on the server, to confirm
        PyPhi works end to end and to see how run time grows with network size.
      </p>

      <form onSubmit={handleSubmit} className="sim-inputs">
        <label>
          Network
          <select value={source} onChange={(e) => setSource(e.target.value as Source)}>
            {SOURCES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>
        {source === 'random' && (
          <>
            <label>
              Nodes <span className="hint">3–7</span>
              <input type="number" min={3} max={7} value={nNodes}
                onChange={(e) => setNNodes(Number(e.target.value))} />
            </label>
            <label>
              Noise <span className="hint">0–0.5</span>
              <input type="number" min={0} max={0.5} step={0.05} value={noise}
                onChange={(e) => setNoise(Number(e.target.value))} />
            </label>
            <label>
              Seed
              <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} />
            </label>
          </>
        )}
        <label className="checkbox">
          <input type="checkbox" checked={full && fullAllowed} disabled={!fullAllowed}
            onChange={(e) => setFull(e.target.checked)} />
          Full structure (Φ, distinctions) <span className="hint">up to {MAX_FULL_NODES} nodes</span>
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Computing…' : 'Compute Φ'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {result && (
        <div className={loading ? 'sim-result stale' : 'sim-result'}>
          <dl className="stats">
            {[
              ['φ_s (system)', fmt(result.phi_s)],
              ['Φ (structure)', fmt(result.big_phi)],
              ['Distinctions', result.n_distinctions ?? '—'],
              ['Run time', `${Math.round(result.elapsed_ms)} ms`],
              ['PyPhi', `${result.pyphi_version} · ${result.formalism}`],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <p className="readout">
            {result.phi_s > 0
              ? 'φ_s > 0: no partition leaves the network unaffected, so under IIT 4.0 it exists as one integrated whole.'
              : 'φ_s = 0: cutting the network along the minimum partition makes no difference (or it specifies no intrinsic information), so under IIT 4.0 it does not exist as one whole. This is common in small networks.'}
          </p>

          <NetworkDiagram result={result} />

          {result.full && result.distinctions.length > 0 && (
            <div className="table-wrap">
              <table>
                <caption>
                  Top distinctions (uppercase = ON, lowercase = OFF). Σφ distinctions{' '}
                  {fmt(result.sum_phi_distinctions)} + Σφ relations {fmt(result.sum_phi_relations)} = Φ.
                </caption>
                <thead>
                  <tr><th>Mechanism</th><th>φ</th><th>Cause purview</th><th>Effect purview</th></tr>
                </thead>
                <tbody>
                  {result.distinctions.map((d) => (
                    <tr key={d.mechanism}>
                      <td>{d.mechanism}</td><td>{d.phi.toFixed(3)}</td><td>{d.cause}</td><td>{d.effect}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div className="table-wrap">
          <table>
            <caption>Run history (this browser)</caption>
            <thead>
              <tr><th>Network</th><th>Mode</th><th>φ_s</th><th>Φ</th><th>Time</th></tr>
            </thead>
            <tbody>
              {history.map((row, k) => (
                <tr key={k}>
                  <td>{row.title}</td><td>{row.full ? 'full' : 'φ_s only'}</td>
                  <td>{fmt(row.phi_s)}</td><td>{fmt(row.big_phi)}</td><td>{Math.round(row.ms)} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function NetworkDiagram({ result }: { result: PhiResult }) {
  const size = 260
  const center = size / 2
  const radius = 90
  const nodeR = 18
  const n = result.nodes.length
  const pos = result.nodes.map((_, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / n
    return { x: center + radius * Math.cos(angle), y: center + radius * Math.sin(angle) }
  })
  const cut = new Set((result.mip?.cut_edges ?? []).map(([a, b]) => `${a}>${b}`))

  const edges = []
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (!result.cm[i][j]) continue
      const isCut = cut.has(`${result.nodes[i]}>${result.nodes[j]}`)
      const className = isCut ? 'edge cut' : 'edge'
      if (i === j) {
        // Self-loop: a small circle on the outside of the node.
        const dx = pos[i].x - center
        const dy = pos[i].y - center
        const len = Math.hypot(dx, dy) || 1
        edges.push(
          <circle key={`${i}-${j}`} className={className} cx={pos[i].x + (dx / len) * nodeR * 1.4}
            cy={pos[i].y + (dy / len) * nodeR * 1.4} r={nodeR * 0.6} fill="none" />,
        )
        continue
      }
      const dx = pos[j].x - pos[i].x
      const dy = pos[j].y - pos[i].y
      const len = Math.hypot(dx, dy)
      // Offset sideways so A→B and B→A don't overlap; stop short of the node circles.
      const ox = (-dy / len) * 4
      const oy = (dx / len) * 4
      edges.push(
        <line key={`${i}-${j}`} className={className} markerEnd={isCut ? 'url(#arrow-cut)' : 'url(#arrow)'}
          x1={pos[i].x + (dx / len) * nodeR + ox} y1={pos[i].y + (dy / len) * nodeR + oy}
          x2={pos[j].x - (dx / len) * (nodeR + 4) + ox} y2={pos[j].y - (dy / len) * (nodeR + 4) + oy} />,
      )
    }
  }

  return (
    <figure className="network">
      <figcaption>
        {result.title}: filled nodes are ON.
        {result.mip && result.mip.cut_edges.length > 0 &&
          ` Dashed connections are cut by the minimum partition {${result.mip.parts.map((p) => p.join('')).join(' | ')}}.`}
      </figcaption>
      <svg viewBox={`0 0 ${size} ${size}`} role="img"
        aria-label={`Network of ${n} nodes; ${result.mip?.cut_edges.length ?? 0} connections cut by the minimum partition`}>
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" className="arrowhead" />
          </marker>
          <marker id="arrow-cut" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" className="arrowhead cut" />
          </marker>
        </defs>
        {edges}
        {result.nodes.map((label, i) => (
          <g key={label}>
            <circle className={result.state[i] ? 'node on' : 'node'} cx={pos[i].x} cy={pos[i].y} r={nodeR} />
            <text className={result.state[i] ? 'node-label on' : 'node-label'} x={pos[i].x} y={pos[i].y + 4}
              textAnchor="middle">{label}</text>
          </g>
        ))}
      </svg>
    </figure>
  )
}
