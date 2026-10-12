import type { GameData, Profile, Rarity, SavedDeck, CardDef, WeaponDef, RelicDef } from "rules";
import { relicAt, upgradeCost, weaponAt } from "rules";
import { matchesDeckText } from "./deck-presentation";

export type EquipmentKind = "weapons" | "relics";
export interface EquipmentFilters {
  query: string;
  rarity: "all" | Rarity;
  ownership: "all" | "owned" | "locked" | "upgrade";
  sort: "owned" | "rarity" | "level" | "name";
}
const rarityOrder: Record<Rarity, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };
export const equipmentDefaults = (): EquipmentFilters => ({ query: "", rarity: "all", ownership: "all", sort: "owned" });
export const equipmentTag = (kind: EquipmentKind) => kind === "weapons" ? "Tinh Luyện" : "Cộng Minh";
export function equipmentLevel(profile: Profile, kind: EquipmentKind, id: string): number | undefined {
  return kind === "weapons" ? profile.weapons[id]?.refinement : profile.relics[id]?.resonance;
}
export function equipmentUpgrade(data: GameData, profile: Profile, kind: EquipmentKind, id: string, online: boolean, busy: boolean) {
  const level = equipmentLevel(profile, kind, id);
  const materialId = kind === "weapons" ? "darkIron" : "moonDust";
  const material = kind === "weapons" ? "Huyền Thiết" : "Nguyệt Trần";
  const cost = level === undefined ? null : upgradeCost(data, kind === "weapons" ? "weapon" : "relic", id, level);
  const have = profile.currencies[materialId], missing = cost === null ? 0 : Math.max(0, cost - have);
  const reason = level === undefined ? "Cần sở hữu trang bị trước khi nâng cấp."
    : cost === null ? "Đã đạt cấp tối đa."
    : busy ? "Đang nâng cấp…"
    : !online ? "Cần kết nối để nâng cấp."
    : missing ? `Thiếu ${missing} ${material}.`
    : `Nâng ${level} → ${level + 1} · Đủ nguyên liệu`;
  return { level, cost, have, missing, materialId, material, reason, enabled: cost !== null && !missing && online && !busy };
}
export function filterEquipment(data: GameData, profile: Profile, kind: EquipmentKind, filters: EquipmentFilters, online: boolean) {
  const definitions: (WeaponDef | RelicDef)[] = Object.values(data[kind]);
  return definitions.filter(def => {
    const owned = equipmentLevel(profile, kind, def.id) !== undefined;
    return matchesDeckText(filters.query, def.name)
      && (filters.rarity === "all" || filters.rarity === def.rarity)
      && (filters.ownership === "all" || filters.ownership === "owned" && owned || filters.ownership === "locked" && !owned
        || filters.ownership === "upgrade" && equipmentUpgrade(data, profile, kind, def.id, online, false).enabled);
  }).sort((a, b) => {
    const levelA = equipmentLevel(profile, kind, a.id), levelB = equipmentLevel(profile, kind, b.id);
    const primary = filters.sort === "owned" ? Number(levelB !== undefined) - Number(levelA !== undefined)
      : filters.sort === "rarity" ? rarityOrder[b.rarity] - rarityOrder[a.rarity]
      : filters.sort === "level" ? (levelB ?? 0) - (levelA ?? 0) : 0;
    return primary || a.name.localeCompare(b.name, "vi") || a.id.localeCompare(b.id);
  });
}
export function initialEquipmentId(data: GameData, profile: Profile, kind: EquipmentKind, previous = ""): string {
  return data[kind][previous]?.id ?? Object.keys(data[kind]).find(id => equipmentLevel(profile, kind, id) !== undefined) ?? Object.keys(data[kind])[0] ?? "";
}
export function equipmentEffects(data: GameData, kind: EquipmentKind, id: string, level: number): { title: string; text: string; passive: string; card?: CardDef } {
  if (kind === "relics") return { title: `Cộng Minh ${level}`, text: relicAt(data.relics[id]!, level).text, passive: "" };
  const def = data.weapons[id]!, resolved = weaponAt(def, level);
  // Refinement prose may describe only a changed frequency or signature effect.
  // Keep its base context and clearly label updates instead of claiming a partial sentence is the full passive.
  const changes = def.refinement.slice(0, level - 1).flatMap((change, index) => change.hooks !== undefined || change.signatureHooks !== undefined ? [`Tinh Luyện ${index + 2}: ${change.text}`] : []);
  return { title: resolved.card.name, text: resolved.card.text, passive: [def.text, ...changes].join("\n"), card: { ...resolved.card, id } };
}
export function equipmentDecks(decks: readonly SavedDeck[], kind: EquipmentKind, id: string): SavedDeck[] {
  return decks.filter(deck => kind === "weapons" ? Object.values(deck.weapons ?? {}).includes(id) : deck.relicIds?.includes(id));
}
