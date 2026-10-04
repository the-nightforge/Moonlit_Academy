import { expect, test } from "@playwright/test";
import { setupOfflineCombat, sceneTexts, clickDesign, waitIdle } from "./helpers/combat";
import { applyAction, createCombat, createCoopCombat, getEffectiveCost, starterDeck } from "rules";

const viewports = [{ width:1280,height:720 },{ width:1366,height:768 },{ width:1024,height:576 },{ width:1280,height:900 }];

test("reused combat scene owns no new controls through its destroyed previous root", async ({ page }) => {
  await page.route("**/api/health", route => route.fulfill({status:503,contentType:"application/json",body:'{"ok":false}'}));
  await setupOfflineCombat(page);
  await page.evaluate(() => {
    const h = (window as any).__vn, s = h.game.scene.getScene("combat");
    (window as any).__reviewOldRoot = s.root;
    (window as any).__reviewOldScene = s;
    s.scene.start("deck-select");
  });
  await expect.poll(() => page.evaluate(() => (window as any).__vn.game.scene.getScenes(true)[0]?.scene.key)).toBe("deck-select");
  await page.evaluate(async () => {
    const h = (window as any).__vn;
    const {NetMatch} = await import("/src/net/match.ts");
    const net = {sendMatch:()=>true, serverNow:()=>Date.now(), onMessage:()=>{}, onStatus:()=>{}, onRecovery:()=>{}};
    const state = structuredClone(h.session.state); state.status = "won";
    h.session.net = net;
    h.session.match = new NetMatch(net as any, {matchId:"scene_reuse_review",mode:state.mode,you:0,others:[],view:state,deadline:null,eventSeq:0,nextActionSeq:1,settlement:{status:"complete",end:{result:"won",reason:"combat"}}});
    h.game.scene.getScene("deck-select").scene.start("combat");
  });
  await expect.poll(() => page.evaluate(() => (window as any).__vn.game.scene.getScenes(true)[0]?.scene.key)).toBe("combat");
  const probe = await page.evaluate(() => {
    const old = (window as any).__reviewOldRoot, s = (window as any).__vn.game.scene.getScene("combat");
    return {sameScene:s === (window as any).__reviewOldScene, newRoot:s.root !== old, oldLiveChildren:old.list.filter((n:any)=>!!n.scene).length, locked:s.inputLocked, newRootLive:!!s.root.scene};
  });
  expect(probe).toEqual({sameScene:true,newRoot:true,oldLiveChildren:0,locked:true,newRootLive:true});
});

test("draw icon, lower edge and count open draw; discard opens discard", async ({ page }) => {
  await setupOfflineCombat(page);
  for (const y of [424, 455, 474]) {
    await clickDesign(page, 54, y);
    await expect.poll(async () => (await sceneTexts(page, "combat")).some(t => t.includes("Chồng rút"))).toBe(true);
    await page.keyboard.press("e");
    expect(await page.evaluate(() => (window as any).__vn.session.state.round)).toBe(1);
    await page.keyboard.press("Escape");
  }
  await clickDesign(page, 54, 540);
  await expect.poll(async () => (await sceneTexts(page, "combat")).some(t => t.includes("Chồng bỏ"))).toBe(true);
});

for (const viewport of [viewports[0]!, viewports[2]!]) {
test(`selected card retains lift after pointerover/out and body stays clear of owner @ ${viewport.width}x${viewport.height}`, async ({ page }) => {
  await page.setViewportSize(viewport);
  await setupOfflineCombat(page, "hand10");
  const overlaps = await page.evaluate(() => {
    const scene = (window as any).__vn.game.scene.getScene("combat");
    return [...scene.cardViews.values()].flatMap((view: any) => {
      const body = view.list.find((n: any) => n.name === "card_body");
      const owner = view.list.find((n: any) => n.name === "card_owner");
      return !body || !owner || owner.getBounds().bottom > body.getBounds().top || body.getBounds().bottom > view.y + 80 ? [body?.text ?? "missing header/body"] : [];
    });
  });
  expect(overlaps).toEqual([]);
  await page.screenshot({ path: `../../.sdd-work/combat-review-fixes/screenshots/hand10-${viewport.width}x${viewport.height}.png` });
  const selected = await page.evaluate(() => {
    const scene = (window as any).__vn.game.scene.getScene("combat");
    const state = (window as any).__vn.session.state;
    state.players[0].moonPower = 9;
    const id = state.players[0].hand.find((id: string) => {
      const card = (window as any).__vn.session.data.cards[state.cards[id].cardId];
      return card?.target === "enemy";
    });
    scene.onCardClicked(id);
    return { id, y: scene.cardViews.get(id).y };
  });
  await page.evaluate(({ id }) => {
    const view = (window as any).__vn.game.scene.getScene("combat").cardViews.get(id);
    view.emit("pointerover");
    view.emit("pointerout");
  }, selected);
  expect(await page.evaluate(id => (window as any).__vn.game.scene.getScene("combat").cardViews.get(id).y, selected.id)).toBe(selected.y);
});
}

