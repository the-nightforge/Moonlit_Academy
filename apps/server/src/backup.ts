import { spawn } from "node:child_process";
import { mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { AppContext } from "./context";

/** `pg_dump` cadence and retention (`16` §7.4): every 6 h, keep the 14 newest. */
export const BACKUP_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const BACKUP_KEEP = 14;

const NAME_PREFIX = "vong-nguyet-";
const NAME_SUFFIX = ".sql";

/**
 * Schedules rolling `pg_dump` backups into `config.backupDir` via the app
 * scheduler. Disabled when `backupDir` is null (dev/test without the env).
 * `pg_dump` must be on PATH — on hosts without it the failure is logged once
 * per interval, never fatal (Supabase keeps its own backups regardless).
 */
export function startBackups(ctx: AppContext): void {
  const dir = ctx.config.backupDir;
  if (dir === null) return;
  mkdirSync(dir, { recursive: true });
  const tick = (): void => {
    const stamp = new Date(ctx.clock()).toISOString().replace(/[:.]/g, "-");
    const target = join(dir, `${NAME_PREFIX}${stamp}${NAME_SUFFIX}`);
    const child = spawn("pg_dump", ["--file", target, "--format", "plain", ctx.config.databaseUrl], {
      stdio: "ignore",
    });
    child.on("error", (error: unknown) => console.error("backup failed", error));
    child.on("exit", (code) => {
      if (code === 0) prune(dir);
      else console.error(`backup failed: pg_dump exited ${code}`);
    });
    ctx.scheduler.setTimeout(tick, BACKUP_INTERVAL_MS);
  };
  ctx.scheduler.setTimeout(tick, BACKUP_INTERVAL_MS);
}

/** Deletes every backup past the `BACKUP_KEEP` newest (names sort by time). */
function prune(dir: string): void {
  const names = readdirSync(dir)
    .filter((name) => name.startsWith(NAME_PREFIX) && name.endsWith(NAME_SUFFIX))
    .sort();
  for (const stale of names.slice(0, Math.max(0, names.length - BACKUP_KEEP))) {
    try {
      unlinkSync(join(dir, stale));
    } catch {
      // A file being copied away is not worth crashing the server over.
    }
  }
}
