import { expect, test } from "@playwright/test";
import { registerAccount, saveDeck, signedInPage, closeMultiplayerPages } from "./helpers/multiplayer";
import { clickArenaAction, enterArena } from "./helpers/arena";

test.afterEach(closeMultiplayerPages);
test("private room preserves rejected codes and identifies the local player from welcome", async ({ browser }) => {
  const account = await registerAccount(`room_${Date.now()}`);
  await saveDeck(account.token, account.rev);
  const page = await signedInPage(browser, account.token);
  await enterArena(page);
  await clickArenaAction(page, "arena_mode_private");
  await page.locator("#vn-arena-room-code").fill("ABC123");
  await page.evaluate(() => { (window as any).__vn.session.net.send = () => {}; });
  await clickArenaAction(page, "arena_room_join");
  await page.evaluate(() => (window as any).__vn.game.scene.getScene("arena").onMessage({ type: "error", error: "room not found" }));
  await expect(page.locator("#vn-arena-room-code")).toHaveValue("ABC123");
  const labels = await page.evaluate(() => {
    const scene = (window as any).__vn.game.scene.getScene("arena");
    scene.onMessage({ type: "welcome", account: { id: 1, username: "local-player" }, serverTime: Date.now() });
    scene.pending = true;
    scene.onMessage({ type: "room.created", code: "ABC123", mode: "pvp", players: [
      { username: "opponent", ready: false }, { username: "local-player", ready: false },
    ] });
    const body = scene.root.getByName("arena_mode_content");
    const ownSlot = body.list.find((n: any) => n.list?.some((text: any) => text.text === "BẠN"));
    return ownSlot.list.filter((n: any) => n.text).map((n: any) => n.text);
  });
  expect(labels).toEqual(["BẠN", "local-player"]);
});

test("hero and equipment previews explain PvP rules, history filters and validation opens editing", async ({ browser }) => {
  const account = await registerAccount(`detail_${Date.now()}`);
  await saveDeck(account.token, account.rev);
  const page = await signedInPage(browser, account.token);
  await page.route("**/api/arena/history", route => route.fulfill({ json: { entries: [
    { matchId: "ranked", mode: "ranked", opponent: "Ranked opponent", result: "won", ratingDelta: 20, createdAt: Date.now() },
    { matchId: "ranked_bot", mode: "ranked_bot", opponent: "Generated opponent", result: "won", ratingDelta: null, createdAt: Date.now() },
    { matchId: "practice", mode: "practice", opponent: "Practice opponent", result: "lost", ratingDelta: null, createdAt: Date.now() },
  ] } }));
  await enterArena(page);
  const heroPreview = await page.evaluate(() => {
    const { session, game } = (window as any).__vn;
    const deck = session.profile.decks[0];
    deck.weapons = { m05: "w_thiet_thuan" }; deck.relicIds = ["r_bach_lo_huong_nang"];
    session.profile.heroes.m05.constellation = 6;
    session.profile.weapons.w_thiet_thuan = { refinement: 3 };
    session.profile.relics.r_bach_lo_huong_nang = { resonance: 4 };
    game.scene.getScene("arena").render();
    return { health: session.data.pvpConfig.heroStats.m05.maxHp, threshold: session.data.heroes.m05.levelUp.constellationThreshold };
  });
  const tip = () => page.evaluate(() => {
    const s = (window as any).__vn.game.scene.getScene("arena");
    const texts = (nodes: any[]): string[] => nodes.flatMap(n => n.text ? [n.text] : n.list ? texts(n.list) : []);
    return texts(s.tooltip?.list ?? []).join("\n");
  });
  await clickArenaAction(page, "arena_hero_m05");
  await expect.poll(tip).toContain(`Máu Đấu Trường: ${heroPreview.health}`);
  await expect.poll(tip).toContain(`Ngưỡng Thức Tỉnh: ${heroPreview.threshold}`);
  await expect.poll(tip).toContain("Tinh Hồn 6");
  await page.keyboard.press("Escape");
  await clickArenaAction(page, "arena_weapon_m05");
  await expect.poll(tip).toContain("Tinh Luyện 3");
  await page.keyboard.press("Escape");
  await clickArenaAction(page, "arena_relic_0");
  await expect.poll(tip).toContain("Cộng Minh 4");
  await page.keyboard.press("Escape");
  await clickArenaAction(page, "arena_history");
  await expect.poll(() => page.evaluate(() => (window as any).__vn.game.scene.getScene("arena").history?.length)).toBe(3);
  await clickArenaAction(page, "arena_history_filter_ranked_bot");
  const botHistory = await page.evaluate(() => {
    const modal = (window as any).__vn.game.scene.getScene("arena").root.getByName("arena_modal");
    const texts = (nodes: any[]): string[] => nodes.flatMap(n => n.text ? [n.text] : n.list ? texts(n.list) : []);
    return texts(modal.list).join("\n");
  });
  expect(botHistory).toContain("Generated opponent (máy)");
  expect(botHistory).not.toContain("Ranked opponent");
  await clickArenaAction(page, "arena_history_filter_practice");
  const visible = await page.evaluate(() => {
    const modal = (window as any).__vn.game.scene.getScene("arena").root.getByName("arena_modal");
    const texts = (nodes: any[]): string[] => nodes.flatMap(n => n.text ? [n.text] : n.list ? texts(n.list) : []);
    return texts(modal.list).join("\n");
  });
  expect(visible).toContain("Practice opponent"); expect(visible).not.toContain("Ranked opponent");
  await clickArenaAction(page, "arena_modal_close");
  await page.evaluate(() => {
    const { session, game } = (window as any).__vn;
    session.profile.decks[0].cardIds = []; game.scene.getScene("arena").render();
  });
  await clickArenaAction(page, "arena_deck_validation");
  await clickArenaAction(page, "arena_validation_edit");
  await page.waitForFunction(() => (window as any).__vn.game.scene.isActive("deck-builder"));
});

