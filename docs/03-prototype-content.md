# 03 — Nội dung prototype

Bản dễ đọc của các file trong `data/`. **Khi sửa số liệu, sửa JSON trước**, rồi cập nhật file này.

Mục tiêu balance ban đầu: một trận `enc_01` kéo dài khoảng **5–8 vòng**, người chơi mới thắng nhưng mất khá nhiều máu.

---

## 1. Đội hình prototype

| Hero | HP | Vai trò | Thăng cấp |
|---|---|---|---|
| **M05 Hoắc Liệt** | 40 | Tank + damage, mạnh hơn khi máu thấp | Mất tổng 15 HP → *Liệt Hỏa*: đòn tấn công +3 |
| **F04 Ôn Như Ý** | 30 | Hồi máu, giáp, điều khiển trăng | 3 đầu lượt có đồng đội mang Hồi Phục → *Bách Thảo*: Hồi Phục lan cả đội |
| **M06 Tô Dạ** | 28 | Sát thủ, kết liễu | Kết liễu 1 kẻ địch → *Vô Nguyệt*: lá đầu tiên của Tô Dạ mỗi lượt miễn phí |

Ba Hero được chọn vì thử được hầu hết cơ chế: khiêu khích, giáp, máu thấp, hồi máu, Hồi Phục, giải trừ, Đổi Vận, Ẩn Thân, Đánh Dấu, kết liễu, damage lan, và cả 3 kiểu thăng cấp.

---

## 2. Lá bài

### M05 Hoắc Liệt

| Lá | Giá | Loại | Tag | Hiệu ứng |
|---|---|---|---|---|
| Liệt Hỏa Xung Phong | 2 | Tấn công | attack | Gây 8 damage. HP dưới 50%: gây 12 |
| Hổ Gầm | 1 | Kỹ năng | control | Khiêu Khích 1 vòng, nhận 5 giáp |
| Thương Phá | 1 | Tấn công | attack | Xóa giáp mục tiêu, gây 5 damage |
| Trấn Bắc Huyết Tính | 0 | Kỹ năng | — | Mất 3 HP, Tích Lực 4 |
| Bất Khuất | 2 | Kỹ năng | heal | Hồi 6 HP. Trăng Non: +1 Nguyệt Lực |

### F04 Ôn Như Ý

| Lá | Giá | Loại | Tag | Hiệu ứng |
|---|---|---|---|---|
| Thảo Dược | 1 | Kỹ năng | heal | Hồi 5 HP cho 1 Hero |
| Bách Thảo Hương | 1 | Kỹ năng | heal | 3 Hồi Phục cho 1 Hero |
| Linh Chi Hộ Thể | 1 | Kỹ năng | — | 1 Hero nhận 6 giáp |
| Tịnh Tâm Trà | 1 | Kỹ năng | heal | Giải Trừ 1 Hero, hồi 2 HP |
| Nguyệt Quang Dẫn | 2 | Kỹ năng | moon | Trăng tiến 1 pha, rút 1 lá |

### M06 Tô Dạ

| Lá | Giá | Loại | Tag | Hiệu ứng |
|---|---|---|---|---|
| Ảnh Bộ | 1 | Kỹ năng | assassin | Ẩn Thân 1 vòng |
| Ám Tiễn | 1 | Tấn công | attack, assassin | Gây 6. Đang Ẩn Thân: gây 10 |
| Đoạt Mệnh | 2 | Tấn công | attack, assassin | Gây 7. Mục tiêu HP ≤ 30%: gây 20 |
| Nguyệt Ảnh Ấn | 1 | Kỹ năng | control | Đánh Dấu 2 vòng (+3 damage từ Tô Dạ) |
| Song Nhận Loạn Vũ | 2 | Tấn công | attack, assassin | Gây 5 lên mọi kẻ địch |

### Combo nên xuất hiện tự nhiên
- **Ảnh Bộ → Ám Tiễn:** 2 Nguyệt Lực, 10 damage (Trăng Non: 15), và Tô Dạ an toàn đến khi ra đòn.
- **Nguyệt Ảnh Ấn → Đoạt Mệnh:** đánh dấu rồi kết liễu, dễ đạt thăng cấp Vô Nguyệt.
- **Trấn Bắc Huyết Tính → Liệt Hỏa Xung Phong:** 2 Nguyệt Lực cho 12 damage, đồng thời đẩy M05 gần thăng cấp và gần ngưỡng 50% HP.
- **Nguyệt Quang Dẫn ở Trăng Khuyết Đầu → Trăng Tròn:** mọi hồi máu còn lại trong lượt ×2.
- **Hổ Gầm ở Hạ Huyền:** 7 giáp thay vì 5, kéo đòn khỏi Tô Dạ và Ôn Như Ý.

---

## 3. Kẻ địch

### Khôi Lỗi Canh Thư (`puppet_guard`) — HP 42
Chậm, đánh mạnh, có lúc tự thủ.

| Thứ tự | Ý định | Chọn mục tiêu | Hiệu ứng |
|---|---|---|---|
| 1 | Trọng Kích | Ngẫu nhiên | Gây 9 |
| 2 | Thủ Thế | HP thấp nhất | Nhận 8 giáp, gây 4 |
| 3 | Trọng Kích | Ngẫu nhiên | Gây 9 |
| → lặp lại | | | |

### Ảnh Hồ (`shadow_fox`) — HP 24
Nhanh, săn Hero yếu, đặc biệt nguy hiểm vào Trăng Tròn.

