import { auth } from "./api";

/**
 * A response that outlived its scene or account (`home-ui-redesign` Task 2).
 * Thrown between the wire answer and any local commit; callers swallow it —
 * stale callbacks must stay silent (no alert, no scene change, no writes).
 */
export class StaleRequestError extends Error {
  constructor() {
    super("stale request");
    this.name = "StaleRequestError";
  }
}

/** Scene-side liveness check; the scene returns one bound to its own generation. */
export interface RequestGuard {
  isCurrent(): boolean;
}

/** Throws when the account changed mid-request or the caller's scene is gone. */
export function assertCurrentRequest(expectedAuthGeneration: number, guard?: RequestGuard): void {
  if (auth.generation !== expectedAuthGeneration || (guard !== undefined && !guard.isCurrent())) {
    throw new StaleRequestError();
  }
}
