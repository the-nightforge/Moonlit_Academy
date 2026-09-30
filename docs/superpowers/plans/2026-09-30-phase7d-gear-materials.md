# Giai đoạn 7d (Trang bị và vật liệu) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Mỗi Task kết thúc bằng `pnpm test` + `pnpm typecheck` xanh và một commit trên nhánh `feature/phase7`. Báo người dùng sau mỗi Task và chờ "ok" trước Task kế tiếp. Task 4, 5 và 7 có **điểm dừng duyệt** giữa chừng.

**Goal:** Huyền Thiết và Nguyệt Trần có chỗ tiêu (nâng +1 Tinh Luyện / Cộng Minh). Lượt chơi trả Huyền Thiết. Đủ 20 Hero có vũ khí bản mệnh (thêm 15). Thêm 8 Nguyệt Bảo mới (tổng 16).

**Architecture:**
- **Luật thuần** `rules/src/meta/upgrade.ts`: `upgradeItem` đọc giá từ `economy-config.json → upgradeCost`, trừ vật liệu và +1 cấp. Server gọi qua `ctx.mutateProfile` (có `If-Match`), giống mọi route hồ sơ.
- **Huyền Thiết từ Lượt chơi:** cộng trong `applyRunRewards`, số nằm trong `runRewards`.
- **Nội dung:** thêm vào `weapons.json` / `relics.json` / `banners.json` theo khuôn `02` §1.12. Không có effect hay hook mới. Nếu một món cần cơ chế chưa có thì dừng và hỏi.
- **Client:** chỉ thêm nút *Nâng Cấp* trong `ArmoryScene`.

**Tech Stack:** TypeScript strict, pnpm workspaces, Vitest, zod (`packages/data`), Fastify + Postgres (test bằng `pg-mem`), Phaser (client).

**Spec:** `docs/18-phase7-spec.md` §5 (7d), §6, §8. Khi plan và spec khác nhau về luật, spec là chuẩn. Khi spec và tài liệu luật (`02`, `14`, `16`) khác nhau, tài liệu luật là chuẩn. Những điểm plan làm rõ spec nằm ở Task 1 Step 1 và phải được đưa vào tài liệu.

**Điều kiện trước:** 7c đã đóng (`74bb9bd`). `firstClear.darkIron` của Cốt truyện đã có từ 7c.

**Thứ tự với Nguyệt Luân mới** (`docs/superpowers/plans/2026-09-30-nguyet-luan-redesign.md`):
- Task 1–3 và Task 6 của plan này độc lập với Nguyệt Luân.
- Nếu Nguyệt Luân mới được thực hiện thì làm **trước Task 4–5 và Task 7**. Lý do: nội tại vũ khí / Nguyệt Bảo gắn với pha trăng, và mọi số đo cân bằng phải đo trên luật trăng cuối cùng.

## Global Constraints

- `packages/rules` thuần: không Phaser, DOM, mạng, file system, `Math.random()`, `Date.now()`.
- Hàm thuần, không mutate đầu vào: `upgradeItem` clone hồ sơ trước khi sửa (như `unlockCard`).
- Server là trọng tài hồ sơ (CLAUDE.md quy tắc 9): nâng cấp chỉ đổi trên server, qua hàm thuần trong `rules/src/meta/`. Client không tự trừ vật liệu.
- **T213 (ghi vàng PvE) xanh sau mỗi Task, không ghi lại.** 7d không đổi kết quả trận cũ: vũ khí / Nguyệt Bảo mới chỉ vào trận khi được trang bị, và golden không trang bị chúng. Nếu T213 đỏ thì dừng và tìm nguyên nhân.
- Không hardcode giá, thưởng, chỉ số trang bị trong code: nằm trong `economy-config.json`, `weapons.json`, `relics.json`, `banners.json`.
- Code, tên biến, comment: tiếng Anh. Chữ cho người chơi: tiếng Việt, lấy từ dữ liệu hoặc `apps/client/src/ui/theme.ts`.
- Thuật ngữ theo `docs/04-glossary.md` (Task 1 thêm: Nâng Cấp).
- Mã test **T308–T313** (`18` §6, đã dời ở 7c). Tên test bắt đầu bằng mã.
- Không thêm thư viện mới.
- Lệnh (ở gốc repo): `pnpm --filter rules test`, `pnpm --filter data test`, `pnpm --filter server test`, `pnpm test`, `pnpm typecheck`.

---

## File Structure

