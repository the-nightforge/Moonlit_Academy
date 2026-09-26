import { defineConfig } from "@playwright/test";

/**
 * Two-process e2e: the Vite dev server proxies `/api` (incl. `/api/ws`) to the
 * Fastify server. Run with both processes up: the built server on :8787
 * (`pnpm --filter server build && pnpm --filter server start`) and Vite on
 * :5173 (`pnpm --filter client dev`), then `npx playwright test` here.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 180_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:5173",
    viewport: { width: 1280, height: 800 },
  },
});
