import type { GameData, PullResult, Rarity } from "rules";
import { featuredEntry } from "rules";
import type { ProfileReply } from "../../account";
import { CURRENCY_LABELS } from "../../ui/theme";

export const RARITIES: readonly Rarity[] = ["legendary", "epic", "rare", "common"];
export const itemName = (data: GameData, id: string) => data.heroes[id]?.name ?? data.weapons[id]?.name ?? data.relics[id]?.name ?? id;
export const percent = (rate: number) => `${Math.round(rate * 1000) / 10}%`;

export interface HistoryEntry { bannerId: string; results: PullResult[]; createdAt: number }
export interface ResultCard { root: Phaser.GameObjects.Container; result: PullResult; width: number; height: number; revealed: boolean }
export type PullReply = ProfileReply & { results: PullResult[]; achievements: string[] };

/** Banner splash texture: featured banners get a per-hero splash, others use their own id art. */
export function splashKey(scene: Phaser.Scene, banner: GameData["banners"][string], featured: ReturnType<typeof featuredEntry>): string {
  const candidates = [
    featured ? `gacha:${banner.id}_${featured.heroId}` : "",
    `gacha:${banner.id}`,
    "gacha:altar",
    `gacha:${banner.kind}_banner`,
  ];
  return candidates.find(key => key !== "" && scene.textures.exists(key)) ?? "";
}

/** Scale to cover w×h then crop the overflow so the image stays centered. */
export function coverCrop(image: Phaser.GameObjects.Image, width: number, height: number) {
  const scale = Math.max(width / image.width, height / image.height);
  image.setScale(scale);
  image.setCrop((image.width - width / scale) / 2, (image.height - height / scale) / 2, width / scale, height / scale);
}

/** One-line outcome label under the item name on a revealed card / history row. */
export function outcomeText(result: PullResult): string {
  switch (result.outcome) {
    case "newHero": case "newWeapon": case "newRelic": return "MỚI!";
    case "constellation": return `Tinh Hồn ${result.constellation}`;
    case "moonStar": return `+${result.moonStar} ${CURRENCY_LABELS.moonStar}`;
    case "refinement": return `Tinh Luyện ${result.refinement}`;
    case "resonance": return `Cộng Minh ${result.resonance}`;
    case "maxed": return `+${result.moonStar} ${CURRENCY_LABELS.moonStar}\n+1 ${result.darkIron ? "Huyền Thiết" : "Nguyệt Trần"}`;
    default: { const exhaustive: never = result.outcome; return String(exhaustive); }
  }
}
