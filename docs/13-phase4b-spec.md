# 13 — Đặc tả Giai đoạn 4b (Pool lá, Tu Luyện, xếp deck)

Đặc tả cho giai đoạn 4b: **pool 12 lá mỗi Hero (6 miễn phí + 6 khóa), bộ từ khóa
mới, Tu Luyện mở khóa, nhiều deck đặt tên 18 lá, hồ sơ lưu lâu dài**. Vẫn offline.

Thiết kế được chốt qua brainstorming (2026-09-25). Khi đưa vào tài liệu luật
(bước 4b.1): luật từ khóa vào `01`, luật hồ sơ / Tu Luyện / deck vào tài liệu mới
`14-meta-rules.md`, schema vào `02`, thuật ngữ vào `04`, test vào `06`, bước vào
`07`. Khi có khác biệt, `01`/`14` là chuẩn; tài liệu này giữ bối cảnh và lý do.

**Điều kiện trước:** GĐ 4a (`12-phase4a-spec.md`) đã xong — thang cost 0–8, giữ
tay, `copies`, Chiêm Bài, địch dùng Nguyệt Lực.

**Trạng thái:** thiết kế đã duyệt, chưa đưa vào tài liệu luật.

---

## 0. Phạm vi

**Có:** 7 từ khóa mới (§2); 60 lá Hero (16 mới, 1 bỏ, ~25 sửa) + sửa 1 lá Song
Hành (§3); `keywords.json`; hồ sơ + Tu Luyện 6 cấp, tự chọn lá mở (§4); nhiều deck
đặt tên, luật deck 18 lá, Bộ cơ bản (§5); lượt chơi / trận lẻ dùng deck đã chọn,
pool lá thưởng 12 lá/Hero (§5); client: chọn deck, xếp deck, Tu Luyện, XP cuối
lượt chơi, hiển thị từ khóa (§6); mô phỏng + chỉnh số (§8).

**Không có (để sau):** gacha / Tinh Hồn (chỉ chừa chỗ: một hàm cộng lượt mở); sở
hữu Hero (cả 5 Hero có sẵn); Binh Khí; PvP; lưu đám mây; làm lại hệ thống thăng
cấp Hero.

**Nguyên tắc thiết kế lá:**
- Mỗi Hero có **hai nhánh**, mỗi nhánh 6 lá: 3 miễn phí + 3 khóa.
- Mỗi lá có ít nhất một **điểm quyết định**: thời điểm (Tích Tụ, Liên Hoàn, HP,
  Huyết Nguyệt, Ẩn Thân, Đóng Băng), mục tiêu (Tỏa Nguyệt, kết liễu, Đánh Dấu),
  hoặc nhịp nhánh (rải Hồi Phục → Tụ Dược).
- Lá khóa là **lối chơi khác, không mạnh hơn** (GDD §7.1).
- Đường cong 12 lá ≈ 2 lá cost 0–1, 4 lá 2–3, 4 lá 4–5, 2 lá 6–8; bộ miễn phí có
  ≥ 2 lá cost ≤ 3. `copies` khởi điểm: cost 0–1 → 3, 2–4 → 2, 5+ → 1.
- Số liệu là khởi điểm; chốt ở bước 4b.7.

---

## 1. Kiến trúc

| Chỗ | Thay đổi |
|---|---|
| `packages/data/meta-config.json` (mới) | Mốc XP, công thức XP, luật deck, giới hạn deck |
| `packages/data/keywords.json` (mới) | Giải thích từ khóa cho người chơi |
| `packages/data/{cards,heroes}.json` + schema | 60 lá, `keywords`, `lockedCardIds` |
| `rules/src/effects.ts`, `queries.ts`, `turn.ts`, `apply-action.ts`, `draw.ts` | 7 từ khóa |
| `rules/src/meta/` (mới) | `profile.ts` (hồ sơ, Tu Luyện), `deck.ts` (luật deck, thao tác deck) |
| `rules/src/run/run.ts` | `RunSetup.deckCardIds`, pool lá thưởng, `heroLevelUps` |
| `apps/client/src/profile-store.ts` (mới) | Đọc / lưu hồ sơ `localStorage` |
| `apps/client/src/scenes/{deck-select,deck-builder,mastery}-scene.ts` (mới) | Màn mới |
| `apps/client/src/scenes/{team-select,run,combat}-scene.ts`, `session.ts`, `debug.ts` | Luồng mới, hiển thị từ khóa |

`rules` vẫn thuần: hồ sơ là dữ liệu vào/ra của hàm thuần; chỉ client chạm
`localStorage`. `createRun` không đọc hồ sơ — chỉ nhận danh sách lá.

---

## 2. Từ khóa mới (luật trận)

### 2.1 Kiểu

