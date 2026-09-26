import type { GameData, Profile } from "../types/index";
import { checkAchievements, recordProgress } from "./economy";
import { grantHeroItem } from "./gacha";

/** Buys a moon star shop item (`14` §11); `heroId` picks the hero of a hero choice. */
export function buyShopItem(
  data: GameData,
  profile: Profile,
  itemId: string,
  now: number,
  heroId?: string,
): { ok: true; profile: Profile; achievements: string[] } | { ok: false; error: string } {
  const item = data.economyConfig.moonStarShop.find((entry) => entry.id === itemId);
  if (!item) return { ok: false, error: "unknown item" };
  // Rolls the week first, so last week's purchases no longer count.
  const next = recordProgress(data, profile, now, {}).profile;
  if ((next.shop.bought[itemId] ?? 0) >= item.limitPerWeek) return { ok: false, error: "weekly limit" };
  if (next.currencies.moonStar < item.price) return { ok: false, error: "not enough moonStar" };
  switch (item.item.type) {
    case "moonJade":
      next.currencies.moonJade += item.item.amount;
      break;
    case "heroChoice": {
      if (heroId === undefined) return { ok: false, error: "hero required" };
      const hero = data.heroes[heroId];
      if (!hero || hero.rarity !== item.item.rarity || next.heroes[heroId]) return { ok: false, error: "invalid hero" };
      grantHeroItem(data, next, heroId);
      break;
    }
    default: {
      const exhaustive: never = item.item;
      throw new Error(`unknown shop item: ${JSON.stringify(exhaustive)}`);
    }
  }
  next.currencies.moonStar -= item.price;
  next.shop.bought[itemId] = (next.shop.bought[itemId] ?? 0) + 1;
  return checkAchievements(data, next);
}
