import { expect, test } from "@playwright/test";
import { openCombatScene } from "./helpers/online";

// Online setup + 15 renderer probes per test exceed the default 180 s budget.
test.describe.configure({ timeout: 300_000 });

// Runs the production renderer/runtime in Phaser; these are renderer probes,
// while the moon-choice, summon-revive and multi-hit tests exercise actual rules actions.
const kinds = ["slash","spear","darts","bow","herb","fan","ink","music","ribbon","fire","star","moon","talisman","blood","spell"] as const;
for (const settings of [{speed:1,reducedMotion:false},{speed:2,reducedMotion:false},{speed:1,reducedMotion:true}] as const) {
  test(`all attack styles and spell with runtime cleanup @ speed${settings.speed} reduced${settings.reducedMotion}`, async ({page})=>{
    await openCombatScene(page);
    for (const kind of kinds) {
      await page.evaluate(async ({kind,settings})=>{
        const {playAttack} = await import("/src/ui/vfx.ts");
        const {createAnimationRuntime} = await import("/src/ui/animation-runtime.ts");
        const scene = (window as any).__vn.game.scene.getScene("combat");
        const state = scene.state;
        const hero = state.heroes[0].id;
        const enemy = state.enemies[0].id;
        const view = scene.unitViews.get(hero);
        const probe = {done:false,error:null as string|null,impacts:0,before:{x:view.x,y:view.y},after:{x:0,y:0},fx:0};
        (window as any).__reviewFx = probe;
        const runtime = createAnimationRuntime(scene,new AbortController().signal,{...settings,volume:0});
        void playAttack({kind,color:0xffd27a},scene.unitAnchors.get(hero),scene.unitAnchors.get(enemy),{runtime,attackerView:view,blocked:false,onImpact:()=>probe.impacts++})
          .then(()=>runtime.drain())
          .catch((error:unknown)=>{probe.error=String(error);})
          .finally(()=>{runtime.dispose();probe.after={x:view.x,y:view.y};probe.fx=scene.children.list.filter((n:any)=>n.depth>=90 && n.depth<1600).length;probe.done=true;});
      },{kind,settings});
      await expect.poll(()=>page.evaluate(()=>(window as any).__reviewFx.impacts),{timeout:10000}).toBe(1);
      await page.screenshot({path:`../../.sdd-work/combat-review-fixes/screenshots/vfx-${kind}-${settings.speed}-${settings.reducedMotion}.png`});
      await expect.poll(()=>page.evaluate(()=>(window as any).__reviewFx.done),{timeout:10000}).toBe(true);
      const result = await page.evaluate(()=>(window as any).__reviewFx);
      expect(result.error,kind).toBeNull();
      expect(result.impacts,kind).toBe(1);
      expect(result.fx,kind).toBe(0);
      expect(result.after,kind).toEqual(result.before);
    }
  });
}