for (const viewport of viewports) {
  test(`co-op compact HUD and partner preview both seats @ ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await setupOfflineCombat(page);
    for (const viewer of [0,1]) {
      const data = await page.evaluate(() => (window as any).__vn.session.data);
      const heroIds = ["m05","f04","m06"] as [string,string,string];
      const side = {heroIds,loadout:{heroes:Object.fromEntries(heroIds.map(id=>[id,{constellation:0,levelUpForm:"base" as const,weaponId:null,refinement:0}])),relics:[]}};
      const {state:opening} = createCoopCombat(data,{seed:42,players:[side,side],encounterId:data.coopConfig.encounterId});
      let state = applyAction(data, opening, {type:"mulligan",instanceIds:[],player:0}).state;
      state = applyAction(data, state, {type:"mulligan",instanceIds:[],player:1}).state;
      state.summons = [0,1].map(player => ({id:`review_summon_${player}`,defId:"tho_ngoc",summonId:"tho_ngoc",side:"hero",player,ownerHeroId:state.heroes.find(h=>h.player===player)!.id,position:0,hp:12,maxHp:12,armor:7,statuses:[{id:"strength",value:3},{id:"weak",value:2},{id:"burn",value:1}],alive:true})) as any;
      const partner = 1-viewer;
      const instanceId = state.players[partner]!.hand[0]!;
      state.cards[instanceId]!.turnDiscount = 1;
      state.bloodMoonRounds = 2;
      const effective = getEffectiveCost(data,state,instanceId,partner);
      await page.evaluate(({ state, viewer }) => {
        const handle = (window as any).__vn;
        const scene = handle.game.scene.getScene("combat");
        handle.session.state = state;
        scene.state = state;
        scene.latestState = state;
        scene.mySeat = viewer;
        scene.requestRender();
      }, { state, viewer });
      await waitIdle(page);
      const probe = await page.evaluate(({partner}) => {
        const scene = (window as any).__vn.game.scene.getScene("combat");
        const anchors = [...scene.unitAnchors].filter(([id]: any)=>id.startsWith("review_summon"));
        const tile = scene.seatLayers.get(partner).list.find((n:any)=>n.type==="Rectangle" && n.width===24 && n.height===34);
        const cost = scene.seatLayers.get(partner).list.find((n:any)=>n.type==="Text" && n.x===tile.x && n.y===tile.y).text;
        tile.emit("pointerover");
        const texts: string[]=[];
        const walk=(list:any[])=>list.forEach(n=>{if(n.type==="Text")texts.push(n.text);if(n.list)walk(n.list);});
        walk(scene.tooltip.list);
        const main = scene.moonLayer.list.find((n:any)=>n.type==="Image");
        return {anchors,cost,texts,phaseTexture:main.texture.key,moonIndex:scene.state.moonIndex};
      }, {partner});
      expect(probe.anchors).toContainEqual([`review_summon_${viewer}`,{x:1000,y:410}]);
      expect(probe.anchors).toContainEqual([`review_summon_${partner}`,{x:1100,y:410}]);
      expect(probe.cost).toBe(`${effective}`);
      expect(probe.texts.some(t=>t.includes(`${effective} Nguyệt Lực (`) && t.includes("Thiên Cơ -1"))).toBe(true);
      expect(probe.phaseTexture).toBe(`ui:moon_${data.moonPhases[state.moonIndex]!.id}`);
      await page.screenshot({path:`../../.sdd-work/combat-review-fixes/screenshots/coop-${viewport.width}x${viewport.height}-seat${viewer}.png`});
    }
  });
}

test("end turn displays processing immediately, blocks repeat actions, then unlocks", async ({ page }) => {
  await setupOfflineCombat(page);
  const result = await page.evaluate(() => {
    const scene = (window as any).__vn.game.scene.getScene("combat");
    const accepted = scene.dispatch({ type: "endTurn" });
    const repeated = scene.dispatch({ type: "endTurn" });
    const texts: string[] = [];
    const walk = (list: any[]) => list.forEach(n => { if (n.type === "Text") texts.push(n.text); if (n.list) walk(n.list); });
    walk(scene.root.list);
    return { accepted, repeated, texts };
  });
  expect(result.accepted).toBe(true);
  expect(result.repeated).toBe(false);
  expect(result.texts).toContain("Đang xử lý…");
  await waitIdle(page, 60000);
  expect(await sceneTexts(page, "combat")).not.toContain("Đang xử lý…");
});

test("real Bách Chiến resolves two hits through resize during cast and drains FX", async ({page}) => {
  await setupOfflineCombat(page);
  const data = await page.evaluate(()=>(window as any).__vn.session.data);
  const heroIds = ["m10","f04","m06"] as [string,string,string];
  let state = createCombat(data,{heroIds,encounterId:"enc_01",seed:42,deckCardIds:starterDeck(data,heroIds)}).state;
  state = applyAction(data,state,{type:"mulligan",instanceIds:[]}).state;
  const id="review_multi";
  state.cards[id]={instanceId:id,cardId:"m10_bach_chien",ownerIds:["m10"],player:0,heldTurns:0};
  state.players[0]!.hand=[id];
  state.players[0]!.moonPower=9;
  const target=state.enemies[0]!.id;
  const locked=await page.evaluate(({state,id,target})=>{
    const handle=(window as any).__vn;
    const scene=handle.game.scene.getScene("combat");
    handle.session.state=state;handle.session.events=[];
    scene.state=state;scene.latestState=state;scene.mySeat=0;scene.requestRender();
    scene.dispatch({type:"playCard",instanceId:id,targetId:target});
    return {busy:scene.playback.busy,repeated:scene.dispatch({type:"playCard",instanceId:id,targetId:target})};
  },{state,id,target});
  expect(locked).toEqual({busy:true,repeated:false});
  await page.setViewportSize({width:1280,height:900});
  await waitIdle(page,60000);
  const probe=await page.evaluate(()=>{
    const handle=(window as any).__vn,scene=handle.game.scene.getScene("combat");
    return {played:handle.session.events.filter((e:any)=>e.type==="cardPlayed").length,hits:handle.session.events.filter((e:any)=>e.type==="damageDealt").length,fx:scene.children.list.filter((n:any)=>n.depth>=90&&n.depth<1600).length};
  });
  expect(probe).toEqual({played:1,hits:2,fx:0});
  await page.screenshot({path:"../../.sdd-work/combat-review-fixes/screenshots/real-multihit-resize.png"});
});

test("actual Tiên Tri opens all four choices, blocks E and accepts the rendered choice",async({page})=>{
  await page.setViewportSize({width:1024,height:576});
  await setupOfflineCombat(page);
  const data=await page.evaluate(()=>(window as any).__vn.session.data);
  const heroIds=["m03","f04","m06"] as [string,string,string];
  let state=createCombat(data,{heroIds,encounterId:"enc_01",seed:42,deckCardIds:starterDeck(data,heroIds)}).state;
  state=applyAction(data,state,{type:"mulligan",instanceIds:[]}).state;
  const id="review_choice";
  state.cards[id]={instanceId:id,cardId:"m03_tien_tri",ownerIds:["m03"],player:0,heldTurns:0};
  state.players[0]!.hand=[id];state.players[0]!.moonPower=9;
  await page.evaluate(({state,id})=>{
    const h=(window as any).__vn,s=h.game.scene.getScene("combat");
    h.session.state=state;h.session.events=[];s.state=state;s.latestState=state;s.mySeat=0;s.requestRender();s.dispatch({type:"playCard",instanceId:id});
  },{state,id});
  await waitIdle(page,60000);
  const choice=await page.evaluate(()=>{
    const h=(window as any).__vn,s=h.game.scene.getScene("combat"),pending=s.state.players[0].pendingChoice;
    const view=s.cardViews.get(pending.options[3]),b=view.getBounds();
    return {options:pending.options,x:b.centerX,y:b.centerY,round:s.state.round};
  });
  expect(choice.options).toHaveLength(4);
  await page.keyboard.press("e");
  expect(await page.evaluate(()=>(window as any).__vn.session.state.round)).toBe(choice.round);
  await page.screenshot({path:"../../.sdd-work/combat-review-fixes/screenshots/real-four-card-choice.png"});
  await clickDesign(page,choice.x,choice.y);
  await waitIdle(page,60000);
  expect(await page.evaluate(()=>(window as any).__vn.session.state.players[0].pendingChoice)).toBeNull();
  expect(await page.evaluate(()=>(window as any).__vn.session.events.some((e:any)=>e.type==="cardChosen"))).toBe(true);
});
