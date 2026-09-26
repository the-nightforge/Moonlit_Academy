# Giai đoạn 4d (Tiền tệ, nhiệm vụ, gacha Hero, Tinh Hồn) — Implementation Plan

> Làm từng Task theo thứ tự; mỗi Task kết thúc bằng `pnpm test` + `pnpm typecheck` xanh
> và một commit. Steps dùng checkbox (`- [ ]`).

**Goal:** Người chơi kiếm Nguyệt Ngọc (lượt chơi, nhiệm vụ ngày/tuần, thành tựu, quà
tài khoản), quay banner Hero có bảo hiểm, sở hữu F02/F03, nâng Tinh Hồn 1–4, đổi
Nguyệt Tinh ở cửa hàng. Mọi thay đổi kho đồ chạy trên server bằng hàm thuần.

**Spec:** `docs/15-phase4-spec.md` §3 (đã chốt thêm 2026-09-28: Tinh Hồn 5 dời sang
4e; thành tựu Song Hành = 1 thành tựu mỗi lá Song Hành; quà tài khoản tự nhận khi
đăng ký hoặc đăng nhập nếu chưa nhận). Luật chuẩn: `14`, `16`, `01` sau bước 4d.1.

**Tech:** không thêm thư viện.

## Global Constraints

- Hàm meta thuần trong `packages/rules/src/meta/` nhận `now` (ms UTC) và `rngState`
  (số nguyên từ server) làm tham số; không `Date.now()` / `Math.random()`.
- Mọi hàm meta trả `{ ok: true; profile; ...kết quả } | { ok: false; error }` và không
  sửa input (clone như `profile.ts`).
- Server gọi hàm thuần trong `mutateProfile`; seed quay sinh bằng `random(4)`; nhật ký
  quay ghi seed + kết quả.
- Mã test T183–T196 (T195 = cấu trúc loadout + dạng thăng cấp khóa ở 4d; nội tại C5 là
  test của 4e).
- Test luật dùng fixture/data cố định; test gacha dùng seed cố định và pool fixture khi
  cần xác suất cực đoan.

---

## File Structure

| File | Trách nhiệm |
|---|---|
| `docs/{01,02,04,06,07,14,15,16}.md`, `CLAUDE.md` | Tài liệu (Task 1) |
| `packages/data/economy-config.json` | Quà, giá quay, thưởng lượt chơi, mốc reset, gacha, Nguyệt Tinh, cửa hàng |
| `packages/data/{missions,achievements,banners}.json` (mới) | Nhiệm vụ, thành tựu, banner |
| `packages/data/heroes.json` | `levelUp.constellationThreshold`, `signature { cardId, plusCard }` |
| `packages/data/src/{schema,load-game-data}.ts` | Schema + kiểm tra chéo |
| `packages/rules/src/meta/periods.ts` | `dayKey(now)`, `weekKey(now)` |
| `packages/rules/src/meta/economy.ts` | `grantStarterGift`, `applyRunRewards`, `recordProgress`, `claimMission`, `checkAchievements`, `buyShopItem` |
| `packages/rules/src/meta/gacha.ts` | `pull`, `pullMany`, `grantItem` (Hero / Tinh Hồn / Nguyệt Tinh) |
| `packages/rules/src/meta/loadout.ts` | `buildLoadout`; `createRun`/`createCombat` nhận `loadout` |
| `packages/rules/src/{create-combat,levelup,run/run}.ts` | C2 ngưỡng, C4 lá "+" |
| `apps/server/src/db.ts` | Migration 2: `runs.loadout_json`, bảng `pulls` |
| `apps/server/src/routes/{economy,gacha}.ts` | Route 4d |
| `apps/client/src/scenes/{gacha,heroes,missions}-scene.ts` | Màn mới |

---

### Task 1: Tài liệu (bước 4d.1)

- [ ] `14`: §5 Tiền tệ + quà + thưởng lượt chơi; §6 Kỳ ngày/tuần; §7 Nhiệm vụ; §8 Thành
      tựu; §9 Gacha; §10 Sở hữu Hero + Tinh Hồn; §11 Cửa hàng Nguyệt Tinh; §12 Loadout.
      `Profile` thêm `shop`.
