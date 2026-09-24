import type { CombatEvent, StatusId, StatusInstance, UnitState } from "./types/index";

export const DEBUFF_STATUSES: ReadonlySet<StatusId> = new Set([
  "weak",
  "vulnerable",
  "burn",
  "freeze",
  "mark",
]);

export function hasStatus(unit: UnitState, status: StatusId): boolean {
  return unit.statuses.some((entry) => entry.id === status);
}

export function getStatus(unit: UnitState, status: StatusId): StatusInstance | undefined {
  return unit.statuses.find((entry) => entry.id === status);
}

export function statusValue(unit: UnitState, status: StatusId): number {
  return getStatus(unit, status)?.value ?? 0;
}

export function applyStatus(
  unit: UnitState,
  status: StatusId,
  amount: number,
  sourceId: string,
  events: CombatEvent[],
): void {
  const existing = getStatus(unit, status);
  if (existing) {
    if (status === "freeze") return;
    existing.value += amount;
    if (status === "mark") existing.sourceId = sourceId;
    events.push({ type: "statusApplied", targetId: unit.id, status, value: existing.value });
    return;
  }
  const value = status === "freeze" ? 1 : amount;
  const instance: StatusInstance =
    status === "mark" ? { id: status, value, sourceId } : { id: status, value };
  unit.statuses.push(instance);
  events.push({ type: "statusApplied", targetId: unit.id, status, value });
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

export function cleanseDebuffs(unit: UnitState, events: CombatEvent[]): void {
  for (const entry of [...unit.statuses]) {
    if (DEBUFF_STATUSES.has(entry.id)) removeStatus(unit, entry.id, events);
  }
}
