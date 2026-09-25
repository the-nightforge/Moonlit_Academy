# Giai đoạn 3 (Roguelike) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Một lượt chơi roguelike chơi được trọn vẹn: bản đồ tầng sinh theo seed, HP mang qua trận, lá thưởng, Kỳ Vật có hook trong trận, Nghỉ Chân, Kho Báu, boss.

**Architecture:** Lượt chơi là state machine thuần trong `packages/rules/src/run/` (`createRun` / `applyRunAction`), chứa `CombatState` của trận đang đánh và chuyển tiếp hành động chiến đấu sang `applyAction`. Hook Kỳ Vật nằm trong engine chiến đấu (`run-relic-hooks.ts`), kích hoạt tại các điểm cố định và bằng cách quét event mới (`unitDied`, `moonShifted`). Client chỉ gửi `RunAction` và vẽ lại từ `RunState`.

**Tech Stack:** TypeScript strict, pnpm workspaces, Vitest, zod 4 (`packages/data`), Phaser 4 (`apps/client`).

**Spec:** `docs/10-phase3-spec.md`

## Global Constraints

- `packages/rules` là code thuần: không import Phaser/DOM/`window`/network/fs; không `Math.random()`, không `Date.now()`.
- Mọi ngẫu nhiên đi qua RNG có seed nằm trong state (`CombatState.rngState`, `RunState.rngState`).
- Hàm thuần, không mutate input: `applyAction` / `applyRunAction` clone trước khi sửa.
- Client không tự tính luật; mọi con số hiển thị lấy từ state hoặc hàm của `rules`.
- Nội dung (lá, Kỳ Vật, kẻ địch, số liệu lượt chơi) nằm trong JSON của `packages/data`, không hardcode.
- Code, tên biến, comment, chuỗi lỗi: tiếng Anh. Chữ cho người chơi: tiếng Việt.
- ID dữ liệu `snake_case`; type `PascalCase`; hàm/biến `camelCase`; thuật ngữ theo `docs/04-glossary.md` (Kỳ Vật = `runRelic`).
- Union có trường `type` + `switch` đầy đủ với kiểm tra `never`.
- Không thêm thư viện mới.
- Test đặt tên theo mã kịch bản (`it("T96: ...")`). Kết thúc mỗi task: `pnpm test` và `pnpm typecheck` pass, file dùng LF.
- Chế độ Trận lẻ (không lượt chơi) phải giữ nguyên hành vi: T01–T95 không đổi.
- Làm việc trên nhánh `feature/phase3`.

---

## File Structure

| File | Trách nhiệm |
|---|---|
| `docs/11-run-rules.md` (mới) | Luật lượt chơi (bản đồ, hành động, phần thưởng, HP) |
| `packages/rules/src/types/static.ts` | + `rewardCardIds`, `EncounterTier`, `NodeType`, `FloorRule`, `RunConfig`, `HookTrigger`, `RunRelicHook`, `RunRelicDef` |
| `packages/rules/src/types/run.ts` (mới) | `MapNode`, `RunMap`, `RunState`, `RunSetup`, `RunAction`, `RunEvent`, `RunActionResult` |
| `packages/rules/src/types/api.ts` | `GameData.runRelics/runConfig`, `CombatSetup` mở rộng |
| `packages/rules/src/types/state.ts` | `CombatState.runRelicIds/runRelicCounters` |
| `packages/rules/src/types/events.ts` | + `runRelicTriggered` |
| `packages/rules/src/moon.ts` | `activeMoonModifiers` → `activeModifiers` (+ modifier Kỳ Vật) |
| `packages/rules/src/run-relic-hooks.ts` (mới) | `runRelicHooks`, `fireEventHooks` |
| `packages/rules/src/run/random.ts` (mới) | `Rng`, `nextFloat`, `pickOne` |
| `packages/rules/src/run/map.ts` (mới) | `generateMap` |
| `packages/rules/src/run/run.ts` (mới) | `createRun`, `applyRunAction`, `getRunActionError`, `reachableNodeIds`, `restHealAmounts`, `findNode` |
| `packages/data/src/schema.ts`, `load-game-data.ts` | Schema + kiểm tra chéo cho dữ liệu mới |
| `packages/data/{heroes,cards,enemies,encounters}.json`, `run-relics.json` (mới), `run-config.json` (mới) | Nội dung |
| `apps/client/src/scenes/run-scene.ts` (mới) | Màn bản đồ / thưởng / Nghỉ Chân / Kho Báu / kết thúc |
| `apps/client/src/{session.ts, main.ts, debug.ts, scenes/combat-scene.ts, scenes/team-select-scene.ts, ui/theme.ts, ui/event-animator.ts}` | Chế độ Lượt chơi |

---

### Task 1: Tài liệu luật (bước 3.1)

**Files:**
- Create: `docs/11-run-rules.md`
- Modify: `docs/01-combat-rules.md`, `docs/02-data-schema.md`, `docs/04-glossary.md`, `docs/05-ui-combat-screen.md`, `docs/06-test-scenarios.md`, `docs/07-implementation-plan.md`, `docs/10-phase3-spec.md`

**Interfaces:** chỉ tài liệu; các task sau đọc `01` §13 và `11`.

- [ ] **Step 1: Tạo `docs/11-run-rules.md`**

Nội dung: dòng tiêu đề dưới đây, rồi chép **nguyên văn** từ `docs/10-phase3-spec.md` các mục §2.2, §2.3, §2.4, §3 (toàn bộ), §4 (toàn bộ), giữ nguyên code block và bảng; đánh số lại thành §1–§5 theo thứ tự đó.

```markdown
# 11 — Luật lượt chơi (Roguelike)

Tài liệu này mô tả **chính xác** cách một lượt chơi vận hành, bổ sung cho `01-combat-rules.md` (một trận). Thuật ngữ theo `04-glossary.md`. Bối cảnh và lý do thiết kế: `10-phase3-spec.md`. Phạm vi: giai đoạn 3.
```

- [ ] **Step 2: Sửa `docs/01-combat-rules.md`**

1. Dòng phạm vi (dòng 5) thay bằng:
   `Phạm vi: giai đoạn 1–3 (PvE offline). Các mục đánh dấu **[GĐ2]** / **[GĐ3]** thuộc giai đoạn 2 / 3 (bối cảnh: `09-phase2-spec.md`, `10-phase3-spec.md`). Luật lượt chơi: `11-run-rules.md`.`
2. §2 bước 1: thêm câu `**[GĐ3]** Nếu `CombatSetup.deckCardIds` có: dùng danh sách đó thay cho `cardIds` của 3 Hero (chủ lá = `ownerId`, phải thuộc đội).`
3. §2 bước 2: thêm câu `**[GĐ3]** Nếu `CombatSetup.heroes` có: `hp`/`maxHp` của Hero lấy từ đó.`
4. §2 thêm bước 7: `7. **[GĐ3]** Kích hoạt hook Kỳ Vật `combatStart` (§13), sau các hook `playerTurnStart` của lượt 1.`
5. §3.1 thêm bước 9: `9. **[GĐ3]** Kích hoạt hook Kỳ Vật `playerTurnStart` (§13).`
6. §3.3 thêm bước 0 ở đầu danh sách: `0. **[GĐ3]** Kích hoạt hook Kỳ Vật `playerTurnEnd` (§13). Nếu trận kết thúc: dừng.`
7. §5.2 sau bước 4 thêm: `4b. **[GĐ3]** Kích hoạt hook Kỳ Vật `cardPlayed` (§13).`
8. §7.1 dưới bảng thêm: `**[GĐ3]** Modifier của Kỳ Vật đang có cộng thêm vào modifier của pha hiện tại (§13).`
9. §12: bỏ "Kỳ Vật" khỏi danh sách "Chưa có".
10. Thêm cuối file mục `## 13. Kỳ Vật [GĐ3]` với nội dung chép **nguyên văn** `docs/10-phase3-spec.md` §5.1–§5.4 (đổi tiêu đề con thành 13.1–13.4).

- [ ] **Step 3: Sửa `docs/02-data-schema.md`**

1. `HeroDef`: thêm dòng `  rewardCardIds: string[];  // GĐ3: lá thưởng (không trùng cardIds, ownerId = Hero này)`.
2. `EncounterDef`: thêm `  tier: "normal" | "elite" | "boss";  // GĐ3` và `  minFloor?: number;                  // GĐ3, mặc định 1`.
3. `CombatState`: thêm `  runRelicIds: string[];                  // GĐ3` và `  runRelicCounters: Record<string, number>;  // GĐ3: "<relicId>#<hookIndex>"`.
4. `CombatEvent`: thêm `  | { type: "runRelicTriggered"; runRelicId: string }   // GĐ3`.
5. `GameData`: thêm `  runRelics: Record<string, RunRelicDef>;  // GĐ3` và `  runConfig: RunConfig;                    // GĐ3`.
6. `CombatSetup`: thêm ba trường tùy chọn đúng như `10-phase3-spec.md` §2.3.
7. Thêm mục `## 7. Lượt chơi [GĐ3]` chứa nguyên văn các code block: §2.2 (`RunState`), §2.4 (`run-config.json`), §3 (`MapNode`/`RunMap`), §4.1 (`RunAction`), §4.5 (`RunEvent`), §5.1 (`RunRelicDef`) của spec.
8. §6 (kiểm tra khi nạp) thêm các dòng:
   - `**[GĐ3]** `rewardCardIds` trỏ tới lá tồn tại, `ownerId` = Hero đó, không trùng `cardIds`.`
   - `**[GĐ3]** Đúng 1 trận `boss`; ≥1 trận `normal` có `minFloor` ≤ 1; ≥1 trận `elite`.`
   - `**[GĐ3]** `runConfig`: mỗi tầng 1..`floors` có đúng 1 `floorRules`; tầng cuối là `boss` và chỉ tầng cuối có `boss`; `floorWidth.min ≤ max ≤ 2 × min`.`
   - `**[GĐ3]** Effect Kỳ Vật không dùng `to: "chosen"`, `stealBuff`, `actor`, condition `target…`; `heroDied` không dùng `actor: "trigger"`.`

- [ ] **Step 4: Sửa `docs/04-glossary.md`**

Trong bảng "Chiến đấu" thêm các dòng:

```markdown
| Bản đồ | `map`, `RunMap` | Lượt chơi roguelike |
| Nút | `node`, `MapNode` | |
| Tầng | `floor` | |
| Trận thường / Tinh Anh / Boss (tier) | `normal` / `elite` / `boss` | `EncounterDef.tier` |
| Nghỉ Chân | `rest` | Loại nút |
| Kho Báu | `treasure` | Loại nút |
| Lá thưởng | `rewardCard`, `rewardCardIds` | |
| Hook (Kỳ Vật) | `hook`, `HookTrigger` | Thời điểm Kỳ Vật kích hoạt |
```

Và chuyển dòng `| Kỳ Vật | `runRelic` |` từ "Hệ thống sau này" sang bảng "Hero và phát triển"; chuyển `| Lượt chơi roguelike | `run` |` sang bảng "Chiến đấu".

- [ ] **Step 5: Sửa `docs/05-ui-combat-screen.md`**

Thêm cuối file mục `## 7. Lượt chơi [GĐ3]` với nội dung chép nguyên văn `docs/10-phase3-spec.md` §7.

- [ ] **Step 6: Sửa `docs/06-test-scenarios.md`**

Thêm cuối file:

```markdown
---

## Giai đoạn 3

Quy ước thêm: test bản đồ kiểm tra **tính chất** trên seed 1–50. Test lượt chơi dùng đội M05/F04/M06, seed 42 trừ khi ghi khác; "thắng trận" trong test = cho mọi kẻ địch `burn 999` rồi `endTurn`. Bối cảnh: `10-phase3-spec.md`.
```

rồi chép nguyên văn các bảng §8.1, §8.2, §8.3 của spec (giữ tiêu đề con "Bản đồ", "Lượt chơi", "Hook Kỳ Vật").

- [ ] **Step 7: Sửa `docs/07-implementation-plan.md`**

Đổi tiêu đề thành `# 07 — Kế hoạch code (Giai đoạn 0–3)`. Chèn trước mục `## Sau giai đoạn 2`:

```markdown
## Giai đoạn 3 — Roguelike

Đặc tả: `10-phase3-spec.md`. Luật: `01` §13 (Kỳ Vật), `11-run-rules.md` (lượt chơi). Test: `06` T96–T127. Kế hoạch chi tiết: `docs/superpowers/plans/2026-09-24-phase3-roguelike.md`.

### Bước 3.1 — Cập nhật tài liệu *(Task 1)*
### Bước 3.2 — Schema và dữ liệu *(Task 2)*
> Thêm type/schema/kiểm tra chéo cho `rewardCardIds`, `tier`/`minFloor`, Kỳ Vật, `runConfig`; thêm 20 lá thưởng, 3 kẻ địch, 4 trận, `run-relics.json`, `run-config.json`. Làm T127.
### Bước 3.3 — Trận đấu nhận dữ liệu lượt chơi và hook Kỳ Vật *(Task 3–4)*
> `CombatSetup` nhận deck/HP/Kỳ Vật; `activeModifiers`; hệ thống hook theo `01` §13. Làm T115–T126.
### Bước 3.4 — Sinh bản đồ *(Task 5)*
> `generateMap` theo `11` §2. Làm T96–T101.
### Bước 3.5 — State machine lượt chơi *(Task 6)*
> `createRun` / `applyRunAction` theo `11` §3. Làm T102–T114.
### Bước 3.6 — Client *(Task 7)*
> Chế độ Lượt chơi, màn bản đồ / thưởng / Nghỉ Chân / Kho Báu / kết thúc, thanh Kỳ Vật.
### Bước 3.7 — Playtest *(Task 8)*
> Playtest scripted trọn lượt chơi + ghi chú.

**Hoàn thành giai đoạn 3 khi:** chơi được trọn một lượt chơi trên client, T96–T127 pass, playtest cho thấy lượt chơi thắng được với ít nhất 2 đội hình.
```

Và đổi `## Sau giai đoạn 2` thành `## Sau giai đoạn 3`, bỏ dòng "Giai đoạn 3: đặc tả roguelike." trong danh sách của mục đó.

- [ ] **Step 8: Đánh dấu spec đã đưa vào tài liệu luật**

Trong `docs/10-phase3-spec.md`, ngay dưới đoạn mở đầu thêm: `**Trạng thái:** đã đưa vào `01` §13, `11`, `02`, `04`, `05`, `06`, `07` (bước 3.1).`

- [ ] **Step 9: Commit**

```bash
git add docs/
git commit -m "Step 3.1: fold phase 3 spec into rules, schema, glossary, tests, plan docs"
```

---

### Task 2: Schema và dữ liệu (bước 3.2)

**Files:**
- Modify: `packages/rules/src/types/static.ts`, `packages/rules/src/types/api.ts`
- Modify: `packages/data/src/schema.ts`, `packages/data/src/load-game-data.ts`
- Modify: `packages/data/heroes.json`, `packages/data/cards.json`, `packages/data/enemies.json`, `packages/data/encounters.json`
- Create: `packages/data/run-relics.json`, `packages/data/run-config.json`
- Test: `packages/data/test/load-game-data.test.ts`

**Interfaces:**
- Produces: types `EncounterTier`, `NodeType`, `FloorRule`, `RunConfig`, `HookTrigger`, `RunRelicActor`, `RunRelicHook`, `RunRelicDef`; `HeroDef.rewardCardIds: string[]`; `EncounterDef.tier`, `EncounterDef.minFloor?`; `GameData.runRelics: Record<string, RunRelicDef>`, `GameData.runConfig: RunConfig`.

- [ ] **Step 1: Viết test nạp dữ liệu (fail)**

Trong `packages/data/test/load-game-data.test.ts`:

(a) `rawData()` thêm hai import và hai trường:

```ts
import runRelicsJson from "../run-relics.json";
import runConfigJson from "../run-config.json";
// ...
    moonPhases: moonPhasesJson,
    runRelics: runRelicsJson,
    runConfig: runConfigJson,
```

(b) Trong test "loads the real data files…" thay các dòng đếm:

```ts
    expect(Object.keys(data.heroes)).toEqual(["m05", "f04", "m06", "f03", "f02"]);
    expect(Object.keys(data.cards)).toHaveLength(48);
    expect(Object.keys(data.enemies)).toEqual([
      "puppet_guard", "shadow_fox", "moon_ape", "book_wraith", "black_guard", "fox_king",
    ]);
    expect(Object.keys(data.encounters)).toEqual([
      "enc_01", "enc_02", "enc_03", "enc_04", "enc_05", "enc_06", "enc_elite_01", "enc_elite_02",
    ]);
    expect(Object.keys(data.runRelics)).toHaveLength(10);
    expect(data.runConfig.floors).toBe(8);
    expect(data.heroes["m05"]?.rewardCardIds).toEqual([
      "m05_thiet_bich", "m05_no_hoa_lien_hoan", "m05_bat_dong_nhu_son", "m05_huyet_chien",
    ]);
    expect(data.encounters["enc_elite_01"]).toMatchObject({ tier: "elite", minFloor: 5 });
```

