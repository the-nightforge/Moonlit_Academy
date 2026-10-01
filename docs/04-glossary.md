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
| Chọn Pha | `chooseMoon` | GĐ7: lựa chọn đầu lượt giữ / +1 / +2 pha trăng (nội tại M08, `01` §5.5) |
| Lá Tạo Ra | `token`, `createCard` | GĐ7: lá sinh trong trận (`CardDef.token`), không nằm trong pool/deck/thưởng |
| Người hộ vệ | `guardian`, `guardianOf` | GĐ7: Hero chịu đòn thay đồng đội có `guard` |
| Linh Thú | `summon`, `SummonState`, `SummonDef` | GĐ7b: đơn vị thật do Hero triệu hồi, tự hành động cuối lượt người chơi (`01` §17) |
| Triệu hồi | `summon`, `summoned` | GĐ7b: effect tạo Linh Thú hoặc hồi đầy + Sức Mạnh nếu đã có |
| Thức tỉnh | `awakenSummons`, `awakenedId` | GĐ7b: Linh Thú đổi sang bản mạnh hơn khi Hero chủ thăng cấp |
| Mê Hoặc | `charm` | GĐ7b: trạng thái khiến kẻ địch đánh kẻ địch khác, hoặc Hero đánh đồng đội (PvP) (`01` §9.3.1, §15.5) |
| Phong Ấn | `sealIntent` | GĐ7b: đặt dấu lên đơn vị địch một lượt — chiêu/lá/hành động nó đánh ra trong lượt sau chỉ còn damage, mất hiệu ứng khác; cùng cơ chế ở PvE và PvP (`01` §5.6) |
| Hồi Hồn | `revive` | GĐ7b: dựng Hero đã ngã sống lại với tỉ lệ HP (`01` §5.6) |
| Xuyên (mục tiêu) | `pierceOwnAttacks` | GĐ7b: đòn đơn mục tiêu đánh thêm kẻ địch đứng ngay sau mục tiêu (`01` §5.6) |
| Hàng sau | `isBackRow` | GĐ7b: kẻ địch còn sống không ở vị trí nhỏ nhất trong các kẻ địch còn sống (`01` §5.6) |
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
| Hộ Vệ | `guard` |
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
| Ưu Đãi Pha [Nguyệt Luân mới] | `tagBonus`, `tagBonusText` (trên `MoonPhaseDef`) |
| Nguyệt Lệnh | `decree`, `MoonDecreeDef`; lệnh đã bốc của mỗi pha: `moonDecrees` (trên `CombatState`) |
| Nguyệt tính (chiêu trăng công khai của kẻ địch) | `moonOverrides` (trên `EnemyDef`) |
| Hiệu ứng của pha | `MoonModifier`; tra cứu: `phaseModifiers` (ưu đãi + lệnh), `decreeModifier` (một loại của lệnh hiện tại), `currentDecree` |
| Bốc pha khởi đầu và lệnh | `rollMoon`; hook vào pha: `enterPhase` |
| Modifier chỉ dành cho lệnh | `DECREE_ONLY_MODIFIERS` |
| Hủy Bài | action `discardCard` (khi lệnh Xả Thân có hiệu lực) |
| Huyết Tế | action `bloodPact` (khi lệnh Huyết Tế có hiệu lực) |

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
| Tinh Luyện | `refinement` | R1–R5, tăng khi quay trùng vũ khí hoặc Nâng Cấp |
| Cộng Minh | `resonance` | 1–5, tăng khi quay trùng Nguyệt Bảo hoặc Nâng Cấp |
| Nâng Cấp | `upgrade`, `upgradeItem`, `upgradeCost` | GĐ7d: tiêu vật liệu đổi +1 cấp trang bị (`14` §13.3) |
| Huyền Thiết | `darkIron` | Từ vũ khí trùng khi R5 và thưởng Lượt chơi (GĐ7d); tiêu ở Nâng Cấp vũ khí |
| Nguyệt Trần | `moonDust` | Từ Nguyệt Bảo trùng khi Cộng Minh 5; tiêu ở Nâng Cấp Nguyệt Bảo (GĐ7d) |
| Binh Khí Các / Nguyệt Bảo Các | `banner_weapons`, `banner_relics` | Banner trang bị |

## Đấu Trường — PvP [GĐ5]

| Tiếng Việt | Code | Ghi chú |
|---|---|---|
| Đấu Trường Công Bằng | `fairArena` | Chế độ 1v1 cân bằng: trang bị chuẩn hóa, Tinh Hồn về cấp lẻ (`01` §15) |
| Hero thử | `trialHeroIds` | Hero chơi được trong PvP khi chưa sở hữu; chỉ 6 lá khởi đầu |
| Trang bị PvP cơ bản | `freeWeaponIds`, `freeRelicIds` | Vũ khí / Nguyệt Bảo miễn phí trong PvP, cố định cấp 1 |
| Người đi trước / đi sau | `firstPlayer` / seat kia | Bốc bằng RNG lúc tạo trận |
| Bù người đi sau | `secondPlayerBonus` | Cộng Nguyệt Lực lượt đầu của người đi sau |
| Góc nhìn người chơi | `viewFor(state, player)` | State đã che bài đối thủ (`01` §15.7) |
| Che event | `redactEvents(events, player)` | Ẩn event lộ lá của đối thủ |
| Đấu Tập | `practiceMode` | Trận PvP không tính điểm, không lên hạng |
| Phòng riêng | `privateRoom` | Phòng mời bạn bè bằng mã |
| Bảng chỉ số PvP | `pvpStats` | Điểm xếp hạng Elo, Vinh Dự, thắng/thua theo mùa |
| Điểm Đấu Trường | `arena.rating` | Điểm Elo của hồ sơ (`14` §14.2), khởi đầu 1000 |
| Bậc | `tier` | Tên hiển thị theo Điểm (`pvp-config.tiers`): Đồng Sinh → Trạng Nguyên |
| Vinh Dự | `honor` | Tiền tệ PvP (`currencies.honor`), trần 120/kỳ ngày |
| Cửa hàng Vinh Dự | `honorShop` | Mặt hàng mua bằng Vinh Dự (`14` §14.4) |
| Hàng chờ xếp hạng | `queue` | Ghép trận ranked theo chênh Điểm (`16` §8.8) |
| Trận xếp hạng | `ranked` | Trận tính Elo và Vinh Dự |