test("queue ticks preserve the lobby, modal and tooltip across the automatic bot deadline", async ({ browser }) => {
  const account = await registerAccount(`tick_${Date.now()}`);
  await saveDeck(account.token, account.rev);
  const page = await signedInPage(browser, account.token);
  await page.route("**/api/arena/history", route => route.fulfill({ json: { entries: [] } }));
  await enterArena(page);
  await page.evaluate(() => {
    const scene = (window as any).__vn.game.scene.getScene("arena");
    scene.reducedMotion = false;
    scene.queued = true; scene.pending = false; scene.waitingSeconds = 54; scene.render();
  });
  await clickArenaAction(page, "arena_history");
  await expect.poll(() => page.evaluate(() => (window as any).__vn.game.scene.getScene("arena").history?.length)).toBe(0);
  const result = await page.evaluate(() => {
    const s = (window as any).__vn.game.scene.getScene("arena");
    const back = s.root.list[0], modal = s.root.getByName("arena_modal");
    const halo = s.queueBody.getByName("arena_queue_halo"), pulse = s.tweens.getTweensOf(halo)[0];
    s.tip(back, ["Thông tin đang đọc"]);
    const tooltip = s.tooltip;
    for (const waitingSeconds of [59, 60, 64]) s.onMessage({ type: "queue.status", mode: "ranked", waitingSeconds });
    return { sameBack: s.root.list[0] === back, sameModal: s.root.getByName("arena_modal") === modal,
      sameTooltip: s.tooltip === tooltip && !!tooltip.scene, wait: s.waitingSeconds,
      samePulse: !!pulse && s.tweens.getTweensOf(halo)[0] === pulse, pulses: s.tweens.getTweensOf(halo).length,
      countdown: s.queueBody.getByName("arena_queue_fallback").getByName("arena_queue_countdown").text,
      noPracticeSwitch: !s.queueBody.getByName("arena_queue_practice") };
  });
  expect(result).toEqual({ sameBack: true, sameModal: true, sameTooltip: true, wait: 64, samePulse: true, pulses: 1,
    countdown: "Đang ghép với đối thủ máy…", noPracticeSwitch: true });
  await clickArenaAction(page, "arena_modal_close");
  await clickArenaAction(page, "arena_queue_cancel");
  await expect.poll(() => page.evaluate(() => (window as any).__vn.game.scene.getScene("arena").queued)).toBe(false);
  const staticPulseCount = await page.evaluate(() => {
    const s = (window as any).__vn.game.scene.getScene("arena");
    s.reducedMotion = true; s.queued = true; s.render();
    return s.tweens.getTweensOf(s.queueBody.getByName("arena_queue_halo")).length;
  });
  expect(staticPulseCount).toBe(0);
  await page.evaluate(() => {
    const s = (window as any).__vn.game.scene.getScene("arena");
    s.pending = true; s.render();
    s.onMessage({ type: "queue.status", mode: "ranked", waitingSeconds: 2 });
    s.scene.start = (key: string) => { (window as any).__arenaRoute = key; };
  });
  await clickArenaAction(page, "arena_honor_shop");
  await expect.poll(() => page.evaluate(() => (window as any).__arenaRoute)).toBe("shop");
  const failedLaunch = await page.evaluate(() => {
    const s = (window as any).__vn.game.scene.getScene("arena");
    s.pending = true;
    s.onMessage({ type: "error", error: "match unavailable" });
    return { queued: s.queued, pending: s.pending, error: s.error, countdownRemoved: s.queueBody === null,
      contentHasCountdown: !!s.root.getByName("arena_mode_content").getByName("arena_queue_fallback") };
  });
  expect(failedLaunch).toEqual({ queued: false, pending: false, error: "Lỗi: Không thể mở trận — hãy tìm trận lại",
    countdownRemoved: true, contentHasCountdown: false });
});

