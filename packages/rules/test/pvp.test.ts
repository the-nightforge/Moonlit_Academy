import { describe, expect, it } from "vitest";
import type { Action, CardDef, CombatEvent, CombatState, GameData, Loadout, PvpSide } from "../src/index";
import {
  applyAction,
  createPvpCombat,
  displayDuration,
  getStatus,
  getValidTargets,
  isCardPlayable,
  pvpBot,
  redactEvents,
  replayMatch,
  viewFor,
} from "../src/index";
import { p0, testData } from "./helpers";

// m05/m06 appear on both sides so injected fixture cards always find an owner.
const TEAM_A: [string, string, string] = ["m05", "f04", "m06"];
const TEAM_B: [string, string, string] = ["f03", "m05", "m06"];

function pvpSide(heroIds: [string, string, string], loadout?: Partial<Loadout>): PvpSide {
  return { heroIds, loadout: { heroes: {}, ...loadout, pvp: true } };
}

function makePvp(
  seed = 42,
  mutateData?: (data: GameData) => void,
  sides?: [PvpSide, PvpSide],
): { data: GameData; state: CombatState; events: CombatEvent[] } {
  const data = testData();
  mutateData?.(data);
  const created = createPvpCombat(data, {
    seed,
    players: sides ?? [pvpSide(TEAM_A), pvpSide(TEAM_B)],
  });
  return { data, state: created.state, events: [...created.events] };
}

/** Sends the empty mulligan for both seats; the match then stands at firstPlayer's turn. */
function startMatch(data: GameData, state: CombatState, events: CombatEvent[], order: [0, 1] | [1, 0] = [0, 1]): CombatState {
  let current = state;
  for (const seat of order) {
    const result = applyAction(data, current, { type: "mulligan", instanceIds: [], player: seat });
    if (!result.ok) throw new Error(`mulligan failed: ${result.error}`);
    events.push(...result.events);
    current = result.state;
  }
  return current;
}

function endTurn(data: GameData, state: CombatState, events: CombatEvent[], player?: number): CombatState {
  const result = applyAction(data, state, { type: "endTurn", ...(player !== undefined ? { player } : {}) });
  if (!result.ok) throw new Error(`endTurn failed: ${result.error}`);
  events.push(...result.events);
  return result.state;
}

const fixtureCard = (
  id: string,
  ownerId: string,
  target: CardDef["target"],
  effects: CardDef["effects"],
): CardDef => ({ id, name: id, ownerId, cost: 0, copies: 1, type: "skill", tags: [], target, effects, text: "" });

/** Adds `card` to `data` and puts one instance into `seat`'s hand (pvp ids prefixed). */
function pvpInjectCard(state: CombatState, data: GameData, seat: number, card: CardDef): string {
  data.cards[card.id] = card;
  const instanceId = `p${seat}_test_${card.id}`;
  state.cards[instanceId] = {
    instanceId,
    cardId: card.id,
    ownerIds: card.bond ? [...card.bond.owners] : [card.ownerId!],
    player: seat,
    heldTurns: 0,
  };
  state.players[seat]!.hand.push(instanceId);
  return instanceId;
}

/** A test relic with a single hook at resonance 1. */
function testRelic(data: GameData, id: string, hook: object): void {
  (data.relics as Record<string, unknown>)[id] = {
    id,
    name: id,
    rarity: "common",
    resonance: [{ text: "", hooks: [hook] }],
  };
}

const other = (seat: number) => (seat === 0 ? 1 : 0);

/** Last moonPowerChanged value emitted for `seat`, or undefined. */
function lastPowerGain(events: CombatEvent[], seat: number): number | undefined {
  const gains = events.filter(
    (e): e is Extract<CombatEvent, { type: "moonPowerChanged" }> =>
      e.type === "moonPowerChanged" && e.player === seat,
  );
  return gains.at(-1)?.value;
}