| File | Trách nhiệm | Task |
|---|---|---|
| `docs/{02,03,04,05,06,07,14,16,18}.md`, `CLAUDE.md` | Tài liệu 7d | 1 |
| `packages/data/economy-config.json`, `src/schema.ts` | `upgradeCost`, `runRewards.darkIron*` | 2 |
| `packages/rules/src/types/static.ts` | `EconomyConfig.upgradeCost`, `runRewards` mới | 2 |
| `packages/rules/src/meta/upgrade.ts` (mới) | `upgradeCost`, `upgradeItem` | 2 |
| `packages/rules/src/meta/economy.ts` | Huyền Thiết trong `applyRunRewards`, `RunRewards.darkIron` | 2 |
| `packages/rules/src/index.ts` | Export mới | 2 |
| `packages/rules/test/meta-upgrade.test.ts` (mới) | T308–T310, T312 | 2 |
| `apps/server/src/routes/profile.ts`, `apps/server/test/gear.test.ts` | Route nâng cấp, T311 | 3 |
| `packages/data/weapons.json` | 15 vũ khí bản mệnh | 4 |
| `packages/data/relics.json`, `banners.json` | 8 Nguyệt Bảo, banner | 5 |
| `packages/data/test/load-game-data.test.ts` | T313 | 5 |
| `apps/client/src/scenes/armory-scene.ts`, `ui/theme.ts`, `scenes/run-scene.ts` | Nút Nâng Cấp, chữ lỗi, hiện Huyền Thiết thưởng | 6 |
| `packages/rules/test/{run-playtest.test.ts,economy-sim.ts,economy-sim.test.ts}`, `docs/playtest-notes.md` | Mô phỏng + chỉnh số | 7 |

---

### Task 1: Tài liệu 7d (bước 7d.1)

**Files:** `docs/18-phase7-spec.md` (§5), `docs/02-data-schema.md`, `docs/03-prototype-content.md`, `docs/04-glossary.md`, `docs/05-ui-combat-screen.md` (nếu có mục Kho đồ; nếu không thì bỏ qua), `docs/06-test-scenarios.md`, `docs/07-implementation-plan.md`, `docs/14-meta-rules.md`, `docs/16-server-api.md`, `CLAUDE.md`

- [ ] **Step 1: Chốt các điểm plan làm rõ spec** — sửa `18` §5 cho khớp:
  - **Giá nâng cấp** `upgradeCost[kind][rarity][level − 1]` là giá đi từ `level` lên `level + 1` (level 1…4). Spec ghi "chỉ số = cấp đích − 2", cùng nghĩa. Độ hiếm `common` dùng hàng `rare`.
  - **`upgradeItem`** trả:
    - thành công: `{ ok: true; profile; level: number; spent: number }`;
    - lỗi: `{ ok: false; error: "not owned" | "maxed" | "not enough" }`. Id không có trong dữ liệu cũng là `"not owned"`.
  - **Huyền Thiết từ Lượt chơi:** `runRewards` thêm `darkIronWin: 3`, `darkIronLoss: 1`, `darkIronLossMinFloor: 2`.
    - Thắng → `darkIronWin`.
    - Thua với `floorReached ≥ darkIronLossMinFloor` → `darkIronLoss`.
    - Thua sớm hơn → 0.
    - `RunRewards` thêm `darkIron: number`.
  - **Route** trả `{ profile, rev, level, spent }`. Lỗi luật → `400` với mã lỗi của `upgradeItem` (theo `mutateProfile`).
  - **Vũ khí của F09** (Hero Common) có độ hiếm Rare. Kiểm dữ liệu: `weapon.rarity === hero.rarity`, riêng Hero `common` → `rare`.
- [ ] **Step 2: Viết tài liệu**:
  - `14`: mục *Nâng cấp bằng vật liệu* (luật, bảng giá, lỗi) và bổ sung §5 (thưởng Lượt chơi) với Huyền Thiết.
  - `02`: `economy-config.json` (`upgradeCost`, `runRewards` mới).
  - `16`: hai route nâng cấp.
  - `04`: Nâng Cấp (*upgrade*).
  - `06`: T308–T313 theo bảng dưới.
  - `07` + `CLAUDE.md`: "Giai đoạn hiện tại: 7d đang làm — `docs/18-phase7-spec.md` §5".

  | Mã | Nội dung |
  |---|---|
  | T308 | `upgradeItem` vũ khí: đủ Huyền Thiết → trừ đúng giá, `refinement + 1`; hồ sơ đầu vào không đổi |
  | T309 | `upgradeItem` lỗi: chưa sở hữu, đã cấp 5, thiếu vật liệu — hồ sơ không đổi |
  | T310 | Giá theo độ hiếm và cấp cho cả vũ khí (Huyền Thiết) và Nguyệt Bảo (Nguyệt Trần); `common` dùng giá `rare` |
  | T311 | Route nâng cấp: thành công trả hồ sơ + `rev + 1`; thiếu `If-Match` → 428; `rev` cũ → 409; lỗi luật → 400 |
  | T312 | `applyRunRewards`: thắng +3 Huyền Thiết; thua ở tầng ≥ 2 +1; thua tầng 1 +0; bộ khởi đầu cũng nhận |
  | T313 | Nạp dữ liệu: 25 vũ khí, 20 Hero đều có đúng 1 vũ khí bản mệnh đúng độ hiếm; 16 Nguyệt Bảo; banner trỏ tới mọi món |

- [ ] **Step 3: Commit**

```bash
git add docs CLAUDE.md
git commit -m "Step 7d.1: phase 7d rule docs"
```

---

