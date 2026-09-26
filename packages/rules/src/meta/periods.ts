import type { GameData } from "../types/index";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** The game day of `now`: days start at `resetUtcHour` UTC (04:00 in Vietnam) (`14` §6). */
function gameDate(data: GameData, now: number): Date {
  return new Date(now + (24 - data.economyConfig.resetUtcHour) * HOUR_MS);
}

/** "YYYY-MM-DD" of the game day containing `now`. */
export function dayKey(data: GameData, now: number): string {
  return gameDate(data, now).toISOString().slice(0, 10);
}

/** "YYYY-Www": ISO 8601 week (Monday first) of the game day containing `now`. */
export function weekKey(data: GameData, now: number): string {
  const date = gameDate(data, now);
  const day = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const weekday = (new Date(day).getUTCDay() + 6) % 7; // Monday = 0
  const thursday = new Date(day + (3 - weekday) * DAY_MS);
  const year = thursday.getUTCFullYear();
  const week = 1 + Math.floor((thursday.getTime() - Date.UTC(year, 0, 1)) / DAY_MS / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}
