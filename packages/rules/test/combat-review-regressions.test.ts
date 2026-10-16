import { describe, expect, it } from "vitest";
import { applyAction, createCombat, createCoopCombat, createPvpCombat } from "../src/index";
import { computeDamageAmount, resolveEffects } from "../src/effects";
import { opponentsOf } from "../src/players";
import { startPlayerTurn, tickDurations } from "../src/turn";
import { startCoopTurn } from "../src/coop/turn";
import { runEnemyTurn } from "../src/enemy-turn";
import type { CardDef, CombatEvent, CombatState, GameData } from "../src/index";
import { injectCard, makeEnemiesIdle, testData, withoutDecrees } from "./helpers";

function combat(mode: "pve" | "pvp" | "coop", heroId = "f03") {
  const data = testData();
  withoutDecrees(data);
  makeEnemiesIdle(data);
  const side = { heroIds: [heroId, "f04", "m06"] as [string, string, string], loadout: { heroes: {} } };
  let state = mode === "pve"
    ? createCombat(data, { ...side, encounterId: "enc_01", seed: 42 }).state
    : mode === "pvp"
      ? createPvpCombat(data, { seed: 42, players: [side, side] }).state
      : createCoopCombat(data, { seed: 42, players: [side, side], encounterId: "enc_coop_01" }).state;
  for (const player of state.players) {
    const result = applyAction(data, state, { type: "mulligan", player: player.index, instanceIds: [] });
    if (!result.ok) throw new Error(result.error);
    state = result.state;
  }
  state.moonIndex = 0;
  state.bloodMoonRounds = 0;
  for (const unit of [...state.heroes, ...state.enemies]) {
    unit.statuses = [];
    unit.armor = 0;
    unit.hp = unit.maxHp = 500;
  }
  return { data, state, seat: state.activePlayer };
}

const attack = (id: string, ownerId: string, hits = 1): CardDef => ({
  id, name: id, ownerId, type: "attack", cost: 0, copies: 1, tags: [], target: "enemy", text: "",
  effects: [{ type: "damage", to: "chosen", amount: 5, hits }],
});

function play(data: GameData, state: CombatState, seat: number, card: CardDef) {
  const source = state.heroes.find((hero) => hero.player === seat && hero.defId === card.ownerId)!;
  const id = injectCard(state, data, card, seat);
  const result = applyAction(data, state, {
    type: "playCard", player: seat, instanceId: id,
    ...(card.target === "enemy" ? { targetId: opponentsOf(state, source)[0]!.id } : {}),
  });
  if (!result.ok) throw new Error(result.error);
  return result;
}

function startOwnTurn(data: GameData, state: CombatState, seat: number, events: CombatEvent[] = []) {
  if (state.mode === "coop") startCoopTurn(data, state, events);
  else startPlayerTurn(data, state, state.players[seat]!, events);
}

