import {test,expect,type Page} from '@playwright/test';
import {openScene} from './helpers/online';
const errors=new WeakMap<Page,string[]>();
test.beforeEach(({page})=>{const list:string[]=[];errors.set(page,list);page.on('pageerror',e=>list.push(e.message));});
test.afterEach(({page})=>expect(errors.get(page)).toEqual([]));
test('inventory visual rules hold across category, preview, disabled controls and popups',async({page})=>{
 await openScene(page,'armory');
 const probe=()=>page.evaluate(()=>{const s=(window as any).__vn.game.scene.getScene('armory');const walk=(n:any[]):any[]=>n.flatMap(x=>[x,...(x.list?walk(x.list):[])]);const nodes=walk(s.root.list);return {text:nodes.filter(n=>n.type==='Text').map(n=>n.text).join('\n'),hits:nodes.filter(n=>n.type==='Rectangle'&&n.input).map(n=>({stroke:n.lineWidth,opacity:n.strokeAlpha})),icons:nodes.filter(n=>n.name==='equipment-control-icon').length};});
 await page.screenshot({path:'../../docs/inventory-ui/rules-weapons.png'});
 const p=await probe();expect(p.text).not.toMatch(/\b(?:TL|CM|HP|art|Esc)\b/);expect(p.icons).toBeGreaterThan(5);expect(p.hits.every(h=>h.stroke>0&&h.opacity>0)).toBe(true);
 const tile=page.locator('[data-equipment-control^="tile:"]').first();await tile.hover();await page.waitForTimeout(400);
 expect(await page.evaluate(()=>(window as any).__vn.game.scene.getScene('armory').tooltip)).toBeNull();
 await page.getByRole('button',{name:'Phóng to hình trang bị',exact:true}).click();await expect(page.getByRole('button',{name:'Đóng hình trang bị',exact:true})).toBeVisible();await page.screenshot({path:'../../docs/inventory-ui/rules-art.png'});
 await page.keyboard.press('Escape');await page.getByRole('button',{name:/^Nguyệt Bảo/}).click();expect((await probe()).text).not.toMatch(/\b(?:TL|CM|HP|art|Esc)\b/);await page.screenshot({path:'../../docs/inventory-ui/rules-relics.png'});
});
test('card preview reserves a bordered image region without obscuring or cropping the source',async({page})=>{
 await openScene(page,'armory');await page.getByRole('button',{name:'Xem lá Binh Khí',exact:true}).click();
 const layout=await page.evaluate(()=>{const s=(window as any).__vn.game.scene.getScene('armory');const walk=(n:any[]):any[]=>n.flatMap(x=>[x,...(x.list?walk(x.list):[])]);const nodes=walk(s.tooltip.list),art=nodes.find(n=>n.name==='card_art'),frame=nodes.find(n=>n.name==='card_art_frame'),name=nodes.find(n=>n.name==='card_name');const a=art.getBounds(),b=name.getBounds();return {border:frame?.lineWidth??0,imageBottom:a.bottom,textTop:b.top};});
 expect(layout.border).toBeGreaterThan(0);expect(layout.imageBottom).toBeLessThan(layout.textTop);await page.screenshot({path:'../../docs/inventory-ui/rules-card.png'});
});

test('every collection image retains its source ratio inside its border across all items and pages',async({page})=>{
 await openScene(page,'armory');
 const result=await page.evaluate(()=>{const h=(window as any).__vn,s=h.game.scene.getScene('armory'),failures:string[]=[];let checked=0;
  const walk=(n:any[]):any[]=>n.flatMap(x=>[x,...(x.list?walk(x.list):[])]);
  for(const kind of ['weapons','relics']){s.tab=kind;for(const id of Object.keys(h.session.data[kind])){
   s.state.page=Math.floor(Object.keys(h.session.data[kind]).indexOf(id)/12);s.selectItem(id);
   for(const tile of s.root.list.filter((n:any)=>n.name?.startsWith("equipment-tile:"))){const name=tile.list.find((n:any)=>n.type==="Text"&&n.y===103&&n.visible),level=tile.list.find((n:any)=>n.type==="Text"&&n.y===129);if(name&&level&&name.getBounds().bottom>level.getBounds().top)failures.push(tile.name+": title overlaps level");}
   for(const image of walk(s.root.list).filter(n=>n.type==='Image'&&n.getData('imageFrame'))){
    const f=image.getData('imageFrame'),src=image.texture.getSourceImage();checked++;
    if(Math.abs(image.scaleX-image.scaleY)>.0001||Math.abs(image.displayWidth/image.displayHeight-src.width/src.height)>.0001||image.displayWidth>f.width-4+.01||image.displayHeight>f.height-4+.01)failures.push(image.texture.key);
   }
  }}return {checked,failures};
 });
 expect(result.checked).toBeGreaterThan(300);expect(result.failures).toEqual([]);
});

