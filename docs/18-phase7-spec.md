# 18 — Đặc tả Giai đoạn 7 (Nội dung: đủ 20 Hero, Cốt truyện Arc 1–2, trang bị)

Đặc tả cho giai đoạn 7 của lộ trình GDD (`00` §12): **"Nội dung — đủ game"**. Đưa số Hero
từ 5 lên **20**, thêm chế độ **Cốt truyện** (Arc 1 *Vọng Nguyệt*, Arc 2 *Bóng Tối*), thêm
**vũ khí bản mệnh** cho 15 Hero mới, thêm **Nguyệt Bảo**, và cho **Huyền Thiết / Nguyệt
Trần** một chỗ tiêu. Chia thành các phần, mỗi phần có bản chơi được trước khi sang phần
sau:

| Phần | Nội dung | Kết quả chơi được |
|---|---|---|
| **7a** | 9 Hero đợt 1 (M01, M02, M03, M04, M07, M08, M10, F01, F08), 4 lá Song Hành; cơ chế nhỏ: Hộ Vệ (`guard`), Chọn Pha, lá tạo ra trong trận | Xếp deck và chơi Trận lẻ / Lượt chơi / PvP / co-op với 14 Hero |
| **7b** | 6 Hero đợt 2 (F05, F06, F07, F09, F10, M09), 2 lá Song Hành; cơ chế mới: **Linh Thú** (đơn vị thật), Mê Hoặc, Phong Ấn, Hồi Hồn, xuyên mục tiêu | Đủ 20 Hero ở mọi chế độ |
| **7c** | Cốt truyện Arc 1–2: ~8 màn mỗi arc, kẻ địch mới, 2 boss arc, phiếu + chạy lại trên server, thưởng lần đầu, arc tặng Hero | Chơi trọn 2 arc trên client, qua server |
| **7d** | 15 vũ khí bản mệnh + 8 Nguyệt Bảo; nâng Tinh Luyện / Cộng Minh bằng vật liệu; nguồn Huyền Thiết mới; mô phỏng kinh tế | Trang bị đủ 20 Hero; vật liệu có chỗ tiêu |

Thứ tự: **7a → 7b → 7c → 7d**. Cốt truyện làm sau khi đủ 20 Hero để dàn cảnh tự do; trang
bị dồn vào 7d để cân bằng một lần trên toàn bộ Hero.

Thiết kế được chốt với người dùng (2026-09-28): một spec khung cho cả GĐ 7; Cốt truyện là
**chuỗi màn tuyến tính**, người chơi **tự chọn đội**; 15 Hero vào **banner Hero chung**,
**mỗi arc tặng 1 Hero**, không có banner rate-up; **Linh Thú là đơn vị thật**; các cơ chế
khác làm gọn trong khung sẵn có; spec chứa **bản tóm tắt thiết kế** từng Hero và **dàn ý**
Arc 1–2, còn danh sách lá / lời thoại / số trang bị viết ở bước dữ liệu của từng phần và
được duyệt theo đợt; vật liệu đổi lấy **+1 Tinh Luyện / Cộng Minh**.

Khi đưa vào tài liệu luật (bước 7a.1 / 7b.1 / 7c.1 / 7d.1): luật trận vào `01` (mục mới
§17 Linh Thú; các trạng thái / effect mới vào §5, §6, §9); schema vào `02`; nội dung (kẻ
địch, boss, màn) vào `03`; thuật ngữ vào `04`; test vào `06`; bước vào `07`; hồ sơ, Cốt
truyện, nâng cấp vật liệu vào `14`; route vào `16`. Khi có khác biệt, tài liệu luật là
chuẩn; tài liệu này giữ bối cảnh và lý do.

**Điều kiện trước:** GĐ 6 (`17`) đã vào `main`. 5e.2 (triển khai Internet thật) độc lập,
làm song song khi người dùng sẵn sàng.

**Trạng thái:** 7c xong — Cốt truyện Arc 1–2; tiếp theo 7d (§5).

**Thư viện mới:** không có.

---

## 0. Phạm vi

**Có:**
- 7a: 9 Hero theo khuôn §1.1; trạng thái `guard`; lựa chọn `chooseMoon` (Chọn Pha);
  effect `createCard`; 9 bộ đếm thăng cấp và các nội tại mới; 4 lá Song Hành; client
  (khung Chọn Pha, nhãn Hộ Vệ, lá tạo ra); mô phỏng + chỉnh số.
- 7b: 6 Hero; `summons.json`, `CombatState.summons`, effect `summon`, hành động Linh Thú,
  mục tiêu, PvP / co-op / `viewFor`; trạng thái `charm`; effect `sealIntent`, `revive`;
  nội tại xuyên mục tiêu; 2 lá Song Hành; client (ô Linh Thú); mô phỏng + chỉnh số.
- 7c: `story.json`; `createStoryCombat`, `replayStoryCombat`, `applyStoryResult`; hồ sơ
  thêm `story`; bảng `story_tickets` + route; client (màn Cốt truyện, màn hội thoại);
  nội dung Arc 1–2 (~6 kẻ địch thường + 2 boss arc, 16 màn, lời thoại).
- 7d: `upgradeItem` + `upgradeCost`; nguồn Huyền Thiết từ Lượt chơi và Cốt truyện; route
  nâng cấp; 15 vũ khí bản mệnh, 8 Nguyệt Bảo, banner; client (nút Nâng Cấp); mô phỏng
  trang bị + kinh tế.

**Không có (để sau):** Arc 3–6; sự kiện giới hạn thời gian; banner rate-up; mùa giải PvP;
skin / khung card; lồng tiếng / nhạc theo màn; phân giải trang bị; lựa chọn phân nhánh
trong truyện; luật màn dạng hook riêng (chỉ có pha trăng / Huyết Nguyệt đầu trận, §4.1);
kẻ địch triệu hồi; nhiều Linh Thú cho một Hero; tiến trình đặc biệt của F09 (Common → Epic
qua nhiệm vụ cốt truyện, GDD §4); nội tại "xem trước 2 ý định" của F07 (thay thế, §3.3);
Cốt truyện ở chế độ mất kết nối; Hero thứ 21 trở đi.

---

## 1. Nguyên tắc chung

### 1.1 Khuôn Hero (bắt buộc cho cả 15 Hero mới)

Mỗi Hero trong `heroes.json` có đủ trường như M05:

- `cardIds` 6 lá mở sẵn + `lockedCardIds` 6 lá khóa (mở bằng Tu Luyện / Tinh Hồn 1, 3).
- `branches`: 2 nhánh × 6 lá, lá mở khóa là **sidegrade** (GDD §7.1).
- `signature` { `cardId`, `plusCardId` } — lá chủ đạo và bản "+" (Tinh Hồn 4).
- `levelUp` { `name`, `description`, `counter`, `threshold`, `constellationThreshold`,
  `passive` } và `altLevelUp` (Tinh Hồn 5).
- `copies` mỗi lá theo quy tắc 4a (cost 0–1 → 3, 2–4 → 2, 5+ → 1).
- `pvp-config.heroStats[id].maxHp`.
- Có mặt trong `banner_heroes` theo độ hiếm GDD §4.
- `art.portrait` / `art.levelUp` được để trống; client dùng khung tạm.

Lá Song Hành theo GDD §3.5, **chỉ thêm khi đã có đủ cả hai Hero**.

### 1.2 Bất biến

- Mỗi cơ chế mới là một `Effect`, `StatusId`, `LevelUpCounter` hoặc `LevelUpPassive` trong
  schema, được xử lý trong `rules`, và có test (CLAUDE.md quy tắc 5, 7).
- **T213 (ghi vàng PvE) xanh sau mỗi bước.** Thêm nội dung không được đổi kết quả của trận
  / lượt chơi cũ. Bước nào **cố ý** đổi kết quả (ví dụ thêm Hero vào banner đổi kết quả
  quay) phải nêu rõ và ghi vàng lại **sau khi người dùng duyệt**.
