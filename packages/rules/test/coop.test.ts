import { describe, expect, it } from "vitest";
import type { CardDef, CombatEvent, CombatState, CoopSide, GameData, Loadout } from "../src/index";
import {
  applyAction,
  applyCoopResult,
  comboHintFor,
  coopBot,
  coopRedactEvents,
  coopViewFor,
  createCoopCombat,
  createProfile,
  dayKey,
  getValidTargets,
  replayMatch,
} from "../src/index";
import { idleIntent, strike9Intent } from "./fixtures";
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
    expect(state.playedThisTurn).toEqual([
      { player: 1, instanceId: seatOneCard, cardId: "test_p1_ping", moonAfter: state.moonIndex },
    ]);

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

  it("T251: Băng Nguyệt Kế freezes every enemy and fires once per combat", () => {
    const { data, state: created } = makeCoopCombat({
      side0: coopSide(["m05", "f04", "f02"]),
      side1: coopSide(["f03", "m06", "m05"]),
      setup: (state) => {
        state.players[0]!.moonPower = 20;
        state.players[1]!.moonPower = 20;
      },
    });
    let state = created;
    const boss = () => state.enemies[0]!;
    const schemeId = injectSeatCard(state, data, data.cards["f02_dien_doat"]!, 0);
    const freezeId = injectSeatCard(state, data, data.cards["f03_han_an"]!, 1);

    let result = applyAction(data, state, { type: "playCard", player: 0, instanceId: schemeId, targetId: boss().id });
    if (!result.ok) throw new Error(result.error);
    state = result.state;
    expect(result.events.some((event) => event.type === "coopComboTriggered")).toBe(false);

    // Seat 1's freeze completes the pair — Băng Nguyệt Kế fires.
    result = applyAction(data, state, { type: "playCard", player: 1, instanceId: freezeId, targetId: boss().id });
    if (!result.ok) throw new Error(result.error);
    state = result.state;
    const trigger = result.events.find((event) => event.type === "coopComboTriggered");
    expect(trigger).toMatchObject({ comboId: "combo_bang_nguyet_ke", player: 1 });
    expect(trigger?.type === "coopComboTriggered" ? trigger.cardIds : []).toEqual(
      expect.arrayContaining([freezeId, schemeId]),
    );
    expect(boss().statuses.some((entry) => entry.id === "freeze")).toBe(true);
    expect(state.comboUsed).toEqual({ combo_bang_nguyet_ke: { total: 1, round: 1 } });

    // Round 2 with a fresh pair of matching cards — perCombat: 1 blocks it.
    for (const seat of [0, 1]) {
      const ended = applyAction(data, state, { type: "endTurn", player: seat });
      if (!ended.ok) throw new Error(ended.error);
      state = ended.state;
    }
    expect(state.round).toBe(2);
    const scheme2 = injectSeatCard(state, data, data.cards["f02_vong_nguyet_thu"]!, 0);
    const freeze2 = injectSeatCard(state, data, data.cards["f03_vinh_dong"]!, 1);
    result = applyAction(data, state, { type: "playCard", player: 0, instanceId: scheme2, targetId: boss().id });
    if (!result.ok) throw new Error(result.error);
    state = result.state;
    result = applyAction(data, state, { type: "playCard", player: 1, instanceId: freeze2 });
    if (!result.ok) throw new Error(result.error);
    state = result.state;
    expect(result.events.some((event) => event.type === "coopComboTriggered")).toBe(false);
    expect(state.comboUsed).toEqual({ combo_bang_nguyet_ke: { total: 1, round: 1 } });
  });

  it("comboHintFor flags only a hand card completing the partner's half (`17` §9.3)", () => {
    const { data, state: created } = makeCoopCombat({
      side0: coopSide(["m05", "f04", "f02"]),
      side1: coopSide(["f03", "m06", "m05"]),
      setup: (state) => {
        state.players[0]!.moonPower = 20;
        state.players[1]!.moonPower = 20;
      },
    });
    let state = created;
    const boss = () => state.enemies[0]!;
    const schemeId = injectSeatCard(state, data, data.cards["f02_dien_doat"]!, 0);
    const freezeId = injectSeatCard(state, data, data.cards["f03_han_an"]!, 1);

    // Nothing played yet — no hint on either seat.
    expect(comboHintFor(data, state, 0).size).toBe(0);
    expect(comboHintFor(data, state, 1).size).toBe(0);

    let result = applyAction(data, state, { type: "playCard", player: 0, instanceId: schemeId, targetId: boss().id });
    if (!result.ok) throw new Error(result.error);
    state = result.state;

    // Seat 1's freeze card now completes the scheme half seat 0 played.
    expect(comboHintFor(data, state, 1).get(freezeId)).toBe("combo_bang_nguyet_ke");
    // The acting seat's own journal does not hint to itself.
    expect(comboHintFor(data, state, 0).size).toBe(0);

    result = applyAction(data, state, { type: "playCard", player: 1, instanceId: freezeId, targetId: boss().id });
    if (!result.ok) throw new Error(result.error);
    state = result.state;
    // Consumed combo halves stop hinting (perCombat spent and cards marked).
    expect(comboHintFor(data, state, 0).size).toBe(0);
    expect(comboHintFor(data, state, 1).size).toBe(0);
  });

  it("T252: a combo needs both seats; a consumed card cannot feed another combo", () => {
    const { data, state: created } = makeCoopCombat({
      mutateData: makeEnemiesIdle,
      side0: coopSide(["m05", "f04", "f02"]),
      side1: coopSide(["f02", "m06", "f03"]),
      setup: (state) => {
        state.players[0]!.moonPower = 20;
        state.players[1]!.moonPower = 20;
      },
    });
    let state = created;
    const boss = () => state.enemies[0]!;
    // Seat 1 holds both halves of Ám Ảnh Tuyệt Sát — same player, so nothing fires.
    const loseHpP1 = injectSeatCard(state, data, data.cards["f02_huyet_tram"]!, 1);
    const stealthP1 = injectSeatCard(state, data, data.cards["m06_anh_bo"]!, 1);
    const loseHpP0 = injectSeatCard(state, data, data.cards["f02_huyet_khe"]!, 0);
    const loseHpP0b = injectSeatCard(state, data, data.cards["f02_ta_nguyet_chu"]!, 0);

    let result = applyAction(data, state, { type: "playCard", player: 1, instanceId: loseHpP1, targetId: boss().id });
    if (!result.ok) throw new Error(result.error);
    state = result.state;
    result = applyAction(data, state, { type: "playCard", player: 1, instanceId: stealthP1 });
    if (!result.ok) throw new Error(result.error);
    state = result.state;
    expect(result.events.some((event) => event.type === "coopComboTriggered")).toBe(false);

    // Seat 0's loseHp card completes the partner's stealth → the combo fires.
    result = applyAction(data, state, { type: "playCard", player: 0, instanceId: loseHpP0 });
    if (!result.ok) throw new Error(result.error);
    state = result.state;
    expect(
      result.events.some((event) => event.type === "coopComboTriggered" && event.comboId === "combo_am_anh_tuyet_sat"),
    ).toBe(true);

    // The consumed stealth card cannot pair again — no second trigger.
    const entryOf = (id: string) => state.playedThisTurn!.find((entry) => entry.instanceId === id)!;
    expect(entryOf(stealthP1).comboId).toBe("combo_am_anh_tuyet_sat");
    expect(entryOf(loseHpP0).comboId).toBe("combo_am_anh_tuyet_sat");
    expect(entryOf(loseHpP1).comboId).toBeUndefined();
    result = applyAction(data, state, { type: "playCard", player: 0, instanceId: loseHpP0b });
    if (!result.ok) throw new Error(result.error);
    state = result.state;
    expect(result.events.some((event) => event.type === "coopComboTriggered")).toBe(false);
    expect(entryOf(loseHpP0b).comboId).toBeUndefined();
  });

  it("T253: Ám Ảnh Tuyệt Sát executes enemies at ≤25% HP or burns 8 otherwise", () => {
    const pair = () => {
      const combo = makeCoopCombat({
        mutateData: makeEnemiesIdle,
        side0: coopSide(["m05", "f04", "f02"]),
        side1: coopSide(["f02", "m06", "f03"]),
        setup: (state) => {
          state.players[0]!.moonPower = 20;
          state.players[1]!.moonPower = 20;
        },
      });
      injectSeatCard(combo.state, combo.data, combo.data.cards["m06_anh_bo"]!, 1);
      injectSeatCard(combo.state, combo.data, combo.data.cards["f02_huyet_khe"]!, 0);
      return combo;
    };

    // Boss at 24% — the execute branch kills it outright.
    const { data, state: at24 } = pair();
    let state = at24;
    state.enemies[0]!.hp = 50;
    let result = applyAction(data, state, {
      type: "playCard",
      player: 1,
      instanceId: `test_m06_anh_bo_1`,
    });
    if (!result.ok) throw new Error(result.error);
    state = result.state;
    result = applyAction(data, state, { type: "playCard", player: 0, instanceId: `test_f02_huyet_khe_0` });
    if (!result.ok) throw new Error(result.error);
    state = result.state;
    expect(
      result.events.some((event) => event.type === "coopComboTriggered" && event.comboId === "combo_am_anh_tuyet_sat"),
    ).toBe(true);
    expect(state.enemies[0]!.alive).toBe(false);
    expect(result.events.some((event) => event.type === "unitDied" && event.unitId === state.enemies[0]!.id)).toBe(true);
    expect(state.status).toBe("won");

    // Boss at 96% — nobody qualifies, so the fallback hits every enemy for 8.
    const { data: data2, state: at96 } = pair();
    let state2 = at96;
    state2.enemies[0]!.hp = 200;
    result = applyAction(data2, state2, { type: "playCard", player: 1, instanceId: `test_m06_anh_bo_1` });
    if (!result.ok) throw new Error(result.error);
    state2 = result.state;
    result = applyAction(data2, state2, { type: "playCard", player: 0, instanceId: `test_f02_huyet_khe_0` });
    if (!result.ok) throw new Error(result.error);
    state2 = result.state;
    expect(
      result.events.some((event) => event.type === "coopComboTriggered" && event.comboId === "combo_am_anh_tuyet_sat"),
    ).toBe(true);
    expect(state2.enemies[0]!.alive).toBe(true);
    expect(state2.enemies[0]!.hp).toBe(200 - 8);
  });

  it("T254: Nguyệt Quang Phổ Chiếu heals all six heroes, doubled under full moon", () => {
    const { data, state: created } = makeCoopCombat({
      mutateData: makeEnemiesIdle,
      side0: coopSide(["m05", "f04", "f02"]),
      side1: coopSide(["f02", "m06", "f03"]),
      setup: (state) => {
        for (const hero of state.heroes) hero.hp = hero.maxHp - 20;
      },
    });
    let state = created;
    const shiftFar = injectSeatCard(state, data, freeCard("test_shift_2", "f04", [{ type: "shiftMoon", amount: 2 }]), 0);
    const shiftNear = injectSeatCard(state, data, freeCard("test_shift_1", "f04", [{ type: "shiftMoon", amount: 1 }]), 0);
    const heal = injectSeatCard(state, data, freeCard("test_heal_1", "m06", [{ type: "heal", amount: 1, to: "self" }]), 1);

    // The shift leaves the moon short of full — the heal card cannot complete it.
    let result = applyAction(data, state, { type: "playCard", player: 0, instanceId: shiftFar });
    if (!result.ok) throw new Error(result.error);
    state = result.state;
    result = applyAction(data, state, { type: "playCard", player: 1, instanceId: heal });
    if (!result.ok) throw new Error(result.error);
    state = result.state;
    expect(result.events.some((event) => event.type === "coopComboTriggered")).toBe(false);

    // A second shift lands on Trăng Tròn — the earlier heal card completes it.
    const baseline = state.heroes.map((hero) => hero.hp);
    result = applyAction(data, state, { type: "playCard", player: 0, instanceId: shiftNear });
    if (!result.ok) throw new Error(result.error);
    state = result.state;
    expect(data.moonPhases[state.moonIndex]!.id).toBe("full");
    expect(
      result.events.some(
        (event) => event.type === "coopComboTriggered" && event.comboId === "combo_nguyet_quang_pho_chieu",
      ),
    ).toBe(true);
    // heal 6 × Trăng Tròn 2 = 12 on all six heroes (`01` §16.4 comboScope).
    const healed = result.events.filter((event) => event.type === "healed");
    expect(healed).toHaveLength(6);
    state.heroes.forEach((hero, index) => {
      expect(hero.hp).toBe(Math.min(hero.maxHp, baseline[index]! + 12));
    });
  });

  it("T255: phase 2 grants strength and floors Blood Moon at 1 until it ends", () => {
    const { data, state: created } = makeCoopCombat({
      mutateData: (data) => {
        makeEnemiesIdle(data);
        for (const phase of data.enemies["eclipse_lord"]!.phases!) {
          phase.intents = [{ ...idleIntent, cost: 0 }];
        }
      },
      setup: (state) => {
        state.enemies[0]!.hp = 150;
      },
    });
    let state = created;
    const boss = () => state.enemies[0]!;
    const ping = injectSeatCard(state, data, freeCard("test_ping", "m05", [{ type: "gainArmor", amount: 1, to: "self" }]), 0);

    let result = applyAction(data, state, { type: "playCard", player: 0, instanceId: ping });
    if (!result.ok) throw new Error(result.error);
    state = result.state;
    expect(state.boss).toMatchObject({ phase: 2 });
    expect(result.events.some((event) => event.type === "bossPhaseChanged" && event.phase === 2)).toBe(true);
    expect(boss().statuses.find((entry) => entry.id === "strength")?.value).toBe(2);
    expect(state.bloodMoonRounds).toBe(1);

    // Blood Moon cannot drop below 1 while phase 2 is active.
    for (let round = 0; round < 2; round++) {
      for (const seat of [0, 1]) {
        const ended = applyAction(data, state, { type: "endTurn", player: seat });
        if (!ended.ok) throw new Error(ended.error);
        state = ended.state;
      }
      expect(state.bloodMoonRounds).toBe(1);
    }

    // Leaving phase 2 lets Blood Moon decay normally.
    boss().hp = 100;
    const ping2 = injectSeatCard(state, data, freeCard("test_ping_2", "f04", [{ type: "gainArmor", amount: 1, to: "self" }]), 0);
    result = applyAction(data, state, { type: "playCard", player: 0, instanceId: ping2 });
    if (!result.ok) throw new Error(result.error);
    state = result.state;
    expect(state.boss).toMatchObject({ phase: 3 });
    for (const seat of [0, 1]) {
      result = applyAction(data, state, { type: "endTurn", player: seat });
      if (!result.ok) throw new Error(result.error);
      state = result.state;
    }
    expect(state.bloodMoonRounds).toBe(0);
    expect(result.events.some((event) => event.type === "bloodMoonChanged" && event.rounds === 0)).toBe(true);
  });

  it("T256: one hit crossing two thresholds enters each phase in order; planned intents stay", () => {
    const { data, state: created } = makeCoopCombat({
      setup: (state) => {
        state.enemies[0]!.hp = 160;
        setPlan(state, 0, [{ intent: idleIntent, targetId: null }]);
      },
    });
    let state = created;
    const boss = () => state.enemies[0]!;
    const hit = injectSeatCard(
      state,
      data,
      freeCard("test_hit_60", "m05", [{ type: "damage", amount: 60, to: "chosen" }], "enemy"),
      0,
    );

    const result = applyAction(data, state, { type: "playCard", player: 0, instanceId: hit, targetId: boss().id });
    if (!result.ok) throw new Error(result.error);
    state = result.state;
    expect(boss().hp).toBe(100);
    const phases = result.events.filter((event) => event.type === "bossPhaseChanged").map((event) => event.phase);
    expect(phases).toEqual([2, 3]);
    // Phase 2's onEnter ran before phase 3 began.
    expect(boss().statuses.find((entry) => entry.id === "strength")?.value).toBe(2);
    // The chain planned at creation stays untouched until the next planning step.
    expect(boss().plannedIntents.map((planned) => planned.intent.id)).toEqual(["idle"]);

    for (const seat of [0, 1]) {
      const ended = applyAction(data, state, { type: "endTurn", player: seat });
      if (!ended.ok) throw new Error(ended.error);
      state = ended.state;
    }
    // Round-2 planning already draws from the phase-3 pool (the idle stand-in is gone).
    expect(boss().plannedIntents.map((planned) => planned.intent.id)).not.toEqual(["idle"]);
    // alwaysPlan leads the chain only once the fund covers cost 6 (round 3: 4+2+reserve).
    for (const seat of [0, 1]) {
      const ended = applyAction(data, state, { type: "endTurn", player: seat });
      if (!ended.ok) throw new Error(ended.error);
      state = ended.state;
    }
    const chain = boss().plannedIntents.map((planned) => planned.intent.id);
    expect(chain[0]).toBe("ecl_thuc_nguyet_tram");
    expect(chain.length).toBeGreaterThan(0);
  });

  it("T257: phase 4 revives once after two rounds; later threshold hits skip the countdown", () => {
    const reviveSetup = () =>
      makeCoopCombat({
        mutateData: (data) => {
          makeEnemiesIdle(data);
          for (const phase of data.enemies["eclipse_lord"]!.phases!) {
            phase.intents = [{ ...idleIntent, cost: 0 }];
          }
        },
        setup: (state) => {
          state.enemies[0]!.hp = 55;
          state.enemies[0]!.statuses.push({ id: "weak", value: 99 });
        },
      });
    const endBothTurns = (data: GameData, state: CombatState) => {
      for (const seat of [0, 1]) {
        const ended = applyAction(data, state, { type: "endTurn", player: seat });
        if (!ended.ok) throw new Error(ended.error);
        state = ended.state;
      }
      return state;
    };

    const { data, state: created } = reviveSetup();
    let state = created;
    const boss = () => state.enemies[0]!;
    const hit = injectSeatCard(
      state,
      data,
      freeCard("test_hit_10", "m05", [{ type: "damage", amount: 10, to: "chosen" }], "enemy"),
      0,
    );
    let result = applyAction(data, state, { type: "playCard", player: 0, instanceId: hit, targetId: boss().id });
    if (!result.ok) throw new Error(result.error);
    state = result.state;
    expect(state.boss).toMatchObject({ phase: 4, reviveCountdown: 2, revived: false });

    state = endBothTurns(data, state);
    expect(state.boss).toMatchObject({ phase: 4, reviveCountdown: 1 });

    state = endBothTurns(data, state);
    expect(state.boss).toMatchObject({ phase: 3, reviveCountdown: null, revived: true });
    expect(boss().hp).toBe(Math.ceil(210 * 0.5));
    expect(boss().statuses.some((entry) => entry.id === "weak")).toBe(false);

    // Crossing the same threshold again does not restart the countdown.
    const hit2 = injectSeatCard(
      state,
      data,
      freeCard("test_hit_60b", "f04", [{ type: "damage", amount: 60, to: "chosen" }], "enemy"),
      0,
    );
    result = applyAction(data, state, { type: "playCard", player: 0, instanceId: hit2, targetId: boss().id });
    if (!result.ok) throw new Error(result.error);
    state = result.state;
    expect(state.boss).toMatchObject({ phase: 4, reviveCountdown: null, revived: true });

    // A boss killed while the countdown ticks stays dead — plain victory.
    const second = reviveSetup();
    let state2 = second.state;
    const hitA = injectSeatCard(
      state2,
      second.data,
      freeCard("test_hit_10b", "m05", [{ type: "damage", amount: 10, to: "chosen" }], "enemy"),
      0,
    );
    result = applyAction(second.data, state2, { type: "playCard", player: 0, instanceId: hitA, targetId: "enemy:0" });
    if (!result.ok) throw new Error(result.error);
    state2 = endBothTurns(second.data, result.state);
    expect(state2.boss).toMatchObject({ phase: 4, reviveCountdown: 1 });
    const kill = injectSeatCard(
      state2,
      second.data,
      freeCard("test_hit_99", "f02", [{ type: "damage", amount: 50, to: "chosen" }], "enemy"),
      1,
    );
    result = applyAction(second.data, state2, { type: "playCard", player: 1, instanceId: kill, targetId: "enemy:0" });
    if (!result.ok) throw new Error(result.error);
    expect(result.state.status).toBe("won");
    expect(result.state.boss).toMatchObject({ reviveCountdown: 1 });
  });

  it("coopBot plays valid actions for both seats through several rounds", () => {
    const { data, state: created } = makeCoopCombat({
      mutateData: (data) => {
        makeEnemiesIdle(data);
        for (const phase of data.enemies["eclipse_lord"]!.phases!) {
          phase.intents = [{ ...idleIntent, cost: 0 }];
        }
      },
    });
    let state = created;
    for (let step = 0; step < 400 && state.status !== "won" && state.status !== "lost"; step++) {
      const seat =
        state.status === "mulligan"
          ? state.players.find((entry) => !entry.mulliganDone)!.index
          : (state.players.find((entry) => !entry.done) ?? state.players[0]!).index;
      const action = coopBot(data, state, seat);
      const result = applyAction(data, state, action);
      if (!result.ok) throw new Error(`coopBot action ${action.type} rejected: ${result.error}`);
      state = result.state;
    }
    expect(state.round).toBeGreaterThanOrEqual(3);
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

/** Sunday 2026-09-27 12:00 UTC — same anchor as the honor tests. */
const NOW = Date.UTC(2026, 8, 27, 12);
const NEXT_DAY = NOW + 26 * 60 * 60 * 1000;

describe("co-op rewards (`17` §9.2)", () => {
  const settle = (profile: Parameters<typeof applyCoopResult>[1], opts: Parameters<typeof applyCoopResult>[2]) =>
    applyCoopResult(testData(), profile, opts);

  it("T260 (rules): win pays 40/3 plus the first-win bonus once; loss pays 10/1; cap is 3 rewarded matches per game day", () => {
    const data = testData();
    const day = dayKey(data, NOW);

    let profile = createProfile(data);
    const first = settle(profile, { result: "won", forfeited: false, now: NOW });
    expect(first.rewards).toEqual({ moonJade: 60, moonDust: 3, firstWin: true });
    expect(first.profile.currencies).toMatchObject({ moonJade: 60, moonDust: 3 });
    expect(first.profile.coop).toEqual({ dayKey: day, clears: 1, rewarded: 1 });

    profile = first.profile;
    const second = settle(profile, { result: "won", forfeited: false, now: NOW });
    expect(second.rewards).toEqual({ moonJade: 40, moonDust: 3, firstWin: false });

    profile = second.profile;
    const loss = settle(profile, { result: "lost", forfeited: false, now: NOW });
    expect(loss.rewards).toEqual({ moonJade: 10, moonDust: 1, firstWin: false });
    expect(loss.profile.coop).toMatchObject({ clears: 2, rewarded: 3 });

    // Fourth match: still counted, but the daily reward pool is exhausted.
    const capped = settle(loss.profile, { result: "won", forfeited: false, now: NOW });
    expect(capped.rewards).toBeNull();
    expect(capped.profile.coop).toMatchObject({ clears: 3, rewarded: 3 });
    expect(capped.profile.currencies.moonJade).toBe(60 + 40 + 10);

    // A new game day resets both counters and the first-win bonus returns.
    const tomorrow = settle(capped.profile, { result: "won", forfeited: false, now: NEXT_DAY });
    expect(tomorrow.rewards).toEqual({ moonJade: 60, moonDust: 3, firstWin: true });
  });

  it("T261 (rules): a forfeited seat gets nothing and keeps its claims; the surviving partner is paid normally", () => {
    const data = testData();
    const quitter = createProfile(data);
    const left = settle(quitter, { result: "lost", forfeited: true, now: NOW });
    expect(left.rewards).toBeNull();
    expect(left.profile.coop).toEqual({ dayKey: dayKey(data, NOW), clears: 0, rewarded: 0 });
    expect(left.profile.currencies.moonJade).toBe(0);

    const survivor = settle(createProfile(data), { result: "won", forfeited: false, now: NOW });
    expect(survivor.rewards).toEqual({ moonJade: 60, moonDust: 3, firstWin: true });
    expect(survivor.profile.coop.clears).toBe(1);
  });

  it("leaves the input profile untouched", () => {
    const profile = createProfile(testData());
    const snapshot = JSON.stringify(profile);
    settle(profile, { result: "won", forfeited: false, now: NOW });
    expect(JSON.stringify(profile)).toBe(snapshot);
  });
});

describe("co-op view (`17` §9.1)", () => {
  it("T262 (rules): partner hand stays visible while both draw piles, the partner's choice and rngState are hidden", () => {
    const { data, state } = makeCoopCombat();
    state.players[1]!.pendingChoice = {
      kind: "chooseCard",
      options: state.players[1]!.drawPile.slice(0, 3),
    };

    const view = coopViewFor(state, 0);
    // rngState never leaks.
    expect(view.rngState).toBe(0);
    expect(state.rngState).not.toBe(0);
    // The partner's hand is fully visible — every instance id resolves.
    expect(view.players[1]!.hand).toEqual(state.players[1]!.hand);
    for (const id of view.players[1]!.hand) {
      expect(view.cards[id]).toBeDefined();
      expect(view.cards[id]!.cardId).toBe(state.cards[id]!.cardId);
    }
    // Both draw piles are count-only placeholders — including the viewer's own.
    for (const seat of view.players) {
      expect(seat.drawPile).toHaveLength(state.players[seat.index]!.drawPile.length);
      expect(seat.drawPile.every((id) => id.startsWith("hidden_deck_"))).toBe(true);
    }
    // The partner's in-flight choice is dropped; the viewer's would survive.
    expect(view.players[1]!.pendingChoice).toBeNull();
    // The shared turn stays playerTurn for both seats — no opponentTurn remap.
    expect(view.status).toBe("playerTurn");
    // The real state is untouched.
    expect(state.players[1]!.pendingChoice).not.toBeNull();
  });

  it("T262 (rules): coopRedactEvents keeps partner card identity but strips pile-order leaks", () => {
    const events: CombatEvent[] = [
      { type: "cardsDrawn", instanceIds: ["i1", "i2"], player: 1 },
      { type: "mulliganed", returned: ["r1"], drawn: ["d1"], player: 1 },
      { type: "cardPlayed", instanceId: "p1", cost: 1, player: 1 },
      { type: "choiceOpened", options: ["o1", "o2", "o3"], player: 1 },
      { type: "cardChosen", instanceId: "c1", bottomed: ["b1", "b2"], player: 1 },
    ];
    const redacted = coopRedactEvents(events, 0);
    // Partner hand events pass through — the hand is public to allies.
    expect(redacted[0]).toEqual(events[0]);
    expect(redacted[1]).toEqual(events[1]);
    expect(redacted[2]).toEqual(events[2]);
    // Chiêm Bài options and bottomed cards hide draw-pile order.
    expect(redacted[3]).toEqual({
      type: "choiceOpened",
      options: ["hidden_option_0", "hidden_option_1", "hidden_option_2"],
      player: 1,
    });
    expect(redacted[4]).toEqual({
      type: "cardChosen",
      instanceId: "c1",
      bottomed: ["hidden_bottomed_0", "hidden_bottomed_1"],
      player: 1,
    });
  });

  it("T260 (rules): replayMatch mode coop reproduces a match bit-for-bit", () => {
    const players: [CoopSide, CoopSide] = [coopSide(["m05", "f04", "m06"]), coopSide(["f02", "f03", "m05"])];
    const data = testData();
    const created = createCoopCombat(data, { seed: 7, players, encounterId: "enc_coop_01" });
    let state = created.state;
    const log: { player: number; action: Parameters<typeof applyAction>[2] }[] = [];
    for (let step = 0; step < 60 && state.status !== "won" && state.status !== "lost"; step++) {
      const seat =
        state.status === "mulligan"
          ? state.players.find((entry) => !entry.mulliganDone)!.index
          : (state.players.find((entry) => !entry.done) ?? state.players[0]!).index;
      const action = coopBot(data, state, seat);
      const result = applyAction(data, state, action);
      if (!result.ok) throw new Error(`action ${action.type} rejected: ${result.error}`);
      log.push({ player: seat, action });
      state = result.state;
    }

    const replayed = replayMatch(data, { seed: 7, players, mode: "coop", encounterId: "enc_coop_01" }, log);
    expect(replayed.state).toEqual(state);
    expect(replayed.state.status).toBe(state.status);
  });
});
