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

## Các mục đã đóng sau 4b

Các mục đã đóng nhờ số đo 4b (đã xóa khỏi checklist cũ): trận thường dài quá
(nay 7.9 vòng TB), F04 ít thăng cấp (nay 38/48 trận), Nguyệt Quang Dẫn 2 NL
(nay cost 4 theo kinh tế 4a), tay kẹt vì Tàn Chiêu (nay bỏ cuối lượt, kẹt tay
0–5%), boss quá dài (nay 10–12 vòng), m06+f02+f03 0/20 (nay 50% với Bộ cơ
bản), tỷ lệ thắng bot 10–15% (nay 59%). Sau "Chỉnh sau 4b" đóng thêm: game dễ
hơn mục tiêu (bot 59% → 44%), F02 gần như không thăng cấp (6/48 → 28/48). Sau
"vòng 2" đóng nốt: chênh lệch đội, nhánh A/B, Huyết Nguyệt hiếm.

## Chỉnh sau 4b (đã duyệt)

Ablation bằng file tạm (không commit), 4 đội × 6 loại deck × 20 seed (gói
cuối kiểm lại với 50 seed). Mục tiêu: bot 35–45% với Bộ cơ bản (người chơi
thật 25–40% + chênh sàn kỹ năng), trận dài hơn.

| Biến thể | Bộ cơ bản | Nhánh B 6/6/6 | Vòng thường / Tinh Anh | F02 thăng cấp |
|---|---|---|---|---|
| Data 4b | 59% | 50% | 8.3 / 8.8 | 8% |
| NL khởi đầu 3 | 48% | 38% | 8.7 / 9.3 | 9% |
| + damage địch ×0.8 | 36% | 29% | 8.6 / 9.1 | 8% (m05+f04+m06 còn 15%) |
| **+ HP địch thường ×0.9** | **45%** | **39%** | **9.1 / 9.9** | 8% |
| + boss 100 HP | 44% | 35% | 9.1 / 9.9 | 8% |
| + ngưỡng F02 1 | 45% | 39% | — | 29% |
| + Diện Cụ thêm Cướp 1 | 45% | 39% | — | 10% |
| **+ Đoạt Nguyệt tính vào bộ đếm, ngưỡng 3** | **45%** | **39%** | — | **40%** |

Đã áp dụng:

- `combat-config.moonPower.start` 4 → **3** (yêu cầu: kéo dài trận).
- `maxHp` địch thường và Tinh Anh ×0.9/0.8 (hoàn một nửa gói P): Khôi Lỗi
  34 → 38, Ảnh Hồ 19 → 21, Thư Hồn 26 → 29, Hắc Giáp Vệ 56 → 63,
  Hồ Vương 40 → 45. Boss giữ 90. Damage địch giữ ×0.7 (×0.8 làm đội yếu
  sụp).
- **Luật** (`01` §8, T169): bộ đếm F02 `buffsStolen` +1 mỗi effect Đoạt Nguyệt
  của F02 lấy được ≥ 1 Nguyệt Lực; ngưỡng 2 → **3** (trở lại GDD). Cướp buff
  hiếm vì địch ít buff, còn Đoạt Nguyệt luôn có mục tiêu. T86 (Ảnh Đấu) nay
  đếm 2.
- Nhánh B của M06: *Loạn Ảnh* 5 → 4, *Ảnh Tốc* 2 → 1 (50 seed: nhánh B 8/5/5
  25% → 32%, ngẫu nhiên 39% → 43%). Giảm HP tự mất của lá Huyết Nguyệt (F02)
  không có tác dụng đo được, không áp.

### Kết quả sau chỉnh (`run-playtest`, seed 1–20)

| Deck | Thắng | Tầng TB | XP TB/lượt |
|---|---|---|---|
| Bộ cơ bản | 44% | 6.2 | 109.0 |
| nhánh A 6/6/6 | 55% | 7.2 | 133.6 |
| nhánh B 6/6/6 | 41% | 6.3 | 100.2 |
| nhánh A 4/4/10 | 54% | 6.8 | 125.9 |
| nhánh B 8/5/5 | 40% | 6.5 | 103.9 |
| ngẫu nhiên | 48% | 6.6 | 115.9 |

Bộ cơ bản theo tier: thường 90% / 9.3 vòng, Tinh Anh 81% / 11.2, boss 71% /
12.0. Cạn Bài ≤ 6%, kẹt tay ≤ 1%, 0 lượt kẹt, 0/60 lá chưa được đánh. Nhịp Tu
Luyện ~11.4 lượt tới cấp 6 (mục tiêu 8–12). Thăng cấp trong trận đơn: M05
51/72, F04 40/48, M06 36/48, F03 44/72, **F02 28/48** (trước 6/48).

## Chỉnh sau 4b — vòng 2

Ablation bằng file tạm, 4 đội × 6 deck × 40–80 seed (20 seed của
`run-playtest` nhiễu ±10 điểm/đội — số dưới đây là 80 seed).

**Chênh lệch đội.** Nguyên nhân chính là lá Song Hành, không phải Hero:
m05+f04+m06 có 0 lá Song Hành, m05+f03+f02 / m06+f02+f03 có 1, m05+f03+f04 có
2 (cả hai Đóng Băng). Bỏ mọi lá Song Hành: m05+f03+f04 78% → 43%, các đội khác
gần như không đổi. *Tuyết Trung Tống Thán* (2 NL, Đóng Băng + Hồi Phục) là lá
quyết định.

| Biến thể (80 seed) | Bộ cơ bản | m05+f04+m06 | m05+f03+f02 | m06+f02+f03 | m05+f03+f04 |
|---|---|---|---|---|---|
| Sau vòng 1 | 37% | 18% | 43% | 23% | 66% |
| Tuyết Trung `copies` 2 + boss 85 + F04 đổi Thảo Dược ↔ Băng Tâm Quyết | 37% | 24% | 45% | 25% | 54% |
| **+ Đổi Vận Chú 4 → 3** | **38%** | **24%** | **40%** | **34%** | **54%** |

Thử và bỏ: bot không hồi máu khi cả đội ≥ 85% HP (không đổi), thêm lá Song
Hành giáp/hồi cho M05+F04 (không giúp m05+f04+m06), F04 đổi Hồi Xuân Tán /
Linh Chi / Nguyệt Quang Dẫn lấy Băng Tâm Quyết (m05+f04+m06 tụt 8–23%),
enc_02 (Ảnh Hồ ×3) `minFloor` 2, Ảnh Hồ HP 19 (không đổi). m05+f04+m06 thấp
nhất vì không có Song Hành lẫn Đóng Băng — chấp nhận như bản sắc đội.

**Tiêu chí đóng:** mọi đội ≥ 20%, chênh lệch ≤ 30 điểm, Bộ cơ bản 35–45%, mọi
loại deck trong ±15 điểm so với Bộ cơ bản (spec 4b §8) — đạt: 24–54%, 38%,
nhánh A 6/6/6 52% / nhánh B 6/6/6 33% / A 4/4/10 44% / B 8/5/5 30% / ngẫu
nhiên 43%. Khoảng cách nhánh A–B của riêng m06+f02+f03 là do nhánh A của đội
đó mạnh (Ảnh Sát + Cướp), không phải nhánh B yếu so với Bộ cơ bản.

**Huyết Nguyệt.** Đo riêng đội có F02: 0.8 lượt/trận với Bộ cơ bản và nhánh B.
Kéo Huyết Nguyệt của Đổi Vận Chú 2 → 3 vòng tăng lên 1.4 lượt/trận nhưng đội
F02 thua nhiều hơn (m06+f02+f03 25% → 18%): Huyết Nguyệt là rủi ro hai chiều
đúng thiết kế, tần suất hiện tại cân bằng. Không đổi thời lượng; Đổi Vận Chú
rẻ hơn (ở trên) giúp đội F02 mà không đổi tần suất.

Đã áp dụng:

- *Tuyết Trung Tống Thán* `copies` 3 → 2.
- Boss *Thần Viên Trấn Nguyệt* `maxHp` 90 → 85 (bù lại độ khó chung).
- F04: *Băng Tâm Quyết* vào bộ miễn phí, *Thảo Dược* thành lá khóa (cùng nhánh
  Tĩnh Tâm, cùng cost 2; F04 có lá khống chế từ đầu).
- *Đổi Vận Chú* cost 4 → 3.

`run-playtest` (seed 1–20, sau chỉnh): Bộ cơ bản 45%, thường 89% / 9.3 vòng,
Tinh Anh 88% / 9.9, boss 73% / 11.9; nhịp Tu Luyện ~11.4 lượt tới cấp 6.

## Câu hỏi chơi tay — trả lời bằng đo đạc và sửa UI

Những câu "chơi tay" ở các giai đoạn trước đã được trả lời theo một trong hai
cách, rồi xóa khỏi checklist.

**1. So chiến thuật bot** (file tạm, 4 đội × 6 deck × 40 seed, Bộ cơ bản; mốc
42%). Chơi khéo thắng nhiều hơn rõ → cơ chế tạo quyết định thật.

