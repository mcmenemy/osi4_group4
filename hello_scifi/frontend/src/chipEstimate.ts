// Science Corp's chip has no viability measurement, only well occupancy at loading (in vitro, 24 h)
// and at ~3 weeks (in vivo). Their ratio estimates the share of loaded neurons still detected; the
// charts that plot it as a survival reference share this wording so the caveat stays the same.

export const chipEstimate = (loading: number, later: number) => (later / loading) * 100

export function chipNote(loading: number, later: number, days: number): { plain: string; hardcore: string } {
  const est = chipEstimate(loading, later).toFixed(0)
  return {
    plain: `* An estimate, not a direct measurement. Science Corp counted wells holding neurons: ${loading}% when the chip was loaded and ${later}% about three weeks after implantation in mice, so roughly ${est}% of the loaded neurons were still there (${later} ÷ ${loading}). Neurons that moved out of their wells or stopped glowing count as lost, so the real number may be higher. Their result comes from living brains over 3 weeks; most dots here come from a few days in a dish, which is an easier test.`,
    hardcore: `* Estimated, not a viability measurement: ${later}% of wells with fluorescent neurons at ~${days} d in vivo (n=13) ÷ ${loading}% of wells with DAPI+ cells at 24 h in vitro (n=23) ≈ ${est}% of loaded neurons still detected (Brown et al., bioRxiv 2024). The two counts come from different chips, so this is approximate. It is conservative: cells that migrated out of wells or lost reporter fluorescence count as lost, and it doesn't separate death from loss. It is an in vivo 3-week figure, while most points here are in vitro over days, so the comparison favors the gels.`,
  }
}
