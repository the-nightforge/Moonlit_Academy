// @vitest-environment happy-dom
import { EventEmitter } from "node:events";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("phaser",()=>({default:{ Scenes:{Events:{SHUTDOWN:"shutdown"}},Scale:{Events:{RESIZE:"resize"}},GameObjects:{Events:{DESTROY:"destroy"}} }}));
import { showModal } from "../src/ui/widgets";
import { showCombatSettings } from "../src/ui/combat-settings-dialog";

class Node extends EventEmitter {
  list:Node[]=[]; parentContainer:Node|null=null; x=0;y=0;width=180;height=34;
  add(node:Node|Node[]) { for(const child of Array.isArray(node)?node:[node]){this.list.push(child);child.parentContainer=this;}return this; }
  removeAll(destroy=false){if(destroy)for(const child of this.list)child.destroy();this.list=[];return this;}
  setOrigin(){return this;}setName(){return this;}setInteractive(){return this;}setStrokeStyle(){return this;}setAlpha(){return this;}setDepth(){return this;}setRounded(){return this;}setFillStyle(){return this;}setY(y:number){this.y=y;return this;}
  setSize(w:number,h:number){this.width=w;this.height=h;return this;}fillStyle(){return this;}fillRoundedRect(){return this;}lineStyle(){return this;}strokeRoundedRect(){return this;}
  getBounds(){return {left:this.x-this.width/2,top:this.y-this.height/2,width:this.width,height:this.height};}
  destroy(){this.emit("destroy");for(const n of this.list)n.destroy();this.removeAll();}
}
function scene(){
 const keyboard=new EventEmitter();
 const node=(x=0,y=0,w=180,h=34)=>Object.assign(new Node(),{x,y,width:w,height:h});
 return {input:{keyboard},events:new EventEmitter(),scale:new EventEmitter(),game:{canvas:{getBoundingClientRect:()=>({left:0,top:0,width:1280,height:720})},scale:{width:1280,height:720}},cameras:{main:{width:1280,height:720,zoom:1,x:0,y:0,worldView:{x:0,y:0}}},add:{rectangle:node,container:(x=0,y=0,list:Node[]=[])=>node(x,y).add(list),graphics:()=>new Node(),text:(x:number,y:number,text:string)=>node(x,y,text.length*7,20)}} as any;
}
const key=(key:string,shiftKey=false)=>document.activeElement!.dispatchEvent(new KeyboardEvent("keydown",{key,shiftKey,bubbles:true,cancelable:true}));
afterEach(()=>document.body.replaceChildren());
it("confirmation starts on cancel; Tab and arrows choose explicit focus and focused native button activates",async()=>{
 const result=showModal(scene(),{message:"Xóa bộ bài?",actions:[{label:"Hủy"},{label:"Xóa",variant:"danger"}]});
 expect(document.activeElement?.getAttribute("aria-label")).toBe("Hủy");
 key("ArrowRight");expect(document.activeElement?.getAttribute("aria-label")).toBe("Xóa");
 key("Tab");expect(document.activeElement?.getAttribute("aria-label")).toBe("Hủy");
 (document.activeElement as HTMLButtonElement).click();expect((await result).action).toBe(0);
 expect(document.querySelectorAll("button")).toHaveLength(0);
});
it("Enter from a text field moves to safe action; Escape dismisses and restores previous focus",async()=>{
 const before=document.createElement("button");document.body.append(before);before.focus();
 const result=showModal(scene(),{message:"Đổi tên",input:{maxLength:20,value:"Tên mới"},actions:[{label:"Hủy"},{label:"Lưu"}]});
 expect(document.activeElement?.tagName).toBe("INPUT");key("Enter");expect(document.activeElement?.getAttribute("aria-label")).toBe("Hủy");
 key("Escape");expect((await result).action).toBe(-1);expect(document.activeElement).toBe(before);
});
it("combat settings are keyboard actionable and preserve the focused control through redraw",()=>{
 const apply=vi.fn();showCombatSettings(scene(),{speed:1,reducedMotion:false,volume:.5},apply);
 expect(document.activeElement?.getAttribute("aria-label")).toBe("Đóng thiết lập");
 key("Tab");expect(document.activeElement?.getAttribute("aria-label")).toBe("Tốc độ một lần");
 key("ArrowRight");(document.activeElement as HTMLButtonElement).click();
 expect(apply).toHaveBeenLastCalledWith({speed:2,reducedMotion:false,volume:.5});
 expect(document.activeElement?.getAttribute("aria-label")).toBe("Tốc độ hai lần");
 key("Escape");expect(document.querySelectorAll("button")).toHaveLength(0);
});
