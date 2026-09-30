# Giai đoạn 7c (Cốt truyện Arc 1–2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Mỗi Task kết thúc bằng `pnpm test` + `pnpm typecheck` xanh và một commit trên nhánh `feature/phase7`. Báo người dùng sau mỗi Task và chờ "ok" trước Task kế tiếp. Task 6 và Task 7 có **điểm dừng duyệt nội dung** giữa chừng.

**Goal:** Chế độ Cốt truyện: 2 arc × 8 màn tuyến tính, có lời thoại trước/sau trận, người chơi tự chọn đội. Trận chạy trên client và được server chạy lại để xác nhận (phiếu `story_tickets`). Thưởng lần đầu; qua hết một arc thì được tặng Hero (Arc 1 → M10, Arc 2 → F02).

**Architecture:**
- **Dữ liệu:** `packages/data/story.json` gồm `arcs` và `stages`. Nạp vào `GameData.storyArcs` và `GameData.storyStages` (giữ thứ tự file).
- **Encounter:** màn dùng encounter có `tier: "story"`, nên Lượt chơi và Trận lẻ không bốc phải.
- **Tạo trận:** `CombatSetup.start?` (pha trăng, Huyết Nguyệt) được áp trong `createCombat`, **trước** khi địch lên chuỗi vòng 1. Vì vậy một trận Cốt truyện chỉ là `createCombat` với encounter của màn.
- **Luật thuần** nằm trong `rules/src/meta/story.ts`: tạo trận, chạy lại, mở màn, trao thưởng.
- **Server:** thêm bảng + route theo đúng khuôn `routes/runs.ts`.
- **Client:** thêm 2 scene mới và 1 module phiên (`story-session.ts`, theo khuôn `run-session.ts`); dùng lại `DeckSelectScene` và `CombatScene`.

**Tech Stack:** TypeScript strict, pnpm workspaces, Vitest, zod (`packages/data`), Fastify + Postgres (`postgres`, test bằng `pg-mem`), Phaser (client).

**Spec:** `docs/18-phase7-spec.md` §4 (7c), §6, §8. Khi plan và spec khác nhau về luật, spec là chuẩn. Khi spec và tài liệu luật (`01`, `02`, `14`, `16`) khác nhau, tài liệu luật là chuẩn. Những điểm plan làm rõ spec nằm ở Task 1 bước 1 và phải được đưa vào tài liệu.

**Điều kiện trước:** phần cân PvP sau 7b (đang stage, chưa commit) đã được commit. Cây làm việc sạch.

## Global Constraints

- `packages/rules` thuần: không Phaser, DOM, mạng, file system, `Math.random()`, `Date.now()`. Server truyền `seed` và `now` vào.
- Hàm thuần, không mutate đầu vào (`applyStoryResult` clone hồ sơ trước khi sửa, giống `applyRunResult`).
- **T213 (ghi vàng PvE) xanh sau mỗi Task, không ghi lại.** 7c không được đổi kết quả trận / lượt chơi cũ. `CombatSetup.start` vắng mặt thì `createCombat` phải chạy **y hệt** trước.
- Server là trọng tài hồ sơ: thưởng Cốt truyện chỉ trao sau khi `replayStoryCombat` xác nhận (CLAUDE.md quy tắc 9). Client không tự sửa hồ sơ.
- Không hardcode số liệu kẻ địch / thưởng / lời thoại trong code. Mọi thứ nằm trong `story.json`, `enemies.json`, `encounters.json`.
- Code, tên biến, comment: tiếng Anh. Chữ cho người chơi: tiếng Việt, lấy từ dữ liệu hoặc `apps/client/src/ui/theme.ts`.
- Thuật ngữ theo `docs/04-glossary.md` (Task 1 thêm: Cốt Truyện, Arc, Màn, Thưởng Lần Đầu).
- **Mã test T300–T307** (spec ghi T298–T305, nhưng T298/T299 đã dùng cho `scaledDamage` / `targetSealed` sau 7b, nên Task 1 dời cả dải 7c lên 2 và dải 7d thành T308–T313). Tên test bắt đầu bằng mã (`it("T300: …")`).
- Không thêm thư viện mới.
- Lệnh (chạy ở gốc `D:\Source\VongNguyet`): `pnpm --filter rules test`, `pnpm --filter data test`, `pnpm --filter server test`, `pnpm test`, `pnpm typecheck`.

---

## File Structure

| File | Trách nhiệm | Task |
|---|---|---|
| `docs/{00,01,02,03,04,06,07,14,16,18}.md`, `CLAUDE.md` | Tài liệu 7c | 1 |
| `packages/rules/src/types/static.ts` | `StoryArcDef`, `StoryStageDef`, `DialogueLine`, `CombatStart`; `EncounterDef.tier` thêm `"story"` | 2 |
| `packages/rules/src/types/api.ts` | `GameData.storyArcs`, `GameData.storyStages`; `CombatSetup.start?` | 2, 3 |
| `packages/rules/src/types/events.ts` | `bloodMoonChanged.cause` thêm `"start"` | 3 |
| `packages/rules/src/types/meta.ts` | `Profile.story` | 4 |
| `packages/data/story.json` (mới) | Arc, màn, lời thoại, thưởng | 2 (rỗng), 6, 7 |
| `packages/data/src/schema.ts`, `src/load-game-data.ts` | zod + kiểm chéo `story.json` | 2 |
| `packages/rules/src/create-combat.ts` | Áp `setup.start` trước `planEnemyIntents` | 3 |
| `packages/rules/src/meta/story.ts` (mới) | `createStoryCombat`, `replayStoryCombat`, `storyStageUnlocked`, `unlockedStageIds`, `applyStoryResult` | 3, 4 |
| `packages/rules/src/meta/profile.ts` | `createProfile` / `parseProfile` điền `story` | 4 |
| `packages/rules/src/index.ts` | Export mới | 3, 4 |
| `packages/rules/test/story.test.ts` (mới), `test/helpers.ts` | T300–T304, T307; `withTestStory` | 2–4 |
| `apps/server/src/db.ts` | Migration 4: `story_tickets` | 5 |
| `apps/server/src/routes/runs.ts` | Export `combatActionSchema`, `resolveDeck` (tách từ `/api/runs`) | 5 |
| `apps/server/src/routes/story.ts` (mới), `src/app.ts` | Route Cốt truyện | 5 |
| `apps/server/test/story.test.ts` (mới) | T305–T306 | 5 |
| `packages/data/{enemies,encounters,story}.json` | Nội dung Arc 1 / Arc 2 | 6, 7 |
| `apps/client/src/story-session.ts` (mới) | Phiếu, ghi action, nộp | 8 |
| `apps/client/src/scenes/story-scene.ts`, `dialogue-scene.ts` (mới) | Chọn arc/màn; hội thoại | 8 |
| `apps/client/src/{session.ts,main.ts}`, `scenes/{deck-select-scene,combat-scene}.ts`, `ui/event-animator.ts` | Nối luồng Cốt truyện | 8 |
| `docs/playtest-notes.md` | Số đo độ khó 16 màn | 9 |

---

### Task 1: Tài liệu 7c (bước 7c.1)

**Files:**
- Modify: `docs/18-phase7-spec.md` (§4, §6, §8), `docs/01-combat-rules.md`, `docs/02-data-schema.md`, `docs/03-prototype-content.md`, `docs/04-glossary.md`, `docs/06-test-scenarios.md`, `docs/07-implementation-plan.md`, `docs/14-meta-rules.md`, `docs/16-server-api.md`, `CLAUDE.md`

**Interfaces:**
- Produces: luật chuẩn cho Task 2–9.

- [ ] **Step 1: Chốt các điểm plan làm rõ spec** — sửa `docs/18-phase7-spec.md` §4 cho khớp:
  - **Encounter của màn** có `tier: "story"`. `run/map.ts` chỉ bốc `normal` / `elite` / `boss`, nên không đụng tới tier này. Trận lẻ ở client lọc bỏ `story` giống `coop`. Kiểm chéo: `stage.encounterId` phải trỏ tới encounter `tier: "story"`.
  - **`start`** là trường chung `CombatSetup.start?: { moonIndex?; bloodMoonRounds? }` của `createCombat`, áp **trước** `planEnemyIntents` (vòng 1 lên chuỗi theo pha đã đặt). Huyết Nguyệt đầu trận phát `bloodMoonChanged { rounds, cause: "start" }`; hook Kỳ Vật `bloodMoonStarted` **không** chạy vì Cốt truyện không có Kỳ Vật. Vắng `start` thì trận y hệt trước (T213).
  - **`applyStoryResult(data, profile, setup, won)`** nhận cả `StorySetup` (spec ghi `stageId`), vì XP Tu Luyện cộng cho **từng Hero trong đội** (Hero chưa sở hữu không nhận, giống `applyRunResult`). Trả `{ ok: true; profile; rewards: StoryRewards }` với `StoryRewards = { firstClear: boolean; moonJade: number; darkIron: number; gains: MasteryGain[]; hero: PullResult | null }`.
  - **Thứ tự arc** theo thứ tự trong `story.json` (`arcs[0]` là Arc 1).
  - **`GET /api/story`** trả `{ cleared: string[]; unlocked: string[] }`, trong đó `unlocked` là mọi màn đã mở kể cả màn đã qua.
  - **Lỗi route** giống `runs`: `404 "unknown stage"`, `403 "stage locked"`, `404 "unknown ticket"`, `409 "ticket closed"`, `410 "ticket expired"`, `409 "outdated client"`, `422 "replay failed"` (phiếu `rejected`), `422 "combat not finished"`. Số action tối đa `MAX_STORY_ACTIONS = 2000`.
  - **Thưởng** chỉ đến từ `firstClear` của màn. Thua hoặc thắng lại màn đã qua **không** cộng gì, kể cả nhiệm vụ / thống kê Lượt chơi.
