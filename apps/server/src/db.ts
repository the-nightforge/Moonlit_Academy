import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";

export type Db = Database.Database;

/** Numbered migrations (`16` §5); each runs once, in order, inside a transaction. */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE accounts (
    id INTEGER PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    failed_logins INTEGER NOT NULL DEFAULT 0,
    locked_until INTEGER
  );
  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    last_used_at INTEGER NOT NULL
  );
  CREATE TABLE profiles (
    account_id INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    profile_json TEXT NOT NULL,
    rev INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE runs (
    id TEXT PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    setup_json TEXT NOT NULL,
    data_version TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    finished_at INTEGER,
    result_json TEXT
  );
  CREATE INDEX runs_by_account ON runs(account_id, status);
  `,
  // 2 — phase 4d: loadout snapshot and deck kind on tickets, gacha pull log.
  `
  ALTER TABLE runs ADD COLUMN loadout_json TEXT;
  ALTER TABLE runs ADD COLUMN starter_deck INTEGER NOT NULL DEFAULT 0;
  CREATE TABLE pulls (
    id INTEGER PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    banner_id TEXT NOT NULL,
    count INTEGER NOT NULL,
    seed INTEGER NOT NULL,
    results_json TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX pulls_by_account ON pulls(account_id, created_at);
  `,
  // 3 — phase 5c: realtime match records (`16` §8.6).
  `
  CREATE TABLE matches (
    id TEXT PRIMARY KEY,
    mode TEXT NOT NULL,
    data_version TEXT NOT NULL,
    seed INTEGER NOT NULL,
    setup_json TEXT NOT NULL,
    actions_json TEXT NOT NULL,
    status TEXT NOT NULL,
    result_json TEXT,
    created_at INTEGER NOT NULL,
    finished_at INTEGER
  );
  CREATE TABLE match_players (
    match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
    slot INTEGER NOT NULL,
    result TEXT,
    rating_before INTEGER,
    rating_after INTEGER,
    PRIMARY KEY (match_id, slot)
  );
  CREATE INDEX match_players_by_account ON match_players(account_id, match_id);
  `,
];

/** Opens (or creates) the database at `path` (":memory:" for tests) and migrates it. */
export function openDb(path: string): Db {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("foreign_keys = ON");
  if (path !== ":memory:") db.pragma("journal_mode = WAL");
  db.exec("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)");
  const row = db.prepare("SELECT version FROM schema_version").get() as { version: number } | undefined;
  let version = row?.version ?? 0;
  if (!row) db.prepare("INSERT INTO schema_version (version) VALUES (0)").run();
  for (; version < MIGRATIONS.length; version++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[version]!);
      db.prepare("UPDATE schema_version SET version = ?").run(version + 1);
    })();
  }
  // A restart voids matches that were `playing` — no Elo, no rewards (`16` §8.6).
  db.exec("UPDATE matches SET status = 'void' WHERE status = 'playing'");
  return db;
}
