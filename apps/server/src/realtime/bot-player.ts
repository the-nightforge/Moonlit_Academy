import { coopBot, coopViewFor, nextRandom, pvpBot, starterDeck, viewFor } from "rules";
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