test('tile labels stay outside the image and selection context remains visible',async({page})=>{
 await openScene(page,'armory');
 const layout=await page.evaluate(()=>{const s=(window as any).__vn.game.scene.getScene('armory');const tile=s.root.list.find((n:any)=>n.name?.startsWith('equipment-tile:'));const image=tile.list.find((n:any)=>n.type==='Image'&&n.getData('imageFrame'));const label=tile.list.find((n:any)=>n.type==='Text'&&n.y===2);return {imageTop:image.getBounds().top,labelBottom:label.getBounds().bottom};});
 expect(layout.imageTop).toBeGreaterThan(layout.labelBottom);
 await page.getByRole('searchbox',{name:'Tìm trang bị'}).fill('no_matching_item');
 expect(await page.evaluate(()=>{const s=(window as any).__vn.game.scene.getScene('armory');return s.root.list.filter((n:any)=>n.type==='Text').map((n:any)=>n.text).join(' ');})).toContain('Ngoài bộ lọc');
});
for(const useCanvas of [false,true])test('long card rules remain available in the scrollable preview and glossary uses full terms '+(useCanvas?'Canvas':'WebGL'),async({page})=>{
 if(useCanvas)await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,kind:string,...rest:any[]){if(kind.includes('webgl'))return null;return (original as any).call(this,kind,...rest);} as typeof original;});
 await openScene(page,'armory');
 expect(await page.evaluate(()=>(window as any).__vn.game.renderer.type)).toBe(useCanvas?1:2);
 await page.evaluate(()=>{const h=(window as any).__vn,s=h.game.scene.getScene('armory'),w=h.session.data.weapons[s.selected];h.session.profile.weapons[s.selected]={refinement:1};w.card.text='Hồi 2 HP. '.repeat(240)+'Kết thúc mô tả đầy đủ';w.card.keywords=['hoi_phuc'];s.selectItem(s.selected);});
 await page.getByRole('button',{name:'Xem lá Binh Khí',exact:true}).click();
 const text=await page.evaluate(()=>{const s=(window as any).__vn.game.scene.getScene('armory');const walk=(n:any[]):any[]=>n.flatMap(x=>[x,...(x.list?walk(x.list):[])]);return walk(s.tooltip.list).filter(n=>n.type==='Text').map(n=>n.text).join(' ');});
 expect(text).toContain('Kết thúc mô tả đầy đủ');expect(text).not.toMatch(/\bHP\b/);
 const clip=await page.evaluate(()=>{const h=(window as any).__vn,s=h.game.scene.getScene('armory'),tip=s.tooltip.list.find((n:any)=>n.name==='card_tooltip'),preview=tip.list.find((n:any)=>n.getByName?.('card_art')),b=preview.getByName('card_art_frame').getBounds(),cam=s.cameras.main,r=h.game.canvas.getBoundingClientRect(),sx=r.width/h.game.scale.width,sy=r.height/h.game.scale.height;return {x:r.left+(cam.x+(b.x-cam.worldView.x)*cam.zoom)*sx,y:r.top+(cam.y+(b.y-cam.worldView.y)*cam.zoom)*sy,width:b.width*cam.zoom*sx,height:b.height*cam.zoom*sy};});
 const before=await page.screenshot({clip});await page.mouse.move(clip.x+clip.width/2,clip.y+clip.height/2);await page.mouse.wheel(0,450);await page.waitForTimeout(200);
 expect(await page.evaluate(()=>{const s=(window as any).__vn.game.scene.getScene('armory'),tip=s.tooltip.list.find((n:any)=>n.name==='card_tooltip');return tip.list.find((n:any)=>n.list?.some((t:any)=>t.type==='Text'&&t.text.includes('Kết thúc mô tả đầy đủ')))?.y??0;})).toBeLessThan(0);
 const after=await page.screenshot({clip});expect(after.equals(before)).toBe(true);
 await page.keyboard.press("Escape");await expect(page.getByRole("searchbox",{name:"Tìm trang bị"})).toBeVisible();
});

test('hero collection also keeps header labels outside images and controls bordered',async({page})=>{
 await openScene(page,'heroes');
 const result=await page.evaluate(()=>{const s=(window as any).__vn.game.scene.getScene('heroes');const walk=(n:any[]):any[]=>n.flatMap(x=>[x,...(x.list?walk(x.list):[])]);const tiles=s.root.list.filter((n:any)=>n.name?.startsWith('hero-tile:'));return {text:walk(s.root.list).filter(n=>n.type==='Text').map(n=>n.text).join(' '),borders:walk(s.root.list).filter(n=>n.type==='Rectangle'&&n.input).map(n=>n.lineWidth),images:tiles.map((t:any)=>{const a=t.list.find((n:any)=>n.type==='Image'&&n.texture.key.includes('@contain-')),l=t.list.find((n:any)=>n.type==='Text'&&n.y===-65);return {top:a.getBounds().top,labelBottom:l.getBounds().bottom};})};});
 expect(result.images.every((i:{top:number;labelBottom:number})=>i.top>i.labelBottom)).toBe(true);expect(result.borders.every(b=>b>0)).toBe(true);expect(result.text).not.toMatch(/\b(?:HP|ART|Art|art)\b/);await page.screenshot({path:'../../docs/inventory-ui/rules-heroes.png'});
});

test('missing hero artwork keeps its fallback fully inside the bordered image region',async({page})=>{
 await openScene(page,'heroes');
 const bounds=await page.evaluate(()=>{const h=(window as any).__vn,s=h.game.scene.getScene('heroes');for(const key of h.game.textures.getTextureKeys().filter((k:string)=>k.startsWith('heroes:m05')))h.game.textures.remove(key);s.heroId='m05';s.render();const tile=s.root.list.find((n:any)=>n.name==='hero-tile:m05');return tile.list.filter((n:any)=>n.type==='Text'&&n.x===0).map((n:any)=>({top:n.y-n.displayOriginY,bottom:n.y-n.displayOriginY+n.height}));});
 expect(bounds.length).toBeGreaterThan(0);expect(bounds.every((b:{top:number;bottom:number})=>b.top>=-43&&b.bottom<=11)).toBe(true);
});
