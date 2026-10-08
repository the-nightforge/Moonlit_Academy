import { expect, test, type Page } from "@playwright/test";
import { applyAction, createCoopCombat } from "rules";
import { clickDesign, waitIdle } from "./helpers/combat";
import { openCombatScene } from "./helpers/online";

const OUT = "../../.sdd-work/combat-ui-refinement";
async function moveDesign(page: Page, x: number, y: number) {
  const box = (await page.locator("canvas").boundingBox())!;
  const scale = Math.min(box.width / 1280, box.height / 720);
  await page.mouse.move(box.x + (box.width - 1280 * scale) / 2 + x * scale, box.y + (box.height - 720 * scale) / 2 + y * scale);
}

async function tooltipProbe(page: Page) {
  return page.evaluate(() => {
    const s = (window as any).__vn.game.scene.getScene("combat"), tip = s.tooltip;
    if (!tip) return null;
    const texts: string[] = [];
    const walk = (nodes: any[]) => nodes.forEach(n => { if (n.type === "Text") texts.push(n.text); if (n.list) walk(n.list); });
    walk(tip.list);
    const b = tip.getBounds(), panel = tip.list[0].getBounds(), v = s.cameras.main.worldView;
    return { text: texts.join("\n"), panel: { left: panel.left, right: panel.right, top: panel.top, bottom: panel.bottom }, visible: { left: v.x, right: v.right, top: v.y, bottom: v.bottom }, font: tip.list.find((n: any) => n.type === "Text")?.style.fontSize, bounds: { left: b.left, right: b.right, top: b.top, bottom: b.bottom } };
  });
}

async function assertFooter(page: Page, expectedWidth: number) {
  const units = await page.evaluate(() => {
    const s = (window as any).__vn.game.scene.getScene("combat");
    const probe = (u: any, expectedHp: string, alive: boolean) => {
      const v = s.unitViews.get(u.id), spec = s.unitSpecs.get(u.id);
      const name = v.getByName("unit_name"), hp = v.getByName("unit_hp"), weapon = v.getByName("unit_weapon");
      const n = name.getBounds(), w = weapon?.getBounds();
      const shield = v.list.find((node: any) => node.texture?.key === "hud_shield"), sb = shield?.getBounds();
      return { width: spec.w, name: name.text, nameFont: name.style.fontSize, nameCentered: Math.abs(n.centerX - v.x) < 1.5, progressGone: v.getByName("unit_progress") === null,
        hp: hp?.text, expectedHp, hearts: v.list.filter((node: any) => node.texture?.key === "hud_heart").length,
        armor: sb ? { dx: sb.centerX - (v.x - spec.w / 2 + 17), dy: sb.centerY - (v.y - spec.h / 2 + 17) } : null,
        weaponClear: !w || w.bottom < n.top, weaponBelowArmor: !w || !sb || w.top > sb.bottom - 2,
        weaponAnchor: weapon ? [...s.triggerAnchors.values()].some((a: any) => a.x === w.centerX && a.y === w.centerY) : true, alive };
    };
    return {
      heroes: s.state.heroes.map((h: any) => probe(h, `${h.hp}/${h.maxHp}`, h.alive)),
      enemies: s.state.enemies.map((e: any) => probe(e, `${e.hp}/${e.maxHp}`, e.alive)),
    };
  });
  for (const unit of [...units.heroes, ...units.enemies]) {
    expect(unit.name.length).toBeGreaterThan(0); expect(unit.nameCentered).toBe(true);
    expect(unit.nameFont).toBe("11px"); expect(unit.progressGone).toBe(true);
    if (unit.armor) { expect(Math.abs(unit.armor.dx)).toBeLessThan(2); expect(Math.abs(unit.armor.dy)).toBeLessThan(2); }
    expect(unit.weaponClear).toBe(true); expect(unit.weaponBelowArmor).toBe(true); expect(unit.weaponAnchor).toBe(true);
  }
  for (const unit of units.heroes) {
    expect(unit.width).toBe(expectedWidth); expect(unit.hearts).toBe(0); expect(unit.hp).toBe(unit.expectedHp);
  }
}