```ts
type Condition =
  | /* ...cũ */
  | { type: "heldTurnsAtLeast"; turns: number }            // Tích Tụ
  | { type: "cardsPlayedThisTurnAtLeast"; count: number }; // Liên Hoàn

type Effect =
  | /* ...cũ */
  | { type: "heal"; amount: number; to: TargetRef; overflow?: "armor" }            // Dư Sinh
  | { type: "drainMoonPower"; amount: number; to: TargetRef; steal?: true }       // Tỏa / Đoạt Nguyệt
  | { type: "gainMoonPowerPerTurn"; amount: number }                              // Dưỡng Nguyệt
  | { type: "missingHpDamage"; ratio: number; to: TargetRef; hits?: number }      // Phẫn Huyết
  | { type: "burstRegen"; multiplier: number; to: TargetRef };                    // Tụ Dược

interface CardInstance { /* ...cũ */ heldTurns: number; }
interface CombatState { /* ...cũ */ cardsPlayedThisTurn: number; moonPowerBonus: number; }
```

Event mới: `{ type: "intentsCancelled"; enemyId: string; intentIds: string[] }`.
`EffectContext` thêm `instanceId?: string` (lá đang đánh) để đọc `heldTurns`.

### 2.2 Luật

**Tích Tụ** (`heldTurnsAtLeast`):
- `heldTurns = 0` mỗi khi bản lá **vào tay**: rút bù, Chiêm Bài, lá thay trong Đổi Bài.
- Cuối lượt người chơi, **sau** bước bỏ Tàn Chiêu: mọi lá còn trên tay `heldTurns += 1`.
- Điều kiện đọc `heldTurns` của lá đang đánh (`ctx.instanceId`); ngoài lá bài → false.

**Liên Hoàn** (`cardsPlayedThisTurnAtLeast`):
- `cardsPlayedThisTurn = 0` đầu lượt người chơi.
- `+= 1` ở **cuối** việc đánh một lá (sau hook `cardPlayed`) — lá đang đánh không tự đếm.

**Tỏa Nguyệt / Đoạt Nguyệt** (`drainMoonPower`), với mỗi kẻ địch còn sống trong `to`:
1. `drained = min(amount, enemy.moonPower)`; `enemy.moonPower -= drained`.
2. Trong khi tổng `cost` của `plannedIntents` > `enemy.moonPower`: bỏ chiêu **cuối**
   chuỗi. Các chiêu bị bỏ → một event `intentsCancelled` (theo thứ tự bị bỏ).
   Chiêu override (cost 0) không bao giờ làm tổng vượt quỹ nên chỉ bị bỏ khi mọi
   chiêu sau nó đã bị bỏ — thực tế không bao giờ.
3. `enemy.moonReserve = min(moonReserveMax, enemy.moonPower − tổng cost còn lại)`;
   `moonReserveChanged` nếu đổi.
4. `steal: true`: `state.moonPower += drained` (tổng các địch) → `moonPowerChanged`.
- Không tiêu RNG. Địch bị Đóng Băng vẫn bị rút bình thường.

**Dưỡng Nguyệt** (`gainMoonPowerPerTurn`): `state.moonPowerBonus += amount`. Đầu
lượt người chơi (`12` §3.4 bước 6): `moonPower = base + moonReserve + moonPowerBonus`.
Không có trần; cộng dồn.

**Phẫn Huyết** (`missingHpDamage`): mỗi hit, damage gốc
`floor((source.maxHp − source.hp) × ratio)` tính **lúc hit**, rồi qua công thức
damage bình thường (`01` §10.1: Sức Mạnh, Cường Hóa, Đánh Dấu, nội tại, pha trăng,
Suy Yếu, Dễ Vỡ). Được dùng trong chiêu địch.

**Dư Sinh** (`heal.overflow: "armor"`): `raw = floor(amount × hệ số hồi)`,
`healed = min(maxHp − hp, raw)`, `overflow = raw − healed`; nếu `overflow > 0`:
mục tiêu nhận `floor(overflow × hệ số giáp)` giáp (`armorGained`).

**Tụ Dược** (`burstRegen`): với mỗi mục tiêu có Hồi Phục `v`: hồi
`floor(v × multiplier × hệ số hồi)` (không Dư Sinh), rồi gỡ Hồi Phục
(`statusRemoved`). Không có Hồi Phục → không tác dụng.

### 2.3 Ràng buộc schema

- `heldTurnsAtLeast`, `cardsPlayedThisTurnAtLeast`, `drainMoonPower`,
  `gainMoonPowerPerTurn`, `burstRegen`, `heal.overflow`: chỉ trên **lá bài**, không
  trong chiêu địch hay hook Kỳ Vật.
- `missingHpDamage`: lá bài và chiêu địch; không trong hook Kỳ Vật.
- `drainMoonPower.to` chỉ `chosen` (lá `target: "enemy"`) hoặc `allEnemies`.
- `CardDef.keywords?: string[]` — mỗi id phải có trong `keywords.json`.

### 2.4 `keywords.json`

`{ id, name, text }[]`: 7 từ khóa mới — 8 mục vì Tỏa Nguyệt và Đoạt Nguyệt tách riêng (`tich_tu`, `lien_hoan`, `toa_nguyet`,
`doat_nguyet`, `duong_nguyet`, `phan_huyet`, `du_sinh`, `tu_duoc`) + `chiem_bai` +
các trạng thái đã có (Ẩn Thân, Khiêu Khích, Suy Yếu, Dễ Vỡ, Đánh Dấu, Thiêu Đốt,
Hồi Phục, Sức Mạnh, Cường Hóa, Đóng Băng, Phản Đòn) + Huyết Nguyệt. Chữ tiếng
Việt, một câu mỗi mục. Client hiện khi di chuột lên lá.

