import { describe, expect, it } from "vitest";
import { previewEnemyIntent } from "../src/index";
import { makeTestCombat, setIntent } from "./helpers";
import { idleIntent } from "./fixtures";

describe("previewEnemyIntent", () => {
  it("keeps the announced target when it is alive and visible", () => {
    const { data, state } = makeTestCombat();
    const heavy = data.enemies["puppet_guard"]!.intentPattern[0]!;
    setIntent(state, 0, heavy, "hero:m05");

    const preview = previewEnemyIntent(data, state, state.enemies[0]!);
    expect(preview?.targetId).toBe("hero:m05");
    expect(preview?.skipped).toBe(false);
    expect(preview?.fizzles).toBe(false);
    expect(preview?.damages).toEqual([{ targetId: "hero:m05", amount: 9, hits: 1 }]);
  });

  it("re-resolves through taunt without consuming rng state", () => {
    const { data, state } = makeTestCombat();
    const heavy = data.enemies["puppet_guard"]!.intentPattern[0]!;
    setIntent(state, 0, heavy, "hero:m06");
    state.heroes[0]!.statuses.push({ id: "taunt", value: 1 });
    const rngBefore = state.rngState;

    const preview = previewEnemyIntent(data, state, state.enemies[0]!);
    expect(preview?.targetId).toBe("hero:m05");
    expect(state.rngState).toBe(rngBefore);
  });

  it("shows reduced damage when the enemy is weak and target vulnerable", () => {
    const { data, state } = makeTestCombat();
    const heavy = data.enemies["puppet_guard"]!.intentPattern[0]!;
    setIntent(state, 0, heavy, "hero:m05");
    state.enemies[0]!.statuses.push({ id: "weak", value: 1 });
    state.heroes[0]!.statuses.push({ id: "vulnerable", value: 1 });

    const preview = previewEnemyIntent(data, state, state.enemies[0]!);
    expect(preview?.damages[0]?.amount).toBe(10);
  });

  it("marks a frozen enemy as skipped", () => {
    const { data, state } = makeTestCombat();
    state.enemies[0]!.statuses.push({ id: "freeze", value: 1 });
    const preview = previewEnemyIntent(data, state, state.enemies[0]!);
    expect(preview?.skipped).toBe(true);
  });

  it("reports fizzles when no hero can be targeted", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        for (const hero of s.heroes) hero.statuses.push({ id: "stealth", value: 1 });
      },
    });
    const preview = previewEnemyIntent(data, state, state.enemies[0]!);
    expect(preview?.targetId).toBeNull();
    expect(preview?.fizzles).toBe(true);
    expect(preview?.damages).toEqual([]);
  });

  it("returns null for an intent with no effects targeting", () => {
    const { data, state } = makeTestCombat();
    setIntent(state, 0, idleIntent, null);
    const preview = previewEnemyIntent(data, state, state.enemies[0]!);
    expect(preview?.targetId).toBeNull();
    expect(preview?.damages).toEqual([]);
  });
});
