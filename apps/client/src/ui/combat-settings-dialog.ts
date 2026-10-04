import Phaser from "phaser";
import type { CombatSettings } from "./combat-settings";
import { registerModal } from "./widgets";
import { roundedPanel } from "./rounded-panel";
import { COLORS, TEXT_BASE, visibleWorld } from "./theme";

/** One scene-owned dialog; updates preserve modal ownership and focus. */
export function showCombatSettings(
  scene: Phaser.Scene, initial: CombatSettings, apply: (next: CombatSettings) => void,
): void {
  const view = visibleWorld(scene), cx = view.x + view.w / 2, cy = view.y + view.h / 2;
  const layer = scene.add.container(0, 0).setDepth(2000).setName("combat_settings");
  layer.add(scene.add.rectangle(cx, cy, view.w, view.h, 0, 0.6).setInteractive());
  layer.add(roundedPanel(scene,cx,cy,520,366).setName("settings_panel"));
  const content = scene.add.container(cx,cy);layer.add(content);
  let settings = {...initial}, lastVolume = initial.volume > 0 ? initial.volume : 0.5;
  let closed = false;
  const close = () => {
    if(closed) return;closed=true;unregister();
    scene.input.keyboard?.off("keydown-ESC",close);
    scene.input.keyboard?.off("keydown-ENTER",close);
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN,close);layer.destroy();
  };
  const unregister = registerModal(close);
  const draw = () => {
    content.removeAll(true);
    const text=(x:number,y:number,value:string,size=14,color: string=COLORS.text)=>{
      const t=scene.add.text(x,y,value,{...TEXT_BASE,fontSize:`${size}px`,color}).setOrigin(0,0.5);content.add(t);return t;
    };
    const control=(x:number,y:number,w:number,label:string,name:string,action:()=>void,active=false)=>{
      const panel=roundedPanel(scene,x,y,w,34,active?0x34486d:0x1d2945,1,active?0xaac7f0:0x66759d,8);
      panel.setName(name).setInteractive({useHandCursor:true});
      panel.on("pointerover",()=>panel.setAlpha(0.8));panel.on("pointerout",()=>panel.setAlpha(1));
      panel.on("pointerup",(p:Phaser.Input.Pointer)=>{if(p.button===0){action();if(!closed){apply({...settings});draw();}}});
      content.add(panel);text(x,y,label,13).setOrigin(0.5);
    };
    text(0,-144,"Thiết Lập",22,COLORS.gold).setOrigin(0.5);
    text(0,-112,"Nhịp độ và âm thanh — lưu trên máy này",13,COLORS.dimText).setOrigin(0.5);
    for(const y of [-58,6,70]) content.add(roundedPanel(scene,0,y,472,54,0x0d152a,1,0x34415e,10));
    text(-216,-58,"Tốc độ");
    control(80,-58,70,"1×","settings_speed_1",()=>settings.speed=1,settings.speed===1);
    control(164,-58,70,"2×","settings_speed_2",()=>settings.speed=2,settings.speed===2);
    text(-216,6,"Giảm chuyển động");
    control(126,6,150,settings.reducedMotion?"Bật":"Tắt","settings_motion",()=>settings.reducedMotion=!settings.reducedMotion,settings.reducedMotion);
    text(-216,70,"Âm thanh");
    control(-30,70,34,"−","settings_volume_down",()=>settings.volume=Math.max(0,settings.volume-0.25));
    text(23,70,`${Math.round(settings.volume*100)}%`,13).setOrigin(0.5);
    control(76,70,34,"+","settings_volume_up",()=>settings.volume=Math.min(1,settings.volume+0.25));
    control(163,70,100,settings.volume===0?"Bật tiếng":"Tắt tiếng","settings_mute",()=>{if(settings.volume>0){lastVolume=settings.volume;settings.volume=0;}else settings.volume=lastVolume;});
    control(0,138,160,"Đóng","settings_close",close,true);
  };
  draw();
  scene.input.keyboard?.on("keydown-ESC",close);scene.input.keyboard?.on("keydown-ENTER",close);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN,close);
}
