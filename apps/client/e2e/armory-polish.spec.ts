import { test, expect } from "@playwright/test";
import { openScene } from "./helpers/online";
async function setup(page: import('@playwright/test').Page) {
  await openScene(page, 'armory');
  await page.evaluate(() => { const h=(window as any).__vn; h.session.profile.weapons={w_xich_diem_thuong:{refinement:3},w_thiet_thuan:{refinement:5}}; h.session.profile.relics={r_vong_nguyet_kinh:{resonance:2}}; h.session.profile.currencies.darkIron=96; h.session.profile.currencies.moonDust=18; h.game.scene.getScene('armory').selectItem('w_xich_diem_thuong'); });
}
const errors=new WeakMap<import('@playwright/test').Page,string[]>();
test.beforeEach(({page})=>{const list:string[]=[];errors.set(page,list);page.on('pageerror',e=>list.push(e.message));});
test.afterEach(({page})=>expect(errors.get(page)).toEqual([]));
const content=(page:import('@playwright/test').Page)=>page.evaluate(()=>{const s=(window as any).__vn.game.scene.getScene('armory');const walk=(nodes:any[]):any[]=>nodes.flatMap(n=>[n,...(n.list?walk(n.list):[])]);return walk(s.root.list).filter(n=>n.type==='Text').map(n=>n.text).join('\n');});
test('fresh inventory card has loaded type emblem and no fictitious wearer',async({page})=>{
  await setup(page); await page.getByRole('button',{name:'Xem lá Binh Khí',exact:true}).click();
  const state=await page.evaluate(()=>{const h=(window as any).__vn,s=h.game.scene.getScene('armory');const walk=(n:any[]):any[]=>n.flatMap(x=>[x,...(x.list?walk(x.list):[])]);return {loaded:s.textures.exists('ui:intent_attack'),emblem:walk(s.tooltip.list).find(x=>x.name==='card_emblem_icon')?.texture.key,body:walk(s.tooltip.list).filter(x=>x.type==='Text').map(x=>x.text).join(' ')};});
  expect(state.loaded).toBe(true); expect(state.emblem).toBe('ui:intent_attack'); expect(state.body).not.toContain('Hoắc Liệt Gây');
});
test('upgrade delta and semantic action remain at owned level during future preview',async({page})=>{
  await setup(page);
  await page.getByRole('button',{name:'Xem Tinh Luyện 5',exact:true}).click();
  await expect(page.getByRole('button',{name:'Nâng lên Tinh Luyện 4',exact:true})).toBeEnabled();
  await expect.poll(()=>content(page)).toContain('Sát thương: 7 → 9 (+2)');
  await expect.poll(()=>content(page)).toContain('Đang có 96 · Sau nâng còn 31');
  await page.getByRole('tab',{name:/Các cấp/}).click();
  await expect.poll(()=>content(page)).toContain('Cần 65 Huyền Thiết');
});
test('filter reset preserves sort and offline explains an empty upgrade collection',async({page})=>{
  await setup(page); await page.getByLabel('Sắp xếp',{exact:true}).selectOption('level');
  await page.getByRole('searchbox',{name:'Tìm trang bị'}).fill('xich diem');
  await expect(page.getByRole('button',{name:'Đã sở hữu (1)',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Xóa bộ lọc',exact:true}).click();
  await expect(page.getByLabel('Sắp xếp',{exact:true})).toHaveValue('level');
  await page.evaluate(()=>{const h=(window as any).__vn;h.session.online=false;h.game.scene.getScene('armory').render();});
  await page.getByRole('button',{name:/^Nâng cấp được/}).click();
  await expect.poll(()=>content(page)).toContain('Đang mất kết nối');
});
test('deck equipment deep link returns without changing saved deck or collection state',async({page})=>{
  await setup(page);await page.getByRole('button',{name:'Xem Tinh Luyện 5',exact:true}).click(); await page.getByRole('searchbox',{name:'Tìm trang bị'}).fill('xich diem');
  await page.evaluate(()=>{const h=(window as any).__vn;h.session.profile.decks[0].weapons={m05:'w_xich_diem_thuong'};h.game.scene.getScene('armory').render();});
  await page.getByRole('tab',{name:/Bộ bài/}).click(); await page.getByRole('button',{name:/Mở bộ bài/}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__vn.game.scene.getScene('deck-builder').picker?.heroId)).toBe('m05');
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await expect(page.getByRole('searchbox',{name:'Tìm trang bị'})).toHaveValue('xich diem');
  expect(await page.evaluate(()=>(window as any).__vn.session.profile.decks[0].weapons.m05)).toBe('w_xich_diem_thuong');
  expect(await page.evaluate(()=>(window as any).__vn.game.scene.getScene('armory').state.preview)).toBe(5);
});
test('narrow window keeps upgrade and art close controls within its visible viewport',async({page},info)=>{
  await setup(page); await page.setViewportSize({width:900,height:650});
  const b=await page.getByRole('button',{name:'Nâng lên Tinh Luyện 4',exact:true}).boundingBox();
  expect(b).not.toBeNull(); expect(b!.x).toBeGreaterThanOrEqual(0); expect(b!.x+b!.width).toBeLessThanOrEqual(900); expect(b!.y+b!.height).toBeLessThanOrEqual(650);
  await page.getByRole('button',{name:'Phóng to hình trang bị',exact:true}).click();
  await expect(page.getByRole('searchbox')).toBeHidden();
  const close=page.getByRole('button',{name:'Đóng hình trang bị',exact:true}); const box=await close.boundingBox();expect(box!.y+box!.height).toBeLessThanOrEqual(650);
  await close.focus(); await page.keyboard.press('Enter'); await expect(page.getByRole('searchbox')).toBeVisible();
  await page.screenshot({path:info.outputPath('inventory-polish-narrow.png')});
});

test('semantic tile focus moves by row and opens with Enter without losing artwork',async({page})=>{
  await setup(page); const first=page.getByRole('button',{name:/^Thiết Thuẫn, /});
  await first.focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');
  expect(await page.evaluate(()=>(window as any).__vn.game.scene.getScene('armory').selected)).toBe('w_xich_diem_thuong');
  await expect(page.getByRole('button',{name:/^Xích Diệm Thương, /})).toBeFocused();
});

test('pending upgrade remains blocked across scene reentry and clears after a late failure',async({page})=>{
  await setup(page);let release!:()=>void,count=0;const pending=new Promise<void>(r=>release=r);
  await page.route('**/api/profile/weapons/w_xich_diem_thuong/upgrade',async route=>{count++;await pending;await route.fulfill({status:500,json:{error:'held upgrade'}});});
  try{
    await page.getByRole('button',{name:'Nâng lên Tinh Luyện 4',exact:true}).click();await expect.poll(()=>count).toBe(1);
    await page.evaluate(()=>(window as any).__vn.game.scene.getScene('armory').scene.start('deck-select'));
    await expect(page.getByRole('searchbox')).toHaveCount(0);
    await page.evaluate(()=>(window as any).__vn.game.scene.getScene('deck-select').scene.start('armory'));
    await expect(page.getByRole('searchbox')).toBeVisible();
    await expect(page.getByRole('button',{name:'Đang nâng…',exact:true})).toBeDisabled();
    await page.evaluate(()=>(window as any).__vn.game.scene.getScene('armory').upgrade());expect(count).toBe(1);
  }finally{release();}
  await expect(page.getByRole('button',{name:'Nâng lên Tinh Luyện 4',exact:true})).toBeEnabled();
});
test('large balances leave header materials and fixed upgrade price in separate regions',async({page})=>{
  await setup(page);await page.evaluate(()=>{const h=(window as any).__vn;h.session.profile.currencies.darkIron=Number.MAX_SAFE_INTEGER;h.game.scene.getScene('armory').render();});
  const bounds=await page.evaluate(()=>{const s=(window as any).__vn.game.scene.getScene('armory'),f=s.root.list.find((n:any)=>n.name==='equipment-actions');const price=f.list.find((n:any)=>n.text?.startsWith('Cần 65')).getBounds(),balance=f.list.find((n:any)=>n.text?.startsWith('Đang có')).getBounds();const header=s.root.list.find((n:any)=>n.type==='Text'&&n.y===38&&n.x===1056).getBounds();return {priceRight:price.right,balanceLeft:balance.left,headerRight:header.right};});
  expect(bounds.priceRight).toBeLessThan(bounds.balanceLeft);expect(bounds.headerRight).toBeLessThanOrEqual(1140);
});
