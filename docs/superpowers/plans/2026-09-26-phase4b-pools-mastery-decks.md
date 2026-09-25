# Giai đoạn 4b (Pool lá, Tu Luyện, xếp deck) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mỗi Hero có pool 12 lá (6 miễn phí + 6 mở bằng Tu Luyện) dùng 7 từ khóa mới; người chơi xếp nhiều deck 18 lá có tên, hồ sơ lưu lâu dài trong trình duyệt.

**Architecture:** Luật từ khóa nằm trong engine trận (`packages/rules/src/effects.ts`, `turn.ts`, `apply-action.ts`, `intent.ts`). Hồ sơ, Tu Luyện và luật deck là hàm thuần mới trong `packages/rules/src/meta/` (`profile.ts`, `deck.ts`), nhận/trả `Profile` bất biến. Client chỉ đọc/ghi `Profile` vào `localStorage` (`profile-store.ts`) và gọi các hàm đó; `createRun` / `createCombat` chỉ nhận danh sách lá.

**Tech Stack:** TypeScript strict, pnpm workspaces, Vitest, zod 4 (`packages/data`), Phaser 4 (`apps/client`).

**Spec:** `docs/13-phase4b-spec.md` — đọc cùng plan này. Khi plan và spec khác nhau về luật, spec là chuẩn.

## Global Constraints

- `packages/rules` là code thuần: không import Phaser/DOM/`window`/`localStorage`/network/fs; không `Math.random()`, không `Date.now()`.
- Mọi ngẫu nhiên qua RNG có seed trong state; cùng seed + cùng chuỗi Action → cùng state và event.
- Hàm thuần không mutate input (`applyAction`, `applyRunAction`, mọi hàm `meta/*`): clone trước khi sửa (`JSON.parse(JSON.stringify(x))` như `clone.ts`).
- Client không tự tính luật; mọi con số hiển thị lấy từ state / data / hàm `rules`.
- Nội dung và hằng số nằm trong JSON của `packages/data` (`meta-config.json`, `keywords.json`, `cards.json`, `heroes.json`).
- Code, tên biến, comment, chuỗi lỗi: tiếng Anh. Chữ cho người chơi: tiếng Việt.
- ID dữ liệu `snake_case`; type `PascalCase`; hàm/biến `camelCase`; thuật ngữ theo `docs/04-glossary.md` (Tích Tụ = `heldTurns`, Liên Hoàn = `cardsPlayedThisTurn`, Tỏa/Đoạt Nguyệt = `drainMoonPower`, Dưỡng Nguyệt = `gainMoonPowerPerTurn`, Phẫn Huyết = `missingHpDamage`, Dư Sinh = `heal.overflow`, Tụ Dược = `burstRegen`, Tu Luyện = `mastery`).
- Union có trường `type` + `switch` đầy đủ với kiểm tra `never` (kể cả `apps/client/src/debug.ts`).
- Không thêm thư viện mới.
- Test đặt tên theo mã (`it("T149: ...")`), mã mới **T149–T168**. Test luật dùng fixture cố định, không phụ thuộc số cân bằng.
- Kết thúc mỗi task: `pnpm test` và `pnpm typecheck` pass, file dùng LF.
- Thay đổi data cân bằng ở Task 7 phải được người dùng duyệt trước khi áp.
- Làm việc trên nhánh `feature/phase4b` (tạo từ `feature/phase4a`).

### Quy tắc sửa test cũ bị vỡ

- Giữ ý định của test; không nới assertion về luật đang test.
- Test dùng **lá thật** chỉ như ví dụ cho một cơ chế (vd. `f04_thao_duoc` = "lá hồi 5 HP", `f04_linh_chi_ho_the` = "lá nhận 6 giáp") mà lá đó đổi cơ chế ở Task 3: chuyển sang **lá fixture** bằng `injectCard` với đúng hiệu ứng cũ. Không đổi kỳ vọng theo lá mới.
- Test kiểm tra con số phụ thuộc cân bằng (số lá, cost): đọc từ data thay vì số cứng.

---

## File Structure

| File | Trách nhiệm |
|---|---|
| `docs/{00-gdd,01-combat-rules,02-data-schema,04-glossary,06-test-scenarios,07-implementation-plan}.md`, `docs/14-meta-rules.md` (mới) | Tài liệu luật (Task 1) |
| `packages/data/keywords.json` (mới) | Giải thích từ khóa cho người chơi |
| `packages/data/meta-config.json` (mới) | Mốc XP, công thức XP, luật deck |
| `packages/data/{cards,heroes}.json` | 63 lá; `lockedCardIds`, `branches` |
| `packages/data/src/{schema,load-game-data}.ts` | Schema + kiểm tra chéo |
| `packages/rules/src/types/{static,state,events,api,run}.ts`, `types/meta.ts` (mới) | Kiểu |
| `packages/rules/src/effects.ts` | Điều kiện Tích Tụ / Liên Hoàn; effect Dư Sinh, Tụ Dược, Phẫn Huyết, Tỏa/Đoạt Nguyệt, Dưỡng Nguyệt |
| `packages/rules/src/intent.ts` | `drainEnemyMoonPower` (hủy chiêu cuối chuỗi) |
| `packages/rules/src/turn.ts`, `draw.ts`, `apply-action.ts`, `create-combat.ts`, `preview.ts` | `heldTurns`, `cardsPlayedThisTurn`, `moonPowerBonus` |
| `packages/rules/src/meta/profile.ts` (mới) | `createProfile`, `masteryLevel`, `pendingUnlocks`, `summarizeRun`, `applyRunResult`, `unlockCard`, `parseProfile` |
| `packages/rules/src/meta/deck.ts` (mới) | `starterDeck`, `validateDeck`, `saveDeck`, `deleteDeck` |
| `packages/rules/src/run/run.ts` | `RunSetup.deckCardIds`, `heroLevelUps`, pool lá thưởng 12 lá |
| `apps/client/src/profile-store.ts` (mới) | Đọc/ghi hồ sơ `localStorage` |
| `apps/client/src/ui/widgets.ts` (mới) | `addText`, `addButton` dùng chung cho 3 màn mới |
| `apps/client/src/ui/card-tooltip.ts` (mới) | Bảng lá lớn + giải thích từ khóa khi di chuột |
| `apps/client/src/scenes/{deck-select,deck-builder,mastery}-scene.ts` (mới) | Màn chọn deck, xếp deck, Tu Luyện |
| `apps/client/src/{main.ts, session.ts, debug.ts}`, `scenes/{team-select,run,combat}-scene.ts`, `ui/event-animator.ts` | Luồng mới, hiển thị từ khóa |

---

### Task 1: Tài liệu luật (bước 4b.1)

**Files:**
- Create: `docs/14-meta-rules.md`
- Modify: `docs/00-gdd.md`, `docs/01-combat-rules.md`, `docs/02-data-schema.md`, `docs/04-glossary.md`, `docs/06-test-scenarios.md`, `docs/07-implementation-plan.md`, `docs/13-phase4b-spec.md`

**Interfaces:** chỉ tài liệu.

- [ ] **Step 1: `01-combat-rules.md`** — chép luật từ spec §2.2:
  - §4.1 Card instance: thêm `heldTurns` (luật Tích Tụ).
  - §3.1 bước 6: `moonPower = base + moonReserve + moonPowerBonus`; thêm "`cardsPlayedThisTurn = 0`" ở đầu lượt.
  - §3.3 Cuối lượt: sau bỏ Tàn Chiêu, "mọi lá còn trên tay `heldTurns += 1`".
  - §5.2 Giải quyết: bước cuối "`cardsPlayedThisTurn += 1`" (sau hook `cardPlayed`).
  - §5.3 / §10: thêm mục Phẫn Huyết, Dư Sinh, Tụ Dược, Tỏa/Đoạt Nguyệt (thuật toán hủy chiêu cuối chuỗi), Dưỡng Nguyệt; điều kiện `heldTurnsAtLeast`, `cardsPlayedThisTurnAtLeast`.
- [ ] **Step 2: `docs/14-meta-rules.md`** (mới) — tiêu đề "# 14 — Luật hồ sơ, Tu Luyện và deck"; nội dung chép spec §4 (meta-config, kiểu, bảng hàm, `parseProfile`) và §5 (SavedDeck, DeckError, luật deck, hàm, lượt chơi / trận lẻ / lá thưởng). Ghi chú đầu file: "Luật trận ở `01`, luật lượt chơi ở `11`."
- [ ] **Step 3: `02-data-schema.md`** — thêm kiểu spec §2.1 (`Condition`, `Effect`, `CardInstance.heldTurns`, `CombatState.cardsPlayedThisTurn/moonPowerBonus`, event `intentsCancelled`), `CardDef.keywords`, `KeywordDef` + `keywords.json`, `HeroDef.lockedCardIds` (thay `rewardCardIds`) và `HeroDef.branches`, `MetaConfig` + `meta-config.json`, `Profile`, `SavedDeck`, `RunResult`, `DeckError`, `RunSetup.deckCardIds`, `RunState.heroLevelUps`.
- [ ] **Step 4: `04-glossary.md`** — thêm dòng: Tích Tụ (`heldTurns`), Liên Hoàn (`cardsPlayedThisTurn`), Tỏa Nguyệt (`drainMoonPower`), Đoạt Nguyệt (`drainMoonPower` + `steal`), Dưỡng Nguyệt (`gainMoonPowerPerTurn`), Phẫn Huyết (`missingHpDamage`), Dư Sinh (`heal.overflow`), Tụ Dược (`burstRegen`), Tu Luyện (`mastery`), Bộ cơ bản (`starterDeck`), lá khóa (`lockedCardIds`), nhánh (`branches`).
- [ ] **Step 5: `06-test-scenarios.md`** — mục "Giai đoạn 4b" với bảng T149–T168 chép từ spec §7.
- [ ] **Step 6: `07-implementation-plan.md`** — tiêu đề "Giai đoạn 0–4b"; mục "## Giai đoạn 4b — Pool lá, Tu Luyện, xếp deck" với 7 bước theo spec §10 (mỗi bước `### Bước 4b.N — <tên>` + một câu).
- [ ] **Step 7: `00-gdd.md` §7.1** — dòng Tinh Hồn 1 và 3: "Mở 1 lá kỹ năng thay thế" → "Mở ngay 1 lá khóa (không cần Tu Luyện)".
- [ ] **Step 8: `13-phase4b-spec.md`** — "**Trạng thái:** đã đưa vào `01`, `02`, `04`, `06`, `07`, `14` (bước 4b.1)."
- [ ] **Step 9: Commit**

```bash
git checkout -b feature/phase4b
git add docs
git commit -m "Step 4b.1: rule docs for keywords, mastery and decks"
```

---

### Task 2: Bảy từ khóa (bước 4b.2)

**Files:**
- Create: `packages/data/keywords.json`, `packages/rules/test/keywords.test.ts`
- Modify: `packages/rules/src/types/{static,state,events,api}.ts`, `src/effects.ts`, `src/intent.ts`, `src/turn.ts`, `src/draw.ts`, `src/apply-action.ts`, `src/create-combat.ts`, `src/preview.ts`
- Modify: `packages/data/src/schema.ts`, `src/load-game-data.ts`, `test/load-game-data.test.ts`
- Modify: `packages/rules/test/helpers.ts`
- Modify: `apps/client/src/debug.ts`, `apps/client/src/ui/event-animator.ts`

**Interfaces:**
- Produces:
  - `Condition` thêm `{ type: "heldTurnsAtLeast"; turns: number }`, `{ type: "cardsPlayedThisTurnAtLeast"; count: number }`.
  - `Effect`: `heal` thêm `overflow?: "armor"`; thêm `{ type: "drainMoonPower"; amount: number; to: TargetRef; steal?: true }`, `{ type: "gainMoonPowerPerTurn"; amount: number }`, `{ type: "missingHpDamage"; ratio: number; to: TargetRef; hits?: number }`, `{ type: "burstRegen"; multiplier: number; to: TargetRef }`.
  - `CardDef.keywords?: string[]`; `interface KeywordDef { id: string; name: string; text: string }`; `GameData.keywords: Record<string, KeywordDef>`.
  - `CardInstance.heldTurns: number`; `CombatState.cardsPlayedThisTurn: number`; `CombatState.moonPowerBonus: number`.
  - Event `{ type: "intentsCancelled"; enemyId: string; intentIds: string[] }`.
  - `EffectContext.instanceId?: string`.
  - `drainEnemyMoonPower(data: GameData, enemy: EnemyState, amount: number, events: CombatEvent[]): number` (intent.ts; trả số thực rút).

