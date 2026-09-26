import { describe, expect, it } from "vitest";
import type { GameData, Profile, SavedDeck } from "../src/index";
import {
  applyRunAction, createProfile, createRun, deleteDeck, saveDeck, starterDeck, validateDeck,
} from "../src/index";
import { testData } from "./helpers";

const TEAM: [string, string, string] = ["m05", "f04", "m06"];

function draft(data: GameData, cardIds = starterDeck(data, TEAM), id = ""): SavedDeck {
  return { id, name: "Deck thử", heroIds: TEAM, cardIds };
}

describe("decks", () => {
  it("T164: validateDeck reports every broken rule", () => {
    const data = testData();
    const profile = createProfile(data);
    const base = starterDeck(data, TEAM);
    expect(validateDeck(data, profile, { heroIds: TEAM, cardIds: base })).toEqual([]);
    expect(validateDeck(data, profile, { heroIds: ["m05", "m05", "f04"], cardIds: base })).toEqual([{ code: "badHeroes" }]);
    expect(validateDeck(data, profile, { heroIds: TEAM, cardIds: base.slice(1) })).toContainEqual({ code: "wrongSize", size: 17 });
    expect(validateDeck(data, profile, { heroIds: TEAM, cardIds: [base[1]!, ...base.slice(1)] })).toContainEqual({ code: "duplicateCard", cardId: base[1] });
    expect(validateDeck(data, profile, { heroIds: TEAM, cardIds: ["f03_han_an", ...base.slice(1)] })).toContainEqual({ code: "foreignCard", cardId: "f03_han_an" });
    expect(validateDeck(data, profile, { heroIds: TEAM, cardIds: ["bond_anh_dau", ...base.slice(1)] })).toContainEqual({ code: "foreignCard", cardId: "bond_anh_dau" });

    const locked = data.heroes["m05"]!.lockedCardIds[0]!;
    const withLocked = [locked, ...base.slice(1)];
    expect(validateDeck(data, profile, { heroIds: TEAM, cardIds: withLocked })).toEqual([{ code: "lockedCard", cardId: locked }]);
    const unlocked: Profile = { ...profile, heroes: { ...profile.heroes, m05: { xp: 999, unlockedCardIds: [locked] } } };
    expect(validateDeck(data, unlocked, { heroIds: TEAM, cardIds: withLocked })).toEqual([]);

    const m06Cards = data.heroes["m06"]!.cardIds;
    const fewM06 = base.filter((id) => !m06Cards.slice(0, 3).includes(id));
    expect(validateDeck(data, profile, { heroIds: TEAM, cardIds: fewM06 })).toContainEqual({ code: "tooFewForHero", heroId: "m06", count: 3 });
  });

  it("T165: the starter deck is valid for all ten teams with a new profile", () => {
    const data = testData();
    const profile = createProfile(data);
    const ids = Object.keys(data.heroes);
    let teams = 0;
    for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) for (let c = b + 1; c < ids.length; c++) {
      const team = [ids[a]!, ids[b]!, ids[c]!];
      expect(validateDeck(data, profile, { heroIds: team, cardIds: starterDeck(data, team) })).toEqual([]);
      teams += 1;
    }
    expect(teams).toBe(10);
  });

  it("T166: saveDeck assigns ids, checks names and the deck limit, keeps drafts; deleteDeck removes", () => {
    const data = testData();
    let profile = createProfile(data);
    const first = saveDeck(data, profile, draft(data, ["m05_ho_gam"]));
    expect(first).toMatchObject({ ok: true, deckId: "d1" });
    if (!first.ok) return;
    profile = first.profile;
    expect(profile.decks[0]!.cardIds).toEqual(["m05_ho_gam"]); // an invalid draft is kept
    const second = saveDeck(data, profile, draft(data));
    expect(second).toMatchObject({ ok: true, deckId: "d2" });
    if (!second.ok) return;
    const renamed = saveDeck(data, second.profile, { ...draft(data), id: "d1", name: "  Mới  " });
    expect(renamed.ok && renamed.profile.decks.find((d) => d.id === "d1")!.name).toBe("Mới");
    expect(saveDeck(data, profile, { ...draft(data), name: "   " })).toEqual({ ok: false, error: "invalid name" });
    expect(saveDeck(data, profile, { ...draft(data), name: "x".repeat(25) })).toEqual({ ok: false, error: "invalid name" });
    expect(saveDeck(data, profile, draft(data, undefined, "d9"))).toEqual({ ok: false, error: "unknown deck" });

    let full = createProfile(data);
    for (let i = 0; i < data.metaConfig.maxDecks; i++) {
      const saved = saveDeck(data, full, draft(data));
      if (!saved.ok) throw new Error(saved.error);
      full = saved.profile;
    }
    expect(saveDeck(data, full, draft(data))).toEqual({ ok: false, error: "too many decks" });

    const removed = deleteDeck(second.profile, "d1");
    expect(removed.ok && removed.profile.decks.map((d) => d.id)).toEqual(["d2"]);
    expect(deleteDeck(profile, "d7")).toEqual({ ok: false, error: "unknown deck" });
  });

  it("T167: createRun uses deckCardIds and rejects cards outside the team", () => {
    const data = testData();
    const deck = [...starterDeck(data, TEAM).slice(1), data.heroes["m05"]!.lockedCardIds[0]!];
    expect(createRun(data, { heroIds: TEAM, seed: 1, deckCardIds: deck }).run.deck).toEqual(deck);
    expect(() => createRun(data, { heroIds: TEAM, seed: 1, deckCardIds: ["f03_han_an"] })).toThrowError(/f03_han_an/);
  });

  it("T168: reward offers 3 distinct unowned augments and never grows the deck", () => {
    const data = testData();
    const deck = starterDeck(data, TEAM);
    let run = createRun(data, { heroIds: TEAM, seed: 42, deckCardIds: deck }).run;
    const act = (action: Parameters<typeof applyRunAction>[2]) => {
      const result = applyRunAction(data, run, action);
      if (!result.ok) throw new Error(result.error);
      run = result.run;
    };
    const node = run.map.floors[0]![0]!;
    act({ type: "chooseNode", nodeId: node.id });
    act({ type: "combat", action: { type: "mulligan", instanceIds: [] } });
    for (const enemy of run.combat!.enemies) enemy.statuses.push({ id: "burn", value: 999 });
    act({ type: "combat", action: { type: "endTurn" } });
    const choices = run.pendingReward!.augmentChoices;
    expect(choices).toHaveLength(data.runConfig.augmentChoices);
    expect(new Set(choices).size).toBe(choices.length);
    for (const augmentId of choices) {
      expect(data.augments[augmentId]).toBeDefined();
      expect(run.augmentIds).not.toContain(augmentId);
    }
    act({ type: "pickAugment", augmentId: choices[0]! });
    expect(run.deck).toEqual(deck);
  });
});