| Câu hỏi | Chơi khéo | Đối chứng | Kết luận |
|---|---|---|---|
| Tích Tụ có đáng giữ lá? | giữ tới ngưỡng 42% | đánh ngay 31% (nhánh B 30% → 18%) | Có |
| Liên Hoàn có tạo thứ tự đánh? | lá thường trước 42% | không xếp 36% | Có |
| Để dành Đổi Vận Chú + Phệ Hồn? | để dành 46% | đánh ngay 42% (đội F02 +12–15 điểm) | Có — người chơi nên để dành |
| Cướp buff có đáng? | có 42% | bỏ mọi `stealBuff` 39% | Có, nhỏ; nay còn tính vào thăng cấp F02 |
| Kỳ Vật có cảm nhận được? | có 42% | không Kỳ Vật 38% (nhánh B 8/5/5 −13) | Có |
| Lá thưởng có tạo lựa chọn? | lấy lá đầu 42%, lá đắt 39% | bỏ qua 34% | Có (lá thưởng nay đã thay bằng Lõi — xem cuối file) |
| Có muốn đi đường Tinh Anh? | săn 43% / mặc định 42% / né 42% | — | Rủi ro ≈ phần thưởng: lựa chọn trung lập, đúng ý |
| Deck nhánh có khác Bộ cơ bản? | Huyết Nguyệt/trận (đội F02): nhánh A 0.15, nhánh B 0.82; thắng 54% vs 30% | — | Khác rõ về nhịp và độ khó |
| Tụ Dược "rải Hồi rồi nổ"? | nhắm Hero có Hồi ≥ 3: 42% | nhắm bừa 45% | **Không** — xem dưới |

*Tụ Dược:* Hồi Phục `v` tự hồi tổng v + (v−1) + … + 1, nên *Linh Chi Hộ Thể*
(Tụ Dược ×1) luôn lỗ khi nổ (v = 3: hồi 3 thay vì 6). Đã chỉnh Tụ Dược ×1 → ×2
(*Linh Chi Hộ Thể*), ×2 → ×3 (*Bách Hoa Tụ Dược*): với v ≤ 3, nổ ≥ để tự hồi và
có ngay. Tỉ lệ thắng không đổi (43%) — bot không bị giới hạn bởi hồi máu.

**2. Số đo trực tiếp.**

- *Một lượt chơi dài bao lâu?* Trung bình 4.3 trận, 42 lượt người chơi, ~100
  lá được đánh mỗi lượt chơi → ước tính 15–20 phút cho người thật.
- *Đồng hồ Cạn Bài có gây áp lực?* Cuối trận chồng còn trung bình 35–38%;
  chồng cạn hẳn ở 5–12% trận, thua vì Cạn Bài 3–5% (chủ yếu trận boss dài):
  áp lực chỉ đến ở trận kéo dài, đúng mục tiêu < 10%.
- *Mở khóa (Tu Luyện) ~10 lượt tới cấp 6?* ~11.4 lượt, trong mục tiêu 8–12.

**3. Kiểm tra UI** (chạy client, chụp màn hình bằng Playwright):

- Lượt địch "ai đánh ai": trước chỉ nhích 18% về phía mục tiêu. Nay hiện tên
  chiêu dưới kẻ địch và tia đỏ tới mục tiêu (chiêu lan: tia tới mọi Hero).
- Chuỗi chiêu địch đọc được (tên, cost, damage, mục tiêu). Tụ Lực trước chỉ
  ghi "⋯ Tụ Lực"; nay "⋯ Tụ Lực · vòng sau NL X", đổi thành "⚠" khi X đủ cho
  chiêu đắt nhất (`previewEnemyIntent.nextRoundMoonPower`, T170).
- Tỏa Nguyệt: trước ghi số chiêu bị hủy; nay ghi tên chiêu bị hủy.
- Cướp buff (nhãn buff bay từ nạn nhân sang kẻ cướp), tia Phản Đòn, Huyết
  Nguyệt (chớp đỏ toàn màn, banner, nền đỏ, đếm vòng): đã có sẵn.
- Lá Song Hành: viền màu Hero thứ hai + nhãn "Song Hành" (tăng cỡ 9 → 11px).
- Bản đồ: thêm chú thích biểu tượng (⚔ ☠ 🏮 🎁 🌕 kèm ý nghĩa) và số tầng.

## Quyết định thiết kế (đã duyệt)

Ba cơ chế kinh tế 4a không tạo quyết định theo số đo; người dùng đã chọn:

- **Chiêm Bài — lá chọn rẻ hơn (luật mới, T171):** lá lấy qua Chiêm Bài giảm
  `combatConfig.chooseCardDiscount` = 1 NL tới hết lượt. Trước: bỏ hẳn Chiêm
  Bài 42% → 42%. Sau (80 seed): Bộ cơ bản 41% có vs 41% bỏ hẳn, nhánh A 57% vs
  53%; giảm 2 không tốt hơn (42%). Ở cấp bot Nguyệt Lực mới là nút thắt nên
  chọn lá ít đổi kết quả; luật mới cho người chơi lý do cụ thể "Chiêm Bài rồi
  đánh ngay lá vừa lấy". Không phải điểm mở: muốn Chiêm Bài mạnh hơn nữa thì
  phải đổi kinh tế tay/Nguyệt Lực.
- **Đổi Bài — giữ làm van an toàn:** bỏ lá đắt 42%, giữ nguyên 41%, bỏ 2 lá
  đầu 41%. Vai trò là tránh tay xấu gây ức chế, không cần là quyết định lớn.
- **Dự Trữ — giữ nguyên:** tự giữ ≤ 3 NL thừa (Dự Trữ TB 0.4–0.6) để làm mượt
  nhịp; cố tình nhịn đánh không được thưởng (42% → 38%), chấp nhận.

Không còn mục mở trong các phần trên. Phần Lõi bên dưới (merge từ `main`) còn
việc chờ duyệt; các số đo ở trên là trước khi có Lõi.

# Playtest Notes — Lõi (augment thay lá thưởng)

Thay thế lá thưởng sau trận bằng **chọn 1 trong 3 Lõi** (`run-augments.json`,
16 Lõi, hook engine của Kỳ Vật) sau mọi trận thắng không phải boss; deck giữ
nguyên 18 lá suốt lượt (chỉ nhỏ đi khi Nghỉ Chân bỏ lá).

## Số đo sau thay đổi (4 đội × 6 loại deck × 20 seed = 480 lượt)

**Lưu ý:** đo trên data 4b *trước* khi merge gói "Chỉnh sau 4b" từ main
(NL start 3, HP địch ×0.9/0.8…) — sau merge cần đo lại.

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

## Đo lại sau khi merge (Lõi + các gói chỉnh sau 4b)

`run-playtest`, seed 1–20: Bộ cơ bản **64%**, nhánh A 6/6/6 83%, nhánh B 6/6/6
59%, nhánh A 4/4/10 68%, nhánh B 8/5/5 63%, ngẫu nhiên 68%. Bộ cơ bản theo tier:
thường 96% / 8.9 vòng, Tinh Anh 94% / 9.2, boss 77% / 10.6, **Cạn Bài ở boss
17%**.

- [x] Vẫn dễ hơn mục tiêu (bot 35–45%) dù đã có gói chỉnh sau 4b (trước Lõi:
      ~40%). Cần chỉnh số Lõi hoặc độ khó — chờ duyệt.
      → **Đã duyệt gói L** (xem "Chỉnh sau Lõi").
- [x] Cạn Bài ở boss 17% → nay 10–18% tùy deck (mục tiêu < 10%): deck 18 lá
      cố định, trận boss dài. Cải thiện nhẹ sau gói L (trận boss ngắn đi) nhưng
      vẫn trên ngưỡng ở deck thiên phòng thủ.
      → **Chấp nhận** (đã duyệt): chỉ deck thiên phòng thủ chịu, xem là rủi ro
      thiết kế của lối chơi kéo dài trận.

## Chỉnh sau Lõi (đã duyệt)

Ablation: giảm độ lớn Lõi (×0.5/×0.35) **không đổi** win rate (Lõi kinh tế
đã ở sàn 1); giới hạn số Lõi/lượt làm bot luôn trúng Lõi mạnh nhất (70%);
HP địch ×1.15 → 61%. Damage địch là đòn bẩy duy nhất hạ được: ×1.25 → 54%,
×1.4 → 40%, dmg ×1.25 + HP ×1.1 → **43%**.

**Đã áp** (`enemies.json`): `maxHp` mọi địch ×1.1 (Khôi Lỗi 42, Ảnh Hồ 23,
Thần Viên 94, Thư Hồn 32, Hắc Giáp 69, Hồ Vương 50), `damage` mọi chiêu
×1.25 (kể cả `conditional`/`moonOverrides`/`bloodMoonOverride`); không đụng
`loseHp` (không có), `gainArmor`, status, hồi.

### Kết quả sau chỉnh (seed 1–20, mọi đội × loại deck)

| Deck | Thắng | Tầng TB | XP/lượt |
|---|---|---|---|
| Bộ cơ bản | **43%** | 5.9 | 105.3 |
| nhánh A 6/6/6 | 64% | 6.8 | 133.0 |
| nhánh B 6/6/6 | 34% | 5.5 | 85.3 |
| nhánh A 4/4/10 | 51% | 5.6 | 106.5 |
| nhánh B 8/5/5 | 35% | 6.0 | 93.4 |
| ngẫu nhiên | 51% | 6.3 | 111.4 |

Bộ cơ bản theo tier: thường 89% / 9.3 vòng, Tinh Anh 87% / 9.2, boss 69% /
10.7. Kẹt tay ≤2%, 0 kẹt lượt, 0/60 lá chưa được đánh. Nhịp Tu Luyện ~11.8
lượt tới cấp 6 (mục tiêu 8–12).

