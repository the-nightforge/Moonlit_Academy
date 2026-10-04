import type Phaser from "phaser";
import { currentDecree } from "rules";
import type { CombatState, GameData } from "rules";
import { describePhase, TEXT_BASE } from "./theme";
import type { CombatLayout } from "./combat-layout";

/**
 * Current and next phase details from the already rolled schedule.
 */
export interface MoonHudModel {
  current: number;
  phase: MoonPhaseHud;
  next: MoonPhaseHud;
  bloodRounds: number;
}

interface MoonPhaseHud {
  index: number;
  name: string;
  decreeName: string;
  description: string;
}

export function moonHudModel(data: GameData, state: CombatState): MoonHudModel {
  const details = (index: number): MoonPhaseHud => {
    const phase = data.moonPhases[index]!;
    return { index, name: phase.name, decreeName: currentDecree(data, state, index)?.name ?? "—", description: describePhase(data, state, index) };
  };
  return {
    current: state.moonIndex,
    phase: details(state.moonIndex),
    next: details((state.moonIndex + 1) % data.moonPhases.length),
    bloodRounds: state.bloodMoonRounds,
  };
}

/**
 * Only the blood countdown supplements the main current-moon icon.
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

  return container;
}