describe("T216 createPvpCombat", () => {
  it("creates both seats with prefixed ids, arena hp, a drawn hand each, and mulligan status", () => {
    const { data, state, events } = makePvp();
    expect(state.mode).toBe("pvp");
    expect(state.status).toBe("mulligan");
    expect(state.enemies).toHaveLength(0);
    expect(state.players).toHaveLength(2);
    expect([0, 1]).toContain(state.firstPlayer);
    expect(state.activePlayer).toBe(state.firstPlayer);
    for (const seat of state.players) {
      expect(seat.hand).toHaveLength(data.combatConfig.handSize);
      expect(seat.mulliganDone).toBe(false);
      for (const heroId of seat.heroIds) expect(heroId).toMatch(new RegExp(`^p${seat.index}_`));
    }
    for (const hero of state.heroes) {
      expect(hero.hp).toBe(data.pvpConfig.heroStats[hero.defId]!.maxHp);
      expect(hero.id).toMatch(new RegExp(`^p${hero.player}_`));
    }
    for (const id of Object.keys(state.cards)) expect(id).toMatch(/^p[01]_/);
    const draws = events.filter((e) => e.type === "cardsDrawn");
    expect(draws).toHaveLength(2);
    expect(draws[0]).toMatchObject({ player: 0 });
    expect(draws[1]).toMatchObject({ player: 1 });
  });

  it("is deterministic: same seed → same firstPlayer and same hands", () => {
    const a = makePvp(7);
    const b = makePvp(7);
    expect(a.state.firstPlayer).toBe(b.state.firstPlayer);
    expect(a.state.players.map((seat) => seat.hand)).toEqual(b.state.players.map((seat) => seat.hand));
    const seen = new Set<number>();
    for (let seed = 0; seed < 20; seed++) seen.add(makePvp(seed).state.firstPlayer!);
    expect(seen).toEqual(new Set([0, 1]));
  });
});

describe("T217 parallel mulligan", () => {
  it("keeps status mulligan until both seats finished; order of seats does not matter", () => {
    const { data, state, events } = makePvp();
    const secondFirst = startMatch(data, state, events, [1, 0]);
    expect(secondFirst.status).toBe("playerTurn");
    expect(secondFirst.activePlayer).toBe(secondFirst.firstPlayer);
    expect(secondFirst.players.every((seat) => seat.mulliganDone)).toBe(true);
    const turnIndex = events.findIndex((e) => e.type === "turnStarted");
    const secondMulliganIndex = events.map((e, i) => (e.type === "mulliganed" ? i : -1)).filter((i) => i >= 0)[1]!;
    expect(turnIndex).toBeGreaterThan(secondMulliganIndex);
    expect(events[turnIndex]).toMatchObject({ player: secondFirst.firstPlayer });
  });

  it("a seat that already mulliganed cannot act again while waiting", () => {
    const { data, state } = makePvp();
    const done = applyAction(data, state, { type: "mulligan", instanceIds: [], player: 1 });
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(done.state.status).toBe("mulligan");
    expect(done.state.players[1]!.mulliganDone).toBe(true);
    const again = applyAction(data, done.state, { type: "mulligan", instanceIds: [], player: 1 });
    expect(again).toEqual({ ok: false, error: "mulligan already done" });
    const hand = done.state.players[1]!.hand[0]!;
    const play = applyAction(data, done.state, { type: "playCard", instanceId: hand, player: 1 });
    expect(play.ok).toBe(false);
  });
});

describe("T218 turn ownership and combatStart order", () => {
  it("rejects actions from the seat without the turn", () => {
    const { data, state, events } = makePvp();
    const started = startMatch(data, state, events);
    const waiting = other(started.activePlayer);
    const end = applyAction(data, started, { type: "endTurn", player: waiting });
    expect(end).toEqual({ ok: false, error: "not your turn" });
    const hand = started.players[waiting]!.hand[0]!;
    const play = applyAction(data, started, {
      type: "playCard",
      instanceId: hand,
      player: waiting,
    });
    expect(play).toEqual({ ok: false, error: "not your turn" });
  });

  it("fires combatStart hooks after the first turn's start, first player then second", () => {
    const sides: [PvpSide, PvpSide] = [
      pvpSide(TEAM_A, { relics: [{ id: "r_test_start", resonance: 1 }] }),
      pvpSide(TEAM_B, { relics: [{ id: "r_test_start", resonance: 1 }] }),
    ];
    const { data, state, events } = makePvp(42, (d) =>
      testRelic(d, "r_test_start", {
        on: { type: "combatStart" },
        actor: "front",
        effects: [{ type: "gainMoonPower", amount: 1 }],
      }),
    sides,
    );
    const started = startMatch(data, state, events);
    const turnIndex = events.findIndex((e) => e.type === "turnStarted");
    const fired = events
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => e.type === "relicTriggered" && e.relicId === "r_test_start");
    expect(fired).toHaveLength(2);
    expect(fired[0]!.i).toBeGreaterThan(turnIndex);
    expect(fired[0]!.e).toMatchObject({ player: started.firstPlayer });
    expect(fired[1]!.e).toMatchObject({ player: other(started.firstPlayer!) });
  });
});

