import { deckWeapons, weaponCardDef } from "rules";
import type { GameData, Profile, SavedDeck } from "rules";

/** Card definitions occupy slots; their fixed copies build the battle draw pile. */
export function summarizeDeck(data: GameData, deck: SavedDeck, options?: { profile?: Pick<Profile, "weapons">; mode?: "pvp" }) {
  const weapons = deckWeapons(deck);
  const weaponDefs = weapons.map(([heroId, id]) => data.weapons[id] ? weaponCardDef(data, {
    heroId, weaponId: id, refinement: options?.profile?.weapons[id]?.refinement ?? 1,
  }) : undefined);
  const cards = [...deck.cardIds.map((id) => data.cards[id]), ...weaponDefs];
  const curve = Array<number>(9).fill(0);
  let copies = 0;
  let weaponCopies = 0;
  let totalCost = 0;
  for (const card of cards) {
    if (!card) continue;
    copies += card.copies;
    totalCost += card.cost * card.copies;
    const bin = Math.min(8, Math.max(0, Math.floor(card.cost)));
    curve[bin] = curve[bin]! + card.copies;
  }
  for (const card of weaponDefs) weaponCopies += card?.copies ?? 0;
  const heroCounts = Object.fromEntries(deck.heroIds.map((id) => [id, new Set(deck.cardIds.filter((cardId) => data.cards[cardId]?.ownerId === id)).size]));
  // `copies` is the honest draw pile (weapon cards join it, `01` §14.2);
  // `cardCopies` excludes them for the "bản trong chồng bài" counter.
  // Weapons cost no deck slots (`14` §3.1) — `slots` counts card defs only.
  return { slots: deck.cardIds.length, copies, cardCopies: copies - weaponCopies, weaponCopies, averageCost: copies ? totalCost / copies : 0, curve, heroCounts };
}

export function matchesDeckText(query: string, ...values: string[]): boolean {
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().trim();
  const needle = normalize(query);
  return !needle || values.some((value) => normalize(value).includes(needle));
}