- [ ] **Step 2: DỪNG — hỏi người dùng 2 điểm spec chưa rõ** (CLAUDE.md quy tắc 6), rồi ghi câu trả lời vào `18` §4.5 và `01`:
  1. Màn Arc 1-2 *"Kẻ địch dùng Tỏa Nguyệt"*: `drainMoonPower` hiện **chỉ dành cho lá bài** (`load-game-data.ts`, `cardOnly`). Đề xuất: cho phép trong chiêu địch với nghĩa của PvP, tức trừ **Dự Trữ** (`moonReserve`) của người chơi, tối đa `amount` (`01` §15, dùng lại nhánh PvP của `drainMoonPower`). Phương án khác: bỏ chi tiết đó và thay bằng Suy Yếu.
  2. **Mục tiêu độ khó** (spec không có số). Đề xuất: bot, Bộ cơ bản của đội khởi đầu (m05+f04+m06), 80 seed. Màn thường Arc 1 thắng ≥ 80%; boss Arc 1 ≥ 60%; màn thường Arc 2 55–75%; boss Arc 2 40–60%. Mỗi màn Arc 2 dùng đội tốt nhất trong 3 đội mẫu phải ≥ 60%.
- [ ] **Step 3: Viết tài liệu luật**:
  - `01`: §2 `CombatSetup.start` (áp trước lên chuỗi, event `cause: "start"`); nếu người dùng duyệt thì ghi `drainMoonPower` trong chiêu địch (§9.3).
  - `02`: schema `story.json` (dạng ở §4.1 spec + `start` + ràng buộc), `EncounterDef.tier "story"`, `GameData.storyArcs` / `storyStages`, danh sách kiểm chéo (xem Task 2 Step 3).
  - `14`: mục mới *Cốt truyện* (tiến độ `profile.story.cleared`, luật mở màn, thưởng lần đầu, tặng Hero qua `grantHeroItem`, `parseProfile` / `mergeImportedProfile`).
  - `16`: bảng `story_tickets` (migration 4) và 4 route kèm mã lỗi ở Step 1.
  - `04`: Cốt Truyện (*story*), Arc, Màn (*stage*), Thưởng Lần Đầu (*first clear*).
  - `06`: T300–T307 theo bảng dưới; đổi dải 7d trong `18` §6 thành T308–T313.
  - `07` + `CLAUDE.md`: "Giai đoạn hiện tại: 7c đang làm — `docs/18-phase7-spec.md` §4".

  | Mã | Nội dung |
  |---|---|
  | T300 | Kiểm chéo `story.json`: arc trỏ màn không có / màn thuộc hai arc / `arcId` lệch; encounter không phải `story`; `rewardHeroId`, `speaker` không tồn tại; `moonIndex` ngoài 0–7 |
  | T301 | `replayStoryCombat` tất định (cùng setup + action → cùng state); action lỗi → `{ ok: false, step }`; action sau khi trận kết thúc → `"actions after end"` |
  | T302 | `start.moonIndex` / `start.bloodMoonRounds` áp trước khi lên chuỗi vòng 1 (chiêu `moonOverrides` của pha được đặt xuất hiện ở vòng 1); vắng `start` → state giống `createCombat` cũ |
  | T303 | `storyStageUnlocked`: màn 1 Arc 1 luôn mở; màn *n* cần *n−1*; màn 1 Arc 2 cần hết Arc 1; id lạ → `false` |
  | T304 | `applyStoryResult`: thắng lần đầu trao `firstClear` + XP từng Hero sở hữu đúng 1 lần; thắng lại / thua → không thưởng; màn cuối arc tặng Hero, đã có → Tinh Hồn (như gacha) |
  | T305 | Route: màn khóa → 403; nộp action đúng → hồ sơ + thưởng; action sửa → 422 và phiếu `rejected`; chưa xong trận → 422 |
  | T306 | Route: một phiếu mở mỗi tài khoản (cấp mới bỏ cũ); hết hạn → 410; lệch `dataVersion` → 409; `GET /api/story` |
  | T307 | `parseProfile` hồ sơ không có `story` → `{ cleared: [] }`, lọc id màn lạ; `mergeImportedProfile` không nhập `story` |

- [ ] **Step 4: Commit**

```bash
git add docs CLAUDE.md
git commit -m "Step 7c.1: phase 7c rule docs"
```

---

### Task 2: Dữ liệu `story.json` — schema, nạp, kiểm chéo (bước 7c.2, phần 1)

**Files:**
- Create: `packages/data/story.json`, `packages/rules/test/story.test.ts`
- Modify: `packages/rules/src/types/static.ts`, `packages/rules/src/types/api.ts`, `packages/data/src/schema.ts`, `packages/data/src/load-game-data.ts`, `packages/rules/test/helpers.ts`

**Interfaces:**
- Produces: `StoryArcDef`, `StoryStageDef`, `DialogueLine`, `CombatStart` (rules types); `GameData.storyArcs: Record<string, StoryArcDef>`, `GameData.storyStages: Record<string, StoryStageDef>`; `withTestStory(data: GameData): void` (test helper: 2 arc × 2 màn trên `enc_01`/`enc_02`/`enc_03`).

- [ ] **Step 1: Kiểu trong `packages/rules/src/types/static.ts`**

```ts
/** Moon state a combat starts in (`01` §2); story stages only. */
export interface CombatStart {
  moonIndex?: number;
  bloodMoonRounds?: number;
}

/** One line of story dialogue (`18` §4.1). `speaker`: hero id, enemy id or "narrator". */
export interface DialogueLine {
  speaker: string;
  text: string;
}

export interface StoryArcDef {
  id: string;
  name: string;
  stageIds: string[];
  rewardHeroId: string;
}

export interface StoryStageDef {
  id: string;
  arcId: string;
  name: string;
  encounterId: string;
  start?: CombatStart;
  before: DialogueLine[];
  after: DialogueLine[];
  firstClear: { moonJade?: number; darkIron?: number; masteryXp?: number };
}
```

Trong `EncounterDef` đổi `tier` thành `"normal" | "elite" | "boss" | "coop" | "story"`. Trong `GameData` (`types/api.ts`) thêm:

```ts
  /** Story arcs in file order (`18` §4.1). */
  storyArcs: Record<string, StoryArcDef>;
  storyStages: Record<string, StoryStageDef>;
```

- [ ] **Step 2: Viết test T300 (đỏ)** trong `packages/rules/test/story.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseGameData } from "data";
import { rawTestInput } from "./helpers";

const arc = (over: object = {}) => ({ id: "t_arc1", name: "A", stageIds: ["t_s1"], rewardHeroId: "m10", ...over });
const stage = (over: object = {}) => ({
  id: "t_s1", arcId: "t_arc1", name: "S", encounterId: "t_story_enc", before: [{ speaker: "narrator", text: "…" }],
  after: [], firstClear: { moonJade: 50 }, ...over,
});
const withStory = (story: { arcs: object[]; stages: object[] }) => {
  const raw = rawTestInput();
  raw.encounters = [...raw.encounters, { id: "t_story_enc", name: "E", enemyIds: ["puppet_guard"], tier: "story" }];
  raw.story = story;
  return () => parseGameData(raw);
};

describe("story data", () => {
  it("T300: story.json cross-checks arcs, stages, encounters, speakers and start", () => {
    expect(() => withStory({ arcs: [arc()], stages: [stage()] })()).not.toThrow();
    expect(withStory({ arcs: [arc({ stageIds: ["t_missing"] })], stages: [stage()] })).toThrow(/t_missing/);
    expect(withStory({ arcs: [arc(), arc({ id: "t_arc2" })], stages: [stage()] })).toThrow(/more than one arc/);
    expect(withStory({ arcs: [arc()], stages: [stage({ arcId: "t_arc2" })] })).toThrow(/arcId/);
    expect(withStory({ arcs: [arc()], stages: [stage({ encounterId: "enc_01" })] })).toThrow(/tier "story"/);
    expect(withStory({ arcs: [arc({ rewardHeroId: "x99" })], stages: [stage()] })).toThrow(/x99/);
    expect(withStory({ arcs: [arc()], stages: [stage({ after: [{ speaker: "nobody", text: "a" }] })] })).toThrow(/nobody/);
    expect(withStory({ arcs: [arc()], stages: [stage({ start: { moonIndex: 8 } })] })).toThrow();
  });
});
```

