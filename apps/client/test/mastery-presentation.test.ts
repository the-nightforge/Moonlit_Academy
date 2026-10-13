import { describe, expect, it } from "vitest";
import { loadGameData } from "data";
import { createProfile, unlockCard } from "rules";
import { masteryModel, MasteryUnlockFlow } from "../src/ui/mastery-presentation";
const data = loadGameData();
const heroId = "m05", cardId = "m05_no_hoa_lien_hoan";
function ready() { const p = createProfile(data); p.heroes.m05!.xp = 345; p.heroes.m05!.unlockedCardIds = ["m05_huyet_chien"]; return p; }
describe("mastery presentation", () => {
  it("preserves an owned entry selection and prefers earned unlocks when it is unavailable", () => {
    const p = ready(); expect(masteryModel(data,p,"f04").hero?.id).toBe("f04");
    expect(masteryModel(data,p,"unknown").hero?.id).toBe("m05");
    expect(masteryModel(data,p,heroId,cardId).selected?.id).toBe(cardId);
    expect(masteryModel(data,p,heroId,"f04_bach_hoa").selected?.id).toBe(cardId);
  });
  it("shows experience inside the current level instead of cumulative experience", () => {
    const p = ready(); p.heroes.m05!.xp = 240;
    expect(masteryModel(data,p,heroId).hero?.progress).toEqual({level:2,maxLevel:6,value:75,goal:180,remaining:105});
    p.heroes.m05!.xp=45;
    expect(masteryModel(data,p,heroId).hero?.progress).toEqual({level:1,maxLevel:6,value:0,goal:120,remaining:120});
  });
  it("keeps earned unlocks at maximum level and caps constellation bonus unlocks to real cards", () => {
    const p=ready(); p.heroes.m05!.xp=1245; p.heroes.m05!.bonusUnlocks=2;
    const m=masteryModel(data,p,heroId); expect(m.hero?.pending).toBe(5); expect(m.hero?.progress.remaining).toBeNull();
    p.heroes.m05!.unlockedCardIds=[...data.heroes.m05!.lockedCardIds];
    expect(masteryModel(data,p,heroId).hero?.pending).toBe(0);
    expect(masteryModel(data,p,heroId).cards.every(c=>c.unlocked)).toBe(true);
  });
  it("handles no owned heroes and ignores unknown profile entries", () => {
    const p=ready(); p.heroes={unknown:p.heroes.m05!}; const m=masteryModel(data,p);
    expect(m.heroes).toEqual([]); expect(m.hero).toBeNull(); expect(m.cards).toEqual([]); expect(m.selected).toBeNull();
  });
});
describe("mastery unlock flow",()=>{
  it("rechecks the current profile after confirmation and submits no stale choice",async()=>{
    let p=ready(),submitted=0; const flow=new MasteryUnlockFlow();
    const result=await flow.unlock(data,heroId,cardId,{profile:()=>p,online:()=>true,valid:()=>true,confirm:async()=>{p.heroes.m05!.unlockedCardIds.push(cardId); return true;},submit:async()=>{submitted++;}});
    expect(result.status).toBe("unavailable"); expect(submitted).toBe(0); expect(flow.phase).toBe("idle");
  });
  it("deduplicates pending actions and returns the server result",async()=>{
    let p=ready(),sent=0,release!:()=>void; const gate=new Promise<void>(r=>release=r),flow=new MasteryUnlockFlow();
    const ctx={profile:()=>p,online:()=>true,valid:()=>true,confirm:async()=>true,submit:async(h:string,c:string)=>{sent++;await gate; const result=unlockCard(data,p,h,c);if(!result.ok)throw Error(result.error);p=result.profile;return {rev:2};}};
    const first=flow.unlock(data,heroId,cardId,ctx); await Promise.resolve();
    expect(flow.phase).toBe("pending"); expect((await flow.unlock(data,heroId,cardId,ctx)).status).toBe("busy");
    release(); expect(await first).toEqual({status:"success",reply:{rev:2}});expect(sent).toBe(1);expect(p.heroes.m05!.unlockedCardIds).toContain(cardId);expect(flow.phase).toBe("idle");
  });
  it("cancels when the owner leaves during confirmation and when connectivity changes",async()=>{
    const p=ready();for(const change of ["owner","network"]){let valid=true,online=true,sent=0;const f=new MasteryUnlockFlow();
      const result=await f.unlock(data,heroId,cardId,{profile:()=>p,valid:()=>valid,online:()=>online,confirm:async()=>{if(change==="owner")valid=false;else online=false;return true;},submit:async()=>{sent++;}});
      expect(result.status).toBe(change==="owner"?"cancelled":"unavailable");expect(sent).toBe(0);
    }
  });
  it("leaves the profile unchanged on a rejected server request and releases the action",async()=>{
    const p=ready(),before=JSON.stringify(p),error=Error("server rejected"),flow=new MasteryUnlockFlow();
    expect(await flow.unlock(data,heroId,cardId,{profile:()=>p,online:()=>true,valid:()=>true,confirm:async()=>true,submit:async()=>{throw error;}})).toEqual({status:"error",error});
    expect(JSON.stringify(p)).toBe(before);expect(flow.phase).toBe("idle");
  });
  it("ignores a late result after leaving the scene",async()=>{
    const p=ready();let valid=true;const flow=new MasteryUnlockFlow();
    expect((await flow.unlock(data,heroId,cardId,{profile:()=>p,online:()=>true,valid:()=>valid,confirm:async()=>true,submit:async()=>{valid=false;return {rev:2};}})).status).toBe("cancelled");
  });
});
