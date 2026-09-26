# 04 — Thuật ngữ Việt ↔ Code

**Quy tắc:** khái niệm dùng tiếng Anh `camelCase`; tên riêng (phe, Hero) dùng ID không dấu. Chữ hiển thị tiếng Việt luôn lấy từ dữ liệu. **Không tạo tên khác cho cùng một khái niệm.**

## Chiến đấu

| Tiếng Việt | Code | Ghi chú |
|---|---|---|
| Trận đấu | `combat` | `CombatState` |
| Vòng | `round` | 1 lượt người chơi + 1 lượt kẻ địch |
| Lượt | `turn` | `playerTurn`, `enemyTurn` |
| Hero | `hero` | |
| Kẻ địch | `enemy` | |
| Đơn vị | `unit` | Hero hoặc kẻ địch |
| Ngã | `died`, `alive: false` | |
| Kết liễu | `kill` | Gây đòn làm địch ngã |
| Lá bài (định nghĩa) | `cardDef` / `CardDef` | Trong `cards.json` |
| Lá bài (trong trận) | `cardInstance` | Có `instanceId` |
| Chủ của lá | `owner`, `ownerId`, `ownerIds` | Lá Song Hành có 2 chủ (`bond.owners`) |
| Đơn vị hành động | `actor` | Đơn vị thực hiện một effect; lá Song Hành chọn bằng `actor: 0 \| 1` |
| Lá tấn công | `type: "attack"` | |
| Lá kỹ năng | `type: "skill"` | |
| Tàn Chiêu | `brokenCard`, `isBroken` | Lá của Hero đã ngã |
| Tán Chiêu | `cardsPurged` | Mọi bản lá của Hero ngã bị loại khỏi chồng bài |
| Chồng rút | `drawPile` | |
| Bài trên tay | `hand` | |
| Chồng bỏ | `discardPile` | |
| Rút bài | `draw` | |
| Xáo bài | `shuffle` | |
| Đổi Bài | `mulligan` | Đổi tối đa 2 lá ở tay đầu trận |
| Chiêm Bài | `chooseCard` | Xem N lá trên cùng chồng bài, lấy 1, các lá còn lại xuống đáy |
| Cạn Bài | `deckedOut` | Chồng bài và tay đều rỗng đầu lượt → thua |
| Hiệu ứng | `effect` | |
| Điều kiện | `condition` | |
| Mục tiêu | `target` | |
| Nguyệt Lực | `moonPower` | Tài nguyên đánh bài |
| Nguyệt Lực Dự Trữ | `moonReserve` | Nguyệt Lực chưa dùng mang sang lượt sau, tối đa 3 |
| Chi phí | `cost` | |
| Ý định | `intent` | |
| Chuỗi ý định | `intents`, `plannedIntents` | GĐ 4a: thay `intentPattern`; `intents` là bộ chiêu có `cost`, `plannedIntents` là chuỗi đã lên |
| Tụ Lực | chuỗi ý định rỗng | Kẻ địch không đủ Nguyệt Lực cho chiêu nào, bỏ lượt |
| Cách chọn mục tiêu | `targeting` | |
| Sự kiện | `event` / `CombatEvent` | Cho animation |
| Hành động | `action` / `Action` | Người chơi gửi |
| Thắng / Thua | `won` / `lost` | |
| Lượt chơi roguelike | `run` | |
| Bản đồ | `map`, `RunMap` | Lượt chơi roguelike |
| Nút | `node`, `MapNode` | |
| Tầng | `floor` | |
| Trận thường / Tinh Anh / Boss (tier) | `normal` / `elite` / `boss` | `EncounterDef.tier` |
| Nghỉ Chân | `rest` | Loại nút |
| Kho Báu | `treasure` | Loại nút |
| Lõi | `augment` | Sức mạnh vĩnh viễn trong lượt, chọn 1 trong 3 sau mỗi trận thắng (kiểu TFT); hook/modifier như Kỳ Vật, không thêm lá vào deck |
| Tích Tụ | `heldTurns` | Số lượt lá nằm trên tay; điều kiện `heldTurnsAtLeast` |
| Liên Hoàn | `cardsPlayedThisTurn` | Số lá đã đánh trong lượt; điều kiện `cardsPlayedThisTurnAtLeast` |
| Tỏa Nguyệt | `drainMoonPower` | Rút Nguyệt Lực địch, hủy chiêu cuối chuỗi (`intentsCancelled`) |
| Đoạt Nguyệt | `drainMoonPower` + `steal` | Như Tỏa Nguyệt, người chơi nhận đúng số Nguyệt Lực đã rút |
| Dưỡng Nguyệt | `gainMoonPowerPerTurn` | `moonPowerBonus` cộng vào quỹ mỗi đầu lượt, không trần |
| Phẫn Huyết | `missingHpDamage` | Damage gốc theo HP đã mất của đơn vị hành động |
| Dư Sinh | `heal.overflow` | Phần hồi vượt HP tối đa thành giáp |
| Tụ Dược | `burstRegen` | Kích nổ Hồi Phục: hồi ngay rồi gỡ Hồi Phục |
| Hook (Kỳ Vật) | `hook`, `HookTrigger` | Thời điểm Kỳ Vật kích hoạt |

