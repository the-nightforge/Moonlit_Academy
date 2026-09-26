# 06 — Kịch bản test

Mỗi kịch bản là một test Vitest trong `packages/rules/test/`, đặt tên bắt đầu bằng mã (ví dụ `it("T11: empower adds to next attack and is consumed", ...)`).

**"Kẻ địch bị vô hiệu"** nghĩa là trong test, đặt ý định của kẻ địch thành một ý định không có effect (dùng dữ liệu test), để kiểm tra các cơ chế theo lượt mà không bị damage chen vào. Dữ liệu test (lá test, ý định rỗng) đặt trong `packages/rules/test/fixtures/`, không trộn vào `data/`.

**Cách dựng state cho test:** viết helper `makeTestCombat(overrides)` tạo trận với dữ liệu thật trong `data/`, sau đó ghi đè trực tiếp các trường cần thiết (HP, trạng thái, bài trên tay, pha trăng, `moonPower`). Như vậy test không phụ thuộc vào kết quả xáo bài.

Quy ước trong bảng: kẻ địch "Khôi Lỗi" = `puppet_guard` (HP 42), "Ảnh Hồ" = `shadow_fox` (HP 24). Khi không nói gì thêm: pha trăng là Lưỡi Liềm Đầu, không ai có giáp hay trạng thái, `moonPower = 3`, Hero đầy máu.

## A. Khởi tạo và luồng lượt

| Mã | Thiết lập | Hành động | Kết quả mong đợi |
|---|---|---|---|
| T01 | `createCombat` với M05, F04, M06, `enc_01`, seed 42 | — | `status = playerTurn`, `round = 1`, `moonIndex = 1`, `moonPower = 3`, 5 lá trên tay, 10 lá chồng rút, 0 lá chồng bỏ, cả 2 kẻ địch có `currentIntent` |
| T02 | Như T01 | Tạo lại với seed 42 | Thứ tự `drawPile` và `hand` giống hệt lần đầu |
| T03 | Hai trận cùng seed | Cùng một chuỗi 10 hành động | State cuối **bằng nhau hoàn toàn** (deep equal) và cùng danh sách event |
| T04 | `moonPower = 1`, Liệt Hỏa Xung Phong (giá 2) trên tay | `playCard` | Bị từ chối, state không đổi |
| T05 | Lá không có trên tay | `playCard` | Bị từ chối |
| T06 | Ám Tiễn, mục tiêu là một Hero | `playCard` | Bị từ chối (cần `enemy`) |
| T07 | Hand 5 lá | `endTurn` | Sau lượt kẻ địch: `round = 2`, `moonIndex = 2`, 5 lá mới trên tay, `moonPower = 3`, chồng bỏ 5 lá, chồng rút 5 lá |
| T08 | `drawPile` 2 lá, `discardPile` 8 lá | Bắt đầu lượt mới (rút 5) | Rút 2 lá, xáo chồng bỏ thành chồng rút, rút tiếp 3; có event `deckShuffled` |
| T09 | Hand 9 lá | Effect `draw 2` | Hand 10 lá, lá còn lại vào chồng bỏ |

## B. Damage

| Mã | Thiết lập | Hành động | Kết quả mong đợi |
|---|---|---|---|
| T10 | M05 HP 40 | Liệt Hỏa Xung Phong → Khôi Lỗi | Khôi Lỗi HP 42 → 34 |
| T11 | M05 HP 19 | Liệt Hỏa Xung Phong → Khôi Lỗi | Gây 12 → HP 30 |
| T12 | M05 HP **20** (đúng 50%) | Liệt Hỏa Xung Phong | Gây **8** (điều kiện là nhỏ hơn hẳn) |
| T13 | Khôi Lỗi có 5 giáp | Liệt Hỏa Xung Phong (8) | Giáp 0, HP 42 → 39; event `damageDealt` có `blocked 5`, `hpLost 3` |
| T14 | Khôi Lỗi có 8 giáp | Thương Phá | Giáp 0 trước, rồi HP 42 → 37 |
| T15 | Khôi Lỗi có Suy Yếu, ý định Trọng Kích (9) nhắm M05 | `endTurn` | M05 mất floor(9 × 0.75) = **6** |
| T16 | Khôi Lỗi có Dễ Vỡ | Liệt Hỏa Xung Phong (8) | Gây 12 |
| T17 | Khôi Lỗi Suy Yếu, M05 Dễ Vỡ, Trọng Kích nhắm M05 | `endTurn` | 9 × 0.75 × 1.5 = 10.125 → M05 mất **10** |
| T18 | M05 HP 40 | Trấn Bắc Huyết Tính, rồi Liệt Hỏa Xung Phong → Khôi Lỗi | M05 HP 37, `empower 4` được áp rồi bị gỡ; Khôi Lỗi mất **12**; `moonPower` 3 → 1 |
| T19 | Sau T18 | Thêm Thương Phá → Khôi Lỗi | Khôi Lỗi mất 5 (Tích Lực đã dùng hết) |
| T20 | Ảnh Hồ HP 24, Song Nhận Loạn Vũ ở `enc_01` | `playCard` | Cả Khôi Lỗi và Ảnh Hồ mất 5 |

