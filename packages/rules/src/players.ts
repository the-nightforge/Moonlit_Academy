import type { CombatState, HeroState, PlayerState, UnitState } from "./types/index";

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

/**
 * Ally units of `unit` for `allAllies`/same-side effects (`01` §10, `17` §8.4):
 * a hero's own-seat heroes; an enemy's fellow enemies.
 */
export function alliesOf(state: CombatState, unit: UnitState): UnitState[] {
  if (unit.side === "enemy") return state.enemies;
  return heroesOf(state, (unit as HeroState).player);
}

/**
 * Opposing units of `unit` for `allEnemies`/targeting (`17` §3.4):
 * pve/coop — heroes vs enemies; pvp — the other seat's heroes.
 */
export function opponentsOf(state: CombatState, unit: UnitState): UnitState[] {
  if (unit.side === "enemy") return state.heroes;
  if (state.mode === "pvp") {
    return state.heroes.filter((hero) => hero.player !== (unit as HeroState).player);
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
