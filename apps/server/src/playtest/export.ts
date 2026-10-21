import { createHash } from "node:crypto";
import type { Action } from "rules";
import type { Db } from "../db";
import type { HumanReplay } from "./replay-capture";

/**
 * Offline replay export (`20` §7). Joins stored match/action rows with seat
 * metadata and emits `HumanReplay` records with salted pseudonyms — output
 * never carries usernames, tokens, passwords or raw account ids.
 */

export interface CohortConfig {
  /** Tester cohort label — becomes HumanReplay.groupId. */
  groupId: string;
  /** Salt for pseudonymous participant ids — rotating it breaks cross-export joins. */
  salt: string;
  /** Mode filter; missing = every mode. */
  modes?: readonly ("pve" | "pvp" | "coop" | "run" | "story")[];
  /** Pre-match skill labels per participant pseudonym basis (account id). */
  skillLabels?: Record<number, "novice" | "regular" | "advanced">;
  /** created_at window (ms) for the export; missing = unbounded. */
  since?: number;
  until?: number;
}

/** Salted pseudonym — stable inside one export, unlinkable across salts. */
export function pseudonym(salt: string, accountId: number): string {
  return `pt_${createHash("sha256").update(`${salt}:${accountId}`).digest("hex").slice(0, 16)}`;
}

interface MatchRow {
  id: string;
  mode: string;
  data_version: string;
  seed: number;
  setup_json: string;
  actions_json: string;
  status: string;
  result_json: string | null;
  created_at: number;
  finished_at: number | null;
}

interface MatchPlayerRow {
  match_id: string;
  account_id: number | null;
  slot: number;
  result: string | null;
}

interface ReplayRow {
  id: string;
  mode: string;
  quality: string;
  replay_json: string | null;
  reason: string | null;
  data_hash: string;
  engine_hash: string;
  created_at: number;
}

const MODES: Record<string, HumanReplay["mode"]> = {
  ranked: "pvp",
  private: "pvp",
  practice: "pvp",
  coop: "coop",
  coop_private: "coop",
  coop_practice: "coop",
};

const TERMINATIONS = new Set(["combat", "deckOut", "resign", "timeout", "disconnect", "incomplete"]);

interface MatchResult {
  winner?: number | string;
  reason?: string;
}

function matchReplay(
  row: MatchRow,
  players: MatchPlayerRow[],
  cohort: CohortConfig,
): HumanReplay {
  const seated = [...players].sort((a, b) => a.slot - b.slot);
  // System-substituted entries (forfeit/clock endTurn) carry `system: true` —
  // they stay in the log but are excluded from human action-fit (`20` §7).
  const logged = JSON.parse(row.actions_json) as { player: number; action: Action & { system?: boolean } }[];
  const result = (row.result_json ? JSON.parse(row.result_json) : {}) as MatchResult;
  const finished = row.status === "finished";
  const reason = finished ? (result.reason ?? "combat") : "incomplete";
  return {
    schemaVersion: 1,
    id: `match:${row.id}`,
    groupId: cohort.groupId,
    participantIds: seated.map((p) => (p.account_id === null ? "bot" : pseudonym(cohort.salt, p.account_id))),
    humanSeats: seated.filter((p) => p.account_id !== null).map((p) => p.slot),
    skillLabels: seated.map((p) => (p.account_id === null ? "novice" : (cohort.skillLabels?.[p.account_id] ?? "novice"))),
    mode: MODES[row.mode] ?? "pvp",
    dataHash: row.data_version,
    engineHash: "stored",
    setup: JSON.parse(row.setup_json),
    actions: logged.map((entry) => entry.action),
    actionSources: logged.map((entry) =>
      entry.action.system !== true && seated.find((p) => p.slot === entry.player)?.account_id != null
        ? "human"
        : "system",
    ),
    result: row.result_json ?? row.status,
    termination: (TERMINATIONS.has(reason) ? reason : "combat") as HumanReplay["termination"],
  };
}

export interface ExportQuality {
  exported: number;
  /** Replays dropped for version or completeness — still counted, never hidden. */
  versionRejected: number;
  incomplete: number;
}

export interface ReplayExport {
  replays: HumanReplay[];
  quality: ExportQuality;
}

/**
 * Exports completed multiplayer matches (from `matches`/`match_players`) plus
 * captured PvE/story replays (from `playtest_replays`). `dataHash` filters to
 * the matching data version — mismatches are counted, not silently dropped.
 * Old logs have no timestamps/decision times; none are invented here.
 */
export async function exportTesterReplays(
  db: Db,
  cohort: CohortConfig,
  dataHash: string,
): Promise<ReplayExport> {
  const quality: ExportQuality = { exported: 0, versionRejected: 0, incomplete: 0 };
  const replays: HumanReplay[] = [];

  const matchRows = await db
    .prepare<[], MatchRow>("SELECT * FROM matches WHERE status != 'void' ORDER BY created_at, id")
    .all();
  const wanted = (mode: string, created: number): boolean => {
    if (cohort.modes && !cohort.modes.includes(mode as HumanReplay["mode"])) return false;
    if (cohort.since !== undefined && created < cohort.since) return false;
    if (cohort.until !== undefined && created > cohort.until) return false;
    return true;
  };

  for (const row of matchRows) {
    const mode = MODES[row.mode] ?? "pvp";
    if (!wanted(mode, row.created_at)) continue;
    const players = await db
      .prepare<[string], MatchPlayerRow>("SELECT * FROM match_players WHERE match_id = ?")
      .all(row.id);
    if (row.data_version !== dataHash) {
      quality.versionRejected += 1;
      continue;
    }
    const replay = matchReplay(row, players, cohort);
    if (replay.termination === "incomplete" || replay.humanSeats.length === 0) {
      quality.incomplete += 1;
      continue;
    }
    replays.push(replay);
  }

  const pveRows = await db
    .prepare<[], ReplayRow>("SELECT * FROM playtest_replays ORDER BY created_at, id")
    .all();
  for (const row of pveRows) {
    const mode = row.mode as HumanReplay["mode"];
    if (!wanted(mode, row.created_at)) continue;
    if (row.data_hash !== dataHash) {
      quality.versionRejected += 1;
      continue;
    }
    if (row.quality !== "accepted" || row.replay_json === null) {
      quality.incomplete += 1;
      continue;
    }
    const replay = JSON.parse(row.replay_json) as HumanReplay;
    replay.groupId = cohort.groupId;
    const accounts = replay.participantIds.map((id) =>
      id.startsWith("acct:") ? Number(id.slice(5)) : null,
    );
    replay.participantIds = accounts.map((a) => (a === null ? "bot" : pseudonym(cohort.salt, a)));
    replay.skillLabels = accounts.map((a) => (a === null ? "novice" : (cohort.skillLabels?.[a] ?? "novice")));
    replays.push(replay);
  }

  quality.exported = replays.length;
  return { replays, quality };
}
