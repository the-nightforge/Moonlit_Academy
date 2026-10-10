import { deckWeapons, weaponCardDef } from "rules";
import type { GameData, Profile, SavedDeck } from "rules";

/** Card definitions occupy slots; their fixed copies build the battle draw pile. */
export function summarizeDeck(data: GameData, deck: SavedDeck, options?: { profile?: Pick<Profile, "weapons">; mode?: "pvp" }) {
  const weapons = deckWeapons(deck);
  const cards = [
    ...deck.cardIds.map((id) => data.cards[id]),
    ...weapons.map(([heroId, id]) => data.weapons[id] ? weaponCardDef(data, {
      heroId, weaponId: id, refinement: options?.mode === "pvp" ? 1 : options?.profile?.weapons[id]?.refinement ?? 1,
    }) : undefined),
  ];
  const curve = Array<number>(9).fill(0);
  let copies = 0;
  let totalCost = 0;
  for (const card of cards) {
    if (!card) continue;
    copies += card.copies;
    totalCost += card.cost * card.copies;
    const bin = Math.min(8, Math.max(0, Math.floor(card.cost)));
    curve[bin] = curve[bin]! + card.copies;
  }
  const heroCounts = Object.fromEntries(deck.heroIds.map((id) => [id, new Set(deck.cardIds.filter((cardId) => data.cards[cardId]?.ownerId === id)).size]));
  return { slots: deck.cardIds.length + weapons.length, copies, averageCost: copies ? totalCost / copies : 0, curve, heroCounts };
}

export function matchesDeckText(query: string, ...values: string[]): boolean {
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().trim();
  const needle = normalize(query);
  return !needle || values.some((value) => normalize(value).includes(needle));
}