`rawTestInput()` là helper mới trong `test/helpers.ts`: trả object thô cho `parseGameData` (bản sao sâu các JSON mà `loadGameData` đọc, cộng `story`). Tách phần dựng object của `loadGameData` thành hàm export `rawGameInput()` trong `load-game-data.ts` rồi gọi `structuredClone(rawGameInput())`.

- [ ] **Step 3: Chạy test — đỏ**

Run: `pnpm --filter rules test -- story`
Expected: FAIL (`rawTestInput` / `story` chưa có).

- [ ] **Step 4: Cài đặt**
  - `packages/data/story.json`: `{ "arcs": [], "stages": [] }`.
  - `schema.ts`: thêm `"story"` vào `encounterDefSchema.tier`; thêm

```ts
const dialogueLineSchema = z.object({ speaker: idSchema, text: z.string().min(1) });
export const storySchema = z.object({
  arcs: z.array(z.object({
    id: idSchema, name: z.string().min(1), stageIds: z.array(idSchema).min(1), rewardHeroId: idSchema,
  })),
  stages: z.array(z.object({
    id: idSchema, arcId: idSchema, name: z.string().min(1), encounterId: idSchema,
    start: z.object({
      moonIndex: z.number().int().min(0).max(7).optional(),
      bloodMoonRounds: z.number().int().positive().optional(),
    }).optional(),
    before: z.array(dialogueLineSchema),
    after: z.array(dialogueLineSchema),
    firstClear: z.object({
      moonJade: z.number().int().nonnegative().optional(),
      darkIron: z.number().int().nonnegative().optional(),
      masteryXp: z.number().int().nonnegative().optional(),
    }),
  })),
});
```
  và `story: storySchema` trong `rawGameDataSchema`. (`idSchema` là snake_case, nên `"narrator"` hợp lệ.)
  - `load-game-data.ts`: `import storyJson from "../story.json"`, tách `rawGameInput()`, thêm vào `collectCrossCheckErrors`:

```ts
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
```
  Thêm `["storyArcs", story.arcs]`, `["storyStages", story.stages]` vào `groups` (kiểm id trùng). `parseGameData` trả `storyArcs: Object.fromEntries(story.arcs.map((a) => [a.id, a]))`, `storyStages` tương tự.
  - `test/helpers.ts`: thêm `rawTestInput()` và

```ts
/** Two arcs × two stages on existing encounters, for story rule tests. */
export function withTestStory(data: GameData): void {
  data.storyArcs = {
    t_arc1: { id: "t_arc1", name: "Arc 1", stageIds: ["t_a1s1", "t_a1s2"], rewardHeroId: "m10" },
    t_arc2: { id: "t_arc2", name: "Arc 2", stageIds: ["t_a2s1", "t_a2s2"], rewardHeroId: "f02" },
  };
  const stage = (id: string, arcId: string, encounterId: string, extra: Partial<StoryStageDef> = {}): StoryStageDef => ({
    id, arcId, name: id, encounterId, before: [], after: [], firstClear: { moonJade: 40, darkIron: 1, masteryXp: 30 }, ...extra,
  });
  data.storyStages = {
    t_a1s1: stage("t_a1s1", "t_arc1", "enc_01"),
    t_a1s2: stage("t_a1s2", "t_arc1", "enc_02", { start: { moonIndex: 4 } }),
    t_a2s1: stage("t_a2s1", "t_arc2", "enc_03", { start: { bloodMoonRounds: 2 } }),
    t_a2s2: stage("t_a2s2", "t_arc2", "enc_01"),
  };
}
```
  (Rules test dùng dữ liệu tiêm vào, không qua kiểm chéo, nên dùng được encounter `normal` sẵn có.)

- [ ] **Step 5: Chạy test — xanh**

Run: `pnpm --filter rules test -- story` rồi `pnpm --filter data test`
Expected: PASS. `pnpm test` xanh (T213 không đổi: dữ liệu mới rỗng, `dataVersion` đổi là bình thường).

- [ ] **Step 6: Commit**

```bash
git add packages/data packages/rules/src/types packages/rules/test/story.test.ts packages/rules/test/helpers.ts
git commit -m "Step 7c.2: story.json schema, loader and cross-checks (T300)"
```

---

### Task 3: Trận Cốt truyện — `start`, `createStoryCombat`, `replayStoryCombat` (bước 7c.2, phần 2)

**Files:**
- Create: `packages/rules/src/meta/story.ts`
- Modify: `packages/rules/src/types/api.ts` (`CombatSetup.start?`), `packages/rules/src/types/events.ts`, `packages/rules/src/create-combat.ts`, `packages/rules/src/index.ts`, `apps/client/src/ui/event-animator.ts` (chỉ khi `switch` trên `cause` là vét cạn), `packages/rules/test/story.test.ts`

**Interfaces:**
- Consumes: `withTestStory` (Task 2).
- Produces:
  - `CombatSetup.start?: CombatStart`
  - `interface StorySetup { stageId: string; seed: number; heroIds: [string, string, string]; deckCardIds: string[] }`
  - `createStoryCombat(data: GameData, setup: StorySetup, loadout?: Loadout): { state: CombatState; events: CombatEvent[] }`
  - `type StoryReplayResult = { ok: true; state: CombatState } | { ok: false; step: number; reason: string }`
  - `replayStoryCombat(data: GameData, setup: StorySetup, actions: readonly Action[], loadout?: Loadout): StoryReplayResult`

- [ ] **Step 1: Test T301–T302 (đỏ)** — thêm vào `story.test.ts`:

```ts
import { applyAction, chooseCombatAction, createCombat, createStoryCombat, replayStoryCombat, starterDeck } from "../src/index";
import type { Action, StorySetup } from "../src/index";
import { testData, withTestStory } from "./helpers";

const TEAM: [string, string, string] = ["m05", "f04", "m06"];
const storyData = () => { const data = testData(); withTestStory(data); return data; };
const setupFor = (data: ReturnType<typeof testData>, stageId: string, seed = 7): StorySetup =>
  ({ stageId, seed, heroIds: TEAM, deckCardIds: starterDeck(data, TEAM) });

function playOut(data: ReturnType<typeof testData>, setup: StorySetup): Action[] {
  let state = createStoryCombat(data, setup).state;
  const actions: Action[] = [];
  for (let i = 0; i < 2000 && state.status !== "won" && state.status !== "lost"; i++) {
    const action = chooseCombatAction(data, state, 0);
    const result = applyAction(data, state, action);
    if (!result.ok) throw new Error(result.error);
    actions.push(action);
    state = result.state;
  }
  return actions;
}

describe("story combat", () => {
  it("T301: replayStoryCombat is deterministic and rejects bad or trailing actions", () => {
    const data = storyData();
    const setup = setupFor(data, "t_a1s1");
    const actions = playOut(data, setup);
    const a = replayStoryCombat(data, setup, actions);
    const b = replayStoryCombat(data, setup, actions);
    expect(a.ok && ["won", "lost"].includes(a.state.status)).toBe(true);
    expect(a).toEqual(b);
    expect(replayStoryCombat(data, setup, [...actions, { type: "endTurn" }])).toEqual({ ok: false, step: actions.length, reason: "actions after end" });
    const bad = replayStoryCombat(data, setup, [{ type: "playCard", instanceId: "nope" }]);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.step).toBe(0);
  });

  it("T302: start sets the moon and blood moon before round 1 is planned; no start = old createCombat", () => {
    const data = storyData();
    const full = createStoryCombat(data, setupFor(data, "t_a1s2"));
    expect(full.state.moonIndex).toBe(4);
    const blood = createStoryCombat(data, setupFor(data, "t_a2s1"));
    expect(blood.state.bloodMoonRounds).toBe(2);
    expect(blood.events).toContainEqual({ type: "bloodMoonChanged", rounds: 2, cause: "start" });
    // Round-1 intents are planned in the start phase: an enemy with a full-moon override uses it.
    data.enemies["puppet_guard"]!.moonOverrides = [{ phase: "full", intent: { id: "t_full", name: "T", kind: "buff", effects: [{ type: "gainArmor", amount: 1, to: "self" }] } }];
    data.storyStages["t_a1s1"] = { ...data.storyStages["t_a1s1"]!, start: { moonIndex: 4 } };
    const planned = createStoryCombat(data, setupFor(data, "t_a1s1")).state.enemies[0]!.plannedIntents.map((p) => p.intent.id);
    expect(planned).toContain("t_full");
    // Without start, a story combat is exactly createCombat on the stage encounter.
    const plain = createStoryCombat(data, setupFor(data, "t_a2s2"));
    expect(plain).toEqual(createCombat(data, { heroIds: TEAM, encounterId: "enc_01", seed: 7, deckCardIds: starterDeck(data, TEAM) }));
  });
});
```

Ghi chú khi làm T302: cách `planEnemyIntents` chọn `moonOverrides` nằm ở `intent.ts:88–102`. Nếu override chỉ thay một chiêu khi chiêu đó được bốc (không phải luôn có mặt), hãy cho `puppet_guard` chỉ còn 1 chiêu cost 0 trong test (`d.enemies[...].intents = [...]`) để kết quả không phụ thuộc RNG. Mục đích test là chứng minh pha đã được đặt **trước** khi lên chuỗi.

