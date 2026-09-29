# Giai đoạn 7a (9 Hero đợt 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Mỗi Task kết thúc bằng `pnpm test` + `pnpm typecheck` xanh và một commit trên nhánh `feature/phase7`. Báo người dùng sau mỗi Task và chờ "ok" trước Task kế tiếp.

**Goal:** Thêm 9 Hero (M01, M02, M03, M04, M07, M08, M10, F01, F08) cùng 4 lá Song Hành, chơi được ở Trận lẻ / Lượt chơi / PvP / co-op, nhờ các cơ chế mới Hộ Vệ (`guard`), Chọn Pha, lá tạo ra trong trận, 9 bộ đếm và 16 nội tại thăng cấp.

**Architecture:** Mọi cơ chế là kiểu mới trong union có sẵn (`StatusId`, `Effect`, `LevelUpCounter`, `LevelUpPassive`, `Action`, `CombatEvent`) được xử lý trong `packages/rules`. Việc đầu lượt theo từng Hero / từng người chơi gom vào file mới `src/turn-passives.ts`, được gọi từ cả `turn.ts` (PvE, PvP) và `coop/turn.ts`. Cơ chế được test bằng cách **sửa `levelUp` của Hero có sẵn qua `mutateData`** trước khi có nội dung; nội dung 9 Hero vào ở Task 7–8 và phải được người dùng duyệt danh sách lá trước khi viết JSON.

**Tech Stack:** TypeScript strict, pnpm workspaces, Vitest, zod (`packages/data`), Fastify (chỉ sửa schema Action), Phaser (client).

**Spec:** `docs/18-phase7-spec.md` §1–§2 (7a). Khi plan và spec khác nhau về luật, spec là chuẩn; khi spec và tài liệu luật (`01`, `02`, `14`) khác nhau, tài liệu luật là chuẩn. Các điểm plan làm rõ spec được liệt kê ở Task 1 bước 1 và phải đưa vào tài liệu.

## Global Constraints

- `packages/rules` thuần: không Phaser, DOM, mạng, file system, `Math.random()`, `Date.now()`. Ngẫu nhiên dùng RNG trong `CombatState` (`nextRandom` trong `src/rng.ts`).
- Hàm thuần, không mutate state đầu vào: `applyAction` luôn `cloneState` trước khi sửa.
- **T213 (ghi vàng PvE, `packages/rules/test/golden.test.ts`) xanh sau mỗi Task.** Không có Task nào của 7a được đổi kết quả trận/lượt chơi cũ. Nếu T213 đỏ: dừng, tìm nguyên nhân, không ghi vàng lại khi chưa được người dùng duyệt.
- Event PvE giữ nguyên hình dạng; trường `player` chỉ xuất hiện qua `seatTag(state, index)`.
- Trường state mới là **optional** (`?:`) và chỉ được gán khi cơ chế mới chạy, để state trận cũ không đổi.
- Không hardcode số liệu Hero/lá trong code; số nằm trong JSON (`heroes.json`, `cards.json`, `combat-config.json`, `pvp-config.json`, `banners.json`).
- Code, tên biến, comment: tiếng Anh. Chữ cho người chơi: tiếng Việt, từ dữ liệu hoặc `apps/client/src/theme.ts`.
- Thuật ngữ theo `docs/04-glossary.md` (Task 1 thêm: Hộ Vệ, Chọn Pha, Lá Tạo Ra).
- Mã test T263–T276, tên test bắt đầu bằng mã (`it("T263: …")`).
- Không thêm thư viện mới.
- Lệnh: `pnpm --filter rules test`, `pnpm --filter data test`, `pnpm --filter server test`, `pnpm test`, `pnpm typecheck` (chạy ở gốc repo `D:\Source\VongNguyet`).

---

## File Structure

| File | Trách nhiệm | Task |
|---|---|---|
| `docs/{00,01,02,04,06,07}.md`, `CLAUDE.md`, `docs/18-phase7-spec.md` | Tài liệu luật 7a | 1 |
| `packages/rules/src/types/static.ts` | `StatusId "guard"`, `LevelUpCounter`, `LevelUpPassive`, `Effect "createCard"`, `CardDef.token`, `LevelUpDef.onLevelUp`, `CombatConfig.levelUpRandomBuffs` | 2–6 |
| `packages/rules/src/types/state.ts` | `PlayerState.pendingChoice` (union), `moonChoicePending?`, `createdCards?`; `CardInstance.turnDiscount?`; `HeroState.firstSchemeUsedThisTurn?` | 3, 4, 6 |
| `packages/rules/src/types/events.ts` | `Action "chooseMoon"`; event `moonChoiceOpened`, `cardCreated` | 3, 4 |
| `packages/data/src/schema.ts`, `load-game-data.ts` | zod + kiểm chéo cho mọi kiểu mới | 2–6 |
| `packages/rules/src/statuses.ts` | `guard` có `sourceId`, có thời hạn | 2 |
| `packages/rules/src/enemy-turn.ts` | `guardianOf`, chuyển mục tiêu chiêu địch | 2 |
| `packages/rules/src/preview.ts` | Xem trước hiện người hộ vệ | 2 |
| `packages/rules/src/turn-passives.ts` (mới) | `heroTurnStart`, `seatTurnStart`, `openMoonChoice`, `passiveOf` | 2, 3, 5, 6 |
| `packages/rules/src/turn.ts`, `coop/turn.ts` | Gọi `heroTurnStart` / `seatTurnStart`; Huyết Nguyệt bỏ qua `bloodMoonImmune`; xóa `turnDiscount` cuối lượt | 2, 3, 6 |
| `packages/rules/src/apply-action.ts` | PvP chuyển mục tiêu `guard`; Action `chooseMoon`; bộ đếm khi đánh lá; `firstSchemeRepeats` | 2, 3, 5, 6 |
| `packages/rules/src/effects.ts` | Effect `createCard`; bộ đếm; nội tại damage/heal/loseHp/shiftMoon/chooseCard | 4, 5, 6 |
| `packages/rules/src/levelup.ts` | `onLevelUp` cho dạng thường; `bumpSeat` | 4, 5 |
| `packages/rules/src/queries.ts` | Giảm cost: `turnDiscount`, `tagDiscountOwnCards` | 6 |
| `packages/rules/src/choice.ts` (mới) | `autoChoiceAction` (server hết giờ, bot) | 3 |
| `packages/rules/src/bot.ts` | Bot trả lời Chọn Pha; heuristic cơ chế mới | 3, 10 |
| `packages/rules/test/phase7a-mechanics.test.ts` (mới) | T263–T275 | 2–6 |
| `packages/rules/test/helpers.ts` | `withLevelUp` (sửa `levelUp` / `altLevelUp` của Hero có sẵn) | 2 |
| `packages/rules/test/golden.ts` | Chiếu `pendingChoice` với union | 3 |
| `apps/server/src/routes/runs.ts`, `realtime/protocol.ts`, `realtime/match-room.ts`, `test/helpers.ts` | Action `chooseMoon`; hết giờ dùng `autoChoiceAction` | 3 |
| `packages/data/{heroes,cards,banners,pvp-config,combat-config}.json` | Nội dung | 6, 7, 8 |
| `packages/rules/test/phase7a-heroes.test.ts` (mới) | T276 + test từng Hero | 7, 8 |
| `apps/client/src/scenes/combat-scene.ts`, `debug.ts`, `theme.ts` | Khung Chọn Pha, nhãn Hộ Vệ, lá tạo ra | 9 |
| `packages/rules/test/pvp-sim.ts`, `run-playtest.test.ts`, `docs/playtest-notes.md` | Mô phỏng + chỉnh số | 10 |

---

### Task 1: Tài liệu 7a (bước 7a.1)

**Files:**
- Modify: `docs/00-gdd.md` (§4 bảng Hero, §12 lộ trình), `docs/01-combat-rules.md` (§3.1, §3.3, §4, §5, §6.1, §8, §9.3.1, §15.4), `docs/02-data-schema.md`, `docs/04-glossary.md`, `docs/06-test-scenarios.md`, `docs/07-implementation-plan.md`, `CLAUDE.md`, `docs/18-phase7-spec.md`

**Interfaces:**
- Consumes: spec `18` §2.
- Produces: luật chuẩn cho Task 2–10.

- [ ] **Step 1: Chốt các điểm plan làm rõ spec** — sửa `docs/18-phase7-spec.md` §2.2 cho khớp:
  - `createCard` chỉ có `{ cardId }` (luôn vào tay; bỏ `to`). Id instance = `prefixedId(state, seat, "t<n>")`: PvE là `t1`, `t2`…; nhiều người chơi là `p<i>_t<n>`.
  - `pendingChoice` thành union `{ kind: "chooseCard"; options: string[] } | { kind: "chooseMoon"; options: number[] }`. Event mới `moonChoiceOpened { options: number[] }` (không dùng lại `choiceOpened`).
  - Thứ tự đầu lượt người chơi, sau hook `playerTurnStart`: (1) Thiên Cơ gắn giảm giá, (2) Vạn Kim mở Chiêm Bài, (3) Chọn Pha mở **sau khi** Chiêm Bài đã được trả lời (nếu có). Chọn Pha chỉ được "nợ" khi Hero đã thăng cấp **lúc đầu lượt**; thăng cấp giữa lượt thì từ lượt sau.
  - `LevelUpDef.onLevelUp?: Effect[]` (dạng thường, dùng cho F01) và nội tại `{ type: "none" }` (F01 dạng thường, M03 dạng thứ hai).
  - `combatConfig.levelUpRandomBuffs: { status, amount }[]` là bảng buff của Huyết Mạch (M07).
  - Bác Học (M10): lượt giải quyết thứ nhất bỏ mọi effect `chooseCard`, lượt thứ hai giải quyết đầy đủ.
  - `cardsChosen` và `schemeCardsPlayed` là bộ đếm của **cả người chơi** (mọi Hero còn sống của người đó được +1, `bumpCounter` chỉ tính cho Hero có đúng bộ đếm).
  - Nội tại M03 Vạn Kim có dạng `{ type: "freeChooseCardPerTurn"; look: number }`.
- [ ] **Step 2: `01-combat-rules.md`**
  - §6.1 thêm dòng `guard` | Hộ Vệ | có thời hạn (vòng) | đòn đơn mục tiêu nhắm Hero này chuyển sang Hero `sourceId` nếu còn sống; không đặt lên chính mình; đặt lại thay `sourceId` và cộng thời hạn.
  - §9.3.1 thêm bước **1b** sau Khiêu Khích: mục tiêu có `guard` còn người hộ vệ sống → mục tiêu là người hộ vệ; +1 `hitsIntercepted` cho người hộ vệ; nếu người hộ vệ có nội tại `interceptArmor` → nhận giáp trước khi chiêu giải quyết.
  - §15.4 (PvP): lá đơn mục tiêu nhắm Hero đối thủ có `guard` → chuyển sang người hộ vệ theo cùng luật.
  - §3.1 thêm bước cuối "Nội tại đầu lượt" theo thứ tự ở Step 1; §3.1 thêm các nội tại đầu lượt theo Hero (`armorPerTurn`, `randomBuffPerTurn`, bộ đếm `turnsSurvived` từ vòng 2, `studyPoints`, `fullMoonsSeen`).
  - §4 thêm mục "Lá tạo ra" (`createCard`, `token`); §5 thêm Action `chooseMoon`.
  - §8 bảng thăng cấp: 9 Hero với bộ đếm, ngưỡng, nội tại, dạng thứ hai theo `18` §2.1.
- [ ] **Step 3: `02-data-schema.md`** — `StatusId` thêm `guard`; `LevelUpCounter` thêm 9 giá trị (`hitsIntercepted`, `schemeCardsPlayed`, `cardsChosen`, `hpHealed`, `turnsSurvived`, `moonShifts`, `studyPoints`, `fullMoonsSeen`, `forbiddenHpLost`); `LevelUpPassive` thêm 16 dạng (liệt kê ở Task 2–6); `Effect` thêm `createCard`; `CardDef.token`; `LevelUpDef.onLevelUp`; `CombatConfig.levelUpRandomBuffs`; `PlayerState.pendingChoice` union; `Action chooseMoon`; event `moonChoiceOpened`, `cardCreated`; kiểm chéo mới ở §6 (Task 4 Step 6).
- [ ] **Step 4: `04-glossary.md`** — thêm Hộ Vệ (`guard`), Chọn Pha (`chooseMoon`), Lá Tạo Ra (`token`), và tên 9 Hero + tên nội tại/dạng thăng cấp.
- [ ] **Step 5: `06-test-scenarios.md`** — thêm bảng T263–T276 đúng như cột "Test" của Task 2–8 dưới đây (mỗi dòng một câu mô tả kịch bản, tiền tố **[GĐ7]**).
- [ ] **Step 6: `07-implementation-plan.md`** — thêm mục "Giai đoạn 7" với bước 7a.1–7a.6 (tên như Task 1–10 của plan này, ghi đường dẫn plan) và dòng 7b/7c/7d trỏ tới spec `18`. `00` §12: đổi dòng giai đoạn 7 thành "Đủ 20 Hero, Cốt truyện Arc 1–2, trang bị bản mệnh + nâng cấp vật liệu (`18`)". `CLAUDE.md` "Giai đoạn hiện tại": "7a đang làm — `docs/18-phase7-spec.md`".
- [ ] **Step 7: Kiểm tra và commit**

