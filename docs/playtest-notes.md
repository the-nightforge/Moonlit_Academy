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

## Điểm cần theo dõi khi playtest tay

- [ ] Huyết Nguyệt: người chơi có chủ động để dành Đổi Vận Chú + Phệ Hồn không?
- [ ] Cướp buff (Diện Đoạt, Ảnh Đấu) có đáng một lượt không?
- [ ] Lá Song Hành có dễ nhận ra trên tay (viền 2 màu, nhãn) không?
- [ ] Animation cướp buff, tia Phản Đòn, Huyết Nguyệt có rõ không?
- [ ] Trận boss còn quá dài không? (12–37 vòng standalone; đã giảm damage/heal
      boss ở Phase 3 nhưng độ dài chưa đo lại)

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

Playtest scripted: `packages/rules/test/run-playtest.test.ts`. Heuristic "khôn":
ưu tiên Nghỉ Chân khi HP < 60%, né Tinh Anh khi yếu; trong trận focus địch ít HP
nhất, hồi đồng minh thấp % nhất; lá thưởng đầu tiên. 4 đội × seed 1–5. Đây là
**sàn kỹ năng** — người chơi thật chơi tốt hơn.

Lượt chạy đầu (heuristic tham lam, trước khi chỉnh): **0/20 thắng, 0 kẹt**,
tầng TB 2.35/8 — mọi lượt chết trước khi thấy Tinh Anh/boss.

## Điều chỉnh đã áp dụng

Ablation 4 đội × 20 seed = 80 lượt, với cả heuristic tham lam lẫn heuristic
"khôn" (focus-fire địch ít HP nhất, hồi đồng minh thấp % nhất, về Nghỉ Chân khi
HP < 60%, né Tinh Anh khi yếu):

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
- Boss `moon_ape`: `ape_crush` 12 → 10, `ape_dark_strike` 16 → 13,
  `ape_moon_bathe` heal 14 → 8 (giữ `cleanse` — counter Đóng Băng). Trước chỉnh,
  boss là kẻ kết liễu chính khi lượt đi sâu (4 thua + 1 kẹt > 60 vòng ở tầng 8);
  sau chỉnh còn 2 thua, 0 kẹt.
- `run-playtest.test.ts` chuyển sang heuristic khôn (tham lam không phân biệt được
  thiết kế với sàn kỹ năng: cùng data cho ~⅓ số lượt thắng).
- Test luật dùng intent cố định `strike9Intent` (fixtures) thay cho Trọng Kích của
  Khôi Lỗi, để chỉnh cân bằng không làm vỡ test luật.

### Kết quả (`run-playtest`, seed 1–5)

| Đội | Trước chỉnh | Sau attrition | Sau chỉnh boss |
|---|---|---|---|
| m05+f04+m06 | 0/5 (tầng TB 2.0) | 1/5 (6.4) | **3/5** (6.4) |
| m05+f03+f02 | 0/5 (2.2) | 1/5 (6.2) | **2/5** (6.2) |
| m06+f02+f03 | 0/5 (2.0) | 0/5 (5.0) | **0/5** (5.0) |
| m05+f03+f04 | 0/5 (3.2) | 4/5 (6.6) | **4/5** (6.6) |
| **Tổng** | **0/20** (2.35) | **6/20** (6.05) | **9/20** (6.05) |

Sau chỉnh boss: 11/20 lượt tới tầng 8; boss thắng 9, thua 2; **0 lượt kẹt**.

Playtest per-encounter giai đoạn 2 (heuristic tham lam, không đổi): enc_01–03
thắng 34/36 (trước 29/36).

### Đo lại trên 80 lượt (seed 1–20, mỗi đội)

Ablation vòng hai trên data đã chỉnh (mỗi biến thể 4 đội × 20 seed = 80 lượt):

| Biến thể | Thắng/80 | Tầng TB | Chết ≤ tầng 2 | Chết ở boss |
|---|---|---|---|---|
| Baseline | 28 | 5.24 | 20 | 3 |
| enc_02/03 `minFloor` 2 | 27 | 5.04 | 23 | 3 |
| + `enc_00` dễ (Ảnh Hồ ×2) | 22 | 4.67 | 18 | 4 |
| `enc_00` + `minFloor` 2 | 29 | 5.28 | 15 | 4 |
| Boss HP 110 → 100 | 28 | 5.24 | 20 | 3 |
| Boss HP 100 + Hống Nguyệt 6→5 | 28 | 5.24 | 20 | 3 |

