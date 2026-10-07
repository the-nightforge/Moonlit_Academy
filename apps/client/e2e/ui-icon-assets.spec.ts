import { expect, test } from "@playwright/test";
import { setupOfflineCombat } from "./helpers/combat";

test("UI icon textures load and preserve combat display sizes", async ({ page }) => {
  const responses = new Map<string, { status:number; contentType:string }>();
  page.on("response", response => {
    const path = new URL(response.url()).pathname;
    if (path.startsWith("/assets/ui/")) responses.set(path, {
      status:response.status(), contentType:response.headers()["content-type"] ?? "",
    });
  });
  await page.route("**/api/health", route => route.fulfill({ status:503, contentType:"application/json", body:'{"ok":false}' }));
  await page.setViewportSize({ width:1280, height:720 });
  await setupOfflineCombat(page);
  const loaded = await page.evaluate(async () => {
    const h = (window as any).__vn, s = h.game.scene.getScene("combat");
    const manifest = (await import("/@id/__x00__virtual:assets-manifest")).default;
    return Object.entries(manifest.ui).map(([key,url]) => {
      const source = s.textures.get(`ui:${key}`).getSourceImage();
      return { key, url, width:source.width, height:source.height };
    });
  });
  expect(loaded).toHaveLength(54);
  for (const icon of loaded) {
    expect(icon.url).toBe(`/assets/ui/${icon.key}.webp`);
    const response = responses.get(`/assets/ui/${icon.key}.webp`);
    expect(response?.status).toBe(200);
    expect(response?.contentType).toContain("image/webp");
    expect([256, 96]).toContain(icon.width); expect(icon.height).toBe(icon.width);
  }
  await page.evaluate(() => {
    const h = (window as any).__vn, s = h.game.scene.getScene("combat");
    h.session.state.heroes[0].statuses = [{ id:"charm", value:2 }, { id:"strength", value:2 }];
    h.session.state.heroes[1].statuses = [{ id:"freeze", value:1 }, { id:"guard", value:2 }];
    h.session.state.heroes[2].statuses = [{ id:"regen", value:2 }, { id:"mark", value:1 }];
    s.requestRender();
  });
  const sizes = await page.evaluate(() => {
    const s = (window as any).__vn.game.scene.getScene("combat"), nodes:any[] = [];
    const walk=(list:any[])=>list.forEach(n=>{ nodes.push(n); if(n.list) walk(n.list); });
    walk(s.children.list);
    const icon = nodes.find(n=>n.name === "card_emblem_icon");
    const emitter = nodes.find(n=>n.type === "ParticleEmitter" && n.texture?.key === "ui:status_charm");
    emitter.emitParticle(1);
    const particles = emitter.alive;
    return { glyph:icon?.displayWidth, particleWidth:particles.at(-1).scaleX * emitter.texture.getSourceImage().width };
  });
  expect(sizes.glyph).toBe(14); expect(sizes.particleWidth).toBeCloseTo(14, 1);
  await page.screenshot({ path:"../../.sdd-work/ui-icon-assets/combat-ui-icons.png" });
});
