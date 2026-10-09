import { requireSuccess } from "../test/helpers/action-result";
import { expect, test } from "@playwright/test";
import { clickDesign, sceneTexts } from "./helpers/combat";
import { openCombatScene } from "./helpers/online";
import { applyAction, createCombat, createPvpCombat, createCoopCombat, starterDeck } from "rules";

async function clickNamed(page:any,name:string) {
  const point=await page.evaluate((name:string)=>{
    const s=(window as any).__vn.game.scene.getScene("combat");
    const walk=(nodes:any[]):any=>{for(const n of nodes){if(n.name===name)return n;if(n.list){const found=walk(n.list);if(found)return found;}}};
    const b=walk(s.children.list)?.getBounds();return b?{x:b.centerX,y:b.centerY}:null;
  },name);
  expect(point).not.toBeNull();await clickDesign(page,point!.x,point!.y);
}

test("centered foes and independent actual pile clicks in PvE, PvP and co-op",async({page})=>{
  await openCombatScene(page);
  for(const mode of ["pve","pvp","coop"] as const) {
    const data=await page.evaluate(()=>(window as any).__vn.session.data);
    const heroIds=["m05","f04","m06"] as [string,string,string];
    const side={heroIds,loadout:{heroes:Object.fromEntries(heroIds.map(id=>[id,{constellation:0,levelUpForm:"base" as const,weaponId:null,refinement:0}])),relics:[],...(mode==="pvp"?{pvp:true}:{})}};
    const opening=mode==="pve"?createCombat(data,{seed:42,heroIds,encounterId:"enc_01",deckCardIds:starterDeck(data,heroIds)}).state:mode==="pvp"?createPvpCombat(data,{seed:42,players:[side,side]}).state:createCoopCombat(data,{seed:42,players:[side,side],encounterId:data.coopConfig.encounterId}).state;
    let state=requireSuccess(applyAction(data,opening,{type:"mulligan",instanceIds:[],player:0})).state;
    if(mode!=="pve") state=requireSuccess(applyAction(data,state,{type:"mulligan",instanceIds:[],player:1})).state;
    await page.evaluate(async({state})=>{
      const h=(window as any).__vn,s=h.game.scene.getScene("combat");
      if(state.mode!=="pve") {
        const {NetMatch}=await import("/src/net/match.ts");
        const net={sendMatch:()=>true,serverNow:()=>Date.now(),onMessage:()=>{},onStatus:()=>{},onRecovery:()=>{}};
        h.session.match=new NetMatch(net as any,{matchId:"polish",mode:state.mode,you:0,others:[{seat:1,username:"Bạn chơi",connected:true}],view:state,deadline:null,eventSeq:0,nextActionSeq:1,settlement:{status:"playing"}});
      } else h.session.match=null;
      h.session.state=state;s.state=state;s.latestState=state;s.mySeat=0;s.netMatch=h.session.match;s.requestRender();
    },{state});
    const geometry=await page.evaluate(()=>{
      const s=(window as any).__vn.game.scene.getScene("combat"),state=s.state;
      const ids=state.mode==="pvp"?state.heroes.filter((h:any)=>h.player===1).map((h:any)=>h.id):state.enemies.map((e:any)=>e.id);
      const centers=ids.map((id:string)=>s.unitAnchors.get(id).x);
      const nodes:any[]=[];const walk=(list:any[])=>list.forEach(n=>{nodes.push(n);if(n.list)walk(n.list);});walk(s.children.list);
      const moons=nodes.filter(n=>n.name==="moon_current").map(n=>n.getBounds());
      const opponent=nodes.find(n=>n.name==="opponent_power")?.getBounds();
      return {center:(Math.min(...centers)+Math.max(...centers))/2,opponentClear:!opponent||moons.every(b=>b.left>=opponent.right||b.right<=opponent.left||b.top>=opponent.bottom||b.bottom<=opponent.top)};
    });
    expect(geometry.center).toBe(640);expect(geometry.opponentClear).toBe(true);
    for(const seat of state.players) for(const pile of ["draw","discard"]) {
      await clickNamed(page,`pile_${pile}_${seat.index}`);
      await expect.poll(async()=>(await sceneTexts(page,"combat")).includes(pile==="draw"?"Chồng rút":"Chồng bỏ")).toBe(true);
      await page.screenshot({path:`../../.sdd-work/combat-ui-polish/screenshots/${mode}-${seat.index}-${pile}.png`});
      await page.keyboard.press("Escape");
    }
  }
});

