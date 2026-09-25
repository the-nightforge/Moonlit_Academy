# Vọng Nguyệt Thư Viện — Tài liệu Thiết kế Game (GDD)

> **Loại dự án:** Game cá nhân, phi thương mại, không nạp tiền thật.
> **Nền tảng:** Webgame (chạy trên trình duyệt).
> **Thể loại:** Hero Deckbuilder thẻ bài 2D + Gacha + Co-op realtime + PvP.
> **Tài liệu liên quan:** `prompt-nhan-vat-vong-nguyet.md` (lore chi tiết + prompt art của 20 nhân vật).

Mọi con số trong tài liệu này là **giá trị khởi điểm**, cần tinh chỉnh sau khi chơi thử.

---

## 1. Tầm nhìn

Một game thẻ bài cổ phong nơi **quan hệ nhân vật, 4 Viện và chu kỳ mặt trăng** trở thành luật chơi. Hai nhân vật không chỉ khác nhau ở chỉ số và damage. Lore của họ chính là cơ chế của họ.

**Ba trụ cột:**
1. **Nguyệt Luân:** mặt trăng thay đổi luật chơi mỗi lượt.
2. **Lore thành cơ chế:** Hero thăng cấp theo tính cách, cặp đôi có lá bài riêng.
3. **Chơi cùng nhau:** co-op đánh boss, PvP công bằng.

**Nguồn cảm hứng gameplay:** Slay the Spire (khung chiến đấu PvE, ý định của địch), Genius Invokation TCG (3 nhân vật + deck), Legends of Runeterra (Hero thăng cấp trong trận), Marvel Snap (luật thay đổi theo bối cảnh), Yu-Gi-Oh (archetype theo phe).

---

## 2. Thế giới

Vương quốc **Hằng Châu** thờ mặt trăng như thần linh. Mỗi 100 năm, **Nguyệt Thực Máu** xảy ra và chọn ra một **Nguyệt Chủ** nắm thiên mệnh. **Vọng Nguyệt Thư Viện** là học viện tối cao, nơi quý tộc và thường dân tài năng tranh giành vị trí trước kỳ Nguyệt Thực sắp tới.

### Các phe

| Phe | Biểu tượng | Màu | Từ khóa gameplay |
|---|---|---|---|
| Thanh Loan Viện | Chim loan xanh | Xanh lam – bạc | **Mưu Lược:** rút bài, giảm giá lá |
| Huyền Vũ Viện | Rùa rắn đen | Đen – vàng đồng | **Hộ Thể:** giáp, phản đòn |
| Bạch Lộ Viện | Cò trắng | Trắng – xanh ngọc | **Điều Hòa:** hồi máu, giải debuff, làm chậm |
| Xích Diên Viện | Diều đỏ | Đỏ thẫm – tím | **Cấm Thuật:** mất HP đổi hiệu ứng mạnh, mạnh hơn vào Huyết Nguyệt |
| Trung lập | — | — | Lá bài dùng được trong mọi deck |

---

## 3. Chiến đấu cốt lõi

### 3.1 Thiết lập

- **Đội hình:** 3 Hero đứng thành 1 hàng, mỗi Hero có HP riêng. Không có grid, không di chuyển.
- **Deck 18 lá độc nhất** (không có 2 lá trùng id):
  - Lá kỹ năng của 3 Hero (GĐ 4a: mỗi Hero 6 lá cố định; GĐ 4b: tự xếp, mỗi Hero ít nhất 4 lá)
  - Binh Khí (sau này) mỗi lá chiếm 1 ô trong 18, không tính vào mức tối thiểu của Hero
  - Cộng thêm lá Song Hành nếu có cặp Bond (xem 3.5), không tính vào 18 lá
  - Mỗi lá vào chồng bài với số bản theo `copies` (1–3): lá yếu nhiều bản, lá mạnh ít bản
- **Nguyệt Bảo:** tối đa 2 relic, tác dụng lên cả đội.

### 3.2 Một lượt