### Điểm mở mới

(Đã đóng — đã duyệt "chấp nhận rủi ro thiết kế": Bộ cơ bản của m05+f04+m06
5% và nhánh A 4/4/10 của m05+f03+f04 0% là hệ quả của deck cực đoan/không
Song Hành trên bot heuristic; người chơi thật chơi tốt hơn.)


# Playtest Notes — Phase 4d (bước 4d.6)

## Phương pháp

- `packages/rules/test/economy-sim.test.ts`: 200 người chơi ảo × 60 ngày, mỗi ngày 2 lượt
  chơi Bộ cơ bản (kết quả rút từ lượt bot thật, 4 đội × seed 1–20), mở lá khi có lượt,
  nhận mọi nhiệm vụ, mua cửa hàng Nguyệt Tinh, quay mỗi khi đủ Nguyệt Ngọc.
- `run-playtest`: Bộ cơ bản, mọi Hero cùng Tinh Hồn 0 / 2 / 4 / 6 (4 đội × 20 seed).
- Mục tiêu (`15` §8): ≥ 90% đủ 5 Hero trước ngày 7; Legendary đầu TB ngày 16–25;
  thắng lượt C0 và C6 chênh ≤ 15 điểm.

## Thắng lượt theo Tinh Hồn (80 lượt/mức)

| Tinh Hồn | 0 | 2 | 4 | 6 |
|---|---|---|---|---|
| Thắng | 43% | 43% | 48% | 48% |

Chênh 5 điểm — đạt, không chỉnh. C2 gần như không đổi với bot (ít khi sát ngưỡng thăng
cấp); C4 (lá "+") là bước tăng rõ nhất.

## Kinh tế

| | Trước | Sau (gói J) | Mục tiêu |
|---|---|---|---|
| Đủ 5 Hero trước ngày 7 | 99% | 96% | ≥ 90% |
| Ngày đủ 5 Hero (trung vị / p90) | 0 / 3 | 0 / 3 | — |
| Legendary đầu (TB / trung vị) | 4.7 / 4 | 16.8 / 14 | 16–25 |
| Nguyệt Ngọc/ngày | 628 | 184 | — |
| Lượt quay/ngày | 4.1 | 1.4 | — |
| Tinh Hồn TB Hero Epic ngày 30 / 60 | 5.4 / 6.0 | 2.1 / 3.6 | — |

Hai mục tiêu ngược nhau khi chỉ giảm thu nhập (gói E/F/G: Legendary ~13–16 ngày thì
đủ 5 Hero tụt còn 87–89%); tăng quà tân thủ tách được hai mục tiêu.

## Gói đã áp dụng (đã duyệt — gói J)

- `starterGift` 1600 → 2400; `runRewards` 10/80/100 → 3/20/30.
- Nhiệm vụ ngày 40/40/30 → 20/20/10; tuần 200/150/100 → 80/60/40.
- Thành tựu ×0.5; `dupeMoonStar` rare/common 3 → 1, epic 10 → 5.
- `shop_pull` 5 → 2 lần/tuần.

## Điểm mở

(Đã đóng — đã duyệt "chấp nhận tạm": Legendary đầu là bản trùng Hoắc Liệt và
Rare Ôn Như Ý → Tinh Hồn 6 ngày đầu là hành vi đúng của gacha hiện tại; nội
dung Rare mới là việc của giai đoạn nội dung sau.)

# Playtest Notes — Phase 4e (bước 4e.7)

## Phương pháp

- `run-playtest` (bật bằng `PLAYTEST_GEAR=1`): Bộ cơ bản, 4 đội × 20 seed mỗi dòng. Vũ
  khí do Hero bản mệnh mang nếu có trong đội, nếu không thì Hero đầu đội; deck bỏ lá cuối
  của người mang (18 ô). Nguyệt Bảo: deck giữ nguyên. Mỗi món đo ở R1 và R5.
- Mục tiêu (`15` §8): không món nào làm thắng lượt tăng > 10 điểm ở R1. Sai số mỗi dòng
  (80 lượt) khoảng ±5 điểm.

## Gói đã áp dụng (đã duyệt — gói G1)

| Món | Chỉnh | R1 trước → sau |
|---|---|---|
| Xích Diệm Thương | lá 8→6 damage, Thiêu Đốt 3→2; bản mệnh R1 chỉ Phản Đòn 3 (+1 Sức Mạnh dời lên R5) | +21 → +6 |
| Bách Hoa Trâm | nội tại mỗi 2 lượt; lá Hồi Phục 3/5 → 2/4 | +20 → +10 |
| Loan Linh Ấn | CM1 mỗi lá kỹ năng thứ 5 (thay vì 3); CM3–5 mỗi lá thứ 4 | +19 → +9 |
| Tinh Bàn | R1 "Đầu trận +2 NL"; Dưỡng Nguyệt 1 dời lên R5 | +18 → +3 |
| Liệt Cung | lá 3×2 → 2×2 | +16 → +11 |
| Hàn Tuyết Song Kiếm | lá 4×2 → 3×2; bản mệnh R1 như bản thường | +13 → +6 |

R2–R5 co lại theo cùng nguyên tắc (`03` §7).

## Kết quả sau chỉnh (mốc Bộ cơ bản 43%)

| Món | R1 | R5 | Món | R1 | R5 |
|---|---|---|---|---|---|
| Xích Diệm Thương | +6 | +19 | Thiên Sách | +1 | +6 |
| Ảnh Nguyệt Chủy | +8 | +15 | Vọng Nguyệt Kính | +3 | +1 |
| Hàn Tuyết Song Kiếm | +6 | +24 | Huyết Ngọc Bội | +1 | +9 |
| Thiên Diện Phiến | +10 | +21 | Loan Linh Ấn | +9 | +18 |
| Bách Hoa Trâm | +10 | +24 | Xích Diễm Châu | +1 | +14 |
| Thiết Thuẫn | +9 | +6 | Bạch Lộ Hương Nang | +8 | +23 |
| Liệt Cung | +11 | +18 | Huyền Vũ Giáp Phù | 0 | −1 |
| Huyền Linh Kính | +3 | +13 | Trấn Hồn Linh | +10 | +34 |
| Thanh Tâm Bình | +5 | +14 | | | |
| Tinh Bàn | +3 | +15 | | | |

Mọi lá Binh Khí đều từng được đánh.

## Điểm mở

(Đã đóng — đã duyệt: Liệt Cung chỉnh lá Liệt Tiễn `hits` 2 → 1 (giữ `copies`
2), đo lại R1 **+8** / R5 +17 trong ngưỡng; các món R5 >+20 giữ nguyên vì đạt
R5 cần 4 bản trùng; giáp yếu ở R5 là giới hạn của bot, không chỉnh.)

## Phase 5b — mô phỏng PvP (bot đấu bot)

`PLAYTEST_PVP=1 pnpm vitest run test/pvp-sim.test.ts`: 10 đội (C(5,3)) × 10 đội ×
12 seed = 1200 trận, Bộ cơ bản không trang bị; lượt hai có trang bị PvP cơ bản
ngẫu nhiên (1200 trận nữa). Sai số ±~2.9 điểm.

| Chỉ số | Mục tiêu §4.9 | Không trang bị | Có trang bị |
|---|---|---|---|
| Người đi trước thắng | 47–53% | 54% | 55% |
| Vòng trung vị | 8–12 | 14 | 16 |
| Hero win | 40–60% | 44–55% | 45–53% |
| Hòa roundCap | <1% | 0% | 0% |
| Lá chưa từng đánh | — | 35/…(bot chỉ đánh tập con heuristic) | 35 |

Quét chỉnh số (1200 trận/biến thể): `secondPlayerBonus` +1→+2 gần như không đổi
tỉ lệ đi trước; `heroStats` ×0.8 → 53%/13 vòng; ×0.75 → 53–54%/12; ×0.7 →
53%/12. Không biến thể nào vào giữa khoảng 8–12 vòng.

**Quyết định (đã duyệt): giữ nguyên số hiện tại.** Đi trước 54–55% và vòng TB
14–16 xem như chấp nhận được — bot heuristic chơi chậm/phòng thủ hơn người thật,
nên con số sẽ khác khi có người chơi. Đấu Trường nay đã chạy trên server
(Vercel + Render); xem lại bằng data người chơi thật thay vì sim lại.

(Điểm mở "35 lá bot không đánh" đã đóng: toàn lá nhánh `_plus` + lá điều kiện —
giới hạn kỳ vọng của heuristic, kiểm chứng bằng chơi tay khi có.)

# Playtest Notes — Phase 7a (bước 7a.6)

## Phương pháp

- Bot heuristic mới (`bot.ts`): Hộ Vệ nhắm đồng đội yếu nhất **khác** chủ lá
  (bỏ qua lá khi chỉ còn chủ); lá `shiftMoon` chỉ đánh khi pha đáp có modifier
  khớp tag trong tay (ý tưởng `bestMoonOffset`) hoặc chủ lá còn bộ đếm
  `moonShifts` chưa thăng cấp; lá `forbidden` tự mất HP không đánh khi chủ lá
  HP ≤ tổng mất + 5 (miễn khi đã có `forbiddenNoSelfHpLoss`).
- `run-playtest.test.ts`: 8 đội (4 cũ + 4 mới `m01+m02+f04`, `m08+f08+m05`,
  `m03+m10+m04`, `f01+m07+m06`) × 6 loại deck × seed 1–20. Mỗi ô = 20 lượt.
