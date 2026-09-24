# Playtest Notes — Phase 1 (offline prototype)

Playtest scripted: `packages/rules/test/playtest.test.ts` mô phỏng mỗi
encounter bằng heuristic tham lam (đánh lá đánh được đầu tiên trên tay, mục
tiêu hợp lệ đầu tiên, kết thúc lượt khi không còn đánh được). Đây là **sàn
kỹ năng** — người chơi thật chơi tốt hơn nhờ chọn mục tiêu, timing hồi máu,
tận dụng hệ số trăng.

Đội hình: m05 + f04 + m06. Seed: 42 / 7 / 2024.

## Kết quả

| Encounter | Địch | 42 | 7 | 2024 | Thăng cấp (vòng) |
|-----------|------|----|---|------|-------------------|
| enc_01 | puppet_guard + shadow_fox | Thắng v8 | Thắng v8 | Thắng v8 | m05 v3–v6; m06 v6–v7; f04 v4 (1/3) |
| enc_02 | shadow_fox ×3 | Thắng v11 | **Thua v9** | Thắng v7 | m05 v4–v5; m06 v9–v11; f04 v7 (1/3) |
| enc_03 | puppet_guard ×2 | Thắng v11 | **Thua v15** | Thắng v13 | m05 v3–v4; m06 v8–v13; f04 v4 (1/3) |

7/9 trận thắng với heuristic tối thiểu. Không stalemate, determinism giữ
nguyên (mỗi seed lặp lại y hệt).

## Trả lời các câu hỏi mục 6 (doc 03)

**Trận có quá dài / quá ngắn không? (mục tiêu 5–8 vòng)**
enc_01 đúng chuẩn (8 vòng mọi seed). enc_02 hơi vượt (7–11). enc_03 vượt
rõ (11–15) — 2 puppet_guard 42 HP kéo dài trận; nếu playtest tay xác nhận
thì giảm HP xuống ~36–38.

**Có Hero nào gần như không bao giờ thăng cấp không?**
f04 chỉ thăng 3/9 sim — bộ đếm `turnsWithAllyRegen` phụ thuộc lá regen
được rút đúng lúc, heuristic không giữ regen chủ động. m05 thăng đều và
sớm (v3–v6, đếm damageTaken). m06 thăng khi trận đủ dài để có kill
(v6–v13). Không Hero nào "không bao giờ", nhưng f04 cần theo dõi khi chơi
tay.

**Nguyệt Quang Dẫn có đáng 2 Nguyệt Lực không?**
Heuristic đánh 0–3 lần/trận tùy seed. Chưa kết luận được từ sim (heuristic
không căn pha để tận dụng) — câu hỏi mở cho playtest tay.

**Tàn Chiêu có quá phạt không?**
7/9 sim có ít nhất 1 Hero ngã nhưng vẫn thắng 5/7 trận đó → mất 1 Hero
không phải "thua chắc". Mức phạt hiện chấp nhận được.

**Người chơi có phản ứng theo ý định địch không?**
Heuristic không phản ứng — câu hỏi dành cho playtest tay (kiểm tra trên
UI: đổi mục tiêu theo Khiêu Khích, xem số damage ý định trước khi quyết
định).

## Quan sát khác

- Nguyệt Luân có tác động đo được: pha heal ×2 và assassin ×1.5 đổi hẳn
  số vòng cần thiết; enc_02 seed 2024 thắng nhanh v7 phần nào nhờ pha thuận.
- enc_02 thua khi damage dàn đều 3 mục tiêu → focus-fire là quyết định
  quan trọng, tốt cho "cảm giác phải suy nghĩ".

## Điểm cần theo dõi khi playtest tay

- [ ] enc_03 quá dài/khó? (11–15 vòng, thắng thường chỉ còn 1 Hero)
- [ ] f04 có cảm giác "không bao giờ thăng cấp" không?
- [ ] Nguyệt Quang Dẫn 2 NL — đáng không?
- [ ] Tay toàn Tàn Chiêu / lá không đánh được → cảm giác "bí"?
- [ ] Animation lượt địch đủ rõ ai đánh ai không?