- Mọi yếu tố ngẫu nhiên mới (buff ngẫu nhiên của M07, xáo lá khi Hồi Hồn, mục tiêu
  `random` của Linh Thú) dùng RNG trong `CombatState`.
- Server là trọng tài của hồ sơ: thưởng Cốt truyện chỉ trao sau khi `replayStoryCombat`
  xác nhận (CLAUDE.md quy tắc 9).

### 1.3 Mục tiêu cân bằng mỗi đợt Hero

- `run-playtest`: tỉ lệ thắng lượt của đội có Hero mới không lệch quá **±10 điểm** so với
  trung bình các đội hiện có (cùng loại deck, seed 1–20).
- Bot PvP đấu bot: tỉ lệ thắng của mỗi Hero trong **40–60%**; độ dài trận 8–12 vòng.
- Bot (`bot.ts`, `pvpBot`, `coopBot`) được dạy heuristic đơn giản cho từng cơ chế mới
  (Chọn Pha, Phong Ấn, Mê Hoặc, Hộ Vệ, Hồi Hồn, triệu hồi) trước khi đo, để số đo không
  sai vì bot chơi kém.

---

## 2. Phần 7a — 9 Hero đợt 1

### 2.1 Bản tóm tắt Hero

Mọi con số là khởi điểm, chốt ở 7a.6. Thăng cấp ghi *bộ đếm → ngưỡng → nội tại*.

| Hero | Hiếm · Phe · Vai trò · HP | Nhánh A · Nhánh B | Thăng cấp | Dạng thứ hai |
|---|---|---|---|---|
| **M01** Tạ Vân Chiêu | Legendary · Thanh Loan · Support · 30 | *Thiên Cơ* (Mưu Lược, Chiêm Bài, giảm giá) · *Quyền Mưu* (Tỏa / Đoạt Nguyệt) | `schemeCardsPlayed` (lá `scheme` của **cả đội**) → 7 → **Thiên Cơ**: đầu lượt, lá rẻ nhất trên tay −2 Nguyệt Lực trong lượt đó | **Định Cục**: Chiêm Bài của người chơi xem thêm 1 lá |
| **M02** Lục Hàn Phong | Epic · Huyền Vũ · Vanguard · 42 | *Hộ Vệ* (`guard`, giáp) · *Phản Kích* (Phản Đòn, Khiêu Khích) | `hitsIntercepted` (đòn đỡ thay qua `guard`) → 3 → **Thiết Bích**: đầu lượt nhận 4 giáp | **Trung Can**: mỗi đòn đỡ thay, M02 nhận 2 giáp trước khi tính damage |
| **M03** Mặc Tử Du | Rare · Thanh Loan · Specialist · 30 | *Thương Hội* (Nguyệt Lực, Dưỡng Nguyệt) · *Tin Đồn* (Chiêm Bài, Tích Tụ) | `cardsChosen` (lá lấy qua Chiêm Bài) → 4 → **Vạn Kim**: đầu lượt (sau rút bù) Chiêm Bài 4 miễn phí | **Phú Giáp**: khi thăng cấp nhận Dưỡng Nguyệt 1 (`onLevelUp`) |
| **M04** Bùi Thanh Minh | Epic · Bạch Lộ · Support · 32 | *Châm Cứu* (giải debuff, Hồi Phục, Tụ Dược) · *Hộ Mạch* (Dư Sinh, giáp) | `hpHealed` (HP thực hồi bởi lá của M04) → 20 → **Thần Y**: mỗi lần hồi máu giải 1 debuff (dùng lại `healCleanses`) | **Tâm Nhãn**: lá hồi máu của M04 hồi thêm 2 |
| **M07** Ninh An | Rare · Bạch Lộ · Specialist · 34 | *Hồn Nhiên* (buff đồng đội) · *Thức Tỉnh* (Huyết Nguyệt) | `turnsSurvived` (+1 đầu mỗi lượt người chơi khi còn sống, từ vòng 2) → 4 → **Huyết Mạch**: đầu lượt nhận 1 buff ngẫu nhiên từ bảng trong data (RNG có seed) | **Huyết Nguyệt Chi Tử**: M07 không mất HP vì Huyết Nguyệt |
| **M08** Khương Tịch | Legendary · Xích Diên · Controller · 30 | *Đổi Vận* (`shiftMoon`) · *Huyết Thiên* (Huyết Nguyệt) | `moonShifts` (lá của M08 có `shiftMoon`) → 3 → **Quan Tinh**: đầu lượt **Chọn Pha** (§2.2) | **Tinh Mệnh**: mỗi lá Đổi Vận của M08 áp Suy Yếu 1 lên mọi kẻ địch |
| **M10** Chu Quyết | Rare · Thanh Loan · Striker · 30 | *Khổ Học* (Tích Tụ) · *Hàn Môn* (Liên Hoàn) | `studyPoints` (+1 đầu mỗi lượt người chơi khi còn sống, +1 mỗi lá `scheme` của M10) → 5 → **Bác Học**: lá `scheme` **đầu tiên** mỗi lượt của M10 giải quyết effect 2 lần | **Trạng Nguyên**: lá tấn công của M10 +1 damage mỗi hit cho mỗi lá đã đánh trước nó trong lượt |
| **F01** Thẩm Nguyệt Hoa | Legendary · Thanh Loan · Specialist · 32 | *Nguyệt Quang* (tag `moon`, Trăng Tròn) · *Thiên Mệnh* (Dưỡng Nguyệt, lá Nguyệt Lực lớn) | `fullMoonsSeen` (+1 đầu lượt người chơi khi pha là Trăng Tròn) → 1 → **Nguyệt Chủ**: khi thăng cấp nhận lá *Nguyệt Hoa Chiếu Thế* vào tay (`createCard`, §2.2) | **Tự Do**: lá tag `moon` của F01 −1 Nguyệt Lực |
| **F08** Phượng Chiêu Dung | Legendary · Xích Diên · Striker · 34 | *Huyết Phượng* (Cấm Thuật, Phẫn Huyết) · *Nghịch Mệnh* (gọi Huyết Nguyệt) | `forbiddenHpLost` (HP F08 mất bởi lá `forbidden` của mình) → 12 → **Huyết Phượng**: `loseHp` nhắm `self` trong lá `forbidden` của F08 bị bỏ qua | **Phản Sư**: khi Huyết Nguyệt, mọi hit của F08 +3 |

`constellationThreshold` (Tinh Hồn 2) mỗi Hero ≈ 70% `threshold`, làm tròn lên; riêng
ngưỡng 1 giữ nguyên 1 (như M06).

### 2.2 Cơ chế mới

**Hộ Vệ — trạng thái `guard`** (buff, có thời hạn theo vòng, `sourceId` = Hero hộ vệ).
- Lá của M02 đặt `guard` lên một đồng đội (`to: "chosen"` ally; không đặt lên chính mình).
- §9.3.1 thêm bước **1b** (sau Khiêu Khích): nếu mục tiêu còn sống có `guard` mà người hộ
  vệ còn sống → mục tiêu là người hộ vệ. `hitsIntercepted` của người hộ vệ +1 mỗi chiêu
  được chuyển.
- PvP: lá đơn mục tiêu của đối thủ nhắm vào Hero có `guard` bị chuyển sang người hộ vệ
  theo cùng luật (§15.4 thêm dòng).
- Co-op: đặt được lên Hero của đồng đội (theo `ally` §16.3).
- Một Hero chỉ có một `guard`; đặt lại thì thay `sourceId` và thời hạn.

**Chọn Pha — `pendingChoice.kind = "chooseMoon"`.**
- `PlayerState.pendingChoice` là union `PendingChoice =
  { kind: "chooseCard"; options: string[] } | { kind: "chooseMoon"; options: number[] }`
  (trước đây chỉ Chiêm Bài). Event **mới** `moonChoiceOpened { options: number[] }` —
  không dùng lại `choiceOpened`.
