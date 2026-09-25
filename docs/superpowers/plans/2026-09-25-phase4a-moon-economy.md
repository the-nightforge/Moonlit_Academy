# Giai đoạn 4a (Kinh tế Nguyệt Lực mới) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trận đấu theo kinh tế mới: Nguyệt Lực tăng dần theo vòng + Dự Trữ, giữ bài trên tay, chồng bài theo số bản (`copies`), Cạn Bài, Đổi Bài, Chiêm Bài, và kẻ địch dùng Nguyệt Lực để đánh chuỗi chiêu.

**Architecture:** Mọi luật mới nằm trong engine thuần `packages/rules` (`turn.ts`, `draw.ts`, `create-combat.ts`, `apply-action.ts`, `effects.ts`, `intent.ts`, `enemy-turn.ts`, `preview.ts`, `queries.ts`) và đọc hằng số từ `combat-config.json`. Action mới (`mulligan`, `chooseCard`) được mở/khóa theo `CombatState.status` (`mulligan` / `choosing` / `playerTurn`). Client chỉ gửi Action và vẽ từ state.

**Tech Stack:** TypeScript strict, pnpm workspaces, Vitest, zod 4 (`packages/data`), Phaser 4 (`apps/client`).

**Spec:** `docs/12-phase4a-spec.md` — đọc cùng plan này. Khi plan và spec khác nhau về luật, spec là chuẩn (trừ thứ tự bước: theo plan).

## Global Constraints

- `packages/rules` là code thuần: không import Phaser/DOM/`window`/network/fs; không `Math.random()`, không `Date.now()`.
- Mọi ngẫu nhiên đi qua RNG có seed trong state (`CombatState.rngState`); cùng seed + cùng chuỗi Action → cùng state và event.
- `applyAction` / `applyRunAction` clone trước khi sửa, không mutate input.
- Client không tự tính luật; mọi con số hiển thị lấy từ state hoặc hàm của `rules`.
- Nội dung và hằng số nằm trong JSON của `packages/data` (`combat-config.json` cho hằng số kinh tế), không hardcode.
- Code, tên biến, comment, chuỗi lỗi: tiếng Anh. Chữ cho người chơi: tiếng Việt.
- ID dữ liệu `snake_case`; type `PascalCase`; hàm/biến `camelCase`; thuật ngữ theo `docs/04-glossary.md` (Nguyệt Lực Dự Trữ = `moonReserve`, Đổi Bài = `mulligan`, Chiêm Bài = `chooseCard`, Cạn Bài = `deckedOut`, Tán Chiêu = `cardsPurged`).
- Union có trường `type` + `switch` đầy đủ với kiểm tra `never` (kể cả `apps/client/src/debug.ts` `describeEvent`).
- Không thêm thư viện mới.
- Test đặt tên theo mã kịch bản (`it("T128: ...")`), mã mới **T128–T148**. Test luật dùng fixture cố định (`strike9Intent`, `idleIntent`, v.v.), không phụ thuộc số cân bằng.
- Kết thúc mỗi task: `pnpm test` và `pnpm typecheck` pass, file dùng LF.
- Không đổi luật ngoài phạm vi spec. Thay đổi data cân bằng (Task 8) phải được người dùng duyệt trước khi áp.
- Làm việc trên nhánh `feature/phase4a`.

### Quy tắc sửa test cũ bị vỡ

Mỗi task liệt kê test cũ sẽ vỡ. Khi sửa:
- Giữ ý định của test; **không** nới lỏng assertion về luật đang được test.
- Test kiểm tra hiệu ứng một lá bị từ chối `"not enough moonPower"` vì cost đã nhân đôi: thêm `s.moonPower = 11;` vào `setup` (test đó không kiểm tra kinh tế).
- Test kiểm tra con số phụ thuộc cân bằng (cost, số lá, damage chiêu địch): cập nhật con số theo data mới và ghi lý do trong message commit.
- Test mô tả luật đã bị bỏ (xáo lại chồng bỏ, bỏ tay cuối lượt, `patternIndex`): xóa test và nêu mã test thay thế trong commit.

---

## File Structure

| File | Trách nhiệm |
|---|---|
| `docs/00-gdd.md`, `01-combat-rules.md`, `02-data-schema.md`, `04-glossary.md`, `06-test-scenarios.md`, `07-implementation-plan.md` | Tài liệu luật (Task 1) |
| `packages/data/combat-config.json` (mới) | Hằng số kinh tế |
| `packages/data/src/schema.ts`, `src/load-game-data.ts` | Schema + kiểm tra chéo |
| `packages/data/{cards,heroes,enemies,moon-phases,run-relics}.json` | Nội dung |
| `packages/rules/src/types/{static,state,events,api}.ts` | Kiểu mới |
| `packages/rules/src/moon-power.ts` (mới) | `baseMoonPower` — đường cong Nguyệt Lực dùng chung cho Hero và địch |
| `packages/rules/src/turn.ts` | Đầu/cuối lượt: Nguyệt Lực + Dự Trữ, rút bù, Cạn Bài, bỏ Tàn Chiêu |
| `packages/rules/src/draw.ts` | Rút không xáo lại; `refillHand` |
| `packages/rules/src/create-combat.ts` | Chồng bài theo `copies`, trạng thái `mulligan` |
| `packages/rules/src/apply-action.ts` | Action `mulligan`, `chooseCard`; kiểm tra theo `status` |
| `packages/rules/src/effects.ts` | `chooseCard`; Tán Chiêu khi Hero ngã |
| `packages/rules/src/queries.ts` | `firstCardDiscount` (passive M06) |
| `packages/rules/src/intent.ts` | `planEnemyIntents` (lên chuỗi), `chooseHeroTarget` |
| `packages/rules/src/enemy-turn.ts` | Thi hành chuỗi, Dự Trữ địch |
| `packages/rules/src/preview.ts` | `previewEnemyIntent` trả về cả chuỗi |
| `packages/rules/test/*` | Test mới + sửa test cũ; `helpers.ts` (`makeTestCombat` tự Đổi Bài rỗng, `setIntent`, `setPlan`) |
| `apps/client/src/{debug.ts, scenes/combat-scene.ts, ui/event-animator.ts}` | Hiển thị luật mới |

Ghi chú: spec §1 ghi `intent.ts → enemy-plan.ts`; plan **giữ tên `intent.ts`** (ít đổi hơn, cùng trách nhiệm). Cập nhật dòng đó trong spec ở Task 6.

---

### Task 1: Tài liệu luật (bước 4a.1)

**Files:**
- Modify: `docs/00-gdd.md`, `docs/01-combat-rules.md`, `docs/02-data-schema.md`, `docs/04-glossary.md`, `docs/06-test-scenarios.md`, `docs/07-implementation-plan.md`, `docs/12-phase4a-spec.md`

**Interfaces:** chỉ tài liệu; các task sau đọc `01` và `12`.

- [ ] **Step 1: `00-gdd.md` §3.1** — thay khối "**Deck 20 lá:**" (4 gạch đầu dòng con) bằng:

```markdown
- **Deck 18 lá độc nhất** (không có 2 lá trùng id):
  - Lá kỹ năng của 3 Hero (GĐ 4a: mỗi Hero 6 lá cố định; GĐ 4b: tự xếp, mỗi Hero ít nhất 4 lá)
  - Binh Khí (sau này) mỗi lá chiếm 1 ô trong 18, không tính vào mức tối thiểu của Hero
  - Cộng thêm lá Song Hành nếu có cặp Bond (xem 3.5), không tính vào 18 lá
  - Mỗi lá vào chồng bài với số bản theo `copies` (1–3): lá yếu nhiều bản, lá mạnh ít bản
```

- [ ] **Step 2: `00-gdd.md` §3.2** — thay danh sách 6 bước bằng:

```markdown
0. Đầu trận: rút 6 lá, **Đổi Bài** — đổi tối đa 2 lá một lần.
1. Nhận Nguyệt Lực: **3 ở vòng 1, +1 mỗi vòng, tối đa 8**, cộng **Nguyệt Lực Dự Trữ** (phần chưa dùng lượt trước, tối đa 3).
2. **Rút bù** cho đủ 6 lá trên tay. Chồng bài không xáo lại; hết cả chồng lẫn tay là thua (**Cạn Bài**).
3. Đánh bài. Mỗi lá tốn Nguyệt Lực và do **Hero sở hữu lá đó** thực hiện.
4. Kết thúc lượt: **giữ bài trên tay**, chỉ bỏ lá Tàn Chiêu.
5. Kẻ địch dùng Nguyệt Lực (cùng đường cong) để đánh **chuỗi chiêu đã báo trước** (tối đa 3 chiêu).
6. Nguyệt Luân tiến 1 pha.
```

Và trong §8.2 đổi "bắt đầu với deck 20 lá" → "bắt đầu với deck 18 lá"; trong bảng luật PvP (dòng "Luật deck") đổi "20 lá" → "18 lá".

- [ ] **Step 3: `01-combat-rules.md`**
  - §1 bảng thuật ngữ, dòng **Nguyệt Lực**: "Tài nguyên để đánh bài: `min(8, 2 + vòng)` mỗi lượt cộng Dự Trữ (tối đa 3) — `12` §3.1".
  - §2 Bắt đầu trận: thay bằng nội dung spec §3.2 + §3.3 (bước tạo chồng theo `copies`, lên chuỗi địch, rút 6, `status = "mulligan"`, Đổi Bài, rồi lượt 1, rồi hook `combatStart`).
  - §3.1: thay danh sách bằng spec §3.4 (10 bước). §3.2: thêm spec §3.5 (giảm cost M06, Chiêm Bài). §3.3: thay bằng spec §3.6.
  - §4.2 Rút bài: thay bằng spec §3.7. §4.3 Tàn Chiêu: thêm "Lá Tàn Chiêu trên tay bị bỏ cuối lượt (§3.3)". §4.5 Chi phí: thêm bước giảm cost M06 sau modifier.
  - §9 Lượt kẻ địch: §9.1 "Mẫu ý định" → "Bộ chiêu" (`intents` có `cost`, `moonPower` riêng); §9.2 thay bằng spec §4.1–4.2; §9.3 thay bằng spec §4.3; §9.4 giữ, bước "công bố ý định" đổi thành "lên chuỗi (§9.2)".
  - §10.4 Ngã: thêm "Hero ngã: Tán Chiêu (spec §3.8)".
  - §11 Thắng/thua: thêm Cạn Bài.
  - §13 Kỳ Vật: ghi chú `chooseCard` không dùng trong hook; Thanh Loan Vũ mới.

- [ ] **Step 4: `02-data-schema.md`** — thêm/cập nhật theo spec §2.1–2.5: `CombatConfig`, `CardDef.copies`, `Effect` bỏ `draw` thêm `chooseCard`, `EnemyDef.intents`/`moonPower`, `EnemyIntentDef`, `LevelUpPassive.firstOwnCardDiscount`, `CombatStatus`, `CombatState.moonReserve/pendingChoice`, `EnemyState.plannedIntents/lastIntentIds/moonPower/moonReserve`, `HeroState.firstCardDiscountActive/firstCardDiscountUsedThisTurn`, `Action`, bảng event mới.

- [ ] **Step 5: `04-glossary.md`** — thêm 6 dòng:

| Thuật ngữ | Trong code | Nghĩa |
|---|---|---|
| Nguyệt Lực Dự Trữ | `moonReserve` | Nguyệt Lực chưa dùng mang sang lượt sau, tối đa 3 |
| Đổi Bài | `mulligan` | Đổi tối đa 2 lá ở tay đầu trận |
| Chiêm Bài | `chooseCard` | Xem N lá trên cùng chồng bài, lấy 1, các lá còn lại xuống đáy |
| Cạn Bài | `deckedOut` | Chồng bài và tay đều rỗng đầu lượt → thua |
| Tán Chiêu | `cardsPurged` | Mọi bản lá của Hero ngã bị loại khỏi chồng bài |
| Tụ Lực | chuỗi ý định rỗng | Kẻ địch không đủ Nguyệt Lực cho chiêu nào, bỏ lượt |

(Theo đúng định dạng bảng hiện có của file.)

- [ ] **Step 6: `06-test-scenarios.md`** — thêm mục "Giai đoạn 4a" với bảng T128–T148 chép từ spec §7.

- [ ] **Step 7: `07-implementation-plan.md`** — sửa tiêu đề thành "Giai đoạn 0–4a", thêm mục "## Giai đoạn 4a — Kinh tế Nguyệt Lực" với 8 bước theo spec §10 (mỗi bước một `### Bước 4a.N — <tên>` và một câu mô tả như các giai đoạn trước).

- [ ] **Step 8: `12-phase4a-spec.md`** — dòng trạng thái: "**Trạng thái:** đã đưa vào `00`, `01`, `02`, `04`, `06`, `07` (bước 4a.1)."

- [ ] **Step 9: Commit**

```bash
git add docs
git commit -m "Step 4a.1: rule docs for the new moon power economy"
```

---

### Task 2: Thang Nguyệt Lực (bước 4a.2)

Nguyệt Lực `min(8, 2 + vòng)` + Dự Trữ người chơi, hằng số trong `combat-config.json`, nhân đôi cost cả hệ, passive M06 thành giảm 3 cost.

**Files:**
- Create: `packages/data/combat-config.json`, `packages/rules/src/moon-power.ts`, `packages/rules/test/economy.test.ts`
- Modify: `packages/rules/src/types/{static,api,state,events}.ts`, `src/turn.ts`, `src/queries.ts`, `src/apply-action.ts`, `src/create-combat.ts`, `src/index.ts`
- Modify: `packages/data/src/schema.ts`, `src/load-game-data.ts`, `test/load-game-data.test.ts`, `cards.json`, `heroes.json`, `moon-phases.json`, `run-relics.json`
- Modify: `apps/client/src/debug.ts`
- Test: `packages/rules/test/economy.test.ts`, `packages/rules/test/bond-cards.test.ts`, `packages/data/test/load-game-data.test.ts`

**Interfaces:**
- Produces:
  - `interface CombatConfig { moonPower: { start: number; perRound: number; cap: number }; moonReserveMax: number; handSize: number; maxMulligan: number; maxIntentsPerRound: number; bloodMoonHpLoss: number }` (static.ts), `GameData.combatConfig: CombatConfig`.
  - `baseMoonPower(curve: { start: number; cap: number }, perRound: number, round: number): number` (moon-power.ts).
  - `CombatState.moonReserve: number`.
  - `HeroState.firstCardDiscountActive: boolean`, `HeroState.firstCardDiscountUsedThisTurn: boolean` (thay `freeCardActive` / `freeCardUsedThisTurn`).
  - `LevelUpPassive` variant `{ type: "firstOwnCardDiscount"; amount: number }` (thay `firstOwnCardFreeEachTurn`).
  - `firstCardDiscount(data: GameData, state: CombatState, instanceId: string): number` (queries.ts, thay `isFreeByPassive`).
  - Event `{ type: "moonReserveChanged"; side: "hero" | "enemy"; enemyId?: string; value: number }`.

