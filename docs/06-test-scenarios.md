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
