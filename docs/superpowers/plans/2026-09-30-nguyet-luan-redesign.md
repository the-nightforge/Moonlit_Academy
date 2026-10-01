# Nguyệt Luân mới — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Mỗi Task kết thúc bằng `pnpm test` + `pnpm typecheck` xanh và một commit trên nhánh `feature/phase7`. Báo người dùng sau mỗi Task và chờ "ok" trước Task kế tiếp.

**Goal:** Nguyệt Luân mới: mỗi pha có ưu đãi tag cố định cộng 1 Nguyệt Lệnh bốc ngẫu nhiên (1 trong 3) mỗi trận, pha khởi đầu ngẫu nhiên, và Nguyệt tính cho kẻ địch. Cả hai phe đều chịu ảnh hưởng.

**Architecture:**
- **Dữ liệu:** `moon-phases.json` đổi `modifiers` thành `tagBonus` + `decrees` (3 lệnh / pha, mỗi lệnh là một danh sách `MoonModifier`).
- **Bốc lệnh:** lúc tạo trận, `rollMoon` bốc pha khởi đầu và 8 lệnh bằng một **luồng RNG phụ** tính từ `rngState`. Luồng chính không bị đẩy, nên thứ tự xáo bài và lên chuỗi địch giữ nguyên. Kết quả lưu vào `CombatState.moonDecrees`.
- **Tra cứu:** mọi chỗ đọc hiệu ứng pha đi qua `phaseModifiers` / `decreeModifier` trong `moon.ts`. `activeModifiers` (Kỳ Vật) dùng lại hàm đó.
- **Gắn hook:** mỗi lệnh gắn vào đúng một điểm có sẵn: `computeDamageAmount` / `dealDamage`, `startPlayerTurn`, `runEnemyTurn`, `planEnemyIntents`, `endSeatTurn`, `seatTurnStart`, hiệu ứng `applyStatus` / `chooseCard`.
- **Action mới:** `discardCard`, `bloodPact` đi qua `applyAction` như `playCard`.

**Tech Stack:** TypeScript strict, pnpm workspaces, Vitest, zod (`packages/data`), Fastify (server schema), Phaser (client).

**Spec:** `docs/superpowers/specs/2026-09-30-nguyet-luan-redesign-design.md` (đã duyệt). Khi plan và spec khác nhau về luật, spec là chuẩn. Riêng các điểm plan làm rõ ở Task 1 Step 1 được đưa vào spec và `01`, và người dùng xác nhận ở Task 1 Step 2.

**Thời điểm:** làm sau 7c Task 5 (đã commit `3fe7a4f`), **trước** 7c Task 6 (nội dung Arc 1). Phiên 7c phải dừng trước Task 6.

## Global Constraints

- `packages/rules` thuần: không Phaser, DOM, mạng, file system, `Math.random()`, `Date.now()`. Mọi ngẫu nhiên đến từ `rng.ts` (`nextRandom`, `shuffle`).
- Hàm thuần, không mutate đầu vào: `applyAction` luôn `cloneState` trước khi sửa.
- **T213 (ghi vàng PvE) sẽ lệch có chủ đích.** Task 1 xin người dùng duyệt việc ghi lại ở cuối mỗi Task đổi kết quả trận (2–6), để `pnpm test` luôn xanh. Chỉ ghi lại sau khi mọi test khác đã xanh. Lệnh ghi lại: `GOLDEN_RECORD=1 pnpm --filter rules exec vitest run test/golden.test.ts`, rồi chạy lại không có biến môi trường.
- Không hardcode số liệu lệnh / kẻ địch trong code: số nằm trong `moon-phases.json`, `enemies.json`.
- Code, tên biến, comment: tiếng Anh. Chữ cho người chơi: tiếng Việt, lấy từ dữ liệu hoặc `apps/client/src/ui/theme.ts`.
- Thuật ngữ theo `docs/04-glossary.md` (Task 1 thêm: Nguyệt Lệnh, Ưu Đãi Pha, Nguyệt Tính, Hủy Bài, Huyết Tế).
- Mã test **T314–T325**, tên test bắt đầu bằng mã. (T300–T307 thuộc 7c, T308–T313 thuộc 7d.)
- Không thêm thư viện mới.
- Lệnh (ở gốc repo): `pnpm --filter rules test`, `pnpm --filter data test`, `pnpm --filter server test`, `pnpm test`, `pnpm typecheck`.

---

## File Structure

| File | Trách nhiệm | Task |
|---|---|---|
| `docs/{00,01,02,03,04,05,06,07,16}.md`, spec, `CLAUDE.md` | Tài liệu | 1 |
| `packages/rules/src/types/static.ts` | `MoonModifier` mới, `MoonDecreeDef`, `MoonPhaseDef`, `CombatStart.decrees` | 2 |
| `packages/rules/src/types/state.ts` | `CombatState.moonDecrees`, cờ theo lượt | 2–5 |
| `packages/rules/src/types/events.ts` | `moonDecreesRolled`, `cardsRecycled`, `hpLost.cause "decree" \| "bloodPact"`, `Action` mới | 2, 4, 5 |
| `packages/data/moon-phases.json`, `src/schema.ts`, `src/load-game-data.ts` | 24 lệnh + ưu đãi, zod, kiểm chéo | 2 |
| `packages/rules/src/moon.ts` | `phaseModifiers`, `decreeModifier`, `rollMoon`, `enterPhase` | 2, 3 |
| `packages/rules/src/{create-combat,pvp/create,coop/create}.ts` | Gọi `rollMoon` | 2 |
| `packages/rules/src/effects.ts` | Lệnh damage / status / Chiêm Bài / shiftMoon | 3, 4 |
| `packages/rules/src/turn.ts`, `turn-passives.ts`, `enemy-turn.ts`, `intent.ts` | Lệnh đầu / cuối lượt, quỹ địch, Giữ Giáp | 3, 4, 5 |
| `packages/rules/src/draw.ts` | `discardUnplayed` (Đoạn Tuyệt dùng chung) | 5 |
| `packages/rules/src/apply-action.ts` | `discardCard`, `bloodPact` | 5 |
| `packages/rules/src/bot.ts` | Đọc lệnh; Hủy / Huyết Tế; Nguyệt tính | 2, 6 |
| `packages/rules/test/moon-decrees.test.ts` (mới), `test/helpers.ts` | T314–T325 | 2–6 |
| `packages/data/enemies.json` | Nguyệt tính | 6 |
| `apps/server/src/routes/runs.ts`, `src/realtime/protocol.ts` | Schema action mới | 5 |
| `apps/client/src/ui/{theme,card-tooltip}.ts`, `scenes/combat-scene.ts` | Tooltip pha / địch, bỏ "kế tiếp", nút Hủy / Huyết Tế | 7 |
| `docs/playtest-notes.md` | Số đo | 8 |

---

### Task 1: Tài liệu

**Files:** `docs/superpowers/specs/2026-09-30-nguyet-luan-redesign-design.md`, `docs/01-combat-rules.md` (§2, §3.1, §3.3, §5, §7, §9, §10, §15, §16), `docs/02-data-schema.md`, `docs/00-gdd.md` §3.3, `docs/03-prototype-content.md`, `docs/04-glossary.md`, `docs/05-ui-combat-screen.md`, `docs/06-test-scenarios.md`, `docs/07-implementation-plan.md`, `docs/16-server-api.md`, `CLAUDE.md`

