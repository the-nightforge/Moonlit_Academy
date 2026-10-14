import { loadGameData } from "data";
import { DialogueView } from "../src/ui/dialogue-view";

/** Real-browser layout and keyboard checks; run from a disposable Vite QA entry. */
export async function runDialogueBrowserChecks():Promise<string[]> {
  const data=loadGameData(),results:string[]=[];let next=0,skipped=0;
  const view=new DialogueView({next:()=>next++,skip:()=>skipped++});
  const check=(name:string,ok:boolean)=>results.push(`${ok?'PASS':'FAIL'}: ${name}`);
  const stage=data.storyStages.arc1_s01!;
  const render=(index:number,part:'before'|'after'='before')=>view.render(data,stage.name,stage[part][index]!,index,stage[part].length,{stageId:stage.id,part});
  const click=(action:string)=>document.querySelector<HTMLButtonElement>(`.vn-story-dialogue [data-action="${action}"]`)!.click();
  const framed=async()=>{
    const images=Array.from(document.querySelectorAll<HTMLImageElement>('.vn-story-dialogue img')).filter(image=>image.getBoundingClientRect().width>0);
    await Promise.all(images.filter(image=>!image.complete).map(image=>new Promise<void>(resolve=>{image.addEventListener('load',()=>resolve(),{once:true});image.addEventListener('error',()=>resolve(),{once:true});})));
    return images.length>0&&images.every(image=>{const s=getComputedStyle(image),r=image.getBoundingClientRect(),w=r.width-parseFloat(s.borderLeftWidth)-parseFloat(s.borderRightWidth),h=r.height-parseFloat(s.borderTopWidth)-parseFloat(s.borderBottomWidth);return image.naturalWidth>0&&s.objectFit==='contain'&&s.padding==='0px'&&s.borderRadius==='0px'&&parseFloat(s.borderTopWidth)>0&&Math.abs(w/h-image.naturalWidth/image.naturalHeight)<.004;});
  };
  const bordered=()=>Array.from(document.querySelectorAll<HTMLButtonElement>('.vn-story-dialogue button')).filter(b=>b.getBoundingClientRect().width>0).every(b=>{const s=getComputedStyle(b);return parseFloat(s.borderTopWidth)>0&&parseFloat(s.borderRadius)>0;});
  const close=async()=>{const dialog=document.querySelector<HTMLDialogElement>('.sd-history')!,done=new Promise<void>(resolve=>dialog.addEventListener('close',()=>resolve(),{once:true}));dialog.querySelector<HTMLButtonElement>('button[value="close"]')!.click();await done;};
  try{
    check('Initial controls are disabled until a line is ready',Array.from(document.querySelectorAll<HTMLButtonElement>('.vn-story-dialogue [data-action]')).every(b=>b.disabled));
    render(0);check('Narrator, scenery and icons keep their entire image inside fitted borders',await framed());
    if(innerWidth>=375&&innerHeight>=667)check('First story line keeps Continue fully visible',document.querySelector('[data-action="next"]')!.getBoundingClientRect().bottom<=innerHeight);
    const live=document.querySelector('.sd-speech');let styled=bordered();
    render(1);check('Actor and stage illustration occupy separate regions',document.querySelector('.sd-portrait img')?.getAttribute('alt')==='Hoắc Liệt'&&await framed());
    const image=document.querySelector('.sd-portrait img')!.getBoundingClientRect(),speech=document.querySelector('.sd-speech')!.getBoundingClientRect();
    check('Speech never covers the actor image',image.right<=speech.left||image.bottom<=speech.top);
    click('next');click('skip');check('Next and skip each dispatch exactly once',next===1&&skipped===1);
    click('history');check('History contains only displayed lines',document.querySelectorAll('.sd-history-list li').length===2&&!document.querySelector('.sd-history-list')!.textContent!.includes(stage.before[2]!.text));
    styled&&=bordered();check('History controls and images preserve the same frame rules',await framed());
    const modal=document.querySelector('dialog')!;
    modal.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',key:' ',bubbles:true,cancelable:true}));
    modal.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
    check('Keyboard cannot advance the story behind history',next===1);
    await close();check('Closing history returns focus to its control',(document.activeElement as HTMLElement)?.dataset.action==='history');
    document.body.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',key:' ',bubbles:true,cancelable:true}));
    check('Keyboard advances outside controls exactly once',next===2);
    const repeat=new KeyboardEvent('keydown',{key:'Enter',repeat:true,bubbles:true,cancelable:true});
    document.querySelector('[data-action="next"]')!.dispatchEvent(repeat);
    check('Holding Enter is prevented from skipping multiple lines',repeat.defaultPrevented&&next===2);
    const button=document.querySelector<HTMLButtonElement>('[data-action="next"]')!;button.focus();render(2);
    check('Changing speakers keeps the live region and focused control',document.querySelector('.sd-speech')===live&&document.activeElement===button);
    render(stage.before.length-1);check('Final before action names its real destination',button.textContent?.includes('Chọn bộ bài')===true);
    render(stage.after.length-1,'after');check('Final after action names its real destination',button.textContent?.includes('Về Cốt Truyện')===true);
    click('history');check('After-dialogue clears the before transcript',document.querySelectorAll('.sd-history-list li').length===1);await close();
    const sources=new Set<string>();let allStages=true;
    for(const s of Object.values(data.storyStages)){
      view.render(data,s.name,s.before[0]!,0,s.before.length,{stageId:s.id,part:'before'});
      const src=document.querySelector('.sd-setting img')?.getAttribute('src')??'';sources.add(src);
      allStages&&=src===`/assets/story/${s.id}.webp`&&await framed();
    }
    check('Every story stage reuses its own complete illustration',allStages&&sources.size===Object.keys(data.storyStages).length);
    const long='Nội dung dài vẫn phải đọc đầy đủ.\n'.repeat(100);
    view.render(data,'Kiểm tra nội dung dài',{speaker:'missing',text:long},0,1);
    check('Long dialogue remains complete and scrollable',document.querySelector('.sd-speech p')?.textContent===long&&document.querySelector('.vn-story-dialogue')!.scrollHeight>innerHeight);
    check('Narrator fallback never exposes an internal speaker identifier',document.querySelector('.sd-speech h2')?.textContent==='Người dẫn chuyện');
    check('No horizontal page overflow',document.querySelector('.vn-story-dialogue')!.scrollWidth<=innerWidth);
    check('All tested buttons retain rounded visible borders',styled&&bordered());
  }finally{view.destroy();}
  const count=next;document.body.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',key:' ',bubbles:true,cancelable:true}));
  check('Closing the overlay removes its keyboard listener',next===count&&!document.querySelector('.vn-story-dialogue'));
  return results;
}

