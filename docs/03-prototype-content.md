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

Số khởi điểm (chỉnh ở mô phỏng 4e.7). Luật: `01` §14, `14` §13. Mỗi ô R2–R5 ghi **phần
thay đổi** so với cấp trước; phần không nhắc giữ nguyên. "(X: …)" = bản mệnh khi người
mang là Hero X (`signatureHooks`). Mọi Hero mang được mọi vũ khí.

### 7.1 Binh Khí (lá Binh Khí: tên · cost · số bản · loại)

| Vũ khí | Độ hiếm | Lá R1 | Nội tại R1 | R2 | R3 | R4 | R5 |
|---|---|---|---|---|---|---|---|
| Xích Diệm Thương `w_xich_diem_thuong` (bản mệnh M05) | Legendary | *Liệt Diệm* 4 · 2 · tấn công [attack]: gây 8, Thiêu Đốt 3 | Đầu trận người mang Phản Đòn 2 (M05: Phản Đòn 3, +1 Sức Mạnh) | gây 10 | cost 3 | gây 12 | Phản Đòn 3 (M05: Phản Đòn 5, +2 Sức Mạnh) |
| Ảnh Nguyệt Chủy `w_anh_nguyet_chuy` (M06) | Epic | *Ảnh Sát Chủy* 1 · 2 · tấn công [attack, assassin]: gây 3; mục tiêu ≤ 30% HP: gây 9 | Mỗi lá `assassin` thứ 3 của người mang: +1 NL (M06: +2) | 4 / 11 | thêm Đánh Dấu 1 vòng | 5 / 13 | thành mỗi lá thứ **2** |
| Hàn Tuyết Song Kiếm `w_han_tuyet_song_kiem` (F03) | Epic | *Song Tuyết* 4 · 2 · tấn công [attack]: gây 4 ×2; Tích Tụ 1: Đóng Băng 1 vòng | Đầu trận mọi kẻ địch Suy Yếu 1 vòng (F03: 2 vòng) | 5 ×2 | cost 3 | 6 ×2 | Suy Yếu 2 vòng (F03: 3 vòng, thêm Dễ Vỡ 1 vòng) |
| Thiên Diện Phiến `w_thien_dien_phien` (F02) | Epic | *Phiến Ảnh* 1 · 2 · kỹ năng [scheme]: Đoạt Nguyệt 1; Liên Hoàn 2: Cướp 1 buff | Khi Huyết Nguyệt bắt đầu: người mang +1 Sức Mạnh (F02: +1 Sức Mạnh, +2 NL) | Đoạt Nguyệt 2 | cost 0 | Liên Hoàn 2: Cướp 2 buff | +2 Sức Mạnh (F02: +2 Sức Mạnh, +3 NL) |
| Bách Hoa Trâm `w_bach_hoa_tram` (F04) | Rare | *Trâm Hoa* 2 · 2 · kỹ năng [heal]: 1 Hero Hồi Phục 3; Tích Tụ 1: 5 | Cuối lượt Hero máu thấp nhất Hồi Phục 1 (F04: 2) | 4 / 6 | cost 1 | 5 / 7 | Hồi Phục 2 (F04: 3) |
| Thiết Thuẫn `w_thiet_thuan` (chung — Vanguard) | Rare | *Thuẫn Kích* 2 · 2 · kỹ năng [ward]: nhận 6 giáp, Khiêu Khích 1 vòng | Đầu trận người mang 4 giáp | 7 giáp | cost 1 | 8 giáp | đầu trận 8 giáp |
| Liệt Cung `w_liet_cung` (chung — Striker) | Rare | *Liệt Tiễn* 3 · 2 · tấn công [attack]: gây 3 ×2, Đánh Dấu 1 vòng | Người mang kết liễu kẻ địch: +1 NL | 4 ×2 | cost 2 | 5 ×2 | +2 NL |
| Huyền Linh Kính `w_huyen_linh_kinh` (chung — Controller) | Epic | *Kính Hàn* 2 · 2 · kỹ năng [control, moon]: Tỏa Nguyệt 2, Suy Yếu 1 vòng | Khi vào Trăng Non: mọi kẻ địch Dễ Vỡ 1 vòng | Tỏa Nguyệt 3 | cost 1 | Suy Yếu 2 vòng | Trăng Non **hoặc Trăng Tròn** |
| Thanh Tâm Bình `w_thanh_tam_binh` (chung — Support) | Rare | *Bình Lộ* 3 · 2 · kỹ năng [heal]: mọi Hero hồi 3 (Dư Sinh) | Đầu trận người mang Hồi Phục 2 | hồi 4 | cost 2 | hồi 5 | đầu trận **mọi Hero** Hồi Phục 2 |
| Tinh Bàn `w_tinh_ban` (chung — Specialist) | Legendary | *Chuyển Tinh* 2 · 2 · kỹ năng [moon]: Đổi Vận 1 pha, Chiêm Bài 2 | Đầu trận: Dưỡng Nguyệt 1 (mỗi lượt +1 NL) | Chiêm Bài 3 | cost 1 | thêm +1 NL | Dưỡng Nguyệt 2 |