Run: `pnpm test && pnpm typecheck`
Expected: PASS (chỉ đổi tài liệu).

```bash
git add docs CLAUDE.md
git commit -m "Step 7a.1: phase 7a rule docs"
```

---

### Task 2: Hộ Vệ (`guard`), `hitsIntercepted`, `armorPerTurn`, `interceptArmor` (bước 7a.2, phần 1)

**Files:**
- Modify: `packages/rules/src/types/static.ts`, `packages/data/src/schema.ts`, `packages/rules/src/statuses.ts`, `packages/rules/src/enemy-turn.ts`, `packages/rules/src/preview.ts`, `packages/rules/src/apply-action.ts`, `packages/rules/src/turn.ts`, `packages/rules/src/coop/turn.ts`
- Create: `packages/rules/src/turn-passives.ts`, `packages/rules/test/phase7a-mechanics.test.ts`
- Modify: `packages/rules/test/helpers.ts`

**Interfaces:**
- Produces:
  - `StatusId` có `"guard"`; `LevelUpCounter` có `"hitsIntercepted"`; `LevelUpPassive` có `{ type: "armorPerTurn"; amount: number }` và `{ type: "interceptArmor"; amount: number }`.
  - `guardianOf(state: CombatState, targetId: string): HeroState | undefined` (export từ `enemy-turn.ts`).
  - `interceptHit(data: GameData, guardian: HeroState, events: CombatEvent[]): void` (export từ `turn-passives.ts`).
  - `passiveOf(data: GameData, hero: HeroState): LevelUpPassive | undefined` — nội tại đang có hiệu lực (Hero còn sống và đã thăng cấp), export từ `turn-passives.ts`.
  - `heroTurnStart(data: GameData, state: CombatState, hero: HeroState, events: CombatEvent[]): void` (export từ `turn-passives.ts`).
  - Test helper `withLevelUp(heroId: string, patch: { counter?: LevelUpCounter; threshold?: number; passive?: LevelUpPassive; altPassive?: LevelUpPassive }): (data: GameData) => void`.

- [ ] **Step 1: Thêm helper test** — cuối `packages/rules/test/helpers.ts`:

```ts
/** Rewrites an existing hero's level-up so a phase-7 mechanic can be tested before its hero exists. */
export function withLevelUp(
  heroId: string,
  patch: { counter?: LevelUpCounter; threshold?: number; passive?: LevelUpPassive; altPassive?: LevelUpPassive },
): (data: GameData) => void {
  return (data) => {
    const hero = data.heroes[heroId]!;
    hero.levelUp = {
      ...hero.levelUp,
      ...(patch.counter !== undefined ? { counter: patch.counter } : {}),
      ...(patch.threshold !== undefined ? { threshold: patch.threshold, constellationThreshold: patch.threshold } : {}),
      ...(patch.passive !== undefined ? { passive: patch.passive } : {}),
    };
    if (patch.altPassive !== undefined) hero.altLevelUp = { ...hero.altLevelUp, passive: patch.altPassive };
  };
}
```
Thêm `LevelUpCounter, LevelUpPassive` vào dòng `import type` đầu file.

- [ ] **Step 2: Viết test thất bại** — tạo `packages/rules/test/phase7a-mechanics.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { CardDef, CombatState, GameData, IntentDef } from "../src/index";
import { applyAction, createPvpCombat, previewEnemyIntent } from "../src/index";
import { idleIntent } from "./fixtures";
import { injectCard, makeEnemiesIdle, makeTestCombat, p0, setIntent, testData, withLevelUp } from "./helpers";

/** Puts a test card into `seat`'s hand (injectCard only knows seat 0). */
function giveCard(state: CombatState, data: GameData, seat: number, card: CardDef): string {
  const instanceId = injectCard(state, data, card);
  state.players[0]!.hand = state.players[0]!.hand.filter((id) => id !== instanceId);
  state.cards[instanceId]!.player = seat;
  state.players[seat]!.hand.push(instanceId);
  return instanceId;
}

const strike6: IntentDef = {
  id: "t_strike6", name: "Đánh", kind: "attack", targeting: "front",
  effects: [{ type: "damage", amount: 6, to: "chosen" }],
};

describe("phase 7a — Hộ Vệ", () => {
  it("T263: an enemy hit aimed at a guarded hero lands on the guardian", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.heroes[1]!.statuses.push({ id: "guard", value: 1, sourceId: "hero:m05" });
        setIntent(s, 0, strike6, "hero:f04");
        setIntent(s, 1, idleIntent, null);
      },
    });
    const result = applyAction(data, state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: "intentExecuted", intentId: "t_strike6", targetId: "hero:m05" }),
    );
    expect(result.state.heroes[1]!.hp).toBe(state.heroes[1]!.hp);
    expect(result.state.heroes[0]!.hp).toBe(state.heroes[0]!.hp - 6);
  });

  it("T264: taunt picks first, a dead guardian does not redirect, the preview shows the guardian", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.heroes[1]!.statuses.push({ id: "guard", value: 1, sourceId: "hero:m05" });
        setIntent(s, 0, strike6, "hero:f04");
        setIntent(s, 1, idleIntent, null);
      },
    });
    expect(previewEnemyIntent(data, state, state.enemies[0]!)!.intents[0]!.targetId).toBe("hero:m05");

    const tauntOnGuarded = structuredClone(state);
    tauntOnGuarded.heroes[2]!.statuses.push({ id: "taunt", value: 1 });
    tauntOnGuarded.heroes[2]!.statuses.push({ id: "guard", value: 1, sourceId: "hero:m05" });
    const taunted = applyAction(data, tauntOnGuarded, { type: "endTurn" });
    if (!taunted.ok) throw new Error(taunted.error);
    expect(taunted.events).toContainEqual(
      expect.objectContaining({ type: "intentExecuted", intentId: "t_strike6", targetId: "hero:m05" }),
    );

    const deadGuardian = structuredClone(state);
    deadGuardian.heroes[0]!.alive = false;
    deadGuardian.heroes[0]!.hp = 0;
    const plain = applyAction(data, deadGuardian, { type: "endTurn" });
    if (!plain.ok) throw new Error(plain.error);
    expect(plain.events).toContainEqual(
      expect.objectContaining({ type: "intentExecuted", intentId: "t_strike6", targetId: "hero:f04" }),
    );
  });

  it("T265: hitsIntercepted counts each redirected intent and levels the guardian", () => {
    const { data, state } = makeTestCombat({
      mutateData: withLevelUp("m05", { counter: "hitsIntercepted", threshold: 1 }),
      setup: (s) => {
        s.heroes[1]!.statuses.push({ id: "guard", value: 1, sourceId: "hero:m05" });
        setIntent(s, 0, strike6, "hero:f04");
        setIntent(s, 1, idleIntent, null);
      },
    });
    const result = applyAction(data, state, { type: "endTurn" });
    if (!result.ok) throw new Error(result.error);
    expect(result.state.heroes[0]!.levelUpCounter).toBe(1);
    expect(result.state.heroes[0]!.leveledUp).toBe(true);
  });

  it("T266: armorPerTurn grants armor at turn start; interceptArmor shields the guardian before the hit", () => {
    const perTurn = makeTestCombat({
      mutateData: (d) => { makeEnemiesIdle(d); withLevelUp("m05", { passive: { type: "armorPerTurn", amount: 4 } })(d); },
      setup: (s) => { s.heroes[0]!.leveledUp = true; },
    });
    const next = applyAction(perTurn.data, perTurn.state, { type: "endTurn" });
    if (!next.ok) throw new Error(next.error);
    expect(next.state.heroes[0]!.armor).toBe(4);

    const shield = makeTestCombat({
      mutateData: withLevelUp("m05", { passive: { type: "interceptArmor", amount: 2 } }),
      setup: (s) => {
        s.heroes[0]!.leveledUp = true;
        s.heroes[1]!.statuses.push({ id: "guard", value: 1, sourceId: "hero:m05" });
        setIntent(s, 0, strike6, "hero:f04");
        setIntent(s, 1, idleIntent, null);
      },
    });
    const hit = applyAction(shield.data, shield.state, { type: "endTurn" });
    if (!hit.ok) throw new Error(hit.error);
    expect(hit.events).toContainEqual({ type: "damageDealt", sourceId: "enemy:0", targetId: "hero:m05", amount: 6, blocked: 2, hpLost: 4 });
  });

  it("T265b: PvP cards aimed at a guarded hero hit the guardian", () => {
    const data = testData();
    const loadout = { heroes: {}, pvp: true as const };
    const created = createPvpCombat(data, {
      seed: 7,
      players: [
        { heroIds: ["m05", "f04", "m06"], loadout },
        { heroIds: ["m05", "f04", "m06"], loadout },
      ],
    });
    let state = created.state;
    for (const seat of [0, 1]) {
      const r = applyAction(data, state, { type: "mulligan", instanceIds: [], player: seat });
      if (!r.ok) throw new Error(r.error);
      state = r.state;
    }
    const attacker = state.activePlayer;
    const defender = 1 - attacker;
    const guarded = state.heroes.find((h) => h.player === defender && h.defId === "f04")!;
    const guardian = state.heroes.find((h) => h.player === defender && h.defId === "m05")!;
    guarded.statuses.push({ id: "guard", value: 2, sourceId: guardian.id });
    const instanceId = giveCard(state, data, attacker, {
      id: "test_poke", name: "Chọc", ownerId: "m06", cost: 0, copies: 1, type: "attack", tags: ["attack"],
      target: "enemy", effects: [{ type: "damage", amount: 5, to: "chosen" }], text: "",
    });
    const played = applyAction(data, state, { type: "playCard", instanceId, targetId: guarded.id, player: attacker });
    if (!played.ok) throw new Error(played.error);
    expect(played.events).toContainEqual(expect.objectContaining({ type: "damageDealt", targetId: guardian.id }));
    expect(played.state.heroes.find((h) => h.id === guarded.id)!.hp).toBe(guarded.hp);
  });
});
```

- [ ] **Step 3: Chạy test để thấy thất bại**

Run: `pnpm --filter rules test -- phase7a-mechanics`
Expected: FAIL (typecheck của vitest báo `"guard"` không thuộc `StatusId`, hoặc assertion sai mục tiêu).

- [ ] **Step 4: Kiểu và schema**

`packages/rules/src/types/static.ts`:
```ts
export type StatusId =
  | "stealth" | "taunt" | "weak" | "vulnerable" | "mark"
  | "burn" | "regen" | "strength" | "empower" | "freeze"
  | "reflect" | "guard";

export type LevelUpCounter =
  | "damageTaken" | "turnsWithAllyRegen" | "enemiesKilled"
  | "freezesApplied" | "buffsStolen"
  | "hitsIntercepted";
```
và thêm vào `LevelUpPassive`:
```ts
  // Phase 7a (`18` §2.1).
  | { type: "armorPerTurn"; amount: number }
  | { type: "interceptArmor"; amount: number }
```
`packages/data/src/schema.ts`: thêm `"guard"` vào `statusIdSchema`; tách enum bộ đếm thành hằng dùng chung và thêm `"hitsIntercepted"`:
```ts
const levelUpCounterSchema = z.enum([
  "damageTaken", "turnsWithAllyRegen", "enemiesKilled",
  "freezesApplied", "buffsStolen",
  "hitsIntercepted",
]);
```
(`heroDefSchema.levelUp.counter` dùng `levelUpCounterSchema`); thêm vào `levelUpPassiveSchema`:
```ts
  z.object({ type: z.literal("armorPerTurn"), amount: z.number().int().positive() }),
  z.object({ type: z.literal("interceptArmor"), amount: z.number().int().positive() }),
```

- [ ] **Step 5: Trạng thái `guard`** — `packages/rules/src/statuses.ts`: thêm `"guard"` vào `DURATION_STATUSES`; trong `applyStatus` giữ `sourceId` cho cả `guard`:
```ts
    if (status === "mark" || status === "guard") existing.sourceId = sourceId;
  ...
  const instance: StatusInstance =
    status === "mark" || status === "guard" ? { id: status, value, sourceId } : { id: status, value };
```
Đặt `guard` lên chính người đánh là vô nghĩa: trong `effects.ts` case `applyStatus`, bỏ qua mục tiêu khi `effect.status === "guard" && target.id === ctx.source.id` (`continue`).

- [ ] **Step 6: `turn-passives.ts`** (mới):

