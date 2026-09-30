import { z } from "zod";
import type { Effect, GameData, RunRelicHook, WeaponHook } from "rules";
import { rawGameDataSchema } from "./schema";
import heroesJson from "../heroes.json";
import cardsJson from "../cards.json";
import enemiesJson from "../enemies.json";
import encountersJson from "../encounters.json";
import moonPhasesJson from "../moon-phases.json";
import runRelicsJson from "../run-relics.json";
import runAugmentsJson from "../run-augments.json";
import runConfigJson from "../run-config.json";
import combatConfigJson from "../combat-config.json";
import keywordsJson from "../keywords.json";
import metaConfigJson from "../meta-config.json";
import economyConfigJson from "../economy-config.json";
import missionsJson from "../missions.json";
import achievementsJson from "../achievements.json";
import bannersJson from "../banners.json";
import weaponsJson from "../weapons.json";
import relicsJson from "../relics.json";
import pvpConfigJson from "../pvp-config.json";
import coopConfigJson from "../coop-config.json";
import coopCombosJson from "../coop-combos.json";
import summonsJson from "../summons.json";
import storyJson from "../story.json";

function someEffect(effects: Effect[], test: (effect: Effect) => boolean): boolean {
  return effects.some(
    (effect) =>
      test(effect) ||
      (effect.type === "conditional" &&
        (someEffect(effect.then, test) || someEffect(effect.else ?? [], test))) ||
      (effect.type === "execute" && someEffect(effect.elseEffects ?? [], test)),
  );
}

function effectsUseChosen(effects: Effect[]): boolean {
  // stealBuff always takes from the chosen target.
  return someEffect(
    effects,
    (effect) => effect.type === "stealBuff" || ("to" in effect && effect.to === "chosen"),
  );
}

