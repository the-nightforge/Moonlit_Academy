import { validateDeck } from "./deck";
import type { GameData, Profile } from "../types/index";

export function firstStoryStageId(data: GameData): string | undefined {
  return Object.values(data.storyArcs)[0]?.stageIds[0];
}

/** Server story progress is the sole entitlement; notices and imported progress cannot grant this. */
export function firstCardChoices(data: GameData, profile: Profile, deckId: string): string[] {
  const first = firstStoryStageId(data), deck = profile.decks.find(deck => deck.id === deckId);
  if (!first || !profile.story.cleared.includes(first) || profile.firstLesson || !deck || validateDeck(data, profile, deck).length) return [];
  return deck.heroIds.flatMap(heroId => {
    const hero = profile.heroes[heroId];
    return hero ? data.heroes[heroId]!.lockedCardIds.filter(id => !hero.unlockedCardIds.includes(id)).slice(0, 2) : [];
  });
}

/** Unlock and saved-deck replacement form one immutable profile mutation. */
export function claimFirstCard(
  data: GameData, profile: Profile, input: { deckId: string; cardId: string; replaceCardId: string },
): { ok: true; profile: Profile } | { ok: false; error: string } {
  const { deckId, cardId, replaceCardId } = input;
  if (!firstCardChoices(data, profile, deckId).includes(cardId)) return { ok: false, error: "first card unavailable" };
  const deck = profile.decks.find(deck => deck.id === deckId)!;
  const owner = data.cards[cardId]?.ownerId;
  const index = deck.cardIds.indexOf(replaceCardId);
  if (!owner || index < 0 || data.cards[replaceCardId]?.ownerId !== owner || deck.cardIds.includes(cardId)) {
    return { ok: false, error: "invalid replacement" };
  }
  const next = JSON.parse(JSON.stringify(profile)) as Profile;
  const progress = next.heroes[owner]!;
  progress.bonusUnlocks += 1;
  progress.unlockedCardIds.push(cardId);
  const updated = next.decks.find(deck => deck.id === deckId)!;
  updated.cardIds[index] = cardId;
  if (validateDeck(data, next, updated).length) return { ok: false, error: "invalid deck" };
  next.firstLesson = { deckId, cardId, replacedCardId: replaceCardId, practiced: false };
  return { ok: true, profile: next };
}
