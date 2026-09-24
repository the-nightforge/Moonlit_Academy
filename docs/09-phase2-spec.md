# 09 — Đặc tả Giai đoạn 2 (Chiều sâu)

Đặc tả cho giai đoạn 2 theo `00-gdd.md` mục 12: **3 lá Song Hành, 4 từ khóa
phe, 1 boss, Huyết Nguyệt** (thăng cấp Hero đã làm ở bước 1.8). Vẫn offline,
không server.

Phản hồi từ `playtest-notes.md` được dùng để định hướng: trận cần "phải suy
nghĩ" hơn (focus-fire, canh pha, đọc ý định) — các cơ chế mới phải tăng số
quyết định có nghĩa mỗi lượt, không chỉ tăng số liệu.

**Trạng thái: đã duyệt (2026-09-24).** Luật đã đưa vào `01-combat-rules.md`
(các mục **[GĐ2]**), kiểu dữ liệu vào `02`, test vào `06` (T61–T94), các bước
vào `07`. Khi có khác biệt, **`01` là chuẩn**; tài liệu này giữ bối cảnh và lý do
thiết kế. Các điểm từng đánh dấu **[cần duyệt]** đã được duyệt (mục 11).

---

## 1. Từ khóa phe (4 keywords)

Mỗi từ khóa là **một tag trên lá bài**. Tag mới thêm vào `cardTagSchema`:
`scheme`, `ward`, `harmony` (`forbidden` đã có).

| Viện | Từ khóa | Tag | Cơ chế |
|---|---|---|---|
| Thanh Loan | Mưu Lược | `scheme` | Rút bài, giảm chi phí |
| Huyền Vũ | Hộ Thể | `ward` | Giáp + **Phản Đòn** (status mới `reflect`, mục 2.1) |
| Bạch Lộ | Điều Hòa | `harmony` | Hồi máu, `cleanse`, `freeze`/`weak` (làm chậm) |
| Xích Diên | Cấm Thuật | `forbidden` | Tự `loseHp` đổi hiệu ứng mạnh; lá mạnh nhất cần Huyết Nguyệt (mục 3) |

**Nguyên tắc:** từ khóa là tag, không phải luật riêng. Hiệu ứng cụ thể vẫn
nằm trong `effects` của từng lá; tag cho pha trăng / dữ liệu khác tham chiếu.

### 1.1 Gắn tag cho lá hiện có

| Lá | Tag thêm |
|---|---|
| `m05_ho_gam` (Hổ Gầm) | `ward` (giữ `control`) |
| `f04_thao_duoc`, `f04_bach_thao_huong`, `f04_tinh_tam_tra` | `harmony` (giữ `heal`) |

`scheme`: có trong schema và glossary nhưng **chưa có lá nào** — roster giai
đoạn 2 không có Hero Thanh Loan. Lá Mưu Lược thêm cùng Hero Thanh Loan đầu tiên.

### 1.2 Luật tham chiếu tag

| Tag | Tham chiếu | Cách làm |
|---|---|---|
| `ward` | 🌗 Hạ Huyền: chi phí **−1** (tối thiểu 0) | `costModifierForTag` trong `moon-phases.json` (đã có) |
| `harmony` | 🌕 Trăng Tròn: chi phí **−1** (tối thiểu 0) | như trên |
| `forbidden` | `requiresBloodMoon: true` chỉ hợp lệ trên lá có tag `forbidden` (mục 3) | kiểm tra khi nạp dữ liệu |
| `scheme` | chưa có | — |

Chỉ đổi dữ liệu, không thêm code. Hai pha này đã có hiệu ứng theo chủ đề
(giáp ×1.5, hồi máu ×2) nên không trái GDD "pha trung gian không có hiệu ứng chung".

---

## 2. Phản Đòn và effect mới

### 2.1 Status mới: `reflect` (Phản Đòn)

- **Loại:** buff (thêm vào danh sách buff ở `01` mục 6.3 → cướp được bằng
  `stealBuff`, không bị `cleanse` gỡ).
- **`value`** = số HP phản lại. **Khi áp thêm:** cộng giá trị.
- **Vòng đời:** bị gỡ **cùng lúc với giáp**, ở đầu lượt phe mình (Hero: `01`
  bước 3.1.1; kẻ địch: bước 9.3.1). **Không** thuộc `DURATION_STATUSES`.
  → Hero áp reflect trong lượt mình thì có tác dụng suốt lượt kẻ địch; kẻ địch
  áp trong lượt địch thì có tác dụng suốt lượt người chơi kế tiếp.