| Thứ tự | Ý định | Chọn mục tiêu | Hiệu ứng |
|---|---|---|---|
| 1 | Song Trảo | HP thấp nhất | Gây 3 × 2 lần |
| 2 | Huyễn Thuật | HP cao nhất | Suy Yếu 2 vòng |
| 3 | Cắn Xé | Ngẫu nhiên | Gây 7 |
| → lặp lại | | | |
| **Trăng Tròn** (thay thế) | Huyễn Nguyệt | HP thấp nhất | Gây 12 |

Ảnh Hồ tạo một lựa chọn thú vị: Trăng Tròn giúp hồi máu ×2 nhưng cũng là lúc Ảnh Hồ đánh mạnh nhất. Người chơi có thể dùng Nguyệt Quang Dẫn để "vượt qua" Trăng Tròn trước khi Ảnh Hồ công bố ý định.

---

## 4. Trận đấu

| ID | Tên | Kẻ địch | Tổng HP địch | Ghi chú |
|---|---|---|---|---|
| `enc_01` | Hành Lang Tàng Thư Các | Khôi Lỗi + Ảnh Hồ | 66 | Trận chuẩn để thử mọi cơ chế |
| `enc_02` | Rừng Trúc Đêm | 3 Ảnh Hồ | 72 | Thử damage lan, Trăng Tròn rất nguy hiểm |
| `enc_03` | Cổng Đá Học Viện | 2 Khôi Lỗi | 84 | Thử Thương Phá, trận dài |

---

## 5. Nguyệt Luân

Trận bắt đầu ở **Lưỡi Liềm Đầu**, tiến 1 pha mỗi vòng:

| Vòng | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|
| Pha | 🌒 | 🌓 | 🌔 | 🌕 | 🌖 | 🌗 | 🌘 | 🌑 | 🌒 |
| Hiệu ứng | — | control −1 | — | hồi ×2 | — | giáp ×1.5 | — | sát thủ ×1.5 | — |

(Chưa tính Đổi Vận.)

---

## 6. Những điều cần quan sát khi chơi thử

- Trận có quá dài / quá ngắn không? Mục tiêu 5–8 vòng.
- Có Hero nào gần như không bao giờ thăng cấp không? Ghi lại vòng thăng cấp trung bình.
- Nguyệt Quang Dẫn có đáng 2 Nguyệt Lực không?
- Tàn Chiêu có quá phạt không (mất 1 Hero là thua chắc)?
- Người chơi có nhìn và phản ứng theo ý định của địch không?

Ghi kết quả vào `docs/playtest-notes.md` (tự tạo) sau mỗi buổi chơi thử.

---

## 7. Binh Khí và Nguyệt Bảo [GĐ4e]

Số sau gói chỉnh G1 (4e.7, đã duyệt; số đo ở `playtest-notes.md` mục 4e). Luật: `01` §14, `14` §13. Mỗi ô R2–R5 ghi **phần
thay đổi** so với cấp trước; phần không nhắc giữ nguyên. "(X: …)" = bản mệnh khi người
mang là Hero X (`signatureHooks`). Mọi Hero mang được mọi vũ khí.

### 7.1 Binh Khí (lá Binh Khí: tên · cost · số bản · loại)

