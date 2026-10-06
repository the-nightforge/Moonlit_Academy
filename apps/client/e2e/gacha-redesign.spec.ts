import { expect, test, type Page, type Route } from "@playwright/test";

async function setup(page: Page) {
  await page.route("**/api/health", route => route.fulfill({ status: 503, json: { ok: false } }));
  await page.goto("http://127.0.0.1:5173");
  await page.waitForFunction(() => (window as any).__vn?.game.scene.isActive("login"));
  await page.evaluate(() => {
    const h = (window as any).__vn;
    h.session.profile.currencies.moonJade = 10000;
    for (const id of ["m01", "m05", "f01", "m08", "f08", "f10", "m06", "f02", "f03", "m02"]) {
      h.session.profile.heroes[id] = { xp:0, unlockedCardIds:[], constellation:0, bonusUnlocks:0, levelUpForm:"base" };
    }
    h.game.scene.getScene("login").scene.start("gacha");
  });
  await page.waitForFunction(() => (window as any).__vn.game.scene.isActive("gacha"));
}

async function texts(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const scene = (window as any).__vn.game.scene.getScene("gacha"), result: string[] = [];
    const walk = (nodes: any[]) => nodes.forEach(n => { if (n.type === "Text") result.push(n.text); if(n.list) walk(n.list); });
    walk(scene.children.list); return result;
  });
}

async function clickText(page: Page, startsWith: string) {
  const p = await page.evaluate(prefix => {
    const scene = (window as any).__vn.game.scene.getScene("gacha"), nodes: any[] = [];
    const walk = (list: any[]) => list.forEach(n => { nodes.push(n); if(n.list) walk(n.list); });
    walk(scene.children.list);
    const n = nodes.find(n => n.type === "Text" && n.text.startsWith(prefix));
    if(!n) throw new Error(`Missing text: ${prefix}`);
    const b = n.getBounds(); return { x:b.centerX, y:b.centerY };
  }, startsWith);
  const box = (await page.locator("canvas").boundingBox())!;
  const s = Math.min(box.width / 1280, box.height / 720);
  await page.mouse.click(box.x + (box.width - 1280*s)/2 + p.x*s, box.y + (box.height - 720*s)/2 + p.y*s);
}

/** Banner tiles live in the "Đổi duyên" drawer since the P1 layout rework. */
async function selectBanner(page: Page, name: string) {
  await clickText(page, "≡ Đổi duyên");
  await expect.poll(() => page.evaluate(() => (window as any).__vn.game.scene.getScene("gacha").drawerPanel?.x ?? -1)).toBe(0);
  const p = await page.evaluate(prefix => {
    const scene = (window as any).__vn.game.scene.getScene("gacha"), nodes: any[] = [];
    const walk = (list: any[]) => list.forEach(n => { nodes.push(n); if(n.list) walk(n.list); });
    walk(scene.children.list);
    const n = nodes.filter(t => t.type === "Text" && t.text.startsWith(prefix))
      .find(t => t.getBounds().centerX < 410); // drawer card column
    if (!n) throw new Error(`Missing drawer entry: ${prefix}`);
    const b = n.getBounds(); return { x: b.centerX, y: b.centerY };
  }, name);
  const box = (await page.locator("canvas").boundingBox())!;
  const s = Math.min(box.width / 1280, box.height / 720);
  await page.mouse.click(box.x + (box.width - 1280 * s) / 2 + p.x * s, box.y + (box.height - 720 * s) / 2 + p.y * s);
}

async function reply(page: Page, count = 1) {
  return page.evaluate(n => {
    const h = (window as any).__vn;
    const profile = structuredClone(h.session.profile);
    profile.currencies.moonJade -= h.session.data.economyConfig.pullCost*n;
    const ids = ["m01", "m05", "f01", "m08", "f08", "f10", "m06", "f02", "f03", "m02"].slice(0,n);
    for (const id of ids) profile.heroes[id] = { ...profile.heroes[id], constellation:1, bonusUnlocks:1 };
    profile.pity.heroes = { sinceEpic:0, sinceLegendary:Math.max(0,n-6) };
    profile.missions.daily.gachaPulls += n;
    profile.missions.weekly.gachaPulls += n;
    return { profile, rev:h.session.rev+1, achievements:[], results:ids.map((itemId,i) => ({ itemId, rarity:i < 6 ? "legendary":"epic", outcome:"constellation", constellation:1 })) };
  }, count);
}

