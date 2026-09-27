import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * `17` §9.3 e2e — Liên Thủ: two browser contexts, two accounts, one private
 * co-op room where a real Hợp Kích fires (`combo_am_anh_tuyet_sat` —
 * `m06_anh_bo` stealth half + `f02_huyet_tram` loseHp half, both starter
 * cards), plus a page reload mid-match and a bot-partner practice game.
 * The canvas UI is not DOM-readable, so the test drives Phaser through
 * `window.__vn` (main.ts dev handle).
 */
const API = "http://localhost:8787";
const APP = "http://localhost:5173";

/** Starter heroes [m05, f04, m06] — every card is a starter (fresh accounts pass deck validation). */
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

/**
 * Hợp Kích halves (`coop-combos.json` → `combo_nguyet_quang_pho_chieu` —
 * the only combo reachable with starter heroes): one seat plays the
 * `shiftMoon` half while the moon lands on Trăng Tròn (index 4, i.e. played
 * at index 3), the partner plays any `heal` card the same shared turn.
 */
const SHIFT_HALF = "f04_nguyet_quang_dan";
const HEAL_HALF = "f04_tinh_tam_tra";
const COMBO_ID = "combo_nguyet_quang_pho_chieu";
const FULL_MOON = 4;

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
    body: JSON.stringify({ draft: { id: "", name: "Liên Thủ", ...DECK } }),
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

interface ViewProbe {
  mode: string;
  status: string;
  round: number;
  moonIndex: number;
  comboUsed?: Record<string, { total: number; round: number }>;
  playedThisTurn?: { player: number; cardId: string; comboId?: string; moonAfter: number }[];
  players: {
    index: number;
    done: boolean;
    mulliganDone: boolean;
    moonPower: number;
    hand: string[];
    pendingChoice: { options: string[] } | null;
  }[];
  heroes: { id: string; player: number; alive: boolean }[];
  enemies: { id: string; alive: boolean }[];
  cards: Record<string, { cardId: string }>;
}

interface Probe {
  roomCode: string | null;
  match: { ended: { result: string; reason: string } | null; you: number; mode: string } | null;
  view: ViewProbe | null;
  cards: Record<string, { cost: number; target: "none" | "enemy" | "ally" }>;
}

/** Light-weight probe — the full session graph is circular and cannot serialize. */
const vn = (page: Page): Promise<Probe> =>
  page.evaluate(() => {
    const s = (window as unknown as {
      __vn: {
        session: {
          roomCode: string | null;
          match: { ended: { result: string; reason: string } | null; you: number; mode: string; view: ViewProbe } | null;
          data: { cards: Record<string, { cost: number; target: "none" | "enemy" | "ally" }> };
        };
      };
    }).__vn.session;
    return {
      roomCode: s.roomCode ?? null,
      match: s.match ? { ended: s.match.ended ?? null, you: s.match.you, mode: s.match.mode } : null,
      view: s.match?.view ?? null,
      cards: s.data.cards,
    };
  });

async function sceneKey(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      (window as unknown as { __vn?: { game: { scene: { getScenes: (b: boolean) => { scene: { key: string } }[] } } } })
        .__vn?.game.scene.getScenes(true)[0]?.scene.key ?? "",
  );
}

async function enterLobby(page: Page): Promise<void> {
  await clickDesign(page, 1090, 524); // "Liên Thủ"
  // Reconnecting with a live match bounces straight into "combat" instead.
  await page.waitForFunction(() => {
    const vn = (window as unknown as {
      __vn?: {
        session: { net: { connected: boolean } | null; match: unknown };
        game: { scene: { getScenes: (b: boolean) => { scene: { key: string } }[] } };
      };
    }).__vn;
    const key = vn?.game.scene.getScenes(true)[0]?.scene.key;
    return (key === "coop-lobby" && vn?.session.net?.connected === true) || (key === "combat" && vn?.session.match != null);
  }, undefined, { timeout: 30_000 });
}

async function sendMatchAction(page: Page, action: unknown): Promise<void> {
  await page.evaluate((act) => {
    const session = (window as unknown as { __vn: { session: { match: { sendAction: (a: unknown) => void } } } })
      .__vn.session;
    session.match.sendAction(act);
  }, action);
}

const cardIds = (probe: Probe, seat: number): string[] =>
  probe.view!.players[seat]!.hand.map((id) => probe.view!.cards[id]!.cardId);

/**
 * Shared-turn pass one (`17` §8.3): resolves a pending Chiêm Bài and plays this
 * seat's Hợp Kích half. The shift half only goes down inside the Trăng Tròn
 * window (played at moon index 3 so `moonAfter` is 4) when the partner holds
 * or already played the heal half; the heal half waits for the partner's shift
 * in this turn's journal. No endTurn — a second pass and the churn phase
 * follow before the seat is done.
 */