## C. Trăng

| Mã | Thiết lập | Hành động | Kết quả mong đợi |
|---|---|---|---|
| T21 | Pha Trăng Non | Ám Tiễn (không Ẩn Thân) | Gây floor(6 × 1.5) = **9** |
| T22 | Pha Trăng Non, M06 Ẩn Thân | Ám Tiễn | Gây **15**, sau đó M06 hết Ẩn Thân |
| T23 | Pha Trăng Non | Ảnh Bộ | M06 Ẩn Thân thời hạn **2** |
| T24 | Pha Bán Nguyệt | `getEffectiveCost` Nguyệt Ảnh Ấn và Hổ Gầm | Cả hai = **0**; Liệt Hỏa Xung Phong vẫn = 2 |
| T25 | Pha Trăng Tròn, F04 HP 20/30 | Thảo Dược → F04 | HP **30** (hồi 10) |
| T26 | Pha Trăng Tròn, F04 HP 25/30 | Thảo Dược → F04 | HP 30, event `healed` có `amount 5` |
| T27 | Pha Hạ Huyền | Linh Chi Hộ Thể → M06; Hổ Gầm | M06 giáp **9**; M05 giáp **7** |
| T28 | Pha Trăng Khuyết Đầu (3), F04 HP 20 | Nguyệt Quang Dẫn, rồi Thảo Dược → F04 | `moonIndex = 4`, event `moonShifted` cause `card`; F04 HP 30 |
| T29 | Pha Lưỡi Liềm Cuối (7) | Nguyệt Quang Dẫn | `moonIndex = 0` |
| T30 | Effect `shiftMoon -1` ở pha 0 (dùng lá test) | Giải quyết | `moonIndex = 7` |
| T31 | Pha Trăng Khuyết Đầu (3) | `endTurn` | Pha tiến lên 4; ý định mới của Ảnh Hồ là **Huyễn Nguyệt**; `patternIndex` của Ảnh Hồ vẫn tăng 1 |
| T32 | Pha 3, người chơi đánh Nguyệt Quang Dẫn (lên 4) | `endTurn` | Pha tiến lên 5; ý định mới của Ảnh Hồ **không** phải Huyễn Nguyệt |

## D. Trạng thái và mục tiêu của kẻ địch

