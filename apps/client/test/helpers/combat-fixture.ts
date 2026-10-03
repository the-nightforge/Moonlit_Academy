import { loadGameData } from "data";
import { createCombat, createCoopCombat, createPvpCombat, starterDeck } from "rules";
import type { CombatState, GameData, Loadout } from "rules";
import type { MatchSnapshot } from "../../src/net/protocol";

export const FIXTURE_TEAM: [string, string, string] = ["m05", "f04", "m06"];

function loadoutFor(heroIds: readonly string[], pvp: boolean): Loadout {
  return {
    heroes: Object.fromEntries(
      heroIds.map((heroId) => [
        heroId,
        { constellation: 0, levelUpForm: "base" as const, weaponId: null, refinement: 0 },
      ]),
    ),
    relics: [],
    ...(pvp ? { pvp: true } : {}),
  };
}

/**
 * A real seeded combat for client tests — built by `createCombat` /
 * `createPvpCombat` / `createCoopCombat`, never a hand-faked state. Seed 42,
 * the default team at both seats when online, the first valid encounter.
 */
export function fixture(mode: "pve" | "pvp" | "coop" = "pve"): { data: GameData; state: CombatState } {
  const data = loadGameData();
  const seed = 42;
  if (mode === "pvp") {
    const side = { heroIds: FIXTURE_TEAM, loadout: loadoutFor(FIXTURE_TEAM, true) };
    const { state } = createPvpCombat(data, { seed, players: [side, side] });
    return { data, state };
  }
  if (mode === "coop") {
    const side = { heroIds: FIXTURE_TEAM, loadout: loadoutFor(FIXTURE_TEAM, false) };
    const { state } = createCoopCombat(data, {
      seed,
      players: [side, side],
      encounterId: data.coopConfig.encounterId,
    });
    return { data, state };
  }
  const { state } = createCombat(data, {
    heroIds: FIXTURE_TEAM,
    encounterId: "enc_01",
    seed,
    deckCardIds: starterDeck(data, FIXTURE_TEAM),
  });
  return { data, state };
}

/** A per-seat realtime snapshot the way the server sends it (`16` §8.2). */
export function snapshot(state: CombatState, you = 0, overrides: Partial<MatchSnapshot> = {}): MatchSnapshot {
  return {
    matchId: "m_fixture",
    mode: state.mode,
    you,
    others: state.players
      .filter((player) => player.index !== you)
      .map((player) => ({ seat: player.index, username: `seat_${player.index}`, connected: true })),
    view: state,
    deadline: null,
    eventSeq: 0,
    nextActionSeq: 1,
    ...overrides,
  };
}

export function deferred<T>(): { promise: Promise<T>; resolve(value: T): void; reject(error: unknown): void } {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