0. Đầu trận: rút 6 lá, **Đổi Bài** — đổi tối đa 2 lá một lần.
1. Nhận Nguyệt Lực: **3 ở vòng 1, +1 mỗi vòng, tối đa 8**, cộng **Nguyệt Lực Dự Trữ** (phần chưa dùng lượt trước, tối đa 3).
2. **Rút bù** cho đủ 6 lá trên tay. Chồng bài không xáo lại; hết cả chồng lẫn tay là thua (**Cạn Bài**).
3. Đánh bài. Mỗi lá tốn Nguyệt Lực và do **Hero sở hữu lá đó** thực hiện.
4. Kết thúc lượt: **giữ bài trên tay**, chỉ bỏ lá Tàn Chiêu.
5. Kẻ địch dùng Nguyệt Lực (cùng đường cong) để đánh **chuỗi chiêu đã báo trước** (tối đa 3 chiêu).
6. Nguyệt Luân tiến 1 pha.

**Lá bài thuộc về Hero:** Hero nào ngã thì các lá của Hero đó thành **Tàn Chiêu** (không đánh được, chiếm chỗ trên tay). Người chơi phải cân nhắc bảo vệ ai.

**Ý định của địch:** biểu tượng trên đầu kẻ địch cho biết lượt sau nó đánh ai, bao nhiêu damage, hay buff/debuff.

### 3.3 Nguyệt Luân

Thanh 8 pha, tự tiến 1 pha mỗi lượt, luôn hiện pha kế tiếp.

```
🌑 Trăng Non → 🌒 → 🌓 Bán Nguyệt → 🌔 → 🌕 Trăng Tròn → 🌖 → 🌗 Hạ Huyền → 🌘
```

| Pha | Hiệu ứng mẫu |
|---|---|
| 🌑 Trăng Non | Lá sát thủ +50% damage, ẩn thân kéo dài thêm 1 lượt |
| 🌓 Bán Nguyệt | Lá khống chế tốn ít hơn 1 Nguyệt Lực (tối thiểu 1) |
| 🌕 Trăng Tròn | Hồi máu x2 |
| 🌗 Hạ Huyền | Giáp nhận được +50% |
| 🔴 **Huyết Nguyệt** (pha đặc biệt) | Mở khóa lá Cấm Thuật mạnh nhất; mọi Hero mất 2 HP mỗi lượt |

- **Đổi Vận:** một số lá đẩy trăng tiến/lùi 1–2 pha, hoặc (hiếm) kích hoạt Huyết Nguyệt trong 2 lượt.
- **Boss** hành động khác nhau theo pha.
- Các pha trung gian (🌒🌔🌖🌘) không có hiệu ứng chung nhưng có thể là điều kiện của lá bài cụ thể.

### 3.4 Hero thăng cấp trong trận

Mỗi Hero có **điều kiện thăng cấp** gắn với lore. Khi đạt điều kiện: card lật, art đổi sang dạng thăng cấp, nhận hiệu ứng mới cho đến hết trận.

### 3.5 Song Hành (Bond)

Khi đội có đủ một cặp, deck tự thêm **1 lá Song Hành**. Lá này chỉ đánh được khi cả hai Hero còn đứng.

| Cặp | Lá Song Hành | Hiệu ứng mẫu |
|---|---|---|
| M01 + F01 | *Nguyệt Sách* | F01 dùng kỹ năng ánh trăng; M01 được đánh 1 lá Mưu Lược miễn phí |
| M05 + F03 | *Băng Hỏa Tranh Phong* | Lá của người này crit thì người kia rút 1 lá |
| M06 + F02 | *Ảnh Đấu* | Cướp 1 buff của địch, M06 vào trạng thái ẩn thân |
| M08 + F08 | *Sư Đồ Nghịch Mệnh* | Kích hoạt Huyết Nguyệt 1 lượt, M08 chọn pha trăng tiếp theo |
| M09 + F06 | *Khúc Vũ Tri Âm* | Mê hoặc 1 địch, mọi debuff trên nó kéo dài thêm 1 lượt |
| F09 + F10 | *Nguyệt Thố Hộ Mệnh* | Thỏ ngọc bảo vệ Hero máu thấp nhất, chặn 1 đòn chí mạng |
| M03 + M10 | *Kim Bút Đồng Tâm* | Rút 2 lá, lá rẻ nhất trên tay giảm 1 Nguyệt Lực |
| M02 + M01 | *Thân Vệ* | M02 đỡ mọi đòn nhắm vào M01 trong 1 lượt, nhận giáp |