async function comboPass(page: Page): Promise<void> {
  const probe = await vn(page);
  const view = probe.view;
  if (view === null || probe.match === null || view.status !== "playerTurn") return;
  const seat = probe.match.you;
  const me = view.players[seat]!;
  if (me.done) return;
  if (me.pendingChoice !== null) {
    await sendMatchAction(page, { type: "chooseCard", instanceId: me.pendingChoice.options[0] });
    return;
  }
  const other = 1 - seat;
  const myHand = cardIds(probe, seat);
  const partnerHand = cardIds(probe, other);
  const partnerPlayed = (cardId: string, moonAfter?: number) =>
    view.playedThisTurn?.some(
      (e) =>
        e.player === other &&
        e.cardId === cardId &&
        e.comboId === undefined &&
        (moonAfter === undefined || e.moonAfter === moonAfter),
    ) ?? false;
  // Finisher: the partner's shift already landed on Trăng Tròn this turn.
  if (myHand.includes(HEAL_HALF) && partnerPlayed(SHIFT_HALF, FULL_MOON)) {
    const instanceId = me.hand.find((id) => view.cards[id]!.cardId === HEAL_HALF)!;
    const hero = view.heroes.find((h) => h.player === seat && h.alive)?.id;
    if (hero !== undefined) {
      await sendMatchAction(page, { type: "playCard", instanceId, targetId: hero });
      await page.waitForTimeout(150);
      const after = await vn(page);
      const choice = after.view?.players[seat]?.pendingChoice;
      if (choice) await sendMatchAction(page, { type: "chooseCard", instanceId: choice.options[0] });
    }
    return;
  }
  // Setup: play the shift only inside the moon window, and only while the
  // partner can still answer with their heal half this turn.
  if (
    view.moonIndex === FULL_MOON - 1 &&
    myHand.includes(SHIFT_HALF) &&
    (partnerHand.includes(HEAL_HALF) || partnerPlayed(HEAL_HALF)) &&
    view.players[other]!.done === false
  ) {
    const instanceId = me.hand.find((id) => view.cards[id]!.cardId === SHIFT_HALF)!;
    await sendMatchAction(page, { type: "playCard", instanceId });
    await page.waitForTimeout(150);
    // The shift card carries Chiêm Bài — clear it so the seat stays free to act.
    const after = await vn(page);
    const choice = after.view?.players[seat]?.pendingChoice;
    if (choice) await sendMatchAction(page, { type: "chooseCard", instanceId: choice.options[0] });
  }
}

/** Pass two: churn up to two cheap non-piece cards to dig, then "Xong". */
async function churnSeat(page: Page): Promise<void> {
  const probe = await vn(page);
  const view = probe.view;
  if (view === null || probe.match === null || view.status !== "playerTurn") return;
  const seat = probe.match.you;
  const me = view.players[seat]!;
  if (me.done) return;
  if (me.pendingChoice !== null) {
    await sendMatchAction(page, { type: "chooseCard", instanceId: me.pendingChoice.options[0] });
    return;
  }
  let played = 0;
  const affordable = me.hand
    .map((id) => ({ id, def: probe.cards[view.cards[id]!.cardId]! }))
    .filter(({ id, def }) => {
      const cardId = view.cards[id]!.cardId;
      return def.cost <= me.moonPower && cardId !== SHIFT_HALF && cardId !== HEAL_HALF;
    })
    .sort((a, b) => a.def.cost - b.def.cost);
  for (const { id, def } of affordable) {
    if (played >= 2) break;
    const fresh = await vn(page);
    const hero = fresh.view?.heroes.find((h) => h.player === seat && h.alive)?.id;
    const enemy = fresh.view?.enemies.find((e) => e.alive)?.id;
    if (def.target === "ally" && hero === undefined) continue;
    if (def.target === "enemy" && enemy === undefined) continue;
    await sendMatchAction(page, {
      type: "playCard",
      instanceId: id,
      ...(def.target === "ally" ? { targetId: hero! } : def.target === "enemy" ? { targetId: enemy! } : {}),
    });
    played += 1;
    await page.waitForTimeout(120);
    const after = await vn(page);
    const choice = after.view?.players[seat]?.pendingChoice;
    if (choice) {
      await sendMatchAction(page, { type: "chooseCard", instanceId: choice.options[0] });
      await page.waitForTimeout(120);
    }
  }
  await sendMatchAction(page, { type: "endTurn" });
}

