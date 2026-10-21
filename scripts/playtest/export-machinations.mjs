// Export source data and arithmetic reference values. Does not run matches.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const out = resolve(root, "output/machinations/vong-nguyet-kit");
const paths = ["heroes.json", "cards.json", "combat-config.json", "pvp-config.json", "moon-phases.json"];
const raw = Object.fromEntries(paths.map(name => [name, readFileSync(resolve(root, "packages/data", name))]));
const data = Object.fromEntries(paths.map(name => [name, JSON.parse(raw[name].toString("utf8"))]));
const hashes = () => Object.fromEntries(paths.map(name => [name, createHash("sha256").update(readFileSync(resolve(root, "packages/data", name))).digest("hex")]));
const before = hashes();
const cards = new Map(data["cards.json"].map(card => [card.id, card]));
const heroes = new Map(data["heroes.json"].map(hero => [hero.id, hero]));
const pvp = data["pvp-config.json"];
const teams = [
  { id: "sustain", heroIds: ["m05", "f04", "m06"] },
  { id: "pressure", heroIds: ["m05", "m10", "m06"] },
].map(team => {
  const deckCardIds = team.heroIds.flatMap(id => heroes.get(id).cardIds);
  const bondCardIds = [...cards.values()].filter(card => card.bond?.owners.every(id => team.heroIds.includes(id))).map(card => card.id);
  const expandedDeck = [...deckCardIds, ...bondCardIds].flatMap(id => {
    assert(cards.has(id), `Unknown card ${id}`);
    return Array(cards.get(id).copies).fill(id);
  });
  return { ...team, loadout: { heroes: {} }, deckCardIds, bondCardIds, expandedDeck, instanceCount: expandedDeck.length,
    heroes: team.heroIds.map(id => ({ id, name: heroes.get(id).name, maxHp: pvp.heroStats[id].maxHp })) };
});
const selectedIds = new Set(teams.flatMap(team => [...team.deckCardIds, ...team.bondCardIds]));
const csv = rows => '\uFEFF' + rows.map(row => row.map(value => '"' + String(value ?? "").replaceAll('"', '""') + '"').join(",")).join("\n") + "\n";
mkdirSync(out, { recursive: true });
const write = (name, content) => writeFileSync(resolve(out, name), content, "utf8");
const snapshot = {
  schemaVersion: 1, purpose: "Machinations modeling reference; NOT a native diagram import or a simulation result",
  sourceHashes: before, mode: "pvp", teams,
  heroes: [...new Set(teams.flatMap(team => team.heroIds))].map(id => heroes.get(id)),
  cards: [...cards.values()].filter(card => selectedIds.has(card.id)),
  combatConfig: data["combat-config.json"], pvpConfig: { heroStats: pvp.heroStats, secondPlayerBonus: pvp.secondPlayerBonus, roundCap: pvp.roundCap },
  moonPhases: data["moon-phases.json"],
  starterModel: { kind: "isolated-regen", initialHp: 26, maxHp: pvp.heroStats.f04.maxHp, initialStacks: 5, steps: 8, healMultiplier: 1,
    excluded: ["incoming damage", "additional applications", "deck and card choices", "moon changes", "level-ups", "fatigue"],
    balanceDemo: { targetActualHealing: 10, initialStacksRange: [2, 5], integerOnly: true, note: "Training target, not a recommended card nerf" } },
};
write("source-snapshot.json", JSON.stringify(snapshot, null, 2) + "\n");
write("cards.csv", csv([["id", "name", "ownerId", "cost", "copies", "type", "target", "tags", "effects"],
  ...snapshot.cards.map(c => [c.id, c.name, c.ownerId ?? c.bond?.owners.join("+"), c.cost, c.copies, c.type, c.target, c.tags.join("|"), JSON.stringify(c.effects)])]));
write("teams.csv", csv([["team", "heroId", "name", "pvpMaxHp"], ...teams.flatMap(t => t.heroes.map(h => [t.id, h.id, h.name, h.maxHp]))]));
const reference = [["initialStacks", "elapsedOwnTurns", "remainingStacks", "potentialHealing", "actualHealing", "hp"]];
for (const initialStacks of [2, 3, 4, 5]) {
  let remaining = initialStacks, hp = 26, potential = 0;
  for (let t = 0; t <= 8; t++) {
    if (t > 0) { potential += remaining; hp = Math.min(snapshot.starterModel.maxHp, hp + remaining); remaining = Math.max(0, remaining - 1); }
    const active = Math.min(t, initialStacks);
    const closed = active * (2 * initialStacks - active + 1) / 2;
    assert.equal(closed, potential);
    assert.equal(hp, Math.min(snapshot.starterModel.maxHp, 26 + closed));
    reference.push([initialStacks, t, remaining, potential, hp - 26, hp]);
  }
}
write("regen-reference.csv", csv(reference));
write("combat-rules-reference.md", readFileSync(resolve(root, "docs/01-combat-rules.md"), "utf8"));
for (const [source, destination] of [["README.md", "HUONG-DAN.md"], ["builder-prompt.txt", "builder-prompt.txt"], ["full-combat-brief.md", "full-combat-brief.md"]]) {
  write(destination, readFileSync(resolve(root, "docs/playtest/machinations", source), "utf8"));
}
assert.deepEqual(hashes(), before, "Source data changed during export");
console.log(JSON.stringify({ output: out, teams: teams.map(t => ({ id: t.id, instances: t.instanceCount })), cardDefinitions: snapshot.cards.length, arithmeticReferenceRows: reference.length - 1, sourceDataUnchanged: true }, null, 2));
