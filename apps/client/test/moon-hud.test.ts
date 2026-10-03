import { describe, expect, it, vi } from "vitest";
import { fixture } from "./helpers/combat-fixture";

vi.stubGlobal("window", {
  devicePixelRatio: 1,
  screen: { width: 1280, height: 720 },
});

const { moonHudModel } = await import("../src/ui/moon-hud");

const { data, state } = fixture("pve");

describe("moonHudModel", () => {
  it("exposes all 8 phases with their rolled decree and description", () => {
    const model = moonHudModel(data, state);
    expect(model.phases).toHaveLength(8);
    expect(model.current).toBe(state.moonIndex);
    expect(model.bloodRounds).toBe(state.bloodMoonRounds);
    for (const phase of model.phases) {
      const def = data.moonPhases[phase.index]!;
      expect(phase.name).toBe(def.name);
      // The decree name resolves the state's rolled id — never the three candidates.
      const rolled = state.moonDecrees[phase.index];
      expect(def.decrees.some((d) => d.id === rolled)).toBe(true);
      expect(phase.decreeName).toBe(def.decrees.find((d) => d.id === rolled)!.name);
      expect(phase.description.length).toBeGreaterThan(0);
    }
  });

  it("mirrors a blood-moon countdown from state", () => {
    const blood = { ...state, bloodMoonRounds: 2 };
    expect(moonHudModel(data, blood).bloodRounds).toBe(2);
  });
});
