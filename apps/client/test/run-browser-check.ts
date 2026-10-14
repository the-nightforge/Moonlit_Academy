import { loadGameData } from "data";
import { createRun, reachableNodeIds, starterDeck, type RunAction } from "rules";
import { RunView, type RunViewState } from "../src/ui/run-view";
export async function runBrowserChecks():Promise<string[]> {
  const data=loadGameData(),heroIds:[string,string,string]=['m05','f04','m06'];
  const run=createRun(data,{heroIds,seed:42,deckCardIds:starterDeck(data,heroIds)}).run;
  let state:RunViewState={data,run,visited:[],submitting:false,submitted:false,error:'',notice:'',gains:[],rewards:null,achievements:[],canUnlock:false,canRetry:true};
  const actions:RunAction[]=[],results:string[]=[];let retries=0;
  const check=(name:string,ok:boolean)=>results.push(`${ok?'PASS':'FAIL'}: ${name}`);
  const view=new RunView({dispatch:a=>actions.push(a),retry:()=>retries++,back:()=>{},mastery:()=>{}});
  const click=(selector:string)=>document.querySelector<HTMLButtonElement>(`.vn-run ${selector}`)!.click();
  const render=()=>view.render(state);
  const framed=async()=>{
    const images=Array.from(document.querySelectorAll<HTMLImageElement>('.vn-run img')).filter(i=>i.getBoundingClientRect().width>0);
    for(const image of images)if(!image.complete)await new Promise<void>(resolve=>{image.onload=()=>resolve();image.onerror=()=>resolve()});
    return images.length>0&&images.every(image=>{const s=getComputedStyle(image),r=image.getBoundingClientRect(),w=r.width-+s.borderLeftWidth.replace('px','')-+s.borderRightWidth.replace('px',''),h=r.height-+s.borderTopWidth.replace('px','')-+s.borderBottomWidth.replace('px','');return image.naturalWidth>0&&s.objectFit==='contain'&&s.padding==='0px'&&s.borderRadius==='0px'&&+s.borderTopWidth.replace('px','')>0&&Math.abs(w/h-image.naturalWidth/image.naturalHeight)<.006;});
  };
  const buttons=()=>Array.from(document.querySelectorAll<HTMLButtonElement>('.vn-run button')).filter(b=>b.getBoundingClientRect().width>0).every(b=>{const s=getComputedStyle(b);return parseFloat(s.borderTopWidth)>0&&parseFloat(s.borderRadius)>0;});
  const closed=()=>new Promise<void>(resolve=>document.querySelector('dialog')!.addEventListener('close',()=>resolve(),{once:true}));
  try{
    render();check('Map artwork, portraits and icons keep their full ratio and fitted border',await framed());
    if(innerWidth>=1050&&innerHeight>=720)check('Desktop map keeps the team health visible without page scrolling',document.querySelector('.rn-team')!.getBoundingClientRect().bottom<=innerHeight);
    if(innerWidth<=720&&innerHeight>=667)check('Mobile entry action is fully visible on the first screen',document.querySelector('[data-action="enter"]')!.getBoundingClientRect().bottom<=innerHeight);
    const reachable=reachableNodeIds(run)[0]!,far=run.map.floors.at(-1)![0]!.id;
    const scroller=document.querySelector<HTMLElement>('.rn-map-scroll');
    const boss=document.querySelector<HTMLButtonElement>(`[data-id="${far}"]`)!;
    boss.focus();
    const bossRect=boss.getBoundingClientRect(),scrollRect=scroller?.getBoundingClientRect();
    check('Keyboard focus reveals the entire distant encounter in the adventure map',!!scrollRect&&bossRect.left>=scrollRect.left&&bossRect.right<=scrollRect.right);
    const pan=scroller?.scrollLeft;
    click(`[data-id="${far}"]`);click('[data-action="enter"]');check('Distant node inspection cannot apply an action',actions.length===0);
    check('Inspecting an encounter preserves horizontal map position',pan!==undefined&&document.querySelector('.rn-map-scroll')?.scrollLeft===pan);
    check('Selecting a node retains keyboard focus',(document.activeElement as HTMLElement)?.dataset.control===`node-${far}`);
    click(`[data-id="${reachable}"]`);click('[data-action="enter"]');check('Continue applies the exact reachable node once',actions.length===1&&actions[0]?.type==='chooseNode'&&actions[0].nodeId===reachable);
    let styled=buttons();click('[data-action="deck"]');check('Deck dialog shows grouped cards, full descriptions and fitted images',document.querySelector('dialog')!.open&&document.querySelectorAll('.rn-deck-grid article').length>0&&await framed());styled&&=buttons();let done=closed();click('dialog [value="cancel"]');await done;
    state={...state,run:{...run,status:'rest',heroes:run.heroes.map((h,i)=>({...h,hp:i===0?0:Math.max(0,h.maxHp-3)}))}};render();check('Rest preview follows authoritative healing amounts including a fallen hero',document.querySelector('.rn-heals')?.textContent?.includes(data.heroes[heroIds[0]]!.name)===true&&document.querySelector('.rn-heals')?.textContent?.includes('+16 máu')===true&&await framed());
    const card=run.deck[0]!;click(`[data-action="remove"][data-id="${card}"]`);done=closed();click('dialog [value="cancel"]');await done;check('Cancel never removes a card',actions.length===1);
    click(`[data-action="remove"][data-id="${card}"]`);styled&&=buttons();done=closed();click('dialog [value="remove"]');await done;check('Confirm removes exactly one selected card',actions.length===2&&actions[1]?.type==='rest'&&actions[1].choice==='removeCard'&&actions[1].cardId===card);
    state={...state,run:{...state.run,deck:run.deck.slice(0,data.runConfig.minDeckSize)}};render();check('Minimum deck disables every remove control',Array.from(document.querySelectorAll<HTMLButtonElement>('[data-action="remove"]')).every(b=>b.disabled));styled&&=buttons();
    const choices=Object.keys(data.augments).slice(0,3);state={...state,run:{...run,status:'reward',pendingReward:{augmentChoices:choices,runRelicId:Object.keys(data.runRelics)[0]}}};render();
    if(innerWidth>=1050&&innerHeight>=720){document.querySelector<HTMLElement>('.vn-run')!.scrollTop=0;check('Desktop reward keeps every choice fully visible',Array.from(document.querySelectorAll('.rn-augment')).every(b=>b.getBoundingClientRect().bottom<=innerHeight));}
    document.querySelector<HTMLButtonElement>('[data-action="augment"]')!.focus();click('[data-action="augment"]');check('Reward choice applies the offered Lõi',actions.at(-1)?.type==='pickAugment'&&(actions.at(-1) as {augmentId:string}).augmentId===choices[0]);styled&&=buttons();
    state={...state,run:{...run,status:'map'}};render();check('Finishing a choice moves keyboard focus to Continue',(document.activeElement as HTMLElement)?.dataset.control==='enter');
    state={...state,run:{...run,status:'treasure',runRelicIds:[Object.keys(data.runRelics)[0]!]},lastRelicId:null};render();check('An empty treasure never claims an old relic as newly earned',!document.querySelector('.rn-found')&&document.querySelector('.rn-treasure')?.textContent?.includes('Không còn Kỳ Vật mới')===true);
    state={...state,run:{...run,status:'lost'},submitting:true};render();check('Pending submission blocks leaving and hides unverified rewards',document.querySelector<HTMLButtonElement>('[data-action="back"]')!.disabled&&!document.querySelector('.rn-receipt'));styled&&=buttons();
    state={...state,submitting:false,error:'Không thể kết nối'};render();document.querySelector<HTMLButtonElement>('[data-action="retry"]')!.focus();click('[data-action="retry"]');check('Submission failure provides a working retry',retries===1);styled&&=buttons();
    state={...state,submitting:true,error:''};render();
    state={...state,submitting:false,notice:'Kết quả đã ghi nhận.',submitted:true,error:'',rewards:{moonJade:100,darkIron:2,firstWinOfDay:true,achievements:[]}};const live=document.querySelector('.rn-live');render();check('Verified results use a stable announcement region and show actual rewards',live===document.querySelector('.rn-live')&&live?.textContent===state.notice&&document.querySelector('.rn-receipt')?.textContent?.includes('+100')===true);
    check('Settling a keyboard retry restores focus to the end action',(document.activeElement as HTMLElement)?.dataset.control==='back');
    check('All tested controls retain a rounded visible border',styled&&buttons());
  }finally{view.destroy();}
  return results;
}
