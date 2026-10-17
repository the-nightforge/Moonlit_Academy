import type { AwakeningProfile } from "./awakening-profiles";

const clamp = (v: number) => Math.max(0, Math.min(1, v));
/** Zero slope and acceleration at the ends of opacity transitions. */
function fade(v: number): number {
  const t=clamp(v);
  return clamp(t*t*t*(t*(t*6-15)+10));
}

/** Monotone cubic Hermite: shared tangents preserve velocity at authored beats. */
function curve(times: number[], values: number[], time: number): number {
  const tangent = (i: number) => {
    if(i===0 || i===times.length-1) return 0;
    const h0=times[i]!-times[i-1]!,h1=times[i+1]!-times[i]!;
    const a=(values[i]!-values[i-1]!)/h0,b=(values[i+1]!-values[i]!)/h1;
    if(a*b<=0) return 0; // A real directional reversal slows naturally.
    const w0=2*h1+h0,w1=h1+2*h0;
    return (w0+w1)/(w0/a+w1/b);
  };
  let i=0;
  while(i<times.length-2 && time>times[i+1]!) i++;
  const h=times[i+1]!-times[i]!,t=clamp((time-times[i]!)/h),t2=t*t,t3=t2*t;
  return (2*t3-3*t2+1)*values[i]!+(t3-2*t2+t)*h*tangent(i)
    +(-2*t3+3*t2)*values[i+1]!+(t3-t2)*h*tangent(i+1);
}

/** A continuous illustration path; pose offsets are in the authored 160 × 240 space. */
export function sampleAwakening(profile: AwakeningProfile, elapsed: number, reducedMotion=false) {
  const m=profile.motion,charge=reducedMotion?60:m.charge,blend=reducedMotion?100:m.blend;
  const total=reducedMotion?180:m.charge+m.blend+m.release;
  const time=Math.max(0,Math.min(total,elapsed));
  const oldAlpha=1-fade((time-charge)/blend);
  if(reducedMotion) return {x:0,y:0,angle:0,scale:1,
    alpha:.16*fade(time/60)*(1-fade((time-160)/20)),oldAlpha};
  const times=[0,charge,charge+blend,total],poses=[m.from,{},m.peak,m.out];
  const value=(key:"x"|"y"|"angle"|"scale",base:number,damping:number) =>
    curve(times,poses.map(p=>base+((p[key]??base)-base)*damping),time);
  const tail=Math.min(charge+blend,total*.55);
  return {x:value("x",0,.65),y:value("y",0,.65),angle:value("angle",0,.45),scale:value("scale",1,.35),
    alpha:.82*fade(time/Math.max(charge,150))*(1-fade((time-tail)/(total-tail))),oldAlpha};
}
