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
- [x] **Boss vs Đóng Băng:** không thêm luật — xem "Đóng Băng và boss" bên dưới.
- [x] **Tuyết Trung Tống Thán:** đã bỏ tag `harmony`.
- [ ] **Độ dài trận boss:** vẫn 12–37 vòng — để playtest tay (heuristic chơi chậm hơn người).

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

## Đóng Băng và boss (`09` mục 13, đã duyệt)

Thử bỏ **mọi** Đóng Băng khỏi lá (mức trần của luật "boss kháng băng"): **không
đội nào thắng boss** (0/12). Đóng Băng là cách phản đòn chính với boss, không phải
lỗi → **không thêm luật kháng băng**.

Đã chỉnh *Tuyết Trung Tống Thán*: bỏ tag `harmony` (vẫn giá 1, vẫn 0 ở Bán
Nguyệt nhờ `control`, không còn 0 ở Trăng Tròn).

| Đội | Trước | Sau |
|---|---|---|
| m05+f03+f04 | 11/12 (boss 3/3), 51 lá Song Hành | **10/12 (boss 2/3)**, 48 lá Song Hành |
| Ba đội còn lại | 7/12 · 10/12 · 6/12 | không đổi |

Tổng: **33/48** trận thắng. Còn mở cho playtest tay: boss khó với đội không có
băng (m05+f04+m06 0/3, m06+f02+f03 0/3) và trận boss dài.

---

# Playtest Notes — Phase 3 (bước 3.7)

Playtest scripted: `packages/rules/test/run-playtest.test.ts`. Heuristic: nút đi được đầu tiên, lá thưởng đầu tiên, Nghỉ Chân hồi nếu tổng HP < 60% (còn lại bỏ lá rẻ nhất), trong trận đánh lá đánh được đầu tiên. 4 đội × seed 1–5.

| Đội | Thắng | Thua | Kẹt (> 60 vòng) | Tầng trung bình | Trận/lượt | Deck cuối | Kỳ Vật |
|---|---|---|---|---|---|---|---|
| m05+f04+m06 | 0 | 5 | 0 | 2.0 | 1.8 | 15.8 | 0 |
| m05+f03+f02 | 0 | 5 | 0 | 2.2 | 2.0 | 16.0 | 0 |
| m06+f02+f03 | 0 | 5 | 0 | 2.0 | 1.8 | 15.8 | 0 |
| m05+f03+f04 | 0 | 5 | 0 | 3.2 | 2.4 | 16.2 | 0.4 |

Tổng: **0/20 lượt thắng, 20 thua, 0 kẹt.** Tầng trung bình đạt được: 2.35/8.
Không lượt nào chạm trần 60 vòng hay 20000 bước — mọi trận đấu kết thúc trong
3–15 vòng. Không có lỗi `run action rejected`.

## Quan sát

- **Không đội nào thắng nổi một seed.** Trung bình mỗi lượt chỉ đánh 2.0 trận
  rồi chết ở tầng 2.35 — xa tầng 7 (Nghỉ Chân chắc chắn) và tầng 8 (boss). Boss
  `moon_ape` và cả hai encounter Tinh Anh **chưa hề được đánh** trong 20 lượt.
- Bản đồ chỉ phụ thuộc seed → 5 seed = 5 bản đồ; 4/5 seed mở bằng **enc_02
  (Ảnh Hồ ×3)**, seed 2 mở bằng enc_03. enc_02 là "máy rút máu" tầng 1: thắng
  xong thường chỉ còn 1–2 Hero đứng, tổng HP ~30–60%; 3/20 lượt chết ngay trận
  đầu ở full HP (cả 3 đều gặp enc_02).
- **Kẻ kết liễu nhiều nhất: enc_03 (Khôi Lỗi ×2, 42 HP + Giáp 8 + Hồi Phục 2) —
  9/20 lượt**, hầu hết là trận thứ hai khi party đã yếu. Tiếp theo enc_02 (6/20),
  enc_01 (4/20), enc_06 (1/20 — lượt sâu nhất, tầng 6).