- [ ] **Step 1: Ghi các điểm plan làm rõ spec** vào spec (§4, §4.1, §4.2) và `01` §7:
  1. **Luồng RNG phụ.** `rollMoon` bốc từ luồng phụ `seed = (rngState ^ 0x6d2b79f5) >>> 0` (lấy `rngState` lúc gọi) và **không** đổi `state.rngState`. Spec ghi "RNG trong state"; luồng phụ giữ nguyên thứ tự xáo bài / lên chuỗi, bớt vỡ test và replay. Vẫn tất định theo seed.
  2. **Đoạn Tuyệt** là **mất HP** (`hpLost cause "decree"`, không qua giáp, không phải đòn). Lá bị bỏ vì Tàn Chiêu có chủ đã ngã nên không có đơn vị nguồn cho `dealDamage`. Spec ghi "gây 2 damage"; sửa thành "mất 2 HP".
  3. **Mốc theo lượt / vòng:**
     - **Tập Kích:** "đầu tiên mỗi lượt của mỗi bên" dùng `CombatState.firstHitKeys?: string[]` (khóa `"p<seat>"` hoặc `"enemy"`). Xóa khóa của bên đó khi bắt đầu lượt của bên đó. Hit của Linh Thú tính cho ghế chủ.
     - **Thế Thủ:** dùng `UnitState.shieldUsed?: true`, xóa ở `advanceRound`.
  4. **Liên Kích:**
     - Lá: `PlayerState.attackCardsThisTurn?` +1 sau khi một lá `type: "attack"` giải quyết xong. Lá đang đánh được +2 mỗi hit nếu giá trị ≥ 1 lúc bắt đầu đánh.
     - Kẻ địch: trong `runEnemyTurn`, chiêu `kind` `attack` / `attackDefend` được +2 nếu **trước nó** trong cùng chuỗi của kẻ địch đó đã thi hành một chiêu `attack` / `attackDefend`.
  5. **Thế Cân:**
     - PvE / co-op: chạy **một lần mỗi vòng**, ở đầu lượt người chơi của ghế 0. Hero còn sống HP cao nhất của **mỗi ghế** và kẻ địch còn sống HP cao nhất bị Suy Yếu 1.
     - PvP: đầu lượt mỗi ghế, Hero HP cao nhất **của ghế đó** bị Suy Yếu 2 (thời hạn PvP ×2).
     - Hòa HP → vị trí nhỏ nhất.
  6. **Mầm Sống / Đoàn Viên:**
     - Hồi phẳng, **không** nhân hệ số hồi (pha của hai lệnh này không có lệnh hồi ×).
     - Người chơi: sau Huyết Nguyệt (bước 3.1.4). Kẻ địch: sau tick trạng thái đầu lượt địch.
     - "Mọi đơn vị" gồm Linh Thú.
  7. **Nguyệt Chiếu:** gỡ Ẩn Thân khi `moonIndex` đổi **vào** Trăng Tròn (cuối vòng, `shiftMoon`, Chọn Pha) và khi trận bắt đầu ở Trăng Tròn (`enterPhase`).
  8. **Thiên Bình** chỉ cộng cho debuff có thời hạn: `weak`, `vulnerable`, `mark` (giao của `DEBUFF_STATUSES` và `DURATION_STATUSES`). PvP cộng `+1 × 2`.
- [ ] **Step 2: DỪNG — hỏi người dùng xác nhận** các điểm 1–8 và việc **ghi lại T213 ở cuối mỗi Task 2–6** (spec ghi "một lần").
- [ ] **Step 3: Viết tài liệu luật**:
  - `01` §7: viết lại theo spec §3–§4 và các điểm Step 1.
  - `01` §2 bước 3: `rollMoon` + ghi đè `start`.
  - `01` §3.1 / §3.3: điểm gắn lệnh đầu / cuối lượt theo thứ tự trong Task 4–5.
  - `01` §5: Hủy Bài, Huyết Tế.
  - `01` §9: quỹ địch Nguyệt Sinh, Liên Kích chuỗi, Mầm Sống / Đoàn Viên của địch, Giữ Giáp.
  - `01` §10: Tập Kích, Thế Thủ, Liên Kích, Phản Chấn.
  - `02`: schema `moon-phases.json` (spec §7) + `CombatState.moonDecrees` + `CombatStart.decrees` + action mới.
  - `00` §3.3, `03` (Nguyệt tính, spec §5), `04`, `05` (spec §6), `06` (T314–T325 theo spec §9), `16` (action mới trong schema phiếu / realtime).
  - `07` + `CLAUDE.md`: "Giai đoạn hiện tại: Nguyệt Luân mới (chen trước 7c.4) — `docs/superpowers/specs/2026-09-30-nguyet-luan-redesign-design.md`".
- [ ] **Step 4: Commit**

```bash
git add docs CLAUDE.md
git commit -m "Nguyet Luan redesign: rule docs"
```

---

### Task 2: Dữ liệu, bốc lệnh, ưu đãi tag (T314–T316)

**Files:**
- Modify: `packages/rules/src/types/{static,state,events}.ts`, `packages/data/moon-phases.json`, `packages/data/src/schema.ts`, `packages/data/src/load-game-data.ts`, `packages/rules/src/moon.ts`, `packages/rules/src/{create-combat,pvp/create,coop/create}.ts`, `packages/rules/src/bot.ts` (dòng 88, 208), `apps/client/src/ui/theme.ts` (`describePhase`), `packages/rules/src/index.ts`, `packages/rules/test/helpers.ts`
- Create: `packages/rules/test/moon-decrees.test.ts`

**Interfaces:**
- Produces:
  - `MoonModifier` (union mở rộng, ở dưới), `MoonDecreeDef { id; name; text; modifiers: MoonModifier[] }`, `MoonPhaseDef { index; id; name; icon; tagBonus: MoonModifier[]; tagBonusText: string; decrees: MoonDecreeDef[] }`
  - `CombatStart.decrees?: Partial<Record<MoonPhaseId, string>>`; `CombatState.moonDecrees: string[]`
  - `phaseModifiers(data, state, index?: number): MoonModifier[]`
  - `decreeModifier<T extends MoonModifier["type"]>(data, state, type: T): Extract<MoonModifier, { type: T }> | undefined`
  - `rollMoon(data, state, start: CombatStart | undefined, events): void`
  - `currentDecree(data, state, index?: number): MoonDecreeDef | undefined`
  - Test helper `makeTestCombat({ decrees?: "real" })`: mặc định **tắt mọi lệnh** (xóa `modifiers` của lệnh) và đặt `start.moonIndex = 1` để test cũ giữ nguyên bối cảnh.

- [ ] **Step 1: Kiểu** (`types/static.ts`), thay `MoonModifier` / `MoonPhaseDef`:

