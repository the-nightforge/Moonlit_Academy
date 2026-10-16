// @vitest-environment happy-dom
import { afterEach, expect, it } from "vitest";
import { loadGameData } from "data";
import { DialogueView } from "../src/ui/dialogue-view";

const data=loadGameData();
let view:DialogueView, next=0, skipped=0;
const setup=()=>{next=0;skipped=0;view=new DialogueView({next:()=>next++,skip:()=>skipped++});return view;};
const render=(index=0,speaker='m05',text='Lời thoại hiện tại',stageId='arc1_s01',part:'before'|'after'='before')=>
  view.render(data,data.storyStages[stageId]!.name,{speaker,text},index,4,{stageId,part});
const click=(action:string)=>document.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!.click();
const key=(target:Element,keyValue=' ',code='Space',repeat=false)=>target.dispatchEvent(new KeyboardEvent('keydown',{key:keyValue,code,repeat,bubbles:true,cancelable:true}));
afterEach(()=>{view?.destroy();document.body.innerHTML='';document.body.style.overflow='';});

it('shows the actual stage scenery and actor portrait in separate image regions',()=>{
  setup();render();
  expect(document.querySelector('.sd-setting img')?.getAttribute('src')).toBe('/assets/story/arc1_s01.webp');
  expect(document.querySelector('.sd-portrait img')?.getAttribute('alt')).toBe('Hoắc Liệt');
  expect(document.querySelector('.sd-speech')?.textContent).toContain('Hoắc Liệt');
});
it('history contains only displayed lines, preserves multiline text and avoids duplicate rerenders',()=>{
  setup();render(0,'narrator','Dòng đầu\nDòng hai');render(1,'m05','Đã đọc');render(1,'m05','Đã đọc');click('history');
  const rows=document.querySelectorAll('.sd-history-list li');
  expect(rows).toHaveLength(2);
  expect(rows[0]?.querySelector('p')?.textContent).toBe('Dòng đầu\nDòng hai');
  expect(rows[1]?.textContent).toContain('Hoắc Liệt');
  expect(next).toBe(0);expect(skipped).toBe(0);
});
it('changing stage or story part clears the transcript and closes its dialog',()=>{
  setup();render();click('history');render(0,'f04','Sau trận','arc1_s01','after');
  expect(document.querySelector('dialog')?.open).toBe(false);click('history');
  expect(document.querySelectorAll('.sd-history-list li')).toHaveLength(1);
  expect(document.querySelector('dialog')?.textContent).not.toContain('Lời thoại hiện tại');
  render(0,'m06','Màn khác','arc1_s02');click('history');
  expect(document.querySelectorAll('.sd-history-list li')).toHaveLength(1);
  expect(document.querySelector('dialog')?.textContent).not.toContain('Sau trận');
});
it('rewinding discards later transcript entries and replaces the displayed line',()=>{
  setup();render(0,'m05','Đầu');render(2,'m06','Cuối');render(0,'f04','Đầu mới');click('history');
  expect(document.querySelectorAll('.sd-history-list li')).toHaveLength(1);
  expect(document.querySelector('dialog')?.textContent).toContain('Đầu mới');
  expect(document.querySelector('dialog')?.textContent).not.toContain('Cuối');
});
it('keyboard advances once, ignores repeats and controls, and never advances behind history',()=>{
  setup();render();
  key(document.body);key(document.body,'Enter','Enter');key(document.body,' ','Space',true);
  key(document.querySelector('[data-action="next"]')!);
  expect(next).toBe(2);
  expect(key(document.querySelector('[data-action="next"]')!,'Enter','Enter',true)).toBe(false);
  click('history');key(document.querySelector('dialog')!);key(document.body,'Enter','Enter');
  expect(next).toBe(2);expect(skipped).toBe(0);
});
it('preserves the live speech region and keyboard focus while changing speakers',()=>{
  setup();render();const speech=document.querySelector('.sd-speech'),button=document.querySelector<HTMLButtonElement>('[data-action="next"]')!;
  button.focus();render(1,'f04','Lời tiếp theo');
  expect(document.querySelector('.sd-speech')).toBe(speech);expect(speech?.getAttribute('aria-live')).toBe('polite');
  expect(document.activeElement).toBe(button);expect(speech?.textContent).toContain('Ôn Như Ý');
});
it('keeps speaker and history text literal rather than interpreting markup',()=>{
  setup();render(0,'narrator','<img src=x onerror=alert(1)> & "lời"');click('history');
  expect(document.querySelector('.sd-speech p')?.textContent).toBe('<img src=x onerror=alert(1)> & "lời"');
  expect(document.querySelector('.sd-history-list p img')).toBeNull();
});
it('uses a narrator fallback and supports legacy callers without stage context',()=>{
  setup();view.render(data,'Nhập Học',{speaker:'missing',text:'Lời dẫn'},0,1);
  expect(document.querySelector('.sd-speech')?.textContent).toContain('Người dẫn chuyện');
  expect(document.querySelector('.sd-portrait img')?.getAttribute('src')).toBe('/assets/ui/mode_story.webp');
  expect(document.querySelector('.sd-setting')?.hasAttribute('hidden')).toBe(true);
});
it('labels the last action with its real destination and cleans up keyboard listeners',()=>{
  setup();document.body.style.overflow='hidden';render(3);
  expect(document.querySelector('[data-action="next"]')?.textContent).toContain('Chọn bộ bài');
  render(3,'m05','Kết thúc','arc1_s01','after');
  expect(document.querySelector('[data-action="next"]')?.textContent).toContain('Về Cốt Truyện');
  click('next');click('skip');expect(next).toBe(1);expect(skipped).toBe(1);
  view.destroy();key(document.body);expect(next).toBe(1);
});
it('reader mode clearly returns to story even for the before-fight dialogue',()=>{
  setup();view.render(data,'Nhập Học',{speaker:'m05',text:'Đọc lại'},0,1,{stageId:'arc1_s01',part:'before',replayOnly:true});
  expect(document.querySelector('.sd-part')?.textContent).toContain('Xem lại hội thoại');
  expect(document.querySelector('[data-action="next"]')?.textContent).toContain('Về Cốt Truyện');
  expect(document.querySelector('[data-action="skip"]')?.getAttribute('aria-label')).toContain('về Cốt Truyện');
});
