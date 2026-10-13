import { monthKey, weekKey } from "rules";
import type { GameData, Profile, ShopItem } from "rules";
import type { Rarity } from "rules";
const RARITY_LABELS: Record<Rarity, string> = { common: "Common", rare: "Rare", epic: "Epic", legendary: "Legendary" };

export type ShopTab = "moon" | "honor";
export type ShopPick = { heroId?: string; relicId?: string };
export interface ShopChoice { id: string; name: string; art: string; outcome: string }
export interface ShopLimit { period: "week" | "month"; left: number; total: number }
export interface ShopOffer {
  id: string; type: ShopItem["type"];
  title: string; reward: string; icon: string; price: number; currency: "moonStar" | "honor";
  limits: ShopLimit[]; choices: ShopChoice[];
  status: "ready" | "sold-out" | "insufficient" | "owned-all" | "empty";
}

function choices(data: GameData, profile: Profile, item: ShopItem): ShopChoice[] {
  if (item.type === "heroChoice") {
    return Object.values(data.heroes)
      .filter(hero => hero.rarity === item.rarity && !profile.heroes[hero.id])
      .map(hero => ({ id: hero.id, name: hero.name, art: "heroes:" + hero.id, outcome: "Chưa sở hữu" }));
  }
  if (item.type === "relicChoice") {
    return Object.values(data.relics)
      .filter(relic => relic.rarity === item.rarity)
      .map(relic => {
        const level = profile.relics[relic.id]?.resonance ?? 0;
        const outcome = level === 0 ? "Chưa sở hữu"
          : level < 5 ? "Cộng Minh " + level + " → " + (level + 1)
          : "Cộng Minh tối đa · nhận " + data.economyConfig.gearDupeMoonStar[relic.rarity] + " Nguyệt Tinh";
        return { id: relic.id, name: relic.name, art: "relics:" + relic.id, outcome };
      });
  }
  return [];
}

function reward(item: ShopItem): string {
  if (item.type === "moonJade") return item.amount + " Nguyệt Ngọc";
  return "Chọn 1 " + (item.type === "heroChoice" ? "Hero " : "Nguyệt Bảo ") + RARITY_LABELS[item.rarity];
}

function offer(
  data: GameData, profile: Profile, id: string, item: ShopItem, price: number,
  currency: "moonStar" | "honor", limits: ShopLimit[],
): ShopOffer {
  const options = choices(data, profile, item);
  const title = reward(item);
  const status: ShopOffer["status"] = limits.some(limit => limit.left <= 0) ? "sold-out"
    : item.type === "heroChoice" && options.length === 0 ? "owned-all"
    : item.type === "relicChoice" && options.length === 0 ? "empty"
    : profile.currencies[currency] < price ? "insufficient" : "ready";
  return {
    id, type: item.type, title, reward: title,
    icon: item.type === "moonJade" ? "ui:cur_moonJade"
      : item.type === "heroChoice" ? "ui:nav_heroes" : "ui:nav_inventory",
    price, currency, limits, choices: options, status,
  };
}

/** One model for both shop tabs; counters from an old period do not reduce stock. */
export function shopOffers(data: GameData, profile: Profile, tab: ShopTab, now: number): ShopOffer[] {
  const currentWeek = weekKey(data, now), currentMonth = monthKey(data, now);
  if (tab === "moon") {
    return data.economyConfig.moonStarShop.map(entry => {
      const bought = profile.shop.weekKey === currentWeek ? profile.shop.bought[entry.id] ?? 0 : 0;
      return offer(data, profile, entry.id, entry.item, entry.price, "moonStar",
        [{ period: "week", left: Math.max(0, entry.limitPerWeek - bought), total: entry.limitPerWeek }]);
    });
  }
  return (data.pvpConfig.honorShop ?? []).map(entry => {
    const limits: ShopLimit[] = [];
    if (entry.limitPerWeek !== undefined) {
      const bought = profile.honorShop.weekKey === currentWeek ? profile.honorShop.bought[entry.id] ?? 0 : 0;
      limits.push({ period: "week", left: Math.max(0, entry.limitPerWeek - bought), total: entry.limitPerWeek });
    }
    if (entry.limitPerMonth !== undefined) {
      const bought = profile.honorShop.monthKey === currentMonth ? profile.honorShop.boughtMonth[entry.id] ?? 0 : 0;
      limits.push({ period: "month", left: Math.max(0, entry.limitPerMonth - bought), total: entry.limitPerMonth });
    }
    return offer(data, profile, entry.id, entry.item, entry.cost, "honor", limits);
  });
}

function validPick(offer: ShopOffer, pick: ShopPick): boolean {
  if (offer.type === "moonJade") return !pick.heroId && !pick.relicId;
  if (offer.type === "heroChoice") return !pick.relicId && !!pick.heroId && offer.choices.some(choice => choice.id === pick.heroId);
  return !pick.heroId && !!pick.relicId && offer.choices.some(choice => choice.id === pick.relicId);
}

export type ShopBuyResult<T> =
  | { status: "success"; reply: T; pick: ShopPick }
  | { status: "error"; error: unknown }
  | { status: "busy" | "cancelled" | "unavailable" };

/** Recheck stock, balance and choice after confirmation; one request per scene. */
export class ShopPurchaseFlow {
  phase: "idle" | "confirming" | "pending" = "idle";
  async buy<T>(data: GameData, tab: ShopTab, id: string, now: number, context: {
    profile: () => Profile; online: () => boolean; valid: () => boolean;
    confirm: () => Promise<ShopPick | false>;
    submit: (pick: ShopPick) => Promise<T>; changed?: () => void; now?: () => number;
  }): Promise<ShopBuyResult<T>> {
    if (this.phase !== "idle") return { status: "busy" };
    if (!context.valid()) return { status: "cancelled" };
    const currentOffer = () => shopOffers(data, context.profile(), tab, context.now?.() ?? now).find(x => x.id === id);
    if (!context.online() || currentOffer()?.status !== "ready") return { status: "unavailable" };
    this.phase = "confirming"; context.changed?.();
    try {
      const pick = await context.confirm();
      if (!context.valid() || pick === false) return { status: "cancelled" };
      const fresh = currentOffer();
      if (!context.online() || !fresh || fresh.status !== "ready" || !validPick(fresh, pick)) return { status: "unavailable" };
      this.phase = "pending"; context.changed?.();
      const reply = await context.submit(pick);
      return context.valid() ? { status: "success", reply, pick } : { status: "cancelled" };
    } catch (error) {
      return context.valid() ? { status: "error", error } : { status: "cancelled" };
    } finally {
      this.phase = "idle"; context.changed?.();
    }
  }
}