```ts
export type MoonModifier =
  | { type: "damageMultiplierForTag"; tag: CardTag; multiplier: number }
  | { type: "stealthDurationBonus"; amount: number }
  | { type: "costModifierForTag"; tag: CardTag; amount: number; min: number; while?: "bloodMoon" }
  | { type: "healMultiplier"; multiplier: number }
  | { type: "armorMultiplier"; multiplier: number }
  // Nguyệt Lệnh only (`01` §7.3):
  | { type: "firstHitBonus"; amount: number }
  | { type: "turnMoonPowerBonus"; amount: number }
  | { type: "turnStartDraw"; amount: number }
  | { type: "turnStartHeal"; amount: number; target: "all" | "lowestRatio" }
  | { type: "debuffDurationBonus"; amount: number }
  | { type: "turnStartStatusOnHighestHp"; status: StatusId; amount: number }
  | { type: "firstSingleHitReduction"; amount: number }
  | { type: "attackChainBonus"; amount: number }
  | { type: "buffMultiplier"; statuses: StatusId[]; multiplier: number }
  | { type: "stealthSuppressed" }
  | { type: "discardForMoonPower"; perTurn: number; moonPower: number }
  | { type: "discardDamage"; amount: number }
  | { type: "bloodPact"; hp: number; draw: number }
  | { type: "reflectMultiplier"; multiplier: number }
  | { type: "keepArmor" }
  | { type: "chooseCardExtraLook"; amount: number }
  | { type: "freeChooseCard"; look: number }
  | { type: "recycleDiscard"; count: number };

/** Modifier types that only Nguyệt Lệnh may carry (not relics, augments, moon relics). */
export const DECREE_ONLY_MODIFIERS: ReadonlySet<MoonModifier["type"]> = new Set([
  "firstHitBonus", "turnMoonPowerBonus", "turnStartDraw", "turnStartHeal", "debuffDurationBonus",
  "turnStartStatusOnHighestHp", "firstSingleHitReduction", "attackChainBonus", "buffMultiplier",
  "stealthSuppressed", "discardForMoonPower", "discardDamage", "bloodPact", "reflectMultiplier",
  "keepArmor", "chooseCardExtraLook", "freeChooseCard", "recycleDiscard",
]);

export interface MoonDecreeDef {
  id: string;
  name: string;
  text: string;
  modifiers: MoonModifier[];
}

export interface MoonPhaseDef {
  index: number;
  id: MoonPhaseId;
  name: string;
  icon: string;
  tagBonus: MoonModifier[];
  tagBonusText: string;
  decrees: MoonDecreeDef[];
}
```
`CombatStart` thêm `decrees?: Partial<Record<MoonPhaseId, string>>`. `CombatState` thêm `/** Nguyệt Lệnh id per phase index (`01` §7.3). */ moonDecrees: string[];`. `events.ts` thêm `| { type: "moonDecreesRolled"; moonIndex: number; decrees: string[] }`.

Vì `DECREE_ONLY_MODIFIERS` là giá trị (không chỉ kiểu), đặt nó trong `types/static.ts` chỉ khi file đó đã export giá trị khác. Nếu không, đặt ở `moon.ts` và export từ `index.ts`.

- [ ] **Step 2: `moon-phases.json`** — thay toàn bộ file bằng 8 pha theo bảng spec §3–§4 (24 lệnh). Pha 2 mẫu:

```json
{
  "index": 2, "id": "firstQuarter", "name": "Bán Nguyệt", "icon": "🌓",
  "tagBonus": [{ "type": "costModifierForTag", "tag": "control", "amount": -1, "min": 0 }],
  "tagBonusText": "Lá khống chế −1 Nguyệt Lực",
  "decrees": [
    { "id": "thien_binh", "name": "Thiên Bình", "text": "Debuff có thời hạn mới được áp +1 thời hạn.",
      "modifiers": [{ "type": "debuffDurationBonus", "amount": 1 }] },
    { "id": "the_can", "name": "Thế Cân", "text": "Đầu vòng, Hero HP cao nhất và kẻ địch HP cao nhất bị Suy Yếu 1.",
      "modifiers": [{ "type": "turnStartStatusOnHighestHp", "status": "weak", "amount": 1 }] },
    { "id": "the_thu", "name": "Thế Thủ", "text": "Đòn đơn mục tiêu đầu tiên mỗi đơn vị nhận trong vòng giảm 3 damage.",
      "modifiers": [{ "type": "firstSingleHitReduction", "amount": 3 }] }
  ]
}
```

Modifier từng lệnh:

| Pha | Ưu đãi (`tagBonus`) | Lệnh → `modifiers` |
|---|---|---|
| 0 `new` | `damageMultiplierForTag assassin 1.5` | `am_da` → `healMultiplier 0.5`; `bong_mo` → `stealthDurationBonus 1`; `tap_kich` → `firstHitBonus 3` |
| 1 `waxingCrescent` | `costModifierForTag scheme −1 min 0` | `nguyet_sinh` → `turnMoonPowerBonus 1`; `khai_tri` → `turnStartDraw 1`; `mam_song` → `turnStartHeal 2 all` |
| 2 `firstQuarter` | `control −1` | như mẫu |
| 3 `waxingGibbous` | `attack −1` | `lien_kich` → `attackChainBonus 2`; `cuong_nguyet` → `buffMultiplier [strength, empower] 2`; `pha_giap` → `armorMultiplier 0.5` |
| 4 `full` | `harmony −1` | `vien_nguyet` → `healMultiplier 2`; `nguyet_chieu` → `stealthSuppressed`; `doan_vien` → `turnStartHeal 5 lowestRatio` |
| 5 `waningGibbous` | `forbidden −1` | `xa_than` → `discardForMoonPower perTurn 2 moonPower 1`; `doan_tuyet` → `discardDamage 2`; `huyet_te` → `bloodPact hp 3 draw 2` |
| 6 `lastQuarter` | `ward −1` | `huyen_giap` → `armorMultiplier 1.5`; `phan_chan` → `reflectMultiplier 2`; `giu_giap` → `keepArmor` |
| 7 `waningCrescent` | `moon −1` | `chiem_tinh` → `chooseCardExtraLook 2`; `boi_nguyet` → `freeChooseCard 3`; `luan_hoi` → `recycleDiscard 2` |

`text` và `tagBonusText` lấy nguyên câu hiệu ứng ở spec §3–§4 (Đoạn Tuyệt: "…người chơi đối phương có HP thấp nhất mất 2 HP", theo Task 1).

- [ ] **Step 3: Schema + kiểm chéo**
  - `schema.ts`: thêm các biến thể mới vào `moonModifierSchema`. `moonPhaseDefSchema` bỏ `modifiers`, thêm `tagBonus: z.array(moonModifierSchema)`, `tagBonusText: z.string().min(1)`, `decrees: z.array(z.object({ id: idSchema, name: z.string().min(1), text: z.string().min(1), modifiers: z.array(moonModifierSchema) })).length(3)`.
  - `load-game-data.ts` → `collectCrossCheckErrors`:
    - id lệnh duy nhất trên toàn file;
    - `DECREE_ONLY_MODIFIERS` không được xuất hiện trong `tagBonus`, `runRelics` / `runAugments` `.modifiers`, `relics` (mọi cấp) `.modifiers`.

    Thông báo lỗi dạng `moon decree "<id>" is duplicated` / `run relic "<id>": modifier "<type>" is decree-only`.
- [ ] **Step 4: `moon.ts`** — thêm và sửa `activeModifiers`:

```ts
import { nextRandom } from "./rng";

/** The Nguyệt Lệnh rolled for phase `index` (default: the current phase). */
export function currentDecree(data: GameData, state: CombatState, index = state.moonIndex): MoonDecreeDef | undefined {
  const id = state.moonDecrees?.[index];
  return data.moonPhases[index]?.decrees.find((decree) => decree.id === id);
}

/** Tag bonus + rolled decree of a phase (`01` §7). */
export function phaseModifiers(data: GameData, state: CombatState, index = state.moonIndex): MoonModifier[] {
  return [...(data.moonPhases[index]?.tagBonus ?? []), ...(currentDecree(data, state, index)?.modifiers ?? [])];
}

export function decreeModifier<T extends MoonModifier["type"]>(
  data: GameData,
  state: CombatState,
  type: T,
): Extract<MoonModifier, { type: T }> | undefined {
  return phaseModifiers(data, state).find((m): m is Extract<MoonModifier, { type: T }> => m.type === type);
}

/**
 * Start phase and one decree per phase (`01` §7.3). A side stream seeded from
 * `rngState` keeps the combat RNG (decks, intents) where it was.
 */
export function rollMoon(data: GameData, state: CombatState, start: CombatStart | undefined, events: CombatEvent[]): void {
  let rng = (state.rngState ^ 0x6d2b79f5) >>> 0;
  const roll = (n: number): number => {
    const next = nextRandom(rng);
    rng = next.rngState;
    return Math.floor(next.value * n);
  };
  state.moonIndex = roll(data.moonPhases.length);
  state.moonDecrees = data.moonPhases.map((phase) => phase.decrees[roll(phase.decrees.length)]!.id);
  if (start?.moonIndex !== undefined) state.moonIndex = start.moonIndex;
  for (const phase of data.moonPhases) {
    const id = start?.decrees?.[phase.id];
    if (id !== undefined) state.moonDecrees[phase.index] = id;
  }
  events.push({ type: "moonDecreesRolled", moonIndex: state.moonIndex, decrees: [...state.moonDecrees] });
}
```
  Trong `activeModifiers`, thay `data.moonPhases[state.moonIndex]?.modifiers ?? []` bằng `phaseModifiers(data, state)`. Kiểm `nextRandom(...).value` nằm trong `[0, 1)` bằng cách đọc `rng.ts` trước khi dùng.