```ts
import { bumpCounter, levelUpPassive } from "./levelup";
import type { CombatEvent, CombatState, GameData, HeroState, LevelUpPassive } from "./types/index";

/** The hero's level-up passive while it is in effect: alive and leveled up (`01` §8). */
export function passiveOf(data: GameData, hero: HeroState): LevelUpPassive | undefined {
  return hero.alive && hero.leveledUp ? levelUpPassive(data, hero) : undefined;
}

/** Hộ Vệ: `guardian` takes a hit meant for a guarded ally (`01` §9.3.1 step 1b). */
export function interceptHit(data: GameData, guardian: HeroState, events: CombatEvent[]): void {
  bumpCounter(data, guardian, "hitsIntercepted", 1);
  const passive = passiveOf(data, guardian);
  if (passive?.type === "interceptArmor") {
    guardian.armor += passive.amount;
    events.push({ type: "armorGained", targetId: guardian.id, amount: passive.amount });
  }
}

/**
 * Per-hero turn-start work shared by PvE/PvP (`turn.ts`) and co-op (`coop/turn.ts`),
 * run after armor removal and before level-up checks (`01` §3.1).
 */
export function heroTurnStart(data: GameData, state: CombatState, hero: HeroState, events: CombatEvent[]): void {
  if (!hero.alive) return;
  const passive = passiveOf(data, hero);
  if (passive?.type === "armorPerTurn") {
    hero.armor += passive.amount;
    events.push({ type: "armorGained", targetId: hero.id, amount: passive.amount });
  }
}
```
`state` chưa dùng ở Task 2 nhưng Task 5–6 dùng; đặt tên `_state` nếu lint báo tham số thừa, đổi lại ở Task 5.

- [ ] **Step 7: Gọi `heroTurnStart`** — `packages/rules/src/turn.ts`, trong vòng `for (const hero of heroesOf(state, player.index))` đang reset `firstCardDiscountUsedThisTurn…`, thêm ở cuối thân vòng: `heroTurnStart(data, state, hero, events);`. `packages/rules/src/coop/turn.ts`, trong vòng `for (const hero of mine)` tương ứng, thêm cùng dòng. Import `heroTurnStart` từ `"../turn-passives"` / `"./turn-passives"`.

- [ ] **Step 8: Chuyển mục tiêu chiêu địch** — `packages/rules/src/enemy-turn.ts`:
```ts
import { interceptHit } from "./turn-passives";
import { getStatus, hasStatus, removeStatus } from "./statuses";
import type { CombatEvent, CombatState, GameData, HeroState, Targeting } from "./types/index";

/** Hộ Vệ: the living guardian standing in for `targetId`, if any (`01` §9.3.1 step 1b). */
export function guardianOf(state: CombatState, targetId: string): HeroState | undefined {
  const target = state.heroes.find((hero) => hero.id === targetId);
  const sourceId = target ? getStatus(target, "guard")?.sourceId : undefined;
  if (sourceId === undefined || sourceId === targetId) return undefined;
  const guardian = state.heroes.find((hero) => hero.id === sourceId);
  return guardian?.alive ? guardian : undefined;
}
```
Trong `runEnemyTurn`, ngay sau khối `if (targetId === null) { … continue; }`:
```ts
        const guardian = guardianOf(state, targetId);
        if (guardian) {
          targetId = guardian.id;
          interceptHit(data, guardian, events);
        }
```
(`reresolveTarget` giữ nguyên.) `bumpCounter` không tự kiểm thăng cấp: thêm `checkLevelUps(data, state, events);` ngay sau `interceptHit(...)` (import từ `./levelup`).

- [ ] **Step 9: Xem trước** — `packages/rules/src/preview.ts`, sau dòng `targetId = reresolveTarget({ ...state }, planned.targetId, intent.targeting);` thêm:
```ts
    if (targetId !== null) targetId = guardianOf(state, targetId)?.id ?? targetId;
```
(import `guardianOf` từ `./enemy-turn`).

- [ ] **Step 10: PvP — lá người chơi** — `packages/rules/src/apply-action.ts`, trong `playCard` trước `resolveEffects(...)`:
```ts
  // Fair Arena: a single-target card aimed at a guarded hero hits the guardian (`01` §15.4).
  let chosenId = action.targetId;
  if (state.mode === "pvp" && card.target === "enemy" && chosenId !== undefined) {
    const guardian = guardianOf(state, chosenId);
    if (guardian && guardian.player !== player.index) {
      chosenId = guardian.id;
      interceptHit(data, guardian, events);
    }
  }
```
và đổi `chosenId: action.targetId` thành `chosenId` trong context của `resolveEffects`. Import `guardianOf` từ `./enemy-turn`, `interceptHit` từ `./turn-passives`.

- [ ] **Step 11: Chạy test**

Run: `pnpm --filter rules test -- phase7a-mechanics`
Expected: PASS T263–T266, T265b.

Run: `pnpm test && pnpm typecheck`
Expected: PASS, gồm T213.

- [ ] **Step 12: Commit**

```bash
git add packages/rules packages/data/src
git commit -m "Step 7a.2: guard status, hitsIntercepted, armorPerTurn, interceptArmor"
```

---

### Task 3: Chọn Pha, Vạn Kim, `autoChoiceAction`, server (bước 7a.2, phần 2)

**Files:**
- Modify: `packages/rules/src/types/static.ts`, `types/state.ts`, `types/events.ts`, `packages/data/src/schema.ts`, `packages/rules/src/turn-passives.ts`, `turn.ts`, `coop/turn.ts`, `apply-action.ts`, `bot.ts`, `index.ts`, `packages/rules/test/golden.ts`
- Create: `packages/rules/src/choice.ts`
- Modify: `apps/server/src/routes/runs.ts`, `apps/server/src/realtime/protocol.ts`, `apps/server/src/realtime/match-room.ts`, `apps/server/test/helpers.ts`, `apps/client/src/scenes/combat-scene.ts` (chỉ cho typecheck; UI ở Task 9)
- Test: `packages/rules/test/phase7a-mechanics.test.ts`

**Interfaces:**
- Consumes: `passiveOf`, `heroTurnStart` (Task 2).
- Produces:
  - `LevelUpPassive` thêm `{ type: "chooseMoon" }`, `{ type: "freeChooseCardPerTurn"; look: number }`.
  - `PlayerState.pendingChoice: PendingChoice | null` với `export type PendingChoice = { kind: "chooseCard"; options: string[] } | { kind: "chooseMoon"; options: number[] }`; `PlayerState.moonChoicePending?: true`.
  - `Action` thêm `{ type: "chooseMoon"; offset: 0 | 1 | 2; player?: number }`; `CombatEvent` thêm `{ type: "moonChoiceOpened"; options: number[]; player?: number }`.
  - `seatTurnStart(data, state, player: PlayerState, events): void`, `openMoonChoice(state, player, events): void` (export từ `turn-passives.ts`).
  - `autoChoiceAction(state: CombatState, seat: number): Action | null` (export từ `choice.ts` qua `index.ts`) — trả lời mặc định cho lựa chọn đang chờ: lá đầu tiên của Chiêm Bài, hoặc `offset: 0` của Chọn Pha.

- [ ] **Step 1: Viết test thất bại** — thêm vào `phase7a-mechanics.test.ts`:

```ts
import { autoChoiceAction, chooseCombatAction } from "../src/index";

describe("phase 7a — Chọn Pha", () => {
  const quanTinh = (d: GameData) => {
    makeEnemiesIdle(d);
    withLevelUp("m06", { passive: { type: "chooseMoon" } })(d);
  };

  it("T267: a leveled chooseMoon hero opens Chọn Pha at turn start; chooseMoon shifts the moon", () => {
    const { data, state } = makeTestCombat({ mutateData: quanTinh, setup: (s) => { s.heroes[2]!.leveledUp = true; } });
    const turn = applyAction(data, state, { type: "endTurn" });
    if (!turn.ok) throw new Error(turn.error);
    expect(turn.state.status).toBe("choosing");
    expect(p0(turn.state).pendingChoice).toEqual({ kind: "chooseMoon", options: [0, 1, 2] });
    expect(turn.events).toContainEqual({ type: "moonChoiceOpened", options: [0, 1, 2] });

    expect(applyAction(data, turn.state, { type: "endTurn" })).toEqual({ ok: false, error: "choice pending" });
    expect(applyAction(data, turn.state, { type: "chooseCard", instanceId: "c01" })).toEqual({ ok: false, error: "no pending choice" });
    expect(applyAction(data, turn.state, { type: "chooseMoon", offset: 3 as 2 })).toEqual({ ok: false, error: "not a choice option" });

    const chosen = applyAction(data, turn.state, { type: "chooseMoon", offset: 2 });
    if (!chosen.ok) throw new Error(chosen.error);
    expect(chosen.state.status).toBe("playerTurn");
    expect(chosen.state.moonIndex).toBe((turn.state.moonIndex + 2) % 8);
    expect(p0(chosen.state).pendingChoice).toBeNull();
    expect(applyAction(data, chosen.state, { type: "chooseMoon", offset: 0 })).toEqual({ ok: false, error: "no pending choice" });
  });

  it("T268: Vạn Kim's Chiêm Bài comes first, then Chọn Pha; mid-turn level-up waits a turn", () => {
    const { data, state } = makeTestCombat({
      mutateData: (d) => {
        quanTinh(d);
        withLevelUp("f04", { passive: { type: "freeChooseCardPerTurn", look: 3 } })(d);
      },
      setup: (s) => { s.heroes[1]!.leveledUp = true; s.heroes[2]!.leveledUp = true; },
    });
    const turn = applyAction(data, state, { type: "endTurn" });
    if (!turn.ok) throw new Error(turn.error);
    const pending = p0(turn.state).pendingChoice!;
    expect(pending.kind).toBe("chooseCard");
    const picked = applyAction(data, turn.state, { type: "chooseCard", instanceId: pending.options[0] as string });
    if (!picked.ok) throw new Error(picked.error);
    expect(p0(picked.state).pendingChoice).toEqual({ kind: "chooseMoon", options: [0, 1, 2] });
    expect(picked.state.status).toBe("choosing");

    // Leveled mid-turn: nothing is owed until next turn, even after a Chiêm Bài is answered.
    const late = makeTestCombat({ mutateData: quanTinh });
    late.state.heroes[2]!.leveledUp = true;
    const look = injectCard(late.state, late.data, chooseThreeCard);
    const opened = applyAction(late.data, late.state, { type: "playCard", instanceId: look });
    if (!opened.ok) throw new Error(opened.error);
    const lateOptions = p0(opened.state).pendingChoice!.options as string[];
    const answered = applyAction(late.data, opened.state, { type: "chooseCard", instanceId: lateOptions[0]! });
    if (!answered.ok) throw new Error(answered.error);
    expect(p0(answered.state).pendingChoice).toBeNull();
    expect(answered.state.status).toBe("playerTurn");
  });

  it("T268b: co-op — when both seats owe Chọn Pha, only seat 0 chooses", () => {
    const data = testData();
    quanTinh(data);
    const side = { heroIds: ["m06", "f04", "m05"] as [string, string, string], loadout: { heroes: {} } };
    let state = createCoopCombat(data, { seed: 7, players: [side, side], encounterId: "enc_coop_01" }).state;
    for (const seat of [0, 1]) {
      const r = applyAction(data, state, { type: "mulligan", instanceIds: [], player: seat });
      if (!r.ok) throw new Error(r.error);
      state = r.state;
    }
    for (const hero of state.heroes) if (hero.defId === "m06") hero.leveledUp = true;
    for (const seat of [0, 1]) {
      const r = applyAction(data, state, { type: "endTurn", player: seat });
      if (!r.ok) throw new Error(r.error);
      state = r.state;
    }
    expect(state.players[0]!.pendingChoice?.kind).toBe("chooseMoon");
    expect(state.players[1]!.pendingChoice).toBeNull();
    expect(state.status).toBe("playerTurn");
  });

  it("T269: autoChoiceAction and the bot answer both kinds of choice", () => {
    const { data, state } = makeTestCombat({ mutateData: quanTinh, setup: (s) => { s.heroes[2]!.leveledUp = true; } });
    const turn = applyAction(data, state, { type: "endTurn" });
    if (!turn.ok) throw new Error(turn.error);
    expect(autoChoiceAction(turn.state, 0)).toEqual({ type: "chooseMoon", offset: 0, player: 0 });
    const bot = chooseCombatAction(data, turn.state, 0);
    expect(bot.type).toBe("chooseMoon");
    expect(applyAction(data, turn.state, bot).ok).toBe(true);
    expect(autoChoiceAction(state, 0)).toBeNull();
  });
});
```
Thêm `createCoopCombat` vào import giá trị từ `../src/index` và `chooseThreeCard` vào import từ `./fixtures`.

- [ ] **Step 2: Chạy test để thấy thất bại**

Run: `pnpm --filter rules test -- phase7a-mechanics`
Expected: FAIL (`chooseMoon` không phải Action / không có `autoChoiceAction`).

- [ ] **Step 3: Kiểu và schema**