---

## 4. Danh sách Hero

**Archetype:** Vanguard (tank/bruiser), Striker (DPS/sát thủ), Controller (khống chế), Support (hồi máu/buff/giáp), Specialist (triệu hồi/cướp/điều khiển trăng).

| ID | Hero | Độ hiếm | Phe | Archetype | Điều kiện thăng cấp | Dạng thăng cấp |
|---|---|---|---|---|---|---|
| M01 | Tạ Vân Chiêu | Legendary | Thanh Loan | Support | Đội đánh 8 lá Mưu Lược | *Thiên Cơ:* mỗi lượt lá rẻ nhất giảm 1 Nguyệt Lực |
| M02 | Lục Hàn Phong | Epic | Huyền Vũ | Vanguard | Đỡ đòn thay đồng đội 3 lần | *Thiết Bích:* nhận giáp đầu mỗi lượt |
| M03 | Mặc Tử Du | Rare | Thanh Loan | Specialist | Rút tổng 10 lá | *Vạn Kim:* đầu lượt rút thêm 1 lá |
| M04 | Bùi Thanh Minh | Epic | Bạch Lộ | Support | Hồi tổng 20 HP | *Thần Y:* mỗi lần hồi máu giải 1 debuff |
| M05 | Hoắc Liệt | Legendary | Huyền Vũ | Vanguard | Nhận tổng 15 damage | *Liệt Hỏa:* lá tấn công +3 damage |
| M06 | Tô Dạ | Epic | Trung lập | Striker | Kết liễu 1 kẻ địch | *Vô Nguyệt:* lá đầu tiên mỗi lượt miễn phí |
| M07 | Ninh An | Rare | Bạch Lộ | Specialist | Sống sót 5 lượt | *Huyết Mạch:* nhận 1 buff mạnh ngẫu nhiên mỗi lượt |
| M08 | Khương Tịch | Legendary | Xích Diên | Controller | Dùng Đổi Vận 3 lần | *Quan Tinh:* thấy trước 3 pha, được chọn pha kế tiếp |
| M09 | Đoàn Lạc | Epic | Bạch Lộ | Controller | Gây 6 debuff | *Vong Quốc Khúc:* debuff kéo dài thêm 1 lượt |
| M10 | Chu Quyết | Rare | Thanh Loan | Striker | Tích 5 điểm Khổ Học (+1 mỗi lượt) | *Bác Học:* lá Mưu Lược có hiệu ứng x2 |
| F01 | Thẩm Nguyệt Hoa | Legendary | Thanh Loan | Specialist | Trải qua 1 pha Trăng Tròn | *Nguyệt Chủ:* mở lá tối thượng *Nguyệt Hoa Chiếu Thế* |
| F02 | Diệp Linh Lung | Epic | Xích Diên | Specialist | Cướp 3 buff | *Thiên Diện:* sao chép lá vừa đánh của địch |
| F03 | Tần Sương | Epic | Huyền Vũ | Striker | Đóng băng 3 lần | *Hàn Sơn Kiếm:* đánh vào địch bị băng gây x2 damage |
| F04 | Ôn Như Ý | Rare | Bạch Lộ | Support | Duy trì hồi máu theo lượt trong 4 lượt | *Bách Thảo:* hồi máu theo lượt lan ra cả đội |
| F05 | Hạ Chi | Rare | Huyền Vũ | Striker | Bắn trúng địch hàng sau 4 lần | *Xuyên Vân Tiễn:* đòn bắn xuyên 2 mục tiêu |
| F06 | Lam Khê | Epic | Bạch Lộ | Controller | Mê hoặc 2 lần | *Kinh Hồng Vũ:* địch bị mê hoặc đánh đồng đội của nó |
| F07 | Cố Uyển | Rare | Thanh Loan | Controller | Phong ấn 3 kỹ năng địch | *Sử Bút:* xem trước 2 ý định tiếp theo của địch |
| F08 | Phượng Chiêu Dung | Legendary | Xích Diên | Striker | Mất tổng 15 HP bởi Cấm Thuật | *Huyết Phượng:* lá Cấm Thuật không còn tốn HP |
| F09 | Tiểu Mãn | Common | Bạch Lộ | Specialist | Triệu hồi 5 lần | *Thỏ Ngọc Thức Tỉnh:* linh thú mạnh gấp đôi |
| F10 | Liễu Tịnh Nhan | Legendary | Trung lập | Support | 1 đồng đội ngã | *Nguyệt Hồn:* hồi sinh người đó với 30% HP (1 lần/trận) |

