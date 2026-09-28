# Giai đoạn 7b (Linh Thú + 6 Hero đợt 2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Mỗi Task kết thúc bằng `pnpm test` + `pnpm typecheck` xanh và một commit trên nhánh `feature/phase7`. Báo người dùng sau mỗi Task và chờ "ok" trước Task kế tiếp.

**Goal:** Đủ 20 Hero: thêm F05, F06, F07, F09, F10, M09 và 2 lá Song Hành, cùng các cơ chế Linh Thú (đơn vị thật), Mê Hoặc (`charm`), Phong Ấn (`sealIntent`), Hồi Hồn (`revive`), xuyên mục tiêu, chơi được ở Trận lẻ / Lượt chơi / PvP / co-op.

**Architecture:** Linh Thú là `SummonState` trong mảng mới `CombatState.summons?` (chỉ tạo khi có triệu hồi đầu tiên, để state trận cũ không đổi). Mọi thao tác trên Linh Thú gom vào file mới `src/summons.ts`; các chỗ tra đơn vị (`findUnit`, `alliesOf`, `opponentsOf`, `processDeaths`, `tickDurations`, đầu lượt) mở rộng thêm `summonsOf(state)`. Các cơ chế khác là kiểu mới trong union có sẵn, xử lý ở `effects.ts` / `enemy-turn.ts` / `apply-action.ts`. Cơ chế được test bằng dữ liệu tiêm vào (`mutateData`, `injectCard`) trước khi có nội dung; nội dung 6 Hero vào ở Task 8 và phải được người dùng duyệt danh sách lá trước khi viết JSON.

**Tech Stack:** TypeScript strict, pnpm workspaces, Vitest, zod (`packages/data`), Phaser (client).

**Spec:** `docs/18-phase7-spec.md` §1, §3 (7b). Khi plan và spec khác nhau về luật, spec là chuẩn; khi spec và tài liệu luật (`01`, `02`) khác nhau, tài liệu luật là chuẩn. Những điểm plan làm rõ spec nằm ở Task 1 bước 1 và phải được đưa vào tài liệu.

## Global Constraints

- `packages/rules` thuần: không Phaser, DOM, mạng, file system, `Math.random()`, `Date.now()`. Ngẫu nhiên dùng RNG trong `CombatState` (`nextRandom`, `shuffle` trong `src/rng.ts`).
- Hàm thuần, không mutate state đầu vào: `applyAction` luôn `cloneState` trước khi sửa.
- **T213 (ghi vàng PvE, `packages/rules/test/golden.test.ts`) xanh sau mỗi Task.** Không Task nào của 7b được đổi kết quả trận hay lượt chơi cũ. Nếu T213 đỏ thì dừng, tìm nguyên nhân, và không ghi vàng lại khi người dùng chưa duyệt.
- Trường state mới là **optional** (`?:`) và chỉ được gán khi cơ chế mới chạy.
- Event PvE giữ nguyên hình dạng; trường `player` chỉ xuất hiện qua `seatTag(state, index)`.
- Không hardcode số liệu Hero, lá, Linh Thú trong code. Số liệu nằm trong JSON (`heroes.json`, `cards.json`, `summons.json`, `pvp-config.json`, `banners.json`).
- Code, tên biến, comment: tiếng Anh. Chữ cho người chơi: tiếng Việt, lấy từ dữ liệu hoặc `apps/client/src/theme.ts`.
- Thuật ngữ theo `docs/04-glossary.md` (Task 1 thêm: Linh Thú, Mê Hoặc, Phong Ấn, Hồi Hồn, Xuyên).
- Mã test **T280–T297** (Task 1 đánh số lại so với spec vì 7a đã dùng T277, T279). Tên test bắt đầu bằng mã (`it("T280: …")`).
- Không thêm thư viện mới.
- Lệnh (chạy ở gốc `D:\Source\VongNguyet`): `pnpm --filter rules test`, `pnpm --filter data test`, `pnpm test`, `pnpm typecheck`.

---

## File Structure

| File | Trách nhiệm | Task |
|---|---|---|
| `docs/{00,01,02,04,06,07}.md`, `CLAUDE.md`, `docs/18-phase7-spec.md` | Tài liệu luật 7b | 1 |
| `packages/rules/src/types/static.ts` | `SummonDef`, `TargetRef` (`owner`, `summon`), `CardTarget` (`fallenAlly`), `StatusId` (`charm`), `Effect` mới, 6 `LevelUpCounter`, 11 `LevelUpPassive` | 2–7 |
| `packages/rules/src/types/state.ts` | `SummonState`, `CombatState.summons?`, `EnemyState.sealedIntentIds?`, `HeroState.revived?`/`firstSealUsedThisTurn?`, `PlayerState.purged?`/`fallenOrder?`, `CardInstance.sealSurcharge?` | 2, 5, 6 |
| `packages/rules/src/types/events.ts` | `summoned`, `summonActed`, `summonDismissed`, `heroRevived` | 2, 3, 6 |
| `packages/rules/src/types/api.ts` | `GameData.summons` | 2 |
| `packages/data/summons.json` (mới), `src/schema.ts`, `src/load-game-data.ts` | Dữ liệu Linh Thú, zod, kiểm chéo | 2, 8 |
| `packages/rules/src/summons.ts` (mới) | `summonsOf`, `isSummon`, `summonEffect`, `runSummonActions`, `dismissSummonOf`, `awakenSummon` | 2, 3 |
| `packages/rules/src/players.ts` | `alliesOf`/`opponentsOf` gồm Linh Thú | 3 |
| `packages/rules/src/effects.ts` | `findUnit`, `resolveTargets`, `processDeaths`, `killUnit` với Linh Thú; effect `summon`, `sealIntent`, `revive`, `extendDebuffs`; `charm`, bộ đếm, nội tại | 2–7 |
| `packages/rules/src/intent.ts` | `pickTarget` nhận `UnitState[]` | 2 |
| `packages/rules/src/enemy-turn.ts` | Khiêu Khích của Linh Thú; Mê Hoặc đổi mục tiêu; giữ `sealedIntentIds` | 3, 4, 5 |
| `packages/rules/src/preview.ts` | Xem trước với Linh Thú và Mê Hoặc | 3, 4 |
| `packages/rules/src/turn.ts`, `coop/turn.ts`, `pvp/turn.ts` | Linh Thú: xóa giáp / tick / hành động cuối lượt; chỉ xóa giảm giá của lá thuộc người chơi đó | 3, 5 |
| `packages/rules/src/turn-passives.ts` | Reset `firstSealUsedThisTurn` | 5 |
| `packages/rules/src/apply-action.ts` | Mê Hoặc trong PvP (lá tấn công đổi mục tiêu) | 4 |
| `packages/rules/src/queries.ts` | Mục tiêu `fallenAlly`; cost `sealSurcharge`; Linh Thú trong mục tiêu `ally` co-op | 3, 5, 6 |
| `packages/rules/src/statuses.ts` | `charm` là debuff, có `sourceId` | 4 |
| `packages/rules/src/levelup.ts` | Linh Thú thức tỉnh khi Hero chủ thăng cấp | 3 |
| `packages/rules/test/phase7b-mechanics.test.ts` (mới) | T280–T295 | 2–7 |
| `packages/rules/test/phase7b-heroes.test.ts` (mới) | T296–T297 | 8 |
| `packages/data/{heroes,cards,summons,banners,pvp-config}.json` | Nội dung | 8 |
| `packages/rules/src/bot.ts` | Heuristic Linh Thú / Mê Hoặc / Phong Ấn / Hồi Hồn | 3, 10 |
| `apps/client/src/scenes/combat-scene.ts`, `ui/event-animator.ts`, `debug.ts`, `theme.ts` | Ô Linh Thú, nhãn `Mê`, Phong Ấn, Hồi Hồn | 9 |
| `packages/rules/test/{pvp-sim.ts,run-playtest.test.ts}`, `docs/playtest-notes.md` | Mô phỏng + chỉnh số | 10 |

---

### Task 1: Tài liệu 7b (bước 7b.1)

**Files:**
- Modify: `docs/18-phase7-spec.md` (§3, §6, §8), `docs/01-combat-rules.md`, `docs/02-data-schema.md`, `docs/04-glossary.md`, `docs/06-test-scenarios.md`, `docs/07-implementation-plan.md`, `docs/00-gdd.md` (§4 ghi chú F07), `CLAUDE.md`

**Interfaces:**
- Produces: luật chuẩn cho Task 2–10.

- [ ] **Step 1: Chốt các điểm plan làm rõ spec** — sửa `docs/18-phase7-spec.md` §3 cho khớp:
  - **Id Linh Thú**: `prefixedId(state, seat, "summon:<ownerDefId>")`. PvE là `summon:f09`, nhiều người chơi là `p0_summon:f09`. Thay chỗ ghi `p<i>_s_<ownerHeroId>`.
  - `CombatState.summons` là **optional**, chỉ được tạo ở lần triệu hồi đầu tiên.
  - Linh Thú chỉ dùng `awakenedId` khi nội tại đang có hiệu lực của Hero chủ là **`awakenSummons`** (nội tại dạng thường của F09). Không áp dụng cho mọi Hero thăng cấp, vì như vậy dạng thứ hai của F09 (Nguyệt Cung) sẽ mạnh hơn hẳn dạng thường.
  - `TargetRef` thêm `"owner"` (Hero chủ, chỉ hợp lệ trong `SummonDef.action`) và `"summon"` (Linh Thú còn sống của Hero đang giải quyết effect, chỉ hợp lệ trên lá Hero / Song Hành). Lá Song Hành *Nguyệt Thố Hộ Mệnh* dùng `"summon"`.
  - Đòn của Linh Thú là đòn tấn công: Sức Mạnh và Suy Yếu áp dụng. Không có hệ số pha trăng (hệ số đó chỉ dành cho lá bài).
  - Linh Thú bị giết **không** tính `enemiesKilled` trong PvP.
  - **Phong Ấn**: id các chiêu bị hủy được giữ trong `EnemyState.sealedIntentIds`. Lúc thi hành lượt kẻ địch, `lastIntentIds` bằng id các chiêu còn lại trong chuỗi **cộng** `sealedIntentIds`, sau đó xóa `sealedIntentIds`. Lý do: `runEnemyTurn` ghi đè `lastIntentIds`. Trong PvP, phụ phí +1 nằm ở `CardInstance.sealSurcharge` và bị xóa ở cuối lượt của **người sở hữu lá**. Vì thế `endSeatTurn` chỉ xóa `chosenThisTurn` / `turnDiscount` / `sealSurcharge` của lá thuộc người chơi đó.
  - **Mê Hoặc**: `sourceId` là người gây. Chiêu bị đổi mục tiêu vẫn trừ 1 lượt Mê Hoặc kể cả khi thất bại vì không còn kẻ địch khác. Trong PvE / co-op, Mê Hoặc trên Hero không có tác dụng (chỉ PvP có luật cho Hero).
  - **Kinh Hồng Vũ** (F06): nội tại `charmMastery { extraCharges: 1, damageMultiplier: 1.5 }`. Hệ số ×1.5 áp khi Hero gây Mê Hoặc (`sourceId`) còn sống, đã thăng cấp và có nội tại này.
  - **Hồi Hồn**: `revive { ratio; to: "chosen" | "lastFallen" }`. Lá bài dùng `target: "fallenAlly"` + `to: "chosen"`. Nội tại dạng thường của F10 là `none` với `levelUp.onLevelUp: [{ type: "revive", ratio: 0.3, to: "lastFallen" }]`, trong đó `lastFallen` là Hero ngã gần nhất của cùng người chơi mà chưa từng được Hồi Hồn (lấy từ `PlayerState.fallenOrder`).
  - **Xuyên**: đòn xuyên gọi `dealDamage` với **cùng base** lên kẻ địch đứng ngay sau. Hệ số của mục tiêu mới (Dễ Vỡ…) vẫn áp dụng.
  - **Khúc Vũ Tri Âm** dùng effect mới `extendDebuffs { amount; to }`: cộng `amount` vào mọi debuff có thời hạn trên mục tiêu (×2 trong PvP).
  - Bộ đếm mới: `summonsMade`, `charmsApplied`, `intentsSealed`, `alliesFallen` (của cả người chơi), `debuffsApplied`, `backRowHits`.
  - Nội tại mới: `pierceOwnAttacks`, `firstHitMarks { rounds }`, `charmMastery`, `stealthOnCharm { rounds }`, `sealExtraFirstPerTurn`, `sealWeakens { amount }`, `awakenSummons`, `summonTaunts { rounds }`, `armorOnAllyFall { amount }`, `debuffDurationBonus { amount }`, `bonusVsDebuffed { minDebuffs; amount }`.
  - Đánh số test lại: §6 và §8 phần 7b dùng **T280–T297**, 7c dời sang **T298–T305**, 7d dời sang **T306–T311** (cùng thứ tự, tịnh tiến).
- [ ] **Step 2: `01-combat-rules.md`** — thêm mục **§17 Linh Thú** (dữ liệu, id, triệu hồi / triệu hồi lại / thức tỉnh, hành động ở §3.3 bước mới ngay trước lượt kẻ địch, bị nhắm, vòng đời, PvP, co-op). Thêm vào:
  - §6.1: `charm`.
  - §9.3.1: bước 1 xét cả Linh Thú (Hero trước) và bước Mê Hoặc.
  - §5: `sealIntent`, `revive`, `extendDebuffs`, xuyên, và `target: "fallenAlly"`.
  - §15.4 và §15.5: PvP cho Linh Thú, Mê Hoặc, Phong Ấn.
  - §8: bảng thăng cấp của 6 Hero theo `18` §3.3.