`types/static.ts` — `LevelUpPassive` thêm:
```ts
  | { type: "chooseMoon" }
  | { type: "freeChooseCardPerTurn"; look: number }
```
`types/state.ts`:
```ts
/** A choice the seat must answer before acting (`01` §3.1, §4). */
export type PendingChoice =
  | { kind: "chooseCard"; options: string[] }
  | { kind: "chooseMoon"; options: number[] };
```
`PlayerState`: `pendingChoice: PendingChoice | null;` và
```ts
  /** Chọn Pha owed this turn (a hero was leveled with `chooseMoon` at turn start). */
  moonChoicePending?: true;
```
`types/events.ts` — `Action` thêm `| { type: "chooseMoon"; offset: 0 | 1 | 2; player?: number }`; `CombatEvent` thêm `| { type: "moonChoiceOpened"; options: number[]; player?: number }`.
`schema.ts` — `levelUpPassiveSchema` thêm:
```ts
  z.object({ type: z.literal("chooseMoon") }),
  z.object({ type: z.literal("freeChooseCardPerTurn"), look: z.number().int().positive() }),
```

- [ ] **Step 4: `seatTurnStart` và `openMoonChoice`** — thêm vào `turn-passives.ts`:

```ts
import { resolveEffects } from "./effects";
import { heroesOf, seatTag } from "./players";
import type { PlayerState } from "./types/index";

/** Opens Chọn Pha when it is owed and no other choice is pending (`01` §3.1). */
export function openMoonChoice(state: CombatState, player: PlayerState, events: CombatEvent[]): void {
  if (player.moonChoicePending !== true || player.pendingChoice !== null) return;
  if (["won", "lost"].includes(state.status)) return;
  const options = [0, 1, 2];
  player.pendingChoice = { kind: "chooseMoon", options };
  // Co-op keeps the shared turn open while one seat answers (`01` §16.2).
  if (state.mode !== "coop") state.status = "choosing";
  events.push({ type: "moonChoiceOpened", options, ...seatTag(state, player.index) });
}

/**
 * Per-seat turn-start work after the turn-start hooks (`01` §3.1): Vạn Kim's
 * Chiêm Bài, then Chọn Pha (opened once the Chiêm Bài is answered).
 */
export function seatTurnStart(data: GameData, state: CombatState, player: PlayerState, events: CombatEvent[]): void {
  if (["won", "lost"].includes(state.status)) return;
  const heroes = heroesOf(state, player.index);
  for (const hero of heroes) {
    const passive = passiveOf(data, hero);
    if (passive?.type !== "freeChooseCardPerTurn" || player.pendingChoice !== null) continue;
    resolveEffects(data, state, [{ type: "chooseCard", look: passive.look }], { source: hero, noHooks: true }, events);
  }
  const owes = heroes.some((hero) => passiveOf(data, hero)?.type === "chooseMoon");
  // Co-op: one shared moon — when both seats owe, seat 0 chooses (`18` §2.2).
  const partnerChooses =
    state.mode === "coop" && player.index > 0 &&
    state.players.slice(0, player.index).some((seat) =>
      heroesOf(state, seat.index).some((hero) => passiveOf(data, hero)?.type === "chooseMoon"),
    );
  if (owes && !partnerChooses) player.moonChoicePending = true;
  else delete player.moonChoicePending;
  openMoonChoice(state, player, events);
}
```

- [ ] **Step 5: Gọi `seatTurnStart`** — `turn.ts` `startPlayerTurn`: sau dòng cuối `runRelicHooks(data, state, events, { type: "playerTurnStart" }, player.index);` thêm `seatTurnStart(data, state, player, events);`. `coop/turn.ts` `startCoopTurn`: trong vòng `for (const seat of state.players)` sau `runRelicHooks(... "playerTurnStart" ..., seat.index);` thêm `seatTurnStart(data, state, seat, events);`.

- [ ] **Step 6: Action `chooseMoon` và `chooseCard` sau đó mở Chọn Pha** — `apply-action.ts`:
  - `statusError`, nhánh co-op: `if (action.type === "chooseCard" || action.type === "chooseMoon") { return player.pendingChoice === null ? "no pending choice" : null; }`.
  - nhánh `switch (state.status)`: `case "choosing": return action.type === "chooseCard" || action.type === "chooseMoon" ? null : "choice pending";` và `case "playerTurn": return action.type === "chooseCard" || action.type === "chooseMoon" ? "no pending choice" : null;`.
  - case `chooseCard` của `applyAction`:
```ts
    case "chooseCard": {
      const pending = seat.pendingChoice;
      if (pending?.kind !== "chooseCard") return { ok: false, error: "no pending choice" };
      if (!pending.options.includes(action.instanceId)) return { ok: false, error: "not a choice option" };
      const next = cloneState(state);
      const events: CombatEvent[] = [];
      const nextSeat = next.players[seat.index]!;
      chooseCard(next, nextSeat, action.instanceId, events);
      openMoonChoice(next, nextSeat, events);
      return { ok: true, state: next, events };
    }
    case "chooseMoon": {
      const pending = seat.pendingChoice;
      if (pending?.kind !== "chooseMoon") return { ok: false, error: "no pending choice" };
      if (!pending.options.includes(action.offset)) return { ok: false, error: "not a choice option" };
      const next = cloneState(state);
      const events: CombatEvent[] = [];
      chooseMoon(data, next, next.players[seat.index]!, action.offset, events);
      return { ok: true, state: next, events };
    }
```
  - hàm mới trong `apply-action.ts`:
```ts
function chooseMoon(data: GameData, state: CombatState, player: PlayerState, offset: number, events: CombatEvent[]): void {
  player.pendingChoice = null;
  delete player.moonChoicePending;
  if (state.mode !== "coop") state.status = "playerTurn";
  if (offset === 0) return;
  const chooser = heroesOf(state, player.index).find((hero) => passiveOf(data, hero)?.type === "chooseMoon")!;
  resolveEffects(data, state, [{ type: "shiftMoon", amount: offset }], { source: chooser }, events);
}
```
  - Trong hàm `chooseCard` hiện có, `player.pendingChoice!.options` đổi thành đọc sau khi đã kiểm `kind` (hàm nhận `options: string[]` làm tham số thay vì đọc `pendingChoice`): đổi chữ ký thành `chooseCard(state, player, instanceId, options, events)` và truyền `pending.options`.
  - Import `openMoonChoice, passiveOf` từ `./turn-passives`.

- [ ] **Step 7: Co-op tự trả lời khi `endTurn`** — `coop/turn.ts` `coopEndTurn`, sau khối `if (seat.pendingChoice !== null && seat.pendingChoice.kind === "chooseCard") {…}` thêm:
```ts
  if (seat.pendingChoice?.kind === "chooseMoon") {
    // The timer path keeps the moon where it is (`offset 0`).
    seat.pendingChoice = null;
    delete seat.moonChoicePending;
  }
```

- [ ] **Step 8: `choice.ts`** (mới) và export:
```ts
import type { Action, CombatState } from "./types/index";

/** The default answer to a seat's pending choice (server timer, bots): first card / keep the moon. */
export function autoChoiceAction(state: CombatState, seat: number): Action | null {
  const pending = state.players[seat]?.pendingChoice;
  if (!pending) return null;
  if (pending.kind === "chooseMoon") return { type: "chooseMoon", offset: 0, player: seat };
  const instanceId = pending.options[0];
  return instanceId === undefined ? null : { type: "chooseCard", instanceId, player: seat };
}
```
`src/index.ts`: `export { autoChoiceAction } from "./choice";`.

- [ ] **Step 9: Bot** — `bot.ts`, đầu nhánh `if (state.status === "choosing" || player.pendingChoice !== null) {`:
```ts
    if (player.pendingChoice?.kind === "chooseMoon") {
      return { type: "chooseMoon", offset: bestMoonOffset(data, state, seat) };
    }
```
và hàm:
```ts
/** Chọn Pha: the offset whose phase has the most modifiers matching tags in hand (ties → smaller offset). */
function bestMoonOffset(data: GameData, state: CombatState, seat: number): 0 | 1 | 2 {
  const tags = new Set(state.players[seat]!.hand.flatMap((id) => cardDefOf(data, state, state.cards[id]!)?.tags ?? []));
  let best: 0 | 1 | 2 = 0;
  let bestScore = -1;
  for (const offset of [0, 1, 2] as const) {
    const phase = data.moonPhases[(state.moonIndex + offset) % data.moonPhases.length]!;
    const score = phase.modifiers.filter((m) => "tag" in m ? tags.has(m.tag) : true).length;
    if (score > bestScore) { best = offset; bestScore = score; }
  }
  return best;
}
```
Trong nhánh Chiêm Bài đang có, `player.pendingChoice?.options ?? []` đổi thành `player.pendingChoice?.kind === "chooseCard" ? player.pendingChoice.options : []`.

- [ ] **Step 10: Sửa chỗ đọc `options` dạng chuỗi** — chạy `pnpm typecheck`, sửa từng lỗi do union:
  - `packages/rules/test/golden.ts` `combatProjection`: `pendingChoice: (() => { const p = playerPendingChoice(state); return p?.kind === "chooseCard" ? p.options.map(cardId) : null; })(),` (giữ nguyên đầu ra cho Chiêm Bài).
  - `apps/server/test/helpers.ts:174`: dùng `const { player: _seat, ...action } = autoChoiceAction(state, 0)!;` (import từ `rules`) rồi `return { type: "combat", action };` — bỏ `player` vì nhật ký lượt chơi không mang nó.
  - `apps/client/src/scenes/combat-scene.ts` `renderChoiceOverlay`: đầu hàm `const pending = …pendingChoice!; if (pending.kind !== "chooseCard") return;` rồi dùng `pending.options` (UI Chọn Pha ở Task 9).
  - Chỗ còn lại do `tsc` báo: đọc `kind` trước khi dùng `options`.

- [ ] **Step 11: Server** — `apps/server/src/routes/runs.ts` `combatActionSchema` và `apps/server/src/realtime/protocol.ts` (schema Action trong tin nhắn) thêm:
```ts
  z.object({ type: z.literal("chooseMoon"), offset: z.union([z.literal(0), z.literal(1), z.literal(2)]) }),
```
`apps/server/src/realtime/match-room.ts` `clockExpired`: ở nhánh co-op thay khối `const pending = …; if (pending && pending.options[0] !== undefined) {…}` bằng:
```ts
        const answer = autoChoiceAction(this.state, seat.seat);
        if (answer && !this.applyLogged(seat, answer)) return;
```
và ở nhánh PvP thay `if (this.state.status === "choosing" && pending && …) {…}` bằng:
```ts
    const answer = this.state.status === "choosing" ? autoChoiceAction(this.state, seat.seat) : null;
    if (answer && !this.applyLogged(seat, answer)) return;
```
Nếu sau khi trả lời Chiêm Bài lại mở Chọn Pha (`status` vẫn `choosing`), gọi `autoChoiceAction` thêm một lần trước `endTurn` (vòng `while (this.state.status === "choosing")` tối đa 2 lần).

- [ ] **Step 12: Chạy test**

Run: `pnpm --filter rules test -- phase7a-mechanics`
Expected: PASS T263–T269.

Run: `pnpm test && pnpm typecheck`
Expected: PASS, gồm T213 và `apps/server` (realtime/runs không đổi hành vi).

- [ ] **Step 13: Commit**

```bash
git add packages apps
git commit -m "Step 7a.2: Chọn Pha, Vạn Kim turn-start Chiêm Bài, autoChoiceAction"
```

---

### Task 4: Lá tạo ra (`createCard`, `token`), `onLevelUp` dạng thường, nội tại `none` (bước 7a.2, phần 3)

**Files:**
- Modify: `packages/rules/src/types/static.ts`, `types/state.ts`, `types/events.ts`, `packages/data/src/schema.ts`, `packages/data/src/load-game-data.ts`, `packages/rules/src/effects.ts`, `packages/rules/src/levelup.ts`
- Test: `packages/rules/test/phase7a-mechanics.test.ts`, `packages/data/test/load-game-data.test.ts`

**Interfaces:**
- Produces:
  - `Effect` thêm `{ type: "createCard"; cardId: string }`.
  - `CardDef.token?: true`; `LevelUpDef.onLevelUp?: Effect[]`; `LevelUpPassive` thêm `{ type: "none" }`.
  - `PlayerState.createdCards?: number`.
  - `CombatEvent` thêm `{ type: "cardCreated"; cardId: string; instanceId: string | null; player?: number }` (`instanceId: null` khi tay đầy).

- [ ] **Step 1: Viết test thất bại** — thêm vào `phase7a-mechanics.test.ts`:

