import { cloneState } from "../clone";
import { nextRandom, shuffle } from "../rng";
import type { CardDef, CardInstance, CombatState, GameData } from "../types/index";
import type { BotObservation } from "./observation";
import type { BotProfile } from "./policy";

/**
 * Belief sampling (`Task 4`): turn the sanitized observation into concrete
 * hypothetical worlds the search can simulate. Only hidden zones are
 * synthesized — everything publicly visible is kept verbatim.
 *
 * Priors, never truth:
 * - own draw pile: the seat's real registered deck when `ownDeckCardIds` is
 *   known, else the instance ids the view still carries for that seat;
 * - partner draw pile (co-op): partner-owned instances, order randomized;
 * - opponent hand/draw (PvP): card ids drawn from the *archetype pool* of the
 *   opponent's hero defs — the submitted deck is never consulted;
 * - enemy intents (PvE/co-op): left unplanned; the engine's own planner rolls
 *   them from the sample's `rngState`, which can only produce legal intents.
 *
 * A sample that cannot satisfy zone/count invariants is dropped and reported
 * through `errors` (when provided) — the caller counts these as synthetic
 * state errors and falls back, never silently searching a broken world.
 */
export function sampleBeliefStates(
  data: GameData,
  obs: BotObservation,
  profile: BotProfile,
  seed: number,
  errors?: string[],
): readonly CombatState[] {
  const count = Math.max(0, profile.search.samples);
  const worlds: CombatState[] = [];
  for (let i = 0; i < count; i++) {
    const sampleSeed = (seed ^ Math.imul(i + 1, 0x9e3779b9)) >>> 0;
    const world = cloneState(obs.visibleState);
    world.rngState = sampleSeed;
    let rng = sampleSeed;
    let ok = true;
    for (const seat of world.players) {
      const built = fillSeat(data, world, obs, seat.index, rng, (next) => (rng = next));
      if (!built) {
        errors?.push(`sample ${i}: seat ${seat.index} zones inconsistent — dropped`);
        ok = false;
        break;
      }
    }
    if (ok) worlds.push(world);
  }
  return worlds;
}

/** Fills one seat's hidden zones. Returns false when the seat is unfixable. */
function fillSeat(
  data: GameData,
  world: CombatState,
  obs: BotObservation,
  seatIndex: number,
  rng: number,
  advance: (next: number) => void,
): boolean {
  const seat = world.players[seatIndex];
  if (seat === undefined) return false;
  const isSelf = seatIndex === obs.seat || obs.mode !== "pvp";
  // PvP strips the opponent's instances entirely; co-op/PvE keep every
  // instance and only mask pile order.
  const pendingOptions = seat.pendingChoice?.kind === "chooseCard" ? seat.pendingChoice.options : [];
  const knownIds = new Set([...seat.hand, ...seat.discardPile, ...pendingOptions]);
  const unseen = Object.values(world.cards)
    .filter((inst) => inst.player === seatIndex && !knownIds.has(inst.instanceId))
    .map((inst) => inst.instanceId);

  if (seat.hand.some((id) => id.startsWith("hidden_")) || unseen.length !== seat.drawPile.length) {
    // Hand contents or pile membership are hidden — synthesize from the
    // archetype prior (PvP opponent, or any seat whose instances are gone).
    if (isSelf && unseen.length !== seat.drawPile.length) return false;
    const pool = archetypePool(data, world, seatIndex);
    if (pool.length === 0) return seat.hand.length === 0 && seat.drawPile.length === 0;
    const roll = (n: number) => {
      const r = nextRandom(rng);
      rng = r.rngState;
      advance(rng);
      return Math.floor(r.value * n);
    };
    const synth = (prefix: string, n: number): string[] => {
      const ids: string[] = [];
      for (let i = 0; i < n; i++) {
        const card = pool[roll(pool.length)]!;
        const inst: CardInstance = {
          instanceId: `belief_${seatIndex}_${prefix}${i}`,
          cardId: card.id,
          ownerIds: card.bond ? [...card.bond.owners] : [card.ownerId!],
          player: seatIndex,
          heldTurns: 0,
        };
        world.cards[inst.instanceId] = inst;
        ids.push(inst.instanceId);
      }
      return ids;
    };
    if (seat.hand.some((id) => id.startsWith("hidden_"))) seat.hand = synth("h", seat.hand.length);
    const need = Math.max(0, seat.drawPile.length - unseen.length);
    const pile = shuffle([...unseen, ...synth("d", need)], rng);
    rng = pile.rngState;
    seat.drawPile = pile.items;
    advance(rng);
    return true;
  }

  // All membership known — only the order is hidden. Sample a fresh shuffle.
  const pile = shuffle(unseen, rng);
  seat.drawPile = pile.items;
  advance(pile.rngState);
  return true;
}

/** Cards the seat's heroes could legally have brought — the archetype prior. */
function archetypePool(data: GameData, world: CombatState, seatIndex: number): CardDef[] {
  const heroDefIds = new Set(
    world.heroes.filter((h) => h.player === seatIndex).map((h) => h.defId),
  );
  return Object.values(data.cards).filter(
    (card) =>
      (card.ownerId !== undefined && heroDefIds.has(card.ownerId)) ||
      (card.bond !== undefined && card.bond.owners.every((id) => heroDefIds.has(id))),
  );
}
