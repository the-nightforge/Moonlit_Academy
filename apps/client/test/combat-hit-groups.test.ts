import { describe, expect, it, vi } from "vitest";
import type { CombatEvent } from "rules";

vi.stubGlobal("window", {
  devicePixelRatio: 1,
  screen: { width: 1280, height: 720 },
  location: { href: "http://localhost/" },
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout,
});

const { groupDamageEvents } = await import("../src/ui/event-animator");
import type { DamageEvent } from "../src/ui/event-animator";

const damage = (targetId: string, sourceId = "h0"): DamageEvent =>
  ({ type: "damageDealt", sourceId, targetId, amount: 1, blocked: 0, hpLost: 1 });

const healed = { type: "healed", targetId: "a", amount: 2 } as CombatEvent;
const statusApplied = {
  type: "statusApplied",
  targetId: "a",
  status: "weak",
  value: 2,
} as CombatEvent;

describe("groupDamageEvents", () => {
  it("merges consecutive same-source hits on distinct targets", () => {
    expect(groupDamageEvents([damage("a"), damage("b"), damage("a"), damage("b")]).map((g) => g.length)).toEqual([
      2, 2,
    ]);
    expect(groupDamageEvents([damage("a"), damage("b"), damage("c")]).map((g) => g.length)).toEqual([3]);
  });

  it("repeated targets on the same source stay serial — one hit per group", () => {
    expect(groupDamageEvents([damage("a"), damage("a"), damage("a")]).map((g) => g.length)).toEqual([1, 1, 1]);
    expect(groupDamageEvents([damage("a"), damage("b"), damage("a")]).map((g) => g.length)).toEqual([2, 1]);
  });

  it("a different source closes the group", () => {
    expect(groupDamageEvents([damage("a"), damage("b", "h1"), damage("c")]).map((g) => g.length)).toEqual([1, 1, 1]);
  });

  it("non-damage events are barriers and keep their own slot", () => {
    const groups = groupDamageEvents([damage("a"), healed, damage("b")]);
    expect(groups.map((g) => g.length)).toEqual([1, 1, 1]);
    expect(groups[1]![0]).toBe(healed);
  });

  it("flattens back to the input — no sorting, no dropping", () => {
    const events: CombatEvent[] = [damage("a"), damage("b"), healed, damage("a"), damage("a"), statusApplied];
    expect(groupDamageEvents(events).flat()).toEqual(events);
  });
});
