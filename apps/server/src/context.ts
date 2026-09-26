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
}

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
    readProfile(accountId) {
      const row = selectProfile.get(accountId);
      if (!row) throw new HttpError(404, "unknown account");
      return { profile: parseProfile(data, JSON.parse(row.profile_json)).profile, rev: row.rev };
    },
  };
}
