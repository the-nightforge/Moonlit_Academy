import Phaser from "phaser";
import { COLORS } from "./theme";
import { addText } from "./widgets";

interface Control { element: HTMLButtonElement; hit: Phaser.GameObjects.Rectangle; clip?: { x:number;y:number;width:number;height:number }; pinned: boolean }
/** Semantic overlays mirror local canvas actions; no global button styles change. */
export class EquipmentControls {
  private entries: Control[] = [];
  private live = document.createElement("div");
  private restoreId = "";
  constructor(private scene: Phaser.Scene) {
    this.live.setAttribute("role", "status"); this.live.setAttribute("aria-live", "polite");
    this.live.style.cssText = "position:fixed;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);pointer-events:none";
    document.body.append(this.live);
  }
  announce(text: string) { if (this.live.textContent !== text) this.live.textContent = text; }
  clear() {
    const active = document.activeElement as HTMLElement | null;
    this.restoreId = active?.dataset.equipmentControl ?? "";
    this.entries.forEach(c => c.element.remove()); this.entries = [];
  }
  button(parent:Phaser.GameObjects.Container,x:number,y:number,width:number,label:string,action:()=>void,options:{enabled?:boolean;selected?:boolean;primary?:boolean;height?:number;id?:string;name?:string;role?:"tab";pinned?:boolean;clip?:Control["clip"];onFocus?:()=>void;onBlur?:()=>void;onEnter?:()=>void;onLeave?:()=>void;transparent?:boolean}={}) {
    const enabled=options.enabled ?? true, selected=options.selected ?? false, height=options.height ?? 40;
    const fill=selected?0x344b68:options.primary?0xb8912c:0x17263e;
    const panel=this.scene.add.rectangle(x,y,width,height,enabled||selected?fill:0x222c3b).setStrokeStyle(selected||options.primary?2:1, selected||options.primary?COLORS.goldFill:0x526580);
    const text=addText(this.scene,parent,x,y,label,13,enabled||selected?options.primary?"#141024":COLORS.text:"#91a0b6").setOrigin(.5);
    if(options.transparent) panel.setFillStyle(0,0).setStrokeStyle(0);
    parent.add(panel); parent.bringToTop(text);
    if(selected) parent.add(this.scene.add.rectangle(x,y+height/2-2,width-4,2,COLORS.goldFill));
    panel.setInteractive({useHandCursor:enabled}); if(enabled) panel.on("pointerup",(p:Phaser.Input.Pointer)=>{if(p.button===0)action();});
    const element=document.createElement("button"); element.type="button";element.textContent=label;element.setAttribute("aria-label",options.name??label);element.disabled=!enabled;
    const id=options.id??`${parent.name}:${x}:${y}:${label}`;element.dataset.equipmentControl=id;
    if(options.role){element.setAttribute("role",options.role);element.setAttribute("aria-selected",String(selected));}
    else if(options.selected!==undefined)element.setAttribute("aria-pressed",String(selected));
    element.style.cssText='position:fixed;box-sizing:border-box;z-index:11;padding:0;color:transparent;background:transparent;border:0;border-radius:5px;cursor:pointer;font-size:1px;outline-offset:2px';
    element.addEventListener("click",action);
    element.addEventListener("focus",()=>{element.style.outline="2px solid #c1ddf4";options.onFocus?.();});
    element.addEventListener("blur",()=>{element.style.outline="none";options.onBlur?.();});
    element.addEventListener("pointerenter",()=>{if(enabled&&!selected&&!options.transparent)panel.setFillStyle(0x29405d);options.onEnter?.();});
    element.addEventListener("pointerleave",()=>{if(!options.transparent)panel.setFillStyle(enabled||selected?fill:0x222c3b);options.onLeave?.();});
    element.addEventListener("keydown",e=>{if(e.key==="Escape"||e.key.startsWith("Arrow")||e.key==="PageDown"||e.key==="PageUp"){e.preventDefault();this.scene.input.keyboard?.emit("keydown",e);}else e.stopPropagation();});
    document.body.append(element);this.entries.push({element,hit:panel,clip:options.clip,pinned:!!options.pinned});
    return panel;
  }
  sync(pinned: boolean, modal: boolean) {
    const canvas=this.scene.game.canvas.getBoundingClientRect(),cam=this.scene.cameras.main,sx=canvas.width/this.scene.game.scale.width,sy=canvas.height/this.scene.game.scale.height;
    for(const c of this.entries){
      const b=c.hit.getBounds(); const clip=c.clip;
      const inside=!clip||b.top>=clip.y&&b.bottom<=clip.y+clip.height&&b.left>=clip.x&&b.right<=clip.x+clip.width;
      const visible=inside&&!modal&&(pinned?c.pinned:!c.pinned);
      c.element.style.visibility=visible?"visible":"hidden";
      c.element.style.left=`${canvas.left+(cam.x+(b.left-cam.worldView.x)*cam.zoom)*sx}px`;
      c.element.style.top=`${canvas.top+(cam.y+(b.top-cam.worldView.y)*cam.zoom)*sy}px`;
      c.element.style.width=`${b.width*cam.zoom*sx}px`;c.element.style.height=`${b.height*cam.zoom*sy}px`;
    }
    if(this.restoreId){const entry=this.entries.find(c=>c.element.dataset.equipmentControl===this.restoreId&&c.element.style.visibility==='visible');if(entry){this.restoreId="";entry.element.focus({preventScroll:true});}}
  }
  focus(id:string){this.entries.find(c=>c.element.dataset.equipmentControl===id)?.element.focus({preventScroll:true});}
  removePinned(){const removed=this.entries.filter(c=>c.pinned);removed.forEach(c=>c.element.remove());this.entries=this.entries.filter(c=>!c.pinned);}
  destroy(){this.clear();this.live.remove();}
}