- `pvp-sim.test.ts` (`PLAYTEST_PVP=1`): 14 Hero → C(14,3) = 364 đội, quét toàn
  bộ quá chậm → **bốc mẫu 4000 cặp** bằng mulberry32 với seed cố định của file
  (`SAMPLE_SEED`), hai lượt: trần và trang bị PvP cơ bản ngẫu nhiên. Mỗi Hero
  xuất hiện ~1700 trận → sai số tỉ lệ thắng ~±3 điểm.
- Mục tiêu: thắng lượt đội mới trong ±10 điểm so trung bình đội cũ; tỉ lệ thắng
  PvP theo Hero 40–60%; độ dài trận PvP TB 8–12 vòng.

## Thắng lượt theo đội (PvE, 20 lượt/ô)

| Đội | Bộ cơ bản | nA 6/6/6 | nB 6/6/6 | nA 4/4/10 | nB 8/5/5 | Ngẫu nhiên | TB | Δ so đội cũ |
|---|---|---|---|---|---|---|---|---|
| m05+f04+m06 | 5% | 65% | 25% | 60% | 25% | 40% | 37% | — |
| m05+f03+f02 | 55% | 65% | 20% | 80% | 25% | 50% | 49% | — |
| m06+f02+f03 | 50% | 65% | 15% | 80% | 20% | 55% | 48% | — |
| m05+f03+f04 | 60% | 60% | 55% | 0% | 55% | 55% | 48% | — |
| **TB 4 đội cũ** | | | | | | | **45%** | — |
| m01+m02+f04 | 0% | 0% | 0% | 0% | 0% | 0% | 0% | **−45** |
| m08+f08+m05 | 0% | 20% | 0% | 5% | 0% | 10% | 6% | **−39** |
| m03+m10+m04 | 0% | 0% | 0% | 0% | 0% | 0% | 0% | **−45** |
| f01+m07+m06 | 5% | 40% | 5% | 25% | 0% | 10% | 14% | **−31** |

Tất cả đội mới dưới ngưỡng. Bốn đội cũ giữ nguyên số lịch sử → bot mới không
làm hỏng meta cũ. Kiểm chứng trận tay: m03+m10+m04 diệt được shadow_fox v4 rồi
cạn deck trước puppet_guard 42 HP (giáp tự tăng); m01+m02+f04 deck chỉ có 2×5
damage. **Đây là vấn đề thành phần deck (không có carry), không phải con số** —
xem "Điểm cần cờ".

Bộ cơ bản theo Tinh Hồn (cả 8 đội): C0 22% / C2 24% / C4 28% / C6 28% — tụt so
4d (43–48%) vì đội mới kéo trung bình xuống, không phải Tinh Hồn yếu đi.
"lá chưa từng được đánh: 0/168" (PvE, gồm cả lá Song Hành trên các đội có cặp).

## Tỉ lệ thắng PvP theo Hero (mẫu 4000, ~1700 trận/Hero)

| Hero | Trần | Trang bị | Đạt 40–60%? |
|---|---|---|---|
| m01 | 29% | 28% | ✗ dưới |
| m02 | 40% | 40% | sàn |
| m03 | 28% | 28% | ✗ dưới |
| m04 | 47% | 42% | ✓ |
| m07 | 34% | 38% | ✗ dưới |
| m08 | 38% | 39% | ✗ dưới |
| m10 | 49% | 50% | ✓ |
| f01 | 41% | 42% | ✓ |
| f08 | 44% | 41% | ✓ |
| m05 | 48% | 47% | ✓ |
| m06 | 56% | 54% | ✓ |
| f02 | 46% | 50% | ✓ |
| f03 | 56% | 54% | ✓ |
| f04 | 43% | 44% | ✓ |

Chung: đi trước thắng **41%** (trần) / **38%** (trang bị) trên trận phân định —
tụt so mức 54–55% khi còn 5 Hero (§4.9 mục tiêu 47–53%): nhiều Hero support/
phòng thủ làm đi sau có thêm chu kỳ phản. Hòa ở trần vòng **14–15%**
(roundCap 30). Độ dài trận **TB 15.4** (trần) / **16.8** (trang bị), trung vị
13/15 — vượt mục tiêu 8–12 (giống kết luận 5b: bot chơi chậm/phòng thủ hơn
người, giữ nguyên chờ data người chơi). Lá chưa đánh 98 = toàn lá `_plus` + lá
khóa (PvP deck chỉ dùng 6 lá tự do + trang bị) — giới hạn kỳ vọng, như 5b.

## Điểm cần cờ

- **m01/m03 không có lá damage trong pool** — m01 12 lá toàn scheme/control
  (drain, weak, Chiêm Bài); m03 chỉ có `m03_kim_tien` (5 dmg) mà nó nằm ở pool
  khóa. Đội không carry thua sạch ở tầng 1 — không chỉnh bằng con số được; đề
  xuất nội dung riêng (đổi pool / thêm lá damage ở đợt nội dung sau, hoặc chấp
  nhận vai trò support bắt buộc đi cùng carry).
- **`m03_tieu_loi` ramp 0-cost ×3** — +1 NL miễn phí; hiện vô hại vì m03 không
  có đầu ra damage (NL dư tràn qua trần `cap`), nhưng sẽ phải xem lại ngay khi
  m03 có payoff (đang ở mức sàn 28% nên không nerf bây giờ).
- **M10 `firstSchemeRepeats` + scheme rẻ** — m10 đạt 49–50%, trong band; lá
  scheme c1–c2 lặp hai lần chưa lật meta nhưng đáng theo dõi sau khi chỉnh m01/
  m03 (cùng tag `scheme`, hưởng chung mọi buff scheme).
- **F08 forbidden pacing** — trận đơn f08 thăng cấp được (ctr 9–15 ở tầng 1)
  nhưng lượt chơi cộng dồn HP → đội m08+f08+m05 thua sạch (0–20%). Ngưỡng 15 HP
  mất tự gây hơi cao cho vòng đời trận: đề xuất hạ ngưỡng (xem gói dưới).
- **M07 `m07_ho_tong`** — c2 cho đồng đội Giáp 4 + Ẩn Thân 1: Ẩn Thân trên đồng
  đội đánh lạc ý định đã báo (PvE) và khóa target (PvP). Dữ liệu không cho thấy
  lạm dụng (m07 34–38%) nhưng lá này là "stealth cho người khác" duy nhất — cần
  kiểm tay.
- **Song Hành** — cả 6 lá bond đều được đánh ≥1 lần trong cả hai lượt mẫu PvP
  (không nằm trong danh sách 98 lá chưa đánh) và trong suite PvE; xác suất một
  cặp cụ thể xuất hiện trong đội ngẫu nhiên ≈ 12/364 ≈ 3.3%/bên — đúng thiết
  kế hiếm. Đội mới: 3/4 đội playtest mang một cặp bond → đã được cover.
- **Độ dài trận / tỉ lệ đi trước** — như mục PvP trên; giữ quyết định 5b (không
  chỉnh toàn cục trước khi có người chơi thật).

## Gói chỉnh đề xuất (CHƯA áp — chờ duyệt)

Chỉ con số JSON; mục tiêu kéo m01/m03/m07/m08 lên sàn 40% PvP và giảm bleed
F08 ở PvE. Không đụng m02 (đúng sàn 40%, tăng tank sẽ kéo dài trận thêm).

| File | Mục | Số | Từ → sang | Lý do |
|---|---|---|---|---|
| heroes.json | m01 `levelUp` | `threshold` / `constellationThreshold` | 8→7 / 6→5 | thăng cấp sớm hơn ~1 scheme |
| heroes.json | m01 `levelUp.passive` | `cheapestCardDiscount.amount` | 1→2 | payoff thật cho chuỗi scheme |
| heroes.json | m03 `levelUp` | `threshold` / `constellationThreshold` | 5→4 / 4→3 | mở Chiêm Bài miễn phí sớm hơn |
| heroes.json | m03 `levelUp.passive` | `freeChooseCardPerTurn.look` | 3→4 | payoff lọc bài thay damage |
| heroes.json | m07 `levelUp` | `threshold` / `constellationThreshold` | 5→4 / 4→3 | randomBuffPerTurn tới sớm hơn 1 vòng |
| heroes.json | f08 `levelUp` | `threshold` / `constellationThreshold` | 15→12 / 11→9 | cắt bleed PvE sớm ~1 lá forbidden |
| pvp-config.json | `heroStats.m01` | `maxHp` | 42→44 | sống đủ lâu để drain đổi tempo |
| pvp-config.json | `heroStats.m03` | `maxHp` | 42→44 | tương tự |
| pvp-config.json | `heroStats.m07` | `maxHp` | 46→48 | support sống lâu = giá trị |
| pvp-config.json | `heroStats.m08` | `maxHp` | 42→44 | 38–39% cần nhích nhẹ |
| cards.json | `m01_mat_thu` | `drainMoonPower` | 1→2 | deny nhiều hơn trên lá c1 ×3 |
| cards.json | `m01_toa_nguyet_phu` | `drainMoonPower` | 2→3 | deny nặng trên lá c2 |
| cards.json | `m07_huyet_anh` | `damage` (nhánh else) | 4→5 | lá damage duy nhất của m07 |
| cards.json | `m08_huyet_hoa` | `damage` (nhánh else) | 5→6 | lá damage duy nhất của m08 |
| heroes.json | `m03.cardIds` | **đổi thành phần pool** (không phải con số — cần duyệt riêng): `m03_tu_tin` ↔ `m03_kim_tien` | — | cho m03 một lá damage trong deck cơ bản |
| — | `pvpConfig.roundCap`, `heroStats` toàn cục | giữ nguyên | — | độ dài trận là artifact của bot; xem lại với người chơi thật |