test("saved deck selector scrolls and selects by ID, queue locks edits and preserves errors", async ({ browser }) => {
  const account = await registerAccount(`ui_${Date.now()}`);
  await saveDeck(account.token, account.rev);
  const page = await signedInPage(browser, account.token);
  await enterArena(page);
  await page.evaluate(() => {
    const { session, game } = (window as any).__vn;
    const deck = session.profile.decks[0];
    session.profile.decks = Array.from({ length: 25 }, (_, i) => ({ ...structuredClone(deck), id: `ui${i}`, name: `Deck ${i} tên dài để kiểm tra khả năng đọc` }));
    session.selectedDeckId = "ui0";
    const arena = game.scene.getScene("arena"); arena.deckIndex = 0; arena.render();
    session.net.send = (message: any) => { ((window as any).__arenaSent ??= []).push(message); };
  });
  await clickArenaAction(page, "arena_deck_change");
  await expect(page.locator("#vn-arena-search")).toBeVisible();
  await expect(page.locator("#vn-arena-search")).toBeFocused();
  await clickArenaAction(page, "arena_scroll_next");
  await clickArenaAction(page, "arena_deck_ui8");
  await expect.poll(() => page.evaluate(() => (window as any).__vn.session.selectedDeckId)).toBe("ui8");
  await expect(page.locator("#vn-arena-search")).toHaveCount(0);
  await clickArenaAction(page, "arena_ranked_start");
  await clickArenaAction(page, "arena_deck_change");
  await expect(page.locator("#vn-arena-search")).toHaveCount(0);
  await page.evaluate(() => {
    const scene = (window as any).__vn.game.scene.getScene("arena");
    scene.onMessage({ type: "error", error: "already in queue" });
    scene.onMessage({ type: "queue.status", waitingSeconds: 84, mode: "ranked" });
  });
  await expect.poll(() => page.evaluate(() => (window as any).__vn.game.scene.getScene("arena").error)).toContain("hàng chờ");
  await clickArenaAction(page, "arena_mode_practice");
  expect(await page.evaluate(() => (window as any).__arenaSent.map((m: any) => m.type))).toEqual(["queue.join", "queue.leave"]);
});

