import type { CombatState, HeroState, PlayerState, SummonState, UnitState } from "./types/index";

/** The seat whose turn is active (PvE and co-op: `players[0]` / the allied side). */
export function activePlayerState(state: CombatState): PlayerState {
  return state.players[state.activePlayer]!;
}

/** The seat owning the hero unit `unitId`; undefined for enemy ids and unknown units. */
export function playerOf(state: CombatState, unitId: string): PlayerState | undefined {
  const hero = state.heroes.find((unit) => unit.id === unitId);
  return hero ? state.players[hero.player] : undefined;
}

/** The seat owning card instance `instanceId`. */
export function playerOfCard(state: CombatState, instanceId: string): PlayerState | undefined {
  const instance = state.cards[instanceId];
  return instance ? state.players[instance.player] : undefined;
}

/** Living or dead hero units of seat `player`, in state order. */
export function heroesOf(state: CombatState, player: number): HeroState[] {
  return state.heroes.filter((hero) => hero.player === player);
}

/** Linh Thú on the board (`01` §17); empty until the first summon. */
export function summonsOf(state: CombatState): SummonState[] {
  return state.summons ?? [];
}

/**
 * Ally units of `unit` for `allAllies`/same-side effects (`01` §10, `17` §8.4):
 * a hero's own-seat heroes and Linh Thú; an enemy's fellow enemies.
 */
export function alliesOf(state: CombatState, unit: UnitState): UnitState[] {
  if (unit.side === "enemy") return state.enemies;
  const seat = (unit as HeroState).player;
  return [...heroesOf(state, seat), ...summonsOf(state).filter((summon) => summon.player === seat)];
}

/**
 * Opposing units of `unit` for `allEnemies`/targeting (`17` §3.4, §17.3):
 * pve/coop — heroes and Linh Thú vs enemies; pvp — the other seat's heroes and Linh Thú.
 */
export function opponentsOf(state: CombatState, unit: UnitState): UnitState[] {
  if (unit.side === "enemy") return [...state.heroes, ...summonsOf(state)];
  if (state.mode === "pvp") {
    const seat = (unit as HeroState).player;
    return [...state.heroes, ...summonsOf(state)].filter((u) => (u as HeroState).player !== seat);
  }
  return state.enemies;
}

/**
 * An id inside seat `player`'s namespace: multiplayer ids carry the `p<index>_`
 * prefix (`17` §2.4); single-player PvE ids stay unprefixed for compatibility.
 */
export function prefixedId(state: CombatState, player: number, id: string): string {
  return state.players.length > 1 ? `p${player}_${id}` : id;
}

/**
 * `{ player }` spread for seat-scoped events — only in multiplayer, so PvE event
 * streams stay byte-identical (`17` §2.3, doc `02` §3).
 */
export function seatTag(state: CombatState, player: number): { player?: number } {
  return state.players.length > 1 ? { player } : {};
}