test("pending pull locks banner selection and back navigation", async ({ page }) => {
  let request!: Route;
  await page.route("**/api/gacha/*/pull", route => { request = route; });
  await setup(page);
  await clickText(page,"Quay ×1");
  await expect.poll(() => Boolean(request)).toBe(true);
  // Busy locks the drawer itself: the switcher never opens while a pull pends.
  await clickText(page,"≡ Đổi duyên");
  expect(await page.evaluate(() => Boolean((window as any).__vn.game.scene.getScene("gacha").drawer))).toBe(false);
  expect(await page.evaluate(() => (window as any).__vn.game.scene.getScene("gacha").bannerId)).toBe("banner_heroes");
  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => (window as any).__vn.game.scene.isActive("gacha"))).toBe(true);
  await request.fulfill({ json:await reply(page) });
});

test("reveal keeps pulls locked and skip reveals all ten before closing", async ({ page }) => {
  let request!: Route;
  await page.route("**/api/gacha/*/pull", route => { request = route; });
  await setup(page);
  await clickText(page,"Quay ×10");
  await expect.poll(() => Boolean(request)).toBe(true);
  await request.fulfill({ json:await reply(page,10) });
  await page.waitForFunction(() => (window as any).__vn.session.rev === 1);
  expect(await page.evaluate(() => (window as any).__vn.game.scene.getScene("gacha").busy)).toBe(true);
  await clickText(page,"Bỏ qua");
  await expect.poll(async () => (await texts(page)).filter(t => t === "Tinh Hồn 1").length).toBe(10);
  expect(await page.evaluate(() => (window as any).__vn.game.scene.getScene("gacha").busy)).toBe(true);
  await clickText(page,"Trở về");
  expect(await page.evaluate(() => (window as any).__vn.game.scene.getScene("gacha").busy)).toBe(false);
});

test("a reply after shutdown updates profile without reviving scene UI", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  let request!: Route;
  await page.route("**/api/gacha/*/pull", route => { request = route; });
  await setup(page);
  await clickText(page,"Quay ×1");
  await expect.poll(() => Boolean(request)).toBe(true);
  const body = await reply(page);
  await page.evaluate(() => (window as any).__vn.game.scene.getScene("gacha").scene.start("login"));
  await page.waitForFunction(() => (window as any).__vn.game.scene.isActive("login"));
  await request.fulfill({ json:body });
  await page.waitForFunction(() => (window as any).__vn.session.rev === 1);
  await page.waitForTimeout(800);
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => (window as any).__vn.game.scene.isActive("login"))).toBe(true);
});

test("an API error releases the pull lock and a retry completes normally", async ({ page }) => {
  let request!: Route;
  await page.route("**/api/gacha/*/pull", route => { request = route; });
  await setup(page);
  await clickText(page,"Quay ×1");
  await expect.poll(() => Boolean(request)).toBe(true);
  await request.fulfill({ status:503, json:{ error:"network" } });
  await expect.poll(async () => (await texts(page)).includes("Không kết nối được server")).toBe(true);
  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => (window as any).__vn.game.scene.getScene("gacha").busy)).toBe(false);
  request = undefined as unknown as Route;
  await clickText(page,"Quay ×1");
  await expect.poll(() => Boolean(request)).toBe(true);
  await request.fulfill({ json:await reply(page) });
  await expect.poll(async () => (await texts(page)).some(text => text.startsWith("Bỏ qua"))).toBe(true);
  await page.keyboard.press("Escape");
  await expect.poll(async () => (await texts(page)).includes("Tinh Hồn 1")).toBe(true);
  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => (window as any).__vn.game.scene.getScene("gacha").busy)).toBe(false);
});

test("closing a pending history modal prevents its late response reopening it", async ({ page }) => {
  let request!: Route;
  await page.route("**/api/gacha/history?*", route => { request = route; });
  await setup(page);
  await clickText(page,"Nhật ký quay");
  await expect.poll(() => Boolean(request)).toBe(true);
  await page.keyboard.press("Escape");
  await request.fulfill({ json:{ entries:[] } });
  await page.waitForTimeout(250);
  expect((await texts(page)).some(text => text.startsWith("Nhật ký quay —"))).toBe(false);
  expect(await page.evaluate(() => (window as any).__vn.game.scene.isActive("gacha"))).toBe(true);
});