- [ ] **Step 3: `02-data-schema.md`** — `summons.json` (`SummonDef`) + kiểm chéo, `SummonState`, `TargetRef`, `CardTarget`, `StatusId`, effect, bộ đếm, nội tại, event mới, trường state mới (liệt kê ở Task 2–7).
- [ ] **Step 4: `04-glossary.md`** — thêm Linh Thú, Mê Hoặc, Phong Ấn, Hồi Hồn, Xuyên, Hàng Sau, 6 Hero mới cùng tên nội tại và dạng thăng cấp.
- [ ] **Step 5: `06-test-scenarios.md`** — thêm bảng T280–T297 đúng như câu mô tả ở cột "Test" của Task 2–8 (tiền tố **[GĐ7]**).
- [ ] **Step 6: `07-implementation-plan.md`** — mục Giai đoạn 7 thêm bước 7b.1–7b.6 (đường dẫn plan này). `00` §4 thêm ghi chú lệch GDD của F07 (`18` §3.3). `CLAUDE.md` "Giai đoạn hiện tại": "7b đang làm — `docs/18-phase7-spec.md` §3".
- [ ] **Step 7: Kiểm tra và commit**

Run: `pnpm test && pnpm typecheck`
Expected: PASS (chỉ đổi tài liệu).

```bash
git add docs CLAUDE.md
git commit -m "Step 7b.1: phase 7b rule docs"
```

---

### Task 2: Linh Thú — dữ liệu, state, effect `summon`, hành động cuối lượt (bước 7b.2, phần 1)

**Files:**
- Modify: `packages/rules/src/types/static.ts`, `types/state.ts`, `types/events.ts`, `types/api.ts`, `packages/data/src/schema.ts`, `packages/data/src/load-game-data.ts`, `packages/rules/src/effects.ts`, `packages/rules/src/intent.ts`, `packages/rules/src/turn.ts`, `packages/rules/src/pvp/turn.ts`, `packages/rules/src/coop/turn.ts`, `packages/rules/src/index.ts`, `apps/client/src/debug.ts` (switch event)
- Create: `packages/data/summons.json` (mảng rỗng `[]`), `packages/rules/src/summons.ts`, `packages/rules/test/phase7b-mechanics.test.ts`
- Modify: `packages/data/test/load-game-data.test.ts` (`rawData()` thêm `summons`)

**Interfaces:**
- Produces:
  - `SummonDef { id: string; name: string; maxHp: number; targeting: "lowestHp" | "front" | "random"; action: Effect[]; awakenedId?: string }`; `GameData.summons: Record<string, SummonDef>`.
  - `TargetRef` thêm `"owner" | "summon"`.
  - `Effect` thêm `{ type: "summon"; summonId: string }`.
  - `LevelUpCounter` thêm `"summonsMade"`; `LevelUpPassive` thêm `{ type: "awakenSummons" }`, `{ type: "summonTaunts"; rounds: number }`.
  - `SummonState extends UnitState { side: "hero"; player: number; ownerHeroId: string; summonId: string }`; `CombatState.summons?: SummonState[]`.
  - Event: `{ type: "summoned"; unitId: string; summonId: string; ownerHeroId: string; player?: number }`, `{ type: "summonActed"; unitId: string }`.
  - `players.ts`: `summonsOf(state): SummonState[]` (đặt ở đây để `players.ts` không phải import `summons.ts`).
  - `summons.ts`: `isSummon(unit: UnitState): unit is SummonState`, `ownerOf(state, summon): HeroState | undefined`, `summonOf(state, heroId): SummonState | undefined` (Linh Thú còn sống của Hero), `summonEffect(data, state, hero: HeroState, summonId: string, events): void`, `runSummonActions(data, state, seats: number[], events): void`.
  - `EffectContext` thêm `summonAction?: true` (đòn của Linh Thú là đòn tấn công).
  - `pickTarget(state, candidates: UnitState[], targeting: Targeting): string` được export từ `intent.ts`.

- [ ] **Step 1: Viết test thất bại** — tạo `packages/rules/test/phase7b-mechanics.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { CardDef, CombatState, GameData, LevelUpPassive, SummonDef } from "../src/index";
import { applyAction } from "../src/index";
import { idleIntent } from "./fixtures";
import { injectCard, makeEnemiesIdle, makeTestCombat, p0, setIntent, withLevelUp } from "./helpers";

const rabbit: SummonDef = {
  id: "test_rabbit", name: "Thỏ", maxHp: 12, targeting: "lowestHp",
  action: [{ type: "damage", amount: 3, to: "chosen" }], awakenedId: "test_rabbit_up",
};
const rabbitUp: SummonDef = { ...rabbit, id: "test_rabbit_up", maxHp: 24, action: [{ type: "damage", amount: 6, to: "chosen" }] };
delete (rabbitUp as { awakenedId?: string }).awakenedId;

const withRabbits = (d: GameData) => {
  d.summons[rabbit.id] = rabbit;
  d.summons[rabbitUp.id] = rabbitUp;
};

const card = (partial: Partial<CardDef>): CardDef => ({
  id: "test_c", name: "C", ownerId: "f04", cost: 0, copies: 1, type: "skill", tags: [], target: "none",
  effects: [{ type: "gainMoonPower", amount: 0 }], text: "", ...partial,
});
const summonCard = card({ id: "test_summon", effects: [{ type: "summon", summonId: "test_rabbit" }] });

function play(data: GameData, state: CombatState, def: CardDef, targetId?: string) {
  const instanceId = injectCard(state, data, def);
  const result = applyAction(data, state, { type: "playCard", instanceId, ...(targetId ? { targetId } : {}) });
  if (!result.ok) throw new Error(result.error);
  return result;
}

describe("phase 7b — Linh Thú: triệu hồi và hành động", () => {
  it("T280: summon creates one Linh Thú per hero; summoning again heals it and adds Sức Mạnh 1; summonsMade counts both", () => {
    const { data, state } = makeTestCombat({
      mutateData: (d) => { withRabbits(d); withLevelUp("f04", { counter: "summonsMade", threshold: 99 })(d); },
    });
    const first = play(data, state, summonCard);
    expect(first.state.summons).toHaveLength(1);
    expect(first.state.summons![0]).toMatchObject({
      id: "summon:f04", summonId: "test_rabbit", ownerHeroId: "hero:f04", side: "hero", player: 0,
      hp: 12, maxHp: 12, alive: true, position: 1,
    });
    expect(first.events).toContainEqual({ type: "summoned", unitId: "summon:f04", summonId: "test_rabbit", ownerHeroId: "hero:f04" });

    first.state.summons![0]!.hp = 5;
    const again = play(data, first.state, { ...summonCard, id: "test_summon2" });
    expect(again.state.summons).toHaveLength(1);
    expect(again.state.summons![0]!.hp).toBe(12);
    expect(again.state.summons![0]!.statuses).toContainEqual({ id: "strength", value: 1 });
    expect(again.state.heroes[1]!.levelUpCounter).toBe(2);
    expect(state.summons).toBeUndefined(); // the input state was not mutated
  });

  it("T281: at the end of the player turn each Linh Thú acts on its targeting before the enemy turn; strength and weak apply", () => {
    const { data, state } = makeTestCombat({
      mutateData: (d) => { withRabbits(d); makeEnemiesIdle(d); },
    });
    const summoned = play(data, state, summonCard);
    const s = summoned.state;
    s.enemies[0]!.hp = 20;
    s.enemies[1]!.hp = 10; // lowestHp picks enemy:1
    s.summons![0]!.statuses.push({ id: "strength", value: 2 });
    const ended = applyAction(data, s, { type: "endTurn" });
    if (!ended.ok) throw new Error(ended.error);
    const acted = ended.events.findIndex((e) => e.type === "summonActed");
    const enemyTurn = ended.events.findIndex((e) => e.type === "turnStarted" && e.side === "enemy");
    expect(acted).toBeGreaterThanOrEqual(0);
    expect(acted).toBeLessThan(enemyTurn);
    expect(ended.events).toContainEqual({ type: "damageDealt", sourceId: "summon:f04", targetId: "enemy:1", amount: 5, blocked: 0, hpLost: 5 });
  });
});
```
Thêm vào `packages/data/test/load-game-data.test.ts`, `rawData()` thêm `summons: summonsJson` (import `../summons.json`), và:
```ts
  it("T295a: summons cross-check — awakenedId exists, owner only in summon actions, summon target only on hero cards", () => {
    const bad = rawData();
    bad.summons = [{ id: "s_a", name: "A", maxHp: 5, targeting: "front", action: [{ type: "damage", amount: 1, to: "chosen" }], awakenedId: "s_missing" }];
    expect(() => parseGameData(bad)).toThrow(/summon "s_a": awakenedId references missing summon "s_missing"/);

    const ownerOnCard = rawData();
    ownerOnCard.cards[0].effects = [{ type: "heal", amount: 1, to: "owner" }];
    expect(() => parseGameData(ownerOnCard)).toThrow(/to "owner" is only allowed in summon actions/);

    const summonInAction = rawData();
    summonInAction.summons = [{ id: "s_b", name: "B", maxHp: 5, targeting: "front", action: [{ type: "summon", summonId: "s_b" }] }];
    expect(() => parseGameData(summonInAction)).toThrow(/summon "s_b": action must not use summon, chooseCard, createCard or to "summon"/);

    const unknown = rawData();
    unknown.cards[0].effects = [{ type: "summon", summonId: "s_nope" }];
    expect(() => parseGameData(unknown)).toThrow(/summon references missing summon "s_nope"/);
  });
```

- [ ] **Step 2: Chạy test để thấy thất bại**

Run: `pnpm --filter rules test -- phase7b-mechanics && pnpm --filter data test`
Expected: FAIL (`SummonDef` không tồn tại / `d.summons` undefined).

- [ ] **Step 3: Kiểu**

`types/static.ts`:
```ts
export type TargetRef = "self" | "chosen" | "allEnemies" | "allAllies" | "owner" | "summon";

/** Linh Thú (`01` §17): a summoned ally unit that acts at the end of its player's turn. */
export interface SummonDef {
  id: string;
  name: string;
  maxHp: number;
  /** Picks the enemy for `to: "chosen"` effects in `action`. */
  targeting: "lowestHp" | "front" | "random";
  action: Effect[];
  /** Used instead while the owner's passive is `awakenSummons`. */
  awakenedId?: string;
}
```
`Effect` thêm `| { type: "summon"; summonId: string }`. `LevelUpCounter` thêm `| "summonsMade"`. `LevelUpPassive` thêm:
```ts
  // Phase 7b (`18` §3.3).
  | { type: "awakenSummons" }                                // F09 Thỏ Ngọc Thức Tỉnh
  | { type: "summonTaunts"; rounds: number }                  // F09 Nguyệt Cung
```
`types/api.ts` `GameData` thêm `summons: Record<string, SummonDef>;` (import kiểu).
`types/state.ts`:
```ts
/** Linh Thú on the board (`01` §17). Shares the hero side; never counts for defeat. */
export interface SummonState extends UnitState {
  side: "hero";
  /** Seat owning the summoner. */
  player: number;
  /** Unit id of the summoning hero. */
  ownerHeroId: string;
  /** `SummonDef` id in use (switches to `awakenedId` when awakened). */
  summonId: string;
}
```
`CombatState` thêm `/** [GĐ7] Linh Thú; absent until the first summon. */ summons?: SummonState[];`.
`types/events.ts` `CombatEvent` thêm:
```ts
  /** [GĐ7] A Linh Thú entered the board (`01` §17). */
  | { type: "summoned"; unitId: string; summonId: string; ownerHeroId: string; player?: number }
  | { type: "summonActed"; unitId: string }
```

- [ ] **Step 4: Schema và nạp dữ liệu** — `packages/data/src/schema.ts`:
  - `targetRefSchema` thêm `"owner", "summon"`.
  - Effect: `z.object({ actor, type: z.literal("summon"), summonId: idSchema })`. `effectTypeSchema` thêm `"summon"`.
  - `levelUpCounterSchema` thêm `"summonsMade"`. Nội tại: `z.object({ type: z.literal("awakenSummons") })`, `z.object({ type: z.literal("summonTaunts"), rounds: z.number().int().positive() })`.
  - Thêm:
```ts
export const summonDefSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  maxHp: z.number().int().positive(),
  targeting: z.enum(["lowestHp", "front", "random"]),
  action: z.array(effectSchema).min(1),
  awakenedId: idSchema.optional(),
});
```
  - `rawGameDataSchema` thêm `summons: z.array(summonDefSchema)`.

  `load-game-data.ts`:
  - Import `summonsJson from "../summons.json"`, thêm vào `loadGameData`. `parseGameData` trả `summons: Object.fromEntries(summons.map((s) => [s.id, s]))`. Thêm `["summons", summons]` vào `groups`.
  - Kiểm chéo (cuối `collectCrossCheckErrors`, trước `return errors`):
```ts
  // Linh Thú (`02` §6): awakened ids exist, actions stay summon-scoped, summon ids resolve.
  const summonById = new Map(summons.map((summon) => [summon.id, summon]));
  const usesTo = (effects: Effect[], to: string) => someEffect(effects, (e) => "to" in e && e.to === to);
  for (const summon of summons) {
    const label = `summon "${summon.id}"`;
    if (summon.awakenedId !== undefined && !summonById.has(summon.awakenedId)) {
      errors.push(`${label}: awakenedId references missing summon "${summon.awakenedId}"`);
    }
    if (someEffect(summon.action, (e) => e.type === "summon" || e.type === "chooseCard" || e.type === "createCard") || usesTo(summon.action, "summon")) {
      errors.push(`${label}: action must not use summon, chooseCard, createCard or to "summon"`);
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
```
  Ở các chỗ đang cấm `createCard` (ý định kẻ địch, `onEnter` boss, hook Kỳ Vật / vũ khí / Nguyệt Bảo, Hợp Kích — các dòng báo `"createCard is not allowed"`), cấm thêm `summon` và `to "owner"` / `to "summon"` với thông báo `"summon is not allowed"` / `"to \"owner\" is only allowed in summon actions"` / `"to \"summon\" is only allowed on hero cards"`.
  - Tạo `packages/data/summons.json` với nội dung `[]`.
  - `checkCardShape` hiện coi `to: "chosen"` là "dùng mục tiêu". Không đổi. Linh Thú tự chọn mục tiêu nên không đi qua `checkCardShape`.

- [ ] **Step 5a: `players.ts`** — thêm (import kiểu `SummonState`):
```ts
/** Linh Thú on the board (`01` §17); empty until the first summon. */
export function summonsOf(state: CombatState): SummonState[] {
  return state.summons ?? [];
}
```

