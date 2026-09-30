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

- Thăng cấp: `schemeCardsPlayed` ≥ 7 (Tinh Hồn 2: 5) → **Thiên Cơ** `cheapestCardDiscount 2`: đầu lượt, lá rẻ nhất trên tay −2 Nguyệt Lực trong lượt đó.
- Dạng hai **Định Cục**: `chooseCardExtraLook 1` — Chiêm Bài của người chơi xem thêm 1 lá.

| Id | Tên | Cost | Copies | Loại / Tag / Target | Hiệu ứng | Nhánh | Mở sẵn / Khóa |
|---|---|---|---|---|---|---|---|
| `m01_quan_tinh` | Quan Tinh | 1 | 3 | skill / scheme / none | `chooseCard 2` — "Chiêm Bài 2." | A | Mở sẵn — **signature** |
| `m01_thao_luoc` | Thảo Lược | 1 | 3 | skill / scheme / none | `gainMoonPower 1` + `chooseCard 1` — "Nhận 1 Nguyệt Lực. Chiêm Bài 1." | A | Mở sẵn |
| `m01_muu_co` | Mưu Cơ | 2 | 2 | skill / scheme, control / enemy | `applyStatus weak 2 chosen` + `chooseCard 1` | A | Mở sẵn |
| `m01_doi_van_doan` | Đổi Vận Đoán | 3 | 2 | skill / scheme, moon / none | `shiftMoon 1` + `chooseCard 2` | A | Mở sẵn |
| `m01_lien_hoan_ke` | Liên Hoàn Kế | 4 | 2 | skill / scheme / none | `conditional(cardsPlayedThisTurnAtLeast 2 → gainMoonPower 3; else gainMoonPower 1)` + `chooseCard 2` | A | Khóa |
| `m01_vo_trung_sinh_huu` | Vô Trung Sinh Hữu | 5 | 1 | skill / scheme / none | `gainMoonPower 3` + `chooseCard 3` | A | Khóa |
| `m01_mat_thu` | Mật Thư | 1 | 3 | skill / scheme, control / enemy | `drainMoonPower 2 chosen` + `chooseCard 1` | B | Mở sẵn |
| `m01_toa_nguyet_phu` | Tỏa Nguyệt Phù | 2 | 2 | skill / scheme, control / enemy | `drainMoonPower 3 chosen` + `damage 3 chosen` | B | Mở sẵn |
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

- Thăng cấp: `cardsChosen` ≥ 4 (Tinh Hồn 2: 3) → **Vạn Kim** `freeChooseCardPerTurn { look: 4 }`: đầu lượt (sau rút bù) Chiêm Bài 4 miễn phí.
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
| `m03_tu_tin` | Tụ Tin | 2 | 2 | skill / scheme / none | `conditional(heldTurnsAtLeast 2 → gainMoonPower 4; else gainMoonPower 2)` | B | Khóa |
| `m03_kim_tien` | Kim Tiền | 2 | 2 | attack / attack / enemy | `damage 5 chosen` + `gainMoonPower 1` | B | Mở sẵn |
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
| `m04_duong_mach` | Dưỡng Mạch | 3 | 2 | skill / heal, harmony / none | `heal 3 allAllies` + `gainArmor 3 allAllies` + `damage 2 allEnemies` | B | Mở sẵn |
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

---

## 11. GĐ7 — Hero đợt 2 + Song Hành

Bốn Hero đợt 2 của GĐ7 (spec `18` §2): M07 Ninh An (rare · Bạch Lộ · specialist ·
HP 34), M08 Khương Tịch (legendary · Xích Diên · controller · HP 30), M10 Chu
Quyết (rare · Thanh Loan · striker · HP 30), F08 Phượng Chiêu Dung (legendary ·
Xích Diên · striker · HP 34). HP PvP = HP PvE + 12: 46 / 42 / 42 / 46.

### 11.1 M07 — Ninh An

Nhánh A **Hồn Nhiên**: buff đồng đội (`strength`, `empower`, `regen`, `stealth`),
hồi máu, giáp — buff-bot thuần, không lá nào tự nuôi bộ đếm. Nhánh B **Thức
Tỉnh**: cỗ máy Huyết Nguyệt tự duy trì (`bloodMoon`, `conditional
bloodMoonActive`) — không `loseHp`, không tag `forbidden` (đất diễn của F02/F08).

- Thăng cấp: `turnsSurvived` ≥ 4 (Tinh Hồn 2: 3) → **Huyết Mạch** `randomBuffPerTurn`: đầu lượt nhận 1 buff ngẫu nhiên từ `combatConfig.levelUpRandomBuffs` (Sức Mạnh 1 / Cường Hóa 3 / Hồi Phục 3 / Phản Đòn 2).
- Dạng hai **Huyết Nguyệt Chi Tử**: `bloodMoonImmune` — Ninh An không mất HP vì Huyết Nguyệt.

| Id | Tên | Cost | Copies | Loại / Tag / Target | Hiệu ứng | Nhánh | Mở sẵn / Khóa |
|---|---|---|---|---|---|---|---|
| `m07_co_vu` | Cổ Vũ | 1 | 3 | skill / harmony / ally | `applyStatus empower 2 chosen` + `heal 1 chosen` | A | Mở sẵn — **signature** |
| `m07_tam_y` | Tâm Ý | 1 | 3 | skill / heal / ally | `heal 2 chosen` + `applyStatus regen 2 chosen` | A | Mở sẵn |
| `m07_ho_tong` | Hộ Tống | 2 | 2 | skill / ward / ally | `gainArmor 4 chosen` + `applyStatus stealth 1 chosen` | A | Mở sẵn |
| `m07_dong_cam` | Đồng Cam | 3 | 2 | skill / harmony / none | `applyStatus strength 1 allAllies` | A | Khóa |
| `m07_phu_ho` | Phù Hộ | 4 | 2 | skill / heal / none | `heal 3 allAllies` + `applyStatus regen 2 allAllies` | A | Khóa |
| `m07_thien_chan` | Thiên Chân | 5 | 1 | skill / harmony / none | `applyStatus empower 3 allAllies` + `applyStatus regen 3 allAllies` + `heal 2 allAllies` | A | Khóa |
| `m07_trieu_huyet` | Triệu Huyết | 1 | 3 | skill / moon / none | `bloodMoon 1` + `heal 2 self` | B | Mở sẵn |
| `m07_huyet_anh` | Huyết Ảnh | 2 | 2 | attack / attack, moon / enemy | `conditional(bloodMoonActive → damage 8 chosen; else damage 5 chosen)` | B | Mở sẵn |
| `m07_dong_huyet` | Đồng Huyết | 2 | 2 | skill / moon, heal / none | `conditional(bloodMoonActive → heal 4 allAllies; else heal 2 allAllies)` | B | Mở sẵn |
| `m07_huyet_te` | Huyết Tế | 3 | 2 | skill / moon / none | `bloodMoon 2` + `gainMoonPower 1` | B | Khóa |
| `m07_tinh_huyet` | Tịnh Huyết | 4 | 2 | skill / moon, ward / none | `cleanse allAllies` + `conditional(bloodMoonActive → gainArmor 4 allAllies; else gainArmor 2 allAllies)` | B | Khóa |
| `m07_xich_nguyet` | Xích Nguyệt | 6 | 1 | skill / moon, harmony / none | `bloodMoon 3` + `heal 5 allAllies` + `applyStatus empower 2 allAllies` | B | Khóa |
| `m07_co_vu_plus` | Cổ Vũ+ | 1 | 3 | skill / harmony / ally | `applyStatus empower 3 chosen` + `heal 2 chosen` | — | (lá +) |

### 11.2 M08 — Khương Tịch

Nhánh A **Đổi Vận**: `shiftMoon` (cả lùi pha), Chiêm Bài, khống chế theo pha.
Nhánh B **Huyết Thiên**: gọi và tận dụng Huyết Nguyệt — di sản sư phụ của F08.
5 lá có `shiftMoon` (6 tính lá "+") → ngưỡng `moonShifts` 3 đạt trong 1–2 lượt.

- Thăng cấp: `moonShifts` ≥ 3 (Tinh Hồn 2: 3) → **Quan Tinh** `chooseMoon`: đầu lượt mở Chọn Pha (giữ pha / tiến 1 / tiến 2).
- Dạng hai **Tinh Mệnh**: `moonShiftWeakensEnemies 1` — mỗi lá có `shiftMoon` của Khương Tịch áp Suy Yếu 1 lên mọi kẻ địch.

| Id | Tên | Cost | Copies | Loại / Tag / Target | Hiệu ứng | Nhánh | Mở sẵn / Khóa |
|---|---|---|---|---|---|---|---|
| `m08_doi_van` | Đổi Vận | 1 | 3 | skill / moon / none | `shiftMoon 1` | A | Mở sẵn — **signature** |
| `m08_tinh_tuong` | Tinh Tượng | 1 | 3 | skill / moon / none | `chooseCard 2` | A | Mở sẵn |
| `m08_chuyen_van` | Chuyển Vận | 2 | 2 | skill / moon / none | `shiftMoon 1` + `gainMoonPower 1` | A | Mở sẵn |
| `m08_suy_van` | Suy Vận | 2 | 2 | skill / moon, control / enemy | `shiftMoon 1` + `applyStatus weak 2 chosen` | A | Mở sẵn |
| `m08_nghich_van` | Nghịch Vận | 3 | 2 | skill / moon / none | `shiftMoon -1` | A | Khóa |
| `m08_thien_doi` | Thiên Đổi | 5 | 1 | skill / moon / none | `shiftMoon 2` + `chooseCard 2` | A | Khóa |
| `m08_huyet_chiem` | Huyết Chiêm | 1 | 3 | skill / moon / none | `conditional(bloodMoonActive → gainMoonPower 2; else gainMoonPower 1)` | B | Mở sẵn |
| `m08_huyet_hoa` | Huyết Hỏa | 2 | 2 | attack / attack, moon / enemy | `conditional(bloodMoonActive → damage 9 chosen; else damage 6 chosen)` | B | Mở sẵn |
| `m08_huyet_khai` | Huyết Khai | 2 | 2 | skill / forbidden, moon / none | `loseHp 2 self` + `bloodMoon 2` | B | Khóa |
| `m08_xich_van` | Xích Vận | 3 | 2 | skill / moon, control / none | `conditional(bloodMoonActive → applyStatus weak 2 allEnemies; else applyStatus weak 1 allEnemies)` | B | Khóa |
| `m08_phan_van` | Phản Vận | 4 | 2 | skill / moon, control / enemy | `drainMoonPower 2 chosen` + `conditional(bloodMoonActive → applyStatus vulnerable 2 chosen)` | B | Khóa |
| `m08_diet_tinh` | Diệt Tinh | 6 | 1 | attack / attack, moon / none | `bloodMoon 2` + `damage 8 allEnemies` | B | Khóa |
| `m08_doi_van_plus` | Đổi Vận+ | 1 | 3 | skill / moon / none | `shiftMoon 2` | — | (lá +) |

*Ghi chú:* `m08_nghich_van` là lá `shiftMoon` âm đầu tiên (trăng lùi 1 pha).
`m08_huyet_khai` tag `forbidden` + `loseHp self` chỉ mang ý nghĩa cost/theme —
đơn vị hành động là M08 nên không nuôi `forbiddenHpLost`.

### 11.3 M10 — Chu Quyết

Nhánh A **Khổ Học**: Tích Tụ (`heldTurnsAtLeast`) trên lá `scheme`. Nhánh B
**Hàn Môn**: Liên Hoàn (`cardsPlayedThisTurnAtLeast`) và đòn nhiều hit. 9 lá tag
`scheme` → `studyPoints` = +1/lượt (từ vòng 2) + +1/lá scheme đạt ngưỡng 5 trong
2–3 lượt. Hai nhánh đối lập nhịp chơi: Tích Tụ muốn giữ lá (chậm) vs Liên Hoàn
muốn xả lá (nhanh).

- Thăng cấp: `studyPoints` ≥ 5 (Tinh Hồn 2: 4) → **Bác Học** `firstSchemeRepeats`: lá `scheme` đầu tiên mỗi lượt của Chu Quyết giải quyết effect 2 lần (lượt 1 bỏ `chooseCard`).
- Dạng hai **Trạng Nguyên**: `comboAttackBonus 1` — lá tấn công của Chu Quyết +1 damage mỗi hit cho mỗi lá đã đánh trước nó trong lượt.

| Id | Tên | Cost | Copies | Loại / Tag / Target | Hiệu ứng | Nhánh | Mở sẵn / Khóa |
|---|---|---|---|---|---|---|---|
| `m10_kho_hoc` | Khổ Học | 1 | 3 | skill / scheme / none | `conditional(heldTurnsAtLeast 2 → gainMoonPower 3; else gainMoonPower 1)` | A | Mở sẵn — **signature** |
| `m10_tich_doc` | Tích Đọc | 1 | 3 | skill / scheme / none | `conditional(heldTurnsAtLeast 2 → gainMoonPower 2)` + `chooseCard 2` | A | Mở sẵn |
| `m10_tu_luc` | Tự Lực | 2 | 2 | attack / attack, scheme / enemy | `damage 5 chosen` + `conditional(heldTurnsAtLeast 1 → damage 3 chosen)` | A | Mở sẵn |
| `m10_van_luan` | Văn Luận | 3 | 2 | skill / scheme, control / enemy | `applyStatus weak 2 chosen` + `conditional(heldTurnsAtLeast 2 → applyStatus weak 1 allEnemies)` | A | Mở sẵn |
| `m10_da_tuc` | Dạ Tục | 4 | 2 | skill / scheme / none | `conditional(heldTurnsAtLeast 2 → gainMoonPowerPerTurn 1; else gainMoonPower 2)` + `chooseCard 1` | A | Khóa |
| `m10_thong_huyen` | Thông Huyền | 5 | 1 | skill / scheme / none | `conditional(heldTurnsAtLeast 3 → gainMoonPower 5; else gainMoonPower 2)` + `chooseCard 2` | A | Khóa |
| `m10_han_mon` | Hàn Môn | 1 | 3 | attack / attack, scheme / enemy | `conditional(cardsPlayedThisTurnAtLeast 1 → damage 5 chosen; else damage 3 chosen)` | B | Mở sẵn |
| `m10_liet_but` | Liệt Bút | 2 | 2 | attack / attack / enemy | `damage 4 chosen` + `conditional(cardsPlayedThisTurnAtLeast 2 → damage 4 chosen)` | B | Mở sẵn |
| `m10_phan_doc` | Phấn Độc | 2 | 2 | skill / scheme / none | `conditional(cardsPlayedThisTurnAtLeast 2 → gainMoonPower 2; else gainMoonPower 1)` + `chooseCard 1` | B | Khóa |
| `m10_bach_chien` | Bách Chiến | 3 | 2 | attack / attack / enemy | `damage 3 chosen hits 2` + `conditional(cardsPlayedThisTurnAtLeast 3 → damage 3 chosen)` | B | Khóa |
| `m10_dien_kinh` | Điển Kinh | 4 | 2 | skill / scheme / none | `conditional(cardsPlayedThisTurnAtLeast 2 → gainMoonPower 3)` + `chooseCard 2` | B | Khóa |
| `m10_lien_nguyen` | Liên Nguyên | 6 | 1 | attack / attack / enemy | `damage 4 chosen hits 3` + `conditional(cardsPlayedThisTurnAtLeast 4 → damage 4 chosen)` | B | Khóa |
| `m10_kho_hoc_plus` | Khổ Học+ | 1 | 3 | skill / scheme / none | `conditional(heldTurnsAtLeast 2 → gainMoonPower 4; else gainMoonPower 2)` | — | (lá +) |

