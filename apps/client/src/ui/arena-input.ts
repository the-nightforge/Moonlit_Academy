import type Phaser from "phaser";
import { visibleWorld } from "./theme";

/** Native fields retain value/focus through canvas redraws and follow the camera. */
export function arenaInput(scene: Phaser.Scene, id: string, label: string, bounds: { x: number; y: number; w: number; h: number }, changed: (value: string) => void, key: (event: KeyboardEvent) => void, room = false) {
  const input = document.createElement("input");
  input.id = id; input.type = room ? "text" : "search";
  input.placeholder = label; input.setAttribute("aria-label", label);
  if (room) { input.maxLength = 6; input.autocomplete = "off"; input.spellcheck = false; }
  input.style.cssText = "position:fixed;box-sizing:border-box;padding:0 12px;background:#111f34;color:#e8e0c8;border:1px solid #65748e;border-radius:8px;font-family:Segoe UI,sans-serif;z-index:9";
  const place = () => {
    const canvas = scene.game.canvas.getBoundingClientRect(), view = visibleWorld(scene);
    const sx = canvas.width / view.w, sy = canvas.height / view.h;
    Object.assign(input.style, { left: `${canvas.left + (bounds.x - view.x) * sx}px`, top: `${canvas.top + (bounds.y - view.y) * sy}px`, width: `${bounds.w * sx}px`, height: `${bounds.h * sy}px`, fontSize: `${14 * sx}px` });
  };
  input.addEventListener("input", () => {
    if (room) input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    changed(input.value);
  });
  input.addEventListener("keydown", event => { event.stopPropagation(); key(event); });
  document.body.appendChild(input); place(); input.focus();
  scene.scale.on("resize", place);
  const destroy = () => { input.remove(); scene.scale.off("resize", place); scene.events.off("shutdown", destroy); };
  scene.events.once("shutdown", destroy);
  return { input, destroy };
}
