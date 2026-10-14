import Phaser from "phaser";
import { pendingUnlocks, type RunAction } from "rules";
import { achievementNotices, errorText } from "../account";
import { auth } from "../api";
import { applyRecordedRunAction, submitRun } from "../run-session";
import { session } from "../session";
import { RunView } from "../ui/run-view";
import { useDesignCamera } from "../ui/theme";

/** The responsive renderer dispatches through the existing recorded rules engine. */
export class RunScene extends Phaser.Scene {
  private view:RunView|null=null;
  private submitting=false;
  private submitError="";
  private notice="";
  private lastRelic:string|null|undefined;
  private generation=0;
  constructor(){super("run");}
  create(){
    useDesignCamera(this);this.generation++;this.submitting=false;this.submitError="";this.notice="";this.lastRelic=undefined;
    if(!session.run){this.scene.start("deck-select");return;}
    this.view=new RunView({dispatch:action=>this.dispatch(action),retry:()=>{if(session.ticket&&!this.submitting){this.submitError="";void this.finish();}},back:()=>this.leave(false),mastery:()=>this.leave(true)});
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{this.generation++;this.view?.destroy();this.view=null;});
    this.render();
    if(session.run.status==="won"||session.run.status==="lost")void this.finish();
  }
  private dispatch(action:RunAction){
    if(this.submitting||!session.run)return;
    const result=applyRecordedRunAction(action);
    if(!result.ok){this.notice=errorText(result.error);this.render();return;}
    session.run=result.run;session.events.push(...result.events);this.notice="";
    this.lastRelic=result.runEvents.flatMap(e=>e.type==="runRelicGained"?[e.runRelicId]:[])[0]??null;
    if(result.run.status==="combat"&&result.run.combat){session.state=result.run.combat;this.scene.start("combat");return;}
    this.render();if(result.run.status==="won"||result.run.status==="lost")void this.finish();
  }
  private async finish(){
    if(this.submitting||this.submitError||session.runSubmitted||!session.ticket)return;
    const generation=this.generation,account=auth.generation,run=session.run;
    const current=()=>this.generation===generation&&auth.generation===account&&session.run===run&&this.scene.isActive();
    this.submitting=true;this.render();
    try{await submitRun();if(!current())return;this.notice="Kết quả đã được ghi nhận.";}
    catch(error){if(!current())return;this.submitError=errorText(error);}
    finally{if(current()){this.submitting=false;this.render();}}
  }
  private leave(mastery:boolean){
    if(this.submitting||!session.run||!['won','lost'].includes(session.run.status))return;
    const heroId=session.heroIds.find(id=>pendingUnlocks(session.data,session.profile,id)>0);session.run=null;
    if(mastery&&heroId)this.scene.start("mastery",{heroId});else this.scene.start("deck-select");
  }
  private render(){
    if(!session.run)return;
    this.view?.render({data:session.data,run:session.run,visited:session.ticket?.actions.flatMap(a=>a.type==="chooseNode"?[a.nodeId]:[])??[],lastRelicId:this.lastRelic,
      submitting:this.submitting,submitted:session.runSubmitted,error:this.submitError,notice:this.notice,
      gains:session.lastGains??[],rewards:session.lastRewards,achievements:achievementNotices(session.lastRewards?.achievements??[]),canRetry:!!session.ticket,canUnlock:session.heroIds.some(id=>pendingUnlocks(session.data,session.profile,id)>0)});
  }
}
