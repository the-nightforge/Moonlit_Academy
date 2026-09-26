import type { DeckError, GameData, Profile, SavedDeck } from "../types/index";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Free cards of the three heroes, in team order ("Bộ cơ bản"). */
export function starterDeck(data: GameData, heroIds: readonly string[]): string[] {
  return heroIds.flatMap((heroId) => data.heroes[heroId]?.cardIds ?? []);
}

/** Weapons actually carried by `deck`: [heroId, weaponId] in team order. */
export function deckWeapons(deck: DeckGear): [string, string][] {
  return Object.entries(deck.weapons ?? {}).filter((entry): entry is [string, string] => typeof entry[1] === "string");
}

type DeckGear = { heroIds: readonly string[]; weapons?: Record<string, string | null>; relicIds?: readonly string[] };

export function validateDeck(
  data: GameData,
  profile: Profile,
  deck: DeckGear & { cardIds: readonly string[] },
): DeckError[] {
  const { heroIds, cardIds } = deck;
  if (heroIds.length !== 3 || new Set(heroIds).size !== 3 || heroIds.some((id) => !data.heroes[id])) {
    return [{ code: "badHeroes" }];
  }
  const errors: DeckError[] = [];
  for (const heroId of heroIds) {
    if (!profile.heroes[heroId]) errors.push({ code: "unownedHero", heroId });
  }
  // Each carried weapon takes one of the deck's slots (`14` §3.1).
  const weapons = deckWeapons(deck);
  const size = cardIds.length + weapons.length;
  if (size !== data.metaConfig.deckSize) errors.push({ code: "wrongSize", size });
  const unique = new Set<string>();
  for (const cardId of cardIds) {
    if (unique.has(cardId)) errors.push({ code: "duplicateCard", cardId });
    unique.add(cardId);
  }
  const owned = [...unique].filter((cardId) => {
    const ownerId = data.cards[cardId]?.ownerId;
    const ok = ownerId !== undefined && heroIds.includes(ownerId);
    if (!ok) errors.push({ code: "foreignCard", cardId });
    return ok;
  });
  for (const heroId of heroIds) {
    const count = owned.filter((cardId) => data.cards[cardId]!.ownerId === heroId).length;
    if (count < data.metaConfig.minCardsPerHero) errors.push({ code: "tooFewForHero", heroId, count });
  }
  for (const cardId of owned) {
    const ownerId = data.cards[cardId]!.ownerId!;
    const free = data.heroes[ownerId]!.cardIds.includes(cardId);
    if (!free && !profile.heroes[ownerId]?.unlockedCardIds.includes(cardId)) {
      errors.push({ code: "lockedCard", cardId });
    }
  }
  for (const heroId of Object.keys(deck.weapons ?? {})) {
    if (!heroIds.includes(heroId)) errors.push({ code: "weaponSlot", heroId });
  }
  for (const [, weaponId] of weapons) {
    if (!data.weapons[weaponId] || !profile.weapons[weaponId]) errors.push({ code: "unownedWeapon", weaponId });
  }
  const seenWeapons = new Set<string>();
  for (const [, weaponId] of weapons) {
    if (seenWeapons.has(weaponId)) errors.push({ code: "weaponTwice", weaponId });
    seenWeapons.add(weaponId);
  }
  const relicIds = deck.relicIds ?? [];
  for (const relicId of relicIds) {
    if (!data.relics[relicId] || !profile.relics[relicId]) errors.push({ code: "unownedRelic", relicId });
  }
  const seenRelics = new Set<string>();
  for (const relicId of relicIds) {
    if (seenRelics.has(relicId)) errors.push({ code: "duplicateRelic", relicId });
    seenRelics.add(relicId);
  }
  if (relicIds.length > data.metaConfig.maxRelics) errors.push({ code: "tooManyRelics", count: relicIds.length });
  return errors;
}

export function saveDeck(
  data: GameData,
  profile: Profile,
  draft: SavedDeck,
): { ok: true; profile: Profile; deckId: string } | { ok: false; error: string } {
  const name = draft.name.trim();
  if (name.length === 0 || name.length > 24) return { ok: false, error: "invalid name" };
  const next = clone(profile);
  const deck: SavedDeck = { ...clone(draft), name };
  if (draft.id === "") {
    if (next.decks.length >= data.metaConfig.maxDecks) return { ok: false, error: "too many decks" };
    const highest = Math.max(0, ...next.decks.map((saved) => Number(saved.id.slice(1)) || 0));
    deck.id = `d${highest + 1}`;
    next.decks.push(deck);
    return { ok: true, profile: next, deckId: deck.id };
  }
  const index = next.decks.findIndex((saved) => saved.id === draft.id);
  if (index < 0) return { ok: false, error: "unknown deck" };
  next.decks[index] = deck;
  return { ok: true, profile: next, deckId: deck.id };
}

export function deleteDeck(
  profile: Profile,
  deckId: string,
): { ok: true; profile: Profile } | { ok: false; error: string } {
  if (!profile.decks.some((deck) => deck.id === deckId)) return { ok: false, error: "unknown deck" };
  const next = clone(profile);
  next.decks = next.decks.filter((deck) => deck.id !== deckId);
  return { ok: true, profile: next };
}