- [ ] **Step 1: Viết test thất bại `packages/rules/test/economy.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import type { CombatState, GameData } from "../src/index";
import { applyAction, getEffectiveCost } from "../src/index";
import { idleEnemies, instanceIdOf, makeEnemiesIdle, makeTestCombat, setHand } from "./helpers";

function end(data: GameData, state: CombatState) {
  const result = applyAction(data, state, { type: "endTurn" });
  if (!result.ok) throw new Error(result.error);
  return result;
}

describe("moon power economy", () => {
  it("T128: base moon power ramps 3, 4, … 8 by round and caps at 8", () => {
    const { data, state } = makeTestCombat({ mutateData: makeEnemiesIdle, setup: idleEnemies });
    expect(state.moonPower).toBe(3);
    let current = state;
    const seen: number[] = [];
    for (let i = 0; i < 7; i++) {
      current.moonPower = 0; // spend everything: no reserve
      current = end(data, current).state;
      seen.push(current.moonPower);
    }
    expect(seen).toEqual([4, 5, 6, 7, 8, 8, 8]);
  });

  it("T129: unspent moon power carries over as reserve (max 3) and can exceed the cap", () => {
    const { data, state } = makeTestCombat({ mutateData: makeEnemiesIdle, setup: idleEnemies });
    const r2 = end(data, state);
    expect(r2.state.moonReserve).toBe(3);
    expect(r2.state.moonPower).toBe(4 + 3);
    expect(r2.events).toContainEqual({ type: "moonReserveChanged", side: "hero", value: 3 });

    r2.state.moonPower = 5; // more than the reserve max left unspent
    const r3 = end(data, r2.state);
    expect(r3.state.moonReserve).toBe(3);
    expect(r3.state.moonPower).toBe(5 + 3);

    let current = r3.state;
    for (let i = 0; i < 4; i++) current = end(data, current).state;
    expect(current.round).toBe(7);
    expect(current.moonPower).toBe(8 + 3);

    current.moonPower = 0;
    const drained = end(data, current);
    expect(drained.state.moonReserve).toBe(0);
    expect(drained.events).toContainEqual({ type: "moonReserveChanged", side: "hero", value: 0 });
  });

  it("T146: leveled-up M06 gets −3 on his first own card each turn, never below 0, not on bond cards", () => {
    const { data, state } = makeTestCombat({
      heroIds: ["m06", "f02", "f03"],
      setup: (s) => {
        const m06 = s.heroes[0]!;
        m06.leveledUp = true;
        m06.firstCardDiscountActive = true;
        s.moonPower = 11;
        setHand(s, ["m06_doat_menh", "m06_am_tien", "m06_nguyet_anh_an", "bond_anh_dau"]);
      },
    });
    const doatMenh = instanceIdOf(state, "m06_doat_menh");
    const amTien = instanceIdOf(state, "m06_am_tien");
    const anhDau = instanceIdOf(state, "bond_anh_dau");
    expect(getEffectiveCost(data, state, doatMenh)).toBe(4 - 3);
    expect(getEffectiveCost(data, state, amTien)).toBe(0); // 2 − 3 → 0
    expect(getEffectiveCost(data, state, anhDau)).toBe(data.cards["bond_anh_dau"]!.cost);

    const played = applyAction(data, state, { type: "playCard", instanceId: doatMenh, targetId: "enemy:0" });
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(played.state.moonPower).toBe(11 - 1);
    expect(getEffectiveCost(data, played.state, amTien)).toBe(2);

    // Moon phase reduction applies first: Thượng Huyền control −2, then −3, floored at 0.
    state.moonIndex = 2;
    expect(getEffectiveCost(data, state, instanceIdOf(state, "m06_nguyet_anh_an"))).toBe(0);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `pnpm --filter rules test -- economy`
Expected: FAIL (type errors / `moonReserve` undefined / T128 thấy `[3, 3, …]`).

- [ ] **Step 3: Kiểu mới**

`packages/rules/src/types/static.ts` — thay variant passive và thêm `CombatConfig`:

```ts
export type LevelUpPassive =
  | { type: "attackDamageBonus"; amount: number }
  | { type: "regenSpreadsToAllAllies" }
  | { type: "firstOwnCardDiscount"; amount: number }
  | { type: "doubleDamageVsFrozen" }
  | { type: "stealBonus" };
```

```ts
export interface CombatConfig {
  moonPower: { start: number; perRound: number; cap: number };
  moonReserveMax: number;
  handSize: number;
  maxMulligan: number;
  maxIntentsPerRound: number;
  bloodMoonHpLoss: number;
}
```

`types/api.ts`: import `CombatConfig`, thêm `combatConfig: CombatConfig;` vào `GameData`.

`types/state.ts`:

```ts
export interface HeroState extends UnitState {
  side: "hero";
  levelUpCounter: number;
  leveledUp: boolean;
  firstCardDiscountUsedThisTurn: boolean;
  firstCardDiscountActive: boolean;
}
```

và trong `CombatState` thêm sau `moonPower`:

```ts
  /** Moon power carried into this turn (reserve), for display. */
  moonReserve: number;
```

`types/events.ts` thêm vào union:

```ts
  | { type: "moonReserveChanged"; side: "hero" | "enemy"; enemyId?: string; value: number }
```

- [ ] **Step 4: `packages/rules/src/moon-power.ts`**

```ts
/** Base moon power of round `round` (1-based) on a start/cap curve. */
export function baseMoonPower(
  curve: { start: number; cap: number },
  perRound: number,
  round: number,
): number {
  return Math.min(curve.cap, curve.start + (round - 1) * perRound);
}
```

- [ ] **Step 5: `turn.ts`** — bỏ `const BLOOD_MOON_HP_LOSS = 2;`, import `baseMoonPower`. Trong `startPlayerTurn`:

```ts
  for (const hero of state.heroes) {
    if (!hero.alive) continue;
    if (anyAllyRegen) bumpCounter(data, hero, "turnsWithAllyRegen", 1);
    hero.firstCardDiscountUsedThisTurn = false;
    hero.firstCardDiscountActive =
      hero.leveledUp &&
      data.heroes[hero.defId]?.levelUp.passive.type === "firstOwnCardDiscount";
  }
```

đổi `loseHp(data, hero, BLOOD_MOON_HP_LOSS, "bloodMoon", events)` → `loseHp(data, hero, data.combatConfig.bloodMoonHpLoss, "bloodMoon", events)`, và thay `state.moonPower = 3;` bằng:

```ts
  const curve = data.combatConfig.moonPower;
  state.moonPower = baseMoonPower(curve, curve.perRound, state.round) + state.moonReserve;
  events.push({ type: "moonPowerChanged", value: state.moonPower });
```

Trong `runEndTurn`, ngay sau khối `runRelicHooks(... playerTurnEnd)` + kiểm tra won/lost, **trước** khi bỏ tay:

```ts
  const reserve = Math.min(data.combatConfig.moonReserveMax, state.moonPower);
  if (reserve !== state.moonReserve) {
    state.moonReserve = reserve;
    events.push({ type: "moonReserveChanged", side: "hero", value: reserve });
  }
```

- [ ] **Step 6: `queries.ts`** — thay `isFreeByPassive` bằng:

```ts
/** Cost reduction from a leveled-up "first own card" passive; 0 when it does not apply. */
export function firstCardDiscount(data: GameData, state: CombatState, instanceId: string): number {
  const instance = state.cards[instanceId];
  // Level-up passives never apply to bond cards.
  if (!instance || instance.ownerIds.length !== 1) return 0;
  const [owner] = cardOwners(state, instance);
  if (!owner?.leveledUp || !owner.firstCardDiscountActive || owner.firstCardDiscountUsedThisTurn) {
    return 0;
  }
  const passive = data.heroes[owner.defId]?.levelUp.passive;
  return passive?.type === "firstOwnCardDiscount" ? passive.amount : 0;
}
```

và `getEffectiveCost`:

```ts
export function getEffectiveCost(data: GameData, state: CombatState, instanceId: string): number {
  const instance = state.cards[instanceId];
  const card = instance ? data.cards[instance.cardId] : undefined;
  if (!card) throw new Error(`getEffectiveCost: unknown card instance "${instanceId}"`);
  let cost = card.cost;
  let floor = 0;
  for (const modifier of activeModifiers(data, state)) {
    if (modifier.type === "costModifierForTag" && card.tags.includes(modifier.tag)) {
      cost += modifier.amount;
      floor = Math.max(floor, modifier.min);
    }
  }
  return Math.max(0, Math.max(0, floor, cost) - firstCardDiscount(data, state, instanceId));
}
```

- [ ] **Step 7: `apply-action.ts`** — import `firstCardDiscount` thay `isFreeByPassive`; trong `playCard`:

```ts
  const discounted = firstCardDiscount(data, state, instance.instanceId) > 0;
  const cost = getEffectiveCost(data, state, instance.instanceId);
```

và `if (discounted) owner.firstCardDiscountUsedThisTurn = true;` (thay dòng `freeByPassive`).

- [ ] **Step 8: `create-combat.ts`** — hero khởi tạo `firstCardDiscountUsedThisTurn: false, firstCardDiscountActive: false`; `CombatState` thêm `moonReserve: 0`. `index.ts` không đổi export (`isFreeByPassive` không được export).

- [ ] **Step 9: Data — `packages/data/combat-config.json`**

```json
{
  "moonPower": { "start": 3, "perRound": 1, "cap": 8 },
  "moonReserveMax": 3,
  "handSize": 6,
  "maxMulligan": 2,
  "maxIntentsPerRound": 3,
  "bloodMoonHpLoss": 2
}
```

- [ ] **Step 10: Schema + loader** — `schema.ts`:

```ts
export const combatConfigSchema = z.object({
  moonPower: z.object({
    start: z.number().int().nonnegative(),
    perRound: z.number().int().nonnegative(),
    cap: z.number().int().nonnegative(),
  }),
  moonReserveMax: z.number().int().nonnegative(),
  handSize: z.number().int().positive(),
  maxMulligan: z.number().int().nonnegative(),
  maxIntentsPerRound: z.number().int().positive(),
  bloodMoonHpLoss: z.number().int().nonnegative(),
});
```

`levelUpPassiveSchema`: thay `z.object({ type: z.literal("firstOwnCardFreeEachTurn") })` bằng `z.object({ type: z.literal("firstOwnCardDiscount"), amount: z.number().int().positive() })`. `rawGameDataSchema` thêm `combatConfig: combatConfigSchema`.

`load-game-data.ts`: `import combatConfigJson from "../combat-config.json";`, truyền `combatConfig: combatConfigJson` trong `loadGameData`, trả `combatConfig` trong `parseGameData`, và trong `collectCrossCheckErrors` (destructure thêm `combatConfig`):

```ts
  if (combatConfig.moonPower.start > combatConfig.moonPower.cap) {
    errors.push(`combatConfig: moonPower start must be <= cap`);
  }
```

`test/load-game-data.test.ts`: `rawData()` thêm `combatConfig: combatConfigJson` (import tương ứng), và thêm:

```ts
  it("T148: rejects a combatConfig moon power start above its cap", () => {
    const raw = rawData();
    raw.combatConfig.moonPower.start = 9;
    expect(() => parseGameData(raw)).toThrowError(/moonPower start must be <= cap/);
  });
```

- [ ] **Step 11: Data — nhân đôi cost cả hệ.** Chạy script tạm (không commit) từ `packages/data`:

```bash
cat > "$TMPDIR/scale-costs.cjs" <<'EOF'
const fs = require("fs");
let text = fs.readFileSync("cards.json", "utf8");
for (const card of JSON.parse(text)) {
  const draws = JSON.stringify(card.effects).includes('"draw"');
  const cost = card.cost * 2 + (draws ? 1 : 0);
  const idAt = text.indexOf(`"id": "${card.id}"`);
  const costAt = text.indexOf('"cost": ', idAt);
  const comma = text.indexOf(",", costAt);
  text = text.slice(0, costAt) + `"cost": ${cost}` + text.slice(comma);
}
text = text.replace(/"type": "gainMoonPower", "amount": (\d+)/g, (_, n) => `"type": "gainMoonPower", "amount": ${Number(n) * 2}`);
text = text
  .replace("Trăng Non: nhận thêm 1 Nguyệt Lực.", "Trăng Non: nhận thêm 2 Nguyệt Lực.")
  .replace("Trăng Tròn: +1 Nguyệt Lực.", "Trăng Tròn: +2 Nguyệt Lực.")
  .replace("Mất 3 HP. +2 Nguyệt Lực.", "Mất 3 HP. +4 Nguyệt Lực.");
fs.writeFileSync("cards.json", text);

let phases = fs.readFileSync("moon-phases.json", "utf8");
phases = phases.replace(/"amount": -1, "min": 0/g, '"amount": -2, "min": 0');
fs.writeFileSync("moon-phases.json", phases);

let relics = fs.readFileSync("run-relics.json", "utf8");
relics = relics
  .replace('"effects": [{ "type": "gainMoonPower", "amount": 1 }]', '"effects": [{ "type": "gainMoonPower", "amount": 2 }]')
  .replace("Mỗi lá tấn công thứ 3 trong trận: +1 Nguyệt Lực.", "Mỗi lá tấn công thứ 3 trong trận: +2 Nguyệt Lực.");
fs.writeFileSync("run-relics.json", relics);

let heroes = fs.readFileSync("heroes.json", "utf8");
heroes = heroes
  .replace('"passive": { "type": "firstOwnCardFreeEachTurn" }', '"passive": { "type": "firstOwnCardDiscount", "amount": 3 }')
  .replace("Từ lượt sau: lá đầu tiên của Tô Dạ mỗi lượt có chi phí 0.", "Từ lượt sau: lá đầu tiên của Tô Dạ mỗi lượt giảm 3 Nguyệt Lực.");
fs.writeFileSync("heroes.json", heroes);
EOF
node "$TMPDIR/scale-costs.cjs" && git diff --stat
```

Expected: `cards.json` đổi 48 dòng `"cost"` + 3 `gainMoonPower` + 3 `text`; `moon-phases.json` 3 dòng; `run-relics.json` 1 hook + 1 text; `heroes.json` 2 dòng. Kiểm tra bằng mắt vài lá theo bảng spec §5.1 (vd. `f04_nguyet_quang_dan` cost 5, `m05_tran_bac_huyet_tinh` cost 0, `f03_tuyet_han` cost 6). Script **chỉ** nhân đôi `gainMoonPower`; `draw` giữ nguyên tới Task 5.

- [ ] **Step 12: `apps/client/src/debug.ts`** — thêm case vào `describeEvent`:

```ts
    case "moonReserveChanged":
      return `Dự Trữ ${event.side === "hero" ? "người chơi" : name(event.enemyId)} = ${event.value}`;
