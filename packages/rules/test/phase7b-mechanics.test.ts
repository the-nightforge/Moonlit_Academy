import { describe, expect, it } from "vitest";
import type { CardDef, CombatState, GameData, LevelUpPassive, SummonDef } from "../src/index";
import { applyAction } from "../src/index";
import { idleIntent } from "./fixtures";
import { injectCard, makeEnemiesIdle, makeTestCombat, p0, setIntent, withLevelUp } from "./helpers";

const rabbit: SummonDef = {
  id: "test_rabbit", name: "Thỏ", maxHp: 12, targeting: "lowestHp",
  action: [{ type: "damage", amount: 3, to: "chosen" }], awakenedId: "test_rabbit_up",
};
const rabbitUp: SummonDef = { ...rabbit, id: "test_rabbit_up", maxHp: 24, action: [{ type: "damage", amount: 6, to: "chosen" }] };
delete (rabbitUp as { awakenedId?: string }).awakenedId;

const withRabbits = (d: GameData) => {
  d.summons[rabbit.id] = rabbit;
  d.summons[rabbitUp.id] = rabbitUp;
};

const card = (partial: Partial<CardDef>): CardDef => ({
  id: "test_c", name: "C", ownerId: "f04", cost: 0, copies: 1, type: "skill", tags: [], target: "none",
  effects: [{ type: "gainMoonPower", amount: 0 }], text: "", ...partial,
});
const summonCard = card({ id: "test_summon", effects: [{ type: "summon", summonId: "test_rabbit" }] });

function play(data: GameData, state: CombatState, def: CardDef, targetId?: string) {
  const instanceId = injectCard(state, data, def);
  const result = applyAction(data, state, { type: "playCard", instanceId, ...(targetId ? { targetId } : {}) });
  if (!result.ok) throw new Error(result.error);
  return result;
}

describe("phase 7b — Linh Thú: triệu hồi và hành động", () => {
  it("T280: summon creates one Linh Thú per hero; summoning again heals it and adds Sức Mạnh 1; summonsMade counts both", () => {
    const { data, state } = makeTestCombat({
      mutateData: (d) => { withRabbits(d); withLevelUp("f04", { counter: "summonsMade", threshold: 99 })(d); },
    });
    const first = play(data, state, summonCard);
    expect(first.state.summons).toHaveLength(1);
    expect(first.state.summons![0]).toMatchObject({
      id: "summon:f04", summonId: "test_rabbit", ownerHeroId: "hero:f04", side: "hero", player: 0,
      hp: 12, maxHp: 12, alive: true, position: 1,
    });
    expect(first.events).toContainEqual({ type: "summoned", unitId: "summon:f04", summonId: "test_rabbit", ownerHeroId: "hero:f04" });

    first.state.summons![0]!.hp = 5;
    const again = play(data, first.state, { ...summonCard, id: "test_summon2" });
    expect(again.state.summons).toHaveLength(1);
    expect(again.state.summons![0]!.hp).toBe(12);
    expect(again.state.summons![0]!.statuses).toContainEqual({ id: "strength", value: 1 });
    expect(again.state.heroes[1]!.levelUpCounter).toBe(2);
    expect(state.summons).toBeUndefined(); // the input state was not mutated
  });

  it("T281: at the end of the player turn each Linh Thú acts on its targeting before the enemy turn; strength and weak apply", () => {
    const { data, state } = makeTestCombat({
      mutateData: (d) => { withRabbits(d); makeEnemiesIdle(d); },
    });
    const summoned = play(data, state, summonCard);
    const s = summoned.state;
    s.enemies[0]!.hp = 20;
    s.enemies[1]!.hp = 10; // lowestHp picks enemy:1
    s.summons![0]!.statuses.push({ id: "strength", value: 2 });
    const ended = applyAction(data, s, { type: "endTurn" });
    if (!ended.ok) throw new Error(ended.error);
    const acted = ended.events.findIndex((e) => e.type === "summonActed");
    const enemyTurn = ended.events.findIndex((e) => e.type === "turnStarted" && e.side === "enemy");
    expect(acted).toBeGreaterThanOrEqual(0);
    expect(acted).toBeLessThan(enemyTurn);
    expect(ended.events).toContainEqual({ type: "damageDealt", sourceId: "summon:f04", targetId: "enemy:1", amount: 5, blocked: 0, hpLost: 5 });
  });
});
