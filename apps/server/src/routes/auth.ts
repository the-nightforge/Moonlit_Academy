import type { FastifyInstance } from "fastify";
import { createProfile } from "rules";
import { z } from "zod";
import {
  USERNAME_PATTERN, hashPassword, hashToken, isValidPassword, newToken, normalizeUsername, verifyPassword,
} from "../auth";
import { HttpError, type AppContext } from "../context";

/** Wrong passwords in a row before an account is locked, and for how long (`16` §3). */
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MS = 5 * 60 * 1000;

const credentials = z.object({ username: z.string(), password: z.string() });

interface AccountRow {
  id: number;
  password_hash: string;
  failed_logins: number;
  locked_until: number | null;
}

export function registerAuthRoutes(app: FastifyInstance, ctx: AppContext): void {
  const { db, data, clock, random } = ctx;
  const insertAccount = db.prepare(
    "INSERT INTO accounts (username, password_hash, created_at) VALUES (?, ?, ?)",
  );
  const insertProfile = db.prepare(
    "INSERT INTO profiles (account_id, profile_json, rev, updated_at) VALUES (?, ?, 1, ?)",
  );
  const insertSession = db.prepare("INSERT INTO sessions (token_hash, account_id, last_used_at) VALUES (?, ?, ?)");
  const findAccount = db.prepare<[string], AccountRow>(
    "SELECT id, password_hash, failed_logins, locked_until FROM accounts WHERE username = ?",
  );
  const setFailures = db.prepare("UPDATE accounts SET failed_logins = ?, locked_until = ? WHERE id = ?");
  const deleteSession = db.prepare("DELETE FROM sessions WHERE token_hash = ?");

  function openSession(accountId: number): string {
    const { token, tokenHash } = newToken(random);
    insertSession.run(tokenHash, accountId, clock());
    return token;
  }

  app.post("/api/auth/register", async (request, reply) => {
    const body = ctx.parseBody(credentials, request.body);
    const username = normalizeUsername(body.username);
    if (!USERNAME_PATTERN.test(username)) throw new HttpError(400, "invalid username");
    if (!isValidPassword(body.password)) throw new HttpError(400, "invalid password");
    if (findAccount.get(username)) throw new HttpError(409, "username taken");
    const passwordHash = await hashPassword(body.password, random);
    const profile = createProfile(data);
    let token: string;
    try {
      token = db.transaction(() => {
        const now = clock();
        const accountId = Number(insertAccount.run(username, passwordHash, now).lastInsertRowid);
        insertProfile.run(accountId, JSON.stringify(profile), now);
        return openSession(accountId);
      })();
    } catch (error) {
      // Another request took the name while the password was hashing.
      if ((error as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE") throw new HttpError(409, "username taken");
      throw error;
    }
    return reply.code(201).send({ token, profile, rev: 1 });
  });

  app.post("/api/auth/login", async (request) => {
    const body = ctx.parseBody(credentials, request.body);
    const account = findAccount.get(normalizeUsername(body.username));
    if (!account) throw new HttpError(401, "invalid credentials");
    const now = clock();
    if (account.locked_until !== null && now < account.locked_until) {
      throw new HttpError(429, "too many attempts", { retryAfterMs: account.locked_until - now });
    }
    if (!(await verifyPassword(body.password, account.password_hash))) {
      const failures = account.failed_logins + 1;
      if (failures >= MAX_FAILED_LOGINS) setFailures.run(0, now + LOCK_MS, account.id);
      else setFailures.run(failures, null, account.id);
      throw new HttpError(401, "invalid credentials");
    }
    setFailures.run(0, null, account.id);
    const token = openSession(account.id);
    return { token, ...ctx.readProfile(account.id) };
  });

  app.post("/api/auth/logout", async (request, reply) => {
    ctx.requireAccount(request);
    const token = request.headers.authorization!.slice("Bearer ".length).trim();
    deleteSession.run(hashToken(token));
    return reply.code(204).send();
  });
}
