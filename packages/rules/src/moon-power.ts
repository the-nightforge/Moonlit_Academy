/** Base moon power of round `round` (1-based) on a start/cap curve. */
export function baseMoonPower(
  curve: { start: number; cap: number },
  perRound: number,
  round: number,
): number {
  return Math.min(curve.cap, curve.start + (round - 1) * perRound);
}