(c) Thêm vào `describe("parseGameData validation", …)`:

```ts
  it("rejects a reward card owned by another hero", () => {
    const raw = rawData();
    raw.heroes[0].rewardCardIds[0] = "f04_thao_duoc";
    expect(() => parseGameData(raw)).toThrowError(/m05.*f04_thao_duoc/);
  });

  it("rejects encounters without exactly one boss", () => {
    const raw = rawData();
    raw.encounters.find((e: any) => e.id === "enc_04").tier = "normal";
    expect(() => parseGameData(raw)).toThrowError(/boss/);
  });

  it("rejects a runConfig floor without a rule", () => {
    const raw = rawData();
    raw.runConfig.floorRules = raw.runConfig.floorRules.filter((r: any) => !r.floors.includes(7));
    expect(() => parseGameData(raw)).toThrowError(/floor 7/);
  });

  it("T127: rejects run relic effects that target a chosen unit", () => {
    const raw = rawData();
    raw.runRelics.find((r: any) => r.id === "nguyet_giap_phu").hooks[0].effects[0].to = "chosen";
    expect(() => parseGameData(raw)).toThrowError(/nguyet_giap_phu.*chosen/);
  });

  it("T127: rejects stealBuff in run relic effects", () => {
    const raw = rawData();
    raw.runRelics.find((r: any) => r.id === "huyet_an").hooks[0].effects = [{ type: "stealBuff", count: 1 }];
    expect(() => parseGameData(raw)).toThrowError(/huyet_an.*stealBuff/);
  });

  it("T127: rejects actor in run relic effects", () => {
    const raw = rawData();
    raw.runRelics.find((r: any) => r.id === "han_ngoc").hooks[0].effects[0].actor = 1;
    expect(() => parseGameData(raw)).toThrowError(/han_ngoc.*actor/);
  });

  it("T127: rejects heroDied hooks with actor trigger", () => {
    const raw = rawData();
    raw.runRelics.find((r: any) => r.id === "tan_hon_dang").hooks[0].actor = "trigger";
    expect(() => parseGameData(raw)).toThrowError(/tan_hon_dang.*heroDied/);
  });
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `pnpm --filter data exec vitest run`
Expected: FAIL (thiếu `run-relics.json`, đếm sai…).

- [ ] **Step 3: Thêm type vào `packages/rules/src/types/static.ts`**

Trong `HeroDef`, sau `cardIds: string[];` thêm:

```ts
  /** Cards this hero can learn in a run; not in `cardIds`. */
  rewardCardIds: string[];
```

Thay `EncounterDef` bằng:

```ts
export type EncounterTier = "normal" | "elite" | "boss";

export interface EncounterDef {
  id: string;
  name: string;
  enemyIds: string[];
  tier: EncounterTier;
  /** Earliest map floor this encounter may appear on; default 1. */
  minFloor?: number;
}
```

Thêm cuối file:

```ts
export type NodeType = "combat" | "elite" | "rest" | "treasure" | "boss";

export type FloorRule =
  | { floors: number[]; type: NodeType }
  | { floors: number[]; weights: Partial<Record<NodeType, number>> };

export interface RunConfig {
  floors: number;
  floorWidth: { min: number; max: number };
  floorRules: FloorRule[];
  restHealRatio: number;
  reviveHpRatio: number;
  rewardCardChoices: number;
  minDeckSize: number;
}

export type HookTrigger =
  | { type: "combatStart" }
  | { type: "playerTurnStart" }
  | { type: "playerTurnEnd" }
  | { type: "cardPlayed"; tag?: CardTag; cardType?: CardType }
  | { type: "enemyKilled" }
  | { type: "heroDied" }
  | { type: "moonPhaseEntered"; phase?: MoonPhaseId }
  | { type: "bloodMoonStarted" };

export type RunRelicActor = "trigger" | "each" | "lowestHp" | "front";

export interface RunRelicHook {
  on: HookTrigger;
  actor: RunRelicActor;
  /** Fires only when this hook's per-combat counter is a multiple of `every`. */
  every?: number;
  effects: Effect[];
}

export interface RunRelicDef {
  id: string;
  name: string;
  text: string;
  /** Always-on, combined with the moon phase's modifiers. */
  modifiers?: MoonModifier[];
  hooks?: RunRelicHook[];
}
```

- [ ] **Step 4: Sửa `packages/rules/src/types/api.ts`**

```ts
import type {
  CardDef, EnemyDef, EncounterDef, HeroDef, MoonPhaseDef, RunConfig, RunRelicDef,
} from "./static";
```

và trong `GameData` thêm:

```ts
  runRelics: Record<string, RunRelicDef>;
  runConfig: RunConfig;
```

- [ ] **Step 5: Sửa `packages/data/src/schema.ts`**

(a) Trong `heroDefSchema`, sau `cardIds: z.array(idSchema).length(5),` thêm `rewardCardIds: z.array(idSchema),`.

(b) Thay `encounterDefSchema` bằng:

```ts
export const encounterDefSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  enemyIds: z.array(idSchema).min(1).max(3),
  tier: z.enum(["normal", "elite", "boss"]),
  minFloor: z.number().int().positive().optional(),
});
```

(c) Sau `moonPhaseDefSchema` thêm:

```ts
const nodeTypeSchema = z.enum(["combat", "elite", "rest", "treasure", "boss"]);

const hookTriggerSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("combatStart") }),
  z.object({ type: z.literal("playerTurnStart") }),
  z.object({ type: z.literal("playerTurnEnd") }),
  z.object({
    type: z.literal("cardPlayed"),
    tag: cardTagSchema.optional(),
    cardType: z.enum(["attack", "skill"]).optional(),
  }),
  z.object({ type: z.literal("enemyKilled") }),
  z.object({ type: z.literal("heroDied") }),
  z.object({ type: z.literal("moonPhaseEntered"), phase: moonPhaseIdSchema.optional() }),
  z.object({ type: z.literal("bloodMoonStarted") }),
]);

export const runRelicDefSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  text: z.string(),
  modifiers: z.array(moonModifierSchema).optional(),
  hooks: z
    .array(
      z.object({
        on: hookTriggerSchema,
        actor: z.enum(["trigger", "each", "lowestHp", "front"]),
        every: z.number().int().min(2).optional(),
        effects: z.array(effectSchema).min(1),
      }),
    )
    .optional(),
});

const floorsSchema = z.array(z.number().int().positive()).min(1);
const weightSchema = z.number().positive().optional();

export const runConfigSchema = z.object({
  floors: z.number().int().min(2),
  floorWidth: z.object({ min: z.number().int().min(2), max: z.number().int().min(2) }),
  floorRules: z.array(
    z.union([
      z.object({ floors: floorsSchema, type: nodeTypeSchema }),
      z.object({
        floors: floorsSchema,
        weights: z.object({
          combat: weightSchema,
          elite: weightSchema,
          rest: weightSchema,
          treasure: weightSchema,
          boss: weightSchema,
        }),
      }),
    ]),
  ),
  restHealRatio: z.number().gt(0).lte(1),
  reviveHpRatio: z.number().gt(0).lte(1),
  rewardCardChoices: z.number().int().positive(),
  minDeckSize: z.number().int().positive(),
});
```

(d) `rawGameDataSchema` thêm:

```ts
  runRelics: z.array(runRelicDefSchema),
  runConfig: runConfigSchema,