- **Kích hoạt:** mỗi **lượt damage** (mỗi hit, mỗi mục tiêu) có `final > 0`
  theo `01` mục 10.1 lên đơn vị có reflect — **kể cả khi giáp chặn hết**. Nguồn
  gây damage mất HP = `value` (như `loseHp`: bỏ qua giáp và mọi hệ số).
- **Không kích hoạt** bởi `loseHp`, Thiêu Đốt, Huyết Nguyệt, hay chính reflect
  (nên không có reflect-chồng-reflect).
- **Event:** ngay sau `damageDealt` của hit đó, phát
  `hpLost { targetId: <nguồn>, cause: "reflect" }`.
- **Nguồn ngã do reflect:** xử lý ngã ngay sau hit đó (`01` mục 10.4),
  `killerId` = đơn vị có reflect. **Không** tính `enemiesKilled` (không phải
  damage từ lá). Các hit còn lại và effect còn lại của lá/ý định **bị bỏ qua**;
  lá vẫn chuyển vào `discardPile`. Kiểm tra thắng/thua như thường.
- Hero mất HP do reflect: tính vào `damageTaken` (M05) như mọi lần mất HP.

### 2.2 Effect mới

| Effect | Nghĩa |
|---|---|
| `stealBuff { count }` | Chuyển tối đa `count` **buff** từ mục tiêu `chosen` sang đơn vị hành động, lấy theo thứ tự trong `statuses[]` của mục tiêu. Với mỗi buff: gỡ khỏi mục tiêu (`statusRemoved`), rồi áp cho đơn vị hành động với cùng `value` theo cột "Khi áp thêm" (**không** cộng thưởng Ẩn Thân của Trăng Non) → `statusApplied` với `value` sau khi gộp. Mục tiêu không có buff: không làm gì, không phát event. |
| `bloodMoon { rounds }` | `bloodMoonRounds = max(hiện tại, rounds)`. Nếu giá trị đổi: phát `bloodMoonChanged { rounds, cause: "card" }`. |

### 2.3 Điều kiện mới cho `conditional`

| Condition | Đúng khi |
|---|---|
| `bloodMoonActive` | `state.bloodMoonRounds > 0` |

---

## 3. Huyết Nguyệt

Hiện thực mục 7.4 của `01-combat-rules.md`, chi tiết hóa như sau:

- `bloodMoonRounds > 0` → Huyết Nguyệt **chồng lên** pha hiện tại (hai hiệu
  ứng cùng áp dụng). `bloodMoonRounds` đã có sẵn trong `CombatState`.
- **Đầu lượt người chơi** — bước mới 3.1.4, sau bước kích hoạt trạng thái
  (3.1.3), trước kiểm tra thắng/thua (3.1.5): nếu `bloodMoonRounds > 0`, từng Hero
  **còn sống** (vị trí 0 → 2) mất 2 HP (`hpLost`, cause `"bloodMoon"`); xử lý
  ngã và thăng cấp như tick Thiêu Đốt.
- **Cuối vòng** (`01` mục 9.4 bước 2, sau khi tiến pha, **trước** khi kẻ địch
  công bố ý định): nếu `bloodMoonRounds > 0` thì giảm 1 và phát
  `bloodMoonChanged { rounds, cause: "roundEnd" }`.
- **`requiresBloodMoon: true`** (field mới trên `CardDef`, chỉ hợp lệ khi lá có
  tag `forbidden`): khi `bloodMoonRounds = 0` thì `isCardPlayable` trả `false`
  và `getPlayCardError` trả `"requires blood moon"`.
- Lá `forbidden` không có `requiresBloodMoon` đánh được mọi lúc.
- Bật Huyết Nguyệt giữa lượt **không** đổi ý định kẻ địch đã công bố (như 7.3).

**Dòng thời gian** — `bloodMoon(2)` đánh trong lượt người chơi vòng N:

| Thời điểm | `bloodMoonRounds` | Ghi chú |
|---|---|---|
| Sau khi đánh (vòng N) | 2 | Lá cần Huyết Nguyệt đánh được ngay |
| Cuối vòng N | 1 | Ý định vòng N+1 công bố trong Huyết Nguyệt (mục 6.2) |
| Đầu lượt vòng N+1 | 1 | Mỗi Hero còn sống mất 2 HP |
| Cuối vòng N+1 | 0 | Hết |

→ Hai lượt người chơi được dùng lá cần Huyết Nguyệt, chỉ mất HP **một lần**.
Vì *Đổi Vận Chú* (2) + *Phệ Hồn* (3) > 3 Nguyệt Lực, Phệ Hồn thường đánh ở
lượt N+1. Đây là chủ ý: người chơi phải lên kế hoạch trước một lượt.

---

## 4. Song Hành (Bond)

### 4.1 Dữ liệu

`CardDef` mở rộng:

```ts
ownerId?: string;                   // lá thường
bond?: { owners: [string, string] }; // có mặt → đây là lá Song Hành
requiresBloodMoon?: boolean;        // mục 3
```

- Đúng một trong hai: `ownerId` XOR `bond` (kiểm tra khi nạp dữ liệu).
- Effect có field tùy chọn `actor?: 0 | 1` (index vào `owners`, mặc định 0).
  Chỉ hợp lệ trên lá có `bond`, kể cả effect lồng trong `conditional`.
- `CardInstance.ownerId: string` → **`ownerIds: string[]`** (1 phần tử cho lá
  thường; 2 cho lá Song Hành, theo thứ tự `owners`). Mọi chỗ tra chủ lá đổi
  theo: `getPlayCardError`, `isCardPlayable`, `isFreeByPassive`, `playCard`, client.

### 4.2 Dựng deck

- Deck = 15 lá kỹ năng (5 lá × 3 Hero) **+ 1 lá Song Hành cho mỗi cặp có cả
  hai Hero trong đội**.
- Lá Song Hành xếp theo thứ tự trong `cards.json`, instance id `bond01`,
  `bond02`, … đặt sau `c01`–`c15`, rồi xáo cả deck như cũ.
- Đội mặc định M05/F04/M06 **không có cặp nào** → deck vẫn 15 lá, test và mốc
  playtest giai đoạn 1 không đổi.

### 4.3 Luật trong trận

- Chỉ đánh được khi **cả hai** `owners` còn sống và **không ai** đang Đóng
  Băng. Một người ngã → lá thành Tàn Chiêu.
- **Đơn vị hành động** của một effect = `owners[actor]`. Nó quyết định:
  `sourceId`, `to: "self"`, phe của `allAllies`/`allEnemies`, condition
  `selfHpBelow`/`selfHasStatus`, người nhận `stealBuff`, bộ đếm thăng cấp.
- Effect trong `then`/`else` không ghi `actor` thì **kế thừa** `actor` của
  `conditional` chứa nó.
- **Dọn sau lá tấn công** (`01` bước 5.2.4, khi `type: "attack"`): áp cho mọi
  owner là `actor` của ít nhất một effect `damage` trong định nghĩa lá (kể cả
  trong nhánh `conditional`). Xác định từ dữ liệu, không phụ thuộc nhánh đã chạy.
- **Nội tại thăng cấp không áp cho lá Song Hành** (M05 +3, M06 lá miễn phí,
  F04 lan Hồi Phục, F03 ×2, F02 +1) — lá thuộc về cặp, không thuộc một Hero.
  **Bộ đếm thăng cấp vẫn tính** cho đơn vị hành động.
- Điều chỉnh chi phí theo tag của pha trăng áp bình thường.
- Nếu một owner ngã giữa lúc giải quyết lá (ví dụ do reflect): dừng lá (mục 2.1).

### 4.4 Ba lá Song Hành giai đoạn 2

Roster mở rộng thêm **F03 Tần Sương** và **F02 Diệp Linh Lung** (mục 5) →
đội hình chọn 3 trong 5 Hero.

