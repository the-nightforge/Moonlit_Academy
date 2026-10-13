const asset='../../apps/client/public/assets/';
const img=(name,alt='',cls='')=>`<img class="${cls}" src="${asset}${name}.webp" alt="${esc(alt)}">`;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const words=s=>String(s).replace(/\bHP\b/g,'máu').replace(/\bdamage\b/g,'sát thương').replace(/\bXP\b/g,'kinh nghiệm');
let heroes,cards,keywords,config,progress={},heroId='m05',cardId='',many=false,busy=false;
const scenario=document.querySelector('#scenario'),confirmation=document.querySelector('#confirm');
const level=xp=>config.masteryLevels.filter(n=>xp>=n).length;
const pending=id=>Math.max(0,Math.min(level(progress[id].xp)+(progress[id].bonusUnlocks||0),heroes.find(h=>h.id===id).lockedCardIds.length)-progress[id].unlocked.length);
const artwork=c=>`cards/art_${c.art||c.keywords?.[0]||(c.type==='attack'?'attack':'skill')}`;
const branch=(h,c)=>h.branches?.find(b=>b.cardIds.includes(c.id))?.name||'';
function reset(){
 progress=Object.fromEntries(heroes.map((h,i)=>[h.id,{xp:i===0?345:i===1?120:1245,unlocked:i===0?h.lockedCardIds.slice(0,1):i===1?h.lockedCardIds.slice(0,1):[...h.lockedCardIds]}]));
 const h=heroes.find(h=>h.id===heroId)||heroes[0];heroId=h.id;const p=progress[heroId];
 if(scenario.value==='none'){p.xp=165;p.unlocked=h.lockedCardIds.slice(0,2);}
 if(scenario.value==='complete'){p.xp=1245;p.unlocked=[...h.lockedCardIds];}
 if(scenario.value==='maxPending'){p.xp=1245;p.unlocked=h.lockedCardIds.slice(0,4);}
 if(['ready','pending','offline','error'].includes(scenario.value)){p.xp=345;p.unlocked=h.lockedCardIds.slice(0,1);}
 cardId=h.lockedCardIds.find(id=>!p.unlocked.includes(id))||h.lockedCardIds[0];busy=scenario.value==='pending';document.querySelector('#receipt').textContent='';render();
}
function render(){
 const focused=document.activeElement?.dataset.control;
 const h=heroes.find(h=>h.id===heroId),p=progress[heroId],lv=level(p.xp),n=pending(heroId),c=cards[cardId];
 const roster=document.querySelector('#heroes'),oldScroll=roster.scrollTop,oldX=roster.scrollLeft;
 roster.innerHTML=scenario.value==='empty'?'':(many?heroes:heroes.slice(0,3)).map(hero=>`<button class="hero" data-hero="${hero.id}" data-control="hero-${hero.id}" aria-pressed="${hero.id===heroId}" aria-label="${esc(`Chọn ${hero.name}, Tu Luyện cấp ${level(progress[hero.id].xp)}, còn ${pending(hero.id)} lượt mở`)}">${img('heroes/'+hero.id)}<span><strong>${esc(hero.name)}</strong><span class="meta">${img('ui/nav_mastery')} ${level(progress[hero.id].xp)} / 6</span></span>${pending(hero.id)?`<span class="count" aria-hidden="true">● ${pending(hero.id)}</span>`:''}</button>`).join('');
 roster.scrollTop=oldScroll;roster.scrollLeft=oldX;
 if(scenario.value==='empty'){document.querySelector('#main').innerHTML=`<div class="empty">${img('ui/nav_heroes')}<h2>Chưa có Hero để Tu Luyện</h2><button data-go="summon">${img('ui/nav_banners')} Đến Triệu Hồi</button></div>`;document.querySelector('#details').hidden=true;return;}
 document.querySelector('#details').hidden=false;
 const start=lv?config.masteryLevels[lv-1]:0,end=config.masteryLevels[lv],percent=end?Math.min(100,(p.xp-start)/(end-start)*100):100;
 const notice=scenario.value==='offline'?'Đang ngoại tuyến. Kết nối để mở lá khóa.':busy?'Đang mở khóa…':scenario.value==='error'?'Chưa mở được lá. Lượt mở của bạn vẫn được giữ.':'';
 document.querySelector('#main').innerHTML=`<section class="overview">${img('heroes/'+h.id)}<div class="progress"><h2>${esc(h.name)}</h2><span class="muted">Tu Luyện cấp ${lv} / ${config.masteryLevels.length}</span><div class="progressline"><span>${end?`${p.xp-start} / ${end-start} kinh nghiệm`:'Đã đạt cấp tối đa'}</span><span class="muted">${end?`Còn ${end-p.xp}`:''}</span></div><div class="track" role="progressbar" aria-label="Kinh nghiệm trong cấp Tu Luyện" aria-valuemin="0" aria-valuemax="${end?end-start:1}" aria-valuenow="${end?p.xp-start:1}"><i style="width:${percent}%"></i></div></div></section><div class="summary"><span>Đã mở ${p.unlocked.length} / ${h.lockedCardIds.length} lá khóa</span><strong>${img('ui/nav_mastery')} ${n} lượt mở</strong></div>${notice?`<div class="notice" role="status"><span>${notice}</span>${scenario.value==='error'?`<button class="icon" data-retry aria-label="Cập nhật lại lượt mở">${img('ui/action_reset')}</button>`:''}</div>`:''}<section class="grid" aria-label="Lá khóa của ${esc(h.name)}">${h.lockedCardIds.map(id=>{const card=cards[id],done=p.unlocked.includes(id);return `<button class="card ${done?'unlocked':''}" data-card="${id}" data-control="card-${id}" aria-pressed="${id===cardId}" aria-label="${esc(`Xem ${card.name}, ${done?'đã mở':'chưa mở'}, ${card.cost} Nguyệt Lực`)}">${img(artwork(card))}<strong class="title">${esc(card.name)}</strong><span class="meta"><span class="cost">${img('ui/moon_full')} ${card.cost}</span><span class="state">${img(done?'ui/check':'ui/lock')} ${done?'Đã mở':'Chưa mở'}</span></span></button>`;}).join('')}</section><div class="help"><span class="muted">Mỗi cấp Tu Luyện nhận 1 lượt mở.</span><button class="icon" data-go="run" aria-label="Đến Tầm Nguyệt để nhận kinh nghiệm Tu Luyện">${img('ui/mode_run')}</button></div>`;
 const done=p.unlocked.includes(cardId),disabled=done||!n||busy||scenario.value==='offline';
 document.querySelector('#details').innerHTML=`<div class="detail-scroll"><div class="detail-top">${img(artwork(c))}<div><h2>${esc(c.name)}</h2><div class="cost">${img('ui/moon_full','Nguyệt Lực')} ${c.cost} Nguyệt Lực</div><div class="branch">${esc(branch(h,c))}</div></div></div><p class="rules">${esc(words(c.text))}</p>${(c.keywords||[]).map(k=>`<div class="keyword">${img('ui/kw_'+k)}<div><strong>${esc(keywords[k]?.name||k)}</strong><p>${esc(words(keywords[k]?.text||''))}</p></div></div>`).join('')}<p class="muted">Tối đa ${c.copies} bản trong bộ bài</p></div><footer class="action"><p>${done?'Lá đã có trong danh sách để xếp bộ bài.':n?'Dùng 1 lượt mở của '+esc(h.name)+'.':'Lên cấp Tu Luyện hoặc nhận lượt mở từ Tinh Hồn.'}</p>${done?`<button data-go="deck">${img('ui/nav_heroes')} Đến xếp bộ bài</button>`:`<button class="primary" data-unlock data-control="unlock" aria-label="${esc('Mở khóa '+c.name+', dùng 1 lượt mở của '+h.name)}" ${disabled?'disabled':''}>${img('ui/nav_mastery')}<span>${busy?'Đang mở khóa':'Mở khóa'}</span></button>`}</footer>`;
 if(focused)document.querySelector(`[data-control="${focused}"]`)?.focus({preventScroll:true});
}
scenario.addEventListener('change',reset);document.querySelector('#many').onclick=()=>{many=!many;document.querySelector('#many').setAttribute('aria-pressed',String(many));render();};
document.body.addEventListener('click',event=>{
 const b=event.target.closest('button');if(!b||b.disabled)return;
 if(b.dataset.hero){heroId=b.dataset.hero;const h=heroes.find(h=>h.id===heroId);cardId=h.lockedCardIds.find(id=>!progress[heroId].unlocked.includes(id))||h.lockedCardIds[0];render();}
 if(b.dataset.card){cardId=b.dataset.card;render();}
 if(b.hasAttribute('data-unlock')){const h=heroes.find(h=>h.id===heroId),c=cards[cardId];document.querySelector('#confirmation').innerHTML=`<div class="confirmation-art">${img(artwork(c))}<div><h3>${esc(c.name)}</h3><span class="muted">${esc(h.name)}</span></div></div><p>Dùng 1 lượt mở. Còn lại <strong>${pending(heroId)-1}</strong> lượt mở.</p><p class="muted">Lá được thêm vào danh sách để xếp bộ bài.</p>`;confirmation.returnValue='';confirmation.showModal();}
 if(b.hasAttribute('data-retry')){scenario.value='ready';busy=false;render();}
 if(b.dataset.go||b.id==='back')document.querySelector('#receipt').textContent='Bản xem trước: điều hướng sẽ được nối trong màn hình game.';
});
confirmation.addEventListener('close',()=>{if(confirmation.returnValue==='unlock'){progress[heroId].unlocked.push(cardId);render();document.querySelector('#receipt').textContent=`Đã mở ${cards[cardId].name}. Còn ${pending(heroId)} lượt mở.`;}(document.querySelector('[data-unlock]')||document.querySelector('[data-card="'+cardId+'"]'))?.focus();});
Promise.all(['heroes','cards','keywords','meta-config'].map(f=>fetch('../../packages/data/'+f+'.json').then(r=>r.json()))).then(([h,c,k,m])=>{heroes=h;cards=Object.fromEntries(c.map(x=>[x.id,x]));keywords=Object.fromEntries(k.map(x=>[x.id,x]));config=m;reset();}).catch(()=>{document.querySelector('#main').textContent='Không tải được dữ liệu xem trước.';});