- **Hồi sinh 25% HP gần như vô dụng:** 16/20 lượt có `heroRevived`, Hero sống
  lại với 7–10 HP rồi bị địch `targeting: lowestHp` dồn chết lại ngay — không
  lượt nào có hồi sinh mà thoát được chuỗi thua.
- Lá thưởng và Kỳ Vật **chưa đổi được kết quả**: mỗi trận thắng chỉ +1 lá
  (deck cuối TB ~16/15 gốc), và chỉ 2/20 lượt (đội m05+f03+f04) đến được tầng 4
  lấy Kỳ Vật trước khi chết.
- Nghỉ Chân: chỉ **5/20 lượt** gặp (trọng số rest 20% ở tầng 2–3 + heuristic
  luôn đi nút đầu tiên). 4/5 chọn hồi máu (HP < 60%), 1/5 bỏ lá rẻ nhất. Các
  lượt có nghỉ đi sâu hơn (tầng TB 4.0 vs 1.8 của lượt không nghỉ — một phần do
  sống lâu nên mới gặp nghỉ) nhưng vẫn chết ngay trận sau — `restHealRatio`
  0.3 chưa đủ bù HP đã mất.
- Heuristic là **sàn kỹ năng** (không focus-fire, không giữ hồi máu, không căn
  pha trăng): giai đoạn 2 thắng 33/48 (~69%) mỗi trận ở full HP, nhưng lượt chơi
  đòi thắng 5–6 trận liên tiếp với HP cộng dồn → 0/20 phản ánh cả độ khó
  attrition lẫn sàn kỹ năng.

## Đề xuất chỉnh (chưa áp dụng — cần duyệt)

- **`puppet_guard` maxHp 42 → 36** (lặp lại đề xuất giai đoạn 1): enc_03 kết
  liễu 9/20 lượt, trận kéo 3–9 vòng nhờ Giáp + Hồi Phục trong khi party chỉ còn
  nửa HP.
- **`shadow_fox` maxHp 24 → 20** hoặc `maul` 7 → 6: enc_02 mở 16/20 lượt, rút
  ~nửa HP party kể cả khi thắng, giết trực tiếp 3/20.
- **`reviveHpRatio` 0.25 → 0.4**: hồi sinh 7–8 HP bị địch `lowestHp` targeting
  giết lại ngay (12/20 lượt có revive vô hiệu). Ngưỡng 0.4 (~10–16 HP) cho Hero
  sống lại một lượt chống đỡ thật.
- **`restHealRatio` 0.3 → 0.4** và/hoặc **tầng 2–3: rest weight 20 → 30** (hoặc
  bảo đảm ≥1 Nghỉ Chân trong tầng 2–3): 15/20 lượt chết trước khi thấy Nghỉ
  Chân nào; lượt có nghỉ vẫn chết vì hồi 0.3 không đủ.
- Không đề xuất về lá thưởng/Kỳ Vật: dữ liệu chưa đủ (Kỳ Vật chỉ xuất hiện ở
  2/20 lượt). Độ dài trận boss và Tinh Anh cũng **chưa đo được** — cần ít nhất
  một lượt tới tầng 5–8 sau khi chỉnh attrition.

## Điểm cần theo dõi khi chơi tay

- [ ] Bản đồ đọc có dễ không; có muốn đi đường Tinh Anh không?
- [ ] Lá thưởng có tạo lựa chọn thật không?
- [ ] Kỳ Vật có cảm nhận được trong trận không?
- [ ] Một lượt chơi dài bao lâu?
- [ ] Người chơi thật (focus-fire, giữ hồi máu, né Tinh Anh) có lật được chuỗi
      thua của heuristic không, hay attrition vẫn quá nặng?
- [ ] Hero hồi sinh 25% HP có bao giờ "cứu" được lượt không?

## Điều chỉnh attrition (đã duyệt)

Đo từng đề xuất ở trên bằng ablation 4 đội × 20 seed = 80 lượt, với cả heuristic
tham lam lẫn heuristic "khôn" (focus-fire địch ít HP nhất, hồi đồng minh thấp %
nhất, về Nghỉ Chân khi HP < 60%, né Tinh Anh khi yếu):