- [ ] **Step 1: Viết test thất bại `packages/rules/test/keywords.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import type { CardDef, CombatState, Effect, GameData, IntentDef } from "../src/index";
import { applyAction, drawCards } from "../src/index";
import { idleIntent, strike9Intent } from "./fixtures";
import { idleEnemies, injectCard, makeEnemiesIdle, makeTestCombat, setIntent } from "./helpers";

function card(id: string, effects: Effect[], target: CardDef["target"] = "enemy", type: CardDef["type"] = "attack"): CardDef {
  return { id, name: id, ownerId: "m05", cost: 0, copies: 1, type, tags: [], target, effects, text: "" };
}

function play(data: GameData, state: CombatState, instanceId: string, targetId?: string) {
  const result = applyAction(data, state, { type: "playCard", instanceId, ...(targetId ? { targetId } : {}) });
  if (!result.ok) throw new Error(result.error);
  return result;
}

function end(data: GameData, state: CombatState) {
  const result = applyAction(data, state, { type: "endTurn" });
  if (!result.ok) throw new Error(result.error);
  return result;
}

const idle = { mutateData: makeEnemiesIdle, setup: idleEnemies };

const heldCard = card("test_held", [
  {
    type: "conditional",
    condition: { type: "heldTurnsAtLeast", turns: 1 },
    then: [{ type: "damage", amount: 10, to: "chosen" }],
    else: [{ type: "damage", amount: 1, to: "chosen" }],
  },
]);

const comboCard = card("test_combo", [
  {
    type: "conditional",
    condition: { type: "cardsPlayedThisTurnAtLeast", count: 1 },
    then: [{ type: "damage", amount: 10, to: "chosen" }],
    else: [{ type: "damage", amount: 1, to: "chosen" }],
  },
]);

describe("phase 4b keywords", () => {
  it("T149: Tích Tụ counts turns held in hand; drawn cards start at 0", () => {
    const fresh = makeTestCombat(idle);
    const now = injectCard(fresh.state, fresh.data, heldCard);
    const hp = fresh.state.enemies[0]!.hp;
    expect(play(fresh.data, fresh.state, now, "enemy:0").state.enemies[0]!.hp).toBe(hp - 1);

    const held = makeTestCombat(idle);
    const later = injectCard(held.state, held.data, heldCard);
    const next = end(held.data, held.state);
    expect(next.state.cards[later]!.heldTurns).toBe(1);
    const before = next.state.enemies[0]!.hp;
    expect(play(held.data, next.state, later, "enemy:0").state.enemies[0]!.hp).toBe(before - 10);

    const top = next.state.drawPile[0]!;
    next.state.cards[top]!.heldTurns = 5;
    drawCards(next.state, 1, []);
    expect(next.state.cards[top]!.heldTurns).toBe(0);
  });

  it("T150: Liên Hoàn counts cards already played this turn, excluding the current one", () => {
    const { data, state } = makeTestCombat(idle);
    const first = injectCard(state, data, comboCard);
    const hp = state.enemies[0]!.hp;
    const afterFirst = play(data, state, first, "enemy:0");
    expect(afterFirst.state.enemies[0]!.hp).toBe(hp - 1);
    expect(afterFirst.state.cardsPlayedThisTurn).toBe(1);
    const second = injectCard(afterFirst.state, data, { ...comboCard, id: "test_combo_2" });
    const afterSecond = play(data, afterFirst.state, second, "enemy:0");
    expect(afterSecond.state.enemies[0]!.hp).toBe(hp - 1 - 10);
    expect(end(data, afterSecond.state).state.cardsPlayedThisTurn).toBe(0);
  });

  it("T151: Tỏa Nguyệt drains the fund and cancels intents from the chain's end", () => {
    const { data, state } = makeTestCombat();
    setIntent(state, 0, idleIntent, null);
    const fox = state.enemies[1]!;
    const second: IntentDef = { ...strike9Intent, id: "second" };
    fox.plannedIntents = [
      { intent: idleIntent, cost: 0, targetId: null },
      { intent: strike9Intent, cost: 2, targetId: "hero:m05" },
      { intent: second, cost: 2, targetId: "hero:m05" },
    ];
    fox.moonPower = 4;
    fox.moonReserve = 0;
    const drainOne = injectCard(state, data, card("test_drain_1", [{ type: "drainMoonPower", amount: 1, to: "chosen" }], "enemy", "skill"));
    const drained = play(data, state, drainOne, "enemy:1");
    const after = drained.state.enemies[1]!;
    expect(after.moonPower).toBe(3);
    expect(after.plannedIntents.map((p) => p.intent.id)).toEqual(["idle", strike9Intent.id]);
    expect(after.moonReserve).toBe(1);
    expect(drained.events).toContainEqual({ type: "intentsCancelled", enemyId: "enemy:1", intentIds: ["second"] });
    expect(drained.events).toContainEqual({ type: "moonReserveChanged", side: "enemy", enemyId: "enemy:1", value: 1 });

    const drainAll = injectCard(drained.state, data, card("test_drain_9", [{ type: "drainMoonPower", amount: 9, to: "chosen" }], "enemy", "skill"));
    const emptied = play(data, drained.state, drainAll, "enemy:1").state.enemies[1]!;
    expect(emptied.moonPower).toBe(0);
    expect(emptied.plannedIntents.map((p) => p.intent.id)).toEqual(["idle"]);
  });

  it("T152: Đoạt Nguyệt gives the player exactly what was drained", () => {
    const { data, state } = makeTestCombat();
    state.enemies[1]!.moonPower = 1;
    const power = state.moonPower;
    const steal = injectCard(state, data, card("test_steal", [{ type: "drainMoonPower", amount: 2, to: "chosen", steal: true }], "enemy", "skill"));
    expect(play(data, state, steal, "enemy:1").state.moonPower).toBe(power + 1);
  });

  it("T153: Dưỡng Nguyệt adds moon power every later turn, stacks and exceeds the cap", () => {
    const { data, state } = makeTestCombat(idle);
    const curve = data.combatConfig.moonPower;
    const grow = card("test_grow", [{ type: "gainMoonPowerPerTurn", amount: 2 }], "none", "skill");
    const once = play(data, state, injectCard(state, data, grow), undefined);
    expect(once.state.moonPowerBonus).toBe(2);
    const twice = play(data, once.state, injectCard(once.state, data, { ...grow, id: "test_grow_2" }), undefined);
    expect(twice.state.moonPowerBonus).toBe(4);
    twice.state.moonPower = 0;
    const next = end(data, twice.state);
    expect(next.state.moonPower).toBe(Math.min(curve.cap, curve.start + curve.perRound) + 4);
    let current = next.state;
    for (let i = 0; i < 8; i++) {
      current.moonPower = 0;
      current = end(data, current).state;
    }
    expect(current.moonPower).toBe(curve.cap + 4);
  });

  it("T154: Phẫn Huyết deals damage from missing HP through the damage formula, cards and intents", () => {
    const { data, state } = makeTestCombat(idle);
    state.heroes[0]!.hp = state.heroes[0]!.maxHp - 20;
    const rage = card("test_rage", [{ type: "missingHpDamage", ratio: 0.5, to: "chosen" }]);
    const hp = state.enemies[0]!.hp;
    expect(play(data, state, injectCard(state, data, rage), "enemy:0").state.enemies[0]!.hp).toBe(hp - 10);

    state.heroes[0]!.statuses.push({ id: "strength", value: 2 });
    const strong = play(data, state, injectCard(state, data, { ...rage, id: "test_rage_2" }), "enemy:0");
    expect(strong.state.enemies[0]!.hp).toBe(hp - 12);

    const enemyRage = makeTestCombat();
    const foe = enemyRage.state.enemies[0]!;
    foe.hp = foe.maxHp - 10;
    setIntent(enemyRage.state, 0, {
      id: "test_enemy_rage", name: "rage", kind: "attack", targeting: "front",
      effects: [{ type: "missingHpDamage", ratio: 1, to: "chosen" }],
    }, "hero:m05");
    setIntent(enemyRage.state, 1, idleIntent, null);
    const m05 = enemyRage.state.heroes[0]!.hp;
    expect(end(enemyRage.data, enemyRage.state).state.heroes[0]!.hp).toBe(m05 - 10);
  });

  it("T155: Dư Sinh turns overheal into armor, scaled by the moon armor multiplier", () => {
    const { data, state } = makeTestCombat(idle);
    state.moonIndex = 6; // Hạ Huyền: armor ×1.5
    const hero = state.heroes[0]!;
    hero.hp = hero.maxHp - 2;
    const mend = card("test_mend", [{ type: "heal", amount: 5, to: "chosen", overflow: "armor" }], "ally", "skill");
    const result = play(data, state, injectCard(state, data, mend), hero.id);
    expect(result.state.heroes[0]!.hp).toBe(hero.maxHp);
    expect(result.state.heroes[0]!.armor).toBe(Math.floor(3 * 1.5));
  });

  it("T156: Tụ Dược heals regen × multiplier × moon heal multiplier and removes regen", () => {
    const { data, state } = makeTestCombat(idle);
    state.moonIndex = 4; // Trăng Tròn: heal ×2
    const hero = state.heroes[0]!;
    hero.hp = 10;
    hero.statuses.push({ id: "regen", value: 4 });
    const burst = card("test_burst", [{ type: "burstRegen", multiplier: 2, to: "chosen" }], "ally", "skill");
    const result = play(data, state, injectCard(state, data, burst), hero.id);
    expect(result.state.heroes[0]!.hp).toBe(10 + 4 * 2 * 2);
    expect(result.state.heroes[0]!.statuses.some((s) => s.id === "regen")).toBe(false);

    const none = play(data, result.state, injectCard(result.state, data, { ...burst, id: "test_burst_2" }), hero.id);
    expect(none.events.some((e) => e.type === "healed")).toBe(false);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `pnpm --filter rules test -- keywords`
Expected: FAIL (type errors: `heldTurns`, `cardsPlayedThisTurn`, effect mới không có).

- [ ] **Step 3: Kiểu**

`types/static.ts`: `Effect` thay dòng `heal` và thêm 4 dòng:

```ts
  | { type: "heal"; amount: number; to: TargetRef; overflow?: "armor" }
  | { type: "drainMoonPower"; amount: number; to: TargetRef; steal?: true }
  | { type: "gainMoonPowerPerTurn"; amount: number }
  | { type: "missingHpDamage"; ratio: number; to: TargetRef; hits?: number }
  | { type: "burstRegen"; multiplier: number; to: TargetRef }
```

`Condition` thêm:

```ts
  | { type: "heldTurnsAtLeast"; turns: number }
  | { type: "cardsPlayedThisTurnAtLeast"; count: number };
```

`CardDef` thêm `/** Keyword ids (keywords.json) shown as explanations. */ keywords?: string[];` và:

```ts
export interface KeywordDef {
  id: string;
  name: string;
  text: string;
}
```

`types/api.ts`: `GameData.keywords: Record<string, KeywordDef>`.
`types/state.ts`: `CardInstance.heldTurns: number` (comment "Turns spent in hand (Tích Tụ); 0 when the card enters the hand."); `CombatState` thêm `cardsPlayedThisTurn: number;` và `/** Dưỡng Nguyệt: extra moon power every turn start. */ moonPowerBonus: number;`.
`types/events.ts`: `| { type: "intentsCancelled"; enemyId: string; intentIds: string[] }`.

- [ ] **Step 4: Khởi tạo** — `create-combat.ts`: mọi `cards[instanceId] = {...}` thêm `heldTurns: 0`; `CombatState` thêm `cardsPlayedThisTurn: 0, moonPowerBonus: 0`. `test/helpers.ts` `injectCard`: `state.cards[instanceId] = { instanceId, cardId: card.id, ownerIds, heldTurns: 0 };`.

- [ ] **Step 5: `draw.ts`** — trong `drawCards` sau `splice`:

```ts
  for (const id of drawn) state.cards[id]!.heldTurns = 0;
```

`effects.ts` case `chooseCard` nhánh 1 lá: trước `state.hand.push(options[0]!)` thêm `state.cards[options[0]!]!.heldTurns = 0;`. `apply-action.ts` hàm `chooseCard`: trước `state.hand.push(instanceId)` thêm `state.cards[instanceId]!.heldTurns = 0;`; hàm `mulligan`: sau `const drawn = state.drawPile.splice(...)` thêm `for (const id of drawn) state.cards[id]!.heldTurns = 0;`.

- [ ] **Step 6: `turn.ts`**
  - `startPlayerTurn`: ngay sau `events.push({ type: "turnStarted", ... })` thêm `state.cardsPlayedThisTurn = 0;`; dòng tính Nguyệt Lực thành `state.moonPower = baseMoonPower(curve, curve.perRound, state.round) + state.moonReserve + state.moonPowerBonus;`.
  - `runEndTurn`: ngay sau khối bỏ Tàn Chiêu thêm `for (const id of state.hand) state.cards[id]!.heldTurns += 1;`.

- [ ] **Step 7: `apply-action.ts` `playCard`** — `resolveEffects(..., { source: owner, actors: owners, card, chosenId: action.targetId, instanceId: instance.instanceId }, events)`; sau `state.discardPile.push(instance.instanceId);` thêm `state.cardsPlayedThisTurn += 1;`. Trong `attackCleanupTargets` `walk`: `if (effect.type === "damage" || effect.type === "missingHpDamage") damageActors.add(actor);`.

- [ ] **Step 8: `intent.ts`** — thêm:

```ts
/** Tỏa Nguyệt: shrink an enemy's planned fund, cancelling intents from the chain's end (`01` §9). */
export function drainEnemyMoonPower(
  data: GameData,
  enemy: EnemyState,
  amount: number,
  events: CombatEvent[],
): number {
  const drained = Math.min(amount, enemy.moonPower);
  enemy.moonPower -= drained;
  const planned = () => enemy.plannedIntents.reduce((sum, entry) => sum + entry.cost, 0);
  const cancelled: string[] = [];
  while (enemy.plannedIntents.length > 0 && planned() > enemy.moonPower) {
    cancelled.push(enemy.plannedIntents.pop()!.intent.id);
  }
  if (cancelled.length > 0) {
    events.push({ type: "intentsCancelled", enemyId: enemy.id, intentIds: cancelled });
  }
  const reserve = Math.min(data.combatConfig.moonReserveMax, enemy.moonPower - planned());
  if (reserve !== enemy.moonReserve) {
    enemy.moonReserve = reserve;
    events.push({ type: "moonReserveChanged", side: "enemy", enemyId: enemy.id, value: reserve });
  }
  return drained;
}
```

(import kiểu `EnemyState`.)

- [ ] **Step 9: `effects.ts`**
  - `EffectContext` thêm `/** Instance of the card being played (Tích Tụ). */ instanceId?: string;`.
  - `evalCondition` thêm:

```ts
    case "heldTurnsAtLeast": {
      const instance = ctx.instanceId !== undefined ? state.cards[ctx.instanceId] : undefined;
      return instance !== undefined && instance.heldTurns >= condition.turns;
    }
    case "cardsPlayedThisTurnAtLeast":
      return state.cardsPlayedThisTurn >= condition.count;
```

  - case `heal` thay bằng:

```ts
    case "heal": {
      const multiplier = moonHealMultiplier(data, state);
      for (const target of resolveTargets(state, effect.to, ctx)) {
        const raw = Math.floor(effect.amount * multiplier);
        const healed = Math.min(target.maxHp - target.hp, raw);
        if (healed > 0) {
          target.hp += healed;
          events.push({ type: "healed", targetId: target.id, amount: healed });
        }
        if (effect.overflow === "armor" && raw > healed) {
          const armor = Math.floor((raw - healed) * moonArmorMultiplier(data, state));
          if (armor > 0) {
            target.armor += armor;
            events.push({ type: "armorGained", targetId: target.id, amount: armor });
          }
        }
      }
      return;
    }
```

  - thêm các case (trước `default`):

```ts
    case "burstRegen": {
      const multiplier = moonHealMultiplier(data, state);
      for (const target of resolveTargets(state, effect.to, ctx)) {
        const regen = getStatus(target, "regen");
        if (!regen) continue;
        const healed = Math.min(
          target.maxHp - target.hp,
          Math.floor(regen.value * effect.multiplier * multiplier),
        );
        if (healed > 0) {
          target.hp += healed;
          events.push({ type: "healed", targetId: target.id, amount: healed });
        }
        removeStatus(target, "regen", events);
      }
      return;
    }
    case "missingHpDamage": {
      const hits = effect.hits ?? 1;
      for (const target of resolveTargets(state, effect.to, ctx)) {
        for (let hit = 0; hit < hits && target.alive && target.hp > 0; hit++) {
          const base = Math.floor((ctx.source.maxHp - ctx.source.hp) * effect.ratio);
          dealDamage(data, state, ctx, target, base, events);
          if (!ctx.source.alive) return;
        }
      }
      return;
    }
    case "drainMoonPower": {
      let drained = 0;
      for (const target of resolveTargets(state, effect.to, ctx)) {
        if (target.side !== "enemy") continue;
        drained += drainEnemyMoonPower(data, target as EnemyState, effect.amount, events);
      }
      if (effect.steal && drained > 0) {
        state.moonPower += drained;
        events.push({ type: "moonPowerChanged", value: state.moonPower });
      }
      return;
    }
    case "gainMoonPowerPerTurn": {
      state.moonPowerBonus += effect.amount;
      return;
    }
```

  (import `drainEnemyMoonPower` từ `./intent`, kiểu `EnemyState`.)
  - `resolveEffects`: `cardDamage: ctx.card !== undefined && (effect.type === "damage" || effect.type === "missingHpDamage"),`.

- [ ] **Step 10: `preview.ts`** — trong `previewIntent`, vòng effect: xử lý cả `missingHpDamage` (damage gốc = `Math.floor((enemy.maxHp - enemy.hp) * effect.ratio)`), còn lại như `damage`:

```ts
  for (const effect of intent.effects) {
    if (effect.type !== "damage" && effect.type !== "missingHpDamage") continue;
    const base =
      effect.type === "damage" ? effect.amount : Math.floor((enemy.maxHp - enemy.hp) * effect.ratio);
    // ...targets như cũ, dùng `base` thay `effect.amount` trong computeDamageAmount
  }
```

- [ ] **Step 11: `keywords.json`**

```json
[
  { "id": "tich_tu", "name": "Tích Tụ", "text": "Lá mạnh hơn nếu đã nằm trên tay đủ số lượt (mỗi cuối lượt lá còn trên tay được tính 1)." },
  { "id": "lien_hoan", "name": "Liên Hoàn", "text": "Lá mạnh hơn nếu trong lượt này đã đánh đủ số lá trước nó." },
  { "id": "toa_nguyet", "name": "Tỏa Nguyệt", "text": "Kẻ địch mất Nguyệt Lực; chiêu cuối chuỗi đã báo bị hủy cho tới khi đủ tiền." },
  { "id": "doat_nguyet", "name": "Đoạt Nguyệt", "text": "Như Tỏa Nguyệt, và bạn nhận đúng số Nguyệt Lực đã lấy." },
  { "id": "duong_nguyet", "name": "Dưỡng Nguyệt", "text": "Từ lượt sau, mỗi lượt nhận thêm Nguyệt Lực đến hết trận (vượt được trần)." },
  { "id": "phan_huyet", "name": "Phẫn Huyết", "text": "Gây damage theo số HP người đánh đã mất." },
  { "id": "du_sinh", "name": "Dư Sinh", "text": "Phần hồi máu vượt HP tối đa biến thành giáp." },
  { "id": "tu_duoc", "name": "Tụ Dược", "text": "Kích nổ Hồi Phục: hồi ngay theo Hồi Phục còn lại, rồi mất Hồi Phục." },
  { "id": "chiem_bai", "name": "Chiêm Bài", "text": "Xem các lá trên cùng chồng bài, lấy 1, các lá còn lại xuống đáy chồng." },
  { "id": "an_than", "name": "Ẩn Thân", "text": "Không bị chọn làm mục tiêu đơn; mất khi đánh lá tấn công." },
  { "id": "khieu_khich", "name": "Khiêu Khích", "text": "Kẻ địch buộc phải nhắm vào Hero này." },
  { "id": "suy_yeu", "name": "Suy Yếu", "text": "Gây ít damage hơn (×0.75)." },
  { "id": "de_vo", "name": "Dễ Vỡ", "text": "Nhận nhiều damage hơn (×1.5)." },
  { "id": "danh_dau", "name": "Đánh Dấu", "text": "Nhận thêm 3 damage từ đòn tấn công của người đánh dấu." },
  { "id": "thieu_dot", "name": "Thiêu Đốt", "text": "Mất HP đầu lượt, giảm dần." },
  { "id": "hoi_phuc", "name": "Hồi Phục", "text": "Hồi HP đầu lượt, giảm dần." },
  { "id": "suc_manh", "name": "Sức Mạnh", "text": "Mỗi đòn tấn công gây thêm damage." },
  { "id": "cuong_hoa", "name": "Cường Hóa", "text": "Lá tấn công tiếp theo gây thêm damage." },
  { "id": "dong_bang", "name": "Đóng Băng", "text": "Kẻ địch bỏ lượt; Hero bị Đóng Băng không đánh được lá của mình trong lượt." },
  { "id": "phan_don", "name": "Phản Đòn", "text": "Kẻ đánh trúng mất HP." },
  { "id": "huyet_nguyet", "name": "Huyết Nguyệt", "text": "Mọi Hero mất HP mỗi lượt; mở khóa các lá Cấm Thuật." }
]
```

- [ ] **Step 12: Schema** — `schema.ts`:
  - `conditionSchema` thêm `z.object({ type: z.literal("heldTurnsAtLeast"), turns: z.number().int().positive() })`, `z.object({ type: z.literal("cardsPlayedThisTurnAtLeast"), count: z.number().int().positive() })`.
  - `effectSchema`: dòng `heal` thêm `overflow: z.literal("armor").optional()`; thêm

```ts
    z.object({ actor, type: z.literal("drainMoonPower"), amount: z.number().int().positive(), to: z.enum(["chosen", "allEnemies"]), steal: z.literal(true).optional() }),
    z.object({ actor, type: z.literal("gainMoonPowerPerTurn"), amount: z.number().int().positive() }),
    z.object({ actor, type: z.literal("missingHpDamage"), ratio: z.number().gt(0).lte(2), to: targetRefSchema, hits: z.number().int().positive().optional() }),
    z.object({ actor, type: z.literal("burstRegen"), multiplier: z.number().positive(), to: targetRefSchema }),
