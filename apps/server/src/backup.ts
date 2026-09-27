import { mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { AppContext } from "./context";

/** `db.backup()` cadence and retention (`16` §7.4): every 6 h, keep the 14 newest. */
export const BACKUP_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const BACKUP_KEEP = 14;

const NAME_PREFIX = "vong-nguyet-";
const NAME_SUFFIX = ".db";

/**
 * Schedules rolling `better-sqlite3` backups into `config.backupDir` via the
 * app scheduler. Disabled when `backupDir` is null (dev/test without the env).
 */
export function startBackups(ctx: AppContext): void {
  const dir = ctx.config.backupDir;
  if (dir === null) return;
  mkdirSync(dir, { recursive: true });
  const tick = (): void => {
    const stamp = new Date(ctx.clock()).toISOString().replace(/[:.]/g, "-");
    ctx.db
      .backup(join(dir, `${NAME_PREFIX}${stamp}${NAME_SUFFIX}`))
      .then(() => prune(dir))
      .catch((error: unknown) => console.error("backup failed", error));
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