| Lá (id) | Cặp (`owners`) | Giá | Loại | Tag | Mục tiêu | Hiệu ứng |
|---|---|---|---|---|---|---|
| *Băng Hỏa Tranh Phong* (`bond_bang_hoa_tranh_phong`) | M05, F03 | 2 | attack | `attack` | enemy | Nếu mục tiêu đang `freeze`: 14 damage (actor 0). Ngược lại: 8 damage (actor 0), rồi áp `freeze` lên mục tiêu (actor 1). Dùng `then`/`else`. |
| *Ảnh Đấu* (`bond_anh_dau`) | M06, F02 | 1 | skill | — | enemy | `stealBuff 1` từ mục tiêu (actor 1 — F02 nhận), rồi M06 nhận `stealth 1` (`to: "self"`, actor 0). |
| *Tuyết Trung Tống Thán* (`bond_tuyet_trung_tong_than`) | F03, F04 | 1 | skill | `control`, `harmony` | enemy | Áp `freeze` lên mục tiêu (actor 0), rồi F04 nhận `regen 2` (`to: "self"`, actor 1). |

*Ảnh Đấu* là `skill` nên Ẩn Thân của M06 không bị gỡ ở bước dọn.

Cặp thứ 3 F03 + F04: GDD không định nghĩa. Lore có sẵn trong
`08-character-prompts.md` (F04 từng được F03 cứu, F04 là đồng minh của F03).
Không dùng cặp nào trong đội mặc định M05/F04/M06 để giữ nguyên deck 15 lá của
giai đoạn 1.

---

## 5. Hero mới (2)

### 5.1 F03 Tần Sương — Epic, Huyền Vũ, Striker

- HP 32.
- Bộ đếm `freezesApplied`, ngưỡng 3: +1 mỗi lần một effect có đơn vị hành
  động là F03 **thực sự áp** `freeze` lên một mục tiêu. Áp lên mục tiêu đang
  Đóng Băng (không có tác dụng) thì không tính.
- Nội tại `doubleDamageVsFrozen` (*Hàn Sơn Kiếm*): damage từ lá của F03 (không
  tính lá Song Hành) lên mục tiêu đang `freeze` **×2** — một hệ số ở bước 3 của
  công thức `01` mục 10.1.

| Lá (id) | Giá | Loại | Tag | Mục tiêu | Hiệu ứng |
|---|---|---|---|---|---|
| *Sương Trảm* (`f03_suong_tram`) | 1 | attack | `attack` | enemy | Nếu mục tiêu đang `freeze`: 8 damage; ngược lại: 5 |
| *Hàn Ấn* (`f03_han_an`) | 1 | skill | `control` | enemy | Áp `freeze` |
| *Băng Phách Liên Kích* (`f03_bang_phach_lien_kich`) | 2 | attack | `attack` | enemy | 4 damage × 2 hit |
| *Phong Tuyết Chướng* (`f03_phong_tuyet_chuong`) | 2 | skill | `ward` | none | F03 nhận 6 giáp + `reflect 2` |
| *Tuyệt Hàn* (`f03_tuyet_han`) | 3 | attack | `attack` | enemy | 9 damage; nếu `bloodMoonActive`: áp `freeze` lên mục tiêu |

### 5.2 F02 Diệp Linh Lung — Epic, Xích Diên, Specialist

- HP 26.
- Bộ đếm `buffsStolen`, ngưỡng 3: +1 mỗi buff được chuyển bởi `stealBuff` có
  đơn vị hành động là F02 (lá của F02 hoặc *Ảnh Đấu*).
- Nội tại `stealBonus` (*Thiên Diện*): mỗi buff F02 cướp bằng lá của F02 (không
  tính lá Song Hành) được thêm **+1 `value`** (+1 tầng / thời hạn / giá trị).
- Nguồn buff để cướp: Khôi Lỗi (`strength`, mục 6.3), boss (`regen`, `reflect`).

| Lá (id) | Giá | Loại | Tag | Mục tiêu | Hiệu ứng |
|---|---|---|---|---|---|
| *Diện Đoạt* (`f02_dien_doat`) | 1 | skill | — | enemy | `stealBuff 1` |
| *Huyết Trâm* (`f02_huyet_tram`) | 1 | attack | `attack`, `forbidden` | enemy | F02 mất 2 HP, rồi 9 damage |
| *Ảnh Tập* (`f02_anh_tap`) | 1 | attack | `attack`, `assassin` | enemy | Nếu HP của F02 dưới 50%: 10 damage; ngược lại: 6 |
| *Đổi Vận Chú* (`f02_doi_van_chu`) | 2 | skill | `moon` | none | `bloodMoon 2`, rồi `shiftMoon +1` |
| *Phệ Hồn* (`f02_phe_hon`) | 3 | attack | `attack`, `forbidden` | enemy | `requiresBloodMoon`. F02 mất 3 HP, rồi 16 damage |