test("modal rows remain reachable and room input cleans up on mode switch and shutdown", async ({ browser }) => {
  const account = await registerAccount(`modal_${Date.now()}`);
  await saveDeck(account.token, account.rev);
  const page = await signedInPage(browser, account.token);
  await page.route("**/api/arena/history", route => route.fulfill({ json: { entries: Array.from({ length: 40 }, (_, i) => ({ matchId: `${i}`, mode: "ranked", opponent: `Opponent ${i}`, result: "won", ratingDelta: 20, createdAt: Date.now() })) } }));
  await enterArena(page);
  await clickArenaAction(page, "arena_history");
  await expect.poll(() => page.evaluate(() => (window as any).__vn.game.scene.getScene("arena").history?.length)).toBe(40);
  for (let i = 0; i < 4; i++) await clickArenaAction(page, "arena_scroll_next");
  await expect.poll(() => page.evaluate(() => (window as any).__vn.game.scene.getScene("arena").modalScroller.first)).toBeGreaterThan(20);
  await clickArenaAction(page, "arena_modal_close");
  await clickArenaAction(page, "arena_mode_private");
  const input = page.locator("#vn-arena-room-code");
  await expect(input).toBeFocused();
  await input.fill("k7q2mxmore");
  await expect(input).toHaveValue("K7Q2MX");
  await page.keyboard.press("Escape");
  await expect(input).toHaveCount(0);
  await clickArenaAction(page, "arena_mode_private");
  await page.evaluate(() => (window as any).__vn.game.scene.getScene("arena").scene.start("deck-select"));
  await expect(input).toHaveCount(0);
});

test("keyboard focus survives queue status and modal API redraws", async ({ browser }) => {
  const account = await registerAccount(`focus_${Date.now()}`);
  await saveDeck(account.token, account.rev);
  const page = await signedInPage(browser, account.token);
  await enterArena(page);
  const focus = () => page.evaluate(() => (window as any).__vn.game.scene.getScene("arena").controls.focused?.hit.name ?? "");
  const goTo = async (name: string) => {
    for (let i = 0; i < 40 && await focus() !== name; i++) await page.keyboard.press("Tab");
    await expect.poll(focus).toBe(name);
  };
  await goTo("arena_back");
  await expect.poll(focus).toBe("arena_back");
  await page.evaluate(() => {
    const scene = (window as any).__vn.game.scene.getScene("arena");
    scene.queued = true; scene.onMessage({ type: "queue.status", mode: "ranked", waitingSeconds: 84 });
  });
  await expect.poll(focus).toBe("arena_back");
  await page.evaluate(() => { const scene = (window as any).__vn.game.scene.getScene("arena"); scene.queued = false; scene.render(); });
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/arena/history", async route => { await held; await route.fulfill({ json: { entries: [] } }); });
  await clickArenaAction(page, "arena_history");
  await page.keyboard.press("Tab");
  await expect.poll(focus).toBe("arena_modal_close");
  release();
  await expect.poll(() => page.evaluate(() => (window as any).__vn.game.scene.getScene("arena").history?.length)).toBe(0);
  await expect.poll(focus).toBe("arena_modal_close");
  await page.keyboard.press("Enter");
  await expect.poll(() => page.evaluate(() => (window as any).__vn.game.scene.getScene("arena").panel)).toBeNull();
  await expect.poll(focus).toBe("arena_history");
  await goTo("arena_deck_change");
  await page.keyboard.press("Enter");
  const search = page.locator("#vn-arena-search");
  await expect(search).toBeFocused();
  await page.keyboard.type("Đấu");
  await page.keyboard.press("Tab");
  await expect(search).not.toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(search).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(search).toHaveCount(0);
  await expect.poll(focus).toBe("arena_deck_change");
  await goTo("arena_mode_private");
  await page.keyboard.press("Enter");
  const code = page.locator("#vn-arena-room-code");
  await expect(code).toBeFocused();
  await page.keyboard.type("k7q2mx");
  await expect(code).toHaveValue("K7Q2MX");
  await page.keyboard.press("Tab");
  await expect.poll(focus).toBe("arena_room_join");
  await page.keyboard.press("Shift+Tab");
  await expect(code).toBeFocused();
  await page.evaluate(() => {
    const { session } = (window as any).__vn;
    session.net.send = (message: any) => { ((window as any).__keyboardSent ??= []).push(message); };
  });
  await page.keyboard.press("Enter");
  expect(await page.evaluate(() => (window as any).__keyboardSent[0].type)).toBe("room.join");
  await page.evaluate(() => (window as any).__vn.game.scene.getScene("arena").onMessage({ type: "error", error: "room not found" }));
  await expect(code).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(code).toHaveCount(0);
});
