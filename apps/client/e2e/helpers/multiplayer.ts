import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { openSignedIn } from "./online";
import { clickDesign, clickSceneText, waitForScene } from "./combat";

const contexts = new Set<BrowserContext>();

/** Manual browser contexts are not owned by Playwright's automatic page fixture. */
export async function closeMultiplayerPages(): Promise<void> {
  await Promise.all([...contexts].map(context => context.close()));
}

export async function reloadSignedIn(page: Page): Promise<void> {
  await page.bringToFront();
  await page.reload();
  await waitForScene(page, "deck-select");
}

/** Direct API access for multiplayer assertions, including rejected HTTP responses. */
const API = "http://localhost:8787";

const DECK = {
  heroIds: ["m05", "f04", "m06"],
  cardIds: [
    "m05_tran_bac_huyet_tinh", "m05_bat_khuat", "m05_liet_hoa_xung_phong",
    "m05_ho_gam", "m05_bat_dong_nhu_son", "m05_thuong_pha",
    "f04_bach_thao_huong", "f04_linh_chi_ho_the", "f04_hoi_xuan_tan",
    "f04_bang_tam_quyet", "f04_tinh_tam_tra", "f04_nguyet_quang_dan",
    "m06_anh_bo", "m06_am_tien", "m06_doat_menh",
    "m06_phi_tieu", "m06_nguyet_anh_an", "m06_song_nhan_loan_vu",
  ],
};

let version = "";
export async function api(path: string, init: RequestInit & { token?: string } = {}) {
  if (version === "") {
    const health = await fetch(`${API}/api/health`);
    version = ((await health.json()) as { dataVersion: string }).dataVersion;
  }
  const { headers: extra, ...rest } = init;
  const response = await fetch(`${API}${path}`, {
    ...rest,
    headers: {
      "content-type": "application/json",
      "x-data-version": version,
      ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
      ...(extra as Record<string, string> | undefined),
    },
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

export async function registerAccount(name: string): Promise<{ token: string; rev: number }> {
  const res = await api("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ username: name, password: "mk-test-1234" }),
  });
  expect(res.status).toBe(201);
  return { token: res.body.token as string, rev: res.body.rev as number };
}

export async function saveDeck(token: string, rev: number, name = "Đấu"): Promise<void> {
  const res = await api("/api/profile/decks", {
    method: "PUT",
    token,
    headers: { "if-match": String(rev) } as never,
    body: JSON.stringify({ draft: { id: "", name, ...DECK } }),
  });
  expect(res.status).toBe(200);
}

export async function signedInPage(browser: Browser, token: string, logLabel?: string): Promise<Page> {
  const context = await browser.newContext();
  contexts.add(context);
  context.once("close", () => contexts.delete(context));
  const page = await context.newPage();
  if (logLabel) {
    page.on("framenavigated", frame => {
      if (frame === page.mainFrame()) console.info(logLabel + " main-frame navigation", frame.url());
    });
    page.on("pageerror", error => console.info(logLabel + " page error", error.message));
  }
  await openSignedIn(page, { token }, { fastPlayback: false });
  return page;
}

/** Selects the live menu caption and waits for either the lobby or a restored match. */
export async function enterMultiplayer(page: Page, mode: "arena" | "coop-lobby"): Promise<void> {
  await clickSceneText(page, "deck-select", mode === "arena" ? "Đấu Trường" : "Liên Thủ");
  await page.waitForFunction((mode) => {
    const handle = (window as unknown as {
      __vn?: {
        session: { net: { connected: boolean } | null; match: unknown };
        game: { scene: { getScenes(active: boolean): { scene: { key: string } }[] } };
      };
    }).__vn;
    const key = handle?.game.scene.getScenes(true)[0]?.scene.key;
    return (key === mode && handle?.session.net?.connected === true)
      || (key === "combat" && handle?.session.match != null);
  }, mode, { timeout: mode === "arena" ? 90_000 : 60_000 });
  // Landing on a restored match skips the lobby entirely — only a lobby needs
  // the deck pick + art gate (`home-ui-redesign` Tasks 1 & 3): lobbies never
  // auto-pick (`deckIndex` resolves to -1) and match-start sends stay disabled
  // until `assetState` flips to "ready".
  const inLobby = await page.evaluate((sceneKey) => {
    const handle = (window as any).__vn;
    return handle?.game.scene.getScenes(true)[0]?.scene.key === sceneKey;
  }, mode);
  if (!inLobby) return;
  await clickDesign(page, 640, 182); // first saved deck row
  await expect
    .poll(async () => page.evaluate((key) => (window as any).__vn?.game.scene.getScene(key)?.deckIndex, mode), {
      timeout: 15_000,
    })
    .toBeGreaterThanOrEqual(0);
  await expect
    .poll(async () => page.evaluate((key) => (window as any).__vn?.game.scene.getScene(key)?.assetState, mode), {
      timeout: 60_000,
    })
    .toBe("ready");
}

export async function sendMatchAction(page: Page, action: unknown): Promise<void> {
  await page.evaluate(async (act) => {
    const session = (window as unknown as {
      __vn: { session: { match: { sendAction: (a: unknown) => boolean } | null } };
    }).__vn.session;
    // One pending action at a time (`16` §8.3) — wait for the server ack like
    // the real UI's input lock does; a dropped send is retried, not lost.
    for (let i = 0; i < 100; i++) {
      if (session.match === null || session.match.sendAction(act)) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }, action);
  await expect.poll(() => page.evaluate(() =>
    (window as any).__vn.session.match?.pending ?? false,
  ), { timeout: 10_000 }).toBe(false);
}

/** Drain both seats' playback before advancing another shared turn. */
export async function waitForMatchPlayback(...pages: Page[]): Promise<void> {
  for (const page of pages) {
    await page.bringToFront();
    try {
      await expect.poll(() => page.evaluate(() =>
        (window as any).__vn.game.scene.getScene("combat").playback.busy,
      ), { timeout: 60_000 }).toBe(false);
    } catch (error) {
      const diagnostic = await page.evaluate(() => {
        const handle = (window as any).__vn;
        const scene = handle.game.scene.getScene("combat");
        return {
          visibility: document.visibilityState,
          fps: handle.game.loop.actualFps,
          running: scene.playback.running,
          queuedBatches: scene.playback.queue.length,
          renderedStatus: scene.state?.status,
          serverStatus: handle.session.match?.view.status,
          pendingAction: handle.session.match?.pending,
        };
      }).catch(reason => ({ diagnosticError: String(reason) }));
      console.warn("Multiplayer playback did not drain", diagnostic);
      throw error;
    }
  }
}

/** Resolve only the current seat's public choice; opponent choices stay hidden. */
export async function resolveMatchChoice(page: Page): Promise<void> {
  const action = await page.evaluate(() => {
    const match = (window as any).__vn.session.match;
    const pending = match?.view.players[match.you]?.pendingChoice;
    if (!pending) return null;
    return pending.kind === "chooseMoon"
      ? { type: "chooseMoon", offset: 0 }
      : { type: "chooseCard", instanceId: pending.options[0] };
  });
  if (action) await sendMatchAction(page, action);
}