| Vũ khí | Độ hiếm | Lá R1 | Nội tại R1 | R2 | R3 | R4 | R5 |
|---|---|---|---|---|---|---|---|
| Xích Diệm Thương `w_xich_diem_thuong` (bản mệnh M05) | Legendary | *Liệt Diệm* 4 · 2 · tấn công [attack]: gây 6, Thiêu Đốt 2 | Đầu trận người mang Phản Đòn 2 (M05: Phản Đòn 3) | gây 7 | cost 3 | gây 9 | Phản Đòn 3 (M05: Phản Đòn 5, +1 Sức Mạnh) |
| Ảnh Nguyệt Chủy `w_anh_nguyet_chuy` (M06) | Epic | *Ảnh Sát Chủy* 1 · 2 · tấn công [attack, assassin]: gây 3; mục tiêu ≤ 30% HP: gây 9 | Mỗi lá `assassin` thứ 3 của người mang: +1 NL (M06: +2) | 4 / 11 | thêm Đánh Dấu 1 vòng | 5 / 13 | thành mỗi lá thứ **2** |
| Hàn Tuyết Song Kiếm `w_han_tuyet_song_kiem` (F03) | Epic | *Song Tuyết* 4 · 2 · tấn công [attack]: gây 3 ×2; Tích Tụ 1: Đóng Băng 1 vòng | Đầu trận mọi kẻ địch Suy Yếu 1 vòng (F03: như thường tới R4) | 4 ×2 | cost 3 | 5 ×2 | Suy Yếu 2 vòng (F03: 3 vòng, thêm Dễ Vỡ 1 vòng) |
| Thiên Diện Phiến `w_thien_dien_phien` (F02) | Epic | *Phiến Ảnh* 1 · 2 · kỹ năng [scheme]: Đoạt Nguyệt 1; Liên Hoàn 2: Cướp 1 buff | Khi Huyết Nguyệt bắt đầu: người mang +1 Sức Mạnh (F02: +1 Sức Mạnh, +2 NL) | Đoạt Nguyệt 2 | cost 0 | Liên Hoàn 2: Cướp 2 buff | +2 Sức Mạnh (F02: +2 Sức Mạnh, +3 NL) |
| Bách Hoa Trâm `w_bach_hoa_tram` (F04) | Rare | *Trâm Hoa* 2 · 2 · kỹ năng [heal]: 1 Hero Hồi Phục 2; Tích Tụ 1: 4 | Mỗi 2 lượt, cuối lượt Hero máu thấp nhất Hồi Phục 1 (F04: 2) | 3 / 5 | cost 1 | 4 / 6 | Hồi Phục 2 (F04: 3), vẫn mỗi 2 lượt |
| Thiết Thuẫn `w_thiet_thuan` (chung — Vanguard) | Rare | *Thuẫn Kích* 2 · 2 · kỹ năng [ward]: nhận 6 giáp, Khiêu Khích 1 vòng | Đầu trận người mang 4 giáp | 7 giáp | cost 1 | 8 giáp | đầu trận 8 giáp |
| Liệt Cung `w_liet_cung` (chung — Striker) | Rare | *Liệt Tiễn* 3 · 2 · tấn công [attack]: gây 2 ×2, Đánh Dấu 1 vòng | Người mang kết liễu kẻ địch: +1 NL | 3 ×2 | cost 2 | 4 ×2 | +2 NL |
| Huyền Linh Kính `w_huyen_linh_kinh` (chung — Controller) | Epic | *Kính Hàn* 2 · 2 · kỹ năng [control, moon]: Tỏa Nguyệt 2, Suy Yếu 1 vòng | Khi vào Trăng Non: mọi kẻ địch Dễ Vỡ 1 vòng | Tỏa Nguyệt 3 | cost 1 | Suy Yếu 2 vòng | Trăng Non **hoặc Trăng Tròn** |
| Thanh Tâm Bình `w_thanh_tam_binh` (chung — Support) | Rare | *Bình Lộ* 3 · 2 · kỹ năng [heal]: mọi Hero hồi 3 (Dư Sinh) | Đầu trận người mang Hồi Phục 2 | hồi 4 | cost 2 | hồi 5 | đầu trận **mọi Hero** Hồi Phục 2 |
| Tinh Bàn `w_tinh_ban` (chung — Specialist) | Legendary | *Chuyển Tinh* 2 · 2 · kỹ năng [moon]: Đổi Vận 1 pha, Chiêm Bài 2 | Đầu trận: +2 NL | Chiêm Bài 3 | cost 1 | thêm +1 NL | Đầu trận: Dưỡng Nguyệt 1 (mỗi lượt +1 NL) |

### 7.2 Nguyệt Bảo (mỗi cấp Cộng Minh là bản đầy đủ)

| Nguyệt Bảo | Độ hiếm | CM1 | CM2 | CM3 | CM4 | CM5 |
|---|---|---|---|---|---|---|
| Thiên Sách `r_thien_sach` | Legendary | Khi vào Trăng Tròn: +2 NL | +3 NL | Trăng Tròn hoặc Huyết Nguyệt bắt đầu: +3 NL | +4 NL | CM4, thêm: khi vào Trăng Non +2 NL |
| Vọng Nguyệt Kính `r_vong_nguyet_kinh` | Legendary | Mỗi lần trăng đổi pha: mọi Hero 2 giáp | 3 giáp | 4 giáp | 5 giáp | CM4, thêm: Huyết Nguyệt bắt đầu → mọi Hero 5 giáp |
| Huyết Ngọc Bội `r_huyet_ngoc_boi` | Epic | Trong Huyết Nguyệt: lá `forbidden` −1 NL | `forbidden` và `scheme` −1 | `forbidden` −2, `scheme` −1 | `forbidden` −2, `scheme` −2 | CM4, thêm: Huyết Nguyệt bắt đầu → +2 NL |
| Loan Linh Ấn `r_loan_linh_an` | Epic | Mỗi lá kỹ năng thứ 5 trong trận: +1 NL | +2 NL | mỗi lá thứ 4: +1 NL | mỗi lá thứ 4: +2 NL | CM4, thêm: mỗi lá tấn công thứ 4 +1 NL |
| Xích Diễm Châu `r_xich_diem_chau` | Epic | Khi hạ một kẻ địch: mọi kẻ địch còn lại Thiêu Đốt 2 | Thiêu Đốt 3 | Thiêu Đốt 4 | Thiêu Đốt 5 | CM4, thêm: Hero kết liễu +1 Sức Mạnh |
| Bạch Lộ Hương Nang `r_bach_lo_huong_nang` | Rare | Khi vào Trăng Tròn: Hero máu thấp nhất hồi 3 | hồi 5 | Trăng Tròn hoặc Trăng Non: hồi 5 | hồi 7 | CM4, thêm: Hero đó Hồi Phục 2 |
| Huyền Vũ Giáp Phù `r_huyen_vu_giap_phu` | Rare | Đầu trận mọi Hero 3 giáp | 4 giáp | 5 giáp | 6 giáp | CM4, thêm: Huyết Nguyệt bắt đầu → mọi Hero 3 giáp |
| Trấn Hồn Linh `r_tran_hon_linh` | Rare | Khi một Hero ngã: các Hero còn lại +1 Sức Mạnh | +2 | +3 | +4 | CM4, thêm: các Hero còn lại hồi 5 |

Đơn vị hành động: hook "+NL" dùng `front`; "mọi Hero" dùng `each`; "Hero máu thấp nhất"
dùng `lowestHp`; "kẻ địch" dùng `front` với `to: "allEnemies"`; "Hero kết liễu" dùng
`trigger`. Banner Binh Khí Các: legendary 2, epic 4, rare 4; Nguyệt Bảo Các: legendary
2, epic 3, rare 3 (theo cột độ hiếm ở trên).