- [ ] `01` §8: Tinh Hồn 2 (`constellationThreshold`; M06 đếm cả kẻ địch ngã do Phản Đòn);
      Tinh Hồn 4 (lá "+" thay lá chủ lực khi tạo lượt chơi / trận).
- [ ] `02`: schema `economy-config`, `missions`, `achievements`, `banners`, trường mới
      `heroes.json`, `Loadout`.
- [ ] `16`: route 4d, migration 2, quà khi đăng ký/đăng nhập, phản hồi quay.
- [ ] `04`, `06` (T183–T196), `07` (bước 4d.1–4d.6), `15` (C5 dời 4e, trạng thái),
      `CLAUDE.md` (giai đoạn 4d).
- [ ] Commit `Step 4d.1: rule docs for currency, missions, gacha and constellations`.

### Task 2: Kinh tế (bước 4d.2)

- [ ] Data: `economy-config.json` đầy đủ, `missions.json`, `achievements.json` + schema +
      kiểm tra chéo (id nhiệm vụ/thành tựu duy nhất, lá Song Hành tồn tại).
- [ ] `periods.ts`, `economy.ts`: quà, thưởng lượt chơi, tiến độ, nhận nhiệm vụ, thành
      tựu. T183, T184, T185.
- [ ] Server: quà khi đăng ký/đăng nhập; `/runs/:id/finish` gọi `applyRunRewards` sau
      `applyRunResult` (phiếu biết deck có phải Bộ cơ bản); `POST /missions/:id/claim`.
- [ ] Commit `Step 4d.2: moon jade, run rewards, missions and achievements`.

### Task 3: Gacha (bước 4d.3)

- [ ] Data: `banners.json` (banner Hero), `economy-config.gacha`, `dupeMoonStar` + schema.
- [ ] `gacha.ts` đúng thuật toán `14` §9; `grantItem` Hero mới / Tinh Hồn / Nguyệt Tinh.
      T186–T191.
- [ ] Server: migration 2 (`pulls`), `GET /gacha/banners`, `POST /gacha/:id/pull`,
      `GET /gacha/history`. T190 (transaction).
- [ ] Commit `Step 4d.3: hero banner with pity, dupes and pull history`.

### Task 4: Tinh Hồn và loadout (bước 4d.4)

- [ ] Data: `constellationThreshold`, `signature.plusCard` cho 5 Hero (bảng `15` §3.6).
- [ ] `loadout.ts` + `createRun`/`createCombat`/`replayRun` nhận `loadout`; C2, C4 trong
      trận; `bonusUnlocks` (C1/C3). T192, T193, T194, T195.
- [ ] Server: migration 2 thêm `runs.loadout_json`; phiếu chụp loadout.
- [ ] Cửa hàng Nguyệt Tinh `POST /shop/:id/buy`. T196.
- [ ] Commit `Step 4d.4: constellations, loadout snapshot and moon star shop`.

### Task 5: Client (bước 4d.5)

- [ ] Thanh tiền tệ (màn chọn deck); màn **Gacha** (banner, tỉ lệ công khai, bộ đếm bảo
      hiểm, quay 1/10, lật thẻ theo độ hiếm, nhật ký); **Kho Hero** (Tinh Hồn, lá "+");
      **Nhiệm vụ** (ngày/tuần/thành tựu, nhận); cửa hàng Nguyệt Tinh; thông báo quà.
- [ ] Chạy thử trên trình duyệt (Playwright): quà, quay, Hero mới dùng được trong deck.
- [ ] Commit `Step 4d.5: client gacha, heroes, missions and currencies`.

### Task 6: Mô phỏng kinh tế + chỉnh số (bước 4d.6)

- [ ] Script test: người chơi ảo 2 lượt/ngày + nhiệm vụ, 60 ngày × 200 seed → ngày đủ 5
      Hero, ngày có Legendary đầu, Tinh Hồn TB; thắng lượt theo Tinh Hồn 0/2/4.
- [ ] Mục tiêu `15` §8; gói chỉnh trình người dùng duyệt trước khi áp.
- [ ] `playtest-notes.md` mục 4d; commit.