| Mã | Thiết lập | Hành động | Kết quả mong đợi |
|---|---|---|---|
| T33 | Ý định Khôi Lỗi nhắm M06 | Hổ Gầm, `endTurn` | Đòn đánh vào **M05**; M05 có 5 giáp chặn trước |
| T34 | Ý định Khôi Lỗi nhắm M06 (`random`) | Ảnh Bộ, `endTurn` | Mục tiêu được chọn lại (RNG) trong M05, F04; M06 không mất HP |
| T35 | Mọi Hero còn sống đều Ẩn Thân (dựng thẳng state) | `endTurn` | Ý định đơn mục tiêu phát `intentFizzled`, không Hero nào mất HP |
| T36 | M06 Ẩn Thân | `getValidTargets` cho Thảo Dược | Có M06 (Ẩn Thân không chặn đồng đội chọn) |
| T37 | Khôi Lỗi bị Đánh Dấu bởi M06 | Ám Tiễn; rồi Thương Phá của M05 | Ám Tiễn gây **9**; Thương Phá gây **5** (Đánh Dấu chỉ tính cho M06) |
| T38 | Áp Nguyệt Ảnh Ấn ở vòng 1 | `endTurn` hai lần | Còn Đánh Dấu (1) trong vòng 2; bị gỡ ở cuối vòng 2 |
| T39 | M05 có `burn 3`, giáp 5 (dựng thẳng) | Bắt đầu lượt người chơi | Giáp bị xóa trước; M05 mất 3 HP; `burn` còn 2 |
| T40 | M05 HP 30, `regen 3`, pha Hạ Huyền (để không gặp Trăng Tròn), kẻ địch bị vô hiệu | Bắt đầu 3 lượt người chơi liên tiếp | HP 33 → 35 → 36; `regen` hết sau lượt thứ ba |
| T41 | Pha Trăng Tròn khi bắt đầu lượt, M05 HP 30, `regen 3` | Bắt đầu lượt | Hồi **6** |
| T42 | M06 HP 20, có `weak 2`, `mark` (dựng thẳng), `stealth 1`, `regen 2` | Tịnh Tâm Trà → M06 | Hết `weak` và `mark`; vẫn còn `stealth`, `regen`; hồi 2 |
| T43 | Khôi Lỗi `freeze` | `endTurn` | Khôi Lỗi phát `intentSkipped`, không gây damage; hết `freeze` |
| T44 | Hero giáp 6 cuối lượt kẻ địch | Bắt đầu lượt người chơi | Giáp = 0 |
| T45 | Khôi Lỗi nhận 8 giáp từ Thủ Thế | Lượt người chơi kế tiếp | Khôi Lỗi **vẫn còn 8 giáp** (chỉ bị xóa đầu lượt kẻ địch) |

## E. Thăng cấp

| Mã | Thiết lập | Hành động | Kết quả mong đợi |
|---|---|---|---|
| T46 | M05 HP 40, bộ đếm 12 | Trấn Bắc Huyết Tính (mất 3) | Bộ đếm 15 → event `heroLeveledUp` ngay, `leveledUp = true` |
| T47 | M05 đã thăng cấp | Liệt Hỏa Xung Phong (HP ≥ 50%) → Khôi Lỗi | Gây **11** |
| T48 | M05 giáp 5, bộ đếm 0, bị đánh 9 | `endTurn` | Bộ đếm **4** (chỉ tính HP thực mất) |
| T49 | F04 chưa thăng cấp, M05 có `regen 3`, kẻ địch bị vô hiệu | Bắt đầu 3 lượt người chơi | Bộ đếm F04: 1, 2, 3 → thăng cấp ở đầu lượt thứ ba |
| T50 | F04 đã thăng cấp | Bách Thảo Hương → M05 | Cả 3 Hero còn sống đều nhận `regen 3` |
| T51 | Khôi Lỗi HP 5 | Ám Tiễn (M06) | Khôi Lỗi ngã; bộ đếm M06 = 1, M06 thăng cấp; **trong lượt này** Ảnh Bộ vẫn giá 1 |
| T52 | M06 đã thăng cấp từ lượt trước | Đầu lượt: Ảnh Bộ, rồi Ám Tiễn | Ảnh Bộ giá **0**, Ám Tiễn giá 1 |
| T53 | Khôi Lỗi HP 5 | Liệt Hỏa Xung Phong (M05) kết liễu | Bộ đếm M06 **không** tăng |
| T54 | Hero đã thăng cấp | Đạt ngưỡng lần nữa | Không phát `heroLeveledUp` lần hai |

## F. Ngã, thắng, thua

| Mã | Thiết lập | Hành động | Kết quả mong đợi |
|---|---|---|---|
| T55 | M06 HP 5, ý định Trọng Kích nhắm M06 | `endTurn` | M06 ngã, mọi lá M06 là Tàn Chiêu; `isCardPlayable` = false cho lá M06 trên tay |
| T56 | Sau T55 | Thảo Dược → M06 | Bị từ chối (Hero đã ngã) |
| T57 | Chỉ còn Ảnh Hồ HP 5 | Song Nhận Loạn Vũ | `status = won`, event `combatEnded` |
| T58 | Trận đã thắng | Bất kỳ hành động nào | Bị từ chối |
| T59 | Chỉ còn F04 HP 3, bị đánh 9 | `endTurn` | `status = lost` |
| T60 | Lá test có 2 effect (damage 99 → gainArmor 5), chỉ còn 1 kẻ địch | `playCard` | Dừng ngay sau effect đầu, effect thứ hai không chạy |

