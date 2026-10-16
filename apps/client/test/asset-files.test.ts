import { expect, it } from "vitest";
import { preferredAssetFiles } from "../asset-files";
it("selects WebP independently of directory order while retaining SVG-only icons",()=>{
 const files=["w.png","w.webp","w.svg","icon.svg","README.md",".hidden.png"];
 const expected={w:"w.webp",icon:"icon.svg"};
 expect(preferredAssetFiles(files)).toEqual(expected);
 expect(preferredAssetFiles([...files].reverse())).toEqual(expected);
});
