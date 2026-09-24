import Phaser from "phaser";
import { getEffectiveCost, isCardPlayable } from "rules";
import type {
  CombatState,
  EnemyState,
  GameData,
  HeroState,
  StatusInstance,
} from "rules";
import { session } from "../session";
import {
  COLORS,
  FONT,
  INTENT_ICONS,
  OWNER_COLORS,
  STATUS_LABELS,
  describeModifier,
} from "../ui/theme";

const WIDTH = 1280;
const HEIGHT = 720;
const CARD_W = 110;
const CARD_H = 160;

export class CombatScene extends Phaser.Scene {
  private gameData!: GameData;
  private state!: CombatState;

  constructor() {
    super("combat");
  }

  create() {
    this.gameData = session.data;
    this.state = session.state;
    this.renderTopBar();
    this.renderMoonWheel();
    this.renderEnemies();
    this.renderHeroes();
    this.renderBottomBar();
  }

  private text(x: number, y: number, content: string, size = 14, color: string = COLORS.text) {
    return this.add.text(x, y, content, {
      fontFamily: FONT,
      fontSize: `${size}px`,
      color,
    });
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
        this.add.circle(x, y, 16, COLORS.panelBorder, 0.6);
      }
      this.text(x, y, phase.icon, active ? 22 : 15)
        .setOrigin(0.5)
        .setAlpha(active ? 1 : 0.45);
    });
    const next = this.gameData.moonPhases[(this.state.moonIndex + 1) % this.gameData.moonPhases.length]!;
    const effect = next.modifiers.map(describeModifier).join(", ") || "—";
    this.text(WIDTH / 2 + 190, y, `→ kế tiếp: ${next.icon} ${effect}`, 12, COLORS.dimText).setOrigin(0, 0.5);
  }

  private hpBar(
    x: number,
    y: number,
    width: number,
    hp: number,
    maxHp: number,
    fill: number,
  ) {
    const height = 14;
    this.add.rectangle(x, y, width, height, COLORS.hpTrack).setOrigin(0, 0.5);
    const fillWidth = Math.max(0, (hp / maxHp) * width);
    if (fillWidth > 0) {
      this.add.rectangle(x, y, fillWidth, height, fill).setOrigin(0, 0.5);
    }
    this.text(x + width / 2, y, `${hp}/${maxHp}`, 10).setOrigin(0.5);
  }

  private statusChips(x: number, y: number, statuses: StatusInstance[], maxWidth: number) {
    let cursor = x;
    let row = y;
    for (const status of statuses) {
      const label = `${STATUS_LABELS[status.id]} ${status.value}`;
      const chipWidth = label.length * 7 + 12;
      if (cursor + chipWidth > x + maxWidth) {
        cursor = x;
        row += 20;
      }
      this.add.rectangle(cursor, row, chipWidth, 16, 0x0a0e20).setOrigin(0, 0.5);
      this.text(cursor + chipWidth / 2, row, label, 10, "#cfd6f0").setOrigin(0.5, 0.5);
      cursor += chipWidth + 4;
    }
  }

  private unitDeadOverlay(x: number, y: number, w: number, h: number) {
    this.add.rectangle(x, y, w, h, 0x000000, 0.55).setOrigin(0.5);
    this.text(x, y, "Ngã", 20, "#ffffff").setOrigin(0.5);
  }

  private renderEnemies() {
    const enemies = this.state.enemies;
    const panelW = 220;
    const panelH = 140;
    enemies.forEach((enemy, index) => {
      const cx = (WIDTH / (enemies.length + 1)) * (index + 1);
      this.renderIntent(enemy, cx, 118);
      const cy = 205;
      this.add
        .rectangle(cx, cy, panelW, panelH, COLORS.panelEnemy)
        .setStrokeStyle(1, COLORS.panelBorder);
      const def = this.gameData.enemies[enemy.defId]!;
      this.text(cx, cy - panelH / 2 + 16, def.name, 15).setOrigin(0.5);
      this.hpBar(cx - panelW / 2 + 14, cy - 14, panelW - 28, enemy.hp, enemy.maxHp, COLORS.hpFillEnemy);
      if (enemy.armor > 0) {
        this.text(cx - panelW / 2 + 14, cy + 12, `🛡 ${enemy.armor}`, 12, COLORS.armor);
      }
      this.statusChips(cx - panelW / 2 + 14, cy + 38, enemy.statuses, panelW - 28);
      if (!enemy.alive) this.unitDeadOverlay(cx, cy, panelW, panelH);
      else if (enemy.statuses.some((s) => s.id === "stealth")) {
        this.add.rectangle(cx, cy, panelW, panelH, 0x8899ff, 0.12).setOrigin(0.5);
      }
    });
  }

  private renderIntent(enemy: EnemyState, x: number, y: number) {
    const intent = enemy.currentIntent?.intent;
    if (!intent || !enemy.alive) return;
    const icon = INTENT_ICONS[intent.kind];
    const target = enemy.currentIntent?.targetId
      ? this.state.heroes.find((hero) => hero.id === enemy.currentIntent!.targetId)
      : undefined;
    const targetName = target ? this.gameData.heroes[target.defId]!.name : "—";
    this.text(x, y, `${icon} ${intent.name} → ${targetName}`, 13).setOrigin(0.5);
  }

  private renderHeroes() {
    const heroes = this.state.heroes;
    const panelW = 240;
    const panelH = 170;
    heroes.forEach((hero, index) => {
      const cx = (WIDTH / (heroes.length + 1)) * (index + 1);
      const cy = 445;
      const border = hero.leveledUp ? COLORS.goldFill : COLORS.panelBorder;
      this.add
        .rectangle(cx, cy, panelW, panelH, COLORS.panelHero)
        .setStrokeStyle(hero.leveledUp ? 2 : 1, border);
      const def = this.gameData.heroes[hero.defId]!;
      const star = hero.leveledUp ? " ★" : "";
      this.text(cx, cy - panelH / 2 + 18, `${def.name}${star}`, 16, hero.leveledUp ? COLORS.gold : COLORS.text).setOrigin(0.5);
      this.hpBar(cx - panelW / 2 + 16, cy - 30, panelW - 32, hero.hp, hero.maxHp, COLORS.hpFillHero);
      if (hero.armor > 0) {
        this.text(cx - panelW / 2 + 16, cy - 4, `🛡 ${hero.armor}`, 12, COLORS.armor);
      }
      this.statusChips(cx - panelW / 2 + 16, cy + 22, hero.statuses, panelW - 32);
      const progress = hero.leveledUp
        ? `${def.levelUp.name}`
        : `${def.levelUp.name} ${hero.levelUpCounter}/${def.levelUp.threshold}`;
      this.text(cx, cy + panelH / 2 - 20, progress, 11, COLORS.dimText).setOrigin(0.5);
      if (!hero.alive) this.unitDeadOverlay(cx, cy, panelW, panelH);
    });
  }

  private renderCard(instanceId: string, x: number, y: number) {
    const instance = this.state.cards[instanceId]!;
    const card = this.gameData.cards[instance.cardId]!;
    const owner = this.state.heroes.find((hero) => hero.defId === instance.ownerId);
    const broken = !owner?.alive;
    const playable = isCardPlayable(this.gameData, this.state, instanceId);
    const container = this.add.container(x, y);

    const bg = this.add.rectangle(0, 0, CARD_W, CARD_H, broken ? 0x30303a : 0x141b33);
    bg.setStrokeStyle(2, broken ? COLORS.dead : (OWNER_COLORS[instance.ownerId] ?? COLORS.panelBorder));
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
      const base = this.add
        .text(-CARD_W / 2 + 30, -CARD_H / 2 + 14, `${card.cost}`, {
          fontFamily: FONT,
          fontSize: "10px",
          color: COLORS.dimText,
        })
        .setOrigin(0, 0.5);
      const strike = this.add.rectangle(
        -CARD_W / 2 + 34,
        -CARD_H / 2 + 14,
        10,
        1,
        0xffffff,
        0.7,
      );
      container.add([base, strike]);
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
          .text(0, 0, "Tàn Chiêu", {
            fontFamily: FONT,
            fontSize: "14px",
            color: "#bbbbbb",
          })
          .setOrigin(0.5),
      );
    } else if (!playable) {
      container.setAlpha(0.5);
    }
    return container;
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
    this.add.rectangle(btnX, btnY, 190, 56, COLORS.button).setStrokeStyle(1, COLORS.goldFill);
    this.text(btnX, btnY, "KẾT THÚC LƯỢT", 15).setOrigin(0.5);
  }
}
