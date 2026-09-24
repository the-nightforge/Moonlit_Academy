import type { CombatEvent, StatusId, StatusInstance, UnitState } from "./types/index";

export function hasStatus(unit: UnitState, status: StatusId): boolean {
  return unit.statuses.some((entry) => entry.id === status);
}

export function getStatus(unit: UnitState, status: StatusId): StatusInstance | undefined {
  return unit.statuses.find((entry) => entry.id === status);
}

export function statusValue(unit: UnitState, status: StatusId): number {
  return getStatus(unit, status)?.value ?? 0;
}

export function removeStatus(
  unit: UnitState,
  status: StatusId,
  events: CombatEvent[],
): boolean {
  const index = unit.statuses.findIndex((entry) => entry.id === status);
  if (index < 0) return false;
  unit.statuses.splice(index, 1);
  events.push({ type: "statusRemoved", targetId: unit.id, status });
  return true;
}