```

  - `cardDefSchema` thêm `keywords: z.array(idSchema).optional(),`.
  - `export const keywordDefSchema = z.object({ id: idSchema, name: z.string().min(1), text: z.string().min(1) });`; `rawGameDataSchema` thêm `keywords: z.array(keywordDefSchema),`.

- [ ] **Step 13: Kiểm tra chéo** — `load-game-data.ts` (import `keywordsJson from "../keywords.json"`, truyền `keywords` ở `loadGameData`, trả `keywords: Object.fromEntries(keywords.map((k) => [k.id, k]))` ở `parseGameData`, thêm `["keywords", keywords]` vào `groups` kiểm tra trùng id). Trong `collectCrossCheckErrors`:

```ts
  const cardOnly = (effect: Effect): boolean =>
    effect.type === "drainMoonPower" ||
    effect.type === "gainMoonPowerPerTurn" ||
    effect.type === "burstRegen" ||
    (effect.type === "heal" && effect.overflow !== undefined) ||
    (effect.type === "conditional" &&
      (effect.condition.type === "heldTurnsAtLeast" || effect.condition.type === "cardsPlayedThisTurnAtLeast"));
  const keywordIds = new Set(keywords.map((keyword) => keyword.id));
```

  - vòng `cards`: `for (const id of card.keywords ?? []) if (!keywordIds.has(id)) errors.push(\`card "${card.id}": unknown keyword "${id}"\`);` và `if (card.target !== "enemy" && someEffect(card.effects, (e) => e.type === "drainMoonPower" && e.to === "chosen")) errors.push(\`card "${card.id}": drainMoonPower to "chosen" needs target "enemy"\`);`
  - vòng intent của enemy: `if (someEffect(intent.effects, cardOnly)) errors.push(\`enemy "${enemy.id}" intent "${intent.id}": card-only keyword\`);`
  - vòng hook Kỳ Vật: `if (someEffect(hook.effects, (e) => cardOnly(e) || e.type === "missingHpDamage")) errors.push(\`${label}: card-only keyword\`);`

  Lưu ý: `someEffect` duyệt `effect.then/else` nhưng `cardOnly` cần thấy chính effect `conditional` — `someEffect` gọi `test(effect)` trên cả effect `conditional` nên đã đúng.

- [ ] **Step 14: Test schema** — `packages/data/test/load-game-data.test.ts`: `rawData()` thêm `keywords: keywordsJson` (import), và:

```ts
  it("T157: rejects card-only keywords in enemy intents and relic hooks, and unknown card keywords", () => {
    const intent = rawData();
    intent.enemies[0].intents[0].effects.push({ type: "drainMoonPower", amount: 1, to: "chosen" });
    expect(() => parseGameData(intent)).toThrowError(/card-only keyword/);

    const hook = rawData();
    hook.runRelics[0].hooks[0].effects.push({ type: "missingHpDamage", ratio: 1, to: "allEnemies" });
    expect(() => parseGameData(hook)).toThrowError(/card-only keyword/);

    const keyword = rawData();
    keyword.cards[0].keywords = ["no_such_keyword"];
    expect(() => parseGameData(keyword)).toThrowError(/unknown keyword/);
  });
```

  (`runRelics[0]` là Nguyệt Giáp Phù, có `hooks[0]`.)

- [ ] **Step 15: Client** — `debug.ts` thêm case:

```ts
    case "intentsCancelled":
      return `${name(event.enemyId)} bị hủy ${event.intentIds.join(", ")}`;
```

`ui/event-animator.ts` thêm case:

```ts
    case "intentsCancelled": {
      const anchor = anchorOf(event.enemyId);
      if (!anchor) return instant();
      return floatText(scene, anchor.x, anchor.y - 110, `Tỏa Nguyệt: hủy ${event.intentIds.length} chiêu`, "#9fd4ff", 13, 300);
    }
```

- [ ] **Step 16: Chạy toàn bộ**

Run: `pnpm test && pnpm typecheck`
Expected: PASS (T149–T157 mới pass).

- [ ] **Step 17: Commit**

```bash
git add packages apps
git commit -m "Step 4b.2: keywords Tích Tụ, Liên Hoàn, Tỏa/Đoạt Nguyệt, Dưỡng Nguyệt, Phẫn Huyết, Dư Sinh, Tụ Dược"
```

---

### Task 3: Nội dung 60 lá + nhánh (bước 4b.3)

**Files:**
- Modify: `packages/data/cards.json`, `packages/data/heroes.json`
- Modify: `packages/data/src/schema.ts`, `src/load-game-data.ts`, `test/load-game-data.test.ts`
- Modify: `packages/rules/src/types/static.ts`, `src/run/run.ts`
- Modify: test luật dùng lá đổi cơ chế (danh sách Step 6), `packages/rules/test/run.test.ts`

**Interfaces:**
- Consumes: effect/điều kiện Task 2.
- Produces:
  - `HeroDef.lockedCardIds: string[]` (6; thay `rewardCardIds`); `HeroDef.branches: [HeroBranch, HeroBranch]`, `interface HeroBranch { name: string; cardIds: string[] }`.
  - `cards.json` 63 lá theo spec §3.

- [ ] **Step 1: Kiểu + schema**
  - `static.ts` `HeroDef`: thay `rewardCardIds` bằng `/** Mastery-unlocked cards; with cardIds forms the 12-card pool. */ lockedCardIds: string[];` và `branches: [HeroBranch, HeroBranch];` + `export interface HeroBranch { name: string; cardIds: string[] }`.
  - `schema.ts` `heroDefSchema`: `lockedCardIds: z.array(idSchema).length(6),` (thay `rewardCardIds`), `branches: z.tuple([branchSchema, branchSchema]),` với `const branchSchema = z.object({ name: z.string().min(1), cardIds: z.array(idSchema).length(6) });`.
  - `load-game-data.ts`: vòng `rewardCardIds` đổi thành `lockedCardIds` (thông báo lỗi `lockedCardIds …`, `locked card … is also a starting card`); thêm:

```ts
  for (const hero of heroes) {
    const pool = new Set([...hero.cardIds, ...hero.lockedCardIds]);
    const branchCards = hero.branches.flatMap((branch) => branch.cardIds);
    if (new Set(branchCards).size !== branchCards.length || branchCards.some((id) => !pool.has(id)) || branchCards.length !== pool.size) {
      errors.push(`hero "${hero.id}": branches must split the 12-card pool exactly`);
    }
    const cheapFree = hero.cardIds.filter((id) => (cardById.get(id)?.cost ?? 99) <= 3).length;
    if (cheapFree < 2) errors.push(`hero "${hero.id}": needs at least 2 free cards with cost <= 3`);
  }
```

  - `run/run.ts` `drawCardChoices`: `.flatMap((hero) => data.heroes[hero.defId]!.lockedCardIds)` (pool 12 lá đầy đủ làm ở Task 5).

- [ ] **Step 2: `cards.json`** — script tạm (không commit), chạy từ `packages/data`. Script sửa lá "Giữ" bằng patch, thay lá "Sửa"/"Mới" bằng object đầy đủ, bỏ `f03_suong_giap`, xếp lại theo pool từng Hero (miễn phí rồi khóa) và 3 lá Song Hành cuối:

```bash
cat > "$TMPDIR/cards-4b.cjs" <<'EOF'
const fs = require("fs");
const old = new Map(JSON.parse(fs.readFileSync("cards.json", "utf8")).map((c) => [c.id, c]));
const kw = (...ids) => ids;
const patch = {
  m05_tran_bac_huyet_tinh: { cost: 0, copies: 3, keywords: kw("cuong_hoa") },
  m05_ho_gam: { cost: 2, copies: 3, keywords: kw("khieu_khich") },
  m05_liet_hoa_xung_phong: { cost: 4, copies: 3 },
  m05_bat_dong_nhu_son: { cost: 4, copies: 3, keywords: kw("phan_don") },
  f04_nguyet_quang_dan: { cost: 4, copies: 3, keywords: kw("chiem_bai") },
  m06_am_tien: { cost: 2, copies: 3, keywords: kw("an_than") },
  m06_doat_menh: { cost: 4, copies: 3 },
  m06_nguyet_anh_an: { cost: 2, copies: 3, keywords: kw("danh_dau") },
  m06_tang_anh_thich: { cost: 2, copies: 3, keywords: kw("an_than") },
  f03_han_an: { cost: 2, copies: 3, keywords: kw("dong_bang") },
  f03_suong_tram: { cost: 2, copies: 3, keywords: kw("dong_bang") },
  f02_anh_tap: { cost: 2, copies: 3 },
  f02_doi_van_chu: { cost: 4, copies: 3, keywords: kw("huyet_nguyet") },
  f02_phe_hon: { cost: 6, copies: 2, keywords: kw("huyet_nguyet") },
  f02_huyet_khe: { cost: 0, copies: 2 },
  f02_ta_nguyet_chu: { cost: 0, copies: 3, keywords: kw("huyet_nguyet") },
  bond_bang_hoa_tranh_phong: { keywords: kw("dong_bang") },
  bond_tuyet_trung_tong_than: { keywords: kw("dong_bang", "hoi_phuc") },
};
const D = (amount, to = "chosen", extra = {}) => ({ type: "damage", amount, to, ...extra });
const ifHeld = (turns, then, otherwise) => ({ type: "conditional", condition: { type: "heldTurnsAtLeast", turns }, then, ...(otherwise ? { else: otherwise } : {}) });
const ifCombo = (count, then, otherwise) => ({ type: "conditional", condition: { type: "cardsPlayedThisTurnAtLeast", count }, then, ...(otherwise ? { else: otherwise } : {}) });
const S = (status, amount, to = "chosen") => ({ type: "applyStatus", status, amount, to });
const drain = (amount, to = "chosen", steal = false) => ({ type: "drainMoonPower", amount, to, ...(steal ? { steal: true } : {}) });
const C = (id, name, ownerId, cost, copies, type, tags, target, effects, text, keywords, extra = {}) =>
  ({ id, name, ownerId, cost, copies, type, tags, target, effects, text, ...(keywords.length ? { keywords } : {}), ...extra });
const full = [
  // M05
  C("m05_thuong_pha", "Thương Phá", "m05", 1, 3, "attack", ["attack"], "enemy", [{ type: "removeArmor", to: "chosen" }, D(3)], "Xóa giáp của mục tiêu, rồi gây 3 damage.", []),
  C("m05_bat_khuat", "Bất Khuất", "m05", 3, 3, "skill", ["heal"], "none", [{ type: "conditional", condition: { type: "selfHpBelow", ratio: 0.5 }, then: [{ type: "heal", amount: 10, to: "self" }, S("strength", 1, "self")], else: [{ type: "heal", amount: 4, to: "self" }] }], "Hồi 4 HP. Nếu HP dưới 50%: hồi 10 và nhận 1 Sức Mạnh.", kw("suc_manh")),
  C("m05_huyet_chien", "Huyết Chiến", "m05", 2, 3, "attack", ["attack"], "enemy", [{ type: "missingHpDamage", ratio: 0.5, to: "chosen" }], "Phẫn Huyết: gây damage bằng 50% số HP Hoắc Liệt đã mất.", kw("phan_huyet")),
  C("m05_thiet_bich", "Thiết Bích", "m05", 3, 3, "skill", ["ward"], "none", [ifHeld(1, [{ type: "gainArmor", amount: 7, to: "allAllies" }], [{ type: "gainArmor", amount: 4, to: "allAllies" }])], "Mọi Hero nhận 4 giáp. Tích Tụ 1: nhận 7 giáp.", kw("tich_tu")),
  C("m05_no_hoa_lien_hoan", "Nộ Hỏa Liên Hoàn", "m05", 5, 2, "attack", ["attack"], "enemy", [ifCombo(2, [D(3, "chosen", { hits: 5 })], [D(3, "chosen", { hits: 3 })])], "Gây 3 damage 3 lần. Liên Hoàn 2: 5 lần.", kw("lien_hoan")),
  C("m05_lo_luyen", "Lò Luyện", "m05", 5, 2, "attack", ["attack"], "enemy", [ifHeld(2, [D(20)], [ifHeld(1, [D(14)], [D(8)])])], "Gây 8 damage. Tích Tụ 1: 14. Tích Tụ 2: 20.", kw("tich_tu")),
  C("m05_huyet_thuan", "Huyết Thuẫn", "m05", 6, 2, "skill", ["heal", "ward"], "none", [{ type: "heal", amount: 8, to: "self", overflow: "armor" }, S("taunt", 1, "self"), S("reflect", 4, "self")], "Hồi 8 HP (Dư Sinh). Khiêu Khích 1 vòng, Phản Đòn 4.", kw("du_sinh", "khieu_khich", "phan_don")),
  C("m05_liet_hoa_phan_thien", "Liệt Hỏa Phần Thiên", "m05", 8, 2, "attack", ["attack"], "none", [{ type: "loseHp", amount: 6, to: "self" }, { type: "missingHpDamage", ratio: 1, to: "allEnemies" }], "Mất 6 HP. Phẫn Huyết lên mọi kẻ địch: gây damage bằng số HP Hoắc Liệt đã mất.", kw("phan_huyet")),
  // F04
  C("f04_bach_thao_huong", "Bách Thảo Hương", "f04", 2, 3, "skill", ["heal", "harmony"], "ally", [{ type: "conditional", condition: { type: "targetHasStatus", status: "regen" }, then: [S("regen", 5)], else: [S("regen", 3)] }], "Áp 3 Hồi Phục cho 1 Hero. Nếu Hero đó đã có Hồi Phục: áp 5.", kw("hoi_phuc")),
  C("f04_linh_chi_ho_the", "Linh Chi Hộ Thể", "f04", 2, 3, "skill", ["heal"], "ally", [{ type: "burstRegen", multiplier: 1, to: "chosen" }, { type: "gainArmor", amount: 4, to: "chosen" }], "Tụ Dược 1 cho 1 Hero, rồi Hero đó nhận 4 giáp.", kw("tu_duoc")),
  C("f04_hoi_xuan_tan", "Hồi Xuân Tán", "f04", 4, 3, "skill", ["heal", "harmony"], "none", [ifHeld(1, [S("regen", 4, "allAllies")], [S("regen", 2, "allAllies")])], "Mọi Hero nhận 2 Hồi Phục. Tích Tụ 1: 4.", kw("hoi_phuc", "tich_tu")),
  C("f04_thao_duoc", "Thảo Dược", "f04", 2, 3, "skill", ["heal", "harmony"], "ally", [{ type: "heal", amount: 5, to: "chosen", overflow: "armor" }], "Hồi 5 HP cho 1 Hero (Dư Sinh).", kw("du_sinh")),
  C("f04_tinh_tam_tra", "Tịnh Tâm Trà", "f04", 3, 3, "skill", ["heal", "harmony"], "ally", [{ type: "cleanse", to: "chosen" }, { type: "heal", amount: 3, to: "chosen", overflow: "armor" }, { type: "chooseCard", look: 2 }], "Giải trừ 1 Hero, hồi 3 HP (Dư Sinh). Chiêm Bài 2.", kw("du_sinh", "chiem_bai")),
  C("f04_xuan_phong", "Xuân Phong", "f04", 1, 3, "skill", ["heal", "harmony"], "ally", [ifCombo(2, [S("regen", 2, "allAllies")], [S("regen", 2)])], "Áp 2 Hồi Phục cho 1 Hero. Liên Hoàn 2: cho mọi Hero.", kw("hoi_phuc", "lien_hoan")),
  C("f04_thanh_tam_chu", "Thanh Tâm Chú", "f04", 4, 3, "skill", ["harmony"], "none", [{ type: "cleanse", to: "allAllies" }, S("regen", 1, "allAllies"), { type: "chooseCard", look: 3 }], "Giải trừ mọi Hero, mọi Hero nhận 1 Hồi Phục. Chiêm Bài 3.", kw("hoi_phuc", "chiem_bai")),
  C("f04_bach_hoa_tu_duoc", "Bách Hoa Tụ Dược", "f04", 6, 2, "skill", ["heal", "harmony"], "none", [{ type: "burstRegen", multiplier: 2, to: "allAllies" }], "Tụ Dược 2 lên mọi Hero.", kw("tu_duoc")),
  C("f04_bang_tam_quyet", "Băng Tâm Quyết", "f04", 2, 3, "skill", ["control", "harmony"], "enemy", [S("weak", 2), drain(1)], "Suy Yếu 1 kẻ địch 2 vòng. Tỏa Nguyệt 1.", kw("suy_yeu", "toa_nguyet")),
  C("f04_nguyet_lo", "Nguyệt Lộ", "f04", 4, 2, "skill", ["heal", "moon"], "ally", [{ type: "gainMoonPowerPerTurn", amount: 1 }, { type: "heal", amount: 3, to: "chosen" }], "Dưỡng Nguyệt 1. Hồi 3 HP cho 1 Hero.", kw("duong_nguyet")),
  C("f04_tinh_tam_quyet", "Tĩnh Tâm Quyết", "f04", 6, 2, "skill", ["heal", "harmony"], "none", [{ type: "heal", amount: 5, to: "allAllies", overflow: "armor" }, { type: "cleanse", to: "allAllies" }], "Mọi Hero hồi 5 HP (Dư Sinh), rồi được giải trừ.", kw("du_sinh")),
  // M06
  C("m06_anh_bo", "Ảnh Bộ", "m06", 1, 3, "skill", ["assassin"], "none", [S("stealth", 1, "self"), S("empower", 2, "self")], "Ẩn Thân 1 vòng, nhận Cường Hóa 2.", kw("an_than", "cuong_hoa")),
  C("m06_phi_tieu", "Phi Tiêu", "m06", 0, 3, "attack", ["attack"], "enemy", [ifCombo(2, [D(2, "chosen", { hits: 2 })], [D(2)])], "Gây 2 damage. Liên Hoàn 2: 2 lần.", kw("lien_hoan")),
  C("m06_song_nhan_loan_vu", "Song Nhận Loạn Vũ", "m06", 3, 3, "attack", ["attack", "assassin"], "none", [ifCombo(2, [D(6, "allEnemies")], [D(3, "allEnemies")])], "Gây 3 damage lên mọi kẻ địch. Liên Hoàn 2: 6.", kw("lien_hoan")),
  C("m06_anh_phan_than", "Ảnh Phân Thân", "m06", 4, 3, "skill", ["assassin"], "enemy", [S("stealth", 2, "self"), drain(2)], "Ẩn Thân 2 vòng. Tỏa Nguyệt 2 lên 1 kẻ địch.", kw("an_than", "toa_nguyet")),
  C("m06_tuyet_menh", "Tuyệt Mệnh", "m06", 6, 2, "attack", ["attack", "assassin"], "enemy", [ifHeld(2, [D(30)], [D(12)])], "Gây 12 damage. Tích Tụ 2: 30.", kw("tich_tu")),
  C("m06_doc_tieu", "Độc Tiêu", "m06", 2, 3, "skill", ["control"], "enemy", [S("vulnerable", 2), ifCombo(2, [S("mark", 2)])], "Dễ Vỡ 1 kẻ địch 2 vòng. Liên Hoàn 2: thêm Đánh Dấu 2 vòng.", kw("de_vo", "danh_dau", "lien_hoan")),
  C("m06_anh_toc", "Ảnh Tốc", "m06", 2, 3, "skill", ["assassin"], "none", [ifCombo(3, [{ type: "gainMoonPower", amount: 4 }], [{ type: "gainMoonPower", amount: 2 }])], "Nhận 2 Nguyệt Lực. Liên Hoàn 3: nhận 4.", kw("lien_hoan")),
  C("m06_loan_anh", "Loạn Ảnh", "m06", 5, 2, "attack", ["attack", "assassin"], "enemy", [ifCombo(4, [D(2, "chosen", { hits: 6 })], [ifCombo(2, [D(2, "chosen", { hits: 4 })], [D(2, "chosen", { hits: 2 })])])], "Gây 2 damage 2 lần. Liên Hoàn 2: 4 lần. Liên Hoàn 4: 6 lần.", kw("lien_hoan")),
  // F03
  C("f03_phong_tuyet_chuong", "Phong Tuyết Chướng", "f03", 4, 3, "skill", ["ward"], "none", [{ type: "gainArmor", amount: 4, to: "allAllies" }, drain(1, "allEnemies")], "Mọi Hero nhận 4 giáp. Tỏa Nguyệt 1 lên mọi kẻ địch.", kw("toa_nguyet")),
  C("f03_tuyet_vu", "Tuyết Vũ", "f03", 4, 3, "attack", ["attack"], "none", [D(3, "allEnemies"), drain(1, "allEnemies")], "Gây 3 damage lên mọi kẻ địch. Tỏa Nguyệt 1 lên mọi kẻ địch.", kw("toa_nguyet")),
  C("f03_bang_phach_lien_kich", "Băng Phách Liên Kích", "f03", 4, 3, "attack", ["attack"], "enemy", [ifHeld(1, [D(3, "chosen", { hits: 4 })], [D(3, "chosen", { hits: 2 })])], "Gây 3 damage 2 lần. Tích Tụ 1: 4 lần.", kw("tich_tu")),
  C("f03_tuyet_han", "Tuyệt Hàn", "f03", 5, 2, "attack", ["attack"], "enemy", [D(9), ifHeld(1, [S("freeze", 1)])], "Gây 9 damage. Tích Tụ 1: Đóng Băng mục tiêu.", kw("tich_tu", "dong_bang")),
  C("f03_bang_cham", "Băng Châm", "f03", 1, 3, "attack", ["attack"], "enemy", [D(2), drain(1)], "Gây 2 damage. Tỏa Nguyệt 1.", kw("toa_nguyet")),
  C("f03_han_khi_nhap_mach", "Hàn Khí Nhập Mạch", "f03", 2, 3, "skill", ["control"], "enemy", [drain(3)], "Tỏa Nguyệt 3 lên 1 kẻ địch.", kw("toa_nguyet")),
  C("f03_vinh_dong", "Vĩnh Đông", "f03", 8, 1, "skill", ["control"], "none", [S("freeze", 1, "allEnemies"), drain(2, "allEnemies")], "Đóng Băng mọi kẻ địch. Tỏa Nguyệt 2 lên mọi kẻ địch.", kw("dong_bang", "toa_nguyet")),
  C("f03_han_phong", "Hàn Phong", "f03", 2, 3, "skill", ["control"], "enemy", [ifHeld(1, [S("vulnerable", 2, "allEnemies")], [S("vulnerable", 2)])], "Dễ Vỡ 2 lên 1 kẻ địch. Tích Tụ 1: lên mọi kẻ địch.", kw("de_vo", "tich_tu")),
  C("f03_bang_toai", "Băng Toái", "f03", 5, 2, "attack", ["attack"], "enemy", [{ type: "conditional", condition: { type: "targetHasStatus", status: "freeze" }, then: [D(18), { type: "cleanse", to: "chosen" }], else: [D(6)] }], "Gây 6 damage. Nếu mục tiêu đang Đóng Băng: gây 18 và phá băng (gỡ mọi debuff của mục tiêu).", kw("dong_bang")),
  C("f03_han_son_nhat_kiem", "Hàn Sơn Nhất Kiếm", "f03", 7, 2, "attack", ["attack"], "enemy", [ifHeld(2, [D(26), S("freeze", 1)], [ifHeld(1, [D(18)], [D(10)])])], "Gây 10 damage. Tích Tụ 1: 18. Tích Tụ 2: 26 và Đóng Băng mục tiêu.", kw("tich_tu", "dong_bang")),
  // F02
  C("f02_dien_doat", "Diện Đoạt", "f02", 2, 3, "skill", ["scheme"], "enemy", [{ type: "stealBuff", count: 1 }, drain(1, "chosen", true)], "Cướp 1 buff của kẻ địch. Đoạt Nguyệt 1.", kw("doat_nguyet")),
  C("f02_dien_cu", "Diện Cụ", "f02", 3, 3, "skill", ["scheme"], "enemy", [drain(2, "chosen", true), { type: "chooseCard", look: 2 }], "Đoạt Nguyệt 2. Chiêm Bài 2.", kw("doat_nguyet", "chiem_bai")),
  C("f02_huyet_tram", "Huyết Trâm", "f02", 2, 3, "attack", ["attack", "forbidden"], "enemy", [{ type: "conditional", condition: { type: "bloodMoonActive" }, then: [D(9)], else: [{ type: "loseHp", amount: 2, to: "self" }, D(9)] }], "Mất 2 HP, gây 9 damage. Trong Huyết Nguyệt: không mất HP.", kw("huyet_nguyet")),
  C("f02_vong_nguyet_thu", "Vọng Nguyệt Thủ", "f02", 1, 3, "skill", ["scheme"], "enemy", [ifCombo(2, [drain(3, "chosen", true)], [drain(1, "chosen", true)])], "Đoạt Nguyệt 1. Liên Hoàn 2: Đoạt Nguyệt 3.", kw("doat_nguyet", "lien_hoan")),
  C("f02_thien_dien", "Thiên Diện", "f02", 4, 3, "skill", ["scheme"], "enemy", [ifHeld(1, [{ type: "stealBuff", count: 3 }], [{ type: "stealBuff", count: 1 }])], "Cướp 1 buff. Tích Tụ 1: cướp 3.", kw("tich_tu")),
  C("f02_doat_hon_thich", "Đoạt Hồn Thích", "f02", 5, 2, "attack", ["attack", "scheme"], "enemy", [{ type: "stealBuff", count: 2 }, drain(2, "chosen", true), D(6)], "Cướp 2 buff, Đoạt Nguyệt 2, gây 6 damage.", kw("doat_nguyet")),
  C("f02_huyet_nguyet_than_cong", "Huyết Nguyệt Thần Công", "f02", 7, 2, "attack", ["attack", "forbidden"], "none", [{ type: "loseHp", amount: 4, to: "self" }, D(5, "allEnemies", { hits: 2 }), { type: "bloodMoon", rounds: 3 }], "Chỉ đánh được khi Huyết Nguyệt. Mất 4 HP, gây 5 damage 2 lần lên mọi kẻ địch; Huyết Nguyệt kéo dài ít nhất 3 vòng.", kw("huyet_nguyet"), { requiresBloodMoon: true }),
];
const anhDau = { ...old.get("bond_anh_dau"), effects: [{ type: "stealBuff", count: 1, actor: 1 }, { type: "drainMoonPower", amount: 1, to: "chosen", steal: true, actor: 1 }, S("stealth", 1, "self")], text: "Diệp Linh Lung cướp 1 buff và Đoạt Nguyệt 1. Tô Dạ Ẩn Thân 1 vòng.", keywords: kw("doat_nguyet", "an_than") };
const byId = new Map([...old].filter(([id]) => id !== "f03_suong_giap"));
for (const [id, fields] of Object.entries(patch)) byId.set(id, { ...byId.get(id), ...fields });
for (const card of full) byId.set(card.id, card);
byId.set("bond_anh_dau", anhDau);
const heroes = JSON.parse(fs.readFileSync("heroes.json", "utf8"));
const pools = JSON.parse(fs.readFileSync(process.env.POOLS, "utf8"));
const order = [...Object.values(pools).flatMap((p) => [...p.free, ...p.locked]), "bond_bang_hoa_tranh_phong", "bond_anh_dau", "bond_tuyet_trung_tong_than"];
const missing = order.filter((id) => !byId.has(id));
if (missing.length) throw new Error("missing " + missing);
fs.writeFileSync("cards.json", JSON.stringify(order.map((id) => byId.get(id)), null, 2) + "\n");
const next = heroes.map((h) => {
  const p = pools[h.id];
  const { rewardCardIds, levelUp, art, ...rest } = h;
  return { ...rest, cardIds: p.free, lockedCardIds: p.locked, branches: p.branches, levelUp, art };
});
fs.writeFileSync("heroes.json", JSON.stringify(next, null, 2) + "\n");
EOF
```

  `POOLS` là file JSON tạm `"$TMPDIR/pools-4b.json"`:

```json
{
  "m05": {
    "free": ["m05_tran_bac_huyet_tinh", "m05_bat_khuat", "m05_liet_hoa_xung_phong", "m05_ho_gam", "m05_bat_dong_nhu_son", "m05_thuong_pha"],
    "locked": ["m05_huyet_chien", "m05_no_hoa_lien_hoan", "m05_liet_hoa_phan_thien", "m05_thiet_bich", "m05_huyet_thuan", "m05_lo_luyen"],
    "branches": [
      { "name": "Huyết Chiến", "cardIds": ["m05_tran_bac_huyet_tinh", "m05_bat_khuat", "m05_liet_hoa_xung_phong", "m05_huyet_chien", "m05_no_hoa_lien_hoan", "m05_liet_hoa_phan_thien"] },
      { "name": "Thiết Vệ", "cardIds": ["m05_ho_gam", "m05_bat_dong_nhu_son", "m05_thuong_pha", "m05_thiet_bich", "m05_huyet_thuan", "m05_lo_luyen"] }
    ]
  },
  "f04": {
    "free": ["f04_bach_thao_huong", "f04_linh_chi_ho_the", "f04_hoi_xuan_tan", "f04_thao_duoc", "f04_tinh_tam_tra", "f04_nguyet_quang_dan"],
    "locked": ["f04_xuan_phong", "f04_thanh_tam_chu", "f04_bach_hoa_tu_duoc", "f04_bang_tam_quyet", "f04_nguyet_lo", "f04_tinh_tam_quyet"],
    "branches": [
      { "name": "Bách Thảo", "cardIds": ["f04_bach_thao_huong", "f04_linh_chi_ho_the", "f04_hoi_xuan_tan", "f04_xuan_phong", "f04_thanh_tam_chu", "f04_bach_hoa_tu_duoc"] },
      { "name": "Tĩnh Tâm", "cardIds": ["f04_thao_duoc", "f04_tinh_tam_tra", "f04_nguyet_quang_dan", "f04_bang_tam_quyet", "f04_nguyet_lo", "f04_tinh_tam_quyet"] }
    ]
  },
  "m06": {
    "free": ["m06_anh_bo", "m06_am_tien", "m06_doat_menh", "m06_phi_tieu", "m06_nguyet_anh_an", "m06_song_nhan_loan_vu"],
    "locked": ["m06_tang_anh_thich", "m06_anh_phan_than", "m06_tuyet_menh", "m06_doc_tieu", "m06_anh_toc", "m06_loan_anh"],
    "branches": [
      { "name": "Ẩn Sát", "cardIds": ["m06_anh_bo", "m06_am_tien", "m06_doat_menh", "m06_tang_anh_thich", "m06_anh_phan_than", "m06_tuyet_menh"] },
      { "name": "Liên Hoàn", "cardIds": ["m06_phi_tieu", "m06_nguyet_anh_an", "m06_song_nhan_loan_vu", "m06_doc_tieu", "m06_anh_toc", "m06_loan_anh"] }
    ]
  },
  "f03": {
    "free": ["f03_han_an", "f03_phong_tuyet_chuong", "f03_tuyet_vu", "f03_suong_tram", "f03_bang_phach_lien_kich", "f03_tuyet_han"],
    "locked": ["f03_bang_cham", "f03_han_khi_nhap_mach", "f03_vinh_dong", "f03_han_phong", "f03_bang_toai", "f03_han_son_nhat_kiem"],
    "branches": [
      { "name": "Băng Phong", "cardIds": ["f03_han_an", "f03_phong_tuyet_chuong", "f03_tuyet_vu", "f03_bang_cham", "f03_han_khi_nhap_mach", "f03_vinh_dong"] },
      { "name": "Hàn Kiếm", "cardIds": ["f03_suong_tram", "f03_bang_phach_lien_kich", "f03_tuyet_han", "f03_han_phong", "f03_bang_toai", "f03_han_son_nhat_kiem"] }
    ]
  },
  "f02": {
    "free": ["f02_dien_doat", "f02_anh_tap", "f02_dien_cu", "f02_huyet_tram", "f02_doi_van_chu", "f02_phe_hon"],
    "locked": ["f02_vong_nguyet_thu", "f02_thien_dien", "f02_doat_hon_thich", "f02_huyet_khe", "f02_ta_nguyet_chu", "f02_huyet_nguyet_than_cong"],
    "branches": [
      { "name": "Thiên Diện", "cardIds": ["f02_dien_doat", "f02_anh_tap", "f02_dien_cu", "f02_vong_nguyet_thu", "f02_thien_dien", "f02_doat_hon_thich"] },
      { "name": "Huyết Nguyệt", "cardIds": ["f02_huyet_tram", "f02_doi_van_chu", "f02_phe_hon", "f02_huyet_khe", "f02_ta_nguyet_chu", "f02_huyet_nguyet_than_cong"] }
    ]
  }
}
```

  (Nhánh M05: Lò Luyện xếp vào Thiết Vệ để mỗi nhánh đủ 6 lá — "giữ lá lớn trong lúc chắn đòn".) Chạy:

```bash
cd packages/data && POOLS="$TMPDIR/pools-4b.json" node "$TMPDIR/cards-4b.cjs"
node -e 'const c=require("./cards.json");console.log(c.length, c.filter(x=>x.ownerId).length)'
```

  Expected: `63 60`.

- [ ] **Step 3: Test data** — `test/load-game-data.test.ts`:
  - "loads the real data": `toHaveLength(48)` → `toHaveLength(63)`; kỳ vọng `rewardCardIds` → `expect(data.heroes["m05"]?.lockedCardIds).toEqual(["m05_huyet_chien", "m05_no_hoa_lien_hoan", "m05_liet_hoa_phan_thien", "m05_thiet_bich", "m05_huyet_thuan", "m05_lo_luyen"]);`.
  - test "rejects a reward card owned by another hero": `raw.heroes[0].lockedCardIds[0] = "f04_thao_duoc"`, regex lỗi `locked card`.
  - thêm:

```ts
  it("T158: every hero has 6 free + 6 locked unique own cards, 2 branches of 6 and cheap free cards", () => {
    const data = loadGameData();
    for (const hero of Object.values(data.heroes)) {
      const pool = [...hero.cardIds, ...hero.lockedCardIds];
      expect(hero.cardIds).toHaveLength(6);
      expect(hero.lockedCardIds).toHaveLength(6);
      expect(new Set(pool).size).toBe(12);
      for (const id of pool) {
        expect(data.cards[id]?.ownerId).toBe(hero.id);
        expect([1, 2, 3]).toContain(data.cards[id]!.copies);
      }
      expect(hero.branches.flatMap((b) => b.cardIds).sort()).toEqual([...pool].sort());
      expect(hero.cardIds.filter((id) => data.cards[id]!.cost <= 3).length).toBeGreaterThanOrEqual(2);
    }
    const bad = rawData();
    bad.heroes[0].branches[0].cardIds[0] = bad.heroes[0].branches[1].cardIds[0];
    expect(() => parseGameData(bad)).toThrowError(/branches must split/);
  });
```

- [ ] **Step 4: `run.test.ts`** — `teamRewardPool` dùng `lockedCardIds`.

- [ ] **Step 5: Chạy data test**

Run: `pnpm --filter data test`
Expected: PASS.

- [ ] **Step 6: Sửa test luật dùng lá đổi cơ chế** (quy tắc chung: chuyển sang fixture giữ đúng hiệu ứng cũ). Thêm vào `test/fixtures/index.ts`:

```ts
const fixtureCard = (id: string, ownerId: string, type: CardDef["type"], target: CardDef["target"], effects: CardDef["effects"], tags: CardDef["tags"] = []): CardDef =>
  ({ id, name: id, ownerId, cost: 0, copies: 1, type, tags, target, effects, text: "" });

/** Stand-ins for pre-4b card behaviour used as plain mechanics examples in rule tests. */
export const healFiveCard = fixtureCard("test_heal_5", "f04", "skill", "ally", [{ type: "heal", amount: 5, to: "chosen" }], ["heal", "harmony"]);
export const armorSixCard = fixtureCard("test_armor_6", "f04", "skill", "ally", [{ type: "gainArmor", amount: 6, to: "chosen" }]);
export const regenThreeCard = fixtureCard("test_regen_3", "f04", "skill", "ally", [{ type: "applyStatus", status: "regen", amount: 3, to: "chosen" }], ["heal", "harmony"]);
export const cleanseHealCard = fixtureCard("test_cleanse_heal", "f04", "skill", "ally", [{ type: "cleanse", to: "chosen" }, { type: "heal", amount: 2, to: "chosen" }], ["heal", "harmony"]);
export const stealthOneCard = fixtureCard("test_stealth_1", "m06", "skill", "none", [{ type: "applyStatus", status: "stealth", amount: 1, to: "self" }], ["assassin"]);
export const aoeFiveCard = fixtureCard("test_aoe_5", "m06", "attack", "none", [{ type: "damage", amount: 5, to: "allEnemies" }], ["attack", "assassin"]);
export const armorReflectCard = fixtureCard("test_armor_reflect", "f03", "skill", "none", [{ type: "gainArmor", amount: 6, to: "self" }, { type: "applyStatus", status: "reflect", amount: 2, to: "self" }], ["ward"]);
export const twoHitCard = fixtureCard("test_two_hit", "f03", "attack", "enemy", [{ type: "damage", amount: 4, hits: 2, to: "chosen" }], ["attack"]);
export const stealOneCard = fixtureCard("test_steal_1", "f02", "skill", "enemy", [{ type: "stealBuff", count: 1 }]);
export const armorBreakCard = fixtureCard("test_armor_break", "m05", "attack", "enemy", [{ type: "removeArmor", to: "chosen" }, { type: "damage", amount: 5, to: "chosen" }], ["attack"]);
export const healSixCard = fixtureCard("test_heal_6", "m05", "skill", "none", [{ type: "heal", amount: 6, to: "self" }], ["heal"]);
```

  Thay trong các test dưới (dùng `injectCard(state, data, <fixture>)` thay `instanceIdOf(state, "<lá thật>")` / `setHand`), giữ nguyên mọi kỳ vọng:

| Lá thật | Fixture | File test |
|---|---|---|
| `f04_thao_duoc` | `healFiveCard` | boss, combat-end, enemy-turn, hand-pile, moon, play-card |
| `f04_linh_chi_ho_the` | `armorSixCard` | moon, play-card |
| `f04_bach_thao_huong` | `regenThreeCard` | level-up, play-card |
| `f04_tinh_tam_tra` | `cleanseHealCard` | play-card, statuses |
| `m06_anh_bo` | `stealthOneCard` | bond-cards, enemy-turn, level-up, moon |
| `m06_song_nhan_loan_vu` | `aoeFiveCard` | combat-end, damage |
| `f03_phong_tuyet_chuong` | `armorReflectCard` | boss |
| `f03_bang_phach_lien_kich` | `twoHitCard` | phase2-heroes, phase2-mechanics |
| `f02_dien_doat` | `stealOneCard` | phase2-heroes, phase2-mechanics |
| `m05_thuong_pha` | `armorBreakCard` | damage, play-card, run-relics, statuses |
| `m05_bat_khuat` | `healSixCard` | play-card |

  Ngoại lệ: test kiểm tra **luật Song Hành** với `bond_anh_dau` (bond-cards, economy, phase2-heroes) giữ lá thật và cập nhật kỳ vọng theo hiệu ứng mới (thêm Đoạt Nguyệt 1 — thêm `enemy.moonPower` vào setup nếu cần); `f04_nguyet_quang_dan` (choose-card, enemy-plan, moon, run-relics) không đổi cơ chế — chỉ cost 5 → 4, test đang đặt `moonPower = 11` nên không vỡ. `run-combat.test.ts` dùng `m05_huyet_chien` làm "lá ngoài deck khởi đầu" — vẫn đúng, không sửa.

- [ ] **Step 7: Chạy toàn bộ**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages
git commit -m "Step 4b.3: 12-card hero pools with branches, 16 new cards, reworked cards"
```

---

### Task 4: Hồ sơ và Tu Luyện (bước 4b.4)

**Files:**
- Create: `packages/data/meta-config.json`, `packages/rules/src/types/meta.ts`, `packages/rules/src/meta/profile.ts`, `packages/rules/test/meta-profile.test.ts`
- Modify: `packages/rules/src/types/{index,api,static,run}.ts`, `src/run/run.ts`, `src/index.ts`
- Modify: `packages/data/src/schema.ts`, `src/load-game-data.ts`, `test/load-game-data.test.ts`

**Interfaces:**
- Produces:
  - `interface MetaConfig { masteryLevels: number[]; masteryXp: { perFloor: number; win: number; heroLevelUp: number }; deckSize: number; minCardsPerHero: number; maxDecks: number }` (static.ts); `GameData.metaConfig: MetaConfig`.
  - `types/meta.ts`: `Profile`, `SavedDeck`, `RunResult`, `MasteryGain { heroId: string; xp: number; levelBefore: number; levelAfter: number }`, `DeckError` (spec §5.1).
  - `RunState.heroLevelUps: Record<string, number>` (defId → count).
  - `meta/profile.ts`: `createProfile(data): Profile`, `masteryLevel(data, xp): number`, `pendingUnlocks(data, profile, heroId): number`, `summarizeRun(data, run): RunResult`, `applyRunResult(data, profile, result): { profile: Profile; gains: MasteryGain[] }`, `unlockCard(data, profile, heroId, cardId): { ok: true; profile: Profile } | { ok: false; error: string }`, `parseProfile(data, raw: unknown): { profile: Profile; reset: boolean }`.

- [ ] **Step 1: Viết test thất bại `packages/rules/test/meta-profile.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import type { GameData, Profile, RunState } from "../src/index";
import {
  applyRunAction, applyRunResult, createProfile, createRun, masteryLevel, parseProfile,
  pendingUnlocks, starterDeck, summarizeRun, unlockCard,
} from "../src/index";
import { testData } from "./helpers";

const TEAM: [string, string, string] = ["m05", "f04", "m06"];

function withXp(data: GameData, heroId: string, xp: number): Profile {
  const profile = createProfile(data);
  profile.heroes[heroId]!.xp = xp;
  return profile;
}

describe("profile and mastery", () => {
  it("T159: a new profile has every hero at 0 XP; mastery levels follow the thresholds", () => {
    const data = testData();
    const profile = createProfile(data);
    expect(Object.keys(profile.heroes).sort()).toEqual(Object.keys(data.heroes).sort());
    expect(profile).toMatchObject({ version: 1, decks: [] });
    const levels = data.metaConfig.masteryLevels;
    expect(masteryLevel(data, 0)).toBe(0);
    levels.forEach((threshold, index) => {
      expect(masteryLevel(data, threshold - 1)).toBe(index);
      expect(masteryLevel(data, threshold)).toBe(index + 1);
    });
    expect(pendingUnlocks(data, withXp(data, "m05", levels[1]!), "m05")).toBe(2);
  });

  it("T160: applyRunResult grants floor, win and level-up XP without mutating the input", () => {
    const data = testData();
    const { perFloor, win, heroLevelUp } = data.metaConfig.masteryXp;
    const profile = createProfile(data);
    const snapshot = JSON.stringify(profile);
    const { profile: next, gains } = applyRunResult(data, profile, {
      heroIds: TEAM, floorReached: 5, won: true, heroLevelUps: { m05: 2 },
    });
    expect(JSON.stringify(profile)).toBe(snapshot);
    expect(next.heroes["m05"]!.xp).toBe(perFloor * 5 + win + heroLevelUp * 2);
    expect(next.heroes["f04"]!.xp).toBe(perFloor * 5 + win);
    expect(next.heroes["f03"]!.xp).toBe(0);
    const m05 = gains.find((gain) => gain.heroId === "m05")!;
    expect(m05).toEqual({
      heroId: "m05", xp: perFloor * 5 + win + heroLevelUp * 2,
      levelBefore: 0, levelAfter: masteryLevel(data, perFloor * 5 + win + heroLevelUp * 2),
    });
  });

  it("T161: unlockCard needs a locked card of that hero, not yet unlocked, and a pending unlock", () => {
    const data = testData();
    const card = data.heroes["m05"]!.lockedCardIds[0]!;
    expect(unlockCard(data, createProfile(data), "m05", card)).toEqual({ ok: false, error: "no pending unlock" });
    const ready = withXp(data, "m05", data.metaConfig.masteryLevels[0]!);
    expect(unlockCard(data, ready, "m05", data.heroes["m05"]!.cardIds[0]!)).toEqual({ ok: false, error: "not a locked card" });
    const done = unlockCard(data, ready, "m05", card);
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(done.profile.heroes["m05"]!.unlockedCardIds).toEqual([card]);
    expect(ready.heroes["m05"]!.unlockedCardIds).toEqual([]);
    expect(unlockCard(data, done.profile, "m05", card)).toEqual({ ok: false, error: "already unlocked" });
  });

  it("T162: parseProfile resets broken data, drops unknown ids and keeps invalid decks", () => {
    const data = testData();
    expect(parseProfile(data, "garbage")).toEqual({ profile: createProfile(data), reset: true });
    expect(parseProfile(data, { version: 2, heroes: {}, decks: [] }).reset).toBe(true);

    const locked = data.heroes["m05"]!.lockedCardIds[0]!;
    const deck = { id: "d1", name: "Thử", heroIds: TEAM, cardIds: ["f03_suong_giap"] };
    const { profile, reset } = parseProfile(data, {
      version: 1,
      heroes: { m05: { xp: 40, unlockedCardIds: [locked, "f03_suong_giap"] }, ghost: { xp: 5, unlockedCardIds: [] } },
      decks: [deck, { id: 3 }],
    });
    expect(reset).toBe(false);
    expect(profile.heroes["ghost"]).toBeUndefined();
    expect(profile.heroes["m05"]).toEqual({ xp: 40, unlockedCardIds: [locked] });
    expect(profile.heroes["f04"]).toEqual({ xp: 0, unlockedCardIds: [] });
    expect(profile.decks).toEqual([deck]);
  });

  it("T163: summarizeRun reports floor, result and hero level-ups counted across combats", () => {
    const data = testData();
    let run = createRun(data, { heroIds: TEAM, seed: 42, deckCardIds: starterDeck(data, TEAM) }).run;
    run = step(data, run, { type: "chooseNode", nodeId: run.map.floors[0]![0]!.id });
    run = step(data, run, { type: "combat", action: { type: "mulligan", instanceIds: [] } });
    const m05 = run.combat!.heroes[0]!;
    m05.levelUpCounter = data.heroes["m05"]!.levelUp.threshold; // levels up at next check
    for (const hero of run.combat!.heroes) hero.statuses.push({ id: "burn", value: 999 });
    run = step(data, run, { type: "combat", action: { type: "endTurn" } });
    expect(run.status).toBe("lost");
    expect(run.heroLevelUps).toEqual({ m05: 1 });
    expect(summarizeRun(data, run)).toEqual({ heroIds: TEAM, floorReached: 1, won: false, heroLevelUps: { m05: 1 } });
  });
});

function step(data: GameData, run: RunState, action: Parameters<typeof applyRunAction>[2]): RunState {
  const result = applyRunAction(data, run, action);
  if (!result.ok) throw new Error(result.error);
  return result.run;
}
```

(T163 dùng `starterDeck` và `deckCardIds` của Task 5 — viết test ở đây, nó chỉ pass sau Task 5; tạm đánh dấu `it.todo` **không** được dùng: thay vào đó ở Task 4 gọi `createRun(data, { heroIds: TEAM, seed: 42 })` và đổi thành `deckCardIds` ở Task 5 Step 7. Thứ tự import `starterDeck` cũng thêm ở Task 5.)

> Ghi chú cho người làm: ở Task 4, T163 dùng `createRun(data, { heroIds: TEAM, seed: 42 })` và không import `starterDeck`. Task 5 cập nhật lại đúng như khối trên.

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `pnpm --filter rules test -- meta-profile`
Expected: FAIL (không có `createProfile`, `metaConfig`).

- [ ] **Step 3: `meta-config.json`**

```json
{
  "masteryLevels": [30, 110, 230, 390, 590, 830],
  "masteryXp": { "perFloor": 10, "win": 50, "heroLevelUp": 10 },
  "deckSize": 18,
  "minCardsPerHero": 4,
  "maxDecks": 30
}
```

Schema:

```ts
export const metaConfigSchema = z.object({
  masteryLevels: z.array(z.number().int().positive()).min(1),
  masteryXp: z.object({
    perFloor: z.number().int().nonnegative(),
    win: z.number().int().nonnegative(),
    heroLevelUp: z.number().int().nonnegative(),
  }),
  deckSize: z.number().int().positive(),
  minCardsPerHero: z.number().int().nonnegative(),
  maxDecks: z.number().int().positive(),
});
```

`rawGameDataSchema` thêm `metaConfig: metaConfigSchema`; loader import `metaConfigJson from "../meta-config.json"`, trả `metaConfig`; kiểm tra chéo:

```ts
  const levels = metaConfig.masteryLevels;
  if (levels.some((value, index) => index > 0 && value <= levels[index - 1]!)) {
    errors.push(`metaConfig: masteryLevels must increase`);
  }
  for (const hero of heroes) {
    if (hero.lockedCardIds.length !== levels.length) {
      errors.push(`metaConfig: masteryLevels needs one level per locked card of "${hero.id}"`);
    }
  }
```

`test/load-game-data.test.ts`: `rawData()` thêm `metaConfig: metaConfigJson`.

- [ ] **Step 4: Kiểu** — `static.ts` thêm `MetaConfig`; `api.ts` `GameData.metaConfig: MetaConfig`; `types/meta.ts`:

```ts
export interface SavedDeck {
  id: string;
  name: string;
  heroIds: [string, string, string];
  cardIds: string[];
}

export interface Profile {
  version: 1;
  heroes: Record<string, { xp: number; unlockedCardIds: string[] }>;
  decks: SavedDeck[];
}

export interface RunResult {
  heroIds: [string, string, string];
  floorReached: number;
  won: boolean;
  /** defId → combats in which the hero leveled up. */
  heroLevelUps: Record<string, number>;
}

export interface MasteryGain {
  heroId: string;
  xp: number;
  levelBefore: number;
  levelAfter: number;
}

export type DeckError =
  | { code: "badHeroes" }
  | { code: "wrongSize"; size: number }
  | { code: "duplicateCard"; cardId: string }
  | { code: "foreignCard"; cardId: string }
  | { code: "tooFewForHero"; heroId: string; count: number }
  | { code: "lockedCard"; cardId: string };
```

`types/index.ts` thêm `export type * from "./meta";`. `types/run.ts` `RunState` thêm `/** defId → combats in which the hero leveled up (mastery XP). */ heroLevelUps: Record<string, number>;`.

- [ ] **Step 5: `run/run.ts`** — `createRun` thêm `heroLevelUps: {}`; `applyRunAction` case `combat` sau `events.push(...result.events);`:

```ts
      for (const event of result.events) {
        if (event.type !== "heroLeveledUp") continue;
        const defId = result.state.heroes.find((hero) => hero.id === event.heroId)!.defId;
        next.heroLevelUps[defId] = (next.heroLevelUps[defId] ?? 0) + 1;
      }
```

- [ ] **Step 6: `meta/profile.ts`**

```ts
import { findNode } from "../run/run";
import type { GameData, MasteryGain, Profile, RunResult, RunState, SavedDeck } from "../types/index";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createProfile(data: GameData): Profile {
  return {
    version: 1,
    heroes: Object.fromEntries(Object.keys(data.heroes).map((id) => [id, { xp: 0, unlockedCardIds: [] }])),
    decks: [],
  };
}

export function masteryLevel(data: GameData, xp: number): number {
  return data.metaConfig.masteryLevels.filter((threshold) => xp >= threshold).length;
}

export function pendingUnlocks(data: GameData, profile: Profile, heroId: string): number {
  const hero = profile.heroes[heroId];
  if (!hero) return 0;
  return Math.max(0, masteryLevel(data, hero.xp) - hero.unlockedCardIds.length);
}

export function summarizeRun(data: GameData, run: RunState): RunResult {
  if (run.status !== "won" && run.status !== "lost") throw new Error("summarizeRun: run is not over");
  return {
    heroIds: run.heroes.map((hero) => hero.defId) as [string, string, string],
    floorReached: run.position ? (findNode(run, run.position)?.floor ?? 0) : 0,
    won: run.status === "won",
    heroLevelUps: { ...run.heroLevelUps },
  };
}

export function applyRunResult(
  data: GameData,
  profile: Profile,
  result: RunResult,
): { profile: Profile; gains: MasteryGain[] } {
  const next = clone(profile);
  const { perFloor, win, heroLevelUp } = data.metaConfig.masteryXp;
  const gains = result.heroIds.map((heroId) => {
    const hero = (next.heroes[heroId] ??= { xp: 0, unlockedCardIds: [] });
    const levelBefore = masteryLevel(data, hero.xp);
    const xp = perFloor * result.floorReached + (result.won ? win : 0) + heroLevelUp * (result.heroLevelUps[heroId] ?? 0);
    hero.xp += xp;
    return { heroId, xp, levelBefore, levelAfter: masteryLevel(data, hero.xp) };
  });
  return { profile: next, gains };
}

export function unlockCard(
  data: GameData,
  profile: Profile,
  heroId: string,
  cardId: string,
): { ok: true; profile: Profile } | { ok: false; error: string } {
  if (!data.heroes[heroId]?.lockedCardIds.includes(cardId)) return { ok: false, error: "not a locked card" };
  if (profile.heroes[heroId]?.unlockedCardIds.includes(cardId)) return { ok: false, error: "already unlocked" };
  if (pendingUnlocks(data, profile, heroId) <= 0) return { ok: false, error: "no pending unlock" };
  const next = clone(profile);
  next.heroes[heroId]!.unlockedCardIds.push(cardId);
  return { ok: true, profile: next };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDeckShape(value: unknown): value is SavedDeck {
  if (!isRecord(value)) return false;
  const { id, name, heroIds, cardIds } = value;
  return (
    typeof id === "string" &&
    typeof name === "string" &&
    Array.isArray(heroIds) && heroIds.length === 3 && heroIds.every((h) => typeof h === "string") &&
    Array.isArray(cardIds) && cardIds.every((c) => typeof c === "string")
  );
}

/** Reads untrusted saved JSON (`14` §4.4); never throws. */
export function parseProfile(data: GameData, raw: unknown): { profile: Profile; reset: boolean } {
  const profile = createProfile(data);
  if (!isRecord(raw) || raw.version !== 1 || !isRecord(raw.heroes) || !Array.isArray(raw.decks)) {
    return { profile, reset: true };
  }
  for (const heroId of Object.keys(profile.heroes)) {
    const entry = raw.heroes[heroId];
    if (!isRecord(entry)) continue;
    const xp = typeof entry.xp === "number" && Number.isFinite(entry.xp) && entry.xp > 0 ? Math.floor(entry.xp) : 0;
    const locked = data.heroes[heroId]!.lockedCardIds;
    const unlocked = Array.isArray(entry.unlockedCardIds)
      ? entry.unlockedCardIds.filter((id): id is string => typeof id === "string" && locked.includes(id))
      : [];
    profile.heroes[heroId] = { xp, unlockedCardIds: [...new Set(unlocked)] };
  }
  profile.decks = raw.decks.filter(isDeckShape).map((deck) => clone(deck));
  return { profile, reset: false };
}
```

`index.ts` thêm `export { applyRunResult, createProfile, masteryLevel, parseProfile, pendingUnlocks, summarizeRun, unlockCard } from "./meta/profile";`.

- [ ] **Step 7: Chạy toàn bộ**

Run: `pnpm test && pnpm typecheck`
Expected: PASS (T159–T163).

- [ ] **Step 8: Commit**

```bash
git add packages
git commit -m "Step 4b.4: profile, mastery XP and card unlocks"
```

---

### Task 5: Deck (bước 4b.5)

**Files:**
- Create: `packages/rules/src/meta/deck.ts`, `packages/rules/test/meta-deck.test.ts`
- Modify: `packages/rules/src/types/run.ts`, `src/run/run.ts`, `src/index.ts`
- Modify: `packages/rules/test/{run,run-playtest,meta-profile}.test.ts`
- Modify: `apps/client/src/session.ts`

**Interfaces:**
- Consumes: `Profile`, `SavedDeck`, `DeckError`, `MetaConfig` (Task 4).
- Produces:
  - `starterDeck(data: GameData, heroIds: readonly string[]): string[]`.
  - `validateDeck(data: GameData, profile: Profile, deck: { heroIds: readonly string[]; cardIds: readonly string[] }): DeckError[]`.
  - `saveDeck(data: GameData, profile: Profile, draft: SavedDeck): { ok: true; profile: Profile; deckId: string } | { ok: false; error: string }`.
  - `deleteDeck(profile: Profile, deckId: string): { ok: true; profile: Profile } | { ok: false; error: string }`.
  - `RunSetup.deckCardIds: string[]` (bắt buộc).

- [ ] **Step 1: Viết test thất bại `packages/rules/test/meta-deck.test.ts`**

```ts
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

  it("T168: reward choices come from the 12-card pools minus the deck, including locked cards", () => {
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
    const choices = run.pendingReward!.cardChoices;
    expect(choices).toHaveLength(data.runConfig.rewardCardChoices);
    const pool = TEAM.flatMap((id) => [...data.heroes[id]!.cardIds, ...data.heroes[id]!.lockedCardIds]);
    for (const cardId of choices) {
      expect(pool).toContain(cardId);
      expect(deck).not.toContain(cardId);
    }
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `pnpm --filter rules test -- meta-deck`
Expected: FAIL (không có `starterDeck`, `validateDeck`, `saveDeck`).

- [ ] **Step 3: `meta/deck.ts`**

```ts
import type { DeckError, GameData, Profile, SavedDeck } from "../types/index";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Free cards of the three heroes, in team order ("Bộ cơ bản"). */
export function starterDeck(data: GameData, heroIds: readonly string[]): string[] {
  return heroIds.flatMap((heroId) => data.heroes[heroId]?.cardIds ?? []);
}

export function validateDeck(
  data: GameData,
  profile: Profile,
  deck: { heroIds: readonly string[]; cardIds: readonly string[] },
): DeckError[] {
  const { heroIds, cardIds } = deck;
  if (heroIds.length !== 3 || new Set(heroIds).size !== 3 || heroIds.some((id) => !data.heroes[id])) {
    return [{ code: "badHeroes" }];
  }
  const errors: DeckError[] = [];
  if (cardIds.length !== data.metaConfig.deckSize) errors.push({ code: "wrongSize", size: cardIds.length });
  const unique = new Set<string>();
  for (const cardId of cardIds) {
    if (unique.has(cardId)) errors.push({ code: "duplicateCard", cardId });
    unique.add(cardId);
  }
  const owned = [...unique].filter((cardId) => {
    const ownerId = data.cards[cardId]?.ownerId;
    const ok = ownerId !== undefined && heroIds.includes(ownerId);
    if (!ok) errors.push({ code: "foreignCard", cardId });
    return ok;
  });
  for (const heroId of heroIds) {
    const count = owned.filter((cardId) => data.cards[cardId]!.ownerId === heroId).length;
    if (count < data.metaConfig.minCardsPerHero) errors.push({ code: "tooFewForHero", heroId, count });
  }
  for (const cardId of owned) {
    const ownerId = data.cards[cardId]!.ownerId!;
    const free = data.heroes[ownerId]!.cardIds.includes(cardId);
    if (!free && !profile.heroes[ownerId]?.unlockedCardIds.includes(cardId)) {
      errors.push({ code: "lockedCard", cardId });
    }
  }
  return errors;
}

export function saveDeck(
  data: GameData,
  profile: Profile,
  draft: SavedDeck,
): { ok: true; profile: Profile; deckId: string } | { ok: false; error: string } {
  const name = draft.name.trim();
  if (name.length === 0 || name.length > 24) return { ok: false, error: "invalid name" };
  const next = clone(profile);
  const deck: SavedDeck = { ...clone(draft), name };
  if (draft.id === "") {
    if (next.decks.length >= data.metaConfig.maxDecks) return { ok: false, error: "too many decks" };
    const highest = Math.max(0, ...next.decks.map((saved) => Number(saved.id.slice(1)) || 0));
    deck.id = `d${highest + 1}`;
    next.decks.push(deck);
    return { ok: true, profile: next, deckId: deck.id };
  }
  const index = next.decks.findIndex((saved) => saved.id === draft.id);
  if (index < 0) return { ok: false, error: "unknown deck" };
  next.decks[index] = deck;
  return { ok: true, profile: next, deckId: deck.id };
}

export function deleteDeck(
  profile: Profile,
  deckId: string,
): { ok: true; profile: Profile } | { ok: false; error: string } {
  if (!profile.decks.some((deck) => deck.id === deckId)) return { ok: false, error: "unknown deck" };
  const next = clone(profile);
  next.decks = next.decks.filter((deck) => deck.id !== deckId);
  return { ok: true, profile: next };
}
```

`index.ts`: `export { deleteDeck, saveDeck, starterDeck, validateDeck } from "./meta/deck";`.

- [ ] **Step 4: `run/run.ts`** — `RunSetup` (types/run.ts) thêm `/** Validated by the caller (validateDeck); owners are re-checked here. */ deckCardIds: string[];`. `createRun`:

```ts
  for (const cardId of setup.deckCardIds) {
    const ownerId = data.cards[cardId]?.ownerId;
    if (ownerId === undefined || !setup.heroIds.includes(ownerId)) {
      throw new Error(`createRun: deck card "${cardId}" is not owned by a hero in the team`);
    }
  }
```

và `deck: [...setup.deckCardIds],`. `drawCardChoices`:

```ts
  const pool = run.heroes
    .flatMap((hero) => [...data.heroes[hero.defId]!.cardIds, ...data.heroes[hero.defId]!.lockedCardIds])
    .filter((cardId) => !run.deck.includes(cardId));
```

- [ ] **Step 5: Gọi `createRun` với deck**
  - `test/run.test.ts` (`newRun` và dòng ~246): `createRun(data, { heroIds: DEFAULT_TEAM, seed, deckCardIds: starterDeck(data, DEFAULT_TEAM) })`; `teamRewardPool` → `DEFAULT_TEAM.flatMap((id) => [...data.heroes[id]!.cardIds, ...data.heroes[id]!.lockedCardIds])` và test T105 kỳ vọng lá thưởng không có trong deck (giữ).
  - `test/run-playtest.test.ts`: `createRun(data, { heroIds, seed, deckCardIds: starterDeck(data, heroIds) })`.
  - `test/meta-profile.test.ts` T163: đổi thành khối trong Task 4 Step 1 (thêm `deckCardIds: starterDeck(data, TEAM)` và import `starterDeck`).
  - `apps/client/src/session.ts` `startRun`: `createRun(session.data, { heroIds, seed, deckCardIds: starterDeck(session.data, heroIds) })` (Task 6 thay bằng deck đã chọn).

- [ ] **Step 6: Chạy toàn bộ**

Run: `pnpm test && pnpm typecheck`
Expected: PASS (T164–T168).

- [ ] **Step 7: Commit**

```bash
git add packages apps
git commit -m "Step 4b.5: deck rules, saved decks, runs from a chosen deck, 12-card reward pool"
```

---

### Task 6: Client (bước 4b.6)

**Files:**
- Create: `apps/client/src/profile-store.ts`, `apps/client/src/ui/widgets.ts`, `apps/client/src/ui/card-tooltip.ts`, `apps/client/src/scenes/deck-select-scene.ts`, `apps/client/src/scenes/deck-builder-scene.ts`, `apps/client/src/scenes/mastery-scene.ts`
- Modify: `apps/client/src/main.ts`, `session.ts`, `debug.ts`, `scenes/team-select-scene.ts`, `scenes/run-scene.ts`, `scenes/combat-scene.ts`

**Interfaces:**
- Consumes: mọi hàm `meta/*` (Task 4–5), `GameData.keywords`, `HeroDef.branches`.
- Produces: `session.profile: Profile`, `session.deckCardIds: string[]`, `session.editingDeck: SavedDeck | null`, `session.lastGains: MasteryGain[] | null`, `session.runRewarded: boolean`; `startRun(heroIds, deckCardIds, seed?)`; `restartSession(seed?, encounterId?, heroIds?, deckCardIds?)`.

- [ ] **Step 1: `profile-store.ts`**

```ts
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
```

- [ ] **Step 2: `session.ts`** — thêm trường và sửa hàm:

```ts
import { createCombat, createRun, starterDeck } from "rules";
import type { CombatEvent, CombatState, GameData, MasteryGain, Profile, RunState, SavedDeck } from "rules";
import { loadProfile } from "./profile-store";

export interface CombatSession {
  data: GameData;
  state: CombatState;
  events: CombatEvent[];
  seed: number;
  encounterId: string;
  heroIds: Team;
  deckCardIds: string[];
  run: RunState | null;
  profile: Profile;
  editingDeck: SavedDeck | null;
  lastGains: MasteryGain[] | null;
  runRewarded: boolean;
}

export function newCombatSession(
  seed = 42,
  encounterId = "enc_01",
  heroIds: Team = DEFAULT_TEAM,
  deckCardIds?: string[],
): CombatSession {
  const data = loadGameData();
  const deck = deckCardIds ?? starterDeck(data, heroIds);
  const { state, events } = createCombat(data, { heroIds, encounterId, seed, deckCardIds: deck });
  return {
    data, state, events, seed, encounterId, heroIds, deckCardIds: deck, run: null,
    profile: loadProfile(data), editingDeck: null, lastGains: null, runRewarded: false,
  };
}
```

`restartSession(seed, encounterId, heroIds, deckCardIds = session.deckCardIds)` gọi `newCombatSession(seed, encounterId, heroIds, deckCardIds)` và gán thêm `session.deckCardIds = fresh.deckCardIds` (không ghi đè `profile`). `startRun(heroIds: Team, deckCardIds: string[], seed = session.seed)`: gán `session.deckCardIds = deckCardIds; session.runRewarded = false; session.lastGains = null;` và `createRun(session.data, { heroIds, seed, deckCardIds })`.

Lưu ý: khi `restartSession` đổi đội mà deck hiện tại thuộc đội khác, người gọi phải truyền deck đúng (`cycleEncounter` giữ đội nên giữ deck).

- [ ] **Step 3: `ui/widgets.ts`**

```ts
import Phaser from "phaser";
import { COLORS, TEXT_BASE } from "./theme";

export function addText(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  content: string,
  size = 14,
  color: string = COLORS.text,
): Phaser.GameObjects.Text {
  const text = scene.add.text(x, y, content, { ...TEXT_BASE, fontSize: `${size}px`, color });
  parent.add(text);
  return text;
}

export function addButton(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  width: number,
  label: string,
  onClick: () => void,
  enabled = true,
): void {
  const button = scene.add.rectangle(x, y, width, 34, enabled ? COLORS.button : 0x222633);
  button.setStrokeStyle(1, enabled ? COLORS.goldFill : COLORS.panelBorder);
  if (enabled) {
    button.setInteractive({ useHandCursor: true });
    button.on("pointerover", () => button.setFillStyle(0x3a5090));
    button.on("pointerout", () => button.setFillStyle(COLORS.button));
    button.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 0) onClick();
    });
  }
  parent.add(button);
  addText(scene, parent, x, y, label, 13, enabled ? COLORS.text : COLORS.dimText).setOrigin(0.5);
}
```

- [ ] **Step 4: `ui/card-tooltip.ts`**

```ts
import Phaser from "phaser";
import type { GameData } from "rules";
import { COLORS, TEXT_BASE } from "./theme";

const WIDTH = 300;

/** Large card view + keyword explanations; caller destroys it on pointerout. */
export function showCardTooltip(
  scene: Phaser.Scene,
  x: number,
  y: number,
  data: GameData,
  cardId: string,
): Phaser.GameObjects.Container {
  const card = data.cards[cardId]!;
  const lines = [
    `${card.name}  ·  ${card.cost} Nguyệt Lực  ·  ${card.copies} bản`,
    card.text,
    ...(card.keywords ?? []).map((id) => {
      const keyword = data.keywords[id];
      return keyword ? `• ${keyword.name}: ${keyword.text}` : "";
    }),
  ].filter((line) => line.length > 0);
  const text = scene.add.text(12, 10, lines.join("\n"), {
    ...TEXT_BASE,
    fontSize: "12px",
    color: COLORS.text,
    wordWrap: { width: WIDTH - 24 },
    lineSpacing: 4,
  });
  const height = text.height + 20;
  const left = Math.min(Math.max(8, x), 1280 - WIDTH - 8);
  const top = Math.min(Math.max(8, y - height), 720 - height - 8);
  const panel = scene.add.rectangle(0, 0, WIDTH, height, 0x0a0e20, 0.96).setOrigin(0, 0);
  panel.setStrokeStyle(1, COLORS.goldFill);
  return scene.add.container(left, top, [panel, text]).setDepth(200);
}
```

- [ ] **Step 5: Chữ lỗi deck** — trong `deck-select-scene.ts` (dùng lại ở deck-builder qua export):

```ts
export function describeDeckError(data: GameData, error: DeckError): string {
  switch (error.code) {
    case "badHeroes":
      return "Deck phải có 3 Hero khác nhau";
    case "wrongSize":
      return `Deck cần đúng ${data.metaConfig.deckSize} lá (đang ${error.size})`;
    case "duplicateCard":
      return `Trùng lá: ${data.cards[error.cardId]?.name ?? error.cardId}`;
    case "foreignCard":
      return `Lá không thuộc đội: ${data.cards[error.cardId]?.name ?? error.cardId}`;
    case "tooFewForHero":
      return `${data.heroes[error.heroId]?.name ?? error.heroId} cần ít nhất ${data.metaConfig.minCardsPerHero} lá (đang ${error.count})`;
    case "lockedCard":
      return `Lá chưa mở: ${data.cards[error.cardId]?.name ?? error.cardId}`;
    default: {
      const exhaustive: never = error;
      return String(exhaustive);
    }
  }
}
```

- [ ] **Step 6: `scenes/deck-select-scene.ts`**

```ts
import Phaser from "phaser";
import { deleteDeck, starterDeck, validateDeck } from "rules";
import type { DeckError, GameData, SavedDeck } from "rules";
import { saveProfile } from "../profile-store";
import { restartSession, session, startRun } from "../session";
import { COLORS, useDesignCamera } from "../ui/theme";
import { addButton, addText } from "../ui/widgets";

const WIDTH = 1280;

// describeDeckError (Step 5) nằm ở đây.

const sameTeam = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id) => b.includes(id));

export class DeckSelectScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private selected = "starter";

  constructor() {
    super("deck-select");
  }

  create() {
    useDesignCamera(this);
    this.root = this.add.container(0, 0);
    this.selected = "starter";
    this.render();
  }

  private decks(): SavedDeck[] {
    const team = session.heroIds;
    const starter: SavedDeck = { id: "starter", name: "Bộ cơ bản", heroIds: [...team], cardIds: starterDeck(session.data, team) };
    return [starter, ...session.profile.decks.filter((deck) => sameTeam(deck.heroIds, team))];
  }

  private render() {
    this.root.removeAll(true);
    const data = session.data;
    const names = session.heroIds.map((id) => data.heroes[id]!.name).join(" · ");
    addText(this, this.root, WIDTH / 2, 30, "Chọn deck", 26, COLORS.gold).setOrigin(0.5);
    addText(this, this.root, WIDTH / 2, 62, names, 14, COLORS.dimText).setOrigin(0.5);
    const decks = this.decks();
    decks.forEach((deck, index) => {
      const y = 110 + index * 40;
      const errors = validateDeck(data, session.profile, deck);
      const avg = deck.cardIds.reduce((sum, id) => sum + (data.cards[id]?.cost ?? 0), 0) / Math.max(1, deck.cardIds.length);
      const row = this.add.rectangle(WIDTH / 2, y, 760, 34, deck.id === this.selected ? 0x2a3a70 : 0x141b33);
      row.setStrokeStyle(1, deck.id === this.selected ? COLORS.goldFill : COLORS.panelBorder);
      row.setInteractive({ useHandCursor: true });
      row.on("pointerup", () => {
        this.selected = deck.id;
        this.render();
      });
      this.root.add(row);
      const status = errors.length === 0 ? "✓" : `⚠ ${describeDeckError(data, errors[0]!)}`;
      addText(this, this.root, WIDTH / 2 - 360, y, `${deck.name}  ·  cost TB ${avg.toFixed(1)}`, 14).setOrigin(0, 0.5);
      addText(this, this.root, WIDTH / 2 + 360, y, status, 12, errors.length === 0 ? COLORS.gold : "#ff8080").setOrigin(1, 0.5);
    });
    const deck = decks.find((entry) => entry.id === this.selected) ?? decks[0]!;
    const valid = validateDeck(data, session.profile, deck).length === 0;
    const starter = deck.id === "starter";
    const y = 640;
    addButton(this, this.root, WIDTH / 2 - 450, y, 150, "Lượt chơi", () => {
      startRun([...session.heroIds] as typeof session.heroIds, [...deck.cardIds]);
      this.scene.start("run");
    }, valid);
    addButton(this, this.root, WIDTH / 2 - 290, y, 150, "Trận lẻ", () => {
      restartSession(session.seed, session.encounterId, session.heroIds, [...deck.cardIds]);
      this.scene.start("combat");
    }, valid);
    addButton(this, this.root, WIDTH / 2 - 130, y, 150, "Sửa", () => this.edit(deck), !starter);
    addButton(this, this.root, WIDTH / 2 + 30, y, 150, "Sao chép", () => this.edit({ ...deck, id: "", name: `${deck.name} (bản sao)`.slice(0, 24) }));
    addButton(this, this.root, WIDTH / 2 + 190, y, 150, "Xóa", () => {
      if (!window.confirm(`Xóa deck "${deck.name}"?`)) return;
      const result = deleteDeck(session.profile, deck.id);
      if (!result.ok) return;
      session.profile = result.profile;
      saveProfile(session.profile);
      this.selected = "starter";
      this.render();
    }, !starter);
    addButton(this, this.root, WIDTH / 2 + 350, y, 150, "Deck mới", () =>
      this.edit({ id: "", name: "Deck mới", heroIds: [...session.heroIds] as SavedDeck["heroIds"], cardIds: starterDeck(data, session.heroIds) }),
    );
    addButton(this, this.root, 90, 30, 140, "◂ Chọn đội", () => this.scene.start("team-select"));
  }

  private edit(deck: SavedDeck) {
    session.editingDeck = { ...deck, cardIds: [...deck.cardIds], heroIds: [...deck.heroIds] as SavedDeck["heroIds"] };
    this.scene.start("deck-builder");
  }
}
```

(`DeckError`, `GameData` dùng trong `describeDeckError`.)

- [ ] **Step 7: `scenes/deck-builder-scene.ts`**

```ts
import Phaser from "phaser";
import { saveDeck, validateDeck } from "rules";
import { saveProfile, storage } from "../profile-store";
import { session } from "../session";
import { showCardTooltip } from "../ui/card-tooltip";
import { COLORS, OWNER_COLORS, useDesignCamera } from "../ui/theme";
import { addButton, addText } from "../ui/widgets";
import { describeDeckError } from "./deck-select-scene";

const WIDTH = 1280;
const COLUMN_W = 400;
const ROW_H = 30;

export class DeckBuilderScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private tooltip: Phaser.GameObjects.Container | null = null;

  constructor() {
    super("deck-builder");
  }

  create() {
    useDesignCamera(this);
    this.root = this.add.container(0, 0);
    this.render();
  }

  private get deck() {
    return session.editingDeck!;
  }

  private isUnlocked(heroId: string, cardId: string): boolean {
    const hero = session.data.heroes[heroId]!;
    return hero.cardIds.includes(cardId) || session.profile.heroes[heroId]!.unlockedCardIds.includes(cardId);
  }

  private toggle(cardId: string) {
    const cards = this.deck.cardIds;
    const index = cards.indexOf(cardId);
    if (index >= 0) cards.splice(index, 1);
    else cards.push(cardId);
    this.render();
  }

  private render() {
    this.root.removeAll(true);
    this.tooltip?.destroy();
    this.tooltip = null;
    const data = session.data;
    addText(this, this.root, WIDTH / 2, 24, `Xếp deck — ${this.deck.name}`, 22, COLORS.gold).setOrigin(0.5);
    this.deck.heroIds.forEach((heroId, column) => {
      const hero = data.heroes[heroId]!;
      const x0 = 40 + column * COLUMN_W;
      const count = this.deck.cardIds.filter((id) => data.cards[id]?.ownerId === heroId).length;
      const low = count < data.metaConfig.minCardsPerHero;
      addText(this, this.root, x0, 58, `${hero.name}  (${count})`, 16, low ? "#ff8080" : COLORS.text);
      let y = 90;
      for (const branch of hero.branches) {
        addText(this, this.root, x0, y, `— ${branch.name} —`, 12, COLORS.dimText);
        y += 22;
        for (const cardId of branch.cardIds) {
          this.renderRow(heroId, cardId, x0, y);
          y += ROW_H;
        }
        y += 6;
      }
    });
    const errors = validateDeck(data, session.profile, this.deck);
    const copies = this.deck.cardIds.reduce((sum, id) => sum + (data.cards[id]?.copies ?? 0), 0);
    const curve = Array.from({ length: 9 }, (_, cost) => this.deck.cardIds.filter((id) => data.cards[id]?.cost === cost).length);
    addText(this, this.root, 40, 560, `Deck ${this.deck.cardIds.length}/${data.metaConfig.deckSize}  ·  Chồng bài ${copies} bản`, 15);
    addText(this, this.root, 40, 584, `Cost 0–8: ${curve.join(" · ")}`, 13, COLORS.dimText);
    addText(this, this.root, 40, 608, errors.length === 0 ? "✓ Deck hợp lệ" : `⚠ ${describeDeckError(data, errors[0]!)}`, 13, errors.length === 0 ? COLORS.gold : "#ff8080");
    if (storage.failed) addText(this, this.root, 40, 632, "Không lưu được tiến trình (trình duyệt chặn lưu trữ)", 12, "#ff8080");
    addButton(this, this.root, WIDTH - 470, 660, 140, "Đổi tên", () => {
      const name = window.prompt("Tên deck (tối đa 24 ký tự)", this.deck.name);
      if (name !== null) this.deck.name = name;
      this.render();
    });
    addButton(this, this.root, WIDTH - 310, 660, 140, "Lưu", () => {
      const result = saveDeck(data, session.profile, this.deck);
      if (!result.ok) {
        window.alert(result.error === "invalid name" ? "Tên deck phải có 1–24 ký tự" : "Đã đạt số deck tối đa");
        return;
      }
      session.profile = result.profile;
      saveProfile(session.profile);
      session.editingDeck = null;
      this.scene.start("deck-select");
    });
    addButton(this, this.root, WIDTH - 150, 660, 140, "Hủy", () => {
      session.editingDeck = null;
      this.scene.start("deck-select");
    });
  }

  private renderRow(heroId: string, cardId: string, x: number, y: number) {
    const data = session.data;
    const card = data.cards[cardId]!;
    const unlocked = this.isUnlocked(heroId, cardId);
    const inDeck = this.deck.cardIds.includes(cardId);
    const row = this.add.rectangle(x, y, COLUMN_W - 20, ROW_H - 4, inDeck ? 0x2a3a70 : 0x141b33).setOrigin(0, 0.5);
    row.setStrokeStyle(1, inDeck ? (OWNER_COLORS[heroId] ?? COLORS.goldFill) : COLORS.panelBorder);
    this.root.add(row);
    const label = `${card.cost} · ${card.name}${unlocked ? "" : "  🔒"}${inDeck ? "  ✓" : ""}`;
    addText(this, this.root, x + 10, y, label, 13, unlocked ? COLORS.text : COLORS.dimText).setOrigin(0, 0.5);
    addText(this, this.root, x + COLUMN_W - 30, y, `×${card.copies}`, 11, COLORS.dimText).setOrigin(1, 0.5);
    if (!unlocked) row.setAlpha(0.5);
    row.setInteractive({ useHandCursor: unlocked });
    row.on("pointerover", () => {
      this.tooltip?.destroy();
      this.tooltip = showCardTooltip(this, x + COLUMN_W - 10, y, data, cardId);
    });
    row.on("pointerout", () => {
      this.tooltip?.destroy();
      this.tooltip = null;
    });
    row.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 0 && unlocked) this.toggle(cardId);
    });
  }
}
```

- [ ] **Step 8: `scenes/mastery-scene.ts`**

```ts
import Phaser from "phaser";
import { masteryLevel, pendingUnlocks, unlockCard } from "rules";
import { saveProfile } from "../profile-store";
import { session } from "../session";
import { showCardTooltip } from "../ui/card-tooltip";
import { COLORS, useDesignCamera } from "../ui/theme";
import { addButton, addText } from "../ui/widgets";

const WIDTH = 1280;

export class MasteryScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private heroId = "";
  private tooltip: Phaser.GameObjects.Container | null = null;

  constructor() {
    super("mastery");
  }

  create(data?: { heroId?: string }) {
    useDesignCamera(this);
    this.root = this.add.container(0, 0);
    this.heroId = data?.heroId ?? Object.keys(session.data.heroes)[0]!;
    this.render();
  }

  private render() {
    this.root.removeAll(true);
    this.tooltip?.destroy();
    this.tooltip = null;
    const data = session.data;
    const levels = data.metaConfig.masteryLevels;
    addText(this, this.root, WIDTH / 2, 28, "Tu Luyện", 26, COLORS.gold).setOrigin(0.5);
    Object.values(data.heroes).forEach((hero, index) => {
      const y = 100 + index * 90;
      const { xp } = session.profile.heroes[hero.id]!;
      const level = masteryLevel(data, xp);
      const pending = pendingUnlocks(data, session.profile, hero.id);
      const next = levels[level];
      const panel = this.add.rectangle(230, y, 380, 76, hero.id === this.heroId ? 0x2a3a70 : 0x141b33);
      panel.setStrokeStyle(1, hero.id === this.heroId ? COLORS.goldFill : COLORS.panelBorder);
      panel.setInteractive({ useHandCursor: true });
      panel.on("pointerup", () => {
        this.heroId = hero.id;
        this.render();
      });
      this.root.add(panel);
      addText(this, this.root, 55, y - 22, `${hero.name}  ·  cấp ${level}/${levels.length}`, 15);
      addText(this, this.root, 55, y + 2, next !== undefined ? `XP ${xp}/${next}` : `XP ${xp} (tối đa)`, 12, COLORS.dimText);
      if (pending > 0) addText(this, this.root, 55, y + 20, `● Còn ${pending} lượt mở`, 12, COLORS.gold);
    });
    const hero = data.heroes[this.heroId]!;
    const unlocked = session.profile.heroes[hero.id]!.unlockedCardIds;
    const pending = pendingUnlocks(data, session.profile, hero.id);
    addText(this, this.root, 480, 70, `${hero.name} — lá khóa`, 18, COLORS.gold);
    hero.lockedCardIds.forEach((cardId, index) => {
      const y = 120 + index * 64;
      const card = data.cards[cardId]!;
      const done = unlocked.includes(cardId);
      const row = this.add.rectangle(480, y, 520, 54, done ? 0x1f3a2a : 0x141b33).setOrigin(0, 0.5);
      row.setStrokeStyle(1, COLORS.panelBorder);
      row.setInteractive();
      row.on("pointerover", () => {
        this.tooltip?.destroy();
        this.tooltip = showCardTooltip(this, 1010, y, data, cardId);
      });
      row.on("pointerout", () => {
        this.tooltip?.destroy();
        this.tooltip = null;
      });
      this.root.add(row);
      addText(this, this.root, 494, y, `${card.cost} · ${card.name}${done ? "  ✓" : ""}`, 15).setOrigin(0, 0.5);
      if (!done) {
        addButton(this, this.root, 920, y, 140, "Mở khóa", () => {
          if (!window.confirm(`Mở khóa "${card.name}"?`)) return;
          const result = unlockCard(data, session.profile, hero.id, cardId);
          if (!result.ok) return;
          session.profile = result.profile;
          saveProfile(session.profile);
          this.render();
        }, pending > 0);
      }
    });
    addButton(this, this.root, 90, 680, 140, "◂ Quay lại", () => this.scene.start("team-select"));
  }
}
```

- [ ] **Step 9: `main.ts`** — import và thêm `DeckSelectScene, DeckBuilderScene, MasteryScene` vào mảng `scene`.

- [ ] **Step 10: `team-select-scene.ts`**
  - Bỏ hai nút chế độ "Lượt chơi" / "Trận lẻ" và trường `mode`; danh sách trận (nút encounter) luôn hiện với nhãn phía trên `addText(... "Trận lẻ: chọn trận", 13, COLORS.dimText)` và chỉ gán `this.encounterId`.
  - Nút cuối: `ready ? "TIẾP — CHỌN DECK" : …`; khi bấm: `session.heroIds = [...this.picked] as Team; session.encounterId = this.encounterId; this.scene.start("deck-select");`.
  - Thêm nút "Tu Luyện" ở góc trên phải (`WIDTH - 110, 30`), nhãn thêm " ●" khi `Object.keys(session.data.heroes).some((id) => pendingUnlocks(session.data, session.profile, id) > 0)`; bấm → `this.scene.start("mastery")`.
  - Bỏ import `restartSession`, `startRun` nếu không còn dùng.

- [ ] **Step 11: `run-scene.ts` màn kết thúc** — đầu `renderEnd()`:

```ts
    if (!session.runRewarded) {
      const result = applyRunResult(session.data, session.profile, summarizeRun(session.data, this.run));
      session.profile = result.profile;
      session.lastGains = result.gains;
      session.runRewarded = true;
      saveProfile(session.profile);
    }
```

và sau dòng "Tầng …":

```ts
    (session.lastGains ?? []).forEach((gain, index) => {
      const name = session.data.heroes[gain.heroId]!.name;
      const levelUp = gain.levelAfter > gain.levelBefore ? `  ·  Lên cấp Tu Luyện ${gain.levelAfter}!` : "";
      this.text(WIDTH / 2, 350 + index * 24, `${name} +${gain.xp} XP${levelUp}`, 15, levelUp ? COLORS.gold : COLORS.text).setOrigin(0.5);
    });
    const canUnlock = session.heroIds.some((id) => pendingUnlocks(session.data, session.profile, id) > 0);
```

Nút: dời "Về màn chọn đội" xuống `y = 460`; thêm (khi `canUnlock`) nút "Mở lá ngay" ở `y = 510` → `session.run = null; this.scene.start("mastery", { heroId: session.heroIds.find((id) => pendingUnlocks(session.data, session.profile, id) > 0) });`. Import `applyRunResult, pendingUnlocks, summarizeRun` từ `rules`, `saveProfile` từ `../profile-store`.

- [ ] **Step 12: `combat-scene.ts`**
  - `renderCard`: sau badge cost, nếu lá có từ khóa `tich_tu` và `instance.heldTurns > 0`:

```ts
    if (instance.heldTurns > 0 && card.keywords?.includes("tich_tu")) {
      container.add(
        this.add
          .text(0, -CARD_H / 2 + 34, `Tích Tụ ${instance.heldTurns}`, { ...TEXT_BASE, fontSize: "10px", color: COLORS.gold })
          .setOrigin(0.5),
      );
    }
```

  - Tooltip: field `private tooltip: Phaser.GameObjects.Container | null = null;`; trong `pointerover` của lá: `this.tooltip?.destroy(); this.tooltip = showCardTooltip(this, x + CARD_W / 2 + 10, y - 40, this.gameData, instance.cardId);`; trong `pointerout`: `this.tooltip?.destroy(); this.tooltip = null;`; đầu `renderAll()`: `this.tooltip?.destroy(); this.tooltip = null;`.
  - `renderBottomBar` dưới dòng Nguyệt Lực:

```ts
    const extras = [
      this.state.cardsPlayedThisTurn > 0 ? `Liên Hoàn ${this.state.cardsPlayedThisTurn}` : "",
      this.state.moonPowerBonus > 0 ? `+${this.state.moonPowerBonus}/lượt` : "",
    ].filter((part) => part.length > 0);
    if (extras.length > 0) this.text(30, 612, extras.join("  ·  "), 12, COLORS.gold);
```

- [ ] **Step 13: Debug** — `debug.ts`:

```ts
export function debugGrantTeamXp(amount = 100): void {
  const profile = JSON.parse(JSON.stringify(session.profile)) as Profile;
  for (const heroId of session.heroIds) profile.heroes[heroId]!.xp += amount;
  session.profile = profile;
  saveProfile(profile);
}

export function debugUnlockAll(): void {
  const profile = JSON.parse(JSON.stringify(session.profile)) as Profile;
  for (const hero of Object.values(session.data.heroes)) {
    profile.heroes[hero.id] = {
      xp: Math.max(profile.heroes[hero.id]?.xp ?? 0, session.data.metaConfig.masteryLevels.at(-1)!),
      unlockedCardIds: [...hero.lockedCardIds],
    };
  }
  session.profile = profile;
  saveProfile(profile);
}

export function debugResetProfile(): void {
  session.profile = createProfile(session.data);
  saveProfile(session.profile);
}
```

(import `createProfile` từ `rules`, `Profile` type, `saveProfile` từ `./profile-store`.) `combat-scene.ts` `renderDebugPanel`: thêm một hàng 3 nút `debugButton` "+100 XP đội", "Mở hết lá", "Xóa hồ sơ" gọi các hàm trên rồi `this.renderAll()`.

- [ ] **Step 14: Kiểm tra tay** — `pnpm dev`, mở Browser pane:
  1. Hồ sơ mới: Chọn đội → Tiếp → "Bộ cơ bản" ✓; Trận lẻ và Lượt chơi chạy được.
  2. Sao chép → Xếp deck: lá khóa mờ có 🔒, không bấm được; bỏ 1 lá → "Deck 17/18" và ⚠; Lưu → deck hiện ở danh sách với ⚠; Lượt chơi bị mờ.
  3. Debug "+100 XP đội" → Tu Luyện: cấp 1, "Còn 1 lượt mở" → Mở khóa 1 lá → quay lại xếp deck: lá đó bấm được; deck 18 lá, mỗi Hero ≥4 → ✓.
  4. Tải lại trang: hồ sơ và deck còn nguyên.
  5. Trong trận: di chuột lên lá → bảng giải thích từ khóa; đánh 2 lá → "Liên Hoàn 2"; giữ lá Tích Tụ qua lượt → nhãn "Tích Tụ 1".
  6. Kết thúc lượt chơi → XP từng Hero; "Mở lá ngay" khi có lượt mở.
  Chụp màn hình từng bước.

- [ ] **Step 15: Chạy toàn bộ**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 16: Commit**

```bash
git add apps
git commit -m "Step 4b.6: client deck select/builder, mastery, profile storage, keyword display"
```

---

### Task 7: Mô phỏng + chỉnh số (bước 4b.7)

**Files:**
- Modify: `packages/rules/test/playtest.test.ts`, `packages/rules/test/run-playtest.test.ts`, `docs/playtest-notes.md`
- Modify (chỉ sau khi người dùng duyệt): `packages/data/{cards,meta-config}.json`

**Interfaces:**
- Consumes: mọi thứ Task 2–5; heuristic 4a đang có trong hai file playtest (`combatAction`).

- [ ] **Step 1: Heuristic từ khóa** — trong `combatAction` của cả hai file, thay việc chọn lá đánh (sau nhánh `mulligan` / `choosing`) bằng:

```ts
  const keywordsOf = (id: string) => gameData.cards[state.cards[id]!.cardId]!.keywords ?? [];
  const heldThreshold = (id: string): number => {
    let best = 0;
    const walk = (effects: Effect[]) => {
      for (const effect of effects) {
        if (effect.type !== "conditional") continue;
        if (effect.condition.type === "heldTurnsAtLeast") best = Math.max(best, effect.condition.turns);
        walk(effect.then);
        walk(effect.else ?? []);
      }
    };
    walk(gameData.cards[state.cards[id]!.cardId]!.effects);
    return best;
  };
  const playable = state.hand.filter((id) => isCardPlayable(gameData, state, id));
  const ready = playable.filter((id) => state.cards[id]!.heldTurns >= heldThreshold(id));
  const candidates = ready.length > 0 || state.hand.length < gameData.combatConfig.handSize ? ready : playable;
  const ordered = [...candidates].sort((a, b) => {
    const comboA = keywordsOf(a).includes("lien_hoan") ? 1 : 0;
    const comboB = keywordsOf(b).includes("lien_hoan") ? 1 : 0;
    if (comboA !== comboB) return comboA - comboB; // non-combo cards first
    return getEffectiveCost(gameData, state, b) - getEffectiveCost(gameData, state, a);
  });
  for (const instanceId of ordered) {
    const card = gameData.cards[state.cards[instanceId]!.cardId]!;
    if (card.target === "none") return { type: "playCard", instanceId };
    const targets = getValidTargets(gameData, state, instanceId);
    let targetId: string | undefined;
    if (card.target === "enemy") {
      const drains = keywordsOf(instanceId).some((k) => k === "toa_nguyet" || k === "doat_nguyet");
      const chainCost = (id: string) => state.enemies.find((e) => e.id === id)!.plannedIntents.reduce((s, p) => s + p.cost, 0);
      const hp = (id: string) => state.enemies.find((e) => e.id === id)!.hp;
      targetId = [...targets].sort((a, b) => (drains ? chainCost(b) - chainCost(a) : hp(a) - hp(b)))[0];
    } else {
      const burst = keywordsOf(instanceId).includes("tu_duoc");
      const regen = (id: string) => state.heroes.find((h) => h.id === id)!.statuses.find((s) => s.id === "regen")?.value ?? 0;
      const ratio = (id: string) => { const h = state.heroes.find((u) => u.id === id)!; return h.hp / h.maxHp; };
      const pool = burst ? targets.filter((id) => regen(id) >= 3) : targets;
      targetId = [...pool].sort((a, b) => ratio(a) - ratio(b))[0];
    }
    if (targetId !== undefined) return { type: "playCard", instanceId, targetId };
  }
  return { type: "endTurn" };
```

(import `Effect` type, `getEffectiveCost`.) Heuristic cũ Đổi Bài / Chiêm Bài giữ nguyên.

- [ ] **Step 2: Deck so sánh** — trong `run-playtest.test.ts` thêm hàm tạo deck (mọi lá coi như đã mở):

```ts
type DeckPlan = { label: string; split: [number, number, number]; branch: 0 | 1 };

function branchDeck(gameData: GameData, team: [string, string, string], plan: DeckPlan): string[] {
  return team.flatMap((heroId, index) => {
    const hero = gameData.heroes[heroId]!;
    const main = hero.branches[plan.branch].cardIds;
    const other = hero.branches[1 - plan.branch]!.cardIds;
    return [...main, ...other].slice(0, plan.split[index]);
  });
}

function randomDeck(gameData: GameData, team: [string, string, string], seed: number): string[] {
  let rng = seed;
  const pick = (ids: string[], n: number) => {
    const shuffled = shuffle(ids, rng);
    rng = shuffled.rngState;
    return shuffled.items.slice(0, n);
  };
  const pools = team.map((id) => [...gameData.heroes[id]!.cardIds, ...gameData.heroes[id]!.lockedCardIds]);
  const base = pools.flatMap((pool) => pick(pool, 4));
  const rest = pick(pools.flat().filter((id) => !base.includes(id)), gameData.metaConfig.deckSize - base.length);
  return [...base, ...rest];
}

const DECK_PLANS: DeckPlan[] = [
  { label: "nhánh A 6/6/6", split: [6, 6, 6], branch: 0 },
  { label: "nhánh B 6/6/6", split: [6, 6, 6], branch: 1 },
  { label: "nhánh A 4/4/10", split: [4, 4, 10], branch: 0 },
  { label: "nhánh B 8/5/5", split: [8, 5, 5], branch: 1 },
];
```

`simulateRun` nhận thêm `deckCardIds`. Bảng in: với mỗi đội × seed 1–20, chạy Bộ cơ bản (`starterDeck`), 4 `DECK_PLANS`, và `randomDeck(..., seed)`; tổng hợp tỉ lệ thắng lượt chơi, tầng TB, vòng TB trận thường/Tinh Anh, % Cạn Bài, % kẹt tay theo loại deck. Thêm bảng "lá chưa từng được đánh" (so danh sách 60 lá với `cardPlayed` quan sát được) và "số lượt TB tới cấp Tu Luyện 6" = `masteryLevels.at(-1) / (XP TB mỗi lượt theo công thức meta-config)` với XP TB lấy từ kết quả Bộ cơ bản.

- [ ] **Step 3: Chạy và đọc số**

Run: `pnpm --filter rules exec vitest run test/playtest.test.ts test/run-playtest.test.ts --reporter=verbose --silent=false`
Expected: PASS; bảng in ra console.

- [ ] **Step 4: So với mục tiêu spec §8** — deck nhánh/ngẫu nhiên trong ±15 điểm % so với Bộ cơ bản; trận thường/Tinh Anh 8–12 vòng; Cạn Bài < 10% trận; kẹt tay < 10% lượt; mọi lá mới được đánh; số lượt tới cấp 6 trong 8–12. Nếu lệch: ablation bằng file tạm `packages/rules/test/zz-ablation.test.ts` (không commit) — đổi cost/`copies`/số hiệu ứng của lá lệch, hoặc `masteryLevels` / `masteryXp`.

- [ ] **Step 5: Trình người dùng duyệt** gói chỉnh (bảng trước/sau theo loại deck). **Không sửa data trước khi được duyệt.**

- [ ] **Step 6: Áp gói đã duyệt**; chạy lại playtest; test luật vỡ → chuyển sang fixture (test luật không được phụ thuộc số cân bằng).

- [ ] **Step 7: `docs/playtest-notes.md`** — mục "# Playtest Notes — Phase 4b": phương pháp, bảng theo loại deck, lá chưa được đánh, nhịp Tu Luyện, gói đã áp (có lý do bằng số), checklist chơi tay (Tích Tụ có đáng giữ lá không; Liên Hoàn có tạo thứ tự đánh thú vị không; Tỏa Nguyệt có thấy rõ chiêu bị hủy không; Tụ Dược có tạo nhịp "rải rồi nổ" không; mở khóa có hào hứng không; deck nhánh có khác cảm giác Bộ cơ bản không).

- [ ] **Step 8: Chạy toàn bộ**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages docs
git commit -m "Step 4b.7: phase 4b playtest by deck type, tuning and notes"
```