test("a late reply from the previous scene run cannot overlay a fresh altar", async ({ page }) => {
  let request!: Route;
  await page.route("**/api/gacha/*/pull", route => { request = route; });
  await setup(page);
  await clickText(page,"Quay ×1");
  await expect.poll(() => Boolean(request)).toBe(true);
  const body = await reply(page);
  await page.evaluate(() => (window as any).__vn.game.scene.getScene("gacha").scene.restart());
  await page.waitForFunction(() => (window as any).__vn.game.scene.getScene("gacha").busy === false);
  await request.fulfill({ json:body });
  await page.waitForFunction(() => (window as any).__vn.session.rev === 1);
  await page.waitForTimeout(600);
  expect((await texts(page)).includes("Tinh Hồn 1")).toBe(false);
  expect((await texts(page)).some(text => text.startsWith("Bỏ qua"))).toBe(false);
  expect(await page.evaluate(() => (window as any).__vn.game.scene.getScene("gacha").busy)).toBe(false);
});

test("high rarity reveal has local VFX that skip removes immediately", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  let request!: Route;
  await page.route("**/api/gacha/*/pull", route => { request = route; });
  await setup(page);
  await clickText(page,"Quay ×10");
  await expect.poll(() => Boolean(request)).toBe(true);
  await request.fulfill({ json:await reply(page,10) });
  const vfxCount = () => page.evaluate(() => {
    const scene = (window as any).__vn.game.scene.getScene("gacha"), nodes: any[] = [];
    const walk = (list: any[]) => list.forEach(n => { nodes.push(n); if(n.list) walk(n.list); });
    walk(scene.children.list);
    return nodes.filter(n => n.name === "gacha_rarity_vfx").length;
  });
  await expect.poll(vfxCount, { timeout:6000, intervals:[100] }).toBeGreaterThan(0);
  await clickText(page,"Bỏ qua");
  expect(await vfxCount()).toBe(0);
  await page.waitForTimeout(450);
  expect(await vfxCount()).toBe(0);
  expect((await texts(page)).filter(t => t === "Tinh Hồn 1")).toHaveLength(10);
  expect(errors).toEqual([]);
});

for (const lastRarity of ["rare", "epic"] as const) {
  test(`natural reveal leaves every card visible when coarse tween steps end on ${lastRarity}`, async ({ page }) => {
    let request!: Route;
    await page.route("**/api/gacha/*/pull", route => { request = route; });
    await setup(page);
    await clickText(page,"Quay ×10");
    await expect.poll(() => Boolean(request)).toBe(true);
    const body = await reply(page,10);
    if (lastRarity === "rare") {
      body.results[9] = { itemId:"f04", rarity:"rare", outcome:"constellation", constellation:1 };
      body.profile.heroes.f04 = { xp:0, unlockedCardIds:[], constellation:1, bonusUnlocks:1, levelUpForm:"base" };
      body.profile.heroes.m02.constellation = 0;
      body.profile.heroes.m02.bonusUnlocks = 0;
      body.profile.pity.heroes.sinceEpic = 1;
    }
    await page.evaluate(() => {
      // Keep Phaser's real tween state machine/callback ordering; control only
      // elapsed time to reproduce a low-frame-rate update of 300 milliseconds.
      (window as any).__vn.game.scene.getScene("gacha").tweens.getDelta = () => 300;
    });
    await request.fulfill({ json:body });
    await page.waitForFunction(() => (window as any).__vn.game.scene.getScene("gacha").phase === "complete");
    const cards = await page.evaluate(() => (window as any).__vn.game.scene.getScene("gacha").cards.map((card:any) => ({
      scaleX:card.root.scaleX, scaleY:card.root.scaleY, alpha:card.root.alpha, visible:card.root.visible,
      revealed:card.revealed,
      artWidth:card.root.list.find((node:any) => node.type === "Image" && node.texture.key === `heroes:${card.result.itemId}`)?.getBounds().width ?? 0,
    })));
    expect(cards.map(({artWidth:_artWidth,...card}:any) => card)).toEqual(Array.from({length:10}, () => ({scaleX:1,scaleY:1,alpha:1,visible:true,revealed:true})));
    expect(cards.every((card:any) => card.artWidth > 0)).toBe(true);
    expect((await texts(page)).includes("Trở về")).toBe(true);
  });
}

