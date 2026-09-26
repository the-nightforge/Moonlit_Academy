/**
 * Phase 4b kept the profile in localStorage. Since 4c the profile lives on the
 * server; this only reads the old copy once so it can be imported (`14` §2.4).
 */
const LEGACY_KEY = "vong-nguyet.profile";

/** The old saved profile JSON, or null when there is none (or storage is blocked). */
export function readLegacyProfile(): unknown {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    return raw === null ? null : (JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

/** Keeps the old copy under another key so the import is not offered again. */
export function retireLegacyProfile(): void {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (raw !== null) localStorage.setItem(`${LEGACY_KEY}.imported`, raw);
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // Nothing to clean up.
  }
}
