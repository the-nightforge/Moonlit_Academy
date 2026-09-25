import { nextRandom } from "../rng";

/** Mutable cursor over a seeded RNG state, for multi-step generation. */
export interface Rng {
  state: number;
}

export function nextFloat(rng: Rng): number {
  const roll = nextRandom(rng.state);
  rng.state = roll.rngState;
  return roll.value;
}

export function pickOne<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error("pickOne: empty list");
  return items[Math.floor(nextFloat(rng) * items.length)]!;
}