async function visibleListRows(page: Page): Promise<{ text:string; top:number; bottom:number }[]> {
  return page.evaluate(() => {
    const s=(window as any).__vn.game.scene.getScene("gacha");
    const content=s.modal?.list.find((node:any) => node.type === "Container" && node.list.some((child:any) => child.type === "Text" && child.x === 178));
    if (!content?.visible || content.alpha === 0) return [];
    return content.list.filter((node:any) => node.type === "Text" && node.visible && node.alpha > 0 && node.willRender(s.cameras.main))
      .map((node:any) => {const b=node.getBounds();return {text:node.text,top:b.top,bottom:b.bottom};})
      .filter((row:any) => row.bottom > 0 && row.top < 720);
  });
}

async function assertListViewport(page: Page) {
  const rows=await visibleListRows(page);
  assertRowsInsideViewport(rows);
}

function assertRowsInsideViewport(rows: { top:number; bottom:number }[]) {
  expect(rows.length).toBeGreaterThan(0);
  expect(rows.filter(row => row.top < 137 || row.bottom > 577)).toEqual([]);
}

async function wheelList(page: Page, dy:number) {
  const box=(await page.locator("canvas").boundingBox())!,s=Math.min(box.width/1280,box.height/720);
  await page.mouse.move(box.x+(box.width-1280*s)/2+640*s,box.y+(box.height-720*s)/2+350*s);
  await page.mouse.wheel(0,dy);
}

test("details render only body rows inside the viewport and arrows reach the last item", async ({page}) => {
  await setup(page);
  await selectBanner(page,"Binh Khí Các");
  await clickText(page,"Tỉ lệ & vật phẩm");
  await assertListViewport(page);
  await wheelList(page,500);
  await assertListViewport(page);
  for(let i=0;i<6;i++) await clickText(page,"▼");
  await assertListViewport(page);
  expect((await visibleListRows(page)).some(row=>row.text.includes("Ngọc Thố Bội"))).toBe(true);
  for(let i=0;i<6;i++) await clickText(page,"▲");
  await assertListViewport(page);
  expect((await visibleListRows(page)).some(row=>row.text.startsWith("Legendary 2%"))).toBe(true);
});

test("twenty long history entries keep the footer clear and every wrapped result can be read by scrolling", async ({page}) => {
  let request!:Route;
  await page.route("**/api/gacha/history?*",route=>{request=route;});
  await setup(page);
  await clickText(page,"Nhật ký quay");
  await expect.poll(()=>Boolean(request)).toBe(true);
  const results=(await reply(page,10)).results;
  const entries=Array.from({length:20},(_,i)=>({bannerId:`Nhật ký ${i+1}`,createdAt:Date.UTC(2026,9,5,i),results}));
  await request.fulfill({json:{entries}});
  await expect.poll(async()=> (await visibleListRows(page)).some(row=>row.text.includes("Nhật ký 1"))).toBe(true);
  await assertListViewport(page);
  const observed=new Set<string>();
  await wheelList(page,0);
  for(let i=0;i<30;i++) {
    const rows=await visibleListRows(page);
    rows.forEach(row=>observed.add(row.text));
    assertRowsInsideViewport(rows);
    await page.mouse.wheel(0,200);
  }
  expect([...observed].some(text=>text.includes("Nhật ký 20"))).toBe(true);
  // The last result in each entry must remain readable after wrapping.
  expect([...observed].join(" ").includes("Lục Hàn Phong")).toBe(true);
  await assertListViewport(page);
  expect((await visibleListRows(page)).some(row=>row.text.includes("Tinh Hồn 1"))).toBe(true);
  await clickText(page,"▲");
  await assertListViewport(page);
  await page.keyboard.press("Escape");
  expect(await page.evaluate(()=>(window as any).__vn.game.scene.getScene("gacha").modal)).toBe(null);
});
