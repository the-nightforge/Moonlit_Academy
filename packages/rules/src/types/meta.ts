export interface SavedDeck {
  id: string;
  name: string;
  heroIds: [string, string, string];
  cardIds: string[];
}

export interface HeroProgress {
  xp: number;
  unlockedCardIds: string[];
  /** Tinh Hồn 0–6 (phase 4d). */
  constellation: number;
  /** Extra unlocks granted by Tinh Hồn 1/3 (phase 4d). */
  bonusUnlocks: number;
  /** Tinh Hồn 5 choice (phase 4d). */
  levelUpForm: "base" | "alt";
}

export interface ProfileCurrencies {
  moonJade: number;
  moonStar: number;
  darkIron: number;
  moonDust: number;
}

/** Counters of one day or week (`14` §7). */
export interface PeriodCounters {
  runsFinished: number;
  runsWon: number;
  floorsReached: number;
  bossKills: number;
  gachaPulls: number;
  cardsUnlocked: number;
  /** Different heroes used in finished runs of the period. */
  heroesUsed: string[];
}

export interface MissionState {
  dayKey: string;
  weekKey: string;
  daily: PeriodCounters;
  weekly: PeriodCounters;
  /** Missions claimed in their current period. */
  claimed: string[];
}

/** Saved account progress (`14` §2.1). Version 1 was the phase 4b localStorage profile. */
export interface Profile {
  version: 2;
  /** Owned heroes only. */
  heroes: Record<string, HeroProgress>;
  decks: SavedDeck[];
  currencies: ProfileCurrencies;
  weapons: Record<string, { refinement: number }>;
  relics: Record<string, { resonance: number }>;
  pity: Record<string, { sinceEpic: number; sinceLegendary: number }>;
  missions: MissionState;
  /** Moon star shop purchases this week (`14` §11). */
  shop: { weekKey: string; bought: Record<string, number> };
  achievements: string[];
  stats: Record<string, number>;
  flags: { starterGiftClaimed: boolean; localImportDone: boolean };
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
  | { code: "unownedHero"; heroId: string }
  | { code: "wrongSize"; size: number }
  | { code: "duplicateCard"; cardId: string }
  | { code: "foreignCard"; cardId: string }
  | { code: "tooFewForHero"; heroId: string; count: number }
  | { code: "lockedCard"; cardId: string };
