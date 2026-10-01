import type { Archetype, AttackStyle, CardDef, CardTag, CombatState, GameData } from "rules";

/** What a hit looks like: a weapon style, or a spell burst for non-attack cards. */
export type AttackKind = AttackStyle | "spell";
export interface AttackLook {
  kind: AttackKind;
  color: number;
}

const ENEMY_COLOR = 0xff5a40;

const STYLE_COLOR: Record<AttackKind, number> = {
  slash: 0xffd27a,
  spear: 0xff9a40,
  darts: 0xcfd8f0,
  bow: 0xffe08a,
  herb: 0x7fe07f,
  spell: 0xf4d35e,
};

/** Heroes without a lore weapon fight like their archetype. */
const ARCHETYPE_KIND: Record<Archetype, AttackKind> = {
  vanguard: "slash",
  striker: "slash",
  support: "herb",
  controller: "spell",
  specialist: "spell",
};

/** First matching tag colors a spell; order = which tag wins on multi-tag cards. */
const TAG_COLOR: [CardTag, number][] = [
  ["forbidden", 0xd03a4a],
  ["moon", 0xf4d35e],
  ["scheme", 0xb9a8ff],
  ["control", 0x9fd4ff],
  ["ward", 0x9fd4ff],
  ["harmony", 0xff8fb8],
  ["heal", 0x7fe07f],
  ["assassin", 0xcfd8f0],
];

/**
 * Look of a hit from `sourceId`. `card` is the card being played, if any:
 * non-attack cards cast a spell colored by tag; attack cards (and card-less
 * hits) use the equipped weapon's style, else the hero's lore weapon, else the
 * archetype default. Enemies use their own style, tinted red.
 */
export function attackLookOf(data: GameData, state: CombatState, sourceId: string, card?: CardDef): AttackLook {
  const enemy = state.enemies.find((unit) => unit.id === sourceId);
  if (enemy) return { kind: data.enemies[enemy.defId]?.attackStyle ?? "slash", color: ENEMY_COLOR };
  const hero = state.heroes.find((unit) => unit.id === sourceId);
  if (!hero) return { kind: "slash", color: STYLE_COLOR.slash };
  if (card && card.type !== "attack") {
    const color = TAG_COLOR.find(([tag]) => card.tags.includes(tag))?.[1] ?? STYLE_COLOR.spell;
    return { kind: "spell", color };
  }
  const weaponId = state.players[hero.player]?.weapons.find((weapon) => weapon.heroId === hero.defId)?.weaponId;
  const def = data.heroes[hero.defId];
  const kind =
    (weaponId !== undefined ? data.weapons[weaponId]?.attackStyle : undefined) ??
    def?.attackStyle ??
    (def ? ARCHETYPE_KIND[def.archetype] : "slash");
  return { kind, color: STYLE_COLOR[kind] };
}
