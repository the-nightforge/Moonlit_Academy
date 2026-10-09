import { describe, expect, it } from "vitest";
import { applyAction, bondCardsForTeam, createProfile, type CardDef, validateDeck } from "../src/index";
import { healFiveCard, testCard } from "./fixtures";
import {
  endTestTurn,
  idleEnemies,
  injectCard,
  instanceIdOf,
  makeEnemiesIdle,
  makeTestCombat,
  ownAllHeroes,
  p0,
  setHand,
  testData,
  withLevelUp,
} from "./helpers";

const tokenCard: CardDef = {
  id: "test_token_ult", name: "Tối Thượng", ownerId: "f04", cost: 0, copies: 1, type: "attack",
  tags: ["attack"], target: "enemy", effects: [{ type: "damage", amount: 9, to: "chosen" }], text: "", token: true,
};

const idle = { mutateData: makeEnemiesIdle, setup: idleEnemies };

describe("hand and draw pile", () => {
  it("T131: the hand is kept between turns and refilled up to 6", () => {
    const { data, state } = makeTestCombat(idle);
    const hand = [...p0(state).hand];
    expect(hand).toHaveLength(6);
    const kept = endTestTurn(data, state);
    expect(p0(kept.state).hand).toEqual(hand);
    expect(kept.events.some((e) => e.type === "cardsDrawn")).toBe(false);

    p0(kept.state).hand = p0(kept.state).hand.slice(0, 4);
    p0(kept.state).drawPile = p0(kept.state).drawPile.slice(0, 1);
    const refilled = endTestTurn(data, kept.state);
    expect(p0(refilled.state).hand).toHaveLength(5);
    expect(p0(refilled.state).drawPile).toHaveLength(0);
  });

  it("T132: end of turn discards only Tàn Chiêu cards", () => {
    const { data, state } = makeTestCombat({
      heroIds: ["m05", "f04", "f02"],
      mutateData: makeEnemiesIdle,
      setup: (s) => {
        idleEnemies(s);
        setHand(s, ["m05_ho_gam", "f02_phe_hon"]);
        s.heroes[0]!.alive = false;
        s.heroes[0]!.hp = 0;
        s.heroes[1]!.statuses.push({ id: "freeze", value: 1 });
      },
    });
    const thaoDuoc = injectCard(state, data, healFiveCard);
    const hoGam = instanceIdOf(state, "m05_ho_gam");
    const pheHon = instanceIdOf(state, "f02_phe_hon");
    const result = endTestTurn(data, state);
    expect(result.events).toContainEqual({ type: "cardDiscarded", instanceIds: [hoGam] });
    expect(p0(result.state).discardPile).toContain(hoGam);
    expect(p0(result.state).hand).toContain(thaoDuoc);
    expect(p0(result.state).hand).toContain(pheHon);
    expect(p0(result.state).hand).not.toContain(hoGam);
  });

  it("T133: the draw pile holds `copies` instances of every deck and bond card", () => {
    const heroIds: [string, string, string] = ["m05", "f03", "f04"];
    const { data, state } = makeTestCombat({ heroIds });
    const deck = [
      ...heroIds.flatMap((id) => data.heroes[id]!.cardIds),
      ...bondCardsForTeam(data, heroIds).map((card) => card.id),
    ];
    const counts = new Map<string, number>();
    for (const instance of Object.values(state.cards)) {
      counts.set(instance.cardId, (counts.get(instance.cardId) ?? 0) + 1);
    }
    expect([...counts.keys()].sort()).toEqual([...deck].sort());
    for (const cardId of deck) expect(counts.get(cardId)).toBe(data.cards[cardId]!.copies);
    const ids = [...p0(state).hand, ...p0(state).drawPile];
    expect(new Set(ids).size).toBe(Object.keys(state.cards).length);
  });

  it("T134: the discard pile is never shuffled back", () => {
    const { data, state } = makeTestCombat(idle);
    p0(state).discardPile.push(...p0(state).drawPile.splice(0, p0(state).drawPile.length - 1));
    p0(state).hand = p0(state).hand.slice(0, 3);
    const result = endTestTurn(data, state);
    expect(p0(result.state).drawPile).toHaveLength(0);
    expect(p0(result.state).hand).toHaveLength(4);
    expect(result.events.some((e) => e.type === "deckShuffled")).toBe(false);
  });

  it("T135: empty draw pile and empty hand at turn start loses (Cạn Bài)", () => {
    const { data, state } = makeTestCombat(idle);
    p0(state).discardPile.push(...p0(state).drawPile, ...p0(state).hand);
    p0(state).drawPile = [];
    p0(state).hand = [];
    const result = endTestTurn(data, state);
    expect(result.state.status).toBe("lost");
    const types = result.events.map((e) => e.type);
    expect(types.slice(-2)).toEqual(["deckedOut", "combatEnded"]);

    const other = makeTestCombat(idle).state;
    p0(other).discardPile.push(...p0(other).drawPile, ...p0(other).hand.slice(1));
    p0(other).drawPile = [];
    p0(other).hand = p0(other).hand.slice(0, 1);
    expect(endTestTurn(data, other).state.status).toBe("playerTurn");
  });

  it("T136: a fallen hero's copies leave the draw pile; its hand cards go at turn end", () => {
    const { data, state } = makeTestCombat({
      heroIds: ["m06", "f02", "f03"],
      mutateData: makeEnemiesIdle,
      setup: (s) => {
        idleEnemies(s);
        s.heroes[0]!.hp = 1;
        s.heroes[0]!.statuses.push({ id: "burn", value: 3 });
      },
    });
    const ownedByM06 = (id: string) => state.cards[id]!.ownerIds.includes("m06");
    const inPile = p0(state).drawPile.filter(ownedByM06);
    const inHand = p0(state).hand.filter(ownedByM06);
    expect(inPile.length).toBeGreaterThan(0);

    const died = endTestTurn(data, state);
    expect(died.events).toContainEqual({ type: "cardsPurged", heroId: "hero:m06", instanceIds: inPile });
    expect(p0(died.state).drawPile.some(ownedByM06)).toBe(false);
    for (const id of inHand) expect(p0(died.state).hand).toContain(id);

    const next = endTestTurn(data, died.state);
    for (const id of inHand) {
      expect(p0(next.state).hand).not.toContain(id);
      expect(p0(next.state).discardPile).toContain(id);
    }
  });
});