### Task 2: `upgradeItem`, giá nâng cấp, Huyền Thiết từ Lượt chơi (bước 7d.2, phần luật)

**Files:**
- Create: `packages/rules/src/meta/upgrade.ts`, `packages/rules/test/meta-upgrade.test.ts`
- Modify: `packages/data/economy-config.json`, `packages/data/src/schema.ts`, `packages/rules/src/types/static.ts`, `packages/rules/src/meta/economy.ts`, `packages/rules/src/index.ts`

**Interfaces:**
- Produces:
  - `EconomyConfig.upgradeCost: Record<"weapon" | "relic", Record<"rare" | "epic" | "legendary", number[]>>`
  - `EconomyConfig.runRewards` thêm `darkIronWin`, `darkIronLoss`, `darkIronLossMinFloor`
  - `type UpgradeKind = "weapon" | "relic"`
  - `upgradeCost(data: GameData, kind: UpgradeKind, id: string, level: number): number | null` (giá từ `level` lên `level + 1`; `null` khi id lạ hoặc `level` ngoài 1…4)
  - `upgradeItem(data: GameData, profile: Profile, kind: UpgradeKind, id: string): { ok: true; profile: Profile; level: number; spent: number } | { ok: false; error: "not owned" | "maxed" | "not enough" }`
  - `RunRewards.darkIron: number`

- [ ] **Step 1: Test (đỏ)** — `packages/rules/test/meta-upgrade.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { applyRunRewards, createProfile, upgradeCost, upgradeItem } from "../src/index";
import type { RunResult } from "../src/index";
import { testData } from "./helpers";

const NOW = Date.UTC(2026, 8, 30, 12);
const TEAM: [string, string, string] = ["m05", "f04", "m06"];

describe("gear upgrades", () => {
  it("T308: upgrading a weapon spends dark iron and adds one refinement; the input profile is untouched", () => {
    const data = testData();
    const profile = createProfile(data);
    profile.weapons = { w_anh_nguyet_chuy: { refinement: 1 } }; // epic
    profile.currencies.darkIron = 10;
    const result = upgradeItem(data, profile, "weapon", "w_anh_nguyet_chuy");
    expect(result).toMatchObject({ ok: true, level: 2, spent: 3 });
    if (!result.ok) return;
    expect(result.profile.weapons["w_anh_nguyet_chuy"]).toEqual({ refinement: 2 });
    expect(result.profile.currencies.darkIron).toBe(7);
    expect(profile.weapons["w_anh_nguyet_chuy"]).toEqual({ refinement: 1 });
    expect(profile.currencies.darkIron).toBe(10);
  });

  it("T309: not owned, maxed and not enough leave the profile unchanged", () => {
    const data = testData();
    const profile = createProfile(data);
    profile.currencies.darkIron = 2;
    expect(upgradeItem(data, profile, "weapon", "w_anh_nguyet_chuy")).toEqual({ ok: false, error: "not owned" });
    expect(upgradeItem(data, profile, "weapon", "nope")).toEqual({ ok: false, error: "not owned" });
    profile.weapons = { w_anh_nguyet_chuy: { refinement: 1 }, w_thiet_thuan: { refinement: 5 } };
    expect(upgradeItem(data, profile, "weapon", "w_anh_nguyet_chuy")).toEqual({ ok: false, error: "not enough" });
    expect(upgradeItem(data, profile, "weapon", "w_thiet_thuan")).toEqual({ ok: false, error: "maxed" });
    expect(profile.currencies.darkIron).toBe(2);
  });

  it("T310: cost follows rarity and level; relics spend moon dust; common uses the rare row", () => {
    const data = testData();
    const cost = data.economyConfig.upgradeCost;
    expect([1, 2, 3, 4].map((level) => upgradeCost(data, "weapon", "w_xich_diem_thuong", level))).toEqual(cost.weapon.legendary);
    expect([1, 2, 3, 4].map((level) => upgradeCost(data, "relic", "r_bach_lo_huong_nang", level))).toEqual(cost.relic.rare);
    expect(upgradeCost(data, "weapon", "w_xich_diem_thuong", 5)).toBeNull();
    expect(upgradeCost(data, "weapon", "nope", 1)).toBeNull();
    data.relics["r_bach_lo_huong_nang"]!.rarity = "common";
    expect(upgradeCost(data, "relic", "r_bach_lo_huong_nang", 1)).toBe(cost.relic.rare[0]);

    const profile = createProfile(data);
    profile.relics = { r_huyet_ngoc_boi: { resonance: 4 } }; // epic
    profile.currencies.moonDust = 9;
    profile.currencies.darkIron = 0;
    const result = upgradeItem(data, profile, "relic", "r_huyet_ngoc_boi");
    expect(result).toMatchObject({ ok: true, level: 5, spent: cost.relic.epic[3] });
    if (result.ok) expect(result.profile.currencies.moonDust).toBe(9 - cost.relic.epic[3]!);
  });

  it("T312: runs pay dark iron — 3 on a win, 1 on a loss from floor 2, none earlier; starter decks too", () => {
    const data = testData();
    const run = (won: boolean, floorReached: number): RunResult => ({ heroIds: TEAM, floorReached, won, heroLevelUps: {} });
    const pay = (result: RunResult, starterDeck: boolean) =>
      applyRunRewards(data, createProfile(data), result, { now: NOW, starterDeck });
    expect(pay(run(true, 8), false).rewards.darkIron).toBe(3);
    expect(pay(run(true, 8), false).profile.currencies.darkIron).toBe(3);
    expect(pay(run(false, 2), false).rewards.darkIron).toBe(1);
    expect(pay(run(false, 1), false).rewards.darkIron).toBe(0);
    expect(pay(run(false, 5), true).rewards.darkIron).toBe(1);
  });
});
```

