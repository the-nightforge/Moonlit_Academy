import { starterDeck } from "rules";
import type { GameData, Profile, SavedDeck } from "rules";
import type { Team } from "./session";

/**
 * The deck selection shared by Home, the deck editor and the lobbies: Home and
 * the overlay work over virtual starters plus saved decks, while the lobbies
 * only accept saved ids. `session.selectedDeckId` is the single source —
 * account-scoped, reset on login/logout (`home-ui-redesign` §4).
 */

/** Starter pseudo-deck id — hero order matters (two orders are two teams). */
export function starterDeckId(heroIds: readonly string[]): string {
  return `starter:${heroIds.join("+")}`;
}

/**
 * The overlay's list: one "Bộ cơ bản" per team seen — the current team first,
 * then each saved deck's team — followed by the saved decks. The profile is
 * only read, never mutated.
 */
export function homeDecks(data: GameData, profile: Profile, heroIds: Team): SavedDeck[] {
  const starters = new Map<string, SavedDeck>();
  const addStarter = (team: readonly string[]) => {
    const id = starterDeckId(team);
    if (starters.has(id)) return;
    starters.set(id, { id, name: "Bộ cơ bản", heroIds: [...team] as Team, cardIds: starterDeck(data, team) });
  };
  addStarter(heroIds);
  for (const saved of profile.decks) addStarter(saved.heroIds);
  return [...starters.values(), ...profile.decks];
}

/** The deck Home renders: the selection while its id exists, else the current team's starter. */
export function resolveHomeDeck(data: GameData, profile: Profile, heroIds: Team, selectedDeckId: string | null): SavedDeck {
  const decks = homeDecks(data, profile, heroIds);
  return decks.find((entry) => entry.id === selectedDeckId) ?? decks[0]!;
}

/**
 * Index of the selection inside the lobby's saved-only list, or -1 when the
 * selection is a starter/unknown — the lobbies never auto-pick index 0.
 */
export function savedLobbyDeckIndex(decks: readonly SavedDeck[], selectedDeckId: string | null): number {
  if (selectedDeckId === null) return -1;
  return decks.findIndex((deck) => deck.id === selectedDeckId);
}