```

- [ ] **Step 6: Sửa `packages/data/src/load-game-data.ts`**

(a) Import JSON mới:

```ts
import runRelicsJson from "../run-relics.json";
import runConfigJson from "../run-config.json";
```

(b) Trong `collectCrossCheckErrors`: đổi destructuring thành
`const { heroes, cards, enemies, encounters, moonPhases, runRelics, runConfig } = parsed;`, thêm `["runRelics", runRelics],` vào mảng `groups`, và thêm trước `return errors;`:

```ts
  for (const hero of heroes) {
    for (const cardId of hero.rewardCardIds) {
      const card = cardById.get(cardId);
      if (!card) {
        errors.push(`hero "${hero.id}": rewardCardIds references missing card "${cardId}"`);
      } else if (card.ownerId !== hero.id) {
        errors.push(`hero "${hero.id}": reward card "${cardId}" has ownerId "${card.ownerId}"`);
      } else if (hero.cardIds.includes(cardId)) {
        errors.push(`hero "${hero.id}": reward card "${cardId}" is also a starting card`);
      }
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

  for (const relic of runRelics) {
    for (const [index, hook] of (relic.hooks ?? []).entries()) {
      const label = `runRelic "${relic.id}" hook ${index}`;
      if (someEffect(hook.effects, (effect) => "to" in effect && effect.to === "chosen")) {
        errors.push(`${label}: effects must not use to "chosen"`);
      }
      if (someEffect(hook.effects, (effect) => effect.type === "stealBuff")) {
        errors.push(`${label}: effects must not use stealBuff`);
      }
      if (someEffect(hook.effects, (effect) => effect.actor !== undefined)) {
        errors.push(`${label}: effects must not use actor`);
      }
      if (
        someEffect(
          hook.effects,
          (effect) => effect.type === "conditional" && effect.condition.type.startsWith("target"),
        )
      ) {
        errors.push(`${label}: conditions must not reference a target`);
      }
      if (hook.on.type === "heroDied" && hook.actor === "trigger") {
        errors.push(`${label}: heroDied cannot use actor "trigger"`);
      }
    }
  }
```

(c) `parseGameData` trả thêm:

```ts
  const { heroes, cards, enemies, encounters, moonPhases, runRelics, runConfig } = parsed.data;
  return {
    // ...5 trường cũ giữ nguyên...
    runRelics: Object.fromEntries(runRelics.map((relic) => [relic.id, relic])),
    runConfig,
  };
```

(d) `loadGameData` truyền thêm `runRelics: runRelicsJson, runConfig: runConfigJson`.

- [ ] **Step 7: Thêm dữ liệu — `heroes.json` (`rewardCardIds`)**

Chạy từ `packages/data` (chèn trước mỗi `"levelUp": {`, giữ định dạng hiện có):

```bash
node - <<'EOF'
const fs = require("fs");
const rewards = {
  m05: ["m05_thiet_bich", "m05_no_hoa_lien_hoan", "m05_bat_dong_nhu_son", "m05_huyet_chien"],
  f04: ["f04_hoi_xuan_tan", "f04_bang_tam_quyet", "f04_thanh_tam_chu", "f04_nguyet_lo"],
  m06: ["m06_tang_anh_thich", "m06_doc_tieu", "m06_anh_phan_than", "m06_tuyet_menh"],
  f03: ["f03_suong_giap", "f03_bang_toai", "f03_han_phong", "f03_tuyet_vu"],
  f02: ["f02_huyet_khe", "f02_dien_cu", "f02_doat_hon_thich", "f02_ta_nguyet_chu"],
};
let s = fs.readFileSync("heroes.json", "utf8");
for (const [id, cards] of Object.entries(rewards)) {
  const start = s.indexOf(`"id": "${id}"`);
  const at = s.indexOf(`"levelUp": {`, start);
  if (start < 0 || at < 0) throw new Error(id);
  const list = cards.map((c) => `      "${c}"`).join(",\n");
  s = s.slice(0, at) + `"rewardCardIds": [\n${list}\n    ],\n    ` + s.slice(at);
}
fs.writeFileSync("heroes.json", s);
JSON.parse(s);
EOF
```

- [ ] **Step 8: Thêm 20 lá thưởng vào `cards.json`**

Chạy từ `packages/data`:

```bash
node - <<'EOF'
const fs = require("fs");
const dmg = (amount, extra = {}) => ({ type: "damage", amount, to: "chosen", ...extra });
const cards = [
  { id: "m05_thiet_bich", name: "Thiết Bích", ownerId: "m05", cost: 2, type: "skill", tags: ["ward"], target: "none",
    effects: [{ type: "applyStatus", status: "taunt", amount: 1, to: "self" }, { type: "gainArmor", amount: 4, to: "allAllies" }],
    text: "Khiêu Khích 1 vòng. Mọi Hero nhận 4 giáp." },
  { id: "m05_no_hoa_lien_hoan", name: "Nộ Hỏa Liên Hoàn", ownerId: "m05", cost: 2, type: "attack", tags: ["attack"], target: "enemy",
    effects: [dmg(4, { hits: 3 })], text: "Gây 4 damage 3 lần." },
  { id: "m05_bat_dong_nhu_son", name: "Bất Động Như Sơn", ownerId: "m05", cost: 2, type: "skill", tags: ["ward"], target: "none",
    effects: [{ type: "gainArmor", amount: 10, to: "self" }, { type: "applyStatus", status: "reflect", amount: 3, to: "self" }],
    text: "Nhận 10 giáp và Phản Đòn 3." },
  { id: "m05_huyet_chien", name: "Huyết Chiến", ownerId: "m05", cost: 1, type: "attack", tags: ["attack"], target: "enemy",
    effects: [{ type: "conditional", condition: { type: "selfHpBelow", ratio: 0.5 }, then: [dmg(11)], else: [dmg(6)] }],
    text: "Gây 6 damage. HP dưới 50%: gây 11." },
  { id: "f04_hoi_xuan_tan", name: "Hồi Xuân Tán", ownerId: "f04", cost: 2, type: "skill", tags: ["heal", "harmony"], target: "none",
    effects: [{ type: "heal", amount: 4, to: "allAllies" }], text: "Mọi Hero hồi 4 HP." },
  { id: "f04_bang_tam_quyet", name: "Băng Tâm Quyết", ownerId: "f04", cost: 1, type: "skill", tags: ["control", "harmony"], target: "enemy",
    effects: [{ type: "applyStatus", status: "weak", amount: 2, to: "chosen" }], text: "Suy Yếu 1 kẻ địch 2 vòng." },
  { id: "f04_thanh_tam_chu", name: "Thanh Tâm Chú", ownerId: "f04", cost: 1, type: "skill", tags: ["harmony"], target: "none",
    effects: [{ type: "cleanse", to: "allAllies" }, { type: "draw", amount: 1 }], text: "Giải trừ mọi Hero. Rút 1 lá." },
  { id: "f04_nguyet_lo", name: "Nguyệt Lộ", ownerId: "f04", cost: 0, type: "skill", tags: ["heal"], target: "ally",
    effects: [{ type: "heal", amount: 3, to: "chosen" },
      { type: "conditional", condition: { type: "moonPhaseIs", phase: "full" }, then: [{ type: "gainMoonPower", amount: 1 }] }],
    text: "Hồi 3 HP. Trăng Tròn: +1 Nguyệt Lực." },
  { id: "m06_tang_anh_thich", name: "Tàng Ảnh Thích", ownerId: "m06", cost: 1, type: "attack", tags: ["attack", "assassin"], target: "enemy",
    effects: [{ type: "conditional", condition: { type: "selfHasStatus", status: "stealth" }, then: [dmg(4, { hits: 3 })], else: [dmg(4)] }],
    text: "Gây 4 damage. Đang Ẩn Thân: gây 4 damage 3 lần." },
  { id: "m06_doc_tieu", name: "Độc Tiêu", ownerId: "m06", cost: 1, type: "skill", tags: ["control"], target: "enemy",
    effects: [{ type: "applyStatus", status: "vulnerable", amount: 2, to: "chosen" }], text: "Dễ Vỡ 1 kẻ địch 2 vòng." },
  { id: "m06_anh_phan_than", name: "Ảnh Phân Thân", ownerId: "m06", cost: 2, type: "skill", tags: ["assassin"], target: "none",
    effects: [{ type: "applyStatus", status: "stealth", amount: 2, to: "self" }, { type: "draw", amount: 1 }],
    text: "Ẩn Thân 2 vòng. Rút 1 lá." },
  { id: "m06_tuyet_menh", name: "Tuyệt Mệnh", ownerId: "m06", cost: 3, type: "attack", tags: ["attack", "assassin"], target: "enemy",
    effects: [{ type: "conditional", condition: { type: "targetHpAtOrBelow", ratio: 0.5 }, then: [dmg(24)], else: [dmg(12)] }],
    text: "Gây 12 damage. Mục tiêu HP ≤ 50%: gây 24." },
  { id: "f03_suong_giap", name: "Sương Giáp", ownerId: "f03", cost: 1, type: "skill", tags: ["ward"], target: "none",
    effects: [{ type: "gainArmor", amount: 5, to: "self" }, { type: "applyStatus", status: "reflect", amount: 2, to: "self" }],
    text: "Nhận 5 giáp và Phản Đòn 2." },
  { id: "f03_bang_toai", name: "Băng Toái", ownerId: "f03", cost: 2, type: "attack", tags: ["attack"], target: "enemy",
    effects: [{ type: "conditional", condition: { type: "targetHasStatus", status: "freeze" }, then: [dmg(16)], else: [dmg(7)] }],
    text: "Gây 7 damage. Mục tiêu đang Đóng Băng: gây 16." },
  { id: "f03_han_phong", name: "Hàn Phong", ownerId: "f03", cost: 1, type: "skill", tags: ["control"], target: "enemy",
    effects: [{ type: "applyStatus", status: "weak", amount: 1, to: "chosen" }, { type: "applyStatus", status: "vulnerable", amount: 1, to: "chosen" }],
    text: "Suy Yếu 1 và Dễ Vỡ 1 lên 1 kẻ địch." },
  { id: "f03_tuyet_vu", name: "Tuyết Vũ", ownerId: "f03", cost: 2, type: "attack", tags: ["attack"], target: "none",
    effects: [{ type: "damage", amount: 3, hits: 2, to: "allEnemies" }], text: "Gây 3 damage 2 lần lên mọi kẻ địch." },
  { id: "f02_huyet_khe", name: "Huyết Khế", ownerId: "f02", cost: 0, type: "skill", tags: ["forbidden"], target: "none",
    effects: [{ type: "loseHp", amount: 3, to: "self" }, { type: "gainMoonPower", amount: 2 }], text: "Mất 3 HP. +2 Nguyệt Lực." },
  { id: "f02_dien_cu", name: "Diện Cụ", ownerId: "f02", cost: 1, type: "skill", tags: ["assassin"], target: "none",
    effects: [{ type: "applyStatus", status: "stealth", amount: 1, to: "self" }, { type: "draw", amount: 1 }],
    text: "Ẩn Thân 1 vòng. Rút 1 lá." },
  { id: "f02_doat_hon_thich", name: "Đoạt Hồn Thích", ownerId: "f02", cost: 2, type: "attack", tags: ["attack", "forbidden"], target: "enemy",
    effects: [{ type: "loseHp", amount: 2, to: "self" },
      { type: "conditional", condition: { type: "bloodMoonActive" }, then: [dmg(14)], else: [dmg(8)] }],
    text: "Mất 2 HP. Gây 8 damage; Huyết Nguyệt: gây 14." },
  { id: "f02_ta_nguyet_chu", name: "Tà Nguyệt Chú", ownerId: "f02", cost: 0, type: "skill", tags: ["forbidden", "moon"], target: "none",
    effects: [{ type: "loseHp", amount: 4, to: "self" }, { type: "bloodMoon", rounds: 1 }], text: "Mất 4 HP. Huyết Nguyệt 1 vòng." },
];
let s = fs.readFileSync("cards.json", "utf8").trimEnd();
if (!s.endsWith("]")) throw new Error("cards.json shape");
const body = cards.map((c) => "  " + JSON.stringify(c, null, 2).replace(/\n/g, "\n  ")).join(",\n");
fs.writeFileSync("cards.json", s.slice(0, -1).trimEnd() + ",\n" + body + "\n]\n");
JSON.parse(fs.readFileSync("cards.json", "utf8"));
EOF
```

- [ ] **Step 9: Thêm 3 kẻ địch vào `enemies.json`**

Chạy từ `packages/data`:

```bash
node - <<'EOF'
const fs = require("fs");
const enemies = [
  { id: "book_wraith", name: "Thư Hồn", maxHp: 32, intentPattern: [
      { id: "wraith_curse", name: "Nguyền Thư", kind: "debuff", targeting: "random",
        effects: [{ type: "applyStatus", status: "vulnerable", amount: 2, to: "chosen" }] },
      { id: "wraith_strike", name: "Thư Kích", kind: "attack", targeting: "lowestHp",
        effects: [{ type: "damage", amount: 8, to: "chosen" }] },
      { id: "wraith_mend", name: "Tự Tu", kind: "buff",
        effects: [{ type: "applyStatus", status: "regen", amount: 3, to: "self" }] },
    ], art: { portrait: "" } },
  { id: "black_guard", name: "Hắc Giáp Vệ", maxHp: 70, intentPattern: [
      { id: "black_cleave", name: "Hắc Trảm", kind: "attack", targeting: "lowestHp",
        effects: [{ type: "damage", amount: 14, to: "chosen" }] },
      { id: "black_bulwark", name: "Hắc Thuẫn", kind: "defend",
        effects: [{ type: "gainArmor", amount: 12, to: "self" }, { type: "applyStatus", status: "regen", amount: 3, to: "self" }] },
      { id: "black_sweep", name: "Hoành Tảo", kind: "attack",
        effects: [{ type: "damage", amount: 7, to: "allEnemies" }] },
    ], art: { portrait: "" } },
  { id: "fox_king", name: "Hồ Vương", maxHp: 50, intentPattern: [
      { id: "fox_king_veil", name: "Huyễn Ảnh", kind: "buff",
        effects: [{ type: "applyStatus", status: "stealth", amount: 2, to: "self" }] },
      { id: "fox_king_claw", name: "Vương Trảo", kind: "attack", targeting: "highestHp",
        effects: [{ type: "damage", amount: 10, to: "chosen" }] },
      { id: "fox_king_howl", name: "Hồ Khiếu", kind: "debuff",
        effects: [{ type: "applyStatus", status: "weak", amount: 2, to: "allEnemies" }] },
    ], art: { portrait: "" } },
];
let s = fs.readFileSync("enemies.json", "utf8").trimEnd();
if (!s.endsWith("]")) throw new Error("enemies.json shape");
const body = enemies.map((e) => "  " + JSON.stringify(e, null, 2).replace(/\n/g, "\n  ")).join(",\n");
fs.writeFileSync("enemies.json", s.slice(0, -1).trimEnd() + ",\n" + body + "\n]\n");
JSON.parse(fs.readFileSync("enemies.json", "utf8"));
EOF
```

- [ ] **Step 10: Viết lại `packages/data/encounters.json`**

```json
[
  { "id": "enc_01", "name": "Hành Lang Tàng Thư Các", "enemyIds": ["puppet_guard", "shadow_fox"], "tier": "normal" },
  { "id": "enc_02", "name": "Rừng Trúc Đêm", "enemyIds": ["shadow_fox", "shadow_fox", "shadow_fox"], "tier": "normal" },
  { "id": "enc_03", "name": "Cổng Đá Học Viện", "enemyIds": ["puppet_guard", "puppet_guard"], "tier": "normal" },
  { "id": "enc_04", "name": "Vọng Nguyệt Đài", "enemyIds": ["moon_ape"], "tier": "boss" },
  { "id": "enc_05", "name": "Thư Lâu Tầng Hai", "enemyIds": ["puppet_guard", "book_wraith"], "tier": "normal", "minFloor": 3 },
  { "id": "enc_06", "name": "Mê Cung Sách Cấm", "enemyIds": ["book_wraith", "book_wraith", "shadow_fox"], "tier": "normal", "minFloor": 5 },
  { "id": "enc_elite_01", "name": "Cổng Hắc Giáp", "enemyIds": ["black_guard"], "tier": "elite", "minFloor": 5 },
  { "id": "enc_elite_02", "name": "Hang Hồ Vương", "enemyIds": ["fox_king", "shadow_fox"], "tier": "elite", "minFloor": 5 }
]
```

- [ ] **Step 11: Tạo `packages/data/run-relics.json`**

```json
[
  { "id": "nguyet_giap_phu", "name": "Nguyệt Giáp Phù", "text": "Đầu trận: mọi Hero nhận 5 giáp.",
    "hooks": [{ "on": { "type": "combatStart" }, "actor": "each", "effects": [{ "type": "gainArmor", "amount": 5, "to": "self" }] }] },
  { "id": "huyet_an", "name": "Huyết Ấn", "text": "Hero kết liễu một kẻ địch hồi 4 HP.",
    "hooks": [{ "on": { "type": "enemyKilled" }, "actor": "trigger", "effects": [{ "type": "heal", "amount": 4, "to": "self" }] }] },
  { "id": "tam_tuyet_kiem_pho", "name": "Tam Tuyệt Kiếm Phổ", "text": "Mỗi lá tấn công thứ 3 trong trận: +1 Nguyệt Lực.",
    "hooks": [{ "on": { "type": "cardPlayed", "cardType": "attack" }, "actor": "trigger", "every": 3, "effects": [{ "type": "gainMoonPower", "amount": 1 }] }] },
  { "id": "anh_nguyet_chau", "name": "Ảnh Nguyệt Châu", "text": "Lá sát thủ gây damage ×1.25.",
    "modifiers": [{ "type": "damageMultiplierForTag", "tag": "assassin", "multiplier": 1.25 }] },
  { "id": "huyet_nguyet_phu", "name": "Huyết Nguyệt Phù", "text": "Khi Huyết Nguyệt bắt đầu: mọi Hero nhận 1 Sức Mạnh.",
    "hooks": [{ "on": { "type": "bloodMoonStarted" }, "actor": "each", "effects": [{ "type": "applyStatus", "status": "strength", "amount": 1, "to": "self" }] }] },
  { "id": "thanh_loan_vu", "name": "Thanh Loan Vũ", "text": "Mỗi 2 lượt: rút thêm 1 lá.",
    "hooks": [{ "on": { "type": "playerTurnStart" }, "actor": "front", "every": 2, "effects": [{ "type": "draw", "amount": 1 }] }] },
  { "id": "bach_lo_huong_tui", "name": "Bạch Lộ Hương Túi", "text": "Khi vào Trăng Tròn: Hero máu thấp nhất hồi 6 HP.",
    "hooks": [{ "on": { "type": "moonPhaseEntered", "phase": "full" }, "actor": "lowestHp", "effects": [{ "type": "heal", "amount": 6, "to": "self" }] }] },
  { "id": "han_ngoc", "name": "Hàn Ngọc", "text": "Đánh lá khống chế: Hero đó nhận 3 giáp.",
    "hooks": [{ "on": { "type": "cardPlayed", "tag": "control" }, "actor": "trigger", "effects": [{ "type": "gainArmor", "amount": 3, "to": "self" }] }] },
  { "id": "tan_hon_dang", "name": "Tàn Hồn Đăng", "text": "Khi một Hero ngã: các Hero còn lại hồi 6 HP.",
    "hooks": [{ "on": { "type": "heroDied" }, "actor": "each", "effects": [{ "type": "heal", "amount": 6, "to": "self" }] }] },
  { "id": "tinh_ha_kinh", "name": "Tinh Hà Kính", "text": "Cuối lượt: Hero máu thấp nhất nhận 4 giáp.",
    "hooks": [{ "on": { "type": "playerTurnEnd" }, "actor": "lowestHp", "effects": [{ "type": "gainArmor", "amount": 4, "to": "self" }] }] }
]
```

- [ ] **Step 12: Tạo `packages/data/run-config.json`**

```json
{
  "floors": 8,
  "floorWidth": { "min": 2, "max": 3 },
  "floorRules": [
    { "floors": [1], "type": "combat" },
    { "floors": [2, 3], "weights": { "combat": 80, "rest": 20 } },
    { "floors": [4], "type": "treasure" },
    { "floors": [5, 6], "weights": { "combat": 60, "elite": 25, "rest": 15 } },
    { "floors": [7], "type": "rest" },
    { "floors": [8], "type": "boss" }
  ],
  "restHealRatio": 0.3,
  "reviveHpRatio": 0.25,
  "rewardCardChoices": 3,
  "minDeckSize": 10
}
```

- [ ] **Step 13: Chạy test + typecheck**

Run: `pnpm --filter data exec vitest run` → PASS.
Run: `pnpm test` → PASS (playtest giai đoạn 2 tự chạy thêm các trận mới; chỉ cần kết thúc).
Run: `pnpm typecheck` → Done cho cả 3 package.

Ghi chú: màn chọn đội sẽ có 8 nút trận, tràn ngang ở chế độ Trận lẻ — sửa ở Task 7.

- [ ] **Step 14: Commit**

```bash
git add packages/rules/src/types packages/data
git commit -m "Step 3.2: run relic, reward card, encounter tier and run config data + schema"
```

---

### Task 3: Trận đấu nhận dữ liệu lượt chơi + modifier Kỳ Vật (bước 3.3a)

**Files:**
- Modify: `packages/rules/src/types/api.ts`, `packages/rules/src/types/state.ts`, `packages/rules/src/create-combat.ts`, `packages/rules/src/moon.ts`, `packages/rules/src/queries.ts`, `packages/rules/test/helpers.ts`
- Test: `packages/rules/test/run-combat.test.ts` (mới)

**Interfaces:**
- Consumes: `GameData.runRelics` (Task 2).
- Produces: `CombatSetup.deckCardIds?: string[]`, `CombatSetup.heroes?: { hp: number; maxHp: number }[]`, `CombatSetup.runRelicIds?: string[]`; `CombatState.runRelicIds: string[]`, `CombatState.runRelicCounters: Record<string, number>`; `activeModifiers(data, state): MoonModifier[]` (thay `activeMoonModifiers`); `TestCombatOverrides.deckCardIds/heroes/runRelicIds`.

- [ ] **Step 1: Mở rộng helper test** — `packages/rules/test/helpers.ts`

```ts
export interface TestCombatOverrides {
  heroIds?: [string, string, string];
  encounterId?: string;
  seed?: number;
  deckCardIds?: string[];
  heroes?: { hp: number; maxHp: number }[];
  runRelicIds?: string[];
  mutateData?: (data: GameData) => void;
  setup?: (state: CombatState) => void;
}
```

và trong `makeTestCombat` thay lời gọi `createCombat` bằng:

```ts
  const { state, events } = createCombat(data, {
    heroIds: overrides.heroIds ?? ["m05", "f04", "m06"],
    encounterId: overrides.encounterId ?? "enc_01",
    seed: overrides.seed ?? 42,
    deckCardIds: overrides.deckCardIds,
    heroes: overrides.heroes,
    runRelicIds: overrides.runRelicIds,
  });
```

- [ ] **Step 2: Viết test (fail)** — `packages/rules/test/run-combat.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { applyAction, createCombat } from "../src/index";
import { instanceIdOf, makeTestCombat, setHand, testData } from "./helpers";

describe("combat setup from a run", () => {
  it("uses deckCardIds, hero vitals and run relics from the setup", () => {
    const data = testData();
    const deck = [
      ...data.heroes["m05"]!.cardIds,
      ...data.heroes["f04"]!.cardIds,
      ...data.heroes["m06"]!.cardIds,
      "m05_huyet_chien",
    ];
    const { state } = createCombat(data, {
      heroIds: ["m05", "f04", "m06"],
      encounterId: "enc_01",
      seed: 42,
      deckCardIds: deck,
      heroes: [{ hp: 20, maxHp: 40 }, { hp: 30, maxHp: 30 }, { hp: 5, maxHp: 28 }],
      runRelicIds: ["anh_nguyet_chau"],
    });
    expect(Object.keys(state.cards)).toHaveLength(16);
    expect(state.cards["c16"]).toEqual({ instanceId: "c16", cardId: "m05_huyet_chien", ownerIds: ["m05"] });
    expect(state.heroes.map((h) => [h.hp, h.maxHp])).toEqual([[20, 40], [30, 30], [5, 28]]);
    expect(state.runRelicIds).toEqual(["anh_nguyet_chau"]);
    expect(state.runRelicCounters).toEqual({});
  });

  it("rejects a deck card whose owner is not in the team", () => {
    const data = testData();
    expect(() =>
      createCombat(data, {
        heroIds: ["m05", "f04", "m06"],
        encounterId: "enc_01",
        seed: 42,
        deckCardIds: ["f03_han_an"],
      }),
    ).toThrowError(/f03_han_an/);
  });

  it("T123: a run relic modifier stacks with the moon phase", () => {
    const { data, state } = makeTestCombat({
      runRelicIds: ["anh_nguyet_chau"],
      setup: (s) => {
        s.moonIndex = 0;
        setHand(s, ["m06_am_tien"]);
      },
    });
    const result = applyAction(data, state, {
      type: "playCard",
      instanceId: instanceIdOf(state, "m06_am_tien"),
      targetId: "enemy:0",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.enemies[0]?.hp).toBe(31);
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận fail**

Run: `pnpm --filter rules exec vitest run test/run-combat.test.ts`
Expected: FAIL (typecheck lỗi thuộc tính `deckCardIds`, hoặc `runRelicIds` undefined).

- [ ] **Step 4: Type** — `packages/rules/src/types/api.ts`

```ts
export interface CombatSetup {
  heroIds: [string, string, string];
  encounterId: string;
  seed: number;
  /** Default: the three heroes' `cardIds`. Each card's owner must be in the team. */
  deckCardIds?: string[];
  /** Default: every hero at full HP. */
  heroes?: { hp: number; maxHp: number }[];
  runRelicIds?: string[];
}
```

`packages/rules/src/types/state.ts`, trong `CombatState` sau `rngState: number;`:

```ts
  runRelicIds: string[];
  /** Per-combat hook counters, keyed "<relicId>#<hookIndex>". */
  runRelicCounters: Record<string, number>;
```

- [ ] **Step 5: `packages/rules/src/create-combat.ts`**

Thay vòng lặp tạo instance lá thường (khối `let counter = 0; for (const hero of heroDefs) {…}`) bằng:

```ts
  const deckCardIds = setup.deckCardIds ?? heroDefs.flatMap((hero) => hero.cardIds);
  deckCardIds.forEach((cardId, index) => {
    const card = data.cards[cardId];
    if (!card) throw new Error(`createCombat: deck references missing card "${cardId}"`);
    if (card.ownerId === undefined || !setup.heroIds.includes(card.ownerId)) {
      throw new Error(`createCombat: deck card "${cardId}" is not owned by a hero in the team`);
    }
    const instanceId = `c${String(index + 1).padStart(2, "0")}`;
    cards[instanceId] = { instanceId, cardId, ownerIds: [card.ownerId] };
    drawPile.push(instanceId);
  });
```

Trong `heroDefs.map((hero, position) => ({…}))` thay `hp: hero.maxHp, maxHp: hero.maxHp,` bằng:

```ts
    hp: setup.heroes?.[position]?.hp ?? hero.maxHp,
    maxHp: setup.heroes?.[position]?.maxHp ?? hero.maxHp,
```

Trong object `state` sau `rngState,` thêm:

```ts
    runRelicIds: [...(setup.runRelicIds ?? [])],
    runRelicCounters: {},
```

- [ ] **Step 6: `packages/rules/src/moon.ts`**

Thay hàm `activeMoonModifiers` bằng:

```ts
/** Moon phase modifiers plus every held run relic's always-on modifiers. */
export function activeModifiers(data: GameData, state: CombatState): MoonModifier[] {
  const relicModifiers = state.runRelicIds.flatMap((id) => data.runRelics[id]?.modifiers ?? []);
  return [...(data.moonPhases[state.moonIndex]?.modifiers ?? []), ...relicModifiers];
}
```

và đổi 4 lời gọi `activeMoonModifiers(` trong cùng file thành `activeModifiers(`.

`packages/rules/src/queries.ts`: đổi `import { activeMoonModifiers } from "./moon";` thành `import { activeModifiers } from "./moon";` và lời gọi trong `getEffectiveCost` tương ứng. Kiểm tra: `grep -rn activeMoonModifiers packages apps --include=*.ts` không còn kết quả (ngoài `node_modules`).

- [ ] **Step 7: Chạy test**

Run: `pnpm --filter rules exec vitest run test/run-combat.test.ts` → PASS.
Run: `pnpm test` → PASS (T01–T95 không đổi). `pnpm typecheck` → Done.

- [ ] **Step 8: Commit**

```bash
git add packages/rules
git commit -m "Step 3.3a: combat setup takes run deck, hero vitals and run relics; relic modifiers"
```

---

### Task 4: Hệ thống hook Kỳ Vật (bước 3.3b)

**Files:**
- Create: `packages/rules/src/run-relic-hooks.ts`
- Modify: `packages/rules/src/types/events.ts`, `packages/rules/src/effects.ts`, `packages/rules/src/turn.ts`, `packages/rules/src/enemy-turn.ts`, `packages/rules/src/apply-action.ts`, `packages/rules/src/create-combat.ts`, `apps/client/src/debug.ts`
- Test: `packages/rules/test/run-relics.test.ts` (mới)

**Interfaces:**
- Consumes: `CombatState.runRelicIds/runRelicCounters`, `GameData.runRelics`, `RunRelicHook`, `HookTrigger` (Task 2–3).
- Produces: event `{ type: "runRelicTriggered"; runRelicId: string }`; `EffectContext.noHooks?: boolean`; `runRelicHooks(data, state, events, trigger: TriggerInstance): void`; `fireEventHooks(data, state, events, from: number, bloodMoonBefore: number): void`.

- [ ] **Step 1: Viết test (fail)** — `packages/rules/test/run-relics.test.ts`

```ts
import { describe, expect, it } from "vitest";
import type { CombatEvent, CombatState, GameData, RunRelicDef } from "../src/index";
import { applyAction } from "../src/index";
import { idleIntent } from "./fixtures";
import { idleEnemies, instanceIdOf, makeEnemiesIdle, makeTestCombat, setHand, setIntent } from "./helpers";

function play(data: GameData, state: CombatState, cardId: string, targetId?: string) {
  return applyAction(data, state, {
    type: "playCard",
    instanceId: instanceIdOf(state, cardId),
    ...(targetId !== undefined ? { targetId } : {}),
  });
}

function hero(state: CombatState, defId: string) {
  return state.heroes.find((h) => h.defId === defId)!;
}

function triggered(events: CombatEvent[]): string[] {
  return events.flatMap((e) => (e.type === "runRelicTriggered" ? [e.runRelicId] : []));
}

describe("run relic hooks", () => {
  it("T115: combatStart armor lasts through the first enemy turn", () => {
    const { data, state } = makeTestCombat({ runRelicIds: ["nguyet_giap_phu"] });
    expect(state.heroes.map((h) => h.armor)).toEqual([5, 5, 5]);
    setIntent(state, 0, data.enemies["puppet_guard"]!.intentPattern[0]!, "hero:m05");
    setIntent(state, 1, idleIntent, null);
    const result = applyAction(data, state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: "damageDealt", targetId: "hero:m05", blocked: 5, hpLost: 4 }),
    );
  });

  it("T116: every 2 player turns draws one more card", () => {
    const { data, state } = makeTestCombat({
      runRelicIds: ["thanh_loan_vu"],
      mutateData: makeEnemiesIdle,
      setup: idleEnemies,
    });
    expect(state.hand).toHaveLength(5);
    const second = applyAction(data, state, { type: "endTurn" });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.state.hand).toHaveLength(6);
    const third = applyAction(data, second.state, { type: "endTurn" });
    expect(third.ok).toBe(true);
    if (!third.ok) return;
    expect(third.state.hand).toHaveLength(5);
  });

  it("T117: every third attack card grants 1 moon power", () => {
    const { data, state } = makeTestCombat({
      runRelicIds: ["tam_tuyet_kiem_pho"],
      setup: (s) => {
        setHand(s, ["m05_liet_hoa_xung_phong", "m05_ho_gam", "m05_thuong_pha", "m06_am_tien"]);
        s.moonPower = 10;
      },
    });
    let current = state;
    for (const cardId of ["m05_liet_hoa_xung_phong", "m05_ho_gam", "m05_thuong_pha"]) {
      const result = play(data, current, cardId, cardId === "m05_ho_gam" ? undefined : "enemy:0");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      current = result.state;
    }
    expect(current.moonPower).toBe(6);
    const last = play(data, current, "m06_am_tien", "enemy:0");
    expect(last.ok).toBe(true);
    if (!last.ok) return;
    expect(triggered(last.events)).toEqual(["tam_tuyet_kiem_pho"]);
    expect(last.state.moonPower).toBe(6);
  });

  it("T118: cardPlayed filters by tag and uses the card owner (bond: owners[0])", () => {
    const { data, state } = makeTestCombat({
      runRelicIds: ["han_ngoc"],
      setup: (s) => setHand(s, ["m06_nguyet_anh_an", "m05_thuong_pha"]),
    });
    const marked = play(data, state, "m06_nguyet_anh_an", "enemy:0");
    expect(marked.ok).toBe(true);
    if (!marked.ok) return;
    expect(hero(marked.state, "m06").armor).toBe(3);
    const attack = play(data, marked.state, "m05_thuong_pha", "enemy:0");
    expect(attack.ok).toBe(true);
    if (!attack.ok) return;
    expect(hero(attack.state, "m05").armor).toBe(0);

    const bond = makeTestCombat({
      heroIds: ["m05", "f03", "f04"],
      runRelicIds: ["han_ngoc"],
      setup: (s) => setHand(s, ["bond_tuyet_trung_tong_than"]),
    });
    const bonded = play(bond.data, bond.state, "bond_tuyet_trung_tong_than", "enemy:0");
    expect(bonded.ok).toBe(true);
    if (!bonded.ok) return;
    expect(hero(bonded.state, "f03").armor).toBe(3);
  });

  it("T119: enemyKilled heals the killer; a burn kill has no killer", () => {
    const { data, state } = makeTestCombat({
      runRelicIds: ["huyet_an"],
      setup: (s) => setHand(s, ["m05_thuong_pha"]),
    });
    hero(state, "m05").hp = 30;
    state.enemies[0]!.hp = 5;
    const kill = play(data, state, "m05_thuong_pha", "enemy:0");
    expect(kill.ok).toBe(true);
    if (!kill.ok) return;
    expect(hero(kill.state, "m05").hp).toBe(34);

    const burn = makeTestCombat({ runRelicIds: ["huyet_an"], mutateData: makeEnemiesIdle, setup: idleEnemies });
    burn.state.enemies[0]!.hp = 3;
    burn.state.enemies[0]!.statuses.push({ id: "burn", value: 5 });
    const burned = applyAction(burn.data, burn.state, { type: "endTurn" });
    expect(burned.ok).toBe(true);
    if (!burned.ok) return;
    expect(burned.state.enemies[0]?.alive).toBe(false);
    expect(triggered(burned.events)).toEqual([]);
  });

  it("T120: heroDied heals the surviving heroes", () => {
    const { data, state } = makeTestCombat({ runRelicIds: ["tan_hon_dang"] });
    hero(state, "m06").hp = 5;
    hero(state, "m05").hp = 20;
    hero(state, "f04").hp = 20;
    setIntent(state, 0, data.enemies["puppet_guard"]!.intentPattern[0]!, "hero:m06");
    setIntent(state, 1, idleIntent, null);
    const result = applyAction(data, state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(hero(result.state, "m06").alive).toBe(false);
    expect(triggered(result.events)).toEqual(["tan_hon_dang"]);
    expect(hero(result.state, "m05").hp).toBe(26);
    expect(hero(result.state, "f04").hp).toBe(26);
  });

  it("T121: moonPhaseEntered fires on round end and on a moon shift card", () => {
    const roundEnd = makeTestCombat({
      runRelicIds: ["bach_lo_huong_tui"],
      mutateData: makeEnemiesIdle,
      setup: (s) => {
        idleEnemies(s);
        s.moonIndex = 3;
      },
    });
    hero(roundEnd.state, "f04").hp = 10;
    const ended = applyAction(roundEnd.data, roundEnd.state, { type: "endTurn" });
    expect(ended.ok).toBe(true);
    if (!ended.ok) return;
    expect(ended.state.moonIndex).toBe(4);
    expect(hero(ended.state, "f04").hp).toBe(22);

    const shifted = makeTestCombat({
      runRelicIds: ["bach_lo_huong_tui"],
      setup: (s) => {
        s.moonIndex = 3;
        setHand(s, ["f04_nguyet_quang_dan"]);
      },
    });
    hero(shifted.state, "f04").hp = 10;
    const card = play(shifted.data, shifted.state, "f04_nguyet_quang_dan");
    expect(card.ok).toBe(true);
    if (!card.ok) return;
    expect(hero(card.state, "f04").hp).toBe(22);
  });

  it("T122: bloodMoonStarted fires only when blood moon begins", () => {
    const team: [string, string, string] = ["m05", "f03", "f02"];
    const start = makeTestCombat({
      heroIds: team,
      runRelicIds: ["huyet_nguyet_phu"],
      setup: (s) => setHand(s, ["f02_doi_van_chu"]),
    });
    const begun = play(start.data, start.state, "f02_doi_van_chu");
    expect(begun.ok).toBe(true);
    if (!begun.ok) return;
    for (const h of begun.state.heroes) expect(h.statuses).toEqual([{ id: "strength", value: 1 }]);

    const extend = makeTestCombat({
      heroIds: team,
      runRelicIds: ["huyet_nguyet_phu"],
      setup: (s) => {
        s.bloodMoonRounds = 1;
        setHand(s, ["f02_doi_van_chu"]);
      },
    });
    const extended = play(extend.data, extend.state, "f02_doi_van_chu");
    expect(extended.ok).toBe(true);
    if (!extended.ok) return;
    expect(extended.state.bloodMoonRounds).toBe(2);
    expect(triggered(extended.events)).toEqual([]);
  });

  it("T124: relic damage is not an attack (no strength)", () => {
    const blast: RunRelicDef = {
      id: "test_end_blast",
      name: "Test",
      text: "",
      hooks: [{ on: { type: "playerTurnEnd" }, actor: "front", effects: [{ type: "damage", amount: 5, to: "allEnemies" }] }],
    };
    const { data, state } = makeTestCombat({
      runRelicIds: [blast.id],
      mutateData: (d) => {
        makeEnemiesIdle(d);
        d.runRelics[blast.id] = blast;
      },
      setup: idleEnemies,
    });
    hero(state, "m05").statuses.push({ id: "strength", value: 3 });
    const result = applyAction(data, state, { type: "endTurn" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const hits = result.events.filter((e) => e.type === "damageDealt" && e.sourceId === "hero:m05");
    expect(hits.map((e) => e.type === "damageDealt" && e.amount)).toEqual([5, 5]);
  });

  it("T125: hooks do not fire from inside relic effects", () => {
    const chain: RunRelicDef = {
      id: "test_chain",
      name: "Test",
      text: "",
      hooks: [{ on: { type: "enemyKilled" }, actor: "front", effects: [{ type: "damage", amount: 99, to: "allEnemies" }] }],
    };
    const { data, state } = makeTestCombat({
      runRelicIds: [chain.id],
      mutateData: (d) => {
        d.runRelics[chain.id] = chain;
      },
      setup: (s) => setHand(s, ["m05_thuong_pha"]),
    });
    state.enemies[0]!.hp = 5;
    const result = play(data, state, "m05_thuong_pha", "enemy:0");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.status).toBe("won");
    expect(triggered(result.events)).toEqual(["test_chain"]);
  });

  it("T126: relics trigger in acquisition order", () => {
    const armor = (id: string): RunRelicDef => ({
      id,
      name: id,
      text: "",
      hooks: [{ on: { type: "combatStart" }, actor: "front", effects: [{ type: "gainArmor", amount: 1, to: "self" }] }],
    });
    const { events } = makeTestCombat({
      runRelicIds: ["test_b", "test_a"],
      mutateData: (d) => {
        d.runRelics["test_a"] = armor("test_a");
        d.runRelics["test_b"] = armor("test_b");
      },
    });
    expect(triggered(events)).toEqual(["test_b", "test_a"]);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `pnpm --filter rules exec vitest run test/run-relics.test.ts`
Expected: FAIL (không có `runRelicTriggered`, không có giáp đầu trận…).

- [ ] **Step 3: Event** — `packages/rules/src/types/events.ts`, thêm vào `CombatEvent` (trước `heroLeveledUp`):

```ts
  | { type: "runRelicTriggered"; runRelicId: string }
```

`apps/client/src/debug.ts`, trong `describeEvent` thêm case (trước `case "heroLeveledUp":`):

```ts
    case "runRelicTriggered":
      return `Kỳ Vật: ${data.runRelics[event.runRelicId]?.name ?? event.runRelicId}`;
```

- [ ] **Step 4: Engine hook** — tạo `packages/rules/src/run-relic-hooks.ts`

```ts
import { checkCombatEnd, resolveEffects } from "./effects";
import type {
  CardDef,
  CombatEvent,
  CombatState,
  GameData,
  HeroState,
  HookTrigger,
  MoonPhaseId,
  RunRelicActor,
} from "./types/index";

/** A concrete occurrence that run relic hooks may react to. */
export type TriggerInstance =
  | { type: "combatStart" }
  | { type: "playerTurnStart" }
  | { type: "playerTurnEnd" }
  | { type: "cardPlayed"; card: CardDef; heroId: string }
  | { type: "enemyKilled"; killerId?: string }
  | { type: "heroDied" }
  | { type: "moonPhaseEntered"; phase: MoonPhaseId }
  | { type: "bloodMoonStarted" };

function matches(on: HookTrigger, trigger: TriggerInstance): boolean {
  if (on.type !== trigger.type) return false;
  if (on.type === "cardPlayed" && trigger.type === "cardPlayed") {
    if (on.tag !== undefined && !trigger.card.tags.includes(on.tag)) return false;
    if (on.cardType !== undefined && trigger.card.type !== on.cardType) return false;
  }
  if (on.type === "moonPhaseEntered" && trigger.type === "moonPhaseEntered") {
    if (on.phase !== undefined && on.phase !== trigger.phase) return false;
  }
  return true;
}

function pickActors(state: CombatState, actor: RunRelicActor, trigger: TriggerInstance): HeroState[] {
  const living = state.heroes.filter((hero) => hero.alive);
  switch (actor) {
    case "trigger": {
      const heroId =
        trigger.type === "cardPlayed"
          ? trigger.heroId
          : trigger.type === "enemyKilled"
            ? trigger.killerId
            : undefined;
      const hero = living.find((h) => h.id === heroId);
      return hero ? [hero] : [];
    }
    case "each":
      return living;
    case "front":
      return living.slice(0, 1);
    case "lowestHp":
      return living.length === 0
        ? []
        : [living.reduce((best, h) => (h.hp < best.hp ? h : best))];
    default: {
      const exhaustive: never = actor;
      throw new Error(`unknown relic actor ${String(exhaustive)}`);
    }
  }
}

function isOver(state: CombatState): boolean {
  return state.status === "won" || state.status === "lost";
}

/** Runs every held relic hook matching `trigger`, in acquisition then hook order (`01` §13). */
export function runRelicHooks(
  data: GameData,
  state: CombatState,
  events: CombatEvent[],
  trigger: TriggerInstance,
): void {
  for (const relicId of state.runRelicIds) {
    const hooks = data.runRelics[relicId]?.hooks ?? [];
    for (const [index, hook] of hooks.entries()) {
      if (isOver(state)) return;
      if (!matches(hook.on, trigger)) continue;
      const key = `${relicId}#${index}`;
      const count = (state.runRelicCounters[key] ?? 0) + 1;
      state.runRelicCounters[key] = count;
      if (hook.every !== undefined && count % hook.every !== 0) continue;
      const actors = pickActors(state, hook.actor, trigger);
      if (actors.length === 0) continue;
      events.push({ type: "runRelicTriggered", runRelicId: relicId });
      for (const actor of actors) {
        if (!actor.alive) continue;
        // noHooks: triggers raised inside relic effects never fire hooks (no recursion).
        resolveEffects(data, state, hook.effects, { source: actor, noHooks: true }, events);
        if (checkCombatEnd(state, events)) return;
      }
    }
  }
}

/**
 * Fires enemyKilled / heroDied / moonPhaseEntered for events[from..], then
 * bloodMoonStarted if blood moon went from 0 to active.
 */
export function fireEventHooks(
  data: GameData,
  state: CombatState,
  events: CombatEvent[],
  from: number,
  bloodMoonBefore: number,
): void {
  if (state.runRelicIds.length === 0) return;
  for (const event of events.slice(from)) {
    if (isOver(state)) return;
    if (event.type === "unitDied") {
      const isEnemy = state.enemies.some((enemy) => enemy.id === event.unitId);
      runRelicHooks(
        data,
        state,
        events,
        isEnemy ? { type: "enemyKilled", killerId: event.killerId } : { type: "heroDied" },
      );
    } else if (event.type === "moonShifted") {
      runRelicHooks(data, state, events, {
        type: "moonPhaseEntered",
        phase: data.moonPhases[event.to]!.id,
      });
    }
  }
  if (!isOver(state) && bloodMoonBefore === 0 && state.bloodMoonRounds > 0) {
    runRelicHooks(data, state, events, { type: "bloodMoonStarted" });
  }
}
```

- [ ] **Step 5: `packages/rules/src/effects.ts`**

(a) Import: `import { fireEventHooks } from "./run-relic-hooks";`

(b) `EffectContext` thêm:

```ts
  /** Set for run relic effects and nested conditional branches: do not fire hooks here. */
  noHooks?: boolean;
```

(c) Trong `case "conditional":` đổi lời gọi thành:

```ts
      resolveEffects(data, state, branch, { ...ctx, noHooks: true }, events);
```

(d) Thay toàn bộ `resolveEffects` bằng:

```ts
export function resolveEffects(
  data: GameData,
  state: CombatState,
  effects: Effect[],
  ctx: EffectContext,
  events: CombatEvent[],
): void {
  for (const effect of effects) {
    const start = events.length;
    const bloodMoonBefore = state.bloodMoonRounds;
    // Nested effects without their own actor inherit the enclosing one via ctx.
    const effectCtx =
      effect.actor !== undefined && ctx.actors
        ? { ...ctx, source: ctx.actors[effect.actor]! }
        : ctx;
    resolveEffect(data, state, effect, effectCtx, events);
    processDeaths(data, state, events, {
      id: effectCtx.source.id,
      cardDamage: ctx.card !== undefined && effect.type === "damage",
    });
    checkLevelUps(data, state, events);
    if (checkCombatEnd(state, events)) return;
    if (!ctx.noHooks) {
      fireEventHooks(data, state, events, start, bloodMoonBefore);
      if (checkCombatEnd(state, events)) return;
    }
    // An actor that died mid-resolution (e.g. to reflect) stops its card or intent.
    if ((ctx.actors ?? [ctx.source]).some((actor) => !actor.alive)) return;
  }
}
```

- [ ] **Step 6: `packages/rules/src/turn.ts`**

(a) Import: `import { fireEventHooks, runRelicHooks } from "./run-relic-hooks";`

(b) Trong `startPlayerTurn`, thay vòng tick và vòng Huyết Nguyệt bằng:

```ts
  for (const hero of state.heroes) {
    if (!hero.alive) continue;
    const start = events.length;
    tickUnitStatuses(data, state, hero, events);
    if (checkCombatEnd(state, events)) return;
    fireEventHooks(data, state, events, start, state.bloodMoonRounds);
    if (checkCombatEnd(state, events)) return;
  }
  if (state.bloodMoonRounds > 0) {
    for (const hero of state.heroes) {
      if (!hero.alive) continue;
      const start = events.length;
      loseHp(data, hero, BLOOD_MOON_HP_LOSS, "bloodMoon", events);
      processDeaths(data, state, events, undefined);
      checkLevelUps(data, state, events);
      if (checkCombatEnd(state, events)) return;
      fireEventHooks(data, state, events, start, state.bloodMoonRounds);
      if (checkCombatEnd(state, events)) return;
    }
  }
```

và cuối hàm, sau `drawCards(state, 5, events);` thêm:

```ts
  runRelicHooks(data, state, events, { type: "playerTurnStart" });
```

(c) Trong `endRound`, ngay sau `events.push({ type: "moonShifted", from, to: state.moonIndex, cause: "roundEnd" });` thêm:

```ts
  fireEventHooks(data, state, events, events.length - 1, state.bloodMoonRounds);
  if (checkCombatEnd(state, events)) return;
```

(d) Thay `runEndTurn` bằng:

```ts
export function runEndTurn(data: GameData, state: CombatState, events: CombatEvent[]): void {
  runRelicHooks(data, state, events, { type: "playerTurnEnd" });
  if (state.status !== "playerTurn") return;
  if (state.hand.length > 0) {
    const discarded = [...state.hand];
    state.discardPile.push(...discarded);
    state.hand = [];
    events.push({ type: "cardDiscarded", instanceIds: discarded });
  }
  for (const hero of state.heroes) removeStatus(hero, "freeze", events);
  runEnemyTurn(data, state, events);
  if (state.status !== "enemyTurn") return;
  endRound(data, state, events);
  if (state.status !== "enemyTurn") return;
  startPlayerTurn(data, state, events);
}
```

- [ ] **Step 7: `packages/rules/src/enemy-turn.ts`**

Import `import { fireEventHooks } from "./run-relic-hooks";` và thay vòng tick của kẻ địch bằng:

```ts
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    const start = events.length;
    tickUnitStatuses(data, state, enemy, events);
    if (checkCombatEnd(state, events)) return;
    fireEventHooks(data, state, events, start, state.bloodMoonRounds);
    if (checkCombatEnd(state, events)) return;
  }
```

- [ ] **Step 8: `packages/rules/src/apply-action.ts`**

Import `import { runRelicHooks } from "./run-relic-hooks";`. Trong `playCard`, giữa khối dọn `if (card.type === "attack") {…}` và `state.discardPile.push(instance.instanceId);` thêm:

```ts
  runRelicHooks(data, state, events, { type: "cardPlayed", card, heroId: owner.id });
```

- [ ] **Step 9: `packages/rules/src/create-combat.ts`**

Import `import { runRelicHooks } from "./run-relic-hooks";`. Cuối `createCombat`, giữa `startPlayerTurn(data, state, events);` và `return`:

```ts
  runRelicHooks(data, state, events, { type: "combatStart" });
```

- [ ] **Step 10: Chạy test**

Run: `pnpm --filter rules exec vitest run test/run-relics.test.ts` → PASS (T115–T122, T124–T126).
Run: `pnpm test` → PASS (mọi test cũ không đổi). `pnpm typecheck` → Done.

- [ ] **Step 11: Commit**

```bash
git add packages/rules apps/client/src/debug.ts
git commit -m "Step 3.3b: run relic hook engine (triggers, actors, every, no recursion)"
```

---

### Task 5: Sinh bản đồ (bước 3.4)

**Files:**
- Create: `packages/rules/src/types/run.ts` (chỉ `MapNode`, `RunMap` ở task này), `packages/rules/src/run/random.ts`, `packages/rules/src/run/map.ts`
- Modify: `packages/rules/src/types/index.ts`, `packages/rules/src/index.ts`
- Test: `packages/rules/test/map.test.ts` (mới)

**Interfaces:**
- Consumes: `GameData.runConfig`, `EncounterDef.tier/minFloor`, `NodeType` (Task 2).
- Produces: `interface MapNode { id; floor; lane; type: NodeType; next: string[]; encounterId?: string }`, `interface RunMap { floors: MapNode[][] }`; `generateMap(data, rngState): { map: RunMap; rngState: number }`; `interface Rng { state: number }`, `nextFloat(rng): number`, `pickOne<T>(rng, items): T`.

- [ ] **Step 1: Type** — tạo `packages/rules/src/types/run.ts`

```ts
import type { NodeType } from "./static";

export interface MapNode {
  /** "f3n1" = floor 3, lane 1. */
  id: string;
  floor: number;
  lane: number;
  type: NodeType;
  /** Node ids on the next floor, by increasing lane. */
  next: string[];
  /** Set for combat, elite and boss nodes. */
  encounterId?: string;
}

export interface RunMap {
  /** floors[i] = floor i + 1, by lane. */
  floors: MapNode[][];
}
```

`packages/rules/src/types/index.ts` thêm dòng `export type * from "./run";`.

- [ ] **Step 2: Viết test (fail)** — `packages/rules/test/map.test.ts`

```ts
import { describe, expect, it } from "vitest";
import type { MapNode, RunMap } from "../src/index";
import { generateMap } from "../src/index";
import { testData } from "./helpers";

const data = testData();
const maps = Array.from({ length: 50 }, (_, i) => generateMap(data, i + 1).map);

const nodesOf = (map: RunMap) => map.floors.flat();
const laneOf = (map: RunMap, id: string) => nodesOf(map).find((n) => n.id === id)!.lane;
const parentsOf = (map: RunMap, node: MapNode) =>
  node.floor === 1 ? [] : map.floors[node.floor - 2]!.filter((p) => p.next.includes(node.id));
const ruleOf = (floor: number) => data.runConfig.floorRules.find((r) => r.floors.includes(floor))!;

describe("map generation", () => {
  it("T96: floors 1-7 have 2-3 nodes and floor 8 is a single boss", () => {
    for (const map of maps) {
      expect(map.floors).toHaveLength(8);
      for (const floor of map.floors.slice(0, 7)) {
        expect(floor.length).toBeGreaterThanOrEqual(2);
        expect(floor.length).toBeLessThanOrEqual(3);
      }
      expect(map.floors[7]!.map((n) => n.type)).toEqual(["boss"]);
    }
  });

  it("T97: every node is connected and reachable from floor 1", () => {
    for (const map of maps) {
      for (const node of nodesOf(map)) {
        if (node.floor < 8) expect(node.next.length).toBeGreaterThan(0);
        if (node.floor > 1) expect(parentsOf(map, node).length).toBeGreaterThan(0);
      }
      const seen = new Set(map.floors[0]!.map((n) => n.id));
      for (const floor of map.floors) {
        for (const node of floor) if (seen.has(node.id)) node.next.forEach((id) => seen.add(id));
      }
      expect(seen.size).toBe(nodesOf(map).length);
    }
  });

  it("T98: edges never cross and next lists are sorted by lane", () => {
    for (const map of maps) {
      for (const floor of map.floors) {
        for (const node of floor) {
          const lanes = node.next.map((id) => laneOf(map, id));
          expect(lanes).toEqual([...lanes].sort((a, b) => a - b));
        }
        for (const a of floor) {
          for (const b of floor) {
            if (a.lane >= b.lane || a.next.length === 0) continue;
            const maxA = Math.max(...a.next.map((id) => laneOf(map, id)));
            const minB = Math.min(...b.next.map((id) => laneOf(map, id)));
            expect(maxA).toBeLessThanOrEqual(minB);
          }
        }
      }
    }
  });

  it("T99: node types follow floorRules; no elite/rest right after the same type", () => {
    for (const map of maps) {
      for (const node of nodesOf(map)) {
        const rule = ruleOf(node.floor);
        if ("type" in rule) {
          expect(node.type).toBe(rule.type);
        } else {
          expect(rule.weights[node.type] ?? 0).toBeGreaterThan(0);
          if (node.type === "elite" || node.type === "rest") {
            expect(parentsOf(map, node).some((p) => p.type === node.type)).toBe(false);
          }
        }
      }
    }
  });

  it("T100: encounters match tier and minFloor and avoid parents' encounters", () => {
    for (const map of maps) {
      for (const node of nodesOf(map)) {
        if (node.type === "rest" || node.type === "treasure") {
          expect(node.encounterId).toBeUndefined();
          continue;
        }
        const encounter = data.encounters[node.encounterId!]!;
        const tier = node.type === "combat" ? "normal" : node.type;
        expect(encounter.tier).toBe(tier);
        expect(encounter.minFloor ?? 1).toBeLessThanOrEqual(node.floor);
        const parentEncounters = new Set(parentsOf(map, node).map((p) => p.encounterId));
        if (node.type !== "boss" && parentEncounters.has(node.encounterId)) {
          const pool = Object.values(data.encounters).filter(
            (e) => e.tier === tier && (e.minFloor ?? 1) <= node.floor && !parentEncounters.has(e.id),
          );
          expect(pool).toEqual([]);
        }
      }
    }
  });

  it("T101: same seed gives the same map; seeds give different maps", () => {
    expect(generateMap(data, 7)).toEqual(generateMap(data, 7));
    const distinct = new Set(maps.slice(0, 10).map((map) => JSON.stringify(map)));
    expect(distinct.size).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận fail**

Run: `pnpm --filter rules exec vitest run test/map.test.ts`
Expected: FAIL (`generateMap` không tồn tại).

- [ ] **Step 4: RNG helper** — tạo `packages/rules/src/run/random.ts`

```ts
import { nextRandom } from "../rng";

/** Mutable cursor over a seeded RNG state, for multi-step generation. */
export interface Rng {
  state: number;
}

export function nextFloat(rng: Rng): number {
  const roll = nextRandom(rng.state);
  rng.state = roll.rngState;
  return roll.value;
}

export function pickOne<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error("pickOne: empty list");
  return items[Math.floor(nextFloat(rng) * items.length)]!;
}
```

- [ ] **Step 5: Sinh bản đồ** — tạo `packages/rules/src/run/map.ts`

```ts
import type { GameData, MapNode, NodeType, RunMap } from "../types/index";
import { nextFloat, pickOne, type Rng } from "./random";

/**
 * Contiguous next-floor ranges for each of `a` nodes into `b` nodes: each range
 * has 1–2 nodes, ranges are ordered and overlap by at most one node, the first
 * starts at 0 and the last ends at b - 1 (`11` §2.1). Needs b <= 2a.
 */
function connectFloors(rng: Rng, a: number, b: number): [number, number][] {
  const ranges: [number, number][] = [];
  let lo = 0;
  for (let i = 0; i < a; i++) {
    const rest = a - 1 - i;
    const his = [lo, lo + 1].filter(
      (hi) => hi <= b - 1 && hi + 2 * rest >= b - 1 && (rest > 0 || hi === b - 1),
    );
    const hi = pickOne(rng, his);
    ranges.push([lo, hi]);
    if (rest > 0) {
      const los = [hi, hi + 1].filter((next) => next <= b - 1 && next + 1 + 2 * (rest - 1) >= b - 1);
      lo = pickOne(rng, los);
    }
  }
  return ranges;
}

function pickWeighted(rng: Rng, entries: [NodeType, number][]): NodeType {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = nextFloat(rng) * total;
  for (const [type, weight] of entries) {
    if (roll < weight) return type;
    roll -= weight;
  }
  return entries[entries.length - 1]![0];
}

function pickNodeType(rng: Rng, data: GameData, node: MapNode, parents: MapNode[]): NodeType {
  const rule = data.runConfig.floorRules.find((r) => r.floors.includes(node.floor))!;
  if ("type" in rule) return rule.type;
  const blocked = new Set(
    parents.map((p) => p.type).filter((type) => type === "elite" || type === "rest"),
  );
  const entries = (Object.entries(rule.weights) as [NodeType, number | undefined][]).filter(
    (entry): entry is [NodeType, number] =>
      entry[1] !== undefined && entry[1] > 0 && !blocked.has(entry[0]),
  );
  return entries.length > 0 ? pickWeighted(rng, entries) : "combat";
}

/** Seeded map (`11` §2). RNG order: widths → edges → node types → encounters. */
export function generateMap(data: GameData, rngState: number): { map: RunMap; rngState: number } {
  const rng: Rng = { state: rngState };
  const { floors, floorWidth } = data.runConfig;

  const widths: number[] = [];
  for (let floor = 1; floor <= floors; floor++) {
    widths.push(
      floor === floors
        ? 1
        : floorWidth.min + Math.floor(nextFloat(rng) * (floorWidth.max - floorWidth.min + 1)),
    );
  }
  const nodes: MapNode[][] = widths.map((width, index) =>
    Array.from({ length: width }, (_, lane) => ({
      id: `f${index + 1}n${lane}`,
      floor: index + 1,
      lane,
      type: "combat" as NodeType,
      next: [] as string[],
    })),
  );

  for (let f = 0; f < floors - 1; f++) {
    const ranges = connectFloors(rng, widths[f]!, widths[f + 1]!);
    nodes[f]!.forEach((node, lane) => {
      const [lo, hi] = ranges[lane]!;
      for (let to = lo; to <= hi; to++) node.next.push(nodes[f + 1]![to]!.id);
    });
  }

  const parentsOf = (node: MapNode): MapNode[] =>
    node.floor === 1 ? [] : nodes[node.floor - 2]!.filter((p) => p.next.includes(node.id));

  for (const floorNodes of nodes) {
    for (const node of floorNodes) node.type = pickNodeType(rng, data, node, parentsOf(node));
  }

  const encounters = Object.values(data.encounters);
  for (const floorNodes of nodes) {
    for (const node of floorNodes) {
      if (node.type === "boss") {
        node.encounterId = encounters.find((e) => e.tier === "boss")!.id;
      } else if (node.type === "combat" || node.type === "elite") {
        const tier = node.type === "combat" ? "normal" : "elite";
        const pool = encounters
          .filter((e) => e.tier === tier && (e.minFloor ?? 1) <= node.floor)
          .map((e) => e.id);
        if (pool.length === 0) {
          throw new Error(`generateMap: no ${tier} encounter for floor ${node.floor}`);
        }
        const parentEncounters = new Set(parentsOf(node).map((p) => p.encounterId));
        const fresh = pool.filter((id) => !parentEncounters.has(id));
        node.encounterId = pickOne(rng, fresh.length > 0 ? fresh : pool);
      }
    }
  }

  return { map: { floors: nodes }, rngState: rng.state };
}
```

- [ ] **Step 6: Export** — `packages/rules/src/index.ts` thêm `export { generateMap } from "./run/map";`

- [ ] **Step 7: Chạy test**

Run: `pnpm --filter rules exec vitest run test/map.test.ts` → PASS.
Run: `pnpm test`, `pnpm typecheck` → PASS / Done.

- [ ] **Step 8: Commit**

```bash
git add packages/rules
git commit -m "Step 3.4: seeded run map generation"
```

---

### Task 6: State machine lượt chơi (bước 3.5)

**Files:**
- Create: `packages/rules/src/run/run.ts`
- Modify: `packages/rules/src/types/run.ts`, `packages/rules/src/index.ts`
- Test: `packages/rules/test/run.test.ts` (mới)

**Interfaces:**
- Consumes: `generateMap`, `Rng`/`pickOne` (Task 5); `createCombat` với `deckCardIds/heroes/runRelicIds` (Task 3); `applyAction`, `shuffle`, `nextRandom`.
- Produces: types `RunStatus`, `RunState`, `RunSetup`, `RunAction`, `RunEvent`, `RunActionResult`; functions `createRun(data, setup): { run: RunState; runEvents: RunEvent[] }`, `getRunActionError(data, run, action): string | null`, `applyRunAction(data, run, action): RunActionResult`, `reachableNodeIds(run): string[]`, `restHealAmounts(data, run): number[]`, `findNode(run, nodeId): MapNode | undefined`. Chuỗi lỗi: `"run is over"`, `"not choosing a node"`, `"node is not reachable"`, `"not in combat"`, `"no reward to pick"`, `"card is not a reward choice"`, `"not resting"`, `"card is not in deck"`, `"deck is at minimum size"`, `"nothing to continue"`.

- [ ] **Step 1: Type** — thêm vào `packages/rules/src/types/run.ts`

```ts
import type { Action, CombatEvent } from "./events";
import type { CombatState } from "./state";
```

(đặt cạnh import `NodeType` có sẵn) và cuối file:

```ts
export type RunStatus = "map" | "combat" | "reward" | "rest" | "treasure" | "won" | "lost";

export interface RunState {
  status: RunStatus;
  rngState: number;
  /** In team order. */
  heroes: { defId: string; hp: number; maxHp: number }[];
  /** Card ids; bond cards are added per combat, not stored here. */
  deck: string[];
  /** In acquisition order. */
  runRelicIds: string[];
  map: RunMap;
  /** Current node; null before entering floor 1. */
  position: string | null;
  combat: CombatState | null;
  pendingReward: { cardChoices: string[]; runRelicId?: string } | null;
}

export interface RunSetup {
  heroIds: [string, string, string];
  seed: number;
}

export type RunAction =
  | { type: "chooseNode"; nodeId: string }
  | { type: "combat"; action: Action }
  | { type: "pickCard"; cardId: string | null }
  | { type: "rest"; choice: "heal" }
  | { type: "rest"; choice: "removeCard"; cardId: string }
  | { type: "continue" };

export type RunEvent =
  | { type: "nodeEntered"; nodeId: string; nodeType: NodeType }
  | { type: "cardAdded"; cardId: string }
  | { type: "cardRemoved"; cardId: string }
  | { type: "runRelicGained"; runRelicId: string }
  /** heroId is the hero's defId ("m05"). */
  | { type: "heroRevived"; heroId: string; hp: number }
  | { type: "restHealed"; heroId: string; amount: number }
  | { type: "runEnded"; result: "won" | "lost" };

export type RunActionResult =
  | { ok: true; run: RunState; events: CombatEvent[]; runEvents: RunEvent[] }
  | { ok: false; error: string };
```

- [ ] **Step 2: Viết test (fail)** — `packages/rules/test/run.test.ts`

```ts
import { describe, expect, it } from "vitest";
import type { GameData, NodeType, RunAction, RunState } from "../src/index";
import { applyRunAction, createRun, reachableNodeIds } from "../src/index";
import { testData } from "./helpers";

const DEFAULT_TEAM: [string, string, string] = ["m05", "f04", "m06"];

function newRun(seed = 42) {
  const data = testData();
  return { data, run: createRun(data, { heroIds: DEFAULT_TEAM, seed }).run };
}

function act(data: GameData, run: RunState, action: RunAction) {
  const result = applyRunAction(data, run, action);
  if (!result.ok) throw new Error(`unexpected run error: ${result.error}`);
  return result;
}

/** Test setup: turn the first floor-1 node into the given type. */
function forceFirstNode(run: RunState, type: NodeType, encounterId?: string): string {
  const node = run.map.floors[0]![0]!;
  node.type = type;
  if (encounterId !== undefined) node.encounterId = encounterId;
  else delete node.encounterId;
  return node.id;
}

function firstNodeId(run: RunState): string {
  return run.map.floors[0]![0]!.id;
}

/** Every enemy dies to burn at the next enemy turn start. */
function winCombat(data: GameData, run: RunState) {
  for (const enemy of run.combat!.enemies) enemy.statuses.push({ id: "burn", value: 999 });
  return act(data, run, { type: "combat", action: { type: "endTurn" } });
}

/** Every hero dies to burn at the next player turn start. */
function loseCombat(data: GameData, run: RunState) {
  for (const hero of run.combat!.heroes) hero.statuses.push({ id: "burn", value: 999 });
  return act(data, run, { type: "combat", action: { type: "endTurn" } });
}

function teamRewardPool(data: GameData): string[] {
  return DEFAULT_TEAM.flatMap((id) => data.heroes[id]!.rewardCardIds);
}

describe("run lifecycle", () => {
  it("T102: a new run starts on the map with the starting deck", () => {
    const { data, run } = newRun();
    expect(run.status).toBe("map");
    expect(run.deck).toEqual(DEFAULT_TEAM.flatMap((id) => data.heroes[id]!.cardIds));
    expect(run.heroes).toEqual(
      DEFAULT_TEAM.map((id) => ({ defId: id, hp: data.heroes[id]!.maxHp, maxHp: data.heroes[id]!.maxHp })),
    );
    expect(run.runRelicIds).toEqual([]);
    expect(run.position).toBeNull();
  });

  it("T103: only reachable nodes can be chosen", () => {
    const { data, run } = newRun();
    const before = JSON.stringify(run);
    const floor2 = run.map.floors[1]![0]!.id;
    expect(applyRunAction(data, run, { type: "chooseNode", nodeId: floor2 })).toEqual({
      ok: false,
      error: "node is not reachable",
    });
    expect(JSON.stringify(run)).toBe(before);
    expect(reachableNodeIds(run)).toEqual(run.map.floors[0]!.map((n) => n.id));
    expect(applyRunAction(data, run, { type: "chooseNode", nodeId: firstNodeId(run) }).ok).toBe(true);
  });

  it("T104: entering a combat node uses the run's HP and deck", () => {
    const { data, run } = newRun();
    run.heroes[1]!.hp = 20;
    const { run: next } = act(data, run, { type: "chooseNode", nodeId: firstNodeId(run) });
    expect(next.status).toBe("combat");
    expect(next.combat!.heroes[1]!.hp).toBe(20);
    expect(Object.values(next.combat!.cards).map((c) => c.cardId).sort()).toEqual([...run.deck].sort());
  });

  it("T105: winning carries HP, revives fallen heroes and offers 3 reward cards", () => {
    const { data, run } = newRun();
    const entered = act(data, run, { type: "chooseNode", nodeId: firstNodeId(run) }).run;
    const [m05, f04] = entered.combat!.heroes;
    m05!.hp = 25;
    f04!.hp = 0;
    f04!.alive = false;
    const { run: won, runEvents } = winCombat(data, entered);
    expect(won.heroes.map((h) => h.hp)).toEqual([25, 8, 28]);
    expect(runEvents).toContainEqual({ type: "heroRevived", heroId: "f04", hp: 8 });
    expect(won.status).toBe("reward");
    expect(won.combat).toBeNull();
    const choices = won.pendingReward!.cardChoices;
    expect(choices).toHaveLength(3);
    expect(new Set(choices).size).toBe(3);
    for (const cardId of choices) {
      expect(teamRewardPool(data)).toContain(cardId);
      expect(won.deck).not.toContain(cardId);
    }
  });

  it("T106: picking a reward card adds it; skipping keeps the deck", () => {
    const { data, run } = newRun();
    const entered = act(data, run, { type: "chooseNode", nodeId: firstNodeId(run) }).run;
    const reward = winCombat(data, entered).run;
    const pick = reward.pendingReward!.cardChoices[0]!;
    const picked = act(data, reward, { type: "pickCard", cardId: pick });
    expect(picked.run.deck).toHaveLength(16);
    expect(picked.run.deck).toContain(pick);
    expect(picked.run.status).toBe("map");
    expect(picked.runEvents).toEqual([{ type: "cardAdded", cardId: pick }]);
    const skipped = act(data, reward, { type: "pickCard", cardId: null });
    expect(skipped.run.deck).toHaveLength(15);
    expect(skipped.run.status).toBe("map");
  });

  it("T107: a card outside the choices is rejected", () => {
    const { data, run } = newRun();
    const entered = act(data, run, { type: "chooseNode", nodeId: firstNodeId(run) }).run;
    const reward = winCombat(data, entered).run;
    expect(applyRunAction(data, reward, { type: "pickCard", cardId: "m05_ho_gam" })).toEqual({
      ok: false,
      error: "card is not a reward choice",
    });
  });

  it("T108: winning an elite also grants a run relic", () => {
    const { data, run } = newRun();
    const nodeId = forceFirstNode(run, "elite", "enc_elite_01");
    const entered = act(data, run, { type: "chooseNode", nodeId }).run;
    const { run: won, runEvents } = winCombat(data, entered);
    expect(won.runRelicIds).toHaveLength(1);
    expect(runEvents).toContainEqual({ type: "runRelicGained", runRelicId: won.runRelicIds[0] });
    expect(won.pendingReward!.runRelicId).toBe(won.runRelicIds[0]);
    expect(won.pendingReward!.cardChoices).toHaveLength(3);
    expect(won.status).toBe("reward");
  });

  it("T109: resting heals 30% max HP, capped", () => {
    const { data, run } = newRun();
    const nodeId = forceFirstNode(run, "rest");
    const resting = act(data, run, { type: "chooseNode", nodeId }).run;
    expect(resting.status).toBe("rest");
    resting.heroes[0]!.hp = 20;
    const { run: healed, runEvents } = act(data, resting, { type: "rest", choice: "heal" });
    expect(healed.heroes.map((h) => h.hp)).toEqual([32, 30, 28]);
    expect(runEvents).toEqual([{ type: "restHealed", heroId: "m05", amount: 12 }]);
    expect(healed.status).toBe("map");
  });

  it("T110: resting can remove a card down to the minimum deck size", () => {
    const { data, run } = newRun();
    const nodeId = forceFirstNode(run, "rest");
    const resting = act(data, run, { type: "chooseNode", nodeId }).run;
    resting.deck = resting.deck.slice(0, 11);
    const removed = act(data, resting, { type: "rest", choice: "removeCard", cardId: resting.deck[0]! });
    expect(removed.run.deck).toHaveLength(10);
    expect(removed.run.status).toBe("map");
    expect(removed.runEvents).toEqual([{ type: "cardRemoved", cardId: resting.deck[0] }]);
    resting.deck = resting.deck.slice(0, 10);
    expect(
      applyRunAction(data, resting, { type: "rest", choice: "removeCard", cardId: resting.deck[0]! }),
    ).toEqual({ ok: false, error: "deck is at minimum size" });
  });

  it("T111: a treasure node grants a run relic", () => {
    const { data, run } = newRun();
    const nodeId = forceFirstNode(run, "treasure");
    const { run: treasure, runEvents } = act(data, run, { type: "chooseNode", nodeId });
    expect(treasure.status).toBe("treasure");
    expect(treasure.runRelicIds).toHaveLength(1);
    expect(runEvents).toContainEqual({ type: "runRelicGained", runRelicId: treasure.runRelicIds[0] });
    expect(act(data, treasure, { type: "continue" }).run.status).toBe("map");
  });

  it("T112: beating the boss wins the run; losing a combat loses it", () => {
    const { data, run } = newRun();
    const nodeId = forceFirstNode(run, "boss", "enc_04");
    const fighting = act(data, run, { type: "chooseNode", nodeId }).run;
    const { run: won, runEvents } = winCombat(data, fighting);
    expect(won.status).toBe("won");
    expect(runEvents).toContainEqual({ type: "runEnded", result: "won" });
    expect(applyRunAction(data, won, { type: "continue" })).toEqual({ ok: false, error: "run is over" });

    const other = newRun();
    const inCombat = act(other.data, other.run, { type: "chooseNode", nodeId: firstNodeId(other.run) }).run;
    const { run: lost, runEvents: lostEvents } = loseCombat(other.data, inCombat);
    expect(lost.status).toBe("lost");
    expect(lostEvents).toContainEqual({ type: "runEnded", result: "lost" });
  });

  it("T113: same seed and actions give identical runs", () => {
    const playThrough = () => {
      const { data, run } = newRun(7);
      const log: unknown[] = [];
      let current = act(data, run, { type: "chooseNode", nodeId: firstNodeId(run) });
      log.push(current.events, current.runEvents);
      current = winCombat(data, current.run);
      log.push(current.events, current.runEvents);
      current = act(data, current.run, { type: "pickCard", cardId: current.run.pendingReward!.cardChoices[0]! });
      log.push(current.runEvents);
      current = act(data, current.run, { type: "chooseNode", nodeId: reachableNodeIds(current.run)[0]! });
      log.push(current.events, current.runEvents);
      return { run: current.run, log };
    };
    expect(playThrough()).toEqual(playThrough());
  });

  it("T114: reward choices shrink with the pool; an empty pool skips the reward", () => {
    const { data, run } = newRun();
    const pool = teamRewardPool(data);
    run.deck.push(...pool.slice(0, 11));
    const entered = act(data, run, { type: "chooseNode", nodeId: firstNodeId(run) }).run;
    expect(winCombat(data, entered).run.pendingReward!.cardChoices).toEqual([pool[11]]);

    const full = newRun();
    full.run.deck.push(...pool);
    const fullEntered = act(full.data, full.run, { type: "chooseNode", nodeId: firstNodeId(full.run) }).run;
    const done = winCombat(full.data, fullEntered).run;
    expect(done.status).toBe("map");
    expect(done.pendingReward).toBeNull();
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận fail**

Run: `pnpm --filter rules exec vitest run test/run.test.ts`
Expected: FAIL (`createRun` không tồn tại).

- [ ] **Step 4: State machine** — tạo `packages/rules/src/run/run.ts`

```ts
import { applyAction } from "../apply-action";
import { createCombat } from "../create-combat";
import { nextRandom, shuffle } from "../rng";
import type {
  CombatEvent,
  GameData,
  MapNode,
  RunAction,
  RunActionResult,
  RunEvent,
  RunSetup,
  RunState,
} from "../types/index";
import { generateMap } from "./map";
import { pickOne, type Rng } from "./random";

function cloneRun(run: RunState): RunState {
  return JSON.parse(JSON.stringify(run)) as RunState;
}

export function findNode(run: RunState, nodeId: string): MapNode | undefined {
  return run.map.floors.flat().find((node) => node.id === nodeId);
}

export function reachableNodeIds(run: RunState): string[] {
  if (run.position === null) return run.map.floors[0]!.map((node) => node.id);
  return findNode(run, run.position)?.next ?? [];
}

/** HP each hero would regain from resting now (`11` §3.1). */
export function restHealAmounts(data: GameData, run: RunState): number[] {
  return run.heroes.map((hero) =>
    Math.min(hero.maxHp - hero.hp, Math.floor(hero.maxHp * data.runConfig.restHealRatio)),
  );
}

export function createRun(data: GameData, setup: RunSetup): { run: RunState; runEvents: RunEvent[] } {
  const heroDefs = setup.heroIds.map((heroId) => {
    const hero = data.heroes[heroId];
    if (!hero) throw new Error(`createRun: unknown hero "${heroId}"`);
    return hero;
  });
  const { map, rngState } = generateMap(data, setup.seed);
  const run: RunState = {
    status: "map",
    rngState,
    heroes: heroDefs.map((hero) => ({ defId: hero.id, hp: hero.maxHp, maxHp: hero.maxHp })),
    deck: heroDefs.flatMap((hero) => hero.cardIds),
    runRelicIds: [],
    map,
    position: null,
    combat: null,
    pendingReward: null,
  };
  return { run, runEvents: [] };
}

export function getRunActionError(data: GameData, run: RunState, action: RunAction): string | null {
  if (run.status === "won" || run.status === "lost") return "run is over";
  switch (action.type) {
    case "chooseNode":
      if (run.status !== "map") return "not choosing a node";
      return reachableNodeIds(run).includes(action.nodeId) ? null : "node is not reachable";
    case "combat":
      return run.status === "combat" && run.combat !== null ? null : "not in combat";
    case "pickCard":
      if (run.status !== "reward" || run.pendingReward === null) return "no reward to pick";
      if (action.cardId !== null && !run.pendingReward.cardChoices.includes(action.cardId)) {
        return "card is not a reward choice";
      }
      return null;
    case "rest":
      if (run.status !== "rest") return "not resting";
      if (action.choice === "removeCard") {
        if (!run.deck.includes(action.cardId)) return "card is not in deck";
        if (run.deck.length <= data.runConfig.minDeckSize) return "deck is at minimum size";
      }
      return null;
    case "continue":
      return run.status === "treasure" ? null : "nothing to continue";
    default: {
      const exhaustive: never = action;
      return `unknown run action ${JSON.stringify(exhaustive)}`;
    }
  }
}

function gainRunRelic(data: GameData, run: RunState, runEvents: RunEvent[]): string | undefined {
  const pool = Object.keys(data.runRelics).filter((id) => !run.runRelicIds.includes(id));
  if (pool.length === 0) return undefined;
  const rng: Rng = { state: run.rngState };
  const runRelicId = pickOne(rng, pool);
  run.rngState = rng.state;
  run.runRelicIds.push(runRelicId);
  runEvents.push({ type: "runRelicGained", runRelicId });
  return runRelicId;
}

function drawCardChoices(data: GameData, run: RunState): string[] {
  const pool = run.heroes
    .flatMap((hero) => data.heroes[hero.defId]!.rewardCardIds)
    .filter((cardId) => !run.deck.includes(cardId));
  const shuffled = shuffle(pool, run.rngState);
  run.rngState = shuffled.rngState;
  return shuffled.items.slice(0, data.runConfig.rewardCardChoices);
}

function enterNode(
  data: GameData,
  run: RunState,
  nodeId: string,
  events: CombatEvent[],
  runEvents: RunEvent[],
): void {
  const node = findNode(run, nodeId)!;
  run.position = node.id;
  runEvents.push({ type: "nodeEntered", nodeId: node.id, nodeType: node.type });
  switch (node.type) {
    case "combat":
    case "elite":
    case "boss": {
      const roll = nextRandom(run.rngState);
      run.rngState = roll.rngState;
      const created = createCombat(data, {
        heroIds: run.heroes.map((hero) => hero.defId) as [string, string, string],
        encounterId: node.encounterId!,
        seed: Math.floor(roll.value * 2 ** 32),
        deckCardIds: [...run.deck],
        heroes: run.heroes.map(({ hp, maxHp }) => ({ hp, maxHp })),
        runRelicIds: [...run.runRelicIds],
      });
      run.combat = created.state;
      events.push(...created.events);
      run.status = "combat";
      return;
    }
    case "rest":
      run.status = "rest";
      return;
    case "treasure":
      gainRunRelic(data, run, runEvents);
      run.status = "treasure";
      return;
    default: {
      const exhaustive: never = node.type;
      throw new Error(`unknown node type ${String(exhaustive)}`);
    }
  }
}

function finishCombat(data: GameData, run: RunState, runEvents: RunEvent[]): void {
  const combat = run.combat!;
  run.combat = null;
  if (combat.status === "lost") {
    run.status = "lost";
    runEvents.push({ type: "runEnded", result: "lost" });
    return;
  }
  combat.heroes.forEach((unit, index) => {
    const hero = run.heroes[index]!;
    if (unit.alive) {
      hero.hp = unit.hp;
      return;
    }
    hero.hp = Math.max(1, Math.ceil(hero.maxHp * data.runConfig.reviveHpRatio));
    runEvents.push({ type: "heroRevived", heroId: hero.defId, hp: hero.hp });
  });
  const node = findNode(run, run.position!)!;
  if (node.type === "boss") {
    run.status = "won";
    runEvents.push({ type: "runEnded", result: "won" });
    return;
  }
  const cardChoices = drawCardChoices(data, run);
  const runRelicId = node.type === "elite" ? gainRunRelic(data, run, runEvents) : undefined;
  if (cardChoices.length === 0 && runRelicId === undefined) {
    run.status = "map";
    return;
  }
  run.pendingReward = { cardChoices, ...(runRelicId !== undefined ? { runRelicId } : {}) };
  run.status = "reward";
}

export function applyRunAction(data: GameData, run: RunState, action: RunAction): RunActionResult {
  const error = getRunActionError(data, run, action);
  if (error !== null) return { ok: false, error };
  const next = cloneRun(run);
  const events: CombatEvent[] = [];
  const runEvents: RunEvent[] = [];
  switch (action.type) {
    case "chooseNode":
      enterNode(data, next, action.nodeId, events, runEvents);
      break;
    case "combat": {
      const result = applyAction(data, next.combat!, action.action);
      if (!result.ok) return { ok: false, error: result.error };
      next.combat = result.state;
      events.push(...result.events);
      if (result.state.status === "won" || result.state.status === "lost") {
        finishCombat(data, next, runEvents);
      }
      break;
    }
    case "pickCard":
      if (action.cardId !== null) {
        next.deck.push(action.cardId);
        runEvents.push({ type: "cardAdded", cardId: action.cardId });
      }
      next.pendingReward = null;
      next.status = "map";
      break;
    case "rest":
      if (action.choice === "heal") {
        restHealAmounts(data, next).forEach((amount, index) => {
          const hero = next.heroes[index]!;
          hero.hp += amount;
          if (amount > 0) runEvents.push({ type: "restHealed", heroId: hero.defId, amount });
        });
      } else {
        next.deck.splice(next.deck.indexOf(action.cardId), 1);
        runEvents.push({ type: "cardRemoved", cardId: action.cardId });
      }
      next.status = "map";
      break;
    case "continue":
      next.status = "map";
      break;
    default: {
      const exhaustive: never = action;
      return { ok: false, error: `unknown run action ${JSON.stringify(exhaustive)}` };
    }
  }
  return { ok: true, run: next, events, runEvents };
}
```

- [ ] **Step 5: Export** — `packages/rules/src/index.ts` thêm:

```ts
export {
  applyRunAction,
  createRun,
  findNode,
  getRunActionError,
  reachableNodeIds,
  restHealAmounts,
} from "./run/run";
```

- [ ] **Step 6: Chạy test**

Run: `pnpm --filter rules exec vitest run test/run.test.ts` → PASS (T102–T114).
Run: `pnpm test`, `pnpm typecheck` → PASS / Done.

- [ ] **Step 7: Commit**

```bash
git add packages/rules
git commit -m "Step 3.5: run state machine (map, combat, rewards, rest, treasure, win/loss)"
```

---

### Task 7: Client — chế độ Lượt chơi (bước 3.6)

**Files:**
- Create: `apps/client/src/scenes/run-scene.ts`
- Modify: `apps/client/src/session.ts`, `apps/client/src/main.ts`, `apps/client/src/ui/theme.ts`, `apps/client/src/ui/event-animator.ts`, `apps/client/src/scenes/team-select-scene.ts`, `apps/client/src/scenes/combat-scene.ts`

**Interfaces:**
- Consumes: `createRun`, `applyRunAction`, `reachableNodeIds`, `restHealAmounts`, `findNode`, `RunState`, `RunAction`, `MapNode`, `NodeType` (Task 5–6).
- Produces: `session.run: RunState | null`, `startRun(heroIds, seed?)`; scene key `"run"`.

Client không có test tự động; kiểm tra bằng `pnpm typecheck` và chơi thử trên trình duyệt (Step 8).

- [ ] **Step 1: `apps/client/src/session.ts`**

Thêm import `createRun` và type `RunState`:

```ts
import { createCombat, createRun } from "rules";
import type { CombatEvent, CombatState, GameData, RunState } from "rules";
```

`CombatSession` thêm trường `run: RunState | null;`. `newCombatSession` trả thêm `run: null`. Trong `restartSession` thêm dòng `session.run = null;`. Thêm hàm:

```ts
/** Starts a roguelike run; combat state is taken from the run when a fight begins. */
export function startRun(heroIds: Team, seed = session.seed): void {
  session.heroIds = heroIds;
  session.seed = seed;
  session.run = createRun(session.data, { heroIds, seed }).run;
}
```

- [ ] **Step 2: `apps/client/src/ui/theme.ts`**

Đổi import type thành `import type { CardTag, Faction, IntentKind, MoonModifier, MoonPhaseId, NodeType, StatusId } from "rules";` và thêm:

```ts
export const NODE_ICONS: Record<NodeType, string> = {
  combat: "⚔",
  elite: "☠",
  rest: "🏮",
  treasure: "🎁",
  boss: "🌕",
};
```

- [ ] **Step 3: `apps/client/src/ui/event-animator.ts`**

Trong `switch` của `animateEvent`, trước `case "combatEnded":` thêm:

```ts
    case "runRelicTriggered": {
      const name = ctx.gameData.runRelics[event.runRelicId]?.name ?? event.runRelicId;
      return floatText(scene, WIDTH / 2, 250, `✦ ${name}`, "#9fd4ff", 18, 400);
    }
```

- [ ] **Step 4: Tạo `apps/client/src/scenes/run-scene.ts`**

```ts
import Phaser from "phaser";
import { applyRunAction, findNode, reachableNodeIds, restHealAmounts } from "rules";
import type { MapNode, RunAction, RunState } from "rules";
import { session } from "../session";
import { COLORS, NODE_ICONS, OWNER_COLORS, TEXT_BASE, useDesignCamera } from "../ui/theme";

const WIDTH = 1280;
const HEIGHT = 720;

const ERROR_LABELS: Record<string, string> = {
  "node is not reachable": "Không đi tới nút này được",
  "deck is at minimum size": "Deck đã ở mức tối thiểu",
};

export class RunScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private showDeck = false;
  private lastGainedRelic: string | undefined;

  constructor() {
    super("run");
  }

  create() {
    useDesignCamera(this);
    this.root = this.add.container(0, 0);
    this.showDeck = false;
    this.render();
  }

  private get run(): RunState {
    return session.run!;
  }

  private dispatch(action: RunAction) {
    const result = applyRunAction(session.data, this.run, action);
    if (!result.ok) {
      this.showError(result.error);
      return;
    }
    session.run = result.run;
    session.events.push(...result.events);
    this.lastGainedRelic = result.runEvents.flatMap((e) =>
      e.type === "runRelicGained" ? [e.runRelicId] : [],
    )[0];
    if (result.run.status === "combat" && result.run.combat) {
      session.state = result.run.combat;
      this.scene.start("combat");
      return;
    }
    this.render();
  }

  private text(x: number, y: number, content: string, size = 14, color: string = COLORS.text) {
    const t = this.add.text(x, y, content, { ...TEXT_BASE, fontSize: `${size}px`, color });
    this.root.add(t);
    return t;
  }

  private button(x: number, y: number, w: number, label: string, onClick: () => void) {
    const btn = this.add.rectangle(x, y, w, 34, COLORS.button).setStrokeStyle(1, COLORS.goldFill);
    btn.setInteractive({ useHandCursor: true });
    btn.on("pointerover", () => btn.setFillStyle(0x3a5090));
    btn.on("pointerout", () => btn.setFillStyle(COLORS.button));
    btn.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 0) onClick();
    });
    this.root.add(btn);
    this.text(x, y, label, 13).setOrigin(0.5);
  }

  private showError(error: string) {
    const t = this.text(WIDTH / 2, HEIGHT - 20, ERROR_LABELS[error] ?? error, 14, "#ff8080").setOrigin(0.5);
    this.tweens.add({ targets: t, alpha: 0, delay: 900, duration: 600, onComplete: () => t.destroy() });
  }

  private render() {
    this.root.removeAll(true);
    this.root.add(this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, COLORS.background));
    switch (this.run.status) {
      case "map":
        this.renderHeader();
        this.renderMap();
        break;
      case "reward":
        this.renderHeader();
        this.renderReward();
        break;
      case "rest":
        this.renderHeader();
        this.renderRest();
        break;
      case "treasure":
        this.renderHeader();
        this.renderTreasure();
        break;
      case "won":
      case "lost":
        this.renderEnd();
        break;
      case "combat":
        break;
    }
    if (this.showDeck) this.renderDeck();
  }

  private renderHeader() {
    this.run.heroes.forEach((hero, index) => {
      const def = session.data.heroes[hero.defId]!;
      this.text(24, 16 + index * 20, `${def.name} ${hero.hp}/${hero.maxHp}`, 14);
    });
    const relics =
      this.run.runRelicIds.map((id) => session.data.runRelics[id]?.name ?? id).join(" · ") || "—";
    this.text(WIDTH / 2, 16, `Kỳ Vật: ${relics}`, 13, COLORS.dimText).setOrigin(0.5, 0);
    const deck = this.text(WIDTH - 24, 16, `Deck ${this.run.deck.length} lá ▾`, 14, COLORS.gold).setOrigin(1, 0);
    deck.setInteractive({ useHandCursor: true });
    deck.on("pointerup", () => {
      this.showDeck = !this.showDeck;
      this.render();
    });
  }

  private renderMap() {
    const nodes = this.run.map.floors.flat();
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const reachable = new Set(reachableNodeIds(this.run));
    const pos = (node: MapNode) => {
      const width = this.run.map.floors[node.floor - 1]!.length;
      return { x: WIDTH / 2 + (node.lane - (width - 1) / 2) * 170, y: 660 - (node.floor - 1) * 68 };
    };
    const lines = this.add.graphics();
    lines.lineStyle(2, COLORS.panelBorder, 1);
    for (const node of nodes) {
      for (const nextId of node.next) {
        const a = pos(node);
        const b = pos(byId.get(nextId)!);
        lines.lineBetween(a.x, a.y, b.x, b.y);
      }
    }
    this.root.add(lines);
    for (const node of nodes) {
      const { x, y } = pos(node);
      const current = node.id === this.run.position;
      const canGo = reachable.has(node.id);
      const circle = this.add
        .circle(x, y, 22, canGo ? 0x3a5090 : COLORS.panelHero)
        .setStrokeStyle(current || canGo ? 3 : 1, current || canGo ? COLORS.goldFill : COLORS.panelBorder);
      this.root.add(circle);
      this.text(x, y, NODE_ICONS[node.type], 18).setOrigin(0.5);
      if (canGo) {
        circle.setInteractive({ useHandCursor: true });
        circle.on("pointerup", (pointer: Phaser.Input.Pointer) => {
          if (pointer.button === 0) this.dispatch({ type: "chooseNode", nodeId: node.id });
        });
      }
    }
  }

  private cardBox(x: number, y: number, cardId: string, onClick: () => void) {
    const card = session.data.cards[cardId]!;
    const owner = card.ownerId ?? "";
    const bg = this.add
      .rectangle(x, y, 170, 230, 0x141b33)
      .setStrokeStyle(2, OWNER_COLORS[owner] ?? COLORS.panelBorder);
    bg.setInteractive({ useHandCursor: true });
    bg.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 0) onClick();
    });
    this.root.add(bg);
    this.text(x - 70, y - 105, `${card.cost}`, 18, COLORS.gold);
    this.root.add(
      this.add
        .text(x, y - 60, card.name, { ...TEXT_BASE, fontSize: "16px", color: COLORS.text, align: "center", wordWrap: { width: 150 } })
        .setOrigin(0.5),
    );
    this.text(x, y - 30, session.data.heroes[owner]?.name ?? "", 12, COLORS.dimText).setOrigin(0.5);
    this.root.add(
      this.add
        .text(x, y, card.text, { ...TEXT_BASE, fontSize: "12px", color: COLORS.dimText, align: "center", wordWrap: { width: 150 } })
        .setOrigin(0.5, 0),
    );
  }

  private renderReward() {
    const reward = this.run.pendingReward!;
    this.text(WIDTH / 2, 130, "Chọn 1 lá thưởng", 24, COLORS.gold).setOrigin(0.5);
    if (reward.runRelicId !== undefined) {
      const relic = session.data.runRelics[reward.runRelicId]!;
      this.text(WIDTH / 2, 170, `Nhận Kỳ Vật: ${relic.name} — ${relic.text}`, 14, COLORS.gold).setOrigin(0.5);
    }
    reward.cardChoices.forEach((cardId, index) => {
      const x = WIDTH / 2 + (index - (reward.cardChoices.length - 1) / 2) * 200;
      this.cardBox(x, 340, cardId, () => this.dispatch({ type: "pickCard", cardId }));
    });
    this.button(WIDTH / 2, 520, 180, reward.cardChoices.length > 0 ? "Bỏ qua" : "Tiếp tục", () =>
      this.dispatch({ type: "pickCard", cardId: null }),
    );
  }

  private renderRest() {
    this.text(WIDTH / 2, 130, "Nghỉ Chân", 24, COLORS.gold).setOrigin(0.5);
    const heals = restHealAmounts(session.data, this.run);
    this.button(WIDTH / 2, 190, 240, "Hồi máu", () => this.dispatch({ type: "rest", choice: "heal" }));
    const summary = this.run.heroes
      .map((hero, index) => `${session.data.heroes[hero.defId]!.name} +${heals[index]}`)
      .join("   ");
    this.text(WIDTH / 2, 222, summary, 13, COLORS.dimText).setOrigin(0.5);
    const { minDeckSize } = session.data.runConfig;
    if (this.run.deck.length <= minDeckSize) {
      this.text(WIDTH / 2, 270, `Deck đã tối thiểu (${minDeckSize} lá) — không bỏ lá được`, 14, COLORS.dimText).setOrigin(0.5);
      return;
    }
    this.text(WIDTH / 2, 270, "…hoặc bỏ 1 lá khỏi deck:", 14, COLORS.dimText).setOrigin(0.5);
    this.run.deck.forEach((cardId, index) => {
      const col = index % 5;
      const row = Math.floor(index / 5);
      this.button(WIDTH / 2 + (col - 2) * 210, 310 + row * 40, 200, session.data.cards[cardId]!.name, () =>
        this.dispatch({ type: "rest", choice: "removeCard", cardId }),
      );
    });
  }

  private renderTreasure() {
    this.text(WIDTH / 2, 180, "Kho Báu", 28, COLORS.gold).setOrigin(0.5);
    const relic = this.lastGainedRelic ? session.data.runRelics[this.lastGainedRelic] : undefined;
    this.text(WIDTH / 2, 250, relic ? `${relic.name}: ${relic.text}` : "Kho báu trống.", 16).setOrigin(0.5);
    this.button(WIDTH / 2, 330, 200, "Tiếp tục", () => this.dispatch({ type: "continue" }));
  }

  private renderEnd() {
    const won = this.run.status === "won";
    const floor = this.run.position ? (findNode(this.run, this.run.position)?.floor ?? 0) : 0;
    this.text(WIDTH / 2, 260, won ? "LƯỢT CHƠI THẮNG" : "LƯỢT CHƠI THẤT BẠI", 44, won ? COLORS.gold : "#cc5555").setOrigin(0.5);
    this.text(
      WIDTH / 2,
      320,
      `Tầng ${floor}/${session.data.runConfig.floors} · Deck ${this.run.deck.length} lá · ${this.run.runRelicIds.length} Kỳ Vật`,
      16,
      COLORS.dimText,
    ).setOrigin(0.5);
    this.button(WIDTH / 2, 400, 240, "Về màn chọn đội", () => {
      session.run = null;
      this.scene.start("team-select");
    });
  }

  private renderDeck() {
    const overlay = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x000000, 0.8);
    overlay.setInteractive();
    overlay.on("pointerup", () => {
      this.showDeck = false;
      this.render();
    });
    this.root.add(overlay);
    this.text(WIDTH / 2, 60, `Deck (${this.run.deck.length} lá) — bấm để đóng`, 18, COLORS.gold).setOrigin(0.5);
    this.run.deck.forEach((cardId, index) => {
      const card = session.data.cards[cardId]!;
      const col = index % 4;
      const row = Math.floor(index / 4);
      this.text(160 + col * 280, 100 + row * 24, `${card.cost} · ${card.name}`, 13);
    });
  }
}
```

- [ ] **Step 5: `apps/client/src/main.ts`**

Import `import { RunScene } from "./scenes/run-scene";` và đổi `scene: [TeamSelectScene, CombatScene, RunScene],`.

- [ ] **Step 6: `apps/client/src/scenes/team-select-scene.ts`**

(a) Import: thêm `startRun` từ `../session`:
`import { restartSession, session, startRun } from "../session";`

(b) Thêm field `private mode: "run" | "single" = "run";`

(c) Thay khối từ `this.text(WIDTH / 2, 470, "Trận:", …)` tới hết `render()` bằng:

```ts
    this.button(WIDTH / 2 - 120, 470, 200, "Lượt chơi", this.mode === "run", () => {
      this.mode = "run";
      this.render();
    });
    this.button(WIDTH / 2 + 120, 470, 200, "Trận lẻ", this.mode === "single", () => {
      this.mode = "single";
      this.render();
    });

    if (this.mode === "single") {
      const encounters = Object.values(data.encounters);
      const perRow = 4;
      const encSpacing = 230;
      encounters.forEach((encounter, index) => {
        const col = index % perRow;
        const row = Math.floor(index / perRow);
        const x = WIDTH / 2 + (col - (perRow - 1) / 2) * encSpacing;
        this.button(x, 520 + row * 44, 210, encounter.name, encounter.id === this.encounterId, () => {
          this.encounterId = encounter.id;
          this.render();
        });
      });
    }

    const ready = this.picked.length === 3;
    this.button(WIDTH / 2, 640, 220, ready ? "BẮT ĐẦU" : `Chọn thêm ${3 - this.picked.length} Hero`, ready, () => {
      if (!ready) return;
      const team = [...this.picked] as Team;
      if (this.mode === "run") {
        startRun(team);
        this.scene.start("run");
      } else {
        restartSession(session.seed, this.encounterId, team);
        this.scene.start("combat");
      }
    });
  }
```

- [ ] **Step 7: `apps/client/src/scenes/combat-scene.ts`**

(a) Import `applyRunAction` cùng các hàm `rules` đang import.

(b) Thay phần đầu `dispatch` (từ `const result = applyAction(…)` tới hết hàm) bằng:

```ts
    const run = session.run;
    const result = run
      ? applyRunAction(this.gameData, run, { type: "combat", action })
      : applyAction(this.gameData, this.state, action);
    if (!result.ok) {
      this.showError(result.error);
      return false;
    }
    let newState: CombatState = this.state;
    let backToRun = false;
    if ("run" in result) {
      session.run = result.run;
      backToRun = result.run.combat === null;
      newState = result.run.combat ?? this.state;
    } else {
      newState = result.state;
    }
    session.state = newState;
    session.events.push(...result.events);
    this.targeting = null;
    this.inputLocked = true;
    const events = result.events;
    void this.playEvents(events).then(() => {
      if (backToRun) {
        this.scene.start("run");
        return;
      }
      this.state = newState;
      this.renderAll();
      this.inputLocked = false;
    });
    return true;
```

(c) Trong `renderTopBar`, sau dòng vẽ `Vòng ${this.state.round}` thêm:

```ts
    if (this.state.runRelicIds.length > 0) {
      const names = this.state.runRelicIds
        .map((id) => this.gameData.runRelics[id]?.name ?? id)
        .join(" · ");
      this.text(24, 36, `Kỳ Vật: ${names}`, 11, COLORS.dimText);
    }
```

- [ ] **Step 8: Typecheck + chơi thử**

Run: `pnpm typecheck` → Done. Run: `pnpm test` → PASS.

Run: `pnpm dev`, mở `http://localhost:5173` và kiểm tra:
1. Màn chọn đội có hai nút "Lượt chơi" / "Trận lẻ"; Trận lẻ hiện 8 trận trên 2 hàng, không tràn.
2. Lượt chơi → BẮT ĐẦU → màn bản đồ: 8 tầng, tầng 1 sáng lên, cạnh không cắt nhau, thanh trên có HP 3 Hero, "Kỳ Vật: —", "Deck 15 lá".
3. Bấm một nút tầng 1 → vào trận; thắng trận → màn thưởng 3 lá; chọn một lá → bản đồ, deck 16.
4. Tới Nghỉ Chân: "Hồi máu" hiện số HP hồi; hoặc bỏ 1 lá.
5. Tầng 4 Kho Báu: hiện Kỳ Vật; trong trận sau thanh "Kỳ Vật:" hiện tên, và event Kỳ Vật hiện chữ ✦.
6. Thua một trận → "LƯỢT CHƠI THẤT BẠI" → "Về màn chọn đội".
7. Trận lẻ vẫn chơi như trước.

- [ ] **Step 9: Commit**

```bash
git add apps/client
git commit -m "Step 3.6: client run mode (map, reward, rest, treasure, end screens; relic bar)"
```

---

### Task 8: Playtest scripted trọn lượt chơi (bước 3.7)

**Files:**
- Create: `packages/rules/test/run-playtest.test.ts`
- Modify: `docs/playtest-notes.md`

**Interfaces:**
- Consumes: `createRun`, `applyRunAction`, `reachableNodeIds`, `findNode`, `getValidTargets`, `isCardPlayable`.

- [ ] **Step 1: Viết playtest** — `packages/rules/test/run-playtest.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { loadGameData } from "data";

declare const console: {
  log(...args: unknown[]): void;
  table(...args: unknown[]): void;
};
import type { Action, CombatState, GameData, RunAction, RunState } from "../src/index";
import {
  applyRunAction,
  createRun,
  findNode,
  getValidTargets,
  isCardPlayable,
  reachableNodeIds,
} from "../src/index";

const data = loadGameData();
const TEAMS: [string, string, string][] = [
  ["m05", "f04", "m06"],
  ["m05", "f03", "f02"],
  ["m06", "f02", "f03"],
  ["m05", "f03", "f04"],
];
const SEEDS = [1, 2, 3, 4, 5];
const MAX_STEPS = 20000;
const MAX_COMBAT_ROUNDS = 60;

// Greedy floor: first playable card with its first valid target, else end turn.
function combatAction(gameData: GameData, state: CombatState): Action {
  for (const instanceId of state.hand) {
    if (!isCardPlayable(gameData, state, instanceId)) continue;
    const card = gameData.cards[state.cards[instanceId]!.cardId]!;
    if (card.target === "none") return { type: "playCard", instanceId };
    const targetId = getValidTargets(gameData, state, instanceId)[0];
    if (targetId !== undefined) return { type: "playCard", instanceId, targetId };
  }
  return { type: "endTurn" };
}

function runAction(gameData: GameData, run: RunState): RunAction {
  switch (run.status) {
    case "map":
      return { type: "chooseNode", nodeId: reachableNodeIds(run)[0]! };
    case "combat":
      return { type: "combat", action: combatAction(gameData, run.combat!) };
    case "reward":
      return { type: "pickCard", cardId: run.pendingReward!.cardChoices[0] ?? null };
    case "rest": {
      const hp = run.heroes.reduce((sum, h) => sum + h.hp, 0);
      const maxHp = run.heroes.reduce((sum, h) => sum + h.maxHp, 0);
      if (hp < 0.6 * maxHp || run.deck.length <= gameData.runConfig.minDeckSize) {
        return { type: "rest", choice: "heal" };
      }
      const cheapest = [...run.deck].sort(
        (a, b) => gameData.cards[a]!.cost - gameData.cards[b]!.cost,
      )[0]!;
      return { type: "rest", choice: "removeCard", cardId: cheapest };
    }
    case "treasure":
      return { type: "continue" };
    case "won":
    case "lost":
      throw new Error("run is over");
  }
}

function simulateRun(heroIds: [string, string, string], seed: number) {
  let run = createRun(data, { heroIds, seed }).run;
  let fights = 0;
  let stalled = false;
  for (let step = 0; step < MAX_STEPS; step++) {
    if (run.status === "won" || run.status === "lost") break;
    if (run.status === "combat" && run.combat!.round > MAX_COMBAT_ROUNDS) {
      stalled = true;
      break;
    }
    const result = applyRunAction(data, run, runAction(data, run));
    if (!result.ok) throw new Error(`run action rejected: ${result.error}`);
    if (result.runEvents.some((e) => e.type === "nodeEntered" && e.nodeType !== "rest" && e.nodeType !== "treasure")) {
      fights += 1;
    }
    run = result.run;
  }
  return {
    result: stalled ? "stalled" : run.status,
    floor: run.position ? findNode(run, run.position)!.floor : 0,
    fights,
    deck: run.deck.length,
    relics: run.runRelicIds.length,
    hp: run.heroes.map((h) => `${h.defId}:${h.hp}/${h.maxHp}`).join(" "),
  };
}

describe("run playtest", () => {
  for (const team of TEAMS) {
    it(`${team.join("+")} chạy trọn lượt chơi`, () => {
      const rows = SEEDS.map((seed) => ({ seed, ...simulateRun(team, seed) }));
      console.log(`\n=== run · ${team.join("+")} ===`);
      console.table(rows);
      for (const row of rows) expect(["won", "lost", "stalled"]).toContain(row.result);
    });
  }
});
```

- [ ] **Step 2: Chạy playtest**

Run: `pnpm --filter rules exec vitest run test/run-playtest.test.ts --reporter=verbose`
Expected: PASS; bảng in ra cho 4 đội × 5 seed.

- [ ] **Step 3: Ghi kết quả vào `docs/playtest-notes.md`**

Thêm cuối file mục sau, điền số từ output Step 2:

```markdown
---

# Playtest Notes — Phase 3 (bước 3.7)

Playtest scripted: `packages/rules/test/run-playtest.test.ts`. Heuristic: nút đi được đầu tiên, lá thưởng đầu tiên, Nghỉ Chân hồi nếu tổng HP < 60% (còn lại bỏ lá rẻ nhất), trong trận đánh lá đánh được đầu tiên. 4 đội × seed 1–5.

| Đội | Thắng | Thua | Kẹt (> 60 vòng) | Tầng trung bình | Trận/lượt | Deck cuối | Kỳ Vật |
|---|---|---|---|---|---|---|---|
| m05+f04+m06 | | | | | | | |
| m05+f03+f02 | | | | | | | |
| m06+f02+f03 | | | | | | | |
| m05+f03+f04 | | | | | | | |

## Quan sát

- (Tỉ lệ thắng từng đội; tầng thường thua; trận nào gây chết nhiều nhất.)
- (Lá thưởng và Kỳ Vật có đổi kết quả không; Nghỉ Chân hồi hay bỏ lá.)

## Đề xuất chỉnh (chưa áp dụng — cần duyệt)

- (Số liệu `run-config.json` / kẻ địch / lá thưởng cần chỉnh, kèm số liệu.)

## Điểm cần theo dõi khi chơi tay

- [ ] Bản đồ đọc có dễ không; có muốn đi đường Tinh Anh không?
- [ ] Lá thưởng có tạo lựa chọn thật không?
- [ ] Kỳ Vật có cảm nhận được trong trận không?
- [ ] Một lượt chơi dài bao lâu?
```

Thay các ô trống và các dòng trong ngoặc bằng số liệu, quan sát thật từ output. Không sửa JSON trong task này — đề xuất chỉnh cần được duyệt.

- [ ] **Step 4: Chạy toàn bộ**

Run: `pnpm test` → PASS. `pnpm typecheck` → Done.

- [ ] **Step 5: Commit**

```bash
git add packages/rules/test/run-playtest.test.ts docs/playtest-notes.md
git commit -m "Step 3.7: scripted full-run playtest + notes"
```
