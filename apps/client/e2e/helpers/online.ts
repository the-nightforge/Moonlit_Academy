import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, type Page } from "@playwright/test";
import { activeSceneKey, applyScenario, clickSceneText, waitForScene, waitIdle, type CombatScenario } from "./combat";

/**
 * Online e2e helpers: the app runs against the pg-mem test server on :8787
 * (`pnpm --filter server dev:test`). Accounts are created through the real
 * `/api/auth/register` endpoint — no shortcuts into private server internals —
 * so these flows exercise the production wire path.
 *
 * `data`/`rules` packages can't be imported here (Playwright's loader cannot
 * parse the JSON imports inside `data`), so the helpers read the two fields
 * they need from `heroes.json` directly.
 */
export const API = "http://localhost:5173";

const HEROES = Object.fromEntries(
  (JSON.parse(
    readFileSync(fileURLToPath(new URL("../../../../packages/data/heroes.json", import.meta.url)), "utf8"),
  ) as { id: string; cardIds: string[] }[]).map((hero) => [hero.id, hero]),
);

let counter = 0;
let version = "";

async function dataVersion(): Promise<string> {
  if (version === "") {
    const health = (await (await fetch(`${API}/api/health`)).json()) as { dataVersion: string };
    version = health.dataVersion;
  }
  return version;
}

interface ApiOptions {
  token?: string;
  rev?: number;
  body?: unknown;
}

async function call<T>(method: string, path: string, options: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = { "x-data-version": await dataVersion() };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  if (options.rev !== undefined) headers["if-match"] = String(options.rev);
  if (options.body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(`${API}/api${path}`, {
    method,
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(`${method} ${path} → ${response.status}: ${body.error ?? "?"}`);
  return body as T;
}

export interface OnlineAccount {
  token: string;
  username: string;
  rev: number;
}

/**
 * Registers a fresh account and saves one legal PvP deck. Seed the returned
 * token into localStorage (see `openSignedIn`) and the app auto-resumes.
 * `rev` moves with every profile mutation.
 */
export async function registerAccount(options: { heroIds?: [string, string, string]; deck?: boolean } = {}): Promise<OnlineAccount> {
  const username = `e2e_${Date.now().toString(36)}_${counter++}`;
  const registered = await call<{ token: string; rev: number }>("POST", "/auth/register", {
    body: { username, password: "trang-sang-8" },
  });
  const account: OnlineAccount = { token: registered.token, username, rev: registered.rev };
  if (options.deck !== false) {
    const heroIds = options.heroIds ?? ["m05", "f04", "m06"];
    const reply = await call<{ rev: number }>("PUT", "/profile/decks", {
      token: account.token,
      rev: account.rev,
      body: {
        // Empty id = new deck; the server assigns `d1`, `d2`, … (`saveDeck`).
        draft: { id: "", name: "E2E", heroIds, cardIds: heroIds.flatMap((id) => HEROES[id]!.cardIds) },
      },
    });
    account.rev = reply.rev;
  }
  return account;
}

/** Boots the app signed in as `account` (token in localStorage → resumeSession). */
export async function openSignedIn(
  page: Page,
  account: Pick<OnlineAccount, "token">,
  options: { fastPlayback?: boolean; timeout?: number } = {},
): Promise<void> {
  await page.bringToFront();
  await page.addInitScript(({ token, fastPlayback }) => {
    localStorage.setItem("vong-nguyet.token", token);
    // Double playback speed + muted: halves online batch time (reducedMotion
    // stays off — visual specs still see the full VFX set).
    if (fastPlayback) {
      localStorage.setItem("vongnguyet.combatSettings.v1", JSON.stringify({ speed: 2, reducedMotion: false, volume: 0 }));
    }
  }, { token: account.token, fastPlayback: options.fastPlayback ?? true });
  await page.goto(API);
  await waitForScene(page, "deck-select", options.timeout);
}

/**
 * Opens any scene on a signed-in session — for pure-visual specs that never
 * need the wire (gacha armory, deck-builder, …). `page.on("route")` mocks in
 * the spec still intercept API calls before the test server sees them.
 */
export async function openScene(page: Page, key: string, account?: OnlineAccount): Promise<void> {
  const acc = account ?? (await registerAccount());
  await openSignedIn(page, acc);
  await page.evaluate((sceneKey) => {
    const handle = (window as any).__vn;
    handle.game.scene.getScenes(true)[0]!.scene.start(sceneKey);
  }, key);
  await expect.poll(async () => activeSceneKey(page), { timeout: 15_000 }).toBe(key);
}

/**
 * Cheap combat-scene entry for purely visual specs: signs in online, then
 * starts `combat` on the session's synthetic state (no server match). Specs
 * that overwrite `scene.state`/`match.view` themselves should use this — they
 * never touch the wire anyway. Real gameplay flows use `setupOnlineCombat`.
 */
export async function openCombatScene(
  page: Page,
  scenario: CombatScenario = "default",
  options: { keepMulligan?: boolean; account?: OnlineAccount } = {},
): Promise<void> {
  const acc = options.account ?? (await registerAccount());
  await openSignedIn(page, acc);
  await page.evaluate(() => {
    const handle = (window as any).__vn;
    handle.game.scene.getScenes(true)[0]!.scene.start("combat");
  });
  await waitForScene(page, "combat");
  await expect
    .poll(async () => page.evaluate(() => (window as any).__vn?.session.state.status), { timeout: 15_000 })
    .toBe("mulligan");
  await waitIdle(page);
  if (options.keepMulligan) return;
  await page.evaluate(() => {
    const handle = (window as any).__vn;
    handle.game.scene.getScene("combat")!.dispatch({ type: "mulligan", instanceIds: [] });
  });
  await waitIdle(page);
  await applyScenario(page, scenario);
}

/**
 * Reaches the combat scene online: signed-in deck-select → arena → "Đấu Tập
 * (máy)" starts a real server-side practice match vs the bot (`17` §5.4); the
 * `match.start` frame routes the client into combat. The mulligan answer is
 * kept so the board settles into the first player turn like the old helper.
 */
export async function setupOnlineCombat(
  page: Page,
  scenario: CombatScenario = "default",
  options: { keepMulligan?: boolean; account?: OnlineAccount } = {},
): Promise<void> {
  const acc = options.account ?? (await registerAccount());
  await openSignedIn(page, acc);
  await clickSceneText(page, "deck-select", "Đấu Trường");
  await expect.poll(async () => activeSceneKey(page), { timeout: 15_000 }).toBe("arena");
  await clickSceneText(page, "arena", "Đấu Tập (máy)");
  await waitForScene(page, "combat");
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const s = (window as any).__vn?.session;
          return (s?.match?.view ?? s?.state)?.status;
        }),
      { timeout: 15_000 },
    )
    .toBe("mulligan");
  // Intro reveal streams over the wire — noticeably slower than offline.
  await waitIdle(page, 30_000);
  if (options.keepMulligan) return;
  await page.evaluate(() => {
    const handle = (window as any).__vn;
    handle.game.scene.getScene("combat")!.dispatch({ type: "mulligan", instanceIds: [] });
  });
  await waitIdle(page, 30_000);
  await applyScenario(page, scenario);
}
