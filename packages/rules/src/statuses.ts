import type { StatusId, UnitState } from "./types/index";

export function hasStatus(unit: UnitState, status: StatusId): boolean {
  return unit.statuses.some((entry) => entry.id === status);
}
