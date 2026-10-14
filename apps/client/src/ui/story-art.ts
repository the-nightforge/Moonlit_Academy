import assets from "virtual:assets-manifest";
import type { GameData } from "rules";

export const storyEscape = (text: string) => text.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export function storyImage(category: string, id: string, alt = "", className = "") {
  const source = assets[category]?.[id];
  return source ? `<img class="${className}" src="${storyEscape(source)}" alt="${storyEscape(alt)}">` : "";
}
export const storyIcon = (id: string, alt = "") => storyImage("ui", id, alt, "st-icon");
export function storyPortrait(data: GameData, id: string, className = "") {
  const actor = data.heroes[id] ?? data.enemies[id];
  if (!actor) return "";
  const category = data.heroes[id] ? "heroes" : "enemies";
  const parts = actor.art.portrait.split(":");
  return storyImage(parts.length === 2 ? parts[0]! : category, parts.length === 2 ? parts[1]! : id, actor.name, className);
}
