import type { Profile } from "rules";
import { ApiError, api, auth, setToken } from "./api";
import { MatchRegistry } from "./net/match-registry";
import type { MatchSettlement } from "./net/protocol";
import { session } from "./session";
import { API_ERROR_TEXT, CURRENCY_LABELS } from "./ui/theme";

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

/**
 * A match that finished off the combat screen (`16` §8.4): refresh the profile
 * when the settlement carried a newer `profileRev`, then announce the result.
 */
async function settleMatch(matchId: string, settlement: MatchSettlement): Promise<void> {
  void matchId;
  if (settlement.profileRev !== undefined && settlement.profileRev > session.rev) {
    await resumeSession();
  }
  const result = settlement.result === "won" ? "Thắng" : settlement.result === "lost" ? "Thua" : "Hòa";
  const parts: string[] = [];
  if (settlement.rewards?.honor) parts.push(`+${settlement.rewards.honor} ${CURRENCY_LABELS.honor}`);
  if (settlement.rewards?.moonJade) parts.push(`+${settlement.rewards.moonJade} ${CURRENCY_LABELS.moonJade}`);
  if (settlement.rewards?.moonDust) parts.push(`+${settlement.rewards.moonDust} Nguyệt Trần`);
  if (settlement.rewards?.firstWin) parts.push("Thắng đầu ngày");
  if (settlement.rating) parts.push(`Elo ${settlement.rating.before} → ${settlement.rating.after}`);
  session.notices.push(`Trận trước: ${result}${parts.length ? ` — ${parts.join(", ")}` : ""}`);
}

/**
 * The account-lifetime registry (`16` §8.4): retained matches keep receiving
 * frames while no combat scene is bound. Created with the account session.
 */
export function matchRegistry(): MatchRegistry {
  return (session.registry ??= new MatchRegistry(settleMatch, (text) => session.notices.push(text)));
}

export async function login(username: string, password: string, register: boolean): Promise<void> {
  const reply = await api<ProfileReply & { token: string }>("POST", register ? "/auth/register" : "/auth/login", {
    body: { username, password },
  });
  setToken(reply.token);
  applyServerProfile(reply);
  session.online = true;
  matchRegistry();
  // New accounts receive the starter gift with registration (`14` §5).
  if (register) {
    const gift = session.data.economyConfig.starterGift.moonJade;
    session.notices.push(`Quà tân thủ: +${gift} ${CURRENCY_LABELS.moonJade} — thử vận may ở Triệu Hồi!`);
  }
}

/** Notice lines for achievements the server just granted. */
export function achievementNotices(ids: readonly string[] | undefined): string[] {
  return (ids ?? []).map((id) => {
    const achievement = session.data.achievements[id];
    return achievement ? `Thành tựu: ${achievement.name} (+${achievement.reward.moonJade} ${CURRENCY_LABELS.moonJade})` : id;
  });
}

/** Uses a saved token; false when there is none or it was refused. */
export async function resumeSession(): Promise<boolean> {
  if (!auth.token) return false;
  applyServerProfile(await api<ProfileReply>("GET", "/profile"));
  session.online = true;
  matchRegistry();
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
  session.registry?.dispose();
  session.registry = null;
  session.match = null;
}

/** Vietnamese text for an error from the API (or anything else). */
export function errorText(error: unknown): string {
  if (error instanceof ApiError) return API_ERROR_TEXT[error.code] ?? `Lỗi server (${error.code})`;
  return "Có lỗi không xác định";
}
