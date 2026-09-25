import { describe, expect, it } from "vitest";
import type { CombatState } from "../src/index";
import { applyAction, getEffectiveCost } from "../src/index";
import { idleIntent } from "./fixtures";
import { instanceIdOf, makeTestCombat, setHand, setIntent } from "./helpers";

function hero(state: CombatState, defId: string) {
  return state.heroes.find((h) => h.defId === defId)!;
}

describe("boss and blood moon intents", () => {
  it("T91: bloodMoonOverride wins over a matching moon override", () => {
    const { data, state } = makeTestCombat({ heroIds: ["m05", "f03", "f02"], encounterId: "enc_04" });
    state.moonIndex = 3;
    state.bloodMoonRounds = 2;
    setIntent(state, 0, idleIntent, null);
    const patternIndex = state.enemies[0]!.patternIndex;

    const result = applyAction(data, state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.moonIndex).toBe(4);
    expect(result.state.bloodMoonRounds).toBe(1);
    expect(result.state.enemies[0]?.currentIntent?.intent.id).toBe("ape_blood_frenzy");
    expect(result.state.enemies[0]?.patternIndex).toBe(patternIndex + 1);
  });

  it("T92: the boss's Hạ Huyền reflect lasts through the player turn, then is removed", () => {
    const { data, state } = makeTestCombat({ heroIds: ["m05", "f03", "f02"], encounterId: "enc_04" });
    state.moonIndex = 5;
    setIntent(state, 0, idleIntent, null);

    const announced = applyAction(data, state, { type: "endTurn" });
    expect(announced.ok).toBe(true);
    if (!announced.ok) return;
    expect(announced.state.enemies[0]?.currentIntent?.intent.id).toBe("ape_mirror_shell");

    const executed = applyAction(data, announced.state, { type: "endTurn" });
    expect(executed.ok).toBe(true);
    if (!executed.ok) return;
    const boss = executed.state.enemies[0]!;
    expect(boss.statuses).toContainEqual({ id: "reflect", value: 3 });
    expect(boss.armor).toBe(21);

    setHand(executed.state, ["f03_suong_tram"]);
    const f03Hp = hero(executed.state, "f03").hp;
    const played = applyAction(data, executed.state, {
      type: "playCard",
      instanceId: instanceIdOf(executed.state, "f03_suong_tram"),
      targetId: "enemy:0",
    });
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(hero(played.state, "f03").hp).toBe(f03Hp - 3);

    const next = applyAction(data, played.state, { type: "endTurn" });
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    const enemyTurn = next.events.findIndex((e) => e.type === "turnStarted" && e.side === "enemy");
    const removed = next.events.findIndex(
      (e) => e.type === "statusRemoved" && e.targetId === "enemy:0" && e.status === "reflect",
    );
    expect(removed).toBeGreaterThan(enemyTurn);
  });

  it("T93: ward and harmony cards are cheaper in their moon phases", () => {
    const { data, state } = makeTestCombat({ heroIds: ["m05", "f03", "f04"] });
    const cost = (cardId: string) => getEffectiveCost(data, state, instanceIdOf(state, cardId));

    state.moonIndex = 6;
    expect(cost("m05_ho_gam")).toBe(0);
    expect(cost("f03_phong_tuyet_chuong")).toBe(2);

    state.moonIndex = 4;
    expect(cost("f04_thao_duoc")).toBe(0);
    expect(cost("m05_ho_gam")).toBe(2);
  });
});