---

## 3. Nội dung

### 3.1 Hero

`heroes.json`: `cardIds` = 6 lá miễn phí; `rewardCardIds` → **`lockedCardIds`** (6
lá). Pool của Hero = `cardIds + lockedCardIds` (12, không trùng, cùng `ownerId`).

Ký hiệu cột **Đích**: `—` = `target: "none"`, `E` = kẻ địch, `A` = đồng minh.
Nhãn: Giữ / Sửa (giữ id, đổi cơ chế) / Mới. Hiệu ứng viết theo effect: "HT≥n" =
`heldTurnsAtLeast n`, "LH≥n" = `cardsPlayedThisTurnAtLeast n`.

### 3.2 M05 Hoắc Liệt — *Huyết Chiến* (HC) · *Thiết Vệ* (TV)

| id | Tên | Nhánh | Mở | Nhãn | Cost·Bản | Đích | Tag | Hiệu ứng |
|---|---|---|---|---|---|---|---|---|
| `m05_tran_bac_huyet_tinh` | Trấn Bắc Huyết Tính | HC | Miễn phí | Giữ | 0·3 | — | | Mất 3 HP; Cường Hóa 4 bản thân |
| `m05_thuong_pha` | Thương Phá | — | Miễn phí | Sửa (số) | 1·3 | E | attack | Xóa giáp mục tiêu; 3 damage |
| `m05_ho_gam` | Hổ Gầm | TV | Miễn phí | Giữ | 2·2 | — | control, ward | Khiêu Khích 1; giáp 5 |
| `m05_bat_khuat` | Bất Khuất | HC | Miễn phí | Sửa | 3·2 | — | heal | HP < 50%: hồi 10 + Sức Mạnh 1; ngược lại hồi 4 |
| `m05_liet_hoa_xung_phong` | Liệt Hỏa Xung Phong | HC | Miễn phí | Giữ | 4·2 | E | attack | 8 damage; HP < 50%: 12 |
| `m05_bat_dong_nhu_son` | Bất Động Như Sơn | TV | Miễn phí | Giữ | 4·2 | — | ward | Giáp 10; Phản Đòn 3 |
| `m05_huyet_chien` | Huyết Chiến | HC | Khóa | Sửa | 2·2 | E | attack | Phẫn Huyết 0.5 |
| `m05_thiet_bich` | Thiết Bích | TV | Khóa | Sửa | 3·2 | — | ward | Mọi Hero giáp 4; HT≥1: 7 |
| `m05_no_hoa_lien_hoan` | Nộ Hỏa Liên Hoàn | HC | Khóa | Sửa | 5·1 | E | attack | 3 damage ×3; LH≥2: ×5 |
| `m05_lo_luyen` | Lò Luyện | HC | Khóa | Mới | 5·1 | E | attack | 8 damage; HT≥1: 14; HT≥2: 20 |
| `m05_huyet_thuan` | Huyết Thuẫn | TV | Khóa | Mới | 6·1 | — | heal, ward | Hồi 8 (Dư Sinh); Khiêu Khích 1; Phản Đòn 4 |
| `m05_liet_hoa_phan_thien` | Liệt Hỏa Phần Thiên | HC | Khóa | Mới | 8·1 | — | attack | Mất 6 HP; Phẫn Huyết 1.0 lên mọi kẻ địch |

### 3.3 F04 Ôn Như Ý — *Bách Thảo* (BT) · *Tĩnh Tâm* (TT)

| id | Tên | Nhánh | Mở | Nhãn | Cost·Bản | Đích | Tag | Hiệu ứng |
|---|---|---|---|---|---|---|---|---|
| `f04_bach_thao_huong` | Bách Thảo Hương | BT | Miễn phí | Sửa | 2·2 | A | heal, harmony | Hồi Phục 3; mục tiêu đã có Hồi Phục: 5 |
| `f04_linh_chi_ho_the` | Linh Chi Hộ Thể | BT | Miễn phí | Sửa | 2·2 | A | heal | Tụ Dược ×1; giáp 4 |
| `f04_hoi_xuan_tan` | Hồi Xuân Tán | BT | Miễn phí | Sửa | 4·2 | — | heal, harmony | Mọi Hero Hồi Phục 2; HT≥1: 4 |
| `f04_thao_duoc` | Thảo Dược | TT | Miễn phí | Sửa | 2·2 | A | heal, harmony | Hồi 5 (Dư Sinh) |
| `f04_tinh_tam_tra` | Tịnh Tâm Trà | TT | Miễn phí | Sửa | 3·2 | A | heal, harmony | Giải trừ; hồi 3 (Dư Sinh); Chiêm Bài 2 |
| `f04_nguyet_quang_dan` | Nguyệt Quang Dẫn | TT | Miễn phí | Giữ | 4·2 | — | moon | Trăng tiến 1 pha; Chiêm Bài 3 |
| `f04_xuan_phong` | Xuân Phong | BT | Khóa | Mới | 1·3 | A | heal, harmony | Hồi Phục 2 lên mục tiêu; LH≥2: lên mọi Hero |
| `f04_thanh_tam_chu` | Thanh Tâm Chú | BT | Khóa | Sửa | 4·2 | — | harmony | Giải trừ mọi Hero; mọi Hero Hồi Phục 1; Chiêm Bài 3 |
| `f04_bach_hoa_tu_duoc` | Bách Hoa Tụ Dược | BT | Khóa | Mới | 6·1 | — | heal, harmony | Tụ Dược ×2 lên mọi Hero |
| `f04_bang_tam_quyet` | Băng Tâm Quyết | TT | Khóa | Sửa | 2·2 | E | control, harmony | Suy Yếu 2; Tỏa Nguyệt 1 |
| `f04_nguyet_lo` | Nguyệt Lộ | TT | Khóa | Sửa | 4·1 | A | heal, moon | Dưỡng Nguyệt 1; hồi 3 |
| `f04_tinh_tam_quyet` | Tĩnh Tâm Quyết | TT | Khóa | Mới | 6·1 | — | heal, harmony | Mọi Hero hồi 5 (Dư Sinh); giải trừ mọi Hero |