```

- [ ] **Step 13: Sửa test cũ**
  - `bond-cards.test.ts` dòng ~155: `m06.freeCardActive = true` → `m06.firstCardDiscountActive = true`; assertion cost của lá Song Hành giữ nguyên ý nghĩa (passive không áp lá Song Hành) — cập nhật con số theo cost mới.
  - `turn-flow.test.ts` T07: `expect(result.state.moonPower).toBe(3)` → `toBe(4 + 3)` (vòng 2, 3 Nguyệt Lực chưa dùng thành Dự Trữ).
  - Các test bị `"not enough moonPower"`: thêm `s.moonPower = 11;` vào `setup` (quy tắc chung ở đầu plan).
  - `level-up.test.ts`: test của M06 dùng `firstOwnCardFreeEachTurn` / `freeCard*` → đổi sang tên mới; kỳ vọng "cost 0" → `max(0, cost − 3)`.
  - `playtest.test.ts`, `run-playtest.test.ts`: không đổi (chỉ in bảng).

- [ ] **Step 14: Chạy toàn bộ**

Run: `pnpm test && pnpm typecheck`
Expected: PASS (T128, T129, T146, T148 mới pass; không còn test đỏ).

- [ ] **Step 15: Commit**

```bash
git add packages apps
git commit -m "Step 4a.2: moon power ramp, reserve, doubled costs, M06 discount"
```

---

### Task 3: Tay và chồng bài (bước 4a.3)

Giữ tay, rút bù đủ 6, bỏ Tàn Chiêu cuối lượt, `copies`, deck 6 lá/Hero, không xáo lại chồng bỏ, Cạn Bài, Tán Chiêu.

**Files:**
- Create: `packages/rules/test/hand-pile.test.ts`
- Modify: `packages/rules/src/types/{static,events}.ts`, `src/draw.ts`, `src/turn.ts`, `src/create-combat.ts`, `src/effects.ts`, `src/index.ts`
- Modify: `packages/data/src/schema.ts`, `test/load-game-data.test.ts`, `cards.json`, `heroes.json`
- Modify: `packages/rules/test/fixtures/index.ts`, `turn-flow.test.ts`, `create-combat.test.ts`, `run-combat.test.ts`, các test khác vỡ theo quy tắc chung
- Modify: `apps/client/src/debug.ts`

**Interfaces:**
- Consumes: `CombatConfig.handSize` (Task 2).
- Produces:
  - `CardDef.copies: 1 | 2 | 3`.
  - `drawCards(state: CombatState, count: number, events: CombatEvent[]): void` — không xáo lại, không giới hạn tay.
  - `refillHand(data: GameData, state: CombatState, events: CombatEvent[]): void`.
  - Events `{ type: "deckedOut" }`, `{ type: "cardsPurged"; heroId: string; instanceIds: string[] }`.
  - `HeroDef.cardIds` có đúng 6 lá.

- [ ] **Step 1: Viết test thất bại `packages/rules/test/hand-pile.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import type { CombatState, GameData } from "../src/index";
import { applyAction, bondCardsForTeam } from "../src/index";
import { idleEnemies, instanceIdOf, makeEnemiesIdle, makeTestCombat, setHand } from "./helpers";

function end(data: GameData, state: CombatState) {
  const result = applyAction(data, state, { type: "endTurn" });
  if (!result.ok) throw new Error(result.error);
  return result;
}

const idle = { mutateData: makeEnemiesIdle, setup: idleEnemies };

