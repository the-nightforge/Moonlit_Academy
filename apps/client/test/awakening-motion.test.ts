import { expect, it } from "vitest";
import { HERO_AWAKENINGS } from "../src/ui/awakening-profiles";
import { sampleAwakening } from "../src/ui/awakening-motion";

it("keeps position, scale, angle and opacity velocity continuous across both beat boundaries for every hero", () => {
  const epsilon=.01;
  for(const p of Object.values(HERO_AWAKENINGS)) {
    for(const boundary of [p.motion.charge,p.motion.charge+p.motion.blend]) {
      const a=sampleAwakening(p,boundary-epsilon),b=sampleAwakening(p,boundary),c=sampleAwakening(p,boundary+epsilon);
      for(const key of ["x","y","scale","angle","alpha","oldAlpha"] as const) {
        expect(Math.abs((b[key]-a[key])/epsilon-(c[key]-b[key])/epsilon)).toBeLessThan(.0001);
      }
    }
  }
});

it("bounds the expansion and spin, with soft transparent entry and exit", () => {
  for(const p of Object.values(HERO_AWAKENINGS)) {
    expect(sampleAwakening(p,0).alpha).toBe(0);
    expect(sampleAwakening(p,520).alpha).toBe(0);
    expect(sampleAwakening(p,p.motion.charge).oldAlpha).toBe(1);
    expect(sampleAwakening(p,p.motion.charge+p.motion.blend).oldAlpha).toBe(0);
    for(let time=0;time<=520;time+=2) {
      const pose=sampleAwakening(p,time);
      expect(pose.scale).toBeGreaterThanOrEqual(.90);
      expect(pose.scale).toBeLessThanOrEqual(1.07);
      expect(Math.abs(pose.angle)).toBeLessThanOrEqual(8.2);
      expect(pose.alpha).toBeGreaterThanOrEqual(0);
      expect(pose.alpha).toBeLessThanOrEqual(.82);
    }
  }
});

it("retains 25 distinct continuous paths rather than a common path recolored", () => {
  const paths=Object.values(HERO_AWAKENINGS).map(p=>JSON.stringify(Array.from({length:53},(_,i)=>sampleAwakening(p,i*10))));
  expect(new Set(paths).size).toBe(25);
});

it("reduced motion is a stationary 180-millisecond fade and still blends the portrait at its authored boundary", () => {
  const p=HERO_AWAKENINGS.m05!;
  for(let time=0;time<=180;time++) {
    const pose=sampleAwakening(p,time,true);
    expect([pose.x,pose.y,pose.angle,pose.scale]).toEqual([0,0,0,1]);
    expect(pose.alpha).toBeGreaterThanOrEqual(0); expect(pose.alpha).toBeLessThanOrEqual(.16);
  }
  expect(sampleAwakening(p,60,true).oldAlpha).toBe(1);
  expect(sampleAwakening(p,160,true).oldAlpha).toBe(0);
  expect(sampleAwakening(p,180,true).alpha).toBe(0);
});