**Phân bổ phe hiện tại:** Thanh Loan 5, Huyền Vũ 4, Bạch Lộ 6, Xích Diên 3, Trung lập 2. Nên ưu tiên Xích Diên khi thêm Hero mới.

**F09 Tiểu Mãn** có tiến trình đặc biệt ngoài trận: Common → nhiệm vụ cốt truyện *Nguyệt Thố Tỉnh Giấc* → Epic → nhiệm vụ *Chân Thân* → mở dạng thăng cấp thứ hai.

### 4.1 Mẫu bộ 5 lá kỹ năng — M05 Hoắc Liệt

| Lá | Giá | Hiệu ứng |
|---|---|---|
| *Liệt Hỏa Xung Phong* | 2 | Gây 8 damage. Nếu HP của M05 dưới 50%: gây 12 |
| *Hổ Gầm* | 1 | Khiêu khích: địch nhắm vào M05 lượt sau, M05 nhận 5 giáp |
| *Thương Phá* | 1 | Gây 5 damage, xóa giáp của mục tiêu |
| *Trấn Bắc Huyết Tính* | 0 | Mất 3 HP, lá tấn công tiếp theo +4 damage |
| *Bất Khuất* | 2 | Hồi 6 HP. Trăng Non: thêm 1 Nguyệt Lực |

Làm tương tự cho 19 Hero còn lại trong giai đoạn thiết kế nội dung.

---

## 5. Trang bị

### 5.1 Binh Khí (vũ khí)

- Mỗi Hero trang bị 1 vũ khí, vũ khí góp **1 lá Binh Khí** vào deck và cho **1 nội tại nhỏ**.
- Mỗi Hero có 1 vũ khí **bản mệnh** hợp nhất (nội tại mạnh hơn khi trang bị đúng Hero).

| Vũ khí | Độ hiếm | Bản mệnh | Lá Binh Khí | Nội tại |
|---|---|---|---|---|
| Ngọc Bút | Legendary | M01 | *Bút Định Càn Khôn:* rút 2, lá Mưu Lược kế tiếp miễn phí | Đầu trận +1 Nguyệt Lực |
| Xích Diệm Thương | Legendary | M05 | *Liệt Diệm:* gây 10 damage, thiêu đốt 3 lượt | Nhận damage: +1 Nộ |
| Hàn Tuyết Song Kiếm | Epic | F03 | *Song Tuyết:* 2 lần 4 damage, đóng băng nếu cả 2 trúng | Đòn đầu mỗi trận làm chậm |

### 5.2 Nguyệt Bảo (relic vĩnh viễn)

- Cả đội mang tối đa 2 Nguyệt Bảo. Hiệu ứng **cố định** (không có chỉ số phụ ngẫu nhiên) để dễ balance.
- Phân biệt với **Kỳ Vật**: relic tạm thời chỉ tồn tại trong một lượt chơi roguelike.