- Đầu lượt người chơi (sau rút bù và Chiêm Bài của Vạn Kim nếu có), nếu có Hero đã
  thăng cấp với nội tại `chooseMoon` → trạng thái `choosing`, `options = [0, 1, 2]` (giữ
  pha, tiến 1, tiến 2).
- Thứ tự đầu lượt người chơi, sau hook `playerTurnStart`: (1) Thiên Cơ gắn giảm giá,
  (2) Vạn Kim mở Chiêm Bài, (3) Chọn Pha mở **sau khi** Chiêm Bài đã được trả lời (nếu
  có). Chọn Pha chỉ được "nợ" khi Hero đã thăng cấp **lúc đầu lượt**; thăng cấp giữa
  lượt thì từ lượt sau (`PlayerState.moonChoicePending`).
- Action mới `chooseMoon { offset: 0 | 1 | 2 }` → `moonShifted { cause: "card" }` nếu
  `offset > 0`; về `playerTurn`.
- Co-op: người sở hữu M08 chọn; cả hai có M08 → người 0 chọn, người 1 không mở. PvP: mỗi
  người chọn trong lượt của mình.
- Server: thêm vào `combatActionSchema` và giao thức WebSocket; hết giờ → `offset: 0`
  (đáp án mặc định `autoChoiceAction`: lá đầu tiên của Chiêm Bài, hoặc `offset: 0` của
  Chọn Pha).

**Lá tạo ra trong trận — effect `createCard { cardId }`.**
- Chỉ có `cardId` — luôn vào tay, không có trường `to`. Tạo instance id
  `prefixedId(state, seat, "t<n>")` (`n` là bộ đếm tăng dần trong
  `PlayerState.createdCards`): PvE là `t1`, `t2`…; nhiều người chơi là `p<i>_t<n>`.
  Chủ là Hero đang giải quyết effect.
- Tay đầy (≥ `handLimit` = 8, `01` §4.2 — khác mốc rút bù `handSize`) → lá không được tạo, phát `cardCreated { cardId, instanceId: null }`.
- Lá tạo ra không thuộc deck: bị bỏ → vào chồng bỏ bình thường nhưng không bao giờ vào lại
  chồng rút; chủ ngã → Tàn Chiêu như lá thường. Không tính vào kiểm tra deck.
- Lá tạo ra có `CardDef.token: true` (không nằm trong pool, không được đặt vào deck, không
  xuất hiện ở thưởng lượt chơi).

**Bộ đếm và nội tại.** 9 `LevelUpCounter` mới (bảng §2.1). `cardsChosen` và
`schemeCardsPlayed` là bộ đếm của **cả người chơi**: mọi Hero còn sống của người đó
được nhận +1, `bumpCounter` chỉ thật sự tính cho Hero có đúng bộ đếm. Nội tại mới:
`cheapestCardDiscount`, `chooseCardExtraLook`, `armorPerTurn`, `interceptArmor`,
`freeChooseCardPerTurn { look }` (nội tại M03 Vạn Kim), `healBonusOwnCards`,
`randomBuffPerTurn` (bảng buff `combatConfig.levelUpRandomBuffs { status, amount }[]`
của Huyết Mạch M07, bốc bằng RNG của trận), `bloodMoonImmune`, `chooseMoon`,
`moonShiftWeakensEnemies`, `firstSchemeRepeats`, `comboAttackBonus`,
`tagDiscountOwnCards { tag }`, `forbiddenNoSelfHpLoss`, `bloodMoonAttackBonus`, và
`none` (F01 dạng thường, M03 dạng thứ hai). Dùng lại: `healCleanses`, `onLevelUp`
(4e) cho Phú Giáp và Nguyệt Chủ — `LevelUpDef.onLevelUp?: Effect[]` giờ có cả ở dạng
thường (F01), không chỉ `altLevelUp`. Tên cuối cùng có thể gộp khi viết `02`, nhưng mỗi
nội tại có test.

**Bác Học (M10):** lá `scheme` đầu tiên mỗi lượt của M10 giải quyết hai lần — lượt giải
quyết thứ nhất bỏ mọi effect `chooseCard`, lượt thứ hai giải quyết đầy đủ.

### 2.3 Song Hành 7a (GDD §3.5)

| Cặp | Lá |
|---|---|
| M01 + F01 | *Nguyệt Sách* |
| M02 + M01 | *Thân Vệ* (M02 đặt `guard` lên M01 và nhận giáp) |
| M03 + M10 | *Kim Bút Đồng Tâm* |
| M08 + F08 | *Sư Đồ Nghịch Mệnh* (F08 gọi Huyết Nguyệt 1 lượt, M08 `shiftMoon` 1) |

Hiệu ứng chính xác viết ở 7a.4 và được duyệt.

### 2.4 Client 7a
Khung Chọn Pha (3 pha, hiện hiệu ứng từng pha từ `moon-phases.json`); nhãn `Hộ` trên Hero
có `guard` và đường nối tới người hộ vệ; animation lá tạo ra bay vào tay; danh sách Hero
mới ở màn chọn đội, xếp deck, kho Hero, gacha.

---

## 3. Phần 7b — Linh Thú, cơ chế mới, 6 Hero đợt 2

### 3.1 Linh Thú (đơn vị thật)

**Dữ liệu `summons.json`:**
```ts
SummonDef {
  id: string; name: string; maxHp: number;
  targeting: "lowestHp" | "front" | "random";   // chọn kẻ địch cho effect `chosen`
  action: Effect[];                               // chạy mỗi cuối lượt người chơi
  awakenedId?: string;                            // bản dùng khi Hero chủ đã thăng cấp
}
```
Kiểm chéo khi nạp: `awakenedId` trỏ tới Linh Thú có sẵn; `action` chỉ dùng `to` thuộc
`chosen` (kẻ địch theo `targeting`), `self`, `allEnemies`, `allAllies`, `owner` (Hero chủ,
`TargetRef` mới chỉ hợp lệ trong `action`). `TargetRef` còn thêm `"summon"` (Linh Thú còn
sống của Hero đang giải quyết effect) — chỉ hợp lệ trên lá Hero / Song Hành, **không**
trong `SummonDef.action`; lá Song Hành *Nguyệt Thố Hộ Mệnh* (§3.4) dùng `"summon"`.

**State:** `CombatState.summons?: SummonState[]` — **optional**, chỉ được tạo ở lần triệu
hồi đầu tiên (state trận cũ không có trường này vẫn hợp lệ):
```ts
SummonState extends UnitState { side: "hero"; player: number; ownerHeroId: string; summonId: string }
```
Id `prefixedId(state, seat, "summon:<ownerDefId>")` (mỗi Hero tối đa 1 Linh Thú → id ổn
định): PvE là `summon:f09`, nhiều người chơi là `p0_summon:f09`. `heroes[]` giữ
nguyên nghĩa. Các hàm tra đơn vị (`findUnit`, mục tiêu, `allEnemies` / `allAllies`) mở
rộng thêm `summons`.

**Effect `summon { summonId }`:**
- Hero chủ chưa có Linh Thú → tạo với đủ HP. Dùng `awakenedId` (nếu có) chỉ khi nội tại
  **đang có hiệu lực** của Hero chủ là `awakenSummons` (nội tại dạng thường của F09) —
  không áp dụng cho mọi Hero đã thăng cấp nói chung, vì như vậy dạng thứ hai của F09
  (Nguyệt Cung) sẽ mạnh hơn hẳn dạng thường. Event `summoned { unitId, summonId,
  ownerHeroId }`.
- Đã có → hồi đầy HP và nhận **Sức Mạnh 1**.
- Hero chủ thăng cấp (nhận nội tại `awakenSummons`) khi Linh Thú đang sống → Linh Thú
  đổi sang `awakenedId`, giữ tỉ lệ HP (làm tròn xuống, tối thiểu 1).

