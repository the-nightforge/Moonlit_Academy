import assets from "virtual:assets-manifest";
import type { GameData, Profile } from "rules";
import { cardArtCandidates } from "./combat-card-view";
import { displayText } from "./display-text";
import type { MasteryCard, MasteryModel } from "./mastery-presentation";
import "./mastery.css";
export interface MasteryViewState { model:MasteryModel; data:GameData; currencies:Profile["currencies"]; online:boolean; busy:boolean; refreshing:boolean; error:string; notice:string }
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);
const url=(key:string)=>{const [kind,id]=key.split(":");return assets[kind!]?.[id!]??"";};
const image=(key:string,alt="",cls="")=>`<img class="${cls}" src="${escape(url(key))}" alt="${escape(alt)}">`;
const icon=(id:string)=>image(`ui:${id}`);
function cardImage(data:GameData,row:MasteryCard,cls=""){return image(cardArtCandidates(data,row.card,row.id).find(k=>url(k))??"cards:art_skill","",cls);}
/** Independent DOM list and native dialog; each image carries its own fitted border. */
export class MasteryView {
  private readonly shell=document.createElement("section");
  private readonly content=document.createElement("div");
  private readonly dialog=document.createElement("dialog");
  private state:MasteryViewState|null=null;
  private readonly bodyOverflow=document.body.style.overflow;
  private choice:{heroId:string;cardId:string}|null=null;
  private resolve:((ok:boolean)=>void)|null=null;
  private previousHero="";
  private previousCard="";
  private gridScroll=new Map<string,number>();
  private detailScroll=new Map<string,number>();
  constructor(private readonly actions:{back:()=>void;hero:(id:string)=>void;card:(id:string)=>void;unlock:()=>void;refresh:()=>void;navigate:(to:"deck-select"|"gacha")=>void}){
    document.body.style.overflow="hidden";this.shell.className="vn-mastery";this.shell.setAttribute("aria-label","Tu Luyện");this.content.className="mt-shell";
    this.dialog.setAttribute("aria-labelledby","mastery-confirm-title");this.shell.append(this.content,this.dialog);document.body.append(this.shell);
    this.content.addEventListener("click",e=>{
      const b=(e.target as HTMLElement).closest<HTMLButtonElement>("button");if(!b||b.disabled)return;
      if(b.dataset.hero)this.actions.hero(b.dataset.hero);
      else if(b.dataset.card)this.actions.card(b.dataset.card);
      else if(b.dataset.go)this.actions.navigate(b.dataset.go as "deck-select"|"gacha");
      else if(b.dataset.control==="back")this.actions.back();
      else if(b.dataset.control==="unlock")this.actions.unlock();
      else if(b.dataset.control==="refresh")this.actions.refresh();
    });
    this.dialog.addEventListener("close",()=>{const resolve=this.resolve;this.resolve=null;this.choice=null;resolve?.(this.dialog.returnValue==="unlock");this.restoreFocus("unlock");});
  }
  get confirming(){return this.dialog.open;}
  confirm(heroId:string,cardId:string):Promise<boolean>{
    const s=this.state,h=s?.model.hero,row=s?.model.selected;
    if(!s||!h||!row||h.id!==heroId||row.id!==cardId||this.resolve)return Promise.resolve(false);
    this.choice={heroId,cardId};this.dialog.returnValue="";
    this.dialog.innerHTML=`<form method="dialog"><header><h2 id="mastery-confirm-title">Mở lá khóa</h2><button type="submit" class="mt-icon" value="cancel" aria-label="Đóng xác nhận">${icon("action_close")}</button></header><div class="mt-confirm-art">${cardImage(s.data,row)}<div><h3>${escape(row.card.name)}</h3><span class="mt-muted">${escape(h.name)}</span></div></div><p>Dùng 1 lượt mở. Còn lại <strong data-remaining>${Math.max(0,h.pending-1)}</strong> lượt mở.</p><p class="mt-muted">Lá được thêm vào danh sách để xếp bộ bài.</p><p data-unavailable class="mt-error" hidden></p><footer><button type="submit" value="cancel">Hủy</button><button type="submit" class="mt-primary" value="unlock" data-confirm>Mở khóa</button></footer></form>`;
    this.syncDialog();this.dialog.showModal();return new Promise(resolve=>{this.resolve=resolve;});
  }
  private syncDialog(){
    if(!this.choice||!this.state)return;
    const {model,online,busy,refreshing}=this.state;
    const available=model.hero?.id===this.choice.heroId&&model.cards.some(c=>c.id===this.choice!.cardId&&!c.unlocked)&&model.hero.pending>0;
    const button=this.dialog.querySelector<HTMLButtonElement>("[data-confirm]");if(button)button.disabled=!available||!online||busy||refreshing;
    const remaining=this.dialog.querySelector<HTMLElement>("[data-remaining]");if(remaining)remaining.textContent=String(Math.max(0,(model.hero?.pending??0)-1));
    const reason=this.dialog.querySelector<HTMLElement>("[data-unavailable]");if(reason){reason.hidden=!!available&&online&&!refreshing;reason.textContent=!online?"Kết nối để mở lá khóa.":refreshing?"Đang cập nhật lượt mở…":!available?"Lá không còn có thể mở. Hãy đóng xác nhận và chọn lại.":"";}
  }
  render(s:MasteryViewState){
    const outerScroll=this.shell.scrollTop;
    const oldRoster=this.content.querySelector<HTMLElement>(".mt-heroes"),ry=oldRoster?.scrollTop??0,rx=oldRoster?.scrollLeft??0;
    const oldGrid=this.content.querySelector<HTMLElement>(".mt-grid"),oldDetail=this.content.querySelector<HTMLElement>(".mt-detail-scroll");
    if(this.previousHero&&oldGrid)this.gridScroll.set(this.previousHero,oldGrid.scrollTop);
    if(this.previousCard&&oldDetail)this.detailScroll.set(this.previousCard,oldDetail.scrollTop);
    const active=document.activeElement as HTMLElement|null,focus=active&&this.content.contains(active)?active.dataset.control:undefined;
    this.state=s;const {model}=s,h=model.hero,row=model.selected,blocked=!s.online||s.busy||s.refreshing;
    const notice=!s.online?"Đang ngoại tuyến. Kết nối để cập nhật và mở lá khóa.":s.busy?"Đang mở khóa…":s.refreshing?"Đang cập nhật tiến độ…":s.error;
    this.content.innerHTML=`<header class="mt-header"><button type="button" class="mt-icon" data-control="back" aria-label="Trở về màn hình chính">${icon("nav_back")}</button><h1>Tu Luyện</h1><div class="mt-wallet">${([['moonJade','Nguyệt Ngọc'],['moonStar','Nguyệt Tinh'],['honor','Vinh Dự']] as const).map(([id,label])=>`<span>${image(`ui:cur_${id}`,label)}${s.currencies[id].toLocaleString('vi-VN')}</span>`).join('')}</div></header><div class="mt-layout"><nav class="mt-roster" aria-label="Chọn Hero"><h2>Hero của bạn</h2><div class="mt-heroes" tabindex="0" data-control="heroes" aria-label="Danh sách Hero">${model.heroes.map(hero=>`<button type="button" class="mt-hero" data-hero="${hero.id}" data-control="hero-${hero.id}" aria-pressed="${hero.id===h?.id}" aria-label="${escape(`Chọn ${hero.name}, Tu Luyện cấp ${hero.progress.level}, còn ${hero.pending} lượt mở`)}" ${s.busy?'disabled':''}>${image(`heroes:${hero.id}`)}<span><strong>${escape(hero.name)}</strong><span class="mt-meta">${icon("nav_mastery")} ${hero.progress.level} / ${hero.progress.maxLevel}</span></span>${hero.pending?`<span class="mt-count" aria-hidden="true">● ${hero.pending}</span>`:''}</button>`).join('')}</div></nav><main class="mt-main">${h?`<section class="mt-overview">${image(`heroes:${h.id}`)}<div><h2>${escape(h.name)}</h2><span class="mt-muted">Tu Luyện cấp ${h.progress.level} / ${h.progress.maxLevel}</span><div class="mt-progressline"><span>${h.progress.remaining===null?'Đã đạt cấp tối đa':`${h.progress.value} / ${h.progress.goal} kinh nghiệm`}</span><span class="mt-muted">${h.progress.remaining===null?'':`Còn ${h.progress.remaining}`}</span></div><div class="mt-track" role="progressbar" aria-label="Kinh nghiệm trong cấp Tu Luyện" aria-valuemin="0" aria-valuemax="${h.progress.goal}" aria-valuenow="${h.progress.value}"><i style="width:${h.progress.goal?h.progress.value/h.progress.goal*100:0}%"></i></div></div></section><div class="mt-summary"><span>Đã mở ${h.unlocked} / ${h.total} lá khóa</span><strong>${icon("nav_mastery")} ${h.pending} lượt mở</strong></div>${notice?`<div class="mt-notice" role="status"><span>${escape(notice)}</span>${!s.busy&&!s.refreshing?`<button type="button" class="mt-icon" data-control="refresh" aria-label="Cập nhật lại tiến độ Tu Luyện">${icon("action_reset")}</button>`:''}</div>`:''}<section class="mt-grid" tabindex="0" data-control="cards" aria-label="Lá khóa của ${escape(h.name)}">${model.cards.map(c=>`<button type="button" class="mt-card ${c.unlocked?'unlocked':''}" data-card="${c.id}" data-control="card-${c.id}" aria-pressed="${c.id===row?.id}" aria-label="${escape(`Xem ${c.card.name}, ${c.unlocked?'đã mở':'chưa mở'}, ${c.card.cost} Nguyệt Lực`)}" ${s.busy?'disabled':''}>${cardImage(s.data,c)}<strong>${escape(c.card.name)}</strong><span class="mt-card-meta"><span>${icon('moon_full')} ${c.card.cost}</span><span>${icon(c.unlocked?'check':'lock')} ${c.unlocked?'Đã mở':'Chưa mở'}</span></span></button>`).join('')}</section><div class="mt-help"><span class="mt-muted">Mỗi cấp Tu Luyện nhận 1 lượt mở.</span><button type="button" class="mt-icon" data-go="deck-select" data-control="run" aria-label="Đến chọn đội hình để nhận kinh nghiệm từ Tầm Nguyệt">${icon('mode_run')}</button></div>`:`<div class="mt-empty">${icon('nav_heroes')}<h2>Chưa có Hero để Tu Luyện</h2><button type="button" data-go="gacha" data-control="summon">${icon('nav_banners')} Đến Triệu Hồi</button>${notice?`<p role="status">${escape(notice)}</p>`:''}</div>`}</main>${h&&row?`<aside class="mt-details" aria-label="Chi tiết lá bài"><div class="mt-detail-scroll" tabindex="0" data-control="detail"><div class="mt-detail-top">${cardImage(s.data,row)}<div><h2>${escape(row.card.name)}</h2><span class="mt-cost">${image('ui:moon_full','Nguyệt Lực')} ${row.card.cost} Nguyệt Lực</span><p class="mt-muted">${escape(row.branch)}</p></div></div><p class="mt-rules">${escape(displayText(row.card.text))}</p>${(row.card.keywords??[]).flatMap(id=>{const k=s.data.keywords[id];return k?[`<div class="mt-keyword">${icon(`kw_${id}`)}<div><strong>${escape(k.name)}</strong><p>${escape(displayText(k.text))}</p></div></div>`]:[]}).join('')}<p class="mt-muted">Tối đa ${row.card.copies} bản trong bộ bài</p></div><footer class="mt-action"><p>${row.unlocked?'Lá đã có trong danh sách để xếp bộ bài.':h.pending?`Dùng 1 lượt mở của ${escape(h.name)}.`:'Lên cấp Tu Luyện hoặc nhận lượt mở từ Tinh Hồn.'}</p>${row.unlocked?`<button type="button" data-go="deck-select" data-control="deck">${icon('nav_heroes')} Đến chọn bộ bài</button>`:`<button type="button" class="mt-primary" data-control="unlock" aria-label="${escape(`Mở khóa ${row.card.name}, dùng 1 lượt mở của ${h.name}`)}" ${blocked||!h.pending?'disabled':''}>${icon('nav_mastery')} ${s.busy?'Đang mở khóa':'Mở khóa'}</button>`}</footer></aside>`:''}</div><p class="mt-receipt" role="status" aria-live="polite">${escape(s.notice)}</p>`;
    const roster=this.content.querySelector<HTMLElement>('.mt-heroes');if(roster){roster.scrollTop=ry;roster.scrollLeft=rx;}
    const grid=this.content.querySelector<HTMLElement>('.mt-grid');if(grid)grid.scrollTop=this.gridScroll.get(h?.id??'')??0;
    const detail=this.content.querySelector<HTMLElement>('.mt-detail-scroll');if(detail)detail.scrollTop=this.detailScroll.get(row?.id??'')??0;
    if(!this.previousHero&&h)this.content.querySelector<HTMLElement>(`[data-hero="${h.id}"]`)?.scrollIntoView({block:'nearest',inline:'nearest'});
    this.previousHero=h?.id??'';this.previousCard=row?.id??'';this.syncDialog();if(focus)this.restoreFocus(focus);this.shell.scrollTop=outerScroll;
  }
  private restoreFocus(control:string){
    const target=Array.from(this.content.querySelectorAll<HTMLElement>('[data-control]')).find(e=>e.dataset.control===control&&!(e instanceof HTMLButtonElement&&e.disabled));
    const selected=this.content.querySelector<HTMLElement>('.mt-card[aria-pressed=true]:not(:disabled)');
    (target??selected??this.content.querySelector<HTMLElement>('.mt-grid')??this.content.querySelector<HTMLElement>('.mt-heroes'))?.focus({preventScroll:true});
  }
  destroy(){const resolve=this.resolve;this.resolve=null;this.choice=null;resolve?.(false);this.dialog.close();this.shell.remove();if(document.body.style.overflow==="hidden")document.body.style.overflow=this.bodyOverflow;}
}
