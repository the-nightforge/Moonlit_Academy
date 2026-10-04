import { expect, test, type Browser, type Page } from "@playwright/test";
import { clickSceneText } from "./helpers/combat";

/**
 * `16` §8.4 e2e — a match settlement outlives the combat scene: resigning in a
 * practice match, leaving for the lobby, and a duplicated terminal frame.
 * Canvas UI is not DOM-readable, so the test probes `window.__vn` (main.ts dev
 * handle); `session.registry` internals are runtime-visible despite `private`.
 */
const API = "http://localhost:8787";
const APP = "http://localhost:5173";

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
async function api(path: string, init: RequestInit & { token?: string } = {}) {
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

async function registerAccount(name: string): Promise<{ token: string; rev: number }> {
  const res = await api("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ username: name, password: "mk-test-1234" }),
  });
  expect(res.status).toBe(201);
  return { token: res.body.token as string, rev: res.body.rev as number };
}

async function saveDeck(token: string, rev: number): Promise<void> {
  const res = await api("/api/profile/decks", {
    method: "PUT",
    token,
    headers: { "if-match": String(rev) } as never,
    body: JSON.stringify({ draft: { id: "", name: "Đấu", ...DECK } }),
  });
  expect(res.status).toBe(200);
}

async function signedInPage(browser: Browser, token: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript((value) => localStorage.setItem("vong-nguyet.token", value), token);
  await page.goto(APP);
  await page.waitForFunction(() => {
    const vn = (window as unknown as { __vn?: { game: { scene: { getScenes: (b: boolean) => { scene: { key: string } }[] } } } }).__vn;
    return vn?.game.scene.getScenes(true)[0]?.scene.key === "deck-select";
  }, undefined, { timeout: 30_000 });
  return page;
}

async function clickDesign(page: Page, x: number, y: number): Promise<void> {
  const box = await page.locator("canvas").boundingBox();
  const s = Math.min(box!.width / 1280, box!.height / 720);
  const left = box!.x + (box!.width - 1280 * s) / 2;
  const top = box!.y + (box!.height - 720 * s) / 2;
  await page.mouse.click(left + x * s, top + y * s);
}

async function sceneKey(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      (window as unknown as { __vn?: { game: { scene: { getScenes: (b: boolean) => { scene: { key: string } }[] } } } })
        .__vn?.game.scene.getScenes(true)[0]?.scene.key ?? "",
  );
}

interface VnSession {
  match: { matchId: string; ended: unknown } | null;
  notices: string[];
}

// The session object serializes fine except Maps/Sets — probe those in-page.
const session = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as { __vn: { session: VnSession & { registry: unknown } } }).__vn.session;
    return { match: s.match === null ? null : { matchId: s.match.matchId, ended: s.match.ended }, notices: s.notices };
  });

const tombstoned = (page: Page, matchId: string) =>
  page.evaluate((id) => {
    const registry = (window as unknown as {
      __vn: { session: { registry: { tombstones: Set<string> } | null } };
    }).__vn.session.registry;
    return registry !== null && registry.tombstones.has(id);
  }, matchId);

test("settlement sống ngoài combat: rời trận vẫn xử lý, frame lặp bị nuốt", async ({ browser }) => {
  const acc = await registerAccount(`e2e_s_${Date.now()}`);
  await saveDeck(acc.token, acc.rev);
  const page = await signedInPage(browser, acc.token);

  await clickDesign(page, 1090, 480); // "Đấu Trường (thử)"
  await expect.poll(() => sceneKey(page), { timeout: 30_000 }).toBe("arena");
  await clickDesign(page, 400, 518); // "Đấu Tập (máy)"
  await expect.poll(() => sceneKey(page), { timeout: 30_000 }).toBe("combat");
  const matchId = (await session(page)).match!.matchId;

  // Đầu hàng → match.end đi qua registry; kết thúc hiện trên combat.
  await page.evaluate((id) => {
    const s = (window as unknown as {
      __vn: { session: { net: { sendMatch: (m: unknown) => boolean } } };
    }).__vn.session;
    s.net.sendMatch({ type: "match.resign", matchId: id });
  }, matchId);
  await expect
    .poll(async () => ((await session(page)).match?.ended !== null && (await session(page)).match !== null))
    .toBe(true);

  // Rời combat về Đấu Trường — scene unbind callback, registry vẫn giữ quyết định.
  await clickSceneText(page, "combat", "Về Đấu Trường");
  await expect.poll(() => sceneKey(page)).toBe("arena");

  // matchId nằm trong tombstone — settlement xử lý đúng một lần.
  await expect.poll(async () => tombstoned(page, matchId), { timeout: 15_000 }).toBe(true);

  // Frame lặp cho trận đã xong bị nuốt — không notice thứ hai, không đổi scene.
  await page.evaluate((id) => {
    const s = (window as unknown as {
      __vn: { session: { registry: { handle: (m: unknown) => boolean } } };
    }).__vn.session;
    s.registry.handle({ type: "match.end", matchId: id, result: "lost", reason: "resign" });
    s.registry.handle({ type: "match.end", matchId: id, result: "lost", reason: "resign" });
  }, matchId);
  await page.waitForTimeout(500);
  const notices = (await session(page)).notices;
  expect(notices.filter((line) => line.includes("Trận trước"))).toHaveLength(0);
  expect(await sceneKey(page)).toBe("arena");
});