- [ ] **Step 2: Chạy — đỏ**

Run: `pnpm --filter rules test -- story`
Expected: FAIL (`createStoryCombat` chưa có).

- [ ] **Step 3: Cài đặt**
  - `types/api.ts` → `CombatSetup` thêm `/** Moon state at the start (`01` §2); story stages. */ start?: CombatStart;`
  - `types/events.ts` → `bloodMoonChanged.cause: "roundEnd" | "card" | "boss" | "start"`.
  - `create-combat.ts`, ngay trước `planEnemyIntents(data, state, events);`:

```ts
  // Story stages (`01` §2): the moon is set before round 1 is planned.
  if (setup.start?.moonIndex !== undefined) state.moonIndex = setup.start.moonIndex;
  if (setup.start?.bloodMoonRounds !== undefined) {
    state.bloodMoonRounds = setup.start.bloodMoonRounds;
    events.push({ type: "bloodMoonChanged", rounds: state.bloodMoonRounds, cause: "start" });
  }
```
  - `meta/story.ts`:

```ts
import { applyAction } from "../apply-action";
import { createCombat } from "../create-combat";
import type { Action, CombatEvent, CombatState, GameData, Loadout } from "../types/index";

export interface StorySetup {
  stageId: string;
  seed: number;
  heroIds: [string, string, string];
  deckCardIds: string[];
}

export type StoryReplayResult =
  | { ok: true; state: CombatState }
  | { ok: false; step: number; reason: string };

/** A story stage's combat (`18` §4.2): its encounter, started in the stage's moon. */
export function createStoryCombat(
  data: GameData,
  setup: StorySetup,
  loadout?: Loadout,
): { state: CombatState; events: CombatEvent[] } {
  const stage = data.storyStages[setup.stageId];
  if (!stage) throw new Error(`createStoryCombat: unknown stage "${setup.stageId}"`);
  return createCombat(
    data,
    {
      heroIds: setup.heroIds,
      encounterId: stage.encounterId,
      seed: setup.seed,
      deckCardIds: setup.deckCardIds,
      ...(stage.start ? { start: stage.start } : {}),
    },
    loadout,
  );
}

/** Rebuilds a story combat from the player's actions (`18` §4.2); same convention as `replayRun`. */
export function replayStoryCombat(
  data: GameData,
  setup: StorySetup,
  actions: readonly Action[],
  loadout?: Loadout,
): StoryReplayResult {
  let state = createStoryCombat(data, setup, loadout).state;
  for (let step = 0; step < actions.length; step++) {
    if (state.status === "won" || state.status === "lost") return { ok: false, step, reason: "actions after end" };
    const result = applyAction(data, state, actions[step]!);
    if (!result.ok) return { ok: false, step, reason: result.error };
    state = result.state;
  }
  return { ok: true, state };
}
```
  - `index.ts`: `export { createStoryCombat, replayStoryCombat } from "./meta/story"; export type { StorySetup, StoryReplayResult } from "./meta/story";`
  - Nếu `tsc` báo `switch` vét cạn trên `cause` ở client (`event-animator.ts:334`, `debug.ts:138`) thì thêm nhánh `"start"` đi cùng nhánh `"card"`.

- [ ] **Step 4: Chạy — xanh**

Run: `pnpm --filter rules test`, `pnpm typecheck`
Expected: PASS; T213 xanh (không trận cũ nào có `start`).

- [ ] **Step 5: Commit**

```bash
git add packages/rules apps/client/src/ui/event-animator.ts apps/client/src/debug.ts
git commit -m "Step 7c.2: story combat with start moon, deterministic replay (T301-T302)"
```

---

### Task 4: Tiến độ Cốt truyện trong hồ sơ — mở màn, thưởng lần đầu (bước 7c.2, phần 3)

**Files:**
- Modify: `packages/rules/src/types/meta.ts`, `packages/rules/src/meta/profile.ts`, `packages/rules/src/meta/story.ts`, `packages/rules/src/index.ts`, `packages/rules/test/story.test.ts`

**Interfaces:**
- Consumes: `StorySetup` (Task 3), `grantHeroItem`, `PullResult` (`meta/gacha.ts`), `masteryLevel` (`meta/profile.ts`).
- Produces:
  - `Profile.story: { cleared: string[] }`
  - `storyStageUnlocked(data: GameData, profile: Profile, stageId: string): boolean`
  - `unlockedStageIds(data: GameData, profile: Profile): string[]`
  - `interface StoryRewards { firstClear: boolean; moonJade: number; darkIron: number; gains: MasteryGain[]; hero: PullResult | null }`
  - `applyStoryResult(data: GameData, profile: Profile, setup: StorySetup, won: boolean): { ok: true; profile: Profile; rewards: StoryRewards }`

- [ ] **Step 1: Test T303, T304, T307 (đỏ)**:

```ts
import { applyStoryResult, createProfile, mergeImportedProfile, parseProfile, storyStageUnlocked, unlockedStageIds } from "../src/index";

describe("story progress", () => {
  it("T303: stages open in order; arc 2 needs all of arc 1", () => {
    const data = storyData();
    const profile = createProfile(data);
    expect(unlockedStageIds(data, profile)).toEqual(["t_a1s1"]);
    profile.story.cleared = ["t_a1s1"];
    expect(storyStageUnlocked(data, profile, "t_a1s2")).toBe(true);
    expect(storyStageUnlocked(data, profile, "t_a2s1")).toBe(false);
    profile.story.cleared = ["t_a1s1", "t_a1s2"];
    expect(storyStageUnlocked(data, profile, "t_a2s1")).toBe(true);
    expect(storyStageUnlocked(data, profile, "t_a2s2")).toBe(false);
    expect(storyStageUnlocked(data, profile, "nope")).toBe(false);
  });

  it("T304: first clear pays once; the last stage of an arc grants its hero, a dupe becomes Tinh Hồn", () => {
    const data = storyData();
    const start = createProfile(data);
    const setup = setupFor(data, "t_a1s1");
    const lost = applyStoryResult(data, start, setup, false);
    expect(lost.rewards).toEqual({ firstClear: false, moonJade: 0, darkIron: 0, gains: [], hero: null });
    expect(lost.profile).toEqual(start);

    const won = applyStoryResult(data, start, setup, true);
    expect(won.profile.story.cleared).toEqual(["t_a1s1"]);
    expect(won.rewards).toMatchObject({ firstClear: true, moonJade: 40, darkIron: 1, hero: null });
    expect(won.rewards.gains.map((g) => [g.heroId, g.xp])).toEqual([["m05", 30], ["f04", 30], ["m06", 30]]);
    expect(won.profile.currencies.moonJade).toBe(start.currencies.moonJade + 40);
    expect(start.story.cleared).toEqual([]); // input not mutated

    const again = applyStoryResult(data, won.profile, setup, true);
    expect(again.rewards.firstClear).toBe(false);
    expect(again.profile).toEqual(won.profile);

    const last = applyStoryResult(data, won.profile, setupFor(data, "t_a1s2"), true);
    expect(last.rewards.hero).toMatchObject({ itemId: "m10", outcome: "new" });
    expect(last.profile.heroes["m10"]).toBeDefined();

    const dupe = structuredClone(won.profile);
    dupe.heroes["m10"] = { xp: 0, unlockedCardIds: [], constellation: 0, bonusUnlocks: 0, levelUpForm: "base" };
    const dupeResult = applyStoryResult(data, dupe, setupFor(data, "t_a1s2"), true);
    expect(dupeResult.rewards.hero?.outcome).not.toBe("new");
    expect(dupeResult.profile.heroes["m10"]!.constellation).toBe(1);
  });

  it("T307: old profiles get an empty story; imports never touch story", () => {
    const data = storyData();
    const saved = JSON.parse(JSON.stringify(createProfile(data))) as Record<string, unknown>;
    delete saved.story;
    expect(parseProfile(data, saved).profile.story).toEqual({ cleared: [] });
    expect(parseProfile(data, { ...saved, story: { cleared: ["t_a1s1", "ghost"] } }).profile.story).toEqual({ cleared: ["t_a1s1"] });
    const server = createProfile(data);
    server.story.cleared = ["t_a1s1"];
    const local = createProfile(data);
    local.story.cleared = ["t_a1s1", "t_a1s2"];
    const merged = mergeImportedProfile(data, server, local);
    expect(merged.ok && merged.profile.story).toEqual({ cleared: ["t_a1s1"] });
  });
});
```

Đối chiếu tên trường `outcome` và giá trị `"new"` của `PullResult` với `meta/gacha.ts` trước khi chạy. Nếu khác thì sửa test theo code hiện có, không sửa gacha.

- [ ] **Step 2: Chạy — đỏ**

Run: `pnpm --filter rules test -- story`
Expected: FAIL (`profile.story` undefined).

