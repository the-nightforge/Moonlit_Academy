import type { ActionResult } from "rules";

/** Fixture setup must succeed before tests inspect state or animation events. */
export function requireSuccess(result: ActionResult): Extract<ActionResult, { ok: true }> {
  if (!result.ok) throw new Error(`test setup action failed: ${result.error}`);
  return result;
}