describe("hand and draw pile", () => {
  it("T131: the hand is kept between turns and refilled up to 6", () => {
    const { data, state } = makeTestCombat(idle);
    const hand = [...state.hand];
    expect(hand).toHaveLength(6);
    const kept = end(data, state);
    expect(kept.state.hand).toEqual(hand);
    expect(kept.events.some((e) => e.type === "cardsDrawn")).toBe(false);

    kept.state.hand = kept.state.hand.slice(0, 4);
    kept.state.drawPile = kept.state.drawPile.slice(0, 1);
    const refilled = end(data, kept.state);
    expect(refilled.state.hand).toHaveLength(5);
    expect(refilled.state.drawPile).toHaveLength(0);
  });

  it("T132: end of turn discards only Tàn Chiêu cards", () => {
    const { data, state } = makeTestCombat({
      heroIds: ["m05", "f04", "f02"],
      mutateData: makeEnemiesIdle,
      setup: (s) => {
        idleEnemies(s);
        setHand(s, ["m05_ho_gam", "f04_thao_duoc", "f02_phe_hon"]);
        s.heroes[0]!.alive = false;
        s.heroes[0]!.hp = 0;
        s.heroes[1]!.statuses.push({ id: "freeze", value: 1 });
      },
    });
    const hoGam = instanceIdOf(state, "m05_ho_gam");
    const thaoDuoc = instanceIdOf(state, "f04_thao_duoc");
    const pheHon = instanceIdOf(state, "f02_phe_hon");
    const result = end(data, state);
    expect(result.events).toContainEqual({ type: "cardDiscarded", instanceIds: [hoGam] });
    expect(result.state.discardPile).toContain(hoGam);
    expect(result.state.hand).toContain(thaoDuoc);
    expect(result.state.hand).toContain(pheHon);
    expect(result.state.hand).not.toContain(hoGam);
  });

  it("T133: the draw pile holds `copies` instances of every deck and bond card", () => {
    const heroIds: [string, string, string] = ["m05", "f03", "f04"];
    const { data, state } = makeTestCombat({ heroIds });
    const deck = [
      ...heroIds.flatMap((id) => data.heroes[id]!.cardIds),
      ...bondCardsForTeam(data, heroIds).map((card) => card.id),
    ];
    const counts = new Map<string, number>();
    for (const instance of Object.values(state.cards)) {
      counts.set(instance.cardId, (counts.get(instance.cardId) ?? 0) + 1);
    }
    expect([...counts.keys()].sort()).toEqual([...deck].sort());
    for (const cardId of deck) expect(counts.get(cardId)).toBe(data.cards[cardId]!.copies);
    const ids = [...state.hand, ...state.drawPile];
    expect(new Set(ids).size).toBe(Object.keys(state.cards).length);
  });

  it("T134: the discard pile is never shuffled back", () => {
    const { data, state } = makeTestCombat(idle);
    state.discardPile.push(...state.drawPile.splice(0, state.drawPile.length - 1));
    state.hand = state.hand.slice(0, 3);
    const result = end(data, state);
    expect(result.state.drawPile).toHaveLength(0);
    expect(result.state.hand).toHaveLength(4);
    expect(result.events.some((e) => e.type === "deckShuffled")).toBe(false);
  });

  it("T135: empty draw pile and empty hand at turn start loses (Cạn Bài)", () => {
    const { data, state } = makeTestCombat(idle);
    state.discardPile.push(...state.drawPile, ...state.hand);
    state.drawPile = [];
    state.hand = [];
    const result = end(data, state);
    expect(result.state.status).toBe("lost");
    const types = result.events.map((e) => e.type);
    expect(types.slice(-2)).toEqual(["deckedOut", "combatEnded"]);

    const other = makeTestCombat(idle).state;
    other.discardPile.push(...other.drawPile, ...other.hand.slice(1));
    other.drawPile = [];
    other.hand = other.hand.slice(0, 1);
    expect(end(data, other).state.status).toBe("playerTurn");
  });

  it("T136: a fallen hero's copies leave the draw pile; its hand cards go at turn end", () => {
    const { data, state } = makeTestCombat({
      heroIds: ["m06", "f02", "f03"],
      mutateData: makeEnemiesIdle,
      setup: (s) => {
        idleEnemies(s);
        s.heroes[0]!.hp = 1;
        s.heroes[0]!.statuses.push({ id: "burn", value: 3 });
      },
    });
    const ownedByM06 = (id: string) => state.cards[id]!.ownerIds.includes("m06");
    const inPile = state.drawPile.filter(ownedByM06);
    const inHand = state.hand.filter(ownedByM06);
    expect(inPile.length).toBeGreaterThan(0);

    const died = end(data, state);
    expect(died.events).toContainEqual({ type: "cardsPurged", heroId: "hero:m06", instanceIds: inPile });
    expect(died.state.drawPile.some(ownedByM06)).toBe(false);
    for (const id of inHand) expect(died.state.hand).toContain(id);

    const next = end(data, died.state);
    for (const id of inHand) {
      expect(next.state.hand).not.toContain(id);
      expect(next.state.discardPile).toContain(id);
    }
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `pnpm --filter rules test -- hand-pile`
Expected: FAIL (tay 5 lá, `copies` undefined, `cardsPurged` không có).

- [ ] **Step 3: Kiểu** — `static.ts` `CardDef` thêm sau `cost`:

```ts
  /** Instances of this card in the draw pile (weak cards get more). */
  copies: 1 | 2 | 3;
```

`events.ts` thêm:

```ts
  | { type: "deckedOut" }
  | { type: "cardsPurged"; heroId: string; instanceIds: string[] }
```

`test/fixtures/index.ts`: thêm `copies: 1,` vào mọi `CardDef` fixture.

- [ ] **Step 4: `draw.ts`** — thay toàn bộ:

```ts
import type { CombatEvent, CombatState, GameData } from "./types/index";

/** Draws from the top of the draw pile; stops when it is empty (never reshuffles). */
export function drawCards(state: CombatState, count: number, events: CombatEvent[]): void {
  const drawn = state.drawPile.splice(0, Math.max(0, count));
  if (drawn.length === 0) return;
  state.hand.push(...drawn);
  events.push({ type: "cardsDrawn", instanceIds: drawn });
}

/** Draws until the hand holds `handSize` cards or the draw pile is empty. */
export function refillHand(data: GameData, state: CombatState, events: CombatEvent[]): void {
  drawCards(state, data.combatConfig.handSize - state.hand.length, events);
}
```

`index.ts`: `export { drawCards, refillHand } from "./draw";`.

- [ ] **Step 5: `turn.ts`**
  - import `refillHand` thay `drawCards`, import `cardOwners` từ `./queries`.
  - Trong `startPlayerTurn` thay `drawCards(state, 5, events);` bằng:

```ts
  refillHand(data, state, events);
  if (state.hand.length === 0 && state.drawPile.length === 0) {
    state.status = "lost";
    events.push({ type: "deckedOut" }, { type: "combatEnded", result: "lost" });
    return;
  }
```

  - Trong `runEndTurn` thay khối bỏ tay (`if (state.hand.length > 0) { … }`) bằng:

```ts
  const broken = state.hand.filter((id) =>
    cardOwners(state, state.cards[id]!).some((owner) => !owner?.alive),
  );
  if (broken.length > 0) {
    state.hand = state.hand.filter((id) => !broken.includes(id));
    state.discardPile.push(...broken);
    events.push({ type: "cardDiscarded", instanceIds: broken });
  }
```

- [ ] **Step 6: `create-combat.ts`** — thay hai vòng tạo instance:

```ts
  const deckCardIds = setup.deckCardIds ?? heroDefs.flatMap((hero) => hero.cardIds);
  let deckIndex = 0;
  for (const cardId of deckCardIds) {
    const card = data.cards[cardId];
    if (!card) throw new Error(`createCombat: deck references missing card "${cardId}"`);
    if (card.ownerId === undefined || !setup.heroIds.includes(card.ownerId)) {
      throw new Error(`createCombat: deck card "${cardId}" is not owned by a hero in the team`);
    }
    for (let copy = 0; copy < card.copies; copy++) {
      deckIndex += 1;
      const instanceId = `c${String(deckIndex).padStart(2, "0")}`;
      cards[instanceId] = { instanceId, cardId, ownerIds: [card.ownerId] };
      drawPile.push(instanceId);
    }
  }
  let bondIndex = 0;
  for (const card of bondCardsForTeam(data, setup.heroIds)) {
    for (let copy = 0; copy < card.copies; copy++) {
      bondIndex += 1;
      const instanceId = `bond${String(bondIndex).padStart(2, "0")}`;
      cards[instanceId] = { instanceId, cardId: card.id, ownerIds: [...card.bond!.owners] };
      drawPile.push(instanceId);
    }
  }
```

(`startPlayerTurn` vòng 1 rút bù từ tay rỗng → 6 lá; không cần đổi gì khác.)

- [ ] **Step 7: `effects.ts` `killUnit`** — cuối hàm thêm:

```ts
  if (unit.side === "hero") {
    const defId = (unit as HeroState).defId;
    const purged = state.drawPile.filter((id) => state.cards[id]!.ownerIds.includes(defId));
    if (purged.length > 0) {
      state.drawPile = state.drawPile.filter((id) => !purged.includes(id));
      state.discardPile.push(...purged);
      events.push({ type: "cardsPurged", heroId: unit.id, instanceIds: purged });
    }
  }
```

- [ ] **Step 8: Schema** — `cardDefSchema` thêm `copies: z.union([z.literal(1), z.literal(2), z.literal(3)]),`; `heroDefSchema.cardIds` `.length(5)` → `.length(6)`. `test/load-game-data.test.ts` thêm:

```ts
  it("T148: rejects a card with copies outside 1..3", () => {
    const raw = rawData();
    raw.cards[0].copies = 4;
    expect(() => parseGameData(raw)).toThrowError(/copies/);
  });
```

và cập nhật kỳ vọng `data.heroes["m05"]?.rewardCardIds` → `["m05_thiet_bich", "m05_no_hoa_lien_hoan", "m05_huyet_chien"]`.

- [ ] **Step 9: Data — `copies` và deck 6 lá.** Script tạm (không commit), chạy từ `packages/data`:

```bash
cat > "$TMPDIR/copies-and-decks.cjs" <<'EOF'
const fs = require("fs");
let text = fs.readFileSync("cards.json", "utf8");
for (const card of JSON.parse(text)) {
  const copies = card.cost <= 1 ? 3 : card.cost <= 4 ? 2 : 1;
  const idAt = text.indexOf(`"id": "${card.id}"`);
  const costAt = text.indexOf('"cost": ', idAt);
  const lineEnd = text.indexOf("\n", costAt);
  const indent = text.slice(text.lastIndexOf("\n", costAt) + 1, costAt);
  text = text.slice(0, lineEnd + 1) + `${indent}"copies": ${copies},\n` + text.slice(lineEnd + 1);
}
fs.writeFileSync("cards.json", text);

const moves = {
  m05: ["m05_bat_khuat", "m05_bat_dong_nhu_son"],
  f04: ["f04_nguyet_quang_dan", "f04_hoi_xuan_tan"],
  m06: ["m06_song_nhan_loan_vu", "m06_tang_anh_thich"],
  f03: ["f03_tuyet_han", "f03_tuyet_vu"],
  f02: ["f02_phe_hon", "f02_huyet_khe"],
};
let heroes = fs.readFileSync("heroes.json", "utf8");
for (const [lastStarter, moved] of Object.values(moves)) {
  heroes = heroes.replace(`\n      "${moved}",`, "").replace(`,\n      "${moved}"\n`, "\n");
  heroes = heroes.replace(`"${lastStarter}"\n    ],\n    "rewardCardIds"`, `"${lastStarter}",\n      "${moved}"\n    ],\n    "rewardCardIds"`);
}
fs.writeFileSync("heroes.json", heroes);
EOF
node "$TMPDIR/copies-and-decks.cjs"
node -e 'for (const h of require("./heroes.json")) console.log(h.id, h.cardIds.length, h.rewardCardIds.length)'
```

Expected: mỗi Hero `6 3`. Kiểm tra `copies` với bảng spec §5.1 (vd. `m05_tran_bac_huyet_tinh` 3, `m05_liet_hoa_xung_phong` 2, `f03_tuyet_han` 1, `f04_nguyet_quang_dan` 1).

- [ ] **Step 10: `apps/client/src/debug.ts`** — thêm case:

```ts
    case "deckedOut":
      return "Cạn Bài";
    case "cardsPurged":
      return `Tán Chiêu: ${name(event.heroId)} mất ${event.instanceIds.length} lá trong chồng`;
```

- [ ] **Step 11: Sửa test cũ**
  - `turn-flow.test.ts`: T08 (xáo lại chồng bỏ) — **xóa**, thay bằng T134. T07: bỏ assertion `cardDiscarded` và kích thước chồng; kiểm tra `hand` giữ nguyên + `moonPower` như Task 2.
  - `create-combat.test.ts` T01: `hand` 6; `Object.keys(state.cards)` = tổng `copies` của 18 lá đội mặc định (tính bằng `data.heroes[...]!.cardIds` + `copies`, không viết số cứng); `drawPile.length === cards − 6`.
  - `run-combat.test.ts`: `toHaveLength(16)` → tính từ `copies`; instance `c16` → tìm instance có `cardId === "m05_huyet_chien"`.
  - Test dùng `drawTwoCard` (`play-card.test.ts`): rút 2 vẫn đúng (effect `draw` còn tới Task 5), chỉ cần fixture có `copies`.
  - Test giả định bỏ tay cuối lượt / rút 5 lá / `hand.length === 5`: đổi theo luật giữ tay (tay 6).

- [ ] **Step 12: Chạy toàn bộ**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 13: Commit**

```bash
git add packages apps
git commit -m "Step 4a.3: kept hand, refill to 6, copies, no reshuffle, Cạn Bài, Tán Chiêu"
```

---

### Task 4: Đổi Bài (bước 4a.4)

**Files:**
- Create: `packages/rules/test/mulligan.test.ts`
- Modify: `packages/rules/src/types/{state,events}.ts`, `src/create-combat.ts`, `src/apply-action.ts`
- Modify: `packages/rules/test/helpers.ts`, `run.test.ts`, `run-relics.test.ts`, `create-combat.test.ts`, `turn-flow.test.ts`, `playtest.test.ts`, `run-playtest.test.ts`
- Modify: `apps/client/src/debug.ts`

**Interfaces:**
- Consumes: `startPlayerTurn` (turn.ts), `runRelicHooks`, `shuffle`, `CombatConfig.maxMulligan`.
- Produces:
  - `CombatStatus = "mulligan" | "playerTurn" | "enemyTurn" | "won" | "lost"`.
  - `Action` variant `{ type: "mulligan"; instanceIds: string[] }`.
  - Event `{ type: "mulliganed"; returned: string[]; drawn: string[] }`.
  - `createCombat` trả state `status: "mulligan"` (tay 6, chưa chạy lượt 1, chưa chạy hook `combatStart`).
  - `makeTestCombat(overrides & { mulligan?: "pending" })`: mặc định tự gửi `{ type: "mulligan", instanceIds: [] }` và trả state `playerTurn`; `mulligan: "pending"` giữ state ở `mulligan`.

- [ ] **Step 1: Viết test thất bại `packages/rules/test/mulligan.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { applyAction } from "../src/index";
import { makeTestCombat } from "./helpers";

describe("mulligan (Đổi Bài)", () => {
  it("T137: swapped cards are replaced by the top of the pile before the reshuffle", () => {
    const { data, state } = makeTestCombat({ mulligan: "pending" });
    expect(state.status).toBe("mulligan");
    expect(state.hand).toHaveLength(6);
    const [a, b] = state.hand as [string, string];
    const top = state.drawPile.slice(0, 2);

    const result = applyAction(data, state, { type: "mulligan", instanceIds: [a, b] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events[0]).toEqual({ type: "mulliganed", returned: [a, b], drawn: top });
    expect(result.state.hand.slice(0, 2)).toEqual(top);
    expect(result.state.hand).not.toContain(a);
    expect(result.state.hand).not.toContain(b);
    expect(result.state.drawPile).toContain(a);
    expect(result.state.drawPile).toContain(b);
    expect(result.state.status).toBe("playerTurn");

    const kept = applyAction(data, state, { type: "mulligan", instanceIds: [] });
    expect(kept.ok).toBe(true);
    if (!kept.ok) return;
    expect(kept.state.hand).toEqual(state.hand);
    expect(kept.state.drawPile).toEqual(state.drawPile);
    expect(kept.state.rngState).toBe(state.rngState);
  });

  it("T138: invalid mulligans and other actions during the mulligan are rejected", () => {
    const { data, state } = makeTestCombat({ mulligan: "pending" });
    const [a, b, c] = state.hand as [string, string, string];
    const reject = (action: Parameters<typeof applyAction>[2]) =>
      applyAction(data, state, action);

    expect(reject({ type: "mulligan", instanceIds: [a, b, c] })).toEqual({ ok: false, error: "too many cards to mulligan" });
    expect(reject({ type: "mulligan", instanceIds: [a, a] })).toEqual({ ok: false, error: "duplicate card in mulligan" });
    expect(reject({ type: "mulligan", instanceIds: [state.drawPile[0]!] })).toEqual({ ok: false, error: "card is not in hand" });
    expect(reject({ type: "endTurn" })).toEqual({ ok: false, error: "mulligan pending" });
    expect(reject({ type: "playCard", instanceId: a })).toEqual({ ok: false, error: "mulligan pending" });

    const done = applyAction(data, state, { type: "mulligan", instanceIds: [] });
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(applyAction(data, done.state, { type: "mulligan", instanceIds: [] })).toEqual({
      ok: false,
      error: "mulligan already done",
    });
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `pnpm --filter rules test -- mulligan`
Expected: FAIL (`status` là `playerTurn`, `mulligan` không phải Action).

- [ ] **Step 3: Kiểu** — `state.ts`: `export type CombatStatus = "mulligan" | "playerTurn" | "enemyTurn" | "won" | "lost";`. `events.ts`: `Action` thêm `| { type: "mulligan"; instanceIds: string[] }`; `CombatEvent` thêm `| { type: "mulliganed"; returned: string[]; drawn: string[] }`.

- [ ] **Step 4: `create-combat.ts`** — `CombatState` khởi tạo `status: "mulligan"`; thay 3 dòng cuối (`announceIntents`, `startPlayerTurn`, `runRelicHooks combatStart`) bằng:

```ts
  announceIntents(data, state, events);
  drawCards(state, data.combatConfig.handSize, events);
  return { state, events };
```

(import `drawCards` từ `./draw`; bỏ import `startPlayerTurn`, `runRelicHooks` nếu không còn dùng.)

- [ ] **Step 5: `apply-action.ts`** — thêm:

```ts
export function getMulliganError(data: GameData, state: CombatState, instanceIds: string[]): string | null {
  if (instanceIds.length > data.combatConfig.maxMulligan) return "too many cards to mulligan";
  if (new Set(instanceIds).size !== instanceIds.length) return "duplicate card in mulligan";
  if (instanceIds.some((id) => !state.hand.includes(id))) return "card is not in hand";
  return null;
}

function mulligan(data: GameData, state: CombatState, instanceIds: string[], events: CombatEvent[]): void {
  const count = Math.min(instanceIds.length, state.drawPile.length);
  const returned = instanceIds.slice(0, count);
  const drawn = state.drawPile.splice(0, count);
  state.hand = state.hand.map((id) => {
    const index = returned.indexOf(id);
    return index >= 0 ? drawn[index]! : id;
  });
  events.push({ type: "mulliganed", returned, drawn });
  if (count > 0) {
    const shuffled = shuffle([...state.drawPile, ...returned], state.rngState);
    state.drawPile = shuffled.items;
    state.rngState = shuffled.rngState;
    events.push({ type: "deckShuffled" });
  }
  startPlayerTurn(data, state, events);
  runRelicHooks(data, state, events, { type: "combatStart" });
}

function statusError(state: CombatState, action: Action): string | null {
  switch (state.status) {
    case "mulligan":
      return action.type === "mulligan" ? null : "mulligan pending";
    case "playerTurn":
      return action.type === "mulligan" ? "mulligan already done" : null;
    case "enemyTurn":
    case "won":
    case "lost":
      return "not the player turn";
    default: {
      const exhaustive: never = state.status;
      return `unknown status ${String(exhaustive)}`;
    }
  }
}
```

và `applyAction`:

```ts
export function applyAction(data: GameData, state: CombatState, action: Action): ActionResult {
  const blocked = statusError(state, action);
  if (blocked !== null) return { ok: false, error: blocked };
  switch (action.type) {
    case "mulligan": {
      const error = getMulliganError(data, state, action.instanceIds);
      if (error !== null) return { ok: false, error };
      const next = cloneState(state);
      const events: CombatEvent[] = [];
      mulligan(data, next, action.instanceIds, events);
      return { ok: true, state: next, events };
    }
    case "playCard": { /* unchanged */ }
    case "endTurn": { /* unchanged */ }
    default: { /* unchanged never check */ }
  }
}
```

(import `shuffle` từ `./rng`, `startPlayerTurn` từ `./turn`, `Action` đã có.) `index.ts` export thêm `getMulliganError`.

- [ ] **Step 6: `test/helpers.ts`**

```ts
export interface TestCombatOverrides {
  // ...existing fields...
  /** Default: an empty mulligan is sent so the state is at the player's first turn. */
  mulligan?: "pending";
}

export function makeTestCombat(overrides: TestCombatOverrides = {}): {
  data: GameData;
  state: CombatState;
  events: CombatEvent[];
} {
  const data = testData();
  overrides.mutateData?.(data);
  const created = createCombat(data, {
    heroIds: overrides.heroIds ?? ["m05", "f04", "m06"],
    encounterId: overrides.encounterId ?? "enc_01",
    seed: overrides.seed ?? 42,
    deckCardIds: overrides.deckCardIds,
    heroes: overrides.heroes,
    runRelicIds: overrides.runRelicIds,
  });
  let { state } = created;
  const events = [...created.events];
  if (overrides.mulligan !== "pending") {
    const kept = applyAction(data, state, { type: "mulligan", instanceIds: [] });
    if (!kept.ok) throw new Error(`test: mulligan failed: ${kept.error}`);
    state = kept.state;
    events.push(...kept.events);
  }
  overrides.setup?.(state);
  return { data, state, events };
}
```

(import `applyAction`.)

- [ ] **Step 7: Sửa test và mô phỏng dùng `createCombat` / lượt chơi trực tiếp**
  - `run.test.ts`: thêm helper và gọi nó ngay sau mọi `chooseNode` vào nút combat/elite/boss (trong `winCombat`, `loseCombat` và các test tự đánh):

```ts
function keepHand(data: GameData, run: RunState): RunState {
  if (run.combat?.status !== "mulligan") return run;
  return act(data, run, { type: "combat", action: { type: "mulligan", instanceIds: [] } }).run;
}

function winCombat(data: GameData, run: RunState) {
  const ready = keepHand(data, run);
  for (const enemy of ready.combat!.enemies) enemy.statuses.push({ id: "burn", value: 999 });
  return act(data, ready, { type: "combat", action: { type: "endTurn" } });
}
```

(tương tự cho `loseCombat`).
  - `run-relics.test.ts`: test dùng `createCombat` trực tiếp và kiểm tra hook `combatStart` → gửi `mulligan []` trước khi kiểm tra (hook giờ chạy sau Đổi Bài).
  - `create-combat.test.ts` T01: kiểm tra `makeTestCombat({ mulligan: "pending" })` có `status "mulligan"`, tay 6, `turnStarted` **không** có; và `makeTestCombat()` có `status "playerTurn"`, `moonPower 3`.
  - `turn-flow.test.ts` T03: giữ nguyên (makeTestCombat đã Đổi Bài rỗng).
  - `playtest.test.ts` và `run-playtest.test.ts`: trong hàm chọn Action trận, thêm nhánh đầu tiên:

```ts
  if (state.status === "mulligan") return { type: "mulligan", instanceIds: [] };
```

- [ ] **Step 8: `apps/client/src/debug.ts`** — thêm case:

```ts
    case "mulliganed":
      return `Đổi Bài ${event.returned.length} lá`;
```

Client chưa có màn Đổi Bài (Task 7); `combat-scene.ts` tạm tự gửi Đổi Bài rỗng để vẫn chơi được: trong `renderAll()` cuối hàm thêm

```ts
    if (this.state.status === "mulligan" && !this.inputLocked) {
      this.time.delayedCall(0, () => this.dispatch({ type: "mulligan", instanceIds: [] }));
    }
```

(Task 7 thay bằng màn Đổi Bài thật.)

- [ ] **Step 9: Chạy toàn bộ**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add packages apps
git commit -m "Step 4a.4: mulligan (Đổi Bài) before the first player turn"
```

---

### Task 5: Chiêm Bài (bước 4a.5)

**Files:**
- Create: `packages/rules/test/choose-card.test.ts`
- Modify: `packages/rules/src/types/{static,state,events}.ts`, `src/effects.ts`, `src/apply-action.ts`, `src/create-combat.ts`, `src/index.ts`
- Modify: `packages/data/src/schema.ts`, `src/load-game-data.ts`, `test/load-game-data.test.ts`, `cards.json`, `run-relics.json`
- Modify: `packages/rules/test/fixtures/index.ts`, `play-card.test.ts`, `run-relics.test.ts`, `playtest.test.ts`, `run-playtest.test.ts`
- Modify: `apps/client/src/debug.ts`, `apps/client/src/scenes/combat-scene.ts`

**Interfaces:**
- Produces:
  - `Effect` variant `{ type: "chooseCard"; look: number }`; variant `draw` **bị bỏ**.
  - `CombatStatus` thêm `"choosing"`; `CombatState.pendingChoice: { kind: "chooseCard"; options: string[] } | null`.
  - `Action` variant `{ type: "chooseCard"; instanceId: string }`.
  - Events `{ type: "choiceOpened"; options: string[] }`, `{ type: "cardChosen"; instanceId: string; bottomed: string[] }`.

- [ ] **Step 1: Viết test thất bại `packages/rules/test/choose-card.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { applyAction } from "../src/index";
import { instanceIdOf, makeTestCombat, setHand } from "./helpers";

function setupGuide() {
  return makeTestCombat({
    setup: (s) => {
      setHand(s, ["f04_nguyet_quang_dan"]);
      s.moonPower = 11;
    },
  });
}

describe("chooseCard (Chiêm Bài)", () => {
  it("T144: opens a choice of the top 3; the pick goes to hand, the rest to the bottom in order", () => {
    const { data, state } = setupGuide();
    const guide = instanceIdOf(state, "f04_nguyet_quang_dan");
    const top = state.drawPile.slice(0, 3) as [string, string, string];
    const played = applyAction(data, state, { type: "playCard", instanceId: guide });
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(played.state.status).toBe("choosing");
    expect(played.state.pendingChoice).toEqual({ kind: "chooseCard", options: top });
    expect(played.events).toContainEqual({ type: "choiceOpened", options: top });
    expect(played.state.drawPile).not.toContain(top[0]);
    expect(played.state.discardPile).toContain(guide);

    expect(applyAction(data, played.state, { type: "endTurn" })).toEqual({ ok: false, error: "choice pending" });
    expect(
      applyAction(data, played.state, { type: "chooseCard", instanceId: played.state.drawPile[0]! }),
    ).toEqual({ ok: false, error: "not a choice option" });

    const chosen = applyAction(data, played.state, { type: "chooseCard", instanceId: top[1] });
    expect(chosen.ok).toBe(true);
    if (!chosen.ok) return;
    expect(chosen.events).toEqual([{ type: "cardChosen", instanceId: top[1], bottomed: [top[0], top[2]] }]);
    expect(chosen.state.hand).toContain(top[1]);
    expect(chosen.state.drawPile.slice(-2)).toEqual([top[0], top[2]]);
    expect(chosen.state.status).toBe("playerTurn");
    expect(chosen.state.pendingChoice).toBeNull();
    expect(applyAction(data, chosen.state, { type: "chooseCard", instanceId: top[0] })).toEqual({
      ok: false,
      error: "no pending choice",
    });
  });

  it("T145: with one card left it is taken directly; with none nothing happens", () => {
    const one = setupGuide();
    const last = one.state.drawPile[0]!;
    one.state.drawPile = [last];
    const took = applyAction(one.data, one.state, {
      type: "playCard",
      instanceId: instanceIdOf(one.state, "f04_nguyet_quang_dan"),
    });
    expect(took.ok).toBe(true);
    if (!took.ok) return;
    expect(took.state.status).toBe("playerTurn");
    expect(took.state.hand).toContain(last);
    expect(took.events).toContainEqual({ type: "cardsDrawn", instanceIds: [last] });

    const none = setupGuide();
    none.state.drawPile = [];
    const empty = applyAction(none.data, none.state, {
      type: "playCard",
      instanceId: instanceIdOf(none.state, "f04_nguyet_quang_dan"),
    });
    expect(empty.ok).toBe(true);
    if (!empty.ok) return;
    expect(empty.state.status).toBe("playerTurn");
    expect(empty.events.some((e) => e.type === "choiceOpened" || e.type === "cardsDrawn")).toBe(false);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `pnpm --filter rules test -- choose-card`
Expected: FAIL (lá vẫn `draw`, không có `choosing`).

- [ ] **Step 3: Kiểu** — `static.ts` `Effect`: xóa `| { type: "draw"; amount: number }`, thêm `| { type: "chooseCard"; look: number }`. `state.ts`: `CombatStatus` thêm `"choosing"`; `CombatState` thêm `pendingChoice: { kind: "chooseCard"; options: string[] } | null;`. `events.ts`: `Action` thêm `| { type: "chooseCard"; instanceId: string }`; `CombatEvent` thêm `| { type: "choiceOpened"; options: string[] }` và `| { type: "cardChosen"; instanceId: string; bottomed: string[] }`. `create-combat.ts`: `pendingChoice: null`.

- [ ] **Step 4: `effects.ts`** — thay case `draw` bằng:

```ts
    case "chooseCard": {
      const options = state.drawPile.splice(0, Math.min(effect.look, state.drawPile.length));
      if (options.length === 0) return;
      if (options.length === 1) {
        state.hand.push(options[0]!);
        events.push({ type: "cardsDrawn", instanceIds: options });
        return;
      }
      state.pendingChoice = { kind: "chooseCard", options };
      state.status = "choosing";
      events.push({ type: "choiceOpened", options });
      return;
    }
```

(bỏ import `drawCards` nếu không còn dùng.)

- [ ] **Step 5: `apply-action.ts`**

```ts
function chooseCard(state: CombatState, instanceId: string, events: CombatEvent[]): void {
  const options = state.pendingChoice!.options;
  const bottomed = options.filter((id) => id !== instanceId);
  state.hand.push(instanceId);
  state.drawPile.push(...bottomed);
  state.pendingChoice = null;
  state.status = "playerTurn";
  events.push({ type: "cardChosen", instanceId, bottomed });
}
```

`statusError` thêm:

```ts
    case "choosing":
      return action.type === "chooseCard" ? null : "choice pending";
```

và nhánh `playerTurn` thành:

```ts
    case "playerTurn":
      if (action.type === "mulligan") return "mulligan already done";
      if (action.type === "chooseCard") return "no pending choice";
      return null;
```

`applyAction` thêm case:

```ts
    case "chooseCard": {
      if (!state.pendingChoice!.options.includes(action.instanceId)) {
        return { ok: false, error: "not a choice option" };
      }
      const next = cloneState(state);
      const events: CombatEvent[] = [];
      chooseCard(next, action.instanceId, events);
      return { ok: true, state: next, events };
    }
```

`playCard` giữ nguyên thứ tự hiện có: sau `resolveEffects` vẫn chạy gỡ Cường Hóa/Ẩn Thân, hook `cardPlayed` và đẩy lá vào chồng bỏ — kể cả khi `status` đã là `"choosing"` (spec §3.5).

- [ ] **Step 6: Schema + kiểm tra chéo** — `effectSchema`: xóa dòng `draw`, thêm `z.object({ actor, type: z.literal("chooseCard"), look: z.number().int().positive() }),`. Trong `collectCrossCheckErrors`:

```ts
  const nestedChoose = (effects: Effect[]) =>
    effects.some(
      (effect) =>
        effect.type === "conditional" &&
        someEffect([...effect.then, ...(effect.else ?? [])], (inner) => inner.type === "chooseCard"),
    );
  for (const card of cards) {
    const index = card.effects.findIndex((effect) => effect.type === "chooseCard");
    if ((index >= 0 && index !== card.effects.length - 1) || nestedChoose(card.effects)) {
      errors.push(`card "${card.id}": chooseCard must be the last top-level effect`);
    }
  }
```

và trong vòng enemy intents: `if (someEffect(intent.effects, (e) => e.type === "chooseCard")) errors.push(\`enemy "${enemy.id}" intent "${intent.id}": chooseCard is not allowed\`);`, trong vòng relic hook: `if (someEffect(hook.effects, (e) => e.type === "chooseCard")) errors.push(\`${label}: effects must not use chooseCard\`);`.

`test/load-game-data.test.ts`:

```ts
  it("T148: rejects chooseCard that is not the last top-level card effect", () => {
    const raw = rawData();
    const guide = raw.cards.find((card: any) => card.id === "f04_nguyet_quang_dan");
    guide.effects.reverse();
    expect(() => parseGameData(raw)).toThrowError(/chooseCard must be the last/);
  });
```

- [ ] **Step 7: Data** — `cards.json`: 4 lá (`f04_nguyet_quang_dan`, `f04_thanh_tam_chu`, `m06_anh_phan_than`, `f02_dien_cu`) đổi `{ "type": "draw", "amount": 1 }` → `{ "type": "chooseCard", "look": 3 }` và trong `text` "Rút 1 lá." → "Chiêm Bài 3.". `run-relics.json` Thanh Loan Vũ:

```json
  { "id": "thanh_loan_vu", "name": "Thanh Loan Vũ", "text": "Mỗi 2 lượt: +2 Nguyệt Lực.",
    "hooks": [{ "on": { "type": "playerTurnStart" }, "actor": "front", "every": 2, "effects": [{ "type": "gainMoonPower", "amount": 2 }] }] },
```

Kiểm tra: `grep -n '"draw"' packages/data/*.json` không còn kết quả.

- [ ] **Step 8: Fixture và test cũ**
  - `fixtures/index.ts`: thay `drawTwoCard` bằng:

```ts
export const chooseThreeCard: CardDef = {
  id: "test_choose_three",
  name: "Test Choose Three",
  ownerId: "f04",
  cost: 0,
  copies: 1,
  type: "skill",
  tags: [],
  target: "none",
  effects: [{ type: "chooseCard", look: 3 }],
  text: "Chiêm Bài 3 (test).",
};
```

  - `play-card.test.ts` (test dùng `drawTwoCard`, ~dòng 64): đổi sang `chooseThreeCard`, kỳ vọng `status "choosing"` và 3 `options` = 3 lá trên cùng chồng bài trước khi đánh.
  - `run-relics.test.ts`: test của Thanh Loan Vũ (rút thêm mỗi 2 lượt) → kỳ vọng `moonPower` lượt thứ 2 cao hơn 2 so với không có Kỳ Vật (dùng `mutateData: makeEnemiesIdle`, `setup: idleEnemies`).
  - `playtest.test.ts`, `run-playtest.test.ts`: trong hàm chọn Action trận thêm:

```ts
  if (state.status === "choosing") return { type: "chooseCard", instanceId: state.pendingChoice!.options[0]! };
```

- [ ] **Step 9: Client** — `debug.ts`:

```ts
    case "choiceOpened":
      return `Chiêm Bài: ${event.options.length} lá`;
    case "cardChosen":
      return "Chọn 1 lá";
```

`combat-scene.ts` tạm (Task 7 làm màn thật): trong `renderAll()` cạnh nhánh mulligan tạm của Task 4 thêm

```ts
    if (this.state.status === "choosing" && !this.inputLocked) {
      const first = this.state.pendingChoice!.options[0]!;
      this.time.delayedCall(0, () => this.dispatch({ type: "chooseCard", instanceId: first }));
    }
```

- [ ] **Step 10: Chạy toàn bộ**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add packages apps
git commit -m "Step 4a.5: Chiêm Bài replaces draw; Thanh Loan Vũ grants moon power"
```

---

### Task 6: AI địch dùng Nguyệt Lực (bước 4a.6)

**Files:**
- Create: `packages/rules/test/enemy-plan.test.ts`
- Modify: `packages/rules/src/types/{static,state,events}.ts`, `src/intent.ts`, `src/enemy-turn.ts`, `src/turn.ts`, `src/create-combat.ts`, `src/preview.ts`, `src/index.ts`
- Modify: `packages/data/src/schema.ts`, `src/load-game-data.ts`, `test/load-game-data.test.ts`, `enemies.json`
- Modify: `packages/rules/test/helpers.ts`, `create-combat.test.ts`, `enemy-turn.test.ts`, `boss.test.ts`, `preview.test.ts`, `moon.test.ts`, `turn-flow.test.ts`, và test khác dùng `currentIntent` / `patternIndex` / `intentPattern` / `intentRevealed`
- Modify: `apps/client/src/debug.ts`, `scenes/combat-scene.ts`, `ui/event-animator.ts`
- Modify: `docs/12-phase4a-spec.md` (§1: giữ `intent.ts`)

**Interfaces:**
- Consumes: `baseMoonPower` (Task 2), `CombatConfig.maxIntentsPerRound/moonReserveMax/moonPower.perRound`, `nextRandom`.
- Produces:
  - `type EnemyIntentDef = IntentDef & { cost: number }`; `EnemyDef.intents: EnemyIntentDef[]`, `EnemyDef.moonPower: { start: number; cap: number }` (bỏ `intentPattern`).
  - `interface PlannedIntent { intent: IntentDef; cost: number; targetId: string | null }`.
  - `EnemyState.plannedIntents: PlannedIntent[]`, `lastIntentIds: string[]`, `moonPower: number`, `moonReserve: number` (bỏ `patternIndex`, `currentIntent`).
  - `planEnemyIntents(data: GameData, state: CombatState, events: CombatEvent[]): void` (intent.ts, thay `announceIntents`).
  - Event `{ type: "intentsRevealed"; enemyId: string; moonPower: number; intents: { intentId: string; cost: number; targetId: string | null }[] }` (thay `intentRevealed`).
  - `previewEnemyIntent(data, state, enemy): EnemyPlanPreview | null` với `interface EnemyPlanPreview { skipped: boolean; intents: IntentPreview[] }`, `interface IntentPreview { intentId: string; cost: number; targetId: string | null; fizzles: boolean; damages: IntentDamagePreview[] }`.
  - Test helpers: `setIntent(state, position, intent, targetId)` (chuỗi 1 chiêu), `setPlan(state, position, plan: { intent: IntentDef; targetId: string | null }[])`, `makeEnemiesIdle(data)` (đặt `intents = [{ ...idleIntent, cost: 0 }]`), `idleEnemies(state)`.

- [ ] **Step 1: Viết test thất bại `packages/rules/test/enemy-plan.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import type { CombatState, EnemyIntentDef, GameData } from "../src/index";
import { applyAction } from "../src/index";
import { planEnemyIntents } from "../src/intent";
import { idleIntent, strike9Intent } from "./fixtures";
import { instanceIdOf, makeTestCombat, setIntent, setPlan } from "./helpers";

function end(data: GameData, state: CombatState) {
  const result = applyAction(data, state, { type: "endTurn" });
  if (!result.ok) throw new Error(result.error);
  return result;
}

const intent = (id: string, cost: number): EnemyIntentDef => ({ id, name: id, kind: "special", cost, effects: [] });

function withFox(intents: EnemyIntentDef[], start: number, cap: number, seed = 42) {
  return makeTestCombat({
    seed,
    mutateData: (d) => {
      const fox = d.enemies["shadow_fox"]!;
      fox.intents = intents;
      fox.moonPower = { start, cap };
      fox.moonOverrides = [];
      const puppet = d.enemies["puppet_guard"]!;
      puppet.intents = [{ ...idleIntent, cost: 0 }];
    },
  });
}

const planIds = (state: CombatState, position: number) =>
  state.enemies[position]!.plannedIntents.map((planned) => planned.intent.id);

describe("enemy moon power plans", () => {
  it("T139: the most expensive intent leads when affordable and unused last round; max 3, each once", () => {
    const { data, state } = withFox([intent("a", 1), intent("b", 1), intent("top", 3)], 5, 5);
    expect(planIds(state, 1)[0]).toBe("top");
    expect(new Set(planIds(state, 1))).toEqual(new Set(["top", "a", "b"]));
    expect(state.enemies[1]!.moonReserve).toBe(0);

    // Round 2: "top" led last round, so it is only a weighted candidate now.
    const next = end(data, state);
    expect(next.state.enemies[1]!.lastIntentIds).toContain("top");
    const ids = planIds(next.state, 1);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeLessThanOrEqual(3);

    const many = withFox(["p", "q", "r", "s"].map((id) => intent(id, 0)), 1, 1);
    expect(planIds(many.state, 1)).toHaveLength(3);
  });

  it("T140: weighted picks are seeded — same seed, same plan; seeds vary the plan", () => {
    const planFor = (seed: number) => {
      const { data, state } = withFox([intent("x", 1), intent("y", 1), intent("z", 1)], 1, 1, seed);
      state.enemies[1]!.lastIntentIds = ["x"];
      planEnemyIntents(data, state, []);
      return planIds(state, 1);
    };
    expect(planFor(7)).toEqual(planFor(7));
    const firsts = new Set(Array.from({ length: 20 }, (_, i) => planFor(i + 1)[0]));
    expect(firsts.size).toBeGreaterThan(1);
  });

  it("T141: nothing affordable is Tụ Lực; the unspent fund becomes reserve", () => {
    const { data, state, events } = withFox([intent("big", 3)], 1, 3);
    expect(state.enemies[1]!.plannedIntents).toEqual([]);
    expect(state.enemies[1]!.moonReserve).toBe(1);
    expect(events).toContainEqual({ type: "intentsRevealed", enemyId: "enemy:1", moonPower: 1, intents: [] });

    const next = end(data, state);
    expect(next.state.enemies[1]!.moonPower).toBe(2 + 1);
    expect(planIds(next.state, 1)).toEqual(["big"]);
  });

  it("T142: moon and blood moon overrides lead the chain for free, then intents are added", () => {
    const { data, state } = makeTestCombat({ heroIds: ["m05", "f03", "f02"], encounterId: "enc_04" });
    state.moonIndex = 4; // Trăng Tròn
    planEnemyIntents(data, state, []);
    const boss = state.enemies[0]!;
    expect(boss.plannedIntents[0]).toMatchObject({ cost: 0, intent: { id: "ape_moon_bathe" } });
    expect(boss.plannedIntents.length).toBeGreaterThan(1);

    state.bloodMoonRounds = 2;
    planEnemyIntents(data, state, []);
    expect(state.enemies[0]!.plannedIntents[0]!.intent.id).toBe("ape_blood_frenzy");
  });

  it("T143: an enemy dying mid-chain cancels the rest; each intent re-picks its target", () => {
    const { data, state } = makeTestCombat();
    setIntent(state, 0, idleIntent, null);
    state.enemies[1]!.hp = 5;
    state.heroes[0]!.statuses.push({ id: "reflect", value: 30 });
    setPlan(state, 1, [
      { intent: strike9Intent, targetId: "hero:m05" },
      { intent: strike9Intent, targetId: "hero:m05" },
    ]);
    const died = end(data, state);
    expect(died.events.filter((e) => e.type === "intentExecuted" && e.enemyId === "enemy:1")).toHaveLength(1);

    const retarget = makeTestCombat();
    setIntent(retarget.state, 1, idleIntent, null);
    retarget.state.heroes[2]!.hp = 1;
    setPlan(retarget.state, 0, [
      { intent: strike9Intent, targetId: "hero:m06" },
      { intent: strike9Intent, targetId: "hero:m06" },
    ]);
    const result = end(retarget.data, retarget.state);
    const executed = result.events.filter((e) => e.type === "intentExecuted" && e.enemyId === "enemy:0");
    expect(executed).toHaveLength(2);
    const second = executed[1]!;
    expect(second.type === "intentExecuted" && second.targetId).not.toBe("hero:m06");
  });

  it("T130: a frozen enemy skips its whole chain and loses its reserve", () => {
    const { data, state } = makeTestCombat();
    const puppet = state.enemies[0]!;
    puppet.statuses.push({ id: "freeze", value: 1 });
    puppet.moonReserve = 2;
    setPlan(state, 0, [
      { intent: strike9Intent, targetId: "hero:m05" },
      { intent: strike9Intent, targetId: "hero:m05" },
    ]);
    setIntent(state, 1, idleIntent, null);
    const result = end(data, state);
    expect(result.events.filter((e) => e.type === "intentSkipped" && e.enemyId === "enemy:0")).toHaveLength(1);
    expect(result.events.some((e) => e.type === "intentExecuted" && e.enemyId === "enemy:0")).toBe(false);
    expect(result.events).toContainEqual({ type: "moonReserveChanged", side: "enemy", enemyId: "enemy:0", value: 0 });
    const curve = data.enemies["puppet_guard"]!.moonPower;
    expect(result.state.enemies[0]!.moonPower).toBe(Math.min(curve.cap, curve.start + 1));
  });

  it("T147: same seed and same actions (mulligan, Chiêm Bài) give identical state and events", () => {
    const run = () => {
      const { data, state, events } = makeTestCombat({ mulligan: "pending" });
      const log = [...events];
      const step = (current: CombatState, action: Parameters<typeof applyAction>[2]) => {
        const result = applyAction(data, current, action);
        if (!result.ok) throw new Error(result.error);
        log.push(...result.events);
        return result.state;
      };
      let current = step(state, { type: "mulligan", instanceIds: state.hand.slice(0, 2) });
      // Force a Chiêm Bài into the sequence: Nguyệt Quang Dẫn to hand, enough moon power.
      const guide = instanceIdOf(current, "f04_nguyet_quang_dan");
      current.drawPile = current.drawPile.filter((id) => id !== guide);
      current.discardPile = current.discardPile.filter((id) => id !== guide);
      if (!current.hand.includes(guide)) current.hand.push(guide);
      current.moonPower = 11;
      current = step(current, { type: "playCard", instanceId: guide });
      expect(current.status).toBe("choosing");
      current = step(current, { type: "chooseCard", instanceId: current.pendingChoice!.options[0]! });
      for (let turn = 0; turn < 4 && current.status === "playerTurn"; turn++) {
        current = step(current, { type: "endTurn" });
      }
      return { state: current, log };
    };
    const first = run();
    const second = run();
    expect(second.state).toEqual(first.state);
    expect(second.log).toEqual(first.log);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `pnpm --filter rules test -- enemy-plan`
Expected: FAIL (không có `planEnemyIntents`, `intents`, `plannedIntents`).

- [ ] **Step 3: Kiểu** — `static.ts`:

```ts
export type EnemyIntentDef = IntentDef & { cost: number };

export interface EnemyDef {
  id: string;
  name: string;
  maxHp: number;
  intents: EnemyIntentDef[];
  moonPower: { start: number; cap: number };
  moonOverrides?: { phase: MoonPhaseId; intent: IntentDef }[];
  bloodMoonOverride?: IntentDef;
  art: { portrait: string };
}
```

`state.ts`:

```ts
export interface PlannedIntent {
  intent: IntentDef;
  cost: number;
  targetId: string | null;
}

export interface EnemyState extends UnitState {
  side: "enemy";
  plannedIntents: PlannedIntent[];
  /** Ids of the chain executed last round (the most expensive one may not lead again). */
  lastIntentIds: string[];
  /** Fund the current chain was planned with (base + reserve). */
  moonPower: number;
  /** Reserve carried into the next plan. */
  moonReserve: number;
}
```

`events.ts`: thay `intentRevealed` bằng

```ts
  | {
      type: "intentsRevealed";
      enemyId: string;
      moonPower: number;
      intents: { intentId: string; cost: number; targetId: string | null }[];
    }
```

- [ ] **Step 4: `intent.ts`** — giữ `pickTarget`, `chooseHeroTarget`; thay `announceIntents` bằng:

```ts
function weightedPick(state: CombatState, intents: EnemyIntentDef[]): EnemyIntentDef {
  if (intents.length === 1) return intents[0]!;
  const total = intents.reduce((sum, intent) => sum + intent.cost + 1, 0);
  const roll = nextRandom(state.rngState);
  state.rngState = roll.rngState;
  let cursor = roll.value * total;
  for (const intent of intents) {
    cursor -= intent.cost + 1;
    if (cursor < 0) return intent;
  }
  return intents[intents.length - 1]!;
}

/** Plans every living enemy's intent chain for `state.round` (`12` §4.2). */
export function planEnemyIntents(data: GameData, state: CombatState, events: CombatEvent[]): void {
  const phaseId = data.moonPhases[state.moonIndex]!.id;
  const { maxIntentsPerRound, moonReserveMax, moonPower } = data.combatConfig;
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    const def = data.enemies[enemy.defId]!;
    const fund = baseMoonPower(def.moonPower, moonPower.perRound, state.round) + enemy.moonReserve;
    let left = fund;
    const chain: PlannedIntent[] = [];
    const override =
      (state.bloodMoonRounds > 0 ? def.bloodMoonOverride : undefined) ??
      def.moonOverrides?.find((entry) => entry.phase === phaseId)?.intent;
    if (override) chain.push({ intent: override, cost: 0, targetId: null });
    const top = def.intents.reduce((best, intent) => (intent.cost > best.cost ? intent : best));
    const used = new Set<string>();
    while (chain.length < maxIntentsPerRound) {
      const affordable = def.intents.filter((intent) => intent.cost <= left && !used.has(intent.id));
      if (affordable.length === 0) break;
      const pick =
        affordable.includes(top) && !enemy.lastIntentIds.includes(top.id)
          ? top
          : weightedPick(state, affordable);
      chain.push({ intent: pick, cost: pick.cost, targetId: null });
      used.add(pick.id);
      left -= pick.cost;
    }
    for (const planned of chain) {
      planned.targetId =
        planned.intent.targeting !== undefined ? chooseHeroTarget(state, planned.intent.targeting) : null;
    }
    enemy.plannedIntents = chain;
    enemy.moonPower = fund;
    enemy.moonReserve = Math.min(moonReserveMax, left);
    events.push({
      type: "intentsRevealed",
      enemyId: enemy.id,
      moonPower: fund,
      intents: chain.map((planned) => ({
        intentId: planned.intent.id,
        cost: planned.cost,
        targetId: planned.targetId,
      })),
    });
  }
}
```

(import `baseMoonPower` từ `./moon-power`, kiểu `EnemyIntentDef`, `PlannedIntent`.) Thay mọi lời gọi `announceIntents` (create-combat.ts, turn.ts `endRound`) bằng `planEnemyIntents`. `create-combat.ts` khởi tạo enemy `plannedIntents: [], lastIntentIds: [], moonPower: 0, moonReserve: 0` (bỏ `patternIndex`, `currentIntent`). `index.ts` export `planEnemyIntents` và type `EnemyPlanPreview`.

- [ ] **Step 5: `enemy-turn.ts`** — thay vòng thi hành (vòng `for` thứ ba) bằng:

```ts
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    enemy.lastIntentIds = enemy.plannedIntents.map((planned) => planned.intent.id);
    if (hasStatus(enemy, "freeze")) {
      events.push({ type: "intentSkipped", enemyId: enemy.id, reason: "freeze" });
      removeStatus(enemy, "freeze", events);
      if (enemy.moonReserve !== 0) {
        enemy.moonReserve = 0;
        events.push({ type: "moonReserveChanged", side: "enemy", enemyId: enemy.id, value: 0 });
      }
      continue;
    }
    for (const planned of enemy.plannedIntents) {
      if (!enemy.alive) break;
      const intent = planned.intent;
      let targetId: string | null = null;
      if (intent.targeting !== undefined) {
        targetId = reresolveTarget(state, planned.targetId, intent.targeting);
        if (targetId === null) {
          events.push({ type: "intentFizzled", enemyId: enemy.id, intentId: intent.id });
          continue;
        }
      }
      events.push({ type: "intentExecuted", enemyId: enemy.id, intentId: intent.id, targetId });
      resolveEffects(
        data,
        state,
        intent.effects,
        { source: enemy, intentKind: intent.kind, ...(targetId !== null ? { chosenId: targetId } : {}) },
        events,
      );
      if (state.status !== "enemyTurn") return;
    }
  }
```

- [ ] **Step 6: `preview.ts`** — thay toàn bộ phần sau `IntentDamagePreview`:

```ts
export interface IntentPreview {
  intentId: string;
  cost: number;
  targetId: string | null;
  fizzles: boolean;
  damages: IntentDamagePreview[];
}

export interface EnemyPlanPreview {
  skipped: boolean;
  intents: IntentPreview[];
}

function previewIntent(
  data: GameData,
  state: CombatState,
  enemy: EnemyState,
  planned: PlannedIntent,
): IntentPreview {
  const intent = planned.intent;
  let targetId: string | null = null;
  let fizzles = false;
  if (intent.targeting !== undefined) {
    targetId = reresolveTarget({ ...state }, planned.targetId, intent.targeting);
    fizzles = targetId === null;
  }
  const ctx: EffectContext = {
    source: enemy,
    intentKind: intent.kind,
    ...(targetId !== null ? { chosenId: targetId } : {}),
  };
  const damages: IntentDamagePreview[] = [];
  for (const effect of intent.effects) {
    if (effect.type !== "damage") continue;
    let targets: UnitState[] = [];
    if (effect.to === "chosen") {
      const target = [...state.heroes, ...state.enemies].find((unit) => unit.id === targetId);
      targets = target?.alive ? [target] : [];
    } else if (effect.to === "allEnemies") {
      targets = state.heroes.filter((hero) => hero.alive);
    } else if (effect.to === "self") {
      targets = [enemy];
    } else {
      targets = state.enemies.filter((foe) => foe.alive);
    }
    for (const target of targets) {
      damages.push({
        targetId: target.id,
        amount: computeDamageAmount(data, state, ctx, target, effect.amount),
        hits: effect.hits ?? 1,
      });
    }
  }
  return { intentId: intent.id, cost: planned.cost, targetId, fizzles, damages };
}

/** The announced chain as the player will see it; never consumes RNG. */
export function previewEnemyIntent(
  data: GameData,
  state: CombatState,
  enemy: EnemyState,
): EnemyPlanPreview | null {
  if (!enemy.alive) return null;
  return {
    skipped: hasStatus(enemy, "freeze"),
    intents: enemy.plannedIntents.map((planned) => previewIntent(data, state, enemy, planned)),
  };
}
```

`index.ts`: `export type { EnemyPlanPreview, IntentPreview, IntentDamagePreview } from "./preview";`.

- [ ] **Step 7: Schema + data**
  - `schema.ts`: `export const enemyIntentDefSchema = intentDefSchema.extend({ cost: z.number().int().nonnegative() });`; `enemyDefSchema` thay `intentPattern` bằng `intents: z.array(enemyIntentDefSchema).min(1)` và thêm `moonPower: z.object({ start: z.number().int().nonnegative(), cap: z.number().int().nonnegative() })`.
  - `load-game-data.ts` vòng enemy: dùng `enemy.intents` thay `enemy.intentPattern`; thêm

```ts
    if (enemy.moonPower.start > enemy.moonPower.cap) {
      errors.push(`enemy "${enemy.id}": moonPower start must be <= cap`);
    }
    const intentIds = new Set<string>();
    for (const intent of enemy.intents) {
      if (intentIds.has(intent.id)) errors.push(`enemy "${enemy.id}": duplicate intent id "${intent.id}"`);
      intentIds.add(intent.id);
    }
```

  - `test/load-game-data.test.ts`: `raw.enemies[0].intentPattern[0]` → `raw.enemies[0].intents[0]` (2 chỗ); thêm

```ts
  it("T148: rejects an enemy without intents or with start above cap", () => {
    const empty = rawData();
    empty.enemies[0].intents = [];
    expect(() => parseGameData(empty)).toThrowError();
    const inverted = rawData();
    inverted.enemies[0].moonPower = { start: 4, cap: 2 };
    expect(() => parseGameData(inverted)).toThrowError(/moonPower start must be <= cap/);
  });
```

  - `enemies.json`: thay mỗi `"intentPattern": [...]` bằng `"moonPower"` + `"intents"` theo bảng dưới (giữ nguyên `id`, `name`, `maxHp`, `moonOverrides`, `bloodMoonOverride`, `art`; chỉ đổi override Ảnh Hồ Trăng Tròn `moon_illusion` damage 9 → 7). Mỗi chiêu là `IntentDef` + `cost`; định dạng giống các chiêu hiện có (một dòng `effects` khi ngắn).

**`puppet_guard`** — `"moonPower": { "start": 1, "cap": 3 }`:

```json
    "intents": [
      { "id": "guard_stance", "name": "Thủ Thế", "kind": "defend", "cost": 1,
        "effects": [
          { "type": "gainArmor", "amount": 8, "to": "self" },
          { "type": "applyStatus", "status": "regen", "amount": 2, "to": "self" }
        ] },
      { "id": "heavy_strike", "name": "Trọng Kích", "kind": "attack", "targeting": "random", "cost": 1,
        "effects": [{ "type": "damage", "amount": 7, "to": "chosen" }] },
      { "id": "puppet_mirror_guard", "name": "Phản Giáp", "kind": "defend", "cost": 1,
        "effects": [
          { "type": "gainArmor", "amount": 5, "to": "self" },
          { "type": "applyStatus", "status": "reflect", "amount": 3, "to": "self" }
        ] },
      { "id": "puppet_quake", "name": "Chấn Địa", "kind": "attack", "cost": 2,
        "effects": [{ "type": "damage", "amount": 3, "to": "allEnemies" }] },
      { "id": "puppet_siege", "name": "Phá Thành", "kind": "attack", "targeting": "highestHp", "cost": 3,
        "effects": [
          { "type": "removeArmor", "to": "chosen" },
          { "type": "damage", "amount": 11, "to": "chosen" }
        ] }
    ],
```

**`shadow_fox`** — `"moonPower": { "start": 1, "cap": 2 }`:

```json
    "intents": [
      { "id": "twin_claw", "name": "Song Trảo", "kind": "attack", "targeting": "lowestHp", "cost": 1,
        "effects": [{ "type": "damage", "amount": 2, "hits": 2, "to": "chosen" }] },
      { "id": "illusion", "name": "Huyễn Thuật", "kind": "debuff", "targeting": "highestHp", "cost": 1,
        "effects": [{ "type": "applyStatus", "status": "weak", "amount": 2, "to": "chosen" }] },
      { "id": "maul", "name": "Cắn Xé", "kind": "attack", "targeting": "random", "cost": 1,
        "effects": [{ "type": "damage", "amount": 5, "to": "chosen" }] },
      { "id": "fox_vanish", "name": "Ẩn Hình", "kind": "attack", "targeting": "random", "cost": 1,
        "effects": [
          { "type": "applyStatus", "status": "stealth", "amount": 1, "to": "self" },
          { "type": "damage", "amount": 2, "to": "chosen" }
        ] },
      { "id": "fox_shadow_kill", "name": "Ảnh Sát", "kind": "attack", "targeting": "lowestHp", "cost": 2,
        "effects": [
          {
            "type": "conditional",
            "condition": { "type": "targetHasStatus", "status": "weak" },
            "then": [{ "type": "damage", "amount": 3, "hits": 3, "to": "chosen" }],
            "else": [{ "type": "damage", "amount": 3, "hits": 2, "to": "chosen" }]
          }
        ] }
    ],
```

**`book_wraith`** — `"moonPower": { "start": 1, "cap": 3 }`:

```json
    "intents": [
      { "id": "wraith_curse", "name": "Nguyền Thư", "kind": "debuff", "targeting": "random", "cost": 1,
        "effects": [{ "type": "applyStatus", "status": "vulnerable", "amount": 2, "to": "chosen" }] },
      { "id": "wraith_mend", "name": "Tự Tu", "kind": "buff", "cost": 1,
        "effects": [{ "type": "applyStatus", "status": "regen", "amount": 3, "to": "self" }] },
      { "id": "wraith_strike", "name": "Thư Kích", "kind": "attack", "targeting": "lowestHp", "cost": 1,
        "effects": [{ "type": "damage", "amount": 6, "to": "chosen" }] },
      { "id": "wraith_burn", "name": "Thiêu Thư", "kind": "debuff", "cost": 2,
        "effects": [{ "type": "applyStatus", "status": "burn", "amount": 2, "to": "allEnemies" }] },
      { "id": "wraith_seal", "name": "Phong Ấn", "kind": "debuff", "targeting": "highestHp", "cost": 3,
        "effects": [{ "type": "applyStatus", "status": "freeze", "amount": 1, "to": "chosen" }] }
    ],
```

**`black_guard`** — `"moonPower": { "start": 2, "cap": 5 }`:

```json
    "intents": [
      { "id": "black_roar", "name": "Chấn Hồn", "kind": "debuff", "cost": 1,
        "effects": [{ "type": "applyStatus", "status": "weak", "amount": 1, "to": "allEnemies" }] },
      { "id": "black_bulwark", "name": "Hắc Thuẫn", "kind": "defend", "cost": 2,
        "effects": [
          { "type": "gainArmor", "amount": 12, "to": "self" },
          { "type": "applyStatus", "status": "regen", "amount": 3, "to": "self" }
        ] },
      { "id": "black_rage", "name": "Thịnh Nộ", "kind": "buff", "cost": 2,
        "effects": [{ "type": "applyStatus", "status": "strength", "amount": 2, "to": "self" }] },
      { "id": "black_sweep", "name": "Hoành Tảo", "kind": "attack", "cost": 3,
        "effects": [{ "type": "damage", "amount": 7, "to": "allEnemies" }] },
      { "id": "black_cleave", "name": "Hắc Trảm", "kind": "attack", "targeting": "lowestHp", "cost": 5,
        "effects": [{ "type": "damage", "amount": 16, "to": "chosen" }] }
    ],
```

**`fox_king`** — `"moonPower": { "start": 2, "cap": 5 }`:

```json
    "intents": [
      { "id": "fox_king_veil", "name": "Huyễn Ảnh", "kind": "buff", "cost": 1,
        "effects": [{ "type": "applyStatus", "status": "stealth", "amount": 2, "to": "self" }] },
      { "id": "fox_king_howl", "name": "Hồ Khiếu", "kind": "debuff", "cost": 2,
        "effects": [{ "type": "applyStatus", "status": "weak", "amount": 2, "to": "allEnemies" }] },
      { "id": "fox_king_feast", "name": "Huyết Hồ", "kind": "buff", "cost": 2,
        "effects": [{ "type": "heal", "amount": 8, "to": "self" }] },
      { "id": "fox_king_claw", "name": "Vương Trảo", "kind": "attack", "targeting": "highestHp", "cost": 3,
        "effects": [{ "type": "damage", "amount": 10, "to": "chosen" }] },
      { "id": "fox_king_nine_tails", "name": "Cửu Vĩ Trảm", "kind": "attack", "targeting": "lowestHp", "cost": 5,
        "effects": [
          {
            "type": "conditional",
            "condition": { "type": "targetHasStatus", "status": "weak" },
            "then": [{ "type": "damage", "amount": 5, "hits": 4, "to": "chosen" }],
            "else": [{ "type": "damage", "amount": 3, "hits": 4, "to": "chosen" }]
          }
        ] }
    ],
```

**`moon_ape`** — `"moonPower": { "start": 3, "cap": 8 }`, `maxHp` giữ 110:

```json
    "intents": [
      { "id": "ape_guard", "name": "Nguyệt Giáp", "kind": "defend", "cost": 2,
        "effects": [
          { "type": "gainArmor", "amount": 8, "to": "self" },
          { "type": "applyStatus", "status": "regen", "amount": 1, "to": "self" }
        ] },
      { "id": "ape_rage", "name": "Cuồng Nộ", "kind": "buff", "cost": 2,
        "effects": [{ "type": "applyStatus", "status": "strength", "amount": 2, "to": "self" }] },
      { "id": "ape_crush", "name": "Trấn Sơn Quyền", "kind": "attack", "targeting": "lowestHp", "cost": 4,
        "effects": [{ "type": "damage", "amount": 12, "to": "chosen" }] },
      { "id": "ape_roar", "name": "Hống Nguyệt", "kind": "attack", "cost": 4,
        "effects": [{ "type": "damage", "amount": 6, "to": "allEnemies" }] },
      { "id": "ape_heaven_strike", "name": "Thiên Nguyệt Kích", "kind": "attack", "targeting": "highestHp", "cost": 8,
        "effects": [
          { "type": "damage", "amount": 20, "to": "chosen" },
          { "type": "applyStatus", "status": "vulnerable", "amount": 2, "to": "chosen" }
        ] }
    ],
```

Tên chiêu cũ giữ theo data hiện có (Cắn Xé, Huyễn Thuật, Nguyền Thư, Thư Kích, Hoành Tảo, Huyễn Ảnh, Hồ Khiếu, Nguyệt Giáp, Trấn Sơn Quyền, Hống Nguyệt); spec §5.5 dùng tên gọi tắt — đồng bộ tên chiêu cũ trong spec §5.5 theo data ở bước này.

- [ ] **Step 8: `test/helpers.ts`**

```ts
export function setIntent(state: CombatState, position: number, intent: IntentDef, targetId: string | null): void {
  setPlan(state, position, [{ intent, targetId }]);
}

export function setPlan(
  state: CombatState,
  position: number,
  plan: { intent: IntentDef; targetId: string | null }[],
): void {
  state.enemies[position]!.plannedIntents = plan.map((entry) => ({ ...entry, cost: 0 }));
}

export function idleEnemies(state: CombatState): void {
  for (const enemy of state.enemies) {
    enemy.plannedIntents = [{ intent: idleIntent, cost: 0, targetId: null }];
  }
}

export function makeEnemiesIdle(data: GameData): void {
  for (const def of Object.values(data.enemies)) {
    def.intents = [{ ...idleIntent, cost: 0 }];
    def.moonOverrides = [];
  }
}
```

- [ ] **Step 9: Sửa test cũ**
  - `enemy.currentIntent?.intent.id` → `enemy.plannedIntents[0]?.intent.id`; `enemy.currentIntent` not null → `plannedIntents.length > 0`.
  - `data.enemies[x]!.intentPattern[n]!` → `data.enemies[x]!.intents.find((i) => i.id === "<id cũ>")!` (vd. T45: `"guard_stance"` — chiêu giờ chỉ giáp + Hồi Phục, T45 vẫn kỳ vọng giáp 8).
  - Mọi assertion `patternIndex`: **xóa** (khái niệm không còn).
  - `intentRevealed` → `intentsRevealed` (kiểm tra số event = số địch còn sống).
  - `boss.test.ts` T91: thay bằng kiểm tra chiêu đầu chuỗi là `ape_blood_frenzy` (T142 đã phủ phần "cost 0 + thêm chiêu"). T92: sau `endTurn` báo chuỗi, cắt chuỗi còn chiêu đầu `announced.state.enemies[0]!.plannedIntents.splice(1)` rồi giữ nguyên các assertion giáp/Phản Đòn.
  - Test chạy chiêu địch thật mà cần đúng một chiêu: cắt chuỗi bằng `plannedIntents.splice(1)` hoặc dùng `setIntent`.
  - `preview.test.ts`: `preview?.damages` → `preview?.intents[0]?.damages`; `preview?.targetId` → `preview?.intents[0]?.targetId`; `preview?.fizzles` → `preview?.intents[0]?.fizzles`.
  - `create-combat.test.ts` T01: thay kỳ vọng `heavy_strike` / `twin_claw` bằng: mỗi địch có `plannedIntents` với tổng `cost ≤ moonPower`, `moonPower === data.enemies[defId].moonPower.start`.

- [ ] **Step 10: Client (bắt buộc để typecheck)**
  - `debug.ts`: case `intentRevealed` → 

```ts
    case "intentsRevealed":
      return `${name(event.enemyId)} báo ${event.intents.map((i) => i.intentId).join(", ") || "Tụ Lực"} (NL ${event.moonPower})`;
```

  - `ui/event-animator.ts`: đổi `case "intentRevealed"` → `case "intentsRevealed"`, chữ nổi `event.intents.length === 0 ? "Tụ Lực" : "Ý định mới"`.
  - `scenes/combat-scene.ts` `renderIntent` thay toàn bộ:

```ts
  private renderIntent(enemy: EnemyState, x: number, y: number) {
    if (!enemy.alive) return;
    const preview = previewEnemyIntent(this.gameData, this.state, enemy);
    if (!preview) return;
    const lines = enemy.plannedIntents.map((planned, index) => {
      const intentPreview = preview.intents[index]!;
      let label = `${INTENT_ICONS[planned.intent.kind]} ${planned.intent.name} (${planned.cost})`;
      const damage = intentPreview.damages[0];
      if (damage) label += ` ${damage.amount}${damage.hits > 1 ? `×${damage.hits}` : ""}`;
      if (intentPreview.fizzles) {
        label += " → (hụt)";
      } else if (intentPreview.targetId) {
        const target = this.state.heroes.find((hero) => hero.id === intentPreview.targetId);
        label += ` → ${target ? this.gameData.heroes[target.defId]!.name : "—"}`;
      } else if (intentPreview.damages.length > 0) {
        label += " → tất cả";
      }
      return label;
    });
    const text = lines.length === 0 ? "⋯ Tụ Lực" : lines.join("\n");
    this.text(x, y, preview.skipped ? `❄ ${text}` : text, 12)
      .setOrigin(0.5, 1)
      .setAlign("center")
      .setAlpha(preview.skipped ? 0.55 : 1);
  }
```

  và trong `renderEnemies` gọi `this.renderIntent(enemy, cx, 132)` (neo đáy, chuỗi mọc lên trên).

- [ ] **Step 11: Spec** — `docs/12-phase4a-spec.md` §1: dòng `rules/src/intent.ts → enemy-plan.ts` → `rules/src/intent.ts` ("`planEnemyIntents` thay `announceIntents`"); §5.5 dùng tên chiêu cũ theo data.

- [ ] **Step 12: Chạy toàn bộ**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 13: Commit**

```bash
git add packages apps docs
git commit -m "Step 4a.6: enemies plan intent chains with moon power and reserve"
```

---

### Task 7: Client (bước 4a.7)

**Files:**
- Modify: `apps/client/src/scenes/combat-scene.ts`, `apps/client/src/ui/event-animator.ts`

**Interfaces:**
- Consumes: `CombatState.status` (`"mulligan"`, `"choosing"`), `pendingChoice`, `moonReserve`, `EnemyState.moonPower/moonReserve/plannedIntents`, `CombatConfig` (`handSize`, `maxMulligan`, `moonReserveMax`), Action `mulligan` / `chooseCard`.
- Produces: không có API mới; chỉ màn hình.

- [ ] **Step 1: Bỏ hai nhánh tự gửi tạm** (mulligan rỗng ở Task 4, chọn lá đầu ở Task 5) trong `renderAll()`.

- [ ] **Step 2: Đổi Bài** — thêm field `private mulliganPicks = new Set<string>();` (xóa trong `create()` và `syncFromSession()`). Trong `onCardClicked`, đầu hàm:

```ts
    if (this.state.status === "mulligan") {
      if (this.inputLocked) return;
      if (this.mulliganPicks.has(instanceId)) this.mulliganPicks.delete(instanceId);
      else if (this.mulliganPicks.size < this.gameData.combatConfig.maxMulligan) this.mulliganPicks.add(instanceId);
      this.renderAll();
      return;
    }
```

Trong `renderCard`: nếu `this.mulliganPicks.has(instanceId)` → viền `COLORS.goldFill` dày 3 và dòng chữ "Đổi" ở giữa lá; hover-phóng-to cho phép cả khi `status === "mulligan"`. Thêm vào `renderAll()` (trước `renderDebugPanel`):

```ts
    if (this.state.status === "mulligan") this.renderMulliganBar();
```

```ts
  private renderMulliganBar() {
    const picks = this.mulliganPicks.size;
    this.text(WIDTH / 2, 520, `Đổi Bài: chọn tối đa ${this.gameData.combatConfig.maxMulligan} lá để đổi`, 14, COLORS.gold).setOrigin(0.5);
    this.endScreenButton(1150, 600, picks > 0 ? `Đổi (${picks})` : "Giữ nguyên", () => {
      const instanceIds = [...this.mulliganPicks];
      this.mulliganPicks.clear();
      this.dispatch({ type: "mulligan", instanceIds });
    });
  }
```

Nút "KẾT THÚC LƯỢT" chỉ vẽ khi `status === "playerTurn"`.

- [ ] **Step 3: Chiêm Bài** — trong `renderAll()` (sau Đổi Bài):

```ts
    if (this.state.status === "choosing") this.renderChoiceOverlay();
```

```ts
  private renderChoiceOverlay() {
    const options = this.state.pendingChoice!.options;
    this.root.add(this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x000000, 0.6));
    this.text(WIDTH / 2, 250, "Chiêm Bài — chọn 1 lá, các lá còn lại xuống đáy chồng", 16, COLORS.gold).setOrigin(0.5);
    const spacing = CARD_W + 30;
    const startX = WIDTH / 2 - ((options.length - 1) * spacing) / 2;
    options.forEach((instanceId, index) => {
      const view = this.renderCard(instanceId, startX + index * spacing, 380);
      view.setDepth(50).setAlpha(1); // renderCard dims cards that are not playable right now
      view.removeAllListeners("pointerup");
      view.on("pointerup", (pointer: Phaser.Input.Pointer) => {
        if (pointer.button === 0) this.dispatch({ type: "chooseCard", instanceId });
      });
    });
  }
```

- [ ] **Step 4: Nguyệt Lực + Dự Trữ** — thay 3 dòng đầu `renderBottomBar`:

```ts
    const power = this.state.moonPower;
    const reserve = this.state.moonReserve;
    const base = Math.max(0, power - reserve);
    this.text(30, 545, "Nguyệt Lực", 13, COLORS.dimText);
    this.text(30, 566, "◉".repeat(base), 16, COLORS.gold);
    if (reserve > 0) this.text(30 + base * 12, 566, "◈".repeat(reserve), 16, COLORS.costCheap);
    this.text(30, 592, reserve > 0 ? `${power} (Dự Trữ ${reserve})` : `${power}`, 12, COLORS.dimText);
```

Nhãn nút kết thúc lượt: `KẾT THÚC LƯỢT` và dòng nhỏ bên dưới `Giữ ${Math.min(this.gameData.combatConfig.moonReserveMax, this.state.moonPower)}` (cỡ 11, `COLORS.dimText`).

- [ ] **Step 5: Đồng hồ Cạn Bài** — thay dòng `Rút ${...}`:

```ts
    const pile = this.state.drawPile.length;
    this.text(1090, 548, `Chồng bài ${pile}`, 16, pile <= 6 ? "#ff8080" : COLORS.text);
```

(giữ dòng `Bỏ ${this.state.discardPile.length}`.)

- [ ] **Step 6: Nguyệt Lực địch** — trong `renderEnemies`, sau tên địch:

```ts
      this.text(panelW / 2 - 10, -panelH / 2 + 16, `NL ${enemy.moonPower}${enemy.moonReserve > 0 ? ` +${enemy.moonReserve}` : ""}`, 11, COLORS.gold, c).setOrigin(1, 0.5);
```

- [ ] **Step 7: Animation** — `event-animator.ts` thêm case (trước `default`):

```ts
    case "mulliganed":
      return floatText(scene, WIDTH / 2, 520, `Đổi ${event.returned.length} lá`, "#cfd6f0", 14, 250);
    case "choiceOpened":
      return floatText(scene, WIDTH / 2, 520, "Chiêm Bài", "#f4d35e", 16, 250);
    case "cardChosen":
      return instant();
    case "deckedOut":
      return floatText(scene, WIDTH / 2, 300, "CẠN BÀI", "#ff8080", 28, 700);
    case "cardsPurged":
      return floatText(scene, 1120, 548, `-${event.instanceIds.length} lá (Tán Chiêu)`, "#8b93b8", 12, 300);
    case "moonReserveChanged":
      return instant();
```

`ERROR_LABELS` thêm:

```ts
  [/mulligan pending/, "Hãy Đổi Bài trước"],
  [/choice pending/, "Hãy chọn 1 lá"],
  [/too many cards to mulligan/, "Chỉ đổi tối đa 2 lá"],
```

- [ ] **Step 8: Kiểm tra tay** — `pnpm dev`, mở trình duyệt (Browser pane): chọn đội mặc định, kiểm tra lần lượt: màn Đổi Bài (chọn 2 lá → Đổi; lá mới thay đúng vị trí), vòng 1 có 3 Nguyệt Lực, kết thúc lượt không đánh gì → vòng 2 hiện "7 (Dự Trữ 3)", tay giữ nguyên 6 lá, chuỗi ý định địch có cost, "Tụ Lực" khi địch không đủ tiền, đánh Nguyệt Quang Dẫn (đội có F04) → lớp phủ Chiêm Bài 3 lá, chọn → lá vào tay. Chụp màn hình từng trạng thái.

- [ ] **Step 9: Chạy toàn bộ**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add apps
git commit -m "Step 4a.7: client for mulligan, Chiêm Bài, reserve, deck-out clock, enemy chains"
```

---

### Task 8: Mô phỏng + chỉnh số (bước 4a.8)

**Files:**
- Modify: `packages/rules/test/playtest.test.ts`, `packages/rules/test/run-playtest.test.ts`, `docs/playtest-notes.md`
- Modify (chỉ sau khi người dùng duyệt): `packages/data/{cards,enemies,combat-config}.json`

**Interfaces:**
- Consumes: mọi thứ ở Task 2–6.

- [ ] **Step 1: Heuristic mới** — dùng chung trong cả hai file playtest (chép vào mỗi file, không tạo module chung):

```ts
function combatAction(gameData: GameData, state: CombatState): Action {
  if (state.status === "mulligan") {
    const expensive = state.hand.filter((id) => gameData.cards[state.cards[id]!.cardId]!.cost > 5);
    return { type: "mulligan", instanceIds: expensive.slice(0, gameData.combatConfig.maxMulligan) };
  }
  if (state.status === "choosing") {
    const curve = gameData.combatConfig.moonPower;
    const nextFund = Math.min(curve.cap, curve.start + state.round * curve.perRound) + gameData.combatConfig.moonReserveMax;
    const options = [...state.pendingChoice!.options].sort(
      (a, b) => gameData.cards[state.cards[b]!.cardId]!.cost - gameData.cards[state.cards[a]!.cardId]!.cost,
    );
    const pick = options.find((id) => gameData.cards[state.cards[id]!.cardId]!.cost <= nextFund) ?? options[0]!;
    return { type: "chooseCard", instanceId: pick };
  }
  const playable = state.hand
    .filter((id) => isCardPlayable(gameData, state, id))
    .sort((a, b) => getEffectiveCost(gameData, state, b) - getEffectiveCost(gameData, state, a));
  for (const instanceId of playable) {
    const card = gameData.cards[state.cards[instanceId]!.cardId]!;
    if (card.target === "none") return { type: "playCard", instanceId };
    const units: { id: string; hp: number; maxHp: number }[] = card.target === "enemy" ? state.enemies : state.heroes;
    const score = (id: string) => {
      const unit = units.find((u) => u.id === id)!;
      return card.target === "enemy" ? unit.hp : unit.hp / unit.maxHp;
    };
    const targetId = getValidTargets(gameData, state, instanceId).sort((a, b) => score(a) - score(b))[0];
    if (targetId !== undefined) return { type: "playCard", instanceId, targetId };
  }
  return { type: "endTurn" };
}
```

(`playtest.test.ts` dùng hàm này thay heuristic cũ; `run-playtest.test.ts` thay `combatAction` hiện có, giữ `runAction`/`nodeScore`.)

- [ ] **Step 2: Chỉ số** — thêm vào kết quả mỗi trận (playtest) / mỗi lượt chơi (run-playtest):
  - `rounds`, `result` (`won` / `lost` / `deckedOut` — `deckedOut` khi event `deckedOut` xuất hiện), `stalled` (> 60 vòng).
  - `clogTurns` / `turns`: đếm lượt người chơi mà tay có `handSize` lá và `isCardPlayable` false cho mọi lá.
  - `avgReserve`: trung bình `moonReserve` đầu lượt người chơi.
  - `enemyIntentsPerRound`: trung bình độ dài `plannedIntents` của địch còn sống lúc `turnStarted` phía địch.
  In bảng tổng theo tier trận (thường / Tinh Anh / boss) và theo đội.

- [ ] **Step 3: Chạy và đọc số**

Run: `pnpm --filter rules exec vitest run test/playtest.test.ts test/run-playtest.test.ts --reporter=verbose --silent=false`
Expected: PASS (các test chỉ khẳng định kết quả hợp lệ); bảng in ra console.

- [ ] **Step 4: Ablation** — theo cách GĐ 3: tạo file tạm `packages/rules/test/zz-ablation.test.ts` (không commit) chạy 4 đội × 20 seed với các biến thể data (mutate `structuredClone(loadGameData())`): HP địch thường ×1.25 / ×1.5, `copies` của Huyết Khế 3 → 2, `handSize` 5 / 6, `moonReserveMax` 2 / 3, HP boss 90 / 110 / 130. So với mục tiêu spec §8: trận thường và Tinh Anh 8–12 vòng, thua vì Cạn Bài < 10% trận, kẹt tay < 10% lượt, thắng lượt chơi 25–40%; boss chỉ đo và báo cáo. Xóa file tạm sau khi đo.

- [ ] **Step 5: Trình người dùng duyệt** — trình bảng số (hiện tại vs từng biến thể) và đề xuất gói chỉnh; hỏi bằng câu hỏi lựa chọn. **Không sửa data trước khi được duyệt.**

- [ ] **Step 6: Áp gói đã duyệt** vào `cards.json` / `enemies.json` / `combat-config.json`; sửa test luật nào vỡ theo quy tắc chung (test luật không được phụ thuộc số cân bằng — nếu vỡ, chuyển sang fixture). Chạy lại playtest.

- [ ] **Step 7: `docs/playtest-notes.md`** — thêm mục "# Playtest Notes — Phase 4a" theo mẫu GĐ 3: phương pháp, bảng ablation, gói đã áp (có lý do bằng số), bảng kết quả sau chỉnh, số liệu boss (vòng, thắng, Cạn Bài) để người dùng quyết mục tiêu, và checklist chơi tay (Đổi Bài có tạo quyết định không; Dự Trữ có được dùng chủ động không; đồng hồ Cạn Bài có gây áp lực không; chuỗi chiêu địch có đọc được không; Chiêm Bài có đáng cost không).

- [ ] **Step 8: Chạy toàn bộ**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages docs
git commit -m "Step 4a.8: phase 4a playtest heuristics, tuning and notes"
```