**Hành động:** §3.3 (cuối lượt người chơi) thêm bước ngay trước "chuyển sang lượt kẻ
địch": từng Linh Thú còn sống (theo vị trí Hero chủ, rồi theo người chơi) chạy `action`.
Effect `chosen` chọn kẻ địch còn sống, không Ẩn Thân, theo `targeting` (hòa → vị trí nhỏ);
không có mục tiêu → bỏ qua effect đó. Linh Thú là nguồn đòn (Sức Mạnh, Suy Yếu, Đánh Dấu
áp đầy đủ theo §10.1). Kiểm tra thắng/thua sau mỗi effect. Event `summonActed`.
Co-op: sau khi cả hai người Xong, Linh Thú người 0 rồi người 1. PvP: cuối lượt của người
sở hữu.

**Bị nhắm:**
- Chiêu đơn mục tiêu của kẻ địch chỉ nhắm Linh Thú khi Linh Thú **Khiêu Khích** (§9.3.1
  bước 1 xét cả Linh Thú; nhiều đơn vị Khiêu Khích → Hero trước, rồi Linh Thú, vị trí
  nhỏ). Lên chuỗi (§9.2 bước 4) không chọn Linh Thú.
- `allEnemies` phía kẻ địch trúng cả Linh Thú.
- Lá nhắm đồng minh (`chosen` ally, `allAllies`) tính cả Linh Thú của người đánh.
- PvP: lá của đối thủ **được chọn** Linh Thú làm mục tiêu đơn như một Hero; Khiêu Khích
  của Linh Thú ép như của Hero (§15.4).
- Đòn của Linh Thú (cả effect `action` lẫn hit về phía nó) là **đòn tấn công**: Sức Mạnh
  và Suy Yếu áp dụng như đòn thường; không có hệ số pha trăng (hệ số đó chỉ dành cho lá
  bài). Linh Thú bị giết **không** tính `enemiesKilled` trong PvP.

**Vòng đời:** xóa giáp và tick trạng thái cùng lúc với Hero. Về 0 HP → `unitDied`, bị bỏ
khỏi `summons`. Hero chủ ngã → Linh Thú biến mất (`summonDismissed`). Linh Thú không có
lá, Nguyệt Lực, thăng cấp, bộ đếm; không tính vào điều kiện thua; không thể bị Hồi Hồn.

**Góc nhìn:** `viewFor` hiện Linh Thú của cả hai bên (thông tin công khai).

### 3.2 Các cơ chế khác

**Mê Hoặc — trạng thái `charm`** (debuff, giá trị = số chiêu, không giảm theo vòng,
`sourceId` = người gây Mê Hoặc).
- PvE / co-op: khi kẻ địch bị Mê Hoặc thi hành chiêu có mục tiêu đơn, mục tiêu đổi thành
  **kẻ địch khác còn sống** có HP hiện tại cao nhất (hòa → vị trí nhỏ). Damage tính như
  kẻ địch đánh thường (§10.1, nguồn là kẻ địch bị Mê Hoặc). Không có kẻ địch khác → chiêu
  thất bại (`intentFizzled`) — **vẫn trừ 1** lượt Mê Hoặc dù chiêu thất bại. Mỗi chiêu bị
  đổi trừ 1; về 0 → gỡ. Chiêu `allEnemies` / buff bản thân không bị ảnh hưởng và không
  trừ. Mê Hoặc trên Hero **không có tác dụng** trong PvE / co-op (chỉ PvP có luật cho
  Hero, dưới đây).
- **Kinh Hồng Vũ** (F06): nội tại `charmMastery { extraCharges: 1; damageMultiplier: 1.5 }`
  — mỗi lần F06 gây Mê Hoặc, cộng thêm `extraCharges` lượt; hệ số `damageMultiplier` áp
  vào đòn bị đổi mục tiêu khi Hero đã gây Mê Hoặc đó (`sourceId`) còn sống, đã thăng cấp
  và đang có nội tại này.
- Xem trước ý định (`preview.ts`) hiện mục tiêu đã đổi.
- PvP (§15.5 thêm dòng): Hero bị Mê Hoặc → lá tấn công đơn mục tiêu đầu tiên của nó trong
  lượt kế tiếp đánh vào **đồng đội còn sống HP cao nhất** của chính nó (không có đồng
  đội → đánh chính nó); trừ 1.

**Phong Ấn — effect `sealIntent { to }`.** Kẻ địch không báo chiêu — `plannedIntents`
là nội bộ, client không hiển thị (event `intentsRevealed` vẫn phát để debug/replay).
Một cơ chế duy nhất cho mọi chế độ: đặt dấu lên đơn vị địch (`UnitState.sealedBy`
= id Hero đánh lá); dấu tồn tại tới hết lượt kế của bên mục tiêu rồi hết, dù có dùng
hay không.
- PvE / co-op (`to` là kẻ địch): trong lượt kế của kẻ đó, mỗi chiêu nó thi hành bị
  tước **mọi effect không phải `damage`**; mỗi chiêu mất ít nhất một effect phát
  `sealStripped { unitId, refId }` (`refId` = intentId) và +1 `intentsSealed` cho
  Hero đặt dấu. Đóng Băng bỏ chuỗi vẫn hết dấu.
- PvP (`to` là Hero hoặc Linh Thú đối thủ): cùng cơ chế — trong lượt kế của ghế đó,
  lá do Hero bị dấu đánh và hành động của Linh Thú bị dấu chỉ còn effect `damage`;
  `sealStripped` (`refId` = instanceId / summonId) + `intentsSealed` cho người đặt.
- `sealExtraFirstPerTurn` (Sử Bút): lần Phong Ấn đầu tiên mỗi lượt đặt dấu thêm lên
  đơn vị địch còn sống khác có vị trí nhỏ nhất (cờ `firstSealUsedThisTurn` đặt lại
  đầu lượt). `sealWeakens { amount }` (Chép Sử): mục tiêu nhận Suy Yếu `amount`
  (PvP ×2 theo quy ước `01` §15.3).

**Hồi Hồn — effect `revive { ratio; to: "chosen" | "lastFallen" }`.** Lá bài dùng
`target: "fallenAlly"` + `to: "chosen"` (Hero **đã ngã** của người đánh).
- Hero sống lại với `max(1, floor(ratio × maxHp))` HP, không giáp, không trạng thái; giữ
  `leveledUp` và bộ đếm.
- Các instance bị gỡ khi Hero đó ngã (`cardsPurged`) được **xáo lại vào chồng rút** bằng
  RNG của trận (`PlayerState.purged[heroId]` lưu danh sách lúc gỡ).
- Mỗi Hero bị Hồi Hồn tối đa 1 lần mỗi trận; lá Hồi Hồn không có mục tiêu hợp lệ thì không
  đánh được (`getValidTargets` mở rộng cho Hero đã ngã).
- Event `heroRevived` (dùng lại tên của lượt chơi, thêm vào `CombatEvent`).
- Nội tại dạng thường của F10 là `none`, với `levelUp.onLevelUp:
  [{ type: "revive", ratio: 0.3, to: "lastFallen" }]`. `to: "lastFallen"` chọn Hero **ngã
  gần nhất của cùng người chơi mà chưa từng được Hồi Hồn** (lấy từ `PlayerState.
  fallenOrder`, không phải HP thấp nhất hay vị trí).

**Xuyên mục tiêu.** "Hàng sau" = kẻ địch không có vị trí nhỏ nhất trong các kẻ địch còn
sống. Bộ đếm `backRowHits` +1 mỗi hit từ lá tấn công của F05 trúng kẻ địch hàng sau. Nội tại
`pierceOwnAttacks`: mỗi hit đơn mục tiêu từ lá của Hero còn gọi `dealDamage` với **cùng
base** lên kẻ địch còn sống có vị trí ngay sau mục tiêu (nếu có) — hệ số của mục tiêu mới
(Suy Yếu, Dễ Vỡ…) vẫn áp dụng bình thường, không phải "cùng số damage trước giáp". PvP:
"vị trí" là vị trí Hero đối thủ.