for (const viewport of [{ width: 1280, height: 720 }, { width: 1024, height: 576 }]) {
  test(`mulligan, portraits, awakening details and current/next moon @ ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openCombatScene(page, "default", { keepMulligan: true });
    const opening = await page.evaluate(() => {
      const s = (window as any).__vn.game.scene.getScene("combat"), banner = s.root.getByName("mulligan_banner").getBounds();
      const rects = [...s.unitViews.values(), ...s.cardViews.values()].map((v: any) => v.getBounds());
      const overlaps = rects.some((b: any) => banner.left < b.right && b.left < banner.right && banner.top < b.bottom && b.top < banner.bottom);
      const card: any = [...s.cardViews.values()][0];
      return { overlaps, top: banner.top, bottom: banner.bottom, card: { x: card.x, y: card.y + 55 } };
    });
    expect(opening.overlaps).toBe(false); expect(opening.top).toBeGreaterThanOrEqual(60); expect(opening.bottom).toBeLessThanOrEqual(92);
    await page.screenshot({ path: `${OUT}/mulligan-${viewport.width}.png` });
    await clickDesign(page, opening.card.x, opening.card.y);
    await expect.poll(() => page.evaluate(() => (window as any).__vn.game.scene.getScene("combat").mulliganPicks.size)).toBe(1);
    const swap = await page.evaluate(() => {
      const s = (window as any).__vn.game.scene.getScene("combat"), v: any = [...s.cardViews.values()].find((v: any) => v.getByName("card_swap_gate"));
      return { radius: v.getByName("card_swap_gate").radius, size: v.getByName("card_swap_icon").displayWidth };
    });
    expect(swap.radius).toBe(22); expect(swap.size).toBe(24);
    await moveDesign(page, 40, 690);
    await page.screenshot({ path: `${OUT}/mulligan-picked-${viewport.width}.png` });
    const action = await page.evaluate(async () => {
      const s = (window as any).__vn.game.scene.getScene("combat"), { endTurnAnchor } = await import("/src/ui/combat-layout.ts");
      return endTurnAnchor(s.layout);
    });
    await clickDesign(page, action.x, action.y);
    await expect.poll(() => page.evaluate(() => (window as any).__vn.session.state.status)).toBe("playerTurn");
    await waitIdle(page);
    await page.evaluate(() => {
      const h = (window as any).__vn, s = h.game.scene.getScene("combat"), state = h.session.state;
      state.players[0].weapons = [{ heroId: state.heroes[0].defId, weaponId: "w_xich_diem_thuong", refinement: 2 }];
      state.heroes[0].armor = 4; state.heroes[0].constellation = 5; state.heroes[0].levelUpCounter = 2;
      state.summons = [{ id: "refinement_summon", defId: "tho_ngoc", summonId: "tho_ngoc", side: "hero", player: 0, ownerHeroId: state.heroes[0].id, position: 0, hp: 7, maxHp: 12, armor: 0, statuses: [], alive: true }];
      state.moonIndex = 7; state.bloodMoonRounds = 2;
      const id = state.players[0].hand[0]; h.session.data.cards[state.cards[id].cardId].text = "Một\nHai\nBa\nBốn";
      s.requestRender();
    });
    await assertFooter(page, 136);
    const chrome = await page.evaluate(async () => {
      const h = (window as any).__vn, s = h.game.scene.getScene("combat"), nodes: any[] = [];
      const { combatCardModel, cardOwnerLabel } = await import("/src/ui/combat-card-view.ts");
      const walk = (list: any[]) => list.forEach(n => { nodes.push(n); if (n.list) walk(n.list); }); walk(s.children.list);
      const cards = [...s.cardViews.entries()].map(([id, v]: any) => {
        const icon = v.getByName("card_emblem_icon"), art = v.getByName("card_art"), fallback = v.getByName("card_art_fallback_icon"), body = v.getByName("card_body");
        const label = cardOwnerLabel(combatCardModel(h.session.data, s.state, id));
        const b = body.getBounds();
        return { icon: icon?.displayWidth, art: art?.displayWidth, fallback: fallback?.displayWidth, body: body.text, font: body.style.fontSize, startsWithOwner: body.text.startsWith(label), ownerGone: v.getByName("card_owner") === null, bodyTop: b.top, bodyBottom: b.bottom, bandTop: v.y - 25, bandBottom: v.y + 84 };
      });
      const canvas = s.textures.get("hud_card_face").getSourceImage(), ctx = canvas.getContext("2d");
      const pixel = ctx.getImageData(Math.round(10 * canvas.width / 124), Math.round(150 * canvas.height / 180), 1, 1).data;
      const summon = s.unitViews.get("refinement_summon");
      return { rail: nodes.filter(n => /^moon_phase_\d$/.test(n.name) || n.name === "moon_current_aura").length, blood: nodes.some(n => n.name === "moon_current" && n.texture?.key === "ui:moon_blood"), cards, oldPaperPixel: [...pixel], summonHp: summon.getByName("unit_hp").text, summonHearts: summon.list.filter((n: any) => n.texture?.key === "hud_heart").length };
    });
    expect(chrome.rail).toBe(0); expect(chrome.blood).toBe(true); expect(chrome.summonHp).toBe("7/12"); expect(chrome.summonHearts).toBe(0);
    expect(chrome.oldPaperPixel[0]).toBeLessThan(80);
    for (const card of chrome.cards) { if (card.icon) expect(card.icon).toBe(14); if (card.art) expect(card.art).toBe(114); if (card.fallback) expect(card.fallback).toBe(40); expect(["11px","10px","9px"]).toContain(card.font); expect(card.ownerGone).toBe(true); expect(card.startsWithOwner).toBe(true); expect(card.bodyTop).toBeGreaterThanOrEqual(card.bandTop); expect(card.bodyBottom).toBeLessThanOrEqual(card.bandBottom); }
    // The full rules text fits the band — "Một Hai Ba Bốn" shows unclipped.
    expect(chrome.cards.some(card => card.body.includes("Một") && card.body.includes("Bốn"))).toBe(true);
    await page.screenshot({ path: `${OUT}/battle-${viewport.width}.png` });
    // A hovered hand card raises smoothly but never reaches the hero row.
    const hover = await page.evaluate(() => {
      const s = (window as any).__vn.game.scene.getScene("combat");
      const heroRect = s.layout.units.get(s.state.heroes.find((h: any) => h.player === 0 && h.alive)!.id)!;
      const cx = heroRect.x + heroRect.w / 2;
      const [id, v] = [...s.cardViews.entries()].reduce((best: any, entry: any) =>
        Math.abs(entry[1].x - cx) < Math.abs(best[1].x - cx) ? entry : best);
      return { id, x: v.x, y: v.y, heroBottom: heroRect.y + heroRect.h };
    });
    await moveDesign(page, hover.x, hover.y);
    await expect
      .poll(async () => page.evaluate((id: string) => (window as any).__vn.game.scene.getScene("combat").cardViews.get(id)?.scaleX ?? 0, hover.id))
      .toBeGreaterThan(1.08);
    const raised = await page.evaluate((id: string) => {
      const v = (window as any).__vn.game.scene.getScene("combat").cardViews.get(id)!;
      return { top: v.getBounds().top, scale: v.scaleX };
    }, hover.id);
    expect(raised.top).toBeGreaterThanOrEqual(hover.heroBottom - 1);
    await moveDesign(page, 40, 690);
    const moon = await page.evaluate(() => {
      const s = (window as any).__vn.game.scene.getScene("combat"), n = s.moonLayer.list.find((n: any) => n.name === "moon_current");
      const state = s.state, data = s.gameData;
      return { x: n.x, y: n.y, phase: data.moonPhases[7], next: data.moonPhases[0], currentId: state.moonDecrees[7], nextId: state.moonDecrees[0] };
    });
    await moveDesign(page, moon.x, moon.y);
    await expect.poll(() => tooltipProbe(page)).not.toBeNull();
    const moonTip = (await tooltipProbe(page))!;
    // Huyết Nguyệt IS the current phase — the covered phase only shows as suppressed.
    expect(moonTip.text).toContain("Huyết Nguyệt — pha hiện tại");
    expect(moonTip.text).toContain(`${moon.phase.name} đang bị che`);
    // The next phase still previews fully — name, rolled decree, tag bonus.
    const nextDecree = moon.next.decrees.find((d: any) => d.id === moon.nextId)!;
    expect(moonTip.text).toContain(moon.next.name);
    expect(moonTip.text).toContain(nextDecree.name); expect(moonTip.text).toContain(nextDecree.text);
    expect(moonTip.text).toContain(moon.next.tagBonusText);
    expect(moonTip.text).toContain("pha kế tiếp");
    await page.screenshot({ path: `${OUT}/moon-current-next-${viewport.width}.png` });
    await moveDesign(page, 40, 690);
    for (const form of ["base", "alt"] as const) {
      const hero = await page.evaluate(form => {
        const h = (window as any).__vn, s = h.game.scene.getScene("combat"), hero = h.session.state.heroes[0];
        hero.levelUpForm = form; s.requestRender(); return { x: s.unitAnchors.get(hero.id).x + 20, y: s.unitAnchors.get(hero.id).y, def: h.session.data.heroes[hero.defId] };
      }, form);
      await moveDesign(page, hero.x, hero.y);
      await expect.poll(async () => (await tooltipProbe(page))?.text).toContain("Đang chọn");
      const tip = (await tooltipProbe(page))!;
      expect(tip.text).toContain(hero.def.levelUp.description); expect(tip.text).toContain(hero.def.altLevelUp.description);
      // Awakening-only tooltip — the unit-stat line is gone.
      expect(tip.text).not.toMatch(/HP \d/);
      expect(tip.text).toContain(`${(form === "base" ? hero.def.levelUp : hero.def.altLevelUp).name} — dạng ${form === "base" ? "cơ bản" : "thứ hai"} · Đang chọn`);
      expect(tip.text).toContain(`Thức Tỉnh: mất HP · 2/${hero.def.levelUp.constellationThreshold}`);
      expect(tip.panel.left).toBeGreaterThanOrEqual(tip.visible.left); expect(tip.panel.right).toBeLessThanOrEqual(tip.visible.right); expect(tip.panel.top).toBeGreaterThanOrEqual(tip.visible.top); expect(tip.panel.bottom).toBeLessThanOrEqual(tip.visible.bottom);
      await page.screenshot({ path: `${OUT}/hero-${form}-${viewport.width}.png` });
      await moveDesign(page, 40, 690);
    }
    // Exercise genuinely oversized text without rewriting any hero definition.
    const wheel = await page.evaluate(async () => {
      const s = (window as any).__vn.game.scene.getScene("combat"), { showTextTooltip } = await import("/src/ui/card-tooltip.ts");
      const before = s.input.listenerCount("wheel"), tip = showTextTooltip(s, 900, 500, Array.from({ length: 70 }, (_, i) => `Dòng ${i}: mô tả đầy đủ ở cỡ chữ đọc được.`));
      const content = tip.getByName("tooltip_scroll_content") as any;
      s.input.emit("wheel", {}, [], 0, 300); const scrolled = content.y;
      const font = content.list[0].style.fontSize;
      tip.destroy(); return { before, after: s.input.listenerCount("wheel"), scrolled, font };
    });
    expect(wheel.scrolled).toBeLessThan(0); expect(wheel.font).toBe("12px"); expect(wheel.after).toBe(wheel.before);
    // Same boot: real co-op rules state supplies compact heroes and the waiting banner.
    const data = await page.evaluate(() => (window as any).__vn.session.data);
    const heroIds = ["m05", "f04", "m06"] as [string, string, string];
    const side = { heroIds, loadout: { heroes: Object.fromEntries(heroIds.map(id => [id, { constellation: 5, levelUpForm: "alt" as const, weaponId: id === "m05" ? "w_xich_diem_thuong" : null, refinement: id === "m05" ? 1 : 0 }])), relics: [] } };
    let coop = createCoopCombat(data, { seed: 42, players: [side, side], encounterId: data.coopConfig.encounterId }).state;
    coop = applyAction(data, coop, { type: "mulligan", instanceIds: [], player: 0 }).state;
    await page.evaluate(state => { const h = (window as any).__vn, s = h.game.scene.getScene("combat"); h.session.state = state; s.state = state; s.latestState = state; s.requestRender(); }, coop);
    await assertFooter(page, 100);
    expect(await page.evaluate(() => { const s = (window as any).__vn.game.scene.getScene("combat"), banner = s.root.getByName("mulligan_banner"); return banner.list.some((n: any) => n.text === "chờ đồng đội…"); })).toBe(true);
    await page.screenshot({ path: `${OUT}/coop-waiting-${viewport.width}.png` });
    coop = applyAction(data, coop, { type: "mulligan", instanceIds: [], player: 1 }).state;
    coop.heroes[0]!.leveledUp = true; coop.heroes[1]!.alive = false; coop.heroes[1]!.hp = 0;
    await page.evaluate(state => { const h = (window as any).__vn, s = h.game.scene.getScene("combat"); h.session.state = state; s.state = state; s.latestState = state; s.requestRender(); }, coop);
    await assertFooter(page, 100);
    await page.screenshot({ path: `${OUT}/coop-footer-${viewport.width}.png` });
  });
}