describe.each(["pve", "pvp", "coop"] as const)("combat review regressions (%s)", (mode) => {
  it("Hàn Kiếm marks the first opposing hit only, with PvP half-round duration", () => {
    const { data, state, seat } = combat(mode);
    const source = state.heroes.find((hero) => hero.player === seat && hero.defId === "f03")!;
    source.leveledUp = true;
    source.levelUpForm = "alt";
    source.constellation = 5;
    const target = opponentsOf(state, source)[0]!;
    const ally = state.heroes.find((hero) => hero.player === seat && hero !== source)!;
    const card = attack("frost", "f03", 2);
    // A charmed or self-directed hit must neither debuff allies nor spend the proc.
    resolveEffects(data, state, [{ type: "damage", to: "chosen", amount: 1 }], { source, card, chosenId: ally.id }, []);
    expect(ally.statuses).toEqual([]);
    expect(source.firstHitUsedThisTurn).toBe(false);
    const events: CombatEvent[] = [];
    resolveEffects(data, state, card.effects, { source, card, chosenId: target.id }, events);
    expect(events.filter((e) => e.type === "damageDealt").map((e) => e.amount)).toEqual([5, 7]);
    expect(events.filter((e) => e.type === "statusApplied")).toEqual([
      { type: "statusApplied", targetId: target.id, status: "vulnerable", value: mode === "pvp" ? 2 : 1 },
    ]);
    const second = opponentsOf(state, source)[1] ?? target;
    const again: CombatEvent[] = [];
    resolveEffects(data, state, [{ type: "damage", to: "chosen", amount: 1 }], { source, card, chosenId: second.id }, again);
    expect(again.some((e) => e.type === "statusApplied")).toBe(false);
    tickDurations(state, []);
    expect(target.statuses.find((s) => s.id === "vulnerable")?.value ?? 0).toBe(mode === "pvp" ? 1 : 0);
    startOwnTurn(data, state, seat);
    expect(source.firstHitUsedThisTurn).toBe(false);
  });

  it("Vũ Điệp gives flat +1 after her first own attack card, independent of teammates and hit count", () => {
    const setup = combat(mode, "f11");
    const { data, seat } = setup;
    let state = setup.state;
    const hero = () => state.heroes.find((h) => h.player === seat && h.defId === "f11")!;
    hero().leveledUp = true;
    // A teammate's attacks and her own skill do not enable Vũ Điệp.
    state = play(data, state, seat, attack("ally_one", "m06")).state;
    state = play(data, state, seat, attack("ally_two", "m06")).state;
    state = play(data, state, seat, { ...attack("own_skill", "f11"), type: "skill", target: "none", effects: [] }).state;
    const card = attack("first_own", "f11", 2);
    const target = () => opponentsOf(state, hero())[0]!;
    const before = structuredClone(state);
    expect(computeDamageAmount(data, state, { source: hero(), card }, target(), 5, false)).toBe(5);
    expect(state).toEqual(before);
    const first = play(data, state, seat, card);
    expect(first.events.filter((e) => e.type === "damageDealt").map((e) => e.amount)).toEqual([5, 5]);
    state = first.state;
    expect(computeDamageAmount(data, state, { source: hero(), card }, target(), 5, false)).toBe(6);
    for (const id of ["second_own", "third_own"]) {
      const result = play(data, state, seat, attack(id, "f11", 2));
      expect(result.events.filter((e) => e.type === "damageDealt").map((e) => e.amount)).toEqual([6, 6]);
      state = result.state;
    }
    // The other seat's copy has its own counter, even in the shared turn.
    if (mode === "coop") {
      const partner = state.heroes.find((h) => h.player !== seat && h.defId === "f11")!;
      partner.leveledUp = true;
      const result = play(data, state, partner.player, attack("partner_first", "f11", 2));
      expect(result.events.filter((e) => e.type === "damageDealt").map((e) => e.amount)).toEqual([5, 5]);
      state = result.state;
    }
    startOwnTurn(data, state, seat);
    const next = play(data, state, seat, attack("next_turn_first", "f11", 2));
    expect(next.events.filter((e) => e.type === "damageDealt").map((e) => e.amount)).toEqual([5, 5]);
  });

  it("Vũ Điệp counts earlier own attacks before leveling and resets even while dead", () => {
    const setup = combat(mode, "f11");
    const { data, seat } = setup;
    let state = play(data, setup.state, seat, attack("before_leveling", "f11")).state;
    const hero = () => state.heroes.find((h) => h.player === seat && h.defId === "f11")!;
    hero().leveledUp = true;
    const afterLevel = play(data, state, seat, attack("after_leveling", "f11"));
    expect(afterLevel.events.find((e) => e.type === "damageDealt")).toMatchObject({ amount: 6 });
    state = afterLevel.state;
    hero().alive = false;
    hero().hp = 0;
    startOwnTurn(data, state, seat);
    const rescuer = state.heroes.find((h) => h.player === seat && h.alive)!;
    resolveEffects(data, state, [{ type: "revive", ratio: 0.5, to: "chosen" }], { source: rescuer, chosenId: hero().id }, []);
    expect(hero().alive).toBe(true);
    const revived = play(data, state, seat, attack("revived_first", "f11"));
    expect(revived.events.find((e) => e.type === "damageDealt")).toMatchObject({ amount: 5 });
  });

  it("Vũ Điệp excludes bond attacks and leaves Nam Vọng's damage unchanged", () => {
    const setup = combat(mode, "f11");
    const { data, seat } = setup;
    let state = setup.state;
    const hero = () => state.heroes.find((h) => h.player === seat && h.defId === "f11")!;
    hero().leveledUp = true;
    state = play(data, state, seat, {
      ...attack("bond", "f11"),
      bond: { owners: ["f11", "m06"] },
    }).state;
    const first = play(data, state, seat, attack("after_bond", "f11"));
    expect(first.events.find((e) => e.type === "damageDealt")).toMatchObject({ amount: 5 });
    state = first.state;
    hero().levelUpForm = "alt";
    hero().constellation = 5;
    const alt = play(data, state, seat, attack("alt", "f11", 2));
    expect(alt.events.filter((e) => e.type === "damageDealt").map((e) => e.amount)).toEqual([5, 5]);
  });
});

