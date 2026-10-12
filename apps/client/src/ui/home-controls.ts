import Phaser from "phaser";
import { COLORS, TEXT_BASE } from "./theme";
import { roundedPanel } from "./rounded-panel";
import { actionIcon, type ActionIcon } from "./action-icon";
import type { ButtonOptions } from "./widgets";

interface ControlOptions {
  enabled: boolean;
  activate: () => void;
  showTip?: () => void;
  hideTip?: () => void;
  fill?: number;
  border?: number;
  hoverFill?: number;
  radius?: number;
  icon?: Phaser.GameObjects.Image;
  /** A native field can share the canvas focus order. */
  onFocus?: () => void;
}
interface Target { hit: Phaser.GameObjects.GameObject; panel: Phaser.GameObjects.Container; focus: () => void; blur: () => void; activate: () => void }

/** Home pointer/keyboard feedback. Display objects retain their fixed hit areas. */
export class HomeControls {
  private targets: Target[] = [];
  private focused: Target | null = null;
  private layer: Phaser.GameObjects.Container | null = null;

  constructor(private scene: Phaser.Scene, private reducedMotion: boolean, private blocked: () => boolean) {
    scene.input.keyboard?.on("keydown", this.onKey, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.input.keyboard?.off("keydown", this.onKey, this);
      this.targets = [];
      this.focused = null;
    });
  }

  setLayer(layer: Phaser.GameObjects.Container) {
    if (this.layer === layer) return;
    this.focused?.blur();
    this.layer = layer;
    this.focused = null;
  }

  get focusedName(): string | null { return this.focused?.hit.name || null; }

  private liveTargets() {
    return this.targets.filter(target => {
      if (!target.hit.scene) return false;
      let parent: Phaser.GameObjects.Container | null = target.panel;
      while (parent && parent !== this.layer) parent = parent.parentContainer;
      return parent === this.layer;
    });
  }

  /** Restore logical focus after a scene replaces its display objects. */
  restoreFocus(name: string | null) {
    if (!name) return;
    const target = this.liveTargets().find(target => target.hit.name === name);
    if (!target) return;
    this.focused?.blur(); this.focused = target; target.focus();
  }

  /** Explicit Tab handoff from a native field to its adjacent canvas control. */
  stepFocus(name: string, backwards = false) {
    const targets = this.liveTargets(), index = targets.findIndex(target => target.hit.name === name);
    if (index < 0 || !targets.length) return;
    const target = targets[(index + (backwards ? -1 : 1) + targets.length) % targets.length]!;
    this.focused?.blur(); this.focused = target; target.focus();
  }

  /** Informational text shares the same keyboard order as actionable controls. */
  info(source: Phaser.GameObjects.Text, showTip: () => void, hideTip: () => void) {
    const background = source.style.backgroundColor;
    let hovered = false;
    let timer: number | undefined;
    const cancel = () => { if (timer !== undefined) { window.clearTimeout(timer); timer = undefined; } hideTip(); };
    const paint = (active: boolean) => source.setBackgroundColor(active ? "#243854" : background);
    const focus = () => { paint(true); cancel(); showTip(); };
    const blur = () => { paint(hovered); cancel(); };
    const target: Target = { hit: source, panel: source.parentContainer, focus, blur, activate: showTip };
    this.targets.push(target);
    source.setInteractive({ useHandCursor: true });
    source.on("pointerover", () => {
      hovered = true;
      paint(true);
      cancel();
      timer = window.setTimeout(() => { timer = undefined; if (hovered && source.scene) showTip(); }, 180);
    });
    source.on("pointerout", () => { hovered = false; paint(this.focused === target); cancel(); });
    source.on("pointerup", (pointer: Phaser.Input.Pointer) => { if (pointer.button === 0) { cancel(); showTip(); } });
    source.once(Phaser.GameObjects.Events.DESTROY, () => {
      if (timer !== undefined) window.clearTimeout(timer);
      if (this.focused === target) this.focused = null;
      this.targets = this.targets.filter((entry) => entry !== target);
    });
  }

  private onKey(event: KeyboardEvent) {
    const active = typeof document === "undefined" ? null : document.activeElement as HTMLElement | null;
    if (active && (active.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName))) return;
    if (this.blocked() || !["Tab", "ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) return;
    this.targets = this.targets.filter((target) => !!target.hit.scene);
    const targets = this.targets.filter((target) => {
      let parent: Phaser.GameObjects.Container | null = target.panel;
      while (parent && parent !== this.layer) parent = parent.parentContainer;
      return parent === this.layer;
    });
    if (!targets.length) return;
    event.preventDefault();
    if (event.key === "Enter" || event.key === " ") { this.focused?.activate(); return; }
    const backwards = event.shiftKey || event.key === "ArrowLeft" || event.key === "ArrowUp";
    const index = targets.indexOf(this.focused!);
    this.focused?.blur();
    const next = index < 0 ? backwards ? targets.length - 1 : 0 : (index + (backwards ? -1 : 1) + targets.length) % targets.length;
    this.focused = targets[next]!;
    this.focused.focus();
  }

  bind(hit: Phaser.GameObjects.Rectangle, panel: Phaser.GameObjects.Container, options: ControlOptions) {
    const { enabled, activate, showTip, hideTip, fill = 0x15243b, border = 0x726449, radius = 12, icon } = options;
    const chrome = panel.list[1] as Phaser.GameObjects.Graphics;
    let hovered = false;
    let tipTimer: number | undefined;
    const iconY = icon?.y ?? 0;
    const paint = (active: boolean) => {
      if (!chrome.scene) return;
      chrome.clear().fillStyle(active && enabled ? options.hoverFill ?? 0x243854 : fill, enabled ? 0.96 : 0.92)
        .fillRoundedRect(-panel.width / 2, -panel.height / 2, panel.width, panel.height, radius)
        .lineStyle(active ? 2 : 1, active ? 0xd3bb83 : border, 0.9)
        .strokeRoundedRect(-panel.width / 2, -panel.height / 2, panel.width, panel.height, radius);
      if (icon && !this.reducedMotion) {
        this.scene.tweens.killTweensOf(icon);
        this.scene.tweens.add({ targets: icon, y: iconY - (active && enabled ? 2 : 0), duration: 140, ease: "Sine.easeOut" });
      }
    };
    const cancelTip = () => { if (tipTimer !== undefined) { window.clearTimeout(tipTimer); tipTimer = undefined; } hideTip?.(); };
    const focus = () => { paint(true); cancelTip(); showTip?.(); options.onFocus?.(); };
    const blur = () => { paint(hovered); cancelTip(); };
    const run = () => { cancelTip(); if (enabled) activate(); else showTip?.(); };
    const target = { hit, panel, focus, blur, activate: run };
    this.targets.push(target);
    hit.setInteractive({ useHandCursor: enabled });
    hit.on("pointerover", () => {
      hovered = true;
      paint(true);
      cancelTip();
      if (showTip) tipTimer = window.setTimeout(() => { tipTimer = undefined; if (hovered && hit.scene) showTip(); }, 180);
    });
    hit.on("pointerout", () => { hovered = false; paint(this.focused === target); cancelTip(); });
    hit.on("pointerdown", () => {
      if (!enabled || !chrome.scene) return;
      chrome.setAlpha(0.78);
      if (!this.reducedMotion) this.scene.tweens.add({ targets: chrome, alpha: 1, duration: 90 });
      else chrome.setAlpha(1);
    });
    hit.on("pointerup", (pointer: Phaser.Input.Pointer) => { if (pointer.button === 0) run(); });
    hit.once(Phaser.GameObjects.Events.DESTROY, () => {
      if (tipTimer !== undefined) window.clearTimeout(tipTimer);
      if (icon) this.scene.tweens.killTweensOf(icon);
      this.scene.tweens.killTweensOf(chrome);
      if (this.focused === target) this.focused = null;
      this.targets = this.targets.filter((entry) => entry !== target);
    });
  }

  iconButton(parent: Phaser.GameObjects.Container, x: number, y: number, icon: ActionIcon, label: string, enabled = true, options: ButtonOptions = {}) {
    const control = this.button(parent, x, y, 44, "", enabled, options);
    const image = actionIcon(this.scene, icon);
    if (image) {
      image.setAlpha(enabled ? 1 : 0.45);
      if (!enabled) image.setTint(0x8b93b8);
      control.panel.add(image);
    }
    // Semantic labels survive redraws and let keyboard/tooling identify icon controls.
    control.panel.setData("actionLabel", label);
    control.hit.setData("actionLabel", label);
    return { ...control, icon: image ?? undefined };
  }

  button(parent: Phaser.GameObjects.Container, x: number, y: number, width: number, label: string, enabled = true, options: ButtonOptions = {}) {
    const danger = options.variant === "danger", primary = options.variant === "primary";
    const fill = danger ? 0x40202a : primary && options.strong && enabled ? 0xc8ad73 : primary ? 0x273c54 : 0x14243a;
    const border = danger ? 0x884455 : primary ? 0xc8ad73 : 0x65748e;
    const height = options.height ?? 40;
    const panel = roundedPanel(this.scene, x, y, width, height, fill, enabled ? 0.96 : 0.92, border, 9);
    const hit = this.scene.add.rectangle(0, 0, width, height, 0, 0);
    panel.add(hit);
    panel.add(this.scene.add.text(0, 0, label, { ...TEXT_BASE, fontSize: `${options.fontSize ?? 14}px`, color: enabled ? danger ? "#ffb0b0" : options.strong && primary ? "#111b2d" : COLORS.text : COLORS.dimText }).setOrigin(0.5));
    parent.add(panel);
    return { panel, hit, fill, border };
  }
}
