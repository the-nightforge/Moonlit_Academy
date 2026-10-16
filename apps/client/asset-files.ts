/** Stable format preference lets optimized WebP coexist with original source images. */
export function preferredAssetFiles(names: readonly string[]): Record<string,string> {
  const result:Record<string,string> = {};
  const rank:Record<string,number> = {svg:0,jpg:1,jpeg:1,png:2,webp:3};
  for (const file of names) {
    if(file.startsWith("."))continue;
    const match = /^(.*)\.(png|jpe?g|webp|svg)$/i.exec(file);
    if(!match)continue;
    const stem=match[1]!, old=result[stem], oldExtension=old?.split(".").at(-1)?.toLowerCase();
    if(!old || rank[match[2]!.toLowerCase()]! > (rank[oldExtension ?? ""] ?? -1))result[stem]=file;
  }
  return result;
}
