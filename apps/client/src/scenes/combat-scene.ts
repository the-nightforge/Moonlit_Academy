import Phaser from "phaser";
import {
  applyAction,
  getEffectiveCost,
  getPlayCardError,
  getValidTargets,
  isCardPlayable,
  previewEnemyIntent,
} from "rules";
import type {
  Action,
  CombatEvent,
  CombatState,
  EnemyState,
  GameData,
  StatusInstance,
} from "rules";
import { cycleEncounter, restartSession, session } from "../session";
import {
  debugAddMoonPower,
  debugAdjustHeroHp,
  debugDrawCards,
  debugKillEnemy,
  debugSetMoon,
  describeEvent,
} from "../debug";
import { animateEvent } from "../ui/event-animator";
import {
  COLORS,
  FONT,
  INTENT_ICONS,
  OWNER_COLORS,
  PHASE_BG,
  STATUS_LABELS,
  describeModifier,
} from "../ui/theme";

const WIDTH = 1280;
const HEIGHT = 720;
const CARD_W = 110;
const CARD_H = 160;

const ERROR_LABELS: [RegExp, string][] = [
  [/not the player turn/, "Chưa tới lượt người chơi"],
  [/not in hand/, "Lá không còn trên tay"],
  [/broken/, "Tàn Chiêu — chủ lá đã ngã"],
  [/frozen/, "Chủ lá đang Đóng Băng"],
  [/moonPower/, "Không đủ Nguyệt Lực"],
  [/no target/, "Lá này không cần mục tiêu"],
  [/requires a target/, "Cần chọn mục tiêu"],
  [/invalid target/, "Mục tiêu không hợp lệ"],
];

function errorLabel(error: string): string {
  return ERROR_LABELS.find(([pattern]) => pattern.test(error))?.[1] ?? error;
}

export class CombatScene extends Phaser.Scene {
  private gameData!: GameData;
  private state!: CombatState;
  private root!: Phaser.GameObjects.Container;
  private targeting: string | null = null;
  private validTargetIds = new Set<string>();
  private cardViews = new Map<string, Phaser.GameObjects.Container>();
  private unitAnchors = new Map<string, { x: number; y: number }>();
  private unitViews = new Map<string, Phaser.GameObjects.Container>();
  private errorText?: Phaser.GameObjects.Text;
  private inputLocked = false;
  private debugVisible = false;

  constructor() {
    super("combat");
  }