- [ ] **Step 5: Gọi `rollMoon`**
  - `create-combat.ts`: thay dòng `if (setup.start?.moonIndex !== undefined) state.moonIndex = …` bằng `rollMoon(data, state, setup.start, events);` (giữ khối Huyết Nguyệt đầu trận ngay sau). Thêm `moonDecrees: []` vào literal `state`.
  - `pvp/create.ts`, `coop/create.ts`: thêm `moonDecrees: []` vào literal và gọi `rollMoon(data, state, undefined, events);` ngay sau literal, trước `drawCards` / `planEnemyIntents`.
- [ ] **Step 6: Chỗ đọc `phase.modifiers` cũ**
  - `bot.ts:88` (`landingScore`) và `bot.ts:208` (`bestMoonOffset`) → `phaseModifiers(data, state, <index>)`.
  - `theme.ts` → `describePhase(data, state, index)`: trả `"<tên lệnh>: <text lệnh> · <tagBonusText>"` (dùng `currentDecree`). Cập nhật 2 chỗ gọi trong `combat-scene.ts` (vòng trăng, Chọn Pha) cho đúng chữ ký mới. Dòng "→ kế tiếp" giữ tạm; Task 7 mới bỏ.
- [ ] **Step 7: Test helper** (`test/helpers.ts`):

```ts
/** Removes every decree effect: phases keep only their tag bonus (legacy-free test baseline). */
export function withoutDecrees(data: GameData): void {
  for (const phase of data.moonPhases) for (const decree of phase.decrees) decree.modifiers = [];
}
```
  `makeTestCombat`:
  - thêm tuỳ chọn `decrees?: "real"` và `start?: CombatStart`;
  - khi không có `decrees: "real"` → gọi `withoutDecrees(data)` trước `overrides.mutateData`;
  - truyền `start: overrides.start ?? { moonIndex: 1 }` vào `createCombat`.
- [ ] **Step 8: Test T314–T316 (đỏ trước, xanh sau)** trong `moon-decrees.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createCombat, createPvpCombat, phaseModifiers, starterDeck } from "../src/index";
import { makeTestCombat, rawTestInput, testData } from "./helpers";
import { parseGameData } from "data";

const TEAM: [string, string, string] = ["m05", "f04", "m06"];

describe("Nguyệt Luân — dữ liệu và bốc lệnh", () => {
  it("T314: every phase has exactly 3 decrees with unique ids; decree-only modifiers stay out of relics", () => {
    const data = testData();
    const ids = data.moonPhases.flatMap((phase) => phase.decrees.map((d) => d.id));
    expect(data.moonPhases.every((phase) => phase.decrees.length === 3)).toBe(true);
    expect(new Set(ids).size).toBe(24);
    const raw = rawTestInput();
    raw.runRelics[0].modifiers = [{ type: "keepArmor" }];
    expect(() => parseGameData(raw)).toThrow(/decree-only/);
  });

  it("T315: start phase and decrees are rolled from the seed without moving the combat RNG; start overrides after the roll", () => {
    const data = testData();
    const make = (seed: number, start?: object) =>
      createCombat(data, { heroIds: TEAM, encounterId: "enc_01", seed, deckCardIds: starterDeck(data, TEAM), ...(start ? { start } : {}) });
    const a = make(42).state;
    expect(make(42).state.moonDecrees).toEqual(a.moonDecrees);
    expect(a.moonDecrees).toHaveLength(8);
    a.moonDecrees.forEach((id, i) => expect(data.moonPhases[i]!.decrees.map((d) => d.id)).toContain(id));
    const seeds = Array.from({ length: 40 }, (_, i) => make(i + 1).state.moonIndex);
    expect(new Set(seeds).size).toBeGreaterThan(3);
    const pinned = make(42, { moonIndex: 4, decrees: { full: "doan_vien" } }).state;
    expect(pinned.moonIndex).toBe(4);
    expect(pinned.moonDecrees[4]).toBe("doan_vien");
    expect(pinned.players[0]!.drawPile).toEqual(a.players[0]!.drawPile);
    expect(pinned.rngState).toBe(a.rngState);
    const side = (heroIds: [string, string, string]) => ({ heroIds, loadout: { heroes: {}, pvp: true as const } });
    const pvp = createPvpCombat(data, { seed: 42, players: [side(TEAM), side(["f03", "f02", "m01"])] });
    expect(pvp.state.moonDecrees).toHaveLength(8);
    expect(pvp.events.some((e) => e.type === "moonDecreesRolled")).toBe(true);
  });

  it("T316: tag bonus is −1 (assassin ×1.5 at new moon) and stacks with run-relic modifiers", () => {
    const plain = makeTestCombat({ heroIds: ["f03", "f04", "m06"], start: { moonIndex: 2 }, setup: (s) => setHand(s, ["f03_han_an"]) });
    expect(phaseModifiers(plain.data, plain.state)).toEqual([{ type: "costModifierForTag", tag: "control", amount: -1, min: 0 }]);
    expect(getEffectiveCost(plain.data, plain.state, p0(plain.state).hand[0]!)).toBe(1); // Hàn Ấn: 2 − 1

    const relic = makeTestCombat({
      heroIds: ["f03", "f04", "m06"],
      start: { moonIndex: 2 },
      runRelicIds: ["t_control_relic"],
      mutateData: (d) => {
        d.runRelics["t_control_relic"] = { id: "t_control_relic", name: "T", text: "T", modifiers: [{ type: "costModifierForTag", tag: "control", amount: -1, min: 0 }] };
      },
      setup: (s) => setHand(s, ["f03_han_an"]),
    });
    expect(getEffectiveCost(relic.data, relic.state, p0(relic.state).hand[0]!)).toBe(0);

    const dark = makeTestCombat({ start: { moonIndex: 0 } });
    expect(phaseModifiers(dark.data, dark.state)).toEqual([{ type: "damageMultiplierForTag", tag: "assassin", multiplier: 1.5 }]);
  });
});
```

Import thêm `getEffectiveCost` (từ `../src/index`) và `p0`, `setHand` (từ `./helpers`). Kiểm lại cost gốc của `f03_han_an` trong `cards.json` (2 lúc viết plan) trước khi chạy; nếu khác thì sửa số kỳ vọng theo `cost − 1`.

- [ ] **Step 9: Chạy và sửa test cũ**