- [ ] **Step 5: `intent.ts`** — đổi `function pickTarget(state: CombatState, candidates: HeroState[], targeting: Targeting)` thành `export function pickTarget(state: CombatState, candidates: UnitState[], targeting: Targeting): string` (import `UnitState`). Thân hàm giữ nguyên.

- [ ] **Step 6: `summons.ts`** (mới):

```ts
import { resolveEffects } from "./effects";
import { pickTarget } from "./intent";
import { bumpCounter, levelUpPassive } from "./levelup";
import { opponentsOf, prefixedId, seatTag, summonsOf } from "./players";
import { applyStatus, hasStatus } from "./statuses";
import type { CombatEvent, CombatState, GameData, HeroState, SummonState, UnitState } from "./types/index";

export function isSummon(unit: UnitState): unit is SummonState {
  return "summonId" in unit;
}

export function ownerOf(state: CombatState, summon: SummonState): HeroState | undefined {
  return state.heroes.find((hero) => hero.id === summon.ownerHeroId);
}

/** The living Linh Thú of hero `heroId`, if any. */
export function summonOf(state: CombatState, heroId: string): SummonState | undefined {
  return summonsOf(state).find((summon) => summon.ownerHeroId === heroId && summon.alive);
}

/** The def a hero's Linh Thú uses: awakened while the owner's passive is `awakenSummons` (`01` §17). */
function summonDefIdFor(data: GameData, owner: HeroState, summonId: string): string {
  const awakened = data.summons[summonId]?.awakenedId;
  const passive = owner.alive && owner.leveledUp ? levelUpPassive(data, owner) : undefined;
  return awakened !== undefined && passive?.type === "awakenSummons" ? awakened : summonId;
}

/** Effect `summon` (`01` §17): create, or heal to full and add Sức Mạnh 1. */
export function summonEffect(data: GameData, state: CombatState, hero: HeroState, summonId: string, events: CombatEvent[]): void {
  bumpCounter(data, hero, "summonsMade", 1);
  let summon = summonOf(state, hero.id);
  if (summon) {
    const healed = summon.maxHp - summon.hp;
    if (healed > 0) {
      summon.hp = summon.maxHp;
      events.push({ type: "healed", targetId: summon.id, amount: healed });
    }
    applyStatus(summon, "strength", 1, hero.id, events);
  } else {
    const defId = summonDefIdFor(data, hero, summonId);
    const def = data.summons[defId]!;
    summon = {
      id: prefixedId(state, hero.player, `summon:${hero.defId}`),
      defId,
      summonId: defId,
      side: "hero",
      player: hero.player,
      ownerHeroId: hero.id,
      position: hero.position,
      hp: def.maxHp,
      maxHp: def.maxHp,
      armor: 0,
      statuses: [],
      alive: true,
    };
    // A dead summon of the same hero leaves the board for good.
    state.summons = [...summonsOf(state).filter((s) => s.ownerHeroId !== hero.id), summon];
    events.push({ type: "summoned", unitId: summon.id, summonId: defId, ownerHeroId: hero.id, ...seatTag(state, hero.player) });
  }
  const passive = hero.leveledUp ? levelUpPassive(data, hero) : undefined;
  if (passive?.type === "summonTaunts") {
    const factor = state.mode === "pvp" ? 2 : 1;
    applyStatus(summon, "taunt", passive.rounds * factor, hero.id, events);
  }
}

/** §3.3: each living Linh Thú of `seats` acts, in owner position order (`01` §17). */
export function runSummonActions(data: GameData, state: CombatState, seats: number[], events: CombatEvent[]): void {
  for (const seat of seats) {
    const acting = summonsOf(state)
      .filter((summon) => summon.player === seat)
      .sort((a, b) => a.position - b.position);
    for (const summon of acting) {
      if (!summon.alive) continue;
      const def = data.summons[summon.summonId]!;
      const candidates = opponentsOf(state, summon).filter((unit) => unit.alive && !hasStatus(unit, "stealth"));
      const chosenId = candidates.length > 0 ? pickTarget(state, candidates, def.targeting) : undefined;
      events.push({ type: "summonActed", unitId: summon.id });
      resolveEffects(data, state, def.action, { source: summon, summonAction: true, ...(chosenId ? { chosenId } : {}) }, events);
      if (state.status === "won" || state.status === "lost") return;
    }
  }
}
```

- [ ] **Step 7: `effects.ts`**
  - `EffectContext` thêm `/** A Linh Thú's action: its hits are attacks (`01` §17). */ summonAction?: true;`.
  - `isAttackSource`: thêm `ctx.summonAction === true ||`.
  - `findUnit`: `return [...state.heroes, ...summonsOf(state), ...state.enemies].find((unit) => unit.id === unitId);`.
  - `resolveTargets` thêm:
```ts
    case "owner": {
      const owner = isSummon(ctx.source) ? ownerOf(state, ctx.source) : undefined;
      return owner?.alive ? [owner] : [];
    }
    case "summon": {
      const summon = ctx.source.side === "hero" && !isSummon(ctx.source) ? summonOf(state, ctx.source.id) : undefined;
      return summon ? [summon] : [];
    }
```
  - Case `summon` trong `resolveEffect`:
```ts
    case "summon": {
      if (ctx.source.side !== "hero" || isSummon(ctx.source)) return;
      summonEffect(data, state, ctx.source as HeroState, effect.summonId, events);
      return;
    }
```
  - Import từ `./summons` (`isSummon`, `ownerOf`, `summonOf`, `summonEffect`) và `summonsOf` từ `./players`. Vòng import `effects.ts` ↔ `summons.ts` hợp lệ vì chỉ gọi hàm lúc chạy, giống `levelup.ts` ↔ `effects.ts` hiện có.
  - Các lệnh `bumpCounter(data, target as HeroState, …)` trên Linh Thú không làm gì, vì `data.heroes[summonId]` không tồn tại. Giữ nguyên.

- [ ] **Step 8: Gọi `runSummonActions`**
  - `turn.ts` `runEndTurn`: sau khối `endSeatTurn(...)` + `if (state.status === "won" || …) return;` thêm:
```ts
  runSummonActions(data, state, [player.index], events);
  if (state.status === "won" || state.status === "lost") return;
```
  - `pvp/turn.ts` `pvpEndTurn`: cùng hai dòng ngay sau `endSeatTurn(...)` và kiểm tra `won/lost`.
  - `coop/turn.ts` `coopEndTurn`: sau vòng `for (const other of state.players) { endSeatTurn(...) … }` thêm `runSummonActions(data, state, state.players.map((seat) => seat.index), events); if (state.status === "won" || state.status === "lost") return;`.
  - `index.ts`: `export { isSummon } from "./summons";` và thêm `summonsOf` vào dòng export đang có của `./players`;, `export type { SummonDef } …` (theo cách file đang export kiểu), `SummonState` tương tự.

- [ ] **Step 9: Client typecheck** — `apps/client/src/debug.ts` thêm `case "summoned": return "Triệu hồi Linh Thú";`, `case "summonActed": return "Linh Thú hành động";`. `event-animator.ts` rơi vào `default` (UI ở Task 9).

- [ ] **Step 10: Chạy test**

Run: `pnpm --filter rules test -- phase7b-mechanics && pnpm --filter data test`
Expected: PASS T280, T281, T295a.

Run: `pnpm test && pnpm typecheck`
Expected: PASS, gồm T213. `dataVersion` đổi vì có thêm khóa `summons`. Nếu có test so `dataVersion` với chuỗi cố định (`packages/data/test/data-version.test.ts`), cập nhật chuỗi đó và ghi rõ trong commit. Đây không phải T213.

- [ ] **Step 11: Commit**

```bash
git add packages apps/client/src/debug.ts
git commit -m "Step 7b.2: Linh Thú data, summon effect and end-of-turn actions"
```

---

### Task 3: Linh Thú — bị nhắm, vòng đời, thức tỉnh, PvP, co-op (bước 7b.2, phần 2)

**Files:**
- Modify: `packages/rules/src/players.ts`, `effects.ts`, `enemy-turn.ts`, `preview.ts`, `turn.ts`, `coop/turn.ts`, `queries.ts`, `levelup.ts`, `summons.ts`, `bot.ts`, `types/events.ts`, `apps/client/src/debug.ts`
- Test: `packages/rules/test/phase7b-mechanics.test.ts`

**Interfaces:**
- Consumes: Task 2 (`summonsOf`, `isSummon`, `summonOf`, `ownerOf`, `summonEffect`, `runSummonActions`).
- Produces:
  - Event `{ type: "summonDismissed"; unitId: string }`.
  - `dismissSummonOf(state, heroId, events): void` và `awakenSummon(data, state, hero, events): void` (export từ `summons.ts`).
  - `alliesOf(hero)` = Hero cùng người chơi + Linh Thú của người đó; `opponentsOf(enemy)` = mọi Hero + mọi Linh Thú; `opponentsOf(hero)` trong PvP = Hero + Linh Thú của người kia.

- [ ] **Step 1: Viết test thất bại** — thêm vào `phase7b-mechanics.test.ts` (import thêm `createCoopCombat, createPvpCombat, previewEnemyIntent, viewFor` từ `../src/index`, `testData` từ `./helpers`):

```ts
const strike6 = { id: "t_strike6", name: "Đánh", kind: "attack" as const, targeting: "lowestHp" as const, effects: [{ type: "damage" as const, amount: 6, to: "chosen" as const }] };
const sweep4 = { id: "t_sweep4", name: "Quét", kind: "attack" as const, effects: [{ type: "damage" as const, amount: 4, to: "allEnemies" as const }] };

describe("phase 7b — Linh Thú: bị nhắm và vòng đời", () => {
  const summoned = () => {
    const t = makeTestCombat({ mutateData: withRabbits });
    const r = play(t.data, t.state, summonCard);
    return { data: t.data, state: r.state };
  };

  it("T282: single-target intents skip a Linh Thú unless it taunts (heroes first); area intents hit it; planning never picks it", () => {
    const { data, state } = summoned();
    state.summons![0]!.hp = 1; // lowest HP on the board, still not picked
    setIntent(state, 0, strike6, "hero:m05");
    setIntent(state, 1, sweep4, null);
    const plain = applyAction(data, state, { type: "endTurn" });
    if (!plain.ok) throw new Error(plain.error);
    expect(plain.events).not.toContainEqual(expect.objectContaining({ type: "intentExecuted", targetId: "summon:f04" }));
    expect(plain.events).toContainEqual(expect.objectContaining({ type: "damageDealt", sourceId: "enemy:1", targetId: "summon:f04" }));

    const taunting = structuredClone(state);
    taunting.summons![0]!.hp = 12;
    taunting.summons![0]!.statuses.push({ id: "taunt", value: 1 });
    expect(previewEnemyIntent(data, taunting, taunting.enemies[0]!)!.intents[0]!.targetId).toBe("summon:f04");
    const soaked = applyAction(data, taunting, { type: "endTurn" });
    if (!soaked.ok) throw new Error(soaked.error);
    expect(soaked.events).toContainEqual(expect.objectContaining({ type: "intentExecuted", intentId: "t_strike6", targetId: "summon:f04" }));

    const heroTaunts = structuredClone(taunting);
    heroTaunts.heroes[2]!.statuses.push({ id: "taunt", value: 1 });
    const heroFirst = applyAction(data, heroTaunts, { type: "endTurn" });
    if (!heroFirst.ok) throw new Error(heroFirst.error);
    expect(heroFirst.events).toContainEqual(expect.objectContaining({ type: "intentExecuted", intentId: "t_strike6", targetId: "hero:m06" }));
  });

  it("T283: a Linh Thú dies and leaves; its owner's death dismisses it; summons never decide defeat; ally cards can target it", () => {
    const { data, state } = summoned();
    const healCard = card({ id: "test_heal", ownerId: "m05", target: "ally", effects: [{ type: "heal", amount: 2, to: "chosen" }] });
    state.summons![0]!.hp = 5;
    const healId = injectCard(state, data, healCard);
    expect(getValidTargets(data, state, healId)).toContain("summon:f04");

    const killed = structuredClone(state);
    killed.summons![0]!.hp = 1;
    setIntent(killed, 0, idleIntent, null);
    setIntent(killed, 1, sweep4, null);
    const r1 = applyAction(data, killed, { type: "endTurn" });
    if (!r1.ok) throw new Error(r1.error);
    expect(r1.events).toContainEqual({ type: "unitDied", unitId: "summon:f04", killerId: "enemy:1" });
    expect(r1.state.summons).toEqual([]);

    const ownerDies = structuredClone(state);
    ownerDies.heroes[1]!.hp = 1;
    setIntent(ownerDies, 0, { ...strike6, targeting: "front" }, "hero:f04");
    ownerDies.heroes[0]!.statuses.push({ id: "stealth", value: 1 });
    setIntent(ownerDies, 1, idleIntent, null);
    const r2 = applyAction(data, ownerDies, { type: "endTurn" });
    if (!r2.ok) throw new Error(r2.error);
    expect(r2.events).toContainEqual({ type: "summonDismissed", unitId: "summon:f04" });
    expect(r2.state.summons).toEqual([]);

    const allHeroesDown = structuredClone(state);
    for (const hero of allHeroesDown.heroes) { hero.hp = 1; }
    setIntent(allHeroesDown, 0, idleIntent, null);
    setIntent(allHeroesDown, 1, sweep4, null);
    const r3 = applyAction(data, allHeroesDown, { type: "endTurn" });
    if (!r3.ok) throw new Error(r3.error);
    expect(r3.state.status).toBe("lost");
  });

  it("T284: awakenSummons swaps the Linh Thú to its awakened def on level-up (keeping the HP ratio); summonTaunts gives Khiêu Khích", () => {
    const t = makeTestCombat({
      mutateData: (d) => { withRabbits(d); withLevelUp("f04", { counter: "summonsMade", threshold: 2, passive: { type: "awakenSummons" } })(d); },
    });
    const first = play(t.data, t.state, summonCard);
    first.state.summons![0]!.hp = 6; // half
    const second = play(t.data, first.state, { ...summonCard, id: "test_summon2" });
    // the refresh heals to 12 first, then the level-up awakens at a full ratio
    expect(second.state.heroes[1]!.leveledUp).toBe(true);
    expect(second.state.summons![0]).toMatchObject({ summonId: "test_rabbit_up", maxHp: 24, hp: 24 });

    const taunt = makeTestCombat({
      mutateData: (d) => { withRabbits(d); withLevelUp("f04", { passive: { type: "summonTaunts", rounds: 1 } })(d); },
      setup: (s) => { s.heroes[1]!.leveledUp = true; },
    });
    const tauntSummon = play(taunt.data, taunt.state, summonCard);
    expect(tauntSummon.state.summons![0]!.statuses).toContainEqual({ id: "taunt", value: 1 });
  });

  it("T285: PvP — an opposing Linh Thú is a valid single target and its taunt forces picks; viewFor shows both sides' summons", () => {
    const data = testData();
    withRabbits(data);
    const loadout = { heroes: {}, pvp: true as const };
    let state = createPvpCombat(data, { seed: 7, players: [{ heroIds: ["m05", "f04", "m06"], loadout }, { heroIds: ["m05", "f04", "m06"], loadout }] }).state;
    for (const seat of [0, 1]) {
      const r = applyAction(data, state, { type: "mulligan", instanceIds: [], player: seat });
      if (!r.ok) throw new Error(r.error);
      state = r.state;
    }
    const attacker = state.activePlayer;
    const defender = 1 - attacker;
    const defF04 = state.heroes.find((h) => h.player === defender && h.defId === "f04")!;
    summonEffect(data, state, defF04, "test_rabbit", []);
    const summonId = `p${defender}_summon:f04`;
    const poke = injectCard(state, data, card({ id: "test_poke", ownerId: "m06", type: "attack", tags: ["attack"], target: "enemy", effects: [{ type: "damage", amount: 3, to: "chosen" }] }));
    state.players[0]!.hand = state.players[0]!.hand.filter((id) => id !== poke);
    state.cards[poke]!.player = attacker;
    state.players[attacker]!.hand.push(poke);
    expect(getValidTargets(data, state, poke)).toContain(summonId);
    state.summons![0]!.statuses.push({ id: "taunt", value: 2 });
    expect(getValidTargets(data, state, poke)).toEqual([summonId]);
    expect(viewFor(state, attacker).summons!.map((s) => s.id)).toEqual([summonId]);
  });

  it("T286: co-op — both seats' Linh Thú act after both seats are done, seat 0 first", () => {
    const data = testData();
    withRabbits(data);
    makeEnemiesIdle(data);
    const side = { heroIds: ["m05", "f04", "m06"] as [string, string, string], loadout: { heroes: {} } };
    let state = createCoopCombat(data, { seed: 7, players: [side, side], encounterId: "enc_coop_01" }).state;
    for (const seat of [0, 1]) {
      const r = applyAction(data, state, { type: "mulligan", instanceIds: [], player: seat });
      if (!r.ok) throw new Error(r.error);
      state = r.state;
    }
    for (const hero of state.heroes.filter((h) => h.defId === "f04")) summonEffect(data, state, hero, "test_rabbit", []);
    const first = applyAction(data, state, { type: "endTurn", player: 0 });
    if (!first.ok) throw new Error(first.error);
    expect(first.events.some((e) => e.type === "summonActed")).toBe(false);
    const second = applyAction(data, first.state, { type: "endTurn", player: 1 });
    if (!second.ok) throw new Error(second.error);
    const acted = second.events.filter((e) => e.type === "summonActed").map((e) => (e as { unitId: string }).unitId);
    expect(acted).toEqual(["p0_summon:f04", "p1_summon:f04"]);
  });
});
```
Import thêm `getValidTargets`, `summonEffect`, `viewFor` từ `../src/index`. Nếu `summonEffect`/`viewFor` chưa export, export chúng ở Step 9. `makeEnemiesIdle` sửa mọi kẻ địch, gồm cả boss co-op.