describe("lá tạo ra", () => {
  it("T270: onLevelUp createCard puts a token in hand with a stable id; a full hand skips it", () => {
    const { data, state } = makeTestCombat({
      mutateData: (d) => {
        d.cards[tokenCard.id] = tokenCard;
        withLevelUp("f04", { counter: "damageTaken", threshold: 1, passive: { type: "none" } })(d);
        d.heroes.f04!.levelUp.onLevelUp = [{ type: "createCard", cardId: tokenCard.id }];
      },
    });
    const hurt = injectCard(state, data, {
      id: "test_selfcut", name: "Tự Thương", ownerId: "f04", cost: 0, copies: 1, type: "skill", tags: [],
      target: "none", effects: [{ type: "loseHp", amount: 1, to: "self" }], text: "",
    });

    // 8 cards in hand: after `hurt` leaves, 7 remain — above `handSize` but under `handLimit`.
    const roomy = structuredClone(state);
    p0(roomy).hand = [hurt, ...p0(roomy).drawPile.splice(0, 7)];
    const result = applyAction(data, roomy, { type: "playCard", instanceId: hurt });
    if (!result.ok) throw new Error(result.error);
    expect(result.events).toContainEqual({ type: "cardCreated", cardId: tokenCard.id, instanceId: "t1" });
    expect(p0(result.state).hand).toHaveLength(8);
    expect(result.state.cards.t1).toMatchObject({ cardId: tokenCard.id, ownerIds: ["f04"], player: 0, heldTurns: 0 });

    // 9 cards in hand: after `hurt` leaves, 8 remain = handLimit → no room.
    const full = structuredClone(state);
    p0(full).hand = [hurt, ...p0(full).drawPile.splice(0, 8)];
    const skipped = applyAction(data, full, { type: "playCard", instanceId: hurt });
    if (!skipped.ok) throw new Error(skipped.error);
    expect(skipped.events).toContainEqual({ type: "cardCreated", cardId: tokenCard.id, instanceId: null });
    expect(skipped.state.cards.t1).toBeUndefined();
  });

  it("T271: token cards cannot be deck-built and createCard must point at a token", () => {
    const data = testData();
    data.cards[tokenCard.id] = tokenCard;
    const profile = ownAllHeroes(data, createProfile(data));
    const deck = { heroIds: ["m05", "f04", "m06"] as [string, string, string], cardIds: [...data.heroes.m05!.cardIds, ...data.heroes.f04!.cardIds.slice(0, 5), tokenCard.id, ...data.heroes.m06!.cardIds] };
    expect(validateDeck(data, profile, deck).length).toBeGreaterThan(0);
  });
});

