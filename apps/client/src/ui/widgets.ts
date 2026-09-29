import Phaser from "phaser";
import { COLORS, CURRENCY_LABELS, DESIGN_HEIGHT, DESIGN_WIDTH, TEXT_BASE } from "./theme";

export function addText(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  content: string,
  size = 14,
  color: string = COLORS.text,
): Phaser.GameObjects.Text {
  const text = scene.add.text(x, y, content, { ...TEXT_BASE, fontSize: `${size}px`, color });
  parent.add(text);
  return text;
}

/** Main action (one per screen), ordinary action, or one that loses something. */
export type ButtonVariant = "primary" | "secondary" | "danger";

export interface ButtonOptions {
  variant?: ButtonVariant;
  /** Shown on hover while the button is disabled: why, and what unlocks it. */
  disabledReason?: string;
}

const BUTTON_STYLES: Record<ButtonVariant, { fill: number; hover: number; stroke: number; text: string }> = {
  primary: { fill: 0xb8912c, hover: 0xd4ab3f, stroke: COLORS.goldFill, text: "#141024" },
  secondary: { fill: COLORS.button, hover: 0x3a5090, stroke: COLORS.goldFill, text: COLORS.text },
  danger: { fill: 0x40202a, hover: 0x5a2a36, stroke: 0x884455, text: "#ff9090" },
};

export function addButton(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  width: number,
  label: string,
  onClick: () => void,
  enabled = true,
  options: ButtonOptions = {},
): void {
  const style = BUTTON_STYLES[options.variant ?? "secondary"];
  const button = scene.add.rectangle(x, y, width, 34, enabled ? style.fill : 0x222633);
  button.setStrokeStyle(1, enabled ? style.stroke : COLORS.panelBorder);
  if (enabled) {
    button.setInteractive({ useHandCursor: true });
    button.on("pointerover", () => button.setFillStyle(style.hover));
    button.on("pointerout", () => button.setFillStyle(style.fill));
    button.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 0) onClick();
    });
  } else if (options.disabledReason) {
    const reason = options.disabledReason;
    let tip: Phaser.GameObjects.Container | null = null;
    const hide = () => {
      tip?.destroy();
      tip = null;
    };
    button.setInteractive();
    button.on("pointerover", () => {
      hide();
      tip = hoverNote(scene, x, y - 30, reason);
    });
    button.on("pointerout", hide);
    // A re-render destroys the button under the pointer: take the note with it.
    button.once(Phaser.GameObjects.Events.DESTROY, hide);
  }
  parent.add(button);
  addText(scene, parent, x, y, label, 13, enabled ? style.text : COLORS.dimText).setOrigin(0.5);
}

/** A one-line note in a dark box, centered at (x, y), kept on screen. */
function hoverNote(scene: Phaser.Scene, x: number, y: number, message: string): Phaser.GameObjects.Container {
  const text = scene.add
    .text(0, 0, message, { ...TEXT_BASE, fontSize: "12px", color: COLORS.text, wordWrap: { width: 360 }, align: "center" })
    .setOrigin(0.5);
  const width = text.width + 20;
  const height = text.height + 12;
  const box = scene.add.rectangle(0, 0, width, height, 0x0a0e20, 0.96).setStrokeStyle(1, COLORS.panelBorder);
  const left = Phaser.Math.Clamp(x, width / 2 + 8, DESIGN_WIDTH - width / 2 - 8);
  const top = Phaser.Math.Clamp(y, height / 2 + 8, DESIGN_HEIGHT - height / 2 - 8);
  return scene.add.container(left, top, [box, text]).setDepth(1500);
}

/**
 * One tab of a tab row: the open tab is lit with a gold underline and takes no
 * clicks; the others read as plain buttons. Same look on every screen.
 */
export function addTab(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  width: number,
  label: string,
  active: boolean,
  onClick: () => void,
): void {
  const tab = scene.add.rectangle(x, y, width, 34, active ? 0x3a5090 : 0x1a2446);
  tab.setStrokeStyle(1, active ? COLORS.goldFill : COLORS.panelBorder);
  parent.add(tab);
  if (active) {
    parent.add(scene.add.rectangle(x, y + 15, width - 2, 3, COLORS.goldFill));
  } else {
    tab.setInteractive({ useHandCursor: true });
    tab.on("pointerover", () => tab.setFillStyle(COLORS.button));
    tab.on("pointerout", () => tab.setFillStyle(0x1a2446));
    tab.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 0) onClick();
    });
  }
  addText(scene, parent, x, y, label, 13, active ? COLORS.gold : COLORS.text).setOrigin(0.5);
}