- [ ] **Step 2: Chạy — đỏ**

Run: `pnpm --filter rules test -- meta-upgrade`
Expected: FAIL (`upgradeItem` chưa có).

- [ ] **Step 3: Dữ liệu + kiểu**
  - `economy-config.json`:

```json
  "runRewards": { "moonJadePerFloor": 3, "moonJadeWin": 20, "firstWinOfDay": 30, "darkIronWin": 3, "darkIronLoss": 1, "darkIronLossMinFloor": 2 },
  "upgradeCost": {
    "weapon": { "rare": [2, 3, 4, 5], "epic": [3, 5, 7, 9], "legendary": [5, 8, 11, 14] },
    "relic": { "rare": [2, 3, 4, 5], "epic": [3, 5, 7, 9], "legendary": [5, 8, 11, 14] }
  },
```
  - `schema.ts` → `economyConfigSchema`: `runRewards` thêm `darkIronWin: nonNegativeInt, darkIronLoss: nonNegativeInt, darkIronLossMinFloor: z.number().int().positive()`; thêm

```ts
const upgradeRow = z.array(z.number().int().positive()).length(4);
const upgradeTable = z.object({ rare: upgradeRow, epic: upgradeRow, legendary: upgradeRow });
// trong economyConfigSchema:
  upgradeCost: z.object({ weapon: upgradeTable, relic: upgradeTable }),
```
  - `types/static.ts` → `EconomyConfig`: `runRewards` thêm ba trường; thêm `/** Material cost to go from level n to n + 1 (index n − 1), by rarity (`14` §13.2). */ upgradeCost: Record<"weapon" | "relic", Record<"rare" | "epic" | "legendary", number[]>>;`.
- [ ] **Step 4: `meta/upgrade.ts`**

```ts
import type { GameData, Profile } from "../types/index";

export type UpgradeKind = "weapon" | "relic";
const MAX_GEAR_LEVEL = 5;

/** Material cost to take `id` from `level` to `level + 1`; null for unknown items or levels (`14` §13.2). */
export function upgradeCost(data: GameData, kind: UpgradeKind, id: string, level: number): number | null {
  const rarity = (kind === "weapon" ? data.weapons[id] : data.relics[id])?.rarity;
  if (rarity === undefined) return null;
  const row = data.economyConfig.upgradeCost[kind][rarity === "common" ? "rare" : rarity];
  return row[level - 1] ?? null;
}

/** Spends dark iron (weapons) or moon dust (relics) for one level (`18` §5.1). */
export function upgradeItem(
  data: GameData,
  profile: Profile,
  kind: UpgradeKind,
  id: string,
): { ok: true; profile: Profile; level: number; spent: number } | { ok: false; error: "not owned" | "maxed" | "not enough" } {
  const level = kind === "weapon" ? profile.weapons[id]?.refinement : profile.relics[id]?.resonance;
  if (level === undefined) return { ok: false, error: "not owned" };
  if (level >= MAX_GEAR_LEVEL) return { ok: false, error: "maxed" };
  const cost = upgradeCost(data, kind, id, level);
  if (cost === null) return { ok: false, error: "not owned" };
  const currency = kind === "weapon" ? "darkIron" : "moonDust";
  if (profile.currencies[currency] < cost) return { ok: false, error: "not enough" };
  const next = JSON.parse(JSON.stringify(profile)) as Profile;
  next.currencies[currency] -= cost;
  if (kind === "weapon") next.weapons[id]!.refinement = level + 1;
  else next.relics[id]!.resonance = level + 1;
  return { ok: true, profile: next, level: level + 1, spent: cost };
}
```
  `index.ts`: `export { upgradeCost, upgradeItem } from "./meta/upgrade"; export type { UpgradeKind } from "./meta/upgrade";`
- [ ] **Step 5: Huyền Thiết trong `applyRunRewards`** (`meta/economy.ts`) — `RunRewards` thêm `/** Dark iron from the run (`14` §5). */ darkIron: number;`; trong hàm, sau khi cộng `moonJade`:

```ts
  const { darkIronWin, darkIronLoss, darkIronLossMinFloor } = data.economyConfig.runRewards;
  const darkIron = result.won ? darkIronWin : result.floorReached >= darkIronLossMinFloor ? darkIronLoss : 0;
  next.currencies.darkIron += darkIron;
```
  và trả `rewards: { moonJade, darkIron, firstWinOfDay: firstWin, achievements }`.