  create() {
    this.gameData = session.data;
    this.state = session.state;
    this.root = this.add.container(0, 0);
    this.input.mouse?.disableContextMenu();
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) this.cancelTargeting();
    });
    this.input.keyboard?.on("keydown-ESC", () => this.cancelTargeting());
    this.input.keyboard?.on("keydown-E", () => {
      if (!this.inputLocked) this.dispatch({ type: "endTurn" });
    });
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (event.code === "Backquote") {
        this.debugVisible = !this.debugVisible;
        this.renderAll();
      }
    });
    this.renderAll();
  }

  // ---- action pipeline ----

  private dispatch(action: Action): boolean {
    if (this.inputLocked) return false;
    const result = applyAction(this.gameData, this.state, action);
    if (!result.ok) {
      this.showError(result.error);
      return false;
    }
    session.state = result.state;
    session.events.push(...result.events);
    this.targeting = null;
    this.inputLocked = true;
    const events = result.events;
    const newState = result.state;
    void this.playEvents(events).then(() => {
      this.state = newState;
      this.renderAll();
      this.inputLocked = false;
    });
    return true;
  }

  private async playEvents(events: CombatEvent[]) {
    for (const event of events) {
      await animateEvent(this, event, {
        gameData: this.gameData,
        state: this.state,
        unitAnchors: this.unitAnchors,
        unitViews: this.unitViews,
      });
    }
  }

  private onCardClicked(instanceId: string) {
    if (this.inputLocked || this.state.status !== "playerTurn") return;
    if (this.targeting === instanceId) {
      this.cancelTargeting();
      return;
    }
    const instance = this.state.cards[instanceId]!;
    const card = this.gameData.cards[instance.cardId]!;
    if (!isCardPlayable(this.gameData, this.state, instanceId)) {
      const probeTarget =
        card.target === "none"
          ? undefined
          : getValidTargets(this.gameData, this.state, instanceId)[0] ?? "enemy:0";
      const error = getPlayCardError(this.gameData, this.state, {
        type: "playCard",
        instanceId,
        ...(probeTarget !== undefined ? { targetId: probeTarget } : {}),
      });
      this.shakeCard(instanceId);
      this.showError(error ?? "Không đánh được");
      return;
    }
    if (card.target === "none") {
      this.dispatch({ type: "playCard", instanceId });
      return;
    }
    this.targeting = instanceId;
    this.validTargetIds = new Set(getValidTargets(this.gameData, this.state, instanceId));
    this.renderAll();
  }

  private onUnitClicked(unitId: string) {
    if (
      this.inputLocked ||
      this.targeting === null ||
      !this.validTargetIds.has(unitId)
    )
      return;
    this.dispatch({ type: "playCard", instanceId: this.targeting, targetId: unitId });
  }

  private cancelTargeting() {
    if (this.inputLocked || this.targeting === null) return;
    this.targeting = null;
    this.validTargetIds.clear();
    this.renderAll();
  }

  private shakeCard(instanceId: string) {
    const view = this.cardViews.get(instanceId);
    if (!view) return;
    this.tweens.add({ targets: view, x: view.x + 7, duration: 45, yoyo: true, repeat: 3 });
  }

  private showError(error: string) {
    this.errorText?.destroy();
    const text = this.add
      .text(WIDTH / 2, 525, errorLabel(error), {
        fontFamily: FONT,
        fontSize: "15px",
        color: "#ff8080",
      })
      .setOrigin(0.5);
    this.errorText = text;
    this.tweens.add({
      targets: text,
      alpha: 0,
      delay: 900,
      duration: 800,
      onComplete: () => text.destroy(),
    });
  }

  // ---- rendering ----

  private renderAll() {
    this.root.removeAll(true);
    this.cardViews.clear();
    const phase = this.gameData.moonPhases[this.state.moonIndex]!;
    this.root.add(
      this.add
        .rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, PHASE_BG[phase.id])
        .setDepth(-10),
    );
    this.unitAnchors.clear();
    this.unitViews.clear();
    this.errorText = undefined;
    this.renderTopBar();
    this.renderMoonWheel();
    this.renderEnemies();
    this.renderHeroes();
    this.renderBottomBar();
    if (this.targeting !== null) this.renderTargetingHint();
    if (this.state.status === "won" || this.state.status === "lost") {
      this.renderCombatEnd();
    }
    this.renderDebugPanel();
  }

  private restart(seed?: number, encounterId?: string): void {
    restartSession(seed, encounterId);
    this.syncFromSession();
  }

  private syncFromSession(): void {
    this.state = session.state;
    this.targeting = null;
    this.validTargetIds.clear();
    this.inputLocked = false;
    this.renderAll();
  }

  private text(
    x: number,
    y: number,
    content: string,
    size = 14,
    color: string = COLORS.text,
    parent?: Phaser.GameObjects.Container,
  ) {
    const t = this.add.text(x, y, content, {
      fontFamily: FONT,
      fontSize: `${size}px`,
      color,
    });
    (parent ?? this.root).add(t);
    return t;
  }

  private renderTopBar() {
    this.text(24, 14, `Vòng ${this.state.round}`, 16);
    const phase = this.gameData.moonPhases[this.state.moonIndex]!;
    this.text(WIDTH / 2, 14, `( ${phase.icon} ${phase.name} )`, 16).setOrigin(0.5, 0);
    this.text(WIDTH - 24, 14, "⚙", 18, COLORS.dimText).setOrigin(1, 0);
  }

  private renderMoonWheel() {
    const y = 58;
    this.gameData.moonPhases.forEach((phase, index) => {
      const x = WIDTH / 2 + (index - 3.5) * 36;
      const active = index === this.state.moonIndex;
      if (active) {
        const halo = this.add.circle(x, y, 16, COLORS.panelBorder, 0.6);
        this.root.add(halo);
      }
      this.text(x, y, phase.icon, active ? 22 : 15)
        .setOrigin(0.5)
        .setAlpha(active ? 1 : 0.45);
    });
    const next =
      this.gameData.moonPhases[(this.state.moonIndex + 1) % this.gameData.moonPhases.length]!;
    const effect = next.modifiers.map(describeModifier).join(", ") || "—";
    this.text(
      WIDTH / 2 + 190,
      y,
      `→ kế tiếp: ${next.icon} ${effect}`,
      12,
      COLORS.dimText,
    ).setOrigin(0, 0.5);
  }

  private hpBar(
    x: number,
    y: number,
    width: number,
    hp: number,
    maxHp: number,
    fill: number,
    parent: Phaser.GameObjects.Container,
  ) {
    const height = 14;
    parent.add(this.add.rectangle(x, y, width, height, COLORS.hpTrack).setOrigin(0, 0.5));
    const fillWidth = Math.max(0, (hp / maxHp) * width);
    if (fillWidth > 0) {
      parent.add(this.add.rectangle(x, y, fillWidth, height, fill).setOrigin(0, 0.5));
    }
    this.text(x + width / 2, y, `${hp}/${maxHp}`, 10, COLORS.text, parent).setOrigin(0.5);
  }

  private statusChips(
    x: number,
    y: number,
    statuses: StatusInstance[],
    maxWidth: number,
    parent: Phaser.GameObjects.Container,
  ) {
    let cursor = x;
    let row = y;
    for (const status of statuses) {
      const label = `${STATUS_LABELS[status.id]} ${status.value}`;
      const chipWidth = label.length * 7 + 12;
      if (cursor + chipWidth > x + maxWidth) {
        cursor = x;
        row += 20;
      }
      parent.add(this.add.rectangle(cursor, row, chipWidth, 16, 0x0a0e20).setOrigin(0, 0.5));
      this.text(cursor + chipWidth / 2, row, label, 10, "#cfd6f0", parent).setOrigin(0.5, 0.5);
      cursor += chipWidth + 4;
    }
  }

  private renderIntent(enemy: EnemyState, x: number, y: number) {
    const intent = enemy.currentIntent?.intent;
    if (!intent || !enemy.alive) return;
    const preview = previewEnemyIntent(this.gameData, this.state, enemy);
    const icon = INTENT_ICONS[intent.kind];
    let label = `${icon} ${intent.name}`;
    const firstDamage = preview?.damages[0];
    if (firstDamage) {
      label += ` ${firstDamage.amount}`;
      if (firstDamage.hits > 1) label += `×${firstDamage.hits}`;
    }
    if (preview?.fizzles) {
      label += " → (hụt)";
    } else if (preview?.targetId) {
      const target = this.state.heroes.find((hero) => hero.id === preview.targetId);
      label += ` → ${target ? this.gameData.heroes[target.defId]!.name : "—"}`;
    } else if ((preview?.damages.length ?? 0) > 0) {
      label += " → tất cả";
    }
    if (preview?.skipped) label = `❄ ${label}`;
    this.text(x, y, label, 13).setOrigin(0.5).setAlpha(preview?.skipped ? 0.55 : 1);
  }

  private unitPanelHit(
    panel: Phaser.GameObjects.Rectangle,
    w: number,
    h: number,
    unitId: string,
  ) {
    const selectable = this.targeting !== null && this.validTargetIds.has(unitId);
    panel.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: selectable,
    });
    panel.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 0) this.onUnitClicked(unitId);
    });
  }

  private renderEnemies() {
    const enemies = this.state.enemies;
    const panelW = 220;
    const panelH = 140;
    enemies.forEach((enemy, index) => {
      const cx = (WIDTH / (enemies.length + 1)) * (index + 1);
      this.renderIntent(enemy, cx, 118);
      const cy = 205;
      const c = this.add.container(cx, cy);
      this.root.add(c);
      this.unitAnchors.set(enemy.id, { x: cx, y: cy });
      this.unitViews.set(enemy.id, c);
      const isValidTarget = this.validTargetIds.has(enemy.id);
      const panel = this.add.rectangle(0, 0, panelW, panelH, COLORS.panelEnemy);
      panel.setStrokeStyle(
        this.targeting && isValidTarget ? 2 : 1,
        this.targeting && isValidTarget ? COLORS.goldFill : COLORS.panelBorder,
      );
      c.add(panel);
      const def = this.gameData.enemies[enemy.defId]!;
      this.text(0, -panelH / 2 + 16, def.name, 15, COLORS.text, c).setOrigin(0.5);
      this.hpBar(-panelW / 2 + 14, -14, panelW - 28, enemy.hp, enemy.maxHp, COLORS.hpFillEnemy, c);
      if (enemy.armor > 0) {
        this.text(-panelW / 2 + 14, 12, `🛡 ${enemy.armor}`, 12, COLORS.armor, c);
      }
      this.statusChips(-panelW / 2 + 14, 38, enemy.statuses, panelW - 28, c);
      if (!enemy.alive) {
        c.add(this.add.rectangle(0, 0, panelW, panelH, 0x000000, 0.55));
        this.text(0, 0, "Ngã", 20, "#ffffff", c).setOrigin(0.5);
      } else if (enemy.statuses.some((s) => s.id === "stealth")) {
        c.add(this.add.rectangle(0, 0, panelW, panelH, 0x8899ff, 0.12));
      }
      if (this.targeting && !isValidTarget) c.setAlpha(0.4);
      this.unitPanelHit(panel, panelW, panelH, enemy.id);
    });
  }

  private renderHeroes() {
    const heroes = this.state.heroes;
    const panelW = 240;
    const panelH = 170;
    heroes.forEach((hero, index) => {
      const cx = (WIDTH / (heroes.length + 1)) * (index + 1);
      const cy = 445;
      const c = this.add.container(cx, cy);
      this.root.add(c);
      this.unitAnchors.set(hero.id, { x: cx, y: cy });
      this.unitViews.set(hero.id, c);
      const isValidTarget = this.validTargetIds.has(hero.id);
      const panel = this.add.rectangle(0, 0, panelW, panelH, COLORS.panelHero);
      panel.setStrokeStyle(
        this.targeting && isValidTarget ? 2 : hero.leveledUp ? 2 : 1,
        this.targeting && isValidTarget
          ? COLORS.goldFill
          : hero.leveledUp
            ? COLORS.goldFill
            : COLORS.panelBorder,
      );
      c.add(panel);
      const def = this.gameData.heroes[hero.defId]!;
      const star = hero.leveledUp ? " ★" : "";
      this.text(
        0,
        -panelH / 2 + 18,
        `${def.name}${star}`,
        16,
        hero.leveledUp ? COLORS.gold : COLORS.text,
        c,
      ).setOrigin(0.5);
      this.hpBar(-panelW / 2 + 16, -30, panelW - 32, hero.hp, hero.maxHp, COLORS.hpFillHero, c);
      if (hero.armor > 0) {
        this.text(-panelW / 2 + 16, -4, `🛡 ${hero.armor}`, 12, COLORS.armor, c);
      }
      this.statusChips(-panelW / 2 + 16, 22, hero.statuses, panelW - 32, c);
      const progress = hero.leveledUp
        ? def.levelUp.name
        : `${def.levelUp.name} ${hero.levelUpCounter}/${def.levelUp.threshold}`;
      this.text(0, panelH / 2 - 20, progress, 11, COLORS.dimText, c).setOrigin(0.5);
      if (!hero.alive) {
        c.add(this.add.rectangle(0, 0, panelW, panelH, 0x000000, 0.55));
        this.text(0, 0, "Ngã", 20, "#ffffff", c).setOrigin(0.5);
      }
      if (this.targeting && !isValidTarget) c.setAlpha(0.4);
      this.unitPanelHit(panel, panelW, panelH, hero.id);
    });
  }

  private renderCard(instanceId: string, x: number, y: number) {
    const instance = this.state.cards[instanceId]!;
    const card = this.gameData.cards[instance.cardId]!;
    const owner = this.state.heroes.find((hero) => hero.defId === instance.ownerId);
    const broken = !owner?.alive;
    const playable = isCardPlayable(this.gameData, this.state, instanceId);
    const container = this.add.container(x, y);
    this.root.add(container);
    this.cardViews.set(instanceId, container);

    const bg = this.add.rectangle(0, 0, CARD_W, CARD_H, broken ? 0x30303a : 0x141b33);
    const isValidTarget = this.targeting === instanceId;
    bg.setStrokeStyle(
      isValidTarget ? 3 : 2,
      broken
        ? COLORS.dead
        : isValidTarget
          ? COLORS.goldFill
          : (OWNER_COLORS[instance.ownerId] ?? COLORS.panelBorder),
    );
    container.add(bg);

    const effectiveCost = getEffectiveCost(this.gameData, this.state, instanceId);
    const badge = this.add.circle(-CARD_W / 2 + 14, -CARD_H / 2 + 14, 12, 0x0a0e20);
    badge.setStrokeStyle(1, COLORS.panelBorder);
    container.add(badge);
    container.add(
      this.add
        .text(-CARD_W / 2 + 14, -CARD_H / 2 + 14, `${effectiveCost}`, {
          fontFamily: FONT,
          fontSize: "14px",
          color: effectiveCost < card.cost ? COLORS.costCheap : COLORS.text,
        })
        .setOrigin(0.5),
    );
    if (effectiveCost < card.cost) {
      container.add(
        this.add
          .text(-CARD_W / 2 + 30, -CARD_H / 2 + 14, `${card.cost}`, {
            fontFamily: FONT,
            fontSize: "10px",
            color: COLORS.dimText,
          })
          .setOrigin(0, 0.5),
      );
      container.add(
        this.add.rectangle(-CARD_W / 2 + 34, -CARD_H / 2 + 14, 10, 1, 0xffffff, 0.7),
      );
    }

    container.add(
      this.add
        .text(0, -20, card.name, {
          fontFamily: FONT,
          fontSize: "13px",
          color: COLORS.text,
          align: "center",
          wordWrap: { width: CARD_W - 14 },
        })
        .setOrigin(0.5),
    );
    container.add(
      this.add
        .text(0, 42, card.text, {
          fontFamily: FONT,
          fontSize: "9px",
          color: COLORS.dimText,
          align: "center",
          wordWrap: { width: CARD_W - 12 },
        })
        .setOrigin(0.5, 0),
    );

    if (broken) {
      container.add(
        this.add
          .text(0, 0, "Tàn Chiêu", { fontFamily: FONT, fontSize: "14px", color: "#bbbbbb" })
          .setOrigin(0.5),
      );
    } else if (!playable && !isValidTarget) {
      container.setAlpha(0.5);
    }

    container.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
    container.on("pointerover", () => {
      if (!broken && this.state.status === "playerTurn") {
        container.setScale(1.15);
        container.y = y - 18;
        container.setDepth(10);
      }
    });
    container.on("pointerout", () => {
      container.setScale(1);
      container.y = y;
      container.setDepth(0);
    });
    container.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 0) this.onCardClicked(instanceId);
    });
    return container;
  }

  private renderTargetingHint() {
    const card = this.gameData.cards[this.state.cards[this.targeting!]!.cardId]!;
    this.text(
      WIDTH / 2,
      92,
      `Chọn mục tiêu cho ${card.name} — chuột phải / Esc để hủy`,
      13,
      COLORS.gold,
    ).setOrigin(0.5);
  }

  private renderCombatEnd() {
    const won = this.state.status === "won";
    this.root.add(this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x000000, 0.65));
    this.text(
      WIDTH / 2,
      HEIGHT / 2 - 30,
      won ? "THẮNG" : "THUA",
      56,
      won ? COLORS.gold : "#cc5555",
    ).setOrigin(0.5);
    this.text(
      WIDTH / 2,
      HEIGHT / 2 + 30,
      won ? "Vọng Nguyệt Thư Viện còn đứng." : "Thư viện đã bị xâm chiếm.",
      16,
      COLORS.dimText,
    ).setOrigin(0.5);
    this.endScreenButton(WIDTH / 2 - 100, HEIGHT / 2 + 90, "Chơi lại", () => this.restart());
    this.endScreenButton(WIDTH / 2 + 100, HEIGHT / 2 + 90, "Trận khác", () => {
      cycleEncounter(1);
      this.syncFromSession();
    });
  }

  private endScreenButton(
    x: number,
    y: number,
    label: string,
    onClick: () => void,
  ): void {
    const btn = this.add.rectangle(x, y, 160, 42, COLORS.button);
    btn.setStrokeStyle(1, COLORS.goldFill);
    btn.setInteractive({ useHandCursor: true });
    btn.on("pointerover", () => btn.setFillStyle(0x3a5090));
    btn.on("pointerout", () => btn.setFillStyle(COLORS.button));
    btn.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 0) onClick();
    });
    this.root.add(btn);
    this.text(x, y, label, 14).setOrigin(0.5);
  }

  private debugButton(
    x: number,
    y: number,
    width: number,
    label: string,
    onClick: () => void,
    fontSize = 11,
  ): void {
    const btn = this.add.rectangle(x, y, width, 22, COLORS.button).setOrigin(0, 0.5);
    btn.setInteractive({ useHandCursor: true });
    btn.on("pointerover", () => btn.setFillStyle(0x3a5090));
    btn.on("pointerout", () => btn.setFillStyle(COLORS.button));
    btn.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 0) onClick();
    });
    this.root.add(btn);
    this.text(x + width / 2, y, label, fontSize).setOrigin(0.5);
  }

  private renderDebugPanel(): void {
    if (!this.debugVisible) return;
    const x = WIDTH - 336;
    this.root.add(
      this.add
        .rectangle(x + 168, HEIGHT / 2, 336, HEIGHT - 16, 0x0a0e20, 0.93)
        .setStrokeStyle(1, COLORS.panelBorder),
    );
    let y = 30;
    const line = (label: string, size = 12) => {
      this.text(x + 14, y, label, size);
      y += 20;
    };
    line(`DEBUG — seed ${session.seed} · ${session.encounterId}`, 13);
    this.debugButton(x + 14, y + 10, 100, "Chơi lại", () => this.restart());
    this.debugButton(x + 124, y + 10, 80, "Seed +1", () => this.restart(session.seed + 1));
    this.debugButton(x + 214, y + 10, 90, "Trận kế ▸", () => {
      cycleEncounter(1);
      this.syncFromSession();
    });
    y += 36;
    this.debugButton(x + 14, y + 10, 110, "+3 Nguyệt Lực", () => {
      debugAddMoonPower();
      this.renderAll();
    });
    this.debugButton(x + 134, y + 10, 80, "Rút 1 lá", () => {
      debugDrawCards(1);
      this.renderAll();
    });
    y += 36;
    line("Đặt pha:");
    this.gameData.moonPhases.forEach((phase, index) => {
      this.debugButton(x + 14 + index * 38, y + 8, 32, phase.icon, () => {
        debugSetMoon(index);
        this.renderAll();
      });
    });
    y += 32;
    line("HP Hero:");
    this.state.heroes.forEach((hero, index) => {
      const def = this.gameData.heroes[hero.defId]!;
      this.text(x + 14, y + 8, `${def.name} ${hero.hp}/${hero.maxHp}`, 11);
      this.debugButton(x + 200, y + 8, 44, "-5", () => {
        debugAdjustHeroHp(index, -5);
        this.renderAll();
      });
      this.debugButton(x + 250, y + 8, 44, "+5", () => {
        debugAdjustHeroHp(index, 5);
        this.renderAll();
      });
      y += 28;
    });
    this.state.enemies.forEach((enemy, index) => {
      if (!enemy.alive) return;
      const def = this.gameData.enemies[enemy.defId]!;
      this.debugButton(x + 14, y + 8, 180, `Giết: ${def.name}`, () => {
        debugKillEnemy(index);
        this.renderAll();
      }, 10);
      y += 28;
    });
    y += 6;
    line("— Sự kiện —", 11);
    for (const event of session.events.slice(-14)) {
      line(describeEvent(this.state, this.gameData, event), 10);
    }
  }

  private renderBottomBar() {
    const power = this.state.moonPower;
    this.text(30, 545, "Nguyệt Lực", 13, COLORS.dimText);
    this.text(30, 566, `${"◉".repeat(power)}${"○".repeat(Math.max(0, 3 - power))}`, 16, COLORS.gold);
    this.text(30, 592, `${power}/3`, 12, COLORS.dimText);

    const hand = this.state.hand;
    const spacing = CARD_W + 10;
    const startX = WIDTH / 2 - ((hand.length - 1) * spacing) / 2;
    hand.forEach((instanceId, index) => {
      this.renderCard(instanceId, startX + index * spacing, 632);
    });

    this.text(1090, 552, `Rút ${this.state.drawPile.length}`, 13, COLORS.dimText);
    this.text(1090, 576, `Bỏ ${this.state.discardPile.length}`, 13, COLORS.dimText);

    const btnX = 1150;
    const btnY = 660;
    const btn = this.add.rectangle(btnX, btnY, 190, 56, COLORS.button);
    btn.setStrokeStyle(1, COLORS.goldFill);
    btn.setInteractive({ useHandCursor: true });
    btn.on("pointerover", () => btn.setFillStyle(0x3a5090));
    btn.on("pointerout", () => btn.setFillStyle(COLORS.button));
    btn.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 0 && !this.inputLocked) this.dispatch({ type: "endTurn" });
    });
    this.root.add(btn);
    this.text(btnX, btnY, "KẾT THÚC LƯỢT", 15).setOrigin(0.5);
  }
}