/** A horizontal tab row centered on `centerX`. */
export function addTabs(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  centerX: number,
  y: number,
  width: number,
  tabs: { label: string; active: boolean; onClick: () => void }[],
): void {
  const step = width + 16;
  const startX = centerX - ((tabs.length - 1) * step) / 2;
  tabs.forEach((tab, index) => addTab(scene, parent, startX + index * step, y, width, tab.label, tab.active, tab.onClick));
}

type Currencies = { moonJade: number; moonStar: number; honor?: number };

const escBack = new WeakMap<Phaser.Scene, { onBack: () => void }>();

/**
 * Every menu screen's top strip: "◂ back" top-left (Esc does the same), title
 * centered, currencies top-right with an optional second line under them.
 */
export function addScreenHeader(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  options: {
    title: string;
    back: { label?: string; onBack: () => void };
    currencies?: Currencies;
    extra?: string;
  },
): void {
  addButton(scene, parent, 90, 30, 140, `◂ ${options.back.label ?? "Quay lại"}`, options.back.onBack);
  addText(scene, parent, DESIGN_WIDTH / 2, 30, options.title, 26, COLORS.gold).setOrigin(0.5);
  if (options.currencies) addCurrencyText(scene, parent, DESIGN_WIDTH - 40, 30, options.currencies).setOrigin(1, 0.5);
  if (options.extra) addText(scene, parent, DESIGN_WIDTH - 40, 52, options.extra, 12, COLORS.dimText).setOrigin(1, 0.5);
  // One Esc listener per scene run; re-renders only swap the handler.
  const bound = escBack.get(scene);
  if (bound) {
    bound.onBack = options.back.onBack;
    return;
  }
  const state = { onBack: options.back.onBack };
  escBack.set(scene, state);
  const onEsc = () => {
    if (!isModalOpen()) state.onBack();
  };
  scene.input.keyboard?.on("keydown-ESC", onEsc);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.input.keyboard?.off("keydown-ESC", onEsc);
    escBack.delete(scene);
  });
}

function addCurrencyText(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  currencies: Currencies,
): Phaser.GameObjects.Text {
  const honor = currencies.honor === undefined ? "" : `   ❖ ${CURRENCY_LABELS.honor} ${currencies.honor}`;
  return addText(
    scene, parent, x, y,
    `◆ ${CURRENCY_LABELS.moonJade} ${currencies.moonJade}   ✦ ${CURRENCY_LABELS.moonStar} ${currencies.moonStar}${honor}`,
    14, COLORS.gold,
  );
}

/** "Nguyệt Ngọc N · Nguyệt Tinh M · Vinh Dự K" from the local profile copy. */
export function addCurrencyBar(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  currencies: Currencies,
): Phaser.GameObjects.Text {
  return addCurrencyText(scene, parent, x, y, currencies).setOrigin(0, 0.5);
}

/**
 * Scrolls a list by whole rows: the scene renders only rows `range()` returns,
 * so a list longer than the screen never spills over other controls. Wheel
 * over `area` and the ▲▼ bars step one row. Create once in `create()`; the
 * wheel listener is dropped with the scene.
 */
