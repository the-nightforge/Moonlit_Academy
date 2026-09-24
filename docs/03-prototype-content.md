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
