import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * `17` §7.1 e2e — ranked queue between two real clients, the full match,
 * rating/Vinh Dự settlement, then one Vinh Dự shop purchase. The canvas UI is
 * not DOM-readable, so the test drives Phaser through `window.__vn`.
 *
 * Vinh Dự is capped at 120/day (§6.4) while the cheapest shop item costs 150 —
 * a first-day purchase is impossible by design, so the test tops the winner's
 * balance up in SQLite (same DB file the dev server opened) before buying.
 */
const API = "http://localhost:8787";
const APP = "http://localhost:5173";
const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../server");

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
async function api(path_: string, init: RequestInit & { token?: string } = {}) {
  if (version === "") {
    const health = await fetch(`${API}/api/health`);
    version = ((await health.json()) as { dataVersion: string }).dataVersion;
  }
  const { headers: extra, ...rest } = init;
  const response = await fetch(`${API}${path_}`, {
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

/** A signed-in page sitting on the deck-select scene. */
async function signedInPage(browser: Browser, token: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript((value) => localStorage.setItem("vong-nguyet.token", value), token);
  await page.goto(APP);
  await page.waitForFunction(() => {
    const vn = (window as unknown as { __vn?: { session: { online: boolean } } }).__vn;
    const scene = (window as unknown as { __vn?: { game: { scene: { getScenes: (b: boolean) => { scene: { key: string } }[] } } } }).__vn;
    return vn !== undefined && scene?.game.scene.getScenes(true)[0]?.scene.key === "deck-select";
  }, undefined, { timeout: 30_000 });
  return page;
}

/** Clicks a design-space coordinate on the fitted canvas. */
async function clickDesign(page: Page, x: number, y: number): Promise<void> {
  const box = await page.locator("canvas").boundingBox();
  await page.mouse.click(box!.x + (x / 1280) * box!.width, box!.y + (y / 720) * box!.height);
}

interface MatchProbe {
  ended: {
    result: string;
    reason: string;
    rating?: { before: number; after: number };
    rewards?: { honor: number };
  } | null;
  view: { status: string; round: number };
}

const vn = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as { __vn: { session: { match: MatchProbe | null } } }).__vn.session;
    return s.match ? { ended: s.match.ended ?? null, view: s.match.view } : null;
  });

async function sceneKey(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      (window as unknown as { __vn?: { game: { scene: { getScenes: (b: boolean) => { scene: { key: string } }[] } } } })
        .__vn?.game.scene.getScenes(true)[0]?.scene.key ?? "",
  );
}

async function enterArena(page: Page): Promise<void> {
  await clickDesign(page, 1090, 480); // "Đấu Trường"
  await page.waitForFunction(() => {
    const vn_ = (window as unknown as {
      __vn?: {
        session: { net: { connected: boolean } | null; match: unknown };
        game: { scene: { getScenes: (b: boolean) => { scene: { key: string } }[] } };
      };
    }).__vn;
    const key = vn_?.game.scene.getScenes(true)[0]?.scene.key;
    return (key === "arena" && vn_?.session.net?.connected === true) || (key === "combat" && vn_?.session.match != null);
  }, undefined, { timeout: 30_000 });
}

test("xếp hạng: vào hàng chờ, đấu xong trận, điểm + Vinh Dự đổi, mua ở cửa hàng Vinh Dự", async ({ browser }) => {
  test.setTimeout(300_000);
  const stamp = Date.now();
  const winnerName = `e2e_w_${stamp}`;
  const winner = await registerAccount(winnerName);
  await saveDeck(winner.token, winner.rev);
  const pageW = await signedInPage(browser, winner.token);
  await enterArena(pageW);

  // Six ranked wins vs six fresh opponents — ranked blocks rematches for
  // 10 min, so every match needs a new account. 6 × 20 hits the 120/day cap.
  const WINS = 6;
  for (let i = 0; i < WINS; i++) {
    const loser = await registerAccount(`e2e_l${i}_${stamp}`);
    await saveDeck(loser.token, loser.rev);
    const pageL = await signedInPage(browser, loser.token);
    await enterArena(pageL);

    await clickDesign(pageW, 400, 470); // "Xếp hạng"
    await clickDesign(pageL, 400, 470);
    await expect.poll(() => sceneKey(pageW), { timeout: 60_000 }).toBe("combat");
    await expect.poll(() => sceneKey(pageL), { timeout: 60_000 }).toBe("combat");

    // The loser concedes; the server settles rating + Vinh Dự on match.end.
    await pageL.evaluate(() => {
      (window as unknown as { __vn: { session: { match: { resign: () => void } } } }).__vn.session.match.resign();
    });
    await expect.poll(async () => (await vn(pageW))?.ended !== null, { timeout: 30_000 }).toBe(true);
    const ended = (await vn(pageW))!.ended!;
    expect(ended.result).toBe("won");
    expect(ended.rating).toBeDefined();
    expect(ended.rating!.after).toBeGreaterThan(ended.rating!.before);
    expect(ended.rewards!.honor).toBeGreaterThan(0);

    await clickDesign(pageW, 640, 476); // "Về Đấu Trường"
    await expect.poll(() => sceneKey(pageW), { timeout: 30_000 }).toBe("arena");
    await pageL.context().close();
  }

  const me = await api("/api/arena/me", { token: winner.token });
  const arena = me.body.arena as { wins: number; rating: number };
  expect(arena.wins).toBe(WINS);
  expect(arena.rating).toBeGreaterThan(1000);
  expect((me.body.honorToday as { gained: number }).gained).toBe(120); // daily cap (§6.4)

  // Top up Vinh Dự straight in SQLite — the cap makes a purchase impossible
  // on day one; this checks the whole buy path, not the economy design.
  execFileSync(
    process.execPath,
    [
      "-e",
      `const db = require("better-sqlite3")("data/vong-nguyet.db");
       db.pragma("busy_timeout = 5000");
       const acc = db.prepare("SELECT id FROM accounts WHERE username = ?").get(process.argv[1]);
       if (!acc) throw new Error("no such account");
       db.prepare("UPDATE profiles SET profile_json = json_set(profile_json, '$.currencies.honor', 200) WHERE account_id = ?").run(acc.id);`,
      winnerName,
    ],
    { cwd: SERVER_DIR },
  );

  // Reload → fresh profile with the topped-up Vinh Dự → arena → Vinh Dự shop.
  await pageW.reload();
  await pageW.waitForFunction(() => {
    const key = (window as unknown as { __vn?: { game: { scene: { getScenes: (b: boolean) => { scene: { key: string } }[] } } } })
      .__vn?.game.scene.getScenes(true)[0]?.scene.key;
    return key === "deck-select";
  }, undefined, { timeout: 30_000 });
  await enterArena(pageW);
  await clickDesign(pageW, 1110, 518); // "Cửa hàng Vinh Dự"
  await expect.poll(() => sceneKey(pageW), { timeout: 15_000 }).toBe("shop");

  const before = await api("/api/profile", { token: winner.token });
  const jadeBefore = (before.body.profile as { currencies: { moonJade: number } }).currencies.moonJade;
  pageW.once("dialog", (dialog) => void dialog.accept());
  await clickDesign(pageW, 1020, 170); // "Mua" — vé kéo 160 Ngọc (150 Vinh Dự)
  await expect
    .poll(async () => {
      const reply = await api("/api/profile", { token: winner.token });
      const currencies = (reply.body.profile as { currencies: { moonJade: number; honor: number } }).currencies;
      return currencies.moonJade === jadeBefore + 160 && currencies.honor === 50;
    }, { timeout: 15_000 })
    .toBe(true);
});
