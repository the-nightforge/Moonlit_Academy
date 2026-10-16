import { getRunActionError, restHealAmounts, runEventModel, runSwapChoices, type GameData, type MasteryGain, type RunAction, type RunRewards, type RunState } from "rules";
import { displayText } from "./display-text";
import { runCardImage, runEscape as esc, runIcon as icon, runImage, runPortrait as portrait } from "./run-art";
import { RUN_NODE_HELP, RUN_NODE_LABELS, runDeckGroups, runMapModel } from "./run-presentation";
import "./run.css";

export interface RunViewState {
  data: GameData; run: RunState; visited: string[]; lastRelicId?: string | null;
  submitting: boolean; submitted: boolean; error: string; notice: string;
  gains: MasteryGain[]; rewards: RunRewards | null; achievements: string[]; canUnlock: boolean; canRetry: boolean;
}
const STATUS = { current:"Vị trí hiện tại", visited:"Đã đi qua", open:"Có thể đi", upcoming:"Chưa tới", blocked:"Ngoài đường đi" };
const nodeIcon = (type:string) => icon(type==='event'?'node_treasure':`node_${type}`);
/** Native controls keep inspection separate from applying a recorded run action. */
export class RunView {
  private readonly shell=document.createElement("section");
  private readonly content=document.createElement("div");
  private readonly dialog=document.createElement("dialog");
  private readonly live=document.createElement("p");
  private readonly oldOverflow=document.body.style.overflow;
  private state:RunViewState|null=null;
  private selected="";
  private position:string|null|undefined=undefined;
  private dialogSource="";
  private removeId:string|null=null;
  private swapFrom="";
  private swapTo="";
  private eventCard="";
  constructor(private readonly actions:{dispatch:(action:RunAction)=>void;retry:()=>void;back:()=>void;mastery:()=>void}) {
    this.shell.className="vn-run";this.shell.setAttribute("aria-label","Tầm Nguyệt");this.content.className="rn-shell";
    this.live.className="rn-live";this.live.setAttribute("role","status");this.live.setAttribute("aria-live","polite");this.live.setAttribute("aria-atomic","true");
    this.dialog.setAttribute("aria-labelledby","run-dialog-title");this.shell.append(this.content,this.live,this.dialog);document.body.append(this.shell);document.body.style.overflow="hidden";
    this.content.addEventListener("click",event=>{
      const button=(event.target as HTMLElement).closest<HTMLButtonElement>("button");if(!button||button.disabled||!this.state)return;
      const action=button.dataset.action;
      if(action==='pan')this.content.querySelector('.rn-map-scroll')?.scrollBy({left:Number(button.dataset.direction)*260});
      if(action==="node") { this.selected=button.dataset.id!;this.render(this.state,button.dataset.control);if(matchMedia("(max-width:720px)").matches)this.content.querySelector(".rn-preview")?.scrollIntoView({block:"start"}); }
      if(action==="enter")this.dispatch({type:"chooseNode",nodeId:this.selected});
      if(action==="augment")this.dispatch({type:"pickAugment",augmentId:button.dataset.id!});
      if(action==="reward-continue")this.dispatch({type:"pickAugment",augmentId:null});
      if(action==="heal")this.dispatch({type:"rest",choice:"heal"});
      if(action==="swap")this.dispatch({type:"rest",choice:"swapCard",cardId:this.swapFrom,replacementId:this.swapTo});
      if(action==="event-trade")this.dispatch({type:"event",choice:"trade",...(this.eventCard?{cardId:this.eventCard}:{})});
      if(action==="event-rest")this.dispatch({type:"event",choice:"rest"});
      if(action==="continue")this.dispatch({type:"continue"});
      if(action==="remove")this.confirmRemove(button.dataset.id!,button.dataset.control!);
      if(action==="deck"||action==="effects")this.openCollection(action,button.dataset.control!);
      if(action==="retry"&&this.state.canRetry&&!this.state.submitting)this.actions.retry();
      if(action==="back")this.actions.back();
      if(action==="mastery")this.actions.mastery();
    });
    this.content.addEventListener("change",event=>{
      const select=event.target as HTMLSelectElement;if(!this.state)return;
      if(select.dataset.control==='swap-from'){this.swapFrom=select.value;this.swapTo="";}
      if(select.dataset.control==='swap-to')this.swapTo=select.value;
      if(select.dataset.control==='event-card')this.eventCard=select.value;
      this.render(this.state,select.dataset.control);
    });
    this.content.addEventListener('focusin',event=>{
      const node=(event.target as HTMLElement).closest<HTMLElement>('.rn-node'),scroller=this.content.querySelector<HTMLElement>('.rn-map-scroll');
      if(node&&scroller){const n=node.getBoundingClientRect(),s=scroller.getBoundingClientRect();if(n.left<s.left+8||n.right>s.right-8)scroller.scrollLeft=node.offsetLeft-scroller.clientWidth/2;}
    });
    this.dialog.addEventListener("close",()=>{
      const cardId=this.removeId;this.removeId=null;
      if(this.dialog.returnValue==="remove"&&cardId)this.dispatch({type:"rest",choice:"removeCard",cardId});
      this.focus(this.dialogSource);this.dialogSource="";
    });
  }
  private dispatch(action:RunAction) { if(this.state&&!this.state.submitting&&getRunActionError(this.state.data,this.state.run,action)===null)this.actions.dispatch(action); }
  private focus(control:string) { const button=Array.from(this.content.querySelectorAll<HTMLButtonElement|HTMLSelectElement>("[data-control]")).find(b=>b.dataset.control===control&&!b.disabled);if(!button)return false;button.focus({preventScroll:true});return true; }
  render(state:RunViewState,control?:string) {
    const active=document.activeElement as HTMLElement|null, focus=control??(this.content.contains(active)?active?.dataset.control:undefined),scroll=this.shell.scrollTop;
    const previousStatus=this.state?.run.status,wasSubmitting=this.state?.submitting,pan=this.content.querySelector('.rn-map-scroll')?.scrollLeft,changedPosition=this.position!==state.run.position;this.state=state;
    if(changedPosition){this.selected="";this.swapFrom="";this.swapTo="";this.eventCard="";this.position=state.run.position;}
    if(this.dialog.open&&this.removeId&&getRunActionError(state.data,state.run,{type:"rest",choice:"removeCard",cardId:this.removeId})!==null){this.removeId=null;this.dialog.close("cancel");}
    const {run}=state,model=runMapModel(run,state.visited,this.selected);this.selected=model.selectedId;
    const header=`<header class="rn-header">${icon("mode_run")}<div><h1>Tầm Nguyệt</h1><p>Tầng ${model.floor} / ${run.map.floors.length}</p></div><nav aria-label="Hành trang"><button class="rn-tool" data-action="effects" data-control="effects" aria-label="Xem ${run.runRelicIds.length} Kỳ Vật và ${run.augmentIds.length} Lõi">${icon("node_treasure")}<span>${run.runRelicIds.length+run.augmentIds.length}</span></button><button class="rn-tool" data-action="deck" data-control="deck" aria-label="Xem bộ bài, ${run.deck.length} lá">${icon("nav_heroes")}<span>${run.deck.length}</span></button></nav></header>`;
    const team=`<aside class="rn-team" aria-label="Đội hình"><h2>Đội hình</h2><div class="rn-heroes">${run.heroes.map(hero=>`<article class="rn-hero ${hero.hp===0?'fallen':''}">${portrait(state.data,hero.defId)}<div><strong>${esc(state.data.heroes[hero.defId]?.name??hero.defId)}</strong><span>${hero.hp} / ${hero.maxHp} máu</span><div class="rn-health" role="meter" aria-label="Máu ${esc(state.data.heroes[hero.defId]?.name??hero.defId)}" aria-valuemin="0" aria-valuemax="${hero.maxHp}" aria-valuenow="${hero.hp}"><i style="width:${Math.max(0,Math.min(100,hero.hp/hero.maxHp*100))}%"></i></div>${hero.hp===0?'<span>Đã ngã</span>':''}</div></article>`).join('')}</div></aside>`;
    let body="";
    if(run.status==="map")body=this.map(state,model);
    if(run.status==="reward")body=this.reward(state);
    if(run.status==="rest")body=this.rest(state);
    if(run.status==="treasure")body=this.treasure(state);
    if(run.status==="event")body=this.event(state);
    if(run.status==="won"||run.status==="lost")body=this.end(state,model.floor);
    this.content.innerHTML=header+`<main class="rn-layout ${run.status==='map'?'':'rn-choices-layout'}">${team}${body}</main>`;
    const scroller=this.content.querySelector<HTMLElement>('.rn-map-scroll'),selectedNode=this.content.querySelector<HTMLElement>('.rn-node.selected');
    if(scroller)scroller.scrollLeft=changedPosition&&selectedNode?selectedNode.offsetLeft-scroller.clientWidth/2:pan??0;
    this.live.textContent=state.notice;
    if(!this.dialog.open&&((focus&&!this.focus(focus))||(previousStatus!==undefined&&previousStatus!==run.status)||(wasSubmitting&&!state.submitting&&!this.content.contains(document.activeElement)))){
      const next=this.content.querySelector<HTMLButtonElement>('.rn-primary:not(:disabled),[data-action="augment"]:not(:disabled)');
      if(next)next.focus({preventScroll:true});
    }
    this.shell.scrollTop=scroll;
  }
  private map(state:RunViewState,model:ReturnType<typeof runMapModel>) {
    const byId=new Map(model.nodes.map(n=>[n.id,n])),selected=byId.get(this.selected);
    const lines=model.edges.map(edge=>{const a=byId.get(edge.from)!,b=byId.get(edge.to)!,mid=(a.x+b.x)/2;return `<path class="${edge.active?'taken':a.id===state.run.position?'next':''}" d="M ${a.x} ${a.y} C ${mid} ${a.y}, ${mid} ${b.y}, ${b.x} ${b.y}"/>`;}).join('');
    const marks={visited:'✓',current:'◆',open:'•',upcoming:'·',blocked:'−'};
    const nodes=model.nodes.map(node=>`<button class="rn-node rn-node-${node.type} ${node.status} ${node.id===this.selected?'selected':''}" style="left:${node.x}%;top:${node.y}px" data-action="node" data-id="${node.id}" data-control="node-${node.id}" aria-pressed="${node.id===this.selected}" aria-label="Tầng ${node.floor}, đường ${node.lane+1}, ${RUN_NODE_LABELS[node.type]}, ${STATUS[node.status]}">${nodeIcon(node.type)}<span class="rn-node-mark" aria-hidden="true">${marks[node.status]}</span></button>`).join('');
    const floors=state.run.map.floors.map((_,i)=>`<span class="rn-floor ${i+1<=model.floor?'passed':''}" style="left:${6+i*88/Math.max(1,state.run.map.floors.length-1)}%">${i+1}</span>`).join('');
    const legend=Object.entries(RUN_NODE_LABELS).map(([type,label])=>`<span>${nodeIcon(type)}${label}</span>`).join('');
    const terrain=`<svg class="rn-terrain" viewBox="0 0 820 384" preserveAspectRatio="none" aria-hidden="true"><path d="M-20 330 Q110 235 206 290 T422 255 T640 260 T850 185 L850 400 H-20Z"/><path d="M-20 335 Q110 240 206 295 T422 260 T640 265 T850 190"/><path d="M-20 355 Q110 260 206 315 T422 280 T640 285 T850 210"/><path d="M-20 375 Q110 280 206 335 T422 300 T640 305 T850 230"/><path d="M-20 52 Q140 120 244 62 T460 74 T670 45 T850 100 L850 -20 H-20Z"/><path d="M-20 70 Q140 138 244 80 T460 92 T670 63 T850 118"/></svg>`;
    const journey=`<section class="rn-map-panel" aria-label="Bản đồ hành trình"><header><div><span class="rn-kicker">Hành trình</span><h2>Đường lên đỉnh</h2></div><div class="rn-pan"><button data-action="pan" data-direction="-1" data-control="pan-back" aria-label="Xem phần trước của bản đồ">‹</button><button data-action="pan" data-direction="1" data-control="pan-next" aria-label="Xem phần sau của bản đồ">›</button></div></header><div class="rn-map-scroll" tabindex="0" aria-label="Bản đồ các tầng, cuộn ngang để xem đường đi"><div class="rn-map" style="height:${model.height}px;min-width:${model.width}px">${terrain}<svg class="rn-routes" viewBox="0 0 100 ${model.height}" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>${floors}${nodes}<span class="rn-map-caption" aria-hidden="true">Tầm Nguyệt</span></div></div><div class="rn-legend">${legend}</div></section>`;
    if(!selected)return journey;
    const enemyIds=state.data.encounters[selected.encounterId??'']?.enemyIds??[];
    const enemies=runDeckGroups(enemyIds).map(({id,count})=>`<figure>${portrait(state.data,id)}<figcaption>${esc(state.data.enemies[id]?.name??id)}${count>1?` ×${count}`:''}</figcaption></figure>`).join('');
    const reason=selected.status==='open'?'':selected.status==='current'?'Bạn đang ở điểm này.':selected.status==='visited'?'Điểm này đã hoàn thành.':selected.status==='blocked'?'Điểm này nằm ngoài đường hiện tại.':'Hoàn thành điểm hiện tại để đi tiếp.';
    const preview=`<aside class="rn-preview" aria-label="Chi tiết điểm đến"><span class="rn-kicker">Tầng ${selected.floor} · Đường ${selected.lane+1}</span><h2>${RUN_NODE_LABELS[selected.type]}</h2><figure class="rn-landscape">${runImage("run","journey","Đường núi dưới ánh trăng")}</figure>${enemies?`<div class="rn-enemies">${enemies}</div>`:`<div class="rn-location-icon">${nodeIcon(selected.type)}</div>`}<p>${RUN_NODE_HELP[selected.type]}</p><button class="rn-primary" data-action="enter" data-control="enter" aria-label="Tiếp tục tới ${RUN_NODE_LABELS[selected.type]}, tầng ${selected.floor}, đường ${selected.lane+1}" ${selected.status==='open'?'':'disabled'}>${icon(selected.status==='open'?'mode_run':'lock')}Tiếp tục</button>${reason?`<p class="rn-muted">${reason}</p>`:''}</aside>`;
    return journey+preview;
  }
  private relic(state:RunViewState,id:string|undefined,label="Kỳ Vật đã nhận") { const relic=id?state.data.runRelics[id]:undefined;return relic?`<div class="rn-found">${icon('node_treasure')}<div><span class="rn-kicker">${label}</span><h3>${esc(relic.name)}</h3><p>${esc(displayText(relic.text))}</p></div></div>`:''; }
  private reward(state:RunViewState) {
    const reward=state.run.pendingReward;
    return `<section class="rn-choice-panel rn-reward"><span class="rn-kicker">Thưởng chiến thắng</span><h2>Chọn một Lõi</h2><p class="rn-muted">Sau chiến thắng, mỗi anh hùng giữ ít nhất ${Math.round(state.data.runConfig.reviveHpRatio*100)}% máu tối đa, kể cả khi đã ngã.</p>${this.relic(state,reward?.runRelicId)}<div class="rn-augment-grid">${(reward?.augmentChoices??[]).map(id=>{const a=state.data.augments[id];return a?`<button class="rn-augment" data-action="augment" data-id="${esc(id)}" data-control="augment-${esc(id)}" aria-label="Chọn Lõi ${esc(a.name)}">${icon('moon_full')}<strong>${esc(a.name)}</strong><p>${esc(displayText(a.text))}</p><span class="rn-pick">${icon('check')}Chọn</span></button>`:''}).join('')}</div>${reward?.augmentChoices.length===0?'<p>Đã nhận tất cả Lõi có thể tìm thấy.</p><button class="rn-primary" data-action="reward-continue" data-control="reward-continue">'+icon('mode_run')+'Tiếp tục</button>':''}</section>`;
  }
  private rest(state:RunViewState) {
    const heals=restHealAmounts(state.data,state.run),canRemove=state.run.deck.length>state.data.runConfig.minDeckSize;
    return `<section class="rn-choice-panel"><span class="rn-kicker">Một lựa chọn</span><h2>Nghỉ Chân</h2><p>Mỗi điểm nghỉ chỉ dùng một lựa chọn: hồi máu, đổi một lá hoặc bỏ một lá.</p><div class="rn-rest-heal"><div>${icon('node_rest')}<h3>Hồi máu</h3></div><div class="rn-heals">${state.run.heroes.map((hero,i)=>`<span>${esc(state.data.heroes[hero.defId]?.name??hero.defId)}<strong>+${heals[i]} máu</strong></span>`).join('')}</div><button class="rn-primary" data-action="heal" data-control="heal">${icon('node_rest')}Hồi máu</button></div>${this.swapPanel(state)}<div class="rn-divider">Hoặc</div><h3>Bỏ một lá</h3><p class="rn-muted">Bộ bài cần giữ ít nhất ${state.data.runConfig.minDeckSize} lá.</p><div class="rn-remove-grid">${runDeckGroups(state.run.deck).map(({id,count})=>`<button class="rn-remove" data-action="remove" data-id="${esc(id)}" data-control="remove-${esc(id)}" aria-label="Bỏ một lá ${esc(state.data.cards[id]?.name??id)}" ${canRemove?'':'disabled'}>${runCardImage(state.data,id)}<span><strong>${esc(state.data.cards[id]?.name??id)}</strong><span>${icon('moon_full','Nguyệt Lực')}${state.data.cards[id]?.cost??0} · ${count} lá</span></span></button>`).join('')}</div></section>`;
  }
  private cardOptions(state:RunViewState,ids:string[],selected:string) {
    return ids.map(id=>`<option value="${esc(id)}" ${id===selected?'selected':''}>${esc(state.data.cards[id]?.name??id)}</option>`).join('');
  }
  private cardPreview(state:RunViewState,id:string,label:string) {
    const card=state.data.cards[id];
    return `<article class="rn-swap-card"><span class="rn-kicker">${label}</span>${runCardImage(state.data,id)}<h4>${esc(card?.name??id)}</h4><p>${card?.cost??0} Nguyệt Lực · ${esc(state.data.heroes[card?.ownerId??'']?.name??'')}</p><p>${esc(displayText(card?.text??''))}</p></article>`;
  }
  private swapPanel(state:RunViewState) {
    const sources=state.run.deck.filter(id=>runSwapChoices(state.data,state.run,id).length>0);
    if(!sources.length)return `<div class="rn-divider">Hoặc</div><h3>Đổi một lá</h3><p class="rn-muted">Chưa có lá đã mở nào của đội hình để đổi. Bạn vẫn có thể hồi máu hoặc bỏ lá.</p>`;
    if(!sources.includes(this.swapFrom))this.swapFrom=sources[0]!;
    const replacements=runSwapChoices(state.data,state.run,this.swapFrom);
    if(!replacements.includes(this.swapTo))this.swapTo=replacements[0]!;
    return `<section class="rn-swap"><div class="rn-divider">Hoặc</div><h3>Đổi một lá</h3><p>Đổi sang một lá đã mở của cùng anh hùng. Chỉ áp dụng trong hành trình này; bộ bài giữ nguyên số lá.</p>
      <div class="rn-swap-selects"><label>Lá bỏ ra<select data-control="swap-from" ${state.submitting?'disabled':''}>${this.cardOptions(state,sources,this.swapFrom)}</select></label><label>Lá nhận vào<select data-control="swap-to" ${state.submitting?'disabled':''}>${this.cardOptions(state,replacements,this.swapTo)}</select></label></div>
      <div class="rn-swap-preview">${this.cardPreview(state,this.swapFrom,'Trước khi đổi')}${this.cardPreview(state,this.swapTo,'Sau khi đổi')}</div>
      <button class="rn-primary" data-action="swap" data-control="swap" ${state.submitting?'disabled':''}>${icon('action_reset')}Đổi một lá và đi tiếp</button></section>`;
  }
  private event(state:RunViewState) {
    const model=runEventModel(state.data,state.run);if(!model)return '';
    if(!model.cardIds.includes(this.eventCard))this.eventCard=model.cardIds[0]??'';
    return `<section class="rn-choice-panel rn-event"><span class="rn-kicker">Kỳ Ngộ · Chọn một lần</span><h2>${esc(model.title)}</h2><p>${esc(model.text)}</p>
      <div class="rn-event-choices"><article><h3>${esc(model.tradeLabel)}</h3><p>${esc(model.tradeText)}</p>${model.hasReward&&model.reward?`<div class="rn-found"><div><h4>${esc(model.reward.name)}</h4><p>${esc(displayText(model.reward.text))}</p></div></div>`:''}
      ${model.cardIds.length?`<label>Lá đổi lấy Lõi<select data-control="event-card" ${state.submitting?'disabled':''}>${this.cardOptions(state,model.cardIds,this.eventCard)}</select></label>${this.cardPreview(state,this.eventCard,'Lá sẽ rời bộ bài')}`:''}
      <button class="rn-primary" data-action="event-trade" data-control="event-trade" ${state.submitting?'disabled':''}>${icon(model.hasReward?'node_treasure':'nav_mastery')}${esc(model.tradeLabel)}</button></article>
      <article><h3>Dưỡng sức</h3><p>${esc(model.restText)}</p><div class="rn-heals">${state.run.heroes.map(hero=>`<span>${esc(state.data.heroes[hero.defId]?.name??hero.defId)}<strong>+${Math.min(hero.maxHp-hero.hp,Math.floor(hero.maxHp*.2))} máu</strong></span>`).join('')}</div><button class="rn-primary" data-action="event-rest" data-control="event-rest" ${state.submitting?'disabled':''}>${icon('node_rest')}Dưỡng sức và đi tiếp</button></article></div></section>`;
  }
  private treasure(state:RunViewState) {
    const restored=state.lastRelicId===undefined;
    const receipt=this.relic(state,restored?state.run.runRelicIds.at(-1):state.lastRelicId??undefined,restored?"Kỳ Vật gần nhất":"Kỳ Vật đã nhận");
    return `<section class="rn-choice-panel rn-treasure"><h2>Kho Báu</h2>${icon('node_treasure')}${receipt||'<p>Không còn Kỳ Vật mới trong hành trình.</p>'}<button class="rn-primary" data-action="continue" data-control="continue">${icon('mode_run')}Tiếp tục</button></section>`;
  }
  private end(state:RunViewState,floor:number) {
    const won=state.run.status==='won';
    const receipt=state.submitted?`<div class="rn-receipt"><h3>Đã nhận thưởng</h3>${state.gains.map(g=>`<div class="rn-gain">${portrait(state.data,g.heroId)}<span><strong>${esc(state.data.heroes[g.heroId]?.name??g.heroId)}</strong><span>${icon('nav_mastery','Kinh nghiệm Tu Luyện')}+${g.xp}${g.levelAfter>g.levelBefore?` · Tu Luyện cấp ${g.levelAfter}`:''}</span></span></div>`).join('')}${state.rewards?`<div class="rn-loot"><span>${icon('cur_moonJade','Nguyệt Ngọc')}+${state.rewards.moonJade}</span>${state.rewards.darkIron?`<span>${icon('cur_darkIron','Huyền Thiết')}+${state.rewards.darkIron}</span>`:''}</div>${state.rewards.firstWinOfDay?'<p>Gồm thưởng thắng đầu ngày</p>':''}${state.achievements.map(a=>`<p>${esc(displayText(a))}</p>`).join('')}`:''}</div>`:'';
    return `<section class="rn-choice-panel rn-end"><span class="rn-kicker">Kết quả hành trình</span><h2>${won?'Vượt qua Tầm Nguyệt':'Hành trình khép lại'}</h2><figure class="rn-landscape">${runImage('run','journey','Đường núi dưới ánh trăng')}</figure><p>Tầng ${floor} / ${state.run.map.floors.length} · ${state.run.deck.length} lá · ${state.run.runRelicIds.length} Kỳ Vật</p>${state.submitting?'<p role="status">Đang ghi nhận kết quả…</p>':''}${state.error?`<div class="rn-error" role="alert"><p>Chưa ghi nhận: ${esc(state.error)}</p>${state.canRetry?`<button data-action="retry" data-control="retry" ${state.submitting?'disabled':''}>${icon('action_reset')}Gửi lại</button>`:''}</div>`:''}${receipt}<div class="rn-end-actions"><button class="rn-primary" data-action="back" data-control="back" ${state.submitting?'disabled':''}>${icon('nav_back')}Về chọn bộ bài</button>${state.canUnlock?`<button data-action="mastery" data-control="mastery" ${state.submitting?'disabled':''}>${icon('nav_mastery')}Mở lá khóa</button>`:''}</div></section>`;
  }
  private dialogHeader(title:string) { return `<header><h2 id="run-dialog-title">${title}</h2><button value="cancel" aria-label="Đóng">${icon('action_close')}</button></header>`; }
  private openCollection(kind:'deck'|'effects',source:string) {
    const state=this.state;if(!state||this.dialog.open)return;this.removeId=null;this.dialogSource=source;this.dialog.returnValue='';
    let body='';
    if(kind==='deck')body=`<div class="rn-deck-grid">${runDeckGroups(state.run.deck).map(({id,count})=>{const card=state.data.cards[id];return `<article>${runCardImage(state.data,id)}<h3>${esc(card?.name??id)}</h3><span>${card?.cost??0} Nguyệt Lực · ${count} lá</span><p>${esc(displayText(card?.text??''))}</p></article>`;}).join('')}</div>`;
    else body=['runRelicIds','augmentIds'].map(key=>{const relic=key==='runRelicIds';const ids=state.run[key as 'runRelicIds'|'augmentIds'];return `<section><h3>${relic?'Kỳ Vật':'Lõi'}</h3>${ids.length?ids.map(id=>{const item=(relic?state.data.runRelics:state.data.augments)[id];return item?`<article class="rn-effect">${icon(relic?'node_treasure':'moon_full')}<div><h4>${esc(item.name)}</h4><p>${esc(displayText(item.text))}</p></div></article>`:'';}).join(''):'<p class="rn-muted">Chưa có</p>'}</section>`;}).join('');
    this.dialog.innerHTML=`<form method="dialog">${this.dialogHeader(kind==='deck'?`Bộ bài · ${state.run.deck.length} lá`:'Kỳ Vật và Lõi')}<div class="rn-dialog-body">${body}</div></form>`;this.dialog.showModal();
  }
  private confirmRemove(id:string,source:string) {
    const state=this.state;if(!state||this.dialog.open||getRunActionError(state.data,state.run,{type:'rest',choice:'removeCard',cardId:id})!==null)return;
    const card=state.data.cards[id];this.removeId=id;this.dialogSource=source;this.dialog.returnValue='';
    this.dialog.innerHTML=`<form method="dialog">${this.dialogHeader('Bỏ một lá khỏi hành trình')}<div class="rn-dialog-body rn-confirm">${runCardImage(state.data,id)}<div><h3>${esc(card?.name??id)}</h3><p>${esc(displayText(card?.text??''))}</p><p>Còn ${state.run.deck.length-1} lá sau khi bỏ.</p></div></div><footer><button value="cancel">Hủy</button><button class="rn-primary" value="remove">Bỏ một lá</button></footer></form>`;this.dialog.showModal();
  }
  destroy() {this.removeId=null;if(this.dialog.open)this.dialog.close('cancel');this.shell.remove();document.body.style.overflow=this.oldOverflow;}
}
