import type { CardDef } from "rules";
import { matchesDeckText } from "./deck-presentation";
export interface BuilderFilters { query: string; cost: number | null; unlockedOnly: boolean; selectedOnly: boolean }
export function matchesBuilderCard(card: CardDef, filters: BuilderFilters, unlocked: boolean, selected: boolean): boolean {
  return matchesDeckText(filters.query, card.name, card.text)
    && (filters.cost === null || (filters.cost === 8 ? card.cost >= 8 : card.cost === filters.cost))
    && (!filters.unlockedOnly || unlocked) && (!filters.selectedOnly || selected);
}