## 8. Đấu Trường — chỉ số PvP [GĐ5b]

Chỉ số PvP đặt riêng trong `pvp-config.json` (`heroStats`, `secondPlayerBonus`,
`roundCap`...), không đụng số liệu PvE.

| Hero | HP PvP | HP PvE gốc | Thắng% đo (bot, 1440 trận/Hero) |
|---|---|---|---|
| Hoắc Liệt `m05` | 52 | 40 | 52% |
| Ôn Như Ý `f04` | 40 | 30 | 44% |
| Tô Dạ `m06` | 36 | 28 | 52% |
| Tần Sương `f03` | 42 | 32 | 55% |
| Diệp Linh Lung `f02` | 34 | 26 | 47% |

Mô phỏng bot-đấu-bot (`PLAYTEST_PVP=1`, 1200 trận Bộ cơ bản): người đi trước
thắng 54% (mục tiêu 47–53%), vòng trung vị 14 (mục tiêu 8–12), hòa roundCap 0%
(mục tiêu <1%), mọi Hero 44–55% (mục tiêu 40–60%). Bù người đi sau +1 Nguyệt
Lực. Hai chỉ số đầu ở mép/vượt mục tiêu — quyết định giữ nguyên, xem lại sau
khi có người chơi thật (bot heuristic kéo dài trận hơn người).

## 9. Liên Thủ — nội dung co-op [GĐ6a]

### 9.1 Hợp Kích — `coop-combos.json`

Ba đòn theo spec `17` §8.5; `CardMatcher` khớp một lá mỗi người (`01` §16.4).

| id | Tên | Người A | Người B | Hiệu ứng | Giới hạn |
|---|---|---|---|---|---|
| `combo_bang_nguyet_ke` | Băng Nguyệt Kế | lá `tag: scheme` | lá của `f03` áp `freeze` | `applyStatus freeze 1` lên `allEnemies` (boss bỏ cả chuỗi vòng này) | 1/vòng, 1/trận |
| `combo_am_anh_tuyet_sat` | Ám Ảnh Tuyệt Sát | lá của `m06` áp `stealth` | lá của `f02` có effect `loseHp` (Đoạt Mệnh) | `execute threshold 0.25 allEnemies`; không ai ngã → `damage 8 allEnemies` | 1/vòng |
| `combo_nguyet_quang_pho_chieu` | Nguyệt Quang Phổ Chiếu | lá `shiftMoon` kết thúc ở pha `full` | lá có effect `heal` | `heal 6 allAllies` (6 Hero; Trăng Tròn ×2 → 12) | 1/vòng |

*Ruling:* spec ghi người B của *Ám Ảnh Tuyệt Sát* là "lá của F02 áp debuff", nhưng F02
không có lá nào áp trạng thái — đặc trưng của F02 là Đoạt Mệnh (`loseHp`, 6 lá). Đổi
matcher B thành `{ ownerId: "f02", effect: "loseHp" }` để giữ cặp M06–F02.

*Ghi chú:* lá `scheme` hiện thuộc F02 — Hợp Kích dùng `tag` nên Hero Thanh Loan sau này
tự được hưởng.

### 9.2 Boss — `eclipse_lord` *Nguyệt Thực Ma Quân*

`maxHp` 210 (≈ 2.2 × `moon_ape` 94), `moonPower { start: 4, cap: 12 }`, `intents` gốc =
giai đoạn 1. `phases` theo `01` §16.5; `maxIntentsPerRound` 4 mọi giai đoạn.

**Giai đoạn 1 — Trăng Khuyết** (`hpBelow: 1`)

| intent | kind | cost | targeting | effects |
|---|---|---|---|---|
| `ecl_nguyet_nha` — Nguyệt Nha | attack | 3 | lowestHp | damage 9 `chosen` |
| `ecl_trieu_nguyet` — Triều Nguyệt | attack | 4 | — | damage 5 `allEnemies` |
| `ecl_nguyet_mac` — Nguyệt Mạc | defend | 3 | — | gainArmor 10 `self`, `regen` 2 `self` |
| `ecl_am_trieu` — Ám Triệu | debuff | 2 | random | `weak` 2 `chosen`, `vulnerable` 1 `chosen` |

**Giai đoạn 2 — Huyết Nguyệt** (`hpBelow: 0.75`, `bloodMoonWhileActive`,
`onEnter: [applyStatus strength 2 self]`)

| intent | kind | cost | targeting | effects |
|---|---|---|---|---|
| `ecl_huyet_trao` — Huyết Trảo | attack | 4 | lowestHp | damage 12 `chosen` |
| `ecl_huyet_vu` — Huyết Vũ | attack | 5 | — | damage 7 `allEnemies` |
| `ecl_huyet_bich` — Huyết Bích | defend | 4 | — | gainArmor 14 `self`, `reflect` 2 `self` |
| `ecl_cuong_nguyet` — Cuồng Nguyệt | buff | 4 | — | `strength` 3 `self` |

**Giai đoạn 3 — Nguyệt Ấn** (`hpBelow: 0.5`)