for(const viewport of [{width:1280,height:720},{width:1024,height:576}]) {
test(`settings controls fit, persist and keep combat blocked @ ${viewport.width}`,async({page})=>{
  await page.setViewportSize(viewport);await openCombatScene(page);
  await clickDesign(page,1240,36);
  const bounds=await page.evaluate(()=>{
    const s=(window as any).__vn.game.scene.getScene("combat");
    const layer=s.children.list.find((n:any)=>n.name==="combat_settings");
    if(!layer)return null;
    const panel=layer.list.find((n:any)=>n.name==="settings_panel").getBounds();
    const content=layer.list.find((n:any)=>n.type==="Container"&&n.name!=="settings_panel");
    (window as any).__settingsLayer=layer;
    return content.list.filter((n:any)=>n.type==="Text"||n.input).map((n:any)=>{const b=n.getBounds();return b.left>=panel.left&&b.right<=panel.right&&b.top>=panel.top&&b.bottom<=panel.bottom;});
  });
  expect(bounds).not.toBeNull();expect(bounds!.length).toBeGreaterThan(10);expect(bounds?.every(Boolean)).toBe(true);
  await clickNamed(page,"settings_speed_2");await clickNamed(page,"settings_motion");
  await clickNamed(page,"settings_volume_up");await clickNamed(page,"settings_mute");
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("vongnguyet.combatSettings.v1")!))).toEqual({speed:2,reducedMotion:true,volume:0});
  expect((await sceneTexts(page,"combat")).includes("Thiết Lập")).toBe(true);
  expect(await page.evaluate(()=>(window as any).__settingsLayer===(window as any).__vn.game.scene.getScene("combat").children.list.find((n:any)=>n.name==="combat_settings"))).toBe(true);
  expect(await page.evaluate(()=>{
    const s=(window as any).__vn.game.scene.getScene("combat"),old:any[]=[];
    const walk=(list:any[])=>list.forEach(n=>{if(n.name==="moon_current_aura")old.push(n);if(n.list)walk(n.list);});walk(s.moonLayer.list);
    return old.length===0;
  })).toBe(true);
  await page.keyboard.press("e");expect(await page.evaluate(()=>(window as any).__vn.game.scene.getScene("combat").state.round)).toBe(1);
  await page.screenshot({path:`../../.sdd-work/combat-ui-polish/screenshots/settings-${viewport.width}.png`});
  await page.keyboard.press("Escape");
  expect((await sceneTexts(page,"combat")).includes("Thiết Lập")).toBe(false);
  await clickDesign(page,1240,36);await page.keyboard.press("Enter");
  expect((await sceneTexts(page,"combat")).includes("Thiết Lập")).toBe(false);
});