*Ghi chú:* *Bác Học* nhân đôi cả lá `scheme` tấn công (Tự Lực, Hàn Môn) — chuỗi
"đòn kép của kẻ hàn môn" là payoff chính; đánh dấu theo dõi cân bằng ở 7a.6.

### 11.4 F08 — Phượng Chiêu Dung

Nhánh A **Huyết Phượng**: Cấm Thuật (`forbidden` + `loseHp self`), Phẫn Huyết
(`missingHpDamage`). Nhánh B **Nghịch Mệnh**: gọi Huyết Nguyệt (`bloodMoon`), lá
`requiresBloodMoon`. 11 lá `forbidden` tự mất HP (36 HP khả dụng) → ngưỡng
`forbiddenHpLost` 12 đạt sau ~4 lá, ngay trước khi HP thấp nguy hiểm.

- Thăng cấp: `forbiddenHpLost` ≥ 12 (Tinh Hồn 2: 9) → **Huyết Phượng** `forbiddenNoSelfHpLoss`: `loseHp` nhắm `self` trong lá `forbidden` của Phượng Chiêu Dung bị bỏ qua.
- Dạng hai **Phản Sư**: `bloodMoonAttackBonus 3` — khi Huyết Nguyệt, mọi hit của lá Phượng Chiêu Dung +3 damage.

| Id | Tên | Cost | Copies | Loại / Tag / Target | Hiệu ứng | Nhánh | Mở sẵn / Khóa |
|---|---|---|---|---|---|---|---|
| `f08_huyet_vu` | Huyết Vũ | 1 | 3 | skill / forbidden / none | `loseHp 2 self` + `gainMoonPower 2` | A | Mở sẵn |
| `f08_phe_mac` | Phệ Mạch | 2 | 2 | attack / attack, forbidden / enemy | `loseHp 2 self` + `damage 7 chosen` | A | Mở sẵn — **signature** |
| `f08_phan_huyet` | Phẫn Huyết | 3 | 2 | attack / attack, forbidden / enemy | `loseHp 3 self` + `missingHpDamage 0.5 chosen` | A | Mở sẵn |
| `f08_lieu_hoa` | Liệu Hỏa | 4 | 2 | attack / attack, forbidden / enemy | `loseHp 3 self` + `damage 9 chosen` + `applyStatus burn 2 chosen` | A | Khóa |
| `f08_cam_chu` | Cấm Chú | 4 | 2 | skill / forbidden, control / enemy | `loseHp 3 self` + `drainMoonPower 2 chosen` + `applyStatus vulnerable 2 chosen` | A | Khóa |
| `f08_niet_ban` | Niết Bàn | 6 | 1 | attack / attack, forbidden / none | `loseHp 5 self` + `missingHpDamage 1 allEnemies` | A | Khóa |
| `f08_huyet_trieu` | Huyết Triều | 1 | 3 | skill / forbidden, moon / none | `loseHp 3 self` + `bloodMoon 1` | B | Mở sẵn |
| `f08_dinh_menh` | Định Mệnh | 2 | 2 | skill / moon / none | `bloodMoon 1` + `shiftMoon 1` | B | Mở sẵn |
| `f08_huyet_vuc` | Huyết Vực | 3 | 2 | attack / attack, forbidden / enemy | `loseHp 2 self` + `damage 6 chosen hits 2` | B | Mở sẵn |
| `f08_nghich_thien` | Nghịch Thiên | 4 | 2 | skill / forbidden, moon / none | `loseHp 4 self` + `bloodMoon 2` + `gainMoonPower 2` | B | Khóa |
| `f08_phan_menh` | Phản Mệnh | 5 | 1 | attack / attack, forbidden / enemy | `requiresBloodMoon` + `loseHp 4 self` + `damage 18 chosen` | B | Khóa |
| `f08_phuong_nghich` | Phượng Nghịch | 6 | 1 | attack / attack, forbidden / none | `requiresBloodMoon` + `loseHp 5 self` + `damage 5 allEnemies hits 3` | B | Khóa |
| `f08_phe_mac_plus` | Phệ Mạch+ | 2 | 2 | attack / attack, forbidden / enemy | `loseHp 2 self` + `damage 9 chosen` | — | (lá +) |

### 11.5 Lá Song Hành đợt 2

Bốn lá Song Hành mới theo `18` §2.3: `bond: { owners }` thay `ownerId`; `actor`
trên từng effect chỉ ghế trong `bond.owners` (`0` = chủ thứ nhất, `1` = chủ thứ
hai — effect giải quyết như Hero đó đánh, nuôi bộ đếm của Hero đó). `copies` = 2
theo quy tắc cost 2–4.

| Id | Tên | Cost | Copies | Owners | Hiệu ứng | Loại / Tag / Target |
|---|---|---|---|---|---|---|
| `bond_nguyet_sach` | Nguyệt Sách | 3 | 2 | m01 + f01 | `shiftMoon 1` (actor 1 — F01) + `gainMoonPower 1` (actor 0 — M01) + `chooseCard 2` (actor 0 — M01) — "Thẩm Nguyệt Hoa Đổi Vận 1 pha. Tạ Vân Chiêu nhận 1 Nguyệt Lực và Chiêm Bài 2." | skill / moon, scheme / none |
| `bond_than_ve` | Thân Vệ | 2 | 2 | m02 + m01 | `applyStatus guard 1 chosen` (actor 0 — M02) + `gainArmor 4 self` (actor 0 — M02) — "Lục Hàn Phong Hộ Vệ 1 đồng đội 1 vòng và nhận 4 giáp." | skill / ward / ally |
| `bond_kim_but_dong_tam` | Kim Bút Đồng Tâm | 2 | 2 | m03 + m10 | `drawCards 2` (actor 0 — M03) + `gainMoonPower 1` (actor 1 — M10) — "Mặc Tử Du rút 2 lá. Chu Quyết nhận 1 Nguyệt Lực." | skill / scheme / none |
| `bond_su_do_nghich_menh` | Sư Đồ Nghịch Mệnh | 3 | 2 | m08 + f08 | `bloodMoon 1` (actor 1 — F08) + `shiftMoon 1` (actor 0 — M08) — "Phượng Chiêu Dung gọi Huyết Nguyệt 1 vòng. Khương Tịch Đổi Vận 1 pha." | skill / moon, forbidden / none |

*Ghi chú:* `bond_than_ve` không ép được mục tiêu = M01 bằng dữ liệu (`target`
chỉ có none/enemy/ally) — text gợi ý chọn M01; tự đặt `guard` lên M02 là no-op.
`bond_su_do_nghich_menh` dùng `shiftMoon` cố định, **không** mở Chọn Pha (Chọn
Pha chỉ là nội tại `chooseMoon` của M08); `shiftMoon` actor 0 nuôi `moonShifts`
của M08. Tag `scheme` của Nguyệt Sách / Kim Bút Đồng Tâm nuôi `schemeCardsPlayed`
của cả đội nhưng không nuôi `studyPoints` (lá Song Hành không tính).

## 12. GĐ7b — 6 Hero đợt 2 + Linh Thú + Song Hành

Sáu Hero đợt 2 của GĐ7 (spec `18` §3): F05 Hạ Chi (rare · Huyền Vũ · striker ·
HP 32), F06 Lam Khê (epic · Bạch Lộ · controller · HP 30), F07 Cố Uyển (rare ·
Thanh Loan · controller · HP 30), F09 Tiểu Mãn (common · Bạch Lộ · specialist ·
HP 28), F10 Liễu Tịnh Nhan (legendary · Trung lập · support · HP 30), M09 Đoàn
Lạc (epic · Bạch Lộ · controller · HP 32). HP PvP = HP PvE + 12, đã chỉnh sau
playtest 7b.6 (`playtest-notes.md` — F06/F07 +2, F09 −2): 44 / 44 / 44 / 38 /
42 / 44.

Cơ chế mới đi kèm (`01` §5.6, §17): trạng thái **Mê Hoặc** (`charm`), effect
**Phong Ấn** (`sealIntent` — đơn vị bị dấu một lượt, chiêu/lá/hành động nó đánh
ra chỉ còn `damage`), **Hồi Hồn** (`revive`), **Kéo Dài** debuff
(`extendDebuffs`), **Xuyên** mục tiêu (hàng sau + `pierceOwnAttacks`) và **Linh
Thú** (`summon`). `keywords.json` thêm `me_hoac`, `phong_an`, `hoi_hon`,
`linh_thu`, `keo_dai`.

### 12.1 F05 — Hạ Chi

Nhánh A **Liệp Thủ**: Đánh Dấu (`mark`) và đòn trả thêm khi mục tiêu bị dấu.
Nhánh B **Tiễn Vũ**: đa đòn (`hits`) và Liên Hoàn (`cardsPlayedThisTurnAtLeast`).
Chín lá tấn công đơn mục tiêu nuôi `backRowHits` mỗi khi trúng hàng sau.

- Thăng cấp: `backRowHits` ≥ 4 (Tinh Hồn 2: 3) → **Xuyên Vân Tiễn** `pierceOwnAttacks`: mọi đòn đơn mục tiêu từ lá của Hạ Chi đánh thêm kẻ địch đứng ngay sau mục tiêu, cùng damage gốc.
- Dạng hai **Biên Tái**: `firstHitMarks 1` — đòn đánh đầu tiên mỗi lượt từ lá tấn công của Hạ Chi, nếu trúng, áp Đánh Dấu 1 vòng.

| Id | Tên | Cost | Copies | Loại / Tag / Target | Hiệu ứng | Nhánh | Mở sẵn / Khóa |
|---|---|---|---|---|---|---|---|
| `f05_liet_nham` | Liệp Nhắm | 1 | 3 | attack / attack, assassin / enemy | `damage 3 chosen` + `applyStatus mark 1 chosen` — "Gây 3 damage. Đánh Dấu 1 vòng." | A | Mở sẵn — **signature** |
| `f05_truy_anh` | Truy Ảnh | 2 | 2 | attack / attack, assassin / enemy | `damage 4 chosen` + `conditional(targetHasStatus mark → damage 3 chosen)` — "Gây 4 damage. Mục tiêu đang bị Đánh Dấu: gây thêm 3." | A | Mở sẵn |
| `f05_diem_menh` | Điểm Mệnh | 3 | 2 | skill / control / enemy | `applyStatus mark 2 chosen` + `applyStatus vulnerable 1 chosen` | A | Mở sẵn |
| `f05_ha_uy` | Hạ Uy | 4 | 2 | attack / attack, assassin / enemy | `damage 7 chosen` + `applyStatus mark 2 chosen` | A | Khóa |
| `f05_xa_nhat` | Xạ Nhật | 5 | 1 | attack / attack, assassin / enemy | `damage 9 chosen` + `conditional(targetHasStatus mark → damage 5 chosen)` | A | Khóa |
| `f05_tuyet_diem` | Tuyệt Điểm | 6 | 1 | attack / attack, assassin / enemy | `damage 10 chosen` + `conditional(targetHpAtOrBelow 0.5 → damage 5 chosen)` | A | Khóa |
| `f05_lien_chau` | Liên Châu | 1 | 3 | attack / attack / enemy | `damage 2 chosen hits 2` | B | Mở sẵn |
| `f05_loan_tien` | Loạn Tiễn | 2 | 2 | attack / attack / enemy | `damage 2 chosen hits 2` + `conditional(cardsPlayedThisTurnAtLeast 2 → damage 2 chosen)` — "Gây 2 damage 2 lần. Liên Hoàn 2: thêm 1 đòn." | B | Mở sẵn |
| `f05_vu_ten` | Vũ Tiễn | 3 | 2 | attack / attack / none | `damage 3 allEnemies` | B | Mở sẵn |
| `f05_cuu_lien` | Cửu Liên | 4 | 2 | attack / attack / enemy | `damage 2 chosen hits 3` + `conditional(cardsPlayedThisTurnAtLeast 3 → damage 2 chosen)` — "Gây 2 damage 3 lần. Liên Hoàn 3: thêm 1 đòn." | B | Khóa |
| `f05_bach_ten` | Bách Tiễn | 5 | 1 | attack / attack / none | `damage 3 allEnemies hits 2` | B | Khóa |
| `f05_van_ten` | Vạn Tiễn | 6 | 1 | attack / attack / enemy | `damage 4 chosen hits 3` | B | Khóa |
| `f05_liet_nham_plus` | Liệp Nhắm+ | 1 | 3 | attack / attack, assassin / enemy | `damage 4 chosen` + `applyStatus mark 2 chosen` | — | (lá +) |