```ts
import { createProfile, validateDeck } from "../src/index";

const tokenCard: CardDef = {
  id: "test_token_ult", name: "Tối Thượng", ownerId: "f04", cost: 0, copies: 1, type: "attack",
  tags: ["attack"], target: "enemy", effects: [{ type: "damage", amount: 9, to: "chosen" }], text: "", token: true,
};

describe("phase 7a — lá tạo ra", () => {
  it("T270: onLevelUp createCard puts a token in hand with a stable id; a full hand skips it", () => {
    const { data, state } = makeTestCombat({
      mutateData: (d) => {
        d.cards[tokenCard.id] = tokenCard;
        withLevelUp("f04", { counter: "damageTaken", threshold: 1, passive: { type: "none" } })(d);
        d.heroes.f04!.levelUp.onLevelUp = [{ type: "createCard", cardId: tokenCard.id }];
      },
    });
    const hurt = injectCard(state, data, {
      id: "test_selfcut", name: "Tự Thương", ownerId: "f04", cost: 0, copies: 1, type: "skill", tags: [],
      target: "none", effects: [{ type: "loseHp", amount: 1, to: "self" }], text: "",
    });

    const roomy = structuredClone(state);
    p0(roomy).hand = [hurt];
    const result = applyAction(data, roomy, { type: "playCard", instanceId: hurt });
    if (!result.ok) throw new Error(result.error);
    expect(result.events).toContainEqual({ type: "cardCreated", cardId: tokenCard.id, instanceId: "t1" });
    expect(p0(result.state).hand).toEqual(["t1"]);
    expect(result.state.cards.t1).toMatchObject({ cardId: tokenCard.id, ownerIds: ["f04"], player: 0, heldTurns: 0 });

    // 7 cards in hand: after `hurt` leaves, 6 remain = handSize → no room.
    const full = structuredClone(state);
    p0(full).hand = [hurt, ...p0(full).drawPile.splice(0, 6)];
    const skipped = applyAction(data, full, { type: "playCard", instanceId: hurt });
    if (!skipped.ok) throw new Error(skipped.error);
    expect(skipped.events).toContainEqual({ type: "cardCreated", cardId: tokenCard.id, instanceId: null });
    expect(skipped.state.cards.t1).toBeUndefined();
  });

  it("T271: token cards cannot be deck-built and createCard must point at a token", () => {
    const data = testData();
    data.cards[tokenCard.id] = tokenCard;
    const profile = ownAllHeroes(data, createProfile(data));
    const deck = { heroIds: ["m05", "f04", "m06"] as [string, string, string], cardIds: [...data.heroes.m05!.cardIds, ...data.heroes.f04!.cardIds.slice(0, 5), tokenCard.id, ...data.heroes.m06!.cardIds] };
    expect(validateDeck(data, profile, deck).length).toBeGreaterThan(0);
  });
});
```
(`ownAllHeroes` import thêm từ `./helpers`; `CardDef` đã có trong `import type`.) Test dữ liệu trong `packages/data/test/load-game-data.test.ts` (theo mẫu `rawData()` + `parseGameData` của file):
```ts
  it("T271: createCard must point at a token card owned by the creating hero; tokens stay out of pools", () => {
    const raw = rawData();
    raw.cards.push({ id: "tok_x", name: "X", ownerId: "m05", cost: 0, copies: 1, type: "skill", tags: [], target: "none", effects: [{ type: "gainMoonPower", amount: 1 }], text: "", token: true });
    raw.heroes.find((h: any) => h.id === "f04").levelUp.onLevelUp = [{ type: "createCard", cardId: "tok_x" }];
    expect(() => parseGameData(raw)).toThrow(/createCard .*tok_x.* owned by "f04"/);

    const pooled = rawData();
    pooled.cards.find((c: any) => c.id === pooled.heroes[0].cardIds[0]).token = true;
    expect(() => parseGameData(pooled)).toThrow(/token card .* must not be in a hero pool/);

    const notToken = rawData();
    notToken.heroes[0].levelUp.onLevelUp = [{ type: "createCard", cardId: notToken.heroes[0].cardIds[0] }];
    expect(() => parseGameData(notToken)).toThrow(/createCard .* must be a token card/);
  });
```

- [ ] **Step 2: Chạy test để thấy thất bại**

Run: `pnpm --filter rules test -- phase7a-mechanics && pnpm --filter data test`
Expected: FAIL.

- [ ] **Step 3: Kiểu và schema**

`types/static.ts`: `Effect` thêm `| { type: "createCard"; cardId: string }`; `CardDef` thêm
```ts
  /** Created during combat only (`createCard`): never in a pool, deck or reward (`01` §4). */
  token?: true;
```
`LevelUpDef` thêm `/** Runs once right after the hero levels up in its base form, the hero acting. */ onLevelUp?: Effect[];`; `LevelUpPassive` thêm `| { type: "none" }`.
`types/state.ts` `PlayerState` thêm `/** Cards created this combat (`createCard`); names the next `t<n>` instance. */ createdCards?: number;`.
`types/events.ts` thêm event `cardCreated` như Interfaces.
`schema.ts`: effect `z.object({ actor, type: z.literal("createCard"), cardId: idSchema })`; `cardDefSchema` thêm `token: z.literal(true).optional()`; `heroDefSchema.levelUp` thêm `onLevelUp: z.array(effectSchema).min(1).optional()`; passive `z.object({ type: z.literal("none") })`; `effectTypeSchema` thêm `"createCard"`.

- [ ] **Step 4: Effect** — `effects.ts` `resolveEffect`, thêm case trước `default` (import `prefixedId` từ `./players`):
```ts
    case "createCard": {
      const seat = playerOf(state, ctx.source.id);
      const card = data.cards[effect.cardId];
      if (!seat || card?.ownerId === undefined) return;
      if (seat.hand.length >= data.combatConfig.handSize) {
        events.push({ type: "cardCreated", cardId: card.id, instanceId: null, ...seatTag(state, seat.index) });
        return;
      }
      seat.createdCards = (seat.createdCards ?? 0) + 1;
      const instanceId = prefixedId(state, seat.index, `t${seat.createdCards}`);
      state.cards[instanceId] = { instanceId, cardId: card.id, ownerIds: [card.ownerId], player: seat.index, heldTurns: 0 };
      seat.hand.push(instanceId);
      events.push({ type: "cardCreated", cardId: card.id, instanceId, ...seatTag(state, seat.index) });
      return;
    }
```
- [ ] **Step 5: `onLevelUp` dạng thường** — `levelup.ts` `checkLevelUps`: đổi dòng
```ts
      const onLevelUp = hero.levelUpForm === "alt" ? def.altLevelUp.onLevelUp : def.levelUp.onLevelUp;
```
- [ ] **Step 6: Kiểm chéo** — `load-game-data.ts`, cạnh các kiểm tra `heroes:` (quanh dòng 310–330), thêm:
```ts
  // Lá tạo ra (`02` §6): createCard targets a token of the creating hero; tokens stay out of pools.
  const createdIn = (effects: Effect[]): string[] =>
    effects.flatMap((effect) =>
      effect.type === "createCard" ? [effect.cardId]
        : effect.type === "conditional" ? [...createdIn(effect.then), ...createdIn(effect.else ?? [])]
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
```
(`cardById`, `pooled` là tên đang dùng trong file cho map lá và tập lá thuộc pool — nếu tên khác, dùng tên hiện có; `pooled` được tạo ở kiểm tra "plus card must not be in a hero pool".) Kẻ địch, hook Kỳ Vật / vũ khí / Nguyệt Bảo, Hợp Kích: thêm `createCard` vào danh sách effect bị cấm ở cùng chỗ đang cấm `chooseCard` (thông báo `"createCard is not allowed"`).

- [ ] **Step 7: Chạy test**

Run: `pnpm --filter rules test -- phase7a-mechanics && pnpm --filter data test`
Expected: PASS T270, T271.

Run: `pnpm test && pnpm typecheck`
Expected: PASS, gồm T213. Nếu client báo `switch` event chưa đủ (`debug.ts`), thêm `case "cardCreated": return event.instanceId === null ? "Tay đầy — không tạo lá" : "Tạo lá";` và `case "moonChoiceOpened": return "Chọn Pha";`.

- [ ] **Step 8: Commit**

```bash
git add packages apps/client/src/debug.ts
git commit -m "Step 7a.2: createCard tokens, base-form onLevelUp, none passive"
```

---

### Task 5: Tám bộ đếm thăng cấp (bước 7a.2, phần 4)

**Files:**
- Modify: `packages/rules/src/types/static.ts`, `packages/data/src/schema.ts`, `packages/rules/src/levelup.ts`, `packages/rules/src/effects.ts`, `packages/rules/src/apply-action.ts`, `packages/rules/src/coop/turn.ts`, `packages/rules/src/turn-passives.ts`
- Test: `packages/rules/test/phase7a-mechanics.test.ts`

**Interfaces:**
- Consumes: `heroTurnStart` (Task 2).
- Produces:
  - `LevelUpCounter` thêm `"schemeCardsPlayed" | "cardsChosen" | "hpHealed" | "turnsSurvived" | "moonShifts" | "studyPoints" | "fullMoonsSeen" | "forbiddenHpLost"`.
  - `bumpSeat(data, state, seat: number, counter: LevelUpCounter, amount: number): void` (export từ `levelup.ts`) — +amount cho mọi Hero còn sống của người chơi (chỉ Hero có đúng bộ đếm thật sự tăng).
  - `loseHp(...)` trả về `number` (HP thực mất).

- [ ] **Step 1: Viết test thất bại** — thêm vào `phase7a-mechanics.test.ts` (mỗi bộ đếm đặt trên M05 bằng `withLevelUp("m05", { counter, threshold: 99 })`, đọc `heroes[0].levelUpCounter`):

```ts
describe("phase 7a — bộ đếm", () => {
  const counterOn = (counter: LevelUpCounter) => withLevelUp("m05", { counter, threshold: 99 });
  const card = (partial: Partial<CardDef>): CardDef => ({
    id: "test_c", name: "C", ownerId: "m05", cost: 0, copies: 1, type: "skill", tags: [], target: "none",
    effects: [{ type: "gainMoonPower", amount: 0 }], text: "", ...partial,
  });
  const play = (data: GameData, state: CombatState, def: CardDef, targetId?: string) => {
    const instanceId = injectCard(state, data, def);
    const result = applyAction(data, state, { type: "playCard", instanceId, ...(targetId ? { targetId } : {}) });
    if (!result.ok) throw new Error(result.error);
    return result;
  };

  it("T272: every new counter bumps on its trigger", () => {
    // schemeCardsPlayed: a scheme card by any teammate
    let t = makeTestCombat({ mutateData: counterOn("schemeCardsPlayed") });
    expect(play(t.data, t.state, card({ id: "s1", ownerId: "f04", tags: ["scheme"] })).state.heroes[0]!.levelUpCounter).toBe(1);

    // studyPoints: +1 per own scheme card, +1 per turn start alive
    t = makeTestCombat({ mutateData: (d) => { makeEnemiesIdle(d); counterOn("studyPoints")(d); } });
    const s = play(t.data, t.state, card({ id: "s2", tags: ["scheme"] }));
    expect(s.state.heroes[0]!.levelUpCounter).toBe(1);
    const turn = applyAction(t.data, s.state, { type: "endTurn" });
    if (!turn.ok) throw new Error(turn.error);
    expect(turn.state.heroes[0]!.levelUpCounter).toBe(2);

    // turnsSurvived: from round 2 on
    t = makeTestCombat({ mutateData: (d) => { makeEnemiesIdle(d); counterOn("turnsSurvived")(d); } });
    expect(t.state.heroes[0]!.levelUpCounter).toBe(0);
    const r2 = applyAction(t.data, t.state, { type: "endTurn" });
    if (!r2.ok) throw new Error(r2.error);
    expect(r2.state.heroes[0]!.levelUpCounter).toBe(1);

    // fullMoonsSeen: turn start on the full moon
    t = makeTestCombat({ mutateData: (d) => { makeEnemiesIdle(d); counterOn("fullMoonsSeen")(d); }, setup: (st) => { st.moonIndex = 3; } });
    const full = applyAction(t.data, t.state, { type: "endTurn" });
    if (!full.ok) throw new Error(full.error);
    expect(full.state.moonIndex).toBe(4);
    expect(full.state.heroes[0]!.levelUpCounter).toBe(1);

    // moonShifts: shiftMoon from the hero's card
    t = makeTestCombat({ mutateData: counterOn("moonShifts") });
    expect(play(t.data, t.state, card({ id: "s3", effects: [{ type: "shiftMoon", amount: 1 }] })).state.heroes[0]!.levelUpCounter).toBe(1);

    // hpHealed: real HP healed by the hero's card
    t = makeTestCombat({ mutateData: counterOn("hpHealed"), setup: (st) => { st.heroes[1]!.hp -= 4; } });
    expect(play(t.data, t.state, card({ id: "s4", target: "ally", effects: [{ type: "heal", amount: 10, to: "chosen" }] }), "hero:f04").state.heroes[0]!.levelUpCounter).toBe(4);

    // forbiddenHpLost: self loseHp from the hero's forbidden card
    t = makeTestCombat({ mutateData: counterOn("forbiddenHpLost") });
    expect(play(t.data, t.state, card({ id: "s5", tags: ["forbidden"], effects: [{ type: "loseHp", amount: 3, to: "self" }] })).state.heroes[0]!.levelUpCounter).toBe(3);

    // cardsChosen: a Chiêm Bài pick by the seat
    t = makeTestCombat({ mutateData: counterOn("cardsChosen") });
    const opened = play(t.data, t.state, card({ id: "s6", effects: [{ type: "chooseCard", look: 3 }] }));
    const pending = p0(opened.state).pendingChoice!;
    const picked = applyAction(t.data, opened.state, { type: "chooseCard", instanceId: pending.options[0] as string });
    if (!picked.ok) throw new Error(picked.error);
    expect(picked.state.heroes[0]!.levelUpCounter).toBe(1);
  });
});
```
Thêm `LevelUpCounter` vào `import type`. Lưu ý `moonIndex: 3` là `waxingGibbous`, qua cuối vòng thành `full` (4) — kiểm lại thứ tự trong `moon-phases.json` trước khi chạy.

