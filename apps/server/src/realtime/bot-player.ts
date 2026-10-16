import { coopBot, coopViewFor, measurePvpPower, nextRandom, pvpBot, starterDeck, viewFor } from "rules";
import type { CoopSide, PvpSide } from "rules";
import type { AppContext } from "../context";
import type { MatchRoom } from "./match-room";

/** Bot "thinking" delay bounds (`17` §5.4). */
const THINK_MIN_MS = 600;
const THINK_RANGE_MS = 600;

/**
 * Drives a bot seat (`17` §5.4): after every event push, if the bot may act, it
 * waits 600–1200 ms (seeded by the match seed so replays/tests are stable) and
 * plays `pvpBot`'s choice on its own redacted view — never the real state.
 */
export class BotPlayer {
  private rngState: number;
  private pending = false;

  constructor(
    private readonly ctx: AppContext,
    private readonly room: MatchRoom,
    private readonly seat: number,
    seed: number,
  ) {
    this.rngState = seed ^ 0x51ab2f;
    room.onPushed = () => this.maybeAct();
    this.maybeAct();
  }

  private maybeAct(): void {
    if (this.pending || !this.room.canAct(this.seat)) return;
    this.pending = true;
    const roll = nextRandom(this.rngState);
    this.rngState = roll.rngState;
    const delay = THINK_MIN_MS + Math.floor(roll.value * THINK_RANGE_MS);
    this.ctx.scheduler.setTimeout(() => {
      this.pending = false;
      if (!this.room.canAct(this.seat)) return;
      const seatState = this.room.seats[this.seat]!;
      const coop = this.room.mode === "coop_practice" || this.room.mode === "coop" || this.room.mode === "coop_private";
      const view = coop ? coopViewFor(this.room.combatState, this.seat) : viewFor(this.room.combatState, this.seat);
      const action = coop
        ? coopBot(this.ctx.data, view, this.seat)
        : pvpBot(this.ctx.data, view, this.seat);
      this.room.botAction(seatState, action);
    }, delay);
  }
}

/**
 * The bot's side for a practice match (`17` §5.4): a random 3-hero team from
 * `trialHeroIds` on the starter deck with random free PvP gear.
 */
export function botPvpSide(ctx: AppContext, seed: number): PvpSide {
  let rngState = seed ^ 0x77cc55;
  const next = () => {
    const roll = nextRandom(rngState);
    rngState = roll.rngState;
    return roll.value;
  };
  const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!;
  const pool = [...ctx.data.pvpConfig.trialHeroIds];
  const heroIds = [0, 1, 2].map(() => pool.splice(Math.floor(next() * pool.length), 1)[0]!) as [string, string, string];
  const heroes: PvpSide["loadout"]["heroes"] = {};
  for (const heroId of heroIds) {
    heroes[heroId] = { constellation: 0, levelUpForm: "base", weaponId: pick(ctx.data.pvpConfig.freeWeaponIds), refinement: 1 };
  }
  return {
    heroIds,
    deckCardIds: starterDeck(ctx.data, heroIds),
    loadout: {
      heroes,
      relics: next() < 0.5 ? [] : [{ id: pick(ctx.data.pvpConfig.freeRelicIds), resonance: 1 }],
      pvp: true,
    },
  };
}

/**
 * Seeded arena fallback. Search at most 32 random full-roster compositions and
 * their finite upgrade ladders; keep the closest score. No simulated turns or
 * timers are involved. Each candidate has a legal six-card pool per hero and
 * distinct carried gear. Stop early within 0.5% of the authoritative target.
 */
export function botMatchedPvpSide(ctx: AppContext, seed: number, targetSide: PvpSide): PvpSide {
  const data = ctx.data;
  const target = measurePvpPower(data, targetSide);
  let rngState = seed ^ 0x6d617463;
  const next = () => {
    const roll = nextRandom(rngState);
    rngState = roll.rngState;
    return roll.value;
  };
  const shuffled = <T>(items: readonly T[]): T[] => {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [result[i], result[j]] = [result[j]!, result[i]!];
    }
    return result;
  };
  let best: PvpSide | undefined;
  let distance = Number.POSITIVE_INFINITY;
  for (let attempt = 0; attempt < 32; attempt++) {
    const heroIds = shuffled(Object.keys(data.heroes)).slice(0, 3) as PvpSide["heroIds"];
    const side: PvpSide = {
      heroIds,
      deckCardIds: heroIds.flatMap((id) => shuffled([...data.heroes[id]!.cardIds, ...data.heroes[id]!.lockedCardIds]).slice(0, data.metaConfig.deckSize / 3)),
      loadout: { heroes: Object.fromEntries(heroIds.map((id) => [id, { constellation: 0, levelUpForm: "base" as const }])), relics: [] },
    };
    const consider = () => {
      const gap = Math.abs(measurePvpPower(data, side) - target);
      if (gap < distance) {
        best = structuredClone(side);
        distance = gap;
      }
    };
    consider();
    if (distance <= target * 0.005) return best!;
    // These milestones enable all combat bonuses; C1/3 unlock card choices
    // already represented by the selected deck, and C6 is presentation only.
    for (const constellation of [2, 4, 6]) {
      for (const id of shuffled(heroIds)) {
        side.loadout.heroes[id]!.constellation = constellation;
        if (constellation >= 5) side.loadout.heroes[id]!.levelUpForm = next() < 0.5 ? "alt" : "base";
        consider();
        if (distance <= target * 0.005) return best!;
      }
    }
    const weapons = shuffled(Object.keys(data.weapons)).slice(0, 3);
    for (let refinement = 1; refinement <= 5; refinement++) {
      for (const [i, id] of heroIds.entries()) {
        const hero = side.loadout.heroes[id]!;
        hero.weaponId = weapons[i]!;
        hero.refinement = refinement;
        consider();
        if (distance <= target * 0.005) return best!;
      }
    }
    const relics = shuffled(Object.keys(data.relics)).slice(0, data.metaConfig.maxRelics);
    for (let resonance = 1; resonance <= 5; resonance++) {
      for (const [i, id] of relics.entries()) {
        side.loadout.relics![i] = { id, resonance };
        consider();
        if (distance <= target * 0.005) return best!;
      }
    }
    if (distance <= target * 0.005) break;
  }
  return best!;
}

/**
 * The bot's side for a co-op practice match (`17` §5.4): three random distinct
 * heroes on their starter cards with no gear — co-op sides are full PvE
 * strength (`17` §8.1), so nothing is normalized.
 */
export function botCoopSide(ctx: AppContext, seed: number): CoopSide {
  let rngState = seed ^ 0x33ee99;
  const next = () => {
    const roll = nextRandom(rngState);
    rngState = roll.rngState;
    return roll.value;
  };
  const pool = Object.keys(ctx.data.heroes);
  const heroIds = [0, 1, 2].map(() => pool.splice(Math.floor(next() * pool.length), 1)[0]!) as [
    string,
    string,
    string,
  ];
  const heroes: CoopSide["loadout"]["heroes"] = {};
  for (const heroId of heroIds) heroes[heroId] = { constellation: 0, levelUpForm: "base" };
  return { heroIds, deckCardIds: starterDeck(ctx.data, heroIds), loadout: { heroes, relics: [] } };
}
