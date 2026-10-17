import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { HERO_AWAKENINGS } from "../src/ui/awakening-profiles";

it("ships eight distinct transparent illustrated cells for every hero with verified provenance",()=>{
  const root=resolve(__dirname,"../../..");
  const meta=JSON.parse(readFileSync(resolve(root,"docs/assets/awakening-flipbooks-generated.json"),"utf8"));
  expect(meta.assets.map((a:any)=>a.heroId).sort()).toEqual(Object.keys(HERO_AWAKENINGS).sort());
  expect(new Set(meta.assets.map((a:any)=>a.sha256)).size).toBe(25);
  for(const asset of meta.assets) {
    const bytes=readFileSync(resolve(root,asset.path));
    expect(bytes.subarray(8,12).toString()).toBe("WEBP");
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(asset.sha256);
    expect(asset.frames).toHaveLength(8);
    expect(new Set(asset.frames.map((f:any)=>f.sha256)).size).toBe(8);
    expect(asset.frames.every((f:any)=>f.alphaRange[0]===0&&f.centerAlpha<32)).toBe(true);
  }
});