Run: `pnpm --filter rules test`
Expected: T314–T316 xanh. Các test cũ đỏ nếu kiểm hiệu ứng pha cũ (cost −2, hồi ×2 ở Trăng Tròn, giáp ×1.5, Ẩn Thân +1):
- Sửa bằng cách cho test đó `decrees: "real"` và `start: { moonIndex: X, decrees: { <pha>: "<lệnh cũ tương ứng>" } }` (`vien_nguyet`, `huyen_giap`, `bong_mo`).
- Đổi kỳ vọng −2 thành −1.
- **Không** nới kỳ vọng khác. Test đỏ vì lý do khác thì dừng và tìm nguyên nhân.
- [ ] **Step 10: Ghi lại T213** (đã duyệt ở Task 1), rồi `pnpm test` + `pnpm typecheck` xanh.
- [ ] **Step 11: Commit**

```bash
git add packages apps/client/src
git commit -m "Nguyet Luan: decree data, seeded start phase and decree roll, tag bonus (T314-T316)"
```

---

### Task 3: Lệnh chiến đấu — damage, giáp, trạng thái (T317, T318, T320)

**Files:** `packages/rules/src/effects.ts`, `packages/rules/src/enemy-turn.ts`, `packages/rules/src/turn.ts`, `packages/rules/src/apply-action.ts`, `packages/rules/src/moon.ts`, `packages/rules/src/types/state.ts`, `packages/rules/test/moon-decrees.test.ts`

**Interfaces:**
- Consumes: `decreeModifier`, `phaseModifiers` (Task 2).
- Produces:
  - `EffectContext.attackChain?: true`
  - `CombatState.firstHitKeys?: string[]`, `UnitState.shieldUsed?: true`, `PlayerState.attackCardsThisTurn?: number`
  - `hitKey(state, unit): string` (`"p<seat>"` / `"enemy"`)
  - `enterPhase(data, state, events): void` (Nguyệt Chiếu)

- [ ] **Step 1: Test (đỏ)** — dùng `makeTestCombat({ decrees: "real", start: { moonIndex, decrees: { … } } })` và lá tiêm (`injectCard`), kẻ địch đứng yên (`makeEnemiesIdle`):
  - **T317:**
    - Ám Dạ: `heal 10` lên Hero thiếu 10 HP → hồi 5.
    - Viên Nguyệt: hồi 10 → 20.
    - Phá Giáp: `gainArmor 10` → 5.
    - Huyền Giáp → 15.
    - Bóng Mờ: `applyStatus stealth 1` → giá trị 2.
    - Phản Chấn: kẻ địch có `reflect 3`, lá đánh nó → người đánh mất 6.
  - **T318:**
    - Tập Kích: lá `damage 5` đầu tiên → 8, lá thứ hai → 5. Chiêu địch đầu tiên của lượt địch cũng +3.
    - Thế Thủ: hai lá đơn mục tiêu `damage 5` vào cùng kẻ địch trong một vòng → 2 rồi 5. Lá `allEnemies` không bị giảm.
    - Liên Kích: lá tấn công thứ nhất `damage 4` → 4, lá tấn công thứ hai → 6 (mỗi hit). Lá kỹ năng ở giữa không tính. Chuỗi địch `[attack 4, attack 4]` → 4 rồi 6.
  - **T320:**
    - Thiên Bình: `applyStatus weak 1` → 2; `stealth` không đổi.
    - Cuồng Nguyệt: `strength 1` → 2.
    - Nguyệt Chiếu: Hero có Ẩn Thân, `shiftMoon` vào Trăng Tròn → mất Ẩn Thân; áp Ẩn Thân trong pha → không có.
- [ ] **Step 2: Chạy — đỏ.** `pnpm --filter rules test -- moon-decrees`
- [ ] **Step 3: Cài đặt**
  - `effects.ts` → `computeDamageAmount`, ngay sau khi tính `flat` (trước hệ số):

```ts
  const chain = decreeModifier(data, state, "attackChainBonus");
  if (chain && ctx.attackChain) flat += chain.amount;
  const first = decreeModifier(data, state, "firstHitBonus");
  if (first) {
    const key = hitKey(state, ctx.source);
    state.firstHitKeys ??= [];
    if (!state.firstHitKeys.includes(key)) {
      state.firstHitKeys.push(key);
      flat += first.amount;
    }
  }
```
  `hitKey`: `unit.side === "enemy" ? "enemy" : \`p${(isSummon(unit) ? ownerOf(state, unit) : (unit as HeroState)).player}\``. `computeDamageAmount` cũng được `preview.ts` gọi. Tách phần Tập Kích thành một tham số `consume: boolean` (mặc định `true`, `preview` truyền `false`) để xem trước không đánh dấu hit.
  - `dealDamage(…, single = false)`: sau `const amount = computeDamageAmount(...)`:

```ts
  let final = amount;
  const shield = decreeModifier(data, state, "firstSingleHitReduction");
  if (shield && single && !target.shieldUsed) {
    target.shieldUsed = true;
    final = Math.max(0, final - shield.amount);
  }
```
  (dùng `final` thay `amount` phía dưới). Case `damage` gọi `dealDamage(..., effect.to === "chosen")`; `missingHpDamage` / `scaledDamage` tương tự. Phản Đòn: `loseHp(data, ctx.source, reflect * (decreeModifier(data, state, "reflectMultiplier")?.multiplier ?? 1), "reflect", events)`.
  - `applyStatus` case: sau khi tính `amount`:

```ts
      if (effect.status === "stealth" && decreeModifier(data, state, "stealthSuppressed")) return;
      const buff = decreeModifier(data, state, "buffMultiplier");
      if (buff?.statuses.includes(effect.status)) amount *= buff.multiplier;
      const extend = decreeModifier(data, state, "debuffDurationBonus");
      if (extend && debuff && DURATION_STATUSES.has(effect.status)) amount += extend.amount * durationFactor;
```
  - `moon.ts` → `enterPhase(data, state, events)`: nếu `decreeModifier(data, state, "stealthSuppressed")` thì gỡ `stealth` của mọi đơn vị (`removeStatus`). Gọi ở `advanceRound` (sau đổi pha), case `shiftMoon` (sau đổi pha), và cuối `rollMoon`.
  - Liên Kích lá: `apply-action.ts` → `playCard`, trước khi giải quyết effect: `const attackChain = card.type === "attack" && (player.attackCardsThisTurn ?? 0) > 0;` đưa vào `ctx` (`...(attackChain ? { attackChain: true as const } : {})`). Sau khi giải quyết: `if (card.type === "attack") player.attackCardsThisTurn = (player.attackCardsThisTurn ?? 0) + 1;`. `startPlayerTurn` đặt `delete player.attackCardsThisTurn`.
  - Liên Kích địch: `enemy-turn.ts`, trong vòng chuỗi của mỗi kẻ địch, giữ `let attacked = false`. `ctx.attackChain = attacked && (intent.kind === "attack" || intent.kind === "attackDefend")`, rồi sau khi thi hành: `if (intent.kind === "attack" || intent.kind === "attackDefend") attacked = true;`.
  - Mốc lượt / vòng:
    - `startPlayerTurn`: `state.firstHitKeys = (state.firstHitKeys ?? []).filter((k) => k !== \`p${player.index}\`)`.
    - `runEnemyTurn` đầu: bỏ khóa `"enemy"`.
    - `advanceRound`: `delete unit.shieldUsed` cho mọi đơn vị.
- [ ] **Step 4: Chạy — xanh**; sửa test cũ nếu vỡ theo quy tắc Task 2 Step 9. Ghi lại T213. `pnpm test` + `pnpm typecheck` xanh.
- [ ] **Step 5: Commit** — `git commit -m "Nguyet Luan: combat decrees (T317, T318, T320)"`

---