test(`current moon and card description geometry @ ${viewport.width}`,async({page})=>{
  await page.setViewportSize(viewport);await openCombatScene(page);
  const probe=await page.evaluate(()=>{
    const s=(window as any).__vn.game.scene.getScene("combat"),nodes:any[]=[];
    const walk=(list:any[])=>list.forEach(n=>{nodes.push(n);if(n.list)walk(n.list);});walk(s.children.list);
    const phases=nodes.filter(n=>/^moon_phase_\d$/.test(n.name));
    const cards=[...s.cardViews.values()].map((v:any)=>{
      const body=v.getByName("card_body") as any;
      const b=body?.getBounds();
      return body&&b?{body:body.text,bodyTop:b.top,bodyBottom:b.bottom,bandTop:v.y-25,bandBottom:v.y+84}:null;
    });
    return {phases:phases.map(n=>({x:n.x,y:n.y})),label:nodes.some(n=>n.name==="moon_label"),ring:nodes.some(n=>n.name==="moon_current_ring"),aura:nodes.some(n=>n.name==="moon_current_aura"),exit:nodes.some(n=>n.text==="✕"),cards};
  });
  expect(probe.phases).toHaveLength(0);
  expect(probe.label).toBe(false);expect(probe.ring).toBe(false);expect(probe.aura).toBe(false);
  // Offline combat offers an exit back to deck-select (`✕` badge by the gear).
  expect(probe.exit).toBe(true);
  // Offline player turns run on `combatConfig.turnSeconds` — the clock ticks per frame.
  await expect.poll(()=>page.evaluate(()=>{const s=(window as any).__vn.game.scene.getScene("combat"),nodes:any[]=[];const walk=(l:any[])=>l.forEach((n:any)=>{nodes.push(n);if(n.list)walk(n.list);});walk(s.children.list);return nodes.some((n:any)=>/^⏱ \d+s$/.test(n.text||""));})).toBe(true);
  for(const card of probe.cards){expect(card).not.toBeNull();expect(card!.body.length).toBeGreaterThan(0);expect(card!.bodyTop).toBeGreaterThanOrEqual(card!.bandTop);expect(card!.bodyBottom).toBeLessThanOrEqual(card!.bandBottom);}
  await page.evaluate(()=>{
    const h=(window as any).__vn,s=h.game.scene.getScene("combat"),id=s.state.players[0].hand[0];
    const card=h.session.data.cards[s.state.cards[id].cardId];
    card.text="Một\nHai\nBa";s.requestRender();
  });
  await expect.poll(()=>page.evaluate(()=>{const s=(window as any).__vn.game.scene.getScene("combat");return [...s.cardViews.values()].some((v:any)=>(v.getByName("card_body")?.text.endsWith(" Một\nHai\nBa") ?? false));})).toBe(true);
  await page.screenshot({path:`../../.sdd-work/combat-ui-polish/screenshots/board-${viewport.width}.png`});
  const compact=await page.evaluate(async()=>{
    const h=(window as any).__vn,s=h.game.scene.getScene("combat");
    const {combatCardModel,renderCombatCard}=await import("/src/ui/combat-card-view.ts");
    const base=combatCardModel(h.session.data,s.state,s.state.players[0].hand[0]);
    const models=[base,{...base,category:"bond",ownerNames:[h.session.data.heroes.f03.name,h.session.data.heroes.f04.name],ownerColors:[0xaaaaff,0xddbbff]},{...base,category:"weapon",ownerNames:[base.ownerNames[0]]},base];
    return models.map((model:any,i:number)=>{
      const view=renderCombatCard(s,{...model,fullText:i===3?"Một Hai Ba Bốn Năm Sáu Bảy Tám Chín Mười":"Một\nHai\nBa\nBốn"},{x:410+i*120,y:400}).setDepth(1800);
      const body=view.getByName("card_body") as any;
      return {body:body.text,expected:model.ownerNames,bodyTop:body.getBounds().top,bodyBottom:body.getBounds().bottom,bodyLeft:body.getBounds().left,bodyRight:body.getBounds().right,cardLeft:view.x-57,cardRight:view.x+57,bandTop:view.y-25,bandBottom:view.y+84,lines:body.getWrappedText(),font:body.style.fontSize};
    });
  });
  for(const card of compact){const flat=card.body.replace(/\s+/g," ");for(const name of card.expected)expect(flat).toContain(name);expect(card.bodyTop).toBeGreaterThanOrEqual(card.bandTop);expect(card.bodyBottom).toBeLessThanOrEqual(card.bandBottom);expect(card.bodyLeft).toBeGreaterThanOrEqual(card.cardLeft);expect(card.bodyRight).toBeLessThanOrEqual(card.cardRight);expect(card.lines.length).toBeLessThanOrEqual(7);expect(["11px","10px","9px"]).toContain(card.font);}
  expect(compact[1]!.body).toContain("∞");expect(compact[2]!.body).toContain("⚔");
  await page.screenshot({path:`../../.sdd-work/combat-ui-polish/screenshots/compact-categories-${viewport.width}.png`});
});
}