*Ảnh Tập* dùng điều kiện HP thấp để ăn khớp với các lá tự mất HP của F02
(Huyết Trâm, Phệ Hồn, Huyết Nguyệt).

---

## 6. Kẻ địch

### 6.1 Boss — Thần Viên Trấn Nguyệt

`enc_04` (*Vọng Nguyệt Đài*): 1 boss (`moon_ape`), HP 140. Không có giáp mở
đầu (`01` mục 2: mọi đơn vị bắt đầu với 0 giáp).

Mẫu ý định (xoay vòng):

1. `attack` — 12 damage, targeting `lowestHp`
2. `defend` — tự nhận 8 giáp + `regen 1`
3. `attack` — 6 damage `allEnemies`

`moonOverrides`:

| Pha | Ý định thay thế |
|---|---|
| `full` | Tự hồi 14 HP + `cleanse` (gỡ **mọi** debuff) |
| `new` | `attack` 16 damage, targeting `highestHp` |
| `lastQuarter` | `defend`: tự nhận 14 giáp (×1.5 = 21) + `reflect 3` — reflect còn suốt lượt người chơi kế tiếp |

`bloodMoonOverride` (mục 6.2): `attack` 10 damage `allEnemies`.

Hạn chế đã biết: boss đánh một mình nên M06 chỉ thăng cấp khi trận đã thắng —
nội tại M06 không có tác dụng ở `enc_04`. Chấp nhận.

### 6.2 `bloodMoonOverride`

- `EnemyDef` thêm `bloodMoonOverride?: IntentDef`.
- `01` mục 9.2 bước 1: nếu `bloodMoonRounds > 0` và kẻ địch có
  `bloodMoonOverride` → dùng nó (**ưu tiên hơn** `moonOverrides`); ngược lại xét
  `moonOverrides`; ngược lại dùng mẫu. `patternIndex += 1` trong mọi trường hợp.
- Vì ý định được công bố sau khi giảm `bloodMoonRounds` ở cuối vòng,
  `bloodMoon(2)` làm boss dùng ý định Huyết Nguyệt đúng **1 lần** (vòng N+1).

### 6.3 Khôi Lỗi Canh Thư có buff

`puppet_guard` / `guard_stance` (Thủ Thế) thêm effect
`applyStatus strength 1 to self`. Mỗi lần Thủ Thế, Khôi Lỗi được +1 Sức Mạnh
vĩnh viễn. Đây là mục tiêu cướp buff ở `enc_01`/`enc_03` và tạo quyết định
"cướp sớm hay giết nhanh". Test và mốc playtest có Khôi Lỗi dùng ≥2 ý định cần
cập nhật.

---

## 7. UI bổ sung (theo `05-ui-combat-screen.md` mở rộng)

- **Màn chọn đội** trước trận: chọn 3 trong 5 Hero → hiện các lá Song Hành sẽ
  được thêm vào deck.
- Lá Song Hành: viền hai màu (màu chủ của cả 2 Hero), nhãn "Song Hành" nhỏ;
  hiện Tàn Chiêu nếu một trong hai Hero đã ngã.
- Huyết Nguyệt: nền đỏ tối; icon 🔴 **cạnh** bánh xe kèm số lượt còn lại. Pha
  hiện tại vẫn hiển thị và vẫn tiến bình thường.
- Chip status mới: `Phản X` cho reflect. Chip status hiển thị **theo thứ tự
  `statuses[]`** để người chơi biết buff nào bị cướp trước.
- Cướp buff: `statusRemoved` rồi `statusApplied` liên tiếp → animation bay từ
  mục tiêu sang người cướp.
- Debug panel: đặt `bloodMoonRounds`, chọn đội khi test.

---

## 8. Các thay đổi schema/rules tóm tắt

