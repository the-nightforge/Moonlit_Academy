import type { GameData, Profile } from "../types/index";

export type UpgradeKind = "weapon" | "relic";
const MAX_GEAR_LEVEL = 5;

/** Material cost to take `id` from `level` to `level + 1`; null for unknown items or levels (`14` §13.3). */
export function upgradeCost(data: GameData, kind: UpgradeKind, id: string, level: number): number | null {
  const rarity = (kind === "weapon" ? data.weapons[id] : data.relics[id])?.rarity;
  if (rarity === undefined) return null;
  const row = data.economyConfig.upgradeCost[kind][rarity === "common" ? "rare" : rarity];
  return row[level - 1] ?? null;
}

/** Spends dark iron (weapons) or moon dust (relics) for one level (`18` §5.1). */
export function upgradeItem(
  data: GameData,
  profile: Profile,
  kind: UpgradeKind,
  id: string,
): { ok: true; profile: Profile; level: number; spent: number } | { ok: false; error: "not owned" | "maxed" | "not enough" } {
  const level = kind === "weapon" ? profile.weapons[id]?.refinement : profile.relics[id]?.resonance;
  const def = kind === "weapon" ? data.weapons[id] : data.relics[id];
  if (level === undefined || def === undefined) return { ok: false, error: "not owned" };
  if (level >= MAX_GEAR_LEVEL) return { ok: false, error: "maxed" };
  const cost = upgradeCost(data, kind, id, level);
  if (cost === null) return { ok: false, error: "not owned" };
  const currency = kind === "weapon" ? "darkIron" : "moonDust";
  if (profile.currencies[currency] < cost) return { ok: false, error: "not enough" };
  const next = JSON.parse(JSON.stringify(profile)) as Profile;
  next.currencies[currency] -= cost;
  if (kind === "weapon") next.weapons[id]!.refinement = level + 1;
  else next.relics[id]!.resonance = level + 1;
  return { ok: true, profile: next, level: level + 1, spent: cost };
}