Kết luận: **không thay đổi thêm** — boss chỉ còn hạ 3/80 lượt (giảm tiếp cho kết
quả y hệt); các đòn bẩy tầng 1 hoặc tệ hơn hoặc nằm trong nhiễu (enc_01 không dễ
hơn enc_02 sau nerf; `enc_00` làm loãng cả tầng giữa). ~25% lượt chết ở tầng 1–2
là độ khó chấp nhận được cho sàn kỹ năng.

### Còn mở

- [ ] **m06+f02+f03 0/20** (0/80 ở mọi biến thể, kể cả seed 1–20) — quyết định:
      **không chỉnh**, coi như đội hard-mode; vấn đề của đội (không hồi máu,
      F02 tự mất HP), không phải cấu trúc lượt chơi. Xác nhận bằng chơi tay.

## Điểm cần theo dõi khi chơi tay

- [ ] Bản đồ đọc có dễ không; có muốn đi đường Tinh Anh không?
- [ ] Lá thưởng có tạo lựa chọn thật không?
- [ ] Kỳ Vật có cảm nhận được trong trận không?
- [ ] Một lượt chơi dài bao lâu?
- [ ] Người chơi thật (focus-fire, giữ hồi máu, né Tinh Anh) có lật được seed 1
      / đội m06+f02+f03 không, hay attrition vẫn quá nặng?
- [ ] Boss còn quá khắc nghiệt với đội không có hồi máu / chỉ một nguồn Đóng
      Băng không?

# Playtest Notes — Phase 4a (bước 4a.8)

Playtest scripted: `packages/rules/test/playtest.test.ts` (trận đơn) và
`run-playtest.test.ts` (lượt chơi). Heuristic 4a: Đổi Bài bỏ lá cost > 5;
Chiêm Bài lấy lá đắt nhất mua nổi ở vòng tới; đánh lá đắt nhất trước; focus
địch ít HP / đồng minh thấp % nhất. Đây là **sàn kỹ năng**.

Lượt chạy đầu sau khi đổi kinh tế (trước chỉnh số): **0/80 thắng run**,
tầng TB 1.99/8, 59/80 chết tầng ≤2, trận thường thắng 38%, Cạn Bài 18%
trận — kinh tế mới làm đội chơi yếu tương đối hơn nhiều so giai đoạn 3.

## Đo ablation (4 đội × 20 seed = 80 lượt/biến thể)

| Biến thể | Thắng/80 | Tầng TB | Chết ≤F2 | Thắng trận | Vòng/trận | Cạn Bài |
|---|---|---|---|---|---|---|
| baseline | 0 | 1.99 | 59 | 38% | 7.3 | 18% |
| HP địch ×0.8 | 0 | 2.96 | 44 | 54% | 7.1 | 7% |
| NL địch −1 | 0 | 2.75 | 50 | 51% | 8.0 | 17% |
| copies +1 | 0 | 2.33 | 55 | 44% | 7.9 | 6% |
| dmg địch ×0.8 | 0 | 2.21 | 56 | 44% | 7.7 | 19% |
| NL +2/vòng (chơi) | 0 | 2.41 | 54 | 46% | 6.9 | 15% |
| K: NL−1 + HP×0.8 + dmg×0.8 + copies+1 + boss 90 + NL start 4 | 7 | 5.40 | 14 | 75% | 8.4 | 2% |
| **P: K + dmg×0.7** | **12** | **5.91** | **10** | **78%** | **8.6** | **3%** |
| V: P + Nghỉ ×2 | 14 | 5.94 | 10 | 79% | 8.6 | 3% |
| X: P + Nghỉ ×2 + NL +2/vòng | 18 | 5.76 | 11 | 80% | 7.9 | 3% |

## Gói đã áp dụng (đã duyệt — gói P)

- `combat-config`: `moonPower.start` 3 → 4 (vòng 1 đánh được 1 lá tầm trung).
- `cards.json`: mọi lá `copies` +1 (tối đa 3) — deck 18 → 21+, Cạn Bài
  18% → ~0%.