function collectCrossCheckErrors(parsed: z.infer<typeof rawGameDataSchema>): string[] {
  const { heroes, cards, enemies, encounters, moonPhases, runRelics, runAugments, runConfig, combatConfig, keywords, metaConfig, economyConfig, missions, achievements, banners, weapons, relics, pvpConfig, coopConfig, coopCombos, summons, story } =
    parsed;
  const errors: string[] = [];

  const groups = [
    ["heroes", heroes],
    ["cards", cards],
    ["enemies", enemies],
    ["encounters", encounters],
    ["runRelics", runRelics],
    ["runAugments", runAugments],
    ["keywords", keywords],
    ["weapons", weapons],
    ["relics", relics],
    ["coopCombos", coopCombos],
    ["summons", summons],
    ["storyArcs", story.arcs],
    ["storyStages", story.stages],
  ] as const;
  for (const [label, defs] of groups) {
    const seen = new Set<string>();
    for (const def of defs) {
      if (seen.has(def.id)) errors.push(`${label}: duplicate id "${def.id}"`);
      seen.add(def.id);
    }
  }

  const heroById = new Map(heroes.map((hero) => [hero.id, hero]));
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const enemyById = new Map(enemies.map((enemy) => [enemy.id, enemy]));
  const keywordIds = new Set(keywords.map((keyword) => keyword.id));

  /** Linh Thú (`01` §17): whether any effect (incl. nested) targets `to`. */
  const usesTo = (effects: Effect[], to: string) => someEffect(effects, (e) => "to" in e && e.to === to);
  /** Linh Thú is out of place outside summon actions and hero cards (`02` §6).
   *  Phong Ấn (`01` §5.6) is a card-only effect, banned wherever `summon` is.
   *  `heroCardLike`: weapon cards and weapon hooks act as heroes (`01` §14.2–14.3),
   *  so they may use every hero-card effect — only `to "owner"` stays banned. */
  const checkNoSummon = (label: string, effects: Effect[], heroCardLike = false) => {
    if (!heroCardLike) {
      if (someEffect(effects, (effect) => effect.type === "summon")) {
        errors.push(`${label}: summon is not allowed`);
      }
      if (someEffect(effects, (effect) => effect.type === "sealIntent")) {
        errors.push(`${label}: sealIntent is not allowed`);
      }
      if (someEffect(effects, (effect) => effect.type === "revive")) {
        errors.push(`${label}: revive is not allowed`);
      }
      if (usesTo(effects, "summon")) errors.push(`${label}: to "summon" is only allowed on hero cards`);
    }
    if (usesTo(effects, "owner")) errors.push(`${label}: to "owner" is only allowed in summon actions`);
  };

  /** Effects and conditions only usable on player cards (`13` §2.3). */
  const cardOnly = (effect: Effect): boolean =>
    effect.type === "drainMoonPower" ||
    effect.type === "gainMoonPowerPerTurn" ||
    effect.type === "burstRegen" ||
    (effect.type === "heal" && effect.overflow !== undefined) ||
    (effect.type === "conditional" &&
      (effect.condition.type === "heldTurnsAtLeast" ||
        effect.condition.type === "cardsPlayedThisTurnAtLeast"));

  /** Enemy intents may drain the player's moon reserve (`01` §9.3.2, `02` §6 [GĐ7c]). */
  const cardOnlyForIntent = (effect: Effect): boolean =>
    effect.type !== "drainMoonPower" && cardOnly(effect);

  const nestedChoose = (effects: Effect[]) =>
    effects.some(
      (effect) =>
        effect.type === "conditional" &&
        someEffect([...effect.then, ...(effect.else ?? [])], (inner) => inner.type === "chooseCard"),
    );

  /** Rules every playable card follows, weapon cards included (`02` §6). */
  const checkCardShape = (
    label: string,
    card: Pick<z.infer<typeof rawGameDataSchema>["cards"][number], "target" | "effects" | "keywords" | "tags" | "requiresBloodMoon">,
  ) => {
    if (card.requiresBloodMoon && !card.tags.includes("forbidden")) {
      errors.push(`${label}: requiresBloodMoon requires tag "forbidden"`);
    }
    const usesChosen = effectsUseChosen(card.effects);
    if (card.target === "none" && usesChosen) {
      errors.push(`${label}: target "none" must not have effects with to "chosen"`);
    }
    if (card.target !== "none" && !usesChosen) {
      errors.push(`${label}: target "${card.target}" requires at least one effect with to "chosen"`);
    }
    const revivesChosen = someEffect(card.effects, (e) => e.type === "revive" && e.to === "chosen");
    if (card.target === "fallenAlly" && !revivesChosen) {
      errors.push(`${label}: target "fallenAlly" requires a revive effect with to "chosen"`);
    }
    if (card.target !== "fallenAlly" && revivesChosen) {
      errors.push(`${label}: revive to "chosen" needs target "fallenAlly"`);
    }
    if (someEffect(card.effects, (e) => e.type === "revive" && e.to === "lastFallen")) {
      errors.push(`${label}: revive to "lastFallen" is only allowed on onLevelUp`);
    }
    if (someEffect(card.effects, (effect) => effect.type === "execute")) {
      errors.push(`${label}: execute is only allowed in co-op combos`);
    }
    const chooseIndex = card.effects.findIndex((effect) => effect.type === "chooseCard");
    if ((chooseIndex >= 0 && chooseIndex !== card.effects.length - 1) || nestedChoose(card.effects)) {
      errors.push(`${label}: chooseCard must be the last top-level effect`);
    }
    for (const id of card.keywords ?? []) {
      if (!keywordIds.has(id)) errors.push(`${label}: unknown keyword "${id}"`);
    }
    if (
      card.target !== "enemy" &&
      someEffect(card.effects, (e) => e.type === "drainMoonPower" && e.to === "chosen")
    ) {
      errors.push(`${label}: drainMoonPower to "chosen" needs target "enemy"`);
    }
  };

  for (const hero of heroes) {
    for (const cardId of hero.cardIds) {
      const card = cardById.get(cardId);
      if (!card) {
        errors.push(`hero "${hero.id}": cardIds references missing card "${cardId}"`);
      } else if (card.ownerId !== hero.id) {
        errors.push(`hero "${hero.id}": card "${cardId}" has ownerId "${card.ownerId}"`);
      }
    }
  }

  for (const card of cards) {
    if ((card.ownerId === undefined) === (card.bond === undefined)) {
      errors.push(`card "${card.id}": must have exactly one of ownerId or bond`);
    }
    if (card.ownerId !== undefined && !heroById.has(card.ownerId)) {
      errors.push(`card "${card.id}": ownerId references missing hero "${card.ownerId}"`);
    }
    if (card.bond !== undefined) {
      const [first, second] = card.bond.owners;
      if (first === second) errors.push(`card "${card.id}": bond owners must be different heroes`);
      for (const ownerId of card.bond.owners) {
        if (!heroById.has(ownerId)) {
          errors.push(`card "${card.id}": bond owner references missing hero "${ownerId}"`);
        }
      }
    } else if (someEffect(card.effects, (effect) => effect.actor !== undefined)) {
      errors.push(`card "${card.id}": actor is only allowed on bond cards`);
    }
    checkCardShape(`card "${card.id}"`, card);
  }

  for (const enemy of enemies) {
    if (enemy.moonPower.start > enemy.moonPower.cap) {
      errors.push(`enemy "${enemy.id}": moonPower start must be <= cap`);
    }
    const intentLists = [enemy.intents, ...(enemy.phases ?? []).map((phase) => phase.intents)];
    for (const list of intentLists) {
      const intentIds = new Set<string>();
      for (const intent of list) {
        if (intentIds.has(intent.id)) errors.push(`enemy "${enemy.id}": duplicate intent id "${intent.id}"`);
        intentIds.add(intent.id);
      }
    }
    const intents = [
      ...enemy.intents,
      ...(enemy.moonOverrides ?? []).map((override) => override.intent),
      ...(enemy.bloodMoonOverride ? [enemy.bloodMoonOverride] : []),
      ...(enemy.phases ?? []).flatMap((phase) => phase.intents),
    ];
    for (const intent of intents) {
      if (effectsUseChosen(intent.effects) && intent.targeting === undefined) {
        errors.push(`enemy "${enemy.id}" intent "${intent.id}": has to "chosen" effects but no targeting`);
      }
      if (someEffect(intent.effects, (effect) => effect.actor !== undefined)) {
        errors.push(`enemy "${enemy.id}" intent "${intent.id}": actor is only allowed on bond cards`);
      }
      if (someEffect(intent.effects, (effect) => effect.type === "chooseCard")) {
        errors.push(`enemy "${enemy.id}" intent "${intent.id}": chooseCard is not allowed`);
      }
      if (someEffect(intent.effects, (effect) => effect.type === "createCard")) {
        errors.push(`enemy "${enemy.id}" intent "${intent.id}": createCard is not allowed`);
      }
      checkNoSummon(`enemy "${enemy.id}" intent "${intent.id}"`, intent.effects);
      if (someEffect(intent.effects, (effect) => effect.type === "execute")) {
        errors.push(`enemy "${enemy.id}" intent "${intent.id}": execute is only allowed in co-op combos`);
      }
      if (someEffect(intent.effects, cardOnlyForIntent)) {
        errors.push(`enemy "${enemy.id}" intent "${intent.id}": card-only keyword`);
      }
    }
    // Boss phases (`01` §16.5): first threshold is 1, then strictly decreasing;
    // the revive countdown only lives on the final phase.
    const phases = enemy.phases ?? [];
    if (phases.length > 0 && phases[0]!.hpBelow !== 1) {
      errors.push(`enemy "${enemy.id}": phases[0].hpBelow must be 1`);
    }
    for (let i = 1; i < phases.length; i++) {
      if (phases[i]!.hpBelow >= phases[i - 1]!.hpBelow) {
        errors.push(`enemy "${enemy.id}": phases hpBelow must strictly decrease`);
      }
    }
    for (const [index, phase] of phases.entries()) {
      if (phase.reviveAfterRounds !== undefined && index !== phases.length - 1) {
        errors.push(`enemy "${enemy.id}": reviveAfterRounds only on the last phase`);
      }
      const onEnter = phase.onEnter ?? [];
      if (effectsUseChosen(onEnter) || someEffect(onEnter, (e) => e.type === "stealBuff")) {
        errors.push(`enemy "${enemy.id}" phase ${index + 1}: onEnter must not use to "chosen" or stealBuff`);
      }
      if (someEffect(onEnter, (e) => e.type === "chooseCard" || e.type === "execute" || e.actor !== undefined)) {
        errors.push(`enemy "${enemy.id}" phase ${index + 1}: onEnter must not use chooseCard, execute or actor`);
      }
      if (someEffect(onEnter, (e) => e.type === "createCard")) {
        errors.push(`enemy "${enemy.id}" phase ${index + 1}: createCard is not allowed`);
      }
      checkNoSummon(`enemy "${enemy.id}" phase ${index + 1}`, onEnter);
    }
  }

  if (moonPhases.length !== 8) {
    errors.push(`moonPhases: expected 8 phases, got ${moonPhases.length}`);
  }
  const seenIndex = new Set<number>();
  for (const phase of moonPhases) {
    if (seenIndex.has(phase.index)) errors.push(`moonPhases: duplicate index ${phase.index}`);
    seenIndex.add(phase.index);
  }

  for (const encounter of encounters) {
    for (const enemyId of encounter.enemyIds) {
      if (!enemyById.has(enemyId)) {
        errors.push(`encounter "${encounter.id}": enemyIds references missing enemy "${enemyId}"`);
      }
    }
    if (encounter.tier === "coop") {
      for (const enemyId of encounter.enemyIds) {
        if ((enemyById.get(enemyId)?.phases?.length ?? 0) === 0) {
          errors.push(`encounter "${encounter.id}": co-op enemies need phases`);
        }
      }
    }
  }

  for (const hero of heroes) {
    for (const cardId of hero.lockedCardIds) {
      const card = cardById.get(cardId);
      if (!card) {
        errors.push(`hero "${hero.id}": lockedCardIds references missing card "${cardId}"`);
      } else if (card.ownerId !== hero.id) {
        errors.push(`hero "${hero.id}": locked card "${cardId}" has ownerId "${card.ownerId}"`);
      } else if (hero.cardIds.includes(cardId)) {
        errors.push(`hero "${hero.id}": locked card "${cardId}" is also a starting card`);
      }
    }
    const pool = new Set([...hero.cardIds, ...hero.lockedCardIds]);
    const branchCards = hero.branches.flatMap((branch) => branch.cardIds);
    if (
      new Set(branchCards).size !== branchCards.length ||
      branchCards.some((id) => !pool.has(id)) ||
      branchCards.length !== pool.size
    ) {
      errors.push(`hero "${hero.id}": branches must split the 12-card pool exactly`);
    }
    const cheapFree = hero.cardIds.filter((id) => (cardById.get(id)?.cost ?? 99) <= 3).length;
    if (cheapFree < 2) {
      errors.push(`hero "${hero.id}": needs at least 2 free cards with cost <= 3`);
    }
  }

  const byTier = (tier: string) => encounters.filter((encounter) => encounter.tier === tier);
  if (byTier("boss").length !== 1) {
    errors.push(`encounters: expected exactly 1 boss encounter, got ${byTier("boss").length}`);
  }
  if (!byTier("normal").some((encounter) => (encounter.minFloor ?? 1) <= 1)) {
    errors.push(`encounters: need a normal encounter with minFloor 1`);
  }
  if (byTier("elite").length === 0) errors.push(`encounters: need at least 1 elite encounter`);

  const { floors, floorWidth, floorRules } = runConfig;
  if (floorWidth.max < floorWidth.min || floorWidth.max > 2 * floorWidth.min) {
    errors.push(`runConfig: floorWidth needs min <= max <= 2 x min`);
  }
  for (let floor = 1; floor <= floors; floor++) {
    const count = floorRules.filter((rule) => rule.floors.includes(floor)).length;
    if (count !== 1) errors.push(`runConfig: floor ${floor} has ${count} floorRules (expected 1)`);
  }
  for (const rule of floorRules) {
    if (rule.floors.some((floor) => floor < 1 || floor > floors)) {
      errors.push(`runConfig: floorRules reference a floor outside 1..${floors}`);
    }
    const allowsBoss = "type" in rule ? rule.type === "boss" : (rule.weights.boss ?? 0) > 0;
    if (allowsBoss && rule.floors.some((floor) => floor !== floors)) {
      errors.push(`runConfig: boss nodes are only allowed on floor ${floors}`);
    }
  }
  const lastRule = floorRules.find((rule) => rule.floors.includes(floors));
  if (!lastRule || !("type" in lastRule) || lastRule.type !== "boss") {
    errors.push(`runConfig: floor ${floors} must be type "boss"`);
  }

  if (combatConfig.moonPower.start > combatConfig.moonPower.cap) {
    errors.push(`combatConfig: moonPower start must be <= cap`);
  }

  const levels = metaConfig.masteryLevels;
  if (levels.some((value, index) => index > 0 && value <= levels[index - 1]!)) {
    errors.push(`metaConfig: masteryLevels must increase`);
  }
  for (const hero of heroes) {
    if (hero.lockedCardIds.length !== levels.length) {
      errors.push(`metaConfig: masteryLevels needs one level per locked card of "${hero.id}"`);
    }
  }

  // Constellation data (`14` §10): threshold, signature card and its "+" version.
  const pooled = new Set(heroes.flatMap((hero) => [...hero.cardIds, ...hero.lockedCardIds]));
  for (const hero of heroes) {
    if (hero.levelUp.constellationThreshold > hero.levelUp.threshold) {
      errors.push(`heroes: "${hero.id}" constellationThreshold must not exceed threshold`);
    }
    const { cardId, plusCardId } = hero.signature;
    const base = cards.find((card) => card.id === cardId);
    const plus = cards.find((card) => card.id === plusCardId);
    if (!hero.cardIds.includes(cardId)) errors.push(`heroes: "${hero.id}" signature card "${cardId}" is not one of its free cards`);
    if (!base || !plus) {
      errors.push(`heroes: "${hero.id}" signature cards must exist`);
    } else if (plus.plusOf !== cardId || plus.ownerId !== hero.id || plus.cost !== base.cost || plus.copies !== base.copies) {
      errors.push(`heroes: "${hero.id}" plus card "${plusCardId}" must have plusOf "${cardId}", the same owner, cost and copies`);
    }
  }
  for (const card of cards) {
    if (card.plusOf === undefined) continue;
    if (pooled.has(card.id)) errors.push(`cards: plus card "${card.id}" must not be in a hero pool`);
    if (heroes.filter((hero) => hero.signature.plusCardId === card.id).length !== 1) {
      errors.push(`cards: plus card "${card.id}" must be the signature plus card of exactly one hero`);
    }
  }

  // Lá tạo ra (`02` §6): createCard targets a token of the creating hero; tokens stay out of pools.
  const createdIn = (effects: Effect[]): string[] =>
    effects.flatMap((effect) =>
      effect.type === "createCard" ? [effect.cardId]
        : effect.type === "conditional" ? [...createdIn(effect.then), ...createdIn(effect.else ?? [])]
        : effect.type === "execute" ? createdIn(effect.elseEffects ?? [])
        : [],
    );
  const checkCreated = (label: string, effects: Effect[], ownerId: string) => {
    for (const cardId of createdIn(effects)) {
      const card = cardById.get(cardId);
      if (!card?.token) errors.push(`${label}: createCard "${cardId}" must be a token card`);
      else if (card.ownerId !== ownerId) errors.push(`${label}: createCard "${cardId}" must be owned by "${ownerId}"`);
    }
  };
  for (const hero of heroes) {
    checkCreated(`hero "${hero.id}" levelUp`, hero.levelUp.onLevelUp ?? [], hero.id);
    checkCreated(`hero "${hero.id}" altLevelUp`, hero.altLevelUp.onLevelUp ?? [], hero.id);
  }
  for (const card of cards) {
    if (card.ownerId !== undefined) checkCreated(`card "${card.id}"`, card.effects, card.ownerId);
    else if (createdIn(card.effects).length > 0) errors.push(`card "${card.id}": createCard only on hero cards`);
    if (card.token && (pooled.has(card.id) || card.plusOf !== undefined || card.bond !== undefined)) {
      errors.push(`cards: token card "${card.id}" must not be in a hero pool, a plus card or a bond card`);
    }
  }

  const starters = economyConfig.starterHeroIds;
  if (new Set(starters).size !== starters.length) {
    errors.push(`economyConfig: starterHeroIds must be distinct`);
  }
  for (const heroId of starters) {
    if (!heroes.some((hero) => hero.id === heroId)) {
      errors.push(`economyConfig: unknown starter hero "${heroId}"`);
    }
  }
  const { gacha } = economyConfig;
  if (gacha.rates.legendary + gacha.rates.epic >= 1) errors.push(`economyConfig: gacha rates must leave room for rare`);
  if (gacha.legendarySoftPityStart >= gacha.legendaryPity) {
    errors.push(`economyConfig: legendarySoftPityStart must be below legendaryPity`);
  }
  const duplicate = (ids: string[]) => ids.filter((id, index) => ids.indexOf(id) !== index);
  for (const id of duplicate(economyConfig.moonStarShop.map((item) => item.id))) errors.push(`economyConfig: duplicate shop item "${id}"`);
  for (const id of duplicate(missions.map((mission) => mission.id))) errors.push(`missions: duplicate id "${id}"`);
  for (const id of duplicate(achievements.map((achievement) => achievement.id))) errors.push(`achievements: duplicate id "${id}"`);
  for (const id of duplicate(banners.map((banner) => banner.id))) errors.push(`banners: duplicate id "${id}"`);
  for (const banner of banners) {
    const ids = Object.values(banner.pool).flat();
    for (const id of duplicate(ids)) errors.push(`banners: "${banner.id}" lists "${id}" twice`);
    if (ids.length === 0) errors.push(`banners: "${banner.id}" has an empty pool`);
    // Pool ids come from the file of the banner's kind, at their own rarity.
    const items: { id: string; rarity: string }[] =
      banner.kind === "hero" ? heroes : banner.kind === "weapon" ? parsed.weapons : parsed.relics;
    for (const [rarity, itemIds] of Object.entries(banner.pool)) {
      for (const itemId of itemIds) {
        const item = items.find((candidate) => candidate.id === itemId);
        if (!item) errors.push(`banners: "${banner.id}" has unknown ${banner.kind} "${itemId}"`);
        else if (item.rarity !== rarity) errors.push(`banners: "${banner.id}" lists ${item.rarity} ${banner.kind} "${itemId}" as ${rarity}`);
      }
    }
  }
  for (const achievement of achievements) {
    const goal = achievement.goal;
    if (goal.type === "bossKillWithBond" && !cards.some((card) => card.id === goal.bondCardId && card.bond)) {
      errors.push(`achievements: "${achievement.id}" needs a bond card, got "${goal.bondCardId}"`);
    }
  }

  for (const augment of runAugments) {
    if (runRelics.some((relic) => relic.id === augment.id)) {
      errors.push(`runAugments: id "${augment.id}" collides with a runRelic`);
    }
  }

  const checkHooks = (
    label: string,
    hooks: (RunRelicHook | WeaponHook)[],
    allowCardOnly: boolean,
    allowWearer: boolean,
  ) => {
    for (const [index, hook] of hooks.entries()) {
      const hookLabel = `${label} hook ${index}`;
      if (someEffect(hook.effects, (effect) => "to" in effect && effect.to === "chosen")) {
        errors.push(`${hookLabel}: effects must not use to "chosen"`);
      }
      if (someEffect(hook.effects, (effect) => effect.type === "stealBuff")) {
        errors.push(`${hookLabel}: effects must not use stealBuff`);
      }
      if (someEffect(hook.effects, (effect) => effect.actor !== undefined)) {
        errors.push(`${hookLabel}: effects must not use actor`);
      }
      if (someEffect(hook.effects, (effect) => effect.type === "chooseCard")) {
        errors.push(`${hookLabel}: effects must not use chooseCard`);
      }
      if (someEffect(hook.effects, (effect) => effect.type === "createCard")) {
        errors.push(`${hookLabel}: createCard is not allowed`);
      }
      checkNoSummon(hookLabel, hook.effects, allowWearer);
      if (someEffect(hook.effects, (effect) => effect.type === "execute")) {
        errors.push(`${hookLabel}: execute is only allowed in co-op combos`);
      }
      if (!allowCardOnly && someEffect(hook.effects, (e) => cardOnly(e) || e.type === "missingHpDamage")) {
        errors.push(`${hookLabel}: card-only keyword`);
      }
      if (
        someEffect(
          hook.effects,
          (effect) => effect.type === "conditional" && effect.condition.type.startsWith("target"),
        )
      ) {
        errors.push(`${hookLabel}: conditions must not reference a target`);
      }
      if (hook.on.type === "heroDied" && hook.actor === "trigger") {
        errors.push(`${hookLabel}: heroDied cannot use actor "trigger"`);
      }
      const usesWearer =
        hook.actor === "wearer" ||
        (hook.on.type === "cardPlayed" && hook.on.owner !== undefined) ||
        (hook.on.type === "enemyKilled" && hook.on.killer !== undefined);
      if (usesWearer && !allowWearer) errors.push(`${hookLabel}: "wearer" is only allowed in weapon hooks`);
    }
  };
  for (const relic of runRelics) checkHooks(`runRelic "${relic.id}"`, relic.hooks ?? [], false, false);
  // Augments, moon relics and weapons are player-side powers: card-only effects
  // (drainMoonPower, gainMoonPowerPerTurn, ...) are allowed, unlike run relics.
  for (const augment of runAugments) checkHooks(`runAugment "${augment.id}"`, augment.hooks ?? [], true, false);

  // Weapons and moon relics (`01` §14, `14` §13).
  const otherIds = new Set([...heroes, ...cards, ...runRelics, ...runAugments].map((def) => def.id));
  for (const def of [...weapons, ...relics]) {
    if (otherIds.has(def.id)) errors.push(`gear: id "${def.id}" collides with a hero, card, run relic or augment`);
  }
  for (const id of weapons.map((weapon) => weapon.id).filter((id) => relics.some((relic) => relic.id === id))) {
    errors.push(`gear: id "${id}" is both a weapon and a relic`);
  }
  for (const weapon of weapons) {
    const label = `weapon "${weapon.id}"`;
    const signature = weapon.signatureHeroId;
    if (signature !== undefined && !heroById.has(signature)) errors.push(`${label}: unknown signature hero "${signature}"`);
    const usesSignature = weapon.signatureHooks !== undefined || weapon.refinement.some((level) => level.signatureHooks !== undefined);
    if (usesSignature && signature === undefined) errors.push(`${label}: signatureHooks need signatureHeroId`);
    // Every refinement level must be a valid card with valid passives.
    let card = weapon.card;
    let hooks = weapon.hooks;
    let signatureHooks = weapon.signatureHooks;
    for (let level = 1; level <= weapon.refinement.length + 1; level++) {
      if (level > 1) {
        const change = weapon.refinement[level - 2]!;
        card = { ...card, ...change.card };
        hooks = change.hooks ?? hooks;
        signatureHooks = change.signatureHooks ?? signatureHooks;
      }
      const levelLabel = `${label} R${level}`;
      checkCardShape(levelLabel, card);
      if (someEffect(card.effects, (effect) => effect.actor !== undefined)) {
        errors.push(`${levelLabel}: actor is only allowed on bond cards`);
      }
      if (someEffect(card.effects, (effect) => effect.type === "createCard")) {
        errors.push(`${levelLabel}: createCard is not allowed`);
      }
      checkNoSummon(levelLabel, card.effects, true);
      checkHooks(levelLabel, hooks, true, true);
      checkHooks(`${levelLabel} signature`, signatureHooks ?? [], true, true);
    }
  }
  for (const relic of relics) {
    for (const [index, level] of relic.resonance.entries()) {
      checkHooks(`relic "${relic.id}" resonance ${index + 1}`, level.hooks ?? [], true, false);
    }
  }
  // PvP config (`17` §3.1): every hero has arena HP; trial and free ids must exist.
  for (const hero of heroes) {
    if (pvpConfig.heroStats[hero.id] === undefined) {
      errors.push(`pvpConfig: heroStats missing "${hero.id}"`);
    }
  }
  for (const id of Object.keys(pvpConfig.heroStats)) {
    if (!heroById.has(id)) errors.push(`pvpConfig: heroStats references unknown hero "${id}"`);
  }
  for (const id of pvpConfig.trialHeroIds) {
    if (!heroById.has(id)) errors.push(`pvpConfig: unknown trial hero "${id}"`);
  }
  for (const id of pvpConfig.freeWeaponIds) {
    if (!weapons.some((weapon) => weapon.id === id)) {
      errors.push(`pvpConfig: unknown free weapon "${id}"`);
    }
  }
  for (const id of pvpConfig.freeRelicIds) {
    if (!relics.some((relic) => relic.id === id)) {
      errors.push(`pvpConfig: unknown free relic "${id}"`);
    }
  }
  // Tiers ascend by minRating; honor shop choices must name a rarity that exists.
  const tiers = pvpConfig.tiers ?? [];
  for (let i = 1; i < tiers.length; i++) {
    if (tiers[i]!.minRating <= tiers[i - 1]!.minRating) errors.push("pvpConfig: tiers must ascend by minRating");
  }
  for (const entry of pvpConfig.honorShop ?? []) {
    const item = entry.item;
    if (item.type === "heroChoice" && !heroes.some((hero) => hero.rarity === item.rarity)) {
      errors.push(`pvpConfig: honorShop "${entry.id}" has no hero of rarity "${item.rarity}"`);
    }
    if (item.type === "relicChoice" && !relics.some((relic) => relic.rarity === item.rarity)) {
      errors.push(`pvpConfig: honorShop "${entry.id}" has no relic of rarity "${item.rarity}"`);
    }
  }

  for (const hero of heroes) {
    for (const [form, effects] of [
      ["levelUp", hero.levelUp.onLevelUp],
      ["altLevelUp", hero.altLevelUp.onLevelUp],
    ] as const) {
      const list = effects ?? [];
      const label = `hero "${hero.id}" ${form}.onLevelUp`;
      if (effectsUseChosen(list)) errors.push(`${label}: effects must not use to "chosen" or stealBuff`);
      if (someEffect(list, (effect) => effect.type === "chooseCard" || effect.type === "execute" || effect.actor !== undefined)) {
        errors.push(`${label}: effects must not use chooseCard, execute or actor`);
      }
      if (someEffect(list, (effect) => effect.type === "conditional" && effect.condition.type.startsWith("target"))) {
        errors.push(`${label}: conditions must not reference a target`);
      }
    }
  }

  // Co-op combos (`01` §16.4, `02` §1.14): matchers name real heroes; effects
  // resolve with no chosen target and no actor, like hook effects.
  for (const combo of coopCombos) {
    const label = `coopCombo "${combo.id}"`;
    for (const part of combo.parts) {
      if (part.ownerId !== undefined && !heroById.has(part.ownerId)) {
        errors.push(`${label}: matcher ownerId references missing hero "${part.ownerId}"`);
      }
    }
    if (effectsUseChosen(combo.effects) || someEffect(combo.effects, (e) => e.type === "stealBuff")) {
      errors.push(`${label}: effects must not use to "chosen" or stealBuff`);
    }
    if (someEffect(combo.effects, (e) => e.type === "chooseCard" || e.actor !== undefined)) {
      errors.push(`${label}: effects must not use chooseCard or actor`);
    }
    if (someEffect(combo.effects, (e) => e.type === "createCard")) {
      errors.push(`${label}: createCard is not allowed`);
    }
    checkNoSummon(label, combo.effects);
  }
  if (coopConfig.reconnectSeconds <= coopConfig.turnSeconds) {
    errors.push("coopConfig: reconnectSeconds must exceed turnSeconds");
  }
  const coopEncounter = encounters.find((encounter) => encounter.id === coopConfig.encounterId);
  if (coopEncounter === undefined) {
    errors.push(`coopConfig: encounterId references missing encounter "${coopConfig.encounterId}"`);
  } else if (coopEncounter.tier !== "coop") {
    errors.push(`coopConfig: encounter "${coopConfig.encounterId}" is not tier "coop"`);
  }

  // Linh Thú (`02` §6): awakened ids exist, actions stay summon-scoped, summon ids resolve.
  const summonById = new Map(summons.map((summon) => [summon.id, summon]));
  for (const summon of summons) {
    const label = `summon "${summon.id}"`;
    if (summon.awakenedId !== undefined && !summonById.has(summon.awakenedId)) {
      errors.push(`${label}: awakenedId references missing summon "${summon.awakenedId}"`);
    }
    if (someEffect(summon.action, (e) => e.type === "summon" || e.type === "chooseCard" || e.type === "createCard") || usesTo(summon.action, "summon")) {
      errors.push(`${label}: action must not use summon, chooseCard, createCard or to "summon"`);
    }
    if (someEffect(summon.action, (e) => e.type === "sealIntent")) {
      errors.push(`${label}: sealIntent is not allowed`);
    }
    if (someEffect(summon.action, (e) => e.type === "revive")) {
      errors.push(`${label}: revive is not allowed`);
    }
  }
  const checkSummonRefs = (label: string, effects: Effect[]) => {
    for (const effect of effects) {
      if (effect.type === "summon" && !summonById.has(effect.summonId)) {
        errors.push(`${label}: summon references missing summon "${effect.summonId}"`);
      }
      if (effect.type === "conditional") checkSummonRefs(label, [...effect.then, ...(effect.else ?? [])]);
    }
  };
  for (const card of cards) {
    checkSummonRefs(`card "${card.id}"`, card.effects);
    if (usesTo(card.effects, "owner")) errors.push(`card "${card.id}": to "owner" is only allowed in summon actions`);
  }

  // Cốt truyện (`02` §1.16): arcs list their stages, stages point back at their arc,
  // their encounter is tier "story" and every speaker is a hero, an enemy or "narrator".
  const stageById = new Map(story.stages.map((s) => [s.id, s]));
  const encounterById = new Map(encounters.map((e) => [e.id, e]));
  const heroIds = new Set(heroes.map((h) => h.id));
  const speakers = new Set(["narrator", ...heroIds, ...enemies.map((e) => e.id)]);
  const arcOfStage = new Map<string, string>();
  for (const arc of story.arcs) {
    if (!heroIds.has(arc.rewardHeroId)) errors.push(`story arc "${arc.id}": rewardHeroId "${arc.rewardHeroId}" does not exist`);
    for (const stageId of arc.stageIds) {
      if (!stageById.has(stageId)) errors.push(`story arc "${arc.id}": stage "${stageId}" does not exist`);
      else if (arcOfStage.has(stageId)) errors.push(`story stage "${stageId}" is in more than one arc`);
      arcOfStage.set(stageId, arc.id);
    }
  }
  for (const s of story.stages) {
    if (arcOfStage.get(s.id) !== s.arcId) errors.push(`story stage "${s.id}": arcId "${s.arcId}" does not list it`);
    if (encounterById.get(s.encounterId)?.tier !== "story") errors.push(`story stage "${s.id}": encounter "${s.encounterId}" must have tier "story"`);
    for (const line of [...s.before, ...s.after]) {
      if (!speakers.has(line.speaker)) errors.push(`story stage "${s.id}": speaker "${line.speaker}" does not exist`);
    }
  }

  return errors;
}

