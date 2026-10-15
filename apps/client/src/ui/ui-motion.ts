import type Phaser from "phaser";
import { COMBAT_SETTINGS_CHANGED, loadCombatSettings } from "./combat-settings";

function reducedMotion(): boolean {
  const preferred = typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
  try { return loadCombatSettings(window.localStorage, preferred).reducedMotion; }
  catch { return preferred; }
}

/** Resolve DOM and canvas motion from the same saved preference, with the OS as fallback. */
export function installUiMotion(): () => void {
  const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const refresh = () => { document.documentElement.dataset.vnReducedMotion = String(reducedMotion()); };
  refresh();
  window.addEventListener(COMBAT_SETTINGS_CHANGED, refresh);
  window.addEventListener("storage", refresh);
  media?.addEventListener("change", refresh);
  return () => {
    window.removeEventListener(COMBAT_SETTINGS_CHANGED, refresh);
    window.removeEventListener("storage", refresh);
    media?.removeEventListener("change", refresh);
  };
}

/** Opacity only: layout, hit areas, artwork aspect ratios and borders never change. */
export function enterUi(scene: Phaser.Scene, target: Phaser.GameObjects.Container): void {
  if (reducedMotion() || !scene.tweens) return;
  target.setAlpha(0.6);
  const tween = scene.tweens.add({ targets: target, alpha: 1, duration: 160, ease: "Sine.easeOut" });
  target.once("destroy", () => tween.remove());
}

/** A small press/release response on existing canvas buttons; no new hit target. */
export function buttonMotion(scene: Phaser.Scene, button: Phaser.GameObjects.Rectangle): void {
  let release: Phaser.Tweens.Tween | undefined;
  const restore = () => {
    release?.remove();
    if (reducedMotion() || !scene.tweens) { button.setAlpha(1); return; }
    release = scene.tweens.add({ targets: button, alpha: 1, duration: 120, ease: "Sine.easeOut" });
  };
  button.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
    if (pointer.button !== 0) return;
    release?.remove();
    button.setAlpha(reducedMotion() ? 1 : 0.82);
  });
  button.on("pointerup", restore);
  button.on("pointerout", restore);
  button.once("destroy", () => release?.remove());
}
