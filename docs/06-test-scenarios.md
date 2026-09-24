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
