import type { Action, RunAction } from "rules";
import type { Db } from "../db";

/**
 * One validated human playtest replay (`20` §7 — tester evidence collection).
 * Stored in `playtest_replays` after authoritative server replay validation;
 * exported offline with salted pseudonyms — never real account identifiers.
 */
export interface HumanReplay {
  schemaVersion: 1;
  /** Unique replay id — `run:<id>` / `story:<id>` / `match:<id>`. */
  id: string;
  /** Tester group (cohort) the participant was recruited under. */
  groupId: string;
  /** Salted pseudonyms in seat order — joinable within one export, stable. */
  participantIds: readonly string[];
  /** Seat indexes driven by humans (bot/system seats excluded). */
  humanSeats: readonly number[];
  /** Pre-match skill labels collected before games were played; `[]` = unlabeled. */
  skillLabels: readonly ("novice" | "regular" | "advanced")[];
  mode: "pve" | "pvp" | "coop" | "run" | "story";
  /** Version hashes pinned at capture — exports reject mismatched versions. */
  dataHash: string;
  engineHash: string;
  /** Full setup including seed — offline-only, never in API responses. */
  setup: unknown;
  actions: readonly (Action | RunAction)[];
  actionSources: readonly ("human" | "bot" | "system")[];
  result: string;
  termination: "combat" | "resign" | "timeout" | "disconnect" | "incomplete";
}

/** Structural check — a replay enters the accepted set only when complete. */
export function isValidHumanReplay(replay: HumanReplay): string | null {
  if (replay.schemaVersion !== 1) return "schemaVersion ≠ 1";
  if (!replay.id || !replay.groupId) return "missing id/groupId";
  if (replay.actions.length === 0) return "empty action log";
  if (replay.actionSources.length !== replay.actions.length) return "actionSources length mismatch";
  if (replay.humanSeats.length === 0) return "no human seat";
  if (replay.participantIds.length === 0) return "no participants";
  if (replay.termination === "incomplete") return "incomplete replay";
  return null;
}

export interface CaptureResult {
  stored: boolean;
  quality: "accepted" | "rejected";
  reason: string | null;
}

/**
 * Writes one validated replay. Duplicates collapse on the primary key — a
 * retried finish stores exactly one row. A failed validation stores nothing
 * accepted; the reason row keeps collection-quality totals honest.
 */
export async function captureValidatedReplay(
  db: Db,
  source: "run" | "story",
  accountId: number,
  replay: HumanReplay,
  clock: number,
): Promise<CaptureResult> {
  const reason = isValidHumanReplay(replay);
  const insert = db.prepare(
    "INSERT INTO playtest_replays (id, source, account_id, mode, quality, data_hash, engine_hash, replay_json, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING",
  );
  if (reason !== null) {
    await insert.run(replay.id, source, accountId, replay.mode, "rejected", replay.dataHash, replay.engineHash, null, reason, clock);
    return { stored: false, quality: "rejected", reason };
  }
  const written = await insert.run(
    replay.id, source, accountId, replay.mode, "accepted",
    replay.dataHash, replay.engineHash, JSON.stringify(replay), null, clock,
  );
  return { stored: written.changes === 1, quality: "accepted", reason: null };
}