describe("co-op fatigue", () => {
  it("starts at round 20 for every hero and summon and escalates on both sides", () => {
    const { data, state } = combat("coop");
    const owner = state.heroes[0]!;
    state.summons = [{ ...owner, id: "test_summon", ownerHeroId: owner.id, summonId: "test", hp: 20, maxHp: 20 }];
    state.round = 19;
    const before: CombatEvent[] = [];
    startCoopTurn(data, state, before);
    expect(before.some((e) => e.type === "hpLost" && e.cause === "fatigue")).toBe(false);
    for (const [round, amount] of [[20, 1], [21, 2]]) {
      state.round = round!;
      const events: CombatEvent[] = [];
      startCoopTurn(data, state, events);
      runEnemyTurn(data, state, events);
      expect(events.filter((e) => e.type === "hpLost" && e.cause === "fatigue")).toEqual(
        [...state.heroes, ...state.summons, ...state.enemies].map((u) => ({ type: "hpLost", targetId: u.id, amount, cause: "fatigue" })),
      );
    }
  });

  it("purges a fallen seat's cards, marks it done and lets the survivor continue", () => {
    const { data, state } = combat("coop");
    state.round = 20;
    for (const hero of state.heroes.filter((h) => h.player === 0)) hero.hp = 1;
    const events: CombatEvent[] = [];
    startCoopTurn(data, state, events);
    expect(state.status).toBe("playerTurn");
    expect(state.players.map((p) => p.done)).toEqual([true, false]);
    expect(events.filter((e) => e.type === "unitDied")).toHaveLength(3);
    expect(events.some((e) => e.type === "cardsPurged")).toBe(true);
    expect(state.players[0]!.drawPile).toEqual([]);
    const played = play(data, state, 1, attack("survivor", "m06"));
    expect(played.events.some((e) => e.type === "damageDealt")).toBe(true);
  });

  it("ends immediately on a total fatigue wipe before resource and turn-start hooks", () => {
    const { data, state } = combat("coop");
    state.round = 20;
    for (const hero of state.heroes) hero.hp = 1;
    const events: CombatEvent[] = [];
    startCoopTurn(data, state, events);
    expect(state.status).toBe("lost");
    expect(events.filter((e) => e.type === "unitDied")).toHaveLength(6);
    expect(events.at(-1)).toEqual({ type: "combatEnded", result: "lost" });
    expect(events.some((e) => e.type === "moonPowerChanged" || e.type === "cardsDrawn")).toBe(false);
  });
});
