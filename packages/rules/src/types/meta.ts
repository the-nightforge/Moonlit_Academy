export interface SavedDeck {
  id: string;
  name: string;
  heroIds: [string, string, string];
  cardIds: string[];
}

export interface Profile {
  version: 1;
  heroes: Record<string, { xp: number; unlockedCardIds: string[] }>;
  decks: SavedDeck[];
}

export interface RunResult {
  heroIds: [string, string, string];
  floorReached: number;
  won: boolean;
  /** defId → combats in which the hero leveled up. */
  heroLevelUps: Record<string, number>;
}

export interface MasteryGain {
  heroId: string;
  xp: number;
  levelBefore: number;
  levelAfter: number;
}

export type DeckError =
  | { code: "badHeroes" }
  | { code: "wrongSize"; size: number }
  | { code: "duplicateCard"; cardId: string }
  | { code: "foreignCard"; cardId: string }
  | { code: "tooFewForHero"; heroId: string; count: number }
  | { code: "lockedCard"; cardId: string };
