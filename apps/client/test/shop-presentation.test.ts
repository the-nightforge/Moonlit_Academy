import { describe, expect, it } from "vitest";
import { loadGameData } from "data";
import { createProfile, weekKey, monthKey } from "rules";
import { shopOffers, ShopPurchaseFlow } from "../src/ui/shop-presentation";

const data = loadGameData();
const now = Date.parse("2026-10-13T10:00:00Z");
function profile() {
  const p = createProfile(data);
  p.currencies.moonStar = 200;
  p.currencies.honor = 1000;
  return p;
}

describe("shop offers", () => {
  it("shows both currencies, prices and the actual weekly and monthly stock", () => {
    const p = profile();
    p.shop.weekKey = weekKey(data, now);
    p.shop.bought.shop_pull = 1;
    p.honorShop.weekKey = weekKey(data, now);
    p.honorShop.monthKey = monthKey(data, now);
    p.honorShop.bought.honor_relic_rare = 1;
    const moon = shopOffers(data, p, "moon", now);
    const honor = shopOffers(data, p, "honor", now);
    expect(moon.map(x => [x.id, x.price, x.currency])).toEqual([
      ["shop_pull", 10, "moonStar"], ["shop_epic_hero", 120, "moonStar"],
    ]);
    expect(moon[0]?.limits).toEqual([{ period: "week", left: 1, total: 2 }]);
    expect(honor[1]?.limits).toEqual([{ period: "month", left: 1, total: 1 }]);
    expect(honor[2]?.status).toBe("sold-out");
  });

  it("resets old counters and distinguishes insufficient currency from exhausted stock", () => {
    const p = profile();
    p.shop.weekKey = "old";
    p.shop.bought.shop_pull = 2;
    p.currencies.moonStar = 5;
    expect(shopOffers(data, p, "moon", now)[0]).toMatchObject({
      status: "insufficient", limits: [{ period: "week", left: 2, total: 2 }],
    });
    p.shop.weekKey = weekKey(data, now);
    expect(shopOffers(data, p, "moon", now)[0]?.status).toBe("sold-out");
  });

  it("offers only unowned Hero and describes duplicate Nguyệt Bảo outcomes", () => {
    const p = profile();
    const hero = shopOffers(data, p, "moon", now)[1]!;
    expect(hero.choices.every(x => !p.heroes[x.id] && data.heroes[x.id]?.rarity === "epic")).toBe(true);
    for (const choice of hero.choices) p.heroes[choice.id] = p.heroes.m05!;
    expect(shopOffers(data, p, "moon", now)[1]?.status).toBe("owned-all");
    p.relics.r_bach_lo_huong_nang = { resonance: 4 };
    const relic = shopOffers(data, p, "honor", now)[2]!.choices.find(x => x.id === "r_bach_lo_huong_nang");
    expect(relic?.outcome).toBe("Cộng Minh 4 → 5");
  });
});

describe("shop purchase flow", () => {
  it("checks the live balance after confirmation before sending anything", async () => {
    let p = profile(), sent = 0;
    const flow = new ShopPurchaseFlow();
    const result = await flow.buy(data, "moon", "shop_pull", now, {
      profile: () => p, online: () => true, valid: () => true,
      confirm: async () => { p = { ...p, currencies: { ...p.currencies, moonStar: 0 } }; return {}; },
      submit: async () => { sent++; return { rev: 2 }; },
    });
    expect(result.status).toBe("unavailable");
    expect(sent).toBe(0);
  });

  it("rejects an invalid choice and allows only one pending purchase", async () => {
    const p = profile(), flow = new ShopPurchaseFlow();
    const invalid = await flow.buy(data, "moon", "shop_epic_hero", now, {
      profile: () => p, online: () => true, valid: () => true,
      confirm: async () => ({ heroId: "m05" }), submit: async () => ({ rev: 2 }),
    });
    expect(invalid.status).toBe("unavailable");
    let sent = 0, release!: () => void;
    const gate = new Promise<void>(r => { release = r; });
    const context = {
      profile: () => p, online: () => true, valid: () => true,
      confirm: async () => ({}),
      submit: async () => { sent++; await gate; return { rev: 2 }; },
    };
    const first = flow.buy(data, "moon", "shop_pull", now, context);
    await Promise.resolve();
    expect(flow.phase).toBe("pending");
    expect((await flow.buy(data, "moon", "shop_pull", now, context)).status).toBe("busy");
    release();
    expect((await first).status).toBe("success");
    expect(sent).toBe(1);
    expect(flow.phase).toBe("idle");
  });

  it("cancels stale scene replies and leaves rejected purchases unchanged", async () => {
    const p = profile(), before = JSON.stringify(p), flow = new ShopPurchaseFlow();
    const error = Error("rejected");
    const rejected = await flow.buy(data, "honor", "honor_pull", now, {
      profile: () => p, online: () => true, valid: () => true,
      confirm: async () => ({}), submit: async () => { throw error; },
    });
    expect(rejected).toEqual({ status: "error", error });
    expect(JSON.stringify(p)).toBe(before);
    let valid = true;
    const gone = await flow.buy(data, "honor", "honor_pull", now, {
      profile: () => p, online: () => true, valid: () => valid,
      confirm: async () => ({}), submit: async () => { valid = false; return { rev: 3 }; },
    });
    expect(gone.status).toBe("cancelled");
  });
});