**Khúc Vũ Tri Âm** (Song Hành M09+F06, §3.4) dùng effect mới `extendDebuffs { amount;
to }`: cộng `amount` vào mọi debuff **có thời hạn** đang có trên mục tiêu (×2 trong PvP,
như mọi trạng thái Thời hạn khác, §15.3).

### 3.3 Bản tóm tắt Hero

| Hero | Hiếm · Phe · Vai trò · HP | Nhánh A · Nhánh B | Thăng cấp | Dạng thứ hai |
|---|---|---|---|---|
| **F05** Hạ Chi | Rare · Huyền Vũ · Striker · 32 | *Liệp Thủ* (Đánh Dấu, bắn hàng sau) · *Tiễn Vũ* (nhiều hit) | `backRowHits` → 4 → **Xuyên Vân Tiễn** (`pierceOwnAttacks`) | **Biên Tái**: hit đầu mỗi lượt của F05 áp Đánh Dấu |
| **F06** Lam Khê | Epic · Bạch Lộ · Controller · 30 | *Kinh Hồng* (Mê Hoặc) · *Tin Mật* (Suy Yếu, Chiêm Bài) | `charmsApplied` → 2 → **Kinh Hồng Vũ**: Mê Hoặc do F06 gây +1 chiêu; đòn bị đổi mục tiêu ×1.5 | **Vũ Y**: mỗi khi gây Mê Hoặc, F06 Ẩn Thân 1 vòng |
| **F07** Cố Uyển | Rare · Thanh Loan · Controller · 30 | *Sử Bút* (Phong Ấn) · *Thư Hải* (Mưu Lược, Chiêm Bài) | `intentsSealed` → 3 → **Sử Bút**: lần Phong Ấn đầu tiên mỗi lượt lan sang 1 kẻ địch khác (vị trí nhỏ nhất) | **Chép Sử**: Phong Ấn còn áp Suy Yếu 1 lên mục tiêu |
| **F09** Tiểu Mãn | Common · Bạch Lộ · Specialist · 28 | *Linh Thố* (triệu hồi Thỏ Ngọc, buff Linh Thú) · *Nguyệt Dược* (Hồi Phục) | `summonsMade` → 7 (chỉnh sau 7b) → **Thỏ Ngọc Thức Tỉnh**: Linh Thú dùng `awakenedId` (18 HP, đòn 5 damage, hồi chủ 2) | **Nguyệt Cung**: Linh Thú của F09 mới triệu hồi được Khiêu Khích 1 vòng |
| **F10** Liễu Tịnh Nhan | Legendary · Trung lập · Support · 30 | *Hồn Dẫn* (Hồi Hồn, giáp) · *Tịnh Tâm* (hồi máu, giải debuff) | `alliesFallen` → 1 → **Nguyệt Hồn**: khi thăng cấp, Hồi Hồn đồng đội vừa ngã với 30% HP (theo luật `revive`) | **Vong Xuyên**: mỗi khi đồng đội ngã, mọi Hero còn sống của người chơi nhận 6 giáp |
| **M09** Đoàn Lạc | Epic · Bạch Lộ · Controller · 32 | *Khúc Sầu* (Suy Yếu / Dễ Vỡ lan) · *Tri Âm* (Mê Hoặc) | `debuffsApplied` → 6 → **Vong Quốc Khúc**: debuff có thời hạn do M09 gây kéo dài thêm 1 vòng | **Nam Chiếu Hồn**: hit của M09 +3 vào kẻ địch có ít nhất 2 debuff |

**Lệch GDD (đã duyệt):** GDD ghi dạng thăng cấp F07 *"xem trước 2 ý định tiếp theo của
địch"*. Chuỗi chiêu chỉ lên ở cuối vòng (§9.2); xem trước vòng sau buộc lên chuỗi trước
hai vòng và đổi thứ tự RNG (hỏng T213), nên thay bằng nội tại ở bảng trên. Ghi chú vào
`00` §4.

### 3.4 Song Hành 7b

| Cặp | Lá |
|---|---|
| M09 + F06 | *Khúc Vũ Tri Âm* (Mê Hoặc 1 kẻ địch, debuff trên nó kéo dài thêm 1 vòng) |
| F09 + F10 | *Nguyệt Thố Hộ Mệnh* (Thỏ Ngọc được triệu hồi / hồi đầy, nhận Khiêu Khích và giáp) |

### 3.5 Client 7b
Ô Linh Thú cạnh Hero chủ (HP, giáp, trạng thái, chọn làm mục tiêu được); animation
`summoned` / `summonActed` / `summonDismissed`; nhãn `Mê` trên kẻ địch bị Mê Hoặc và nhãn
`Phong Ấn` trên kẻ địch mang dấu (`sealedBy`); hiệu ứng chiêu bị Phong Ấn (event
`sealStripped` — kẻ địch không báo chiêu nên không vẽ `plannedIntents`); Hero đã ngã
chọn được khi đánh lá Hồi Hồn.

---

## 4. Phần 7c — Cốt truyện Arc 1–2

### 4.1 Dữ liệu `story.json`

```ts
StoryArc   { id: string; name: string; stageIds: string[]; rewardHeroId: string }
StoryStage {
  id: string; arcId: string; name: string; encounterId: string;
  start?: { moonIndex?: number; bloodMoonRounds?: number };
  before: DialogueLine[]; after: DialogueLine[];
  firstClear: { moonJade?: number; darkIron?: number; masteryXp?: number };
}
DialogueLine { speaker: string; text: string }   // heroId | enemyId | "narrator"
```
Id: `arc1`, `arc1_s01`… Thứ tự arc là thứ tự trong file (`arcs[0]` là Arc 1). Kiểm chéo
khi nạp: `stageIds` khớp `arcId`; `encounterId`, `rewardHeroId`, `speaker` trỏ tới dữ
liệu có sẵn; `moonIndex` 0–7; mỗi màn thuộc đúng một arc.

**Encounter của màn** có `tier: "story"` (tier mới của `EncounterDef`, `02` §1.6).
Encounter `story` không vào bản đồ lượt chơi (`run/map.ts` chỉ bốc `normal` / `elite` /
`boss`) và bị Trận lẻ lọc bỏ như `coop`. Kiểm chéo: `stage.encounterId` phải trỏ tới
encounter có `tier: "story"`.

**Mở màn:** màn thứ *n* của arc cần đã qua màn *n−1*; màn đầu của arc cần đã qua hết màn
của arc trước (màn 1 Arc 2 cần hết Arc 1).

### 4.2 Luật thuần — `rules/src/meta/story.ts`

- `StorySetup = { stageId, seed, heroIds: [string, string, string], deckCardIds }`.
- `createStoryCombat(data, setup, loadout?)` → `createCombat` với encounter của màn và
  `start` của màn chuyển thành `CombatSetup.start`.
- **`CombatSetup.start?: { moonIndex?: number; bloodMoonRounds?: number }`** là trường
  chung của `createCombat` (`01` §2): áp **trước** khi lên chuỗi ý định vòng 1, nên chiêu
  `moonOverrides` / `bloodMoonOverride` của vòng 1 theo pha đã đặt. Huyết Nguyệt đầu trận
  phát `bloodMoonChanged { rounds, cause: "start" }`; hook Kỳ Vật `bloodMoonStarted`
  **không** chạy (Cốt truyện không có Kỳ Vật). Vắng `start` thì `createCombat` giữ y hệt
  hành vi cũ (T213).
- `replayStoryCombat(data, setup, actions: Action[], loadout?)` →
  `{ ok: true; state } | { ok: false; step; reason }` (cùng quy ước `replayRun`; action sau
  khi trận kết thúc → lỗi `"actions after end"`).