- [ ] **Step 3: Cài đặt**
  - `types/meta.ts` → `Profile` thêm `/** Story progress (`18` §4.2); server-only. */ story: { cleared: string[] };`
  - `meta/profile.ts`:
    - `createProfile` thêm `story: { cleared: [] },`
    - `parseProfile`, sau khối `coop`: `profile.story = { cleared: isRecord(raw.story) ? strings(raw.story.cleared).filter((id) => data.storyStages[id] !== undefined) : [] };`
    - `mergeImportedProfile`: không đổi. `next` là bản clone hồ sơ server, nên `story` của server được giữ. Thêm comment `// story stays server-only (`18` §4.2).`
  - `meta/story.ts` thêm:

```ts
import { grantHeroItem, type PullResult } from "./gacha";
import { masteryLevel } from "./profile";
import type { MasteryGain, Profile } from "../types/index";

export interface StoryRewards {
  firstClear: boolean;
  moonJade: number;
  darkIron: number;
  gains: MasteryGain[];
  hero: PullResult | null;
}

/** Stage `n` needs stage `n-1`; an arc's first stage needs every stage of the arc before (`18` §4.1). */
export function storyStageUnlocked(data: GameData, profile: Profile, stageId: string): boolean {
  const stage = data.storyStages[stageId];
  if (!stage) return false;
  const arcs = Object.values(data.storyArcs);
  const arcIndex = arcs.findIndex((arc) => arc.id === stage.arcId);
  const arc = arcs[arcIndex];
  if (!arc) return false;
  const cleared = new Set(profile.story.cleared);
  const index = arc.stageIds.indexOf(stageId);
  if (index > 0) return cleared.has(arc.stageIds[index - 1]!);
  return arcIndex === 0 || arcs[arcIndex - 1]!.stageIds.every((id) => cleared.has(id));
}

export function unlockedStageIds(data: GameData, profile: Profile): string[] {
  return Object.keys(data.storyStages).filter((id) => storyStageUnlocked(data, profile, id));
}

const NO_REWARDS: StoryRewards = { firstClear: false, moonJade: 0, darkIron: 0, gains: [], hero: null };

/** Records a verified story result (`18` §4.2); only the first win of a stage pays. */
export function applyStoryResult(
  data: GameData,
  profile: Profile,
  setup: StorySetup,
  won: boolean,
): { ok: true; profile: Profile; rewards: StoryRewards } {
  const stage = data.storyStages[setup.stageId];
  if (!won || !stage || profile.story.cleared.includes(stage.id)) {
    return { ok: true, profile, rewards: { ...NO_REWARDS, gains: [] } };
  }
  const next = structuredClone(profile);
  next.story.cleared.push(stage.id);
  const moonJade = stage.firstClear.moonJade ?? 0;
  const darkIron = stage.firstClear.darkIron ?? 0;
  next.currencies.moonJade += moonJade;
  next.currencies.darkIron += darkIron;
  const xp = stage.firstClear.masteryXp ?? 0;
  const gains = xp === 0 ? [] : setup.heroIds.flatMap((heroId) => {
    const hero = next.heroes[heroId];
    if (!hero) return [];
    const levelBefore = masteryLevel(data, hero.xp);
    hero.xp += xp;
    return [{ heroId, xp, levelBefore, levelAfter: masteryLevel(data, hero.xp) }];
  });
  const arc = data.storyArcs[stage.arcId]!;
  const hero = arc.stageIds.at(-1) === stage.id ? grantHeroItem(data, next, arc.rewardHeroId) : null;
  return { ok: true, profile: next, rewards: { firstClear: true, moonJade, darkIron, gains, hero } };
}
```
  (Nếu `structuredClone` không có trong `lib` của `rules`, dùng hàm `clone` giống `profile.ts`: `JSON.parse(JSON.stringify(...))`.)
  - `index.ts`: export `storyStageUnlocked`, `unlockedStageIds`, `applyStoryResult`, type `StoryRewards`.

- [ ] **Step 4: Chạy — xanh**

Run: `pnpm --filter rules test`, `pnpm test`, `pnpm typecheck`
Expected: PASS. Server test hồ sơ vẫn xanh (hồ sơ có thêm `story`; nếu test so khớp nguyên hồ sơ thì cập nhật kỳ vọng).

- [ ] **Step 5: Commit**

```bash
git add packages/rules apps/server/test
git commit -m "Step 7c.2: story progress, unlocks and first-clear rewards (T303, T304, T307)"
```

---

### Task 5: Server — `story_tickets` và route (bước 7c.3)

**Files:**
- Create: `apps/server/src/routes/story.ts`, `apps/server/test/story.test.ts`
- Modify: `apps/server/src/db.ts` (migration 4), `apps/server/src/routes/runs.ts`, `apps/server/src/app.ts`, `apps/server/test/helpers.ts`

**Interfaces:**
- Consumes: `createStoryCombat`, `replayStoryCombat`, `applyStoryResult`, `storyStageUnlocked`, `unlockedStageIds`, `StorySetup` (Task 3–4); `TICKET_TTL_MS` (`routes/runs.ts`).
- Produces:
  - `export const combatActionSchema` và `export function resolveDeck(data, profile, body): SavedDeck | Omit<SavedDeck, "id" | "name">` từ `routes/runs.ts` (tách nguyên văn khối dựng deck trong `POST /api/runs`, route đó gọi lại hàm này).
  - `registerStoryRoutes(app, ctx)`.
  - Test helper `playStory(data, setup, loadout?): { state: CombatState; actions: Action[] }`.

- [ ] **Step 1: Test T305–T306 (đỏ)** trong `apps/server/test/story.test.ts`. `server.data` được tiêm 2 màn trỏ encounter có sẵn. `withServerStory(server)` làm việc này: gán `storyArcs` / `storyStages` giống `withTestStory` (bản copy trong helpers server, vì server không import test của rules).

```ts
import { describe, expect, it } from "vitest";
import type { StorySetup } from "rules";
import { TICKET_TTL_MS } from "../src/routes/runs";
import { call, playStory, register, testServer, withServerStory } from "./helpers";

const TEAM: [string, string, string] = ["m05", "f04", "m06"];
const start = { deckId: "starter", heroIds: TEAM };

async function signedIn() {
  const server = await testServer();
  withServerStory(server);
  const { token } = await register(server);
  return { server, token };
}

describe("story tickets", () => {
  it("T305: locked stage 403; verified win pays once; tampered replay 422 rejected; unfinished 422", async () => {
    const { server, token } = await signedIn();
    expect((await call(server, "POST", "/api/story/t_a1s2/tickets", { token, body: start })).status).toBe(403);

    const ticket = await call(server, "POST", "/api/story/t_a1s1/tickets", { token, body: start });
    expect(ticket.status).toBe(201);
    const setup = ticket.body.setup as StorySetup;
    const { state, actions } = playStory(server.data, setup, ticket.body.loadout);

    const unfinished = await call(server, "POST", `/api/story/tickets/${ticket.body.ticketId}/finish`, { token, rev: 1, body: { actions: actions.slice(0, 3) } });
    expect(unfinished.body).toEqual({ error: "combat not finished" });

    const finished = await call(server, "POST", `/api/story/tickets/${ticket.body.ticketId}/finish`, { token, rev: 1, body: { actions } });
    expect(finished.status).toBe(200);
    expect(finished.body.rewards.firstClear).toBe(state.status === "won");
    if (state.status === "won") expect(finished.body.profile.story.cleared).toEqual(["t_a1s1"]);

    const again = await call(server, "POST", "/api/story/t_a1s1/tickets", { token, body: start });
    const tampered = [...actions];
    tampered[0] = { type: "playCard", instanceId: "c99" };
    const rejected = await call(server, "POST", `/api/story/tickets/${again.body.ticketId}/finish`, { token, rev: 2, body: { actions: tampered } });
    expect(rejected.status).toBe(422);
    expect(rejected.body.error).toBe("replay failed");
    const row = await server.db.prepare("SELECT status FROM story_tickets WHERE id = ?").get(again.body.ticketId);
    expect(row).toEqual({ status: "rejected" });
  });

  it("T306: one open ticket per account; expiry 410; outdated data 409; GET /api/story", async () => {
    const { server, token } = await signedIn();
    expect((await call(server, "GET", "/api/story", { token })).body).toEqual({ cleared: [], unlocked: ["t_a1s1"] });
    const first = await call(server, "POST", "/api/story/t_a1s1/tickets", { token, body: start });
    const second = await call(server, "POST", "/api/story/t_a1s1/tickets", { token, body: start });
    expect((await call(server, "POST", `/api/story/tickets/${first.body.ticketId}/finish`, { token, rev: 1, body: { actions: [] } })).body)
      .toEqual({ error: "ticket closed" });
    server.now.value += TICKET_TTL_MS + 1;
    expect((await call(server, "POST", `/api/story/tickets/${second.body.ticketId}/finish`, { token, rev: 1, body: { actions: [] } })).status).toBe(410);
    const third = await call(server, "POST", "/api/story/t_a1s1/tickets", { token, body: start });
    await server.db.prepare("UPDATE story_tickets SET data_version = 'old' WHERE id = ?").run(third.body.ticketId);
    expect((await call(server, "POST", `/api/story/tickets/${third.body.ticketId}/finish`, { token, rev: 1, body: { actions: [] } })).body)
      .toMatchObject({ error: "outdated client" });
    expect((await call(server, "POST", `/api/story/tickets/${third.body.ticketId}/abandon`, { token })).status).toBe(204);
    expect((await call(server, "POST", "/api/story/nope/tickets", { token, body: start })).status).toBe(404);
  });
});
```

