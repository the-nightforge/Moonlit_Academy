import { describe, expect, it } from "vitest";
import { applyAction, isCardPlayable } from "../src/index";
import { idleIntent, killThenArmorCard, strike9Intent } from "./fixtures";
import { injectCard, instanceIdOf, makeTestCombat, setHand, setIntent } from "./helpers";

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

  it("T55: a dead hero's cards become broken", () => {
    const { data, state } = makeTestCombat();
    const heavy = strike9Intent;
    state.heroes[2]!.hp = 5;
    setIntent(state, 0, heavy, "hero:m06");
    setIntent(state, 1, idleIntent, null);

    const result = applyAction(data, state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.heroes[2]?.alive).toBe(false);
    expect(
      result.events.some((e) => e.type === "unitDied" && e.unitId === "hero:m06"),
    ).toBe(true);

    const m06Card = instanceIdOf(result.state, "m06_am_tien");
    result.state.hand.push(m06Card);
    expect(isCardPlayable(data, result.state, m06Card)).toBe(false);
    const attempt = applyAction(data, result.state, {
      type: "playCard",
      instanceId: m06Card,
      targetId: "enemy:0",
    });
    expect(attempt.ok).toBe(false);
  });

  it("T56: a dead hero cannot be targeted by ally cards", () => {
    const { data, state } = makeTestCombat();
    const heavy = strike9Intent;
    state.heroes[2]!.hp = 5;
    setIntent(state, 0, heavy, "hero:m06");
    setIntent(state, 1, idleIntent, null);

    const result = applyAction(data, state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    setHand(result.state, ["f04_thao_duoc"]);
    const attempt = applyAction(data, result.state, {
      type: "playCard",
      instanceId: instanceIdOf(result.state, "f04_thao_duoc"),
      targetId: "hero:m06",
    });
    expect(attempt.ok).toBe(false);
  });

  it("T59: losing the last hero loses the combat", () => {
    const { data, state } = makeTestCombat();
    const heavy = strike9Intent;
    state.heroes[0]!.alive = false;
    state.heroes[0]!.hp = 0;
    state.heroes[2]!.alive = false;
    state.heroes[2]!.hp = 0;
    state.heroes[1]!.hp = 3;
    setIntent(state, 0, heavy, "hero:f04");
    setIntent(state, 1, idleIntent, null);

    const result = applyAction(data, state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.status).toBe("lost");
    expect(result.events.at(-1)).toMatchObject({ type: "combatEnded", result: "lost" });
  });
});
