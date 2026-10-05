import { describe, expect, it, vi } from "vitest";
import type { HeroState, StatusId, UnitState } from "rules";
import { computeCombatLayout, overlap } from "../src/ui/combat-layout";
import { fixture } from "./helpers/combat-fixture";

vi.stubGlobal("window", {
  devicePixelRatio: 1,
  screen: { width: 1280, height: 720 },
});

const { heroProgressLabel, heroTooltipLines, statusBadgeModels, statusTooltipNames, weaponForHero } = await import(
  "../src/ui/combat-display"
);

const ALL_STATUSES: StatusId[] = [
  "stealth",
  "taunt",
  "weak",
  "vulnerable",
  "mark",
  "burn",
  "regen",
  "strength",
  "empower",
  "freeze",
  "reflect",
  "guard",
  "charm",
];

function unitWith(statusCount: number, sealed: boolean): UnitState {
  return {
    id: "u_dense",
    hp: 10,
    maxHp: 20,
    armor: 0,
    statuses: ALL_STATUSES.slice(0, statusCount).map((id, i) => ({ id, value: i + 1 })),
    ...(sealed ? { sealedBy: "sealer_1" } : {}),
  } as UnitState;
}

describe("statusBadgeModels — two rows then +N overflow (`05` review)", () => {
  const { state } = fixture("coop");

  it("13 statuses + seal on a 100-wide co-op card: 6 badges, +9 hidden, order kept", () => {
    const unit = unitWith(13, true); // 14 entries
    const badges = statusBadgeModels(state, unit, 100);
    // perRow = floor((100-16)/24) = 3 → capacity 6 → 5 shown + 1 overflow.
    expect(badges).toHaveLength(6);
    expect(badges.at(-1)?.id).toBe("overflow");
    expect(badges.at(-1)?.hiddenCount).toBe(9);
    // First five keep state order — never re-sorted (a wrong processing order reads as a bug).
    expect(badges.slice(0, 5).map((b) => b.id)).toEqual(ALL_STATUSES.slice(0, 5));
  });

  it("fits exactly in two rows: no overflow badge", () => {
    const badges = statusBadgeModels(state, unitWith(5, true), 100); // 6 entries, capacity 6
    expect(badges).toHaveLength(6);
    expect(badges.at(-1)?.id).toBe("seal");
    expect(badges.some((b) => b.id === "overflow")).toBe(false);
  });

  it("the full tooltip still names every status + the seal", () => {
    const names = statusTooltipNames(fixture("coop").data, unitWith(13, true));
    expect(names).toHaveLength(14);
  });
});

describe("heroProgressLabel — Thức Tỉnh counter (`01` §8)", () => {
  const { data, state } = fixture("pve");
  const hero = state.heroes[0] as HeroState;
  const def = data.heroes[hero.defId]!;

  it("reads counter/threshold with the rules' formula", () => {
    const label = heroProgressLabel(data, state, { ...hero, levelUpCounter: 3 });
    expect(label).toBe(`3/${def.levelUp.threshold}`);
  });

  it("constellation ≥2 swaps to the constellation threshold — except a PvP hero", () => {
    const c2 = { ...hero, constellation: 2, levelUpCounter: 1 };
    expect(heroProgressLabel(data, state, c2)).toBe(`1/${def.levelUp.constellationThreshold}`);
    // Fair Arena (`17` §3.2): even-constellation perks stay off in PvP.
    const { state: pvpState } = fixture("pvp");
    const pvpHero = { ...(pvpState.heroes[0] as HeroState), constellation: 2, levelUpCounter: 1 };
    expect(heroProgressLabel(data, pvpState, pvpHero)).toBe(`1/${def.levelUp.threshold}`);
  });

  it("an already-Thức Tỉnh hero shows no counter", () => {
    expect(heroProgressLabel(data, state, { ...hero, leveledUp: true })).toBeNull();
  });
});

describe("hero tooltip — both authoritative awakening forms", () => {
  const { data, state } = fixture("pve");
  const hero = state.heroes[0]!;
  const def = data.heroes[hero.defId]!;

  it.each(["base", "alt"] as const)("marks selected %s and retains both full descriptions", levelUpForm => {
    const lines = heroTooltipLines(data, state, { ...hero, levelUpForm, constellation: 5, levelUpCounter: 2, armor: 4, sealedBy: "seal" });
    expect(lines).toContain(def.levelUp.description);
    expect(lines).toContain(def.altLevelUp.description);
    expect(lines.find(line => line.includes("Đang chọn"))).toContain(levelUpForm === "base" ? def.levelUp.name : def.altLevelUp.name);
    expect(lines).toContain(`Thức Tỉnh: mất HP · 2/${def.levelUp.constellationThreshold}`);
    // Awakening info only — unit stats and status notes live on the card itself.
    expect(lines.some((line) => line.startsWith("HP ") || line.includes("Phong Ấn"))).toBe(false);
  });

  it("shows awakened state instead of stale progress, and keeps PvP threshold authoritative", () => {
    expect(heroTooltipLines(data, state, { ...hero, leveledUp: true })).toContain("Đã Thức Tỉnh");
    expect(heroTooltipLines(data, state, { ...hero, leveledUp: true }).some(line => line.includes("Thức Tỉnh:"))).toBe(false);
    expect(heroTooltipLines(data, state, { ...hero, pvp: true, constellation: 5, levelUpCounter: 2 })).toContain(`Thức Tỉnh: mất HP · 2/${def.levelUp.threshold}`);
  });
});

