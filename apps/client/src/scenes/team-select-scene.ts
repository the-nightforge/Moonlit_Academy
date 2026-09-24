import Phaser from "phaser";
import { bondCardsForTeam } from "rules";
import { restartSession, session } from "../session";
import type { Team } from "../session";
import { COLORS, FACTION_LABELS, OWNER_COLORS, TEXT_BASE, useDesignCamera } from "../ui/theme";

const WIDTH = 1280;
const HERO_W = 220;
const HERO_H = 250;

export class TeamSelectScene extends Phaser.Scene {
  private picked: string[] = [];
  private encounterId = "";
  private root!: Phaser.GameObjects.Container;

  constructor() {
    super("team-select");
  }

  create() {
    this.picked = [...session.heroIds];
    this.encounterId = session.encounterId;
    useDesignCamera(this);
    this.root = this.add.container(0, 0);
    this.render();
  }

  private text(x: number, y: number, content: string, size = 14, color: string = COLORS.text) {
    const t = this.add.text(x, y, content, { ...TEXT_BASE, fontSize: `${size}px`, color });
    this.root.add(t);
    return t;
  }

  private button(x: number, y: number, w: number, label: string, active: boolean, onClick: () => void) {
    const btn = this.add.rectangle(x, y, w, 34, active ? 0x3a5090 : COLORS.button);
    btn.setStrokeStyle(1, active ? COLORS.goldFill : COLORS.panelBorder);
    btn.setInteractive({ useHandCursor: true });
    btn.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 0) onClick();
    });
    this.root.add(btn);
    this.text(x, y, label, 13, active ? COLORS.gold : COLORS.text).setOrigin(0.5);
  }

  private toggleHero(heroId: string) {
    if (this.picked.includes(heroId)) {
      this.picked = this.picked.filter((id) => id !== heroId);
    } else if (this.picked.length < 3) {
      this.picked.push(heroId);
    }
    this.render();
  }

  private render() {
    this.root.removeAll(true);
    const data = session.data;
    this.text(WIDTH / 2, 30, "Chọn đội", 26, COLORS.gold).setOrigin(0.5);
    this.text(WIDTH / 2, 62, "Chọn 3 Hero — thứ tự chọn là vị trí trong đội", 13, COLORS.dimText).setOrigin(0.5);

    const heroes = Object.values(data.heroes);
    const spacing = HERO_W + 20;
    const startX = WIDTH / 2 - ((heroes.length - 1) * spacing) / 2;
    heroes.forEach((hero, index) => {
      const x = startX + index * spacing;
      const y = 230;
      const slot = this.picked.indexOf(hero.id);
      const panel = this.add.rectangle(x, y, HERO_W, HERO_H, COLORS.panelHero);
      panel.setStrokeStyle(slot >= 0 ? 3 : 1, slot >= 0 ? COLORS.goldFill : (OWNER_COLORS[hero.id] ?? COLORS.panelBorder));
      panel.setInteractive({ useHandCursor: true });
      panel.on("pointerup", (pointer: Phaser.Input.Pointer) => {
        if (pointer.button === 0) this.toggleHero(hero.id);
      });
      this.root.add(panel);
      if (slot >= 0) this.text(x + HERO_W / 2 - 14, y - HERO_H / 2 + 14, `${slot + 1}`, 16, COLORS.gold).setOrigin(0.5);
      this.text(x, y - 98, hero.name, 18).setOrigin(0.5);
      this.text(x, y - 72, FACTION_LABELS[hero.faction], 12, COLORS.dimText).setOrigin(0.5);
      this.text(x, y - 50, `HP ${hero.maxHp}`, 13).setOrigin(0.5);
      this.text(x, y - 22, `Thăng cấp: ${hero.levelUp.name}`, 13, COLORS.gold).setOrigin(0.5);
      this.root.add(
        this.add
          .text(x, y - 4, hero.levelUp.description, {
            ...TEXT_BASE,
            fontSize: "11px",
            color: COLORS.dimText,
            align: "center",
            wordWrap: { width: HERO_W - 24 },
          })
          .setOrigin(0.5, 0),
      );
    });

    const bonds = bondCardsForTeam(data, this.picked);
    this.text(WIDTH / 2, 390, "Lá Song Hành thêm vào deck:", 14, COLORS.dimText).setOrigin(0.5);
    const bondLine =
      bonds.length === 0
        ? "— không có —"
        : bonds
            .map((card) => `${card.name} (${card.bond!.owners.map((id) => data.heroes[id]!.name).join(" + ")})`)
            .join("   ·   ");
    this.text(WIDTH / 2, 416, bondLine, 15, bonds.length > 0 ? COLORS.gold : COLORS.dimText).setOrigin(0.5);

    this.text(WIDTH / 2, 470, "Trận:", 14, COLORS.dimText).setOrigin(0.5);
    const encounters = Object.values(data.encounters);
    const encSpacing = 230;
    const encStart = WIDTH / 2 - ((encounters.length - 1) * encSpacing) / 2;
    encounters.forEach((encounter, index) => {
      this.button(encStart + index * encSpacing, 506, 210, encounter.name, encounter.id === this.encounterId, () => {
        this.encounterId = encounter.id;
        this.render();
      });
    });

    const ready = this.picked.length === 3;
    this.button(WIDTH / 2, 600, 220, ready ? "BẮT ĐẦU" : `Chọn thêm ${3 - this.picked.length} Hero`, ready, () => {
      if (!ready) return;
      restartSession(session.seed, this.encounterId, [...this.picked] as Team);
      this.scene.start("combat");
    });
  }
}
