import type { Profile } from "rules";
import { ApiError, api, auth, setToken } from "./api";
import { session } from "./session";
import { API_ERROR_TEXT } from "./ui/theme";

export interface ProfileReply {
  profile: Profile;
  rev: number;
}

/** Replaces the local copy of the profile with the server's (`16` §2). */
export function applyServerProfile(reply: ProfileReply): void {
  session.profile = reply.profile;
  session.rev = reply.rev;
}

/**
 * A request that changes the profile. On `409 stale profile` the local copy is
 * refreshed from the error body before the error is passed on.
 */
export async function mutate<T extends ProfileReply>(
  method: "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  try {
    const reply = await api<T>(method, path, { body, rev: session.rev });
    applyServerProfile(reply);
    return reply;
  } catch (error) {
    if (error instanceof ApiError && error.code === "stale profile") {
      applyServerProfile(error.payload as unknown as ProfileReply);
    }
    throw error;
  }
}

export async function login(username: string, password: string, register: boolean): Promise<void> {
  const reply = await api<ProfileReply & { token: string }>("POST", register ? "/auth/register" : "/auth/login", {
    body: { username, password },
  });
  setToken(reply.token);
  applyServerProfile(reply);
  session.online = true;
}

/** Uses a saved token; false when there is none or it was refused. */
export async function resumeSession(): Promise<boolean> {
  if (!auth.token) return false;
  applyServerProfile(await api<ProfileReply>("GET", "/profile"));
  session.online = true;
  return true;
}

export async function logout(): Promise<void> {
  try {
    await api("POST", "/auth/logout");
  } catch {
    // Already signed out on the server.
  }
  setToken(null);
  session.online = false;
}

/** Vietnamese text for an error from the API (or anything else). */
export function errorText(error: unknown): string {
  if (error instanceof ApiError) return API_ERROR_TEXT[error.code] ?? `Lỗi server (${error.code})`;
  return "Có lỗi không xác định";
}
