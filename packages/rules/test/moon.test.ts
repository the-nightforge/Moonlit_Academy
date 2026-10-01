import { describe, expect, it } from "vitest";
import { applyAction, getEffectiveCost } from "../src/index";
import { healFiveCard, rewindMoonCard, stealthOneCard } from "./fixtures";
import { injectCard, instanceIdOf, makeTestCombat, pendingCardOptions, setHand, p0 } from "./helpers";

describe("moon phases", () => {
  it("T21: new moon boosts assassin card damage by 1.5x", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.moonIndex = 0;
        setHand(s, ["m06_am_tien"]);
      },
    });
    const result = applyAction(data, state, {
      type: "playCard",
      instanceId: instanceIdOf(state, "m06_am_tien"),
      targetId: "enemy:0",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events.find((e) => e.type === "damageDealt")).toMatchObject({ amount: 9 });
    expect(result.state.enemies[0]?.hp).toBe(state.enemies[0]!.hp - 9);
  });

  it("T22: stealthed assassin branch also gets the 1.5x multiplier", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.moonIndex = 0;
        s.heroes[2]!.statuses.push({ id: "stealth", value: 1 });
        setHand(s, ["m06_am_tien"]);
      },
    });
    const result = applyAction(data, state, {
      type: "playCard",
      instanceId: instanceIdOf(state, "m06_am_tien"),
      targetId: "enemy:0",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events.find((e) => e.type === "damageDealt")).toMatchObject({ amount: 15 });
    expect(result.state.heroes[2]?.statuses.some((s) => s.id === "stealth")).toBe(false);
  });

  it("T23: new moon extends applied stealth by 1 under the Bóng Mờ decree", () => {
    const { data, state } = makeTestCombat({
      decrees: "real",
      start: { moonIndex: 1, decrees: { new: "bong_mo" } },
      setup: (s) => {
        s.moonIndex = 0;
      },
    });
    const stealth = injectCard(state, data, stealthOneCard);
    const result = applyAction(data, state, {
      type: "playCard",
      instanceId: stealth,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.heroes[2]?.statuses).toContainEqual({ id: "stealth", value: 2 });
  });

  it("T24: first quarter makes control cards cost 1 less, floored at 0", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.moonIndex = 2;
      },
    });
    expect(getEffectiveCost(data, state, instanceIdOf(state, "m06_nguyet_anh_an"))).toBe(1);
    expect(getEffectiveCost(data, state, instanceIdOf(state, "m05_ho_gam"))).toBe(1);
    expect(getEffectiveCost(data, state, instanceIdOf(state, "m05_liet_hoa_xung_phong"))).toBe(4);
  });

  it("T25: full moon doubles healing under the Viên Nguyệt decree", () => {
    const { data, state } = makeTestCombat({
      decrees: "real",
      start: { moonIndex: 1, decrees: { full: "vien_nguyet" } },
      setup: (s) => {
        s.moonIndex = 4;
        s.heroes[1]!.hp = 20;
      },
    });
    const heal = injectCard(state, data, healFiveCard);
    const result = applyAction(data, state, {
      type: "playCard",
      instanceId: heal,
      targetId: "hero:f04",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.heroes[1]?.hp).toBe(30);
    expect(result.events.find((e) => e.type === "healed")).toMatchObject({ amount: 10 });
  });

  it("T26: healing is capped by missing HP after the multiplier", () => {
    const { data, state } = makeTestCombat({
      decrees: "real",
      start: { moonIndex: 1, decrees: { full: "vien_nguyet" } },
      setup: (s) => {
        s.moonIndex = 4;
        s.heroes[1]!.hp = 25;
      },
    });
    const heal = injectCard(state, data, healFiveCard);
    const result = applyAction(data, state, {
      type: "playCard",
      instanceId: heal,
      targetId: "hero:f04",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.heroes[1]?.hp).toBe(30);
    expect(result.events.find((e) => e.type === "healed")).toMatchObject({ amount: 5 });
  });

  it("T27: last quarter discounts ward cards; armor is no longer multiplied by the phase", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.moonIndex = 6;
      },
    });
    const ward = injectCard(state, data, data.cards["f03_phong_tuyet_chuong"]!);
    expect(getEffectiveCost(data, state, ward)).toBe(3); // ward giá 4 − 1
    const healCard = injectCard(state, data, data.cards["f04_linh_chi_ho_the"]!);
    expect(getEffectiveCost(data, state, healCard)).toBe(2); // heal: no tag bonus
    const played = applyAction(data, state, {
      type: "playCard",
      instanceId: healCard,
      targetId: "hero:m06",
    });
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(played.state.heroes[2]?.armor).toBe(4); // giáp đúng bằng lá — no ×1.5 without Huyền Giáp
  });

  it("T28: shiftMoon takes effect immediately for later plays", () => {
    const { data, state } = makeTestCombat({
      decrees: "real",
      start: { moonIndex: 1, decrees: { full: "vien_nguyet" } },
      setup: (s) => {
        s.moonIndex = 3;
        p0(s).moonPower = 11;
        s.heroes[1]!.hp = 20;
        setHand(s, ["f04_nguyet_quang_dan"]);
      },
    });
    const heal = injectCard(state, data, healFiveCard);
    const shifted = applyAction(data, state, {
      type: "playCard",
      instanceId: instanceIdOf(state, "f04_nguyet_quang_dan"),
    });
    expect(shifted.ok).toBe(true);
    if (!shifted.ok) return;
    expect(shifted.state.moonIndex).toBe(4);
    expect(
      shifted.events.find((e) => e.type === "moonShifted"),
    ).toMatchObject({ from: 3, to: 4, cause: "card" });

    const picked = applyAction(data, shifted.state, {
      type: "chooseCard",
      instanceId: pendingCardOptions(shifted.state)[0]!,
    });
    expect(picked.ok).toBe(true);
    if (!picked.ok) return;
    const healed = applyAction(data, picked.state, {
      type: "playCard",
      instanceId: heal,
      targetId: "hero:f04",
    });
    expect(healed.ok).toBe(true);
    if (!healed.ok) return;
    expect(healed.state.heroes[1]?.hp).toBe(30);
  });

  it("T29: shiftMoon wraps around past the last phase", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.moonIndex = 7;
        p0(s).moonPower = 11;
        setHand(s, ["f04_nguyet_quang_dan"]);
      },
    });
    const result = applyAction(data, state, {
      type: "playCard",
      instanceId: instanceIdOf(state, "f04_nguyet_quang_dan"),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.moonIndex).toBe(0);
  });

  it("T30: negative shiftMoon wraps below phase 0", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.moonIndex = 0;
      },
    });
    const instanceId = injectCard(state, data, rewindMoonCard);
    const result = applyAction(data, state, { type: "playCard", instanceId });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.moonIndex).toBe(7);
  });

  it("T31: moon overrides apply at the new phase and lead the announced chain", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.moonIndex = 3;
      },
    });
    const result = applyAction(data, state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.moonIndex).toBe(4);
    const fox = result.state.enemies[1]!;
    expect(fox.plannedIntents[0]?.intent.id).toBe("moon_illusion");
    expect(fox.plannedIntents[0]?.cost).toBe(0);
  });

  it("T32: a card-shifted moon changes which intent is announced", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.moonIndex = 3;
        p0(s).moonPower = 11;
        s.enemies[1]!.moonReserve = 3; // lets the round-2 replan afford the fox's top intent
        setHand(s, ["f04_nguyet_quang_dan"]);
      },
    });
    const shifted = applyAction(data, state, {
      type: "playCard",
      instanceId: instanceIdOf(state, "f04_nguyet_quang_dan"),
    });
    expect(shifted.ok).toBe(true);
    if (!shifted.ok) return;

    const picked = applyAction(data, shifted.state, {
      type: "chooseCard",
      instanceId: pendingCardOptions(shifted.state)[0]!,
    });
    expect(picked.ok).toBe(true);
    if (!picked.ok) return;
    const result = applyAction(data, picked.state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.moonIndex).toBe(5);
    const fox = result.state.enemies[1]!;
    // Task 6: waningGibbous is the fox's Nguyệt tính — Hồ Hút Huyết leads free;
    // the paid kit follows and the full-moon override is gone entirely.
    expect(fox.plannedIntents[0]?.intent.id).toBe("fox_blood_sip");
    expect(fox.plannedIntents[0]?.cost).toBe(0);
    expect(fox.plannedIntents.every((plan) => plan.intent.id !== "moon_illusion")).toBe(true);
  });
});