### 12.2 F06 — Lam Khê

Nhánh A **Kinh Hồng**: Mê Hoặc (`charm`) — kẻ địch bị Mê Hoặc đánh kẻ địch khác.
Nhánh B **Tin Mật**: Suy Yếu, Dễ Vỡ, Chiêm Bài. Sáu lá gây `charm` → `charmsApplied`
2 đạt trong 1–2 cast.

- Thăng cấp: `charmsApplied` ≥ 2 (Tinh Hồn 2: 2) → **Kinh Hồng Vũ** `charmMastery { extraCharges: 1, damageMultiplier: 1.5 }`: Mê Hoặc do Lam Khê gây thêm 1 lượt; đòn bị đổi mục tiêu của kẻ địch đó ×1.5 khi Lam Khê còn sống.
- Dạng hai **Vũ Y**: `stealthOnCharm 1` — mỗi khi Lam Khê gây Mê Hoặc, nàng Ẩn Thân 1 vòng.

| Id | Tên | Cost | Copies | Loại / Tag / Target | Hiệu ứng | Nhánh | Mở sẵn / Khóa |
|---|---|---|---|---|---|---|---|
| `f06_me_vu` | Mê Vũ | 1 | 3 | skill / harmony, control / enemy | `applyStatus charm 1 chosen` — "Mê Hoặc 1 chiêu đã báo của mục tiêu." | A | Mở sẵn — **signature** |
| `f06_quyen_muc` | Quyến Mục | 2 | 2 | skill / harmony, control / enemy | `applyStatus charm 1 chosen` + `applyStatus weak 1 chosen` | A | Mở sẵn |
| `f06_hong_vu` | Hồng Vũ | 3 | 2 | skill / harmony, control / enemy | `applyStatus charm 2 chosen` | A | Mở sẵn |
| `f06_dien_dao` | Điên Đảo | 4 | 2 | skill / harmony, control / enemy | `applyStatus charm 2 chosen` + `applyStatus vulnerable 2 chosen` | A | Khóa |
| `f06_khuynh_tam` | Khuynh Tâm | 5 | 1 | skill / harmony, control / enemy | `applyStatus charm 3 chosen` | A | Khóa |
| `f06_kinh_hong_chieu` | Kinh Hồng Chiếu | 6 | 1 | skill / harmony, control / none | `applyStatus charm 1 allEnemies` | A | Khóa |
| `f06_co_mat` | Cơ Mật | 1 | 3 | skill / harmony / none | `chooseCard 2` — "Chiêm Bài 2." | B | Mở sẵn |
| `f06_mat_ham` | Mật Hàm | 2 | 2 | skill / harmony, control / enemy | `applyStatus weak 2 chosen` + `damage 2 chosen` + `chooseCard 1` | B | Mở sẵn |
| `f06_phong_thu` | Phong Thư | 2 | 2 | skill / harmony / none | `drawCards 1` + `gainMoonPower 1` | B | Mở sẵn |
| `f06_doan_tin` | Đoạn Tin | 3 | 2 | skill / harmony, control / enemy | `applyStatus weak 2 chosen` + `applyStatus vulnerable 1 chosen` | B | Khóa |
| `f06_loan_am` | Loạn Âm | 4 | 2 | skill / harmony, control / none | `applyStatus weak 2 allEnemies` | B | Khóa |
| `f06_cuc_mat` | Cực Mật | 5 | 1 | skill / harmony, control / enemy | `applyStatus weak 3 chosen` + `chooseCard 3` | B | Khóa |
| `f06_me_vu_plus` | Mê Vũ+ | 1 | 3 | skill / harmony, control / enemy | `applyStatus charm 1 chosen` + `applyStatus stealth 1 self` | — | (lá +) |

### 12.3 F07 — Cố Uyển

Nhánh A **Sử Bút**: Phong Ấn (`sealIntent`) — đặt dấu lên đơn vị địch; trong lượt
kế của nó mọi chiêu/lá nó đánh ra chỉ còn `damage`, mất hiệu ứng khác. Nhánh B
**Thư Hải**: `scheme`, Chiêm Bài, Tích Tụ. `intentsSealed` cộng theo số chiêu/lá
thực sự bị tước hiệu ứng ở lượt kế — bảy lá `sealIntent` nuôi bộ đếm.

- Thăng cấp: `intentsSealed` ≥ 3 (Tinh Hồn 2: 2) → **Sử Bút** `sealExtraFirstPerTurn`: lần Phong Ấn đầu tiên mỗi lượt của Cố Uyển còn đặt dấu lên kẻ địch khác (vị trí nhỏ nhất).
- Dạng hai **Chép Sử**: `sealWeakens 1` — Phong Ấn của Cố Uyển còn áp Suy Yếu 1 vòng lên mục tiêu.

| Id | Tên | Cost | Copies | Loại / Tag / Target | Hiệu ứng | Nhánh | Mở sẵn / Khóa |
|---|---|---|---|---|---|---|---|
| `f07_phong_an` | Phong Ấn | 1 | 3 | skill / scheme, control / enemy | `sealIntent chosen` — "Phong Ấn mục tiêu 1 lượt: chiêu của nó chỉ còn damage." | A | Mở sẵn — **signature** |
| `f07_doat_but` | Đoạt Bút | 2 | 2 | skill / scheme, control / enemy | `sealIntent chosen` + `damage 3 chosen` | A | Mở sẵn |
| `f07_phe_but` | Phê Bút | 3 | 2 | skill / scheme, control / enemy | `sealIntent chosen` + `applyStatus weak 1 chosen` | A | Mở sẵn |
| `f07_thiet_but` | Thiết Bút | 4 | 2 | skill / scheme, control / enemy | `sealIntent chosen` × 2 | A | Khóa |
| `f07_cam_su` | Cấm Sử | 5 | 1 | skill / scheme, control / enemy | `sealIntent chosen` + `applyStatus weak 2 chosen` + `applyStatus vulnerable 1 chosen` | A | Khóa |
| `f07_doan_su` | Đoạn Sử | 6 | 1 | skill / scheme, control / none | `sealIntent allEnemies` | A | Khóa |
| `f07_thu_hai` | Thư Hải | 1 | 3 | skill / scheme / none | `chooseCard 2` — "Chiêm Bài 2." | B | Mở sẵn |
| `f07_dien_co` | Điển Cố | 2 | 2 | skill / scheme / none | `gainMoonPower 1` + `chooseCard 1` | B | Mở sẵn |
| `f07_doc_dien` | Độc Điển | 3 | 2 | skill / scheme / none | `conditional(cardsPlayedThisTurnAtLeast 2 → gainMoonPower 2)` + `chooseCard 2` | B | Mở sẵn |
| `f07_tang_kinh` | Tàng Kinh | 4 | 2 | skill / scheme / none | `gainMoonPower 1` + `chooseCard 3` | B | Khóa |
| `f07_phan_dinh` | Phán Định | 4 | 2 | skill / scheme, control / enemy | `sealIntent chosen` + `chooseCard 1` | B | Khóa |
| `f07_van_quyen` | Vạn Quyển | 5 | 1 | skill / scheme / none | `conditional(heldTurnsAtLeast 2 → drawCards 3; else drawCards 1)` — "Tích Tụ 2: rút 3 lá; chưa đủ: rút 1." | B | Khóa |
| `f07_phong_an_plus` | Phong Ấn+ | 1 | 3 | skill / scheme, control / enemy | `sealIntent chosen` + `applyStatus weak 1 chosen` | — | (lá +) |

### 12.4 F09 — Tiểu Mãn

Nhánh A **Linh Thố**: triệu hồi và buff **Thỏ Ngọc** (`summon tho_ngoc`, giáp,
Sức Mạnh, Khiêu Khích lên `summon`) — cả 6 lá đều nuôi `summonsMade`, cộng thêm lá
Song Hành `bond_nguyet_tho_ho_menh`. Nhánh B **Nguyệt Dược**: hồi máu, Hồi Phục
(`regen`), tẩy debuff — lá nhắm `ally` tính cả Linh Thú cùng chủ.

- Thăng cấp: `summonsMade` ≥ 6 (Tinh Hồn 2: 5) → **Thỏ Ngọc Thức Tỉnh** `awakenSummons`: Linh Thú của Tiểu Mãn dùng bản thức tỉnh (18 HP, đòn 5 damage và hồi chủ 2 HP); Linh Thú đang sống đổi ngay, giữ tỉ lệ HP.
- Dạng hai **Nguyệt Cung**: `summonTaunts 1` — Linh Thú của Tiểu Mãn khi vừa được triệu hồi nhận Khiêu Khích 1 vòng.

| Id | Tên | Cost | Copies | Loại / Tag / Target | Hiệu ứng | Nhánh | Mở sẵn / Khóa |
|---|---|---|---|---|---|---|---|
| `f09_trieu_hoi` | Triệu Hồi | 1 | 3 | skill / harmony / none | `summon tho_ngoc` — "Triệu hồi Thỏ Ngọc. Đã có: hồi đầy HP và Sức Mạnh +1." | A | Mở sẵn — **signature** |
| `f09_ngoc_anh` | Ngọc Ảnh | 2 | 2 | skill / harmony / none | `summon tho_ngoc` + `gainArmor 2 summon` | A | Mở sẵn |
| `f09_moi_duong` | Mồi Dưỡng | 2 | 2 | skill / harmony / none | `summon tho_ngoc` + `applyStatus strength 1 summon` | A | Mở sẵn |
| `f09_tho_tinh` | Thố Tinh | 3 | 2 | skill / harmony / none | `summon tho_ngoc` + `chooseCard 1` | A | Khóa |
| `f09_linh_ke` | Linh Kế | 4 | 2 | skill / harmony / none | `summon tho_ngoc` + `gainArmor 3 summon` + `applyStatus strength 1 summon` | A | Khóa |
| `f09_nguyet_tho` | Nguyệt Thố | 5 | 1 | skill / harmony / none | `summon tho_ngoc` + `applyStatus taunt 2 summon` + `applyStatus strength 2 summon` | A | Khóa |
| `f09_ngoc_dao` | Ngọc Đảo | 1 | 3 | skill / heal, harmony / ally | `heal 3 chosen` — "Hồi 3 HP cho 1 đồng đội (tính cả Thỏ Ngọc)." | B | Mở sẵn |
| `f09_tao_duoc` | Tảo Dược | 2 | 2 | skill / heal, harmony / ally | `applyStatus regen 2 chosen` + `heal 2 chosen` | B | Mở sẵn |
| `f09_nguyet_duoc` | Nguyệt Dược | 3 | 2 | skill / heal / none | `heal 2 allAllies` + `applyStatus regen 1 allAllies` | B | Mở sẵn |
| `f09_tien_dan` | Tiên Đan | 4 | 2 | skill / heal, harmony / ally | `heal 5 chosen` + `applyStatus regen 2 chosen` | B | Khóa |
| `f09_dan_thanh` | Đan Thành | 5 | 1 | skill / heal / none | `heal 4 allAllies` + `applyStatus regen 2 allAllies` | B | Khóa |
| `f09_linh_duoc` | Linh Dược | 6 | 1 | skill / heal / ally | `heal 7 chosen` + `cleanse chosen` + `gainArmor 3 chosen` | B | Khóa |
| `f09_trieu_hoi_plus` | Triệu Hồi+ | 1 | 3 | skill / harmony / none | `summon tho_ngoc` + `gainArmor 3 summon` | — | (lá +) |

### 12.5 F10 — Liễu Tịnh Nhan

Nhánh A **Hồn Dẫn**: Hồi Hồn (`revive`, `target: "fallenAlly"` — chỉ đánh được khi
đã có đồng đội ngã), giáp, Ẩn Thân. Nhánh B **Tịnh Tâm**: hồi máu, tẩy debuff
(`cleanse`). `alliesFallen` đếm mọi Hero của phe ngã — tự chạy, không cần lá nuôi;
ba lá `fallenAlly` là payoff.

- Thăng cấp: `alliesFallen` ≥ 1 (Tinh Hồn 2: 1) → **Nguyệt Hồn** `passive: none` + `onLevelUp: [revive 0.3 lastFallen]` — khi thăng cấp, Hồi Hồn đồng đội đã ngã gần nhất với 30% HP tối đa.
- Dạng hai **Vong Xuyên**: `armorOnAllyFall 6` — mỗi khi đồng đội của Liễu Tịnh Nhan ngã, mọi Hero còn sống cùng phe nhận 6 giáp.

| Id | Tên | Cost | Copies | Loại / Tag / Target | Hiệu ứng | Nhánh | Mở sẵn / Khóa |
|---|---|---|---|---|---|---|---|
| `f10_dan_hon` | Dẫn Hồn | 1 | 3 | skill / moon / ally | `gainArmor 3 chosen` + `applyStatus stealth 1 chosen` | A | Mở sẵn |
| `f10_ho_phach` | Hộ Phách | 2 | 2 | skill / moon / ally | `heal 3 chosen` + `gainArmor 3 chosen` | A | Mở sẵn |
| `f10_hoi_hon` | Hồi Hồn | 3 | 2 | skill / moon / fallenAlly | `revive 0.3 chosen` — "Hồi sinh 1 đồng đội đã ngã với 30% HP tối đa." | A | Mở sẵn — **signature** |
| `f10_hon_quy` | Hồn Quy | 4 | 2 | skill / moon / none | `gainArmor 5 allAllies` | A | Khóa |
| `f10_trieu_hon` | Triệu Hồn | 5 | 1 | skill / moon / fallenAlly | `revive 0.5 chosen` + `gainArmor 4 chosen` | A | Khóa |
| `f10_luan_hoi` | Luân Hồi | 6 | 1 | skill / moon / fallenAlly | `revive 0.6 chosen` + `heal 4 allAllies` | A | Khóa |
| `f10_tinh_tam` | Tịnh Tâm | 1 | 3 | skill / moon, heal / ally | `cleanse chosen` + `gainArmor 2 chosen` | B | Mở sẵn |
| `f10_thanh_tam` | Thanh Tâm | 2 | 2 | skill / moon, heal / ally | `heal 4 chosen` + `cleanse chosen` | B | Mở sẵn |
| `f10_tay_tran` | Tẩy Trần | 3 | 2 | skill / moon, heal / none | `cleanse allAllies` + `heal 2 allAllies` + `damage 2 allEnemies` | B | Mở sẵn |
| `f10_khong_tuong` | Không Tướng | 4 | 2 | skill / moon / ally | `applyStatus stealth 2 chosen` + `heal 4 chosen` | B | Khóa |
| `f10_vong_uu` | Vong Ưu | 5 | 1 | skill / moon, heal / none | `applyStatus regen 2 allAllies` + `heal 3 allAllies` | B | Khóa |
| `f10_minh_nguyet` | Minh Nguyệt | 5 | 1 | skill / moon, heal / none | `heal 3 allAllies` + `conditional(moonPhaseIs full → heal 3 allAllies)` | B | Khóa |
| `f10_hoi_hon_plus` | Hồi Hồn+ | 3 | 2 | skill / moon / fallenAlly | `revive 0.5 chosen` + `gainArmor 3 chosen` | — | (lá +) |