| Nguyệt Bảo | Độ hiếm | Hiệu ứng (Cộng Minh 1) |
|---|---|---|
| Thiên Sách | Legendary | Trăng Tròn: rút thêm 2 lá |
| Huyết Ngọc Bội | Epic | Huyết Nguyệt: lá Cấm Thuật giảm 1 Nguyệt Lực |
| Bạch Lộ Hương Nang | Rare | Trăng Tròn: hồi 3 HP cho Hero máu thấp nhất |

---

## 6. Gacha

### 6.1 Nguyên tắc

- **Không nạp tiền thật.** Tiền tệ quay gacha (**Nguyệt Ngọc**) chỉ kiếm được bằng cách chơi.
- Công khai tỉ lệ trong game để minh bạch.
- **Quay trên server**, vì bộ sưu tập ảnh hưởng đến PvP và co-op.

### 6.2 Ba banner

| Banner | Nội dung | Giá |
|---|---|---|
| **Triệu Hồi Anh Hùng** | Hero | 1 lượt = 160 Nguyệt Ngọc |
| **Binh Khí Các** | Vũ khí | 1 lượt = 160 Nguyệt Ngọc |
| **Nguyệt Bảo Các** | Relic | 1 lượt = 160 Nguyệt Ngọc |

### 6.3 Tỉ lệ và bảo hiểm (khởi điểm)

| Độ hiếm | Tỉ lệ |
|---|---|
| Legendary | 2% |
| Epic | 13% |
| Rare / Common | 85% |

- **Bảo hiểm Epic:** mỗi 10 lượt chắc chắn có ít nhất 1 Epic trở lên.
- **Bảo hiểm Legendary:** lượt thứ 70 chắc chắn ra Legendary; từ lượt 55 tỉ lệ tăng dần.
- **Banner giới hạn:** ra Legendary lần đầu có 50% là nhân vật được quảng bá; nếu lệch, lần Legendary tiếp theo chắc chắn đúng.
- Bảo hiểm tính riêng cho từng banner.

Vì không có tiền thật, có thể đặt tỉ lệ rộng tay hơn game thương mại. Mục tiêu là người chơi đều đặn có Legendary mới sau vài tuần chơi.

---

## 7. Xử lý trùng

### 7.1 Hero: Tinh Hồn (0 → 6)

Cấp **lẻ** mở **lựa chọn** (dùng được trong PvP), cấp **chẵn** tăng **sức mạnh** (chỉ PvE và co-op).

| Cấp | Loại | Nội dung | PvP |
|---|---|---|---|
| Tinh Hồn 1 | Lựa chọn | Mở 1 lá kỹ năng thay thế | ✅ |
| Tinh Hồn 2 | Sức mạnh | Điều kiện thăng cấp dễ hơn | ❌ |
| Tinh Hồn 3 | Lựa chọn | Mở thêm 1 lá thay thế | ✅ |
| Tinh Hồn 4 | Sức mạnh | Lá chủ lực thành bản "+" | ❌ |
| Tinh Hồn 5 | Lựa chọn | Mở dạng thăng cấp thứ hai (chọn trước trận) | ✅ |
| Tinh Hồn 6 | Hiển thị | Art thăng cấp riêng, khung card đặc biệt, hiệu ứng lật bài | ✅ Hiển thị |

**Quy tắc thiết kế:** lá thay thế phải **ngang sức** lá gốc, khác cách chơi chứ không mạnh hơn.

### 7.2 Vũ khí: Tinh Luyện (R1 → R5)

| Cấp | Nội dung |
|---|---|
| R1 | Bản gốc |
| R2 | Hiệu ứng +15% |
| R3 | Lá Binh Khí giảm 1 Nguyệt Lực hoặc thêm hiệu ứng phụ |
| R4 | Hiệu ứng +15% |
| R5 | Nội tại mạnh lên rõ rệt + hiệu ứng hình ảnh riêng |

### 7.3 Nguyệt Bảo: Cộng Minh (1 → 5)

| Cấp | Nội dung |
|---|---|
| 1 | Hiệu ứng gốc |
| 2–4 | Tăng số hoặc mở rộng điều kiện (ví dụ "Trăng Tròn" thành "Trăng Tròn và Trăng Khuyết") |
| 5 | Mở hiệu ứng thứ hai + art phát sáng |