## Không chỉnh data

Chưa thay đổi `data/*.json`: kết quả nằm trong ngưỡng chấp nhận được cho
prototype và heuristic không phải người chơi thật. Checklist trên để đối
chiếu khi chơi tay.

---

# Playtest Notes — Phase 2 (bước 2.8)

Cùng heuristic tham lam như giai đoạn 1 (sàn kỹ năng, không phải người chơi
thật). Playtest giờ chạy **4 đội × 4 encounter × 3 seed** (42 / 7 / 2024) và đo
thêm: số lá Song Hành đã đánh, số lượt bắt đầu trong Huyết Nguyệt, số lần Phản
Đòn, số buff bị cướp.

| Đội | Vì sao chọn |
|---|---|
| m05 + f04 + m06 | Đội giai đoạn 1, không Song Hành — mốc so sánh |
| m05 + f03 + f02 | Băng Hỏa Tranh Phong, Huyết Nguyệt, Cấm Thuật |
| m06 + f02 + f03 | Ảnh Đấu |
| m05 + f03 + f04 | Băng Hỏa Tranh Phong + Tuyết Trung Tống Thán |

## Chỉnh data sau lượt chạy đầu

| Thay đổi | Lý do (số liệu) |
|---|---|
| Khôi Lỗi `guard_stance`: `strength 1` → `regen 2` | Với strength, đội mốc thua enc_03 **0/3** (Sức Mạnh vĩnh viễn cộng dồn mỗi 3 vòng trên cả hai Khôi Lỗi). Thử tắt buff: 3/3. Chỉ hạ HP Khôi Lỗi 42 → 36 vẫn 0/3. Với regen 2: 2/3, như giai đoạn 1 |
| Boss `moon_ape` HP 140 → 110 | Lượt đầu chỉ 3/12 trận boss thắng (đều là đội m05+f03+f04). Với 110: 5/12 |

## Kết quả (data sau khi chỉnh)

Thắng / 3 seed, (số vòng):

| Đội | enc_01 | enc_02 | enc_03 | enc_04 (boss) | Tổng |
|---|---|---|---|---|---|
| m05+f04+m06 | 3/3 (8–9) | 2/3 (7–19) | 2/3 (12–18) | 0/3 (18–37) | 7/12 |
| m05+f03+f02 | 3/3 (7–10) | 3/3 (7–9) | 2/3 (8–12) | 2/3 (12–23) | 10/12 |
| m06+f02+f03 | 1/3 (7–12) | 3/3 (7–10) | 0/3 (9–12) | 0/3 (15–16) | 4/12 |
| m05+f03+f04 | 3/3 (13–20) | 3/3 (11–12) | 2/3 (12–21) | 3/3 (16–28) | 11/12 |

32/48 trận thắng. Không stalemate, determinism giữ nguyên.

## Trả lời các câu hỏi (doc 03 mục 6 + mục tiêu giai đoạn 2)

**Trận có quá dài không? (mục tiêu 5–8 vòng)**
enc_01/enc_02 vẫn gần chuẩn với đội mốc. Boss **quá dài**: 12–37 vòng, kể cả khi
thắng. Đội m05+f03+f04 kéo mọi trận dài ra (11–28 vòng) vì hồi máu + khóa Đóng
Băng: ít chết nhưng gây damage chậm.

**Có Hero nào gần như không bao giờ thăng cấp không?**
**F02 thăng cấp 0/24 trận** có F02. Cần cướp 3 buff, nhưng mỗi trận chỉ cướp
được 0–1 buff; và F02 **ngã ở 23/24 trận** (HP 26, tự mất HP qua Huyết Trâm /
Phệ Hồn, cộng Huyết Nguyệt). F03 thăng đều (v5–v10). M05, M06, F04 như giai đoạn 1.