### 12.6 M09 — Đoàn Lạc

Nhánh A **Khúc Sầu**: Suy Yếu / Dễ Vỡ lan (`weak`, `vulnerable`, cả `allEnemies`).
Nhánh B **Tri Âm**: Mê Hoặc (`charm`) — 6 lá charm. Mọi lá đều áp debuff →
`debuffsApplied` 6 đạt sau ~2–3 cast (AoE cộng theo số địch); `charm` là debuff
nhưng không có thời hạn nên không được `debuffDurationBonus` kéo dài.

- Thăng cấp: `debuffsApplied` ≥ 6 (Tinh Hồn 2: 5) → **Vong Quốc Khúc** `debuffDurationBonus 1`: debuff có thời hạn do Đoàn Lạc gây kéo dài thêm 1 vòng.
- Dạng hai **Nam Chiếu Hồn**: `bonusVsDebuffed { minDebuffs: 2, amount: 3 }` — đòn của lá tấn công Đoàn Lạc gây thêm 3 damage vào kẻ địch có ít nhất 2 debuff.

| Id | Tên | Cost | Copies | Loại / Tag / Target | Hiệu ứng | Nhánh | Mở sẵn / Khóa |
|---|---|---|---|---|---|---|---|
| `m09_khuc_sau` | Khúc Sầu | 1 | 3 | skill / harmony, control / enemy | `applyStatus weak 1 chosen` — "Suy Yếu 1 vòng." | A | Mở sẵn — **signature** |
| `m09_sau_cam` | Sầu Cầm | 2 | 2 | skill / harmony, control / enemy | `applyStatus weak 1 chosen` + `applyStatus vulnerable 1 chosen` | A | Mở sẵn |
| `m09_doan_truong` | Đoạn Trường | 3 | 2 | skill / harmony, control / none | `applyStatus weak 1 allEnemies` | A | Mở sẵn |
| `m09_ai_khuc` | Ai Khúc | 4 | 2 | attack / attack, harmony / enemy | `damage 4 chosen hits 2` + `applyStatus weak 1 chosen` | A | Khóa |
| `m09_ly_biet` | Ly Biệt | 4 | 2 | skill / harmony, control / enemy | `applyStatus weak 2 chosen` + `applyStatus vulnerable 2 chosen` | A | Khóa |
| `m09_quoc_pha` | Quốc Phá | 5 | 1 | skill / harmony, control / none | `applyStatus weak 2 allEnemies` + `applyStatus vulnerable 1 allEnemies` | A | Khóa |
| `m09_tri_am` | Tri Âm | 1 | 3 | skill / harmony, control / enemy | `applyStatus charm 1 chosen` — "Mê Hoặc 1 chiêu đã báo của mục tiêu." | B | Mở sẵn |
| `m09_tri_ky` | Tri Kỷ | 2 | 2 | skill / harmony, control / enemy | `applyStatus charm 1 chosen` + `applyStatus weak 1 chosen` | B | Mở sẵn |
| `m09_cam_khuc` | Cầm Khúc | 3 | 2 | attack / attack, harmony / enemy | `damage 5 chosen` + `applyStatus charm 1 chosen` | B | Mở sẵn |
| `m09_nhac_tan` | Nhạc Tận | 4 | 2 | skill / harmony, control / enemy | `applyStatus charm 1 chosen` + `extendDebuffs 1 chosen` — "Mê Hoặc 1 chiêu. Mọi debuff có thời hạn của mục tiêu +1 vòng." | B | Khóa |
| `m09_tuyet_am` | Tuyệt Âm | 5 | 1 | skill / harmony, control / enemy | `applyStatus charm 2 chosen` + `applyStatus weak 2 chosen` | B | Khóa |
| `m09_lac_khuc` | Lạc Khúc | 6 | 1 | skill / harmony, control / none | `applyStatus charm 1 allEnemies` + `applyStatus weak 1 allEnemies` | B | Khóa |
| `m09_khuc_sau_plus` | Khúc Sầu+ | 1 | 3 | skill / harmony, control / enemy | `applyStatus weak 2 chosen` + `applyStatus vulnerable 1 chosen` | — | (lá +) |

### 12.7 Linh Thú — `summons.json`

Mỗi Hero chủ có tối đa một Linh Thú (`01` §17): triệu hồi lại hồi đầy HP và cho
Sức Mạnh 1; cuối lượt người chơi nó tự hành động theo `targeting`; chủ ngã → nó
biến mất. `awakenedId` dùng khi chủ có nội tại `awakenSummons`.

| Id | Tên | HP | Targeting | Hành động cuối lượt | Thức tỉnh |
|---|---|---|---|---|---|
| `tho_ngoc` | Thỏ Ngọc | 12 | lowestHp | `damage 2 chosen` | → `tho_ngoc_thuc_tinh` |
| `tho_ngoc_thuc_tinh` | Thỏ Ngọc Thức Tỉnh | 18 | lowestHp | `damage 5 chosen` + `heal 2 owner` | — |

### 12.8 Lá Song Hành 7b

| Id | Tên | Cost | Copies | Owners | Hiệu ứng | Loại / Tag / Target |
|---|---|---|---|---|---|---|
| `bond_khuc_vu_tri_am` | Khúc Vũ Tri Âm | 3 | 2 | m09 + f06 | `applyStatus charm 1 chosen` (actor 0 — Đoàn Lạc) + `extendDebuffs 1 chosen` (actor 1 — Lam Khê) — "Mê Hoặc 1 chiêu đã báo (Đoàn Lạc); mọi debuff có thời hạn của mục tiêu +1 vòng (Lam Khê)." | skill / harmony, control / enemy |
| `bond_nguyet_tho_ho_menh` | Nguyệt Thố Hộ Mệnh | 3 | 2 | f09 + f10 | `summon tho_ngoc` (actor 0 — Tiểu Mãn) + `applyStatus taunt 1 summon` (actor 0) + `gainArmor 6 summon` (actor 0) — "Triệu hồi / triệu hồi lại Thỏ Ngọc; nó nhận Khiêu Khích 1 vòng và 6 giáp." | skill / harmony, moon / none |

*Ghi chú:* `to: "summon"` phân giải theo **actor** nên mọi effect của Nguyệt Thố
Hộ Mệnh buộc actor 0 (chỉ F09 có Linh Thú); charm của Khúc Vũ Tri Âm gắn actor 0
để nuôi `debuffsApplied` của M09.

---

## 13. Cốt Truyện — Arc 1–2 [GĐ7c]

Dàn ý theo `18` §4.5; schema `story.json` ở `02` §1.16, luật ở `14` §16, route ở `16`
§9. Dữ liệu chi tiết (kẻ địch, encounter, lời thoại, số thưởng) viết và duyệt ở bước
7c.4 / 7c.5.

Mỗi **Màn** (`stage`) là một trận cố định: `encounterId` trỏ encounter `tier: "story"`
(không vào bản đồ Lượt chơi, Trận lẻ lọc bỏ như `coop`), lời thoại `before` / `after`
(dòng `{ speaker, text }` — `speaker` là id Hero, id kẻ địch hoặc `narrator`), thưởng
`firstClear` (Nguyệt Ngọc, Huyền Thiết, XP Tu Luyện) chỉ trao ở lần qua đầu, và có thể
đặt `start` (pha trăng `moonIndex` / `bloodMoonRounds` đầu trận, `01` §2). Người chơi
tự chọn đội và deck; kết quả được server chạy lại xác nhận (`18` §4.3).

### 13.1 Arc 1 — Vọng Nguyệt (dễ, dạy dần luật)

| Màn | Tên | Ghi chú |
|---|---|---|
| 1 | Nhập Học | Khôi lỗi; trận hướng dẫn |
| 2 | Thanh Loan Thí Luận | Kẻ địch dùng Tỏa Nguyệt (`drainMoonPower` trong chiêu — `01` §9.3.2) |
| 3 | Huyền Vũ Thí Võ | Kẻ địch nhiều giáp / Phản Đòn |
| 4 | Bạch Lộ Thí Y | Kẻ địch hồi máu |
| 5 | Cấm Địa Xích Diên | Bắt đầu trong Huyết Nguyệt (`start.bloodMoonRounds`) |
| 6 | Tàng Thư Các Có Ma | `book_wraith` |
| 7 | Dạ Tập | `shadow_fox` |
| 8 | **Boss: Khảo Hạch Chi Linh** (mới) | Đổi hành vi theo pha trăng |

Qua Arc 1 tặng **M10 Chu Quyết** (Rare); đã có → +1 Tinh Hồn như gacha.

### 13.2 Arc 2 — Bóng Tối (ngang tầng 2–3 của Lượt chơi)

| Màn | Tên | Ghi chú |
|---|---|---|
| 1 | Thư Tín Mất Tích | |
| 2 | Mật Thám | F02 trong truyện |
| 3 | Vô Nguyệt Ám Sát | Kẻ địch Ẩn Thân / sát thủ |
| 4 | Tô Dạ Dao Động | M06 trong truyện |
| 5 | Chợ Đêm Tin Tức | |
| 6 | Quan Tinh Đài | M08 trong truyện; bắt đầu Trăng Non (`start.moonIndex`) |
| 7 | Hắc Vệ | `black_guard` |
| 8 | **Boss: Vô Nguyệt Ảnh Chủ** (mới) | Cướp buff, Ẩn Thân |

Qua Arc 2 tặng **F02 Diệp Linh Lung** (Epic); đã có → +1 Tinh Hồn.

**Kẻ địch mới:** ~3 thường mỗi arc + 1 boss mỗi arc; các màn còn lại dùng lại 7 kẻ địch
hiện có.

**Thưởng (khởi điểm, chốt ở 7d.6):** mỗi arc tổng ~400 Nguyệt Ngọc; Huyền Thiết 1–2 mỗi
màn, 5 ở boss arc; XP Tu Luyện theo màn; 1 Hero.

**Mục tiêu độ khó đã duyệt** (`18` §4.5): đo bằng bot, Bộ cơ bản `m05 + f04 + m06`, 80
seed — màn thường Arc 1 ≥ 80% thắng; boss Arc 1 ≥ 60%; màn thường Arc 2 55–75%; boss
Arc 2 40–60%; mỗi màn Arc 2 ≥ 60% với đội tốt nhất trong 3 đội mẫu.

---

### 13.3 Arc 1 — Vọng Nguyệt: nội dung chi tiết [GĐ7c.4]

**Đã duyệt (7c.4).** Số liệu là khởi điểm đã chốt bằng mô phỏng 80 seed (bot, Bộ cơ
bản `m05 + f04 + m06`) theo mục tiêu độ khó trên. Chỉ dùng effect / trạng thái /
điều kiện đã có trong `01`, `02`, `static.ts`.

Bối cảnh arc: năm nhất tại Vọng Nguyệt Thư Viện — người chơi qua các bài thí của bốn
Viện (**Thanh Loan** văn → **Huyền Vũ** võ → **Bạch Lộ** y → **Cấm Địa Xích Diên**
mở khe bất thường), gặp sự cố tại Tàng Thư Các và một vụ tập kích ban đêm, trước kỳ
khảo hạch tổng do linh thú gác cổng thi chủ trì. Định nghĩa arc (Phase B ghi vào
`story.json`): `arcs[0] = { id: "arc1", name: "Vọng Nguyệt", stageIds: [arc1_s01…arc1_s08], rewardHeroId: "m10" }`.

#### 13.3.1 Bảng màn

Mỗi màn `arc1_sNN` trỏ encounter `story_arc1_sNN` (`tier: "story"`, `name` = tên màn,
không vào pool Lượt chơi / Trận lẻ).

| # | Id màn | Tên | Kẻ địch (tổng HP) | `start` | `firstClear` Ngọc / Thiết / XP |
|---|---|---|---|---|---|
| 1 | `arc1_s01` | Nhập Học | `puppet_guard` (42) | — | 40 / 1 / 20 |
| 2 | `arc1_s02` | Thanh Loan Thí Luận | `thanh_loan_thi_quan` **mới** (38) | — | 45 / 1 / 25 |
| 3 | `arc1_s03` | Huyền Vũ Thí Võ | `huyen_vu_thi_quan` **mới** (48) | — | 50 / 1 / 25 |
| 4 | `arc1_s04` | Bạch Lộ Thí Y | `shadow_fox` + `bach_lo_thi_quan` **mới** (23+30 = 53) | — | 50 / 1 / 25 |
| 5 | `arc1_s05` | Cấm Địa Xích Diên | `book_wraith` + `shadow_fox` (55) | `bloodMoonRounds: 3` | 50 / 2 / 30 |
| 6 | `arc1_s06` | Tàng Thư Các Có Ma | `book_wraith` ×2 (64) | — | 55 / 2 / 30 |
| 7 | `arc1_s07` | Dạ Tập | `shadow_fox` ×3 (69) | — | 55 / 2 / 35 |
| 8 | `arc1_s08` | Khảo Hạch Chi Linh | `khao_hach_chi_linh` **boss mới** (80) | — | 55 / 5 / 40 |