- [ ] **Step 2: Chạy test để thấy thất bại**

Run: `pnpm --filter rules test -- phase7b-mechanics`
Expected: FAIL T282–T286.

- [ ] **Step 3: `players.ts`** (`summonsOf` đã ở cùng file từ Task 2)
```ts
export function alliesOf(state: CombatState, unit: UnitState): UnitState[] {
  if (unit.side === "enemy") return state.enemies;
  const seat = (unit as HeroState).player;
  return [...heroesOf(state, seat), ...summonsOf(state).filter((summon) => summon.player === seat)];
}

export function opponentsOf(state: CombatState, unit: UnitState): UnitState[] {
  if (unit.side === "enemy") return [...state.heroes, ...summonsOf(state)];
  if (state.mode === "pvp") {
    const seat = (unit as HeroState).player;
    return [...state.heroes, ...summonsOf(state)].filter((u) => (u as HeroState).player !== seat);
  }
  return state.enemies;
}
```
(`SummonState` có `player`, nên ép kiểu `(u as HeroState).player` vẫn đọc đúng.) Chỗ duy nhất dùng `alliesOf` khác `resolveTargets` là nhánh lan Hồi Phục của nội tại `regenSpreadsToAllAllies`. Lan sang Linh Thú là đúng ý "cả đội".

- [ ] **Step 4: Mục tiêu kẻ địch** — `enemy-turn.ts` `reresolveTarget`:
```ts
  const taunter =
    state.heroes.find((hero) => hero.alive && hasStatus(hero, "taunt")) ??
    summonsOf(state)
      .filter((summon) => summon.alive && hasStatus(summon, "taunt"))
      .sort((a, b) => a.player - b.player || a.position - b.position)[0];
  if (taunter) return taunter.id;
```
(`chooseHeroTarget` giữ nguyên: lên chuỗi không chọn Linh Thú.)
`preview.ts`: nhánh `effect.to === "allEnemies"` đổi thành `targets = [...state.heroes, ...summonsOf(state)].filter((unit) => unit.alive);` và tìm `chosen` bằng `[...state.heroes, ...summonsOf(state), ...state.enemies]`.

- [ ] **Step 5: Vòng đời** — `summons.ts` thêm:
```ts
/** Hero `heroId` fell: its Linh Thú leaves with it (`01` §17). */
export function dismissSummonOf(state: CombatState, heroId: string, events: CombatEvent[]): void {
  const summon = summonOf(state, heroId);
  if (!summon) return;
  summon.alive = false;
  summon.hp = 0;
  state.summons = summonsOf(state).filter((s) => s !== summon);
  events.push({ type: "summonDismissed", unitId: summon.id });
}

/** `awakenSummons`: the owner's living Linh Thú switches to its awakened def, keeping its HP ratio. */
export function awakenSummon(data: GameData, state: CombatState, hero: HeroState, events: CombatEvent[]): void {
  const summon = summonOf(state, hero.id);
  const awakened = summon ? data.summons[summon.summonId]?.awakenedId : undefined;
  if (!summon || awakened === undefined) return;
  const def = data.summons[awakened]!;
  const ratio = summon.hp / summon.maxHp;
  summon.summonId = awakened;
  summon.defId = awakened;
  summon.maxHp = def.maxHp;
  summon.hp = Math.max(1, Math.floor(ratio * def.maxHp));
  events.push({ type: "summoned", unitId: summon.id, summonId: awakened, ownerHeroId: hero.id, ...seatTag(state, hero.player) });
}
```
`effects.ts`:
  - `processDeaths`: `for (const unit of [...state.heroes, ...summonsOf(state), ...state.enemies])`.
  - `killUnit`: sau `events.push({ type: "unitDied", … })`:
```ts
  if (isSummon(unit)) {
    state.summons = summonsOf(state).filter((summon) => summon !== unit);
    return;
  }
```
    Đặt khối này **trước** khối `if (killer)` (Linh Thú không tính `enemiesKilled`, `01` §17). Trong nhánh `if (unit.side === "hero")` thêm `dismissSummonOf(state, unit.id, events);` ở đầu nhánh.
  - `levelup.ts` `checkLevelUps`: sau `events.push({ type: "heroLeveledUp", … })` thêm `if (levelUpPassive(data, hero)?.type === "awakenSummons") awakenSummon(data, state, hero, events);` (import từ `./summons`).
  - `turn.ts` `tickDurations`: `for (const unit of [...state.heroes, ...summonsOf(state), ...state.enemies])`.
  - `turn.ts` `startPlayerTurn` và `coop/turn.ts` `startCoopTurn`: trong vòng xóa giáp / gỡ Phản Đòn, và trong vòng `tickUnitStatuses`, thêm Linh Thú của người chơi đó. Ví dụ ở `startPlayerTurn`:
```ts
  const mySummons = summonsOf(state).filter((summon) => summon.player === player.index);
  for (const unit of [...heroesOf(state, player.index), ...mySummons]) { /* armor + reflect as before */ }
  …
  for (const unit of [...heroesOf(state, player.index), ...mySummons]) {
    if (!unit.alive) continue;
    const start = events.length;
    tickUnitStatuses(data, state, unit, events);
    …
  }
```
    Vòng bộ đếm / cờ lượt (`heroTurnStart`) giữ nguyên, chỉ chạy cho Hero. Co-op dùng `summonsOf(state)` (mọi người chơi) ở các vòng đang duyệt `state.heroes`.
  - `types/events.ts` thêm `| { type: "summonDismissed"; unitId: string }`. `debug.ts` thêm `case "summonDismissed": return "Linh Thú biến mất";`.
- [ ] **Step 6: Mục tiêu người chơi** — `queries.ts` `getValidTargets` nhánh `ally`: `const allies = state.mode === "coop" ? [...state.heroes, ...summonsOf(state)] : alliesOf(state, source);`. Nhánh `enemy` đã dùng `opponentsOf` nên PvP tự có Linh Thú. Bộ lọc Khiêu Khích PvP giữ nguyên.
- [ ] **Step 7: Bot** — `bot.ts` `unitOf`: `state.heroes.find(…) ?? summonsOf(state).find((s) => s.id === id) ?? state.enemies.find(…)`.
- [ ] **Step 8: `viewFor` / `coopViewFor`** — không cần sửa (`cloneState` giữ `summons`, thông tin công khai). T285 kiểm điều này.
- [ ] **Step 9: Export** — `index.ts` export `summonEffect`, `viewFor` (nếu chưa có), `dismissSummonOf`.
- [ ] **Step 10: Chạy test**

Run: `pnpm --filter rules test -- phase7b-mechanics`
Expected: PASS T280–T286.

Run: `pnpm test && pnpm typecheck`
Expected: PASS, gồm T213. Chưa có trận cũ nào có Linh Thú nên mọi vòng lặp mới là rỗng.

- [ ] **Step 11: Commit**

```bash
git add packages apps/client/src/debug.ts
git commit -m "Step 7b.2: Linh Thú targeting, lifecycle, awakening, PvP and co-op"
```

---

### Task 4: Mê Hoặc (`charm`) và bộ debuff của M09 (bước 7b.3, phần 1)

**Files:**
- Modify: `packages/rules/src/types/static.ts`, `packages/data/src/schema.ts`, `packages/rules/src/statuses.ts`, `enemy-turn.ts`, `preview.ts`, `effects.ts`, `apply-action.ts`
- Test: `packages/rules/test/phase7b-mechanics.test.ts`

**Interfaces:**
- Produces:
  - `StatusId` thêm `"charm"` (debuff, không có thời hạn, có `sourceId`).
  - `Effect` thêm `{ type: "extendDebuffs"; amount: number; to: TargetRef }`.
  - `LevelUpCounter` thêm `"charmsApplied" | "debuffsApplied"`.
  - `LevelUpPassive` thêm `{ type: "charmMastery"; extraCharges: number; damageMultiplier: number }`, `{ type: "stealthOnCharm"; rounds: number }`, `{ type: "debuffDurationBonus"; amount: number }`, `{ type: "bonusVsDebuffed"; minDebuffs: number; amount: number }`.
  - `charmTargetOf(state: CombatState, enemy: EnemyState): EnemyState | undefined` (export từ `enemy-turn.ts`).
  - `EffectContext.damageMultiplier?: number`.

- [ ] **Step 1: Viết test thất bại**

