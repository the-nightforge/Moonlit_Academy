import type Phaser from "phaser";
import type { CombatEvent, CombatState, GameData } from "rules";
import { FONT, STATUS_LABELS } from "./theme";

const WIDTH = 1280;

export interface AnimContext {
  gameData: GameData;
  state: CombatState;
  unitAnchors: Map<string, { x: number; y: number }>;
  unitViews: Map<string, Phaser.GameObjects.Container>;
}

function floatText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  content: string,
  color: string,
  size: number,
  duration: number,
): Promise<void> {
  return new Promise((resolve) => {
    const text = scene.add
      .text(x, y, content, { fontFamily: FONT, fontSize: `${size}px`, color })
      .setOrigin(0.5)
      .setDepth(100);
    scene.tweens.add({
      targets: text,
      y: y - 34,
      alpha: 0,
      duration,
      ease: "Sine.easeOut",
      onComplete: () => {
        text.destroy();
        resolve();
      },
    });
  });
}

function flash(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number,
  duration: number,
): Promise<void> {
  return new Promise((resolve) => {
    const rect = scene.add
      .rectangle(x, y, w, h, color, 0.45)
      .setDepth(90);
    scene.tweens.add({
      targets: rect,
      alpha: 0,
      duration,
      onComplete: () => {
        rect.destroy();
        resolve();
      },
    });
  });
}

function instant(): Promise<void> {
  return Promise.resolve();
}

function moonX(index: number): number {
  return WIDTH / 2 + (index - 3.5) * 36;
}