**Tổng:** 400 Nguyệt Ngọc, 15 Huyền Thiết, XP Tu Luyện 20 → 40 theo màn (trả cho từng
Hero trong `setup.heroIds`, `14` §16.3). Qua màn 8 tặng `m10` Chu Quyết.

**Tuyến bài học** (theo `18` §4.5):

- **s01:** nhịp trận cơ bản; `puppet_guard` `start: 0` → vòng 1 Tụ Lực (chuỗi rỗng),
  dạy "địch cũng cần Nguyệt Lực".
- **s02:** Tỏa Nguyệt của địch rút `moonReserve` — dạy tiêu Nguyệt Lực đúng lúc.
- **s03:** giáp địch + Phản Đòn — dạy gom đòn lớn, `removeArmor`, và lượt thủ của địch.
- **s04:** địch hồi phục — dạy dồn sát thương / hạ bên hỗ trợ trước (hồi `allAllies`).
- **s05:** Huyết Nguyệt rút 2 HP mỗi Hero mỗi vòng — dạy kết thúc trận sớm.
- **s06:** debuff của địch (Dễ Vỡ, Thiêu Đốt, Đóng Băng).
- **s07:** bầy địch nhắm `lowestHp`; Ảnh Hồ mạnh lên ở Trăng Tròn (`moonOverrides`).
- **s08:** boss đổi chiêu theo pha trăng — `moonOverrides` là thông tin công khai
  (Nguyệt tính), dạy đọc pha trước khi ra tay.

#### 13.3.2 Kẻ địch mới

Ba "Thí Quan" là linh thể khảo thí do các Viện dựng lên — mỗi con một Viện, một bài
học. Theo tinh thần Nguyệt tính (luật mới), mỗi kẻ địch mới có đúng **1 `moonOverride`**
ở pha hợp viện; boss có **4** cho 4 pha từng có hiệu ứng (`new`, `firstQuarter`,
`full`, `lastQuarter`). `art.portrait` để `""`.

**`thanh_loan_thi_quan` — Thanh Loan Thí Quan** — `maxHp: 38`, `moonPower { start: 1, cap: 4 }`

| intent | Tên | kind | cost | targeting | effects |
|---|---|---|---|---|---|
| `tlq_but_phong` | Bút Phong | attack | 1 | lowestHp | `damage 5 chosen` |
| `tlq_toa_nguyet` | Tỏa Nguyệt | debuff | 1 | random | `drainMoonPower 2 chosen` |
| `tlq_muc_an` | Mực Ấn | defend | 1 | — | `gainArmor 6 self` |
| `tlq_luan_kiem` | Luận Kiếm | attack | 2 | random | `damage 4 chosen hits 2` |
| `tlq_nguyet_chu` | Nguyệt Chú | debuff | 3 | random | `drainMoonPower 2 chosen` + `applyStatus weak 1 chosen` |

`moonOverrides`: `firstQuarter` → `tlq_ban_nguyet_luan` "Bán Nguyệt Luận" (debuff,
random): `drainMoonPower 3 chosen`.

**`huyen_vu_thi_quan` — Huyền Vũ Thí Quan** — `maxHp: 48`, `moonPower { start: 1, cap: 4 }`

| intent | Tên | kind | cost | targeting | effects |
|---|---|---|---|---|---|
| `hvq_thiet_chuong` | Thiết Chưởng | attack | 1 | front | `damage 5 chosen` |
| `hvq_quy_giap` | Quy Giáp | defend | 1 | — | `gainArmor 7 self` |
| `hvq_phan_kich` | Phản Kích | defend | 1 | — | `gainArmor 3 self` + `applyStatus reflect 3 self` |
| `hvq_truy_phong` | Truy Phong | attack | 2 | lowestHp | `damage 8 chosen` |
| `hvq_huyen_vu_bich` | Huyền Vũ Bích | defend | 3 | — | `gainArmor 10 self` + `applyStatus reflect 2 self` |

`moonOverrides`: `lastQuarter` → `hvq_nguyet_bich` "Nguyệt Bích" (defend):
`gainArmor 8 self` + `applyStatus reflect 2 self`.

**`bach_lo_thi_quan` — Bạch Lộ Thí Quan** — `maxHp: 30`, `moonPower { start: 1, cap: 4 }`

| intent | Tên | kind | cost | targeting | effects |
|---|---|---|---|---|---|
| `blq_cham_kich` | Châm Kích | attack | 1 | lowestHp | `damage 4 chosen` |
| `blq_duong_sinh` | Dưỡng Sinh | buff | 1 | — | `applyStatus regen 1 allAllies` |
| `blq_cam_lo` | Cam Lộ | buff | 1 | — | `heal 3 allAllies` |
| `blq_kim_cham` | Kim Châm | attack | 2 | lowestHp | `damage 6 chosen` + `applyStatus vulnerable 1 chosen` |
| `blq_hoi_xuan` | Hồi Xuân | buff | 3 | — | `heal 5 allAllies` + `cleanse self` |

`moonOverrides`: `full` → `blq_nguyet_duoc` "Nguyệt Dược" (buff): `heal 4 allAllies` +
`cleanse self`.

**`khao_hach_chi_linh` — Khảo Hạch Chi Linh (boss)** — `maxHp: 80`,
`moonPower { start: 2, cap: 7 }`. Linh thú gác cổng thi từ thời lập viện — đổi "đề
thi" theo pha trăng. Chiêu gốc chỉ đánh ở 4 pha không có override.

| intent | Tên | kind | cost | targeting | effects |
|---|---|---|---|---|---|
| `khl_thach_trao` | Thạch Trảo | attack | 2 | random | `damage 8 chosen` |
| `khl_khao_an` | Khảo Ấn | debuff | 2 | random | `applyStatus vulnerable 2 chosen` + `applyStatus weak 1 chosen` |
| `khl_tran_ap` | Trấn Áp | attack | 3 | — | `damage 4 allEnemies` |
| `khl_ngoc_bich` | Ngọc Bích | defend | 3 | — | `gainArmor 10 self` |
| `khl_lac_an` | Lạc Ấn | attack | 4 | lowestHp | `damage 10 chosen` |

`moonOverrides` (đứng đầu chuỗi, cost 0 — `01` §9.2):

| phase | intent | Tên | kind | targeting | effects |
|---|---|---|---|---|---|
| `new` | `khl_vo_nguyet_tram` | Vô Nguyệt Trảm | attack | lowestHp | `damage 10 chosen` |
| `firstQuarter` | `khl_toa_nguyet_phap` | Tỏa Nguyệt Pháp | debuff | random | `drainMoonPower 2 chosen` |
| `full` | `khl_vong_nguyet_nghi` | Vọng Nguyệt Nghi | buff | — | `heal 5 self` + `applyStatus regen 2 self` |
| `lastQuarter` | `khl_huyen_vu_giap` | Huyền Vũ Giáp | defend | — | `gainArmor 10 self` + `applyStatus reflect 2 self` |

Không `bloodMoonOverride`, không `phases` (đó là cơ chế boss co-op). So sánh sức
mạnh: `moon_ape` 94 HP / đòn tới 18 — boss này 80 HP / đòn tới 10, đúng tầng dưới
cho một arc dạy luật.

#### 13.3.3 Lời thoại

`speaker` chỉ dùng: `narrator`, Hero (`m05` Hoắc Liệt — nóng tính, thẳng; `f04` Ôn
Như Ý — hiền, rụt rè nhưng bền; `m06` Tô Dạ — lười biếng bề ngoài, lạnh lùng bên
trong, thủ thư Tàng Thư Các; `m10` Chu Quyết — tham vọng, tự ti ngầm, hay ghi chép —
là bạn học trong truyện, chỉ vào đội sau arc), và id kẻ địch của màn đó. Thoại **không
giả định** Hero nào có trong đội ra trận.

**`arc1_s01` Nhập Học**

`before`:
- `narrator`: "Đêm khai giảng, cổng đá Vọng Nguyệt Thư Viện hé mở. Tấm biển ngang cổng chỉ viết một dòng: ứng viên vượt qua người gác cổng thì được nhập học."
- `m05`: "Con rối gỗ mà cũng dám cản đường? Để ta đốn nó!"
- `f04`: "Nghe nói khôi lỗi của học viện đánh chậm nhưng rất nặng... mọi người cẩn thận nhé."
- `m06`: "(ngáp) Vòng đầu nó chưa tụ đủ Nguyệt Lực đâu. Thừa cơ đánh trước — đừng kéo dài."

`after`:
- `narrator`: "Pho khôi lỗi rạn nứt, chậm rãi quỵ gối. Tấm biển 'Nhập Học' tự lật mặt — hiện chữ 'ĐẬU'."
- `m05`: "Chỉ thế thôi á? Bài thi của học viện tối cao có vẻ nhàn rỗi đấy."
- `f04`: "Đừng chủ quan... bốn Viện còn bốn bài thí riêng, nghe nói một bài khó hơn một bài."
- `narrator`: "Những cái tên mới được ghi vào sổ Vọng Nguyệt — trang đầu của một năm đầy sóng gió."

**`arc1_s02` Thanh Loan Thí Luận**

`before`:
- `narrator`: "Sảnh Thanh Loan Viện — nơi văn chương và mưu lược được trọng nhất. Bài thí luận: đấu pháp với Thí Quan do viện dựng lên."
- `thanh_loan_thi_quan`: "Tân sinh thường ôm khư khư Nguyệt Lực chờ đòn lớn. Thanh Loan có một chiêu khiến thói quen đó đổ sông đổ bể — gọi là Tỏa Nguyệt."
- `m10`: "Tỏa Nguyệt... rút cạn Nguyệt Lực Dự Trữ của đối thủ. Đọc trong sách đã lâu, đây là lần đầu thấy người ta dùng thật."
- `m05`: "Lời nhiều quá! Muốn lấy thì lấy — ta đánh nhanh hơn ngươi lấy!"
- `thanh_loan_thi_quan`: "Khí phách tốt. Vào bài."

`after`:
- `thanh_loan_thi_quan`: "Tốt. Kẻ thắng không phải kẻ có nhiều Nguyệt Lực nhất — mà là kẻ tiêu nó đúng lúc nhất."
- `m10`: "Ghi nhớ: Tỏa Nguyệt chỉ lấy được phần Dự Trữ đã tích — quỹ của vòng mới vẫn về đủ."
- `f04`: "May quá... chỉ nhìn Nguyệt Lực bị hút đi thôi mà đã thấy hãi rồi."
- `narrator`: "Dấu ấn Thanh Loan đầu tiên đóng vào sổ thi — bài thí luận đậu."

**`arc1_s03` Huyền Vũ Thí Võ**

`before`:
- `narrator`: "Thao trường Huyền Vũ Viện — cát vàng, giáp đen, tiếng gió qua hàng thương giá. Bài thí võ không đòi đánh đẹp, chỉ đòi hạ một Thí Quan biết chắn đòn và trả đòn."
- `huyen_vu_thi_quan`: "Đánh đi. Mỗi đòn các ngươi trút lên giáp của ta, một phần sẽ bật ngược về tay các ngươi."
- `f04`: "Phản Đòn... đánh nhiều nhịp nhỏ thì mỗi nhịp đều bị phản. Phải gom thành đòn lớn, hoặc phá giáp trước!"
- `m05`: "Đúng sở trường của ta — một nhát xuyên giáp cho xong!"
- `m06`: "Võ sĩ đứng nghiêm thế kia thì đòn đâu khó đoán."

`after`:
- `huyen_vu_thi_quan`: "Được. Giáp chỉ là vỏ — thứ các ngươi vừa đánh vỡ là sự kiên trì, và nó đáng khâm phục."
- `m05`: "Ha! Cuối cùng cũng có một bài thi ra hồn!"
- `narrator`: "Dấu ấn Huyền Vũ — bài thí võ đậu."

**`arc1_s04` Bạch Lộ Thí Y**

`before`:
- `narrator`: "Viện Bạch Lộ, sân thuốc ngập mùi thảo mộc. Bài thí y: vượt qua một Thí Quan chuyên chữa lành — đi cùng một con thú bị thương nó cứu hộ."
- `bach_lo_thi_quan`: "Ta không đánh mạnh — nhưng ta chữa nhanh. Muốn thắng ta, các ngươi phải đánh nhanh hơn ta chữa."
- `f04`: "Thầy là tiền bối của em... trận kéo dài là lợi thế của bên có hồi máu — mình phải dồn sát thương thật nhanh!"
- `m10`: "Hoặc hạ người chữa trước — chặn nguồn hồi phục thì phần còn lại tự gãy."
- `bach_lo_thi_quan`: "Vào bài đi. Cho ta xem các ngươi chữa được bệnh 'chần chừ' thế nào."

`after`:
- `bach_lo_thi_quan`: "Tốt lắm. Y thuật cứu được người — nhưng không cứu được một trận đấu đã quyết."
- `f04`: "Cảm ơn thầy chỉ dạy ạ! Em ghi nhớ rồi."
- `narrator`: "Dấu ấn Bạch Lộ — ba trong bốn bài thí đã xong."

**`arc1_s05` Cấm Địa Xích Diên**

`before`:
- `narrator`: "Xích Diên Viện không đặt bài thí — họ niêm phong bí thuật trong một cấm địa. Đêm nay, cánh cửa ấy hé ra một khe."
- `narrator`: "Gió tràn qua khe cửa mang theo mùi tàn khét. Và trên trời — trăng đang nhuộm màu máu. Huyết Nguyệt."
- `m05`: "Trăng... đỏ? Cái quái gì thế này?!"
- `m06`: "(vẻ ngái ngủ tan hẳn) Cấm Thuật. Ta đọc về nó — trong những cuốn sách không được phép đọc."
- `f04`: "Trong Huyết Nguyệt, cơ thể sẽ không ngừng mất máu mỗi vòng... phải kết thúc trận này thật nhanh!"
- `book_wraith`: "...kẻ lạ... đọc nhầm... dòng cấm..."

