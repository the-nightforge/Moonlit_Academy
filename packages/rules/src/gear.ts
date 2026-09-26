import type {
  CardDef,
  CardInstance,
  CombatState,
  CombatWeapon,
  GameData,
  RelicDef,
  RelicLevel,
  WeaponCardDef,
  WeaponDef,
  WeaponHook,
} from "./types/index";

export interface WeaponLevel {
  card: WeaponCardDef;
  hooks: WeaponHook[];
  signatureHooks?: WeaponHook[];
}

/** A weapon at refinement `refinement` (1–5): R1 with R2..Rn changes applied in order (`01` §14.1). */
export function weaponAt(def: WeaponDef, refinement: number): WeaponLevel {
  let level: WeaponLevel = { card: def.card, hooks: def.hooks, signatureHooks: def.signatureHooks };
  for (const change of def.refinement.slice(0, Math.max(0, refinement - 1))) {
    level = {
      card: { ...level.card, ...change.card },
      hooks: change.hooks ?? level.hooks,
      signatureHooks: change.signatureHooks ?? level.signatureHooks,
    };
  }
  return level;
}

/** A moon relic at resonance `resonance` (1–5): each level is complete. */
export function relicAt(def: RelicDef, resonance: number): RelicLevel {
  const level = def.resonance[Math.min(def.resonance.length, Math.max(1, resonance)) - 1];
  if (!level) throw new Error(`relicAt: relic "${def.id}" has no resonance levels`);
  return level;
}

/** The hooks a carried weapon runs: signature hooks on its signature hero (`01` §14.3). */
export function weaponHooks(data: GameData, weapon: CombatWeapon): WeaponHook[] {
  const def = data.weapons[weapon.weaponId];
  if (!def) return [];
  const level = weaponAt(def, weapon.refinement);
  return def.signatureHeroId === weapon.heroId && level.signatureHooks ? level.signatureHooks : level.hooks;
}

/** The weapon card of `weapon` as a regular card owned by its wearer (`01` §14.2). */
export function weaponCardDef(data: GameData, weapon: CombatWeapon): CardDef {
  const def = data.weapons[weapon.weaponId];
  if (!def) throw new Error(`unknown weapon "${weapon.weaponId}"`);
  return { ...weaponAt(def, weapon.refinement).card, id: def.id, ownerId: weapon.heroId };
}

/** Definition of a card instance: a card from cards.json, or a carried weapon's card. */
export function cardDefOf(data: GameData, state: CombatState, instance: CardInstance): CardDef | undefined {
  const card = data.cards[instance.cardId];
  if (card) return card;
  const weapon = state.weapons.find(
    (entry) => entry.weaponId === instance.cardId && entry.heroId === instance.ownerIds[0],
  );
  return weapon ? weaponCardDef(data, weapon) : undefined;
}
