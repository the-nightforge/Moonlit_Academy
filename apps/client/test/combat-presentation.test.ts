import { describe, expect, it } from "vitest";
import type { CombatState, UnitState } from "rules";
import { cloneState } from "rules";
import { applyPresentationEvent, createPresentation } from "../src/ui/combat-presentation";
import type { PresentationBindings } from "../src/ui/combat-presentation";
import { fixture } from "./helpers/combat-fixture";

const { data, state: base } = fixture("pve");

/** Test helper — any unit of the visual state by id (not a production API). */
function target(state: CombatState, id: string): UnitState {
  const unit =
    state.heroes.find((hero) => hero.id === id) ??
    state.enemies.find((enemy) => enemy.id === id) ??
    state.summons?.find((summon) => summon.id === id);
  expect(unit, `unit ${id}`).toBeDefined();
  return unit!;
}

describe("createPresentation", () => {
  it("deep-clones the before state — editing the clone never touches before/after", () => {
    const visual = createPresentation(base);
    const heroId = visual.heroes[0]!.id;
    visual.heroes[0]!.hp = 1;
    expect(base.heroes.find((hero) => hero.id === heroId)!.hp).not.toBe(1);
  });
});

describe("applyPresentationEvent", () => {
  it("damage subtracts blocked from armor and hpLost from hp — no mitigation recompute", () => {
    const before = cloneState(base);
    const after = cloneState(base);
    const visual = createPresentation(before);
    const unit = visual.heroes[0]!;
    unit.hp = 20;
    unit.armor = 5;
    const beforeJson = JSON.stringify(before);
    const afterJson = JSON.stringify(after);
    applyPresentationEvent(
      data,
      visual,
      { type: "damageDealt", sourceId: "src", targetId: unit.id, amount: 8, blocked: 5, hpLost: 3 },
      after,
    );
    expect([target(visual, unit.id).hp, target(visual, unit.id).armor]).toEqual([17, 0]);
    applyPresentationEvent(data, visual, { type: "armorGained", targetId: unit.id, amount: 2 }, after);
    expect(target(visual, unit.id).armor).toBe(2);
    expect(JSON.stringify(before)).toBe(beforeJson);
    expect(JSON.stringify(after)).toBe(afterJson);
  });

  it("heals clamp to maxHp; hpLost subtracts raw", () => {
    const visual = createPresentation(base);
    const unit = visual.heroes[0]!;
    unit.hp = unit.maxHp - 2;
    applyPresentationEvent(data, visual, { type: "healed", targetId: unit.id, amount: 5 }, base);
    expect(target(visual, unit.id).hp).toBe(unit.maxHp);
    applyPresentationEvent(data, visual, { type: "hpLost", targetId: unit.id, amount: 4, cause: "burn" }, base);
    expect(target(visual, unit.id).hp).toBe(unit.maxHp - 4);
  });

  it("statusApplied stores the raw total (replaces, never adds); statusRemoved deletes", () => {
    const visual = createPresentation(base);
    const unit = visual.heroes[0]!;
    unit.statuses = [{ id: "strength", value: 2 }];
    applyPresentationEvent(data, visual, { type: "statusApplied", targetId: unit.id, status: "strength", value: 5 }, base);
    expect(target(visual, unit.id).statuses.find((s) => s.id === "strength")?.value).toBe(5);
    applyPresentationEvent(data, visual, { type: "statusRemoved", targetId: unit.id, status: "strength" }, base);
    expect(target(visual, unit.id).statuses.some((s) => s.id === "strength")).toBe(false);
  });

  it("unitDied marks the unit dead; heroRevived stands it back up at the event hp", () => {
    const visual = createPresentation(base);
    const unit = visual.heroes[0]!;
    applyPresentationEvent(data, visual, { type: "unitDied", unitId: unit.id }, base);
    expect(target(visual, unit.id).alive).toBe(false);
    applyPresentationEvent(data, visual, { type: "heroRevived", heroId: unit.id, hp: 7 }, base);
    expect([target(visual, unit.id).alive, target(visual, unit.id).hp]).toEqual([true, 7]);
  });

  it("summoned builds a fresh Linh Thú from the def — not the (possibly dead) after copy", () => {
    const visual = createPresentation(base);
    const owner = visual.heroes[0]!;
    const summonId = Object.keys(data.summons)[0]!;
    // The `after` snapshot already shows the summon dead — the beat must not inherit hp 0.
    const after = cloneState(base);
    after.summons = [
      { id: "s1", defId: summonId, summonId, side: "hero", player: 0, ownerHeroId: owner.id, position: 0, hp: 0, maxHp: 0, armor: 0, statuses: [], alive: false },
    ];
    applyPresentationEvent(
      data,
      visual,
      { type: "summoned", unitId: "s1", summonId, ownerHeroId: owner.id },
      after,
    );
    const summon = target(visual, "s1");
    expect(summon.alive).toBe(true);
    expect(summon.hp).toBe(data.summons[summonId]!.maxHp);
    expect(summon.maxHp).toBe(data.summons[summonId]!.maxHp);
  });

  it("card zones move by public identity — played leaves hand, draws join hand", () => {
    const visual = createPresentation(base);
    const seat = visual.players[0]!;
    const played = seat.hand[0]!;
    const handSize = seat.hand.length;
    applyPresentationEvent(data, visual, { type: "cardPlayed", instanceId: played, cost: 1 }, base);
    expect(seat.hand).not.toContain(played);
    expect(seat.hand.length).toBe(handSize - 1);
    applyPresentationEvent(data, visual, { type: "cardsDrawn", instanceIds: ["x1", "x2"] }, base);
    expect(seat.hand.slice(-2)).toEqual(["x1", "x2"]);
  });

  it("resource events update the acting seat", () => {
    const visual = createPresentation(base);
    applyPresentationEvent(data, visual, { type: "moonPowerChanged", value: 4, player: 0 }, base);
    expect(visual.players[0]!.moonPower).toBe(4);
    applyPresentationEvent(data, visual, { type: "moonShifted", from: 0, to: 3, cause: "card" }, base);
    expect(visual.moonIndex).toBe(3);
  });
});

describe("PresentationBindings", () => {
  it("exposes the four refresh hooks", () => {
    const calls: string[] = [];
    const bindings: PresentationBindings = {
      updateUnit: (id) => calls.push(`unit:${id}`),
      updateSeat: (seat) => calls.push(`seat:${seat}`),
      ensureSummon: (id) => calls.push(`summon:${id}`),
      updateMoon: () => calls.push("moon"),
    };
    const visual = createPresentation(base);
    bindings.updateUnit("u1", visual);
    bindings.updateSeat(0, visual);
    bindings.ensureSummon("s1", visual);
    bindings.updateMoon(visual);
    expect(calls).toEqual(["unit:u1", "seat:0", "summon:s1", "moon"]);
  });
});
