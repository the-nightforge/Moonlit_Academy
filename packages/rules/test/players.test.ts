import { describe, expect, it } from "vitest";

import type { CombatState, PlayerState } from "../src/index";
import { activePlayerState, alliesOf, playerOf, prefixedId } from "../src/index";
import { makeTestCombat, p0 } from "./helpers";

/**
 * A hand-built two-player combat for the accessor tests: seat 0 from a real PvE
 * combat plus a mirrored seat 1 choosing the same heroes (`17` §2.4, T215).
 */
function twoPlayerState(): CombatState {
  const { state: base } = makeTestCombat();
  const state = JSON.parse(JSON.stringify(base)) as CombatState;
  const second = JSON.parse(JSON.stringify(p0(state))) as PlayerState;
  second.index = 1;
  state.players.push(second);
  const prefix = (id: string) => `p1_${id}`;
  for (const id of [...second.hand, ...second.drawPile, ...second.discardPile]) {
    const renamed = prefixedId(state, 1, id);
    expect(renamed).toBe(prefix(id));
    state.cards[renamed] = { ...state.cards[id]!, instanceId: renamed, player: 1 };
    delete state.cards[id];
  }
  second.hand = second.hand.map(prefix);
  second.drawPile = second.drawPile.map(prefix);
  second.discardPile = second.discardPile.map(prefix);
  const secondHeroes = state.heroes.map((hero) => ({
    ...hero,
    id: prefixedId(state, 1, hero.id),
    player: 1,
  }));
  second.heroIds = secondHeroes.map((hero) => hero.id);
  state.heroes.push(...secondHeroes);
  return state;
}

describe("per-player state (5a)", () => {
  it("T215: two players may pick the same hero — prefixed ids never collide", () => {
    const state = twoPlayerState();
    expect(state.mode).toBe("pve");
    expect(state.players).toHaveLength(2);
    const heroIds = new Set(state.heroes.map((hero) => hero.id));
    expect(heroIds.size).toBe(state.heroes.length);
    expect(state.players[1]!.heroIds).toEqual(
      state.heroes.filter((hero) => hero.player === 1).map((hero) => hero.id),
    );
    const p1Hero = state.heroes.find((hero) => hero.player === 1)!;
    expect(p1Hero.id.startsWith("p1_")).toBe(true);
    expect(playerOf(state, p1Hero.id)).toBe(state.players[1]);
    expect(playerOf(state, state.heroes[0]!.id)).toBe(state.players[0]);
    const cardIds = Object.keys(state.cards);
    expect(new Set(cardIds).size).toBe(cardIds.length);
    expect(cardIds.some((id) => id.startsWith("p1_"))).toBe(true);
    expect(state.cards[state.players[1]!.hand[0]!]!.player).toBe(1);
    expect(activePlayerState(state)).toBe(state.players[0]);
    expect(alliesOf(state, state.heroes[0]!).map((unit) => unit.id)).toEqual(
      state.players[0]!.heroIds,
    );
    expect(playerOf(state, "enemy:0")).toBeUndefined();
  });
});