- `storyStageUnlocked(data, profile, stageId): boolean`, `unlockedStageIds(data,
  profile): string[]`.
- `applyStoryResult(data, profile, setup: StorySetup, won)` — nhận cả `StorySetup` (không
  chỉ `stageId`) vì XP Tu Luyện cộng cho **từng Hero trong đội** mà tài khoản sở hữu,
  giống `applyRunResult` (`14`). Trả `{ ok: true; profile; rewards }` với
  `rewards = { firstClear: boolean; moonJade: number; darkIron: number; gains:
  MasteryGain[]; hero: PullResult | null }`:
  - Thắng và màn chưa có trong `profile.story.cleared` → thêm vào; trao `firstClear`
    (`moonJade`, `darkIron` vào `currencies`; `masteryXp` cộng cho từng Hero sở hữu trong
    đội → `gains`); nếu là màn cuối arc → `grantHeroItem(rewardHeroId)` (trùng → Tinh Hồn
    như gacha), kết quả trả trong `hero`.
  - Thắng lại hoặc thua → không thưởng: `rewards` về `{ firstClear: false, moonJade: 0,
    darkIron: 0, gains: [], hero: null }`. Màn Cốt truyện **không** cộng tiến độ nhiệm vụ
    hay thống kê Lượt chơi (`runsFinished`, `floorsReached`…) trong mọi trường hợp.
- Hồ sơ thêm `story: { cleared: string[] }`; `parseProfile` điền `{ cleared: [] }` cho hồ
  sơ cũ và lọc id màn không tồn tại; `mergeImportedProfile` không nhập `story` (Cốt
  truyện chỉ có trên server).

### 4.3 Server

- **Migration 4**: bảng `story_tickets` (`id`, `account_id`, `stage_id`, `status`,
  `setup_json`, `loadout_json`, `data_version`, `created_at`, `finished_at`,
  `result_json`), cùng quy ước bảng `runs` (`16` §9). Mỗi tài khoản tối đa một phiếu
  `open`; cấp phiếu mới đóng phiếu cũ (`abandoned`).
- `GET /api/story` → `{ cleared: string[]; unlocked: string[] }`; `unlocked` gồm mọi màn
  đang mở, **kể cả màn đã qua**.
- `POST /api/story/:stageId/tickets { deckId }` (hoặc `{ deckId: "starter", heroIds }`
  như `runs`): kiểm màn đã mở, deck hợp lệ, chụp loadout → `{ ticketId, setup, loadout }`.
  Màn chưa mở → 403 `"stage locked"`.
- `POST /api/story/tickets/:id/finish { actions }` (tối đa `MAX_STORY_ACTIONS = 2000`
  action): hạn phiếu như `runs` (7 ngày), `dataVersion` khớp, chạy lại bằng
  `replayStoryCombat`; lỗi → 422 và phiếu `rejected`; trận chưa kết thúc → 422, phiếu vẫn
  `open`; thành công → `applyStoryResult` trong transaction, trả hồ sơ + `rewards`.
- `POST /api/story/tickets/:id/abandon`.
- Mã lỗi chính xác: `404 "unknown stage"`, `403 "stage locked"`, `404 "unknown ticket"`,
  `409 "ticket closed"`, `410 "ticket expired"`, `409 "outdated client"`,
  `422 "replay failed"` (phiếu bị sửa → `rejected`), `422 "combat not finished"`.
- Cốt truyện cần đăng nhập; client ẩn chế độ khi mất kết nối.

### 4.4 Client

- **Màn Cốt Truyện:** chọn arc → danh sách màn (đã qua / đang mở / khóa) và thưởng lần
  đầu; màn cuối arc hiện Hero được tặng.
- **Màn Hội Thoại:** chân dung (`art.portrait`, trống → khung tạm có tên), tên người nói,
  chữ; click / phím Space để tiếp; nút *Bỏ Qua*.
- Luồng: `before` → chọn deck → cấp phiếu → trận (`CombatScene`) → nộp → thắng: `after`
  → bảng thưởng; thua: bảng kết quả, nút *Thử Lại* (phiếu mới).

### 4.5 Dàn ý nội dung

Lời thoại, encounter và chỉ số kẻ địch viết ở 7c.4 / 7c.5 và được duyệt.

**Arc 1 — Vọng Nguyệt** (dễ, dạy dần luật):

| Màn | Tên | Ghi chú |
|---|---|---|
| 1 | Nhập Học | Khôi lỗi; trận hướng dẫn |
| 2 | Thanh Loan Thí Luận | Kẻ địch dùng Tỏa Nguyệt |
| 3 | Huyền Vũ Thí Võ | Kẻ địch nhiều giáp / Phản Đòn |
| 4 | Bạch Lộ Thí Y | Kẻ địch hồi máu |
| 5 | Cấm Địa Xích Diên | Bắt đầu trong Huyết Nguyệt |
| 6 | Tàng Thư Các Có Ma | `book_wraith` |
| 7 | Dạ Tập | `shadow_fox` |
| 8 | **Boss: Khảo Hạch Chi Linh** (mới) | Đổi hành vi theo pha trăng |

Qua Arc 1 tặng **M10 Chu Quyết** (Rare).

**Arc 2 — Bóng Tối** (ngang tầng 2–3 của Lượt chơi):

| Màn | Tên | Ghi chú |
|---|---|---|
| 1 | Thư Tín Mất Tích | |
| 2 | Mật Thám | F02 trong truyện |
| 3 | Vô Nguyệt Ám Sát | Kẻ địch Ẩn Thân / sát thủ |
| 4 | Tô Dạ Dao Động | M06 trong truyện |
| 5 | Chợ Đêm Tin Tức | |
| 6 | Quan Tinh Đài | M08 trong truyện; bắt đầu Trăng Non |
| 7 | Hắc Vệ | `black_guard` |
| 8 | **Boss: Vô Nguyệt Ảnh Chủ** (mới) | Cướp buff, Ẩn Thân |

Qua Arc 2 tặng **F02 Diệp Linh Lung** (Epic); đã có → Tinh Hồn.

**Kẻ địch mới:** ~3 thường mỗi arc + 1 boss mỗi arc; các màn còn lại dùng lại 7 kẻ địch
hiện có.

**Thưởng (khởi điểm, chốt ở 7d.6):** mỗi arc tổng ~400 Nguyệt Ngọc; Huyền Thiết 1–2 mỗi
màn, 5 ở boss arc; XP Tu Luyện theo màn; 1 Hero.

**Quyết định đã duyệt (7c.1):**

- **Tỏa Nguyệt trong chiêu địch:** `drainMoonPower` được phép trong `IntentDef` của kẻ
  địch (ngoài lá bài) với đúng nghĩa PvP của `01` §15.5: rút **Dự Trữ của người chơi** một
  lần, `min(amount, player.moonReserve)`; `steal` cộng quỹ cho kẻ địch thi hành. Không có
  phần hủy ý định — người chơi không có chuỗi ý định (luật `01` §9.3.2; kiểm chéo nới ở
  `02` §6).
- **Mục tiêu độ khó** (đo bằng bot, Bộ cơ bản của đội khởi đầu `m05 + f04 + m06`, 80
  seed): màn thường Arc 1 thắng **≥ 80%**; boss Arc 1 **≥ 60%**; màn thường Arc 2
  **55–75%**; boss Arc 2 **40–60%**. Ngoài ra mỗi màn Arc 2 phải có **≥ 60%** với đội tốt
  nhất trong 3 đội mẫu.

---

## 5. Phần 7d — Trang bị và vật liệu

### 5.1 Nâng cấp bằng vật liệu

