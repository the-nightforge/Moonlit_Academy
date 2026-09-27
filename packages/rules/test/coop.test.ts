import { describe, expect, it } from "vitest";
import type { CardDef, CombatEvent, CombatState, CoopSide, GameData, Loadout } from "../src/index";
import { applyAction, createCoopCombat, getValidTargets } from "../src/index";
import { strike9Intent } from "./fixtures";
import { makeEnemiesIdle, setPlan, testData } from "./helpers";

const baseLoadout = (): Loadout => ({ heroes: {} });

const coopSide = (heroIds: [string, string, string], loadout: Loadout = baseLoadout()): CoopSide => ({
  heroIds,
  loadout,
});

function makeCoopCombat(
  overrides: {
    seed?: number;
    side0?: CoopSide;
    side1?: CoopSide;
    encounterId?: string;
    mutateData?: (data: GameData) => void;
    mulligan?: "pending";
    setup?: (state: CombatState) => void;
  } = {},
): { data: GameData; state: CombatState; events: CombatEvent[] } {
  const data = testData();
  overrides.mutateData?.(data);
  const created = createCoopCombat(data, {
    seed: overrides.seed ?? 42,
    players: [
      overrides.side0 ?? coopSide(["m05", "f04", "m06"]),
      // Duplicate definitions across seats are legal (`01` §16.1).
      overrides.side1 ?? coopSide(["f02", "f03", "m05"]),
    ],
    encounterId: overrides.encounterId ?? "enc_coop_01",
  });
  let { state } = created;
  const events = [...created.events];
  if (overrides.mulligan !== "pending") {
    for (const seat of [0, 1]) {
      const result = applyAction(data, state, { type: "mulligan", player: seat, instanceIds: [] });
      if (!result.ok) throw new Error(`test: mulligan seat ${seat} failed: ${result.error}`);
      state = result.state;
      events.push(...result.events);
    }
  }
  overrides.setup?.(state);
  return { data, state, events };
}

/** Put a fixture card into a specific seat's hand. */
function injectSeatCard(state: CombatState, data: GameData, card: CardDef, seat: number): string {
  data.cards[card.id] = card;
  const instanceId = `test_${card.id}_${seat}`;
  const ownerIds = card.bond ? [...card.bond.owners] : [card.ownerId!];
  state.cards[instanceId] = { instanceId, cardId: card.id, ownerIds, player: seat, heldTurns: 0 };
  state.players[seat]!.hand.push(instanceId);
  return instanceId;
}

const freeCard = (id: string, ownerId: string, effects: CardDef["effects"], target: CardDef["target"] = "none"): CardDef =>
  ({ id, name: id, ownerId, cost: 0, copies: 1, type: "skill", tags: [], target, effects, text: "" });