| intent | kind | cost | targeting | effects |
|---|---|---|---|---|
| `ecl_thuc_nguyet_tram` — Thực Nguyệt Trảm | attack | 6 | random | damage 18 `chosen` — `alwaysPlan` (mỗi chuỗi có khi đủ quỹ; mục tiêu hiện rõ ở ý định) |
| `ecl_nguyet_an` — Nguyệt Ấn | debuff | 3 | random | `mark` 2 `chosen`, `weak` 1 `chosen` |
| `ecl_anh_ba` — Ảnh Ba | attack | 4 | — | damage 6 `allEnemies` |
| `ecl_nguyet_tu` — Nguyệt Tụ | defend | 4 | — | heal 12 `self`, `cleanse` `self` |

**Giai đoạn 4 — Nguyệt Thực** (`hpBelow: 0.25`, `reviveAfterRounds: 2`)

| intent | kind | cost | targeting | effects |
|---|---|---|---|---|
| `ecl_thon_nguyet` — Thôn Nguyệt | attack | 5 | highestHp | damage 14 `chosen` |
| `ecl_nguyet_diet` — Nguyệt Diệt | attack | 7 | — | damage 10 `allEnemies` |
| `ecl_tan_nguyet_bich` — Tận Nguyệt Bích | defend | 4 | — | gainArmor 18 `self` |
| `ecl_doan_menh` — Đoản Mệnh | debuff | 3 | lowestHp | `vulnerable` 2 `chosen`, `weak` 1 `chosen` |

Encounter `enc_coop_01` — "Đại Nghiễn Nguyệt Thực": `enemyIds: ["eclipse_lord"]`,
`tier: "coop"` (không vào bản đồ lượt chơi).

Cường độ tham chiếu mục tiêu spec `17` §8.8: Bộ cơ bản không trang bị thắng 35–50%,
vòng trung vị 10–14 — sẽ hiệu chỉnh sau `coop-sim`.

---

## 10. GĐ7 — Hero đợt 1

Năm Hero đợt 1 của GĐ7 (spec `18` §2): M01 Tạ Vân Chiêu (legendary · Thanh Loan ·
support · HP 30), M02 Lục Hàn Phong (epic · Huyền Vũ · vanguard · HP 42), M03 Mặc Tử
Du (rare · Thanh Loan · specialist · HP 30), M04 Bùi Thanh Minh (epic · Bạch Lộ ·
support · HP 32), F01 Thẩm Nguyệt Hoa (legendary · Thanh Loan · specialist · HP 32).
HP PvP = HP PvE + 12: 42 / 54 / 42 / 44 / 44. Mỗi Hero 6 lá mở sẵn + 6 lá khóa, chia
đều hai nhánh; lá chủ đạo (signature) là lá mở sẵn và có bản "+" cùng giá/cùng số bản.

### 10.1 M01 — Tạ Vân Chiêu

Nhánh A **Thiên Cơ**: mưu lược (tag `scheme`), Chiêm Bài, giảm giá. Nhánh B **Quyền
Mưu**: Tỏa/Đoạt Nguyệt, debuff, cướp buff. Cả 12 lá đều tag `scheme` — mọi lá M01 nuôi
bộ đếm thẳng.

- Thăng cấp: `schemeCardsPlayed` ≥ 8 (Tinh Hồn 2: 6) → **Thiên Cơ** `cheapestCardDiscount 1`: đầu lượt, lá rẻ nhất trên tay −1 Nguyệt Lực trong lượt đó.
- Dạng hai **Định Cục**: `chooseCardExtraLook 1` — Chiêm Bài của người chơi xem thêm 1 lá.

| Id | Tên | Cost | Copies | Loại / Tag / Target | Hiệu ứng | Nhánh | Mở sẵn / Khóa |
|---|---|---|---|---|---|---|---|
| `m01_quan_tinh` | Quan Tinh | 1 | 3 | skill / scheme / none | `chooseCard 2` — "Chiêm Bài 2." | A | Mở sẵn — **signature** |
| `m01_thao_luoc` | Thảo Lược | 1 | 3 | skill / scheme / none | `gainMoonPower 1` + `chooseCard 1` — "Nhận 1 Nguyệt Lực. Chiêm Bài 1." | A | Mở sẵn |
| `m01_muu_co` | Mưu Cơ | 2 | 2 | skill / scheme, control / enemy | `applyStatus weak 2 chosen` + `chooseCard 1` | A | Mở sẵn |
| `m01_doi_van_doan` | Đổi Vận Đoán | 3 | 2 | skill / scheme, moon / none | `shiftMoon 1` + `chooseCard 2` | A | Mở sẵn |
| `m01_lien_hoan_ke` | Liên Hoàn Kế | 4 | 2 | skill / scheme / none | `conditional(cardsPlayedThisTurnAtLeast 2 → gainMoonPower 3; else gainMoonPower 1)` + `chooseCard 2` | A | Khóa |
| `m01_vo_trung_sinh_huu` | Vô Trung Sinh Hữu | 5 | 1 | skill / scheme / none | `gainMoonPower 3` + `chooseCard 3` | A | Khóa |
| `m01_mat_thu` | Mật Thư | 1 | 3 | skill / scheme, control / enemy | `drainMoonPower 1 chosen` + `chooseCard 1` | B | Mở sẵn |
| `m01_toa_nguyet_phu` | Tỏa Nguyệt Phù | 2 | 2 | skill / scheme, control / enemy | `drainMoonPower 2 chosen` | B | Mở sẵn |
| `m01_phan_gian_ke` | Phản Gian Kế | 3 | 2 | skill / scheme, control / enemy | `stealBuff 1` + `applyStatus weak 2 chosen` | B | Khóa |
| `m01_doat_nguyet_sach` | Đoạt Nguyệt Sách | 4 | 2 | skill / scheme, control / enemy | `drainMoonPower 3 steal chosen` + `chooseCard 1` | B | Khóa |
| `m01_khong_thanh_ke` | Không Thành Kế | 5 | 1 | skill / scheme, control / none | `applyStatus weak 2 allEnemies` + `drainMoonPower 2 allEnemies` | B | Khóa |
| `m01_doat_cuc` | Đoạt Cục | 6 | 1 | skill / scheme, control / enemy | `stealBuff 2` + `drainMoonPower 3 steal chosen` + `chooseCard 2` | B | Khóa |
| `m01_quan_tinh_plus` | Quan Tinh+ | 1 | 3 | skill / scheme / none | `chooseCard 3` | — | (lá +) |