### 7.4 Trùng khi đã max

| Loại | Legendary | Epic | Rare/Common |
|---|---|---|---|
| Hero (sau Tinh Hồn 6) | 25 Nguyệt Tinh | 10 Nguyệt Tinh | 3 Nguyệt Tinh |
| Vũ khí (sau R5) | Huyền Thiết + 10 Nguyệt Tinh | Huyền Thiết + 4 Nguyệt Tinh | Huyền Thiết + 1 Nguyệt Tinh |
| Nguyệt Bảo (sau Cộng Minh 5) | Nguyệt Trần + 10 Nguyệt Tinh | Nguyệt Trần + 4 Nguyệt Tinh | Nguyệt Trần + 1 Nguyệt Tinh |

**Cửa hàng Nguyệt Tinh:**
- Vé chọn 1 Hero Epic (xoay vòng hàng tháng)
- Vé quay gacha
- Skin, khung card, hiệu ứng lật bài
- Vé chọn Hero Legendary (giá rất cao, mục tiêu dài hạn)

---

## 8. Chế độ chơi

### 8.1 Cốt truyện (PvE)

Chuỗi trận cố định, chia theo 6 arc:

| Arc | Tên | Nội dung chính |
|---|---|---|
| 1 | Vọng Nguyệt | Học viện mở cửa, giới thiệu 4 Viện |
| 2 | Bóng Tối | M06, F02, M08 dính vào âm mưu |
| 3 | Huyết Nguyệt | F08 bắt đầu hành động |
| 4 | Nguyệt Chủ | F01 đối diện thiên mệnh |
| 5 | Kẻ Được Chọn | Bí mật huyết thống của M07 |
| 6 | Nguyệt Thực | Các phe xung đột lớn |

Mỗi arc gắn với: chương truyện, banner Hero, sự kiện, boss.

### 8.2 Nguyệt Thực Roguelike (PvE, chế độ chơi lại chính)

- Chọn 3 Hero + trang bị, bắt đầu với deck 18 lá.
- Đi qua bản đồ nút: **Trận thường → Sự kiện → Tinh Anh → Kho Báu → Nghỉ Chân → Boss**.
- Nhận trong lượt chơi: lá bài mới, **Kỳ Vật**, Phúc Nguyệt (buff), Lời Nguyền (debuff đổi phần thưởng).
- Cuối lượt chơi: **Boss Huyết Nguyệt**.
- Mọi thứ nhận trong lượt chơi mất khi kết thúc; phần thưởng vĩnh viễn là tài nguyên và Nguyệt Ngọc.

### 8.3 Co-op Raid (realtime, 2 người)

- Mỗi người mang **3 Hero** và deck riêng; hai người **chung Nguyệt Luân** và đánh cùng 1 boss.
- **Lượt đồng thời:** cả hai cùng đánh bài trong một lượt có đồng hồ (ví dụ 45 giây), rồi hết lượt thì boss hành động.
- **Hợp Kích:** nếu trong cùng một lượt, người A đánh lá có nhãn X và người B đánh lá có nhãn Y phù hợp → kích hoạt đòn hợp kích.

| Người A | Người B | Hợp Kích |
|---|---|---|
| Lá Mưu Lược (Thanh Loan) | Lá Băng (F03) | *Băng Nguyệt Kế:* đóng băng toàn bộ địch 1 lượt |
| Ẩn thân (M06) | Debuff (F02) | *Ám Ảnh Tuyệt Sát:* kết liễu địch dưới 25% HP |
| Đổi Vận sang Trăng Tròn | Lá hồi máu | *Nguyệt Quang Phổ Chiếu:* hồi máu cho cả 6 Hero |

- **Boss Nguyệt Thực (4 giai đoạn):**
  1. Bình thường
  2. Huyết Nguyệt: boss mạnh hơn, mở lá Cấm Thuật cho người chơi
  3. Đánh dấu ngẫu nhiên: 1 Hero bị nhắm, người kia phải bảo vệ
  4. Boss tự hồi sinh 1 lần nếu không bị kết liễu trong 2 lượt