test("phòng riêng Liên Thủ: hai trình duyệt kích Hợp Kích, tải lại một bên vào lại trận", async ({ browser }) => {
  const accA = await registerAccount(`e2e_ca_${Date.now()}`);
  const accB = await registerAccount(`e2e_cb_${Date.now()}`);
  await saveDeck(accA.token, accA.rev);
  await saveDeck(accB.token, accB.rev);

  const pageA = await signedInPage(browser, accA.token);
  const pageB = await signedInPage(browser, accB.token);
  await enterLobby(pageA);
  await enterLobby(pageB);

  // A tạo phòng riêng co-op; B vào bằng mã.
  await clickDesign(pageA, 640, 470); // "Tạo phòng riêng"
  await expect.poll(async () => (await vn(pageA)).roomCode).not.toBeNull();
  const code = (await vn(pageA)).roomCode!;
  pageB.once("dialog", (dialog) => void dialog.accept(code));
  await clickDesign(pageB, 880, 470); // "Vào phòng (mã)"

  await expect.poll(() => sceneKey(pageA), { timeout: 30_000 }).toBe("combat");
  await expect.poll(() => sceneKey(pageB)).toBe("combat");
  expect((await vn(pageA)).match?.mode).toBe("coop_private");
  expect((await vn(pageA)).view?.mode).toBe("coop");

  // Mulligan: đổi tối đa 2 lá không phải nửa Hợp Kích để đào bài.
  for (const page of [pageA, pageB]) {
    const probe = await vn(page);
    const seat = probe.match!.you;
    const returns = probe.view!.players[seat]!.hand
      .filter((id) => ![SHIFT_HALF, HEAL_HALF].includes(probe.view!.cards[id]!.cardId))
      .slice(0, 2);
    await sendMatchAction(page, { type: "mulligan", instanceIds: returns });
  }
  await expect.poll(async () => (await vn(pageA)).view?.status ?? "", { timeout: 20_000 }).toBe("playerTurn");

  // Đánh tới khi Hợp Kích kích (hoặc trận kết thúc); vòng lặp điều khiển cả hai ghế.
  // Hai lượt comboPass trước churn+endTurn để nửa được đánh sau vẫn bắt kịp journal.
  let fired = false;
  for (let round = 0; round < 30 && !fired; round++) {
    for (const page of [pageA, pageB]) await comboPass(page);
    for (const page of [pageA, pageB]) await comboPass(page);
    for (const page of [pageA, pageB]) await churnSeat(page);
    await pageA.waitForTimeout(400);
    fired = ((await vn(pageA)).view?.comboUsed?.[COMBO_ID]?.total ?? 0) > 0;
    if ((await vn(pageA)).match?.ended !== null) break;
  }
  const view = (await vn(pageA)).view;
  expect(view?.comboUsed?.[COMBO_ID]?.total ?? 0, "Hợp Kích Ám Ảnh Tuyệt Sát phải kích").toBeGreaterThanOrEqual(1);
  expect(view?.status, "trận co-op vẫn đang diễn ra").toBe("playerTurn");

  // Tải lại trang của A → vào lại Liên Thủ → snapshot trả về trận.
  await pageA.reload();
  await pageA.waitForFunction(() => {
    const key = (window as unknown as { __vn?: { game: { scene: { getScenes: (b: boolean) => { scene: { key: string } }[] } } } })
      .__vn?.game.scene.getScenes(true)[0]?.scene.key;
    return key === "deck-select";
  }, undefined, { timeout: 30_000 });
  await enterLobby(pageA);
  await expect.poll(() => sceneKey(pageA), { timeout: 30_000 }).toBe("combat");
  expect(["playerTurn", "enemyTurn", "choosing"]).toContain((await vn(pageA)).view!.status);
});

test("đấu tập Liên Thủ: đồng đội máy đánh cùng tới khi trận kết thúc", async ({ browser }) => {
  const acc = await registerAccount(`e2e_cc_${Date.now()}`);
  await saveDeck(acc.token, acc.rev);
  const page = await signedInPage(browser, acc.token);
  await enterLobby(page);

  await clickDesign(page, 400, 518); // "Đấu Tập (đồng đội máy)"
  await expect.poll(() => sceneKey(page), { timeout: 30_000 }).toBe("combat");
  expect((await vn(page)).match?.mode).toBe("coop_practice");

  await sendMatchAction(page, { type: "mulligan", instanceIds: [] });
  await expect
    .poll(async () => (await vn(page)).view?.status ?? "", { timeout: 15_000 })
    .toBe("playerTurn");

  // Chơi tới hết: máy tự đánh phần mình; người chơi churn lá + Xong mỗi lượt.
  for (let i = 0; i < 90; i++) {
    const probe = await vn(page);
    if (probe.match === null || probe.match.ended !== null) break;
    await comboPass(page);
    await churnSeat(page);
    await page.waitForTimeout(500); // nhịp "nghĩ" của máy + lượt boss
  }
  const match = (await vn(page)).match;
  expect(match === null || match.ended !== null, "trận đấu tập phải kết thúc").toBe(true);
});