### 10.2 M02 — Lục Hàn Phong

Nhánh A **Hộ Vệ**: `guard`, giáp. Nhánh B **Phản Kích**: Phản Đòn (`reflect`), Khiêu
Khích (`taunt`). Ba lá đặt `guard` lên đồng đội (đặt lên chính M02 là no-op), cộng
`taunt`/`reflect` để M02 tự hút đòn — `hitsIntercepted` 3 đạt được sớm.

- Thăng cấp: `hitsIntercepted` ≥ 3 (Tinh Hồn 2: 3) → **Thiết Bích** `armorPerTurn 4`: đầu lượt nhận 4 giáp.
- Dạng hai **Trung Can**: `interceptArmor 2` — mỗi đòn đỡ thay, nhận 2 giáp trước khi tính damage.

| Id | Tên | Cost | Copies | Loại / Tag / Target | Hiệu ứng | Nhánh | Mở sẵn / Khóa |
|---|---|---|---|---|---|---|---|
| `m02_ho_ve` | Hộ Vệ | 1 | 3 | skill / ward / ally | `applyStatus guard 2 chosen` | A | Mở sẵn |
| `m02_xung_tran` | Xung Trận | 2 | 2 | attack / attack / enemy | `damage 5 chosen` + `gainArmor 3 self` | A | Mở sẵn |
| `m02_can_ve` | Cận Vệ | 2 | 2 | skill / ward / ally | `applyStatus guard 2 chosen` + `gainArmor 3 chosen` | A | Mở sẵn — **signature** |
| `m02_tu_ve` | Tứ Vệ | 3 | 2 | skill / ward / none | `gainArmor 4 allAllies` | A | Mở sẵn |
| `m02_ve_thanh` | Vệ Thánh | 4 | 2 | skill / ward / ally | `applyStatus guard 3 chosen` + `gainArmor 6 self` | A | Khóa |
| `m02_tap_ve` | Tập Vệ | 5 | 1 | skill / ward / none | `gainArmor 6 allAllies` + `applyStatus taunt 1 self` | A | Khóa |
| `m02_phan_kich` | Phản Kích | 1 | 3 | skill / ward / none | `applyStatus reflect 2 self` | B | Mở sẵn |
| `m02_khieu_dich` | Khiêu Địch | 1 | 3 | skill / ward, control / none | `applyStatus taunt 1 self` + `gainArmor 3 self` | B | Mở sẵn |
| `m02_bat_hoai` | Bất Hoại | 3 | 2 | skill / ward / none | `gainArmor 6 self` + `conditional(selfHpBelow 0.5 → gainArmor 6 self)` | B | Khóa |
| `m02_doi_thuong` | Đổi Thương | 3 | 2 | attack / attack / enemy | `damage 6 chosen` + `applyStatus reflect 2 self` | B | Khóa |
| `m02_ngich_pha` | Nghịch Phá | 4 | 2 | attack / attack / enemy | `damage 7 chosen` + `applyStatus taunt 1 self` | B | Khóa |
| `m02_van_quan` | Vạn Quân | 5 | 1 | skill / ward / none | `applyStatus taunt 2 self` + `applyStatus reflect 4 self` + `gainArmor 8 self` | B | Khóa |
| `m02_can_ve_plus` | Cận Vệ+ | 2 | 2 | skill / ward / ally | `applyStatus guard 3 chosen` + `gainArmor 5 chosen` | — | (lá +) |

*Ghi chú:* lá signature đổi tên thành *Cận Vệ* để tránh trùng lá Song Hành *Thân Vệ*
(`18` §2.3). Keyword `ho_ve` được thêm vào `keywords.json` cho ba lá guard + lá "+".

### 10.3 M03 — Mặc Tử Du

Nhánh A **Thương Hội**: Nguyệt Lực (`gainMoonPower`), Dưỡng Nguyệt. Nhánh B **Tin
Đồn**: Chiêm Bài, Tích Tụ (`heldTurnsAtLeast`). 6 lá có `chooseCard` nuôi `cardsChosen`
rất nhanh; nhánh A dựng kinh tế Nguyệt Lực trả cho các lá đắt và lượt Vạn Kim.

- Thăng cấp: `cardsChosen` ≥ 5 (Tinh Hồn 2: 4) → **Vạn Kim** `freeChooseCardPerTurn { look: 3 }`: đầu lượt (sau rút bù) Chiêm Bài 3 miễn phí.
- Dạng hai **Phú Giáp**: `passive: none` + `onLevelUp: [gainMoonPowerPerTurn 1]` — khi thăng cấp nhận Dưỡng Nguyệt 1.

