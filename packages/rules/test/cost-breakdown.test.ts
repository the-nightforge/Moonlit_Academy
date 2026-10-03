import { describe, expect, it } from "vitest";
import { createPvpCombat, getCardCostBreakdown, getEffectiveCost } from "../src/index";
import { injectCard, instanceIdOf, makeTestCombat, p0, setHand, testData } from "./helpers";

/**
 * The display-side cost query (`05`, review UI): `getEffectiveCost` delegates
 * to the breakdown, so the numbers here pin the real arithmetic — including
 * that the floor clamps before discounts, never after.
 */
describe("getCardCostBreakdown", () => {
  it("effective matches getEffectiveCost for every card in hand", () => {
    const { data, state } = makeTestCombat();
    for (const instanceId of p0(state).hand) {
      expect(getCardCostBreakdown(data, state, instanceId, 0).effective).toBe(
        getEffectiveCost(data, state, instanceId, 0),
      );
    }
  });

  it("lists the current phase's tag bonus as a phaseOrDecree modifier", () => {
    // Bán Nguyệt (index 2): control cards cost 1 less (`01` §7.4).
    const { data, state } = makeTestCombat({ start: { moonIndex: 2 } });
    setHand(state, ["m05_ho_gam"]); // cost 2, tags control+ward
    const breakdown = getCardCostBreakdown(data, state, instanceIdOf(state, "m05_ho_gam"), 0);
    expect(breakdown.base).toBe(2);
    expect(breakdown.modifiers).toEqual([{ kind: "phaseOrDecree", amount: -1 }]);
    expect(breakdown.floor).toBe(0);
    expect(breakdown.effective).toBe(1);
  });

  it("a non-matching tag keeps the base cost and no modifiers", () => {
    const { data, state } = makeTestCombat({ start: { moonIndex: 2 } });
    setHand(state, ["m05_thuong_pha"]); // cost 1, tag attack only
    const breakdown = getCardCostBreakdown(data, state, instanceIdOf(state, "m05_thuong_pha"), 0);
    expect(breakdown.modifiers).toEqual([]);
    expect(breakdown.effective).toBe(1);
  });

  it("Chiêm Bài picks report the chosen discount", () => {
    const { data, state } = makeTestCombat();
    setHand(state, ["m05_ho_gam"]); // cost 2
    const instanceId = instanceIdOf(state, "m05_ho_gam");
    state.cards[instanceId]!.chosenThisTurn = true;
    const breakdown = getCardCostBreakdown(data, state, instanceId, 0);
    expect(breakdown.modifiers).toEqual([{ kind: "chosen", amount: -1 }]);
    expect(breakdown.effective).toBe(1); // 2 − chooseCardDiscount(1)
  });

  it("firstOwnCardDiscount reports −3 while unused, nothing after use", () => {
    const { data, state } = makeTestCombat();
    setHand(state, ["m06_anh_bo"]); // cost 1, owner m06 → firstOwnCardDiscount 3
    const owner = state.heroes.find((hero) => hero.defId === "m06")!;
    owner.leveledUp = true;
    owner.firstCardDiscountActive = true;
    const instanceId = instanceIdOf(state, "m06_anh_bo");
    expect(getCardCostBreakdown(data, state, instanceId, 0)).toMatchObject({
      modifiers: [{ kind: "firstOwn", amount: -3 }],
      effective: 0,
    });
    owner.firstCardDiscountUsedThisTurn = true;
    expect(getCardCostBreakdown(data, state, instanceId, 0).modifiers).toEqual([]);
    expect(getCardCostBreakdown(data, state, instanceId, 0).effective).toBe(1);
  });

  it("bloodMoonOwnCardDiscount only counts during Huyết Nguyệt", () => {
    const { data, state } = makeTestCombat({
      heroIds: ["f02", "f04", "m06"],
      loadout: {
        heroes: {
          f02: { constellation: 0, levelUpForm: "alt", weaponId: null, refinement: 0 },
        },
        relics: [],
      },
    });
    const instanceId = p0(state).hand[0]!;
    const owner = state.heroes.find((hero) => hero.defId === "f02")!;
    owner.leveledUp = true;
    expect(getCardCostBreakdown(data, state, instanceId, 0).modifiers).toEqual([]);
    state.bloodMoonRounds = 2;
    expect(getCardCostBreakdown(data, state, instanceId, 0).modifiers).toEqual([
      { kind: "bloodMoon", amount: -1 },
    ]);
  });

  it("tagDiscountOwnCards discounts only the owner's tagged cards", () => {
    const { data, state } = makeTestCombat({ heroIds: ["f01", "f04", "m06"] });
    const cardId = injectCard(state, data, {
      id: "t_moon_card",
      name: "Moon test",
      ownerId: "f01",
      cost: 3,
      type: "attack",
      tags: ["moon"],
      target: "none",
      effects: [],
      text: "test",
      copies: 1,
    });
    const owner = state.heroes.find((hero) => hero.defId === "f01")!;
    owner.leveledUp = true;
    owner.levelUpForm = "alt"; // Tự Do: moon cards −1
    const breakdown = getCardCostBreakdown(data, state, cardId, 0);
    expect(breakdown.modifiers).toEqual([{ kind: "ownTag", amount: -1 }]);
    expect(breakdown.effective).toBe(2);
    // The same tag on another owner's card does not see f01's passive.
    const other = injectCard(state, data, {
      id: "t_moon_other",
      name: "Moon other",
      ownerId: "m06",
      cost: 3,
      type: "skill",
      tags: ["moon"],
      target: "none",
      effects: [],
      text: "test",
      copies: 1,
    });
    expect(getCardCostBreakdown(data, state, other, 0).modifiers).toEqual([]);
  });

  it("turnDiscount reports its stored amount", () => {
    const { data, state } = makeTestCombat();
    setHand(state, ["m05_bat_khuat"]); // cost 3
    const instanceId = instanceIdOf(state, "m05_bat_khuat");
    state.cards[instanceId]!.turnDiscount = 2;
    const breakdown = getCardCostBreakdown(data, state, instanceId, 0);
    expect(breakdown.modifiers).toEqual([{ kind: "turnDiscount", amount: -2 }]);
    expect(breakdown.effective).toBe(1);
  });

  it("the floor clamps before discounts: cost 0, floor 1, discount 1 stays 0", () => {
    const { data, state } = makeTestCombat({
      runRelicIds: ["t_floor_relic"],
      mutateData: (d) => {
        d.runRelics.t_floor_relic = {
          id: "t_floor_relic",
          name: "Floor relic",
          text: "test",
          modifiers: [{ type: "costModifierForTag", tag: "attack", amount: 0, min: 1 }],
        };
      },
    });
    const instanceId = injectCard(state, data, {
      id: "t_free_attack",
      name: "Free attack",
      ownerId: "m05",
      cost: 0,
      type: "attack",
      tags: ["attack"],
      target: "none",
      effects: [],
      text: "test",
      copies: 1,
    });
    state.cards[instanceId]!.chosenThisTurn = true; // −1 discount
    const breakdown = getCardCostBreakdown(data, state, instanceId, 0);
    expect(breakdown.floor).toBe(1);
    expect(breakdown.modifiers).toEqual([
      { kind: "phaseOrDecree", amount: 0 },
      { kind: "chosen", amount: -1 },
    ]);
    // max(0, 1, 0) − 1 = 0 — the floor lifted first, then the discount ate it.
    expect(breakdown.effective).toBe(0);
  });

  it("evaluates another seat's cost from their own modifiers (PvP)", () => {
    // A seat-scoped relic must not leak into the other seat's cost.
    const data = testData();
    data.runRelics.t_attack_relic = {
      id: "t_attack_relic",
      name: "Attack relic",
      text: "test",
      modifiers: [{ type: "costModifierForTag", tag: "attack", amount: -1, min: 0 }],
    };
    const side = { heroIds: ["m05", "f04", "m06"] as [string, string, string], loadout: { heroes: {}, pvp: true } };
    const { state } = createPvpCombat(data, { seed: 42, players: [side, side] });
    state.players[0]!.runRelicIds.push("t_attack_relic");
    const instanceId = Object.values(state.cards).find(
      (card) => card.player === 0 && data.cards[card.cardId]?.tags.includes("attack"),
    )!.instanceId;
    const base = data.cards[state.cards[instanceId]!.cardId]!.cost;
    expect(getCardCostBreakdown(data, state, instanceId, 0).effective).toBe(base - 1);
    // The same instance evaluated for seat 1 sees no seat-0 relic.
    expect(getCardCostBreakdown(data, state, instanceId, 1).effective).toBe(base);
    expect(getCardCostBreakdown(data, state, instanceId, 1).modifiers).toEqual([]);
  });
});
