/** What the team brings into a run beyond its cards (`14` §12): constellations (4d), gear (4e). */
export interface Loadout {
  heroes: Record<string, {
    constellation: number;
    levelUpForm: "base" | "alt";
    /** Phase 4e; missing = no weapon. */
    weaponId?: string | null;
    /** Tinh Luyện 1–5 of `weaponId`. */
    refinement?: number;
  }>;
  /** Moon relics (phase 4e); missing = none. */
  relics?: { id: string; resonance: number }[];
  /** [GĐ5] Fair Arena loadout: even constellation thresholds and "+" cards stay off (`17` §3.2). */
  pvp?: boolean;
}

export interface SavedDeck {
  id: string;
  name: string;
  heroIds: [string, string, string];
  cardIds: string[];
  /** Phase 4e: heroId → weaponId; missing = no weapon (`14` §3.1). */
  weapons?: Record<string, string | null>;
  /** Phase 4e: moon relics of the team; missing = none. */
  relicIds?: string[];
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
  /** Vinh Dự — honor earned in ranked PvP (`14` §14.3). */
  honor: number;
}

/** Ranked arena record of the profile (`14` §14.1). */
export interface ArenaStats {
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  /** Ranked matches played — picks K in `ratingChange`. */
  rankedGames: number;
  /** Honor granted in the current game day (cap 120, `14` §14.3). */
  honorDay: { dayKey: string; gained: number };
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
  /** Honor shop purchases per period (`14` §14.4). */
  honorShop: { weekKey: string; monthKey: string; bought: Record<string, number>; boughtMonth: Record<string, number> };
  /** Ranked arena record (`14` §14.1); default 1000 / 0-0-0. */
  arena: ArenaStats;
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
  | { code: "lockedCard"; cardId: string }
  | { code: "weaponSlot"; heroId: string }
  | { code: "unownedWeapon"; weaponId: string }
  | { code: "weaponTwice"; weaponId: string }
  | { code: "unownedRelic"; relicId: string }
  | { code: "duplicateRelic"; relicId: string }
  | { code: "tooManyRelics"; count: number };
