import { dataVersion } from "data";
import type { GameData } from "rules";

const TOKEN_KEY = "vong-nguyet.token";
const USERNAME_KEY = "vong-nguyet.username";

/**
 * API origin prefix (`16` §7.6): empty in production builds (same origin behind
 * Caddy); set `VITE_API_BASE=https://host` to point a build at another server.
 */
export const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/+$/, "");

/** A failed API call: HTTP status (0 = no connection), error code from the server, full body. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly payload: Record<string, unknown> = {},
  ) {
    super(code);
  }
}

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readToken(): string | null {
  return readStored(TOKEN_KEY);
}

export const auth = {
  token: readToken(),
  /** Last signed-in username (display only — the token proves identity). */
  username: readStored(USERNAME_KEY),
  /** Invalidates requests at authentication boundaries, before a new token arrives. */
  generation: 0,
  /** Called on a current-session 401; the app goes back to the login screen. */
  onUnauthorized: (): void => {},
};

export function setToken(token: string | null): void {
  auth.token = token;
  try {
    if (token === null) localStorage.removeItem(TOKEN_KEY);
    else localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Without storage the session lasts until the page is closed.
  }
}

export function setUsername(username: string | null): void {
  auth.username = username;
  try {
    if (username === null) localStorage.removeItem(USERNAME_KEY);
    else localStorage.setItem(USERNAME_KEY, username);
  } catch {
    // Without storage the session lasts until the page is closed.
  }
}

let version = "";

/** True when the API server answers (used before showing the sign-in form). */
export async function serverReachable(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/health`);
    if (!response.ok) return false;
    const body = (await response.json()) as { ok?: boolean };
    return body.ok === true;
  } catch {
    return false;
  }
}

/** Must run once before any request: every call carries the data version (`16` §2). */
export function initApi(data: GameData): void {
  version = dataVersion(data);
}

/** Calls `/api<path>`; `rev` becomes `If-Match` for requests that change the profile. */
export async function api<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  options: { body?: unknown; rev?: number } = {},
): Promise<T> {
  const requestToken = auth.token;
  const requestGeneration = auth.generation;
  const headers: Record<string, string> = { "x-data-version": version };
  if (auth.token) headers.authorization = `Bearer ${auth.token}`;
  if (options.rev !== undefined) headers["if-match"] = String(options.rev);
  if (options.body !== undefined) headers["content-type"] = "application/json";
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api${path}`, {
      method,
      headers,
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });
  } catch {
    throw new ApiError(0, "network");
  }
  const text = await response.text();
  let body: Record<string, unknown> = {};
  try {
    body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    // Not our server (e.g. the dev proxy answering while the server is down).
    throw new ApiError(0, "network");
  }
  // A gateway error without our error body means the server itself is unreachable.
  if (response.status >= 502 && typeof body.error !== "string") throw new ApiError(0, "network");
  if (!response.ok) {
    if (response.status === 401 && path !== "/auth/login" && requestGeneration === auth.generation && requestToken === auth.token) auth.onUnauthorized();
    throw new ApiError(response.status, typeof body.error === "string" ? body.error : "unknown", body);
  }
  return body as T;
}
