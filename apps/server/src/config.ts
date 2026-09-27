import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.string().optional(),
  PORT: z.string().regex(/^\d+$/, "PORT must be a number").optional(),
  HOST: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  TRUST_PROXY: z.string().optional(),
  ALLOWED_ORIGINS: z.string().optional(),
  BACKUP_DIR: z.string().optional(),
});

export interface ServerConfig {
  production: boolean;
  port: number;
  host: string;
  /** Postgres connection string (Supabase Supavisor / local server); "" in tests. */
  databaseUrl: string;
  /** Trust `X-Forwarded-For` from the reverse proxy for `request.ip` (`16` §7.1). */
  trustProxy: boolean;
  /** Allowed `Origin` header values; empty disables the check (dev/test). */
  allowedOrigins: string[];
  /** `pg_dump` target directory; null disables scheduled backups. */
  backupDir: string | null;
}

/** Development/test defaults: no Origin check, no backups, real loopback only. */
export const DEV_CONFIG: ServerConfig = {
  production: false,
  port: 8787,
  host: "127.0.0.1",
  databaseUrl: "",
  trustProxy: false,
  allowedOrigins: [],
  backupDir: null,
};

/**
 * Reads and validates process env (`16` §7.1). `DATABASE_URL` is required in
 * every mode (dev uses a dev Supabase project, see `deploy/vercel-render.md`);
 * production additionally requires `TRUST_PROXY=1` and `ALLOWED_ORIGINS` — a
 * missing variable throws a clear error before the server opens its port.
 * `BACKUP_DIR` stays optional: unset it and Supabase's managed backups cover
 * the database (PaaS images like Render's don't ship `pg_dump`).
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`invalid env: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  }
  const e = parsed.data;
  const production = e.NODE_ENV === "production";
  const missing = [...(!e.DATABASE_URL ? ["DATABASE_URL"] : [])];
  if (production) {
    missing.push(
      ...(e.TRUST_PROXY !== "1" ? ["TRUST_PROXY=1"] : []),
      ...(!e.ALLOWED_ORIGINS ? ["ALLOWED_ORIGINS"] : []),
    );
  }
  if (missing.length > 0) throw new Error(`missing ${production ? "production " : ""}env: ${missing.join(", ")}`);
  return {
    production,
    port: e.PORT ? Number(e.PORT) : DEV_CONFIG.port,
    // PaaS (Render/Railway/Fly) health checks need a public bind; dev stays loopback.
    host: e.HOST ?? (production ? "0.0.0.0" : DEV_CONFIG.host),
    databaseUrl: e.DATABASE_URL ?? DEV_CONFIG.databaseUrl,
    trustProxy: e.TRUST_PROXY === "1" || e.TRUST_PROXY === "true",
    allowedOrigins: (e.ALLOWED_ORIGINS ?? "").split(",").map((o) => o.trim()).filter((o) => o !== ""),
    backupDir: e.BACKUP_DIR && e.BACKUP_DIR !== "" ? e.BACKUP_DIR : null,
  };
}