| Hạng mục | Thay đổi |
|---|---|
| `cardTagSchema` / `CardTag` | + `scheme`, `ward`, `harmony` |
| `statusIdSchema` / `StatusId` | + `reflect`; thêm vào danh sách buff; **không** thêm vào `DURATION_STATUSES`; gỡ cùng giáp |
| `Effect` | + `stealBuff { count }`, `bloodMoon { rounds }`; `actor?: 0 \| 1` (chỉ lá Song Hành) |
| `Condition` | + `bloodMoonActive` |
| `CardDef` | `ownerId` thành tùy chọn; + `bond`, `requiresBloodMoon?` (kèm các kiểm tra khi nạp: XOR, `actor`, `forbidden`) |
| `CardInstance` | `ownerId` → `ownerIds: string[]` |
| `CombatEvent` | + `bloodMoonChanged { rounds, cause: "card" \| "roundEnd" }`; `hpLost.cause` + `"reflect"`, `"bloodMoon"` |
| `LevelUpCounter` (+ enum `counter` trong `heroDefSchema`) | + `freezesApplied`, `buffsStolen` |
| `LevelUpPassive` | + `doubleDamageVsFrozen`, `stealBonus` |
| `EnemyDef` | + `bloodMoonOverride?` |
| Data | `heroes.json` + f03, f02; `cards.json` + 10 lá Hero + 3 lá Song Hành, gắn tag 4 lá (mục 1.1); `moon-phases.json` `full`/`lastQuarter` thêm `costModifierForTag`; `enemies.json` + boss, `guard_stance` + strength; `encounters.json` + `enc_04` |
| Glossary | + `reflect` = Phản Đòn, `scheme` = Mưu Lược, `ward` = Hộ Thể, `harmony` = Điều Hòa, `forbidden` = Cấm Thuật, `stealBuff` = Cướp buff, `bloodMoonChanged` |

### 8.1 Tài liệu khác đã cập nhật (bước 2.1)

| Tài liệu | Mục |
|---|---|
| `01-combat-rules.md` | §1, §2 (deck + Song Hành); §3.1 (bước 4 mới: Huyết Nguyệt; gỡ reflect cùng giáp; các bước sau đánh số lại); §4.1, §4.3; §4.4 **mới** (lá Song Hành); §4.5 (chi phí — trước là §4.4); §5.1–§5.3; §5.4 **mới** (`actor`); §6.1, §6.3, §6.4; §6.5 **mới** (Cướp buff); §7.1; §7.4; §8 (F03, F02); §9.1–§9.4; §10.1; §10.4; §10.5 **mới** (Phản Đòn); §12 |
| `02-data-schema.md` | Theo bảng mục 8 + kiểm tra chéo ở mục 6 |
| `04-glossary.md` | Theo bảng mục 8, thêm `actor` (Đơn vị hành động) |
| `05-ui-combat-screen.md` | Theo mục 7 |
| `06-test-scenarios.md` | Thêm T61–T94 (phần "Giai đoạn 2") |
| `07-implementation-plan.md` | Thêm các bước 2.1–2.8 |

---

## 9. Kế hoạch bước

Xem `07-implementation-plan.md`, bước 2.1–2.8.

## 10. Kịch bản test

Xem `06-test-scenarios.md`, phần "Giai đoạn 2" (T61–T94).

## 11. Quyết định đã duyệt (2026-09-24)

1. **Cặp Song Hành thứ 3: F03 + F04** — *Tuyết Trung Tống Thán* (lore: F04
   từng được F03 cứu). Không dùng cặp nào trong đội mặc định để giữ deck 15 lá.
2. **Băng Hỏa Tranh Phong** — nhánh `freeze` / không `freeze` thay crit của GDD.
3. **F02 nội tại `stealBonus`** thay "sao chép lá vừa đánh của địch".
4. **Nội tại thăng cấp không áp cho lá Song Hành; bộ đếm vẫn tính** (mục 4.3).
5. **Phản Đòn**: gỡ cùng giáp; kích hoạt cả khi giáp chặn hết (mục 2.1).
6. **Tag theo pha**: Hạ Huyền `ward` −1, Trăng Tròn `harmony` −1 (mục 1.2).
7. **Khôi Lỗi thêm `strength 1`** ở Thủ Thế (mục 6.3).
8. **Boss** — *Thần Viên Trấn Nguyệt*, `enc_04` *Vọng Nguyệt Đài*.
9. Số liệu lá mới/boss (HP 140, damage…) là điểm khởi đầu — chỉnh sau playtest 2.8.
