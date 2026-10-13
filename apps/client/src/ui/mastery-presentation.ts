import { masteryLevel, pendingUnlocks, unlockCard } from "rules";
import type { CardDef, GameData, HeroDef, Profile } from "rules";
export interface MasteryProgress { level:number; maxLevel:number; value:number; goal:number; remaining:number|null }
export interface MasteryHero { id:string; name:string; progress:MasteryProgress; pending:number; unlocked:number; total:number }
export interface MasteryCard { id:string; card:CardDef; unlocked:boolean; branch:string }
export interface MasteryModel { heroes:MasteryHero[]; hero:MasteryHero|null; cards:MasteryCard[]; selected:MasteryCard|null }
export function masteryModel(data:GameData,profile:Profile,heroId?:string,cardId?:string):MasteryModel {
  const levels=data.metaConfig.masteryLevels;
  const heroes=Object.values(data.heroes).filter(h=>profile.heroes[h.id]).map(h=>{
    const p=profile.heroes[h.id]!,level=masteryLevel(data,p.xp),start=levels[level-1]??0,next=levels[level];
    return {id:h.id,name:h.name,pending:pendingUnlocks(data,profile,h.id),unlocked:h.lockedCardIds.filter(id=>p.unlockedCardIds.includes(id)).length,total:h.lockedCardIds.length,
      progress:{level,maxLevel:levels.length,value:next===undefined?1:Math.max(0,p.xp-start),goal:next===undefined?1:next-start,remaining:next===undefined?null:Math.max(0,next-p.xp)}};
  });
  const hero=heroes.find(h=>h.id===heroId)??heroes.find(h=>h.pending>0)??heroes[0]??null;
  if(!hero)return {heroes,hero:null,cards:[],selected:null};
  const def:HeroDef=data.heroes[hero.id]!;
  const cards=def.lockedCardIds.filter(id=>data.cards[id]).map(id=>({id,card:data.cards[id]!,unlocked:profile.heroes[hero.id]!.unlockedCardIds.includes(id),branch:def.branches.find(b=>b.cardIds.includes(id))?.name??""}));
  return {heroes,hero,cards,selected:cards.find(c=>c.id===cardId)??cards.find(c=>!c.unlocked)??cards[0]??null};
}
export type UnlockResult<T>={status:"success";reply:T}|{status:"error";error:unknown}|{status:"busy"|"cancelled"|"unavailable"};
/** One confirmation/request per scene; eligibility is checked again after the dialog. */
export class MasteryUnlockFlow {
  phase:"idle"|"confirming"|"pending"="idle";
  async unlock<T>(data:GameData,heroId:string,cardId:string,context:{profile:()=>Profile;online:()=>boolean;valid:()=>boolean;confirm:()=>Promise<boolean>;submit:(heroId:string,cardId:string)=>Promise<T>;changed?:()=>void}):Promise<UnlockResult<T>> {
    if(this.phase!=="idle")return {status:"busy"};
    const eligible=()=>context.online()&&unlockCard(data,context.profile(),heroId,cardId).ok;
    if(!context.valid())return {status:"cancelled"};
    if(!eligible())return {status:"unavailable"};
    this.phase="confirming";context.changed?.();
    try {
      if(!await context.confirm()||!context.valid())return {status:"cancelled"};
      if(!eligible())return {status:"unavailable"};
      this.phase="pending";context.changed?.();
      const reply=await context.submit(heroId,cardId);
      return context.valid()?{status:"success",reply}:{status:"cancelled"};
    }catch(error){return context.valid()?{status:"error",error}:{status:"cancelled"};}
    finally{this.phase="idle";context.changed?.();}
  }
}
