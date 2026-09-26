import type { FastifyRequest } from "fastify";
import type { GameData, Profile } from "rules";
import { parseProfile } from "rules";
import type { z } from "zod";
import { hashToken } from "./auth";
import type { Db } from "./db";

/** Session lifetime after last use (`16` §3). */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** An error answered as `status` with body `{ error, ...extra }` (`16` §2). */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(code);
  }
}

export interface AppDeps {
  db: Db;
  data: GameData;
  /** Milliseconds since the epoch (UTC). */
  clock: () => number;
  /** `bytes` random bytes. */
  random: (bytes: number) => Buffer;
}

/** Everything a route needs: dependencies plus shared helpers. */
export interface AppContext extends AppDeps {
  dataVersion: string;
  parseBody<T>(schema: z.ZodType<T>, body: unknown): T;
  /** The signed-in account for this request; throws 401 otherwise. Slides the session. */
  requireAccount(request: FastifyRequest): number;
  readProfile(accountId: number): { profile: Profile; rev: number };
  /**
   * Applies a pure rule to the account's profile in one transaction (`16` §2):
   * checks `If-Match` against `rev`, turns a rule error into 400, writes `rev + 1`.
   */
  mutateProfile<T extends object>(
    accountId: number,
    request: FastifyRequest,
    change: (profile: Profile) => ProfileChange<T>,
  ): { profile: Profile; rev: number } & T;
}

export type ProfileChange<T> =
  | ({ ok: true; profile: Profile } & T)
  | { ok: false; error: string };

export function createContext(deps: AppDeps, dataVersion: string): AppContext {
  const { db, data, clock } = deps;
  const findSession = db.prepare<[string], { account_id: number; last_used_at: number }>(
    "SELECT account_id, last_used_at FROM sessions WHERE token_hash = ?",
  );
  const touchSession = db.prepare("UPDATE sessions SET last_used_at = ? WHERE token_hash = ?");
  const dropSession = db.prepare("DELETE FROM sessions WHERE token_hash = ?");
  const selectProfile = db.prepare<[number], { profile_json: string; rev: number }>(
    "SELECT profile_json, rev FROM profiles WHERE account_id = ?",
  );
  const writeProfile = db.prepare(
    "UPDATE profiles SET profile_json = ?, rev = ?, updated_at = ? WHERE account_id = ?",
  );

  function readProfile(accountId: number): { profile: Profile; rev: number } {
    const row = selectProfile.get(accountId);
    if (!row) throw new HttpError(404, "unknown account");
    return { profile: parseProfile(data, JSON.parse(row.profile_json)).profile, rev: row.rev };
  }

  function mutateProfile<T extends object>(
    accountId: number,
    request: FastifyRequest,
    change: (profile: Profile) => ProfileChange<T>,
  ): { profile: Profile; rev: number } & T {
    const header = request.headers["if-match"];
    const expected = typeof header === "string" && /^\d+$/.test(header.trim()) ? Number(header.trim()) : null;
    if (expected === null) throw new HttpError(428, "if-match required");
    return db.transaction(() => {
      const current = readProfile(accountId);
      if (current.rev !== expected) throw new HttpError(409, "stale profile", current);
      const result = change(current.profile);
      if (!result.ok) throw new HttpError(400, result.error);
      const { ok: _ok, profile, ...extra } = result;
      const rev = current.rev + 1;
      writeProfile.run(JSON.stringify(profile), rev, clock(), accountId);
      return { ...extra, profile, rev } as unknown as { profile: Profile; rev: number } & T;
    })();
  }

  return {
    ...deps,
    dataVersion,
    parseBody(schema, body) {
      const parsed = schema.safeParse(body);
      if (!parsed.success) throw new HttpError(400, "bad request", { issues: parsed.error.issues });
      return parsed.data;
    },
    requireAccount(request) {
      const header = request.headers.authorization;
      const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
      if (token === "") throw new HttpError(401, "unauthorized");
      const tokenHash = hashToken(token);
      const session = findSession.get(tokenHash);
      if (!session) throw new HttpError(401, "unauthorized");
      const now = clock();
      if (now - session.last_used_at > SESSION_TTL_MS) {
        dropSession.run(tokenHash);
        throw new HttpError(401, "unauthorized");
      }
      touchSession.run(now, tokenHash);
      return session.account_id;
    },
    readProfile,
    mutateProfile,
  };
}
