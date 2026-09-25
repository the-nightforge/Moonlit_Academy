import Phaser from "phaser";
import { applyRunAction, findNode, reachableNodeIds, restHealAmounts } from "rules";
import type { MapNode, RunAction, RunState } from "rules";
import { session } from "../session";
import { COLORS, NODE_ICONS, OWNER_COLORS, TEXT_BASE, useDesignCamera } from "../ui/theme";

const WIDTH = 1280;
const HEIGHT = 720;

const ERROR_LABELS: Record<string, string> = {
  "node is not reachable": "Không đi tới nút này được",
  "deck is at minimum size": "Deck đã ở mức tối thiểu",
};

export class RunScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private showDeck = false;
  private lastGainedRelic: string | undefined;

  constructor() {
    super("run");
  }

  create() {
    useDesignCamera(this);
    this.root = this.add.container(0, 0);
    this.showDeck = false;
    this.render();
  }

  private get run(): RunState {
    return session.run!;
  }

  private dispatch(action: RunAction) {
    const result = applyRunAction(session.data, this.run, action);
    if (!result.ok) {
      this.showError(result.error);
      return;
    }
    session.run = result.run;
    session.events.push(...result.events);
    this.lastGainedRelic = result.runEvents.flatMap((e) =>
      e.type === "runRelicGained" ? [e.runRelicId] : [],
    )[0];
    if (result.run.status === "combat" && result.run.combat) {
      session.state = result.run.combat;
      this.scene.start("combat");
      return;
    }
    this.render();
  }

  private text(x: number, y: number, content: string, size = 14, color: string = COLORS.text) {
    const t = this.add.text(x, y, content, { ...TEXT_BASE, fontSize: `${size}px`, color });
    this.root.add(t);
    return t;
  }

  private button(x: number, y: number, w: number, label: string, onClick: () => void) {
    const btn = this.add.rectangle(x, y, w, 34, COLORS.button).setStrokeStyle(1, COLORS.goldFill);
    btn.setInteractive({ useHandCursor: true });
    btn.on("pointerover", () => btn.setFillStyle(0x3a5090));
    btn.on("pointerout", () => btn.setFillStyle(COLORS.button));
    btn.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 0) onClick();
    });
    this.root.add(btn);
    this.text(x, y, label, 13).setOrigin(0.5);
  }

  private showError(error: string) {
    const t = this.text(WIDTH / 2, HEIGHT - 20, ERROR_LABELS[error] ?? error, 14, "#ff8080").setOrigin(0.5);
    this.tweens.add({ targets: t, alpha: 0, delay: 900, duration: 600, onComplete: () => t.destroy() });
  }

  private render() {
    this.root.removeAll(true);
    this.root.add(this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, COLORS.background));
    switch (this.run.status) {
      case "map":
        this.renderHeader();
        this.renderMap();
        break;
      case "reward":
        this.renderHeader();
        this.renderReward();
        break;
      case "rest":
        this.renderHeader();
        this.renderRest();
        break;
      case "treasure":
        this.renderHeader();
        this.renderTreasure();
        break;
      case "won":
      case "lost":
        this.renderEnd();
        break;
      case "combat":
        break;
    }
    if (this.showDeck) this.renderDeck();
  }

  private renderHeader() {
    this.run.heroes.forEach((hero, index) => {
      const def = session.data.heroes[hero.defId]!;
      this.text(24, 16 + index * 20, `${def.name} ${hero.hp}/${hero.maxHp}`, 14);
    });
    const relics =
      this.run.runRelicIds.map((id) => session.data.runRelics[id]?.name ?? id).join(" · ") || "—";
    this.text(WIDTH / 2, 16, `Kỳ Vật: ${relics}`, 13, COLORS.dimText).setOrigin(0.5, 0);
    const deck = this.text(WIDTH - 24, 16, `Deck ${this.run.deck.length} lá ▾`, 14, COLORS.gold).setOrigin(1, 0);
    deck.setInteractive({ useHandCursor: true });
    deck.on("pointerup", () => {
      this.showDeck = !this.showDeck;
      this.render();
    });
  }

  private renderMap() {
    const nodes = this.run.map.floors.flat();
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const reachable = new Set(reachableNodeIds(this.run));
    const pos = (node: MapNode) => {
      const width = this.run.map.floors[node.floor - 1]!.length;
      return { x: WIDTH / 2 + (node.lane - (width - 1) / 2) * 170, y: 660 - (node.floor - 1) * 68 };
    };
    const lines = this.add.graphics();
    lines.lineStyle(2, COLORS.panelBorder, 1);
    for (const node of nodes) {
      for (const nextId of node.next) {
        const a = pos(node);
        const b = pos(byId.get(nextId)!);
        lines.lineBetween(a.x, a.y, b.x, b.y);
      }
    }
    this.root.add(lines);
    for (const node of nodes) {
      const { x, y } = pos(node);
      const current = node.id === this.run.position;
      const canGo = reachable.has(node.id);
      const circle = this.add
        .circle(x, y, 22, canGo ? 0x3a5090 : COLORS.panelHero)
        .setStrokeStyle(current || canGo ? 3 : 1, current || canGo ? COLORS.goldFill : COLORS.panelBorder);
      this.root.add(circle);
      this.text(x, y, NODE_ICONS[node.type], 18).setOrigin(0.5);
      if (canGo) {
        circle.setInteractive({ useHandCursor: true });
        circle.on("pointerup", (pointer: Phaser.Input.Pointer) => {
          if (pointer.button === 0) this.dispatch({ type: "chooseNode", nodeId: node.id });
        });
      }
    }
  }

  private cardBox(x: number, y: number, cardId: string, onClick: () => void) {
    const card = session.data.cards[cardId]!;
    const owner = card.ownerId ?? "";
    const bg = this.add
      .rectangle(x, y, 170, 230, 0x141b33)
      .setStrokeStyle(2, OWNER_COLORS[owner] ?? COLORS.panelBorder);
    bg.setInteractive({ useHandCursor: true });
    bg.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 0) onClick();
    });
    this.root.add(bg);
    this.text(x - 70, y - 105, `${card.cost}`, 18, COLORS.gold);
    this.root.add(
      this.add
        .text(x, y - 60, card.name, { ...TEXT_BASE, fontSize: "16px", color: COLORS.text, align: "center", wordWrap: { width: 150 } })
        .setOrigin(0.5),
    );
    this.text(x, y - 30, session.data.heroes[owner]?.name ?? "", 12, COLORS.dimText).setOrigin(0.5);
    this.root.add(
      this.add
        .text(x, y, card.text, { ...TEXT_BASE, fontSize: "12px", color: COLORS.dimText, align: "center", wordWrap: { width: 150 } })
        .setOrigin(0.5, 0),
    );
  }

  private renderReward() {
    const reward = this.run.pendingReward!;
    this.text(WIDTH / 2, 130, "Chọn 1 lá thưởng", 24, COLORS.gold).setOrigin(0.5);
    if (reward.runRelicId !== undefined) {
      const relic = session.data.runRelics[reward.runRelicId]!;
      this.text(WIDTH / 2, 170, `Nhận Kỳ Vật: ${relic.name} — ${relic.text}`, 14, COLORS.gold).setOrigin(0.5);
    }
    reward.cardChoices.forEach((cardId, index) => {
      const x = WIDTH / 2 + (index - (reward.cardChoices.length - 1) / 2) * 200;
      this.cardBox(x, 340, cardId, () => this.dispatch({ type: "pickCard", cardId }));
    });
    this.button(WIDTH / 2, 520, 180, reward.cardChoices.length > 0 ? "Bỏ qua" : "Tiếp tục", () =>
      this.dispatch({ type: "pickCard", cardId: null }),
    );
  }

  private renderRest() {
    this.text(WIDTH / 2, 130, "Nghỉ Chân", 24, COLORS.gold).setOrigin(0.5);
    const heals = restHealAmounts(session.data, this.run);
    this.button(WIDTH / 2, 190, 240, "Hồi máu", () => this.dispatch({ type: "rest", choice: "heal" }));
    const summary = this.run.heroes
      .map((hero, index) => `${session.data.heroes[hero.defId]!.name} +${heals[index]}`)
      .join("   ");
    this.text(WIDTH / 2, 222, summary, 13, COLORS.dimText).setOrigin(0.5);
    const { minDeckSize } = session.data.runConfig;
    if (this.run.deck.length <= minDeckSize) {
      this.text(WIDTH / 2, 270, `Deck đã tối thiểu (${minDeckSize} lá) — không bỏ lá được`, 14, COLORS.dimText).setOrigin(0.5);
      return;
    }
    this.text(WIDTH / 2, 270, "…hoặc bỏ 1 lá khỏi deck:", 14, COLORS.dimText).setOrigin(0.5);
    this.run.deck.forEach((cardId, index) => {
      const col = index % 5;
      const row = Math.floor(index / 5);
      this.button(WIDTH / 2 + (col - 2) * 210, 310 + row * 40, 200, session.data.cards[cardId]!.name, () =>
        this.dispatch({ type: "rest", choice: "removeCard", cardId }),
      );
    });
  }

  private renderTreasure() {
    this.text(WIDTH / 2, 180, "Kho Báu", 28, COLORS.gold).setOrigin(0.5);
    const relic = this.lastGainedRelic ? session.data.runRelics[this.lastGainedRelic] : undefined;
    this.text(WIDTH / 2, 250, relic ? `${relic.name}: ${relic.text}` : "Kho báu trống.", 16).setOrigin(0.5);
    this.button(WIDTH / 2, 330, 200, "Tiếp tục", () => this.dispatch({ type: "continue" }));
  }

  private renderEnd() {
    const won = this.run.status === "won";
    const floor = this.run.position ? (findNode(this.run, this.run.position)?.floor ?? 0) : 0;
    this.text(WIDTH / 2, 260, won ? "LƯỢT CHƠI THẮNG" : "LƯỢT CHƠI THẤT BẠI", 44, won ? COLORS.gold : "#cc5555").setOrigin(0.5);
    this.text(
      WIDTH / 2,
      320,
      `Tầng ${floor}/${session.data.runConfig.floors} · Deck ${this.run.deck.length} lá · ${this.run.runRelicIds.length} Kỳ Vật`,
      16,
      COLORS.dimText,
    ).setOrigin(0.5);
    this.button(WIDTH / 2, 400, 240, "Về màn chọn đội", () => {
      session.run = null;
      this.scene.start("team-select");
    });
  }

  private renderDeck() {
    const overlay = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x000000, 0.8);
    overlay.setInteractive();
    overlay.on("pointerup", () => {
      this.showDeck = false;
      this.render();
    });
    this.root.add(overlay);
    this.text(WIDTH / 2, 60, `Deck (${this.run.deck.length} lá) — bấm để đóng`, 18, COLORS.gold).setOrigin(0.5);
    this.run.deck.forEach((cardId, index) => {
      const card = session.data.cards[cardId]!;
      const col = index % 4;
      const row = Math.floor(index / 4);
      this.text(160 + col * 280, 100 + row * 24, `${card.cost} · ${card.name}`, 13);
    });
  }
}
