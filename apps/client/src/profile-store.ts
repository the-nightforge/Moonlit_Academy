import { createProfile, parseProfile } from "rules";
import type { GameData, Profile } from "rules";

const KEY = "vong-nguyet.profile";

/** Set when localStorage is unavailable; scenes show a warning. */
export const storage = { failed: false };

export function loadProfile(data: GameData): Profile {
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    storage.failed = true;
    return createProfile(data);
  }
  if (raw === null) return createProfile(data);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = undefined;
  }
  const result = parseProfile(data, parsed);
  if (result.reset) {
    try {
      localStorage.setItem(`${KEY}.bak`, raw);
    } catch {
      storage.failed = true;
    }
  }
  return result.profile;
}

export function saveProfile(profile: Profile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
    storage.failed = false;
  } catch {
    storage.failed = true;
  }
}