`after`:
- `narrator`: "Khe cấm địa khép lại trong im lặng. Nhưng thứ ánh sáng đỏ kia vẫn đọng lại nơi đáy mắt các ngươi."
- `m06`: "Thứ đó học trò không dựng nổi. Có kẻ mở cánh cửa ấy — từ phía trong."
- `m10`: "Sách ghi: Huyết Nguyệt là dấu hiệu của Cấm Thuật thức tỉnh. Nếu đúng... chuyện này mới chỉ bắt đầu."
- `m05`: "Kẻ nào mở cửa thì đi tìm kẻ đó. Đơn giản!"

**`arc1_s06` Tàng Thư Các Có Ma**

`before`:
- `narrator`: "Tàng Thư Các — nơi Tô Dạ làm thủ thư mỗi đêm. Gần đây sách tự xé trang, và từ kệ cũ vọng ra tiếng thì thầm không rõ từ đâu."
- `m06`: "Phòng sách của ta có khách. Thư Hồn — những trang sách bị bỏ quên quá lâu, oán khí đọng thành hình."
- `f04`: "Nghe tiếng xào xạc đó mà rùng hết cả mình..."
- `book_wraith`: "...trang nào... cũng là ngục... cuốn nào... cũng thiếu... trang cuối..."
- `m06`: "Đừng lắng tai nghe nó. Giọng của Thư Hồn làm người nghe mỏi mệt — nó sống bằng sự chú ý của ngươi."

`after`:
- `narrator`: "Thư Hồn tan thành những trang giấy rời, rơi xuống im ắng như một trận tuyết nhỏ."
- `book_wraith`: "...trả lại... trang... cuối..."
- `m06`: "(nhặt một trang rời) 'Nguyệt Thực Ký' — trang cuối của nó bị xé mất từ lâu. Ai đó đã đọc cuốn này trước cả ta."
- `f04`: "Thắng rồi... nhưng chuyện Tô Dạ vừa nói còn đáng sợ hơn con ma lúc nãy."

**`arc1_s07` Dạ Tập**

`before`:
- `narrator`: "Đường về ký túc xá cắt qua rừng trúc. Đêm nay gió lạnh — và trong bóng cây, có thứ đang lộ răng."
- `m05`: "Ảnh Hồ! Cả bầy săn đêm — chúng luôn nhắm con mồi yếu nhất trước!"
- `f04`: "B-ba con... giữ đội hình, đừng ai lạc hàng nhé!"
- `m06`: "Chúng vào được học viện nghĩa là có người mở cửa. Trận này không phải tai nạn."
- `narrator`: "Ba cái bóng lùa qua kẽ trúc, xếp thành hình răng nanh."

`after`:
- `narrator`: "Bầy Ảnh Hồ tan vào bóng tối như chưa từng hiện hữu, chỉ để lại vài sợi lông đen trên lá trúc."
- `m05`: "Tập kích ban đêm ngay trong sân học viện?! Vọng Nguyệt rốt cuộc đang giấu cái gì?"
- `m06`: "Ai đó muốn thử xem tân sinh năm nay có những gì. Câu trả lời — vừa được viết xong."
- `narrator`: "Gió đêm lùa qua kẽ trúc — nghe như lời nhắn cuối trước ngày khảo hạch."

**`arc1_s08` Khảo Hạch Chi Linh**

`before`:
- `narrator`: "Bài khảo hạch cuối cùng của năm nhất. Trên đài cao nhất của thư viện, linh thú gác cổng thi từ thời lập viện thức dậy."
- `khao_hach_chi_linh`: "KẺ BƯỚC VÀO ĐIỆN KHẢO. TRĂNG ĐỔI PHA — TA ĐỔI ĐỀ. TIẾN LÊN, ỨNG VIÊN."
- `m10`: "Nó đổi chiêu theo pha trăng — tra Nguyệt tính của nó trước khi ra tay, đừng đánh mù!"
- `f04`: "Lớn quá... nhưng mình đã đi được đến tận đây — không lùi nữa!"
- `m05`: "Trăng đổi thì ta đổi theo. Đơn giản!"

`after`:
- `khao_hach_chi_linh`: "ĐẬU. TÂN SINH CỦA VỌNG NGUYỆT — TỪ ĐÊM NAY, TRĂNG SẼ THEO DÕI CÁC NGƯƠI."
- `narrator`: "Linh thú tan thành bụi ánh sáng, quyện lên quanh đỉnh thư viện. Trên bảng vàng, những cái tên mới được khắc ngang hàng các thế hệ trước."
- `m10`: "(thở hắt) Cuối cùng mình cũng qua được... và mình sẽ còn học được nhiều hơn nữa."
- `m05`: "Năm nhất mới mở màn thôi. Xem học viện này còn giấu bao nhiêu chuyện."
- `narrator`: "Phần thưởng nhập môn: Chu Quyết — học sinh thường dân xuất sắc nhất khóa — chính thức gia nhập đội."

#### 13.3.4 Ghi chú thiết kế

- **Mốc sức mạnh:** số liệu bám tầng 1–2 hiện có (`puppet_guard` 42 HP, đòn 6–10;
  `shadow_fox` 23 HP; `book_wraith` 32 HP; boss `moon_ape` 94 HP). Tổng HP màn tăng
  dần 42 → 80; damage tối đa mỗi chiêu giữ ≤ 10 (một bậc dưới `moon_ape`).
- **Đã chỉnh theo mô phỏng** (80 seed, bot Bộ cơ bản `m05+f04+m06`): bản khởi điểm
  đo s04 50%, s08 45% → giảm `bach_lo_thi_quan` (HP 36→30, `cam_lo` 4→3,
  `duong_sinh` regen 2→1, `hoi_xuan` 8→5, `nguyet_duoc` 6→4) và `khao_hach_chi_linh`
  (HP 90→80, `lac_an`/`vo_nguyet_tram` 12→10, `vong_nguyet_nghi` hồi 6→5) → s04 85%,
  s08 72.5%; màn còn lại ≥ 92.5%.
- **Nguyệt Luân mới (đã duyệt, chưa cài):** spec
  `superpowers/specs/2026-09-30-nguyet-luan-redesign` sẽ đổi pha khởi đầu thành ngẫu
  nhiên, mỗi pha một Ưu Đãi tag −1 cộng một Nguyệt Lệnh bốc theo trận, và quy ước
  1–2 Nguyệt tính công khai mỗi kẻ địch. **Nội dung Arc 1 ở đây viết theo luật hiện
  tại** — `moon-phases.json` cũ, pha đầu luôn là index 1 trừ khi `start` ghi đè —
  nên 4 override của boss đặt đúng 4 pha có hiệu ứng hiện nay. Thiết kế cũng đi trước
  tương thích: 3 Thí Quan mỗi con 1 `moonOverride` đúng pha hợp viện, sẵn làm Nguyệt
  tính khi redesign chạy. Khi đó nếu lệnh `healMultiplier`/`armorMultiplier` không
  được bốc thì hiệu ứng nhân của `full`/`lastQuarter` mất (chấp nhận — chiêu trăng
  vẫn kích); có thể ghim `CombatStart.decrees` khi schema có sẵn nếu cần.
- **Huyết Nguyệt màn 5:** `bloodMoonRounds: 3` → mỗi Hero mất ~6 HP trải 3 vòng đầu;
  gặp kẻ địch `start: 0` nên vòng 1 tương đối nhẹ.
- **Kẻ địch cũ không đổi số liệu** trong bản này (giữ golden T213); khi redesign thêm
  Nguyệt tính cho kẻ địch cũ, các màn 5–7 sẽ nhận thêm chiêu trăng — đo lại lúc đó.
- **Quyết định đã chốt (duyệt 7c.4):**
  1. Màn 4 **giữ** cặp `shadow_fox` + Thí Quan Y (bài học "hạ bên hồi trước").
  2. Màn 8 **không** ghim `start.moonIndex` — pha đầu theo luật hiện hành (index 1;
     khi redesign chạy sẽ là ngẫu nhiên), khuyến khích đọc Nguyệt tính.
  3. Màn 5 giữ `bloodMoonRounds: 3` như đề xuất.

---

### 13.4 Arc 2 — Bóng Tối: nội dung chi tiết [GĐ7c.5]

**Đã duyệt (7c.5).** Số liệu là khởi điểm; đo bằng mô phỏng 80 seed (bot, Bộ cơ bản)
theo mục tiêu độ khó ở §13.2: màn thường 55–75%, boss 40–60% cho đội
`m05 + f04 + m06`; mỗi màn ≥ 60% với đội tốt nhất trong 3 đội mẫu
(`m05+f04+m06`, `m05+f03+f02`, `m01+m02+f04`). Chỉ dùng effect / trạng thái / điều
kiện đã có trong `01`, `02`, `static.ts`.

Bối cảnh arc: sau khảo hạch năm nhất, thư từ của học sinh bị lấy cắp dẫn tới một mạng
mật thám trong học viện — tổ chức **Vô Nguyệt** (trùng tên nội tại thức tỉnh của Tô
Dạ — không phải ngẫu nhiên) đang lập danh sách người trong học viện, ám sát kẻ đã
đọc tài liệu cấm, và lấy "trang cuối" của *Nguyệt Thực Ký*. Các tuyến đã gieo ở Arc
1 chụp lại thành một âm mưu: kẻ mở cửa cho Ảnh Hồ (s07), trang sách bị xé (s06), cánh
cửa Cấm Địa mở từ phía trong (s05). Định nghĩa arc (Phase B ghi vào `story.json`):
`arcs[1] = { id: "arc2", name: "Bóng Tối", stageIds: [arc2_s01…arc2_s08],
rewardHeroId: "f02" }`.

#### 13.4.1 Bảng màn

Mỗi màn `arc2_sNN` trỏ encounter `story_arc2_sNN` (`tier: "story"`, `name` = tên màn,
không vào pool Lượt chơi / Trận lẻ).

| # | Id màn | Tên | Kẻ địch (tổng HP) | `start` | `firstClear` Ngọc / Thiết / XP |
|---|---|---|---|---|---|
| 1 | `arc2_s01` | Thư Tín Mất Tích | `hac_y_mat_tham` **mới** + `shadow_fox` ×2 (10+23+23 = 56) | — | 40 / 1 / 25 |
| 2 | `arc2_s02` | Mật Thám | `hac_y_mat_tham` ×2 + `shadow_fox` (10+10+23 = 43) | — | 45 / 1 / 30 |
| 3 | `arc2_s03` | Vô Nguyệt Ám Sát | `vo_nguyet_am_sat` **mới** ×3 (18×3 = 54) | — | 50 / 2 / 30 |
| 4 | `arc2_s04` | Tô Dạ Dao Động | `vo_nguyet_nghi_si` **mới** + `vo_nguyet_am_sat` ×2 (22+18+18 = 58) | — | 50 / 1 / 30 |
| 5 | `arc2_s05` | Chợ Đêm Tin Tức | `fox_king` + `hac_y_mat_tham` + `shadow_fox` (50+10+23 = 83) | — | 50 / 2 / 35 |
| 6 | `arc2_s06` | Quan Tinh Đài | `vo_nguyet_nghi_si` + `vo_nguyet_am_sat` ×2 (22+18+18 = 58) | `moonIndex: 0` | 55 / 2 / 35 |
| 7 | `arc2_s07` | Hắc Vệ | `black_guard` + `vo_nguyet_am_sat` (69+18 = 87) | — | 55 / 2 / 40 |
| 8 | `arc2_s08` | Vô Nguyệt Ảnh Chủ | `vo_nguyet_anh_chu` **boss mới** (75) | — | 55 / 5 / 40 |

**Tổng:** 400 Nguyệt Ngọc, 16 Huyền Thiết, XP Tu Luyện 25 → 40 theo màn. Qua màn 8
tặng `f02` Diệp Linh Lung.

**Tuyến ý đồ** (khác Arc 1: đây là chiến tranh thật, không còn là bài thí):

- **s01:** mở arc ở độ khó Arc 1 cuối — mật thám hút Dự Trữ (`drainMoonPower`) và
  cướp 1 buff (`stealBuff 1`, mồi cho boss), cáo trộm nhắm `lowestHp`.
- **s02:** hai mật thám hút Dự Trữ luân phiên — dạy "tiêu quỹ trong lượt, đừng để
  Dự Trữ cho kẻ địch hút"; hạ kẻ hút trước.
- **s03:** bức tường Ẩn Thân — 3 sát thủ thay phiên `stealth 2` (đủ che 1 lượt người
  chơi); nhắm đơn vào bóng là phí lượt, lá `allEnemies` (Song Nhận Loạn Vũ của M06…)
  trả đúng giá. Đội `m05+f03+f02` có nhiều đòn lan hơn — dự kiến là "đội tốt nhất".
- **s04:** nghi sĩ + sát thủ hộ tống — địch có sustain (`heal allAllies`) và quét
  `weak` toàn đội; kẻ ít hơn nhưng trận kéo dài.
- **s05:** `fox_king` (elite tầng 5+) cầm chợ đêm — stealth của Vương + hút Dự Trữ
  của mật thám + hồi 8; trận dài nhất arc ngoài boss.
- **s06:** `start.moonIndex: 0` — Vô Nguyệt đánh đúng đêm của nó: `stealth` địch áp
  trong Trăng Non được **+1 thời hạn** (`01` §7.1) → `stealth 2` thành 3, che 2 lượt
  người chơi; override `new` của cả ba kẻ địch mới đều kích ở vòng 1 (nghi sĩ phủ
  `stealth 2` toàn đội địch lượt đầu). Ngược lại lá `assassin` của người chơi cũng
  ×1.5 — hai phe dùng chung một pha, đúng "hiệu ứng pha áp cho cả hai phe".
- **s07:** `black_guard` (đòn 14 + quét `allEnemies` + Suy Yếu) hộ tống một sát thủ
  — áp lực damage cao nhất arc ngoài boss; dạy giữ Hero yếu trên ngưỡng an toàn.
- **s08:** boss cướp buff + Ẩn Thân + Đoạt Nguyệt — phạt deck dựng buff trâu (Sức
  Mạnh/Hồi Phục/Hộ Vệ không chốt nhanh là của hắn), thưởng deck đánh thẳng.

#### 13.4.2 Kẻ địch mới