### 3.4 M06 Tô Dạ — *Ẩn Sát* (ẨS) · *Liên Hoàn* (LH)

| id | Tên | Nhánh | Mở | Nhãn | Cost·Bản | Đích | Tag | Hiệu ứng |
|---|---|---|---|---|---|---|---|---|
| `m06_anh_bo` | Ảnh Bộ | ẨS | Miễn phí | Sửa | 1·3 | — | assassin | Ẩn Thân 1; Cường Hóa 2 |
| `m06_am_tien` | Ám Tiễn | ẨS | Miễn phí | Giữ | 2·2 | E | attack, assassin | 6 damage; đang Ẩn Thân: 10 |
| `m06_doat_menh` | Đoạt Mệnh | ẨS | Miễn phí | Giữ | 4·2 | E | attack, assassin | 7 damage; mục tiêu HP ≤ 30%: 20 |
| `m06_phi_tieu` | Phi Tiêu | LH | Miễn phí | Mới | 0·3 | E | attack | 2 damage; LH≥2: 2 ×2 |
| `m06_nguyet_anh_an` | Nguyệt Ảnh Ấn | LH | Miễn phí | Giữ | 2·2 | E | control | Đánh Dấu 2 |
| `m06_song_nhan_loan_vu` | Song Nhận Loạn Vũ | LH | Miễn phí | Sửa | 3·2 | — | attack, assassin | 3 damage mọi kẻ địch; LH≥2: 6 |
| `m06_tang_anh_thich` | Tàng Ảnh Thích | ẨS | Khóa | Giữ | 2·2 | E | attack, assassin | 4 damage; đang Ẩn Thân: 4 ×3 |
| `m06_anh_phan_than` | Ảnh Phân Thân | ẨS | Khóa | Sửa | 4·2 | E | assassin | Ẩn Thân 2; Tỏa Nguyệt 2 |
| `m06_tuyet_menh` | Tuyệt Mệnh | ẨS | Khóa | Sửa | 6·1 | E | attack, assassin | 12 damage; HT≥2: 30 |
| `m06_doc_tieu` | Độc Tiêu | LH | Khóa | Sửa | 2·2 | E | control | Dễ Vỡ 2; LH≥2: thêm Đánh Dấu 2 |
| `m06_anh_toc` | Ảnh Tốc | LH | Khóa | Mới | 2·2 | — | assassin | +2 Nguyệt Lực; LH≥3: +4 |
| `m06_loan_anh` | Loạn Ảnh | LH | Khóa | Mới | 5·1 | E | attack, assassin | 2 damage ×2; LH≥2: ×4; LH≥4: ×6 |

### 3.5 F03 Tần Sương — *Băng Phong* (BP) · *Hàn Kiếm* (HK)

| id | Tên | Nhánh | Mở | Nhãn | Cost·Bản | Đích | Tag | Hiệu ứng |
|---|---|---|---|---|---|---|---|---|
| `f03_han_an` | Hàn Ấn | BP | Miễn phí | Giữ | 2·2 | E | control | Đóng Băng 1 |
| `f03_phong_tuyet_chuong` | Phong Tuyết Chướng | BP | Miễn phí | Sửa | 4·2 | — | ward | Mọi Hero giáp 4; Tỏa Nguyệt 1 mọi kẻ địch |
| `f03_tuyet_vu` | Tuyết Vũ | BP | Miễn phí | Sửa | 4·2 | — | attack | 3 damage mọi kẻ địch; Tỏa Nguyệt 1 mọi kẻ địch |
| `f03_suong_tram` | Sương Trảm | HK | Miễn phí | Giữ | 2·2 | E | attack | 5 damage; mục tiêu Đóng Băng: 8 |
| `f03_bang_phach_lien_kich` | Băng Phách Liên Kích | HK | Miễn phí | Sửa | 4·2 | E | attack | 3 damage ×2; HT≥1: ×4 |
| `f03_tuyet_han` | Tuyệt Hàn | HK | Miễn phí | Sửa | 5·1 | E | attack | 9 damage; HT≥1: Đóng Băng mục tiêu |
| `f03_bang_cham` | Băng Châm | BP | Khóa | Mới | 1·3 | E | attack | 2 damage; Tỏa Nguyệt 1 |
| `f03_han_khi_nhap_mach` | Hàn Khí Nhập Mạch | BP | Khóa | Mới | 2·2 | E | control | Tỏa Nguyệt 3 |
| `f03_vinh_dong` | Vĩnh Đông | BP | Khóa | Mới | 8·1 | — | control | Đóng Băng mọi kẻ địch; Tỏa Nguyệt 2 mọi kẻ địch |
| `f03_han_phong` | Hàn Phong | HK | Khóa | Sửa | 2·2 | E | control | Dễ Vỡ 2 lên mục tiêu; HT≥1: lên mọi kẻ địch |
| `f03_bang_toai` | Băng Toái | HK | Khóa | Sửa | 5·1 | E | attack | Mục tiêu Đóng Băng: 18 damage + giải trừ mục tiêu (phá băng); ngược lại 6 |
| `f03_han_son_nhat_kiem` | Hàn Sơn Nhất Kiếm | HK | Khóa | Mới | 7·1 | E | attack | 10 damage; HT≥1: 18; HT≥2: 26 + Đóng Băng |

