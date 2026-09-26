import { describe, expect, it } from "vitest";
import type { CombatState, GameData } from "../src/index";
import { applyAction, bondCardsForTeam } from "../src/index";
import { healFiveCard } from "./fixtures";
import { idleEnemies, injectCard, instanceIdOf, makeEnemiesIdle, makeTestCombat, setHand } from "./helpers";

function end(data: GameData, state: CombatState) {
  const result = applyAction(data, state, { type: "endTurn" });
  if (!result.ok) throw new Error(result.error);
  return result;
}

const idle = { mutateData: makeEnemiesIdle, setup: idleEnemies };

describe("hand and draw pile", () => {
  it("T131: the hand is kept between turns and refilled up to 6", () => {
    const { data, state } = makeTestCombat(idle);
    const hand = [...state.hand];
    expect(hand).toHaveLength(6);
    const kept = end(data, state);
    expect(kept.state.hand).toEqual(hand);
    expect(kept.events.some((e) => e.type === "cardsDrawn")).toBe(false);

    kept.state.hand = kept.state.hand.slice(0, 4);
    kept.state.drawPile = kept.state.drawPile.slice(0, 1);
    const refilled = end(data, kept.state);
    expect(refilled.state.hand).toHaveLength(5);
    expect(refilled.state.drawPile).toHaveLength(0);
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
    const result = end(data, state);
    expect(result.events).toContainEqual({ type: "cardDiscarded", instanceIds: [hoGam] });
    expect(result.state.discardPile).toContain(hoGam);
    expect(result.state.hand).toContain(thaoDuoc);
    expect(result.state.hand).toContain(pheHon);
    expect(result.state.hand).not.toContain(hoGam);
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
    const ids = [...state.hand, ...state.drawPile];
    expect(new Set(ids).size).toBe(Object.keys(state.cards).length);
  });

  it("T134: the discard pile is never shuffled back", () => {
    const { data, state } = makeTestCombat(idle);
    state.discardPile.push(...state.drawPile.splice(0, state.drawPile.length - 1));
    state.hand = state.hand.slice(0, 3);
    const result = end(data, state);
    expect(result.state.drawPile).toHaveLength(0);
    expect(result.state.hand).toHaveLength(4);
    expect(result.events.some((e) => e.type === "deckShuffled")).toBe(false);
  });

  it("T135: empty draw pile and empty hand at turn start loses (Cạn Bài)", () => {
    const { data, state } = makeTestCombat(idle);
    state.discardPile.push(...state.drawPile, ...state.hand);
    state.drawPile = [];
    state.hand = [];
    const result = end(data, state);
    expect(result.state.status).toBe("lost");
    const types = result.events.map((e) => e.type);
    expect(types.slice(-2)).toEqual(["deckedOut", "combatEnded"]);

    const other = makeTestCombat(idle).state;
    other.discardPile.push(...other.drawPile, ...other.hand.slice(1));
    other.drawPile = [];
    other.hand = other.hand.slice(0, 1);
    expect(end(data, other).state.status).toBe("playerTurn");
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
    const inPile = state.drawPile.filter(ownedByM06);
    const inHand = state.hand.filter(ownedByM06);
    expect(inPile.length).toBeGreaterThan(0);

    const died = end(data, state);
    expect(died.events).toContainEqual({ type: "cardsPurged", heroId: "hero:m06", instanceIds: inPile });
    expect(died.state.drawPile.some(ownedByM06)).toBe(false);
    for (const id of inHand) expect(died.state.hand).toContain(id);

    const next = end(data, died.state);
    for (const id of inHand) {
      expect(next.state.hand).not.toContain(id);
      expect(next.state.discardPile).toContain(id);
    }
  });
});
