import { describe, expect, it } from "vitest";
import { applyAction, getEffectiveCost } from "../src/index";
import { rewindMoonCard } from "./fixtures";
import { injectCard, instanceIdOf, makeTestCombat, setHand } from "./helpers";

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

  it("T23: new moon extends applied stealth by 1", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.moonIndex = 0;
        setHand(s, ["m06_anh_bo"]);
      },
    });
    const result = applyAction(data, state, {
      type: "playCard",
      instanceId: instanceIdOf(state, "m06_anh_bo"),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.heroes[2]?.statuses).toContainEqual({ id: "stealth", value: 2 });
  });

  it("T24: first quarter makes control cards cost 0 with a floor of 0", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.moonIndex = 2;
      },
    });
    expect(getEffectiveCost(data, state, instanceIdOf(state, "m06_nguyet_anh_an"))).toBe(0);
    expect(getEffectiveCost(data, state, instanceIdOf(state, "m05_ho_gam"))).toBe(0);
    expect(getEffectiveCost(data, state, instanceIdOf(state, "m05_liet_hoa_xung_phong"))).toBe(4);
  });

  it("T25: full moon doubles healing", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.moonIndex = 4;
        s.heroes[1]!.hp = 20;
        setHand(s, ["f04_thao_duoc"]);
      },
    });
    const result = applyAction(data, state, {
      type: "playCard",
      instanceId: instanceIdOf(state, "f04_thao_duoc"),
      targetId: "hero:f04",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.heroes[1]?.hp).toBe(30);
    expect(result.events.find((e) => e.type === "healed")).toMatchObject({ amount: 10 });
  });

  it("T26: healing is capped by missing HP after the multiplier", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.moonIndex = 4;
        s.heroes[1]!.hp = 25;
        setHand(s, ["f04_thao_duoc"]);
      },
    });
    const result = applyAction(data, state, {
      type: "playCard",
      instanceId: instanceIdOf(state, "f04_thao_duoc"),
      targetId: "hero:f04",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.heroes[1]?.hp).toBe(30);
    expect(result.events.find((e) => e.type === "healed")).toMatchObject({ amount: 5 });
  });

  it("T27: last quarter multiplies gained armor by 1.5", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.moonIndex = 6;
        setHand(s, ["f04_linh_chi_ho_the", "m05_ho_gam"]);
      },
    });
    const armored = applyAction(data, state, {
      type: "playCard",
      instanceId: instanceIdOf(state, "f04_linh_chi_ho_the"),
      targetId: "hero:m06",
    });
    expect(armored.ok).toBe(true);
    if (!armored.ok) return;
    const roared = applyAction(data, armored.state, {
      type: "playCard",
      instanceId: instanceIdOf(armored.state, "m05_ho_gam"),
    });
    expect(roared.ok).toBe(true);
    if (!roared.ok) return;
    expect(roared.state.heroes[2]?.armor).toBe(9);
    expect(roared.state.heroes[0]?.armor).toBe(7);
  });

  it("T28: shiftMoon takes effect immediately for later plays", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.moonIndex = 3;
        s.moonPower = 11;
        s.heroes[1]!.hp = 20;
        setHand(s, ["f04_nguyet_quang_dan", "f04_thao_duoc"]);
      },
    });
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
      instanceId: shifted.state.pendingChoice!.options[0]!,
    });
    expect(picked.ok).toBe(true);
    if (!picked.ok) return;
    const healed = applyAction(data, picked.state, {
      type: "playCard",
      instanceId: instanceIdOf(picked.state, "f04_thao_duoc"),
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
        s.moonPower = 11;
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
        s.moonPower = 11;
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
      instanceId: shifted.state.pendingChoice!.options[0]!,
    });
    expect(picked.ok).toBe(true);
    if (!picked.ok) return;
    const result = applyAction(data, picked.state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.moonIndex).toBe(5);
    const fox = result.state.enemies[1]!;
    expect(fox.plannedIntents[0]?.intent.id).toBe("fox_shadow_kill");
    expect(fox.plannedIntents[0]?.intent.id).not.toBe("moon_illusion");
  });
});
