import { expect, test, type Page } from "@playwright/test";

async function setup(page: Page) {
  await page.route("**/api/health", route => route.fulfill({ status:503, json:{ok:false} }));
  await page.goto("http://127.0.0.1:5173");
  await page.waitForFunction(() => (window as any).__vn?.game.scene.isActive("login"));
  await page.evaluate(() => {
    const h=(window as any).__vn;
    h.session.profile.currencies.moonJade=10000; h.session.rev=5;
    h.game.scene.getScene("login").scene.start("gacha");
  });
  await page.waitForFunction(() => (window as any).__vn.game.scene.isActive("gacha"));
}

async function click(page: Page, prefix: string) {
  const point=await page.evaluate(prefix => {
    const s=(window as any).__vn.game.scene.getScene("gacha"), nodes:any[]=[];
    const walk=(list:any[])=>list.forEach(n=>{nodes.push(n);if(n.list)walk(n.list);});walk(s.children.list);
    const text=nodes.find(n=>n.type==="Text" && n.text.startsWith(prefix));
    if(!text)throw new Error("Missing control: "+prefix);
    const b=text.getBounds(),cam=s.cameras.main;
    return {x:(b.centerX-cam.worldView.x)*cam.zoom+cam.x,y:(b.centerY-cam.worldView.y)*cam.zoom+cam.y,
      width:s.game.canvas.width,height:s.game.canvas.height};
  },prefix);
  const box=(await page.locator("canvas").boundingBox())!;
  await page.mouse.click(box.x+point.x*box.width/point.width,box.y+point.y*box.height/point.height);
}

/** Banner tiles live inside the "Đổi duyên" drawer since the P1 layout rework. */
async function selectBanner(page: Page, name: string) {
  await click(page, "≡ Đổi duyên");
  await expect.poll(() => page.evaluate(() => (window as any).__vn.game.scene.getScene("gacha").drawerPanel?.x ?? -1)).toBe(0); // slide-in done
  const point = await page.evaluate(name => {
    const s = (window as any).__vn.game.scene.getScene("gacha"), nodes: any[] = [];
    const walk = (list: any[]) => list.forEach(n => { nodes.push(n); if (n.list) walk(n.list); });
    walk(s.children.list);
    const text = nodes.filter(n => n.type === "Text" && n.text.startsWith(name))
      .find(n => n.getBounds().centerX < 410); // drawer panel column
    if (!text) throw new Error("Missing drawer entry: " + name);
    const b = text.getBounds(), cam = s.cameras.main;
    return { x: (b.centerX - cam.worldView.x) * cam.zoom + cam.x, y: (b.centerY - cam.worldView.y) * cam.zoom + cam.y,
      width: s.game.canvas.width, height: s.game.canvas.height };
  }, name);
  const box = (await page.locator("canvas").boundingBox())!;
  await page.mouse.click(box.x + point.x * box.width / point.width, box.y + point.y * box.height / point.height);
}

async function probe(page: Page) {
  return page.evaluate(() => {
    const s=(window as any).__vn.game.scene.getScene("gacha"), nodes:any[]=[];
    const walk=(list:any[])=>list.forEach(n=>{nodes.push(n);if(n.list)walk(n.list);});walk(s.children.list);
    return {texts:nodes.filter(n=>n.type==="Text").map(n=>n.text),
      phase:s.phase, revealed:s.cards.filter((c:any)=>c.revealed).length,
      vfx:nodes.filter(n=>n.name==="gacha_rarity_vfx").length,
      cardTransforms:s.cards.map((c:any)=>({scaleX:c.root.scaleX,scaleY:c.root.scaleY,alpha:c.root.alpha}))};
  });
}

