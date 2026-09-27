import { cardDefOf } from "./gear";
import { getEffectiveCost, getValidTargets, isCardPlayable } from "./queries";
import type { Action, CombatState, Effect, GameData, UnitState } from "./types/index";

/**
 * The heuristic bot shared by the playtest sims and `pvpBot`: mulligan cards
 * above the doubling curve, Chiêm Bài picks the most expensive card affordable
 * next round, plays costliest first, focuses the lowest-HP enemy unit (or the
 * highest-reserve seat for drains) / lowest-ratio ally. Pure: reads only the
 * state it is given — pass a `viewFor` result to keep it honest (`17` §4.9).
 */
export function chooseCombatAction(data: GameData, state: CombatState, seat: number): Action {
  const player = state.players[seat]!;
  const defOf = (id: string) => cardDefOf(data, state, state.cards[id]!);
  if (state.status === "mulligan") {
    const expensive = player.hand.filter((id) => defOf(id)!.cost > 5);
    return {
      type: "mulligan",
      instanceIds: expensive.slice(0, data.combatConfig.maxMulligan),
    };
  }
  // Co-op keeps status playerTurn while a seat answers a choice (`01` §16.2).
  if (state.status === "choosing" || player.pendingChoice !== null) {
    const options = player.pendingChoice?.options ?? [];
    const curve = data.combatConfig.moonPower;
    const nextFund =
      Math.min(curve.cap, curve.start + state.round * curve.perRound) +
      data.combatConfig.moonReserveMax;
    const ordered = [...options].sort((a, b) => defOf(b)!.cost - defOf(a)!.cost);
    const pick = ordered.find((id) => defOf(id)!.cost <= nextFund) ?? ordered[0];
    return pick === undefined ? { type: "endTurn" } : { type: "chooseCard", instanceId: pick };
  }
  const keywordsOf = (id: string) => defOf(id)!.keywords ?? [];
  const heldThreshold = (id: string): number => {
    let best = 0;
    const walk = (effects: Effect[]) => {
      for (const effect of effects) {
        if (effect.type !== "conditional") continue;
        if (effect.condition.type === "heldTurnsAtLeast") best = Math.max(best, effect.condition.turns);
        walk(effect.then);
        walk(effect.else ?? []);
      }
    };
    walk(defOf(id)!.effects);
    return best;
  };
  const playable = player.hand.filter((id) => isCardPlayable(data, state, id, seat));
  const ready = playable.filter((id) => state.cards[id]!.heldTurns >= heldThreshold(id));
  const candidates = ready.length > 0 || player.hand.length < data.combatConfig.handSize ? ready : playable;
  const ordered = [...candidates].sort((a, b) => {
    const comboA = keywordsOf(a).includes("lien_hoan") ? 1 : 0;
    const comboB = keywordsOf(b).includes("lien_hoan") ? 1 : 0;
    if (comboA !== comboB) return comboA - comboB; // non-combo cards first
    return getEffectiveCost(data, state, b) - getEffectiveCost(data, state, a);
  });
  const unitOf = (id: string) =>
    state.heroes.find((hero) => hero.id === id) ?? state.enemies.find((enemy) => enemy.id === id);
  for (const instanceId of ordered) {
    const card = defOf(instanceId)!;
    if (card.target === "none") return { type: "playCard", instanceId };
    const targets = getValidTargets(data, state, instanceId);
    let targetId: string | undefined;
    if (card.target === "enemy") {
      const drains = keywordsOf(instanceId).some((k) => k === "toa_nguyet" || k === "doat_nguyet");
      // PvE drains hit the enemy planning the priciest chain; PvP drains hit the
      // seat holding the bigger reserve (`17` §4.5).
      const threat = (id: string) => {
        const unit = unitOf(id)!;
        return unit.side === "enemy"
          ? state.enemies.find((e) => e.id === id)!.plannedIntents.reduce((s, p) => s + p.cost, 0)
          : (state.players.find((p) => p.index === (unit as { player: number }).player)?.moonReserve ?? 0);
      };
      const hp = (id: string) => unitOf(id)!.hp;
      targetId = [...targets].sort((a, b) => (drains ? threat(b) - threat(a) : hp(a) - hp(b)))[0];
    } else {
      const burst = keywordsOf(instanceId).includes("tu_duoc");
      const regen = (id: string) => unitOf(id)!.statuses.find((s) => s.id === "regen")?.value ?? 0;
      const ratio = (id: string) => {
        const unit = unitOf(id) as UnitState;
        return unit.hp / unit.maxHp;
      };
      const pool = burst ? targets.filter((id) => regen(id) >= 3) : targets;
      targetId = [...pool].sort((a, b) => ratio(a) - ratio(b))[0];
    }
    if (targetId !== undefined) return { type: "playCard", instanceId, targetId };
  }
  return { type: "endTurn" };
}