```ts
describe("phase 7b — Mê Hoặc", () => {
  it("T287: a charmed enemy's single-target intent hits another living enemy (highest HP), consuming one charge; alone it fizzles; the preview shows the redirect", () => {
    const { data, state } = makeTestCombat({
      setup: (s) => {
        s.enemies[0]!.statuses.push({ id: "charm", value: 1, sourceId: "hero:f04" });
        setIntent(s, 0, strike6, "hero:m05");
        setIntent(s, 1, idleIntent, null);
      },
    });
    expect(previewEnemyIntent(data, state, state.enemies[0]!)!.intents[0]!.targetId).toBe("enemy:1");
    const r = applyAction(data, state, { type: "endTurn" });
    if (!r.ok) throw new Error(r.error);
    expect(r.events).toContainEqual(expect.objectContaining({ type: "intentExecuted", intentId: "t_strike6", targetId: "enemy:1" }));
    expect(r.events).toContainEqual(expect.objectContaining({ type: "damageDealt", sourceId: "enemy:0", targetId: "enemy:1", amount: 6 }));
    expect(r.state.enemies[0]!.statuses.some((st) => st.id === "charm")).toBe(false);

    const alone = structuredClone(state);
    alone.enemies[1]!.alive = false;
    alone.enemies[1]!.hp = 0;
    const r2 = applyAction(data, alone, { type: "endTurn" });
    if (!r2.ok) throw new Error(r2.error);
    expect(r2.events).toContainEqual({ type: "intentFizzled", enemyId: "enemy:0", intentId: "t_strike6" });
    expect(r2.state.enemies[0]!.statuses.some((st) => st.id === "charm")).toBe(false);
  });

  it("T288: charmsApplied counts; charmMastery adds a charge and ×1.5; stealthOnCharm hides the charmer; PvP charm turns the first attack onto an ally", () => {
    const charmCard = card({ id: "test_charm", ownerId: "f04", target: "enemy", effects: [{ type: "applyStatus", status: "charm", amount: 1, to: "chosen" }] });
    const counting = makeTestCombat({ mutateData: withLevelUp("f04", { counter: "charmsApplied", threshold: 99 }) });
    expect(play(counting.data, counting.state, charmCard, "enemy:0").state.heroes[1]!.levelUpCounter).toBe(1);

    const mastery = makeTestCombat({
      mutateData: withLevelUp("f04", { passive: { type: "charmMastery", extraCharges: 1, damageMultiplier: 1.5 } }),
      setup: (s) => { s.heroes[1]!.leveledUp = true; setIntent(s, 0, strike6, "hero:m05"); setIntent(s, 1, idleIntent, null); },
    });
    const charmed = play(mastery.data, mastery.state, charmCard, "enemy:0");
    expect(charmed.state.enemies[0]!.statuses).toContainEqual({ id: "charm", value: 2, sourceId: "hero:f04" });
    const hit = applyAction(mastery.data, charmed.state, { type: "endTurn" });
    if (!hit.ok) throw new Error(hit.error);
    expect(hit.events).toContainEqual(expect.objectContaining({ type: "damageDealt", sourceId: "enemy:0", targetId: "enemy:1", amount: 9 }));

    const vuY = makeTestCombat({
      mutateData: withLevelUp("f04", { passive: { type: "stealthOnCharm", rounds: 1 } }),
      setup: (s) => { s.heroes[1]!.leveledUp = true; },
    });
    expect(play(vuY.data, vuY.state, charmCard, "enemy:0").state.heroes[1]!.statuses).toContainEqual({ id: "stealth", value: 1 });

    // PvP
    const data = testData();
    const loadout = { heroes: {}, pvp: true as const };
    let pvp = createPvpCombat(data, { seed: 7, players: [{ heroIds: ["m05", "f04", "m06"], loadout }, { heroIds: ["m05", "f04", "m06"], loadout }] }).state;
    for (const seat of [0, 1]) {
      const r = applyAction(data, pvp, { type: "mulligan", instanceIds: [], player: seat });
      if (!r.ok) throw new Error(r.error);
      pvp = r.state;
    }
    const me = pvp.activePlayer;
    const myM06 = pvp.heroes.find((h) => h.player === me && h.defId === "m06")!;
    myM06.statuses.push({ id: "charm", value: 1, sourceId: "x" });
    const myM05 = pvp.heroes.find((h) => h.player === me && h.defId === "m05")!; // HP 52 in PvP: highest ally
    const foe = pvp.heroes.find((h) => h.player !== me)!;
    const strike = injectCard(pvp, data, card({ id: "test_pvp_strike", ownerId: "m06", type: "attack", tags: ["attack"], target: "enemy", effects: [{ type: "damage", amount: 4, to: "chosen" }] }));
    pvp.players[0]!.hand = pvp.players[0]!.hand.filter((id) => id !== strike);
    pvp.cards[strike]!.player = me;
    pvp.players[me]!.hand.push(strike);
    const turned = applyAction(data, pvp, { type: "playCard", instanceId: strike, targetId: foe.id, player: me });
    if (!turned.ok) throw new Error(turned.error);
    expect(turned.events).toContainEqual(expect.objectContaining({ type: "damageDealt", sourceId: myM06.id, targetId: myM05.id }));
    expect(turned.state.heroes.find((h) => h.id === myM06.id)!.statuses.some((st) => st.id === "charm")).toBe(false);
  });

  it("T294: debuffsApplied counts debuffs from the hero; debuffDurationBonus lengthens them; bonusVsDebuffed adds damage; extendDebuffs lengthens existing debuffs", () => {
    const weakCard = card({ id: "test_weak", ownerId: "f04", target: "enemy", effects: [{ type: "applyStatus", status: "weak", amount: 1, to: "chosen" }] });
    const counting = makeTestCombat({ mutateData: withLevelUp("f04", { counter: "debuffsApplied", threshold: 99 }) });
    expect(play(counting.data, counting.state, weakCard, "enemy:0").state.heroes[1]!.levelUpCounter).toBe(1);

    const longer = makeTestCombat({ mutateData: withLevelUp("f04", { passive: { type: "debuffDurationBonus", amount: 1 } }), setup: (s) => { s.heroes[1]!.leveledUp = true; } });
    expect(play(longer.data, longer.state, weakCard, "enemy:0").state.enemies[0]!.statuses).toContainEqual({ id: "weak", value: 2 });

    const bonus = makeTestCombat({
      mutateData: withLevelUp("f04", { passive: { type: "bonusVsDebuffed", minDebuffs: 2, amount: 3 } }),
      setup: (s) => { s.heroes[1]!.leveledUp = true; s.enemies[0]!.statuses.push({ id: "weak", value: 1 }, { id: "mark", value: 1, sourceId: "x" }); },
    });
    const hit = play(bonus.data, bonus.state, card({ id: "test_hit", ownerId: "f04", type: "attack", tags: ["attack"], target: "enemy", effects: [{ type: "damage", amount: 5, to: "chosen" }] }), "enemy:0");
    expect(hit.events.find((e) => e.type === "damageDealt")).toMatchObject({ amount: 8 });

    const extend = makeTestCombat({ setup: (s) => { s.enemies[0]!.statuses.push({ id: "weak", value: 1 }, { id: "burn", value: 3 }); } });
    const ext = play(extend.data, extend.state, card({ id: "test_ext", ownerId: "f04", target: "enemy", effects: [{ type: "extendDebuffs", amount: 1, to: "chosen" }] }), "enemy:0");
    expect(ext.state.enemies[0]!.statuses).toEqual([{ id: "weak", value: 2 }, { id: "burn", value: 3 }]);
  });
});
```
T288 PvP: `m05` có HP PvP cao nhất (`pvp-config.heroStats`). Nếu số liệu sau 7a đổi thứ tự thì chọn đồng đội HP cao nhất bằng `Math.max` trong test thay vì gán cứng.

- [ ] **Step 2: Chạy test để thấy thất bại**

Run: `pnpm --filter rules test -- phase7b-mechanics`
Expected: FAIL T287, T288, T294.

- [ ] **Step 3: Kiểu và schema** — thêm các dạng ở Interfaces vào `static.ts` và zod (`statusIdSchema` thêm `"charm"`; effect `z.object({ actor, type: z.literal("extendDebuffs"), amount: z.number().int().positive(), to: targetRefSchema })`; `effectTypeSchema` thêm `"extendDebuffs"`; bộ đếm; nội tại với `z.number().int().positive()` cho số nguyên và `z.number().gt(1)` cho `damageMultiplier`).
- [ ] **Step 4: `statuses.ts`** — `DEBUFF_STATUSES` thêm `"charm"`. `applyStatus` giữ `sourceId` cho `charm` giống `mark`: điều kiện `status === "mark" || status === "charm"` ở cả nhánh cộng dồn và nhánh tạo mới. Nhánh `guard` giữ nguyên.
- [ ] **Step 5: `effects.ts`**
  - `EffectContext` thêm `/** Kinh Hồng Vũ: a charmed intent's damage multiplier (`01` §9.3.1). */ damageMultiplier?: number;`. `computeDamageAmount`: `multiplier *= ctx.damageMultiplier ?? 1;` ngay sau `let multiplier = 1;`.
  - `computeDamageAmount` trong khối `if (ctx.card !== undefined)` của đòn tấn công: `if (passive?.type === "bonusVsDebuffed" && target.statuses.filter((st) => DEBUFF_STATUSES.has(st.id)).length >= passive.minDebuffs) flat += passive.amount;`.
  - Case `applyStatus`, trước vòng `for (const target of targets)`:
```ts
      const passive = cardPassive(data, ctx);
      const debuff = DEBUFF_STATUSES.has(effect.status);
      let amount = (effect.amount + bonus) * durationFactor;
      if (passive?.type === "debuffDurationBonus" && debuff && DURATION_STATUSES.has(effect.status)) amount += passive.amount * durationFactor;
      if (passive?.type === "charmMastery" && effect.status === "charm") amount += passive.extraCharges;
```
    và thay `(effect.amount + bonus) * durationFactor` trong `applyStatus(...)` bằng `amount`. Trong vòng, sau `applyStatus(...)`:
```ts
        if (debuff && ctx.source.side === "hero" && target.side !== ctx.source.side) {
          bumpCounter(data, ctx.source as HeroState, "debuffsApplied", 1);
        }
        if (effect.status === "charm" && ctx.source.side === "hero") {
          bumpCounter(data, ctx.source as HeroState, "charmsApplied", 1);
          if (passive?.type === "stealthOnCharm") applyStatus(ctx.source, "stealth", passive.rounds * durationFactor, ctx.source.id, events);
        }
```
    Trong PvP, `target.side` của Hero đối thủ cũng là `"hero"`. Điều kiện "gây lên đối phương" viết lại thành `opponentsOf(state, ctx.source).includes(target)`.
  - Case mới:
```ts
    case "extendDebuffs": {
      const factor = state.mode === "pvp" ? 2 : 1;
      for (const target of resolveTargets(state, effect.to, ctx)) {
        for (const entry of target.statuses) {
          if (DEBUFF_STATUSES.has(entry.id) && DURATION_STATUSES.has(entry.id)) {
            entry.value += effect.amount * factor;
            events.push({ type: "statusApplied", targetId: target.id, status: entry.id, value: entry.value });
          }
        }
      }
      return;
    }
```
- [ ] **Step 6: Kẻ địch bị Mê Hoặc** — `enemy-turn.ts`:
```ts
/** Mê Hoặc: the other living enemy a charmed enemy strikes instead — highest HP, lower position on ties. */
export function charmTargetOf(state: CombatState, enemy: EnemyState): EnemyState | undefined {
  return state.enemies
    .filter((other) => other !== enemy && other.alive)
    .reduce<EnemyState | undefined>((best, other) => (best === undefined || other.hp > best.hp ? other : best), undefined);
}
```
Trong `runEnemyTurn`, ở vòng `for (const planned of enemy.plannedIntents)`, thay khối `if (intent.targeting !== undefined) { … }` bằng:
```ts
      let damageMultiplier: number | undefined;
      if (intent.targeting !== undefined) {
        const charm = getStatus(enemy, "charm");
        if (charm) {
          charm.value -= 1;
          if (charm.value <= 0) removeStatus(enemy, "charm", events);
          const turned = charmTargetOf(state, enemy);
          if (!turned) {
            events.push({ type: "intentFizzled", enemyId: enemy.id, intentId: intent.id });
            continue;
          }
          targetId = turned.id;
          const charmer = state.heroes.find((hero) => hero.id === charm.sourceId);
          const mastery = charmer ? passiveOf(data, charmer) : undefined;
          if (mastery?.type === "charmMastery") damageMultiplier = mastery.damageMultiplier;
        } else {
          targetId = reresolveTarget(state, planned.targetId, intent.targeting);
          if (targetId === null) {
            events.push({ type: "intentFizzled", enemyId: enemy.id, intentId: intent.id });
            continue;
          }
          const guardian = guardianOf(state, targetId);
          if (guardian) {
            targetId = guardian.id;
            interceptHit(data, guardian, events);
            checkLevelUps(data, state, events);
          }
        }
      }
```
và thêm `...(damageMultiplier !== undefined ? { damageMultiplier } : {})` vào context `resolveEffects`. Import `passiveOf` từ `./turn-passives`, kiểu `EnemyState`. Đòn trúng đồng minh dùng `resolveTargets("chosen")` và `findUnit`, nên kẻ địch tìm được kẻ địch.
`preview.ts`: trước `targetId = reresolveTarget(...)` thêm nhánh `if (hasStatus(enemy, "charm")) { targetId = charmTargetOf(state, enemy)?.id ?? null; } else { …như cũ… }`.
- [ ] **Step 7: PvP Mê Hoặc** — `apply-action.ts` `playCard`, ngay trước khối Hộ Vệ PvP:
```ts
  // Fair Arena Mê Hoặc: the charmed owner's first single-target attack hits its own highest-HP ally (`01` §15.5).
  if (state.mode === "pvp" && card.type === "attack" && card.target === "enemy" && !card.bond) {
    const charm = getStatus(owner, "charm");
    if (charm) {
      const allies = heroesOf(state, player.index).filter((hero) => hero.alive && hero !== owner);
      const victim = allies.reduce<HeroState | undefined>((best, hero) => (best === undefined || hero.hp > best.hp ? hero : best), undefined) ?? owner;
      chosenIdOverride = victim.id;
      charm.value -= 1;
      if (charm.value <= 0) removeStatus(owner, "charm", events);
    }
  }
```
  Khai báo `let chosenIdOverride: string | undefined;` trước khối. Khối Hộ Vệ dùng `let chosenId = chosenIdOverride ?? action.targetId;` và **bỏ qua** chuyển Hộ Vệ khi `chosenIdOverride !== undefined` (đòn đã đánh vào phe mình). Import `getStatus`.
- [ ] **Step 8: Chạy test**

Run: `pnpm --filter rules test -- phase7b-mechanics`
Expected: PASS T280–T288, T294.

Run: `pnpm test && pnpm typecheck`
Expected: PASS, gồm T213. `debuffsApplied` và `charmsApplied` chỉ tăng với Hero có đúng bộ đếm. Nhánh `damageMultiplier` mặc định là 1.

- [ ] **Step 9: Commit**

```bash
git add packages
git commit -m "Step 7b.3: charm, debuff counters and M09 passives"
```

---

### Task 5: Phong Ấn (`sealIntent`) (bước 7b.3, phần 2)

**Files:**
- Modify: `packages/rules/src/types/static.ts`, `types/state.ts`, `packages/data/src/schema.ts`, `packages/rules/src/effects.ts`, `enemy-turn.ts`, `turn.ts`, `turn-passives.ts`, `queries.ts`
- Test: `packages/rules/test/phase7b-mechanics.test.ts`

**Interfaces:**
- Produces:
  - `Effect` thêm `{ type: "sealIntent"; to: TargetRef }`.
  - `LevelUpCounter` thêm `"intentsSealed"`. `LevelUpPassive` thêm `{ type: "sealExtraFirstPerTurn" }`, `{ type: "sealWeakens"; amount: number }`.
  - `EnemyState.sealedIntentIds?: string[]`, `HeroState.firstSealUsedThisTurn?: boolean`, `CardInstance.sealSurcharge?: number`.