### Task 4: Lệnh đầu lượt, Chiêm Bài (T319, T323)

**Files:** `packages/rules/src/turn.ts`, `turn-passives.ts`, `enemy-turn.ts`, `intent.ts`, `effects.ts`, `packages/rules/test/moon-decrees.test.ts`

**Interfaces:**
- Consumes: `decreeModifier` (Task 2).
- Produces: `decreeTurnHeal(data, state, units: UnitState[], events)`, `decreeWeakHighest(data, state, events)` (trong `turn.ts`).

- [ ] **Step 1: Test (đỏ)**
  - **T319:**
    - Nguyệt Sinh: sang lượt 2 trong pha 1 → quỹ người chơi = gốc + 1; `planEnemyIntents` trong pha → `enemy.moonPower` = gốc + 1.
    - Khai Trí: đầu lượt tay 7 lá (6 + 1); tay đã 8 → lá thứ 9 vào chồng bỏ.
    - Mầm Sống: Hero −5 HP, đầu lượt hồi 2; kẻ địch −5, đầu lượt địch hồi 2.
    - Đoàn Viên: chỉ đơn vị tỉ lệ HP thấp nhất mỗi bên hồi 5.
    - Thế Cân: Hero HP cao nhất và kẻ địch HP cao nhất nhận `weak 1` đúng một lần mỗi vòng (PvE), PvP nhận `weak 2` ở ghế đang tới lượt.
  - **T323:**
    - Chiêm Tinh: lá `chooseCard look 2` mở 4 lựa chọn.
    - Bói Nguyệt: đầu lượt mở Chiêm Bài 3. Cùng Vạn Kim (M03 đã thăng cấp) → mở Vạn Kim trước, trả lời xong mới mở Bói Nguyệt. Rồi mới tới Chọn Pha.
- [ ] **Step 2: Chạy — đỏ.**
- [ ] **Step 3: Cài đặt**
  - `turn.ts` → `startPlayerTurn`:
    - Khi tính quỹ: `+ (decreeModifier(data, state, "turnMoonPowerBonus")?.amount ?? 0)`.
    - Sau khối Huyết Nguyệt: `decreeTurnHeal(data, state, [...heroesOf(state, player.index), ...mySummons], events)`; và nếu `decreeModifier(data, state, "turnStartStatusOnHighestHp")` thì chạy Thế Cân theo điểm 5 của Task 1.
    - Sau `refillHand`: `const draw = decreeModifier(data, state, "turnStartDraw"); if (draw) drawCards(data, state, player, draw.amount, events);`.
  - `decreeTurnHeal`:

```ts
function decreeTurnHeal(data: GameData, state: CombatState, units: UnitState[], events: CombatEvent[]): void {
  const heal = decreeModifier(data, state, "turnStartHeal");
  if (!heal) return;
  const living = units.filter((unit) => unit.alive && unit.hp > 0);
  const targets = heal.target === "all"
    ? living
    : living.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || a.position - b.position).slice(0, 1);
  for (const unit of targets) {
    const healed = Math.min(unit.maxHp - unit.hp, heal.amount);
    if (healed <= 0) continue;
    unit.hp += healed;
    events.push({ type: "healed", targetId: unit.id, amount: healed });
  }
}
```
  - `enemy-turn.ts` → `runEnemyTurn`: sau tick trạng thái địch gọi `decreeTurnHeal(data, state, state.enemies, events)` (export từ `turn.ts`). Bước xóa giáp để nguyên (Giữ Giáp ở Task 5).
  - `intent.ts` → `planEnemyIntents`: `const fund = baseMoonPower(...) + enemy.moonReserve + (decreeModifier(data, state, "turnMoonPowerBonus")?.amount ?? 0);`.
  - `effects.ts` → case `chooseCard`: `extra += decreeModifier(data, state, "chooseCardExtraLook")?.amount ?? 0`.
  - `turn-passives.ts` → `seatTurnStart`, sau vòng Vạn Kim, trước Chọn Pha:

```ts
  const omen = decreeModifier(data, state, "freeChooseCard");
  const seer = heroes.find((hero) => hero.alive);
  if (omen && seer) {
    if (player.pendingChoice === null) {
      resolveEffects(data, state, [{ type: "chooseCard", look: omen.look }], { source: seer, noHooks: true }, events);
    } else {
      player.omenPending = true;
    }
  }
```
  `PlayerState.omenPending?: true`. Trong `applyAction` case `chooseCard`, trước `openMoonChoice`: nếu `nextSeat.omenPending` thì xóa cờ và mở Bói Nguyệt như trên, và **chỉ** gọi `openMoonChoice` khi không còn `pendingChoice`. Ghi thứ tự Vạn Kim → Bói Nguyệt → Chọn Pha vào `01` §3.1 bước 11.
- [ ] **Step 4: Chạy — xanh**; sửa test cũ theo quy tắc; ghi lại T213; `pnpm test` + `pnpm typecheck` xanh.
- [ ] **Step 5: Commit** — `git commit -m "Nguyet Luan: turn-start decrees, Chiem Bai decrees (T319, T323)"`

---

### Task 5: Hủy Bài, Huyết Tế, Đoạn Tuyệt, Giữ Giáp, Luân Hồi (T321, T322)

**Files:** `packages/rules/src/types/events.ts` (Action + event), `types/state.ts`, `packages/rules/src/draw.ts`, `turn.ts`, `enemy-turn.ts`, `apply-action.ts`, `packages/rules/src/run/run.ts` (nếu `RunAction` combat bọc `Action` qua schema riêng), `apps/server/src/routes/runs.ts`, `apps/server/src/realtime/protocol.ts`, `packages/rules/test/moon-decrees.test.ts`, `apps/server/test/runs.test.ts`

**Interfaces:**
- Produces:
  - `Action` thêm `| { type: "discardCard"; instanceId: string; player?: number } | { type: "bloodPact"; heroId: string; player?: number }`
  - `CombatEvent` thêm `| { type: "cardsRecycled"; instanceIds: string[]; player?: number }`; `hpLost.cause` thêm `"decree" | "bloodPact"`
  - `PlayerState.discardsThisTurn?: number`, `bloodPactUsed?: true`
  - `discardUnplayed(data, state, player, instanceIds, events): void` (`draw.ts`)

- [ ] **Step 1: Test (đỏ)**
  - **T321:**
    - `discardCard` sai pha → `"no discard decree"`; lá không trên tay → `"card not in hand"`; lần thứ 3 → `"discard limit"`.
    - Hủy hợp lệ: lá vào chồng bỏ, `moonPower +1`, event `cardDiscarded`.
    - Đoạn Tuyệt: hủy (với Xả Thân tiêm cùng pha qua `mutateData`), Tàn Chiêu cuối lượt, và lá vượt `handLimit` khi rút → mỗi lá: kẻ địch HP thấp nhất `hpLost 2 cause "decree"`.
  - **T322:**
    - `bloodPact` sai pha / Hero HP ≤ 3 / lần 2 → lỗi. Hợp lệ: Hero −3 HP (`cause "bloodPact"`), tay +2.
    - Giữ Giáp: giáp Hero còn nguyên sang lượt sau; giáp địch còn sang lượt địch.
    - Luân Hồi: đầu chồng rút là `drawPile[0]` (`drawCards` rút từ đầu mảng), nên đáy là cuối mảng. Chồng bỏ `[a, b, c]` (c mới nhất) → cuối lượt đuôi chồng rút là `[b, c]` (c nằm dưới cùng), chồng bỏ còn `[a]`, event `cardsRecycled [b, c]`.
- [ ] **Step 2: Chạy — đỏ.**
- [ ] **Step 3: Cài đặt**
  - `draw.ts`:

```ts
/** Cards leaving the hand unplayed (discard, Tàn Chiêu, hand overflow) — Đoạn Tuyệt fires per card (`01` §7.3). */
export function discardUnplayed(data: GameData, state: CombatState, player: PlayerState, instanceIds: string[], events: CombatEvent[]): void {
  if (instanceIds.length === 0) return;
  player.discardPile.push(...instanceIds);
  events.push({ type: "cardDiscarded", instanceIds, ...seatTag(state, player.index) });
  const cut = decreeModifier(data, state, "discardDamage");
  if (!cut) return;
  for (let i = 0; i < instanceIds.length; i++) {
    const foes = (state.mode === "pvp"
      ? state.heroes.filter((hero) => hero.player !== player.index)
      : state.enemies).filter((unit) => unit.alive && unit.hp > 0);
    const victim = foes.sort((a, b) => a.hp - b.hp || a.position - b.position)[0];
    if (!victim) return;
    loseHp(data, victim, cut.amount, "decree", events);
    processDeaths(data, state, events, undefined);
    if (checkCombatEnd(state, events)) return;
  }
}
```
  Dùng hàm này ở: `drawCards` (lá tràn), `addToHand` (tay đầy), `endSeatTurn` (Tàn Chiêu). Nếu import `effects.ts` từ `draw.ts` gây vòng import mà `tsc` / vitest báo lỗi, chuyển `discardUnplayed` sang `effects.ts` và cho `draw.ts` nhận một callback.
  - `endSeatTurn`, sau khi bỏ Tàn Chiêu: Luân Hồi

```ts
  const recycle = decreeModifier(data, state, "recycleDiscard");
  if (recycle && player.discardPile.length > 0) {
    const back = player.discardPile.splice(-recycle.count);
    player.drawPile.push(...back);
    events.push({ type: "cardsRecycled", instanceIds: back, ...seatTag(state, player.index) });
  }
```
    và đặt lại `delete player.discardsThisTurn; delete player.bloodPactUsed;` ở `startPlayerTurn`.
  - Giữ Giáp: trong `startPlayerTurn` và `runEnemyTurn`, bọc khối xóa giáp / gỡ Phản Đòn bằng `if (!decreeModifier(data, state, "keepArmor"))`.
  - `apply-action.ts`: hai case mới trong `switch` và trong `statusError` đối xử như `playCard` (chỉ `playerTurn`; co-op theo lượt chung):

```ts
    case "discardCard": {
      const rule = decreeModifier(data, state, "discardForMoonPower");
      if (!rule) return { ok: false, error: "no discard decree" };
      if (!seat.hand.includes(action.instanceId)) return { ok: false, error: "card not in hand" };
      if ((seat.discardsThisTurn ?? 0) >= rule.perTurn) return { ok: false, error: "discard limit" };
      const next = cloneState(state);
      const events: CombatEvent[] = [];
      const nextSeat = next.players[seat.index]!;
      nextSeat.hand = nextSeat.hand.filter((id) => id !== action.instanceId);
      nextSeat.discardsThisTurn = (nextSeat.discardsThisTurn ?? 0) + 1;
      nextSeat.moonPower += rule.moonPower;
      events.push({ type: "moonPowerChanged", value: nextSeat.moonPower, ...seatTag(next, seat.index) });
      discardUnplayed(data, next, nextSeat, [action.instanceId], events);
      return { ok: true, state: next, events };
    }
    case "bloodPact": {
      const rule = decreeModifier(data, state, "bloodPact");
      if (!rule) return { ok: false, error: "no blood pact decree" };
      if (seat.bloodPactUsed) return { ok: false, error: "blood pact used" };
      const hero = heroesOf(state, seat.index).find((h) => h.id === action.heroId);
      if (!hero?.alive || hero.hp <= rule.hp) return { ok: false, error: "invalid hero" };
      const next = cloneState(state);
      const events: CombatEvent[] = [];
      const nextSeat = next.players[seat.index]!;
      nextSeat.bloodPactUsed = true;
      loseHp(data, next.heroes.find((h) => h.id === hero.id)!, rule.hp, "bloodPact", events);
      drawCards(data, next, nextSeat, rule.draw, events);
      return { ok: true, state: next, events };
    }
```
  - Server:
    - `runs.ts` → `combatActionSchema` thêm `z.object({ type: z.literal("discardCard"), instanceId: id })` và `z.object({ type: z.literal("bloodPact"), heroId: id })`.
    - `realtime/protocol.ts` thêm hai dạng tương ứng.
    - Test server: một trận có `discardCard` hợp lệ được `replayRun` chấp nhận, action sai pha → 422 (thêm vào `runs.test.ts` như một `it("T325 (phần server): …")` — mã chung với Task 6).
- [ ] **Step 4: Chạy — xanh**; ghi lại T213; `pnpm test` + `pnpm typecheck` xanh (kể cả `apps/client`: `switch` vét cạn trên `Action` / `CombatEvent` ở client, `debug.ts`, `event-animator.ts` phải có nhánh mới, animation tạm như `cardDiscarded`).
- [ ] **Step 5: Commit** — `git commit -m "Nguyet Luan: discard, blood pact, cut, keep armor, recycle (T321, T322)"`

---

### Task 6: Nguyệt tính kẻ địch, bot, PvP / co-op (T324, T325)

**Files:** `packages/data/enemies.json`, `packages/rules/src/bot.ts`, `packages/rules/test/moon-decrees.test.ts`, `packages/rules/test/{pvp,coop}.test.ts` (nếu cần)

- [ ] **Step 1: `enemies.json`** — thêm `moonOverrides` theo spec §5 (id, tên, effect, `targeting`). Kiểm chéo sẵn có bắt `targeting` thiếu cho effect `chosen`.
- [ ] **Step 2: Test (đỏ)**
  - **T324:**
    - Khôi Lỗi lên chuỗi ở `waxingGibbous` → `puppet_moon_hammer` đứng đầu chuỗi với cost 0.
    - Bot: với tay có lá `shiftMoon 1` và kẻ địch có Nguyệt tính ở pha đích, bot **không** đánh lá đó khi lá chỉ đổi pha (dùng lại luật lá thuần Đổi Vận).
    - Bot: pha `xa_than` + tay 6 lá có 1 lá cost > quỹ → bot hủy lá đó trước khi kết thúc lượt.
    - Bot: pha `huyet_te`, Hero HP 100%, tay 3 lá → bot dùng `bloodPact`.
  - **T325:** PvP:
    - `moonDecrees` giống nhau ở `viewFor` của cả hai ghế.
    - Tập Kích tính riêng mỗi ghế.
    - Đoạn Tuyệt nhắm Hero đối thủ HP thấp nhất.

    Co-op: Thế Cân chạy đúng một lần mỗi vòng. Server: phần ở Task 5.
- [ ] **Step 3: Bot (`bot.ts`)**
  - Tính `enemyTraitPhases`: tập `phase` trong `moonOverrides` của kẻ địch còn sống, và `bloodMoonOverride` bỏ qua. Trong luật lá Đổi Vận thuần: không đánh nếu `landing` rơi vào pha thuộc tập này.
  - `knownIntents`: thêm `override.intent` của pha **kế tiếp** (`(moonIndex + 1) % 8`) vào danh sách công khai (effect của nó tính như chiêu cost 0).
  - Trước `return { type: "endTurn" }`:
    - Nếu có `discardForMoonPower` và còn lượt hủy: hủy lá không đánh được có cost cao nhất khi tay ≥ 5 lá.
    - Nếu có `bloodPact` và chưa dùng: dùng với Hero còn sống có `hp / maxHp ≥ 0.6` và HP lớn nhất, khi tay < 5 lá.

    Cả hai trả action rồi để vòng bot gọi lại.
