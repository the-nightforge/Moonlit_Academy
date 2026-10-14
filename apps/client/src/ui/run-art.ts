import assets from "virtual:assets-manifest";
import type { GameData } from "rules";
import { cardArtCandidates } from "./combat-card-view";
export const runEscape = (text: string) => text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);
export function runImage(category: string, id: string, alt = "", className = "") {
  const source = assets[category]?.[id];
  return source ? `<img class="${className}" src="${runEscape(source)}" alt="${runEscape(alt)}">` : "";
}
export const runIcon = (id: string, alt = "") => runImage("ui",id,alt,"rn-icon");
export function runPortrait(data: GameData, id: string) {
  const actor=data.heroes[id]??data.enemies[id]; if(!actor)return "";
  const parts=actor.art.portrait.split(":");
  return runImage(parts.length===2?parts[0]!:data.heroes[id]?"heroes":"enemies",parts.length===2?parts[1]!:id,actor.name);
}
export function runCardImage(data:GameData,id:string) {
  const candidate=cardArtCandidates(data,data.cards[id],id).find(key=>{const [category,stem]=key.split(":");return assets[category!]?.[stem!]});
  const [category,stem]=(candidate??"cards:art_skill").split(":");return runImage(category!,stem!,data.cards[id]?.name??"Lá bài");
}