### 7.2 Nguyệt Bảo (mỗi cấp Cộng Minh là bản đầy đủ)

| Nguyệt Bảo | Độ hiếm | CM1 | CM2 | CM3 | CM4 | CM5 |
|---|---|---|---|---|---|---|
| Thiên Sách `r_thien_sach` | Legendary | Khi vào Trăng Tròn: +2 NL | +3 NL | Trăng Tròn hoặc Huyết Nguyệt bắt đầu: +3 NL | +4 NL | CM4, thêm: khi vào Trăng Non +2 NL |
| Vọng Nguyệt Kính `r_vong_nguyet_kinh` | Legendary | Mỗi lần trăng đổi pha: mọi Hero 2 giáp | 3 giáp | 4 giáp | 5 giáp | CM4, thêm: Huyết Nguyệt bắt đầu → mọi Hero 5 giáp |
| Huyết Ngọc Bội `r_huyet_ngoc_boi` | Epic | Trong Huyết Nguyệt: lá `forbidden` −1 NL | `forbidden` và `scheme` −1 | `forbidden` −2, `scheme` −1 | `forbidden` −2, `scheme` −2 | CM4, thêm: Huyết Nguyệt bắt đầu → +2 NL |
| Loan Linh Ấn `r_loan_linh_an` | Epic | Mỗi lá kỹ năng thứ 3 trong trận: +1 NL | +2 NL | mỗi lá thứ 2: +1 NL | mỗi lá thứ 2: +2 NL | CM4, thêm: mỗi lá tấn công thứ 3 +1 NL |
| Xích Diễm Châu `r_xich_diem_chau` | Epic | Khi hạ một kẻ địch: mọi kẻ địch còn lại Thiêu Đốt 2 | Thiêu Đốt 3 | Thiêu Đốt 4 | Thiêu Đốt 5 | CM4, thêm: Hero kết liễu +1 Sức Mạnh |
| Bạch Lộ Hương Nang `r_bach_lo_huong_nang` | Rare | Khi vào Trăng Tròn: Hero máu thấp nhất hồi 3 | hồi 5 | Trăng Tròn hoặc Trăng Non: hồi 5 | hồi 7 | CM4, thêm: Hero đó Hồi Phục 2 |
| Huyền Vũ Giáp Phù `r_huyen_vu_giap_phu` | Rare | Đầu trận mọi Hero 3 giáp | 4 giáp | 5 giáp | 6 giáp | CM4, thêm: Huyết Nguyệt bắt đầu → mọi Hero 3 giáp |
| Trấn Hồn Linh `r_tran_hon_linh` | Rare | Khi một Hero ngã: các Hero còn lại +1 Sức Mạnh | +2 | +3 | +4 | CM4, thêm: các Hero còn lại hồi 5 |

Đơn vị hành động: hook "+NL" dùng `front`; "mọi Hero" dùng `each`; "Hero máu thấp nhất"
dùng `lowestHp`; "kẻ địch" dùng `front` với `to: "allEnemies"`; "Hero kết liễu" dùng
`trigger`. Banner Binh Khí Các: legendary 2, epic 4, rare 4; Nguyệt Bảo Các: legendary
2, epic 3, rare 3 (theo cột độ hiếm ở trên).