- Dùng **sức mạnh đầy đủ** (Tinh Hồn, R5, Cộng Minh 5).

### 8.4 PvP — Đấu Trường Công Bằng

- 1 đấu 1, theo lượt, có đồng hồ mỗi lượt.
- **Chuẩn hóa hoàn toàn:**

| Hạng mục | Trong PvP |
|---|---|
| Chỉ số Hero | Bảng chỉ số PvP riêng, không phụ thuộc cấp người chơi |
| Lá kỹ năng | Bản gốc, không có bản "+"; được dùng lá thay thế đã mở |
| Vũ khí | Tất cả về mức R1 |
| Nguyệt Bảo | Tất cả về Cộng Minh 1 |
| Luật deck | 3 Hero, 18 lá, 1 vũ khí/Hero, 2 Nguyệt Bảo |
| Hiển thị | Art, khung card, skin hiện đầy đủ |

- **Pool Hero thử miễn phí** 4–5 Hero xoay vòng mỗi tuần.
- **Vũ khí và Nguyệt Bảo PvP cơ bản** phát miễn phí cho mọi người.
- Mùa giải có xếp hạng; thưởng cuối mùa là khung card và danh hiệu.

---

## 9. Kinh tế tài nguyên

| Tài nguyên | Nguồn chính | Dùng để |
|---|---|---|
| **Nguyệt Ngọc** | Mọi chế độ, nhiệm vụ ngày/tuần, thành tựu | Quay gacha |
| **Nguyệt Tinh** | Trùng khi đã max | Cửa hàng Nguyệt Tinh |
| **EXP Hero** | Cốt truyện, roguelike | Lên cấp Hero |
| **Huyền Thiết** | Roguelike, phân giải vũ khí | Nâng cấp vũ khí |
| **Nguyệt Trần** | Co-op Raid, phân giải relic | Nâng cấp Nguyệt Bảo |
| **Vinh Dự** | PvP | Shop PvP: relic chọn lọc, vé chọn Hero Epic, khung card mùa giải |

Mỗi chế độ cho loại tài nguyên khác nhau để người chơi không bị ép cày một chế độ duy nhất.

### Vòng lặp chính

```
Cốt truyện / Roguelike ──→ EXP, Huyền Thiết, Nguyệt Ngọc
          │
          ↓
      Quay Gacha ──→ Hero / Vũ khí / Nguyệt Bảo mới
          │
          ↓
  Xây đội (Phe + Song Hành + Trang bị)
          │
          ├──→ Co-op Raid ──→ Nguyệt Trần, Nguyệt Ngọc
          └──→ PvP ──→ Vinh Dự
          │
          ↓
    Arc cốt truyện mới + banner mới
```

---

## 10. Kiến trúc kỹ thuật (webgame)

### 10.1 Công nghệ đề xuất

| Phần | Công nghệ | Lý do |
|---|---|---|
| Ngôn ngữ | **TypeScript** (toàn bộ) | Client và server dùng chung code; AI viết TypeScript rất tốt |
| Render game | **Phaser** (hoặc PixiJS + GSAP) | Phaser có sẵn scene, tween, particle, input, rất hợp card game |
| Build tool | Vite | Nhanh, dễ cấu hình |
| Multiplayer | **Colyseus** (Node.js) | Framework phòng chơi, đồng bộ trạng thái, hợp cả PvP lẫn co-op |
| API và lưu dữ liệu | Node.js + PostgreSQL (bắt đầu có thể dùng SQLite) | Tài khoản, kho đồ, gacha |
| Test | Vitest | Test luật chơi không cần mở game |

Kiểm tra phiên bản mới nhất và tài liệu của từng thư viện khi bắt đầu, vì các thư viện web cập nhật khá nhanh.

### 10.2 Cấu trúc thư mục (monorepo)

