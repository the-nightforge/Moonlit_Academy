import { reloadSignedIn, closeMultiplayerPages, enterMultiplayer, api, registerAccount, saveDeck, signedInPage } from "./helpers/multiplayer";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { waitForScene, clickSceneText, activeSceneKey as sceneKey, clickDesign } from "./helpers/combat";


test.afterEach(closeMultiplayerPages);

/**
 * `17` §7.1 e2e — ranked queue between two real clients, the full match,
 * rating/Vinh Dự settlement, then one Vinh Dự shop purchase. The canvas UI is
 * not DOM-readable, so the test drives Phaser through `window.__vn`.
 *
 * Vinh Dự is capped at 120/day (§6.4) while the cheapest shop item costs 150 —
 * a first-day purchase is impossible by design, so the test tops the winner's
 * balance up in an explicitly selected disposable/dev database before buying.
 */
const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../server");

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

test("xếp hạng: vào hàng chờ, đấu xong trận, điểm + Vinh Dự đổi, mua ở cửa hàng Vinh Dự", async ({ browser }) => {
  // Seven clients plus the winner's reload preload the full assets on Vite.
  // Keep each step bounded while allowing the six-match scenario to finish.
  test.setTimeout(600_000);
  const stamp = Date.now();
  const winnerName = `e2e_w_${stamp}`;
  const winner = await registerAccount(winnerName);
  await saveDeck(winner.token, winner.rev);
  const pageW = await signedInPage(browser, winner.token, "Arena");
  await enterMultiplayer(pageW, "arena");

  // Six ranked wins vs six fresh opponents — ranked blocks rematches for
  // 10 min, so every match needs a new account. 6 × 20 hits the 120/day cap.
  const WINS = 6;
  for (let i = 0; i < WINS; i++) {
    console.info("Ranked win attempt", i + 1, "elapsed ms", Date.now() - stamp);
    const loser = await registerAccount(`e2e_l${i}_${stamp}`);
    await saveDeck(loser.token, loser.rev);
    const pageL = await signedInPage(browser, loser.token, "Arena");
    await enterMultiplayer(pageL, "arena");

    await clickDesign(pageW, 400, 470); // "Xếp hạng"
    await clickDesign(pageL, 400, 470);
    await waitForScene(pageW, "combat");
    await waitForScene(pageL, "combat");

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

    await clickSceneText(pageW, "combat", "Về Đấu Trường");
    await expect.poll(() => sceneKey(pageW), { timeout: 60_000 }).toBe("arena");
    await pageL.context().close();
    console.info("Ranked win settled", i + 1, "elapsed ms", Date.now() - stamp);
  }

  const me = await api("/api/arena/me", { token: winner.token });
  const arena = me.body.arena as { wins: number; rating: number };
  expect(arena.wins).toBe(WINS);
  expect(arena.rating).toBeGreaterThan(1000);
  expect((me.body.honorToday as { gained: number }).gained).toBe(120); // daily cap (§6.4)
  console.info("Six wins and daily cap verified; elapsed ms", Date.now() - stamp);

  // The cap makes a day-one purchase impossible. The review fixture owns its
  // test-only endpoint; ordinary runs require an explicit dedicated dev DB.
  if (process.env.COMBAT_REVIEW_FIXTURE === "1") {
    const toppedUp = await api("/__review/honor", {
      method:"POST",
      body:JSON.stringify({username:winnerName,honor:200}),
    });
    expect(toppedUp.status).toBe(200);
  } else {
    if (!process.env.COMBAT_E2E_DATABASE_URL) throw new Error("Set COMBAT_E2E_DATABASE_URL to the dedicated PostgreSQL database used by the dev API");
    execFileSync(
    process.execPath,
    [
      "--input-type=module", "-e",
      `import postgres from "postgres";
       const sql = postgres(process.env.COMBAT_E2E_DATABASE_URL, {max:1});
       try {
         const changed = await sql.unsafe("UPDATE profiles SET profile_json = jsonb_set(profile_json::jsonb, '{currencies,honor}', '200'::jsonb)::text, rev = rev + 1 WHERE account_id = (SELECT id FROM accounts WHERE username = $1) RETURNING account_id", [process.argv[1]]);
         if (changed.length !== 1) throw new Error("expected one dev fixture account");
       } finally { await sql.end(); }`,
      winnerName,
    ],
    { cwd: SERVER_DIR },
    );
  }

  // Reload → fresh profile with the topped-up Vinh Dự → arena → Vinh Dự shop.
  await reloadSignedIn(pageW);
  await enterMultiplayer(pageW, "arena");
  // Welcome may enqueue recovery of the retained completed room. Let the
  // scene manager apply that transition before navigating toward the shop.
  await pageW.evaluate(() => new Promise<void>(resolve => (window as any).__vn.game.events.once("poststep", () => resolve())));
  await expect.poll(() => sceneKey(pageW), {timeout:60_000}).toMatch(/^(arena|combat)$/);
  if (await sceneKey(pageW) === "combat") {
    expect((await vn(pageW))?.ended?.result).toBe("won");
    await clickSceneText(pageW, "combat", "Về Đấu Trường");
    await expect.poll(() => sceneKey(pageW)).toBe("arena");
  }
  await clickSceneText(pageW, "arena", "Cửa hàng Vinh Dự");
  await expect.poll(() => sceneKey(pageW), { timeout: 60_000 }).toBe("shop");
  console.info("Reload recovery and shop entry verified; elapsed ms", Date.now() - stamp);

  const before = await api("/api/profile", { token: winner.token });
  const jadeBefore = (before.body.profile as { currencies: { moonJade: number } }).currencies.moonJade;
  await clickDesign(pageW, 1020, 170); // "Mua" — vé kéo 160 Ngọc (150 Vinh Dự)
  // In-game confirm dialog: Enter picks its default action ("Mua").
  await pageW.waitForFunction(() => (window as unknown as { __vn: { isModalOpen(): boolean } }).__vn.isModalOpen());
  await pageW.keyboard.press("Enter");
  await expect
    .poll(async () => {
      const reply = await api("/api/profile", { token: winner.token });
      const currencies = (reply.body.profile as { currencies: { moonJade: number; honor: number } }).currencies;
      return currencies.moonJade === jadeBefore + 160 && currencies.honor === 50;
    }, { timeout: 15_000 })
    .toBe(true);
  console.info("Honor shop purchase verified; elapsed ms", Date.now() - stamp);
});