- [ ] **Step 1: Viết test thất bại**

```ts
describe("phase 7b — Phong Ấn", () => {
  const sealCard = card({ id: "test_seal", ownerId: "f04", target: "enemy", effects: [{ type: "sealIntent", to: "chosen" }] });
  const cheap = { id: "t_cheap", name: "Rẻ", kind: "attack" as const, targeting: "front" as const, effects: [{ type: "damage" as const, amount: 1, to: "chosen" as const }] };
  const dear = { ...cheap, id: "t_dear", name: "Đắt", effects: [{ type: "damage" as const, amount: 9, to: "chosen" as const }] };

  const withPlan = (s: CombatState) => {
    s.enemies[0]!.plannedIntents = [
      { intent: cheap, cost: 1, targetId: "hero:m05" },
      { intent: dear, cost: 3, targetId: "hero:m05" },
    ];
    setIntent(s, 1, idleIntent, null);
  };

  it("T289: sealIntent cancels the priciest planned intent, it cannot lead next round; the first seal each turn cancels one more with sealExtraFirstPerTurn; sealWeakens applies weak; intentsSealed counts", () => {
    const t = makeTestCombat({ mutateData: withLevelUp("f04", { counter: "intentsSealed", threshold: 99 }), setup: withPlan });
    const sealed = play(t.data, t.state, sealCard, "enemy:0");
    expect(sealed.events).toContainEqual({ type: "intentsCancelled", enemyId: "enemy:0", intentIds: ["t_dear"] });
    expect(sealed.state.enemies[0]!.plannedIntents.map((p) => p.intent.id)).toEqual(["t_cheap"]);
    expect(sealed.state.heroes[1]!.levelUpCounter).toBe(1);
    const next = applyAction(t.data, sealed.state, { type: "endTurn" });
    if (!next.ok) throw new Error(next.error);
    expect(next.state.enemies[0]!.sealedIntentIds).toBeUndefined();
    // lastIntentIds after the enemy turn carried the sealed id, so planning could not lead with it.
    expect(
      next.events
        .filter((e) => e.type === "intentExecuted" && e.enemyId === "enemy:0")
        .map((e) => (e as { intentId: string }).intentId),
    ).toEqual(["t_cheap"]);

    const extra = makeTestCombat({
      mutateData: withLevelUp("f04", { passive: { type: "sealExtraFirstPerTurn" } }),
      setup: (s) => { withPlan(s); s.heroes[1]!.leveledUp = true; },
    });
    const twice = play(extra.data, extra.state, sealCard, "enemy:0");
    expect(twice.state.enemies[0]!.plannedIntents).toEqual([]);
    expect(twice.state.heroes[1]!.firstSealUsedThisTurn).toBe(true);

    const weakens = makeTestCombat({
      mutateData: withLevelUp("f04", { passive: { type: "sealWeakens", amount: 1 } }),
      setup: (s) => { withPlan(s); s.heroes[1]!.leveledUp = true; },
    });
    expect(play(weakens.data, weakens.state, sealCard, "enemy:0").state.enemies[0]!.statuses).toContainEqual({ id: "weak", value: 1 });
  });

  it("T290: PvP sealIntent makes the opponent's priciest hand card cost 1 more during their next turn only", () => {
    const data = testData();
    const loadout = { heroes: {}, pvp: true as const };
    let pvp = createPvpCombat(data, { seed: 7, players: [{ heroIds: ["m05", "f04", "m06"], loadout }, { heroIds: ["m05", "f04", "m06"], loadout }] }).state;
    for (const seat of [0, 1]) {
      const r = applyAction(data, pvp, { type: "mulligan", instanceIds: [], player: seat });
      if (!r.ok) throw new Error(r.error);
      pvp = r.state;
    }
    const me = pvp.activePlayer;
    const them = 1 - me;
    const seal = injectCard(pvp, data, sealCard);
    pvp.players[0]!.hand = pvp.players[0]!.hand.filter((id) => id !== seal);
    pvp.cards[seal]!.player = me;
    pvp.players[me]!.hand.push(seal);
    const foe = pvp.heroes.find((h) => h.player === them && h.alive)!;
    const sealed = applyAction(data, pvp, { type: "playCard", instanceId: seal, targetId: foe.id, player: me });
    if (!sealed.ok) throw new Error(sealed.error);
    const marked = sealed.state.players[them]!.hand.filter((id) => sealed.state.cards[id]!.sealSurcharge === 1);
    expect(marked).toHaveLength(1);
    const cost = (s: CombatState, id: string) => getEffectiveCost(data, s, id);
    // The marked card was the priciest when sealed (its cost now includes the +1).
    const unsealed = sealed.state.players[them]!.hand.map((id) => cost(sealed.state, id) - (id === marked[0] ? 1 : 0));
    expect(cost(sealed.state, marked[0]!) - 1).toBe(Math.max(...unsealed));

    // My own turn end must not clear it; it holds through their turn (the moon may have moved — compare with the surcharge removed).
    const theirTurn = applyAction(data, sealed.state, { type: "endTurn", player: me });
    if (!theirTurn.ok) throw new Error(theirTurn.error);
    const plain = structuredClone(theirTurn.state);
    delete plain.cards[marked[0]!]!.sealSurcharge;
    expect(cost(theirTurn.state, marked[0]!)).toBe(cost(plain, marked[0]!) + 1);

    const afterTheirs = applyAction(data, theirTurn.state, { type: "endTurn", player: them });
    if (!afterTheirs.ok) throw new Error(afterTheirs.error);
    expect(afterTheirs.state.cards[marked[0]!]!.sealSurcharge).toBeUndefined();
  });
});
```

- [ ] **Step 2: Chạy test để thấy thất bại**

Run: `pnpm --filter rules test -- phase7b-mechanics`
Expected: FAIL T289, T290.

- [ ] **Step 3: Kiểu và schema** — theo Interfaces. Zod: `z.object({ actor, type: z.literal("sealIntent"), to: targetRefSchema })`, `effectTypeSchema` thêm `"sealIntent"`, bộ đếm, nội tại. Trong `load-game-data.ts`, cấm `sealIntent` trong ý định kẻ địch, `onEnter` boss, hook, Hợp Kích và `SummonDef.action` (cùng chỗ đang cấm `summon`).
- [ ] **Step 4: Effect** — `effects.ts`:
```ts
/** Phong Ấn on an enemy: cancel its priciest planned intent (ties → earlier), remember it for next round's plan. */
function sealPriciest(enemy: EnemyState, events: CombatEvent[]): boolean {
  if (enemy.plannedIntents.length === 0) return false;
  const index = enemy.plannedIntents.reduce((best, p, i, all) => (p.cost > all[best]!.cost ? i : best), 0);
  const [removed] = enemy.plannedIntents.splice(index, 1);
  enemy.sealedIntentIds = [...(enemy.sealedIntentIds ?? []), removed!.intent.id];
  events.push({ type: "intentsCancelled", enemyId: enemy.id, intentIds: [removed!.intent.id] });
  return true;
}
```
Case:
```ts
    case "sealIntent": {
      const hero = ctx.source.side === "hero" && !isSummon(ctx.source) ? (ctx.source as HeroState) : undefined;
      const passive = cardPassive(data, ctx);
      for (const target of resolveTargets(state, effect.to, ctx)) {
        if (state.mode === "pvp") {
          const seat = state.players[(target as HeroState).player]!;
          const priciest = seat.hand.reduce<string | undefined>((best, id) =>
            best === undefined || getEffectiveCost(data, state, id) > getEffectiveCost(data, state, best) ? id : best, undefined);
          if (priciest !== undefined) {
            const instance = state.cards[priciest]!;
            instance.sealSurcharge = (instance.sealSurcharge ?? 0) + 1;
          }
          if (hero) bumpCounter(data, hero, "intentsSealed", 1);
          continue;
        }
        if (target.side !== "enemy") continue;
        if (!sealPriciest(target as EnemyState, events)) continue;
        if (hero) bumpCounter(data, hero, "intentsSealed", 1);
        if (passive?.type === "sealExtraFirstPerTurn" && hero && !hero.firstSealUsedThisTurn) {
          hero.firstSealUsedThisTurn = true;
          if (sealPriciest(target as EnemyState, events) && hero) bumpCounter(data, hero, "intentsSealed", 1);
        }
        if (passive?.type === "sealWeakens") applyStatus(target, "weak", passive.amount, ctx.source.id, events);
      }
      return;
    }
```
Import `getEffectiveCost` từ `./queries`. Vòng import `queries` → `levelup` → `effects` hợp lệ vì chỉ gọi hàm lúc chạy. Nếu vitest báo lỗi thứ tự khởi tạo, chuyển hàm tìm lá đắt nhất vào `queries.ts` (`priciestHandCard(data, state, seat): string | undefined`) và gọi từ đó.
- [ ] **Step 5: Lượt kẻ địch** — `enemy-turn.ts`: đổi dòng `enemy.lastIntentIds = enemy.plannedIntents.map((planned) => planned.intent.id);` thành
```ts
    enemy.lastIntentIds = [...enemy.plannedIntents.map((planned) => planned.intent.id), ...(enemy.sealedIntentIds ?? [])];
    delete enemy.sealedIntentIds;
```
- [ ] **Step 6: Cờ lượt và cost** — `turn-passives.ts` `heroTurnStart`: thêm `delete hero.firstSealUsedThisTurn;` cạnh `delete hero.firstSchemeUsedThisTurn;`. `queries.ts` `getEffectiveCost`: `const surcharge = instance!.sealSurcharge ?? 0;` và `return Math.max(0, Math.max(0, floor, cost) + surcharge - passives - chosen);`. `turn.ts` `endSeatTurn`, vòng xóa cờ lá đổi thành:
```ts
  for (const instance of Object.values(state.cards)) {
    if (instance.player !== player.index) continue;
    delete instance.chosenThisTurn;
    delete instance.turnDiscount;
    delete instance.sealSurcharge;
  }
```
PvE chỉ có người chơi 0, nên kết quả không đổi. Co-op gọi `endSeatTurn` cho cả hai người, nên mọi lá vẫn được xóa như cũ.
- [ ] **Step 7: Chạy test**

Run: `pnpm --filter rules test -- phase7b-mechanics`
Expected: PASS T280–T290, T294.

Run: `pnpm test && pnpm typecheck`
Expected: PASS, gồm T213.

- [ ] **Step 8: Commit**

```bash
git add packages
git commit -m "Step 7b.3: sealIntent and F07 passives"
```

---

### Task 6: Hồi Hồn (`revive`) và F10 (bước 7b.3, phần 3)

**Files:**
- Modify: `packages/rules/src/types/static.ts`, `types/state.ts`, `types/events.ts`, `packages/data/src/schema.ts`, `packages/data/src/load-game-data.ts`, `packages/rules/src/effects.ts`, `packages/rules/src/queries.ts`, `apps/client/src/debug.ts`
- Test: `packages/rules/test/phase7b-mechanics.test.ts`, `packages/data/test/load-game-data.test.ts`

**Interfaces:**
- Produces:
  - `CardTarget` thêm `"fallenAlly"`.
  - `Effect` thêm `{ type: "revive"; ratio: number; to: "chosen" | "lastFallen" }`.
  - `LevelUpCounter` thêm `"alliesFallen"`. `LevelUpPassive` thêm `{ type: "armorOnAllyFall"; amount: number }`.
  - `HeroState.revived?: true`, `PlayerState.purged?: Record<string, string[]>` (khóa là unit id của Hero), `PlayerState.fallenOrder?: string[]`.
  - Event `{ type: "heroRevived"; heroId: string; hp: number; player?: number }`.

- [ ] **Step 1: Viết test thất bại**

```ts
describe("phase 7b — Hồi Hồn", () => {
  const reviveCard = card({ id: "test_revive", ownerId: "f04", target: "fallenAlly", effects: [{ type: "revive", ratio: 0.5, to: "chosen" }] });
  const down = (s: CombatState, index: number) => {
    const hero = s.heroes[index]!;
    hero.hp = 0;
    hero.alive = false;
  };

  it("T291: revive raises a fallen ally once at ratio × maxHp, reshuffles its purged cards into the draw pile; fallenAlly lists only fallen, unrevived allies", () => {
    const { data, state } = makeTestCombat({ mutateData: makeEnemiesIdle });
    // Kill m05 through the real path so its draw-pile cards are purged.
    state.heroes[0]!.hp = 1;
    const s = structuredClone(state);
    const m05Pile = p0(s).drawPile.filter((id) => s.cards[id]!.ownerIds.includes("m05"));
    const cut = card({ id: "test_cut", ownerId: "m06", type: "attack", tags: ["attack"], target: "ally", effects: [{ type: "loseHp", amount: 1, to: "chosen" }] });
    const killed = play(data, s, cut, "hero:m05");
    expect(killed.state.heroes[0]!.alive).toBe(false);
    expect(killed.state.players[0]!.purged!["hero:m05"]).toEqual(m05Pile);

    const reviveId = injectCard(killed.state, data, reviveCard);
    expect(getValidTargets(data, killed.state, reviveId)).toEqual(["hero:m05"]);
    const raised = applyAction(data, killed.state, { type: "playCard", instanceId: reviveId, targetId: "hero:m05" });
    if (!raised.ok) throw new Error(raised.error);
    const m05 = raised.state.heroes[0]!;
    expect(m05).toMatchObject({ alive: true, hp: Math.floor(0.5 * m05.maxHp), armor: 0, statuses: [], revived: true });
    expect(raised.events).toContainEqual({ type: "heroRevived", heroId: "hero:m05", hp: m05.hp });
    for (const id of m05Pile) expect(p0(raised.state).drawPile).toContain(id);
    for (const id of m05Pile) expect(p0(raised.state).discardPile).not.toContain(id);

    const again = structuredClone(raised.state);
    down(again, 0);
    const second = injectCard(again, data, { ...reviveCard, id: "test_revive2" });
    expect(getValidTargets(data, again, second)).toEqual([]);
  });

  it("T292: alliesFallen counts for the seat; an onLevelUp revive to lastFallen raises the ally that just fell; armorOnAllyFall shields the survivors", () => {
    const { data, state } = makeTestCombat({
      mutateData: (d) => {
        withLevelUp("f04", { counter: "alliesFallen", threshold: 1, passive: { type: "none" } })(d);
        d.heroes.f04!.levelUp.onLevelUp = [{ type: "revive", ratio: 0.3, to: "lastFallen" }];
      },
    });
    const cut = card({ id: "test_cut2", ownerId: "m06", type: "attack", tags: ["attack"], target: "ally", effects: [{ type: "loseHp", amount: 99, to: "chosen" }] });
    const r = play(data, state, cut, "hero:m05");
    expect(r.state.heroes[1]!.leveledUp).toBe(true);
    expect(r.state.heroes[0]).toMatchObject({ alive: true, hp: Math.max(1, Math.floor(0.3 * r.state.heroes[0]!.maxHp)), revived: true });

    const shield = makeTestCombat({
      mutateData: withLevelUp("f04", { passive: { type: "armorOnAllyFall", amount: 6 } }),
      setup: (s) => { s.heroes[1]!.leveledUp = true; },
    });
    const fell = play(shield.data, shield.state, { ...cut, id: "test_cut3" }, "hero:m05");
    expect(fell.state.heroes[1]!.armor).toBe(6);
    expect(fell.state.heroes[2]!.armor).toBe(6);
  });
});
```
Kiểm chéo dữ liệu thêm vào `load-game-data.test.ts`:
```ts
  it("T295b: fallenAlly cards must revive; revive only on fallenAlly cards or onLevelUp", () => {
    const a = rawData();
    a.cards[0].target = "fallenAlly";
    expect(() => parseGameData(a)).toThrow(/target "fallenAlly" requires a revive effect with to "chosen"/);
    const b = rawData();
    b.cards[0].effects = [{ type: "revive", ratio: 0.5, to: "chosen" }];
    expect(() => parseGameData(b)).toThrow(/revive to "chosen" needs target "fallenAlly"/);
  });
```

