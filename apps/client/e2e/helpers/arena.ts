import { expect, type Page } from "@playwright/test";
import { clickDesign, clickSceneText, waitForScene } from "./combat";

/** Stable hit names work for both text and raster icon controls. */
export async function clickArenaAction(page: Page, name: string) {
  const point = () => page.evaluate((name) => {
    const scene = (window as any).__vn?.game.scene.getScene("arena");
    const find = (list: any[]): any => {
      for (const node of list) {
        if (node.name === name && node.input && node.scene) return node;
        if (node.list) { const match = find(node.list); if (match) return match; }
      }
      return null;
    };
    const hit = find(scene?.root?.list ?? []);
    if (!hit) return null;
    const b = hit.getBounds(); return { x: b.centerX, y: b.centerY };
  }, name);
  await expect.poll(point, { timeout: 60_000 }).not.toBeNull();
  const p = (await point())!;
  await clickDesign(page, p.x, p.y);
}

export async function selectArenaDeck(page: Page, prefix: string) {
  await clickArenaAction(page, "arena_deck_change");
  await page.locator("#vn-arena-search").fill(prefix);
  const id = await page.evaluate(prefix => (window as any).__vn.session.profile.decks.find((deck: any) => deck.name.startsWith(prefix))?.id ?? null, prefix);
  expect(id).not.toBeNull();
  await clickArenaAction(page, `arena_deck_${id}`);
}

export async function enterArena(page: Page) {
  await waitForScene(page, "deck-select");
  await clickSceneText(page, "deck-select", "Đấu Trường");
  await page.waitForFunction(() => {
    const { game, session } = (window as any).__vn;
    const key = game.scene.getScenes(true)[0]?.scene.key;
    return (key === "arena" && session.net?.connected) || (key === "combat" && session.match);
  }, undefined, { timeout: 90_000 });
  if (await page.evaluate(() => (window as any).__vn.game.scene.getScenes(true)[0]?.scene.key) === "combat") return;
  if (await page.evaluate(() => (window as any).__vn.game.scene.getScene("arena").deckIndex) < 0) await selectArenaDeck(page, "");
  await expect.poll(() => page.evaluate(() => (window as any).__vn.game.scene.getScene("arena").assetState), { timeout: 60_000 }).toBe("ready");
}