/** Exercise every real speaker/text pair; layout space may scroll vertically but never crops inside image frames. */
export async function auditDialogueFrames() {
  const data=loadGameData(),view=new DialogueView({next:()=>{},skip:()=>{}});
  const failures:{stage:string;part:string;line:number;issue:string}[]=[];
  let lines=0;const speakers=new Set<string>();
  try{
    for(const stage of Object.values(data.storyStages))for(const part of ['before','after'] as const)for(const [index,line] of stage[part].entries()){
      view.render(data,stage.name,line,index,stage[part].length,{stageId:stage.id,part});lines++;speakers.add(line.speaker);
      const images=Array.from(document.querySelectorAll<HTMLImageElement>('.vn-story-dialogue img'));
      await Promise.all(images.filter(i=>!i.complete).map(i=>new Promise<void>(resolve=>{i.addEventListener('load',()=>resolve(),{once:true});i.addEventListener('error',()=>resolve(),{once:true});})));
      const fail=(issue:string)=>failures.push({stage:stage.id,part,line:index+1,issue});
      for(const image of images){
        const s=getComputedStyle(image),r=image.getBoundingClientRect(),w=r.width-parseFloat(s.borderLeftWidth)-parseFloat(s.borderRightWidth),h=r.height-parseFloat(s.borderTopWidth)-parseFloat(s.borderBottomWidth);
        if(!image.naturalWidth||s.objectFit!=='contain'||s.padding!=='0px'||s.borderRadius!=='0px'||parseFloat(s.borderTopWidth)<=0||Math.abs(w/h-image.naturalWidth/image.naturalHeight)>.004)fail(`Image frame: ${image.alt}`);
      }
      for(const button of document.querySelectorAll<HTMLButtonElement>('.vn-story-dialogue button')){
        const s=getComputedStyle(button);if(parseFloat(s.borderTopWidth)<=0||parseFloat(s.borderRadius)<=0)fail(`Button border: ${button.getAttribute('aria-label')??button.textContent}`);
      }
      const portrait=document.querySelector('.sd-portrait img')!.getBoundingClientRect(),speech=document.querySelector('.sd-speech')!.getBoundingClientRect();
      if(portrait.right>speech.left&&portrait.bottom>speech.top)fail('Speech overlaps portrait');
      if(document.querySelector('.vn-story-dialogue')!.scrollWidth>innerWidth)fail('Horizontal page overflow');
    }
  }finally{view.destroy();}
  return {viewport:{width:innerWidth,height:innerHeight},stages:Object.keys(data.storyStages).length,lines,speakers:speakers.size,failures};
}
