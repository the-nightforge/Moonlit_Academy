import { describe, expect, it } from "vitest";
import type { CombatState, EnemyIntentDef, GameData } from "../src/index";
import { applyAction } from "../src/index";
import { planEnemyIntents } from "../src/intent";
import { idleIntent, strike9Intent } from "./fixtures";
import { instanceIdOf, makeTestCombat, setIntent, setPlan } from "./helpers";

function end(data: GameData, state: CombatState) {
  const result = applyAction(data, state, { type: "endTurn" });
  if (!result.ok) throw new Error(result.error);
  return result;
}

const intent = (id: string, cost: number): EnemyIntentDef => ({ id, name: id, kind: "special", cost, effects: [] });

function withFox(intents: EnemyIntentDef[], start: number, cap: number, seed = 42) {
  return makeTestCombat({
    seed,
    mutateData: (d) => {
      const fox = d.enemies["shadow_fox"]!;
      fox.intents = intents;
      fox.moonPower = { start, cap };
      fox.moonOverrides = [];
      const puppet = d.enemies["puppet_guard"]!;
      puppet.intents = [{ ...idleIntent, cost: 0 }];
    },
  });
}

const planIds = (state: CombatState, position: number) =>
  state.enemies[position]!.plannedIntents.map((planned) => planned.intent.id);