`f03_suong_giap` **bị bỏ** (trùng Phong Tuyết Chướng).

### 3.6 F02 Diệp Linh Lung — *Thiên Diện* (TD) · *Huyết Nguyệt* (HN)

| id | Tên | Nhánh | Mở | Nhãn | Cost·Bản | Đích | Tag | Hiệu ứng |
|---|---|---|---|---|---|---|---|---|
| `f02_dien_doat` | Diện Đoạt | TD | Miễn phí | Sửa | 2·2 | E | scheme | Cướp 1 buff; Đoạt Nguyệt 1 |
| `f02_anh_tap` | Ảnh Tập | TD | Miễn phí | Giữ | 2·2 | E | attack, assassin | Cướp 1 buff; 6 damage; HP < 50%: 10 |
| `f02_dien_cu` | Diện Cụ | TD | Miễn phí | Sửa | 3·2 | E | scheme | Đoạt Nguyệt 2; Chiêm Bài 2 |
| `f02_huyet_tram` | Huyết Trâm | HN | Miễn phí | Sửa | 2·2 | E | attack, forbidden | Huyết Nguyệt: 9 damage; ngược lại mất 2 HP + 9 damage |
| `f02_doi_van_chu` | Đổi Vận Chú | HN | Miễn phí | Giữ | 4·2 | — | moon | Huyết Nguyệt 2; trăng tiến 1 pha |
| `f02_phe_hon` | Phệ Hồn | HN | Miễn phí | Giữ | 6·1 | E | attack, forbidden | Chỉ khi Huyết Nguyệt. Mất 3 HP; 16 damage |
| `f02_vong_nguyet_thu` | Vọng Nguyệt Thủ | TD | Khóa | Mới | 1·3 | E | scheme | Đoạt Nguyệt 1; LH≥2: Đoạt Nguyệt 3 |
| `f02_thien_dien` | Thiên Diện | TD | Khóa | Mới | 4·2 | E | scheme | Cướp 1 buff; HT≥1: cướp 3 |
| `f02_doat_hon_thich` | Đoạt Hồn Thích | TD | Khóa | Sửa | 5·1 | E | attack, scheme | Cướp 2 buff; Đoạt Nguyệt 2; 6 damage |
| `f02_huyet_khe` | Huyết Khế | HN | Khóa | Giữ | 0·2 | — | forbidden | Mất 3 HP; +4 Nguyệt Lực |
| `f02_ta_nguyet_chu` | Tà Nguyệt Chú | HN | Khóa | Giữ | 0·2 | — | forbidden, moon | Mất 4 HP; Huyết Nguyệt 1 |
| `f02_huyet_nguyet_than_cong` | Huyết Nguyệt Thần Công | HN | Khóa | Mới | 7·1 | — | attack, forbidden | Chỉ khi Huyết Nguyệt. Mất 4 HP; 5 damage ×2 mọi kẻ địch; Huyết Nguyệt ≥ 3 vòng |

### 3.7 Lá Song Hành

| id | Nhãn | Hiệu ứng |
|---|---|---|
| `bond_bang_hoa_tranh_phong` (M05+F03) | Giữ | 8 damage + Đóng Băng; mục tiêu Đóng Băng: 14 |
| `bond_anh_dau` (M06+F02) | Sửa | F02: cướp 1 buff + Đoạt Nguyệt 1; M06: Ẩn Thân 1 |
| `bond_tuyet_trung_tong_than` (F03+F04) | Giữ | F03 Đóng Băng 1 kẻ địch; F04 Hồi Phục 2 |

### 3.8 Ghi chú nội dung

- Bộ miễn phí đổi so với 4a: M06 Phi Tiêu thay Tàng Ảnh Thích; F02 Diện Cụ thay
  Huyết Khế. Bộ cơ bản (18 lá) mọi đội vẫn đánh được từ vòng 1.
- `text` của mọi lá viết lại theo bảng, dùng đúng tên từ khóa; `keywords` liệt kê
  id từ khóa dùng trên lá.
- Tổng: 60 lá Hero (16 mới, `f03_suong_giap` bỏ) + 3 Song Hành = 63 lá.

---