## Chỉ số và trạng thái

| Tiếng Việt | Code |
|---|---|
| HP / máu | `hp`, `maxHp` |
| Giáp | `armor` |
| Hồi máu | `heal` |
| Mất HP | `loseHp` |
| Trạng thái | `status` |
| Ẩn Thân | `stealth` |
| Khiêu Khích | `taunt` |
| Suy Yếu | `weak` |
| Dễ Vỡ | `vulnerable` |
| Đánh Dấu | `mark` |
| Thiêu Đốt | `burn` |
| Hồi Phục (theo lượt) | `regen` |
| Sức Mạnh | `strength` |
| Tích Lực | `empower` |
| Đóng Băng | `freeze` |
| Phản Đòn | `reflect` |
| Giải Trừ | `cleanse` |
| Cướp buff | `stealBuff` |
| Buff / Debuff | `buff` / `debuff` |

## Nguyệt Luân

| Tiếng Việt | Code |
|---|---|
| Nguyệt Luân | `moon`, `moonIndex` |
| Pha trăng | `moonPhase` |
| Trăng Non | `new` |
| Lưỡi Liềm Đầu | `waxingCrescent` |
| Bán Nguyệt | `firstQuarter` |
| Trăng Khuyết Đầu | `waxingGibbous` |
| Trăng Tròn | `full` |
| Trăng Khuyết Cuối | `waningGibbous` |
| Hạ Huyền | `lastQuarter` |
| Lưỡi Liềm Cuối | `waningCrescent` |
| Huyết Nguyệt | `bloodMoon`, `bloodMoonRounds`, `bloodMoonChanged` |
| Lá cần Huyết Nguyệt | `requiresBloodMoon` |
| Ý định Huyết Nguyệt | `bloodMoonOverride` |
| Đổi Vận | `shiftMoon` |
| Hiệu ứng của pha | `moonModifier` |

## Hero và phát triển

| Tiếng Việt | Code |
|---|---|
| Thăng cấp (trong trận) | `levelUp` |
| Bộ đếm thăng cấp | `levelUpCounter` |
| Ngưỡng | `threshold` |
| Nội tại | `passive` |
| Song Hành | `bond`, `bondCard` |
| Phe / Viện | `faction` |
| Thanh Loan | `thanhLoan` |
| Huyền Vũ | `huyenVu` |
| Bạch Lộ | `bachLo` |
| Xích Diên | `xichDien` |
| Trung lập | `neutral` |
| Mưu Lược (từ khóa Thanh Loan) | tag `scheme` |
| Hộ Thể (từ khóa Huyền Vũ) | tag `ward` |
| Điều Hòa (từ khóa Bạch Lộ) | tag `harmony` |
| Cấm Thuật (từ khóa Xích Diên) | tag `forbidden` |
| Nhóm vai trò | `archetype`: `vanguard`, `striker`, `controller`, `support`, `specialist` |
| Độ hiếm | `rarity`: `common`, `rare`, `epic`, `legendary` |
| Kỳ Vật | `runRelic` |

## Hồ sơ, Tu Luyện và deck

|| Tiếng Việt | Code | Ghi chú |
||---|---|---|
|| Hồ sơ | `profile`, `Profile` | GĐ 4b: `localStorage`; từ GĐ 4c: lưu trên server (`version: 2`) |
|| Tu Luyện | `mastery` | XP từ lượt chơi; `masteryLevel`, `masteryLevels` trong `meta-config.json` |
|| Lá khóa | `lockedCardIds` | 6 lá/Hero mở bằng Tu Luyện; pool = `cardIds` + `lockedCardIds` (12 lá) |
|| Nhánh | `branches`, `HeroBranch` | Mỗi Hero 2 nhánh × 6 lá |
|| Deck (đã lưu) | `SavedDeck` | Deck đặt tên 18 lá (`deckSize`) |
|| Bộ cơ bản | `starterDeck` | Deck 18 lá miễn phí của đội, không lưu trong hồ sơ |
|| Hero khởi đầu | `starterHeroIds` | Hero tài khoản mới sở hữu (`economy-config.json`) |
|| Tài khoản | `account` | Tên đăng nhập + mật khẩu; mỗi tài khoản một hồ sơ |
|| Phiên | `session` | Token đăng nhập, hạn 30 ngày kể từ lần dùng cuối |
|| Phiếu lượt chơi | `runTicket`, `runId` | Server cấp seed + ảnh chụp `RunSetup` cho một lượt chơi |
|| Chạy lại | `replay`, `replayRun` | Server chạy lại chuỗi `RunAction` để xác nhận kết quả trước khi thưởng |
|| Phiên bản dữ liệu | `dataVersion` | Băm của `GameData`; client và server phải khớp |