describe("enemy moon power plans", () => {
  it("T139: the most expensive intent leads when affordable and unused last round; max 3, each once", () => {
    const { data, state } = withFox([intent("a", 1), intent("b", 1), intent("top", 3)], 5, 5);
    expect(planIds(state, 1)[0]).toBe("top");
    expect(new Set(planIds(state, 1))).toEqual(new Set(["top", "a", "b"]));
    expect(state.enemies[1]!.moonReserve).toBe(0);

    // Round 2: "top" led last round, so it is only a weighted candidate now.
    const next = end(data, state);
    expect(next.state.enemies[1]!.lastIntentIds).toContain("top");
    const ids = planIds(next.state, 1);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeLessThanOrEqual(3);

    const many = withFox(["p", "q", "r", "s"].map((id) => intent(id, 0)), 1, 1);
    expect(planIds(many.state, 1)).toHaveLength(3);
  });

  it("T140: weighted picks are seeded — same seed, same plan; seeds vary the plan", () => {
    const planFor = (seed: number) => {
      const { data, state } = withFox([intent("x", 1), intent("y", 1), intent("z", 1)], 1, 1, seed);
      state.enemies[1]!.lastIntentIds = ["x"];
      planEnemyIntents(data, state, []);
      return planIds(state, 1);
    };
    expect(planFor(7)).toEqual(planFor(7));
    const firsts = new Set(Array.from({ length: 20 }, (_, i) => planFor(i + 1)[0]));
    expect(firsts.size).toBeGreaterThan(1);
  });

  it("T141: nothing affordable is Tụ Lực; the unspent fund becomes reserve", () => {
    const { data, state, events } = withFox([intent("big", 3)], 1, 3);
    expect(state.enemies[1]!.plannedIntents).toEqual([]);
    expect(state.enemies[1]!.moonReserve).toBe(1);
    expect(events).toContainEqual({ type: "intentsRevealed", enemyId: "enemy:1", moonPower: 1, intents: [] });

    const next = end(data, state);
    expect(next.state.enemies[1]!.moonPower).toBe(2 + 1);
    expect(planIds(next.state, 1)).toEqual(["big"]);
  });

  it("T142: moon and blood moon overrides lead the chain for free, then intents are added", () => {
    const { data, state } = makeTestCombat({ heroIds: ["m05", "f03", "f02"], encounterId: "enc_04" });
    state.moonIndex = 4; // Trăng Tròn
    planEnemyIntents(data, state, []);
    const boss = state.enemies[0]!;
    expect(boss.plannedIntents[0]).toMatchObject({ cost: 0, intent: { id: "ape_moon_bathe" } });
    expect(boss.plannedIntents.length).toBeGreaterThan(1);

    state.bloodMoonRounds = 2;
    planEnemyIntents(data, state, []);
    expect(state.enemies[0]!.plannedIntents[0]!.intent.id).toBe("ape_blood_frenzy");
  });

  it("T143: an enemy dying mid-chain cancels the rest; each intent re-picks its target", () => {
    const { data, state } = makeTestCombat();
    setIntent(state, 0, idleIntent, null);
    state.enemies[1]!.hp = 5;
    state.heroes[0]!.statuses.push({ id: "reflect", value: 30 });
    setPlan(state, 1, [
      { intent: strike9Intent, targetId: "hero:m05" },
      { intent: strike9Intent, targetId: "hero:m05" },
    ]);
    const died = end(data, state);
    expect(died.events.filter((e) => e.type === "intentExecuted" && e.enemyId === "enemy:1")).toHaveLength(1);

    const retarget = makeTestCombat();
    setIntent(retarget.state, 1, idleIntent, null);
    retarget.state.heroes[2]!.hp = 1;
    setPlan(retarget.state, 0, [
      { intent: strike9Intent, targetId: "hero:m06" },
      { intent: strike9Intent, targetId: "hero:m06" },
    ]);
    const result = end(retarget.data, retarget.state);
    const executed = result.events.filter((e) => e.type === "intentExecuted" && e.enemyId === "enemy:0");
    expect(executed).toHaveLength(2);
    const second = executed[1]!;
    expect(second.type === "intentExecuted" && second.targetId).not.toBe("hero:m06");
  });

  it("T130: a frozen enemy skips its whole chain and loses its reserve", () => {
    const { data, state } = makeTestCombat();
    const puppet = state.enemies[0]!;
    puppet.statuses.push({ id: "freeze", value: 1 });
    puppet.moonReserve = 2;
    setPlan(state, 0, [
      { intent: strike9Intent, targetId: "hero:m05" },
      { intent: strike9Intent, targetId: "hero:m05" },
    ]);
    setIntent(state, 1, idleIntent, null);
    const result = end(data, state);
    expect(result.events.filter((e) => e.type === "intentSkipped" && e.enemyId === "enemy:0")).toHaveLength(1);
    expect(result.events.some((e) => e.type === "intentExecuted" && e.enemyId === "enemy:0")).toBe(false);
    expect(result.events).toContainEqual({ type: "moonReserveChanged", side: "enemy", enemyId: "enemy:0", value: 0 });
    const curve = data.enemies["puppet_guard"]!.moonPower;
    expect(result.state.enemies[0]!.moonPower).toBe(Math.min(curve.cap, curve.start + 1));
  });

  it("T147: same seed and same actions (mulligan, Chiêm Bài) give identical state and events", () => {
    const run = () => {
      const { data, state, events } = makeTestCombat({ mulligan: "pending" });
      const log = [...events];
      const step = (current: CombatState, action: Parameters<typeof applyAction>[2]) => {
        const result = applyAction(data, current, action);
        if (!result.ok) throw new Error(result.error);
        log.push(...result.events);
        return result.state;
      };
      let current = step(state, { type: "mulligan", instanceIds: state.hand.slice(0, 2) });
      // Force a Chiêm Bài into the sequence: Nguyệt Quang Dẫn to hand, enough moon power.
      const guide = instanceIdOf(current, "f04_nguyet_quang_dan");
      current.drawPile = current.drawPile.filter((id) => id !== guide);
      current.discardPile = current.discardPile.filter((id) => id !== guide);
      if (!current.hand.includes(guide)) current.hand.push(guide);
      current.moonPower = 11;
      current = step(current, { type: "playCard", instanceId: guide });
      expect(current.status).toBe("choosing");
      current = step(current, { type: "chooseCard", instanceId: current.pendingChoice!.options[0]! });
      for (let turn = 0; turn < 4 && current.status === "playerTurn"; turn++) {
        current = step(current, { type: "endTurn" });
      }
      return { state: current, log };
    };
    const first = run();
    const second = run();
    expect(second.state).toEqual(first.state);
    expect(second.log).toEqual(first.log);
  });
});
