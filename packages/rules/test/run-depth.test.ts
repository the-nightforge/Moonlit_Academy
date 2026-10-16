import { describe, expect, it } from "vitest";
import { applyRunAction, createRun, generateMap, replayRun, runEventModel, runSwapChoices, starterDeck, type RunAction, type RunState } from "../src/index";
import { testData } from "./helpers";

const team: [string, string, string] = ["m05", "f04", "m06"];
function fresh(seed = 42) {
  const data = testData();
  const setup = { heroIds: team, seed, deckCardIds: starterDeck(data, team), availableCardIds: team.flatMap(id => [...data.heroes[id]!.cardIds, ...data.heroes[id]!.lockedCardIds]) };
  return { data, setup, run: createRun(data, setup).run };
}
function act(data: ReturnType<typeof testData>, run: RunState, action: RunAction) {
  const result = applyRunAction(data, run, action);
  if (!result.ok) throw new Error(result.error);
  return result;
}

describe("Tầm Nguyệt depth", () => {
  it("rotates at least three dedicated bosses deterministically and keeps route variety", () => {
    const { data } = fresh();
    const bosses = new Set<string>();
    const fourth = new Set<string>();
    for (let seed = 1; seed <= 80; seed++) {
      const generated = generateMap(data, seed);
      expect(generateMap(data, seed)).toEqual(generated);
      const map = generated.map;
      expect(map.floors).toHaveLength(8);
      expect(map.floors[0]!.every(n => n.type === "combat")).toBe(true);
      expect(map.floors[6]!.every(n => n.type === "rest")).toBe(true);
      const boss = map.floors[7]![0]!.encounterId!;
      expect(data.encounters[boss]!.tier).toBe("boss");
      bosses.add(boss);
      map.floors[3]!.forEach(n => fourth.add(n.type));
    }
    expect(bosses.has("enc_04")).toBe(true);
    expect(bosses.size).toBeGreaterThanOrEqual(3);
    expect(fourth).toEqual(new Set(["event", "treasure"]));
  });

  it("gives living and fallen heroes the same recovery floor, retaining higher health", () => {
    const { data, run } = fresh();
    let fighting = act(data, run, { type: "chooseNode", nodeId: run.map.floors[0]![0]!.id }).run;
    fighting = act(data, fighting, { type: "combat", action: { type: "mulligan", instanceIds: [] } }).run;
    fighting.combat!.heroes[0]!.hp = 1;
    fighting.combat!.heroes[1]!.hp = 0;
    fighting.combat!.heroes[1]!.alive = false;
    fighting.combat!.heroes[2]!.hp = fighting.heroes[2]!.maxHp;
    fighting.combat!.enemies.forEach(e => e.statuses.push({ id: "burn", value: 999 }));
    const won = act(data, fighting, { type: "combat", action: { type: "endTurn" } });
    expect(won.run.heroes.map(h => h.hp)).toEqual([16, 12, 28]);
    expect(won.runEvents).toContainEqual({ type: "heroRecovered", heroId: "m05", amount: 15 });
    expect(won.runEvents).toContainEqual({ type: "heroRevived", heroId: "f04", hp: 12 });
  });

  it("replays three seeded event templates and denies repeat or forged choices", () => {
    const { data } = fresh();
    data.runConfig.floorRules[0] = { floors: [1], type: "event" };
    const templates = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) {
      const { setup } = fresh(seed);
      const run = createRun(data, setup).run;
      const enter: RunAction = { type: "chooseNode", nodeId: run.map.floors[0]![0]!.id };
      const event = act(data, run, enter).run;
      templates.add(event.pendingEvent!.id);
      const rest: RunAction = { type: "event", choice: "rest" };
      const done = act(data, event, rest).run;
      expect(done.status).toBe("map");
      expect(replayRun(data, setup, [enter, rest])).toEqual({ ok: true, run: done });
      const model = runEventModel(data, event)!;
      const trade: RunAction = { type: "event", choice: "trade", ...(model.cardIds.length ? { cardId: model.cardIds[0]! } : {}) };
      expect(replayRun(data, setup, [enter, trade])).toEqual({ ok: true, run: act(data, event, trade).run });
      expect(applyRunAction(data, done, rest).ok).toBe(false);
      expect(applyRunAction(data, event, { type: "event", choice: "forged" } as any).ok).toBe(false);
      event.heroes.forEach(h => { h.hp = 1; });
      event.deck = event.deck.slice(0, data.runConfig.minDeckSize);
      event.runRelicIds = Object.keys(data.runRelics);
      event.augmentIds = Object.keys(data.augments);
      expect(act(data, event, rest).run.status).toBe("map");
    }
    expect(templates.size).toBe(3);
  });

  it("swaps a single unlocked same-owner card for this run only and rejects illegal swaps", () => {
    const { data, run, setup } = fresh();
    run.map.floors[0]![0]!.type = "rest";
    const resting = act(data, run, { type: "chooseNode", nodeId: run.map.floors[0]![0]!.id }).run;
    const cardId = data.heroes[team[0]]!.cardIds[0]!;
    const replacementId = data.heroes[team[0]]!.lockedCardIds[0]!;
    const swap: RunAction = { type: "rest", choice: "swapCard", cardId, replacementId };
    const changed = act(data, resting, swap);
    expect(changed.run.deck).toHaveLength(resting.deck.length);
    expect(changed.run.deck).toContain(replacementId);
    expect(changed.run.deck).not.toContain(cardId);
    expect(new Set(changed.run.deck).size).toBe(changed.run.deck.length);
    expect(changed.run.status).toBe("map");
    expect(applyRunAction(data, changed.run, swap).ok).toBe(false);
    expect(setup.deckCardIds).toContain(cardId);
    expect(resting.deck).toContain(cardId);
    for (const bad of [data.heroes[team[1]]!.lockedCardIds[0]!, resting.deck[1]!, "unknown"]) {
      expect(applyRunAction(data, resting, { ...swap, replacementId: bad } as any).ok).toBe(false);
    }
    const limited = createRun(data, { ...setup, availableCardIds: setup.deckCardIds }).run;
    limited.status = "rest";
    expect(applyRunAction(data, limited, swap).ok).toBe(false);
  });

  it("applies distinct event costs exactly once, and exhausted or minimum decks always have two exits", () => {
    const { data, run } = fresh();
    const relic = Object.keys(data.runRelics)[0]!;
    const augment = Object.keys(data.augments)[0]!;
    for (const id of ["moonShrine", "wanderingSmith", "forgottenArchive"] as const) {
      const event: RunState = { ...structuredClone(run), status: "event", pendingEvent: { id, ...(id === "moonShrine" ? { runRelicId: relic } : { augmentId: augment }) } };
      event.heroes.forEach(h => { h.hp = h.maxHp; });
      if (id === "wanderingSmith") event.runRelicIds = [relic];
      const model = runEventModel(data, event)!;
      const trade: RunAction = { type: "event", choice: "trade", ...(model.cardIds.length ? { cardId: event.deck[0]! } : {}) };
      const before = structuredClone(event);
      const result = act(data, event, trade);
      expect(event).toEqual(before);
      expect(result.run.status).toBe("map");
      expect(result.run.pendingEvent).toBeNull();
      if (id === "moonShrine") {
        expect(result.run.heroes.map(h => h.hp)).toEqual([32, 24, 22]);
        expect(result.run.runRelicIds).toEqual([relic]);
      } else if (id === "wanderingSmith") {
        expect(result.run.runRelicIds).toEqual([]);
        expect(result.run.augmentIds).toEqual([augment]);
        expect(result.run.heroes).toEqual(event.heroes);
      } else {
        expect(result.run.deck).toHaveLength(event.deck.length - 1);
        expect(result.run.augmentIds).toEqual([augment]);
        expect(applyRunAction(data, event, { type: "event", choice: "trade", cardId: "forged" }).ok).toBe(false);
      }
      expect(applyRunAction(data, result.run, trade).ok).toBe(false);
      const exhausted: RunState = { ...event, pendingEvent: { id }, deck: event.deck.slice(0, data.runConfig.minDeckSize), runRelicIds: Object.keys(data.runRelics), augmentIds: Object.keys(data.augments) };
      exhausted.heroes.forEach(h => { h.hp = 1; });
      for (const choice of ["trade", "rest"] as const) {
        expect(act(data, exhausted, { type: "event", choice }).run.status).toBe("map");
      }
    }
  });

  it("does not offer a signature base card when its upgraded signature is already in the deck", () => {
    const { data, setup } = fresh();
    const run = createRun(data, setup, { heroes: { m05: { constellation: 4, levelUpForm: "base" } } }).run;
    expect(run.deck).toContain(data.heroes.m05!.signature.plusCardId);
    for (const cardId of run.deck) {
      expect(runSwapChoices(data, run, cardId)).not.toContain(data.heroes.m05!.signature.cardId);
      expect(runSwapChoices(data, run, cardId)).not.toContain(data.heroes.m05!.signature.plusCardId);
    }
  });

  it("replays a swap from the trusted card snapshot and filters foreign and generated candidates", () => {
    const { data, setup } = fresh();
    data.runConfig.floorRules[0] = { floors: [1], type: "rest" };
    const run = createRun(data, { ...setup, availableCardIds: Object.keys(data.cards) }).run;
    const cardId = data.heroes.m05!.cardIds[0]!;
    const candidates = runSwapChoices(data, run, cardId);
    expect(candidates.every(id => data.cards[id]!.ownerId === "m05" && data.heroes.m05!.lockedCardIds.includes(id))).toBe(true);
    const enter: RunAction = { type: "chooseNode", nodeId: run.map.floors[0]![0]!.id };
    const resting = act(data, run, enter).run;
    const swap: RunAction = { type: "rest", choice: "swapCard", cardId, replacementId: candidates[0]! };
    const swapped = act(data, resting, swap).run;
    expect(replayRun(data, { ...setup, availableCardIds: Object.keys(data.cards) }, [enter, swap])).toEqual({ ok: true, run: swapped });
  });
});
