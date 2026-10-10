import { describe, expect, it } from "vitest";
import type { SavedDeck } from "rules";

// A missing implementation is an observable failure while defining the save contract.
const module = await import("../src/ui/deck-builder-save").catch(() => ({ DeckDraftSave: undefined }));

function draft(): SavedDeck {
  return { id: "", name: "Bản sao", heroIds: ["m05", "f04", "m06"], cardIds: ["m05_01"] };
}
function pending() {
  let resolve!: (value: { deckId: string }) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<{ deckId: string }>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
function setup(valid = false) {
  const deck = draft();
  const request = pending();
  let selected = "active-deck", destination = "editor", writes = 0, current = true, online = true;
  const Save = module.DeckDraftSave;
  expect(Save, "draft save controller must implement the editor save contract").toBeTypeOf("function");
  const save = new Save!({
    deck: () => deck, online: () => online, valid: () => valid, current: () => current,
    request: async (body: SavedDeck) => { writes++; expect(body).not.toBe(deck); return request.promise; },
    activate: (id: string) => { selected = id; destination = "home"; },
    changed: () => {}, error: (error: unknown) => String(error),
  });
  return { deck, save, request, selected: () => selected, destination: () => destination, writes: () => writes,
    invalidate: () => { current = false; }, offline: () => { online = false; } };
}

describe("deck editor save", () => {
  it("saves an invalid draft in place, stores returned id and clears dirty without changing active deck", async () => {
    const ctx = setup();
    ctx.deck.name = "Draft";
    expect(ctx.save.dirty).toBe(true);
    const result = ctx.save.save();
    ctx.request.resolve({ deckId: "saved-draft" });
    await result;
    expect(ctx.deck.id).toBe("saved-draft");
    expect(ctx.save.dirty).toBe(false);
    expect(ctx.selected()).toBe("active-deck");
    expect(ctx.destination()).toBe("editor");
    expect(ctx.save.notice).toContain("bản nháp");
  });
  it("uses the returned id for a valid copy and prevents repeated submission while busy", async () => {
    const ctx = setup(true);
    const result = ctx.save.save();
    expect(ctx.save.busy).toBe(true);
    await ctx.save.save();
    expect(ctx.writes()).toBe(1);
    ctx.request.resolve({ deckId: "new-copy" });
    await result;
    expect(ctx.selected()).toBe("new-copy");
    expect(ctx.destination()).toBe("home");
  });
  it("preserves unsaved edits and releases busy after failure", async () => {
    const ctx = setup();
    ctx.deck.name = "Keep me";
    const result = ctx.save.save();
    ctx.request.reject(new Error("network"));
    await result;
    expect(ctx.deck.name).toBe("Keep me");
    expect(ctx.deck.id).toBe("");
    expect(ctx.save.dirty).toBe(true);
    expect(ctx.save.busy).toBe(false);
    expect(ctx.save.notice).toContain("network");
  });
  it("does not save offline or with an empty/oversized name and gives a reason", async () => {
    const ctx = setup();
    ctx.offline();
    await ctx.save.save();
    expect(ctx.writes()).toBe(0);
    expect(ctx.save.disabledReason).toContain("kết nối");
    const empty = setup(); empty.deck.name = "   ";
    await empty.save.save(); expect(empty.writes()).toBe(0);
    expect(empty.save.disabledReason).toContain("1–24");
    empty.deck.name = "a".repeat(25);
    await empty.save.save(); expect(empty.writes()).toBe(0);
  });
  it("ignores a late response after the scene/account guard expires", async () => {
    const ctx = setup(true);
    const result = ctx.save.save();
    ctx.invalidate(); ctx.request.resolve({ deckId: "late" });
    await result;
    expect(ctx.deck.id).toBe("");
    expect(ctx.selected()).toBe("active-deck");
    expect(ctx.destination()).toBe("editor");
  });
});