Ba kẻ địch thường đều thuộc tổ chức Vô Nguyệt — mật thám (hút/cướp), sát thủ (Ẩn
Thân), nghi sĩ (nghi lễ Trăng Non). Theo tinh thần Nguyệt tính như Arc 1: mỗi con
đúng **1 `moonOverride` ở `new`** (Vô Nguyệt = "không trăng"); boss **4** override
cho 4 pha có hiệu ứng. `art.portrait` để `""`.

**`hac_y_mat_tham` — Hắc Y Mật Thám** — `maxHp: 10`, `moonPower { start: 1, cap: 4 }`

| intent | Tên | kind | cost | targeting | effects |
|---|---|---|---|---|---|
| `hym_am_cham` | Ám Châm | attack | 1 | lowestHp | `damage 2 chosen` |
| `hym_thin_tuc` | Thính Tức | debuff | 1 | random | `drainMoonPower 2 chosen` |
| `hym_dao_an` | Đạo Ấn | special | 2 | highestHp | `stealBuff 1` |
| `hym_mai_phuc` | Mai Phục | debuff | 2 | lowestHp | `applyStatus vulnerable 2 chosen` |
| `hym_cap_bao` | Cấp Báo | debuff | 3 | random | `drainMoonPower 3 chosen steal` + `damage 3 chosen` |

`moonOverrides`: `new` → `hym_vo_nguyet_mat_lenh` "Vô Nguyệt Mật Lệnh" (special,
random): `drainMoonPower 3 chosen steal` + `stealBuff 1`.

**`vo_nguyet_am_sat` — Vô Nguyệt Ám Sát** — `maxHp: 18`, `moonPower { start: 1, cap: 4 }`

| intent | Tên | kind | cost | targeting | effects |
|---|---|---|---|---|---|
| `vas_lanh_dao` | Lãnh Đao | attack | 1 | lowestHp | `damage 4 chosen` |
| `vas_am_chu` | Ám Chủ | attack | 1 | random | `damage 3 chosen` |
| `vas_tan_anh` | Tản Ảnh | buff | 4 | — | `applyStatus stealth 2 self` |
| `vas_doat_menh` | Đoạt Mệnh | attack | 3 | lowestHp | `damage 7 chosen` |
| `vas_vo_thanh` | Vô Thanh | buff | 4 | — | `applyStatus stealth 2 self` + `applyStatus strength 1 self` |

`moonOverrides`: `new` → `vas_tan_nguyet_sat` "Tân Nguyệt Sát" (attack, lowestHp):
`damage 3 chosen` + `applyStatus stealth 1 self` (ở Trăng Non thành 2 — che 1 lượt).

**`vo_nguyet_nghi_si` — Vô Nguyệt Nghi Sĩ** — `maxHp: 22`, `moonPower { start: 1, cap: 4 }`

| intent | Tên | kind | cost | targeting | effects |
|---|---|---|---|---|---|
| `vns_hac_chuc` | Hắc Chúc | attack | 1 | random | `damage 3 chosen` + `applyStatus burn 1 chosen` |
| `vns_te_tinh` | Tế Tinh | buff | 2 | — | `heal 1 allAllies` |
| `vns_doan_tinh` | Đoạn Tinh | debuff | 2 | random | `drainMoonPower 2 chosen steal` |
| `vns_vo_vong` | Vô Vọng | debuff | 4 | — | `applyStatus weak 2 allEnemies` |
| `vns_tan_nguyet` | Tàn Nguyệt | buff | 4 | — | `heal 2 allAllies` + `applyStatus regen 1 allAllies` |

`moonOverrides`: `new` → `vns_vo_nguyet_te` "Vô Nguyệt Tế" (buff):
`applyStatus strength 1 allAllies` + `applyStatus stealth 1 allAllies` (ở Trăng Non
thành stealth 2 — che cả đội 1 lượt người chơi).

**`vo_nguyet_anh_chu` — Vô Nguyệt Ảnh Chủ (boss)** — `maxHp: 75`,
`moonPower { start: 2, cap: 8 }`. Đầu não Vô Nguyệt đứng sau đợt trộm thư — cướp
buff của người chơi làm của mình, ẩn vào bóng khi bị ép, hút Dự Trữ để nuôi quỹ.

| intent | Tên | kind | cost | targeting | effects |
|---|---|---|---|---|---|
| `vac_anh_cham` | Ảnh Châm | attack | 1 | random | `damage 4 chosen` |
| `vac_doat_uy` | Đoạt Uy | special | 2 | highestHp | `stealBuff 2` |
| `vac_am_chieu` | Ám Chiếu | attack | 3 | lowestHp | `damage 5 chosen` + `applyStatus weak 2 chosen` |
| `vac_tan_the` | Tản Thể | buff | 3 | — | `applyStatus stealth 2 self` + `cleanse self` |
| `vac_doat_nguyet` | Đoạt Nguyệt | debuff | 4 | random | `drainMoonPower 2 chosen steal` + `damage 2 chosen` |
| `vac_vo_nguyet_tram` | Vô Nguyệt Trảm | attack | 5 | lowestHp | `damage 9 chosen` |

`moonOverrides` (đứng đầu chuỗi, cost 0 — `01` §9.2):

| phase | intent | Tên | kind | targeting | effects |
|---|---|---|---|---|---|
| `new` | `vac_vo_nguyet_thiem` | Vô Nguyệt Thiểm | attack | lowestHp | `damage 10 chosen` |
| `firstQuarter` | `vac_nhiep_tinh` | Nhiếp Tinh | debuff | random | `drainMoonPower 3 chosen steal` + `applyStatus weak 2 chosen` |
| `full` | `vac_ty_nguyet` | Tị Nguyệt | defend | — | `applyStatus stealth 2 self` + `gainArmor 10 self` |
| `lastQuarter` | `vac_phe_nguyet` | Phệ Nguyệt | special | random | `stealBuff 3` |

Không `bloodMoonOverride`, không `phases` (đó là cơ chế boss co-op). So sánh sức
mạnh: `khao_hach_chi_linh` 80 HP / đòn tới 10; `moon_ape` 94 HP / đòn tới 18 — boss
này 75 HP / đòn tới 10, nhưng HP hiệu dụng cao hơn số ghi vì `stealth` chặn nhắm
đơn và `stealBuff` tước buff của người chơi sang hắn.

#### 13.4.3 Lời thoại

`speaker` chỉ dùng: `narrator`, Hero (`m05`, `f04`, `m10` như Arc 1; `f02`, `m06`,
`m08` là nhân vật truyện ở màn 2/4/6 và lặp lại ở 5/8), và id kẻ địch của màn đó.
Thoại **không giả định** Hero nào có trong đội ra trận — `f02`/`m06`/`m08` chỉ nói
với tư cách người trong câu chuyện.

**`arc2_s01` Thư Tín Mất Tích**

`before`:
- `narrator`: "Ba tuần nay, thư của học sinh gửi về quê không một lá tới nơi. Đêm nay các ngươi phục quanh phòng bưu dịch — nơi bao thư chất thành từng đống nhỏ."
- `m10`: "Ghi lại: mười ba bao thư mất không dấu vết, sáp niêm không rách. Kẻ lấy biết cách mở thư mà không để lại dấu tay."
- `f04`: "Trong thư của mọi người... có cả địa chỉ nhà, lời nhắn cho cha mẹ. Sao ai lại muốn những thứ đó chứ?"
- `hac_y_mat_tham`: "Thư không chữ chỉ là giấy. Thư có chữ — là bản đồ. Đừng tưởng học viện này kín như các ngươi nghĩ."
- `m05`: "Nói hay đấy, đồ trộm! Cất bản đồ của ngươi đi — ta đóng dấu ngươi ngay tại đây!"

`after`:
- `narrator`: "Bóng áo đen loang xuống mái ngói rồi tan. Trong bọc hắn đánh rơi: hàng chục lá thư chưa đọc — mỗi lá đều bị xé mất đoạn ký tên."
- `m10`: "Không lấy tiền, không lấy nội dung — chỉ lấy tên. Chúng đang lập danh sách... danh sách những người ở học viện này."
- `hac_y_mat_tham`: "(khẽ, trước khi ngất) Vô Nguyệt không quên cái tên nào."
- `f04`: "Vô... Nguyệt? Nghe cái tên đó mà lạnh cả người..."
- `m05`: "Kẻ nào lập danh sách thì ta xé danh sách đó. Tìm hang của chúng thôi!"

**`arc2_s02` Mật Thám**

`before`:
- `narrator`: "Lần theo đống thư, các ngươi tới một căn phòng hoang ngoài bờ hồ — và nhận ra mình không phải thợ săn duy nhất tới trước."
- `f02`: "Á à ~ đội mới của thư viện cũng tới rồi. Muội tới trước các huynh đệ một bước — thói quen nghề nghiệp thôi."
- `m05`: "Ngươi là ai?! Đêm nay ta không tin cái bóng nào cả!"
- `f02`: "Diệp Linh Lung — người bán tin, không phải kẻ trộm thư. Tin xấu: tổ chim này đã dọn. Tin tốt: chúng để lại đồ đội trả ~"
- `hac_y_mat_tham`: "Con cáo của cung điện cũng ngửi được mùi này à... Coi chừng cái bóng sau lưng mình đi, mật thám."
- `m10`: "(thì thầm) 'Con cáo của cung điện' — ghi lại: cô ta không phải học sinh."

`after`:
- `narrator`: "Tổ chim đã trống thật — chỉ còn dây ràng, tro thư đốt và hai quân bài úp trên mặt bàn."
- `f02`: "Vô Nguyệt ~ cái tên này muội ngửi thấy từ trong cung ra tới đây. Ai học được cách 'ẩn thân trong ánh trăng' thì sẽ không dạy lại cho người khác đâu nhé."
- `f04`: "Vậy... cô theo dõi bọn này từ bao giờ?"
- `f02`: "Từ đêm mưa tuần trước. Đừng giật mình ~ muội còn theo dõi cả bọn chúng nữa — và chúng giỏi hơn các huynh tưởng nhiều."
- `m05`: "Giỏi đến đâu cũng chỉ là đồ lén lút. Bọn ta đây: đánh thẳng mặt!"

**`arc2_s03` Vô Nguyệt Ám Sát**

`before`:
- `narrator`: "Nửa đêm. Chuông báo động không kịp rung — ba cái bóng đã lọt qua tường, nhắm thẳng dãy ký túc của những người từng chạm vào bí mật Cấm Địa."
- `vo_nguyet_am_sat`: "Trăng lặn nơi này."
- `m05`: "Câu cửa miệng của chúng à? Nói xong câu đó ngươi nằm luôn được không?"
- `m06`: "(không ngáp nữa) ...Ẩn Thân. Đánh lan ra — nhắm đơn vào cái bóng là đánh vào hư không."
- `f04`: "Họ tiến lại mà không một tiếng động... mọi người đừng tách hàng!"

`after`:
- `narrator`: "Các bóng đen vỡ như mực gặp nước. Trên nền nhà chỉ còn một dấu ấn: vầng trăng bị tô đen."
- `m10`: "Chúng không nhắm vào người — chúng nhắm vào 'kẻ từng đọc trang cuối'. Cuốn 'Nguyệt Thực Ký' ấy... chúng muốn bịt miệng ai đã đọc nó."
- `m06`: "(im lặng lau tay áo) ...có những danh sách chỉ cần một nét gạch."
- `m05`: "Ai xách dao tới thì cứ tới. Vọng Nguyệt này chưa thua đêm nào!"
- `narrator`: "Trăng Khuyết Đầu nhô lên khỏi mái — mỏng như vết dao. Các ngươi sống qua đêm không trăng đầu tiên."

**`arc2_s04` Tô Dạ Dao Động**

`before`:
- `narrator`: "Nghi Sĩ của Vô Nguyệt không đến để giết — họ đến để 'nhắc nợ'. Kèm theo hai sát thủ: một tin nhắn bằng thứ ngôn ngữ chỉ kẻ trong nghề mới hiểu."
- `vo_nguyet_nghi_si`: "Tô Dạ. Dao động là quyền của người sống — nhưng kẻ ngủ không được phép mơ."
- `m06`: "...Ta vẫn đang ngủ. Về đi."
- `vo_nguyet_nghi_si`: "Vô Nguyệt không đòi lại thứ đã cho ngươi — chỉ đòi thứ ngươi hứa. Một cánh cửa mở, một đêm trăng tắt. Cũ kỹ, dễ nhớ."
- `f04`: "Tô Dạ... họ đang nói gì vậy? 'Cánh cửa mở' là sao...?"
- `m05`: "Ai hứa hẹn gì với bọn này thì đập bọn này xong rồi tính! Đứng về phía bọn ta trước đã!"
- `m06`: "(khẽ, như ngáp trong mơ) Được. Nợ xưa — trả bằng trận này."

`after`:
- `narrator`: "Nghi Sĩ quỵ xuống, nụ cười của kẻ tín đồ không rời môi. Hai sát thủ tan đi không hối tiếc — tin nhắn đã giao xong."
- `vo_nguyet_nghi_si`: "Dao động cũng là một câu trả lời, Tô Dạ à. Vô Nguyệt ghi nhận... câu trả lời đó."
- `m06`: "Ghi thì ghi. Ta là thủ thư — và thủ thư không giữ gì mãi cả, kể cả lời hứa."
- `m05`: "Đi ngủ đi Tô Dạ. Ai thắc mắc thì để ta trả lời — bằng thương."
- `f04`: "(lo lắng) Tô Dạ vẫn giấu gì đó... nhưng hắn vừa đứng về phía mình, phải không?"

**`arc2_s05` Chợ Đêm Tin Tức**

