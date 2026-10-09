import { closeMultiplayerPages, enterMultiplayer, registerAccount, saveDeck, signedInPage } from "./helpers/multiplayer";
import { expect, test, type Page } from "@playwright/test";
import { waitForScene, clickSceneText, activeSceneKey as sceneKey, clickDesign } from "./helpers/combat";


test.afterEach(closeMultiplayerPages);

/**
 * `16` §8.4 e2e — a match settlement outlives the combat scene: resigning in a
 * practice match, leaving for the lobby, and a duplicated terminal frame.
 * Canvas UI is not DOM-readable, so the test probes `window.__vn` (main.ts dev
 * handle); `session.registry` internals are runtime-visible despite `private`.
 */

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

  await enterMultiplayer(page, "arena");
  await expect.poll(() => sceneKey(page), { timeout: 60_000 }).toBe("arena");
  await clickDesign(page, 400, 518); // "Đấu Tập (máy)"
  await waitForScene(page, "combat");
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
  await expect.poll(async () => tombstoned(page, matchId), { timeout: 30_000 }).toBe(true);

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