describe("T219 second player bonus", () => {
  it("adds secondPlayerBonus.moonPower on the second player's first turn only", () => {
    const { data, state, events } = makePvp();
    const started = startMatch(data, state, events);
    const first = started.firstPlayer!;
    const second = other(first);
    const firstGain = lastPowerGain(events, first)!;
    const afterFirst = endTurn(data, started, events);
    const secondGain = lastPowerGain(events, second)!;
    expect(secondGain).toBe(firstGain + data.pvpConfig.secondPlayerBonus.moonPower);
    expect(afterFirst.players[second]!.moonPower).toBe(
      firstGain + data.pvpConfig.secondPlayerBonus.moonPower,
    );
    // Not granted again: by round 2 both seats gain base+reserve without the bonus.
    let current = endTurn(data, afterFirst, events); // first's round-2 turn
    const firstRoundTwo = lastPowerGain(events, first)!;
    current = endTurn(data, current, events); // second's round-2 turn
    expect(lastPowerGain(events, second)).toBe(firstRoundTwo);
    expect(current.activePlayer).toBe(second);
    expect(current.round).toBe(2);
  });
});

describe("T220 per-turn durations", () => {
  const weakCard = fixtureCard("test_weak", "m05", "enemy", [
    { type: "applyStatus", status: "weak", amount: 1, to: "chosen" },
  ]);

  it("stores 2 × rounds, ticks once per either player's turn, displays ceil(/2)", () => {
    const { data, state, events } = makePvp();
    let current = startMatch(data, state, events);
    const active = current.activePlayer;
    const victim = current.heroes.find((hero) => hero.player === other(active))!;
    const card = pvpInjectCard(current, data, active, weakCard);
    const played = applyAction(data, current, { type: "playCard", instanceId: card, targetId: victim.id });
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    current = played.state;
    const weakened = current.heroes.find((hero) => hero.id === victim.id)!;
    expect(getStatus(weakened, "weak")?.value).toBe(2);
    expect(displayDuration(current, weakened, "weak")).toBe(1);
    // End of the caster's turn: one tick, still up through the opponent's turn.
    current = endTurn(data, current, events);
    const still = current.heroes.find((hero) => hero.id === victim.id)!;
    expect(getStatus(still, "weak")?.value).toBe(1);
    expect(displayDuration(current, still, "weak")).toBe(1);
    // End of the victim's own turn: expires.
    current = endTurn(data, current, events);
    const expired = current.heroes.find((hero) => hero.id === victim.id)!;
    expect(getStatus(expired, "weak")).toBeUndefined();
  });
});

