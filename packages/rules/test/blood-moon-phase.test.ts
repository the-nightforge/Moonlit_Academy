import { describe, expect, it } from "vitest";
import {
  activeModifiers,
  applyAction,
  decreeModifier,
  getEffectiveCost,
  isCardPlayable,
  phaseModifiers,
  phaseSuppressed,
  planEnemyIntents,
} from "../src/index";
import {
  heroByDefId,
  idleEnemies,
  instanceIdOf,
  makeEnemiesIdle,
  makeTestCombat,
  p0,
  playCardById,
  setHand,
} from "./helpers";

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

const REFLECT_STEAL_TEAM: [string, string, string] = ["m05", "f03", "f02"];

describe("blood moon", () => {
  it("T71: Đổi Vận Chú starts a 2-round blood moon and shifts the moon", () => {
    const { data, state } = makeTestCombat({
      heroIds: REFLECT_STEAL_TEAM,
      setup: (s) => {
        p0(s).moonPower = 11;
        setHand(s, ["f02_doi_van_chu"]);
      },
    });

    const result = playCardById(data, state, "f02_doi_van_chu");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.bloodMoonRounds).toBe(2);
    expect(result.state.moonIndex).toBe(2);
    expect(result.events).toContainEqual({ type: "bloodMoonChanged", rounds: 2, cause: "card" });
  });

  it("T72: the last blood moon round ends at round end without an HP loss", () => {
    const { data, state } = makeTestCombat({
      heroIds: REFLECT_STEAL_TEAM,
      mutateData: makeEnemiesIdle,
      setup: idleEnemies,
    });
    state.bloodMoonRounds = 1;

    const result = applyAction(data, state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.bloodMoonRounds).toBe(0);
    expect(result.events).toContainEqual({ type: "bloodMoonChanged", rounds: 0, cause: "roundEnd" });
    expect(result.events.some((e) => e.type === "hpLost" && e.cause === "bloodMoon")).toBe(false);
    expect(result.state.heroes.map((h) => h.hp)).toEqual(result.state.heroes.map((h) => h.maxHp));
  });

  it("T73: every living hero loses 2 HP at turn start, after status ticks", () => {
    const { data, state } = makeTestCombat({
      heroIds: REFLECT_STEAL_TEAM,
      mutateData: makeEnemiesIdle,
      setup: idleEnemies,
    });
    state.bloodMoonRounds = 2;
    heroByDefId(state, "m05").statuses.push({ id: "burn", value: 1 });

    const result = applyAction(data, state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.bloodMoonRounds).toBe(1);
    const losses = result.events.filter((e) => e.type === "hpLost");
    expect(losses.map((e) => e.type === "hpLost" && [e.targetId, e.cause])).toEqual([
      ["hero:m05", "burn"],
      ["hero:m05", "bloodMoon"],
      ["hero:f03", "bloodMoon"],
      ["hero:f02", "bloodMoon"],
    ]);
    expect(heroByDefId(result.state, "m05").hp).toBe(37);
    expect(heroByDefId(result.state, "m05").levelUpCounter).toBe(3);
    expect(heroByDefId(result.state, "f02").hp).toBe(24);
  });

  it("T74: a requiresBloodMoon card is rejected outside blood moon", () => {
    const { data, state } = makeTestCombat({
      heroIds: REFLECT_STEAL_TEAM,
      setup: (s) => setHand(s, ["f02_phe_hon"]),
    });

    const result = playCardById(data, state, "f02_phe_hon", "enemy:0");
    expect(result).toEqual({ ok: false, error: "requires blood moon" });
    expect(isCardPlayable(data, state, instanceIdOf(state, "f02_phe_hon"))).toBe(false);
  });

  it("T75: Phệ Hồn is playable during blood moon", () => {
    const { data, state } = makeTestCombat({
      heroIds: REFLECT_STEAL_TEAM,
      setup: (s) => {
        p0(s).moonPower = 11;
        setHand(s, ["f02_phe_hon"]);
      },
    });
    state.bloodMoonRounds = 1;
    expect(isCardPlayable(data, state, instanceIdOf(state, "f02_phe_hon"))).toBe(true);

    const result = playCardById(data, state, "f02_phe_hon", "enemy:0");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(heroByDefId(result.state, "f02").hp).toBe(23);
    expect(result.state.enemies[0]?.hp).toBe(state.enemies[0]!.hp - 16);
  });

  it("T76: a shorter bloodMoon does not shorten an active one", () => {
    const { data, state } = makeTestCombat({
      heroIds: REFLECT_STEAL_TEAM,
      setup: (s) => {
        p0(s).moonPower = 11;
        setHand(s, ["f02_doi_van_chu"]);
      },
    });
    state.bloodMoonRounds = 3;

    const result = playCardById(data, state, "f02_doi_van_chu");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.bloodMoonRounds).toBe(3);
    expect(result.events.some((e) => e.type === "bloodMoonChanged")).toBe(false);
  });

  it("T77: blood moon HP loss can lose the combat", () => {
    const { data, state } = makeTestCombat({
      heroIds: REFLECT_STEAL_TEAM,
      mutateData: makeEnemiesIdle,
      setup: idleEnemies,
    });
    state.bloodMoonRounds = 2;
    for (const h of state.heroes) {
      if (h.defId !== "f02") {
        h.hp = 0;
        h.alive = false;
      }
    }
    heroByDefId(state, "f02").hp = 2;

    const result = applyAction(data, state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.status).toBe("lost");
    expect(result.events).toContainEqual({ type: "combatEnded", result: "lost" });
  });
});