| Id | Tên | Cost | Copies | Loại / Tag / Target | Hiệu ứng | Nhánh | Mở sẵn / Khóa |
|---|---|---|---|---|---|---|---|
| `m03_tieu_loi` | Tiểu Lợi | 0 | 3 | skill / scheme / none | `gainMoonPower 1` | A | Mở sẵn |
| `m03_thong_bao` | Thông Bảo | 1 | 3 | skill / scheme / none | `gainMoonPower 2` | A | Mở sẵn |
| `m03_mau_dich` | Mậu Dịch | 2 | 2 | skill / scheme / none | `gainMoonPower 2` + `chooseCard 1` | A | Mở sẵn |
| `m03_bon_kim` | Bốn Kim | 3 | 2 | skill / scheme / none | `gainMoonPowerPerTurn 1` | A | Mở sẵn |
| `m03_tich_thuy` | Tích Thủy | 4 | 2 | skill / scheme / none | `gainMoonPowerPerTurn 1` + `chooseCard 2` | A | Khóa |
| `m03_kim_dau` | Kim Đấu | 6 | 1 | skill / scheme / none | `gainMoonPowerPerTurn 2` | A | Khóa |
| `m03_tham_bao` | Thám Báo | 1 | 3 | skill / scheme / none | `chooseCard 2` | B | Mở sẵn — **signature** |
| `m03_tu_tin` | Tụ Tin | 2 | 2 | skill / scheme / none | `conditional(heldTurnsAtLeast 2 → gainMoonPower 4; else gainMoonPower 2)` | B | Mở sẵn |
| `m03_kim_tien` | Kim Tiền | 2 | 2 | attack / attack / enemy | `damage 5 chosen` + `gainMoonPower 1` | B | Khóa |
| `m03_than_toan` | Thần Toán | 3 | 2 | skill / scheme / none | `conditional(heldTurnsAtLeast 1 → gainMoonPower 3)` + `chooseCard 2` | B | Khóa |
| `m03_diem_tin` | Điềm Tin | 4 | 2 | skill / scheme / none | `gainMoonPower 1` + `chooseCard 3` | B | Khóa |
| `m03_tien_tri` | Tiên Tri | 6 | 1 | skill / scheme / none | `conditional(heldTurnsAtLeast 2 → gainMoonPowerPerTurn 1)` + `chooseCard 4` | B | Khóa |
| `m03_tham_bao_plus` | Thám Báo+ | 1 | 3 | skill / scheme / none | `chooseCard 3` | — | (lá +) |

*Ghi chú:* `m03_tieu_loi` (cost 0 → `gainMoonPower 1`) là lá ramp 0-mana đầu tiên của
game — đánh dấu để mô phỏng 7a.6 xem xét.

### 10.4 M04 — Bùi Thanh Minh

Nhánh A **Châm Cứu**: giải debuff (`cleanse`), Hồi Phục (`regen`), Tụ Dược
(`burstRegen`). Nhánh B **Hộ Mạch**: Dư Sinh (`heal` + `overflow: "armor"`), giáp.
10/12 lá có `heal`/`burstRegen` trực tiếp (tick `regen` không đếm `hpHealed`); heal
lan `allAllies` đếm từng Hero nên ngưỡng 20 đạt được trong 1–2 lượt hồi tốt.

- Thăng cấp: `hpHealed` ≥ 20 (Tinh Hồn 2: 14) → **Thần Y** `healCleanses`: lá hồi của Bùi Thanh Minh giải trừ Hero được hồi.
- Dạng hai **Tâm Nhãn**: `healBonusOwnCards 2` — lá hồi máu của Bùi Thanh Minh hồi thêm 2.

| Id | Tên | Cost | Copies | Loại / Tag / Target | Hiệu ứng | Nhánh | Mở sẵn / Khóa |
|---|---|---|---|---|---|---|---|
| `m04_cham_cu` | Châm Cứu | 1 | 3 | skill / heal, harmony / ally | `cleanse chosen` + `heal 2 chosen` | A | Mở sẵn — **signature** |
| `m04_cam_lo` | Cam Lộ | 2 | 2 | skill / heal, harmony / ally | `applyStatus regen 3 chosen` + `heal 2 chosen` | A | Mở sẵn |
| `m04_tu_duoc` | Tụ Dược | 2 | 2 | skill / heal / ally | `burstRegen 2 chosen` + `heal 2 chosen` | A | Mở sẵn |
| `m04_hoi_xuan` | Hồi Xuân | 4 | 2 | skill / heal, harmony / none | `applyStatus regen 3 allAllies` | A | Khóa |
| `m04_than_cham` | Thần Châm | 5 | 1 | skill / heal / ally | `burstRegen 3 chosen` + `cleanse chosen` + `heal 4 chosen` | A | Khóa |
| `m04_cuu_chuyen` | Cửu Chuyển | 6 | 1 | skill / heal, harmony / none | `heal 6 allAllies` + `applyStatus regen 2 allAllies` | A | Khóa |
| `m04_ho_mach` | Hộ Mạch | 1 | 3 | skill / heal, ward / ally | `heal 3 chosen overflow:"armor"` | B | Mở sẵn |
| `m04_ngoc_bi` | Ngọc Bích | 2 | 2 | skill / ward / ally | `gainArmor 6 chosen` | B | Mở sẵn |
| `m04_duong_mach` | Dưỡng Mạch | 3 | 2 | skill / heal, harmony / none | `heal 3 allAllies` + `gainArmor 3 allAllies` | B | Mở sẵn |
| `m04_dinh_mach` | Định Mạch | 3 | 2 | skill / ward / ally | `gainArmor 5 chosen` + `conditional(selfHpBelow 0.5 → heal 4 chosen)` | B | Khóa |
| `m04_bao_mach` | Bảo Mạch | 4 | 2 | skill / heal, ward / ally | `heal 6 chosen overflow:"armor"` + `gainArmor 4 chosen` | B | Khóa |
| `m04_hoi_duong` | Hồi Dương | 6 | 1 | skill / heal, harmony / none | `heal 8 allAllies overflow:"armor"` | B | Khóa |
| `m04_cham_cu_plus` | Châm Cứu+ | 1 | 3 | skill / heal, harmony / ally | `cleanse chosen` + `heal 4 chosen` | — | (lá +) |