| Biến thể | Tham lam | Khôn | Khôn: tới tầng ≥5 |
|---|---|---|---|
| Data cũ | 1/80 | 6/80 | 16 |
| `puppet_guard` HP 36 | 2 | 7 | 19 |
| `shadow_fox` HP 20 | 0 | 6 | 22 |
| Hồi sinh 0.4 | 4 | 5 | 17 |
| Nghỉ 0.4 + rest weight 30 | 4 | 10 | 28 |
| enc_02/03 `minFloor` 2 | 0 | 6 | 16 |
| HP mọi địch thường ×0.8 | 3 | 7 | 24 |
| Damage địch thường (9→7, 7→5, 8→6) | 3 | 12 | 31 |
| 4 đề xuất trên + `minFloor` 2 | 4 | 14 | 38 |
| **Damage + Nghỉ 0.4/w30 + Hồi sinh 0.4** | **7** | **20** | **49** |

Kết luận: attrition đến từ **damage địch**, không phải HP địch — hạ HP chỉ rút ngắn
trận, còn HP mất mỗi trận (thứ cộng dồn qua lượt) gần như giữ nguyên. Đã áp dụng:

- `puppet_guard` Trọng Kích 9 → 7 (cả hai lượt); `shadow_fox` Vồ 7 → 5 (Trăng Tròn
  12 → 9); `book_wraith` 8 → 6. Song Trảo 3×2, Giáp, Hồi Phục giữ nguyên.
- `restHealRatio` 0.3 → 0.4; tầng 2–3 weights `combat 80 / rest 20` → `70 / 30`;
  `reviveHpRatio` 0.25 → 0.4. Cập nhật T105/T109 trong `06` và `10`.
- `run-playtest.test.ts` chuyển sang heuristic khôn (tham lam không phân biệt được
  thiết kế với sàn kỹ năng: cùng data cho ~⅓ số lượt thắng).
- Test luật dùng intent cố định `strike9Intent` (fixtures) thay cho Trọng Kích của
  Khôi Lỗi, để chỉnh cân bằng không làm vỡ test luật.

### Kết quả sau chỉnh (`run-playtest`, seed 1–5)

| Đội | Thắng | Thua | Kẹt | Tầng TB | Trận/lượt | Deck cuối | Kỳ Vật |
|---|---|---|---|---|---|---|---|
| m05+f04+m06 | 1 | 3 | 1 (boss) | 6.4 | 3.8 | 17.0 | 0.8 |
| m05+f03+f02 | 1 | 4 | 0 | 6.2 | 3.6 | 17.4 | 0.8 |
| m06+f02+f03 | 0 | 5 | 0 | 5.0 | 3.0 | 17.0 | 0.6 |
| m05+f03+f04 | 4 | 1 | 0 | 6.6 | 4.2 | 16.6 | 0.8 |

Tổng: **6/20 thắng** (trước 0/20), tầng TB 6.05 (trước 2.35). 11/20 lượt tới boss.

Playtest per-encounter giai đoạn 2 (heuristic tham lam, không đổi): enc_01–03 giờ
thắng 34/36 (trước 29/36); boss không đổi (data boss không chỉnh).

### Còn mở

- [ ] **Boss là kẻ kết liễu chính** khi lượt đi sâu (4 thua + 1 kẹt > 60 vòng ở tầng
      8, đều là đội không có hai nguồn Đóng Băng). Giờ đã đo được — xem lại độ
      khó / độ dài boss ở vòng sau.
- [ ] **m06+f02+f03 0/5** (ablation: 0/20 ở mọi biến thể): vấn đề của đội (không
      hồi máu, F02 tự mất HP), không phải cấu trúc lượt chơi.
- [ ] Encounter "dễ" cho tầng 1 (Ảnh Hồ ×2, Khôi Lỗi ×1) chỉ thêm +3/80 trong
      ablation — chưa làm.
