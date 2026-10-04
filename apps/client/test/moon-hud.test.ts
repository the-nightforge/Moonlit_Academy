import { describe, expect, it, vi } from "vitest";
import { fixture } from "./helpers/combat-fixture";

vi.stubGlobal("window", {
  devicePixelRatio: 1,
  screen: { width: 1280, height: 720 },
});

const { moonHudModel } = await import("../src/ui/moon-hud");

const { data, state } = fixture("pve");

describe("moonHudModel", () => {
  it("exposes current and next phases with their rolled decree and description", () => {
    const model = moonHudModel(data, state);
    expect(model.phase.index).toBe(state.moonIndex);
    expect(model.current).toBe(state.moonIndex);
    expect(model.bloodRounds).toBe(state.bloodMoonRounds);
    for (const phase of [model.phase, model.next]) {
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

  it.each([0, 6, 7])("shows the actual rolled next phase after %s, wrapping the cycle", index => {
    const model = moonHudModel(data, { ...state, moonIndex: index }) as ReturnType<typeof moonHudModel> & { next?: { index: number; name: string; decreeName: string; description: string } };
    const nextIndex = (index + 1) % 8;
    const phase = data.moonPhases[nextIndex]!;
    expect(model.next?.index).toBe(nextIndex);
    expect(model.next?.name).toBe(phase.name);
    const decree = phase.decrees.find(entry => entry.id === state.moonDecrees[nextIndex])!;
    expect(model.next?.decreeName).toBe(decree.name);
    expect(model.next?.description).toContain(decree.text);
  });
});