```
vong-nguyet/
├── packages/
│   ├── rules/        # Bộ luật chơi thuần TypeScript, KHÔNG phụ thuộc Phaser hay server
│   └── data/         # JSON: Hero, lá bài, vũ khí, relic, bảng chỉ số PvE/PvP, tỉ lệ gacha
├── apps/
│   ├── client/       # Vite + Phaser: hiển thị, animation, UI
│   └── server/       # Node + Colyseus: phòng PvP/co-op, gacha, kho đồ, tài khoản
└── assets/           # Art gốc (Git LFS)
```

### 10.3 Nguyên tắc quan trọng

1. **`rules` là trái tim của game.** Nhận vào trạng thái + hành động, trả ra trạng thái mới. Không vẽ, không mạng, không đọc thời gian thật.
2. **Deterministic:** mọi yếu tố ngẫu nhiên dùng RNG có seed, để server và client cùng một seed ra cùng kết quả, và dễ tái hiện lỗi.
3. **Server là trọng tài:** trong PvP và co-op, client chỉ gửi "tôi muốn đánh lá X"; server chạy `rules`, kiểm tra hợp lệ, rồi gửi trạng thái mới cho cả hai bên.
4. **Gacha và kho đồ chỉ tính trên server.**
5. **Dữ liệu tách khỏi code:** balance bằng cách sửa JSON trong `data`, kể cả bảng chỉ số PvP riêng.

### 10.4 Quản lý source code

- Git + GitHub (repo private).
- `.gitignore`: `node_modules/`, `dist/`, `.env`, file log.
- **Git LFS** cho art gốc (`*.png`, `*.psd`, `*.webp`, audio).
- Nhánh theo tính năng: `feature/moon-phase`, `feature/gacha-server`...

---

## 11. Art

- Prompt và lore chi tiết: xem `prompt-nhan-vat-vong-nguyet.md`.
- Mỗi Hero cần **2 art**: dạng thường và dạng thăng cấp. Hero Tinh Hồn 6 có thêm art riêng.
- **Khung card theo độ hiếm:** Common (trắng xám), Rare (xanh lam), Epic (tím bạc), Legendary (vàng kim + bạc, có hào quang).
- **Xuất ảnh cho web:** định dạng WebP, ảnh card khoảng 512×768 cho trong trận, bản lớn hơn cho màn hình xem Hero, để trang tải nhanh.
- **Hiệu ứng làm bằng code:** lật card, thăng cấp, quay gacha, pha trăng đổi màu nền, đều dùng tween và particle của Phaser, không cần vẽ frame-by-frame.

---

## 12. Lộ trình

| Giai đoạn | Mục tiêu | Nội dung |
|---|---|---|
| **0. Khởi động** | Dựng dự án | Monorepo, Vite + Phaser chạy được, Git + LFS |
| **1. Prototype** | Chơi thấy vui | `rules` với 3 Hero (M05, F04, M06), 15 lá, 2 loại địch, Nguyệt Luân, ý định địch; chơi offline, art tạm |
| **2. Chiều sâu** | Bản sắc | Thăng cấp Hero, 3 lá Song Hành, 4 từ khóa phe, 1 boss |
| **3. Roguelike** | Chơi lại | Bản đồ nút, Kỳ Vật, phần thưởng lá bài |
| **4. Server + Meta** | Có tài khoản | Server lưu kho đồ, gacha 3 banner, Tinh Hồn / Tinh Luyện / Cộng Minh, art thật |
| **5. PvP** | Đấu Trường Công Bằng | Phòng Colyseus 1v1, bảng chỉ số PvP, xếp hạng đơn giản |
| **6. Co-op** | Raid 2 người | Lượt đồng thời, Hợp Kích, Boss Nguyệt Thực |
| **7. Nội dung** | Đủ game | Đủ 20 Hero, Arc 1–2, thêm vũ khí và relic |

**Nguyên tắc:** mỗi giai đoạn phải có bản chơi được trước khi sang giai đoạn sau. Luôn giữ `rules` có test đầy đủ, vì PvP và co-op đều dựa vào nó.
