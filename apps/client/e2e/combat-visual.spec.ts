import { expect, test, type Page } from "@playwright/test";
import {
  captureCombat,
  clickDesign,
  probeCombat,
  sceneTexts,
  waitIdle,
} from "./helpers/combat";
import { openCombatScene } from "./helpers/online";

/**
 * `05` review U6 — visual/layout regression across the four pinned viewports.
 * Signed-in session on the synthetic session state — enough for layout, since
 * these specs never dispatch wire actions. Real PvP/co-op coverage lives in
 * `pvp.spec.ts`/`coop.spec.ts`.
 */
const VIEWPORTS = [
  { name: "1280x720", width: 1280, height: 720 },
  { name: "1366x768", width: 1366, height: 768 },
  { name: "1024x576", width: 1024, height: 576 },
  { name: "1280x900", width: 1280, height: 900 },
] as const;

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    // Resource-load failures are tolerated (fonts, optional assets).
    if (message.type() === "error" && !message.text().includes("Failed to load resource")) {
      errors.push(message.text());
    }
  });
  return errors;
}

test.describe("combat visual matrix (online session)", () => {
  for (const vp of VIEWPORTS) {
    test(`board + idle invariants @ ${vp.name}`, async ({ page }) => {
      const errors = collectErrors(page);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await openCombatScene(page, "default");
      const probe = await probeCombat(page);
      expect(probe.busy).toBe(false);
      expect(probe.inputLocked).toBe(false);
      expect(probe.temporaryFxCount).toBe(0);
      // Units never spill into the right control band (layout right edge ~1154).
      for (const unit of probe.units) {
        expect(unit.bounds.x + unit.bounds.w, `${unit.id} right edge`).toBeLessThanOrEqual(1160);
        expect(unit.bounds.x, `${unit.id} left edge`).toBeGreaterThanOrEqual(0);
      }
      expect(probe.handCount).toBe(6); // combatConfig.handSize
      // Moon schedule + own seat visible in every viewport.
      expect(probe.texts.some((t) => t.includes("của bạn") || /Nguyệt/.test(t))).toBe(true);
      await captureCombat(page, vp.name, "default");
      expect(errors).toEqual([]);
    });

    test(`hand sizes 0/1/8/10 @ ${vp.name}`, async ({ page }) => {
      const errors = collectErrors(page);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const [scenario, expected] of [
        ["hand0", 0],
        ["hand1", 1],
        ["hand8", 8],
        ["hand10", 10],
      ] as const) {
        await openCombatScene(page, scenario);
        const probe = await probeCombat(page);
        expect(probe.handCount, scenario).toBe(expected);
        expect(probe.temporaryFxCount).toBe(0);
        await captureCombat(page, vp.name, scenario);
      }
      expect(errors).toEqual([]);
    });
  }

  test("denseStatus: 13 badges + seal overflow without clipping controls", async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await openCombatScene(page, "denseStatus");
    const probe = await probeCombat(page);
    // The hero carries the full status set; the badge row shows the +N overflow.
    expect(probe.texts.some((t) => /^\+\d+$/.test(t))).toBe(true);
    for (const unit of probe.units) {
      expect(unit.bounds.x + unit.bounds.w, `${unit.id}`).toBeLessThanOrEqual(1160);
    }
    await captureCombat(page, "1280x720", "denseStatus");
    expect(errors).toEqual([]);
  });

  test("longChoice: Chọn Pha panel opens, folds to banner, reopens", async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await openCombatScene(page, "longChoice");
    let texts = await sceneTexts(page, "combat");
    expect(texts.some((t) => t.includes("Chọn Pha") || t.includes("Giữ pha"))).toBe(true);
    await captureCombat(page, "1280x720", "longChoice-open");
    // Esc folds the mandatory choice to a reopen banner rather than cancelling it.
    await page.keyboard.press("Escape");
    await expect
      .poll(async () => (await sceneTexts(page, "combat")).some((t) => t.includes("bấm để mở lại")))
      .toBe(true);
    await captureCombat(page, "1280x720", "longChoice-folded");
    // The banner reopens the panel on click.
    const before = await probeCombat(page);
    await clickDesign(page, 640, 24);
    await expect
      .poll(async () => (await sceneTexts(page, "combat")).some((t) => t.includes("Chọn Pha") || t.includes("Giữ pha")))
      .toBe(true);
    expect(before.temporaryFxCount).toBe(0);
    expect(errors).toEqual([]);
  });

  test("summonRevive: summon card + fallen hero render together", async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await openCombatScene(page, "summonRevive");
    const probe = await probeCombat(page);
    expect(probe.units.some((u) => u.id === "e2e_summon_1")).toBe(true);
    expect(probe.texts).toContain("Ngã");
    for (const unit of probe.units) {
      expect(unit.bounds.x + unit.bounds.w, `${unit.id}`).toBeLessThanOrEqual(1160);
    }
    await captureCombat(page, "1280x720", "summonRevive");
    expect(errors).toEqual([]);
  });

  test("playback lock: input stays down while a batch plays", async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await openCombatScene(page, "default");
    // endTurn enqueues the enemy-turn batch synchronously — reading the busy
    // flag in the same evaluate is deterministic (no sleep, no race).
    const locked = await page.evaluate(() => {
      const handle = (
        window as unknown as {
          __vn: {
            game: {
              scene: {
                getScene(k: string): { dispatch(a: unknown): void; playback?: { busy: boolean }; inputLocked: boolean } | undefined;
              };
            };
          };
        }
      ).__vn;
      const scene = handle.game.scene.getScene("combat")!;
      scene.dispatch({ type: "endTurn" });
      return scene.playback?.busy === true || scene.inputLocked;
    });
    expect(locked).toBe(true);
    await waitIdle(page, 60_000); // a full enemy chain is several beats
    // The turn cycled: playerTurn again means the full batch played.
    const status = await page.evaluate(
      () =>
        (window as unknown as { __vn: { session: { state: { status: string } } } }).__vn.session.state
          .status,
    );
    expect(["playerTurn", "enemyTurn"]).toContain(status);
    expect(errors).toEqual([]);
  });

  test("pile inspector: draw pile opens count-only, Esc closes", async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await openCombatScene(page, "default");
    // Own draw pile anchor per the shared layout (seat 0: 54,424).
    await clickDesign(page, 54, 424);
    await expect
      .poll(async () => (await sceneTexts(page, "combat")).some((t) => t.includes("Chồng rút")))
      .toBe(true);
    await captureCombat(page, "1280x720", "pile-draw");
    // Draw order is never enumerated — only the secrecy note shows (the body
    // is one Text node with \n-joined lines, so match inside it).
    const texts = await sceneTexts(page, "combat");
    expect(texts.some((t) => t.includes("giữ kín"))).toBe(true);
    await page.keyboard.press("Escape");
    await expect
      .poll(async () => (await sceneTexts(page, "combat")).some((t) => t.includes("Chồng rút")))
      .toBe(false);
    expect(errors).toEqual([]);
  });

  test("bloodMoon: the lasting look — blood-moon icon, corona, edge vignette", async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await openCombatScene(page, "bloodMoon");
    await waitIdle(page);
    // The surge has played out; only the persistent dressing remains.
    const dressed = await page.evaluate(() => {
      const handle = (window as unknown as { __vn: { game: { scene: { getScene(k: string): { children: { list: unknown[] } } | undefined } } } }).__vn;
      const scene = handle.game.scene.getScene("combat");
      const found: { names: string[]; moonTexture?: string } = { names: [] };
      const walk = (list: unknown[] | undefined) => {
        list?.forEach((node) => {
          const n = node as { name?: string; list?: unknown[]; texture?: { key?: string } };
          if (n.name) found.names.push(n.name);
          if (n.name === "moon_current") found.moonTexture = n.texture?.key;
          if (Array.isArray(n.list)) walk(n.list);
        });
      };
      walk(scene?.children.list);
      return found;
    });
    // The socket shows the dedicated blood-moon icon — not the phase glyph —
    // and no round-count badge is rendered by design.
    expect(dressed.moonTexture).toBe("ui:moon_blood");
    expect(dressed.names).toContain("moon_blood_corona");
    expect(dressed.names).not.toContain("moon_blood");
    await captureCombat(page, "1280x720", "bloodMoon");
    expect(errors).toEqual([]);
  });
});