## 4. Hồ sơ và Tu Luyện

### 4.1 `meta-config.json`

```json
{
  "masteryLevels": [30, 110, 230, 390, 590, 830],
  "masteryXp": { "perFloor": 10, "win": 50, "heroLevelUp": 10 },
  "deckSize": 18,
  "minCardsPerHero": 4,
  "maxDecks": 30
}
```

`masteryLevels`: XP cộng dồn cho cấp 1…6; độ dài phải bằng số lá khóa mỗi Hero (6),
tăng dần.

### 4.2 Kiểu

```ts
interface Profile {
  version: 1;
  heroes: Record<string, { xp: number; unlockedCardIds: string[] }>;
  decks: SavedDeck[];
}

interface RunResult {
  heroIds: [string, string, string];
  floorReached: number;
  won: boolean;
  heroLevelUps: Record<string, number>; // defId → số trận Hero thăng cấp
}
```

`RunState` thêm `heroLevelUps: Record<string, number>`: khi một trận trong lượt
chơi kết thúc (thắng hoặc thua), cộng số event `heroLeveledUp` của trận đó theo
Hero (`heroId` "hero:m05" → "m05").

### 4.3 Hàm (`rules/src/meta/profile.ts`)

| Hàm | Luật |
|---|---|
| `createProfile(data)` | Mọi Hero `{ xp: 0, unlockedCardIds: [] }`, `decks: []` |
| `masteryLevel(data, xp)` | Số mốc `masteryLevels` ≤ `xp` (0–6) |
| `pendingUnlocks(data, profile, heroId)` | `masteryLevel − unlockedCardIds.length` (≥ 0) |
| `summarizeRun(data, run)` | Chỉ khi `run.status` là `won`/`lost`; `floorReached` = tầng của `position` (0 nếu chưa vào nút nào) |
| `applyRunResult(data, profile, result)` | Mỗi Hero trong đội: `xp += perFloor × floorReached + (won ? win : 0) + heroLevelUp × heroLevelUps[id]`. Trả `{ profile, gains: { heroId, xp, levelBefore, levelAfter }[] }`; không sửa input |
| `unlockCard(data, profile, heroId, cardId)` | Lỗi: `"not a locked card"` (không thuộc `lockedCardIds`), `"already unlocked"`, `"no pending unlock"`. Hợp lệ → thêm vào `unlockedCardIds` |
| `parseProfile(data, raw)` | §4.4 |

Chỉ lượt chơi cho XP; trận lẻ và lượt chơi bỏ ngang không cho.

### 4.4 `parseProfile`

- Không phải object / thiếu trường / sai kiểu → `{ profile: createProfile(data), reset: true }`.
- `version` khác 1 → hàm chuyển đổi (hiện không có bản nào khác 1 → coi như hỏng).
- Hero không có trong data → bỏ; Hero trong data mà hồ sơ thiếu → thêm `{ xp: 0, unlockedCardIds: [] }`.
- `unlockedCardIds` không thuộc `lockedCardIds` của Hero → bỏ (lượt mở tự quay
  lại vì được tính ra).
- Deck: giữ nguyên (kể cả không hợp lệ); chỉ bỏ deck sai kiểu cơ bản (thiếu `id`,
  `name`, `heroIds` 3 phần tử, `cardIds` mảng chuỗi).

---

## 5. Deck

### 5.1 Kiểu và luật (`rules/src/meta/deck.ts`)

```ts
interface SavedDeck {
  id: string;                        // "d1", "d2", …
  name: string;                      // 1–24 ký tự sau khi trim
  heroIds: [string, string, string]; // thứ tự = vị trí trong đội
  cardIds: string[];
}

type DeckError =
  | { code: "badHeroes" }                          // không đủ 3 Hero khác nhau có trong data
  | { code: "wrongSize"; size: number }            // ≠ deckSize
  | { code: "duplicateCard"; cardId: string }
  | { code: "foreignCard"; cardId: string }        // không thuộc 3 Hero / lá Song Hành / không tồn tại
  | { code: "tooFewForHero"; heroId: string; count: number }
  | { code: "lockedCard"; cardId: string };        // chưa mở (không miễn phí, không trong unlockedCardIds)
```

`validateDeck(data, profile, deck): DeckError[]` — kiểm tra mọi luật, trả mọi lỗi
theo thứ tự trên (rỗng = hợp lệ).

### 5.2 Hàm

| Hàm | Luật |
|---|---|
| `starterDeck(data, heroIds)` | "Bộ cơ bản": `cardIds` miễn phí của 3 Hero theo thứ tự đội; không lưu trong hồ sơ |
| `saveDeck(data, profile, draft)` | `draft.id` rỗng → deck mới, `id = "d" + (số lớn nhất hiện có + 1)`; có `id` → ghi đè. Lỗi: `"invalid name"`, `"too many decks"` (khi tạo mới lúc đã có `maxDecks`), `"unknown deck"` (ghi đè `id` không có). Deck không hợp lệ **vẫn lưu được** |
| `deleteDeck(profile, deckId)` | Lỗi `"unknown deck"` |

### 5.3 Lượt chơi và trận lẻ