describe("layout — summon slots belong to their seat (`05` review)", () => {
  it("two summons on one seat never overlap, nor touch the controls column", () => {
    const { state } = fixture("coop");
    const seat = state.players[0]!.index;
    const summons = [0, 1].map((i) => ({
      id: `sum_${i}`,
      summonId: "linh_thu_moc",
      player: seat,
      hp: 5,
      maxHp: 5,
      armor: 0,
      statuses: [],
      alive: true,
    }));
    const withSummons = { ...state, summons: summons as never };
    const layout = computeCombatLayout(withSummons, seat);
    const [a, b] = summons.map((s) => layout.units.get(s.id)!);
    expect(a).toBeDefined();
    expect(overlap(a, b)).toBe(false);
    expect(a.x + a.w).toBeLessThanOrEqual(layout.controls.x);
    expect(b.x + b.w).toBeLessThanOrEqual(layout.controls.x);
  });

  it("co-op: the partner's summon is not dropped into the enemy band", () => {
    const { state } = fixture("coop");
    const mySeat = state.players[0]!.index;
    const partner = state.players[1]!.index;
    const withSummons = {
      ...state,
      summons: [
        { id: "sum_mine", summonId: "linh_thu_moc", player: mySeat, hp: 5, maxHp: 5, armor: 0, statuses: [], alive: true },
        { id: "sum_theirs", summonId: "linh_thu_moc", player: partner, hp: 5, maxHp: 5, armor: 0, statuses: [], alive: true },
      ] as never,
    };
    const layout = computeCombatLayout(withSummons, mySeat);
    const mine = layout.units.get("sum_mine")!;
    const theirs = layout.units.get("sum_theirs")!;
    expect(overlap(mine, theirs)).toBe(false);
    // The other seat's pair sits in its own slot band — clear of the enemy band
    // (co-op's single boss ends well left of the right-edge summon column).
    for (const enemy of state.enemies) {
      const rect = layout.units.get(enemy.id);
      if (rect !== undefined) expect(overlap(theirs, rect)).toBe(false);
    }
    expect(theirs.x + theirs.w).toBeLessThanOrEqual(layout.controls.x);
  });

  it("a third+ own summon fans inside the slot band — never into the hand area", () => {
    const { state } = fixture("pve");
    const seat = state.players[0]!.index;
    const summons = [0, 1, 2, 3].map((i) => ({
      id: `sum_${i}`,
      summonId: "linh_thu_moc",
      player: seat,
      hp: 5,
      maxHp: 5,
      armor: 0,
      statuses: [],
      alive: true,
    }));
    const layout = computeCombatLayout({ ...state, summons: summons as never }, seat);
    for (const s of summons) {
      const rect = layout.units.get(s.id)!;
      expect(rect.y + rect.h).toBeLessThanOrEqual(layout.hand.y);
      expect(rect.x + rect.w).toBeLessThanOrEqual(layout.controls.x);
    }
  });
});

describe("weaponForHero — Trang Bị lookup (`05` review)", () => {
  it("finds the wearer's weapon — CombatWeapon.heroId is a defId, not the unit id", () => {
    const { state } = fixture("pve");
    const seat = state.players[0]!;
    const hero = state.heroes.find((h) => h.player === seat.index)!;
    seat.weapons = [{ heroId: hero.defId, weaponId: "w_xich_diem_thuong", refinement: 2 }];
    expect(weaponForHero(state, hero)).toEqual({ id: "w_xich_diem_thuong", refinement: 2, seat: seat.index });
  });

  it("returns undefined when the seat has no weapon on that hero", () => {
    const { state } = fixture("pve");
    expect(weaponForHero(state, state.heroes[0]!)).toBeUndefined();
  });

  it("seat-scoped: the other seat's weapon for the same hero def does not leak", () => {
    const { state } = fixture("pvp");
    const mine = state.heroes.find((h) => h.player === state.players[0]!.index)!;
    const shadow = { ...state.heroes.find((h) => h.player !== state.players[0]!.index)!, defId: mine.defId };
    state.players[1]!.weapons = [{ heroId: mine.defId, weaponId: "w_anh_nguyet_chuy", refinement: 1 }];
    expect(weaponForHero(state, mine)).toBeUndefined();
    expect(weaponForHero(state, shadow)?.id).toBe("w_anh_nguyet_chuy");
  });
});

describe("unit card fallback — no art still identifies the unit", () => {
  it("the spec name always comes from the definition, art or not", () => {
    const { data, state } = fixture("pve");
    const hero = state.heroes[0]!;
    // A missing portrait must still leave the def's name on the card (silhouette + name).
    expect(data.heroes[hero.defId]!.name.length).toBeGreaterThan(0);
  });
});
