import type { DeckError, GameData, Profile, SavedDeck } from "../types/index";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Free cards of the three heroes, in team order ("Bộ cơ bản"). */
export function starterDeck(data: GameData, heroIds: readonly string[]): string[] {
  return heroIds.flatMap((heroId) => data.heroes[heroId]?.cardIds ?? []);
}

export function validateDeck(
  data: GameData,
  profile: Profile,
  deck: { heroIds: readonly string[]; cardIds: readonly string[] },
): DeckError[] {
  const { heroIds, cardIds } = deck;
  if (heroIds.length !== 3 || new Set(heroIds).size !== 3 || heroIds.some((id) => !data.heroes[id])) {
    return [{ code: "badHeroes" }];
  }
  const errors: DeckError[] = [];
  if (cardIds.length !== data.metaConfig.deckSize) errors.push({ code: "wrongSize", size: cardIds.length });
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