- [ ] **Step 2: Chạy test để thấy thất bại**

Run: `pnpm --filter rules test -- phase7a-mechanics`
Expected: FAIL.

- [ ] **Step 3: Kiểu và schema** — `LevelUpCounter` thêm 8 giá trị ở Interfaces; `levelUpCounterSchema` thêm cùng 8 giá trị.

- [ ] **Step 4: `bumpSeat`** — `levelup.ts`:
```ts
/** Seat-wide counters (`schemeCardsPlayed`, `cardsChosen`): every living hero of the seat is offered the bump. */
export function bumpSeat(data: GameData, state: CombatState, seat: number, counter: LevelUpCounter, amount: number): void {
  for (const hero of state.heroes) {
    if (hero.player === seat && hero.alive) bumpCounter(data, hero, counter, amount);
  }
}
```

- [ ] **Step 5: Điểm tăng bộ đếm**
  - `apply-action.ts` `playCard`, ngay sau khối `if (discounted) …`:
```ts
  if (card.tags.includes("scheme")) {
    bumpSeat(data, state, player.index, "schemeCardsPlayed", 1);
    if (!card.bond) bumpCounter(data, owner, "studyPoints", 1);
  }
```
  - `apply-action.ts` case `chooseCard` (Task 3): sau `chooseCard(...)` thêm `bumpSeat(data, next, seat.index, "cardsChosen", 1); checkLevelUps(data, next, events);` (trước `openMoonChoice`). `effects.ts` case `chooseCard`, nhánh một lá (`options.length === 1`): thêm `bumpSeat(data, state, seat.index, "cardsChosen", 1);`. `coop/turn.ts` `coopEndTurn` nhánh tự chọn Chiêm Bài: thêm `bumpSeat(data, state, seat.index, "cardsChosen", 1);`.
  - `effects.ts` case `heal` và `burstRegen`: sau `events.push({ type: "healed", … })` thêm
```ts
          if (ctx.card !== undefined && ctx.source.side === "hero") bumpCounter(data, ctx.source as HeroState, "hpHealed", healed);
```
  - `effects.ts` case `shiftMoon`: cuối case thêm `if (ctx.card !== undefined && ctx.source.side === "hero") bumpCounter(data, ctx.source as HeroState, "moonShifts", 1);`.
  - `effects.ts` hàm `loseHp`: đổi kiểu trả về thành `number` và `return lost;` ở cuối. Case `loseHp`:
```ts
      for (const target of resolveTargets(state, effect.to, ctx)) {
        const lost = loseHp(data, target, effect.amount, "loseHp", events);
        if (target === ctx.source && ctx.source.side === "hero" && ctx.card?.tags.includes("forbidden")) {
          bumpCounter(data, ctx.source as HeroState, "forbiddenHpLost", lost);
        }
      }
```
  - `turn-passives.ts` `heroTurnStart`, sau khối `armorPerTurn`:
```ts
  if (state.round >= 2) bumpCounter(data, hero, "turnsSurvived", 1);
  bumpCounter(data, hero, "studyPoints", 1);
  if (data.moonPhases[state.moonIndex]!.id === "full") bumpCounter(data, hero, "fullMoonsSeen", 1);
```

- [ ] **Step 6: Chạy test**

Run: `pnpm --filter rules test -- phase7a-mechanics`
Expected: PASS T263–T272.

Run: `pnpm test && pnpm typecheck`
Expected: PASS, gồm T213 (Hero cũ không dùng bộ đếm mới nên `bumpCounter` không đổi gì).

- [ ] **Step 7: Commit**

```bash
git add packages
git commit -m "Step 7a.2: eight phase-7a level-up counters"
```

---

### Task 6: Mười một nội tại còn lại (bước 7a.2, phần 5)

**Files:**
- Modify: `packages/rules/src/types/static.ts`, `types/state.ts`, `packages/data/src/schema.ts`, `packages/data/combat-config.json`, `packages/rules/src/turn-passives.ts`, `turn.ts`, `coop/turn.ts`, `effects.ts`, `apply-action.ts`, `queries.ts`
- Test: `packages/rules/test/phase7a-mechanics.test.ts`

**Interfaces:**
- Consumes: `passiveOf`, `heroTurnStart`, `seatTurnStart` (Task 2–3).
- Produces — `LevelUpPassive` thêm:
```ts
  | { type: "cheapestCardDiscount"; amount: number }        // M01 Thiên Cơ
  | { type: "chooseCardExtraLook"; amount: number }         // M01 Định Cục
  | { type: "healBonusOwnCards"; amount: number }           // M04 Tâm Nhãn
  | { type: "randomBuffPerTurn" }                           // M07 Huyết Mạch
  | { type: "bloodMoonImmune" }                             // M07 Huyết Nguyệt Chi Tử
  | { type: "moonShiftWeakensEnemies"; amount: number }     // M08 Tinh Mệnh
  | { type: "firstSchemeRepeats" }                          // M10 Bác Học
  | { type: "comboAttackBonus"; amount: number }            // M10 Trạng Nguyên
  | { type: "tagDiscountOwnCards"; tag: CardTag; amount: number } // F01 Tự Do
  | { type: "forbiddenNoSelfHpLoss" }                       // F08 Huyết Phượng
  | { type: "bloodMoonAttackBonus"; amount: number }        // F08 Phản Sư
```
  (cùng với `armorPerTurn`, `interceptArmor`, `chooseMoon`, `freeChooseCardPerTurn`, `none` và `healCleanses` sẵn có là đủ 16 nội tại mới của `18` §2.2.)
- `CardInstance.turnDiscount?: number`; `HeroState.firstSchemeUsedThisTurn?: boolean`; `CombatConfig.levelUpRandomBuffs: { status: StatusId; amount: number }[]`.

- [ ] **Step 1: Viết test thất bại** — thêm vào `phase7a-mechanics.test.ts` (dùng `card()`, `play()` của Task 5; chuyển hai hàm đó lên cấp file):

```ts
describe("phase 7a — nội tại", () => {
  const leveled = (heroId: string, passive: LevelUpPassive, extra?: (d: GameData) => void) => ({
    mutateData: (d: GameData) => { makeEnemiesIdle(d); withLevelUp(heroId, { passive })(d); extra?.(d); },
    setup: (s: CombatState) => { s.heroes.find((h) => h.defId === heroId)!.leveledUp = true; },
  });

  it("T273: cost passives — cheapest card discount, own-tag discount, extra Chiêm Bài look", () => {
    const thienCo = makeTestCombat(leveled("m05", { type: "cheapestCardDiscount", amount: 1 }));
    const turn = applyAction(thienCo.data, thienCo.state, { type: "endTurn" });
    if (!turn.ok) throw new Error(turn.error);
    const hand = p0(turn.state).hand;
    const discounted = hand.filter((id) => turn.state.cards[id]!.turnDiscount === 1);
    expect(discounted).toHaveLength(1);
    const cost = (id: string) => getEffectiveCost(thienCo.data, turn.state, id);
    for (const id of hand) expect(cost(id)).toBeGreaterThanOrEqual(cost(discounted[0]!));
    const ended = applyAction(thienCo.data, turn.state, { type: "endTurn" });
    if (!ended.ok) throw new Error(ended.error);
    // Cleared at turn end, then set anew: never stacks across turns.
    const after = Object.values(ended.state.cards).filter((c) => c.turnDiscount !== undefined);
    expect(after).toHaveLength(1);
    expect(after[0]!.turnDiscount).toBe(1);

    const tuDo = makeTestCombat(leveled("m05", { type: "tagDiscountOwnCards", tag: "moon", amount: 1 }));
    const moonCard = injectCard(tuDo.state, tuDo.data, card({ id: "mc", cost: 2, tags: ["moon"] }));
    expect(getEffectiveCost(tuDo.data, tuDo.state, moonCard)).toBe(1);

    const dinhCuc = makeTestCombat(leveled("m05", { type: "chooseCardExtraLook", amount: 1 }));
    const opened = play(dinhCuc.data, dinhCuc.state, card({ id: "look", ownerId: "f04", effects: [{ type: "chooseCard", look: 3 }] }));
    expect(p0(opened.state).pendingChoice!.options).toHaveLength(4);
  });

  it("T274: damage/heal passives — combo bonus, blood moon bonus, heal bonus, no forbidden self-loss, moon shift weakens", () => {
    const combo = makeTestCombat(leveled("m05", { type: "comboAttackBonus", amount: 1 }));
    const first = play(combo.data, combo.state, card({ id: "a2" }));
    const hit = play(combo.data, first.state, card({ id: "a3", type: "attack", tags: ["attack"], target: "enemy", effects: [{ type: "damage", amount: 5, to: "chosen" }] }), "enemy:0");
    expect(hit.events.find((e) => e.type === "damageDealt")).toMatchObject({ amount: 6 });

    const phanSu = makeTestCombat(leveled("m05", { type: "bloodMoonAttackBonus", amount: 3 }, undefined));
    phanSu.state.bloodMoonRounds = 1;
    const bm = play(phanSu.data, phanSu.state, card({ id: "a4", type: "attack", tags: ["attack"], target: "enemy", effects: [{ type: "damage", amount: 5, to: "chosen" }] }), "enemy:0");
    expect(bm.events.find((e) => e.type === "damageDealt")).toMatchObject({ amount: 8 });

    const tamNhan = makeTestCombat(leveled("m05", { type: "healBonusOwnCards", amount: 2 }));
    tamNhan.state.heroes[1]!.hp -= 10;
    const healed = play(tamNhan.data, tamNhan.state, card({ id: "h1", target: "ally", effects: [{ type: "heal", amount: 3, to: "chosen" }] }), "hero:f04");
    expect(healed.events).toContainEqual({ type: "healed", targetId: "hero:f04", amount: 5 });

    const huyetPhuong = makeTestCombat(leveled("m05", { type: "forbiddenNoSelfHpLoss" }));
    const f = play(huyetPhuong.data, huyetPhuong.state, card({ id: "f1", tags: ["forbidden"], effects: [{ type: "loseHp", amount: 3, to: "self" }, { type: "gainArmor", amount: 1, to: "self" }] }));
    expect(f.state.heroes[0]!.hp).toBe(huyetPhuong.state.heroes[0]!.hp);

    const tinhMenh = makeTestCombat(leveled("m05", { type: "moonShiftWeakensEnemies", amount: 1 }));
    const shifted = play(tinhMenh.data, tinhMenh.state, card({ id: "sh", effects: [{ type: "shiftMoon", amount: 1 }] }));
    for (const enemy of shifted.state.enemies.filter((e) => e.alive)) {
      expect(enemy.statuses).toContainEqual({ id: "weak", value: 1 });
    }
  });

  it("T275: turn-start passives — random buff from config (seeded), blood moon immunity, first scheme card resolves twice", () => {
    const huyetMach = makeTestCombat(leveled("m05", { type: "randomBuffPerTurn" }));
    const a = applyAction(huyetMach.data, huyetMach.state, { type: "endTurn" });
    const b = applyAction(huyetMach.data, huyetMach.state, { type: "endTurn" });
    if (!a.ok || !b.ok) throw new Error("endTurn failed");
    const buffIds = huyetMach.data.combatConfig.levelUpRandomBuffs.map((x) => x.status);
    const got = a.state.heroes[0]!.statuses.filter((st) => buffIds.includes(st.id));
    expect(got).toHaveLength(1);
    expect(b.state.heroes[0]!.statuses).toEqual(a.state.heroes[0]!.statuses);

    const immune = makeTestCombat(leveled("m05", { type: "bloodMoonImmune" }));
    immune.state.bloodMoonRounds = 2;
    const bmTurn = applyAction(immune.data, immune.state, { type: "endTurn" });
    if (!bmTurn.ok) throw new Error(bmTurn.error);
    expect(bmTurn.events.some((e) => e.type === "hpLost" && e.cause === "bloodMoon" && e.targetId === "hero:m05")).toBe(false);
    expect(bmTurn.events.some((e) => e.type === "hpLost" && e.cause === "bloodMoon" && e.targetId === "hero:f04")).toBe(true);

    const bacHoc = makeTestCombat(leveled("m05", { type: "firstSchemeRepeats" }));
    const once = play(bacHoc.data, bacHoc.state, card({ id: "sc1", tags: ["scheme"], effects: [{ type: "gainArmor", amount: 2, to: "self" }] }));
    expect(once.state.heroes[0]!.armor).toBe(4);
    const twice = play(bacHoc.data, once.state, card({ id: "sc2", tags: ["scheme"], effects: [{ type: "gainArmor", amount: 2, to: "self" }] }));
    expect(twice.state.heroes[0]!.armor).toBe(6);
    const withChoice = makeTestCombat(leveled("m05", { type: "firstSchemeRepeats" }));
    const chooser = play(withChoice.data, withChoice.state, card({ id: "sc3", tags: ["scheme"], effects: [{ type: "gainArmor", amount: 1, to: "self" }, { type: "chooseCard", look: 3 }] }));
    expect(chooser.state.heroes[0]!.armor).toBe(2);
    expect(p0(chooser.state).pendingChoice!.options).toHaveLength(3);
  });
});
```
Import `getEffectiveCost` (giá trị) và `LevelUpPassive` (kiểu).

