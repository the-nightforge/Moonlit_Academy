export function nextRandom(rngState: number): { value: number; rngState: number } {
  const nextState = (rngState + 0x6d2b79f5) | 0;
  let t = nextState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, rngState: nextState };
}

export function shuffle<T>(items: readonly T[], rngState: number): { items: T[]; rngState: number } {
  const result = [...items];
  let state = rngState;
  for (let i = result.length - 1; i > 0; i--) {
    const roll = nextRandom(state);
    state = roll.rngState;
    const j = Math.floor(roll.value * (i + 1));
    const tmp = result[i]!;
    result[i] = result[j]!;
    result[j] = tmp;
  }
  return { items: result, rngState: state };
}