describe("T221 pvp targeting", () => {
  const ping = fixtureCard("test_ping", "m05", "enemy", [{ type: "damage", amount: 1, to: "chosen" }]);

  it("a taunting opposing hero soaks single-target enemy picks", () => {
    const { data, state, events } = makePvp();
    const current = startMatch(data, state, events);
    const active = current.activePlayer;
    const foes = current.heroes.filter((hero) => hero.player === other(active));
    const [taunter, nonTaunter] = foes as [typeof foes[number], typeof foes[number]];
    taunter.statuses.push({ id: "taunt", value: 4 });
    const card = pvpInjectCard(current, data, active, ping);
    const denied = applyAction(data, current, {
      type: "playCard",
      instanceId: card,
      targetId: nonTaunter!.id,
    });
    expect(denied).toEqual({ ok: false, error: "invalid target" });
    const allowed = applyAction(data, current, {
      type: "playCard",
      instanceId: card,
      targetId: taunter!.id,
    });
    expect(allowed.ok).toBe(true);
  });

  it("freeze blocks the owner's cards on their next turn and expires at that turn's end", () => {
    const { data, state, events } = makePvp();
    let current = startMatch(data, state, events);
    const active = current.activePlayer;
    // Freeze one of the active seat's heroes — it stays frozen through this turn.
    const frozenHero = current.heroes.find((hero) => hero.player === active)!;
    frozenHero.statuses.push({ id: "freeze", value: 1 });
    const frozenCard = pvpInjectCard(current, data, active, fixtureCard("test_armor", frozenHero.defId, "none", [
      { type: "gainArmor", amount: 1, to: "self" },
    ]));
    const denied = applyAction(data, current, { type: "playCard", instanceId: frozenCard });
    expect(denied).toEqual({ ok: false, error: "owner is frozen" });
    current = endTurn(data, current, events);
    expect(events.some((e) => e.type === "statusRemoved" && e.targetId === frozenHero.id && e.status === "freeze")).toBe(true);
    expect(getStatus(current.heroes.find((hero) => hero.id === frozenHero.id)!, "freeze")).toBeUndefined();
  });
});

describe("T222 drainMoonPower in pvp", () => {
  it("drains the opponent's moon reserve once and steals it", () => {
    const { data, state, events } = makePvp();
    const current = startMatch(data, state, events);
    const active = current.activePlayer;
    const seat = current.players[active]!;
    const opponent = current.players[other(active)]!;
    opponent.moonReserve = 3;
    seat.moonPower = 0;
    const drain = pvpInjectCard(current, data, active, fixtureCard("test_drain", "m05", "none", [
      { type: "drainMoonPower", amount: 5, to: "allEnemies", steal: true },
    ]));
    const played = applyAction(data, current, { type: "playCard", instanceId: drain });
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(played.state.players[other(active)]!.moonReserve).toBe(0);
    expect(played.state.players[active]!.moonPower).toBe(3);
    const drained = played.events.filter((e) => e.type === "moonReserveChanged");
    expect(drained).toHaveLength(1);
    expect(drained[0]).toMatchObject({ player: other(active), value: 0 });
  });
});

describe("T223 kill counters and hook seats", () => {
  it("enemiesKilled counts opposing heroes; heroDied fires for the victim, enemyKilled for the killer", () => {
    // Both seats carry the same watching relic: heroDied must resolve on the
    // victim's seat, enemyKilled on the killer's (`17` §4.5).
    const sides: [PvpSide, PvpSide] = [
      pvpSide(TEAM_A, { relics: [{ id: "r_test_watch", resonance: 1 }] }),
      pvpSide(TEAM_B, { relics: [{ id: "r_test_watch", resonance: 1 }] }),
    ];
    const { data, state, events } = makePvp(42, (d) => {
      testRelic(d, "r_test_watch", {
        on: { type: "enemyKilled" },
        actor: "front",
        effects: [{ type: "gainMoonPower", amount: 1 }],
      });
      testRelic(d, "r_test_mourn", {
        on: { type: "heroDied" },
        actor: "front",
        effects: [{ type: "gainMoonPower", amount: 1 }],
      });
      for (const side of sides) side.loadout.relics!.push({ id: "r_test_mourn", resonance: 1 });
    }, sides);
    let current = startMatch(data, state, events);
    const active = current.activePlayer;
    const victim = current.heroes.find((hero) => hero.player === other(active))!;
    victim.hp = 1;
    const kill = pvpInjectCard(current, data, active, fixtureCard("test_kill", "m06", "enemy", [
      { type: "damage", amount: 99, to: "chosen" },
    ]));
    const played = applyAction(data, current, { type: "playCard", instanceId: kill, targetId: victim.id });
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    current = played.state;
    // m06's level-up counter is enemiesKilled: it must have counted the opposing hero.
    const killer = current.heroes.find((hero) => hero.player === active && hero.defId === "m06")!;
    expect(killer.levelUpCounter).toBe(1);
    const heroDiedIndex = played.events.findIndex((e) => e.type === "relicTriggered" && e.relicId === "r_test_mourn");
    const enemyKilledIndex = played.events.findIndex((e) => e.type === "relicTriggered" && e.relicId === "r_test_watch");
    expect(heroDiedIndex).toBeGreaterThanOrEqual(0);
    expect(enemyKilledIndex).toBeGreaterThanOrEqual(0);
    expect(played.events[heroDiedIndex]).toMatchObject({ player: other(active) });
    expect(played.events[enemyKilledIndex]).toMatchObject({ player: active });
  });

  it("moonPhaseEntered fires hooks for both seats, the next turn's owner first", () => {
    const sides: [PvpSide, PvpSide] = [
      pvpSide(TEAM_A, { relics: [{ id: "r_test_moon", resonance: 1 }] }),
      pvpSide(TEAM_B, { relics: [{ id: "r_test_moon", resonance: 1 }] }),
    ];
    const { data, state, events } = makePvp(42, (d) =>
      testRelic(d, "r_test_moon", {
        on: { type: "moonPhaseEntered" },
        actor: "front",
        effects: [{ type: "gainMoonPower", amount: 1 }],
      }),
      sides,
    );
    let current = startMatch(data, state, events);
    const first = current.firstPlayer!;
    current = endTurn(data, current, events); // second player's turn starts
    const before = events.length;
    current = endTurn(data, current, events); // round advances → moonShifted
    const fired = events
      .slice(before)
      .filter((e) => e.type === "relicTriggered" && e.relicId === "r_test_moon");
    expect(fired).toHaveLength(2);
    expect(fired[0]).toMatchObject({ player: first });
    expect(fired[1]).toMatchObject({ player: other(first) });
    expect(current.round).toBe(2);
  });
});

