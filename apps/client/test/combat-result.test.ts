import { expect, it, vi } from "vitest";
vi.mock("phaser",()=>({ default: { Scene:class {} } }));
vi.mock("virtual:assets-manifest",()=>({ default: {} }));
vi.stubGlobal("window", {devicePixelRatio:1,screen:{width:1280,height:720},location:{href:"http://localhost/"}});
const {CombatScene} = await import("../src/scenes/combat-scene");
const {NetMatch} = await import("../src/net/match");
const {fixture,snapshot} = await import("./helpers/combat-fixture");
it.each([0,1].flatMap(seat => ["won","lost"].flatMap(result => ["pending","complete","failed"].map(status => ({seat,result,status}))))) ("co-op $result for seat $seat during $status settlement",({seat,result,status})=>{
 const {state} = fixture("coop"); state.status=result as "won"|"lost";
 const settlement = status === "complete" ? {status:"complete",end:{result,reason:"combat"}} : status === "failed" ? {status:"failed",error:"fixture failure"} : {status:"pending"};
 const match=new NetMatch({sendMatch:()=>true} as any,snapshot(state,seat,{settlement:settlement as any}));
 const labels:string[]=[]; const cue=vi.fn();
 const harness={netMatch:match,state,mySeat:seat,audio:{play:cue},root:{add:()=>{}},screenDim:()=>({}),endScreenButton:()=>{},text:(_x:number,_y:number,label:string)=>{labels.push(label);return {setOrigin:()=>{}};}};
 (CombatScene.prototype as any).renderCombatEnd.call(harness);

 expect(labels).toContain(result === "won" ? "THẮNG" : "THUA");
 expect(cue).toHaveBeenCalledWith(result === "won" ? "victory" : "defeat");
});
it("live terminal push enters settlement pending before match.end",()=>{
 const {state} = fixture("pvp"); const match=new NetMatch({sendMatch:()=>true} as any,snapshot(state));
 state.status="won"; state.winner=0;
 match.handle({type:"match.events",matchId:match.matchId,eventSeq:1,nextActionSeq:1,events:[{type:"combatEnded",result:"won",winner:0}],view:state,deadline:null});
 expect(match.settlement.status).toBe("pending");
});

it("compact summon status badges leave armor and HP regions readable", () => {
 const {state,data} = fixture();
 const badges: {x:number;y:number;r:number}[]=[];
 const node = new Proxy({}, {get:()=>()=>node});
 const unit={...state.heroes[0],id:"summon",statuses:[{id:"strength",value:3},{id:"weak",value:2},{id:"burn",value:1}]};
 const harness={state,gameData:data,targeting:null,textures:{exists:()=>true},add:{image:()=>node,text:()=>node},badge:(x:number,y:number,r:number)=>{badges.push({x,y,r});return node;},hoverTooltip:()=>{},statusSourceLine:()=>"",fullStatusLines:()=>[]};
 (CombatScene.prototype as any).statusIcons.call(harness,{unit,statuses:unit.statuses,w:80,h:108,x:1000,y:410}, {add:()=>{}});
 const armor={left:-35.75,right:-10.25,top:-19.45,bottom:9.45};
 for(const b of badges) expect(b.x-b.r>=armor.right || b.x+b.r<=armor.left || b.y-b.r>=armor.bottom || b.y+b.r<=armor.top).toBe(true);
});

it("a known co-op personal forfeit stays lost while the team wins pending settlement",()=>{
 const {state}=fixture("coop");state.status="won";
 const match=new NetMatch({sendMatch:()=>true} as any,snapshot(state,1));
 match.handle({type:"match.events",matchId:match.matchId,eventSeq:1,nextActionSeq:1,events:[{type:"playerForfeited",player:1,reason:"resign"},{type:"combatEnded",result:"won"}],view:state,deadline:null});
 const labels:string[]=[],cue=vi.fn();
 const harness={netMatch:match,state,mySeat:1,audio:{play:cue},root:{add:()=>{}},screenDim:()=>({}),endScreenButton:()=>{},text:(_x:number,_y:number,label:string)=>{labels.push(label);return {setOrigin:()=>{}};}};
 (CombatScene.prototype as any).renderCombatEnd.call(harness);
 expect(labels).toContain("THUA");
 expect(cue).toHaveBeenCalledWith("defeat");
});


