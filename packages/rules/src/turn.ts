import { drawCards } from "./draw";
import type { CombatEvent, CombatState, GameData } from "./types/index";

export function startPlayerTurn(data: GameData, state: CombatState, events: CombatEvent[]): void {
  events.push({ type: "turnStarted", side: "hero", round: state.round });
  for (const hero of state.heroes) hero.armor = 0;
  state.moonPower = 3;
  drawCards(state, 5, events);
}