describe("giới hạn tay bài", () => {
  const drawCard = (amount: number): CardDef => ({
    id: `test_draw${amount}`, name: `Rút ${amount}`, ownerId: "m05", cost: 0, copies: 1,
    type: "skill", tags: [], target: "none", effects: [{ type: "drawCards", amount }], text: "",
  });

  it("T277: drawCards draws blindly; cards past handLimit are discarded", () => {
    const { data, state } = makeTestCombat({ setup: (s) => { p0(s).moonPower = 99; } });
    const small = structuredClone(state);
    const fit = injectCard(small, data, drawCard(3));
    p0(small).hand = [fit];
    const fitted = applyAction(data, small, { type: "playCard", instanceId: fit });
    if (!fitted.ok) throw new Error(fitted.error);
    expect(fitted.events).toContainEqual(expect.objectContaining({ type: "cardsDrawn" }));
    expect(fitted.events.find((e) => e.type === "cardsDrawn")).toMatchObject({ instanceIds: expect.arrayContaining([expect.any(String)]) });
    expect(p0(fitted.state).hand).toHaveLength(3);
    expect(fitted.events.some((e) => e.type === "cardDiscarded")).toBe(false);

    const crowded = structuredClone(state);
    const over = injectCard(crowded, data, drawCard(3));
    p0(crowded).hand = [over, ...p0(crowded).drawPile.splice(0, 7)];
    const spilled = applyAction(data, crowded, { type: "playCard", instanceId: over });
    if (!spilled.ok) throw new Error(spilled.error);
    expect(p0(spilled.state).hand).toHaveLength(data.combatConfig.handLimit);
    const drawn = spilled.events.find((e) => e.type === "cardsDrawn") as { instanceIds: string[] } | undefined;
    const dropped = spilled.events.find((e) => e.type === "cardDiscarded") as { instanceIds: string[] } | undefined;
    expect(drawn?.instanceIds).toHaveLength(1);
    expect(dropped?.instanceIds).toHaveLength(2);
    for (const id of dropped!.instanceIds) {
      expect(p0(spilled.state).discardPile).toContain(id);
      expect(p0(spilled.state).drawPile).not.toContain(id);
    }
  });

  it("T279: a Chiêm Bài pick on a full hand is discarded; unchosen options still bottom", () => {
    const { data, state } = makeTestCombat({ setup: (s) => { p0(s).moonPower = 99; } });
    const peek = injectCard(state, data, testCard({
      id: "test_peek", effects: [{ type: "chooseCard", look: 3 }],
    }));
    p0(state).hand = [peek, ...p0(state).drawPile.splice(0, data.combatConfig.handLimit)];
    const opened = applyAction(data, state, { type: "playCard", instanceId: peek });
    if (!opened.ok) throw new Error(opened.error);
    const pending = p0(opened.state).pendingChoice;
    if (pending?.kind !== "chooseCard") throw new Error("expected Chiêm Bài");
    const picked = applyAction(data, opened.state, { type: "chooseCard", instanceId: pending.options[0]! });
    if (!picked.ok) throw new Error(picked.error);
    const seat = p0(picked.state);
    expect(seat.hand).toHaveLength(data.combatConfig.handLimit);
    expect(seat.hand).not.toContain(pending.options[0]);
    expect(seat.discardPile).toContain(pending.options[0]);
    expect(picked.events).toContainEqual(expect.objectContaining({ type: "cardChosen", instanceId: pending.options[0] }));
    expect(picked.events).toContainEqual(expect.objectContaining({ type: "cardDiscarded", instanceIds: [pending.options[0]] }));
    for (const other of pending.options.slice(1)) expect(seat.drawPile).toContain(other);
  });
});