Ước lượng tác động: m01/m03 +2 HP PvP + ngưỡng/payoff nới ≈ +5–8 điểm PvP
(mục tiêu 33–38% — chưa chắc chạm sàn 40% nếu vẫn thiếu damage; nếu không đạt
thì bước tiếp là thay đổi nội dung pool, không tiếp tục phình số). f08 ngưỡng
12 kéo đội m08+f08+m05 về vùng 15–25% PvE ước tính; phần còn lại là vấn đề
deck (carry đơn). Đo lại sau khi áp bằng cùng seed/seed mẫu.

**DỪNG Ở ĐÂY — chờ người dùng duyệt gói trên trước khi áp (bước 7a.6 step 5).**

## Kết quả sau chỉnh (gói đã duyệt, áp nguyên vẹn + 2 bổ sung duyệt riêng)

Đã áp toàn bộ bảng trên, cộng thêm: `m01_toa_nguyet_phu` được thêm
`damage 3` (sau `drainMoonPower`, cùng mục tiêu `chosen`; text "Tỏa Nguyệt 3.
Gây 3 damage.") và đổi pool m03 `m03_tu_tin` ↔ `m03_kim_tien` (Kim Tiền vào
bộ miễn phí — đã được đánh trong cả hai lượt mẫu PvP). Text lá và mô tả thăng
cấp cập nhật theo số mới; bảng §2.1 của `18` chốt theo số đã chỉnh.

### Thắng lượt theo đội (PvE, 20 lượt/ô — số trong ngoặc = trước chỉnh)

| Đội | Bộ cơ bản | nA 6/6/6 | nB 6/6/6 | nA 4/4/10 | nB 8/5/5 | Ngẫu nhiên | TB | Δ so đội cũ |
|---|---|---|---|---|---|---|---|---|---|
| m05+f04+m06 | 5% | 65% | 25% | 60% | 25% | 40% | 37% | — |
| m05+f03+f02 | 55% | 65% | 20% | 80% | 25% | 50% | 49% | — |
| m06+f02+f03 | 50% | 65% | 15% | 80% | 20% | 55% | 48% | — |
| m05+f03+f04 | 60% | 60% | 55% | 0% | 55% | 55% | 48% | — |
| **TB 4 đội cũ** | | | | | | | **45%** | — |
| m01+m02+f04 | 0% (0%) | 0% (0%) | 0% (0%) | 0% (0%) | 0% (0%) | 0% (0%) | 0% (0%) | **−45** |
| m08+f08+m05 | 0% (0%) | 20% (20%) | 0% (0%) | 10% (5%) | 0% (0%) | 10% (10%) | 7% (6%) | **−38** |
| m03+m10+m04 | 0% (0%) | 0% (0%) | 0% (0%) | 0% (0%) | 0% (0%) | 0% (0%) | 0% (0%) | **−45** |
| f01+m07+m06 | 10% (5%) | 25% (40%) | 5% (5%) | 30% (25%) | 0% (0%) | 25% (10%) | 16% (14%) | **−29** |

Bộ cơ bản theo Tinh Hồn (8 đội): C0 23% / C2 23% / C4 29% / C6 29% (trước
22/24/28/28). 0/168 lá chưa được đánh (PvE). 3/960 lượt kẹt > 60 vòng (1× Bộ
cơ bản, 1× nA 4/4/10, 1× nB 8/5/5 — trước đây 0).

### Tỉ lệ thắng PvP theo Hero (mẫu 4000, ~1700 trận/Hero — số trong ngoặc = trước chỉnh)

| Hero | Trần | Trang bị | Đạt 40–60%? |
|---|---|---|---|
| m01 | 28% (29%) | 28% (28%) | ✗ dưới |
| m02 | 41% (40%) | 40% (40%) | sàn |
| m03 | 27% (28%) | 28% (28%) | ✗ dưới |
| m04 | 46% (47%) | 42% (42%) | ✓ |
| m07 | 35% (34%) | 39% (38%) | ✗ sát sàn |
| m08 | 37% (38%) | 40% (39%) | ✗ sát sàn |
| m10 | 47% (49%) | 50% (50%) | ✓ |
| f01 | 40% (41%) | 41% (42%) | sàn |
| f08 | 43% (44%) | 41% (41%) | ✓ |
| m05 | 49% (48%) | 46% (47%) | ✓ |
| m06 | 54% (56%) | 53% (54%) | ✓ |
| f02 | 46% (46%) | 48% (50%) | ✓ |
| f03 | 54% (56%) | 53% (54%) | ✓ |
| f04 | 42% (43%) | 43% (44%) | ✓ |

Đi trước thắng **41%** (trần) / **38%** (trang bị) — không đổi. Hòa ở trần
vòng **16%** (trước 14–15%). Độ dài trận **TB 15.4 / trung vị 13** (trần) và
**16.8 / 15** (trang bị) — giữ nguyên so trước chỉnh, vẫn vượt mục tiêu 8–12
(theo quyết định 5b: artifact của bot, xem lại với người chơi thật). Lá chưa
đánh 98 = lá `_plus` + lá khóa (đã đổi: `m03_kim_tien` nay được đánh,
`m03_tu_tin` vào danh sách khóa).

### Đánh giá

**Mức band không cải thiện đo được.** Mọi chênh lệch nằm trong sai số ±3 điểm
của mẫu: m01 28–29%→28%, m03 28%→27–28%, m07 +1 (34→35 / 38→39), m08 ~0
(38→37 / 39→40). PvE tương tự: hai đội m01/m03 vẫn 0% mọi deck (chết tầng 1,
tầng TB 1.0–1.3), m08+f08+m05 6%→7%, f01+m07+m06 14%→16%.

Điều này xác nhận chẩn đoán "Điểm cần cờ": **nút thắt là thành phần deck —
không có nguồn damage — chứ không phải ngưỡng/HP.** Kim Tiền (5 damage ×2)
trong bộ miễn phí và +3 damage trên Tỏa Nguyệt Phù vẫn quá ít trước tường
tầng 1 (Khôi Lỗi 42 HP, giáp tự tăng); +2 HP PvP không đổi tempo khi không có
đòn kết liễu. Giữ nguyên ý định đã duyệt: **không phình số tiếp** — bước tiếp
là nội dung (đổi/thêm lá damage cho m01/m03 ở đợt nội dung sau) hoặc chấp nhận
vai trò support bắt buộc đi kèm carry. Ghi chú mở còn lại của 7a (M10 scheme
lặp, `m07_ho_tong` stealth-cho-người-khác, độ dài trận PvP, `m03_tieu_loi`
ramp) vẫn đứng — xem "Điểm cần cờ".

# Playtest Notes — Phase 7b (bước 7b.6)

## Phương pháp

- Bot heuristic bổ sung (`bot.ts`, dùng chung PvE/PvP/co-op): lá `summon` chỉ
  đánh khi chủ lá chưa có Linh Thú sống, Linh Thú < 50% HP, hoặc chủ lá còn
  đang đếm `summonsMade` để thăng cấp (F09); lá `applyStatus → charm` nhắm
  kẻ địch sống có damage báo trước lớn nhất (`previewEnemyIntent`; ở PvP —
  nơi ý định đối thủ ẩn — cân theo damage pool của Hero, Linh Thú không nhận
  Mê Hoặc) và **bỏ qua** khi chỉ còn 1 kẻ địch; lá `sealIntent` nhắm unit có
  nhiều hiệu ứng không-damage nhất trong chuỗi `plannedIntents` (PvP: cân theo
  pool Hero/Linh Thú), **bỏ qua** khi mọi mục tiêu đều chỉ định damage; lá
  `target: "fallenAlly"` chọn đồng đội ngã có `maxHp` cao nhất.
- `run-playtest.test.ts`: +4 đội wave-2 (`f09+f10+m05`, `f06+m09+f03`,
  `f05+f07+m06`, `f10+f05+m04`) × 6 loại deck × seed 1–20. Counters mới: số
  lần triệu hồi/thú đánh, Mê Hoặc đặt + đặt chồng (mê ×2), chiêu địch bị đổi
  mục tiêu, hiệu ứng bị Phong Ấn tước — tách theo tier trận.
- `pvp-sim.test.ts` (`PLAYTEST_PVP=1`): 20 Hero → C(20,3) = 1140 đội, bốc mẫu
  **4000 cặp** seed cố định, hai lượt trần + trang bị PvP cơ bản ngẫu nhiên.
  Mỗi Hero ~1150–1275 trận → sai số ~±3 điểm. Counters mới: triệu hồi, thú
  đánh, Mê Hoặc (kể cả đặt chồng), damage tự bắn phe mình (đổi hướng), lá bị
  Phong Ấn tước (tách trên Linh Thú), Hồi Hồn.
- Mục tiêu: thắng lượt đội mới trong ±10 điểm so trung bình đội cũ (45%); tỉ
  lệ thắng PvP theo Hero 40–60%; độ dài trận PvP TB 8–12 vòng.

## Thắng lượt theo đội (PvE, 20 lượt/ô)

