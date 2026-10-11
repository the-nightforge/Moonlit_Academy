import { clickArenaAction, enterArena } from "./helpers/arena";
import { resolveMatchChoice, reloadSignedIn, closeMultiplayerPages, registerAccount, saveDeck, signedInPage, sendMatchAction, waitForMatchPlayback } from "./helpers/multiplayer";
import { expect, test, type Page } from "@playwright/test";
import { waitForScene, probeCombat, waitIdle } from "./helpers/combat";


test.afterEach(closeMultiplayerPages);

/**
 * `17` §7 e2e — two browser contexts, two accounts, one private match plus a
 * reload-rejoin and a practice match. The canvas UI is not DOM-readable, so the
 * test drives Phaser through `window.__vn` (main.ts dev handle).
 */

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

async function matchView(page: Page): Promise<MatchProbe["view"] | null> {
  return page.evaluate(
    () =>
      (window as unknown as { __vn?: { session: { match: { view: MatchProbe["view"] } | null } } })
        .__vn?.session.match?.view ?? null,
  );
}

test("phòng riêng PvP: hai trình duyệt đấu, tải lại một bên vào lại trận", async ({ browser }) => {
  // Two full-art clients and a reload each preload their own textures.
  test.setTimeout(300_000);
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
  await clickArenaAction(pageA, "arena_mode_private");
  await clickArenaAction(pageA, "arena_room_create"); // "Tạo phòng riêng"
  await expect.poll(async () => (await vn(pageA)).roomCode as string | null).not.toBeNull();
  const code = (await vn(pageA)).roomCode as string;

  await clickArenaAction(pageB, "arena_mode_private"); // "Vào phòng (mã)"
  // The room-code field is an HTML input over the canvas (in-game dialog).
  await pageB.fill("#vn-arena-room-code", code);
  await pageB.press("#vn-arena-room-code", "Enter");

  await waitForScene(pageA, "combat");
  await waitForScene(pageB, "combat");
  expect(await vn(pageA)).not.toBeNull();

  // Hai bên Đổi Bài rồi đánh vài lượt qua API mạng (server vẫn authoritative).
  for (const page of [pageA, pageB]) {
    await waitForMatchPlayback(page);
    await sendMatchAction(page, { type: "mulligan", instanceIds: [] });
  }
  for (const page of [pageA, pageB]) {
    await waitForMatchPlayback(page);
    await resolveMatchChoice(page);
    await waitForMatchPlayback(page);
  }
  await expect.poll(async () => (await matchView(pageA))?.status ?? "").toMatch(/playerTurn|opponentTurn/);

  // U6: the PvP layout holds — units stay left of the control band, and a
  // settled board leaves no floating FX behind.
  await waitIdle(pageA, 60_000);
  const board = await probeCombat(pageA);
  expect(board.units.length).toBeGreaterThan(0);
  expect(board.units.every((u) => u.bounds.x + u.bounds.w <= 1160)).toBe(true);
  expect(board.temporaryFxCount).toBe(0);

  for (let i = 0; i < 4; i++) {
    for (const page of [pageA, pageB]) {
      await waitForMatchPlayback(page);
      await resolveMatchChoice(page);
      await waitForMatchPlayback(page);
      if ((await matchView(page))?.status === "playerTurn") await sendMatchAction(page, { type: "endTurn" });
    }
    await pageA.waitForTimeout(400);
  }
  for (const page of [pageA, pageB]) {
    await waitForMatchPlayback(page);
    await resolveMatchChoice(page);
    await waitForMatchPlayback(page);
  }
  const viewA = await matchView(pageA);
  expect(["playerTurn", "opponentTurn"]).toContain(viewA!.status);

  // Tải lại trang của A → token còn → vào lại Đấu Trường → snapshot đưa về trận.
  await reloadSignedIn(pageA);
  await enterArena(pageA);
  await waitForScene(pageA, "combat");
  await waitForMatchPlayback(pageA);
  await resolveMatchChoice(pageA);
  await waitForMatchPlayback(pageA);
  expect((await matchView(pageA))!.status).toMatch(/playerTurn|opponentTurn/);
});

test("đấu tập: practice.start mở trận với máy, máy tự đánh", async ({ browser }) => {
  const acc = await registerAccount(`e2e_c_${Date.now()}`);
  await saveDeck(acc.token, acc.rev);
  const page = await signedInPage(browser, acc.token);
  await enterArena(page);

  await clickArenaAction(page, "arena_mode_practice");
  await clickArenaAction(page, "arena_practice_start"); // "Đấu Tập (máy)"
  await waitForScene(page, "combat");

  // Người chơi Đổi Bài; máy tự hoàn tất mulligan sau nhịp nghĩ.
  await waitForMatchPlayback(page);
  await sendMatchAction(page, { type: "mulligan", instanceIds: [] });
  await waitForMatchPlayback(page);
  await resolveMatchChoice(page);
  await waitForMatchPlayback(page);
  await expect
    .poll(async () => (await matchView(page))?.status ?? "", { timeout: 15_000 })
    .toMatch(/playerTurn|opponentTurn/);

  // Vài lượt: người chơi kết thúc lượt khi tới lượt; máy tự đánh.
  for (let i = 0; i < 8; i++) {
    await waitForMatchPlayback(page);
    await resolveMatchChoice(page);
    await waitForMatchPlayback(page);
    const view = await matchView(page);
    if (view?.status === "playerTurn") await sendMatchAction(page, { type: "endTurn" });
    await page.waitForTimeout(1_500); // nhịp "nghĩ" của máy
    if ((await vn(page)).match === null) break; // trận có thể kết thúc sớm
  }
  const match = (await vn(page)).match;
  expect(match === null || match.ended !== null || match.view.round >= 1).toBe(true);
});
