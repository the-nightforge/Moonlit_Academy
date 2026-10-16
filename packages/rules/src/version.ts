/**
 * Versioned engine fingerprint — hashed into experiment manifests and replay
 * captures so records from different rule versions never compare silently.
 * Bump when a rules change must invalidate stored experiment/replay sets.
 */
export const ENGINE_FINGERPRINT = "vong-nguyet-rules-2026-10-16-review-v1";