- [ ] **Step 2: Chạy test để thấy thất bại**

Run: `pnpm --filter rules test -- phase7a-mechanics`
Expected: FAIL.

- [ ] **Step 3: Kiểu, schema, config** — thêm các dạng ở Interfaces vào `LevelUpPassive` và `levelUpPassiveSchema` (`amount` là `z.number().int().positive()`, `tag` là `cardTagSchema`). `CardInstance` thêm `/** Thiên Cơ: this turn only (`01` §3.1). */ turnDiscount?: number;`. `HeroState` thêm `/** Bác Học: the first scheme card this turn already repeated. */ firstSchemeUsedThisTurn?: boolean;`. `CombatConfig` thêm `/** Huyết Mạch (M07) buff table, rolled with the combat RNG. */ levelUpRandomBuffs: { status: StatusId; amount: number }[];` — schema `levelUpRandomBuffs: z.array(z.object({ status: statusIdSchema, amount: z.number().int().positive() })).min(1)`. `packages/data/combat-config.json` thêm:
```json
  "levelUpRandomBuffs": [
    { "status": "strength", "amount": 1 },
    { "status": "empower", "amount": 3 },
    { "status": "regen", "amount": 3 },
    { "status": "reflect", "amount": 2 }
  ]
```

- [ ] **Step 4: Đầu lượt** — `turn-passives.ts`:
  - `heroTurnStart`, thêm sau bộ đếm: 
```ts
  delete hero.firstSchemeUsedThisTurn;
  if (passive?.type === "randomBuffPerTurn") {
    const table = data.combatConfig.levelUpRandomBuffs;
    const roll = nextRandom(state.rngState);
    state.rngState = roll.rngState;
    const buff = table[Math.floor(roll.value * table.length)]!;
    applyStatus(hero, buff.status, buff.amount, hero.id, events);
  }
```
  (import `nextRandom` từ `./rng`, `applyStatus` từ `./statuses`.)
  - `seatTurnStart`, trước vòng Vạn Kim:
```ts
  for (const hero of heroes) {
    const passive = passiveOf(data, hero);
    if (passive?.type !== "cheapestCardDiscount" || player.hand.length === 0) continue;
    const cheapest = player.hand.reduce((best, id) =>
      getEffectiveCost(data, state, id) < getEffectiveCost(data, state, best) ? id : best);
    const instance = state.cards[cheapest]!;
    instance.turnDiscount = (instance.turnDiscount ?? 0) + passive.amount;
  }
```
  (import `getEffectiveCost` từ `./queries`.)
- [ ] **Step 5: Huyết Nguyệt** — `turn.ts` và `coop/turn.ts`, trong vòng mất HP Huyết Nguyệt: sau `if (!hero.alive) continue;` thêm `if (passiveOf(data, hero)?.type === "bloodMoonImmune") continue;`.
- [ ] **Step 6: Cuối lượt** — `turn.ts` `endSeatTurn`: dòng `for (const instance of Object.values(state.cards)) delete instance.chosenThisTurn;` đổi thành
```ts
  for (const instance of Object.values(state.cards)) {
    delete instance.chosenThisTurn;
    delete instance.turnDiscount;
  }
```
- [ ] **Step 7: Cost** — `queries.ts`:
```ts
/** Tự Do: the owner's cards with `tag` cost less (`01` §8). */
function ownTagDiscount(data: GameData, state: CombatState, instance: CardInstance, tags: readonly CardTag[]): number {
  if (instance.ownerIds.length !== 1) return 0;
  const [owner] = cardOwners(state, instance);
  if (!owner?.leveledUp) return 0;
  const passive = levelUpPassive(data, owner);
  return passive?.type === "tagDiscountOwnCards" && tags.includes(passive.tag) ? passive.amount : 0;
}
```
và trong `getEffectiveCost`: `const passives = firstCardDiscount(...) + bloodMoonDiscount(...) + ownTagDiscount(data, state, instance!, card.tags) + (instance!.turnDiscount ?? 0);`.
- [ ] **Step 8: Effect** — `effects.ts`:
  - `computeDamageAmount`, trong khối `if (ctx.card !== undefined) {` của `attack`:
```ts
      if (passive?.type === "comboAttackBonus") {
        const played = playerOf(state, ctx.source.id)?.cardsPlayedThisTurn ?? 0;
        flat += passive.amount * (played + (ctx.comboBonus ?? 0));
      }
      if (passive?.type === "bloodMoonAttackBonus" && state.bloodMoonRounds > 0) flat += passive.amount;
```
  - case `heal`, trước vòng lặp:
```ts
      const healPassive = cardPassive(data, ctx);
      const bonus = healPassive?.type === "healBonusOwnCards" ? healPassive.amount : 0;
```
    và trong vòng: `const raw = Math.floor((effect.amount + bonus) * multiplier);`.
  - case `loseHp` (Task 5): đầu thân vòng thêm
```ts
        if (target === ctx.source && ctx.card?.tags.includes("forbidden") && cardPassive(data, ctx)?.type === "forbiddenNoSelfHpLoss") continue;
```
  - case `shiftMoon`: cuối case thêm
```ts
      const weakens = cardPassive(data, ctx);
      if (weakens?.type === "moonShiftWeakensEnemies") {
        resolveEffect(data, state, { type: "applyStatus", status: "weak", amount: weakens.amount, to: "allEnemies" }, ctx, events);
      }
```
  - case `chooseCard`: `const extra = heroesOf(state, seat.index).reduce((sum, hero) => { const p = hero.alive && hero.leveledUp ? levelUpPassive(data, hero) : undefined; return sum + (p?.type === "chooseCardExtraLook" ? p.amount : 0); }, 0);` rồi `splice(0, Math.min(effect.look + extra, seat.drawPile.length))`.
- [ ] **Step 9: Bác Học** — `apply-action.ts` `playCard`, thay lời gọi `resolveEffects(... card.effects ...)` bằng:
```ts
  const ctx = { source: owner, actors: owners, card, chosenId, instanceId: instance.instanceId, comboBonus };
  // Bác Học: the owner's first scheme card each turn resolves twice; the first pass skips Chiêm Bài.
  if (passive?.type === "firstSchemeRepeats" && card.tags.includes("scheme") && !owner.firstSchemeUsedThisTurn) {
    owner.firstSchemeUsedThisTurn = true;
    resolveEffects(data, state, card.effects.filter((effect) => effect.type !== "chooseCard"), ctx, events);
  }
  if (!["won", "lost"].includes(state.status) && owners.every((hero) => hero.alive)) {
    resolveEffects(data, state, card.effects, ctx, events);
  }
```
  (Điều kiện `if` thứ hai chỉ khác hành vi cũ khi lượt thứ nhất đã chạy; khi không có Bác Học thì `status` chưa kết thúc và chủ lá còn sống như trước — kiểm T213.)
- [ ] **Step 10: Chạy test**

Run: `pnpm --filter rules test -- phase7a-mechanics`
Expected: PASS T263–T275.

Run: `pnpm test && pnpm typecheck`
Expected: PASS, gồm T213.

- [ ] **Step 11: Commit**

```bash
git add packages
git commit -m "Step 7a.2: phase-7a level-up passives"
```

---

### Task 7: Nội dung đợt 1 — M01, M02, M03, M04, F01 (bước 7a.3)

**Files:**
- Modify: `docs/03-prototype-content.md` (mục mới "GĐ7 — Hero đợt 1"), `packages/data/heroes.json`, `packages/data/cards.json`, `packages/data/pvp-config.json`, `packages/data/banners.json`, `packages/data/meta-config.json` (chỉ nếu kiểm "masteryLevels needs one level per locked card" đòi)
- Create: `packages/rules/test/phase7a-heroes.test.ts`

**Interfaces:**
- Consumes: mọi kiểu của Task 2–6.
- Produces: Hero `m01`, `m02`, `m03`, `m04`, `f01` trong dữ liệu; lá token `f01_nguyet_hoa_chieu_the`.

- [ ] **Step 1: Soạn danh sách lá và trình người dùng duyệt (không viết JSON trước khi duyệt)** — trong `docs/03-prototype-content.md`, với mỗi Hero một bảng 12 lá + lá "+":

| Id | Tên | Cost | Copies | Loại / Tag / Target | Hiệu ứng (theo `Effect`) | Nhánh | Mở sẵn / Khóa |
|---|---|---|---|---|---|---|---|

Ràng buộc bắt buộc (khớp kiểm chéo `load-game-data.ts` và `18` §1.1):
- Id `<heroId>_<ten_khong_dau>`; 6 mở sẵn + 6 khóa; mỗi nhánh đúng 6 lá; ít nhất 2 lá mở sẵn cost ≤ 3; `copies` theo cost (0–1 → 3, 2–4 → 2, 5+ → 1).
- Lá chủ đạo (`signature.cardId`) là lá mở sẵn; lá "+" có `plusOf`, cùng chủ, cùng cost, cùng copies.
- Chỉ dùng effect / điều kiện / từ khóa sẵn có + cơ chế Task 2–6. Lá của M02 đặt `guard` là `target: "ally"`, effect `{ type: "applyStatus", status: "guard", amount: 1, to: "chosen" }`.
- Bộ đếm và nội tại đúng bảng `18` §2.1: M01 `schemeCardsPlayed` 8 → `cheapestCardDiscount 1` / alt `chooseCardExtraLook 1`; M02 `hitsIntercepted` 3 → `armorPerTurn 4` / alt `interceptArmor 2`; M03 `cardsChosen` 5 → `freeChooseCardPerTurn look 3` / alt `none` + `onLevelUp: [{ gainMoonPowerPerTurn 1 }]`; M04 `hpHealed` 20 → `healCleanses` / alt `healBonusOwnCards 2`; F01 `fullMoonsSeen` 1 → `none` + `levelUp.onLevelUp: [{ createCard f01_nguyet_hoa_chieu_the }]` / alt `tagDiscountOwnCards moon 1`. `constellationThreshold = ceil(0.7 × threshold)` (F01: 1).
- Pool mỗi Hero có đủ lá mang tag / hành vi mà bộ đếm của nó cần (ví dụ M01 ≥ 5 lá `scheme` trong pool; F01 có lá `moon`).
- HP PvE: M01 30, M02 42, M03 30, M04 32, F01 32; HP PvP = HP PvE + 12 (như tỉ lệ 5 Hero cũ, chỉnh ở Task 10).
- Lá token *Nguyệt Hoa Chiếu Thế*: `ownerId: "f01"`, `token: true`, không nằm trong pool.

Dừng, gửi người dùng danh sách, chờ "ok" (có thể sửa theo góp ý) rồi mới làm Step 2.

- [ ] **Step 2: Viết test thất bại** — tạo `packages/rules/test/phase7a-heroes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { applyAction, buildPvpLoadout, createProfile, starterDeck, validateDeck } from "../src/index";
import { makeTestCombat, ownAllHeroes, p0, testData } from "./helpers";

const WAVE1 = ["m01", "m02", "m03", "m04", "f01"] as const;

describe("phase 7a heroes — wave 1", () => {
  it("T276a: wave-1 heroes load with full pools, PvP stats and banner slots", () => {
    const data = testData();
    for (const id of WAVE1) {
      const hero = data.heroes[id]!;
      expect(hero.cardIds).toHaveLength(6);
      expect(hero.lockedCardIds).toHaveLength(6);
      expect(data.pvpConfig.heroStats[id]).toBeDefined();
      expect(data.banners.banner_heroes!.pool[hero.rarity]).toContain(id);
    }
    expect(data.cards.f01_nguyet_hoa_chieu_the!.token).toBe(true);
  });

  it("T276b: every wave-1 hero plays a starter combat and a validated starter deck", () => {
    const data = testData();
    const profile = ownAllHeroes(data, createProfile(data));
    for (const id of WAVE1) {
      const team = [id, "f04", "m06"] as [string, string, string];
      expect(validateDeck(data, profile, { heroIds: team, cardIds: starterDeck(data, team) })).toEqual([]);
      const { state } = makeTestCombat({ heroIds: team });
      expect(p0(state).hand.length).toBe(data.combatConfig.handSize);
      expect(buildPvpLoadout(data, profile, { heroIds: team, cardIds: starterDeck(data, team) }).ok).toBe(true);
    }
  });

  it("T276c: F01 levels on the full moon and gets Nguyệt Hoa Chiếu Thế", () => {
    const { data, state } = makeTestCombat({ heroIds: ["f01", "f04", "m06"], setup: (s) => { s.moonIndex = 3; for (const e of s.enemies) e.plannedIntents = []; } });
    const result = applyAction(data, state, { type: "endTurn" });
    if (!result.ok) throw new Error(result.error);
    expect(result.state.heroes[0]!.leveledUp).toBe(true);
    expect(Object.values(result.state.cards).some((c) => c.cardId === "f01_nguyet_hoa_chieu_the")).toBe(true);
  });
});
```
Chữ ký `buildPvpLoadout` / `starterDeck` lấy đúng như export hiện có (`grep -n "export function buildPvpLoadout\|export function starterDeck" packages/rules/src/meta/*.ts`); sửa lời gọi nếu tham số khác. Thêm một `it` cho mỗi Hero còn lại kiểm tra thăng cấp của nó bằng lá thật (M01: đánh 8 lá `scheme` → `leveledUp`; M02: đặt Hộ Vệ rồi 3 chiêu địch bị chuyển; M03: 5 lần Chiêm Bài; M04: hồi 20 HP), theo mẫu T276c.

