# M03 Team Liên Hoàn Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đưa redesign đã đo (§4.5 của spec) vào `packages/data` — payoff `m03` theo `cardsPlayedThisTurn` + sustain `f09_tao_duoc` — kèm text tiếng Việt khớp hiệu ứng, tái tạo golden records, và verify lại bằng playtest pipeline.

**Architecture:** Thay đổi thuần dữ liệu (`cards.json`); mọi `Effect` type đã có trong schema — không sửa `packages/rules`. Cơ chế đo đã tồn tại: `scaledDamage per:"cardsPlayedThisTurn"` đếm lá đánh trước trong lượt (counter tăng sau khi effects resolve, `apply-action.ts:181`).

**Tech Stack:** TypeScript, pnpm workspaces, zod (`packages/data`), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-12-m03-team-redesign.md`

## Global Constraints

- Chỉ sửa `packages/data/cards.json` (+ golden JSON tái tạo). **Không** đổi `packages/rules`, `apps/*`.
- Chỉ dùng `Effect` type đã có: `scaledDamage` với `per: "cardsPlayedThisTurn"` (schema.ts đã có trong `damageScaleSchema`).
- Text lá bài tiếng Việt phải khớp số trong effects — kể cả số trần `max` nằm trong text.
- Out of scope (spec refuted/không đo được): §4.1 `alliesRegen` weld, `f09_linh_ke` thêm payoff, §4.3 (không có thay đổi data — AI preference).
- `m03_tham_bao_plus` **giữ nguyên** (Chiêm Bài-only — đã là ammo lien_hoan tốt, quyết định chủ đích).
- Locked cards m03 (`tich_thuy`, `kim_dau`, `tu_tin`, `than_toan`, `diem_tin`, `tien_tri`) **giữ nguyên** — khảo sát xác nhận không lá nào mang `scaledDamage`, không có gì để nâng; chúng giữ vai trò ramp/ammo.
- Evidence probe là `synthetic`; ghi nhãn đúng trong mọi report/spec.

## Review Focus

1. **Payoff lá đầu lượt = 0 damage** — `tham_bao`/`mau_dich` mới không có `base`; đánh đầu lượt ra 0 damage (vẫn được Chiêm Bài + đếm cho payoff sau). Đây là thiết kế combo-only; Task 2 pin bằng test.
2. **`m03_kim_tien` giữ `per: "moonPower"`** — chỉ nâng `max` 12→16; text chỉ đổi số trần, **không** viết lại theo mẫu lien_hoan.
3. **Golden regen lan rộng** — `GOLDEN_RECORD=1` ghi lại toàn bộ records; chỉ records chứa 4 lá đổi được phép lệch. Task 5 có bước diff-review bắt buộc: record nào không chứa m03/f09 mà hash đổi = dừng, điều tra.
4. **Server starter/economy** — starter profiles dùng hero m05/f04/m06, pool playtest resolve `starterDeck` lúc load → tự nhất quán; không cần migration.
5. **`docs/18-content-spec.md`** chỉ mô tả kit ở mức hero (đã kiểm tra — không pin số lá) → không cần sửa; nếu reviewer thấy mô tả branch "Nguyệt Lực" loạt thì cập nhật spec doc riêng, không sửa `18` theo rule "đọc, không sửa trừ khi được yêu cầu".

---

### Task 1: Snapshot baseline + failing behavior test

**Files:**
- Create (generated): `output/playtest/pre-redesign-data/` (copy of `packages/data`)
- Modify: `packages/rules/test/hero-cards.test.ts` (thêm test sau T276f)

**Interfaces:**
- Produces: test T277 mới `m03 lien-hoan payoffs scale with cards played this turn` — Task 2 phải làm nó xanh.
- Consumes: `makeTestCombat`, `takeCards`, `playCardState`, `p0` (đã import sẵn trong file).

- [ ] **Step 1: Snapshot dữ liệu hiện tại làm baseline so sánh sau này**

```bash
mkdir -p output/playtest/pre-redesign-data
cp packages/data/*.json output/playtest/pre-redesign-data/
ls output/playtest/pre-redesign-data/*.json | wc -l   # expect 24
```

- [ ] **Step 2: Viết test fail — `tham_bao` scale theo lá đã đánh (không phải moonPower)**

Thêm sau `T276f` (sau dòng ~221):

```ts
it("T277: M03 Thám Báo scales with cards played this turn (liên hoàn)", () => {
    const played: string[] = [];
    const { data, state } = makeTestCombat({
      heroIds: ["m03", "f04", "m06"],
      setup: (s) => {
        p0(s).moonPower = 0;
        played.push(...takeCards(s, "m03_tieu_loi", 2), ...takeCards(s, "m03_tham_bao", 1));
      },
    });
    let current = state;
    for (const instanceId of played.slice(0, 2)) {
      current = playCardState(data, current, instanceId, undefined);
    }
    const targetId = current.enemies.find((e) => e.alive)!.id;
    const before = current.enemies.find((e) => e.id === targetId)!.hp;
    current = playCardState(data, current, played[2]!, targetId);
    const pending = p0(current).pendingChoice;
    if (pending?.kind === "chooseCard") {
      const picked = applyAction(data, current, { type: "chooseCard", instanceId: pending.options[0] as string });
      if (!picked.ok) throw new Error(picked.error);
      current = picked.state;
    }
    // State is immutable — re-find the enemy in the new state before asserting.
    const after = current.enemies.find((e) => e.id === targetId)!.hp;
    // 2 cheap cards before it → 2 × amount(2) = 4 damage. Old per:moonPower at mp 0 dealt 0.
    expect(before - after).toBe(4);
  });
```

(`playCardState` trả `CombatState` trực tiếp — khớp cách dùng của T276f ngay phía trên. `applyAction`/`p0`/`takeCards`/`makeTestCombat` đã import sẵn trong file.)

- [ ] **Step 3: Chạy test — phải FAIL**

```bash
pnpm --filter rules exec vitest run test/hero-cards.test.ts -t T277
```

Expected: FAIL — `before - target.hp` = 0 (per moonPower, mp=0).

- [ ] **Step 4: Commit test**

```bash
git add packages/rules/test/hero-cards.test.ts
git commit -m "test: T277 pin m03 lien-hoan payoff scaling on cardsPlayedThisTurn"
```

---

### Task 2: `cards.json` — payoff liên hoàn (tham_bao + mau_dich)

**Files:**
- Modify: `packages/data/cards.json` (elements `m03_tham_bao`, `m03_mau_dich`)

**Interfaces:**
- Produces: hiệu ứng + text mới của 2 lá — Task 4–6 phụ thuộc.

- [ ] **Step 1: Đổi `m03_tham_bao`**

```jsonc
// effects[0] trước:
{ "type": "scaledDamage", "per": "moonPower", "amount": 1, "max": 6, "to": "chosen" }
// sau:
{ "type": "scaledDamage", "per": "cardsPlayedThisTurn", "amount": 2, "max": 9, "to": "chosen" }
// effects[1] chooseCard look 2 — giữ nguyên
```

```jsonc
// text trước:
"Gây 1 damage cho mỗi Nguyệt Lực đang có (tối đa 6). Chiêm Bài 2."
// text sau:
"Gây 2 damage cho mỗi lá đã đánh trước đó trong lượt (tối đa 9). Chiêm Bài 2."
```

- [ ] **Step 2: Đổi `m03_mau_dich`**

```jsonc
// effects[0] gainMoonPower amount 2 — giữ nguyên (ammo + ramp phụ)
// effects[1] trước:
{ "type": "scaledDamage", "per": "moonPower", "amount": 1, "max": 6, "to": "allEnemies" }
// sau:
{ "type": "scaledDamage", "per": "cardsPlayedThisTurn", "amount": 2, "max": 9, "to": "allEnemies" }
// effects[2] chooseCard look 1 — giữ nguyên
```

```jsonc
// text trước:
"Nhận 2 Nguyệt Lực, rồi gây 1 damage lên mọi kẻ địch cho mỗi Nguyệt Lực đang có (tối đa 6). Chiêm Bài 1."
// text sau:
"Nhận 2 Nguyệt Lực, rồi gây 2 damage lên mọi kẻ địch cho mỗi lá đã đánh trước đó trong lượt (tối đa 9). Chiêm Bài 1."
```

- [ ] **Step 3: Schema validation + test mới xanh**

```bash
pnpm --filter data test
pnpm --filter rules exec vitest run test/hero-cards.test.ts -t "T277|T276f"
```

Expected: `parseGameData` pass; T277 PASS; T276f PASS (chỉ assert levelUp counter, không đụng damage).

- [ ] **Step 4: Commit**

```bash
git add packages/data/cards.json
git commit -m "data: m03 tham_bao/mau_dich payoffs scale on cardsPlayedThisTurn (lien hoan redesign)"
```

---

### Task 3: `cards.json` — `m03_kim_tien` max 12→16 (giữ moonPower)

**Files:**
- Modify: `packages/data/cards.json` (element `m03_kim_tien`)

**Interfaces:**
- Produces: payoff moonPower giữ nguyên trục — đa dạng payoff theo spec §4.5.

- [ ] **Step 1: Đổi `effects[1].max` 12→16 + text số trần**

```jsonc
// effects[1] trước:
{ "type": "scaledDamage", "per": "moonPower", "amount": 2, "max": 12, "to": "chosen" }
// sau (chỉ đổi max):
{ "type": "scaledDamage", "per": "moonPower", "amount": 2, "max": 16, "to": "chosen" }
```

```jsonc
// text trước:
"Nhận 1 Nguyệt Lực, rồi gây 2 damage cho mỗi Nguyệt Lực đang có (tối đa 12)."
// text sau:
"Nhận 1 Nguyệt Lực, rồi gây 2 damage cho mỗi Nguyệt Lực đang có (tối đa 16)."
```

- [ ] **Step 2: Validate**

```bash
pnpm --filter data test
```

- [ ] **Step 3: Commit**

```bash
git add packages/data/cards.json
git commit -m "data: m03 kim_tien payoff cap 12 -> 16 (keeps moonPower scaler)"
```

---

### Task 4: `cards.json` — `f09_tao_duoc` regen 2→3

**Files:**
- Modify: `packages/data/cards.json` (element `f09_tao_duoc`)

**Interfaces:**
- Produces: sustain lever đã đo +3.1pp trong exp2.

- [ ] **Step 1: Đổi `effects[0].amount` 2→3 + text**

```jsonc
// effects[0] trước:
{ "type": "applyStatus", "status": "regen", "amount": 2, "to": "chosen" }
// sau:
{ "type": "applyStatus", "status": "regen", "amount": 3, "to": "chosen" }
```

```jsonc
// text trước:
"Hồi Phục 2. Hồi 2 HP."
// text sau:
"Hồi Phục 3. Hồi 2 HP."
```

(`Hồi Phục` = regen trong glossary — kiểm tra `docs/04-glossary.md` nếu nghi ngờ.)

- [ ] **Step 2: Validate**

```bash
pnpm --filter data test
```

- [ ] **Step 3: Commit**

```bash
git add packages/data/cards.json
git commit -m "data: f09 tao_duoc regen 2 -> 3"
```

---

### Task 5: Tái tạo golden records + diff review

**Files:**
- Modify (generated): `packages/rules/test/golden/combats.json`, `packages/rules/test/golden/runs.json`, có thể `packages/rules/test/golden/tickets/*.json`

**Interfaces:**
- Produces: golden suite xanh trở lại với data mới — bắt buộc trước khi merge.

- [ ] **Step 1: Regen**

```bash
cd packages/rules && GOLDEN_RECORD=1 pnpm exec vitest run test/golden.test.ts && cd ../..
```

(Windows bash: `GOLDEN_RECORD=1` prefix hoạt động trong Git Bash; nếu chạy PowerShell thì `$env:GOLDEN_RECORD="1"; pnpm exec vitest run test/golden.test.ts`.)

- [ ] **Step 2: Diff review — bắt buộc, không bỏ qua**

```bash
git diff packages/rules/test/golden/combats.json | python -c "
import sys, json
# đếm record label nào đổi — chỉ cho phép record có m03/f09 trong setup
" 
# đơn giản hơn: git diff --stat, rồi kiểm tra từng record đổi có chứa m03/f09 cards không
git diff packages/rules/test/golden/runs.json | wc -l
```

Expected: chỉ các record dùng `m03`/`f09` (3 combats + 3 runs đã đếm được trong khảo sát) đổi events/hash. **Nếu record nào không chứa 4 lá bị đổi → DỪNG, điều tra leak trước khi tiếp.**

- [ ] **Step 3: Golden suite xanh**

```bash
pnpm --filter rules exec vitest run test/golden.test.ts
```

Expected: toàn bộ PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/rules/test/golden/
git commit -m "test: regenerate golden records for m03 lien-hoan redesign"
```

---

### Task 6: Verify post-merge — production mới vs snapshot cũ

**Files:**
- Create (generated): `output/playtest/post-redesign/{base,cand,report}/`
- Dùng: `output/playtest/m03-exp/sim-config.json` (64 blocks pve, pool m03-vs-f06, profiles ramp)

**Interfaces:**
- Consumes: `output/playtest/pre-redesign-data/` từ Task 1; CLI `pnpm playtest`.

- [ ] **Step 1: Baseline run với data cũ**

```bash
pnpm playtest --command simulate --config output/playtest/m03-exp/sim-config.json --output output/playtest/post-redesign/base --data output/playtest/pre-redesign-data
```

- [ ] **Step 2: Candidate run với production mới (không --data = loadGameData)**

```bash
pnpm playtest --command simulate --config output/playtest/m03-exp/sim-config.json --output output/playtest/post-redesign/cand
```

- [ ] **Step 3: Report — kỳ vọng m03 delta dương ~+9-19pp, f06 ~0**

```bash
pnpm playtest --command report --base output/playtest/post-redesign/base --candidate output/playtest/post-redesign/cand --output output/playtest/post-redesign/report
```

Expected: `delta` dương; per-team breakdown (python đã dùng ở các exp trước) cho thấy `m03+f09+m08` ↑ và `f06+m09+f03` ≈ 0. Status có thể `insufficient-data` (64 < 128) — chấp nhận, đây là smoke verify chứ không phải confirm stage.

- [ ] **Step 4: Ghi kết quả vào verification.md**

Append section `## post-merge verification` vào `output/playtest/m03-exp/verification.md` với delta/số liệu đo được.

---

### Task 7: Cập nhật spec + full verification

**Files:**
- Modify: `docs/superpowers/specs/2026-10-12-m03-team-redesign.md` (status header)

- [ ] **Step 1: Cập nhật status spec**

```markdown
**Trạng thái:** §4.5 đã triển khai vào `packages/data` (YYYY-MM-DD) — post-merge verify recorded; confirm 2000 blocks + corpus người thật còn treo.
```

- [ ] **Step 2: Full suite**

```bash
pnpm test
pnpm typecheck
```

Expected: toàn bộ xanh (server có thể có flake T245 rate-limit — rerun riêng nếu gặp).

- [ ] **Step 3: Commit cuối**

```bash
git add docs/superpowers/specs/2026-10-12-m03-team-redesign.md
git commit -m "docs: mark m03 lien-hoan redesign implemented"
```