---

## Giai đoạn 2

Quy ước thêm: "Boss" = `moon_ape` (HP 110, `enc_04`). F03 = Tần Sương, F02 = Diệp Linh Lung. Đội phải có Hero sở hữu lá được dùng (ví dụ `heroIds: ["m05", "f03", "f02"]`). Bối cảnh thiết kế: `09-phase2-spec.md`.

### G. Phản Đòn

| Mã | Thiết lập | Hành động | Kết quả mong đợi |
|---|---|---|---|
| T61 | F03 `reflect 2`, 0 giáp; Khôi Lỗi Trọng Kích nhắm F03 | `endTurn` | F03 mất 9; Khôi Lỗi mất 2 HP; `hpLost` cause `reflect` ngay sau `damageDealt` |
| T62 | F03 20 giáp + `reflect 2`; Khôi Lỗi Trọng Kích nhắm F03 | `endTurn` | `blocked 9`, `hpLost 0`; Khôi Lỗi vẫn mất 2 |
| T63 | Hero `reflect 2`; Ảnh Hồ Song Trảo (3 × 2) nhắm Hero đó | `endTurn` | Ảnh Hồ mất 4 (phản mỗi hit) |
| T64 | Hero có `reflect 2` khi lượt kẻ địch kết thúc | Bắt đầu lượt người chơi | `reflect` bị gỡ cùng giáp |
| T65 | Boss `reflect 3`, F03 HP 3 | Băng Phách Liên Kích → Boss | F03 ngã sau hit 1; hit 2 không xảy ra; lá vào `discardPile` |
| T66 | M06 `reflect 2`; Khôi Lỗi HP 2 đánh M06 | `endTurn` | Khôi Lỗi ngã, `killerId` = M06; bộ đếm `enemiesKilled` của M06 không đổi |

### H. Cướp buff

| Mã | Thiết lập | Hành động | Kết quả mong đợi |
|---|---|---|---|
| T67 | Khôi Lỗi `strength 2` rồi `regen 1` (thứ tự đó) | Diện Đoạt → Khôi Lỗi | Khôi Lỗi mất `strength`, còn `regen`; F02 `strength 2`; `buffsStolen = 1` |
| T68 | F02 `strength 1`; Khôi Lỗi `strength 2` | Diện Đoạt → Khôi Lỗi | F02 `strength 3` |
| T69 | F02 đã thăng cấp; Khôi Lỗi `strength 2` | Diện Đoạt → Khôi Lỗi | F02 `strength 3` (+1 từ nội tại) |
| T70 | Khôi Lỗi không có buff | Diện Đoạt → Khôi Lỗi | Không có `statusRemoved`/`statusApplied`; bộ đếm không đổi |
| T95 | Khôi Lỗi `strength 2` | Ảnh Tập → Khôi Lỗi | F02 cướp `strength 2` trước, rồi gây 6 + 2 = **8** damage (Khôi Lỗi HP 42 → 34) |

### I. Huyết Nguyệt

| Mã | Thiết lập | Hành động | Kết quả mong đợi |
|---|---|---|---|
| T71 | `moonIndex 1` | Đổi Vận Chú | `bloodMoonRounds 2`, `moonIndex 2`; event `bloodMoonChanged` cause `card` |
| T72 | `bloodMoonRounds 1`, kẻ địch bị vô hiệu | `endTurn` | Cuối vòng: 0, `bloodMoonChanged` cause `roundEnd`; đầu lượt mới không Hero nào mất HP |
| T73 | `bloodMoonRounds 2`, kẻ địch bị vô hiệu | `endTurn` | Đầu lượt mới: mỗi Hero còn sống mất 2 HP (`hpLost` cause `bloodMoon`) sau tick trạng thái; M05 `damageTaken +2` |
| T74 | `bloodMoonRounds 0`, Phệ Hồn trên tay | `playCard` | Từ chối `"requires blood moon"`; `isCardPlayable = false` |
| T75 | `bloodMoonRounds 1`, Phệ Hồn → Khôi Lỗi | `playCard` | F02 mất 3 HP; Khôi Lỗi HP 42 → 26 |
| T76 | `bloodMoonRounds 3` | Đổi Vận Chú | Vẫn 3; không có `bloodMoonChanged` |
| T77 | Chỉ còn F02 HP 2, `bloodMoonRounds 2`, kẻ địch bị vô hiệu | `endTurn` | `status = lost` |

