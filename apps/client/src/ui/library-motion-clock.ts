const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** Zero slope and acceleration at the ends of the opacity envelope. */
export function libraryFade(value: number): number {
  const t = clamp(value);
  return clamp(t * t * t * (t * (t * 6 - 15) + 10));
}

/** Monotone Hermite phases share one tangent at the authored impact frame. */
export function libraryFramePosition(elapsed: number, duration: number, peakAt: number, count: number, peak: number): number {
  const total = Math.max(1, duration), time = Math.max(0, Math.min(total, elapsed));
  const beat = Math.max(0, Math.min(total, peakAt)), last = Math.max(0, count - 1);
  const middle = Math.max(0, Math.min(last, peak));
  const before = beat ? middle / beat : 0, after = beat < total ? (last - middle) / (total - beat) : 0;
  const w0 = 2 * (total - beat) + beat, w1 = total - beat + 2 * beat;
  const tangent = before > 0 && after > 0 ? (w0 + w1) / (w0 / before + w1 / after) : 0;
  const first = time <= beat && beat > 0;
  const length = first ? beat : Math.max(1, total - beat), t = clamp((time - (first ? 0 : beat)) / length);
  const t2 = t * t, t3 = t2 * t;
  const from = first ? 0 : middle, to = first ? middle : last;
  const startSlope = first ? 0 : tangent, endSlope = first ? tangent : 0;
  return Math.max(0, Math.min(last, (2 * t3 - 3 * t2 + 1) * from + (t3 - 2 * t2 + t) * length * startSlope
    + (-2 * t3 + 3 * t2) * to + (t3 - t2) * length * endSlope));
}