| Đội | Bộ cơ bản | nA 6/6/6 | nB 6/6/6 | nA 4/4/10 | nB 8/5/5 | Ngẫu nhiên | TB | Tầng TB | Δ so đội cũ |
|---|---|---|---|---|---|---|---|---|---|
| f09+f10+m05 | 15% | 55% | 0% | 60% | 0% | 35% | 27.5% | ~6.6 | **−17.5** |
| f06+m09+f03 | 0% | 0% | 5% | 0% | 0% | 5% | 1.7% | ~3.3 | **−43.3** |
| f05+f07+m06 | 45% | 45% | 5% | 35% | 5% | 35% | 27.5% | ~5.0 | **−17.5** |
| f10+f05+m04 | 0% | 0% | 0% | 0% | 0% | 0% | 0% | ~1.2 | **−45** |

Cả 4 đội mới dưới ngưỡng ±10 điểm. Kẹt 2/120 lượt ở f06+m09+f03 (không giết
được, không chết — deck không damage). **Chẩn đoán giống 7a: vấn đề thành
phần pool, không phải con số** — f06/f09/f10 đều có **0 lá damage trong cả 12
lá** (m04 cũng 0). f09+f10+m05 đạt 55–60% trên nhánh A của m05 (Huyết Chiến
có damage) nhưng 0% trên nhánh B (Thiết Vệ thuần tank + 2 Hero 0 damage →
không carry). f10+f05+m04 = hai pool 0-damage + carry đơn f05 → chết sạch
tầng 1 (tầng TB 1.0–1.4), giống hệt m01+m02+f04 / m03+m10+m04 ở 7a.

## Cơ chế wave-2 (PvE, theo tier)

| Đội | Tier | Trận | Triệu hồi/trận | Thú đánh/trận | Mê Hoặc/trận | Mê ×2 | Chiêu đổi/trận | Tước/trận |
|---|---|---|---|---|---|---|---|---|
| f09+f10+m05 | normal | 418 | 1.83 | 6.81 | 0 | 0 | 0 | 0 |
| f09+f10+m05 | elite | 27 | 2.11 | 7.96 | 0 | 0 | 0 | 0 |
| f09+f10+m05 | boss | 80 | 2.42 | 8.46 | 0 | 0 | 0 | 0 |
| f06+m09+f03 | normal | 269 | 0 | 0 | 4.41 | **638** | 2.98 | 0 |
| f06+m09+f03 | elite | 11 | 0 | 0 | 0.55 | 2 | 0.27 | 0 |
| f06+m09+f03 | boss | 18 | 0 | 0 | 0 | 0 | 0 | 0 |
| f05+f07+m06 | normal | 330 | 0 | 0 | 0 | 0 | 0 | 2.31 |
| f05+f07+m06 | elite | 16 | 0 | 0 | 0 | 0 | 0 | 2.56 |
| f05+f07+m06 | boss | 52 | 0 | 0 | 0 | 0 | 0 | 3.88 |

Linh Thú uptime cao: ~2 lần triệu hồi và ~7–8.5 đòn thú mỗi trận — Thỏ Ngọc
(12 HP / 3 dmg → thức tỉnh 24 HP / 6 dmg + hồi 2) là động cơ damage chính của
đội f09. Phong Ấn tước 2.3–3.9 hiệu ứng/trận và cao nhất ở boss (chuỗi ý định
boss nhiều hiệu ứng không-damage — `f07_doan_su` Phong Ấn toàn bàn có giá trị
thật trên boss). Mê Hoặc đổi được ~3 chiêu/trận nhưng đặt chồng lên unit đang
bị mê rất nhiều (**638 lần ở tier normal**) — xem "Điểm cần cờ".

## Tỉ lệ thắng PvP theo Hero (mẫu 4000, ~1200 trận/Hero)

| Hero | Trần | Trang bị | Đạt 40–60%? |
|---|---|---|---|
| **f09** | **81%** | **78%** | ✗ **trên band** |
| f10 | 54% | 56% | ✓ |
| m06 | 53% | 53% | ✓ |
| f03 | 51% | 52% | ✓ |
| m10 | 51% | 49% | ✓ |
| f05 | 51% | 48% | ✓ |
| f02 | 45% | 49% | ✓ |
| f04 | 46% | 40% | ✓ |
| m05 | 45% | 43% | ✓ |
| m04 | 44% | 43% | ✓ |
| f08 | 42% | 40% | sàn |
| m09 | 41% | 40% | sàn |
| m08 | 39% | 38% | ✗ dưới |
| f01 | 39% | 36% | ✗ dưới |
| f06 | 38% | 38% | ✗ dưới |
| m02 | 38% | 37% | ✗ dưới (sát) |
| m07 | 37% | 40% | ✗ sát sàn |
| f07 | 33% | 33% | ✗ dưới |
| m01 | 31% | 29% | ✗ dưới |
| m03 | 28% | 29% | ✗ dưới |

Chung: đi trước thắng **47%** (trần) / **45%** (trang bị) — lên từ 41%/38%
của 7a và đã nằm trong mục tiêu §4.9 (47–53% ở trần): các Hero wave-2 chủ
động hơn (Linh Thú, Phong Ấn) thưởng bên ra đòn. Hòa ở trần vòng **11%**
(trần) / **13%** (trang bị), giảm từ 14–16%. Độ dài trận **TB 14.3 / trung
vị 12** (trần) và **16.1 / 14** (trang bị), min/max 5–31 / 6–31 — vẫn vượt
mục tiêu 8–12 (quyết định 5b/7a đứng: artifact của bot phòng thủ, xem lại
với người chơi thật). Lá chưa đánh 140 = toàn `_plus` + pool khóa.

Cơ chế wave-2 mỗi trận PvP (trần / trang bị): triệu hồi **0.83/0.85**, thú
đánh **3.08/3.52**, Mê Hoặc đặt **3.93/3.93** (đặt chồng **10101/9387** lần,
~2.4–2.5 lần/trận), damage bắn phe mình do đổi hướng **3.05/3.27**, lá bị
tước **2.44/2.57**, tước trên Linh Thú **5/1** lần tổng, Hồi Hồn **0.11/0.08**.

## Điểm cần cờ

- **F09 outlier PvP (81%/78%)** — Thỏ Ngọc đánh mỗi lượt, đối thủ-bot không
  ưu tiên giết summon; dạng thức tỉnh (24 HP, 6 dmg + hồi 2 cho chủ) gần như
  không thể tháo. Tuy nhiên PvE f09 **không** lệch (đội f09+f10+m05 27.5%,
  tụt do pool) → nerf Linh Thú, không nerf chủ; lưu ý `awakenSummons` chỉ áp
  khi chủ còn sống + đã thăng cấp (giết f09 hạ Thỏ về dạng thường).
- **Pool 0-damage (f06, f09, f10 — và m04 cũ)** — damage của f09 đi qua Linh
  Thú, f10 qua Hồi Hồn/hỗ trợ, f06 qua đổi hướng Mê Hoặc. Đội 2 support
  0-damage + 1 carry thua sạch (f10+f05+m04 0%, f06+m09+f03 1.7%) — cùng
  lớp vấn đề m01/m03 ở 7a; **không sửa bằng con số**, cần duyệt đổi pool
  (thêm/đổi 1 lá damage mỗi Hero) ở đợt nội dung.
- **Mê ×2 (đặt chồng Mê Hoặc)** — ~2.4–2.5 lần/trận PvP, 638 lần tier normal
  ở đội f06+m09+f03. Charges stack đúng thiết kế và bot nhắm unit damage cao
  nhất — thường là cùng một mục tiêu; giá trị không mất hẳn nhưng mật độ lá
  charm của f06/m09 làm spam đáng kể. Theo dõi thêm, chưa chỉnh.
- **`f06_kinh_hong_chieu` (Mê Hoặc AoE)** — lá khóa/nhánh, không xuất hiện
  trong deck PvP (140 lá chưa đánh gồm hết pool khóa); trong PvE chỉ vào deck
  nhánh → cover mỏng. Số liệu AoE charm chủ yếu qua nhánh f06.
- **`f07_doan_su` (Phong Ấn toàn bàn) trên boss** — cùng là lá khóa; trong
  deck nhánh f07 đóng góp vào 3.88 tước/trận ở tier boss. Hoạt động đúng kỳ
  vọng, chưa thấy lạm dụng.
- **Phong Ấn lên Linh Thú trong PvP** — xảy ra nhưng hiếm (5 trần / 1 trang
  bị trên 4000 trận): pool seal của f07 hẹp + bot ưu tiên chuỗi nhiều hiệu
  ứng (Linh Thú chỉ có action damage → weight 0, đúng thiết kế).
- **Độ dài trận / đi trước** — như mục PvP; giữ quyết định 5b.
- **m02 tụt khỏi sàn (38%/37%)** — từ 40%/40% ở 7a; vẫn giữ lập trường 7a
  (tăng HP tank kéo dài trận), cờ theo dõi.

## Đề xuất gói chỉnh (CHƯA áp — chờ duyệt)

Chỉ con số JSON; mục tiêu kéo f09 về band và nhấc f07/f06 sát sàn. Không
đụng f10/m09/f05 (đang trong band/sàn) và không phình số cho các pool
0-damage (vấn đề nội dung, không phải số — như 7a).