### J. Song Hành

| Mã | Thiết lập | Hành động | Kết quả mong đợi |
|---|---|---|---|
| T78 | `createCombat` M05, F03, M06, `enc_01`, seed 42 | — | 16 lá: `c01`–`c15` + `bond01` (Băng Hỏa Tranh Phong) |
| T79 | `createCombat` M05, F04, M06 | — | 15 lá, không có lá Song Hành (T01 không đổi) |
| T80 | `createCombat` M05, F03, F04 | — | `bond01` Băng Hỏa Tranh Phong, `bond02` Tuyết Trung Tống Thán |
| T81 | F03 đã ngã, Băng Hỏa Tranh Phong trên tay | `playCard` | Từ chối (Tàn Chiêu) |
| T82 | M05 đang Đóng Băng | Băng Hỏa Tranh Phong | Từ chối |
| T83 | Khôi Lỗi không Đóng Băng; M05 và F03 đều có `empower 2` | Băng Hỏa Tranh Phong → Khôi Lỗi | 10 damage, `sourceId` M05; Khôi Lỗi bị `freeze`; F03 `freezesApplied = 1`; `empower` của M05 bị gỡ, của F03 còn |
| T84 | Khôi Lỗi đang Đóng Băng | Băng Hỏa Tranh Phong → Khôi Lỗi | 14 damage; không áp thêm `freeze`; `freezesApplied` không đổi |
| T85 | M05 đã thăng cấp | Băng Hỏa Tranh Phong → Khôi Lỗi (không Đóng Băng) | 8 damage (không +3) |
| T86 | Khôi Lỗi `strength 1` | Ảnh Đấu → Khôi Lỗi | F02 `strength 1`; M06 `stealth 1`, không bị gỡ sau lá |
| T87 | M06 đã thăng cấp, chưa đánh lá nào trong lượt | `getEffectiveCost` Ảnh Đấu | 1 (không miễn phí) |

### K. F03

| Mã | Thiết lập | Hành động | Kết quả mong đợi |
|---|---|---|---|
| T88 | F03 đã thăng cấp; Khôi Lỗi đang Đóng Băng | Băng Phách Liên Kích → Khôi Lỗi | 2 hit × 8 |
| T89 | Khôi Lỗi đang Đóng Băng | Hàn Ấn → Khôi Lỗi | Không có `statusApplied`; `freezesApplied` không đổi |
| T90 | `enc_02`, `moonPower` đủ | Hàn Ấn lên 3 Ảnh Hồ khác nhau | F03 thăng cấp sau lá thứ 3 |

### L. Kẻ địch, tag và dữ liệu

| Mã | Thiết lập | Hành động | Kết quả mong đợi |
|---|---|---|---|
| T91 | `enc_04`, `bloodMoonRounds 2`, pha kế là `full` | `endTurn` | Boss công bố `bloodMoonOverride` (không phải override `full`); `patternIndex +1` |
| T92 | `enc_04`, boss công bố override `lastQuarter` | `endTurn`, rồi Sương Trảm → Boss | Boss có `reflect 3` trong lượt người chơi; F03 mất 3 HP; đầu lượt kẻ địch kế tiếp `reflect` bị gỡ |
| T93 | Pha Hạ Huyền; rồi pha Trăng Tròn | `getEffectiveCost` | Hạ Huyền: Hổ Gầm 0, Phong Tuyết Chướng 1. Trăng Tròn: Thảo Dược 0 |
| T94 | Dữ liệu lá có cả `ownerId` và `bond`; lá thường có `actor`; `requiresBloodMoon` trên lá không `forbidden` | Nạp dữ liệu | Mỗi trường hợp báo lỗi schema |

---

## Giai đoạn 3