- [ ] **Step 2: Chạy test để thấy thất bại**

Run: `pnpm --filter rules test -- phase7b-mechanics && pnpm --filter data test`
Expected: FAIL T291, T292, T295b.

- [ ] **Step 3: Kiểu và schema** — theo Interfaces. Zod:
  - `cardDefSchema.target` thêm `"fallenAlly"`.
  - Effect `z.object({ actor, type: z.literal("revive"), ratio: z.number().gt(0).lte(1), to: z.enum(["chosen", "lastFallen"]) })`. `effectTypeSchema` thêm `"revive"`.

  Kiểm chéo trong `checkCardShape`:
```ts
    const revivesChosen = someEffect(card.effects, (e) => e.type === "revive" && e.to === "chosen");
    if (card.target === "fallenAlly" && !revivesChosen) errors.push(`${label}: target "fallenAlly" requires a revive effect with to "chosen"`);
    if (card.target !== "fallenAlly" && revivesChosen) errors.push(`${label}: revive to "chosen" needs target "fallenAlly"`);
```
  Luật hiện có "target khác `none` phải có effect `to: "chosen"`" đã đúng với `fallenAlly`, vì `revive` có `to: "chosen"` và `effectsUseChosen` đọc trường `to`. Cấm `revive` trong ý định kẻ địch, `onEnter` boss, hook, Hợp Kích và `SummonDef.action`.
- [ ] **Step 4: Mục tiêu** — `queries.ts` `getValidTargets`:
```ts
    case "fallenAlly":
      return heroesOf(state, instance.player).filter((hero) => !hero.alive && !hero.revived).map((hero) => hero.id);
```
  Hàm cần `source`, và `source` còn sống (luật chủ lá). Import `heroesOf`.
- [ ] **Step 5: Ghi lại lúc ngã** — `effects.ts` `killUnit`, nhánh Hero:
```ts
    seat.fallenOrder = [...(seat.fallenOrder ?? []), unit.id];
    if (purged.length > 0) { …như cũ…; seat.purged = { ...(seat.purged ?? {}), [unit.id]: purged }; }
    bumpSeat(data, state, seat.index, "alliesFallen", 1);
    for (const ally of heroesOf(state, seat.index)) {
      const passive = ally.alive && ally.leveledUp ? levelUpPassive(data, ally) : undefined;
      if (passive?.type !== "armorOnAllyFall") continue;
      for (const survivor of heroesOf(state, seat.index).filter((hero) => hero.alive)) {
        survivor.armor += passive.amount;
        events.push({ type: "armorGained", targetId: survivor.id, amount: passive.amount });
      }
    }
```
  (`bumpSeat` chỉ tính Hero còn sống, nên Hero vừa ngã không được tính.)
- [ ] **Step 6: Effect `revive`** — `effects.ts`:
```ts
    case "revive": {
      const seat = playerOf(state, ctx.source.id);
      if (!seat) return;
      const targetId =
        effect.to === "chosen"
          ? ctx.chosenId
          : [...(seat.fallenOrder ?? [])].reverse().find((id) => {
              const hero = state.heroes.find((h) => h.id === id);
              return hero !== undefined && !hero.alive && !hero.revived;
            });
      const hero = state.heroes.find((h) => h.id === targetId && h.player === seat.index);
      if (!hero || hero.alive || hero.revived) return;
      hero.alive = true;
      hero.revived = true;
      hero.hp = Math.max(1, Math.floor(effect.ratio * hero.maxHp));
      hero.armor = 0;
      hero.statuses = [];
      events.push({ type: "heroRevived", heroId: hero.id, hp: hero.hp, ...seatTag(state, seat.index) });
      const back = seat.purged?.[hero.id] ?? [];
      if (back.length > 0) {
        seat.discardPile = seat.discardPile.filter((id) => !back.includes(id));
        const shuffled = shuffle([...seat.drawPile, ...back], state.rngState);
        seat.drawPile = shuffled.items;
        state.rngState = shuffled.rngState;
        delete seat.purged![hero.id];
        events.push({ type: "deckShuffled", ...seatTag(state, seat.index) });
      }
      return;
    }
```
  Import `shuffle` từ `./rng`. `revive` qua `onLevelUp` chạy bên trong `checkLevelUps`, tức sau `processDeaths` và trước `checkCombatEnd`. Vì vậy Hero vừa ngã được đứng dậy trước khi kiểm thua. T292 kiểm điều này.
- [ ] **Step 7: Client typecheck** — `debug.ts` thêm `case "heroRevived": return "Hồi Hồn";`.
- [ ] **Step 8: Chạy test**

Run: `pnpm --filter rules test -- phase7b-mechanics && pnpm --filter data test`
Expected: PASS T280–T292, T294, T295a, T295b.

Run: `pnpm test && pnpm typecheck`
Expected: PASS, gồm T213. `fallenOrder` và `purged` chỉ được gán khi có Hero ngã. Nếu T213 so cả state thô (không qua projection) mà đỏ vì hai trường này, chỉ gán chúng khi có Hero **ngã trong PvE mà có ai đó mang effect `revive` hoặc bộ đếm `alliesFallen`**. Nếu vẫn đỏ thì dừng và báo người dùng.

- [ ] **Step 9: Commit**

```bash
git add packages apps/client/src/debug.ts
git commit -m "Step 7b.3: revive, fallen allies and F10 passives"
```

---

### Task 7: Xuyên mục tiêu và F05 (bước 7b.3, phần 4)

**Files:**
- Modify: `packages/rules/src/types/static.ts`, `packages/data/src/schema.ts`, `packages/rules/src/effects.ts`
- Test: `packages/rules/test/phase7b-mechanics.test.ts`

**Interfaces:**
- Produces:
  - `LevelUpCounter` thêm `"backRowHits"`. `LevelUpPassive` thêm `{ type: "pierceOwnAttacks" }`, `{ type: "firstHitMarks"; rounds: number }`.
  - `isBackRow(state, target: UnitState): boolean` (export từ `effects.ts`).

- [ ] **Step 1: Viết test thất bại**

```ts
describe("phase 7b — Xuyên", () => {
  const shot = card({ id: "test_shot", ownerId: "f04", type: "attack", tags: ["attack"], target: "enemy", effects: [{ type: "damage", amount: 5, to: "chosen" }] });

  it("T293: backRowHits counts hits on non-front enemies; pierceOwnAttacks also hits the enemy right behind; firstHitMarks marks once per turn", () => {
    const count = makeTestCombat({ mutateData: withLevelUp("f04", { counter: "backRowHits", threshold: 99 }) });
    expect(play(count.data, count.state, shot, "enemy:1").state.heroes[1]!.levelUpCounter).toBe(1);
    expect(play(count.data, count.state, { ...shot, id: "test_shot_front" }, "enemy:0").state.heroes[1]!.levelUpCounter).toBe(0);

    const pierce = makeTestCombat({ mutateData: withLevelUp("f04", { passive: { type: "pierceOwnAttacks" } }), setup: (s) => { s.heroes[1]!.leveledUp = true; } });
    const through = play(pierce.data, pierce.state, shot, "enemy:0");
    const hits = through.events.filter((e) => e.type === "damageDealt").map((e) => (e as { targetId: string }).targetId);
    expect(hits).toEqual(["enemy:0", "enemy:1"]);

    const marks = makeTestCombat({ mutateData: withLevelUp("f04", { passive: { type: "firstHitMarks", rounds: 1 } }), setup: (s) => { s.heroes[1]!.leveledUp = true; } });
    const first = play(marks.data, marks.state, shot, "enemy:0");
    expect(first.state.enemies[0]!.statuses).toContainEqual({ id: "mark", value: 1, sourceId: "hero:f04" });
    const second = play(marks.data, first.state, { ...shot, id: "test_shot2" }, "enemy:1");
    expect(second.state.enemies[1]!.statuses.some((st) => st.id === "mark")).toBe(false);
  });
});
```

- [ ] **Step 2: Chạy test để thấy thất bại**

Run: `pnpm --filter rules test -- phase7b-mechanics`
Expected: FAIL T293.

- [ ] **Step 3: Kiểu và schema** — theo Interfaces.
- [ ] **Step 4: `effects.ts`**
```ts
/** Hàng sau: a living unit that is not the front (lowest position) of its side (`01` §5). */
export function isBackRow(state: CombatState, target: UnitState): boolean {
  const side =
    target.side === "enemy"
      ? state.enemies
      : state.heroes.filter((hero) => hero.player === (target as HeroState).player);
  const front = side.filter((unit) => unit.alive).reduce((min, unit) => Math.min(min, unit.position), Infinity);
  return target.position > front;
}

function nextBehind(state: CombatState, target: UnitState): UnitState | undefined {
  const side =
    target.side === "enemy"
      ? state.enemies
      : state.heroes.filter((hero) => hero.player === (target as HeroState).player);
  return side
    .filter((unit) => unit.alive && unit.position > target.position)
    .sort((a, b) => a.position - b.position)[0];
}
```
  - `dealDamage`, ở đầu hàm (trước khi trừ HP): `const backRow = ctx.card !== undefined && ctx.source.side === "hero" && isBackRow(state, target);`. Sau `events.push({ type: "damageDealt", … })`: `if (backRow) bumpCounter(data, ctx.source as HeroState, "backRowHits", 1);`. Cũng trong `dealDamage`, cạnh khối Hàn Kiếm:
```ts
  if (passive?.type === "firstHitMarks" && opponentsOf(state, ctx.source).includes(target)) {
    const hero = ctx.source as HeroState;
    if (!hero.firstHitUsedThisTurn) {
      hero.firstHitUsedThisTurn = true;
      const factor = state.mode === "pvp" ? 2 : 1;
      if (target.alive && target.hp > 0) applyStatus(target, "mark", passive.rounds * factor, hero.id, events);
    }
  }
```
  - Case `damage`:
```ts
    case "damage": {
      const hits = effect.hits ?? 1;
      const pierce = effect.to === "chosen" && cardPassive(data, ctx)?.type === "pierceOwnAttacks";
      for (const target of resolveTargets(state, effect.to, ctx)) {
        for (let hit = 0; hit < hits && target.alive && target.hp > 0; hit++) {
          const behind = pierce ? nextBehind(state, target) : undefined;
          dealDamage(data, state, ctx, target, effect.amount, events);
          if (!ctx.source.alive) return;
          if (behind?.alive && behind.hp > 0) {
            dealDamage(data, state, ctx, behind, effect.amount, events);
            if (!ctx.source.alive) return;
          }
        }
      }
      return;
    }
```
  Tính `behind` **trước** hit, để việc mục tiêu chính ngã không làm "người phía sau" nhảy vị trí.
- [ ] **Step 5: Chạy test**

Run: `pnpm --filter rules test -- phase7b-mechanics`
Expected: PASS T280–T294.

Run: `pnpm test && pnpm typecheck`
Expected: PASS, gồm T213. `isBackRow` chỉ ảnh hưởng bộ đếm `backRowHits`, và chưa Hero cũ nào có bộ đếm này.

- [ ] **Step 6: Commit**

```bash
git add packages
git commit -m "Step 7b.3: pierce, back-row hits and F05 passives"
```

---

### Task 8: Nội dung — F05, F06, F07, F09, F10, M09, Linh Thú, 2 Song Hành (bước 7b.4)

**Files:**
- Modify: `docs/03-prototype-content.md` (mục "GĐ7 — Hero đợt 2"), `packages/data/heroes.json`, `cards.json`, `summons.json`, `pvp-config.json`, `banners.json`
- Create: `packages/rules/test/phase7b-heroes.test.ts`

**Interfaces:**
- Consumes: mọi kiểu của Task 2–7.
- Produces: Hero `f05`, `f06`, `f07`, `f09`, `f10`, `m09`; Linh Thú `tho_ngoc`, `tho_ngoc_thuc_tinh`; lá Song Hành *Khúc Vũ Tri Âm* (M09+F06), *Nguyệt Thố Hộ Mệnh* (F09+F10). Id lá Song Hành theo tiền tố mà các lá Song Hành đang có trong `cards.json` dùng.

- [ ] **Step 1: Soạn danh sách và trình người dùng duyệt (không viết JSON trước khi duyệt)** — trong `docs/03-prototype-content.md`, mỗi Hero có một bảng 12 lá + lá "+":

