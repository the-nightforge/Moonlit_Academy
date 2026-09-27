import { AsyncLocalStorage } from "node:async_hooks";
import postgres from "postgres";

/**
 * Minimal async wrapper over `postgres` (postgres.js). Queries keep `?`
 * placeholders — the wrapper rewrites them to `$1, $2, …` so call sites stay
 * dialect-agnostic and tests can drive a pg-mem backend with the same code.
 *
 * `db.transaction(fn)` runs `fn` on a transaction connection; statements made
 * through this Db inside `fn` bind to that connection automatically via
 * AsyncLocalStorage (`16` §5 — Postgres, was SQLite).
 */
export interface Stmt<TParams extends unknown[] = unknown[], TRow = unknown> {
  get(...params: TParams): Promise<TRow | undefined>;
  all(...params: TParams): Promise<TRow[]>;
  run(...params: TParams): Promise<{ changes: number }>;
}

export interface Db {
  prepare<TParams extends unknown[] = unknown[], TRow = unknown>(query: string): Stmt<TParams, TRow>;
  exec(query: string): Promise<void>;
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/** What a backend must provide: raw parameterized queries + transactions. */
export interface SqlRunner {
  unsafe(query: string, params?: unknown[], opts?: { prepare?: boolean }): Promise<unknown[] & { count?: number }>;
  begin(fn: (tx: SqlRunner) => Promise<unknown>): Promise<unknown>;
  end(): Promise<unknown>;
}

/** Numbered migrations (`16` §5); each runs once, in order, inside a transaction. */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE accounts (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at BIGINT NOT NULL,
    failed_logins BIGINT NOT NULL DEFAULT 0,
    locked_until BIGINT
  );
  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    last_used_at BIGINT NOT NULL
  );
  CREATE TABLE profiles (
    account_id BIGINT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    profile_json TEXT NOT NULL,
    rev BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
  );
  CREATE TABLE runs (
    id TEXT PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    setup_json TEXT NOT NULL,
    data_version TEXT NOT NULL,
    created_at BIGINT NOT NULL,
    finished_at BIGINT,
    result_json TEXT
  );
  CREATE INDEX runs_by_account ON runs(account_id, status);
  `,
  // 2 — phase 4d: loadout snapshot and deck kind on tickets, gacha pull log.
  `
  ALTER TABLE runs ADD COLUMN loadout_json TEXT;
  ALTER TABLE runs ADD COLUMN starter_deck BIGINT NOT NULL DEFAULT 0;
  CREATE TABLE pulls (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    banner_id TEXT NOT NULL,
    count BIGINT NOT NULL,
    seed BIGINT NOT NULL,
    results_json TEXT NOT NULL,
    created_at BIGINT NOT NULL
  );
  CREATE INDEX pulls_by_account ON pulls(account_id, created_at);
  `,
  // 3 — phase 5c: realtime match records (`16` §8.6).
  `
  CREATE TABLE matches (
    id TEXT PRIMARY KEY,
    mode TEXT NOT NULL,
    data_version TEXT NOT NULL,
    seed BIGINT NOT NULL,
    setup_json TEXT NOT NULL,
    actions_json TEXT NOT NULL,
    status TEXT NOT NULL,
    result_json TEXT,
    created_at BIGINT NOT NULL,
    finished_at BIGINT
  );
  CREATE TABLE match_players (
    match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE,
    slot BIGINT NOT NULL,
    result TEXT,
    rating_before BIGINT,
    rating_after BIGINT,
    PRIMARY KEY (match_id, slot)
  );
  CREATE INDEX match_players_by_account ON match_players(account_id, match_id);
  `,
];

/** Rewrites `?` placeholders to `$1..$n`, skipping single-quoted literals. */
export function toPgPlaceholders(query: string): string {
  let index = 0;
  let inString = false;
  let out = "";
  for (let i = 0; i < query.length; i++) {
    const ch = query[i]!;
    if (ch === "'") {
      if (inString && query[i + 1] === "'") {
        out += "''";
        i++;
        continue;
      }
      inString = !inString;
      out += ch;
      continue;
    }
    out += !inString && ch === "?" ? `$${++index}` : ch;
  }
  return out;
}

/** int8 columns arrive as BigInt; every id/timestamp fits a JS number. */
function normalizeRow(row: unknown): unknown {
  if (row === null || typeof row !== "object") return row;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) out[key] = typeof value === "bigint" ? Number(value) : value;
  return out;
}

class PgDb implements Db {
  private readonly txRunner = new AsyncLocalStorage<SqlRunner>();

  constructor(private readonly sql: SqlRunner) {}

  private runner(): SqlRunner {
    return this.txRunner.getStore() ?? this.sql;
  }

  prepare<TParams extends unknown[] = unknown[], TRow = unknown>(query: string): Stmt<TParams, TRow> {
    const pg = toPgPlaceholders(query);
    return {
      get: async (...params: TParams) =>
        normalizeRow((await this.runner().unsafe(pg, params))[0]) as TRow | undefined,
      all: async (...params: TParams) =>
        (await this.runner().unsafe(pg, params)).map((r) => normalizeRow(r) as TRow),
      run: async (...params: TParams) => {
        const res = await this.runner().unsafe(pg, params);
        return { changes: Number(res.count ?? 0) };
      },
    };
  }

  /** Multi-statement DDL (migrations); simple protocol, no params. */
  exec(query: string): Promise<void> {
    return this.runner()
      .unsafe(query, [], { prepare: false })
      .then(() => undefined);
  }

  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    if (this.txRunner.getStore()) return fn(this); // nested: join the open tx
    return this.sql.begin(async (tx) => this.txRunner.run(tx, () => fn(this))) as Promise<T>;
  }

  close(): Promise<void> {
    return this.sql.end().then(() => undefined);
  }
}

/**
 * Opens a Postgres `databaseUrl` (Supabase Supavisor string or a local server)
 * and migrates it. `prepare: false` keeps queries working through the
 * transaction-mode pooler.
 */
export async function openDb(databaseUrl: string): Promise<Db> {
  const sql = postgres(databaseUrl, { prepare: false, max: 8 });
  const db = new PgDb(sql as unknown as SqlRunner);
  await migrate(db);
  return db;
}

/** Wraps any `SqlRunner` (tests pass a pg-mem client) as a `Db`. */
export function dbFromRunner(runner: SqlRunner): Db {
  return new PgDb(runner);
}

/** Runs the numbered migrations once each, then voids stale `playing` matches. */
export async function migrate(db: Db): Promise<void> {
  await db.exec("CREATE TABLE IF NOT EXISTS schema_version (version BIGINT NOT NULL)");
  const row = await db.prepare<[], { version: number }>("SELECT version FROM schema_version").get();
  let version = row?.version ?? 0;
  if (!row) await db.prepare("INSERT INTO schema_version (version) VALUES (?)").run(0);
  for (; version < MIGRATIONS.length; version++) {
    await db.transaction(async (tx) => {
      await tx.exec(MIGRATIONS[version]!);
      await tx.prepare("UPDATE schema_version SET version = ?").run(version + 1);
    });
  }
  // A restart voids matches that were `playing` — no Elo, no rewards (`16` §8.6).
  await db.exec("UPDATE matches SET status = 'void' WHERE status = 'playing'");
}
