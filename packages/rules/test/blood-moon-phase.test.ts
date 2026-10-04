import { describe, expect, it } from "vitest";
import {
  activeModifiers,
  applyAction,
  decreeModifier,
  getEffectiveCost,
  phaseModifiers,
  phaseSuppressed,
  planEnemyIntents,
} from "../src/index";
import { makeTestCombat, setHand } from "./helpers";

/**
 * Huyết Nguyệt is a hidden phase (`01` §7.4, revised): while `bloodMoonRounds`
 * is positive it REPLACES the current phase — tag bonus and the rolled decree
 * stop applying — instead of stacking on top. The wheel itself keeps turning:
 * `moonIndex` still advances at round end, so the phase the moon returns to
 * is simply wherever the wheel stands then.
 */
describe("Huyết Nguyệt replaces the current phase", () => {
  it("T326: the tag bonus and decree drop out of activeModifiers; the raw phase data is untouched", () => {
    // firstQuarter rolls a `costModifierForTag` bonus (`01` §7).
    const { data, state } = makeTestCombat({ start: { moonIndex: 2 } });
    expect(phaseModifiers(data, state).length).toBeGreaterThan(0);
    expect(activeModifiers(data, state, 0)).toEqual(phaseModifiers(data, state));

    state.bloodMoonRounds = 2;
    expect(phaseSuppressed(state)).toBe(true);
    // The phase's own definition still reads normally — only the live phase is suppressed.
    expect(phaseModifiers(data, state).length).toBeGreaterThan(0);
    expect(activeModifiers(data, state, 0)).toEqual([]);

    // Decree queries go silent too — every decree consumer flows through this.
    const decreeTypes = phaseModifiers(data, state).map((modifier) => modifier.type);
    for (const type of decreeTypes) {
      expect(decreeModifier(data, state, type)).toBeUndefined();
    }

    state.bloodMoonRounds = 0;
    expect(activeModifiers(data, state, 0)).toEqual(phaseModifiers(data, state));
  });

  it("T327: a phase discount stops applying to card costs while the moon burns", () => {
    // firstQuarter: lá `control` −1 Nguyệt Lực (moon-decrees T-suite pins the same fixture).
    const { data, state } = makeTestCombat({ heroIds: ["f03", "f04", "m06"], start: { moonIndex: 2 } });
    setHand(state, ["f03_han_an"]);
    const instanceId = state.players[0]!.hand[0]!;
    const base = data.cards[state.cards[instanceId]!.cardId]!.cost;
    expect(getEffectiveCost(data, state, instanceId, 0)).toBe(base - 1);

    state.bloodMoonRounds = 2;
    expect(getEffectiveCost(data, state, instanceId, 0)).toBe(base);

    state.bloodMoonRounds = 0;
    expect(getEffectiveCost(data, state, instanceId, 0)).toBe(base - 1);
  });

  it("T328: enemy moonOverrides do not apply while the phase is suppressed", () => {
    const { data, state } = makeTestCombat();
    const fox = state.enemies.find((enemy) => enemy.defId === "shadow_fox");
    if (fox === undefined) return; // fixture without the fox — nothing to pin
    // Trăng Tròn: the fox's `moon_illusion` leads for free (enemy-plan T-suite).
    state.moonIndex = 4;
    planEnemyIntents(data, state, []);
    expect(fox.plannedIntents[0]?.intent.id).toBe("moon_illusion");

    // The fox has no bloodMoonOverride — during Huyết Nguyệt nothing leads.
    state.bloodMoonRounds = 2;
    planEnemyIntents(data, state, []);
    expect(fox.plannedIntents.every((planned) => planned.intent.id !== "moon_illusion")).toBe(true);
  });

  it("T329: the wheel keeps turning during Huyết Nguyệt — the phase it lands on resumes after", () => {
    const { data, state } = makeTestCombat();
    const moonIndex = state.moonIndex;
    state.bloodMoonRounds = 2;
    const result = applyAction(data, state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.moonIndex).toBe((moonIndex + 1) % data.moonPhases.length);
    expect(result.state.bloodMoonRounds).toBe(1);
    // One more round burns it off — the phase under the wheel applies again.
    const next = applyAction(data, result.state, { type: "endTurn" });
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    expect(next.state.bloodMoonRounds).toBe(0);
    expect(phaseSuppressed(next.state)).toBe(false);
  });

  it("T330: `while: \"bloodMoon\"` relic modifiers stay on — they are not phase traits", () => {
    const { data, state } = makeTestCombat();
    state.players[0]!.relics = [{ id: "r_huyet_ngoc_boi", resonance: 0 }];
    // Dormant without blood moon.
    expect(
      activeModifiers(data, state, 0).some((modifier) => "while" in modifier && modifier.while === "bloodMoon"),
    ).toBe(false);
    // Active during it — even while the phase itself is suppressed.
    state.bloodMoonRounds = 2;
    expect(
      activeModifiers(data, state, 0).some(
        (modifier) =>
          modifier.type === "costModifierForTag" &&
          "while" in modifier &&
          modifier.while === "bloodMoon",
      ),
    ).toBe(true);
  });
});