`withServerStory` và `playStory` trong `apps/server/test/helpers.ts` (server không import test của `rules`, nên chép dữ liệu tiêm vào):

```ts
/** Two arcs × two stages on existing encounters (same shape as the rules helper `withTestStory`). */
export function withServerStory(server: TestServer): void {
  const stage = (id: string, arcId: string, encounterId: string): StoryStageDef => ({
    id, arcId, name: id, encounterId, before: [], after: [], firstClear: { moonJade: 40, darkIron: 1, masteryXp: 30 },
  });
  server.data.storyArcs = {
    t_arc1: { id: "t_arc1", name: "Arc 1", stageIds: ["t_a1s1", "t_a1s2"], rewardHeroId: "m10" },
    t_arc2: { id: "t_arc2", name: "Arc 2", stageIds: ["t_a2s1", "t_a2s2"], rewardHeroId: "f02" },
  };
  server.data.storyStages = {
    t_a1s1: stage("t_a1s1", "t_arc1", "enc_01"),
    t_a1s2: stage("t_a1s2", "t_arc1", "enc_02"),
    t_a2s1: stage("t_a2s1", "t_arc2", "enc_03"),
    t_a2s2: stage("t_a2s2", "t_arc2", "enc_01"),
  };
}
```

`server.data` là object mà app dùng (nạp một lần trong `testServer`); `server.version` được tính trước khi tiêm nên header `x-data-version` vẫn khớp. Nếu `buildApp` nhận bản sao của `data` thay vì tham chiếu, hãy thêm tham số `mutateData?: (d: GameData) => void` cho `testServer` và gọi trước `buildApp`.

```ts
export function playStory(data: GameData, setup: StorySetup, loadout?: Loadout): { state: CombatState; actions: Action[] } {
  let state = createStoryCombat(data, setup, loadout).state;
  const actions: Action[] = [];
  while (state.status !== "won" && state.status !== "lost") {
    const action = chooseCombatAction(data, state, 0);
    const result = applyAction(data, state, action);
    if (!result.ok) throw new Error(result.error);
    actions.push(action);
    state = result.state;
    if (actions.length > 2000) throw new Error("playStory: combat did not end");
  }
  return { state, actions };
}
```

- [ ] **Step 2: Chạy — đỏ**

Run: `pnpm --filter server test -- story`
Expected: FAIL (route 404).

- [ ] **Step 3: Migration 4** — thêm phần tử cuối mảng `MIGRATIONS` trong `db.ts`:

```ts
  // 4 — phase 7c: story tickets (`16` §9).
  `
  CREATE TABLE story_tickets (
    id TEXT PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    stage_id TEXT NOT NULL,
    status TEXT NOT NULL,
    setup_json TEXT NOT NULL,
    loadout_json TEXT NOT NULL,
    data_version TEXT NOT NULL,
    created_at BIGINT NOT NULL,
    finished_at BIGINT,
    result_json TEXT
  );
  CREATE INDEX story_tickets_by_account ON story_tickets(account_id, status);
  `,
```

`db.test.ts` có thể kiểm số migration. Nếu có thì cập nhật số kỳ vọng.

- [ ] **Step 4: `routes/runs.ts`** — `export` `combatActionSchema`; tách

```ts
export function resolveDeck(
  data: GameData,
  profile: Profile,
  body: { deckId: string; heroIds?: [string, string, string] },
): SavedDeck | Omit<SavedDeck, "id" | "name"> {
  if (body.heroIds) return { heroIds: body.heroIds, cardIds: starterDeck(data, body.heroIds) };
  const saved = profile.decks.find((candidate) => candidate.id === body.deckId);
  if (!saved) throw new HttpError(404, "unknown deck");
  return saved;
}
```
Export thêm `startBody` và dùng lại trong `POST /api/runs` (hành vi không đổi, `runs.test.ts` phải còn xanh).

- [ ] **Step 5: `routes/story.ts`**

```ts
import type { FastifyInstance } from "fastify";
import type { Action, Loadout, StorySetup } from "rules";
import { applyStoryResult, buildLoadout, replayStoryCombat, storyStageUnlocked, unlockedStageIds, validateDeck } from "rules";
import { z } from "zod";
import { HttpError, type AppContext } from "../context";
import { combatActionSchema, resolveDeck, startBody, TICKET_TTL_MS } from "./runs";

export const MAX_STORY_ACTIONS = 2000;
const finishBody = z.object({ actions: z.array(combatActionSchema).max(MAX_STORY_ACTIONS) });

interface StoryTicketRow {
  id: string;
  account_id: number;
  stage_id: string;
  status: "open" | "finished" | "abandoned" | "rejected";
  setup_json: string;
  loadout_json: string;
  data_version: string;
  created_at: number;
}

/** Story mode: progress, tickets and verified results (`18` §4.3, `16` §9). */
export function registerStoryRoutes(app: FastifyInstance, ctx: AppContext): void {
  const { db, data, clock, random } = ctx;
  const abandonOpen = db.prepare("UPDATE story_tickets SET status = 'abandoned', finished_at = ? WHERE account_id = ? AND status = 'open'");
  const insert = db.prepare(
    "INSERT INTO story_tickets (id, account_id, stage_id, status, setup_json, loadout_json, data_version, created_at) VALUES (?, ?, ?, 'open', ?, ?, ?, ?)",
  );
  const find = db.prepare<[string, number], StoryTicketRow>("SELECT * FROM story_tickets WHERE id = ? AND account_id = ?");
  const close = db.prepare("UPDATE story_tickets SET status = ?, finished_at = ?, result_json = ? WHERE id = ?");

  async function openTicket(id: string, accountId: number): Promise<StoryTicketRow> {
    const row = await find.get(id, accountId);
    if (!row) throw new HttpError(404, "unknown ticket");
    if (row.status !== "open") throw new HttpError(409, "ticket closed");
    if (clock() - row.created_at > TICKET_TTL_MS) throw new HttpError(410, "ticket expired");
    if (row.data_version !== ctx.dataVersion) throw new HttpError(409, "outdated client", { dataVersion: ctx.dataVersion });
    return row;
  }

  app.get("/api/story", async (request) => {
    const { profile } = await ctx.readProfile(await ctx.requireAccount(request));
    return { cleared: profile.story.cleared, unlocked: unlockedStageIds(data, profile) };
  });

  app.post<{ Params: { stageId: string } }>("/api/story/:stageId/tickets", async (request, reply) => {
    const accountId = await ctx.requireAccount(request);
    const { stageId } = request.params;
    if (!data.storyStages[stageId]) throw new HttpError(404, "unknown stage");
    const body = ctx.parseBody(startBody, request.body);
    const { profile } = await ctx.readProfile(accountId);
    if (!storyStageUnlocked(data, profile, stageId)) throw new HttpError(403, "stage locked");
    const deck = resolveDeck(data, profile, body);
    const errors = validateDeck(data, profile, deck);
    if (errors.length > 0) throw new HttpError(400, "invalid deck", { errors });
    const built = buildLoadout(data, profile, deck);
    if (!built.ok) throw new HttpError(400, built.error);
    const setup: StorySetup = { stageId, seed: random(4).readUInt32BE(0), heroIds: deck.heroIds, deckCardIds: [...deck.cardIds] };
    const ticketId = random(16).toString("base64url");
    await db.transaction(async () => {
      const now = clock();
      await abandonOpen.run(now, accountId);
      await insert.run(ticketId, accountId, stageId, JSON.stringify(setup), JSON.stringify(built.loadout), ctx.dataVersion, now);
    });
    return reply.code(201).send({ ticketId, setup, loadout: built.loadout });
  });

  app.post<{ Params: { id: string } }>("/api/story/tickets/:id/finish", async (request) => {
    const accountId = await ctx.requireAccount(request);
    const row = await openTicket(request.params.id, accountId);
    const { actions } = ctx.parseBody(finishBody, request.body);
    const setup = JSON.parse(row.setup_json) as StorySetup;
    const loadout = JSON.parse(row.loadout_json) as Loadout;
    const replay = replayStoryCombat(data, setup, actions as Action[], loadout);
    if (!replay.ok) {
      await close.run("rejected", clock(), JSON.stringify({ step: replay.step, reason: replay.reason }), row.id);
      throw new HttpError(422, "replay failed", { step: replay.step, reason: replay.reason });
    }
    if (replay.state.status !== "won" && replay.state.status !== "lost") throw new HttpError(422, "combat not finished");
    const won = replay.state.status === "won";
    return db.transaction(async () => {
      const outcome = await ctx.mutateProfile(accountId, request, (profile) => applyStoryResult(data, profile, setup, won));
      await close.run("finished", clock(), JSON.stringify({ won }), row.id);
      return { ...outcome, won };
    });
  });

  app.post<{ Params: { id: string } }>("/api/story/tickets/:id/abandon", async (request, reply) => {
    const accountId = await ctx.requireAccount(request);
    const row = await find.get(request.params.id, accountId);
    if (!row) throw new HttpError(404, "unknown ticket");
    if (row.status !== "open") throw new HttpError(409, "ticket closed");
    await close.run("abandoned", clock(), null, row.id);
    return reply.code(204).send();
  });
}
```