## Liên Thủ — co-op [GĐ6]

| Tiếng Việt | Code | Ghi chú |
|---|---|---|
| Liên Thủ | `coop` | Chế độ 2 người đánh chung boss (`01` §16) |
| Lượt đồng đội | `simultaneous turn` | Cả hai người cùng đánh trong một lượt, áp theo thứ tự nhận |
| Xong | `done` | Người chơi bấm Xong = `endTurn` của riêng mình trong lượt đồng đội |
| Hợp Kích | `coopCombo` | Đòn phối hợp: lá người A + lá người B trong cùng lượt (`01` §16.4) |
| Boss Nguyệt Thực | `eclipse_lord` | Boss co-op *Nguyệt Thực Ma Quân*, 4 giai đoạn (`01` §16.5) |
| Giai đoạn boss | `boss.phase` | 1 Trăng Khuyết · 2 Huyết Nguyệt · 3 Nguyệt Ấn · 4 Nguyệt Thực |
| Đếm ngược hồi sinh | `reviveCountdown` | Giai đoạn 4: về 0 khi boss còn sống → hồi 50% HP một lần |

## Cốt Truyện [GĐ7c]

| Tiếng Việt | Code | Ghi chú |
|---|---|---|
| Cốt Truyện | `story` | Chế độ màn tuyến tính theo arc (`18` §4); tiến độ `profile.story.cleared` |
| Arc | `arc`, `StoryArcDef` | Chương Cốt Truyện gồm các màn theo thứ tự; `arcs[0]` của `story.json` là Arc 1 |
| Màn | `stage`, `StoryStageDef` | Một trận trong arc; `encounterId` trỏ encounter `tier: "story"`; màn *n* mở khi *n−1* đã qua (`14` §16) |
| Thưởng Lần Đầu | `firstClear` | Thưởng của màn chỉ trao ở lần qua đầu tiên; thắng lại / thua không thưởng |
| Phiếu Cốt Truyện | `story_tickets`, `ticketId` | Phiếu server cấp cho một màn, chạy lại bằng `replayStoryCombat` để xác nhận (`16` §9) |
| Lời thoại | `DialogueLine`, `before` / `after` | `{ speaker, text }`; `speaker` là id Hero, id kẻ địch hoặc `narrator` |

## Hero GĐ7a

| ID | Tên | Nội tại thăng cấp | Dạng thứ hai |
|---|---|---|---|
| `m01` | Tạ Vân Chiêu | Thiên Cơ — `cheapestCardDiscount` | Định Cục — `chooseCardExtraLook` |
| `m02` | Lục Hàn Phong | Thiết Bích — `armorPerTurn` | Trung Can — `interceptArmor` |
| `m03` | Mặc Tử Du | Vạn Kim — `freeChooseCardPerTurn` | Phú Giáp — `onLevelUp` (Dưỡng Nguyệt 1), nội tại `none` |
| `m04` | Bùi Thanh Minh | Thần Y — `healCleanses` (dùng lại GĐ4e) | Tâm Nhãn — `healBonusOwnCards` |
| `m07` | Ninh An | Huyết Mạch — `randomBuffPerTurn` | Huyết Nguyệt Chi Tử — `bloodMoonImmune` |
| `m08` | Khương Tịch | Quan Tinh — `chooseMoon` (Chọn Pha) | Tinh Mệnh — `moonShiftWeakensEnemies` |
| `m10` | Chu Quyết | Bác Học — `firstSchemeRepeats` | Trạng Nguyên — `comboAttackBonus` |
| `f01` | Thẩm Nguyệt Hoa | Nguyệt Chủ — nội tại `none`, `onLevelUp` (`createCard` Nguyệt Hoa Chiếu Thế) | Tự Do — `tagDiscountOwnCards` |
| `f08` | Phượng Chiêu Dung | Huyết Phượng — `forbiddenNoSelfHpLoss` | Phản Sư — `bloodMoonAttackBonus` |

## Hero GĐ7b

| ID | Tên | Nội tại thăng cấp | Dạng thứ hai |
|---|---|---|---|
| `f05` | Hạ Chi | Xuyên Vân Tiễn — `pierceOwnAttacks` | Biên Tái — `firstHitMarks` |
| `f06` | Lam Khê | Kinh Hồng Vũ — `charmMastery` | Vũ Y — `stealthOnCharm` |
| `f07` | Cố Uyển | Sử Bút — `sealExtraFirstPerTurn` | Chép Sử — `sealWeakens` |
| `f09` | Tiểu Mãn | Thỏ Ngọc Thức Tỉnh — `awakenSummons` | Nguyệt Cung — `summonTaunts` |
| `f10` | Liễu Tịnh Nhan | Nguyệt Hồn — `onLevelUp` (`revive` tới `lastFallen`), nội tại `none` | Vong Xuyên — `armorOnAllyFall` |
| `m09` | Đoàn Lạc | Vong Quốc Khúc — `debuffDurationBonus` | Nam Chiếu Hồn — `bonusVsDebuffed` |

## Hệ thống sau này (chưa code)

| Tiếng Việt | Code |
|---|---|
