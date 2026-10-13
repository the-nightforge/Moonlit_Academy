import Phaser from "phaser";
import { applyServerProfile, achievementNotices, errorText, mutate, type ProfileReply } from "../account";
import { api, ApiError, auth } from "../api";
import { session } from "../session";
import { masteryModel, MasteryUnlockFlow } from "../ui/mastery-presentation";
import { MasteryView } from "../ui/mastery-view";
import { useDesignCamera } from "../ui/theme";
export class MasteryScene extends Phaser.Scene {
  private view:MasteryView|null=null;
  private heroId="";
  private cardId="";
  private generation=0;
  private flow=new MasteryUnlockFlow();
  private refreshing=false;
  private networkLost=false;
  private error="";
  private notice="";
  private renderedProfile=session.profile;
  private renderedOnline=session.online;
  constructor(){super("mastery");}
  create(entry?:{heroId?:string}){
    useDesignCamera(this);this.generation++;this.heroId=entry?.heroId??"";this.cardId="";
    this.flow=new MasteryUnlockFlow();this.refreshing=false;this.networkLost=false;this.error="";this.notice="";
    this.view=new MasteryView({back:()=>this.scene.start("deck-select"),hero:id=>{this.heroId=id;this.cardId="";this.render();},card:id=>{this.cardId=id;this.render();},unlock:()=>{void this.unlock();},refresh:()=>{void this.refresh();},navigate:to=>this.scene.start(to)});
    const focus=()=>{if(document.visibilityState!=="hidden")void this.refresh();};
    const escape=(e:KeyboardEvent)=>{if(e.key==="Escape"&&!this.view?.confirming){e.preventDefault();this.scene.start("deck-select");}};
    window.addEventListener("focus",focus);window.addEventListener("online",focus);window.addEventListener("keydown",escape);document.addEventListener("visibilitychange",focus);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{this.generation++;window.removeEventListener("focus",focus);window.removeEventListener("online",focus);window.removeEventListener("keydown",escape);document.removeEventListener("visibilitychange",focus);this.view?.destroy();this.view=null;});
    this.render();void this.refresh();
  }
  update(){if(this.view&&(session.profile!==this.renderedProfile||session.online!==this.renderedOnline))this.render();}
  private current(generation:number,account:number){return !!this.view&&this.generation===generation&&auth.generation===account;}
  private render(){
    const model=masteryModel(session.data,session.profile,this.heroId,this.cardId);this.heroId=model.hero?.id??"";this.cardId=model.selected?.id??"";
    this.renderedProfile=session.profile;this.renderedOnline=session.online;
    this.view?.render({model,data:session.data,currencies:session.profile.currencies,online:session.online&&!this.networkLost,busy:this.flow.phase==="pending",refreshing:this.refreshing,error:this.error,notice:this.notice});
  }
  private async refresh(){
    if(!this.view||this.refreshing||this.flow.phase==="pending"||!session.online)return;
    const generation=this.generation,account=auth.generation;this.refreshing=true;this.render();
    try{const reply=await api<ProfileReply>("GET","/profile");if(!this.current(generation,account))return;if(reply.rev>=session.rev)applyServerProfile(reply);this.networkLost=false;this.error="";}
    catch(error){if(!this.current(generation,account))return;this.networkLost=error instanceof ApiError&&error.status===0;this.error=errorText(error);}
    finally{if(this.current(generation,account)){this.refreshing=false;this.render();}}
  }
  private async unlock(){
    if(!this.view)return;
    const generation=this.generation,account=auth.generation,heroId=this.heroId,cardId=this.cardId;
    const card=session.data.cards[cardId];if(!card)return;
    const result=await this.flow.unlock(session.data,heroId,cardId,{
      profile:()=>session.profile,online:()=>session.online&&!this.networkLost&&!this.refreshing,valid:()=>this.current(generation,account),
      confirm:()=>this.view?.confirm(heroId,cardId)??Promise.resolve(false),
      submit:(h,c)=>mutate<ProfileReply&{achievements?:string[]}>("POST","/profile/unlock",{heroId:h,cardId:c}),
      changed:()=>{if(this.current(generation,account))this.render();},
    });
    if(!this.current(generation,account))return;
    if(result.status==="success"){
      const model=masteryModel(session.data,session.profile,heroId,cardId);
      this.notice=[`Đã mở ${card.name}. Còn ${model.hero?.pending??0} lượt mở.`,...achievementNotices(result.reply.achievements)].join(" ");this.error="";
      const notice=this.notice;this.time.delayedCall(4000,()=>{if(this.current(generation,account)&&this.notice===notice){this.notice="";this.render();}});
    }else if(result.status==="error"){this.networkLost=result.error instanceof ApiError&&result.error.status===0;this.error=errorText(result.error);}
    else if(result.status==="unavailable")this.error="Lá chưa thể mở. Hãy cập nhật tiến độ và chọn lại.";
    this.render();
  }
}