`app.ts`: `import { registerStoryRoutes } from "./routes/story";` và gọi `registerStoryRoutes(app, ctx);` ngay sau `registerRunRoutes`.

- [ ] **Step 6: Chạy — xanh**

Run: `pnpm --filter server test`, `pnpm test`, `pnpm typecheck`
Expected: PASS (`runs.test.ts` không đổi).

- [ ] **Step 7: Commit**

```bash
git add apps/server
git commit -m "Step 7c.3: story tickets table and routes (T305-T306)"
```

---

### Task 6: Nội dung Arc 1 — *Vọng Nguyệt* (bước 7c.4)

**Files:**
- Modify: `packages/data/enemies.json`, `packages/data/encounters.json`, `packages/data/story.json`, `docs/03-prototype-content.md`
- Test: `packages/data/test/load-game-data.test.ts` (kiểm chéo tự chạy), mô phỏng tạm (không commit)

**Interfaces:**
- Consumes: Task 1 Step 2 (quyết định Tỏa Nguyệt của địch, mục tiêu độ khó).
- Produces: `arc1` + `arc1_s01`…`arc1_s08`, encounter `story_arc1_s01`…, ~3 kẻ địch thường mới + boss `khao_hach_chi_linh`.

- [ ] **Step 1: Soạn bản đề xuất** vào `docs/03-prototype-content.md` (mục mới "Arc 1"), **chưa sửa JSON**:
  - Bảng 8 màn: id, tên, encounter (danh sách `enemyIds`), `start`, `firstClear` (tổng Nguyệt Ngọc Arc ~400; Huyền Thiết 1–2 mỗi màn, 5 ở boss; XP Tu Luyện 20–40).
  - Kẻ địch mới: `maxHp`, `moonPower`, từng chiêu (cost, effect, targeting), `moonOverrides`. Dùng **chỉ** effect / trạng thái đã có (mục tiêu dạy luật theo §4.5). Boss *Khảo Hạch Chi Linh* dùng `moonOverrides` cho 4 pha có hiệu ứng.
  - Lời thoại `before` / `after` cho từng màn (3–8 câu mỗi phần, speaker là id Hero / kẻ địch / `narrator`). Hero trong thoại lấy từ đội khởi đầu và Hero được tặng (M10), vì người chơi tự chọn đội nên thoại không giả định Hero có mặt trong trận.
  - Mốc độ mạnh tham chiếu: kẻ địch tầng 1–2 hiện có (`puppet_guard` 42 HP, `shadow_fox` 23 HP; damage ×0.7×1.25 của các gói trước).
- [ ] **Step 2: DỪNG — gửi bản đề xuất cho người dùng duyệt.** Chỉ sang Step 3 khi có "ok" (có thể kèm sửa).
- [ ] **Step 3: Viết JSON** theo bản đã duyệt: `enemies.json` (kẻ địch mới, `art.portrait: ""`), `encounters.json` (`tier: "story"`), `story.json` (`arcs[0] = { id: "arc1", name: "Vọng Nguyệt", stageIds: [...], rewardHeroId: "m10" }` + 8 màn).
- [ ] **Step 4: Kiểm**
  - Run: `pnpm --filter data test` → kiểm chéo xanh.
  - Mô phỏng tạm (không commit, đặt trong thư mục scratchpad hoặc `packages/rules/test/zz-story.tmp.test.ts` rồi xóa): với mỗi màn, đội m05+f04+m06 Bộ cơ bản, 80 seed, vòng lặp như `playOut` ở Task 3, đếm thắng và số vòng. So với mục tiêu Task 1 Step 2. Lệch thì chỉnh HP / damage kẻ địch mới (chỉ số liệu) và ghi lại.
- [ ] **Step 5: `pnpm test` + `pnpm typecheck` xanh; T213 xanh** (kẻ địch cũ không đổi).
- [ ] **Step 6: Commit**

```bash
git add packages/data docs/03-prototype-content.md
git commit -m "Step 7c.4: Arc 1 content — enemies, boss, stages, dialogue"
```

---

### Task 7: Nội dung Arc 2 — *Bóng Tối* (bước 7c.5)

**Files / Interfaces:** như Task 6 với `arc2`, `arc2_s01`…`arc2_s08`, boss `vo_nguyet_anh_chu`, `rewardHeroId: "f02"`.

- [ ] **Step 1: Soạn bản đề xuất** vào `docs/03-prototype-content.md` (mục "Arc 2"), cùng khuôn Task 6 Step 1:
  - Độ khó ngang tầng 2–3 của Lượt chơi.
  - Màn 6 *Quan Tinh Đài* có `start: { moonIndex: 0 }` (Trăng Non).
  - Màn 3 và boss dùng **Ẩn Thân** trên kẻ địch. Luật hiện có: Hero không nhắm đơn được kẻ địch Ẩn Thân (`queries.ts:90`), lá `allEnemies` vẫn trúng. Boss *Vô Nguyệt Ảnh Chủ* dùng `stealBuff` trong chiêu (được phép; chỉ `onEnter` của giai đoạn boss co-op mới cấm).
  - F02 / M06 / M08 xuất hiện trong thoại ở màn 2 / 4 / 6. Thoại không giả định họ có trong đội.
- [ ] **Step 2: DỪNG — gửi duyệt.**
- [ ] **Step 3: Viết JSON** (`arcs[1] = { id: "arc2", name: "Bóng Tối", …, rewardHeroId: "f02" }`).
- [ ] **Step 4: Kiểm** như Task 6 Step 4, thêm 2 đội mẫu (m05+f03+f02, m01+m02+f04) để đo mục tiêu "đội tốt nhất ≥ 60%".
- [ ] **Step 5: `pnpm test` + `pnpm typecheck` xanh.**
- [ ] **Step 6: Commit**

```bash
git add packages/data docs/03-prototype-content.md
git commit -m "Step 7c.5: Arc 2 content — enemies, boss, stages, dialogue"
```

---

### Task 8: Client Cốt truyện (bước 7c.6)

**Files:**
- Create: `apps/client/src/story-session.ts`, `apps/client/src/scenes/story-scene.ts`, `apps/client/src/scenes/dialogue-scene.ts`
- Modify: `apps/client/src/session.ts`, `apps/client/src/main.ts`, `apps/client/src/scenes/deck-select-scene.ts`, `apps/client/src/scenes/combat-scene.ts`

**Interfaces:**
- Consumes: `createStoryCombat`, `StorySetup`, `StoryRewards` (rules); route Task 5; `mutate`, `ProfileReply` (`account.ts`); `api` (`api.ts`).
- Produces:
  - `session.story: StoryTicket | null`, `session.pendingStageId: string | null`, `session.lastStory: { won: boolean; rewards: StoryRewards } | null`
  - `startStoryTicket(stageId, deck)`, `recordStoryAction(action)`, `submitStory()`, `abandonStory()` (`story-session.ts`)
  - Scene key `"story"`, `"dialogue"` (data `{ stageId, part: "before" | "after" }`).

- [ ] **Step 1: `story-session.ts`** (theo khuôn `run-session.ts`; phiếu không lưu `localStorage` vì một trận ngắn, tải lại trang thì bỏ phiếu):

```ts
import { createStoryCombat } from "rules";
import type { Action, Loadout, StoryRewards, StorySetup } from "rules";
import { mutate, type ProfileReply } from "./account";
import { ApiError, api } from "./api";
import { session, type Team } from "./session";

export interface StoryTicket {
  ticketId: string;
  setup: StorySetup;
  loadout: Loadout;
  actions: Action[];
}

/** Asks the server for a stage ticket, then builds the combat locally from its setup (`18` §4.4). */
export async function startStoryTicket(stageId: string, deck: { id: string; heroIds: Team }): Promise<void> {
  const body = deck.id.startsWith("starter:") ? { deckId: "starter", heroIds: deck.heroIds } : { deckId: deck.id };
  const reply = await api<{ ticketId: string; setup: StorySetup; loadout: Loadout }>("POST", `/story/${stageId}/tickets`, { body });
  session.story = { ticketId: reply.ticketId, setup: reply.setup, loadout: reply.loadout, actions: [] };
  session.run = null;
  session.heroIds = reply.setup.heroIds;
  session.deckCardIds = reply.setup.deckCardIds;
  session.seed = reply.setup.seed;
  const { state, events } = createStoryCombat(session.data, reply.setup, reply.loadout);
  session.state = state;
  session.events.push(...events);
}

export function recordStoryAction(action: Action): void {
  session.story?.actions.push(action);
}

/** Sends the finished combat; the server replays it and returns the profile + rewards. */
export async function submitStory(): Promise<{ won: boolean; rewards: StoryRewards }> {
  const ticket = session.story!;
  type FinishReply = ProfileReply & { won: boolean; rewards: StoryRewards };
  const send = () => mutate<FinishReply>("POST", `/story/tickets/${ticket.ticketId}/finish`, { actions: ticket.actions });
  let reply: FinishReply;
  try {
    reply = await send();
  } catch (error) {
    if (!(error instanceof ApiError && error.code === "stale profile")) throw error;
    reply = await send();
  }
  session.story = null;
  session.lastStory = { won: reply.won, rewards: reply.rewards };
  return session.lastStory;
}

export async function abandonStory(): Promise<void> {
  const ticket = session.story;
  session.story = null;
  if (!ticket) return;
  try {
    await api("POST", `/story/tickets/${ticket.ticketId}/abandon`);
  } catch {
    // Already closed or expired on the server.
  }
}
```

