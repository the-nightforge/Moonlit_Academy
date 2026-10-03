import { describe, expect, it } from "vitest";
import { loadCombatSettings, saveCombatSettings, ShakeBudget } from "../src/ui/combat-settings";

const DEFAULTS = { speed: 1, reducedMotion: false, volume: 0.5 } as const;

function memoryStorage(initial?: string) {
  const memory = new Map<string, string>();
  if (initial !== undefined) memory.set("vongnguyet.combatSettings.v1", initial);
  return {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => void memory.set(key, value),
  };
}

describe("loadCombatSettings", () => {
  it("returns defaults on corrupt JSON, honoring the media preference", () => {
    const corrupt = memoryStorage("{broken");
    expect(loadCombatSettings(corrupt, true)).toEqual({ speed: 1, reducedMotion: true, volume: 0.5 });
    expect(loadCombatSettings(corrupt, false)).toEqual(DEFAULTS);
  });

  it("returns defaults when nothing is stored", () => {
    expect(loadCombatSettings(memoryStorage(), false)).toEqual(DEFAULTS);
  });

  it("survives a throwing storage", () => {
    const denied = { getItem: () => { throw new Error("denied"); } };
    expect(loadCombatSettings(denied, true)).toEqual({ speed: 1, reducedMotion: true, volume: 0.5 });
  });

  it("keeps valid fields, clamps volume, rejects an invalid speed", () => {
    const storage = memoryStorage(JSON.stringify({ speed: 3, reducedMotion: false, volume: 7 }));
    expect(loadCombatSettings(storage, true)).toEqual({ speed: 1, reducedMotion: false, volume: 1 });
  });

  it("an explicit saved reducedMotion beats the media preference", () => {
    const storage = memoryStorage(JSON.stringify({ speed: 2, reducedMotion: false, volume: 0.2 }));
    expect(loadCombatSettings(storage, true)).toEqual({ speed: 2, reducedMotion: false, volume: 0.2 });
  });
});

describe("saveCombatSettings", () => {
  it("round-trips through storage", () => {
    const storage = memoryStorage();
    saveCombatSettings(storage, { speed: 2, reducedMotion: true, volume: 0.25 });
    expect(loadCombatSettings(storage, false)).toEqual({ speed: 2, reducedMotion: true, volume: 0.25 });
  });

  it("persists only preference fields — no gameplay state", () => {
    let written = "";
    saveCombatSettings({ setItem: (_key, value) => void (written = value) }, DEFAULTS);
    expect(Object.keys(JSON.parse(written) as Record<string, unknown>).sort()).toEqual([
      "reducedMotion",
      "speed",
      "volume",
    ]);
  });
});

describe("ShakeBudget", () => {
  it("rejects every shake under reduced motion", () => {
    const budget = new ShakeBudget(true);
    expect(budget.allow(60)).toBe(false);
    expect(budget.allow(1)).toBe(false);
  });

  it("caps a beat at two shakes and 120 ms total", () => {
    const budget = new ShakeBudget(false);
    expect(budget.allow(80)).toBe(true);
    expect(budget.allow(50)).toBe(false); // 80 + 50 > 120
    expect(budget.allow(40)).toBe(true);
    expect(budget.allow(1)).toBe(false); // a third shake
  });
});