export class RowScroller {
  first = 0;
  private total = 0;
  private visible = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly area: { x: number; y: number; width: number; height: number },
    private readonly onScroll: () => void,
  ) {
    const bounds = new Phaser.Geom.Rectangle(area.x, area.y, area.width, area.height);
    const onWheel = (pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
      const point = scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
      if (dy !== 0 && bounds.contains(point.x, point.y)) this.scrollBy(Math.sign(dy));
    };
    scene.input.on("wheel", onWheel);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.input.off("wheel", onWheel));
  }

  /** Clamps the scroll for `total` rows, `visible` at a time; returns [start, end). */
  range(total: number, visible: number): [number, number] {
    this.total = total;
    this.visible = visible;
    this.first = Phaser.Math.Clamp(this.first, 0, Math.max(0, total - visible));
    return [this.first, Math.min(total, this.first + visible)];
  }

  scrollBy(rows: number): void {
    const next = Phaser.Math.Clamp(this.first + rows, 0, Math.max(0, this.total - this.visible));
    if (next === this.first) return;
    this.first = next;
    this.onScroll();
  }

  /** ▲ bar just above / ▼ bar just below the area while rows are hidden that way. */
  addArrows(parent: Phaser.GameObjects.Container): void {
    const { x, y, width, height } = this.area;
    const bar = (barY: number, label: string, rows: number) => {
      const rect = this.scene.add.rectangle(x + width / 2, barY, width, 20, COLORS.button, 0.8);
      rect.setStrokeStyle(1, COLORS.panelBorder);
      rect.setInteractive({ useHandCursor: true });
      rect.on("pointerover", () => rect.setFillStyle(0x3a5090, 1));
      rect.on("pointerout", () => rect.setFillStyle(COLORS.button, 0.8));
      rect.on("pointerup", (pointer: Phaser.Input.Pointer) => {
        if (pointer.button === 0) this.scrollBy(rows);
      });
      parent.add(rect);
      addText(this.scene, parent, x + width / 2, barY, label, 11, COLORS.text).setOrigin(0.5);
    };
    if (this.first > 0) bar(y - 12, "▲", -1);
    if (this.first + this.visible < this.total) bar(y + height + 12, "▼", 1);
  }
}

/** A message that fades out by itself (gifts, achievements). */
export function showToast(scene: Phaser.Scene, lines: string[], y = 110): void {
  if (lines.length === 0) return;
  const text = scene.add
    .text(640, y, lines.join("\n"), { ...TEXT_BASE, fontSize: "15px", color: COLORS.gold, align: "center", lineSpacing: 4 })
    .setOrigin(0.5)
    .setDepth(1001);
  const box = scene.add
    .rectangle(640, y, text.width + 40, text.height + 20, 0x101830, 0.95)
    .setStrokeStyle(1, COLORS.goldFill)
    .setDepth(1000);
  scene.tweens.add({ targets: [text, box], alpha: 0, delay: 2800, duration: 600, onComplete: () => {
    text.destroy();
    box.destroy();
  } });
}

export interface ModalAction {
  label: string;
  variant?: ButtonVariant;
}

export interface ModalOptions {
  title?: string;
  message: string;
  /** Left to right; the last one is the default (Enter). */
  actions: ModalAction[];
  /** A text field (HTML, laid over the canvas like the sign-in form). */
  input?: { value?: string; maxLength: number; placeholder?: string };
}

/** `action` is the index into `actions`, or -1 when dismissed (Esc). */
export interface ModalResult {
  action: number;
  value: string;
}

const MODAL_W = 520;
let activeModal: { cancel: () => void } | null = null;

/** Menus' Esc-to-go-back and the combat hotkeys stand down while a modal is open. */
export function isModalOpen(): boolean {
  return activeModal !== null;
}

/**
 * In-game dialog replacing `window.alert/confirm/prompt`: drawn in the game's
 * own style, blocks the screen under it, Enter picks the last action, Esc
 * dismisses. Lives outside scene roots, so a re-render underneath keeps it.
 */
