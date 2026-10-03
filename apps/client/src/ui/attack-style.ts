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
  fan: 0xb8f0e0,
  ink: 0xa8c0ff,
  music: 0x8fe8d8,
  ribbon: 0x9fc8ff,
  fire: 0xc080ff,
  star: 0xcfe6ff,
  moon: 0xf4d35e,
  talisman: 0xffd27a,
  blood: 0xd03a4a,
  spell: 0xf4d35e,
};

/** Physical weapons swing only on attack cards; skills cast a spell instead. */
const WEAPON_STYLES = new Set<AttackKind>(["slash", "spear", "darts", "bow"]);

/** Heroes without a lore weapon fight like their archetype. */
const ARCHETYPE_KIND: Record<Archetype, AttackKind> = {
  vanguard: "slash",
  striker: "slash",
  support: "herb",
  controller: "spell",
  specialist: "spell",
};

/** Linh Thú hit styles — summons carry no `attackStyle` field (`01` §17). */
const SUMMON_STYLE: Record<string, AttackKind> = {
  tho_ngoc: "moon",
  tho_ngoc_thuc_tinh: "moon",
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
 * Look of a hit from `sourceId`. `card` is the card being played, if any.
 * Attack cards (and card-less hits) use the equipped weapon's style, else the
 * hero's lore style, else the archetype default. Skill cards use the hero's
 * lore style when it is a casting one (fan, ink, moon…); a physical weapon
 * does not swing for a skill, which casts a spell colored by tag instead.
 * Enemies use their own style, tinted red.
 */
export function attackLookOf(data: GameData, state: CombatState, sourceId: string, card?: CardDef): AttackLook {
  const enemy = state.enemies.find((unit) => unit.id === sourceId);
  if (enemy) return { kind: data.enemies[enemy.defId]?.attackStyle ?? "slash", color: ENEMY_COLOR };
  const summon = state.summons?.find((unit) => unit.id === sourceId);
  if (summon) {
    const kind = SUMMON_STYLE[summon.summonId] ?? "slash";
    return { kind, color: STYLE_COLOR[kind] };
  }
  const hero = state.heroes.find((unit) => unit.id === sourceId);
  if (!hero) return { kind: "slash", color: STYLE_COLOR.slash };
  const def = data.heroes[hero.defId];
  const lore: AttackKind = def?.attackStyle ?? (def ? ARCHETYPE_KIND[def.archetype] : "slash");
  if (card && card.type !== "attack") {
    if (!WEAPON_STYLES.has(lore) && lore !== "spell") return { kind: lore, color: STYLE_COLOR[lore] };
    return { kind: "spell", color: cardColorOf(card) };
  }
  const weaponId = state.players[hero.player]?.weapons.find((weapon) => weapon.heroId === hero.defId)?.weaponId;
  const kind = (weaponId !== undefined ? data.weapons[weaponId]?.attackStyle : undefined) ?? lore;
  return { kind, color: STYLE_COLOR[kind] };
}

/** Emblem icon of a card (a `ui:` texture), by its first matching tag. */
const TAG_ICON: [CardTag, string][] = [
  ["forbidden", "ui:moon_blood"],
  ["moon", "ui:moon_full"],
  ["scheme", "ui:seal"],
  ["control", "ui:status_freeze"],
  ["ward", "ui:shield"],
  ["harmony", "ui:status_charm"],
  ["heal", "ui:status_regen"],
  ["assassin", "ui:status_stealth"],
];

export function cardIconOf(card: CardDef): string {
  return TAG_ICON.find(([tag]) => card.tags.includes(tag))?.[1] ?? (card.type === "attack" ? "ui:intent_attack" : "ui:intent_special");
}

/** Glow of a card: its first tag's color (see TAG_COLOR order), else moon gold. */
export function cardColorOf(card: CardDef): number {
  return TAG_COLOR.find(([tag]) => card.tags.includes(tag))?.[1] ?? STYLE_COLOR.spell;
}
