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
const app = buildApp({
  db: await openTestDb(),
  data: loadGameData(),
  clock: () => Date.now(),
  random: (bytes) => randomBytes(bytes),
  config: { ...DEV_CONFIG, host: "127.0.0.1" },
});

const port = Number(process.env.PORT ?? DEV_CONFIG.port);
app.listen({ port, host: "127.0.0.1" }).then(
  (address) => console.log(`test server (pg-mem) listening on ${address}`),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