- `RunSetup` thêm `deckCardIds: string[]` (bắt buộc). `createRun` ném lỗi nếu một
  lá không tồn tại hoặc không thuộc đội (như `createCombat`); `run.deck = deckCardIds`.
- Client chỉ vào trận với deck có `validateDeck` rỗng (Bộ cơ bản luôn hợp lệ).
- Trận lẻ: `CombatSetup.deckCardIds` sẵn có.
- **Lá thưởng:** pool = `cardIds + lockedCardIds` của 3 Hero, trừ lá đã có trong
  `run.deck`; lá khóa lấy được chỉ dùng trong lượt đó, không mở khóa.
- Nghỉ Chân / `minDeckSize` như cũ; deck trong lượt chơi được vượt 18 lá.

---

## 6. Client

**Luồng:** Chọn đội → Chọn deck → (Lượt chơi | Trận lẻ | Xếp deck); Chọn đội →
Tu Luyện; cuối lượt chơi → XP → (Tu Luyện).

| Màn | Nội dung |
|---|---|
| Chọn đội (`team-select-scene.ts`) | Như cũ; nút "Tiếp" → Chọn deck; nút "Tu Luyện" (chấm vàng khi có Hero còn lượt mở) |
| Chọn deck (`deck-select-scene.ts`, mới) | Bộ cơ bản + deck của bộ 3 Hero này; mỗi dòng: tên, cost TB, ✓ / ⚠ + lỗi đầu tiên. Nút: Lượt chơi, Trận lẻ (chỉ khi hợp lệ), Sửa, Sao chép, Xóa, Deck mới. Bộ cơ bản: chỉ Chơi + Sao chép |
| Xếp deck (`deck-builder-scene.ts`, mới) | 3 cột Hero × 12 lá thu nhỏ theo nhánh (vạch chia nhánh); lá trong deck viền sáng, lá khóa mờ + 🔒; bấm để thêm/bỏ. Thanh: `Deck n/18`, số lá mỗi Hero (đỏ < 4), tổng số bản trong chồng, biểu đồ cost 0–8. Di chuột: lá lớn + giải thích từ khóa. Tên: `window.prompt`. Nút Lưu (luôn được), Hủy. Lỗi `DeckError` → câu tiếng Việt |
| Tu Luyện (`mastery-scene.ts`, mới) | 5 Hero: thanh XP, cấp n/6, "Còn k lượt mở"; chọn Hero → 6 lá khóa (✓ đã mở); bấm lá + xác nhận → `unlockCard` |
| Kết thúc lượt chơi (`run-scene.ts`) | XP từng Hero + "Lên cấp Tu Luyện n!"; nút "Mở lá ngay" khi có lượt mở |
| Trận (`combat-scene.ts`) | Nhãn "Tích Tụ n" trên lá; "Liên Hoàn n" cạnh Nguyệt Lực; "+n/lượt" khi có Dưỡng Nguyệt; `intentsCancelled`: chiêu gạch khỏi chuỗi + mờ dần; di chuột lên lá trên tay: giải thích từ khóa |