## Kinh tế và gacha [GĐ4d]

|| Tiếng Việt | Code | Ghi chú |
||---|---|---|
|| Nguyệt Ngọc | `moonJade` | Tiền quay gacha; kiếm từ lượt chơi, nhiệm vụ, thành tựu, quà |
|| Nguyệt Tinh | `moonStar` | Từ bản trùng khi Tinh Hồn đã 6; tiêu ở cửa hàng Nguyệt Tinh |
|| Quà tài khoản mới | `starterGift` | Nhận một lần |
|| Kỳ ngày / kỳ tuần | `dayKey`, `weekKey` | Đổi lúc 04:00 giờ Việt Nam (tuần: sáng thứ Hai) |
|| Nhiệm vụ | `mission`, `MissionDef` | Ngày / tuần; nhận thưởng bằng tay |
|| Thành tựu | `achievement`, `AchievementDef` | Một lần, tự nhận |
|| Banner gacha | `banner`, `BannerDef` | GĐ 4d: Triệu Hồi Anh Hùng |
|| Lượt quay | `pull` | 1 hoặc 10 lượt mỗi giao dịch |
|| Bảo hiểm (pity) | `pity` | `sinceEpic`, `sinceLegendary` theo banner |
|| Bảo vệ người mới | `newPlayerEpicHero` | Epic trên banner Hero ưu tiên Hero chưa sở hữu |
|| Tinh Hồn | `constellation` | 0–6, tăng khi quay trùng Hero |
|| Lá chủ lực / lá "+" | `signature`, `plusCardId`, `plusOf` | Tinh Hồn 4 |
|| Dạng thăng cấp thứ hai | `altLevelUp`, `levelUpForm` | Tinh Hồn 5 (luật trận GĐ 4e) |
|| Cửa hàng Nguyệt Tinh | `moonStarShop` | Giới hạn mua theo tuần |
|| Loadout | `Loadout`, `buildLoadout` | Tinh Hồn (4d), trang bị (4e) của đội mang vào lượt chơi |

## Trang bị [GĐ4e]

| Tiếng Việt | Code | Ghi chú |
|---|---|---|
| Binh Khí (vũ khí) | `weapon`, `WeaponDef` | Mỗi Hero mang tối đa 1; góp 1 lá Binh Khí |
| Lá Binh Khí | weapon card (`wpn_<heroId>_<n>`) | Lá riêng của người mang; chiếm 1 ô trong 18 |
| Người mang | `wearer` | Hero đang mang vũ khí |
| Vũ khí bản mệnh | `signatureHeroId`, `signatureHooks` | Nội tại mạnh hơn trên đúng Hero |
| Vũ khí chung | `archetype` | Không có bản mệnh |
| Nội tại vũ khí | `WeaponHook` | Chạy trên máy hook Kỳ Vật |
| Nguyệt Bảo | `relic`, `RelicDef` | Tối đa 2 mỗi deck; nằm cả đời tài khoản (khác Kỳ Vật của lượt chơi) |
| Tinh Luyện | `refinement` | R1–R5, tăng khi quay trùng vũ khí |
| Cộng Minh | `resonance` | 1–5, tăng khi quay trùng Nguyệt Bảo |
| Huyền Thiết | `darkIron` | Từ vũ khí trùng khi R5; GĐ 4 chỉ tích trữ |
| Nguyệt Trần | `moonDust` | Từ Nguyệt Bảo trùng khi Cộng Minh 5; GĐ 4 chỉ tích trữ |
| Binh Khí Các / Nguyệt Bảo Các | `banner_weapons`, `banner_relics` | Banner trang bị |

## Hệ thống sau này (chưa code)

| Tiếng Việt | Code |
|---|---|
| Vinh Dự | `honor` |
| Đấu Trường Công Bằng | `fairArena` |
| Hợp Kích | `coopCombo` |