- [ ] **Step 6: Chạy — xanh**

Run: `pnpm --filter rules test`, `pnpm test`, `pnpm typecheck`
Expected: PASS. Test cũ so khớp nguyên `rewards` của Lượt chơi (rules `meta-economy.test.ts`, server `runs.test.ts` / `economy.test.ts`) cần thêm `darkIron` vào kỳ vọng. Đó là thay đổi đúng, không phải nới test. T213 xanh.
- [ ] **Step 7: Commit**

```bash
git add packages apps/server/test
git commit -m "Step 7d.2: upgradeItem, upgrade costs, dark iron from runs (T308-T310, T312)"
```

---

### Task 3: Route nâng cấp (bước 7d.2, phần server)

**Files:** `apps/server/src/routes/profile.ts`, `apps/server/test/gear.test.ts`

**Interfaces:**
- Consumes: `upgradeItem` (Task 2), `ctx.mutateProfile`.
- Produces: `POST /api/profile/weapons/:id/upgrade`, `POST /api/profile/relics/:id/upgrade` → `{ profile, rev, level, spent }`.

- [ ] **Step 1: Test T311 (đỏ)** — thêm vào `apps/server/test/gear.test.ts` (dùng `editProfile` có sẵn trong file):

```ts
  it("T311: upgrade routes spend materials through If-Match; rule errors are 400", async () => {
    const server = await testServer();
    const { token } = await register(server);
    await editProfile(server, (profile) => {
      profile.weapons = { w_anh_nguyet_chuy: { refinement: 1 } };
      profile.relics = { r_huyet_ngoc_boi: { resonance: 5 } };
      profile.currencies.darkIron = 4;
      profile.currencies.moonDust = 50;
    });
    const url = "/api/profile/weapons/w_anh_nguyet_chuy/upgrade";
    expect((await call(server, "POST", url, { token })).status).toBe(428);
    expect((await call(server, "POST", url, { token, rev: 99 })).status).toBe(409);

    const ok = await call(server, "POST", url, { token, rev: 1 });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ rev: 2, level: 2, spent: 3 });
    expect(ok.body.profile.weapons["w_anh_nguyet_chuy"]).toEqual({ refinement: 2 });
    expect(ok.body.profile.currencies.darkIron).toBe(1);

    const poor = await call(server, "POST", url, { token, rev: 2 });
    expect([poor.status, poor.body]).toEqual([400, { error: "not enough" }]);
    const maxed = await call(server, "POST", "/api/profile/relics/r_huyet_ngoc_boi/upgrade", { token, rev: 2 });
    expect([maxed.status, maxed.body]).toEqual([400, { error: "maxed" }]);
    const missing = await call(server, "POST", "/api/profile/relics/nope/upgrade", { token, rev: 2 });
    expect([missing.status, missing.body]).toEqual([400, { error: "not owned" }]);
  });
```
  Trước khi chạy, đối chiếu số `rev` ban đầu sau `register` với các test khác trong file (đang dùng `rev: 1`). `editProfile` ghi thẳng DB nên không đổi `rev`.
- [ ] **Step 2: Chạy — đỏ.** `pnpm --filter server test -- gear` → 404.
- [ ] **Step 3: Cài đặt** — trong `registerProfileRoutes`, import `upgradeItem` từ `rules`:

```ts
  for (const [path, kind] of [["weapons", "weapon"], ["relics", "relic"]] as const) {
    app.post<{ Params: { id: string } }>(`/api/profile/${path}/:id/upgrade`, async (request) => {
      const accountId = await ctx.requireAccount(request);
      return ctx.mutateProfile(accountId, request, (profile) => upgradeItem(data, profile, kind, request.params.id));
    });
  }
```
- [ ] **Step 4: Chạy — xanh.** `pnpm --filter server test`, `pnpm test`, `pnpm typecheck`.
- [ ] **Step 5: Commit** — `git commit -m "Step 7d.2: gear upgrade routes (T311)"`

---

### Task 4: 15 vũ khí bản mệnh (bước 7d.3)

**Files:** `packages/data/weapons.json`, `docs/03-prototype-content.md` (§7)

**Interfaces:**
- Produces: 15 `WeaponDef` có `signatureHeroId` cho M01, M02, M03, M04, M07, M08, M09, M10, F01, F05, F06, F07, F08, F09, F10. Id `w_<tên_snake_case>`.

