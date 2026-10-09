import { waitForMatchPlayback, reloadSignedIn, closeMultiplayerPages, enterMultiplayer, registerAccount, saveDeck, signedInPage, sendMatchAction } from "./helpers/multiplayer";
import { expect, test, type Page } from "@playwright/test";
import { waitForScene, clickSceneText, probeCombat, sceneTexts, activeSceneKey as sceneKey, clickDesign } from "./helpers/combat";


test.afterEach(closeMultiplayerPages);

/**
 * `17` §9.3 e2e — Liên Thủ: two browser contexts, two accounts, one private
 * co-op room where Nguyệt Quang Phổ Chiếu fires (`combo_nguyet_quang_pho_chieu` —
 * a moon-shift half + a heal half from the starter cards), plus a page reload mid-match and a bot-partner practice game.
 * The canvas UI is not DOM-readable, so the test drives Phaser through
 * `window.__vn` (main.ts dev handle).
 */


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

const cardIds = (probe: Probe, seat: number): string[] =>
  probe.view!.players[seat]!.hand.map((id) => probe.view!.cards[id]!.cardId);

/** Use Chiêm Bài to find a missing combo half instead of blindly taking the first card. */
function chooseComboCard(probe: Probe, seat: number, options: string[]): string {
  const hand = cardIds(probe, seat);
  return options.find(id => {
    const cardId = probe.view!.cards[id]!.cardId;
    return [SHIFT_HALF, HEAL_HALF].includes(cardId) && !hand.includes(cardId);
  }) ?? options[0]!;
}

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
    await sendMatchAction(page, { type: "chooseCard", instanceId: chooseComboCard(probe, seat, me.pendingChoice.options) });
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
      if (choice) await sendMatchAction(page, { type: "chooseCard", instanceId: chooseComboCard(after, seat, choice.options) });
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
    if (choice) await sendMatchAction(page, { type: "chooseCard", instanceId: chooseComboCard(after, seat, choice.options) });
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
    await sendMatchAction(page, { type: "chooseCard", instanceId: chooseComboCard(probe, seat, me.pendingChoice.options) });
    return;
  }
  let played = 0;
  // Reserve one copy of each half; duplicate halves can still heal or dig.
  const reserved = new Set([SHIFT_HALF, HEAL_HALF].map(cardId =>
    me.hand.find(id => view.cards[id]!.cardId === cardId),
  ));
  const affordable = me.hand
    .map((id) => ({ id, def: probe.cards[view.cards[id]!.cardId]! }))
    .filter(({ id, def }) => {
      return def.cost <= me.moonPower && !reserved.has(id);
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
      await sendMatchAction(page, { type: "chooseCard", instanceId: chooseComboCard(after, seat, choice.options) });
      await page.waitForTimeout(120);
    }
  }
  await sendMatchAction(page, { type: "endTurn" });
}

