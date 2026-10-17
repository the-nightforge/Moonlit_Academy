import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect,it } from "vitest";

const root=resolve(__dirname,"../../..");
const kinds=["slash","spear","darts","bow","herb","fan","ink","music","ribbon","fire","star","moon","talisman","blood","spell"];
const support=["hit","guard","heal","armor","armor_break","status_apply","status_remove","death","blood_moon","cast","moon_shift","reflect"];
it("ships distinct transparent authored motion for all attacks and support effects",()=>{
  const meta=JSON.parse(readFileSync(resolve(root,"docs/assets/combat-motion-generated.json"),"utf8"));
  const sheets=meta.assets.filter((a:any)=>a.kind!=="utility");
  expect(sheets.map((a:any)=>a.id).sort()).toEqual([...kinds.map(k=>`attack_${k}`),...support.map(k=>`effect_${k}`)].sort());
  expect(new Set(sheets.map((a:any)=>a.sha256)).size).toBe(27);
  for(const a of meta.assets){
    const bytes=readFileSync(resolve(root,a.path));
    expect(bytes.subarray(8,12).toString()).toBe("WEBP");
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(a.sha256);
    if(a.kind==="utility")continue;
    expect([a.width,a.height]).toEqual([1536,1024]);
    expect(a.frames).toHaveLength(8);
    expect(new Set(a.frames.map((f:any)=>f.sha256)).size).toBe(8);
    expect(a.frames.every((f:any)=>f.alphaRange[0]===0)).toBe(true);
  }
  expect(meta.assets.filter((a:any)=>a.kind==="utility").map((a:any)=>a.id).sort()).toEqual(["glow","star","vignette"]);
});