- [ ] **Step 3: Chạy test để thấy thất bại**

Run: `pnpm --filter rules test -- phase7a-heroes`
Expected: FAIL (`data.heroes.m01` undefined).

- [ ] **Step 4: Viết JSON** theo danh sách đã duyệt: `heroes.json` (5 Hero, `art` rỗng), `cards.json` (60 lá + 5 lá "+" + 1 token), `pvp-config.json` `heroStats`, `banners.json` `banner_heroes.pool` theo độ hiếm (M01, F01 legendary; M02, M04 epic; M03 rare). `pvpConfig.trialHeroIds` không đổi.

- [ ] **Step 5: Chạy test**

Run: `pnpm --filter data test && pnpm --filter rules test`
Expected: PASS. Nếu test gacha cũ (`meta-gacha.test.ts`, `meta-gear.test.ts`) đổi kết quả vì pool banner lớn hơn: đó là thay đổi cố ý — cập nhật kỳ vọng của **test đó** (không phải T213), ghi rõ trong commit. Nếu **T213** đỏ: dừng và báo người dùng.

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add docs/03-prototype-content.md packages
git commit -m "Step 7a.3: heroes M01, M02, M03, M04, F01"
```

---

### Task 8: Nội dung đợt 2 — M07, M08, M10, F08 + 4 Song Hành (bước 7a.4)

**Files:**
- Modify: `docs/03-prototype-content.md`, `packages/data/heroes.json`, `cards.json`, `pvp-config.json`, `banners.json`
- Modify: `packages/rules/test/phase7a-heroes.test.ts`

**Interfaces:**
- Produces: Hero `m07`, `m08`, `m10`, `f08`; lá Song Hành `bond_nguyet_sach` (M01+F01), `bond_than_ve` (M02+M01), `bond_kim_but_dong_tam` (M03+M10), `bond_su_do_nghich_menh` (M08+F08). (Id theo quy ước id Song Hành đang dùng trong `cards.json` — kiểm 3 lá Song Hành cũ và dùng cùng tiền tố.)

- [ ] **Step 1: Soạn danh sách và trình duyệt** — như Task 7 Step 1, với:
  - M07 `turnsSurvived` 5 → `randomBuffPerTurn` / alt `bloodMoonImmune`; M08 `moonShifts` 3 → `chooseMoon` / alt `moonShiftWeakensEnemies 1`; M10 `studyPoints` 5 → `firstSchemeRepeats` / alt `comboAttackBonus 1`; F08 `forbiddenHpLost` 15 → `forbiddenNoSelfHpLoss` / alt `bloodMoonAttackBonus 3`.
  - HP: M07 34, M08 30, M10 30, F08 34. Độ hiếm: M08, F08 legendary; M07, M10 rare.
  - M08 pool có ≥ 4 lá có `shiftMoon`; F08 pool có ≥ 4 lá `forbidden` tự mất HP; M10 pool có ≥ 4 lá `scheme`.
  - 4 lá Song Hành theo `18` §2.3: *Thân Vệ* gồm `applyStatus guard` lên M01 với `actor` là M02 và `gainArmor` cho M02; *Sư Đồ Nghịch Mệnh* gồm `bloodMoon 1` và `shiftMoon` (không mở Chọn Pha: Chọn Pha chỉ là nội tại). Mỗi lá Song Hành phải hợp lệ theo kiểm chéo hiện có (`actor` chỉ trên lá Song Hành, `copies`).
  Chờ người dùng "ok".

- [ ] **Step 2: Viết test thất bại** — thêm vào `phase7a-heroes.test.ts`:
```ts
const WAVE2 = ["m07", "m08", "m10", "f08"] as const;
const BONDS: [string, string][] = [["m01", "f01"], ["m02", "m01"], ["m03", "m10"], ["m08", "f08"]];

describe("phase 7a heroes — wave 2 and bonds", () => {
  it("T276d: 14 heroes load; each bond pair adds its bond card to the deck", () => {
    const data = testData();
    expect(Object.keys(data.heroes)).toHaveLength(14);
    for (const id of WAVE2) expect(data.pvpConfig.heroStats[id]).toBeDefined();
    for (const [a, b] of BONDS) {
      const third = ["m06", "f04", "m05"].find((id) => id !== a && id !== b)!;
      const { state } = makeTestCombat({ heroIds: [a, b, third] });
      const bondIds = Object.values(state.cards).filter((c) => c.ownerIds.length === 2).map((c) => c.ownerIds.slice().sort().join("+"));
      expect(bondIds).toContain([a, b].sort().join("+"));
    }
  });
});
```
và một `it` thăng cấp bằng lá thật cho mỗi Hero đợt 2 (M08: đánh 3 lá `shiftMoon` rồi `endTurn` → `status === "choosing"` với `chooseMoon`; F08: tự mất 15 HP bằng lá `forbidden` → sau đó lá `forbidden` không mất HP; M10: 5 điểm Khổ Học → lá `scheme` đầu tiên giải quyết 2 lần; M07: sống 5 lượt → đầu lượt có 1 buff trong `levelUpRandomBuffs`).

- [ ] **Step 3: Chạy test để thấy thất bại**

Run: `pnpm --filter rules test -- phase7a-heroes`
Expected: FAIL.

- [ ] **Step 4: Viết JSON** theo danh sách đã duyệt (4 Hero, 48 lá + 4 lá "+", 4 lá Song Hành; `heroStats`; banner: M08, F08 legendary; M07, M10 rare).

- [ ] **Step 5: Chạy test**

Run: `pnpm test && pnpm typecheck`
Expected: PASS (T213 xanh; test gacha cập nhật như Task 7 nếu cần). Chạy `pnpm --filter rules test -- phase7a` và kiểm tổng số test T263–T276.

- [ ] **Step 6: Commit**

```bash
git add docs/03-prototype-content.md packages
git commit -m "Step 7a.4: heroes M07, M08, M10, F08 and four bond cards"
```

---

### Task 9: Client 7a (bước 7a.5)

**Files:**
- Modify: `apps/client/src/scenes/combat-scene.ts`, `apps/client/src/debug.ts`, `apps/client/src/theme.ts`

**Interfaces:**
- Consumes: `PendingChoice`, `moonChoiceOpened`, `cardCreated`, status `guard`.

- [ ] **Step 1: Khung Chọn Pha** — `combat-scene.ts` `renderChoiceOverlay`: khi `pending.kind === "chooseMoon"`, vẽ 3 nút ngang (giữ pha / +1 / +2). Mỗi nút hiện `icon` + `name` của `gameData.moonPhases[(state.moonIndex + offset) % 8]` và dòng mô tả modifier (dùng hàm mô tả pha đang dùng cho bánh xe Nguyệt Luân; nếu chưa có hàm dùng chung thì tách hàm đó ra từ chỗ đang vẽ tooltip bánh xe). Tiêu đề: `"Chọn Pha — chọn pha trăng cho lượt này"`. Click → `this.dispatch({ type: "chooseMoon", offset })`.
- [ ] **Step 2: Nhãn Hộ Vệ** — `theme.ts` thêm nhãn trạng thái `guard: "Hộ"` vào bảng nhãn trạng thái; `combat-scene.ts` khi vẽ Hero có `guard`, vẽ đường nối mảnh (màu `COLORS.gold`, alpha 0.5) từ Hero đó tới Hero `sourceId`.
- [ ] **Step 3: Lá tạo ra** — trong hàng đợi animation, event `cardCreated` có `instanceId` → lá bay từ chân dung Hero chủ vào tay (dùng lại tween của `cardsDrawn`); `instanceId: null` → chữ nổi `"Tay đầy"` trên Hero chủ.
- [ ] **Step 4: Chạy thử trên trình duyệt** — theo quy trình kiểm trên preview (`preview_start` cấu hình client trong `.claude/launch.json`; nếu chưa có thì tạo với `pnpm --filter client dev`): chọn đội M08 + M02 + F01 ở Trận lẻ, dùng bảng debug đặt `leveledUp` cho M08, kết thúc lượt → thấy khung Chọn Pha, chọn +2 → bánh xe tiến 2 pha; đánh lá Hộ Vệ → nhãn `Hộ` và đường nối; đặt trăng về Bán Nguyệt+ (debug) để F01 thăng cấp → lá *Nguyệt Hoa Chiếu Thế* bay vào tay. Kiểm `read_console_messages` không có lỗi. Chụp ảnh màn hình làm bằng chứng.
- [ ] **Step 5: Kiểm tra và commit**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

```bash
git add apps/client
git commit -m "Step 7a.5: client Chọn Pha, Hộ Vệ, created cards"
```

---

### Task 10: Bot, mô phỏng, chỉnh số (bước 7a.6)

**Files:**
- Modify: `packages/rules/src/bot.ts`, `packages/rules/test/pvp-sim.ts`, `packages/rules/test/run-playtest.test.ts`, `docs/playtest-notes.md`, JSON số liệu (chỉ sau khi duyệt)

- [ ] **Step 1: Heuristic bot cho cơ chế mới** — `bot.ts`:
  - Lá có `applyStatus guard`: nhắm đồng đội còn sống có HP/maxHP thấp nhất **khác** chủ lá; nếu không có → bỏ qua lá đó.
  - Lá có `shiftMoon`: chỉ đánh nếu pha sau khi đổi có ít nhất một modifier khớp tag trong tay (dùng lại ý của `bestMoonOffset`), hoặc chủ lá có bộ đếm `moonShifts` chưa thăng cấp.
  - Lá `forbidden` tự mất HP: không đánh khi chủ lá HP ≤ tổng HP mất + 5.
  Thêm test nhỏ trong `phase7a-heroes.test.ts` (`it("bot: guard targets the weakest other ally")`) kiểm heuristic đầu tiên.
- [ ] **Step 2: Mô phỏng PvP lấy mẫu** — `pvp-sim.ts`: 14 Hero cho C(14,3) = 364 đội, đánh cặp toàn bộ quá chậm. Thêm tham số `sampleMatches?: number` (mặc định giữ hành vi cũ khi không truyền): bốc cặp đội bằng RNG `mulberry32` có seed cố định của file, đủ số trận; báo tỉ lệ thắng theo **Hero** (Hero xuất hiện ở bên thắng / số trận có Hero đó) và độ dài trận trung bình. Chạy với `PLAYTEST_PVP=1` và `sampleMatches: 4000`.
- [ ] **Step 3: Playtest lượt chơi** — `run-playtest.test.ts` `TEAMS`: thêm 4 đội chứa Hero mới (ví dụ `["m01","m02","f04"]`, `["m08","f08","m05"]`, `["m03","m10","m04"]`, `["f01","m07","m06"]`), chạy seed 1–20 như các đội cũ.
- [ ] **Step 4: Đo và đề xuất gói chỉnh** — ghi vào `docs/playtest-notes.md` mục "Phase 7a (bước 7a.6)": phương pháp, bảng tỉ lệ thắng lượt theo đội (so trung bình đội cũ, mục tiêu ±10 điểm), bảng tỉ lệ thắng PvP theo Hero (mục tiêu 40–60%), độ dài trận PvP (mục tiêu 8–12 vòng), và **gói chỉnh đề xuất** (chỉ số JSON: HP, ngưỡng, số lá). Dừng, trình người dùng duyệt.
- [ ] **Step 5: Áp gói đã duyệt, đo lại, ghi kết quả sau chỉnh** vào cùng mục, rồi:

Run: `pnpm test && pnpm typecheck`
Expected: PASS (T213 xanh).

```bash
git add packages docs/playtest-notes.md
git commit -m "Step 7a.6: bot heuristics, sims and tuning for phase-7a heroes"
```

- [ ] **Step 6: Đóng 7a** — cập nhật `CLAUDE.md` "Giai đoạn hiện tại" thành "7a xong — 14 Hero; tiếp theo 7b (`docs/18-phase7-spec.md` §3)" và `docs/18-phase7-spec.md` dòng **Trạng thái**; commit `"Close phase 7a"`.
