import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.string().optional(),
  PORT: z.string().regex(/^\d+$/, "PORT must be a number").optional(),
  HOST: z.string().optional(),
  DB_PATH: z.string().optional(),
  TRUST_PROXY: z.string().optional(),
  ALLOWED_ORIGINS: z.string().optional(),
  BACKUP_DIR: z.string().optional(),
});

export interface ServerConfig {
  production: boolean;
  port: number;
  host: string;
  dbPath: string;
  /** Trust `X-Forwarded-For` from the reverse proxy for `request.ip` (`16` §7.1). */
  trustProxy: boolean;
  /** Allowed `Origin` header values; empty disables the check (dev/test). */
  allowedOrigins: string[];
  /** `db.backup()` target directory; null disables scheduled backups. */
  backupDir: string | null;
}

/** Development/test defaults: no Origin check, no backups, real loopback only. */
export const DEV_CONFIG: ServerConfig = {
  production: false,
  port: 8787,
  host: "127.0.0.1",
  dbPath: "./data/vong-nguyet.db",
  trustProxy: false,
  allowedOrigins: [],
  backupDir: null,
};

/**
 * Reads and validates process env (`16` §7.1). Production requires `DB_PATH`,
 * `TRUST_PROXY=1`, `ALLOWED_ORIGINS` and `BACKUP_DIR` — a missing variable
 * throws a clear error before the server opens its port.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`invalid env: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  }
  const e = parsed.data;
  const production = e.NODE_ENV === "production";
  if (production) {
    const missing = [
      ...(!e.DB_PATH ? ["DB_PATH"] : []),
      ...(e.TRUST_PROXY !== "1" ? ["TRUST_PROXY=1"] : []),
      ...(!e.ALLOWED_ORIGINS ? ["ALLOWED_ORIGINS"] : []),
      ...(!e.BACKUP_DIR ? ["BACKUP_DIR"] : []),
    ];
    if (missing.length > 0) throw new Error(`missing production env: ${missing.join(", ")}`);
  }
  return {
    production,
    port: e.PORT ? Number(e.PORT) : DEV_CONFIG.port,
    // PaaS (Render/Railway/Fly) health checks need a public bind; dev stays loopback.
    host: e.HOST ?? (production ? "0.0.0.0" : DEV_CONFIG.host),
    dbPath: e.DB_PATH ?? DEV_CONFIG.dbPath,
    trustProxy: e.TRUST_PROXY === "1" || e.TRUST_PROXY === "true",
    allowedOrigins: (e.ALLOWED_ORIGINS ?? "").split(",").map((o) => o.trim()).filter((o) => o !== ""),
    backupDir: e.BACKUP_DIR && e.BACKUP_DIR !== "" ? e.BACKUP_DIR : null,
  };
}