Quy ước thêm: test bản đồ kiểm tra **tính chất** trên seed 1–50. Test lượt chơi dùng đội M05/F04/M06, seed 42 trừ khi ghi khác; "thắng trận" trong test = cho mọi kẻ địch `burn 999` rồi `endTurn`. Bối cảnh: `10-phase3-spec.md`.

### M. Bản đồ

| Mã | Kiểm tra |
|---|---|
| T96 | Tầng 1–7 có 2–3 nút; tầng 8 có đúng 1 nút `boss` |
| T97 | Mọi nút (trừ boss) có ≥1 `next`; mọi nút từ tầng 2 có ≥1 cạnh vào; mọi nút đi tới được từ tầng 1 |
| T98 | Không cạnh cắt nhau: với hai nút cùng tầng lane a < b, lane lớn nhất trong `next` của a ≤ lane nhỏ nhất trong `next` của b |
| T99 | Loại nút đúng `floorRules`; trên tầng trộn, không nút `elite`/`rest` nào có cha cùng loại |
| T100 | Trận gán đúng tier và `minFloor`; không trùng trận của nút cha (khi còn lựa chọn khác) |
| T101 | Cùng seed → bản đồ giống hệt; 10 seed khác nhau cho ra ít nhất 2 bản đồ khác nhau |

### N. Lượt chơi

| Mã | Thiết lập | Hành động | Kết quả mong đợi |
|---|---|---|---|
| T102 | `createRun` M05/F04/M06, seed 42 | — | `map`, deck 15 lá, HP đầy, không Kỳ Vật, `position = null` |
| T103 | Lượt chơi mới | `chooseNode` một nút tầng 2; rồi một nút tầng 1 | Nút tầng 2 bị từ chối, state không đổi; nút tầng 1 hợp lệ |
| T104 | F04 HP 20/30 trong `RunState` | Vào nút trận | `combat`; F04 trong trận HP 20; deck trận = `run.deck` |
| T105 | Thắng trận, F04 đã ngã, M05 còn 25/40 | (trận kết thúc) | M05 25/40; F04 sống lại **12**/30; `reward` với 3 lá từ pool đội, không lá nào đã có trong deck |
| T106 | `reward` | `pickCard` lá đầu; lượt khác `pickCard(null)` | Deck 16 → `map`; deck 15 → `map` |
| T107 | `reward` | `pickCard` lá không nằm trong `cardChoices` | Bị từ chối |
| T108 | Thắng Tinh Anh | (trận kết thúc) | Nhận 1 Kỳ Vật chưa có (`runRelicGained`) + 3 lá |
| T109 | `rest`, M05 20/40 | `rest heal` | M05 36/40 (+16); Hero đầy máu không vượt `maxHp` |
| T110 | `rest`, deck 11 lá | `removeCard` lá có trong deck; lượt khác deck 10 lá | Deck 10 → `map`; deck 10 thì bị từ chối |
| T111 | Vào Kho Báu | `continue` | Nhận 1 Kỳ Vật khi vào; `continue` → `map` |
| T112 | Thắng boss / thua một trận | Bất kỳ hành động sau đó | `won` / `lost`, `runEnded`; mọi hành động bị từ chối |
| T113 | Hai lượt chơi cùng seed | Cùng chuỗi hành động (có trận, thưởng, Nghỉ Chân) | `RunState` và event giống hệt |
| T114 | Deck đã có 11/12 lá thưởng của đội | Thắng trận | `cardChoices` có 1 lá; pool rỗng và không có Kỳ Vật → thẳng `map` |

### O. Hook Kỳ Vật (trận với `runRelicIds`)