**`profile-store.ts`:** `loadProfile()` đọc khóa `vong-nguyet.profile`, chạy
`parseProfile`; `reset: true` → chép chuỗi cũ sang `vong-nguyet.profile.bak`.
`saveProfile(profile)` bọc `try/catch` (localStorage có thể bị chặn → cảnh báo "Không
lưu được tiến trình", game vẫn chạy). Lưu ngay sau: mở lá, lưu/xóa deck, kết thúc
lượt chơi (`applyRunResult`). `session` thêm `profile`, `deckCardIds`; `startRun`
nhận deck.

**Debug (`~`):** "+100 XP cho đội", "Mở hết lá", "Xóa hồ sơ" — gọi hàm `rules`.

---

## 7. Test

Mã mới từ **T149**. Test luật dùng fixture cố định.

| Mã | Kịch bản |
|---|---|
| T149 | Tích Tụ: `heldTurns` = 0 khi vào tay (rút, Chiêm Bài, Đổi Bài), +1 cuối lượt sau bỏ Tàn Chiêu; ngưỡng đổi hiệu ứng |
| T150 | Liên Hoàn: = 0 đầu lượt, +1 sau hook `cardPlayed`; lá đang đánh không tự đếm |
| T151 | Tỏa Nguyệt: quỹ địch giảm (không âm), bỏ chiêu cuối chuỗi tới khi vừa, override còn, Dự Trữ tính lại, `intentsCancelled` |
| T152 | Đoạt Nguyệt: người chơi nhận đúng tổng thực rút |
| T153 | Dưỡng Nguyệt: +n từ lượt sau, cộng dồn, vượt trần |
| T154 | Phẫn Huyết: gốc = floor(HP mất × ratio) lúc hit, qua Sức Mạnh / Suy Yếu / Dễ Vỡ; dùng được trong chiêu địch |
| T155 | Dư Sinh: phần dư thành giáp × hệ số giáp pha trăng |
| T156 | Tụ Dược: hồi = Hồi Phục × hệ số × hệ số hồi, gỡ Hồi Phục; không có Hồi Phục → không gì |
| T157 | Schema: ràng buộc §2.3; `keywords` trỏ id có thật |
| T158 | Data: 6 miễn phí + 6 khóa/Hero, không trùng, đúng chủ; ≥ 2 lá miễn phí cost ≤ 3; `copies` 1–3; `meta-config` hợp lệ (`masteryLevels` tăng dần, dài 6) |
| T159 | `createProfile`; `masteryLevel` tại và quanh mỗi mốc |
| T160 | `applyRunResult`: công thức XP, `levelBefore/After`, không sửa input |
| T161 | `unlockCard`: hợp lệ; 3 lỗi |
| T162 | `parseProfile`: hỏng → mới + `reset`; Hero / lá lạ bị bỏ; lượt mở quay lại; deck không hợp lệ được giữ |
| T163 | `summarizeRun` + `RunState.heroLevelUps` đếm đúng qua nhiều trận |
| T164 | `validateDeck`: từng mã lỗi |
| T165 | `starterDeck` hợp lệ cho cả 10 bộ 3 Hero với hồ sơ mới |
| T166 | `saveDeck` / `deleteDeck`: cấp id, tên, `maxDecks`, lưu nháp, `unknown deck` |
| T167 | `createRun` dùng `deckCardIds`, từ chối lá ngoài đội |
| T168 | Pool lá thưởng = 12 lá/Hero trừ deck, có lá khóa, không rỗng với Bộ cơ bản |

---

## 8. Mô phỏng (bước 4b.7)

**Heuristic thêm (trên heuristic 4a):** giữ lá Tích Tụ tới ngưỡng cao nhất của nó
(trừ khi tay 6 lá và không lá nào khác đánh được); đánh lá không có Liên Hoàn trước,
lá có Liên Hoàn sau; Tỏa Nguyệt / Đoạt Nguyệt nhắm địch có tổng cost chuỗi cao nhất;
Tụ Dược khi mục tiêu có Hồi Phục ≥ 3; hồi / Dư Sinh nhắm Hero thấp % HP nhất.

**Deck so sánh:** Bộ cơ bản; deck theo nhánh (mỗi Hero dồn một nhánh; chia 4/4/10,
6/6/6, 8/5/5); deck ngẫu nhiên hợp lệ (mọi lá đã mở, seed cố định).

**Mục tiêu:**

| Mục tiêu | Ngưỡng |
|---|---|
| Lá khóa là lối chơi khác | Không deck nhánh nào thắng lượt chơi hơn Bộ cơ bản > +15 điểm %, hay kém > −15 điểm % |
| Mục tiêu GĐ 4a | Trận thường / Tinh Anh 8–12 vòng; Cạn Bài < 10% trận; kẹt tay < 10% lượt |
| Mọi lá mới | Được đánh ≥ 1 lần trong mô phỏng |
| Nhịp Tu Luyện | Số lượt TB tới cấp 6 (từ XP mô phỏng) trong 8–12 |

Chỉnh bằng ablation; mọi thay đổi data qua người dùng duyệt. Ghi vào
`playtest-notes.md` mục "Phase 4b".

---

## 9. Tài liệu cần cập nhật (bước 4b.1)

- `01-combat-rules.md`: §4.1 `heldTurns`; §5.2 Liên Hoàn; §10 Phẫn Huyết, Dư Sinh,
  Tụ Dược; §9 Tỏa / Đoạt Nguyệt (hủy chiêu); §3.1 Dưỡng Nguyệt.
- `14-meta-rules.md` (mới): §4 và §5 của tài liệu này.
- `02-data-schema.md`: kiểu §2.1, `CardDef.keywords`, `HeroDef.lockedCardIds`,
  `meta-config`, `keywords.json`, `Profile`, `SavedDeck`, `RunSetup.deckCardIds`.
- `04-glossary.md`: Tích Tụ, Liên Hoàn, Tỏa Nguyệt, Đoạt Nguyệt, Dưỡng Nguyệt,
  Phẫn Huyết, Dư Sinh, Tụ Dược, Tu Luyện (`mastery`), Bộ cơ bản (`starterDeck`),
  lá khóa (`lockedCardIds`).
- `06-test-scenarios.md`: T149–T168.
- `07-implementation-plan.md`: mục Giai đoạn 4b.
- `00-gdd.md` §7.1: Tinh Hồn 1/3 "mở 1 lá kỹ năng thay thế" → "mở ngay 1 lá khóa
  (không cần Tu Luyện)".

---

## 10. Kế hoạch bước

| Bước | Nội dung |
|---|---|
| 4b.1 | Tài liệu (§9) |
| 4b.2 | 7 từ khóa trong `rules` + schema ràng buộc + `keywords.json` (T149–T157) |
| 4b.3 | Nội dung: 60 lá + Song Hành, `heroes.json` (`lockedCardIds`), `text`/`keywords` (T158) |
| 4b.4 | Hồ sơ + Tu Luyện: `meta-config.json`, `profile.ts`, `RunState.heroLevelUps` (T159–T163) |
| 4b.5 | Deck: `deck.ts`, `RunSetup.deckCardIds`, pool lá thưởng (T164–T168) |
| 4b.6 | Client (§6) |
| 4b.7 | Mô phỏng + chỉnh số (qua duyệt) + `playtest-notes.md` |

Mỗi bước gom thay đổi luật cùng phần data phụ thuộc để `pnpm test` xanh sau từng
bước.