- [ ] **Step 2: `session.ts`** — thêm vào `CombatSession` và `newCombatSession`: `story: StoryTicket | null` (null), `pendingStageId: string | null` (null), `lastStory: { won: boolean; rewards: StoryRewards } | null` (null).

- [ ] **Step 3: `StoryScene` (`story-scene.ts`)** — `super("story")`, `useDesignCamera(this)`, dùng `addButton` / `addText` / `addCurrencyBar` (`ui/widgets.ts`):
  - `create()`: gọi `api<{ cleared: string[]; unlocked: string[] }>("GET", "/story")`. Lỗi mạng → `showToast` và nút *Quay lại* về `"deck-select"`.
  - Cột trái: một nút mỗi arc (`Object.values(data.storyArcs)`); arc chưa mở màn nào → nút tắt.
  - Cột phải (arc đang chọn): mỗi màn một hàng `"<số>. <tên>"` + trạng thái `✓ Đã qua` / `Mở` / `🔒`, và thưởng lần đầu (`firstClear`) với màn chưa qua. Màn cuối hiện thêm `"Tặng: <tên Hero>"` (`data.heroes[arc.rewardHeroId].name`).
  - Bấm màn đang mở → `session.pendingStageId = id` → `this.scene.start("dialogue", { stageId: id, part: "before" })`.
- [ ] **Step 4: `DialogueScene` (`dialogue-scene.ts`)** — `super("dialogue")`:
  - Nhận `{ stageId, part }`; `lines = stage[part]`. Rỗng → chuyển ngay bước kế (dưới).
  - Mỗi câu: khung chân dung trái 160×200. `art.portrait` của Hero / kẻ địch trống hoặc `speaker === "narrator"` → khung tạm màu `OWNER_COLORS` / `COLORS.panel` có tên. Tên người nói (Hero → `data.heroes[id].name`, kẻ địch → `data.enemies[id].name`, `narrator` → không tên). Chữ trong khung dưới, xuống dòng theo chiều rộng.
  - Click hoặc phím Space → câu kế. Nút *Bỏ Qua* (góc phải trên) → hết câu.
  - Hết câu: `part === "before"` → `this.scene.start("deck-select")` (có `session.pendingStageId`); `part === "after"` → `this.scene.start("story")` và `showToast` bảng thưởng từ `session.lastStory` (Nguyệt Ngọc, Huyền Thiết, XP từng Hero, Hero được tặng hoặc "+1 Tinh Hồn").
- [ ] **Step 5: `DeckSelectScene`** — khi `session.pendingStageId !== null`:
  - Tiêu đề `"Cốt Truyện — <tên màn>"`. Thay hai nút *Lượt chơi* / *Trận lẻ* của hàng deck bằng một nút *Vào trận* (bật khi deck hợp lệ và online). Nút này gọi `startStoryTicket(pendingStageId, deck)` rồi `this.scene.start("combat")`. Lỗi → `showToast(errorText(error))`.
  - Thêm nút *Hủy* → `session.pendingStageId = null`, về `"story"`.
  - Menu thường: thêm nút *Cốt Truyện* cạnh *Đấu Trường* / *Liên Thủ* (`addButton(this, this.root, 1090, 568, 200, "Cốt Truyện", () => this.scene.start("story"), online)`).
  - Danh sách Trận lẻ lọc thêm `tier !== "story"` (hiện đang lọc `coop`).
- [ ] **Step 6: `CombatScene`**:
  - `dispatch`: nhánh không phải run, không phải netMatch, sau khi `applyAction` thành công → `if (session.story) recordStoryAction(action);`.
  - Khi trận kết thúc (`state.status` là `won` / `lost`) và `session.story !== null`: gọi `submitStory()`. Thắng → `this.scene.start("dialogue", { stageId, part: "after" })`. Thua → bảng kết quả hiện có với nút *Thử Lại* (`startStoryTicket` cùng deck rồi `scene.restart()`) và nút *Về Cốt Truyện*. Lỗi nộp (`replay failed`…) → toast + về `"story"`.
  - Ẩn các nút debug sửa trận khi `session.story` (giống cảnh báo run ở dòng ~1517).
- [ ] **Step 7: `main.ts`** — thêm `StoryScene`, `DialogueScene` vào mảng `scene`.
- [ ] **Step 8: Kiểm tay trên trình duyệt** (`pnpm dev`, preview `.claude/launch.json` nếu có): đăng nhập → Cốt Truyện → Arc 1 màn 1 → thoại → chọn deck → trận → thắng → thoại sau → bảng thưởng → màn 2 mở. Chụp màn hình từng scene. Thử nút *Bỏ Qua*, Space, thua + *Thử Lại*, màn khóa không bấm được, offline ẩn nút.
- [ ] **Step 9: `pnpm test` + `pnpm typecheck` xanh.**
- [ ] **Step 10: Commit**

```bash
git add apps/client
git commit -m "Step 7c.6: client story mode — arcs, dialogue, tickets"
```

---

### Task 9: Chơi thử, chỉnh độ khó, đóng 7c (bước 7c.7)

**Files:**
- Modify: `packages/data/enemies.json` (chỉ số liệu, nếu cần), `docs/playtest-notes.md`, `docs/18-phase7-spec.md` (Trạng thái), `docs/07-implementation-plan.md`, `CLAUDE.md`
- Test: mô phỏng tạm (không commit)

- [ ] **Step 1: Mô phỏng 16 màn** (file tạm, xóa sau khi đo): 3 đội mẫu (m05+f04+m06, m05+f03+f02, m01+m02+f04) × Bộ cơ bản × 80 seed × mỗi màn. Ghi thắng %, vòng TB, tỉ lệ Cạn Bài. Bot dùng `chooseCombatAction` (bot chỉ đọc thông tin công khai).
- [ ] **Step 2: So mục tiêu Task 1 Step 2.** Lệch → ablation chỉ trên HP / damage kẻ địch **mới** của 7c (không đụng kẻ địch cũ, giữ T213). Soạn bảng "gói chỉnh đề xuất". **DỪNG — gửi duyệt**, rồi áp.
- [ ] **Step 3: Chơi tay** Arc 1 màn 1, 5, 8 và Arc 2 màn 3, 6, 8 trên client. Ghi cảm nhận: thoại dài/ngắn, độ khó, pha trăng đầu trận có đọc được không.
- [ ] **Step 4: Ghi `docs/playtest-notes.md`** mục "Phase 7c": phương pháp, bảng 16 màn, gói chỉnh, nhận xét chơi tay, điểm mở.
- [ ] **Step 5: Đóng 7c** — `18` "Trạng thái: 7c xong — tiếp theo 7d (§5)"; `07`; `CLAUDE.md` "Giai đoạn hiện tại: 7d".
- [ ] **Step 6: `pnpm test` + `pnpm typecheck` xanh; T213 xanh.**
- [ ] **Step 7: Commit**

```bash
git add packages/data docs CLAUDE.md
git commit -m "Close phase 7c: story playtest, difficulty tuning"
```

---

## Self-review (đã chạy khi viết plan)

- **Độ phủ spec §4:** 4.1 dữ liệu + kiểm chéo + luật mở màn → Task 2, 4. 4.2 luật thuần → Task 3, 4. 4.3 server → Task 5. 4.4 client → Task 8. 4.5 nội dung → Task 6, 7. Thưởng (chốt ở 7d.6) → `firstClear` trong JSON, chỉnh ở 7d. §8 bước 7c.1–7c.7 → Task 1–9. §6 test → T300–T307 (dời số, Task 1).
- **Điểm dừng hỏi người dùng:** Task 1 Step 2 (Tỏa Nguyệt của địch, mục tiêu độ khó); Task 6/7 Step 2 (nội dung); Task 9 Step 2 (gói chỉnh).
- **Tên thống nhất:** `StorySetup`, `createStoryCombat`, `replayStoryCombat`, `storyStageUnlocked`, `unlockedStageIds`, `applyStoryResult(data, profile, setup, won)`, `StoryRewards`, `withTestStory`, `withServerStory`, `playStory`, `startStoryTicket` / `recordStoryAction` / `submitStory` / `abandonStory`, `session.story` / `pendingStageId` / `lastStory`.