- `enemies.json`: `moonPower.start` −1 cho tất cả địch (địch chậm chuỗi ở
  vòng 1 — đường damage "thấp sớm"); `maxHp` địch thường ×0.8; damage mọi
  intent ×0.7 (làm tròn, tối thiểu 1; **không** đổi damage lồng trong
  `conditional` — ablation chỉ đo top-level); `moon_ape` 110 → 90.
- Test luật chuyển sang số đọc từ data/fixture (hp địch, đường Nguyệt Lực)
  hoặc inject intent — chỉnh cân bằng không còn làm vỡ test luật.

## Kết quả sau chỉnh

Trận đơn (`playtest`, 3 seed × 4 đội, máu đầy):

| Tier | Trận | Thắng | Vòng TB | Cạn Bài | Kẹt tay |
|---|---|---|---|---|---|
| Thường | 60 | 98% | 8.8 | 0% | 3% |
| Tinh Anh | 24 | 96% | 9.9 | 0% | 7% |
| Boss | 12 | 42% | 10.8 | 8% | 0% |

Lượt chơi (`run-playtest`, seed 1–5 × 4 đội): **2/20 thắng**, 12/20 tới
tầng 8, boss thắng 2/12 (17%), 0 kẹt, trận thường 90% / 8.2 vòng / Cạn
Bài 0%.

So mục tiêu §8: trận thường/Tinh Anh 8–12 vòng ✓ (8.2–9.9), Cạn Bài <10%
✓ (~0%), kẹt tay <10% ✓, thắng lượt 25–40% **chưa đạt** (bot ~10–15% —
đã duyệt gói P thay vì gói X 22.5% để giữ độ khó; người chơi thật sẽ cao
hơn sàn). Boss còn là chốt chặn chính (17% trận boss thắng).

## Điểm cần theo dõi khi chơi tay

- [ ] Đổi Bài có tạo quyết định thật không (hay luôn bỏ 2 lá đắt)?
- [ ] Dự Trữ có được dùng chủ động không (nhịp lượt xanh để vòng sau bùng)?
- [ ] Đồng hồ Cạn Bài có gây áp lực đúng không?
- [ ] Chuỗi chiêu địch có đọc được không; Tụ Lực có đủ cảnh báo?
- [ ] Chiêm Bài có đáng cost không; lấy lá đắt hay lá rẻ?
- [ ] Tỷ lệ thắng lượt của người chơi thật — bot đo 10–15%; nếu người chơi
      thật <25%, cân nhắc lại gói V/X.


# Playtest Notes — Phase 4b (bước 4b.7)

## Phương pháp

Heuristic mới có nhận biết từ khóa: giữ lá Tích Tụ tới ngưỡng `heldTurnsAtLeast`,
đánh lá thường trước lá Liên Hoàn, Tỏa Nguyệt/Đoạt Nguyệt nhắm địch có chuỗi
chiêu đắt nhất, Tụ Dược nhắm đồng minh có Hồi ≥3. Lượt chơi chạy trên 6 loại
deck: Bộ cơ bản (18 lá free), 4 biến thể nhánh (A/B × split 6/6/6, 4/4/10,
8/5/5 — mọi lá coi như đã mở), deck ngẫu nhiên theo seed. 4 đội × seed 1–20 ×
6 deck = 480 lượt.

## Kết quả theo loại deck (80 lượt/deck)

| Deck | Thắng | Tầng TB | XP TB/lượt |
|---|---|---|---|
| Bộ cơ bản | 59% | 7.1 | 127.0 |
| nhánh A 6/6/6 | 65% | 7.6 | 138.3 |
| nhánh B 6/6/6 | 50% | 7.0 | 112.1 |
| nhánh A 4/4/10 | 65% | 7.5 | 136.6 |
| nhánh B 8/5/5 | 40% | 6.7 | 105.8 |
| ngẫu nhiên | 63% | 7.1 | 126.0 |

Theo tier (trung bình các deck): trận thường thắng 92–98% / 7.7–8.9 vòng;
Tinh Anh 94–100% / 7.8–9.6 vòng; boss 58–78% / 10.1–11.9 vòng. Cạn Bài ≤9%
trận, kẹt tay ≤5% lượt, 0 kẹt lượt (stalled). **0/60 lá chưa từng được đánh.**