| Mã | Kỳ Vật | Kết quả mong đợi |
|---|---|---|
| T115 | Nguyệt Giáp Phù | Sau `createCombat`: mọi Hero 5 giáp, còn trong lượt người chơi đầu và đỡ đòn lượt địch đầu |
| T116 | Thanh Loan Vũ | Lượt 1: tay 5 lá; lượt 2: tay 6 lá; lượt 3: 5 lá |
| T117 | Tam Tuyệt Kiếm Phổ | Lá tấn công thứ 3 trong trận cho +1 Nguyệt Lực; lá kỹ năng không đếm |
| T118 | Hàn Ngọc | Đánh Nguyệt Ảnh Ấn (`control`) → M06 +3 giáp; lá Song Hành `control` → `owners[0]` nhận giáp |
| T119 | Huyết Ấn | Hero kết liễu bằng lá hồi 4; kẻ địch ngã vì Thiêu Đốt → không ai hồi |
| T120 | Tàn Hồn Đăng | Một Hero ngã → hai Hero còn lại hồi 6 |
| T121 | Bạch Lộ Hương Túi | Vào Trăng Tròn qua cuối vòng **và** qua Đổi Vận: Hero máu thấp nhất hồi 6 (×2 nhờ Trăng Tròn = 12) |
| T122 | Huyết Nguyệt Phù | Đổi Vận Chú: mọi Hero `strength 1`; gia hạn Huyết Nguyệt đang bật: không kích hoạt |
| T123 | Ảnh Nguyệt Châu | Ám Tiễn ở Trăng Non: floor(6 × 1.5 × 1.25) = 11 |
| T124 | Kỳ Vật test: `combatStart`, `front`: 5 damage `allEnemies` | Hero có `strength 3`: mỗi kẻ địch mất 5 (không cộng Sức Mạnh) |
| T125 | Kỳ Vật test: `enemyKilled`, `front`: 99 damage `allEnemies` | Chỉ một lượt `runRelicTriggered` (không đệ quy) |
| T126 | Hai Kỳ Vật cùng `combatStart` | `runRelicTriggered` theo thứ tự `runRelicIds` |
| T127 | Dữ liệu Kỳ Vật dùng `to: "chosen"` / `stealBuff` / `actor` / `heroDied` + `trigger` | Mỗi trường hợp lỗi khi nạp |

---

## Giai đoạn 4a

Bối cảnh thiết kế: `12-phase4a-spec.md`. Test luật dùng fixture cố định (`strike9Intent`, v.v.), không phụ thuộc số cân bằng. Helper `setIntent` → `setPlan(state, pos, plan)`. Các test hiện có dựa vào bỏ tay / rút 5 / Nguyệt Lực 3 / `currentIntent` được viết lại theo luật mới (giữ mã cũ nếu kịch bản còn nghĩa).

| Mã | Kịch bản |
|---|---|
| T128 | Nguyệt Lực gốc 3, 4, … 8, 8 theo vòng |
| T129 | Dự Trữ = min(3, dư); quỹ vượt trần (8 + 3 = 11); `gainMoonPower` dư cũng tối đa 3 |
| T130 | Địch Đóng Băng: bỏ cả chuỗi, Dự Trữ về 0 |
| T131 | Giữ tay qua lượt; rút bù đủ 6; chồng hết thì rút được bao nhiêu hay bấy nhiêu |
| T132 | Cuối lượt chỉ bỏ Tàn Chiêu; lá Hero bị Đóng Băng và lá cần Huyết Nguyệt ở lại |
| T133 | Chồng bài có đúng `copies` bản mỗi lá (kể cả Song Hành), `instanceId` duy nhất |
| T134 | Không xáo lại chồng bỏ; không có `deckShuffled` giữa trận |
| T135 | Cạn Bài: tay rỗng + chồng rỗng đầu lượt → thua; tay còn lá → chưa thua |
| T136 | Tán Chiêu: Hero ngã → mọi bản trong chồng (kể cả Song Hành) sang chồng bỏ; lá trên tay bị bỏ cuối lượt |
| T137 | Đổi Bài: rút thay trước rồi xáo; lá đổi không quay lại tay; mảng rỗng không tiêu RNG |
| T138 | Đổi Bài: > 2 lá, lá không trên tay, trùng, đổi lần 2 → bị từ chối; `playCard`/`endTurn` bị chặn khi `mulligan` |
| T139 | Chuỗi: ưu tiên chiêu đắt nhất khi đủ tiền và vòng trước chưa dùng; tối đa 3; mỗi chiêu 1 lần/vòng |
| T140 | Chuỗi: bốc có trọng số theo seed — cùng seed ra cùng chuỗi |
| T141 | Tụ Lực: không đủ tiền → chuỗi rỗng, quỹ vào Dự Trữ (tối đa 3) |
| T142 | Override pha trăng / Huyết Nguyệt đứng đầu chuỗi, cost 0, vẫn chọn thêm chiêu |
| T143 | Địch chết giữa chuỗi → chiêu còn lại bị hủy; Khiêu Khích / Ẩn Thân chọn lại mục tiêu từng chiêu |
| T144 | Chiêm Bài: `choosing`, `chooseCard` hợp lệ, 2 lá xuống đáy theo thứ tự; Action khác bị chặn |
| T145 | Chiêm Bài: chồng 1 lá → lấy luôn; chồng rỗng → không tác dụng |
| T146 | M06 thăng cấp: lá riêng đầu tiên −3 (tối thiểu 0), sau giảm theo pha; không áp lá Song Hành |
| T147 | Tất định: cùng seed + cùng chuỗi Action (có Đổi Bài, Chiêm Bài) → cùng state và event |
| T148 | Schema: `copies` ∈ {1,2,3}; `intents` ≥ 1, cost ≥ 0; `start ≤ cap`; `chooseCard` chỉ ở cuối lá; config hợp lệ |