| File | Mục | Số | Từ → sang | Lý do |
|---|---|---|---|---|
| summons.json | `tho_ngoc.action[0]` | `amount` | 3→2 | nguồn damage chính khiến f09 đứng 78–81%; −1/đòn ≈ −33% output thú |
| summons.json | `tho_ngoc_thuc_tinh.action[0]` | `amount` | 6→5 | dạng thức tỉnh là đỉnh outlier PvP |
| summons.json | `tho_ngoc_thuc_tinh` | `maxHp` | 24→18 | 24 HP gần như không tháo được ở PvP |
| heroes.json | `f09.levelUp` | `threshold` / `constellationThreshold` | 5→6 / 4→5 | trì hoãn dạng thức tỉnh ~1 lượt triệu hồi |
| pvp-config.json | `heroStats.f09` | `maxHp` | 40→38 | chủ là "kill-switch" của dạng thức tỉnh (awaken cần chủ sống) |
| pvp-config.json | `heroStats.f07` | `maxHp` | 42→44 | 33% dưới sàn; Phong Ấn là utility, cần sống để trả giá trị |
| heroes.json | `f07.levelUp` | `constellationThreshold` | 3→2 | `sealExtraFirstPerTurn` tới sớm hơn ~1 lần ấn |
| pvp-config.json | `heroStats.f06` | `maxHp` | 42→44 | 38% sát sàn; support charm sống lâu = giá trị |
| heroes.json | pool `f10.cardIds` / `f06.cardIds` / `m04.cardIds` | **đổi thành phần pool** (không phải con số — cần duyệt riêng): 1 lá damage mỗi Hero | — | cứu các đội 2-support-0-damage đang 0–2% PvE |
| — | `pvpConfig.roundCap`, `heroStats` toàn cục | giữ nguyên | — | độ dài trận là artifact của bot; xem lại với người chơi thật |

Ước lượng tác động: f09 −33% damage thú + thức tỉnh muộn/mỏng hơn ≈ −15–20
điểm PvP (mục tiêu ~60–65%, có thể cần nhịp nerf thứ hai nếu vẫn trên band).
f07 +2 HP + constellation sớm ≈ +3–5 điểm (mục tiêu 36–38%, sát sàn); f06 +2
HP ≈ +2–3 điểm. Rủi ro: nerf Linh Thú kéo PvE f09+f10+m05 tụt thêm — nhưng
chênh lệch PvE là vấn đề pool, đo lại sau khi áp bằng cùng seed/seed mẫu.

## Kết quả sau chỉnh (gói đã duyệt — đã áp)

Gói được duyệt **nguyên vẹn kèm 3 rider damage** lên `f10_tay_tran`,
`f06_mat_ham`, `m04_duong_mach` (2 damage AoE/chọn, giải quyết sau cùng; riêng
`f06_mat_ham` đặt damage trước `chooseCard` vì schema bắt Chiêm Bài đứng cuối).
Test F09 trong `phase7b-heroes.test.ts` đổi sang 6 lá triệu hồi, thức tỉnh
18 HP. `pnpm --filter rules test`: 595 test xanh, **không golden nào lệch**
(fixture golden chỉ dùng đội wave-1 — không động cơ chế/số liệu mới).

### PvP theo Hero (mẫu 4000, cùng seed mẫu — trước → sau)

| Hero | Trần | Trang bị | Band 40–60%? |
|---|---|---|---|
| **f09** | 81% → **71%** | 78% → **67%** | ✗ **vẫn trên band** |
| f10 | 54% → 57% | 56% → 58% | ✓ (sát trần trên) |
| m06 | 53% → 55% | 53% → 56% | ✓ |
| f03 | 51% → 54% | 52% → 54% | ✓ |
| m10 | 51% → 53% | 49% → 51% | ✓ |
| f05 | 51% → 53% | 48% → 49% | ✓ |
| f02 | 45% → 46% | 49% → 49% | ✓ |
| m04 | 44% → 46% | 43% → 45% | ✓ (+rider) |
| f04 | 46% → 46% | 40% → 41% | ✓ |
| m05 | 45% → 46% | 43% → 44% | ✓ |
| f08 | 42% → 43% | 40% → 41% | sàn |
| m09 | 41% → 42% | 40% → 40% | sàn |
| m02 | 38% → 40% | 37% → 37% | sàn trần / ✗ dưới trang bị |
| m08 | 39% → 39% | 38% → 38% | ✗ dưới |
| f01 | 39% → 39% | 36% → 36% | ✗ dưới |
| **f06** | 38% → 39% | 38% → 38% | ✗ **vẫn dưới sàn (sát)** |
| m07 | 37% → 37% | 40% → 40% | ✗ sát sàn |
| **f07** | 33% → **31%** | 33% → **32%** | ✗ **vẫn dưới, không hồi** |
| m01 | 31% → 30% | 29% → 28% | ✗ dưới |
| m03 | 28% → 27% | 29% → 27% | ✗ dưới |

Chung: đi trước thắng 46%/45% (từ 47%/45%), hòa 11%/13% (như cũ), độ dài TB
14.1 / trung vị 12 (trần) và 16.0 / 14 (trang bị) — ngắn hơn chút, vẫn ngoài
mục tiêu 8–12 (artifact bot, giữ quyết định 5b). Lá chưa đánh 140 = toàn
`_plus` + pool khóa (giống trước). Cơ chế 7b/trận (trần/trang bị): triệu hồi
0.84/0.86, thú đánh 2.92/3.31 (từ 3.08/3.52 — thú yếu hơn đánh ít trận hơn),
Mê Hoặc 3.95/3.93, mê ×2 10161/9418, đổi hướng 3.03/3.29, tước 2.51/2.66,
tước trên Linh Thú 1/0, Hồi Hồn 0.10/0.08.

### Thắng lượt theo đội (PvE, 20 lượt/ô — trước → sau)

| Đội | Bộ cơ bản | nA 6/6/6 | nB 6/6/6 | nA 4/4/10 | nB 8/5/5 | Ngẫu nhiên | TB | Δ so đội cũ |
|---|---|---|---|---|---|---|---|---|
| f09+f10+m05 | 15→5% | 55→30% | 0→0% | 60→50% | 0→0% | 35→25% | 27.5→**18.3%** | −26.7 |
| f06+m09+f03 | 0→0% | 0→0% | 5→5% | 0→0% | 0→0% | 5→5% | 1.7→**1.7%** | −43.3 |
| f05+f07+m06 | 45→45% | 45→45% | 5→5% | 35→35% | 5→5% | 35→35% | 27.5→**28.3%** | −16.7 |
| f10+f05+m04 | 0→0% | 0→0% | 0→0% | 0→0% | 0→0% | 0→0% | 0→**0%** | −45 |

Kẹt: 2/120 ở f06+m09+f03 (như trước). Cơ chế theo tier gần như giữ nguyên:
f09+f10+m05 triệu hồi 1.77/1.91/2.50, thú đánh 6.78/8.23/8.32 (normal/elite/
boss — thú yếu hơn nhưng uptime giữ); f06+m09+f03 Mê Hoặc 4.35, mê ×2 641
normal; f05+f07+m06 tước 2.31/2.56/3.88; f10+f05+m04 vẫn chết tầng 1.

### Đọc kết quả

- **Nerf Thỏ Ngọc đúng hướng nhưng chưa đủ**: f09 −10/−11 điểm nhưng 71%/67%
  vẫn trên band — dự báo "có thể cần nhịp nerf thứ hai" thành hiện thực.
  **Cờ: cần beat nerf thứ hai** (gợi ý chưa áp: `tho_ngoc` damage 2→1, hoặc
  `thuc_tinh` 18→14 HP / bỏ `heal 2 owner`, hoặc `summonsMade` 6→7).
- **f07 không hồi (33→31/32)**: +2 HP và constellation 2 không cứu nổi —
  trong sai số ±3 nhưng xu hướng âm. Phong Ấn là utility mỏng trong meta
  damage; có thể cần buff thực chất hơn (cost `f07_phe_but` 3→2 hoặc
  `f07_doat_but` damage 3→4) ở beat sau — cùng nhịp với f09.
- **f06 vẫn sát sàn (39/38)**: rider 2 damage trên `f06_mat_ham` + 2 HP không
  nhúc nhích đáng kể — PvP damage 2 từ lá 2-cost không lật kèo; giữ quan sát,
  xem xét cùng đợt f07.
- **Rider 0-damage không cứu PvE**: f10+f05+m04 vẫn 0% tầng ~1.2, f06+m09+f03
  vẫn 1.7% — xác nhận chẩn đoán "vấn đề pool, không phải số": 2 damage AoE
  trên 2 lá/deck không đủ khi cả đội thiếu động cơ damage. Vẫn cần đổi thành
  phần pool thật ở đợt nội dung (đề xuất cũ đứng).
- PvP cho thấy rider có giá trị nhỏ nhưng đo được ở chủ nhân: m04 +2/+2,
  f10 +3/+2 (f10 giờ sát trần trên band — theo dõi).
- Nerf f09 kéo PvE f09+f10+m05 tụt 27.5→18.3% như dự báo; chênh vẫn là pool.

# Playtest Notes — Sau 7b: bot trung thực, damage đặc trưng, F09

## Thay đổi phương pháp

- **Bot không đọc chuỗi chiêu ẩn** (quyết định: giữ ẩn ý định). Từ 7b.3 client không hiện
  `plannedIntents` nhưng bot vẫn đọc — mọi số 7b trước đây đo một người chơi biết trước.
  Nay bot chỉ dùng thông tin công khai: bộ chiêu của loại địch (lọc theo Nguyệt Lực đang
  hiện) cho Mê Hoặc / Phong Ấn, Nguyệt Lực hiện có cho Tỏa Nguyệt; bot co-op bỏ "bảo vệ
  Hero bị nhắm".