| Id | Tên | Cost | Copies | Loại / Tag / Target | Hiệu ứng (theo `Effect`) | Nhánh | Mở sẵn / Khóa |
|---|---|---|---|---|---|---|---|

Ràng buộc bắt buộc (khớp kiểm chéo và `18` §1.1, §3.3):
- Id `<heroId>_<ten_khong_dau>`. 6 lá mở sẵn + 6 lá khóa. Mỗi nhánh đúng 6 lá. Ít nhất 2 lá mở sẵn có cost ≤ 3. `copies` theo cost (0–1 → 3, 2–4 → 2, 5+ → 1).
- Lá chủ đạo là lá mở sẵn. Lá "+" có `plusOf`, cùng chủ, cùng cost, cùng copies.
- Bộ đếm và nội tại:
  - F05: `backRowHits` 4 → `pierceOwnAttacks` / alt `firstHitMarks 1`.
  - F06: `charmsApplied` 2 → `charmMastery { extraCharges: 1, damageMultiplier: 1.5 }` / alt `stealthOnCharm 1`.
  - F07: `intentsSealed` 3 → `sealExtraFirstPerTurn` / alt `sealWeakens 1`.
  - F09: `summonsMade` 5 → `awakenSummons` / alt `summonTaunts 1`.
  - F10: `alliesFallen` 1 → `none` + `levelUp.onLevelUp: [{ type: "revive", ratio: 0.3, to: "lastFallen" }]` / alt `armorOnAllyFall 6`.
  - M09: `debuffsApplied` 6 → `debuffDurationBonus 1` / alt `bonusVsDebuffed { minDebuffs: 2, amount: 3 }`.
  - `constellationThreshold = ceil(0.7 × threshold)` (ngưỡng 1 thì giữ 1).
- Pool mỗi Hero phải có lá phục vụ bộ đếm: F05 ≥ 4 lá đánh đơn mục tiêu; F06 và M09 ≥ 3 lá gây `charm` (M09 cho nhánh *Tri Âm*); F07 ≥ 4 lá `sealIntent`; F09 ≥ 4 lá `summon` với `summonId: "tho_ngoc"` (nhánh *Linh Thố*); F10 ≥ 2 lá `target: "fallenAlly"` + `revive`.
- `summons.json`: `tho_ngoc` (HP khởi điểm 12, `targeting: "lowestHp"`, action `damage 3 → chosen`, `awakenedId: "tho_ngoc_thuc_tinh"`); `tho_ngoc_thuc_tinh` (HP 24, action `damage 6 → chosen` + `heal 2 → owner`).
- HP PvE: F05 32, F06 30, F07 30, F09 28, F10 30, M09 32. HP PvP = HP PvE + 12, chỉnh ở Task 10. Độ hiếm: F10 legendary; F06, M09 epic; F05, F07 rare; F09 common.
- Song Hành: *Khúc Vũ Tri Âm* gồm `applyStatus charm 1 → chosen` (actor M09) và `extendDebuffs 1 → chosen`, `target: "enemy"`. *Nguyệt Thố Hộ Mệnh* gồm `summon tho_ngoc` (actor F09, tức index 0 trong `bond.owners`), `applyStatus taunt 1 → summon` và `gainArmor 6 → summon`, `target: "none"`.

Dừng lại, gửi người dùng danh sách, chờ "ok" (sửa theo góp ý nếu có) rồi mới làm Step 2.

- [ ] **Step 2: Viết test thất bại** — tạo `packages/rules/test/phase7b-heroes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { applyAction, buildPvpLoadout, createProfile, starterDeck, validateDeck } from "../src/index";
import { makeTestCombat, ownAllHeroes, p0, testData } from "./helpers";

const WAVE = ["f05", "f06", "f07", "f09", "f10", "m09"] as const;

describe("phase 7b heroes", () => {
  it("T296: the six wave-2 heroes load with full pools, PvP stats, banner slots, a starter combat and a valid starter deck", () => {
    const data = testData();
    const profile = ownAllHeroes(data, createProfile(data));
    for (const id of WAVE) {
      const hero = data.heroes[id]!;
      expect(hero.cardIds).toHaveLength(6);
      expect(hero.lockedCardIds).toHaveLength(6);
      expect(data.pvpConfig.heroStats[id]).toBeDefined();
      expect(data.banners.banner_heroes!.pool[hero.rarity]).toContain(id);
      const team = [id, "f04", "m06"] as [string, string, string];
      expect(validateDeck(data, profile, { heroIds: team, cardIds: starterDeck(data, team) })).toEqual([]);
      expect(buildPvpLoadout(data, profile, { heroIds: team }).ok).toBe(true);
      const { state } = makeTestCombat({ heroIds: team });
      expect(p0(state).hand.length).toBeGreaterThan(0);
    }
    expect(data.summons.tho_ngoc!.awakenedId).toBe("tho_ngoc_thuc_tinh");
  });

  it("T297: 20 heroes load; each wave-2 bond pair adds its bond card", () => {
    const data = testData();
    expect(Object.keys(data.heroes)).toHaveLength(20);
    for (const [a, b] of [["m09", "f06"], ["f09", "f10"]] as const) {
      const { state } = makeTestCombat({ heroIds: [a, b, "m05"] });
      const pairs = Object.values(state.cards).filter((c) => c.ownerIds.length === 2).map((c) => [...c.ownerIds].sort().join("+"));
      expect(pairs).toContain([a, b].sort().join("+"));
    }
  });
});
```
Thêm một `it` cho mỗi Hero kiểm thăng cấp bằng lá thật. Ví dụ F09: đánh 5 lá triệu hồi → `leveledUp` và `state.summons[0].summonId === "tho_ngoc_thuc_tinh"`. F07: 3 lần Phong Ấn. F10: một đồng đội ngã → đứng dậy với 30% HP. F05: 4 hit vào hàng sau → đòn sau xuyên. F06: 2 lần Mê Hoặc. M09: 6 debuff → debuff sau dài hơn 1 vòng. Làm theo mẫu T276c của `phase7a-heroes.test.ts`: `setHand` với lá thật, `moonPower` đủ, đánh lá, rồi kiểm tra.

- [ ] **Step 3: Chạy test để thấy thất bại**

Run: `pnpm --filter rules test -- phase7b-heroes`
Expected: FAIL (`data.heroes.f05` undefined).

- [ ] **Step 4: Viết JSON** theo danh sách đã duyệt: `heroes.json` (6 Hero, `art` rỗng), `cards.json` (72 lá + 6 lá "+" + 2 lá Song Hành), `summons.json` (2 Linh Thú), `pvp-config.json` `heroStats`, `banners.json` `banner_heroes.pool`.

- [ ] **Step 5: Chạy test**

Run: `pnpm --filter data test && pnpm --filter rules test`
Expected: PASS. Nếu test gacha cũ (`meta-gacha.test.ts`, `meta-gear.test.ts`) đổi kết quả vì pool banner lớn hơn, đó là thay đổi cố ý: cập nhật kỳ vọng của **test đó** (không phải T213) và ghi rõ trong commit. Nếu **T213** đỏ thì dừng và báo người dùng.

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add docs/03-prototype-content.md packages
git commit -m "Step 7b.4: heroes F05, F06, F07, F09, F10, M09, Linh Thú and two bond cards"
```

---

### Task 9: Client 7b (bước 7b.5)

**Files:**
- Modify: `apps/client/src/scenes/combat-scene.ts`, `apps/client/src/ui/event-animator.ts`, `apps/client/src/debug.ts`, `apps/client/src/theme.ts`

**Interfaces:**
- Consumes: `summonsOf`, `isSummon` (từ `rules`), các event `summoned` / `summonActed` / `summonDismissed` / `heroRevived`, trạng thái `charm`, `CardTarget "fallenAlly"`.

- [ ] **Step 1: Ô Linh Thú** — `combat-scene.ts` `renderHeroes`: sau khi vẽ panel mỗi Hero, nếu `summonOf(state, hero.id)` có, vẽ một panel nhỏ (khoảng 110×70) ngay dưới panel Hero, gồm tên (`gameData.summons[summonId].name`), thanh HP, giáp, `statusChips`. Ghi `this.unitAnchors.set(summon.id, …)` và `this.unitViews.set(summon.id, …)` để animation damage và mục tiêu dùng được. Panel là mục tiêu click được khi `this.validTargetIds.has(summon.id)`, cùng cách xử lý như panel Hero. PvP vẽ cả Linh Thú của đối thủ cạnh panel Hero đối thủ.
- [ ] **Step 2: Hero đã ngã chọn được** — khi đang chọn mục tiêu cho lá `target: "fallenAlly"`, panel Hero đã ngã có trong `validTargetIds` phải nhận click (hiện panel Hero ngã có thể bị làm mờ và tắt input; bật lại input cho trường hợp này).
- [ ] **Step 3: Animation** — `event-animator.ts`:
  - `summoned`: vòng sáng tại anchor của Hero chủ và chữ nổi `"Triệu hồi"`. Sau đó vẽ lại từ state như các event khác.
  - `summonActed`: chữ nổi tên Linh Thú.
  - `summonDismissed`: mờ dần tại anchor Linh Thú.
  - `heroRevived`: `flash` vàng tại anchor Hero và chữ nổi `"Hồi Hồn"`.
  - Case `intentsCancelled` đang ghi cứng `"Tỏa Nguyệt hủy"`: đổi thành `"Hủy: …"`, vì giờ Phong Ấn cũng phát event này.
- [ ] **Step 4: Nhãn** — `theme.ts`: nhãn trạng thái `charm: "Mê"`. Ý định của kẻ địch bị Mê Hoặc hiện mũi tên tới kẻ địch mục tiêu, lấy từ `previewEnemyIntent` (không tính ở client).
- [ ] **Step 5: Chạy thử trên trình duyệt** — dùng preview (`preview_start` với cấu hình client trong `.claude/launch.json`). Chọn đội F09 + F10 + F06 ở Trận lẻ:
  - Đánh lá triệu hồi → ô Thỏ Ngọc xuất hiện. Kết thúc lượt → Thỏ Ngọc đánh trước lượt kẻ địch.
  - Đánh lá Mê Hoặc → nhãn `Mê` và mũi tên đổi mục tiêu.
  - Để một Hero ngã (bảng debug) → đánh lá Hồi Hồn chọn được Hero đã ngã.

  Kiểm `read_console_messages` không có lỗi và chụp ảnh màn hình làm bằng chứng.
- [ ] **Step 6: Kiểm tra và commit**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

```bash
git add apps/client
git commit -m "Step 7b.5: client Linh Thú, charm, seal and revive"
```

---

### Task 10: Bot, mô phỏng, chỉnh số, đóng 7b (bước 7b.6)

**Files:**
- Modify: `packages/rules/src/bot.ts`, `packages/rules/test/run-playtest.test.ts`, `packages/rules/test/pvp-sim.ts` (nếu cần), `docs/playtest-notes.md`, JSON số liệu (chỉ sau khi duyệt), `CLAUDE.md`, `docs/18-phase7-spec.md`

- [ ] **Step 1: Heuristic bot** — `bot.ts`:
  - Lá có `summon`: chỉ đánh khi Hero chủ chưa có Linh Thú, **hoặc** Linh Thú hiện có HP < 50%. Riêng khi chủ lá còn đang thăng cấp bằng `summonsMade` thì luôn đánh.
  - Lá có `applyStatus charm`: nhắm kẻ địch có tổng damage xem trước (`previewEnemyIntent`) cao nhất **và** còn kẻ địch khác sống. Chỉ còn 1 kẻ địch thì bỏ qua lá.
  - Lá có `sealIntent`: nhắm kẻ địch có chiêu đắt nhất. Chuỗi rỗng thì bỏ qua.
  - Lá `target: "fallenAlly"`: chọn Hero đã ngã có `maxHp` cao nhất.
  - Mỗi heuristic có một `it` nhỏ trong `phase7b-heroes.test.ts` (ví dụ `it("bot: charm skips when only one enemy remains")`).
- [ ] **Step 2: Playtest lượt chơi** — `run-playtest.test.ts` `TEAMS` thêm 4 đội: `["f09","f10","m05"]`, `["f06","m09","f03"]`, `["f05","f07","m06"]`, `["f10","f05","m04"]`. Chạy seed 1–20 như các đội cũ.
- [ ] **Step 3: Mô phỏng PvP** — chạy `PLAYTEST_PVP=1` với chế độ lấy mẫu `sampleMatches` đã thêm ở 7a (20 Hero cho 1140 đội). Báo tỉ lệ thắng theo Hero và độ dài trận.
- [ ] **Step 4: Đo và đề xuất gói chỉnh** — ghi vào `docs/playtest-notes.md` mục "Phase 7b (bước 7b.6)":
  - Phương pháp.
  - Tỉ lệ thắng lượt theo đội, mục tiêu ±10 điểm so với trung bình đội cũ.
  - Tỉ lệ thắng PvP theo Hero, mục tiêu 40–60%.
  - Độ dài trận PvP, mục tiêu 8–12 vòng.
  - Số lần Linh Thú hành động mỗi trận và số chiêu bị đổi hoặc hủy (đếm từ event).
  - **Gói chỉnh đề xuất**: chỉ số JSON (HP Hero / Linh Thú, ngưỡng, số liệu lá).

  Dừng lại và trình người dùng duyệt.
- [ ] **Step 5: Áp gói đã duyệt, đo lại, ghi kết quả sau chỉnh** vào cùng mục, rồi:

Run: `pnpm test && pnpm typecheck`
Expected: PASS (T213 xanh).

```bash
git add packages docs/playtest-notes.md
git commit -m "Step 7b.6: bot heuristics, sims and tuning for phase-7b heroes"
```

- [ ] **Step 6: Đóng 7b** — `CLAUDE.md` "Giai đoạn hiện tại": "7b xong — đủ 20 Hero; tiếp theo 7c Cốt truyện (`docs/18-phase7-spec.md` §4)". Cập nhật dòng **Trạng thái** của `docs/18-phase7-spec.md`. Commit `"Close phase 7b"`.
