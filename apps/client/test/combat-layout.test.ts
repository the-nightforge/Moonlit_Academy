import { describe, expect, it } from "vitest";
import { computeCombatLayout, fitChoicePanel, handSlots } from "../src/ui/combat-layout";
import type { Rect } from "../src/ui/combat-layout";
import { fixture } from "./helpers/combat-fixture";

/** Strict rectangle intersection — the shared test helper the plan names. */
function overlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

const { data, state } = fixture("pve");

it.each([1, 2, 3, 4])("centers the enemy group for %s enemies", count => {
  const enemies = Array.from({length:count}, (_,i)=>({...state.enemies[0]!,id:`enemy_${i}`}));
  const layout = computeCombatLayout({...state,enemies},0);
  const centers = enemies.map(e => {const r=layout.units.get(e.id)!;return r.x+r.w/2;});
  expect((Math.min(...centers)+Math.max(...centers))/2).toBe(640);
});

it.each(["pve", "pvp", "coop"] as const)("keeps pile click regions separate in %s", mode => {
  const {state:s}=fixture(mode), l=computeCombatLayout(s,0);
  for(const a of l.seats.values()) {
    expect(overlap({x:a.draw.x-45,y:a.draw.y-65,w:90,h:130},{x:a.discard.x-45,y:a.discard.y-35,w:90,h:70})).toBe(false);
  }

});

it.each([0, 1])("co-op viewer %s keeps each seat's second summon separate from all allies", (viewer) => {
  const {state} = fixture("coop");
  const summons = [0,1].flatMap(player => [0,1].map(i => ({id:`pair_${player}_${i}`,player,summonId:"tho_ngoc",alive:true,hp:5,maxHp:5,armor:0,statuses:[]})));
  const layout = computeCombatLayout({...state,summons:summons as never},viewer);
  const rectangles = summons.map(s => layout.units.get(s.id)!);
  for (let i=0;i<rectangles.length;i++) {
    const rect = rectangles[i]!;
    expect(rect.x + rect.w).toBeLessThanOrEqual(layout.controls.x);
    expect(rect.y + rect.h).toBeLessThanOrEqual(layout.hand.y);
    for (const next of rectangles.slice(i+1)) expect(overlap(rect,next)).toBe(false);
    for (const hero of state.heroes) expect(overlap(rect,layout.units.get(hero.id)!)).toBe(false);
  }
  for (const player of [0,1]) {
    const first = layout.units.get(`pair_${player}_0`)!;
    expect({x:first.x+first.w/2,y:first.y+first.h/2}).toEqual({x:player===viewer?1000:1100,y:410});
  }
});

describe("computeCombatLayout", () => {
  for (const viewer of [0, 1]) {
    it(`co-op summons share the ally band with distinct own/partner slots for viewer ${viewer}`, () => {
      const { state: coop } = fixture("coop");
      coop.summons = [0, 1].map(player => ({ id: `summon_${player}`, defId: "tho_ngoc", summonId: "tho_ngoc", side: "hero" as const, player, ownerHeroId: coop.heroes.find(h => h.player === player)!.id, position: 0, hp: 12, maxHp: 12, armor: 3, statuses: [], alive: true }));
      const layout = computeCombatLayout(coop, viewer);
      const own = layout.units.get(`summon_${viewer}`)!;
      const partner = layout.units.get(`summon_${1 - viewer}`)!;
      expect([own.x + 40, own.y + 54]).toEqual([1000, 410]);
      expect([partner.x + 40, partner.y + 54]).toEqual([1100, 410]);
      expect(overlap(own, partner)).toBe(false);
    });
  }
  it("places the three PvE hero cards on the own row and enemies inside 330..950", () => {
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
      expect(cx).toBeGreaterThanOrEqual(330);
      expect(cx).toBeLessThanOrEqual(950);
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
  });

  it("gives every seat its own zone anchors — no shared second coordinate system", () => {
    const { state: pvp } = fixture("pvp");
    const layout = computeCombatLayout(pvp, 0);
    expect(layout.seats.get(0)).toEqual({
      draw: { x: 54, y: 424 },
      discard: { x: 54, y: 540 },
      hand: { x: 635, y: 636 },
      resource: { x: 1206, y: 104 },
      reserve: { x: 1206, y: 144 },
    });
    expect(layout.seats.get(1)).toEqual({
      draw: { x: 54, y: 168 },
      discard: { x: 54, y: 286 },
      hand: { x: 156, y: 168 },
      resource: { x: 200, y: 242 },
      reserve: { x: 200, y: 270 },
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