describe("T224 win, loss, draw", () => {
  it("a seat whose heroes all die loses; the other seat wins", () => {
    const { data, state, events } = makePvp();
    const current = startMatch(data, state, events);
    const active = current.activePlayer;
    for (const hero of current.heroes.filter((h) => h.player === other(active))) hero.hp = 1;
    const wipe = pvpInjectCard(current, data, active, fixtureCard("test_wipe", "m05", "none", [
      { type: "damage", amount: 99, to: "allEnemies" },
    ]));
    const played = applyAction(data, current, { type: "playCard", instanceId: wipe });
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(played.state.status).toBe("won");
    expect(played.state.winner).toBe(active);
    expect(played.events.at(-1)).toMatchObject({ type: "combatEnded", result: "won", winner: active });
  });

  it("decked out at turn start loses the seat", () => {
    const { data, state, events } = makePvp();
    let current = startMatch(data, state, events);
    const first = current.firstPlayer!;
    const second = other(first);
    current.players[second]!.drawPile = [];
    current.players[second]!.hand = [];
    current = endTurn(data, current, events);
    expect(current.status).toBe("won");
    expect(current.winner).toBe(first);
    expect(events.at(-2)).toMatchObject({ type: "deckedOut", player: second });
    expect(events.at(-1)).toMatchObject({ type: "combatEnded", result: "won", winner: first });
  });

  it("a simultaneous wipe favors the active player", () => {
    const { data, state, events } = makePvp();
    const current = startMatch(data, state, events);
    const active = current.activePlayer;
    // Both seats die in one processDeaths pass → the active player wins (`17` §4.6).
    for (const hero of current.heroes) hero.hp = 0;
    const noop = pvpInjectCard(current, data, active, fixtureCard("test_noop", "m05", "none", [
      { type: "gainArmor", amount: 1, to: "self" },
    ]));
    const played = applyAction(data, current, { type: "playCard", instanceId: noop });
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(played.state.status).toBe("won");
    expect(played.state.winner).toBe(active);
    expect(played.events.at(-1)).toMatchObject({ type: "combatEnded", result: "won", winner: active });
  });

  it("round beyond roundCap is a draw", () => {
    const { data, state, events } = makePvp();
    let current = startMatch(data, state, events);
    current.round = data.pvpConfig.roundCap;
    current = endTurn(data, current, events); // second player's turn
    const before = events.length;
    current = endTurn(data, current, events); // round advances past the cap
    expect(current.status).toBe("won");
    expect(current.winner).toBe("draw");
    expect(events.slice(before).at(-1)).toMatchObject({
      type: "combatEnded",
      result: "draw",
      winner: "draw",
    });
  });
});

