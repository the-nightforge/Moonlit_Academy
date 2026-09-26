import { describe, expect, it } from "vitest";
import type { CardDef, CombatState, GameData, Loadout, Profile } from "../src/index";
import {
  applyAction, buildLoadout, buyShopItem, createCombat, createProfile, createRun, pendingUnlocks, starterDeck,
} from "../src/index";
import { idleIntent, strike9Intent } from "./fixtures";
import { injectCard, instanceIdOf, makeTestCombat, setIntent, testData } from "./helpers";

const TEAM: [string, string, string] = ["m05", "f04", "m06"];
const MONDAY = Date.UTC(2026, 8, 28, 12);
const WEEK = 7 * 24 * 60 * 60 * 1000;

function hero(state: CombatState, defId: string) {
  return state.heroes.find((unit) => unit.defId === defId)!;
}

function loadout(constellations: Record<string, number>): Loadout {
  return {
    heroes: Object.fromEntries(
      Object.entries(constellations).map(([heroId, constellation]) => [heroId, { constellation, levelUpForm: "base" as const }]),
    ),
  };
}

function withStars(data: GameData, moonStar: number): Profile {
  const profile = createProfile(data);
  return { ...profile, currencies: { ...profile.currencies, moonStar } };
}

describe("constellations, loadout and the moon star shop", () => {
  it("T192: bonus unlocks add to pending unlocks, never beyond the locked cards", () => {
    const data = testData();
    const profile = createProfile(data);
    profile.heroes["m05"]!.bonusUnlocks = 2;
    expect(pendingUnlocks(data, profile, "m05")).toBe(2);
    profile.heroes["m05"]!.xp = data.metaConfig.masteryLevels.at(-1)!;
    expect(pendingUnlocks(data, profile, "m05")).toBe(data.heroes["m05"]!.lockedCardIds.length);
    profile.heroes["m05"]!.unlockedCardIds = data.heroes["m05"]!.lockedCardIds.slice(0, 5);
    expect(pendingUnlocks(data, profile, "m05")).toBe(1);
  });

  it("T193: constellation 2 uses the lower threshold; M06 then also counts kills by its reflect", () => {
    const selfHit: CardDef = {
      id: "test_self_hit", name: "Tự thương", ownerId: "m05", cost: 0, copies: 1, type: "skill", tags: [], target: "none",
      effects: [{ type: "loseHp", amount: 11, to: "self" }], text: "",
    };
    const levelsAt = (constellation: number) => {
      const { data, state } = makeTestCombat();
      hero(state, "m05").constellation = constellation;
      injectCard(state, data, selfHit);
      const result = applyAction(data, state, { type: "playCard", instanceId: instanceIdOf(state, selfHit.id) });
      if (!result.ok) throw new Error(result.error);
      return hero(result.state, "m05").leveledUp;
    };
    const data = testData();
    expect(data.heroes["m05"]!.levelUp.constellationThreshold).toBe(11);
    expect(levelsAt(0)).toBe(false);
    expect(levelsAt(2)).toBe(true);

    const reflectKill = (constellation: number) => {
      const { data: game, state } = makeTestCombat();
      const m06 = hero(state, "m06");
      m06.constellation = constellation;
      m06.statuses.push({ id: "reflect", value: 5 });
      state.enemies[0]!.hp = 3;
      setIntent(state, 0, strike9Intent, "hero:m06");
      setIntent(state, 1, idleIntent, null);
      const result = applyAction(game, state, { type: "endTurn" });
      if (!result.ok) throw new Error(result.error);
      expect(result.state.enemies[0]!.alive).toBe(false);
      return hero(result.state, "m06").levelUpCounter;
    };
    expect(reflectKill(0)).toBe(0);
    expect(reflectKill(2)).toBe(1);
  });

  it("T194: constellation 4 swaps the signature card for its plus card when a run or combat starts", () => {
    const data = testData();
    const deck = starterDeck(data, TEAM);
    const { cardId, plusCardId } = data.heroes["m05"]!.signature;
    expect(deck).toContain(cardId);

    const run = createRun(data, { heroIds: TEAM, seed: 3, deckCardIds: deck }, loadout({ m05: 4, f04: 3, m06: 0 })).run;
    expect(run.deck).toContain(plusCardId);
    expect(run.deck).not.toContain(cardId);
    expect(run.deck).toContain(data.heroes["f04"]!.signature.cardId); // constellation 3: unchanged
    expect(run.loadout?.heroes["m05"]?.constellation).toBe(4);

    const { state } = createCombat(data, { heroIds: TEAM, encounterId: "enc_01", seed: 3, deckCardIds: deck }, loadout({ m05: 6 }));
    const cardIds = Object.values(state.cards).map((card) => card.cardId);
    expect(cardIds.filter((id) => id === plusCardId)).toHaveLength(data.cards[cardId]!.copies);
    expect(cardIds).not.toContain(cardId);
    expect(hero(state, "m05").constellation).toBe(6);
    expect(createCombat(data, { heroIds: TEAM, encounterId: "enc_01", seed: 3, deckCardIds: deck }).state.heroes[0]!.constellation).toBe(0);
  });

  it("T195: buildLoadout reads the team's constellations; the second level-up form stays locked in phase 4d", () => {
    const data = testData();
    const profile = createProfile(data);
    profile.heroes["m05"]!.constellation = 5;
    profile.heroes["m05"]!.levelUpForm = "alt";
    const built = buildLoadout(data, profile, TEAM);
    expect(built).toEqual({ ok: true, loadout: loadout({ m05: 5, f04: 0, m06: 0 }) });
    expect(buildLoadout(data, profile, ["m05", "f04", "f03"])).toEqual({ ok: false, error: "hero not owned" });
  });

  it("T196: the moon star shop checks price and weekly limits; a hero choice needs an epic hero not owned", () => {
    const data = testData();
    const pullItem = data.economyConfig.moonStarShop.find((item) => item.id === "shop_pull")!;
    expect(buyShopItem(data, withStars(data, 0), "shop_pull", MONDAY)).toEqual({ ok: false, error: "not enough moonStar" });
    expect(buyShopItem(data, withStars(data, 999), "shop_nope", MONDAY)).toEqual({ ok: false, error: "unknown item" });

    let profile = withStars(data, 1000);
    for (let bought = 0; bought < pullItem.limitPerWeek; bought++) {
      const result = buyShopItem(data, profile, "shop_pull", MONDAY);
      if (!result.ok) throw new Error(result.error);
      profile = result.profile;
    }
    const amount = pullItem.item.type === "moonJade" ? pullItem.item.amount : 0;
    expect(profile.currencies).toMatchObject({ moonStar: 1000 - pullItem.limitPerWeek * pullItem.price, moonJade: pullItem.limitPerWeek * amount });
    expect(buyShopItem(data, profile, "shop_pull", MONDAY)).toEqual({ ok: false, error: "weekly limit" });
    expect(buyShopItem(data, profile, "shop_pull", MONDAY + WEEK).ok).toBe(true);

    expect(buyShopItem(data, profile, "shop_epic_hero", MONDAY)).toEqual({ ok: false, error: "hero required" });
    expect(buyShopItem(data, profile, "shop_epic_hero", MONDAY, "f04")).toEqual({ ok: false, error: "invalid hero" }); // rare
    expect(buyShopItem(data, profile, "shop_epic_hero", MONDAY, "m06")).toEqual({ ok: false, error: "invalid hero" }); // owned
    const bought = buyShopItem(data, profile, "shop_epic_hero", MONDAY, "f02");
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;
    expect(bought.profile.heroes["f02"]).toMatchObject({ constellation: 0 });
    expect(buyShopItem(data, bought.profile, "shop_epic_hero", MONDAY, "f03")).toEqual({ ok: false, error: "weekly limit" });
  });
});
