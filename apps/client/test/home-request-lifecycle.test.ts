import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { starterDeck } from "rules";
import type { RunSetup } from "rules";

vi.mock("../src/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/api")>();
  return { ...actual, api: vi.fn() };
});

// `account` pulls in ui/theme, which reads `window` at module level — the
// request lifecycle never renders, so labels are stubbed.
vi.mock("../src/ui/theme", () => ({
  API_ERROR_TEXT: {},
  CURRENCY_LABELS: { moonJade: "", moonStar: "", honor: "", moonDust: "", darkIron: "" },
}));

import { api, auth } from "../src/api";
import { assertCurrentRequest, StaleRequestError, type RequestGuard } from "../src/request-context";
import { session, type Team } from "../src/session";
import { startServerRun } from "../src/run-session";
import { startStoryTicket } from "../src/story-session";

const apiMock = vi.mocked(api);
const TEAM: Team = ["m05", "f04", "m06"];
const DECK = { id: "d1", heroIds: TEAM };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const RUN_SETUP: RunSetup = { heroIds: TEAM, seed: 7, deckCardIds: starterDeck(session.data, TEAM) };
const STORY_SETUP = { stageId: "arc1_s01", seed: 7, heroIds: TEAM, deckCardIds: starterDeck(session.data, TEAM) };
const LOADOUT = { heroes: Object.fromEntries(TEAM.map((id) => [id, { constellation: 0, levelUpForm: "base" as const }])) };

let storage: Map<string, string>;
const savedFields = ["ticket", "story", "run", "heroIds", "seed", "deckCardIds", "runSubmitted", "online"] as const;
let snapshot: Record<string, unknown>;
let generation: number;

beforeEach(() => {
  storage = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
    removeItem: (key: string) => void storage.delete(key),
  });
  snapshot = Object.fromEntries(savedFields.map((field) => [field, session[field]]));
  generation = auth.generation;
  session.online = true;
  auth.token = "test-token";
  apiMock.mockReset();
});

afterEach(() => {
  for (const field of savedFields) (session as unknown as Record<string, unknown>)[field] = snapshot[field];
  auth.generation = generation;
  auth.token = null;
  vi.unstubAllGlobals();
});

describe("assertCurrentRequest", () => {
  it("passes for the same generation and a live guard", () => {
    expect(() => assertCurrentRequest(auth.generation, { isCurrent: () => true })).not.toThrow();
  });

  it("throws StaleRequestError on generation change or a dead guard", () => {
    expect(() => assertCurrentRequest(auth.generation + 1)).toThrow(StaleRequestError);
    expect(() => assertCurrentRequest(auth.generation, { isCurrent: () => false })).toThrow(StaleRequestError);
  });
});

describe("late ticket response cannot commit", () => {
  it("run: rejects and writes nothing when the account changed mid-request", async () => {
    const pending = deferred<{ runId: string; setup: RunSetup; loadout: typeof LOADOUT }>();
    apiMock.mockReturnValue(pending.promise);
    const request = startServerRun(DECK);
    auth.generation++;
    pending.resolve({ runId: "r1", setup: RUN_SETUP, loadout: LOADOUT });
    await expect(request).rejects.toBeInstanceOf(StaleRequestError);
    expect(session.ticket).toBeNull();
    expect(session.run).toBeNull();
    expect(storage.has("vong-nguyet.run")).toBe(false);
  });

  it("run: rejects when the scene guard died even on the same account", async () => {
    const pending = deferred<{ runId: string; setup: RunSetup; loadout: typeof LOADOUT }>();
    apiMock.mockReturnValue(pending.promise);
    const guard: RequestGuard = { isCurrent: () => false };
    const request = startServerRun(DECK, { guard });
    pending.resolve({ runId: "r1", setup: RUN_SETUP, loadout: LOADOUT });
    await expect(request).rejects.toBeInstanceOf(StaleRequestError);
    expect(session.ticket).toBeNull();
    expect(storage.has("vong-nguyet.run")).toBe(false);
  });

  it("run: a current response still commits the ticket", async () => {
    apiMock.mockResolvedValue({ runId: "r1", setup: RUN_SETUP, loadout: LOADOUT });
    const guard: RequestGuard = { isCurrent: () => true };
    await startServerRun(DECK, { guard });
    expect(session.ticket?.runId).toBe("r1");
    expect(session.run).not.toBeNull();
    expect(storage.has("vong-nguyet.run")).toBe(true);
  });

  it("story: rejects and writes nothing when the account changed mid-request", async () => {
    const pending = deferred<{ ticketId: string; setup: typeof STORY_SETUP; loadout: typeof LOADOUT }>();
    apiMock.mockReturnValue(pending.promise);
    const request = startStoryTicket("arc1_s01", DECK);
    auth.generation++;
    pending.resolve({ ticketId: "t1", setup: STORY_SETUP, loadout: LOADOUT });
    await expect(request).rejects.toBeInstanceOf(StaleRequestError);
    expect(session.story).toBeNull();
    expect(storage.size).toBe(0);
  });

  it("story: rejects on a dead guard", async () => {
    const pending = deferred<{ ticketId: string; setup: typeof STORY_SETUP; loadout: typeof LOADOUT }>();
    apiMock.mockReturnValue(pending.promise);
    const request = startStoryTicket("arc1_s01", DECK, { guard: { isCurrent: () => false } });
    pending.resolve({ ticketId: "t1", setup: STORY_SETUP, loadout: LOADOUT });
    await expect(request).rejects.toBeInstanceOf(StaleRequestError);
    expect(session.story).toBeNull();
  });

  it("story: a current response still commits the ticket", async () => {
    apiMock.mockResolvedValue({ ticketId: "t1", setup: STORY_SETUP, loadout: LOADOUT });
    await startStoryTicket("arc1_s01", DECK, { guard: { isCurrent: () => true } });
    expect(session.story?.ticketId).toBe("t1");
    expect(session.story?.setup.stageId).toBe("arc1_s01");
  });
});
