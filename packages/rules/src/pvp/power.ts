import { applySignatureCards, bondCardsForTeam } from "../create-combat";
import { relicAt, weaponAt, weaponHooks } from "../gear";
import type { CardDef, DamageScale, Effect, GameData, PvpSide, Rarity } from "../types/index";

const rarity: Record<Rarity, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };
const level = (n: number | undefined) => Math.min(5, Math.max(1, n ?? 1));

/**
 * `scaledDamage` reads a stat off the live board, which this estimator never
 * sees, so each stat needs a stand-in. Only `alliesRegen` is fitted: a
 * mid-combat team pool of Hồi Phục (vòng 9–12, e.g. a 15–21 stack on the carry
 * plus 5–8 on each support). The other five keep the shared `3` — their
 * measured swings flip sign depending on which constant is picked, so fitting
 * them needs its own evidence pass, not a guess.
 */
const SCALED_DAMAGE_STAND_IN: Partial<Record<DamageScale, number>> = { alliesRegen: 24 };
/** Hồi Phục held by the single unit a `burstRegen` typically cashes out. */
const BURST_REGEN_POOL = 9;

/** Static utility estimate, in damage-equivalent units; no combat simulation. */
function effectPower(effect: Effect): number {
  const targets = "to" in effect && (effect.to === "allEnemies" || effect.to === "allAllies") ? 2 : 1;
  let value: number;
  switch (effect.type) {
    case "damage": value = effect.amount * (effect.hits ?? 1); break;
    case "heal": case "gainArmor": value = effect.amount * 0.8; break;
    case "loseHp": value = -effect.amount; break;
    case "applyStatus": value = effect.amount * 2; break;
    case "conditional": return Math.max(effectsPower(effect.then), effectsPower(effect.else ?? [])) * 0.7;
    case "scaledDamage": value = Math.min(effect.max ?? 20, (effect.base ?? 0) + effect.amount * (SCALED_DAMAGE_STAND_IN[effect.per] ?? 3) / (effect.divisor ?? 1)); break;
    case "burstRegen": value = effect.multiplier * BURST_REGEN_POOL * 0.8; break;
    case "missingHpDamage": value = effect.ratio * 20 * (effect.hits ?? 1); break;
    case "drawCards": case "gainMoonPower": case "drainMoonPower": case "gainMoonPowerPerTurn": value = effect.amount * 4; break;
    case "chooseCard": value = 4 + effect.look; break;
    case "summon": case "revive": value = 12; break;
    case "execute": value = 8 + effectsPower(effect.elseEffects ?? []) * 0.5; break;
    default: value = 5;
  }
  return value * targets;
}
const effectsPower = (effects: readonly Effect[]) => effects.reduce((sum, effect) => sum + effectPower(effect), 0);
const cardPower = (card: Pick<CardDef, "cost" | "effects">) => Math.max(0.5, effectsPower(card.effects)) / (1 + card.cost * 0.5);

/**
 * Server-side matchmaking heuristic, not a win prediction. Only the selected
 * side is measured; account inventory/rating and seed never enter the score.
 * Weights: hero 100 + 1.5 × arena HP; C2's easier level-up +20; selected C5 alt
 * form +10. Deck utility is the copy-weighted mean ×6 (signature+ is resolved),
 * plus each bond card's utility ×2. Effects use damage units, heal/armor ×0.8,
 * status ×2, resource/draw ×4, two effective targets for team-wide effects.
 * Weapon: 25 + rarity rank ×4 + (R−1)×12 + card utility ×2 + hook utility.
 * Relic: 25 + rarity rank ×4 + (resonance−1)×12 + modifiers ×5 + hook utility.
 * Hooks use their effects' utility / every. `scaledDamage` reads a per-stat
 * stand-in (see `SCALED_DAMAGE_STAND_IN`); `burstRegen` values the Hồi Phục it
 * cashes out. Values round to whole points.
 * Legacy normalized replay flags retain their historical bonus suppression.
 */
export function measurePvpPower(data: GameData, side: PvpSide): number {
  let power = 0;
  const deck = applySignatureCards(data, side.deckCardIds ?? side.heroIds.flatMap((id) => data.heroes[id]!.cardIds), side.loadout);
  let cardTotal = 0;
  let copies = 0;
  for (const id of deck) {
    const card = data.cards[id]!;
    cardTotal += cardPower(card) * card.copies;
    copies += card.copies;
  }
  power += copies ? cardTotal / copies * 6 : 0;
  for (const card of bondCardsForTeam(data, side.heroIds)) power += cardPower(card) * 2;
  for (const id of side.heroIds) {
    const hero = side.loadout.heroes[id];
    power += 100 + data.pvpConfig.heroStats[id]!.maxHp * 1.5;
    if ((hero?.constellation ?? 0) >= 2 && !side.loadout.pvp) power += 20;
    if ((hero?.constellation ?? 0) >= 5 && hero?.levelUpForm === "alt") power += 10;
    if (hero?.weaponId) {
      const weapon = data.weapons[hero.weaponId]!;
      const refinement = level(hero.refinement);
      power += 25 + rarity[weapon.rarity] * 4 + (refinement - 1) * 12 + cardPower(weaponAt(weapon, refinement).card) * 2;
      for (const hook of weaponHooks(data, { heroId: id, weaponId: hero.weaponId, refinement })) power += effectsPower(hook.effects) / (hook.every ?? 1);
    }
  }
  for (const relic of side.loadout.relics ?? []) {
    const def = data.relics[relic.id]!;
    const resonance = level(relic.resonance);
    const current = relicAt(def, resonance);
    power += 25 + rarity[def.rarity] * 4 + (resonance - 1) * 12 + (current.modifiers?.length ?? 0) * 5;
    for (const hook of current.hooks ?? []) power += effectsPower(hook.effects) / (hook.every ?? 1);
  }
  return Math.round(power);
}
