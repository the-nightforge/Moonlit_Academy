import { describe, expect, it } from "vitest";
import { applyAction } from "../src/index";
import { killThenArmorCard } from "./fixtures";
import { injectCard, instanceIdOf, makeTestCombat, setHand } from "./helpers";

describe("combat end", () => {
  it("T57: killing the last enemy wins the combat", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.enemies[0]!.alive = false;
        s.enemies[0]!.hp = 0;
        s.enemies[1]!.hp = 5;
        setHand(s, ["m06_song_nhan_loan_vu"]);
      },
    });
    const result = applyAction(data, state, {
      type: "playCard",
      instanceId: instanceIdOf(state, "m06_song_nhan_loan_vu"),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.status).toBe("won");
    expect(result.events.some((event) => event.type === "unitDied" && event.unitId === "enemy:1")).toBe(true);
    expect(result.events.at(-1)).toMatchObject({ type: "combatEnded", result: "won" });
  });

  it("T58: actions are rejected after the combat ended", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.enemies[0]!.alive = false;
        s.enemies[0]!.hp = 0;
        s.enemies[1]!.hp = 5;
        setHand(s, ["m06_song_nhan_loan_vu", "f04_thao_duoc"]);
      },
    });
    const won = applyAction(data, state, {
      type: "playCard",
      instanceId: instanceIdOf(state, "m06_song_nhan_loan_vu"),
    });
    expect(won.ok).toBe(true);
    if (!won.ok) return;

    const play = applyAction(data, won.state, {
      type: "playCard",
      instanceId: instanceIdOf(won.state, "f04_thao_duoc"),
      targetId: "hero:m05",
    });
    expect(play.ok).toBe(false);
    expect(applyAction(data, won.state, { type: "endTurn" }).ok).toBe(false);
  });

  it("T60: remaining effects are skipped once the combat ends", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.enemies[0]!.alive = false;
        s.enemies[0]!.hp = 0;
        s.enemies[1]!.hp = 5;
      },
    });
    const instanceId = injectCard(state, data, killThenArmorCard);
    const result = applyAction(data, state, { type: "playCard", instanceId, targetId: "enemy:1" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.status).toBe("won");
    expect(result.state.heroes[0]?.armor).toBe(0);
    expect(result.events.some((event) => event.type === "armorGained")).toBe(false);
  });
});