test("phòng riêng Liên Thủ: hai trình duyệt kích Hợp Kích, tải lại một bên vào lại trận", async ({ browser }) => {
  // Real shared-turn cards, playback and the full portrait preload also run
  // during rejoin; the diagnostic reached round5/combo after70s of actions.
  test.setTimeout(600_000);
  const accA = await registerAccount(`e2e_ca_${Date.now()}`);
  await saveDeck(accA.token, accA.rev, "Liên Thủ");

  const pageA = await signedInPage(browser, accA.token, "Co-op");
  await enterMultiplayer(pageA, "coop-lobby");

  // Drawing both halves before the Trăng Tròn window is pure match RNG — a
  // lost match gets abandoned and a fresh room retries (private rooms allow
  // rematches; only ranked blocks them).
  let fired = false;
  let pageB: Page | null = null;
  for (let attempt = 0; attempt < 2 && !fired; attempt++) {
    // USERNAME_PATTERN caps at 20 chars — keep the attempt marker short.
    const accB = await registerAccount(`e2e_c${attempt}_${Date.now()}`);
    await saveDeck(accB.token, accB.rev, "Liên Thủ");
    pageB = await signedInPage(browser, accB.token, "Co-op");
    await enterMultiplayer(pageB, "coop-lobby");

    // A tạo phòng riêng co-op; B vào bằng mã.
    await clickDesign(pageA, 640, 470); // "Tạo phòng riêng"
    await expect.poll(async () => (await vn(pageA)).roomCode).not.toBeNull();
    const code = (await vn(pageA)).roomCode!;
    await clickDesign(pageB, 880, 470); // "Vào phòng (mã)"
    // The room-code field is an HTML input over the canvas (in-game dialog).
    await pageB.fill("#vn-modal-input", code);
    await pageB.press("#vn-modal-input", "Enter");

    await waitForScene(pageA, "combat");
    await waitForScene(pageB!, "combat");
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
    const started = Date.now();
    for (let round = 0; round < 30 && !fired; round++) {
      for (const page of [pageA, pageB]) await comboPass(page);
      for (const page of [pageA, pageB]) await comboPass(page);
      for (const page of [pageA, pageB]) await churnSeat(page);
      await waitForMatchPlayback(pageA, pageB);
      fired = ((await vn(pageA)).view?.comboUsed?.[COMBO_ID]?.total ?? 0) > 0;
      const progress = await pageA.evaluate(() => {
        const h = (window as any).__vn, s = h.game.scene.getScene("combat");
        return {round:h.session.match?.view.round,moon:h.session.match?.view.moonIndex,status:h.session.match?.view.status,pending:h.session.match?.pending,busy:s.playback.busy};
      });
      console.info("Co-op progress", {attempt:attempt+1,iteration:round,elapsedMs:Date.now()-started,...progress});
      if ((await vn(pageA)).match?.ended !== null) break;
    }
    if (fired) break;

    // The match ended (usually a loss) before the combo assembled — leave the
    // end screen so the next attempt starts from a clean lobby. The end screen
    // only renders once playback drains, so wait for its button first.
    console.info(`Co-op attempt ${attempt + 1} ended without Hợp Kích — retrying in a fresh room`);
    if ((await sceneKey(pageA)) === "combat") {
      await expect
        .poll(async () => (await sceneTexts(pageA, "combat")).some((t) => t.includes("Về Liên Thủ")), { timeout: 90_000 })
        .toBe(true);
      await clickSceneText(pageA, "combat", "Về Liên Thủ");
      await expect.poll(() => sceneKey(pageA), { timeout: 60_000 }).toBe("coop-lobby");
    }
    await pageB.context().close();
    pageB = null;
  }
  const view = (await vn(pageA)).view;
  expect(view?.comboUsed?.[COMBO_ID]?.total ?? 0, "Hợp Kích Nguyệt Quang Phổ Chiếu phải kích").toBeGreaterThanOrEqual(1);
  expect(view?.status, "trận co-op vẫn đang diễn ra").toBe("playerTurn");

  // Tải lại trang của A → vào lại Liên Thủ → snapshot trả về trận.
  await reloadSignedIn(pageA);
  await enterMultiplayer(pageA, "coop-lobby");
  await waitForScene(pageA, "combat");
  expect(["playerTurn", "enemyTurn", "choosing"]).toContain((await vn(pageA)).view!.status);
});

test("đấu tập Liên Thủ: đồng đội máy đánh cùng tới khi trận kết thúc", async ({ browser }) => {
  const acc = await registerAccount(`e2e_cc_${Date.now()}`);
  await saveDeck(acc.token, acc.rev, "Liên Thủ");
  const page = await signedInPage(browser, acc.token, "Co-op");
  await enterMultiplayer(page, "coop-lobby");

  await clickDesign(page, 400, 518); // "Đấu Tập (đồng đội máy)"
  await waitForScene(page, "combat");
  expect((await vn(page)).match?.mode).toBe("coop_practice");

  await sendMatchAction(page, { type: "mulligan", instanceIds: [] });
  await expect
    .poll(async () => (await vn(page)).view?.status ?? "", { timeout: 15_000 })
    .toBe("playerTurn");

  // U6: co-op layout — six heroes across two rows, none spilling into the
  // right control band, and no leftover FX once the board settles.
  await waitForMatchPlayback(page);
  const board = await probeCombat(page);
  expect(board.units.length).toBeGreaterThanOrEqual(6);
  expect(board.units.every((u) => u.bounds.x + u.bounds.w <= 1160)).toBe(true);
  expect(board.temporaryFxCount).toBe(0);

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