export function animateEvent(
  scene: Phaser.Scene,
  event: CombatEvent,
  ctx: AnimContext,
): Promise<void> {
  const anchorOf = (unitId: string) => ctx.unitAnchors.get(unitId);

  switch (event.type) {
    case "turnStarted": {
      const label = event.side === "hero" ? "— Lượt người chơi —" : "— Lượt kẻ địch —";
      return floatText(scene, WIDTH / 2, 96, label, "#cfd6f0", 16, 350);
    }
    case "cardsDrawn": {
      const ids = event.instanceIds;
      if (ids.length === 0) return instant();
      return Promise.all(
        ids.map(
          (id, i) =>
            new Promise<void>((resolve) => {
              const rect = scene.add
                .rectangle(1090, 560, 30, 44, 0x2c3e6e)
                .setStrokeStyle(1, 0xf4d35e)
                .setDepth(100);
              scene.tweens.add({
                targets: rect,
                x: WIDTH / 2 + (i - (ids.length - 1) / 2) * 70,
                y: 610,
                delay: i * 60,
                duration: 120,
                onComplete: () => {
                  rect.destroy();
                  resolve();
                },
              });
            }),
        ),
      ).then(() => undefined);
    }
    case "deckShuffled":
      return floatText(scene, 1090, 540, "Xáo lại chồng bỏ", "#cfd6f0", 12, 300);
    case "cardPlayed": {
      const instance = ctx.state.cards[event.instanceId];
      const card = instance ? ctx.gameData.cards[instance.cardId] : undefined;
      const name = card?.name ?? "";
      return floatText(scene, WIDTH / 2, 330, `◆ ${name}`, "#f4d35e", 22, 300);
    }
    case "cardDiscarded":
      return instant();
    case "damageDealt": {
      const anchor = anchorOf(event.targetId);
      if (!anchor) return instant();
      const jobs: Promise<void>[] = [
        flash(scene, anchor.x, anchor.y, 200, 130, 0xc03030, 250),
        floatText(
          scene,
          anchor.x,
          anchor.y - 50,
          event.hpLost > 0 ? `-${event.hpLost}` : "Chặn",
          event.hpLost > 0 ? "#ff6b6b" : "#9aa3c0",
          20,
          350,
        ),
      ];
      if (event.blocked > 0) {
        jobs.push(
          floatText(scene, anchor.x, anchor.y - 24, `🛡 ${event.blocked}`, "#9fd4ff", 13, 300),
        );
      }
      const view = ctx.unitViews.get(event.targetId);
      if (view) {
        scene.tweens.add({ targets: view, x: view.x + 6, duration: 45, yoyo: true, repeat: 3 });
      }
      return Promise.all(jobs).then(() => undefined);
    }
    case "hpLost": {
      const anchor = anchorOf(event.targetId);
      if (!anchor) return instant();
      const cause = event.cause === "burn" ? "Đốt " : "";
      return Promise.all([
        flash(scene, anchor.x, anchor.y, 200, 130, 0x8a2be2, 200),
        floatText(scene, anchor.x, anchor.y - 50, `${cause}-${event.amount}`, "#c07fff", 18, 250),
      ]).then(() => undefined);
    }
    case "healed": {
      const anchor = anchorOf(event.targetId);
      if (!anchor) return instant();
      return Promise.all([
        flash(scene, anchor.x, anchor.y, 200, 130, 0x2e8b57, 250),
        floatText(scene, anchor.x, anchor.y - 50, `+${event.amount}`, "#7fe07f", 18, 300),
      ]).then(() => undefined);
    }
    case "armorGained": {
      const anchor = anchorOf(event.targetId);
      if (!anchor) return instant();
      return floatText(scene, anchor.x, anchor.y - 40, `🛡 +${event.amount}`, "#9fd4ff", 15, 200);
    }
    case "armorRemoved":
      return instant();
    case "statusApplied": {
      const anchor = anchorOf(event.targetId);
      if (!anchor) return instant();
      return floatText(
        scene,
        anchor.x,
        anchor.y - 62,
        `+${STATUS_LABELS[event.status]} ${event.value}`,
        "#ffd97f",
        13,
        150,
      );
    }
    case "statusRemoved": {
      const anchor = anchorOf(event.targetId);
      if (!anchor) return instant();
      return floatText(
        scene,
        anchor.x,
        anchor.y - 62,
        `-${STATUS_LABELS[event.status]}`,
        "#8b93b8",
        12,
        150,
      );
    }
    case "moonPowerChanged":
      return floatText(scene, 105, 566, `Nguyệt Lực ${event.value}`, "#f4d35e", 12, 200);
    case "moonShifted": {
      const fromX = moonX(event.from);
      const toX = moonX(event.to);
      return new Promise((resolve) => {
        const marker = scene.add.circle(fromX, 58, 18, 0xf4d35e, 0.35).setDepth(95);
        scene.tweens.add({
          targets: marker,
          x: toX,
          duration: 400,
          ease: "Sine.easeInOut",
          onComplete: () => {
            marker.destroy();
            resolve();
          },
        });
      });
    }
    case "intentRevealed": {
      const anchor = anchorOf(event.enemyId);
      if (!anchor) return instant();
      return floatText(scene, anchor.x, anchor.y - 110, "Ý định mới", "#cfd6f0", 12, 150);
    }
    case "intentExecuted": {
      const anchor = anchorOf(event.enemyId);
      const view = ctx.unitViews.get(event.enemyId);
      if (!anchor || !view) return instant();
      const target = event.targetId ? anchorOf(event.targetId) : undefined;
      const dx = target ? (target.x - anchor.x) * 0.18 : 0;
      const dy = target ? (target.y - anchor.y) * 0.18 : 0;
      return new Promise((resolve) => {
        scene.tweens.add({
          targets: view,
          x: anchor.x + dx,
          y: anchor.y + dy,
          duration: 125,
          yoyo: true,
          onComplete: () => resolve(),
        });
      });
    }
    case "intentSkipped": {
      const anchor = anchorOf(event.enemyId);
      if (!anchor) return instant();
      return floatText(scene, anchor.x, anchor.y - 80, "Đóng Băng — bỏ qua", "#9fd4ff", 13, 300);
    }
    case "intentFizzled": {
      const anchor = anchorOf(event.enemyId);
      if (!anchor) return instant();
      return floatText(scene, anchor.x, anchor.y - 80, "Hụt", "#8b93b8", 13, 250);
    }
    case "heroLeveledUp": {
      const anchor = anchorOf(event.heroId);
      const jobs: Promise<void>[] = [
        floatText(scene, WIDTH / 2, 300, `★ ${event.name} ★`, "#f4d35e", 26, 900),
      ];
      if (anchor) jobs.push(flash(scene, anchor.x, anchor.y, 240, 170, 0xf4d35e, 500));
      return Promise.all(jobs).then(() => undefined);
    }
    case "unitDied": {
      const anchor = anchorOf(event.unitId);
      if (!anchor) return instant();
      return new Promise((resolve) => {
        const rect = scene.add.rectangle(anchor.x, anchor.y, 220, 150, 0x333344, 0).setDepth(95);
        scene.tweens.add({
          targets: rect,
          alpha: 0.6,
          duration: 400,
          onComplete: () => {
            rect.destroy();
            resolve();
          },
        });
      });
    }
    case "combatEnded":
      return instant();
    default:
      return instant();
  }
}