---

## Giai đoạn 4b

Bối cảnh thiết kế: `13-phase4b-spec.md`. Luật từ khóa: `01`; luật hồ sơ / Tu Luyện / deck: `14`. Test luật dùng fixture cố định, không phụ thuộc số cân bằng.

| Mã | Kịch bản |
|---|---|
| T149 | Tích Tụ: `heldTurns` = 0 khi vào tay (rút, Chiêm Bài, Đổi Bài), +1 cuối lượt sau bỏ Tàn Chiêu; ngưỡng đổi hiệu ứng |
| T150 | Liên Hoàn: = 0 đầu lượt, +1 sau hook `cardPlayed`; lá đang đánh không tự đếm |
| T151 | Tỏa Nguyệt: quỹ địch giảm (không âm), bỏ chiêu cuối chuỗi tới khi vừa, override còn, Dự Trữ tính lại, `intentsCancelled` |
| T152 | Đoạt Nguyệt: người chơi nhận đúng tổng thực rút |
| T153 | Dưỡng Nguyệt: +n từ lượt sau, cộng dồn, vượt trần |
| T154 | Phẫn Huyết: gốc = floor(HP mất × ratio) lúc hit, qua Sức Mạnh / Suy Yếu / Dễ Vỡ; dùng được trong chiêu địch |
| T155 | Dư Sinh: phần dư thành giáp × hệ số giáp pha trăng |
| T156 | Tụ Dược: hồi = Hồi Phục × hệ số × hệ số hồi, gỡ Hồi Phục; không có Hồi Phục → không gì |
| T157 | Schema: ràng buộc §2.3; `keywords` trỏ id có thật |
| T158 | Data: 6 miễn phí + 6 khóa/Hero, không trùng, đúng chủ; ≥ 2 lá miễn phí cost ≤ 3; `copies` 1–3; `meta-config` hợp lệ (`masteryLevels` tăng dần, dài 6) |
| T159 | `createProfile`; `masteryLevel` tại và quanh mỗi mốc |
| T160 | `applyRunResult`: công thức XP, `levelBefore/After`, không sửa input |
| T161 | `unlockCard`: hợp lệ; 3 lỗi |
| T162 | `parseProfile`: hỏng → mới + `reset`; Hero / lá lạ bị bỏ; lượt mở quay lại; deck không hợp lệ được giữ |
| T163 | `summarizeRun` + `RunState.heroLevelUps` đếm đúng qua nhiều trận |
| T164 | `validateDeck`: từng mã lỗi |
| T165 | `starterDeck` hợp lệ cho cả 10 bộ 3 Hero với hồ sơ mới |
| T166 | `saveDeck` / `deleteDeck`: cấp id, tên, `maxDecks`, lưu nháp, `unknown deck` |
| T167 | `createRun` dùng `deckCardIds`, từ chối lá ngoài đội |
| T168 | Pool lá thưởng = 12 lá/Hero trừ deck, có lá khóa, không rỗng với Bộ cơ bản |
| T169 | Bộ đếm F02 `buffsStolen`: Đoạt Nguyệt lấy được ≥ 1 Nguyệt Lực → +1; Tỏa Nguyệt hoặc Đoạt Nguyệt lên địch 0 Nguyệt Lực → không tính |