- **80 seed** khi đo để ra quyết định (`PLAYTEST_SEEDS=80`): 20 lượt/ô có sai số ±22 điểm
  (95%). `pnpm test` giữ 20 seed.

## Kết quả (Bộ cơ bản, 80 seed/đội — trước → sau)

| Đội | Trước | Sau | Tầng TB |
|---|---|---|---|
| m05+f04+m06 (đội khởi đầu) | 13% | **29%** | 4.7 → 5.7 |
| m05+f03+f02 | 56% | 56% | 6.1 |
| m06+f02+f03 | 61% | 61% | 6.5 |
| m05+f03+f04 | 61% | 66% | 7.2 |
| f05+f07+m06 | 44% | 46% | 5.7 |
| f01+m07+m06 | 9% | 14% | 4.7 |
| f09+f10+m05 | 8% | 4% | 5.9 (F09 thức tỉnh muộn hơn) |
| m01+m02+f04 | 0% | 0% | 1.0 |
| m03+m10+m04 | 0% | 0% | 1.7 |
| f10+f05+m04 | 0% | 0% | 1.8 |
| f06+m09+f03 | 0% | 1% | 3.0 |
| m08+f08+m05 | 1% | 1% | 2.4 |
| **Tổng** | 21% | 23% | |

Đã áp (đã duyệt): *Băng Tâm Quyết* +4 damage (đội khởi đầu 13 → 29%); effect mới
`scaledDamage` + condition `targetSealed` (`01` §5.7) và 9 lá damage theo lối chơi đặc
trưng (Tỏa Nguyệt Phù, Xung Trận, Kim Tiền, Dưỡng Mạch, Nguyệt Quang, Hồng Vũ, Đoạt Bút,
Tẩy Trần, Cầm Khúc).

## Đội 2 support vẫn thua — nguyên nhân là Cạn Bài

Đội 2 support chết ở trận đầu vì **Cạn Bài**, không phải vì bị đánh: bộ bài ~48–54 bản,
~5 lá/vòng, cạn ở vòng 9–12; nhiều seed cả 3 Hero còn đầy máu. Độ nhạy (80 seed):

| Biến thể | m01+m02+f04 | m03+m10+m04 | f10+f05+m04 | f06+m09+f03 | Tổng 10 đội |
|---|---|---|---|---|---|
| Lá đặc trưng (đã áp) | 0% | 0% | 0% | 1% | 15% |
| Lá đặc trưng damage ×2 | 0% | 1% | 0% | 1% | 17% |
| ×2 + mỗi lá 3 bản | 9% | 18% | 3% | 0% | 23% |
| `copies` mọi lá ×2 | 0% | 0% | 9% | 4% | 23% |
| **Hết chồng thì xáo chồng bỏ (không phạt)** | **54%** | 13% | 10% | 1% | **29%** |
| **Xáo chồng bỏ, mỗi Hero mất 5 HP/lần** | **45%** | 3% | 3% | 1% | **25%** |

(Hai dòng xáo chồng bỏ đo bằng file tạm, không phải luật.) Thêm damage vào lá support
không đủ ở mức số hợp lý; nới Cạn Bài cứu đội thủ (m01+m02+f04) nhưng không cứu đội mong
manh (f06+m09+f03 chết tầng 3 vì bị đánh, m08+f08+m05 chết tầng 2 vì tự mất HP).
**Quyết định: không đổi luật Cạn Bài** — thay vào đó mỗi Hero hỗ trợ thêm 2 lá damage đặc trưng (dưới).

## F09 PvP (mẫu 4000, bot trung thực, data sau khi áp lá đặc trưng)

| Biến thể | F09 |
|---|---|
| Hiện tại (ngưỡng 6) | 71% |
| PvP HP 38 → 32 / bỏ "hồi chủ 2" / cả hai | 69–71% |
| Thỏ Ngọc damage 2 → 1 / HP 12 → 8 | 68–69% |
| Thức tỉnh 14 HP · 4 damage / 12 HP · 3 damage không hồi | 66–68% |
| **Ngưỡng `summonsMade` 7** (Tinh Hồn 2 giữ 5) | **56%** |
| Ngưỡng 8 | 54% — loại: bộ miễn phí chỉ có 7 bản lá triệu hồi, không thể thức tỉnh |
| Bot ưu tiên đánh Hero thay vì Linh Thú | 76% — không phải artifact "bia đỡ", đã bỏ |

Đã áp **ngưỡng 7**: thức tỉnh cần đánh đủ cả 7 bản lá triệu hồi miễn phí — muộn, cần
theo dõi tỉ lệ F09 thăng cấp. Band PvP còn dưới sàn: f07 28%, m03 27%, m01 34%, m07 37%,
m02 38% (không đổi đo được so với trước). Đi trước thắng 47%, hòa 10%, vòng TB 13.6.

## Hero hỗ trợ: 3 lá damage đặc trưng mỗi Hero (đã duyệt hướng, số khởi điểm)

Mỗi Hero hỗ trợ (M01, M02, M03, M04, F01, F04, F06, F07, F10, M09) sửa thêm **2 lá miễn phí có
sẵn** (giữ id, giữ khuôn 6 lá) thành lá có damage theo cơ chế riêng; thêm chỉ số
`alliesRegen` cho F04. F09 không đổi (damage đi qua Thỏ Ngọc).

| Hero | Lá sửa thêm | Cơ chế |
|---|---|---|
| M01 | Mưu Cơ, Mật Thư | +damage theo số lá đã đánh trong lượt |
| M02 | Tứ Vệ, Khiêu Địch | damage theo giáp cả đội / giáp bản thân |
| M03 | Mậu Dịch, Thám Báo (nay nhắm kẻ địch) | damage theo Nguyệt Lực đang có |
| M04 | Hộ Mạch, Cam Lộ | damage lan theo số Hero đầy HP |
| F01 | Tinh Dịch, Hô Nguyệt | damage lan, gấp đôi+ ở Trăng Tròn |
| F04 | Hồi Xuân Tán, Bách Thảo Hương | damage lan theo tổng Hồi Phục của đội |
| F06 | Quyến Mục, Mật Hàm | Mê Hoặc / số debuff trên mục tiêu |
| F07 | Phê Bút, Phong Ấn | mạnh hơn lên mục tiêu mang dấu Phong Ấn |
| F10 | Hộ Phách, Dẫn Hồn | damage lan theo giáp cả đội |
| M09 | Sầu Cầm, Đoạn Trường | damage theo số debuff trên mục tiêu |

Lượt đo đầu (chưa chỉnh): tổng 23% → 39%, nhưng F04 quá mạnh (đội có F04 61–89%) và M04 /
F10 còn yếu. Ablation 80 seed: nerf F04 (Hồi Xuân Tán ÷2 tối đa 6, Bách Thảo Hương ÷3 tối đa
4), buff M04 (Hộ Mạch 2, Cam Lộ 3, Dưỡng Mạch 3 mỗi Hero đầy HP), F10 (Tẩy Trần / Hộ Phách
÷1, Dẫn Hồn ÷2), F06/M09 (mỗi debuff +3). Đã áp cả gói.

### PvE (Bộ cơ bản, 80 seed)

| Đội | Trước (1 lá) | Sau (3 lá, đã chỉnh) | Tầng TB |
|---|---|---|---|
| m05+f04+m06 | 29% | 50% | 6.8 |
| m05+f03+f02 | 56% | 56% | 6.1 |
| m06+f02+f03 | 61% | 61% | 6.5 |
| m05+f03+f04 | 66% | 80% | 7.5 |
| m01+m02+f04 | 0% | **41%** | 7.3 |
| m03+m10+m04 | 0% | 18% | 6.3 |
| f01+m07+m06 | 14% | 33% | 6.0 |
| f05+f07+m06 | 46% | 66% | 6.7 |
| f09+f10+m05 | 4% | 13% | 7.0 |
| f06+m09+f03 | 1% | 4% | 4.5 |
| f10+f05+m04 | 0% | 3% | 4.0 |
| m08+f08+m05 | 1% | 1% | 2.4 |
| **Tổng** | 23% | **35%** | |

Còn yếu: f06+m09+f03 (F06 30 HP ngã gần như mỗi trận — thiếu sống sót, không phải damage),
f10+f05+m04 (Cạn Bài trước cặp Khôi Lỗi giáp 8/lượt), m08+f08+m05 (không có Hero hỗ trợ
trong đội; F08 tự mất HP). m05+f03+f04 80% cao (Song Hành Tuyết Trung + damage F04).

### PvP (mẫu 4000)

Đi trước thắng 51%, hòa 7% (từ 10%), vòng TB **11.7** (từ 13.6 — lần đầu vào mục tiêu
8–12). Theo Hero: m09 61, m04 59, f04 58, f10 58, m02 54, f09 54, f06 49, f05 48, m06 48,
m10 48, f01 46, m01 46, f03 43, m03 41, f07 40, m05 39, f08 35, f02 34, m07 34, m08 30.
Support vào band (m01 34 → 46, m03 27 → 41, f07 28 → 40); nay lệch ngược: m09 trên trần
nhẹ, m08 / m07 / f02 / f08 dưới sàn.