- `upgradeItem(data, profile, kind: "weapon" | "relic", id)` trong `rules/src/meta/`:
  phải sở hữu, cấp < 5, đủ vật liệu → trừ vật liệu, +1 `refinement` / `resonance`. Lỗi:
  `"not owned" | "maxed" | "not enough"`.
- `economy-config.json` → `upgradeCost`:
  ```json
  "upgradeCost": {
    "weapon": { "rare": [2,3,4,5], "epic": [3,5,7,9], "legendary": [5,8,11,14] },
    "relic":  { "rare": [2,3,4,5], "epic": [3,5,7,9], "legendary": [5,8,11,14] }
  }
  ```
  Chỉ số mảng = cấp đích − 2 (R2…R5). Vũ khí tiêu `darkIron`, Nguyệt Bảo tiêu `moonDust`.
  Có độ hiếm `common` (nếu có vật phẩm Common) dùng giá `rare`.
- Bản trùng từ gacha vẫn +1 như `14` §13.1.
- Route `POST /api/profile/weapons/:id/upgrade`, `POST /api/profile/relics/:id/upgrade`
  (có `If-Match` như route hồ sơ khác).

### 5.2 Nguồn vật liệu mới

- `runRewards.darkIron`: thắng lượt chơi 3; thua ở tầng ≥ 2 được 1 (bộ khởi đầu cũng
  nhận, theo cùng luật thưởng lượt chơi).
- Cốt truyện: `firstClear.darkIron` (§4.5).
- Nguyệt Trần giữ nguồn cũ (co-op, trùng khi max), đúng GDD §9.

### 5.3 Nội dung

- **15 vũ khí bản mệnh** (một cho mỗi Hero mới). Độ hiếm = độ hiếm Hero; F09 (Common) dùng
  vũ khí Rare. Mỗi vũ khí đủ R1–R5, 1 lá Binh Khí, nội tại thường + nội tại bản mệnh theo
  khuôn `02` §1.12. Có *Ngọc Bút* (M01) theo GDD §5.1.
- **8 Nguyệt Bảo mới** (tổng 16): ưu tiên phục vụ lối chơi mới (Linh Thú, Mê Hoặc, Phong
  Ấn, Hộ Vệ, Chọn Pha); mỗi Viện có ít nhất 1 Nguyệt Bảo trong tổng số.
- Cập nhật `banner_weapons`, `banner_relics`. `pvp-config.freeWeaponIds` / `freeRelicIds`
  giữ nguyên, xem lại theo kết quả mô phỏng PvP.
- Danh sách và số R1–R5 / Cộng Minh 1–5 viết ở 7d.3 / 7d.4 và được duyệt.

### 5.4 Client
Kho đồ: nút *Nâng Cấp* trên vũ khí / Nguyệt Bảo, hiện giá, số vật liệu đang có, cấp sau
nâng; tắt nút khi max hoặc thiếu.

### 5.5 Mô phỏng và mục tiêu

- `run-playtest` có trang bị: không món mới nào làm tỉ lệ thắng lượt tăng quá 10 điểm ở R1
  (cùng chuẩn 4e.7).
- `economy-sim` thêm vật liệu và Cốt truyện. Mục tiêu: người chơi đều đặn đưa **một vũ khí
  Epic R1 → R5 trong ~3–4 tuần** chỉ bằng vật liệu, **Legendary ~6–8 tuần**; tổng Nguyệt
  Ngọc từ Cốt truyện không làm lệch nhịp quay đã chỉnh ở 4d quá 15%.

---

## 6. Test

Tiếp nối `06` từ T263. Mỗi dải có thể giãn khi viết `06`; mã trong code theo `06`.

| Dải | Phần | Nội dung |
|---|---|---|
| T263–T266 | 7a | `guard`: chuyển mục tiêu chiêu địch; thứ tự sau Khiêu Khích; người hộ vệ ngã → không chuyển; PvP lá người chơi bị chuyển; `hitsIntercepted` |
| T267–T269 | 7a | Chọn Pha: mở `choosing` đầu lượt, `chooseMoon` hợp lệ / không hợp lệ; co-op người chọn; server hết giờ → `offset 0` |
| T270–T271 | 7a | `createCard`: id tất định, tay đầy → bỏ qua, bỏ → không vào lại chồng rút, chủ ngã → Tàn Chiêu; lá `token` bị `validateDeck` từ chối |
| T272–T275 | 7a | Bộ đếm + nội tại: mỗi Hero 7a ít nhất 1 kiểm thăng cấp và 1 kiểm dạng thứ hai (có thể gộp nhiều Hero một test) |
| T276 | 7a | 4 Song Hành 7a; nạp dữ liệu 14 Hero; `buildPvpLoadout` với Hero mới |
| T280–T281 | 7b | Linh Thú: tạo / triệu hồi lại (hồi đầy + Sức Mạnh, đếm `summonsMade`); hành động cuối lượt theo `targeting`, Sức Mạnh / Suy Yếu áp dụng như đòn thường |
| T282–T283 | 7b | Linh Thú: chỉ bị nhắm đơn khi Khiêu Khích (Hero trước), trúng `allEnemies`, không lên chuỗi kế hoạch; ngã và chủ ngã → biến mất, không tính thua, lá đồng minh chọn được nó |
| T284 | 7b | `awakenSummons` đổi Linh Thú sang `awakenedId` giữ tỉ lệ HP khi thăng cấp; `summonTaunts` cho Khiêu Khích |
| T285–T286 | 7b | PvP: Linh Thú đối thủ là mục tiêu đơn hợp lệ, Khiêu Khích ép chọn, `viewFor` hiện Linh Thú cả hai bên; co-op: Linh Thú hai người hành động sau khi cả hai Xong, người 0 trước |
| T287–T288 | 7b | `charm`: đổi mục tiêu sang kẻ địch khác (không có → `intentFizzled`, vẫn trừ 1 lượt), xem trước hiện mục tiêu mới; `charmsApplied`, `charmMastery` (+1 lượt, ×1.5), `stealthOnCharm`; PvP Mê Hoặc đánh đồng đội |
| T289–T290 | 7b | `sealIntent`: đặt dấu 1 lượt địch, chiêu/lá bị tước mọi effect không-damage (`UnitState.sealedBy`, `sealStripped`), `sealExtraFirstPerTurn` lan sang 1 địch, `sealWeakens`, `intentsSealed`; PvP cùng cơ chế trên Hero/Linh Thú đối thủ |
| T291–T292 | 7b | `revive`: HP theo `ratio`, xáo lại lá đã gỡ tất định, mỗi Hero tối đa 1 lần, `fallenAlly` chỉ liệt kê Hero ngã chưa hồi; `alliesFallen`, `onLevelUp` hồi `lastFallen`, `armorOnAllyFall` |
| T293–T294 | 7b | Xuyên mục tiêu: `backRowHits`, `pierceOwnAttacks` gọi `dealDamage` cùng base lên kẻ địch phía sau, `firstHitMarks`; `debuffsApplied`, `debuffDurationBonus`, `bonusVsDebuffed`, `extendDebuffs` |
| T295 | 7b | Kiểm chéo dữ liệu: `summons.json` (`awakenedId`, phạm vi `owner` / `summon`), lá `fallenAlly` / `revive` |
| T296–T297 | 7b | 6 Hero đợt 2 nạp đủ pool, chỉ số PvP, slot banner, trận khởi đầu và deck hợp lệ; đủ 20 Hero, 2 Song Hành mới thêm đúng lá vào deck |
| T298–T299 | 7b | `scaledDamage` đọc từng chỉ số theo `base + floor(stat × amount / divisor)` chặn `max`; `targetSealed` |
| T300 | 7c | Kiểm chéo `story.json` (id sai, speaker không tồn tại, màn thuộc hai arc, encounter không phải `story`, `moonIndex` ngoài 0–7) |
| T301–T302 | 7c | `replayStoryCombat` tất định; `start` áp trước khi lên chuỗi vòng 1 |
| T303–T304 | 7c | `storyStageUnlocked` / `unlockedStageIds`; `applyStoryResult` thưởng lần đầu đúng 1 lần, màn cuối tặng Hero (trùng → Tinh Hồn) |
| T305–T306 | 7c | Route: màn khóa → 403; nộp đúng → thưởng; chạy lại sai → 422 `rejected`; trận chưa xong → 422; một phiếu mở mỗi tài khoản, hết hạn → 410; lệch `dataVersion` → 409; `GET /api/story` |
| T307 | 7c | `parseProfile` hồ sơ không có `story` + lọc id màn lạ; `mergeImportedProfile` bỏ qua `story` |
| T308–T310 | 7d | `upgradeItem`: đủ / thiếu, max, chưa sở hữu, giá theo độ hiếm và cấp |
| T311 | 7d | Route nâng cấp + `If-Match` |
| T312 | 7d | Thưởng Huyền Thiết từ lượt chơi |
| T313 | 7d | Nạp dữ liệu vũ khí / Nguyệt Bảo mới, banner trỏ đúng |