export function showModal(scene: Phaser.Scene, options: ModalOptions): Promise<ModalResult> {
  activeModal?.cancel();
  return new Promise((resolve) => {
    const cx = DESIGN_WIDTH / 2;
    const layer = scene.add.container(0, 0).setDepth(2000);
    layer.add(scene.add.rectangle(cx, DESIGN_HEIGHT / 2, DESIGN_WIDTH, DESIGN_HEIGHT, 0x000000, 0.6).setInteractive());
    const message = scene.add
      .text(cx, 0, options.message, { ...TEXT_BASE, fontSize: "15px", color: COLORS.text, align: "center", wordWrap: { width: MODAL_W - 60 }, lineSpacing: 4 })
      .setOrigin(0.5, 0);
    const titleH = options.title ? 34 : 0;
    const inputH = options.input ? 52 : 0;
    const height = 24 + titleH + message.height + 20 + inputH + 34 + 24;
    const top = DESIGN_HEIGHT / 2 - height / 2;
    layer.add(scene.add.rectangle(cx, DESIGN_HEIGHT / 2, MODAL_W, height, 0x101830).setStrokeStyle(1, COLORS.goldFill));
    if (options.title) addText(scene, layer, cx, top + 24 + 12, options.title, 20, COLORS.gold).setOrigin(0.5);
    message.setY(top + 24 + titleH);
    layer.add(message);
    const inputY = top + 24 + titleH + message.height + 20 + 17;

    let input: HTMLInputElement | null = null;
    let done = false;
    const last = options.actions.length - 1;
    const finish = (action: number) => {
      if (done) return;
      done = true;
      const value = input?.value ?? "";
      input?.remove();
      scene.scale.off(Phaser.Scale.Events.RESIZE, place);
      scene.input.keyboard?.off("keydown-ENTER", onEnter);
      scene.input.keyboard?.off("keydown-ESC", onEsc);
      scene.events.off(Phaser.Scenes.Events.SHUTDOWN, onShutdown);
      layer.destroy();
      if (activeModal === handle) activeModal = null;
      resolve({ action, value });
    };
    const onEnter = () => finish(last);
    const onEsc = () => finish(-1);
    const onShutdown = () => finish(-1);
    const handle = { cancel: () => finish(-1) };
    activeModal = handle;

    // Canvas pixels → page pixels, so the HTML field sits on its design spot.
    const place = () => {
      if (!input) return;
      const rect = scene.game.canvas.getBoundingClientRect();
      const scale = rect.width / DESIGN_WIDTH;
      const w = MODAL_W - 60;
      input.style.left = `${rect.left + (cx - w / 2) * scale}px`;
      input.style.top = `${rect.top + (inputY - 17) * scale}px`;
      input.style.width = `${w * scale}px`;
      input.style.height = `${34 * scale}px`;
      input.style.fontSize = `${15 * scale}px`;
    };
    if (options.input) {
      input = document.createElement("input");
      input.id = "vn-modal-input";
      input.maxLength = options.input.maxLength;
      input.value = options.input.value ?? "";
      input.placeholder = options.input.placeholder ?? "";
      input.style.cssText =
        "position:fixed;box-sizing:border-box;padding:0 8px;background:#0b1026;color:#e8ecf8;border:1px solid #4a5a8a;font-family:sans-serif;z-index:10";
      // Keys typed here are text, not game hotkeys (E, `, Esc to go back).
      input.addEventListener("keydown", (event) => {
        event.stopPropagation();
        if (event.key === "Enter") finish(last);
        if (event.key === "Escape") finish(-1);
      });
      document.body.appendChild(input);
      place();
      scene.scale.on(Phaser.Scale.Events.RESIZE, place);
      input.focus();
      input.select();
    }

    const buttonY = top + height - 24 - 17;
    const step = 200;
    const startX = cx - (last * step) / 2;
    options.actions.forEach((action, index) => {
      addButton(scene, layer, startX + index * step, buttonY, 180, action.label, () => finish(index), true, { variant: action.variant });
    });
    scene.input.keyboard?.on("keydown-ENTER", onEnter);
    scene.input.keyboard?.on("keydown-ESC", onEsc);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, onShutdown);
  });
}

/** Hủy / confirm; resolves true on confirm. */
export async function confirmModal(
  scene: Phaser.Scene,
  message: string,
  confirm: { label?: string; danger?: boolean; title?: string } = {},
): Promise<boolean> {
  const result = await showModal(scene, {
    title: confirm.title,
    message,
    actions: [{ label: "Hủy" }, { label: confirm.label ?? "Đồng ý", variant: confirm.danger ? "danger" : "primary" }],
  });
  return result.action === 1;
}

/** A message with one "Đóng" button (server errors, notices). */
export async function alertModal(scene: Phaser.Scene, message: string, title?: string): Promise<void> {
  await showModal(scene, { title, message, actions: [{ label: "Đóng", variant: "primary" }] });
}

/** A one-line text field; resolves the text, or null when cancelled. */
export async function promptModal(
  scene: Phaser.Scene,
  message: string,
  input: { value?: string; maxLength: number; placeholder?: string; confirmLabel?: string },
): Promise<string | null> {
  const result = await showModal(scene, {
    message,
    input,
    actions: [{ label: "Hủy" }, { label: input.confirmLabel ?? "Đồng ý", variant: "primary" }],
  });
  return result.action === 1 ? result.value : null;
}