export function parseGameData(raw: unknown): GameData {
  const parsed = rawGameDataSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid game data:\n${z.prettifyError(parsed.error)}`);
  }
  const errors = collectCrossCheckErrors(parsed.data);
  if (errors.length > 0) {
    throw new Error(`Invalid game data:\n- ${errors.join("\n- ")}`);
  }
  const { heroes, cards, enemies, encounters, moonPhases, runRelics, runAugments, runConfig, combatConfig, keywords, metaConfig, economyConfig, missions, achievements, banners, weapons, relics, pvpConfig, coopConfig, coopCombos, summons, story } =
    parsed.data;
  return {
    heroes: Object.fromEntries(heroes.map((hero) => [hero.id, hero])),
    cards: Object.fromEntries(cards.map((card) => [card.id, card])),
    enemies: Object.fromEntries(enemies.map((enemy) => [enemy.id, enemy])),
    encounters: Object.fromEntries(encounters.map((encounter) => [encounter.id, encounter])),
    moonPhases: [...moonPhases].sort((a, b) => a.index - b.index),
    runRelics: Object.fromEntries(runRelics.map((relic) => [relic.id, relic])),
    augments: Object.fromEntries(runAugments.map((augment) => [augment.id, augment])),
    runConfig,
    combatConfig,
    keywords: Object.fromEntries(keywords.map((keyword) => [keyword.id, keyword])),
    metaConfig,
    economyConfig,
    missions: Object.fromEntries(missions.map((mission) => [mission.id, mission])),
    achievements: Object.fromEntries(achievements.map((achievement) => [achievement.id, achievement])),
    banners: Object.fromEntries(banners.map((banner) => [banner.id, banner])),
    weapons: Object.fromEntries(weapons.map((weapon) => [weapon.id, weapon])),
    relics: Object.fromEntries(relics.map((relic) => [relic.id, relic])),
    pvpConfig,
    coopConfig,
    coopCombos: Object.fromEntries(coopCombos.map((combo) => [combo.id, combo])),
    summons: Object.fromEntries(summons.map((summon) => [summon.id, summon])),
    storyArcs: Object.fromEntries(story.arcs.map((arc) => [arc.id, arc])),
    storyStages: Object.fromEntries(story.stages.map((stage) => [stage.id, stage])),
  };
}

/** The raw JSON files `parseGameData` validates; test helpers clone this to build bad inputs. */
export function rawGameInput() {
  return {
    heroes: heroesJson,
    cards: cardsJson,
    enemies: enemiesJson,
    encounters: encountersJson,
    moonPhases: moonPhasesJson,
    runRelics: runRelicsJson,
    runAugments: runAugmentsJson,
    runConfig: runConfigJson,
    combatConfig: combatConfigJson,
    keywords: keywordsJson,
    metaConfig: metaConfigJson,
    economyConfig: economyConfigJson,
    missions: missionsJson,
    achievements: achievementsJson,
    banners: bannersJson,
    weapons: weaponsJson,
    relics: relicsJson,
    pvpConfig: pvpConfigJson,
    coopConfig: coopConfigJson,
    coopCombos: coopCombosJson,
    summons: summonsJson,
    story: storyJson,
  };
}

export function loadGameData(): GameData {
  return parseGameData(rawGameInput());
}
