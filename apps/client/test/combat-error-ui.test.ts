// @vitest-environment happy-dom
import { EventEmitter } from "node:events";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("phaser",()=>({default:{Scene:class {},Scenes:{Events:{SHUTDOWN:"shutdown"}},Scale:{Events:{RESIZE:"resize"}},GameObjects:{Events:{DESTROY:"destroy"}}}}));
vi.mock("virtual:assets-manifest",()=>({default:{}}));
import { CombatScene } from "../src/scenes/combat-scene";
import { fixture, snapshot } from "./helpers/combat-fixture";
import { session } from "../src/session";
import { NetMatch } from "../src/net/match";
class Node extends EventEmitter {
 x=640;y=572;width=300;height=36;destroyed=false;
 setOrigin(){return this;}setDepth(){return this;}setText(){return this;}setPadding(){return this;}setRounded(){return this;}setStrokeStyle(){return this;}setInteractive(){return this;}
 add(){return this;}
 getBounds(){return {left:this.x-this.width/2,top:this.y-this.height/2,width:this.width,height:this.height};}
 destroy(){if(!this.destroyed){this.destroyed=true;this.emit("destroy");}}
}
const prototype=CombatScene.prototype as any;
afterEach(()=>document.body.replaceChildren());
it("actionable combat error survives a board redraw and ends only on explicit accessible dismissal",()=>{
 const {state}=fixture(); const tweens=vi.fn(); const node=()=>new Node();
 const harness:any={state,mySeat:0,isCoop:false,root:{removeAll:vi.fn(),add:vi.fn()},add:{text:node,rectangle:node,container:node},tweens:{add:tweens},events:new EventEmitter(),scale:new EventEmitter(),input:{off:vi.fn()},game:{canvas:{getBoundingClientRect:()=>({left:0,top:0,width:1280,height:720})},scale:{width:1280,height:720}},cameras:{main:{x:0,y:0,zoom:1,worldView:{x:0,y:0}}},cardViews:new Map(),castingIds:new Set(),seatLayers:new Map(),unitAnchors:new Map(),unitViews:new Map(),unitSpecs:new Map(),triggerAnchors:new Map()};
 for(const method of ["renderBackground","renderTopBar","renderEnemies","renderHeroes","renderMoon","renderBottomBar","renderDebugPanel","renderMulliganBar"])harness[method]=()=>{};
 harness.targeting=null;
 prototype.showError.call(harness,"Thao tác chưa được xác nhận, hãy thử lại.");const text=harness.errorText;
 expect(tweens).not.toHaveBeenCalled();
 prototype.renderAll.call(harness);
 expect(harness.errorText).toBe(text);expect(text.destroyed).toBe(false);
 const dismiss=document.querySelector("button")!;expect(dismiss.getAttribute("aria-label")).toContain("Đóng thông báo lỗi");dismiss.click();
 expect(text.destroyed).toBe(true);expect(harness.errorText).toBeUndefined();expect(document.querySelector("button")).toBeNull();
});

it("does not tick a previous combat while the next scene entry is loading",()=>{
 const setText=vi.fn(),tick=vi.fn(),dispatch=vi.fn();
 prototype.update.call({rootReady:false,timerText:{setText},turnClock:{tick},dispatch},0,1000);
 expect(setText).not.toHaveBeenCalled();expect(tick).not.toHaveBeenCalled();expect(dispatch).not.toHaveBeenCalled();
});

it("re-enters the asset gate when recovery discovers a different match",()=>{
 const saved={net:session.net,match:session.match,registry:session.registry};
 try {
  const net:any={sendMatch:vi.fn()},old=new NetMatch(net,snapshot(fixture("pvp").state,0));
  session.net=net;session.registry=null;
  const events=new EventEmitter();
  const harness:any={rootReady:true,events,unbindNet:vi.fn(),playback:{reset:vi.fn()},scene:{restart:vi.fn()},applyNetRejoin:vi.fn(),requestRender:vi.fn()};
  prototype.bindNet.call(harness,old);
  const next={...snapshot(fixture("pvp").state,0),matchId:"replacement"};
  net.onRecovery(next);
  expect(session.match?.matchId).toBe("replacement");
  expect(harness.playback.reset).toHaveBeenCalledOnce();
  expect(harness.scene.restart).toHaveBeenCalledOnce();
  expect(harness.applyNetRejoin).not.toHaveBeenCalled();
  harness.rootReady=false;events.emit("shutdown");
  net.onStatus(false);net.onRecovery(next);
  expect(harness.requestRender).not.toHaveBeenCalled();
  expect(harness.scene.restart).toHaveBeenCalledOnce();
 }finally {Object.assign(session,saved);}
});