### 10.5 F01 — Thẩm Nguyệt Hoa

Nhánh A **Nguyệt Quang**: tag `moon`, chủ đề Trăng Tròn (`moonPhaseIs "full"`,
`shiftMoon`). Nhánh B **Thiên Mệnh**: Dưỡng Nguyệt, lá Nguyệt Lực lớn (cost 5+). 12/12
lá tag `moon` — dạng Tự Do giảm giá cả pool; Hô Nguyệt/Tinh Dịch/Nguyệt Lệnh đẩy
trăng tới Trăng Tròn sớm để `fullMoonsSeen` bật ngay vòng 2–3.

- Thăng cấp: `fullMoonsSeen` ≥ 1 (Tinh Hồn 2: 1) → **Nguyệt Chủ** `passive: none` + `onLevelUp: [createCard "f01_nguyet_hoa_chieu_the"]` — khi thăng cấp nhận *Nguyệt Hoa Chiếu Thế* vào tay.
- Dạng hai **Tự Do**: `tagDiscountOwnCards { tag: "moon", amount: 1 }` — lá tag `moon` của Thẩm Nguyệt Hoa giảm 1 Nguyệt Lực.

| Id | Tên | Cost | Copies | Loại / Tag / Target | Hiệu ứng | Nhánh | Mở sẵn / Khóa |
|---|---|---|---|---|---|---|---|
| `f01_ho_nguyet` | Hô Nguyệt | 1 | 3 | skill / moon / none | `shiftMoon 1` + `heal 2 self` | A | Mở sẵn |
| `f01_nguyet_am` | Nguyệt Âm | 2 | 2 | skill / moon, heal / ally | `heal 4 chosen` + `conditional(moonPhaseIs "full" → gainMoonPower 1)` | A | Mở sẵn |
| `f01_tinh_dich` | Tinh Dịch | 2 | 2 | skill / moon / none | `shiftMoon 2` | A | Mở sẵn |
| `f01_nguyet_quang` | Nguyệt Quang | 3 | 2 | skill / moon / none | `shiftMoon 1` + `chooseCard 2` | A | Mở sẵn — **signature** |
| `f01_nguyet_hon` | Nguyệt Hồn | 4 | 2 | skill / moon, heal / none | `heal 4 allAllies` + `conditional(moonPhaseIs "full" → gainMoonPower 2)` | A | Khóa |
| `f01_nguyet_lenh` | Nguyệt Lệnh | 4 | 2 | skill / moon / none | `conditional(moonPhaseIs "full" → gainMoonPower 3; else shiftMoon 1)` | A | Khóa |
| `f01_tu_nguyet` | Tụ Nguyệt | 1 | 3 | skill / moon / none | `gainMoonPower 2` | B | Mở sẵn |
| `f01_hung_nguyet` | Hưng Nguyệt | 2 | 2 | skill / moon / none | `conditional(moonPhaseIs "full" → gainMoonPowerPerTurn 1; else gainMoonPower 2)` | B | Mở sẵn |
| `f01_duong_nguyet_quyet` | Dưỡng Nguyệt Quyết | 3 | 2 | skill / moon / none | `gainMoonPowerPerTurn 1` | B | Khóa |
| `f01_nguyet_dinh` | Nguyệt Đỉnh | 5 | 1 | skill / moon / none | `gainMoonPower 3` + `gainMoonPowerPerTurn 1` | B | Khóa |
| `f01_thieu_nguyet` | Thiêu Nguyệt | 6 | 1 | attack / attack, moon / enemy | `conditional(moonPhaseIs "full" → damage 20 chosen; else damage 10 chosen)` | B | Khóa |
| `f01_tue_nguyet` | Tuế Nguyệt | 7 | 1 | skill / moon, heal / none | `heal 7 allAllies overflow:"armor"` + `gainMoonPowerPerTurn 1` | B | Khóa |
| `f01_nguyet_quang_plus` | Nguyệt Quang+ | 3 | 2 | skill / moon / none | `shiftMoon 1` + `chooseCard 3` | — | (lá +) |

### 10.6 Lá token (không nằm trong pool)

| Id | Tên | Cost | Copies | Loại / Tag / Target | Hiệu ứng | Ghi chú |
|---|---|---|---|---|---|---|
| `f01_nguyet_hoa_chieu_the` | Nguyệt Hoa Chiếu Thế | 5 | 1 | attack / attack, moon / none | `conditional(moonPhaseIs "full" → damage 10 allEnemies; else damage 6 allEnemies)` + `heal 4 allAllies` | `ownerId: "f01"`, `token: true`; vào tay khi F01 thăng cấp. Trăng Tròn hồi ×2 → 8 HP mỗi Hero. |
