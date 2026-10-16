import { nextRandom } from "rules";

/** Stable arena aliases survive history reads even for older records. */
export function rankedOpponentName(seed: number): string {
  const first = ["thanh", "truc", "bach", "han", "van", "lac", "da", "lam", "thien", "tu", "moc", "linh"];
  const last = ["phong", "lam", "son", "vu", "nguyet", "hai", "tran", "khe", "tuyet", "yen", "ha", "an"];
  const a = nextRandom(seed ^ 0x6e616d65);
  const b = nextRandom(a.rngState);
  const c = nextRandom(b.rngState);
  return `${first[Math.floor(a.value * first.length)]}_${last[Math.floor(b.value * last.length)]}${Math.floor(c.value * 900) + 100}`;
}
