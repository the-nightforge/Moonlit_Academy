import type Phaser from "phaser";
import { currentDecree } from "rules";
import type { CombatState, GameData } from "rules";
import { COLORS, describePhase, TEXT_BASE } from "./theme";
import type { CombatLayout } from "./combat-layout";

/**
 * What the moon header shows (`05`): the current phase, all eight schedule
 * slots with their rolled decree, and the blood-moon countdown — a pure model
 * so tests read it without a scene.
 */
export interface MoonHudModel {
  current: number;
  phases: { index: number; name: string; icon: string; decreeName: string; description: string }[];
  bloodRounds: number;
}

export function moonHudModel(data: GameData, state: CombatState): MoonHudModel {
  return {
    current: state.moonIndex,
    phases: data.moonPhases.map((phase) => {
      const decree = currentDecree(data, state, phase.index);
      return {
        index: phase.index,
        name: phase.name,
        icon: phase.icon,
        decreeName: decree?.name ?? "—",
        description: describePhase(data, state, phase.index),
      };
    }),
    bloodRounds: state.bloodMoonRounds,
  };
}

/**
 * The schedule strip: eight phase icons either side of the current moon, a
 * current-phase marker, a standalone blood badge, and the decree label strip.
 * Icon objects are named `moon_phase_<i>` so the scene can attach tooltips.
 */
export function renderMoonHud(
  scene: Phaser.Scene,
  model: MoonHudModel,
  layout: CombatLayout,
  /** The icon's actual position — the art socket when a background supplies one. */
  moonAt: { x: number; y: number } = layout.moon,
): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0);
  const blood = model.bloodRounds > 0;

  for (const [i, slot] of layout.phaseSlots.entries()) {
    const phase = model.phases[i];
    if (!phase) continue;
    const isCurrent = phase.index === model.current;
    if (isCurrent) {
      const ring = scene.add
        .circle(slot.x, slot.y, 17, 0x000000, 0)
        .setStrokeStyle(2, 0xf4d35e)
        .setName("moon_current_ring");
      container.add(ring);
    }
    const icon = scene.add
      .text(slot.x, slot.y, phase.icon, {
        ...TEXT_BASE,
        fontSize: isCurrent ? "18px" : "15px",
        color: isCurrent ? COLORS.gold : "#aab4d8",
      })
      .setOrigin(0.5)
      .setName(`moon_phase_${phase.index}`)
      .setInteractive();
    container.add(icon);
  }

  if (blood) {
    const badge = scene.add
      .text(moonAt.x + 30, moonAt.y - 14, `🔴${model.bloodRounds}`, {
        ...TEXT_BASE,
        fontSize: "12px",
        color: "#ff5a5a",
      })
      .setOrigin(0, 0.5)
      .setName("moon_blood");
    container.add(badge);
  }

  const current = model.phases.find((p) => p.index === model.current);
  if (current) {
    const label = scene.add
      .text(
        layout.phaseLabel.x + layout.phaseLabel.w / 2,
        layout.phaseLabel.y + layout.phaseLabel.h / 2,
        `${current.name} — ${current.decreeName}`,
        { ...TEXT_BASE, fontSize: "12px", color: COLORS.gold, wordWrap: { width: layout.phaseLabel.w } },
      )
      .setOrigin(0.5)
      .setName("moon_label");
    container.add(label);
  }

  return container;
}
