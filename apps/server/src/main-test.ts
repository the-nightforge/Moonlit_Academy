import { randomBytes } from "node:crypto";
import { loadGameData } from "data";
import { buildApp } from "./app";
import { DEV_CONFIG } from "./config";
import { openTestDb } from "../test/helpers";

/**
 * E2e backend (`pnpm --filter server dev:test`): the production app on an
 * in-memory pg-mem database with a real clock — Playwright drives the same
 * HTTP/wire paths as production while every run starts from a clean schema.
 * `production: false` keeps per-IP rate limits off (`rate-limit.ts`).
 */
const db = await openTestDb();
const app = buildApp({
  db,
  data: loadGameData(),
  clock: () => Date.now(),
  random: (bytes) => randomBytes(bytes),
  config: { ...DEV_CONFIG, host: "127.0.0.1" },
});

// Test-only fixture endpoints — this entrypoint never runs in production.
// `arena.spec.ts` tops Vinh Dự up here instead of writing to Postgres directly,
// since pg-mem is unreachable over the wire protocol.
app.post<{ Body: { username?: string; honor?: number } }>("/__review/honor", async (request) => {
  const { username, honor } = request.body ?? {};
  if (typeof username !== "string" || typeof honor !== "number") return { error: "bad fixture" };
  const account = await db.prepare<[string], { id: number }>("SELECT id FROM accounts WHERE username = ?").get(username);
  if (!account) return { error: "unknown account" };
  const row = await db.prepare<[number], { profile_json: string; rev: number }>(
    "SELECT profile_json, rev FROM profiles WHERE account_id = ?",
  ).get(account.id);
  if (!row) return { error: "no profile" };
  const profile = JSON.parse(row.profile_json) as { currencies: { honor: number } };
  profile.currencies.honor = honor;
  await db.prepare("UPDATE profiles SET profile_json = ?, rev = rev + 1 WHERE account_id = ?")
    .run(JSON.stringify(profile), account.id);
  return { ok: true, rev: row.rev + 1 };
});

const port = Number(process.env.PORT ?? DEV_CONFIG.port);
app.listen({ port, host: "127.0.0.1" }).then(
  (address) => console.log(`test server (pg-mem) listening on ${address}`),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