- [ ] **Step 1: Soạn bản đề xuất** vào `docs/03-prototype-content.md` §7 (chưa sửa JSON). Mỗi vũ khí một hàng:
  - tên, Hero, độ hiếm;
  - lá Binh Khí (cost, `copies` 1–2, loại, effect);
  - nội tại thường (R1), nội tại bản mệnh;
  - 4 cấp Tinh Luyện (R2–R5).

  Ràng buộc:
  - Độ hiếm = độ hiếm Hero. F09 (Common) dùng Rare. *Ngọc Bút* của M01 theo GDD §5.1 (Legendary; lá *Bút Định Càn Khôn*; nội tại "Đầu trận +1 Nguyệt Lực").
  - Chỉ dùng effect, hook trigger và `LevelUpPassive` **đã có** (`02` §1.12, `11` §3.3). Hook bản mệnh khai thác đúng lối chơi của Hero (bộ đếm thăng cấp, lá đặc trưng `scaledDamage`, Linh Thú của F09, Hồi Hồn của F10, Phong Ấn của F07, Mê Hoặc của F06 / M09…).
  - Mốc sức mạnh: chuẩn 4e.7 sau gói G1 (`playtest-notes.md` "Phase 4e"). R1 không tăng tỉ lệ thắng lượt quá 10 điểm; R2–R5 tăng dần như 10 vũ khí hiện có. Lá Binh Khí ~2–3 damage / Nguyệt Lực hoặc giá trị tương đương.
  - Mỗi vũ khí chiếm 1 ô trong 18 ô deck của người mang (`01` §14.2).
- [ ] **Step 2: DỪNG — gửi bản đề xuất cho người dùng duyệt.** Sang Step 3 khi có "ok".
- [ ] **Step 3: Viết JSON** theo bản đã duyệt vào `weapons.json` (cùng khuôn với `w_xich_diem_thuong`: `text`, `card`, `hooks`, `signatureHooks`, `refinement` đúng 4 mục).
- [ ] **Step 4: Kiểm**
  - `pnpm --filter data test` → kiểm chéo sẵn có xanh (id duy nhất, `signatureHeroId` có thật, lá hợp lệ ở mọi cấp, `refinement` 4 mục).
  - Thêm test tạm (không commit) trong `packages/rules/test/`: với mỗi vũ khí mới, tạo trận có Hero bản mệnh mang nó ở R1 và R5 (`loadout.heroes[id] = { constellation: 0, levelUpForm: "base", weaponId, refinement }`), rồi cho bot chơi hết một trận. Yêu cầu: không lỗi và lá Binh Khí được đánh ít nhất 1 lần trên 10 seed.
- [ ] **Step 5: `pnpm test` + `pnpm typecheck` xanh; T213 xanh.**
- [ ] **Step 6: Commit** — `git commit -m "Step 7d.3: fifteen signature weapons"`

---

### Task 5: 8 Nguyệt Bảo mới + banner (bước 7d.4)

**Files:** `packages/data/relics.json`, `packages/data/banners.json`, `packages/data/test/load-game-data.test.ts`, `docs/03-prototype-content.md`

**Interfaces:**
- Produces: 8 `RelicDef` mới (id `r_<tên_snake_case>`, `resonance` đúng 5 cấp); `banner_weapons.pool` có đủ 25 vũ khí, `banner_relics.pool` có đủ 16 Nguyệt Bảo.

- [ ] **Step 1: Soạn bản đề xuất** vào `docs/03-prototype-content.md` (chưa sửa JSON): 8 Nguyệt Bảo, mỗi món gồm tên, độ hiếm, hiệu ứng Cộng Minh 1–5 (modifier / hook).
  - Ưu tiên lối chơi mới: Linh Thú, Mê Hoặc, Phong Ấn, Hộ Vệ, Chọn Pha / Đổi Vận.
  - Tính cả 8 món cũ: mỗi Viện (Thanh Loan, Huyền Vũ, Bạch Lộ, Xích Diên) có ít nhất 1 Nguyệt Bảo phục vụ từ khóa của Viện đó. Ghi rõ món nào thuộc Viện nào trong bảng đề xuất.
  - Phân bố độ hiếm đề xuất: 2 Legendary, 3 Epic, 3 Rare.
  - Chỉ dùng `MoonModifier` và hook trigger đã có. Nếu Nguyệt Luân mới đã làm: **không** dùng modifier chỉ dành cho Nguyệt Lệnh (`DECREE_ONLY_MODIFIERS`).
  - Kèm đề xuất thứ tự trong `banner_weapons` / `banner_relics` (theo khuôn `pool` hiện có của `banners.json`).
- [ ] **Step 2: DỪNG — gửi duyệt.**
- [ ] **Step 3: Test T313 (đỏ)** — thêm vào `packages/data/test/load-game-data.test.ts`:

