import { nextRandom } from "./rng";
import { hasStatus } from "./statuses";
import type { CombatEvent, CombatState, GameData, HeroState, Targeting } from "./types/index";

function pickTarget(state: CombatState, candidates: HeroState[], targeting: Targeting): string {
  switch (targeting) {
    case "random": {
      const roll = nextRandom(state.rngState);
      state.rngState = roll.rngState;
      return candidates[Math.floor(roll.value * candidates.length)]!.id;
    }
    case "lowestHp": {
      let best = candidates[0]!;
      for (const hero of candidates) {
        if (hero.hp < best.hp) best = hero;
      }
      return best.id;
    }
    case "highestHp": {
      let best = candidates[0]!;
      for (const hero of candidates) {
        if (hero.hp > best.hp) best = hero;
      }
      return best.id;
    }
    case "front":
      return candidates[0]!.id;
  }
}

export function chooseHeroTarget(state: CombatState, targeting: Targeting): string | null {
  const candidates = state.heroes.filter((hero) => hero.alive && !hasStatus(hero, "stealth"));
  if (candidates.length === 0) return null;
  return pickTarget(state, candidates, targeting);
}

export function announceIntents(data: GameData, state: CombatState, events: CombatEvent[]): void {
  const phaseId = data.moonPhases[state.moonIndex]!.id;
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    const def = data.enemies[enemy.defId]!;
    const override = def.moonOverrides?.find((entry) => entry.phase === phaseId);
    const intent =
      override?.intent ?? def.intentPattern[enemy.patternIndex % def.intentPattern.length]!;
    enemy.patternIndex += 1;
    const targetId = intent.targeting !== undefined ? chooseHeroTarget(state, intent.targeting) : null;
    enemy.currentIntent = { intent, targetId };
    events.push({ type: "intentRevealed", enemyId: enemy.id, intentId: intent.id, targetId });
  }
}