**Chốt chặn mọi bước:** T213 xanh (hoặc ghi lại có duyệt, §1.2); `pnpm test` và
`pnpm typecheck` xanh.

---

## 7. Tài liệu cập nhật

| Tài liệu | Thay đổi |
|---|---|
| `00` | Lộ trình (GĐ 7 chi tiết), bảng Hero chốt theo §2.1 / §3.3, ghi chú lệch F07 |
| `01` | `guard` (§6.1, §9.3.1), Chọn Pha (§3.1), `createCard` (§4), §17 Linh Thú (mới), `charm`, `sealIntent`, `revive`, xuyên mục tiêu, §15.4 / §15.5 PvP |
| `02` | `summons.json`, `story.json`, `StatusId` / `Effect` / `LevelUpCounter` / `LevelUpPassive` mới, `CardDef.token`, `TargetRef "owner"`, `upgradeCost`, kiểm chéo |
| `03` | Kẻ địch / boss / encounter Arc 1–2 |
| `04` | Hộ Vệ, Chọn Pha, Linh Thú, Mê Hoặc, Phong Ấn, Hồi Hồn, Xuyên, Cốt Truyện, Arc, Màn, Thưởng Lần Đầu, Nâng Cấp |
| `06` | T263–T313 |
| `07` | Giai đoạn 7 (bước §8) |
| `14` | Cốt truyện (tiến độ, mở màn, thưởng), nâng cấp vật liệu, Huyền Thiết từ lượt chơi |
| `16` | Route `story`, route nâng cấp, migration |
| `CLAUDE.md` | Giai đoạn hiện tại |

---

## 8. Bước

Mỗi phần có kế hoạch riêng trong `docs/superpowers/plans/`. Mỗi bước kết thúc với
`pnpm test` + `pnpm typecheck` xanh và commit.

**7a**
1. 7a.1 — Tài liệu (§7, phần 7a).
2. 7a.2 — Cơ chế: `guard`, Chọn Pha (rules + server schema), `createCard`, bộ đếm, nội
   tại — test trên dữ liệu test (T263–T275 phần luật).
3. 7a.3 — Nội dung M01, M02, M03, M04, F01 (60 lá; danh sách duyệt trước khi code).
4. 7a.4 — Nội dung M07, M08, M10, F08 (48 lá) + 4 Song Hành; banner; `pvp-config` (T276).
5. 7a.5 — Client 7a.
6. 7a.6 — Dạy bot + mô phỏng + chỉnh số (duyệt) + `playtest-notes.md`.

**7b**
1. 7b.1 — Tài liệu.
2. 7b.2 — Linh Thú: state, `summon`, hành động, mục tiêu, PvP / co-op / `viewFor`
   (T280–T286).
3. 7b.3 — `charm`, `sealIntent`, `revive`, xuyên mục tiêu (T287–T295).
4. 7b.4 — Nội dung 6 Hero (72 lá) + `summons.json` + 2 Song Hành; banner; `pvp-config`
   (T296–T297).
5. 7b.5 — Client 7b.
6. 7b.6 — Dạy bot + mô phỏng + chỉnh số (duyệt).

**7c**
1. 7c.1 — Tài liệu.
2. 7c.2 — Schema `story.json` + luật thuần + hồ sơ (T300–T304, T307).
3. 7c.3 — Server: migration, route (T305–T306).
4. 7c.4 — Nội dung Arc 1 (kẻ địch, boss, encounter, lời thoại; duyệt).
5. 7c.5 — Nội dung Arc 2 (duyệt).
6. 7c.6 — Client Cốt truyện + hội thoại.
7. 7c.7 — Chơi thử (bot + tay) và chỉnh độ khó (mục tiêu §4.5).

**7d**
1. 7d.1 — Tài liệu.
2. 7d.2 — `upgradeItem`, `upgradeCost`, nguồn Huyền Thiết, route (T308–T312).
3. 7d.3 — 15 vũ khí bản mệnh (duyệt).
4. 7d.4 — 8 Nguyệt Bảo + banner (T313; duyệt).
5. 7d.5 — Client nâng cấp.
6. 7d.6 — Mô phỏng trang bị + kinh tế + chỉnh số (duyệt).

**Hoàn thành GĐ 7 khi:** 20 Hero chơi được ở mọi chế độ và đạt mục tiêu §1.3; chơi trọn
Arc 1–2 trên client qua server; vật liệu có chỗ tiêu và đạt mục tiêu §5.5; T263–T313 xanh.

---

## 9. Rủi ro

- **Khối lượng nội dung** (~200 lá, 23 trang bị, 16 màn lời thoại): chia đợt, duyệt danh
  sách trước khi code; lá mới dùng tối đa effect / từ khóa sẵn có.
- **Linh Thú** chạm mục tiêu, PvP `viewFor`, co-op, preview, client: làm riêng một bước
  (7b.2), chạy lại mô phỏng PvP và co-op sau bước đó.
- **Cân bằng 20 Hero trong PvP:** bot có thể chơi kém cơ chế mới → số đo sai; dạy bot
  trước khi đo (§1.3).
- **Ghi vàng T213:** thêm Hero vào banner đổi kết quả quay trong test kinh tế / gacha cũ;
  cần tách hoặc ghi lại có duyệt.
- **Art:** nhiều Hero chưa có chân dung; mọi màn (thẻ, hội thoại) chạy được với khung tạm.

---

## 10. Quyết định đã chốt (2026-09-28)

1. Phạm vi: spec khung cho cả GĐ 7, chia 7a → 7b → 7c → 7d.
2. Hero mới theo khuôn §1.1 (pool 12, 2 nhánh, lá "+", dạng thứ hai, vũ khí bản mệnh ở 7d).
3. Cốt truyện: chuỗi màn tuyến tính, tự chọn đội, thưởng lần đầu; phiếu + chạy lại trên
   server.
4. Hero vào banner chung; arc tặng Hero (Arc 1 → M10, Arc 2 → F02); không có rate-up.
5. Linh Thú là đơn vị thật: tự hành động cuối lượt người chơi; kẻ địch chỉ nhắm đơn khi nó
   Khiêu Khích; `allEnemies` trúng nó; mỗi Hero tối đa 1; chủ ngã → biến mất.
6. Mê Hoặc, Phong Ấn, Hồi Hồn, xuyên, Hộ Vệ, Chọn Pha làm gọn trong khung sẵn có.
7. F07 dạng thăng cấp thay "xem trước 2 ý định" bằng Phong Ấn lan sang 1 kẻ địch khác.
8. Spec chứa bản tóm tắt Hero + dàn ý arc; lá / lời thoại / số trang bị duyệt theo đợt.
9. Vật liệu đổi lấy +1 Tinh Luyện / Cộng Minh theo `upgradeCost`; Huyền Thiết thêm nguồn từ
   Lượt chơi và Cốt truyện; không có phân giải.