So mục tiêu spec §8: trận 8–12 vòng ✓, Cạn Bài <10% ✓, kẹt tay <10% ✓,
mọi lá được đánh ✓. Win rate tổng cao hơn 4a (~40–65% thay ~10%) vì heuristic
mới chơi tốt hơn và pool thưởng 12 lá cho lá mạnh hơn — bot hiện là sàn cao
hơn, độ khó thật cần xác nhận bằng chơi tay.

## Gói chỉnh đã duyệt

- **`meta-config.masteryLevels ×1.5`** → `[45,165,345,585,885,1245]`: nhịp
  Tu Luyện 6.5 → **9.8 lượt** tới cấp 6 (mục tiêu 8–12). XP/thắng/tầng giữ
  nguyên.
- **nhánh B 8/5/5 = 40% (−19pp, vượt ±15): chấp nhận.** Deck split cực đoan
  (10 lá một Hero, gồm cả lá khóa) vốn rủi ro; nhánh B 6/6/6 chỉ −9pp nên vấn
  đề nằm ở độ cực đoan của split, không phải nhánh B nói chung. Nhánh B thiên
  phòng thủ/kiểm soát (Thiết Vệ, Tĩnh Tâm, Hàn Kiếm, Huyết Nguyệt) cũng khó
  cho bot hơn.

## Điểm cần theo dõi khi chơi tay

- [ ] Tích Tụ có đáng giữ lá qua lượt không?
- [ ] Liên Hoàn có tạo thứ tự đánh thú vị không?
- [ ] Tỏa Nguyệt có thấy rõ chiêu địch bị hủy không?
- [ ] Tụ Dược có tạo nhịp "rải Hồi rồi nổ" không?
- [ ] Mở khóa (Tu Luyện) có hào hứng không; ~10 lượt tới cấp 6 có hợp lý?
- [ ] Deck nhánh có khác cảm giác Bộ cơ bản không?

# Playtest Notes — Lõi (augment thay lá thưởng)

Thay thế lá thưởng sau trận bằng **chọn 1 trong 3 Lõi** (`run-augments.json`,
16 Lõi, hook engine của Kỳ Vật) sau mọi trận thắng không phải boss; deck giữ
nguyên 18 lá suốt lượt (chỉ nhỏ đi khi Nghỉ Chân bỏ lá).

## Số đo sau thay đổi (4 đội × 6 loại deck × 20 seed = 480 lượt)

| Deck | Thắng% | Tầng TB | XP/lượt |
|---|---|---|---|
| Bộ cơ bản | 74% | 7.5 | 138.1 |
| nhánh A 6/6/6 | 81% | 7.8 | 151.1 |
| nhánh B 6/6/6 | 73% | 7.6 | 130.2 |
| nhánh A 4/4/10 | 73% | 7.3 | 135.0 |
| nhánh B 8/5/5 | 74% | 7.7 | 133.0 |
| ngẫu nhiên | 78% | 7.6 | 138.3 |

Theo tier: trận thường 96–99% / 7.2–8.5 vòng; Tinh Anh 90–100% / 6.8–8.9;
boss 78–88% / 9.3–11.6 vòng. **Cạn Bài: boss 9–14%** (deck 18 cố định — đồng
hồ cạn giờ chỉ cắn ở boss), trận thường ≤4%; kẹt tay ≤1%, 0 kẹt lượt.

## Nhận định

- Lõi mạnh hơn lá thưởng rất nhiều: win rate lượt ~25–59% → **73–81%**, boss
  ~17–78% → 78–88%. Mỗi Lõi là buff vĩnh viễn nên lượt tích ~6–7 Lõi trước boss.
- Bot chọn lá đầu tiên trong 3 lựa chọn (~ngẫu nhiên) — người chơi thật chọn
  theo build sẽ mạnh hơn nữa.
- Cân bằng hiện **dễ hơn mục tiêu**: nếu muốn giữ ~25–40% theo spec 4a §8 cần
  nới địch hoặc giảm số Lõi/lượt (ví dụ chỉ cho sau Tinh Anh + trận thường
  cách nhau). Chưa chỉnh — chờ duyệt.
- Điểm cần chơi tay: Lõi có tạo cảm giác "build" mỗi lượt không; 16 Lõi có
  đủ đa dạng; Lõi thay lá có làm Nghỉ Chân bỏ lá (minDeckSize) vô dụng không.