describe("co-op combat", () => {
  it("T246: createCoopCombat builds six prefixed heroes, private piles and a planned boss", () => {
    const { data, state, events } = makeCoopCombat({ mulligan: "pending" });
    expect(state.mode).toBe("coop");
    expect(state.status).toBe("mulligan");
    expect(state.players).toHaveLength(2);
    expect(state.players.map((seat) => seat.index)).toEqual([0, 1]);
    expect(state.players.every((seat) => !seat.done && !seat.mulliganDone)).toBe(true);

    expect(state.heroes).toHaveLength(6);
    expect(state.heroes.map((hero) => hero.position)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(state.heroes.map((hero) => hero.player)).toEqual([0, 0, 0, 1, 1, 1]);
    expect(state.heroes.map((hero) => hero.id)).toEqual([
      "p0_hero:m05",
      "p0_hero:f04",
      "p0_hero:m06",
      "p1_hero:f02",
      "p1_hero:f03",
      "p1_hero:m05",
    ]);
    expect(state.players[0]!.heroIds).toEqual(state.heroes.slice(0, 3).map((hero) => hero.id));
    expect(state.players[1]!.heroIds).toEqual(state.heroes.slice(3).map((hero) => hero.id));

    // Private piles, hands and resources per seat; prefixed instance ids.
    for (const seat of [0, 1]) {
      const player = state.players[seat]!;
      expect(player.hand).toHaveLength(data.combatConfig.handSize);
      expect(player.drawPile.length).toBeGreaterThan(0);
      expect(player.moonPower).toBe(0);
      for (const id of [...player.hand, ...player.drawPile]) {
        expect(id.startsWith(`p${seat}_`)).toBe(true);
        expect(state.cards[id]!.player).toBe(seat);
      }
    }
    const overlap = state.players[0]!.hand.filter((id) => state.players[1]!.hand.includes(id));
    expect(overlap).toEqual([]);

    // Shared boss from the co-op encounter, already holding its intent chain.
    expect(state.enemies).toHaveLength(1);
    expect(state.enemies[0]!.defId).toBe("eclipse_lord");
    expect(state.enemies[0]!.hp).toBe(210);
    expect(state.enemies[0]!.plannedIntents.length).toBeGreaterThan(0);
    expect(state.boss).toEqual({ enemyId: "enemy:0", phase: 1, reviveCountdown: null, revived: false });
    expect(state.comboUsed).toEqual({});
    expect(state.playedThisTurn).toEqual([]);
    expect(events.some((event) => event.type === "deckShuffled" && event.player === 1)).toBe(true);
  });

  it("T247: both seats act in any order; the enemy turn waits for both to be done", () => {
    const { data, state: created } = makeCoopCombat({ mutateData: makeEnemiesIdle });
    let state = created;
    expect(state.status).toBe("playerTurn");
    expect(state.players.every((seat) => !seat.done)).toBe(true);

    const seatOneCard = injectSeatCard(state, data, freeCard("test_p1_ping", "f02", [{ type: "gainArmor", amount: 2, to: "self" }]), 1);
    const seatZeroCard = injectSeatCard(state, data, freeCard("test_p0_ping", "m05", [{ type: "gainArmor", amount: 2, to: "self" }]), 0);

    // Seat 1 opens, seat 0 answers — actions resolve in receipt order.
    let result = applyAction(data, state, { type: "playCard", player: 1, instanceId: seatOneCard });
    if (!result.ok) throw new Error(result.error);
    state = result.state;
    expect(state.playedThisTurn).toEqual([{ player: 1, instanceId: seatOneCard, cardId: "test_p1_ping" }]);

    result = applyAction(data, state, { type: "playCard", player: 0, instanceId: seatZeroCard });
    if (!result.ok) throw new Error(result.error);
    state = result.state;

    // First endTurn only marks the seat done — no enemy turn yet.
    result = applyAction(data, state, { type: "endTurn", player: 0 });
    if (!result.ok) throw new Error(result.error);
    state = result.state;
    expect(state.players[0]!.done).toBe(true);
    expect(state.players[1]!.done).toBe(false);
    expect(state.status).toBe("playerTurn");
    expect(result.events.some((event) => event.type === "turnStarted" && event.side === "enemy")).toBe(false);

    // The done seat is out; the partner keeps playing.
    const donePlay = applyAction(data, state, { type: "playCard", player: 0, instanceId: seatZeroCard });
    expect(donePlay).toEqual({ ok: false, error: "already done" });

    result = applyAction(data, state, { type: "endTurn", player: 1 });
    if (!result.ok) throw new Error(result.error);
    state = result.state;
    // Seat 0 cleanup precedes seat 1's in the emitted events.
    const reserves = result.events.filter((event) => event.type === "moonReserveChanged");
    expect(reserves.map((event) => (event.type === "moonReserveChanged" ? event.player : undefined))).toEqual([0, 1]);
    expect(result.events.some((event) => event.type === "turnStarted" && event.side === "enemy")).toBe(true);
    // Round 2 opens another shared turn for both seats.
    expect(state.round).toBe(2);
    expect(state.status).toBe("playerTurn");
    expect(state.players.every((seat) => !seat.done)).toBe(true);
    expect(state.playedThisTurn).toEqual([]);
  });

  it("T248: ally targets reach all six heroes; allAllies still means the actor's three", () => {
    const { data, state: created } = makeCoopCombat({
      mutateData: makeEnemiesIdle,
      setup: (state) => {
        for (const hero of state.heroes) hero.hp = hero.maxHp - 10;
      },
    });
    let state = created;
    const healCard = freeCard("test_heal_ally", "f04", [{ type: "heal", amount: 5, to: "chosen" }], "ally");
    const healId = injectSeatCard(state, data, healCard, 0);

    // Any living hero of the six is a legal ally target.
    const targets = getValidTargets(data, state, healId);
    expect(targets.sort()).toEqual(state.heroes.map((hero) => hero.id).sort());

    // Healing the partner's hero works across the seat boundary.
    const partnerHero = state.heroes[4]!;
    let result = applyAction(data, state, { type: "playCard", player: 0, instanceId: healId, targetId: partnerHero.id });
    if (!result.ok) throw new Error(result.error);
    state = result.state;
    expect(state.heroes[4]!.hp).toBe(partnerHero.maxHp - 5);

    // allAllies keeps meaning the acting seat's own three heroes (`01` §16.3).
    const healAll = freeCard("test_heal_all", "f04", [{ type: "heal", amount: 5, to: "allAllies" }]);
    const healAllId = injectSeatCard(state, data, healAll, 0);
    result = applyAction(data, state, { type: "playCard", player: 0, instanceId: healAllId });
    if (!result.ok) throw new Error(result.error);
    state = result.state;
    for (const hero of state.heroes.slice(0, 3)) {
      expect(hero.hp).toBe(hero.maxHp - 5);
    }
    for (const hero of state.heroes.slice(3)) {
      expect(hero.hp).toBe(hero.defId === partnerHero.defId ? partnerHero.maxHp - 5 : hero.maxHp - 10);
    }
  });

  it("T249: one seat's Đổi Vận shifts the shared moon; partner moon hooks fire", () => {
    const { data, state: created } = makeCoopCombat({
      mutateData: makeEnemiesIdle,
      side1: coopSide(["f02", "f03", "m05"], { heroes: {}, relics: [{ id: "r_vong_nguyet_kinh", resonance: 1 }] }),
    });
    let state = created;
    const before = state.moonIndex;
    const shiftCard = freeCard("test_shift", "m05", [{ type: "shiftMoon", amount: 2 }], "none");
    const shiftId = injectSeatCard(state, data, shiftCard, 0);

    const result = applyAction(data, state, { type: "playCard", player: 0, instanceId: shiftId });
    if (!result.ok) throw new Error(result.error);
    state = result.state;
    // One shared moon index — the partner's next cards see the same phase.
    expect(state.moonIndex).toBe((before + 2) % data.moonPhases.length);
    // Vọng Nguyệt Kính on seat 1 fired on the shared moon shift.
    for (const hero of state.heroes.slice(3)) {
      expect(hero.armor).toBe(2);
    }
    for (const hero of state.heroes.slice(0, 3)) {
      expect(hero.armor).toBe(0);
    }
  });

  it("T250: enemy intents aim across all six heroes and taunt redirects cross-seat", () => {
    const { data, state: created } = makeCoopCombat({
      setup: (state) => {
        // The boss plans a fixed strike at a seat-0 hero; a seat-1 taunt soaks it.
        setPlan(state, 0, [{ intent: strike9Intent, targetId: "p0_hero:m05" }]);
        state.heroes[5]!.statuses.push({ id: "taunt", value: 1 });
      },
    });
    let state = created;
    for (const seat of [0, 1]) {
      const result = applyAction(data, state, { type: "endTurn", player: seat });
      if (!result.ok) throw new Error(result.error);
      state = result.state;
    }
    const taunter = state.heroes[5]!;
    const planned = state.heroes[0]!;
    // The taunting partner hero took the hit aimed at seat 0's hero.
    expect(taunter.hp).toBe(taunter.maxHp - 9);
    expect(planned.hp).toBe(planned.maxHp);
  });

  it("T258: deck-out kills only that seat's heroes; forfeit does the same", () => {
    const { data, state: created } = makeCoopCombat({
      mutateData: makeEnemiesIdle,
      setup: (state) => {
        // Empty both of seat 0's piles so the next shared turn decks it out.
        state.players[0]!.discardPile.push(...state.players[0]!.hand, ...state.players[0]!.drawPile);
        state.players[0]!.hand = [];
        state.players[0]!.drawPile = [];
      },
    });
    let state = created;
    for (const seat of [0, 1]) {
      const result = applyAction(data, state, { type: "endTurn", player: seat });
      if (!result.ok) throw new Error(result.error);
      state = result.state;
    }
    // Round 2: seat 0 draws nothing → its three heroes fall, the match goes on.
    expect(state.status).toBe("playerTurn");
    expect(state.round).toBe(2);
    expect(state.heroes.slice(0, 3).every((hero) => !hero.alive)).toBe(true);
    expect(state.heroes.slice(3).every((hero) => hero.alive)).toBe(true);

    const decked = applyAction(data, state, { type: "forfeit", player: 1, reason: "resign", system: true });
    if (!decked.ok) throw new Error(decked.error);
    expect(decked.state.heroes.slice(3).every((hero) => !hero.alive)).toBe(true);
    expect(decked.state.status).toBe("lost");
    expect(decked.events.some((event) => event.type === "playerForfeited" && event.player === 1)).toBe(true);
  });

  it("T259: a server-forced endTurn auto-picks the first Chiêm Bài option", () => {
    const { data, state: created } = makeCoopCombat({ mutateData: makeEnemiesIdle });
    let state = created;
    const choose = freeCard("test_choose", "f04", [{ type: "chooseCard", look: 3 }]);
    const chooseId = injectSeatCard(state, data, choose, 0);

    let result = applyAction(data, state, { type: "playCard", player: 0, instanceId: chooseId });
    if (!result.ok) throw new Error(result.error);
    state = result.state;
    // The shared turn stays open — only the seat's own actions pause.
    expect(state.status).toBe("playerTurn");
    expect(state.players[0]!.pendingChoice).not.toBeNull();
    const options = state.players[0]!.pendingChoice!.options;

    const timedOut = applyAction(data, state, { type: "endTurn", player: 0, system: true });
    if (!timedOut.ok) throw new Error(timedOut.error);
    const chosen = timedOut.events.find((event) => event.type === "cardChosen");
    expect(chosen).toMatchObject({ instanceId: options[0], player: 0 });
    expect(timedOut.state.players[0]!.pendingChoice).toBeNull();
    expect(timedOut.state.players[0]!.done).toBe(true);
    expect(timedOut.state.status).toBe("playerTurn");
  });

  it("co-op requires a coop-tier encounter and known heroes", () => {
    const data = testData();
    expect(() =>
      createCoopCombat(data, {
        seed: 1,
        players: [coopSide(["m05", "f04", "m06"]), coopSide(["f02", "f03", "m05"])],
        encounterId: "enc_01",
      }),
    ).toThrow(/not a co-op encounter/);
    expect(() =>
      createCoopCombat(data, {
        seed: 1,
        players: [coopSide(["m05", "f04", "ghost"]), coopSide(["f02", "f03", "m05"])],
        encounterId: "enc_coop_01",
      }),
    ).toThrow(/unknown hero/);
  });
});
