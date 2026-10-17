import { expect, it } from "vitest";
import { FakeRuntime, runToEnd, stubObject } from "./helpers/fake-runtime";
import { reactToImpact, impactResponse, finishImpactReaction } from "../src/ui/impact-reaction";
import type Phaser from "phaser";

const from = { x: 0, y: 0 }, to = { x: 100, y: 100 };
const view = () => stubObject({x:100,y:100,alpha:1,active:true}) as unknown as Phaser.GameObjects.Container;

it("a full guard stays firm while stronger damage recoils more, with a bounded distance", () => {
  expect(impactResponse(0).distance).toBe(0);
  expect(impactResponse(15).distance).toBeGreaterThan(impactResponse(2).distance);
  expect(impactResponse(1000).distance).toBeLessThanOrEqual(10);
});

it("reacts away from the source then restores the whole framed unit", async () => {
  const rt = new FakeRuntime(), unit = view();
  const result = reactToImpact(rt, unit, from, to, 12);
  const config = rt.tweenConfigs[0]!;
  const pose = config.targets as { progress: number };
  pose.progress=1; (config.onUpdate as () => void)();
  expect(unit.x).toBeGreaterThan(100); expect(unit.y).toBeGreaterThan(100);
  expect(unit.x-100).toBeLessThanOrEqual(10);
  await runToEnd(rt,result);
  expect([unit.x,unit.y,unit.alpha]).toEqual([100,100,1]);
});

it.each([0,12])("reduced motion stays stationary for damage %s and recovers alpha", async damage => {
  const rt=new FakeRuntime({reducedMotion:true}),unit=view();
  const result=reactToImpact(rt,unit,from,to,damage),config=rt.tweenConfigs[0]!;
  (config.targets as {progress:number}).progress=1;(config.onUpdate as () => void)();
  expect([unit.x,unit.y]).toEqual([100,100]);
  await runToEnd(rt,result);expect(unit.alpha).toBe(1);
});

it("overlapping hits cannot let an older tween overwrite or drift the newer response", async () => {
  const rt = new FakeRuntime(),unit=view();
  const first=reactToImpact(rt,unit,from,to,5),old=rt.tweenConfigs[0]!;
  (old.targets as {progress:number}).progress=1;(old.onUpdate as () => void)();
  const second=reactToImpact(rt,unit,{x:200,y:200},to,9),latest=rt.tweenConfigs[1]!;
  (latest.targets as {progress:number}).progress=1;(latest.onUpdate as () => void)();
  const newest=[unit.x,unit.y];(old.onUpdate as () => void)();
  expect([unit.x,unit.y]).toEqual(newest);
  await runToEnd(rt,Promise.all([first,second]));
  expect([unit.x,unit.y,unit.alpha]).toEqual([100,100,1]);
});

it("abort restores a live view and never touches a destroyed one", async () => {
  for(const active of [true,false]){
    const rt=new FakeRuntime(),unit=view(),result=reactToImpact(rt,unit,from,to,9);
    const config=rt.tweenConfigs[0]!;(config.targets as {progress:number}).progress=1;(config.onUpdate as () => void)();
    unit.active=active;const pose=[unit.x,unit.y];rt.dispose();
    await expect(result).rejects.toThrow();
    expect([unit.x,unit.y]).toEqual(active?[100,100]:pose);
  }
});

it("hands the pose to a death or lunge without late restoration overwriting it", async () => {
  const rt=new FakeRuntime(),unit=view(),result=reactToImpact(rt,unit,from,to,12);
  const config=rt.tweenConfigs[0]!;(config.targets as {progress:number}).progress=1;(config.onUpdate as () => void)();
  finishImpactReaction(unit);
  expect([unit.x,unit.y,unit.alpha]).toEqual([100,100,1]);
  unit.y=86;unit.alpha=.55; // another animation now owns the pose
  (config.onUpdate as () => void)();await runToEnd(rt,result);
  expect([unit.y,unit.alpha]).toEqual([86,.55]);
});