```ts
  it("T313: 25 weapons with one signature weapon per hero at the hero's rarity; 16 relics; banners list every item", () => {
    const data = loadGameData();
    expect(Object.keys(data.weapons)).toHaveLength(25);
    expect(Object.keys(data.relics)).toHaveLength(16);
    for (const hero of Object.values(data.heroes)) {
      const signature = Object.values(data.weapons).filter((weapon) => weapon.signatureHeroId === hero.id);
      expect(signature, hero.id).toHaveLength(1);
      expect(signature[0]!.rarity, hero.id).toBe(hero.rarity === "common" ? "rare" : hero.rarity);
    }
    const pooled = (bannerId: string) => new Set(Object.values(data.banners[bannerId]!.pool).flat());
    expect(pooled("banner_weapons")).toEqual(new Set(Object.keys(data.weapons)));
    expect(pooled("banner_relics")).toEqual(new Set(Object.keys(data.relics)));
    // Every item sits in the pool row of its own rarity.
    for (const [rarity, ids] of Object.entries(data.banners["banner_weapons"]!.pool)) {
      for (const id of ids) expect(data.weapons[id]!.rarity, id).toBe(rarity);
    }
    for (const [rarity, ids] of Object.entries(data.banners["banner_relics"]!.pool)) {
      for (const id of ids) expect(data.relics[id]!.rarity, id).toBe(rarity);
    }
  });
```
  `pool` là `Record<Rarity, string[]>` (`banners.json`). Dùng cách nạp dữ liệu mà file test đang dùng (`loadGameData`).
- [ ] **Step 4: Chạy — đỏ** (mới có 8 Nguyệt Bảo; banner chưa có vũ khí mới).
- [ ] **Step 5: Viết JSON:**
  - `relics.json`: thêm 8 món.
  - `banners.json`: thêm 15 vũ khí (Task 4) và 8 Nguyệt Bảo vào `pool` đúng hạng độ hiếm.
  - `pvp-config.freeWeaponIds` / `freeRelicIds` giữ nguyên (spec §5.3; xem lại ở Task 7).
- [ ] **Step 6: Chạy — xanh.** `pnpm --filter data test`, `pnpm test`, `pnpm typecheck`.
  - Test gacha / kinh tế cũ nào cố định kết quả quay theo seed sẽ đổi vì pool lớn hơn (rủi ro đã ghi ở `18` §9). Cập nhật kỳ vọng của **đúng** những test đó, không đụng test khác.
  - T213 không dùng gacha nên phải xanh.
- [ ] **Step 7: Commit** — `git commit -m "Step 7d.4: eight moon relics, banners (T313)"`

---

### Task 6: Client — nút Nâng Cấp (bước 7d.5)

**Files:** `apps/client/src/scenes/armory-scene.ts`, `apps/client/src/ui/theme.ts`, `apps/client/src/scenes/run-scene.ts`

**Interfaces:**
- Consumes: `upgradeCost` (rules), route Task 3, `mutate` / `errorText` (`account.ts`), `addButton` / `addText` (`ui/widgets.ts`), `session.profile`.

- [ ] **Step 1: `theme.ts`** — thêm vào `API_ERROR_TEXT`: `"not owned": "Chưa sở hữu vật phẩm này"`, `maxed: "Đã đạt cấp tối đa"`, `"not enough": "Không đủ vật liệu"`.
- [ ] **Step 2: `ArmoryScene`** — trong `renderWeapon(id)` và `renderRelic(id)`, dưới phần mô tả cấp hiện tại:
  - **Tính:** `level = this.level(id)`, `cost = level !== undefined ? upgradeCost(session.data, kind, id, level) : null`, `have = session.profile.currencies[kind === "weapon" ? "darkIron" : "moonDust"]`.
  - **Dòng chữ:**
    - Khi `cost !== null`: `Nâng Cấp → <R|Cộng Minh> ${level + 1} · giá ${cost} ${vật liệu} · đang có ${have}`. Tên vật liệu là "Huyền Thiết" / "Nguyệt Trần".
    - Khi max: `Đã đạt cấp tối đa`.
    - Khi chưa sở hữu: không hiện gì.
  - **Nút:** `addButton(this, this.root, x, y, 180, "Nâng Cấp", onClick, enabled)` với `enabled = session.online && cost !== null && have >= cost && !this.busy`.
  - **`onClick`:** đặt `this.busy = true`, gọi `await mutate("POST", \`/profile/${kind === "weapon" ? "weapons" : "relics"}/${id}/upgrade\`)` (`mutate` tự cập nhật `session.profile` / `session.rev`), rồi `this.render()`. Lỗi → `showToast(this, [errorText(error)])`. Cuối cùng đặt `this.busy = false`.
  - Thêm trường `private busy = false;` và đặt lại trong `create()`.
- [ ] **Step 3: Hiện Huyền Thiết thưởng Lượt chơi** — trong `RunScene`, nơi hiện `session.lastRewards.moonJade` sau khi nộp: thêm `+${rewards.darkIron} Huyền Thiết` khi `> 0`.
- [ ] **Step 4: Kiểm tay trên trình duyệt** (`pnpm dev`):
  - Tài khoản có 1 vũ khí và đủ Huyền Thiết (sửa hồ sơ dev bằng SQL, hoặc thắng lượt chơi) → bấm Nâng Cấp: cấp tăng, vật liệu giảm, mô tả đổi sang cấp mới.
  - Thiếu vật liệu → nút tắt. Cấp 5 → chữ "Đã đạt cấp tối đa".
  - Chụp màn hình.
- [ ] **Step 5: `pnpm test` + `pnpm typecheck` xanh.**
- [ ] **Step 6: Commit** — `git commit -m "Step 7d.5: armory upgrade button, dark iron in run rewards"`

---

