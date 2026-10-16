import type Phaser from "phaser";

/** Native controls over canvas chrome, with one explicit modal focus order. */
export class DialogControls {
  private suspended = false;
  private entries: { element: HTMLElement; object?: { getBounds(): Phaser.Geom.Rectangle } }[] = [];
  private previous = typeof document === "undefined" ? null : document.activeElement as HTMLElement | null;
  constructor(private scene: Phaser.Scene, private close: () => void) { document.addEventListener("keydown", this.onKey, true); }
  field(element: HTMLElement) { this.entries.push({ element }); }
  button(object: { getBounds(): Phaser.Geom.Rectangle }, name: string, activate: () => void) {
    const element = document.createElement("button");
    element.type = "button"; element.setAttribute("aria-label", name); element.textContent = name;
    element.style.cssText = "position:fixed;z-index:20;background:transparent;color:transparent;border:1px solid transparent;border-radius:8px;padding:0;cursor:pointer;font-size:1px;outline-offset:2px";
    element.addEventListener("click", activate);
    element.addEventListener("focus", () => element.style.outline = "2px solid #d3e8ff");
    element.addEventListener("blur", () => element.style.outline = "none");
    document.body.append(element); this.entries.push({ element, object }); this.sync();
    return element;
  }
  suspend(value: boolean) { this.suspended = value; for (const entry of this.entries) entry.element.style.visibility = value ? "hidden" : "visible"; }
  focus(index = 0) { this.entries[index]?.element.focus({ preventScroll: true }); }
  sync = () => {
    const canvas = this.scene.game.canvas.getBoundingClientRect(), cam = this.scene.cameras.main;
    const sx = canvas.width / this.scene.game.scale.width, sy = canvas.height / this.scene.game.scale.height;
    for (const { element, object } of this.entries) {
      if (!object) continue;
      const b = object.getBounds();
      Object.assign(element.style, { left: `${canvas.left + (cam.x + (b.left - cam.worldView.x) * cam.zoom) * sx}px`, top: `${canvas.top + (cam.y + (b.top - cam.worldView.y) * cam.zoom) * sy}px`, width: `${b.width * cam.zoom * sx}px`, height: `${b.height * cam.zoom * sy}px` });
    }
  };
  private onKey = (event: KeyboardEvent) => {
    if (this.suspended) return;
    if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); this.close(); return; }
    const index = this.entries.findIndex(entry => entry.element === document.activeElement);
    const input = document.activeElement?.tagName === "INPUT";
    if (event.key === "Tab" || (!input && event.key.startsWith("Arrow"))) {
      event.preventDefault(); event.stopImmediatePropagation();
      const backwards = event.shiftKey || event.key === "ArrowLeft" || event.key === "ArrowUp";
      this.focus((index + (backwards ? -1 : 1) + this.entries.length) % this.entries.length);
    } else if (event.key === "Enter" && input) {
      // Input submission moves to the safe first action; it never confirms a destructive default.
      event.preventDefault(); event.stopImmediatePropagation(); this.focus(this.entries.findIndex(entry => entry.element.tagName === "BUTTON"));
    } else if (event.key === "Enter" && index < 0) {
      event.preventDefault(); event.stopImmediatePropagation(); this.focus();
    }
  };
  destroy() { document.removeEventListener("keydown", this.onKey, true); for (const entry of this.entries) if (entry.object) entry.element.remove(); this.entries = []; this.previous?.focus({ preventScroll: true }); }
}
