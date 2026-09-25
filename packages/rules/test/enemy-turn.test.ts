import { describe, expect, it } from "vitest";
import { applyAction, getValidTargets } from "../src/index";
import { idleIntent, strike9Intent } from "./fixtures";
import { instanceIdOf, makeTestCombat, setHand, setIntent } from "./helpers";

describe("enemy turn", () => {
  it("T15: weak reduces enemy damage dealt to 75%", () => {
    const { data, state } = makeTestCombat();
    const heavy = strike9Intent;
    setIntent(state, 0, heavy, "hero:m05");
    state.enemies[0]!.statuses.push({ id: "weak", value: 1 });
    setIntent(state, 1, idleIntent, null);

    const result = applyAction(data, state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.heroes[0]?.hp).toBe(34);
  });

  it("T17: weak and vulnerable stack multiplicatively", () => {
    const { data, state } = makeTestCombat();
    const heavy = strike9Intent;
    setIntent(state, 0, heavy, "hero:m05");
    state.enemies[0]!.statuses.push({ id: "weak", value: 1 });
    state.heroes[0]!.statuses.push({ id: "vulnerable", value: 1 });
    setIntent(state, 1, idleIntent, null);

    const result = applyAction(data, state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.heroes[0]?.hp).toBe(30);
  });

  it("T33: taunt redirects a single-target intent", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => setHand(s, ["m05_ho_gam"]),
    });
    const heavy = strike9Intent;
    setIntent(state, 0, heavy, "hero:m06");
    setIntent(state, 1, idleIntent, null);
    const played = applyAction(data, state, {
      type: "playCard",
      instanceId: instanceIdOf(state, "m05_ho_gam"),
    });
    expect(played.ok).toBe(true);
    if (!played.ok) return;

    const result = applyAction(data, played.state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const damage = result.events.find((e) => e.type === "damageDealt");
    expect(damage).toMatchObject({ targetId: "hero:m05", blocked: 5, hpLost: 4 });
    expect(result.state.heroes[0]?.hp).toBe(36);
  });

  it("T34: stealthed announced target is re-picked among valid heroes", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => setHand(s, ["m06_anh_bo"]),
    });
    const heavy = strike9Intent;
    setIntent(state, 0, heavy, "hero:m06");
    setIntent(state, 1, idleIntent, null);
    const played = applyAction(data, state, {
      type: "playCard",
      instanceId: instanceIdOf(state, "m06_anh_bo"),
    });
    expect(played.ok).toBe(true);
    if (!played.ok) return;

    const result = applyAction(data, played.state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const executed = result.events.find((e) => e.type === "intentExecuted" && e.enemyId === "enemy:0");
    expect(executed).toBeDefined();
    expect(executed && "targetId" in executed ? executed.targetId : null).not.toBe("hero:m06");
    expect(result.state.heroes[2]?.hp).toBe(28);
  });

  it("T35: single-target intents fizzle when every hero is stealthed", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        for (const hero of s.heroes) hero.statuses.push({ id: "stealth", value: 1 });
      },
    });
    const result = applyAction(data, state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events.filter((e) => e.type === "intentFizzled")).toHaveLength(2);
    expect(result.events.some((e) => e.type === "damageDealt")).toBe(false);
    expect(result.state.heroes.map((h) => h.hp)).toEqual([40, 30, 28]);
  });

  it("T36: stealth does not block ally targeting", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.heroes[2]!.statuses.push({ id: "stealth", value: 1 });
      },
    });
    const targets = getValidTargets(data, state, instanceIdOf(state, "f04_thao_duoc"));
    expect(targets).toContain("hero:m06");
  });

  it("T38: mark duration decrements at round end", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => setHand(s, ["m06_nguyet_anh_an"]),
    });
    const marked = applyAction(data, state, {
      type: "playCard",
      instanceId: instanceIdOf(state, "m06_nguyet_anh_an"),
      targetId: "enemy:0",
    });
    expect(marked.ok).toBe(true);
    if (!marked.ok) return;

    const round2 = applyAction(data, marked.state, { type: "endTurn" });
    expect(round2.ok).toBe(true);
    if (!round2.ok) return;
    expect(round2.state.enemies[0]?.statuses).toContainEqual({
      id: "mark",
      value: 1,
      sourceId: "hero:m06",
    });

    const round3 = applyAction(data, round2.state, { type: "endTurn" });
    expect(round3.ok).toBe(true);
    if (!round3.ok) return;
    expect(round3.state.enemies[0]?.statuses.some((s) => s.id === "mark")).toBe(false);
    expect(
      round3.events.some((e) => e.type === "statusRemoved" && e.status === "mark"),
    ).toBe(true);
  });

  it("T43: frozen enemy skips its intent", () => {
    const { data, state } = makeTestCombat();
    state.enemies[0]!.statuses.push({ id: "freeze", value: 1 });
    setIntent(state, 1, idleIntent, null);

    const result = applyAction(data, state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.events.some(
        (e) => e.type === "intentSkipped" && e.enemyId === "enemy:0" && e.reason === "freeze",
      ),
    ).toBe(true);
    expect(result.events.some((e) => e.type === "damageDealt" && e.sourceId === "enemy:0")).toBe(
      false,
    );
    expect(result.state.enemies[0]?.statuses.some((s) => s.id === "freeze")).toBe(false);
  });

  it("T44: hero armor is cleared at player turn start", () => {
    const { data, state } = makeTestCombat({
      mutateData: (d) => {
        for (const def of Object.values(d.enemies)) {
          def.intentPattern = [idleIntent];
          def.moonOverrides = [];
        }
      },
      setup: (s) => {
        s.heroes[0]!.armor = 6;
      },
    });
    const result = applyAction(data, state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.heroes[0]?.armor).toBe(0);
  });

  it("T45: enemy armor is only cleared at enemy turn start", () => {
    const { data, state } = makeTestCombat();
    const guard = data.enemies["puppet_guard"]!.intentPattern[1]!;
    setIntent(state, 0, guard, "hero:m05");
    setIntent(state, 1, idleIntent, null);

    const result = applyAction(data, state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.enemies[0]?.armor).toBe(8);
  });
});
