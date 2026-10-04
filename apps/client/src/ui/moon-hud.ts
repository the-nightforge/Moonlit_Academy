import type Phaser from "phaser";
import { currentDecree } from "rules";
import type { CombatState, GameData } from "rules";
import { describePhase, TEXT_BASE } from "./theme";
import type { CombatLayout } from "./combat-layout";
import { ensureTextures, GLOW } from "./vfx";

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
 * While Huyết Nguyệt burns: a slow-breathing crimson corona behind the moon
 * plus a round-count badge in the game's own badge idiom (dark disc, crimson
 * ring) — the countdown detail itself lives in the moon's tooltip.
 */
export function renderMoonHud(
  scene: Phaser.Scene,
  model: MoonHudModel,
  layout: CombatLayout,
  /** The icon's actual position — the art socket when a background supplies one. */
  moonAt: { x: number; y: number; size?: number } = layout.moon,
  /** Optional looping-pulse hook (e.g. the scene's `loopTween`) for the corona. */
  pulse?: (target: Phaser.GameObjects.GameObject, config: Omit<Phaser.Types.Tweens.TweenBuilderConfig, "targets">) => void,
): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0);
  if (model.bloodRounds <= 0) return container;
  ensureTextures(scene);
  const size = moonAt.size ?? 46;

  // Corona — sits in this container, so the moon icon (added after) renders on top.
  const corona = scene.add
    .image(moonAt.x, moonAt.y, GLOW)
    .setTint(0xc01830)
    .setBlendMode("ADD")
    .setScale(((size * 1.9) / 128) * 0.9)
    .setAlpha(0.28)
    .setName("moon_blood_corona");
  container.add(corona);
  pulse?.(corona, { alpha: 0.5, scale: (size * 1.9) / 128, duration: 1700 });

  // Countdown badge — bottom-right edge of the moon, dark disc + crimson ring.
  const bx = moonAt.x + size * 0.58;
  const by = moonAt.y + size * 0.5;
  const disc = scene.add.circle(bx, by, 11, 0x14060c, 0.95).setStrokeStyle(2, 0xd03a4a).setName("moon_blood");
  const numeral = scene.add
    .text(bx, by, `${model.bloodRounds}`, { ...TEXT_BASE, fontSize: "12px", color: "#ff6a6a" })
    .setOrigin(0.5);
  container.add(disc);
  container.add(numeral);

  return container;
}