**Song Hành có tạo quyết định không?**
Đội m05+f03+f04 đánh 1–10 lá Song Hành/trận: *Tuyết Trung Tống Thán* rẻ (1, còn
0 ở Bán Nguyệt và Trăng Tròn nhờ tag `control`/`harmony`) và rất mạnh. Hai đội
kia chỉ 0–2 lá/trận (deck 16 lá, một lá Song Hành).

**Huyết Nguyệt có được dùng không?**
Hiếm: 0–2 lượt/trận, vì chỉ có một nguồn (*Đổi Vận Chú*) và heuristic đánh nó
ngay khi rút được, không để dành cho Phệ Hồn. Cần playtest tay.

**Phản Đòn có tác dụng không?**
Có: 0–4 lần/trận. Boss (pha Hạ Huyền) và *Phong Tuyết Chướng* đều kích hoạt.

## Quan sát khác

- **Đóng Băng khóa boss quá mạnh.** Boss đánh một mình, nên mỗi lá Đóng Băng
  1 Nguyệt Lực (Hàn Ấn, Tuyết Trung Tống Thán) bỏ hẳn một lượt boss. Đội có hai
  nguồn băng + hồi máu thắng boss 3/3, các đội khác 2/9.
- **m06+f02+f03 yếu (4/12):** không có hồi máu, hai Hero HP thấp.
- Tag theo pha có tác dụng đo được: đội mốc đổi kết quả ở enc_02/enc_03 so với
  giai đoạn 1 dù không có Hero mới (Hổ Gầm rẻ hơn ở Hạ Huyền, lá hồi của F04 rẻ
  hơn ở Trăng Tròn).

## Đề xuất chỉnh tiếp (chưa áp dụng — cần quyết định thiết kế)

- [x] **F02:** đã xử lý — xem "Điều chỉnh F02" bên dưới.
- [ ] **Boss vs Đóng Băng:** cần cơ chế kháng (ví dụ boss miễn Đóng Băng ở lượt
      ngay sau khi vừa bị băng) — là **luật mới**, phải thêm vào `01` + test.
- [ ] **Tuyết Trung Tống Thán:** cân nhắc giá 2, hoặc bỏ tag `harmony` để không
      còn 0 ở Trăng Tròn.
- [ ] **Độ dài trận boss:** sau khi xử lý Đóng Băng, đo lại; mục tiêu ≤ 12 vòng.

## Điểm cần theo dõi khi playtest tay

- [ ] Huyết Nguyệt: người chơi có chủ động để dành Đổi Vận Chú + Phệ Hồn không?
- [ ] Cướp buff (Diện Đoạt, Ảnh Đấu) có đáng một lượt không?
- [ ] Lá Song Hành có dễ nhận ra trên tay (viền 2 màu, nhãn) không?
- [ ] Animation cướp buff, tia Phản Đòn, Huyết Nguyệt có rõ không?

## Điều chỉnh F02 (`09` mục 12, đã duyệt)

Chỉ tăng HP hay hạ ngưỡng không đủ: mỗi trận chỉ cướp được tối đa 1 buff (một
lá cướp trong deck, địch ít buff). Đã áp dụng:

- *Ảnh Tập* thêm `stealBuff 1` trước đòn đánh (F02 có 2 lá cướp; cướp được
  `strength` thì chính đòn đó mạnh hơn).
- Ngưỡng `buffsStolen` 3 → 2 (lệch GDD, ghi chú trong `01` §8).

| Chỉ số (24 trận có F02) | Trước | Sau |
|---|---|---|
| F02 thăng cấp | 0/24 | **4/24** (v6–v7) |
| Lần cướp (tổng · tối đa/trận) | 6 · 1 | 16 · 3 |
| F02 còn sống cuối trận | 1/24 | 3/24 |
| Thắng m05+f03+f02 | 10/12 | 10/12 |
| Thắng m06+f02+f03 | 4/12 | **6/12** |

Hai đội không có F02 không đổi. Tổng: **34/48** trận thắng.

F02 vẫn thường ngã — chấp nhận như rủi ro của phe Cấm Thuật (thử HP 30: F02 sống
7/24 nhưng đội thắng ít hơn). Theo dõi khi chơi tay.
