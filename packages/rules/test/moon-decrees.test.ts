import { describe, expect, it } from "vitest";
import { createCombat, createPvpCombat, getEffectiveCost, phaseModifiers, starterDeck } from "../src/index";
import { makeTestCombat, p0, rawTestInput, setHand, testData } from "./helpers";
import { parseGameData } from "data";

const TEAM: [string, string, string] = ["m05", "f04", "m06"];

describe("Nguyệt Luân — dữ liệu và bốc lệnh", () => {
  it("T314: every phase has exactly 3 decrees with unique ids; decree-only modifiers stay out of relics", () => {
    const data = testData();
    const ids = data.moonPhases.flatMap((phase) => phase.decrees.map((d) => d.id));
    expect(data.moonPhases.every((phase) => phase.decrees.length === 3)).toBe(true);
    expect(new Set(ids).size).toBe(24);
    const raw = rawTestInput();
    raw.runRelics[0].modifiers = [{ type: "keepArmor" }];
    expect(() => parseGameData(raw)).toThrow(/decree-only/);
  });

  it("T315: start phase and decrees are rolled from the seed without moving the combat RNG; start overrides after the roll", () => {
    const data = testData();
    const make = (seed: number, start?: object) =>
      createCombat(data, { heroIds: TEAM, encounterId: "enc_01", seed, deckCardIds: starterDeck(data, TEAM), ...(start ? { start } : {}) });
    const a = make(42).state;
    expect(make(42).state.moonDecrees).toEqual(a.moonDecrees);
    expect(a.moonDecrees).toHaveLength(8);
    a.moonDecrees.forEach((id, i) => expect(data.moonPhases[i]!.decrees.map((d) => d.id)).toContain(id));
    const seeds = Array.from({ length: 40 }, (_, i) => make(i + 1).state.moonIndex);
    expect(new Set(seeds).size).toBeGreaterThan(3);
    const pinned = make(42, { moonIndex: 4, decrees: { full: "doan_vien" } }).state;
    expect(pinned.moonIndex).toBe(4);
    expect(pinned.moonDecrees[4]).toBe("doan_vien");
    expect(pinned.players[0]!.drawPile).toEqual(a.players[0]!.drawPile);
    expect(pinned.rngState).toBe(a.rngState);
    const side = (heroIds: [string, string, string]) => ({ heroIds, loadout: { heroes: {}, pvp: true as const } });
    const pvp = createPvpCombat(data, { seed: 42, players: [side(TEAM), side(["f03", "f02", "m01"])] });
    expect(pvp.state.moonDecrees).toHaveLength(8);
    expect(pvp.events.some((e) => e.type === "moonDecreesRolled")).toBe(true);
  });

  it("T316: tag bonus is −1 (assassin ×1.5 at new moon) and stacks with run-relic modifiers", () => {
    const plain = makeTestCombat({ heroIds: ["f03", "f04", "m06"], start: { moonIndex: 2 }, setup: (s) => setHand(s, ["f03_han_an"]) });
    expect(phaseModifiers(plain.data, plain.state)).toEqual([{ type: "costModifierForTag", tag: "control", amount: -1, min: 0 }]);
    expect(getEffectiveCost(plain.data, plain.state, p0(plain.state).hand[0]!)).toBe(1); // Hàn Ấn: 2 − 1

    const relic = makeTestCombat({
      heroIds: ["f03", "f04", "m06"],
      start: { moonIndex: 2 },
      runRelicIds: ["t_control_relic"],
      mutateData: (d) => {
        d.runRelics["t_control_relic"] = { id: "t_control_relic", name: "T", text: "T", modifiers: [{ type: "costModifierForTag", tag: "control", amount: -1, min: 0 }] };
      },
      setup: (s) => setHand(s, ["f03_han_an"]),
    });
    expect(getEffectiveCost(relic.data, relic.state, p0(relic.state).hand[0]!)).toBe(0);

    const dark = makeTestCombat({ start: { moonIndex: 0 } });
    expect(phaseModifiers(dark.data, dark.state)).toEqual([{ type: "damageMultiplierForTag", tag: "assassin", multiplier: 1.5 }]);
  });
});