### Task 7: Mô phỏng trang bị + kinh tế, chỉnh số, đóng GĐ 7 (bước 7d.6)

**Files:** `packages/rules/test/run-playtest.test.ts`, `packages/rules/test/economy-sim.ts`, `packages/rules/test/economy-sim.test.ts`, `packages/data/{weapons,relics,economy-config,story}.json` (chỉ số), `docs/playtest-notes.md`, `docs/18-phase7-spec.md`, `docs/07-implementation-plan.md`, `CLAUDE.md`

- [ ] **Step 1: Mô phỏng trang bị**
  - Lệnh: `PLAYTEST_GEAR=1 PLAYTEST_SEEDS=80 pnpm --filter rules exec vitest run test/run-playtest.test.ts`.
  - Test trang bị hiện đo mỗi món trên 4 đội cũ. Mở rộng `measure` để vũ khí bản mệnh mới được đo trên **đội có Hero bản mệnh**: dùng các đội trong `TEAMS` chứa Hero đó, Hero bản mệnh mang vũ khí và bỏ lá cuối của người mang như quy ước 4e.
  - Mốc so sánh là cùng đội không trang bị.
  - Ghi bảng R1 / R5 cho 15 vũ khí và 8 Nguyệt Bảo mới.
- [ ] **Step 2: Mô phỏng kinh tế** — trong `economy-sim.ts`:
  - Người chơi ảo nhận Huyền Thiết từ Lượt chơi (đã có qua `applyRunRewards`) và từ Cốt truyện: mỗi ngày chơi 1 màn chưa qua cho tới hết 16 màn, cộng `firstClear` qua `applyStoryResult` với `won = true`.
  - Mỗi ngày gọi `upgradeItem` lặp trên vũ khí độ hiếm cao nhất đang có cho tới khi hết vật liệu.
  - Ghi: ngày một vũ khí Epic đạt R5 và ngày một vũ khí Legendary đạt R5 (trung vị, p90), tính riêng phần đến **từ vật liệu** (bỏ bản trùng gacha bằng cách không quay banner vũ khí trong biến thể đo này).
  - Ghi tổng Nguyệt Ngọc từ Cốt truyện so với tổng thu 60 ngày.
  - `economy-sim.test.ts` in thêm các dòng này.
- [ ] **Step 3: So mục tiêu `18` §5.5:**
  - Không món mới nào tăng tỉ lệ thắng lượt > 10 điểm ở R1.
  - Epic R1 → R5 trong ~3–4 tuần, Legendary ~6–8 tuần.
  - Nguyệt Ngọc Cốt truyện không làm lệch nhịp quay 4d quá 15%.

  Soạn "gói chỉnh đề xuất": chỉ gồm số của trang bị, `upgradeCost`, `runRewards.darkIron*`, `firstClear`. Xem lại `pvp-config.freeWeaponIds` / `freeRelicIds` nếu PvP sim (`PLAYTEST_PVP=1`, lượt có trang bị) lệch. **DỪNG — gửi duyệt**, áp, đo lại.
- [ ] **Step 4: `docs/playtest-notes.md`** mục "Phase 7d": phương pháp, bảng trang bị R1 / R5, bảng kinh tế trước / sau, gói chỉnh, điểm mở.
- [ ] **Step 5: Đóng 7d và GĐ 7:**
  - `18`: "Trạng thái: 7d xong — GĐ 7 hoàn thành" và kiểm lại điều kiện "Hoàn thành GĐ 7 khi…" (§8). Mục nào chưa đạt thì ghi vào điểm mở.
  - Cập nhật `07` và `CLAUDE.md` ("Giai đoạn hiện tại").
- [ ] **Step 6: `pnpm test` + `pnpm typecheck` xanh; T213 xanh.**
- [ ] **Step 7: Commit** — `git commit -m "Close phase 7d: gear and economy sims, tuning"`

---

## Self-review (đã chạy khi viết plan)

- **Độ phủ spec §5:**
  - 5.1 `upgradeItem` + `upgradeCost` + route → Task 2, 3.
  - 5.2 Huyền Thiết từ Lượt chơi → Task 2 (Cốt truyện đã có từ 7c; Nguyệt Trần giữ nguồn cũ).
  - 5.3 nội dung + banner → Task 4, 5.
  - 5.4 client → Task 6.
  - 5.5 mô phỏng → Task 7.
  - §6 test T308–T313 → Task 2 (T308–T310, T312), Task 3 (T311), Task 5 (T313).
  - §8 bước 7d.1–7d.6 → Task 1–7.
- **Điểm dừng hỏi người dùng:** Task 4 Step 2 (vũ khí), Task 5 Step 2 (Nguyệt Bảo), Task 7 Step 3 (gói chỉnh).
- **Tên thống nhất:** `upgradeCost(data, kind, id, level)`, `upgradeItem(data, profile, kind, id)`, `UpgradeKind`, `RunRewards.darkIron`, `runRewards.darkIronWin` / `darkIronLoss` / `darkIronLossMinFloor`, `economyConfig.upgradeCost`.