- [ ] **Step 4: Chạy — xanh**; ghi lại T213; `pnpm test` + `pnpm typecheck` xanh.
- [ ] **Step 5: Commit** — `git commit -m "Nguyet Luan: enemy moon traits, bot, PvP/co-op checks (T324, T325)"`

---

### Task 7: Client

**Files:** `apps/client/src/ui/card-tooltip.ts`, `apps/client/src/ui/theme.ts`, `apps/client/src/scenes/combat-scene.ts`

- [ ] **Step 1: Tooltip chữ dùng chung** — tách phần dựng khung của `showCardTooltip` thành:

```ts
export function showTextTooltip(scene: Phaser.Scene, x: number, y: number, lines: string[]): Phaser.GameObjects.Container
```
  `showCardTooltip` gọi lại hàm này (hành vi không đổi).
- [ ] **Step 2: Tooltip pha** — trong `renderMoonWheel`, mỗi biểu tượng pha:
  - `setInteractive`; `pointerover` → `showTextTooltip` với các dòng: `"<icon> <tên pha>"`, `"Nguyệt Lệnh: <tên lệnh> — <text lệnh>"` (`currentDecree`), `"Ưu đãi: <tagBonusText>"`, và `"Đang diễn ra"` nếu là pha hiện tại.
  - `pointerout` → hủy tooltip (cùng cách `this.tooltip` hiện có).
- [ ] **Step 3: Bỏ dòng "→ kế tiếp: …"** trong `renderMoonWheel`. Xóa `describePhase` nếu không còn chỗ dùng; Chọn Pha vẫn dùng nó thì giữ.
- [ ] **Step 4: Tooltip kẻ địch**
  - Khung / chân dung kẻ địch `setInteractive`; `pointerover` → `showTextTooltip` với dòng tên, và mỗi `moonOverrides` thêm một dòng `"Nguyệt tính: <tên pha> — <tên chiêu>: <mô tả>"`.
  - Mô tả sinh từ effect bằng hàm `describeIntentEffects` trong `theme.ts`: damage N, giáp N, trạng thái N, hồi N. Nếu `bloodMoonOverride` có thì thêm `"Huyết Nguyệt — <tên chiêu>"`.
- [ ] **Step 5: Nút theo lệnh**
  - Khi `decreeModifier(data, state, "discardForMoonPower")`: mỗi lá trên tay có nút nhỏ `"Hủy (<còn lại>)"` ở mép dưới, gọi `this.dispatch({ type: "discardCard", instanceId })`.
  - Khi `decreeModifier(..., "bloodPact")` và `!seat.bloodPactUsed`: nút `"Huyết Tế"` cạnh nút kết thúc lượt. Bấm → chế độ chọn mục tiêu ally (dùng lại `this.targeting` với danh sách Hero còn sống HP > 3) → `dispatch({ type: "bloodPact", heroId })`.
- [ ] **Step 6: Kiểm tay trên trình duyệt** (preview dev server):
  - tooltip pha có tên lệnh đúng;
  - không còn "kế tiếp";
  - tooltip Khôi Lỗi có 2 dòng Nguyệt tính;
  - dùng debug "đặt pha trăng" để vào Trăng Khuyết Cuối có Xả Thân / Huyết Tế và bấm thử.

  Chụp màn hình.
- [ ] **Step 7: `pnpm test` + `pnpm typecheck` xanh.**
- [ ] **Step 8: Commit** — `git commit -m "Nguyet Luan: client tooltips and decree buttons"`

---

### Task 8: Mô phỏng, chỉnh số, đóng

**Files:** `packages/data/{moon-phases,enemies}.json` (chỉ số), `docs/playtest-notes.md`, `CLAUDE.md`, `docs/07-implementation-plan.md`

- [ ] **Step 1: Đo** (file tạm, không commit, xóa sau khi đo):
  - PvE `PLAYTEST_SEEDS=80 pnpm --filter rules exec vitest run test/run-playtest.test.ts`.
  - PvP `PLAYTEST_PVP=1 … test/pvp-sim.test.ts`.
  - co-op `PLAYTEST_COOP=1 … test/coop-sim.test.ts`.
  - Thêm một bảng tạm: tỉ lệ thắng trận PvE theo **lệnh đang có hiệu lực lúc trận kết thúc** và theo **pha khởi đầu**.
- [ ] **Step 2: So mục tiêu spec §10:**
  - Bot Bộ cơ bản tổng 35–45%.
  - PvP: mỗi Hero 40–60%, vòng TB 8–12, đi trước 47–53%.
  - Co-op như `17` §8.8.
  - Không lệnh nào lệch > 10 điểm so với trung bình pha của nó.

  Soạn gói chỉnh chỉ gồm số (`amount`, `multiplier`, số Nguyệt tính). **DỪNG — gửi duyệt**, áp, đo lại.
- [ ] **Step 3: `playtest-notes.md`** mục "Nguyệt Luân mới": phương pháp, bảng trước / sau, gói chỉnh, điểm mở.
- [ ] **Step 4: Đóng:**
  - `CLAUDE.md` / `07`: "Giai đoạn hiện tại: 7c đang làm — tiếp Task 6 (nội dung Arc 1) của `docs/superpowers/plans/2026-09-30-phase7c-story.md`".
  - Ghi chú trong plan 7c, Task 6 / 7: dùng `start.decrees` và thêm Nguyệt tính cho kẻ địch mới.
- [ ] **Step 5: `pnpm test` + `pnpm typecheck` xanh.**
- [ ] **Step 6: Commit** — `git commit -m "Close Nguyet Luan redesign: sims, tuning, notes"`

---

## Self-review (đã chạy khi viết plan)

- **Độ phủ spec:**
  - §3 ưu đãi → Task 2.
  - §4 lệnh:
    - Ám Dạ, Bóng Mờ, Viên Nguyệt, Phá Giáp, Huyền Giáp, Phản Chấn → T317.
    - Tập Kích, Thế Thủ, Liên Kích → T318.
    - Nguyệt Sinh, Khai Trí, Mầm Sống, Đoàn Viên, Thế Cân → T319.
    - Thiên Bình, Cuồng Nguyệt, Nguyệt Chiếu → T320.
    - Xả Thân, Đoạn Tuyệt → T321.
    - Huyết Tế, Giữ Giáp, Luân Hồi → T322.
    - Chiêm Tinh, Bói Nguyệt → T323.
  - §4.1 bốc lệnh → Task 2 / T315.
  - §4.2 action → Task 5.
  - §5 Nguyệt tính → Task 6.
  - §6 UI → Task 7.
  - §7 dữ liệu → Task 2.
  - §8 tài liệu → Task 1, 8.
  - §9 test → T314–T325.
  - §10 cân bằng → Task 8.
- **Lệch spec có chủ đích** (Task 1 Step 1, người dùng xác nhận ở Step 2):
  - luồng RNG phụ;
  - Đoạn Tuyệt là mất HP;
  - Thế Cân một lần mỗi vòng;
  - ghi lại T213 mỗi Task.
- **Tên thống nhất:** `phaseModifiers`, `decreeModifier`, `currentDecree`, `rollMoon`, `enterPhase`, `decreeTurnHeal`, `discardUnplayed`, `hitKey`, `moonDecrees`, `firstHitKeys`, `shieldUsed`, `attackCardsThisTurn`, `discardsThisTurn`, `bloodPactUsed`, `omenPending`, `DECREE_ONLY_MODIFIERS`.