for (const viewport of [{width:1280,height:720},{width:1920,height:1080}]) {
  test(`gacha assets, banner layout and authoritative mixed results ${viewport.width}`,async ({page})=>{
    await page.setViewportSize(viewport);
    const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
    await setup(page);
    const sizes=await page.evaluate(()=>{
      const s=(window as any).__vn.game.scene.getScene("gacha");
      return ["altar","card_back","weapon_banner","relic_banner","spark"].map(key=>{
        const image=s.textures.get(`gacha:${key}`).getSourceImage();return [key,image.width,image.height];
      });
    });
    expect(sizes).toEqual([["altar",1600,900],["card_back",512,768],["weapon_banner",512,512],["relic_banner",512,512],["spark",128,128]]);
    await page.screenshot({path:`../../.sdd-work/gacha-redesign/hero-${viewport.width}.png`});
    await selectBanner(page,"Binh Khí Các");
    await expect.poll(()=>page.evaluate(()=>(window as any).__vn.game.scene.getScene("gacha").bannerId)).toBe("banner_weapons");
    await page.screenshot({path:`../../.sdd-work/gacha-redesign/weapon-${viewport.width}.png`});
    await click(page,"Tỉ lệ & vật phẩm");
    await expect.poll(async()=>(await probe(page)).texts.includes("Binh Khí Các · Tỉ lệ & vật phẩm")).toBe(true);
    await page.screenshot({path:`../../.sdd-work/gacha-redesign/details-${viewport.width}.png`});
    await page.keyboard.press("Escape");
    await selectBanner(page,"Nguyệt Bảo Các");
    await expect.poll(()=>page.evaluate(()=>(window as any).__vn.game.scene.getScene("gacha").bannerId)).toBe("banner_relics");
    await page.screenshot({path:`../../.sdd-work/gacha-redesign/relic-${viewport.width}.png`});
    await selectBanner(page,"Triệu Hồi Anh Hùng");
    let requestBody:unknown,requestRevision:string|undefined,requestPath="";
    await page.route("**/api/gacha/*/pull",async route=>{
      requestBody=route.request().postDataJSON();requestRevision=route.request().headers()["if-match"];requestPath=new URL(route.request().url()).pathname;
      const body=await page.evaluate(()=>{
        const h=(window as any).__vn,profile=structuredClone(h.session.profile);
        profile.currencies.moonJade=8400;profile.currencies.moonStar=25;
        profile.pity.heroes={sinceEpic:3,sinceLegendary:9};
        const ids=["m05","m01","f01","m06","f02","f03","f04","m03","f05","f09"];
        ids.forEach(id=>profile.heroes[id]={xp:0,unlockedCardIds:[],constellation:0,bonusUnlocks:0,levelUpForm:"base"});
        profile.heroes.m05.constellation=2;
        profile.missions.daily.gachaPulls+=10;profile.missions.weekly.gachaPulls+=10;
        return {profile,rev:6,achievements:[],results:ids.map((itemId,i)=>({itemId,
          rarity:i<3?"legendary":i<6?"epic":i<9?"rare":"common",
          ...(i===0?{outcome:"constellation",constellation:2}:i===1?{outcome:"moonStar",moonStar:25}:{outcome:"newHero"})}))};
      });
      await route.fulfill({json:body});
    });
    await click(page,"Quay ×10");
    await expect.poll(async()=>(await probe(page)).phase,{timeout:15000}).toBe("revealing");
    await page.screenshot({path:`../../.sdd-work/gacha-redesign/seal-${viewport.width}.png`});
    await expect.poll(async()=>(await probe(page)).vfx,{timeout:30000,intervals:[50]}).toBeGreaterThan(0);
    await page.screenshot({path:`../../.sdd-work/gacha-redesign/rarity-${viewport.width}.png`});
    await expect.poll(async()=>(await probe(page)).phase,{timeout:60000,intervals:[150]}).toBe("complete");
    const done=await probe(page);expect(done.revealed).toBe(10);expect(done.vfx).toBe(0);
    expect(done.cardTransforms).toEqual(Array.from({length:10},()=>({scaleX:1,scaleY:1,alpha:1})));
    expect(done.texts).toContain("Tinh Hồn 2");expect(done.texts).toContain("+25 Nguyệt Tinh");
    await page.screenshot({path:`../../.sdd-work/gacha-redesign/results-${viewport.width}.png`});
    expect(requestPath).toBe("/api/gacha/banner_heroes/pull");expect(requestBody).toEqual({count:10});expect(requestRevision).toBe("5");
    await click(page,"Trở về");
    const refreshed=await probe(page);expect(refreshed.phase).toBe("idle");expect(refreshed.texts).toContain("8400");expect(refreshed.texts).toContain("3 / 10");expect(refreshed.texts).toContain("9 / 80");
    expect(errors).toEqual([]);
  });
}

test("reduced motion single gear reveal preserves capped duplicate reward",async({page})=>{
  await page.setViewportSize({width:1280,height:720});await page.emulateMedia({reducedMotion:"reduce"});
  await setup(page);await selectBanner(page,"Binh Khí Các");
  await page.route("**/api/gacha/banner_weapons/pull",async route=>{
    const body=await page.evaluate(()=>{
      const h=(window as any).__vn,profile=structuredClone(h.session.profile);
      profile.currencies.moonJade=9840;profile.currencies.moonStar=4;profile.currencies.darkIron=1;
      profile.weapons.w_han_tuyet_song_kiem={refinement:5};profile.pity.banner_weapons={sinceEpic:0,sinceLegendary:1};
      return {profile,rev:6,achievements:[],results:[{itemId:"w_han_tuyet_song_kiem",rarity:"epic",outcome:"maxed",moonStar:4,darkIron:1}]};
    });await route.fulfill({json:body});
  });
  await click(page,"Quay ×1");
  await expect.poll(async()=>(await probe(page)).phase,{timeout:30000,intervals:[100]}).toBe("complete");
  expect(await page.evaluate(()=>(window as any).__vn.game.scene.getScene("gacha").reducedMotion)).toBe(true);
  const p=await probe(page);expect(p.revealed).toBe(1);expect(p.vfx).toBe(0);expect(p.texts).toContain("+4 Nguyệt Tinh\n+1 Huyền Thiết");
  await page.screenshot({path:"../../.sdd-work/gacha-redesign/single-gear-reduced.png"});
});