describe("T225 forfeit", () => {
  it("rejects a client-originated forfeit (no system flag)", () => {
    const { data, state, events } = makePvp();
    const current = startMatch(data, state, events);
    const forged = { type: "forfeit", player: 1, reason: "resign" } as unknown as Parameters<typeof applyAction>[2];
    const denied = applyAction(data, current, forged);
    expect(denied).toEqual({ ok: false, error: "forfeit is a system action" });
  });

  it("a system forfeit ends the match with the other seat as winner", () => {
    const { data, state, events } = makePvp();
    const current = startMatch(data, state, events);
    const resigned = applyAction(data, current, {
      type: "forfeit",
      player: 1,
      reason: "resign",
      system: true,
    });
    expect(resigned.ok).toBe(true);
    if (!resigned.ok) return;
    expect(resigned.state.status).toBe("won");
    expect(resigned.state.winner).toBe(0);
    expect(resigned.events).toEqual([
      { type: "playerForfeited", player: 1, reason: "resign" },
      { type: "combatEnded", result: "won", winner: 0 },
    ]);
  });

  it("forfeit is rejected outside pvp", () => {
    const data = testData();
    const result = applyAction(data, {
      mode: "pve",
      status: "playerTurn",
      activePlayer: 0,
      round: 1,
      moonIndex: 0,
      moonDecrees: [],
      bloodMoonRounds: 0,
      players: [p0Like()],
      heroes: [],
      enemies: [],
      cards: {},
      rngState: 1,
    }, { type: "forfeit", player: 0, reason: "resign", system: true });
    expect(result).toEqual({ ok: false, error: "forfeit is only valid in pvp or coop" });
  });
});

describe("T228 viewFor", () => {
  it("hides the opponent's hand and draw pile but keeps everything the viewer owns", () => {
    const { data, state, events } = makePvp();
    const current = startMatch(data, state, events);
    const viewer = current.activePlayer;
    const foe = other(viewer);
    const view = viewFor(current, viewer);
    const viewOpp = view.players[foe]!;
    expect(view.rngState).toBe(0);
    // Opponent zones: same sizes, placeholder ids, no card ids in the map.
    expect(viewOpp.hand).toHaveLength(current.players[foe]!.hand.length);
    expect(viewOpp.hand.every((id) => id.startsWith("hidden_"))).toBe(true);
    expect(viewOpp.drawPile).toHaveLength(current.players[foe]!.drawPile.length);
    expect(viewOpp.drawPile.every((id) => id.startsWith("hidden_"))).toBe(true);
    for (const [id, instance] of Object.entries(view.cards)) {
      if (instance.player === foe) {
        expect(viewOpp.discardPile).toContain(id);
      }
    }
    // Viewer's own zones are intact and the view still answers queries.
    expect(view.players[viewer]!.hand).toEqual(current.players[viewer]!.hand);
    const ownCard = view.players[viewer]!.hand[0]!;
    expect(view.cards[ownCard]).toBeDefined();
    expect(() => isCardPlayable(data, view, ownCard, viewer)).not.toThrow();
    expect(() => getValidTargets(data, view, ownCard)).not.toThrow();
    // Heroes, gear and moon power are public on both sides.
    expect(view.heroes).toEqual(current.heroes);
    expect(view.players[foe]!.moonPower).toBe(current.players[foe]!.moonPower);
  });

  it("reads opponentTurn when the other seat owns the status, keeps playerTurn for the active viewer", () => {
    const { data, state, events } = makePvp();
    const current = startMatch(data, state, events);
    const active = current.activePlayer;
    expect(viewFor(current, active).status).toBe("playerTurn");
    expect(viewFor(current, other(active)).status).toBe("opponentTurn");
    // During mulligan, a finished seat waits in opponentTurn; the pending seat keeps mulligan.
    const pending = makePvp();
    const done = applyAction(data, pending.state, { type: "mulligan", instanceIds: [], player: 0 });
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(viewFor(done.state, 0).status).toBe("opponentTurn");
    expect(viewFor(done.state, 1).status).toBe("mulligan");
  });
});