`before`:
- `narrator`: "Chợ đêm ngoài thành — nơi bí mật được cân lên cân bạc. Diệp Linh Lung dẫn đường: muốn biết Vô Nguyệt đánh đâu, phải trả bằng thứ tiền không mua nổi."
- `f02`: "Quy tắc chợ đêm: hỏi gì trả đó. Câu hỏi của chúng ta đắt ~ nên đêm nay ta đi đòi nợ thay vì mua."
- `fox_king`: "Hừ — khách quen của ta bán tin cho các ngươi được, nhưng trước phải trả 'phí giới thiệu'. Đám nhỏ của ta đói lắm."
- `m05`: "Sao ai trong chợ này cũng nói nhiều mà không nói gì?! Đánh xong rồi mặc cả!"
- `m10`: "(vừa né vừa viết) Chợ đêm = sở giao dịch tin tức. Ghi nhớ cho báo cáo— à không, cho chuyện kể sau này."

`after`:
- `narrator`: "Hồ Vương lùi vào sương, tiếng cười khàn còn vương trong ánh đèn lồng đỏ."
- `fox_king`: "Ta giữ chữ tín: khách của ngươi đã trả giá để 'mượn mắt trăng'. Đêm Trăng Non tới, chúng lên Quan Tinh Đài — nơi nhìn thấy mọi thứ, trừ bóng tối."
- `f02`: "Quan Tinh Đài ~ nơi giáo quan Khương Tịch đọc sao mỗi đêm. Muốn giết một nhà tiên tri thì trăng non là đêm duy nhất không ai nhìn thấy — kể cả ông ta."
- `m10`: "Phải báo cho giáo quan ngay — đêm Trăng Non chỉ còn vài ngày!"
- `f04`: "Đánh nhau trong đêm không trăng... tối tới mức không thấy cả tay mình..."

**`arc2_s06` Quan Tinh Đài**

`before`:
- `narrator`: "Quan Tinh Đài trên đỉnh núi — mái vòm xoay theo sao. Đêm nay trăng non, trời đen đặc, và những cái bóng đã leo tường trước khi ai kịp hô."
- `m08`: "Ta đọc được đêm nay từ ba năm trước. Nhưng viết lại nó — chỉ được từ đêm nay."
- `vo_nguyet_nghi_si`: "Vô Nguyệt Tế đã bắt đầu. Ánh trăng là lời nói dối đầu tiên — đêm nay đài của ngươi mù như mọi kẻ mù khác."
- `m08`: "Kẻ không thấy gì trong bóng tối thì không nên lên đài của ta. Ở đây, từng viên gạch nhớ hướng của sao."
- `m05`: "Trăng non là sân của bọn sát thủ — nhưng cũng là của ta! Đánh lan ra, đừng nhắm đơn!"
- `f04`: "Ẩn Thân của chúng kéo dài hơn trong đêm không trăng... mọi người đừng tản ra!"

`after`:
- `narrator`: "Tinh khí của đài vẫn sáng — ánh sao xuyên qua từng mảng tối như kim châm qua lụa đen. Bóng cuối cùng vỡ ra khi viền trời hớt qua tia sao đầu tiên."
- `vo_nguyet_nghi_si`: "Tế lễ hôm nay thất bại chỉ là dời ngày. Ảnh Chủ đã có 'trang cuối' — và trăng non sẽ quay lại, như mọi chu kỳ."
- `m08`: "Ta biết các ngươi đến từ lâu. Điều ta không ngờ là các em cũng đến — đọc sách tốt đấy, tân sinh."
- `m10`: "Ảnh Chủ — đầu não của Vô Nguyệt! Giáo quan, hang ổ của chúng ở đâu?"
- `m08`: "Dưới đài này. Nền của phế viện cũ — nơi trăng không soi tới, vì chính chúng đã tắt nó."
- `f04`: "(nuốt nước bọt) Vậy là đêm tới... chúng ta đi xuống đó à? Em chuẩn bị thêm thuốc đã."

**`arc2_s07` Hắc Vệ**

`before`:
- `narrator`: "Nền phế viện dưới chân đài — cổng hầm đen như miệng giếng. Gác cổng: một võ sĩ giáp đen, dáng đứng của người đã quên mình sống thế nào."
- `black_guard`: "Hắc Vệ. Lệnh duy nhất: không ai qua."
- `m05`: "Lệnh một chữ à? Ta có lệnh hai chữ: tránh ra!"
- `vo_nguyet_am_sat`: "Trăng lặn sâu nơi này — ngươi sẽ không nghe thấy chính mình ngã."
- `f04`: "Bộ giáp đó... là giáp thị vệ cũ của triều đình! Sao quân nhà vua lại gác cho Vô Nguyệt?!"
- `m10`: "(viết nhanh) Đội thị vệ mất tích ba năm trước — hồ sơ bị đốt sạch. Hóa ra là ở đây."

`after`:
- `narrator`: "Hắc Vệ gãy xuống như pho tượng mất nền. Phía sau hắn, hành lang đổ dốc vào một chỗ đen đặc tới mức ánh đèn cũng tắt."
- `black_guard`: "...(giọng vỡ, như người vừa tỉnh) ...báo... báo lên trên... trăng sẽ... tắt..."
- `m05`: "Hắn nhắc nhở mình à? Lạ thật — bị đánh bại mà như được đánh thức."
- `m10`: "Dưới đó là đầu não của chúng. Ai xuống cũng phải biết: mình đang bước vào nơi không còn trăng."
- `narrator`: "Ở đáy hành lang, có thứ đang thở chậm — đều như một mặt trăng thứ hai, nhưng không mang theo ánh sáng nào."

**`arc2_s08` Vô Nguyệt Ảnh Chủ**

`before`:
- `narrator`: "Đại điện không trăng. Giữa sảnh, một cái bóng đứng — không rõ hắn mặc áo đen, hay chính bóng đã đứng thành hình người."
- `vo_nguyet_anh_chu`: "Các ngươi đến với sức mạnh, với bạn bè, với ánh sáng trong người. Tốt. Ta lấy hết — từng thứ một."
- `f02`: "Ảnh Chủ ~ kẻ mua thông tin của mọi phe trừ Vô Nguyệt. Đêm nay ta bán miễn phí một tin: ngươi thua."
- `vo_nguyet_anh_chu`: "Mật thám của Thái Hậu. Ta biết mặt ngươi trước cả khi ngươi cất tiếng — ta cướp nó từ lâu rồi."
- `m06`: "(giọng lạnh, không còn vẻ ngái ngủ) Ngươi cho ta một cái tên trong danh sách. Đêm nay ta trả lại — bằng con dao cuối."
- `m05`: "Nói nhiều rồi! Bóng ơi là bóng — gặp thương thì cũng rách thôi!"

`after`:
- `narrator`: "Ảnh Chủ không gục — hắn nhạt dần như vệt mực bị rửa khỏi trang sách. Trên đài trống, 'trang cuối' của Nguyệt Thực Ký trở về trong im lặng."
- `vo_nguyet_anh_chu`: "Trăng rạng... cũng chỉ là món nợ phải trả. Vô Nguyệt không bao giờ mất hết... chỉ đợi lặn..."
- `m06`: "Nợ xong. Kể từ đêm nay, ta chỉ là thủ thư."
- `f02`: "Nhiệm vụ của muội tới đây là hết ~ nhưng cung điện cho phép muội 'đổi bàn làm việc'. Thư viện này thú vị hơn tưởng tượng — muội ở lại nhé?"
- `f04`: "Thật á?! Em mừng quá — từ nay bọn mình cùng một đội!"
- `m10`: "Ghi nhận: Vô Nguyệt tàn diệt, 'trang cuối' trở về thư viện, Diệp Linh Lung nhập đội. Năm nhất... kết thúc chưa yên."
- `narrator`: "Trên bầu trời, Lưỡi Liềm Đầu nhú lên — như thể cả bầu trời cũng thở phào."
- `narrator`: "Phần thưởng kết arc: Diệp Linh Lung — mật thám của Thái Hậu, kẻ bán mọi thứ trừ sự thật — chính thức gia nhập đội."

#### 13.4.4 Ghi chú thiết kế

- **Mốc sức mạnh:** arc 1 neo tầng 1–2 (màn 38–80 HP, đòn ≤ 10); arc 2 neo giữa
  elite và boss Lượt chơi (`black_guard` 69 HP đòn 14, `fox_king` 50 HP, `moon_ape`
  94 HP đòn 18): tổng HP màn 43 → 87, boss 75; đòn lớn nhất 10 (boss, override
  `new`), dưới `moon_ape`. Trạng thái thời hạn của **kẻ địch** trừ 1 ở cuối vòng tạo
  ra (`01` §9.4): `stealth 1` / `weak 1` trên chiêu địch không kịp có tác dụng → mọi
  Ẩn Thân / Suy Yếu / Dễ Vỡ của kẻ địch arc 2 đặt tối thiểu **2** (riêng `burn` là
  cộng dồn, `freeze`/`strength`/`regen`/`stealBuff`/`drainMoonPower` không phụ
  thuộc con số này).
- **Không dùng `empower` / `mark` trong chiêu địch** — cả hai chỉ cộng damage khi
  đòn đến từ lá bài (`ctx.card`, `01` §10.1); chiêu địch không có lá. Dùng
  `strength` (vĩnh viễn, áp cho mọi đòn) thay `empower` cho sát thủ/boss.
- **`stealBuff` trong chiêu địch:** được phép trong `IntentDef` (chỉ `onEnter` của
  phase boss co-op và hook Kỳ Vật/Binh Khí/Hợp Kích cấm — `02` §6). `hac_y_mat_tham`
  lấy 1 làm mồi, boss lấy 2–3.
- **`drainMoonPower … steal`:** cộng quỹ `moonPower` của kẻ địch đang thi hành
  (`01` §9.3.2) — vòng sau vẫn tính `base(r) + moonReserve`, nên phần "cướp" chủ yếu
  là nghĩa (Đoạt Nguyệt), không kỳ vọng lợi thế lớn; phần rút Dự Trữ mới là áp lực.
- **Tương thích redesign Nguyệt Luân (đã duyệt, chưa cài):** mỗi kẻ địch mới đúng 1
  `moonOverride` ở `new` — Nguyệt tính "Vô Nguyệt" tự nhiên; boss 4 override cho 4
  pha hiệu ứng như khuôn boss Arc 1. Khi redesign chạy (pha đầu ngẫu nhiên + Nguyệt
  Lệnh), `start.moonIndex` của s06 đè lên pha ngẫu nhiên — giữ ý đồ "đêm của Vô
  Nguyệt" nhưng cần xem lại cùng redesign.
- **Đã chỉnh theo mô phỏng** (80 seed × 3 đội mẫu, bot + Bộ cơ bản; chỉ đụng số
  kẻ địch mới, không đổi kẻ địch cũ / đội hình màn — T213). Bản đầu (HP 34/30/38/105)
  quá khắc nghiệt từ s03 trở đi (s04 8.8%, s06 1.3%, boss 5% với `m05+f04+m06`).
  Chỉnh: `vo_nguyet_am_sat` HP 30→18, Lãnh Đao 5→4, Ám Chủ 4→3, Đoạt Mệnh 8→7,
  Tản Ảnh cost 2→4 (Ẩn Thân hiếm hơn — tường vẫn có nhưng không liên tục), Tân Nguyệt
  Sát 8→3 + `stealth 2`→1; `vo_nguyet_nghi_si` HP 38→22, Tế Tinh 4→1, Tàn Nguyệt
  6→2, Vô Vọng cost 3→4; `vo_nguyet_anh_chu` HP 105→75, Ảnh Châm 5→4, Ám Chiếu 7→5,
  Đoạt Nguyệt 3→2 (hút lẫn damage), Vô Nguyệt Trảm 12→9, Vô Nguyệt Thiểm 14→10;
  `hac_y_mat_tham` HP 34→10, Ám Châm 4→2 (xem ghi chú lệch band bên dưới).
  Kết quả đội chính `m05+f04+m06` (mục tiêu 55–75% thường / 40–60% boss):
  s01 97.5, s02 100, s03 75.0, s04 78.8, s05 57.5, s06 60.0, s07 67.5, s08 43.8.
  Mọi màn đạt ≥ 60% với đội tốt nhất (chủ yếu `m01+m02+f04`; riêng s05/s08 là
  `m05+f03+f02`).
- **Lệch band còn lại (đã biết, chờ quyết):**
  - **s01/s02 vượt trần** (97.5/100) — chỉ cách nhau bởi `hac_y_mat_tham`: muốn s05
    qua sàn 55%/đội tốt nhất ≥60 thì mật thám buộc phải yếu (HP 10), kéo s01/s02 quá
    dễ. Hai hướng xử lý nếu muốn: (a) chấp nhận hai màn mở arc nhẹ hơn band (như
    Arc 1 các màn đầu ≥ 92.5%); (b) đổi đội hình s01/s02 (ví dụ thêm `hac_y_mat_tham`
    hoặc `vo_nguyet_am_sat`) — phải duyệt vì nằm ngoài "chỉ chỉnh kẻ địch mới".
  - **s04 vượt trần +3.8** (78.8) — cùng đội hình với s06; `moonIndex: 0` đã chốt
    giá s06 ~20 điểm nên s04 không thể ≤75 khi s06 ≥55. Giữ s06 trong band, chấp
    nhận s04 nhỉnh nhẹ.
  - `m05+f03+f02` ở s03 60.0 / s06 15.0 — dưới sàn với đội đó nhưng không phải đội
    tốt nhất của màn (m01+m02+f04 ≥ 97.5): đúng thiết kế "đội nhiều đòn lan".
- **Quyết định đã chốt (duyệt 7c.5):**
  1. s03 **giữ** 3 `vo_nguyet_am_sat` thuần — "bức tường Ẩn Thân" là điểm nhấn của
     arc; nếu mô phỏng kéo Cạn Bài quá nhiều thì chỉnh số chứ không đổi đội hình.
  2. s08 **không** ghim `start` — trận boss mở ở pha ngẫu nhiên như boss Arc 1
     (khác s06, màn duy nhất ghim `moonIndex: 0`).
  3. `stealBuff` giữ trên `hac_y_mat_tham` (Đạo Ấn, `stealBuff 1`) — đặt mồi cho
     `stealBuff 2–3` của boss.
  4. Override `new` của nghi sĩ **giữ** `stealth 1 allAllies` (+`strength 1`) —
     ở Trăng Non thành stealth 2 che cả đội, chấp nhận swing ở s06.
