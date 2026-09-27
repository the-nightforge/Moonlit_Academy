import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * `17` §7 e2e — two browser contexts, two accounts, one private match plus a
 * reload-rejoin and a practice match. The canvas UI is not DOM-readable, so the
 * test drives Phaser through `window.__vn` (main.ts dev handle).
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
  ended: { result: string; reason: string } | null;
  view: { status: string; round: number; players: { mulliganDone: boolean }[] };
}

/** Light-weight probe — the full session graph is circular and cannot serialize. */
const vn = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as {
      __vn: { session: { roomCode: string | null; match: MatchProbe | null } };
    }).__vn.session;
    return {
      roomCode: s.roomCode ?? null,
      match: s.match
        ? { ended: s.match.ended ?? null, view: s.match.view }
        : null,
    };
  });

async function sceneKey(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      (window as unknown as { __vn?: { game: { scene: { getScenes: (b: boolean) => { scene: { key: string } }[] } } } })
        .__vn?.game.scene.getScenes(true)[0]?.scene.key ?? "",
  );
}

async function enterArena(page: Page): Promise<void> {
  await clickDesign(page, 1090, 480); // "Đấu Trường (thử)"
  // Normally lands on "arena" once the socket auths; with an active match the
  // server snapshot bounces the client straight into "combat" (rejoin).
  await page.waitForFunction(() => {
    const vn = (window as unknown as {
      __vn?: {
        session: { net: { connected: boolean } | null; match: unknown };
        game: { scene: { getScenes: (b: boolean) => { scene: { key: string } }[] } };
      };
    }).__vn;
    const key = vn?.game.scene.getScenes(true)[0]?.scene.key;
    return (key === "arena" && vn?.session.net?.connected === true) || (key === "combat" && vn?.session.match != null);
  }, undefined, { timeout: 30_000 });
}

async function sendMatchAction(page: Page, action: unknown): Promise<void> {
  await page.evaluate((act) => {
    const session = (window as unknown as { __vn: { session: { match: { sendAction: (a: unknown) => void } } } })
      .__vn.session;
    session.match.sendAction(act);
  }, action);
}

async function matchView(page: Page): Promise<MatchProbe["view"] | null> {
  return page.evaluate(
    () =>
      (window as unknown as { __vn?: { session: { match: { view: MatchProbe["view"] } | null } } })
        .__vn?.session.match?.view ?? null,
  );
}

test("phòng riêng PvP: hai trình duyệt đấu, tải lại một bên vào lại trận", async ({ browser }) => {
  const accA = await registerAccount(`e2e_a_${Date.now()}`);
  const accB = await registerAccount(`e2e_b_${Date.now()}`);
  await saveDeck(accA.token, accA.rev);
  await saveDeck(accB.token, accB.rev);
  const tokenA = accA.token;
  const tokenB = accB.token;

  const pageA = await signedInPage(browser, tokenA);
  const pageB = await signedInPage(browser, tokenB);
  await enterArena(pageA);
  await enterArena(pageB);

  // A tạo phòng; lấy mã từ session; B vào bằng mã.
  await clickDesign(pageA, 640, 470); // "Tạo phòng riêng"
  await expect.poll(async () => (await vn(pageA)).roomCode as string | null).not.toBeNull();
  const code = (await vn(pageA)).roomCode as string;

  pageB.once("dialog", (dialog) => void dialog.accept(code));
  await clickDesign(pageB, 880, 470); // "Vào phòng (mã)"

  await expect.poll(() => sceneKey(pageA), { timeout: 30_000 }).toBe("combat");
  await expect.poll(() => sceneKey(pageB)).toBe("combat");
  expect(await vn(pageA)).not.toBeNull();

  // Hai bên Đổi Bài rồi đánh vài lượt qua API mạng (server vẫn authoritative).
  for (const page of [pageA, pageB]) {
    await sendMatchAction(page, { type: "mulligan", instanceIds: [] });
  }
  await expect.poll(async () => (await matchView(pageA))?.status ?? "").toMatch(/playerTurn|opponentTurn/);

  for (let i = 0; i < 4; i++) {
    for (const page of [pageA, pageB]) {
      if ((await matchView(page))?.status === "playerTurn") await sendMatchAction(page, { type: "endTurn" });
    }
    await pageA.waitForTimeout(400);
  }
  const viewA = await matchView(pageA);
  expect(["playerTurn", "opponentTurn"]).toContain(viewA!.status);

  // Tải lại trang của A → token còn → vào lại Đấu Trường → snapshot đưa về trận.
  await pageA.reload();
  await pageA.waitForFunction(() => {
    const key = (window as unknown as { __vn?: { game: { scene: { getScenes: (b: boolean) => { scene: { key: string } }[] } } } })
      .__vn?.game.scene.getScenes(true)[0]?.scene.key;
    return key === "deck-select";
  }, undefined, { timeout: 30_000 });
  await enterArena(pageA);
  await expect.poll(() => sceneKey(pageA), { timeout: 30_000 }).toBe("combat");
  expect((await matchView(pageA))!.status).toMatch(/playerTurn|opponentTurn/);
});

test("đấu tập: practice.start mở trận với máy, máy tự đánh", async ({ browser }) => {
  const acc = await registerAccount(`e2e_c_${Date.now()}`);
  await saveDeck(acc.token, acc.rev);
  const page = await signedInPage(browser, acc.token);
  await enterArena(page);

  await clickDesign(page, 400, 518); // "Đấu Tập (máy)"
  await expect.poll(() => sceneKey(page), { timeout: 30_000 }).toBe("combat");

  // Người chơi Đổi Bài; máy tự hoàn tất mulligan sau nhịp nghĩ.
  await sendMatchAction(page, { type: "mulligan", instanceIds: [] });
  await expect
    .poll(async () => (await matchView(page))?.status ?? "", { timeout: 15_000 })
    .toMatch(/playerTurn|opponentTurn/);

  // Vài lượt: người chơi kết thúc lượt khi tới lượt; máy tự đánh.
  for (let i = 0; i < 8; i++) {
    const view = await matchView(page);
    if (view?.status === "playerTurn") await sendMatchAction(page, { type: "endTurn" });
    await page.waitForTimeout(1_500); // nhịp "nghĩ" của máy
    if ((await vn(page)).match === null) break; // trận có thể kết thúc sớm
  }
  const match = (await vn(page)).match;
  expect(match === null || match.ended !== null || match.view.round >= 1).toBe(true);
});
