# Giai đoạn 4e (Binh Khí, Nguyệt Bảo, Tinh Luyện, Cộng Minh, Tinh Hồn 5) — Implementation Plan

> Làm từng Task theo thứ tự; mỗi Task kết thúc bằng `pnpm test` + `pnpm typecheck` xanh
> và một commit. Steps dùng checkbox (`- [ ]`).

**Goal:** Người chơi quay banner Binh Khí Các / Nguyệt Bảo Các, nâng Tinh Luyện / Cộng
Minh bằng bản trùng, gắn vũ khí cho từng Hero và 2 Nguyệt Bảo cho deck; lá Binh Khí và
nội tại chạy trong trận; Tinh Hồn 5 mở dạng thăng cấp thứ hai. Kho đồ chỉ đổi trên server.

**Spec:** `docs/15-phase4-spec.md` §4 (chốt 2026-09-29: người mang ngã → mọi nội tại vũ
khí dừng; lá Binh Khí ngoài `run.deck`; banner trang bị chung tỉ lệ, bảo hiểm riêng; mọi
Hero mang mọi vũ khí). Luật chuẩn: `01` §8, §14; `14` §3, §9, §10.1, §12–§13; `02` §1.12;
`03` §7; `16` §4.2.

**Tech:** không thêm thư viện.

## Global Constraints

- `packages/rules` thuần; hook vũ khí / Nguyệt Bảo dùng lại máy hook Kỳ Vật
  (`rules/src/relics.ts` hoặc nơi đang chạy `runRelicIds`), không viết máy thứ hai.
- Lá Binh Khí là `CardInstance` bình thường; tra định nghĩa lá qua một hàm chung
  (`cardDef(data, state, instanceId)`) để mọi luật lá (cost, tag, owner) tự áp dụng.
- Loadout mở rộng không phá dữ liệu cũ: trường mới đều tùy chọn (phiếu 4d vẫn chạy lại).
- Mã test T197–T212.

---

## File Structure

| File | Trách nhiệm |
|---|---|
| `docs/{01,02,03,04,06,07,14,15,16}.md`, `CLAUDE.md` | Tài liệu (Task 1) |
| `packages/data/{weapons,relics}.json` (mới) | 10 Binh Khí, 8 Nguyệt Bảo (`03` §7) |
| `packages/data/{heroes,banners,economy-config,meta-config}.json` | `altLevelUp`; 2 banner; `gearDupeMoonStar`; `maxRelics` |
| `packages/data/src/{schema,load-game-data}.ts` | Schema + kiểm tra chéo (T212) |
| `packages/rules/src/gear.ts` (mới) | `weaponAt`, `relicAt`, dựng lá Binh Khí |
| `packages/rules/src/{create-combat,relics,effects,levelup,cost}.ts` | Lá Binh Khí, hook `wearer`, thứ tự nguồn, `while`, nội tại dạng thứ hai |
| `packages/rules/src/meta/{deck,gacha,loadout,profile}.ts` | Deck có trang bị, `grantItem` trang bị, `buildLoadout(deck)`, `setLevelUpForm` |
| `apps/server/src/routes/{profile,runs}.ts` | Deck body, loadout từ deck, route dạng thăng cấp |
| `apps/client/src/scenes/*` | Kho đồ, xếp deck, banner, trận, Kho Hero |

---

### Task 1: Tài liệu (bước 4e.1)

- [ ] `01` §8 dạng thứ hai, §14; `02` §1.12; `03` §7 (bảng R1–R5, CM1–5); `04` trang bị;
      `06` T197–T212; `07` bước 4e; `14` §3, §9, §10.1, §12–§13; `16` §4.2; `15` trạng
      thái; `CLAUDE.md` giai đoạn 4e.
- [ ] Commit `Step 4e.1: rule docs for weapons, relics and the second level-up form`.

### Task 2: Dữ liệu (bước 4e.2)

- [ ] Schema `WeaponDef`, `RelicDef`, `altLevelUp`, passive mới, `while`, bộ lọc `wearer`.
- [ ] `weapons.json`, `relics.json` theo `03` §7; 2 banner; config mới.
- [ ] Kiểm tra khi nạp (T212); test data đếm số vũ khí / Nguyệt Bảo.
- [ ] Commit `Step 4e.2: weapon, relic and second level-up data`.

### Task 3: Luật trận trang bị (bước 4e.3)

- [ ] `weaponAt` / `relicAt` (T200); lá Binh Khí vào chồng rút (T198).
- [ ] Hook vũ khí: `wearer`, `owner`, `killer`, bản mệnh, người mang ngã (T199).
- [ ] Nguyệt Bảo: modifier + hook, `while: "bloodMoon"` (T201); thứ tự nguồn + event (T202).
- [ ] Commit `Step 4e.3: weapon cards, weapon passives and relics in combat`.

### Task 4: Dạng thăng cấp thứ hai (bước 4e.4)

- [ ] `levelUpForm` trong loadout chọn `altLevelUp`; `onLevelUp` (T206 phần trận).
- [ ] 5 nội tại (T207–T211).
- [ ] Commit `Step 4e.4: second level-up forms`.

### Task 5: Meta + server (bước 4e.5)

- [ ] `validateDeck` / `saveDeck` có trang bị (T197); `grantItem` trang bị + banner (T204).
- [ ] `buildLoadout(deck)`, lượt chơi dùng trang bị, `replayRun` (T203, T205).
- [ ] `setLevelUpForm` + `PUT /api/profile/heroes/:id/level-up-form` (T206); `POST /runs`
      dựng loadout từ deck; test server.
- [ ] Commit `Step 4e.5: gear ownership, decks, loadout and server routes`.

### Task 6: Client (bước 4e.6)

- [ ] **Kho đồ** (vũ khí / Nguyệt Bảo, cấp, lá Binh Khí và nội tại từng cấp); xếp deck: ô
      vũ khí mỗi Hero, 2 ô Nguyệt Bảo, bộ đếm 18 lá tính lá Binh Khí; banner trang bị trên
      màn Triệu Hồi; khung lá Binh Khí trong trận; animator hiện tên vũ khí / Nguyệt Bảo;
      Kho Hero chọn dạng thăng cấp khi Tinh Hồn ≥ 5.
- [ ] Chạy thử Playwright: quay trang bị, gắn vào deck, vào lượt chơi, thấy lá Binh Khí.
- [ ] Commit `Step 4e.6: client armory, gear slots and gear banners`.

### Task 7: Mô phỏng + chỉnh số (bước 4e.7)

- [ ] `run-playtest`: mỗi vũ khí, mỗi Nguyệt Bảo ở R1 và R5 trên Bộ cơ bản (−1 lá cho vũ
      khí); "lá chưa từng được đánh" gồm lá Binh Khí.
- [ ] Mục tiêu `15` §8: không món nào làm thắng lượt tăng > 10 điểm ở R1; gói chỉnh trình
      người dùng duyệt trước khi áp.
- [ ] `playtest-notes.md` mục 4e; commit.
