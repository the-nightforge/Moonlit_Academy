import { nextRandom } from "../../src/index";
import type { MatchRecord } from "./types";

/**
 * Statistical layer for balance reports (design §"Thống kê"). All estimators
 * are seeded — same records + same seed replay identical intervals.
 *
 * References:
 *  - Wilson score interval — NIST/SEMATECH e-Handbook §2.4.1 (no Wald at n=0/100%).
 *  - Paired cluster bootstrap / sign-flip — SciPy `bootstrap` paired resampling:
 *    blocks are resampled whole so AB/BA correlated legs stay together.
 */

export interface Interval {
  estimate: number;
  lower: number;
  upper: number;
  n: number;
}

const Z_95 = 1.959963984540054;

/** Wilson 95% score interval for a binary rate. n=0 → null (no estimate). */
export function wilson95(wins: number, n: number): Interval | null {
  if (n <= 0) return null;
  const p = wins / n;
  const z2 = Z_95 * Z_95;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (Z_95 * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return { estimate: p, lower: Math.max(0, center - half), upper: Math.min(1, center + half), n };
}

/** Numeric score per record — win 1 / draw 0.5 / loss 0; truncated & error are excluded. */
export function recordScore(record: MatchRecord): number | null {
  switch (record.outcome) {
    case "won": return 1;
    case "draw": return 0.5;
    case "lost": return 0;
    case "truncated":
    case "error": return null;
  }
}

interface SeededRng {
  state: number;
  next(): number;
}

function rng(seed: number): SeededRng {
  const box = { state: seed >>> 0, next: () => 0 };
  box.next = () => {
    const roll = nextRandom(box.state);
    box.state = roll.rngState;
    return roll.value;
  };
  return box;
}

function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

/** Mean score of one block's records — decisive + draw records only. */
function blockMean(records: readonly MatchRecord[]): number | null {
  const scores = records.map(recordScore).filter((s): s is number => s !== null);
  if (scores.length === 0) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

/** Paired blocks: mean(base) → mean(candidate) delta per shared blockId. */
export function pairedBlockDeltas(
  base: readonly MatchRecord[],
  candidate: readonly MatchRecord[],
): { deltas: number[]; pairedBlocks: number; unpaired: number } {
  const byBlock = (records: readonly MatchRecord[]) => {
    const map = new Map<string, MatchRecord[]>();
    for (const record of records) {
      const list = map.get(record.blockId) ?? [];
      list.push(record);
      map.set(record.blockId, list);
    }
    return map;
  };
  const baseBlocks = byBlock(base);
  const candidateBlocks = byBlock(candidate);
  const deltas: number[] = [];
  let unpaired = 0;
  for (const [blockId, baseRecords] of baseBlocks) {
    const candidateRecords = candidateBlocks.get(blockId);
    const b = blockMean(baseRecords);
    const c = candidateRecords === undefined ? null : blockMean(candidateRecords);
    if (candidateRecords === undefined || b === null || c === null) {
      unpaired += 1;
      continue;
    }
    deltas.push(c - b);
  }
  return { deltas, pairedBlocks: deltas.length, unpaired };
}

/**
 * Paired cluster bootstrap CI on the candidate−baseline score delta at the
 * given two-sided alpha (0.05 for 95%). Resamples whole blocks so both legs
 * of a mirrored pair move together. Deterministic for a fixed seed; null
 * when nothing pairs.
 */
export function blockDeltaInterval(
  base: readonly MatchRecord[],
  candidate: readonly MatchRecord[],
  seed: number,
  resamples: number,
  alpha: number,
): Interval | null {
  const { deltas, pairedBlocks } = pairedBlockDeltas(base, candidate);
  if (pairedBlocks === 0) return null;
  const mean = deltas.reduce((a, b) => a + b, 0) / pairedBlocks;
  if (pairedBlocks === 1) return { estimate: mean, lower: mean, upper: mean, n: 1 };
  const roll = rng(seed);
  const estimates: number[] = [];
  for (let r = 0; r < resamples; r++) {
    let sum = 0;
    for (let i = 0; i < pairedBlocks; i++) {
      sum += deltas[Math.floor(roll.next() * pairedBlocks)]!;
    }
    estimates.push(sum / pairedBlocks);
  }
  estimates.sort((a, b) => a - b);
  return {
    estimate: mean,
    lower: quantile(estimates, alpha / 2),
    upper: quantile(estimates, 1 - alpha / 2),
    n: pairedBlocks,
  };
}

/** Convenience wrapper for the standard 95% interval. */
export function pairedBlockDelta95(
  base: readonly MatchRecord[],
  candidate: readonly MatchRecord[],
  seed: number,
  resamples: number,
): Interval | null {
  return blockDeltaInterval(base, candidate, seed, resamples, 0.05);
}

/**
 * Two-sided paired sign-flip p-value (10000 seeded permutations suggested).
 * One random sign per block per permutation — the classic paired permutation
 * test; returns null when there is nothing to pair.
 */
export function signFlipDeltaP(
  base: readonly MatchRecord[],
  candidate: readonly MatchRecord[],
  seed: number,
  resamples: number,
): number | null {
  const { deltas, pairedBlocks } = pairedBlockDeltas(base, candidate);
  if (pairedBlocks === 0) return null;
  const observed = Math.abs(deltas.reduce((a, b) => a + b, 0) / pairedBlocks);
  const roll = rng(seed);
  let extreme = 0;
  for (let r = 0; r < resamples; r++) {
    let sum = 0;
    for (const delta of deltas) sum += roll.next() < 0.5 ? -delta : delta;
    if (Math.abs(sum / pairedBlocks) >= observed - 1e-12) extreme += 1;
  }
  return (extreme + 1) / (resamples + 1);
}

/**
 * Holm-adjusted p-values, returned in input order. Holm 1979: order the raw
 * p-values ascending, multiply rank i by (m − i + 1), then enforce monotonicity.
 */
export function holm(rawP: readonly number[]): number[] {
  const order = rawP.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
  const m = rawP.length;
  const adjusted = new Array<number>(m);
  let running = 0;
  for (let rank = 0; rank < m; rank++) {
    const scaled = Math.min(1, (m - rank) * order[rank]!.p);
    running = Math.max(running, scaled);
    adjusted[order[rank]!.i] = running;
  }
  return adjusted;
}

/** Plain 95% bootstrap CI on a mean of numbers (score series, round counts). */
export function meanBootstrap95(values: readonly number[], seed: number, resamples: number): Interval | null {
  if (values.length === 0) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (values.length === 1) return { estimate: mean, lower: mean, upper: mean, n: 1 };
  const roll = rng(seed);
  const estimates: number[] = [];
  for (let r = 0; r < resamples; r++) {
    let sum = 0;
    for (let i = 0; i < values.length; i++) sum += values[Math.floor(roll.next() * values.length)]!;
    estimates.push(sum / values.length);
  }
  estimates.sort((a, b) => a - b);
  return { estimate: mean, lower: quantile(estimates, 0.025), upper: quantile(estimates, 0.975), n: values.length };
}

export { quantile };
