import { describe, expect, it } from "vitest";
import { computeCombatLayout, fitChoicePanel, handSlots } from "../src/ui/combat-layout";
import type { Rect } from "../src/ui/combat-layout";
import { fixture } from "./helpers/combat-fixture";

/** Strict rectangle intersection — the shared test helper the plan names. */
function overlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

const { data, state } = fixture("pve");

describe("computeCombatLayout", () => {
  it("places the three PvE hero cards on the own row and enemies inside 300..920", () => {
    const layout = computeCombatLayout(state, 0);
    const heroXs = state.heroes.map((hero) => layout.units.get(hero.id)!.x + 68);
    expect(heroXs).toEqual([470, 640, 810]);
    for (const hero of state.heroes) {
      const rect = layout.units.get(hero.id)!;
      expect(rect.w).toBe(136);
      expect(rect.h).toBe(196);
      expect(rect.y + rect.h / 2).toBe(424);
    }
    for (const enemy of state.enemies) {
      const rect = layout.units.get(enemy.id)!;
      const cx = rect.x + rect.w / 2;
      expect(cx).toBeGreaterThanOrEqual(300);
      expect(cx).toBeLessThanOrEqual(920);
      expect(rect.y + rect.h / 2).toBe(200);
    }
    // No unit may intrude into the controls column.
    for (const rect of layout.units.values()) {
      expect(overlap(rect, layout.controls)).toBe(false);
    }
  });

  it("pins the frame rects: hand area, controls column, moon header", () => {
    const layout = computeCombatLayout(state, 0);
    expect(layout.hand).toEqual({ x: 130, y: 556, w: 1010, h: 160 });
    expect(layout.controls).toEqual({ x: 1154, y: 48, w: 104, h: 652 });
    expect(layout.moon).toEqual({ x: 640, y: 40 });
    expect(layout.phaseSlots.map((p) => p.x)).toEqual([464, 504, 544, 584, 696, 736, 776, 816]);
    expect(layout.phaseSlots.every((p) => p.y === 40)).toBe(true);
    expect(layout.phaseLabel).toEqual({ x: 390, y: 72, w: 500, h: 24 });
  });

  it("gives every seat its own zone anchors — no shared second coordinate system", () => {
    const { state: pvp } = fixture("pvp");
    const layout = computeCombatLayout(pvp, 0);
    expect(layout.seats.get(0)).toEqual({
      draw: { x: 54, y: 424 },
      discard: { x: 54, y: 504 },
      hand: { x: 635, y: 636 },
      resource: { x: 1206, y: 104 },
      reserve: { x: 1206, y: 144 },
    });
    expect(layout.seats.get(1)).toEqual({
      draw: { x: 54, y: 168 },
      discard: { x: 54, y: 248 },
      hand: { x: 156, y: 168 },
      resource: { x: 1206, y: 248 },
      reserve: { x: 1206, y: 288 },
    });
  });

  it("co-op: own 100×148 trio left, partner trio right, summon slots stay clear of controls", () => {
    const { state: coop } = fixture("coop");
    const layout = computeCombatLayout(coop, 0);
    const own = coop.heroes.filter((hero) => hero.player === 0);
    const partner = coop.heroes.filter((hero) => hero.player === 1);
    expect(own.map((hero) => layout.units.get(hero.id)!.x + 50)).toEqual([300, 412, 524]);
    expect(partner.map((hero) => layout.units.get(hero.id)!.x + 50)).toEqual([660, 772, 884]);
    for (const hero of coop.heroes) {
      const rect = layout.units.get(hero.id)!;
      expect(rect.w).toBe(100);
      expect(rect.h).toBe(148);
      expect(rect.y + rect.h / 2).toBe(424);
    }
    for (const rect of layout.units.values()) {
      expect(overlap(rect, layout.controls)).toBe(false);
    }
    // Partner seat anchors come from the same map — draw/discard/hand/resource.
    expect(layout.seats.get(1)).toEqual({
      draw: { x: 970, y: 532 },
      discard: { x: 1080, y: 532 },
      hand: { x: 790, y: 532 },
      resource: { x: 1080, y: 316 },
      reserve: { x: 1130, y: 316 },
    });
  });
});

describe("handSlots", () => {
  const layout = computeCombatLayout(state, 0);

  it("keeps every card fully inside the hand area at full hand", () => {
    const slots = handSlots(10, layout.hand);
    expect(slots).toHaveLength(10);
    expect(slots.every((p) => p.x - 55 >= 130 && p.x + 55 <= 1140)).toBe(true);
    expect(slots.every((p) => p.y === 636)).toBe(true);
  });

  it("caps the gap at 120 — a small hand stays centered on the area, not stretched", () => {
    const slots = handSlots(3, layout.hand);
    expect(slots[1]!.x - slots[0]!.x).toBe(120);
    expect(slots[1]!.x).toBe(635); // centered in the area (130..1140), not the screen
  });

  it("handles the degenerate counts", () => {
    expect(handSlots(0, layout.hand)).toEqual([]);
    expect(handSlots(1, layout.hand)).toEqual([{ x: 635, y: 636 }]);
  });
});

describe("fitChoicePanel", () => {
  const visible = { x: 0, y: 0, w: 1280, h: 720 };

  it("caps at the visible height minus margin when the text runs long", () => {
    expect(fitChoicePanel(900, visible).h).toBe(688);
  });

  it("sizes to the real text plus chrome when it fits", () => {
    expect(fitChoicePanel(120, visible).h).toBe(216);
  });

  it("stays fully inside the visible rect", () => {
    const rect = fitChoicePanel(900, { x: 100, y: 40, w: 1280, h: 720 });
    expect(rect.x).toBeGreaterThanOrEqual(100);
    expect(rect.y).toBeGreaterThanOrEqual(40);
    expect(rect.x + rect.w).toBeLessThanOrEqual(100 + 1280);
    expect(rect.y + rect.h).toBeLessThanOrEqual(40 + 720);
    expect(rect.w).toBe(360);
  });
});
