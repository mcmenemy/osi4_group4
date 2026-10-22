// The biohybrid device from the flyer: a device holding engineered neurons
// whose axons grow down into the patient's cortex. Decorative only.
const NEURONS = [180, 260, 340]

export default function BiohybridArt() {
  return (
    <svg className="biohybrid-art" viewBox="0 0 520 380" aria-hidden="true">
      <g className="art-device">
        <rect x="110" y="30" width="300" height="150" rx="6" />
        <text x="122" y="52">biohybrid device</text>
        <rect className="art-unknown" x="150" y="66" width="220" height="60" rx="4" />
        <text className="art-question" x="260" y="108">?</text>
      </g>

      {NEURONS.map((x, i) => (
        <g key={x} className="art-neuron">
          <path
            className="art-axon"
            d={`M${x} 160 C ${x - 14} 210, ${x + 18} 240, ${x - 6 + i * 6} 300`}
          />
          <path className="art-axon" d={`M${x} 160 C ${x + 10} 200, ${x + 34} 230, ${x + 30} 290`} />
          <path className="art-axon" d={`M${x} 160 C ${x - 8} 200, ${x - 36} 230, ${x - 34} 296`} />
          <circle cx={x} cy="150" r="13" />
        </g>
      ))}
      <line className="art-leader" x1="355" y1="150" x2="420" y2="160" />
      <text className="art-label" x="426" y="164">neurons</text>

      <path
        className="art-brain"
        d="M0 290 C 40 250, 80 300, 120 266 S 200 250, 240 272 S 320 246, 360 270 S 440 250, 480 272 S 520 262, 520 262 L 520 380 L 0 380 Z"
      />
      <path className="art-fold" d="M90 300 q 20 20 10 60" />
      <path className="art-fold" d="M300 290 q -16 30 4 70" />
      <path className="art-fold" d="M440 300 q 14 24 0 60" />
      <text className="art-label" x="16" y="364">patient's brain</text>
    </svg>
  )
}