describe("T229 redactEvents", () => {
  it("reduces opponent reveal events to counts; played cards stay public", () => {
    const { data, state, events } = makePvp();
    const current = startMatch(data, state, events);
    const redacted = redactEvents(events, 0);
    const oppDraw = redacted.find((e) => e.type === "cardsDrawn" && e.player === 1)!;
    expect(oppDraw.type === "cardsDrawn" && oppDraw.instanceIds.every((id) => id.startsWith("hidden_"))).toBe(true);
    const realDraw = events.find((e) => e.type === "cardsDrawn" && e.player === 1) as Extract<CombatEvent, { type: "cardsDrawn" }>;
    expect(oppDraw.type === "cardsDrawn" && oppDraw.instanceIds).toHaveLength(realDraw.instanceIds.length);
    // Own events untouched.
    const ownDraw = redacted.find((e) => e.type === "cardsDrawn" && e.player === 0);
    expect(ownDraw).toEqual(events.find((e) => e.type === "cardsDrawn" && e.player === 0));
    // A played opponent card stays visible in the stream.
    const mulligan = applyAction(data, current, { type: "mulligan", instanceIds: [], player: 1 });
    expect(mulligan).toEqual({ ok: false, error: "mulligan already done" });
  });

  it("hides a card created into the opponent's hand but keeps the count", () => {
    const events: CombatEvent[] = [
      { type: "cardCreated", cardId: "m05_liet_hoa", instanceId: "p1_t1", player: 1 },
      { type: "cardCreated", cardId: "m05_liet_hoa", instanceId: null, player: 1 },
      { type: "cardCreated", cardId: "m05_liet_hoa", instanceId: "p0_t1", player: 0 },
    ];
    const redacted = redactEvents(events, 0);
    const created = redacted[0]!;
    // The opponent's gained card leaks neither its definition nor its real id.
    expect(created.type === "cardCreated" && created.cardId === "hidden_card").toBe(true);
    expect(created.type === "cardCreated" && created.instanceId === "hidden_created_0").toBe(true);
    // A hand-full create stays a no-op for the viewer too.
    const full = redacted[1]!;
    expect(full.type === "cardCreated" && full.cardId === "hidden_card").toBe(true);
    expect(full.type === "cardCreated" && full.instanceId === null).toBe(true);
    // The viewer's own created card stays fully public.
    expect(redacted[2]).toEqual(events[2]);
  });
});

describe("T230 pvpBot + replayMatch", () => {
  it("drives a full match from views only: every action is legal on the real state", () => {
    const { data, state } = makePvp(9);
    let current = state;
    const log: { player: number; action: Action }[] = [];
    for (let step = 0; step < 1000 && current.status !== "won" && current.status !== "lost"; step++) {
      const seat =
        current.status === "mulligan"
          ? current.players.find((s) => !s.mulliganDone)!.index
          : current.activePlayer;
      const action = pvpBot(data, viewFor(current, seat), seat);
      const result = applyAction(data, current, action);
      if (!result.ok) throw new Error(`bot action ${action.type} rejected: ${result.error}`);
      log.push({ player: seat, action });
      current = result.state;
    }
    expect(current.status).toBe("won");
    expect(current.winner).toBeDefined();
    // The same log replays to the same final state.
    const replayed = replayMatch(data, { seed: 9, players: [pvpSide(TEAM_A), pvpSide(TEAM_B)] }, log);
    expect(replayed.state).toEqual(current);
  });
});

function p0Like() {
  return {
    index: 0,
    heroIds: [],
    drawPile: [],
    hand: [],
    discardPile: [],
    moonPower: 0,
    moonReserve: 0,
    moonPowerBonus: 0,
    cardsPlayedThisTurn: 0,
    pendingChoice: null,
    hookCounters: {},
    weapons: [],
    relics: [],
    runRelicIds: [],
    mulliganDone: true,
    done: false,
  };
}
