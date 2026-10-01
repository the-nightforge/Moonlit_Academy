# 01 — Đặc tả luật chiến đấu (Prototype)

Tài liệu này mô tả **chính xác** cách một trận đấu vận hành. Code trong `packages/rules` phải tuân theo từng mục. Thuật ngữ theo `04-glossary.md`.

Phạm vi: giai đoạn 1–4b (PvE offline). Các mục đánh dấu **[GĐ2]** / **[GĐ3]** / **[GĐ4a]** / **[GĐ4b]** thuộc giai đoạn 2 / 3 / 4a / 4b (bối cảnh: `09-phase2-spec.md`, `10-phase3-spec.md`, `12-phase4a-spec.md`, `13-phase4b-spec.md`). Luật lượt chơi: `11-run-rules.md`. Luật hồ sơ, Tu Luyện và deck: `14-meta-rules.md`.

---

## 1. Thành phần của trận đấu

| Thành phần | Mô tả |
|---|---|
| **Đội** | 3 Hero, vị trí 0, 1, 2 (trái sang phải). Mỗi Hero có `hp`, `maxHp`, `armor`, danh sách trạng thái, bộ đếm thăng cấp |
| **Kẻ địch** | 1–3 kẻ địch, vị trí 0, 1, 2. Mỗi kẻ địch có `hp`, `maxHp`, `armor`, trạng thái, chuỗi chiêu đã lên (`plannedIntents` — nội bộ, không báo cho người chơi), Nguyệt Lực và Dự Trữ riêng |
| **Deck** | Các lá độc nhất theo `cardId` (khởi đầu 6 lá/Hero) + 1 lá Song Hành cho mỗi cặp đủ mặt trong đội **[GĐ2]** (mục 4.4). Mỗi lá sinh `copies` bản; mỗi bản trong trận là một **card instance** có `instanceId` riêng |
| **Chồng bài** | `drawPile` (rút), `hand` (trên tay), `discardPile` (bỏ — không bao giờ xáo lại vào chồng rút) |
| **Nguyệt Lực** | Tài nguyên để đánh bài: `min(8, 2 + vòng)` mỗi lượt cộng Dự Trữ (tối đa 3) — `12` §3.1 |
| **Nguyệt Luân** | Chỉ số pha trăng 0–7 + `moonDecrees` (lệnh đã bốc của mỗi pha) — xem mục 7 |
| **RNG** | Trạng thái bộ sinh số ngẫu nhiên có seed, lưu trong state |

**[GĐ5]** Từ giai đoạn 5, các thành phần gắn với người chơi (deck, chồng bài, tay, Nguyệt
Lực, Dự Trữ, Chiêm Bài, Kỳ Vật, trang bị, bộ đếm hook) nằm trong `CombatState.players[]`
(xem `02` §2). PvE có đúng một người chơi (`players[0]`, `mode: "pve"`); toàn bộ luật trong
tài liệu này không đổi. Luật PvP ở §15, co-op ở §16; đặc tả đầy đủ `17`.

---

## 2. Bắt đầu trận

`createCombat` theo thứ tự (quan trọng cho RNG):

1. Tạo chồng bài: mỗi lá trong deck (kể cả lá Song Hành tự thêm, mục 4.4) sinh `copies` bản, mỗi bản một card instance có `instanceId` riêng, theo thứ tự deck; xếp vào `drawPile`, **xáo bằng RNG** (`deckShuffled`). **[GĐ3]** Nếu `CombatSetup.deckCardIds` có: dùng danh sách đó thay cho `cardIds` của 3 Hero (chủ lá = `ownerId`, phải thuộc đội).
2. Mọi Hero và kẻ địch: `hp = maxHp`, `armor = 0`, không trạng thái. **[GĐ3]** Nếu `CombatSetup.heroes` có: `hp`/`maxHp` của Hero lấy từ đó.
3. `round = 1`. **`rollMoon`** (mục 7.6) bốc **pha khởi đầu** ngẫu nhiên tất định theo seed (không còn cố định ở pha 1) và **một Nguyệt Lệnh cho mỗi pha** → `state.moonDecrees`, phát `moonDecreesRolled`; bốc bằng luồng RNG phụ nên không đổi `rngState` (mục 7.6). Nếu pha khởi đầu là Trăng Tròn, `enterPhase` của `rollMoon` chạy ngay (mục 7.5 — Nguyệt Chiếu). **[GĐ7c]** `CombatSetup.start?: { moonIndex?: number; decrees?: …; bloodMoonRounds?: number }` (Cốt truyện, `18` §4): `start.moonIndex` (0–7) và `start.decrees` **ghi đè sau khi đã bốc đủ** (không đổi RNG), trước khi lên chuỗi vòng 1, nên `moonOverrides` / `bloodMoonOverride` của vòng 1 theo pha đã đặt. `start.bloodMoonRounds > 0` phát `bloodMoonChanged { rounds, cause: "start" }` ngay khi tạo trận; hook Kỳ Vật `bloodMoonStarted` **không** chạy (trận Cốt truyện không có Kỳ Vật).
4. **Kẻ địch lên chuỗi vòng 1** (mục 9.2), theo vị trí 0 → n.
5. Rút tay đầu `handSize` lá (`cardsDrawn`).
6. `status = "mulligan"`.

Hook Kỳ Vật `combatStart` **[GĐ3]** giữ vị trí như trước: chạy sau các hook `playerTurnStart` của lượt 1, tức là **sau Đổi Bài** (mục 2.1) — để giáp đầu trận không bị bước xóa giáp đầu lượt 1 xóa mất (T115).

### 2.1 Đổi Bài

Action `{ type: "mulligan", instanceIds }`:
- Hợp lệ khi `status = "mulligan"`, `instanceIds` có 0..`maxMulligan` phần tử, không trùng, đều đang trên tay. Mọi Action khác khi `status = "mulligan"` bị từ chối (`"mulligan pending"`).
- Xử lý: rút `n` lá từ đỉnh chồng **trước** (thay đúng vị trí trên tay), **rồi** đưa `n` lá bị đổi vào chồng và xáo lại chồng bằng RNG. Event `mulliganed` (+ `deckShuffled` nếu `n > 0`).
- Chồng có ít hơn `n` lá: chỉ đổi được bằng số lá có trong chồng; lá không đổi được ở lại tay.
- Mảng rỗng = giữ nguyên tay (không tiêu RNG).
- Sau đó bắt đầu lượt người chơi vòng 1 (mục 3.1), rồi hook Kỳ Vật `combatStart` (§13).

---

## 3. Lượt người chơi

### 3.1 Đầu lượt (theo thứ tự)
1. **Xóa giáp** của mọi Hero (`armor = 0`) và gỡ **Phản Đòn** (`reflect`) của mọi Hero **[GĐ2]**. **[Nguyệt Lệnh]** Bỏ qua cả bước này khi lệnh **Giữ Giáp** (`keepArmor`) đang có hiệu lực (mục 7.5).
2. **Bộ đếm thăng cấp đầu lượt** (F04, mục 8), tính **trước** khi trạng thái kích hoạt. **[GĐ7]** Cùng vòng này, với từng Hero còn sống: nhận giáp nội tại `armorPerTurn`; bốc 1 buff `randomBuffPerTurn` trong `combatConfig.levelUpRandomBuffs` bằng RNG; +1 bộ đếm `turnsSurvived` (từ vòng 2 trở đi), `studyPoints`, `fullMoonsSeen` (nếu pha hiện tại là `full`); đặt lại `firstSchemeUsedThisTurn` (mục 8). **[Nguyệt Lệnh]** Bỏ khóa `p<seat>` của người đang có lượt trong `firstHitKeys` (Tập Kích, mục 7.5).
3. **Kích hoạt trạng thái đầu lượt** của từng Hero theo vị trí 0 → 2: Thiêu Đốt, rồi Hồi Phục (mục 6).
4. **Huyết Nguyệt [GĐ2]:** nếu `bloodMoonRounds > 0`, từng Hero còn sống (vị trí 0 → 2) mất `bloodMoonHpLoss` HP (`combatConfig`, mặc định 2; mục 7.4); xử lý ngã và thăng cấp như tick Thiêu Đốt.
5. **[Nguyệt Lệnh]** Hiệu ứng lệnh đầu lượt của người chơi (mục 7.5), theo thứ tự: **Mầm Sống / Đoàn Viên** (`turnStartHeal`: hồi phẳng, không hệ số hồi, gồm Linh Thú); **Thế Cân** (`turnStartStatusOnHighestHp`: PvE một lần mỗi vòng tại ghế 0 — Hero HP cao nhất của mỗi ghế và kẻ địch HP cao nhất nhận Suy Yếu; PvP theo ghế đang tới lượt — mục 15.2).
6. Kiểm tra thắng/thua (mục 11).
7. `cardsPlayedThisTurn = 0` (Liên Hoàn, mục 5.3) **[GĐ4b]**; **[Nguyệt Lệnh]** đặt lại `attackCardsThisTurn` (Liên Kích), `discardsThisTurn` (Xả Thân), `bloodPactUsed` (Huyết Tế). `moonPower = base(round) + moonReserve + moonPowerBonus` + **Nguyệt Sinh** (`turnMoonPowerBonus`) nếu lệnh đang có hiệu lực; event `moonPowerChanged`. **Gốc của vòng** `r`: `base(r) = min(cap, start + (r − 1) × perRound)` theo `combatConfig.moonPower`; quỹ lượt **được vượt** `cap` (`cap + moonReserveMax`, cộng thêm `moonPowerBonus` và phần lệnh không trần); `gainMoonPower` cộng thẳng vào quỹ. `moonPowerBonus` là quỹ cộng thêm mỗi đầu lượt từ Dưỡng Nguyệt (xem dưới) **[GĐ4b]**.
8. **Rút bù:** rút tới khi tay có `handSize` lá hoặc chồng rỗng (mục 4.2, `cardsDrawn`). **[Nguyệt Lệnh]** Sau đó **Khai Trí** (`turnStartDraw`): rút thêm `amount` lá (tuân `handLimit` — lá tràn vào chồng bỏ, mục 4.2).
9. **Cạn Bài:** nếu tay rỗng **và** chồng rỗng → event `deckedOut`, thua (mục 11).
10. Hero đang **Đóng Băng**: các lá của Hero đó (kể cả lá Song Hành có Hero đó là owner) không đánh được trong lượt này.
11. **[GĐ3]** Kích hoạt hook Kỳ Vật `playerTurnStart` (§13).
12. **[GĐ7] Nội tại đầu lượt của cả người chơi** và **[Nguyệt Lệnh]** lệnh Chiêm Bài, đúng thứ tự (mục 8):
    1. **Thiên Cơ** (`cheapestCardDiscount`): gắn `turnDiscount` lên lá rẻ nhất trên tay — chỉ trong lượt này, xóa ở cuối lượt (mục 3.3).
    2. **Vạn Kim** (`freeChooseCardPerTurn`): mở Chiêm Bài miễn phí (`chooseCard` với `look`).
    3. **Bói Nguyệt** (lệnh `freeChooseCard`): mở Chiêm Bài `look` miễn phí **sau** Vạn Kim; nếu đang có `pendingChoice` (Vạn Kim chưa trả lời) → đặt cờ `omenPending`, mở ngay sau khi Chiêm Bài đó được trả lời và **trước** Chọn Pha.
    4. **Quan Tinh** (`chooseMoon`): mở **Chọn Pha** (mục 5.5) — chỉ **sau khi** mọi Chiêm Bài (kể cả Bói Nguyệt) đã được trả lời, và chỉ khi Hero đã thăng cấp **lúc đầu lượt**; Hero thăng cấp giữa lượt thì Chọn Pha mở từ lượt sau (`moonChoicePending`).

Vòng 1 đi qua đủ các bước (bước 7 thường không rút gì vì tay đã đủ `handSize` lá sau Đổi Bài).

**[GĐ4b] Dưỡng Nguyệt** (effect `gainMoonPowerPerTurn { amount }`, chỉ trên lá bài): `moonPowerBonus += amount` — từ lượt sau, mỗi đầu lượt quỹ được cộng thêm `moonPowerBonus` (bước 6). Không có trần; cộng dồn qua mọi lần dùng; giữ tới hết trận.

### 3.2 Trong lượt
Người chơi thực hiện bất kỳ số lượng hành động nào:
- `playCard(instanceId, targetId?)`: đánh 1 lá (mục 5).
- `discardCard(instanceId)` **[Nguyệt Lệnh]**: Hủy Bài — chỉ hợp lệ khi lệnh đang có `discardForMoonPower` (Xả Thân; mục 5.8).
- `bloodPact(heroId)` **[Nguyệt Lệnh]**: Huyết Tế — chỉ hợp lệ khi lệnh đang có `bloodPact` (mục 5.9).
- `endTurn`: kết thúc lượt.
- `chooseCard(instanceId)`: chỉ khi `status = "choosing"` (Chiêm Bài, xem dưới); trong khi `choosing`, mọi Action khác bị từ chối (`"choice pending"`).
- `chooseMoon(offset)` **[GĐ7]**: chỉ khi `pendingChoice.kind = "chooseMoon"` (Chọn Pha, mục 5.5).

- Đánh lá như mục 5. Lá rời tay sang vùng đang giải quyết (mục 5.2) **trước** khi effect chạy.
- **Giảm cost của M06** (`firstOwnCardDiscount`): lá riêng đầu tiên của Tô Dạ mỗi lượt giảm `amount` Nguyệt Lực (tối thiểu 0), áp **sau** giảm cost theo pha (mục 4.5, mục 8). Không áp cho lá Song Hành.
- **Chiêm Bài** (effect `chooseCard look`): lấy `k = min(look, số lá trong chồng)` lá trên cùng.
  - `k = 0`: không có tác dụng.
  - `k = 1`: lá đó vào tay luôn, không dừng (`cardsDrawn`).
  - `k ≥ 2`: `pendingChoice = { options }`, `status = "choosing"`, event `choiceOpened`. Action `chooseCard` (phải thuộc `options`): lá đó vào tay, các lá còn lại **xuống đáy chồng theo thứ tự `options`**, `status = "playerTurn"`, event `cardChosen`. Vì `chooseCard` luôn là effect cuối, không còn effect nào chờ.
  - Tay luôn còn chỗ vì lá đang đánh đã rời tay (tay ≤ `handSize − 1`).
- **Lá lấy qua Chiêm Bài rẻ hơn** (cả khi `k = 1` và khi chọn): đánh dấu `chosenThisTurn`; tới hết lượt người chơi này cost giảm `combatConfig.chooseCardDiscount` (áp sau mọi giảm cost khác, tối thiểu 0). Cuối lượt người chơi mọi dấu `chosenThisTurn` bị xóa **[chỉnh sau 4b]**.
- Khi Chiêm Bài mở lựa chọn, phần còn lại của việc đánh lá (gỡ Tích Lực/Ẩn Thân của lá tấn công, hook Kỳ Vật `cardPlayed`, lá vào chồng bỏ) **chạy ngay**, không chờ người chơi chọn — các bước đó không phụ thuộc lá được chọn, nên không cần lưu "phần việc còn lại".

### 3.3 Cuối lượt người chơi (theo thứ tự)
0. **[GĐ3]** Kích hoạt hook Kỳ Vật `playerTurnEnd` (§13). Nếu trận kết thúc: dừng.
1. **Không bỏ tay.** Chỉ bỏ các lá **Tàn Chiêu** (có owner đã ngã) vào `discardPile` → `cardDiscarded`. Lá cần Huyết Nguyệt và lá của Hero bị Đóng Băng ở lại tay. **[Nguyệt Lệnh]** Khi lệnh **Đoạn Tuyệt** (`discardDamage`) có hiệu lực: với mỗi lá vừa bỏ, đơn vị đối phương còn sống HP thấp nhất của chủ lá mất `amount` HP (`hpLost` cause `"decree"`, mục 7.5). **[Nguyệt Lệnh]** Khi lệnh **Luân Hồi** (`recycleDiscard`) có hiệu lực: chuyển tối đa `count` lá **mới nhất** trong chồng bỏ về **đáy** chồng rút (lá mới nhất nằm dưới cùng) → event `cardsRecycled`, sau đó mới qua bước 2.
2. Mọi lá còn trên tay: `heldTurns += 1` (Tích Tụ, mục 4.1) **[GĐ4b]**. Xóa mọi dấu `chosenThisTurn` (Chiêm Bài, mục 3.2) và `turnDiscount` (Thiên Cơ, mục 3.1) **[GĐ7]**.
3. `moonReserve = min(moonReserveMax, moonPower)`; event `moonReserveChanged`.
4. Hero bị Đóng Băng trong lượt này: gỡ trạng thái Đóng Băng.
5. Chuyển sang lượt kẻ địch (mục 9.3), rồi cuối vòng (mục 9.4).

---

## 4. Bài

### 4.1 Card instance
- Mỗi lá trong deck sinh `copies` bản (mục 2); mỗi bản là một card instance có `instanceId` duy nhất trỏ tới `cardId` trong dữ liệu.
- Một lá **thuộc về** Hero `ownerId` của nó. Lá Song Hành thuộc về **cả hai** Hero trong `bond.owners` (mục 4.4). Card instance lưu `ownerIds` (1 hoặc 2 phần tử).
- **[GĐ4b]** Card instance lưu `heldTurns` — số lượt lá đã nằm trên tay (Tích Tụ): `heldTurns = 0` mỗi khi bản lá **vào tay** (rút bù, Chiêm Bài, lá thay trong Đổi Bài); `heldTurns += 1` cuối lượt người chơi cho mọi lá còn trên tay (mục 3.3).

### 4.2 Rút bài
- Rút từng lá một từ đỉnh `drawPile` (phần tử đầu).
- **Không bao giờ xáo chồng bỏ vào chồng bài.** Chồng bỏ là "nghĩa địa".
- Rút khi chồng rỗng: ngừng rút, không lỗi, không event.
- **[GĐ7]** Effect `drawCards { amount }`: rút mù `amount` lá đầu chồng vào tay đơn vị hành động (`cardsDrawn`). Không đếm `cardsChosen` (không phải Chiêm Bài).
- **[GĐ7]** Giới hạn tay: `handSize` (6) chỉ là mốc **rút bù** đầu lượt. Effect lá/nội tại đưa lá vào tay (`drawCards`, Chiêm Bài, `createCard`) được vượt `handSize` nhưng không quá `handLimit` (8) — lá thừa ngưỡng đi thẳng vào chồng bỏ (`cardDiscarded`; `createCard` phát `cardCreated { instanceId: null }`).

### 4.3 Tàn Chiêu
- Khi Hero **ngã**: mọi bản lá của Hero đó **trong `drawPile`** bị Tán Chiêu sang `discardPile` (mục 10.4); mọi lá của Hero đó **trên tay** thành **Tàn Chiêu**. Lá Song Hành thành Tàn Chiêu khi **một trong hai** owner ngã.
- Tàn Chiêu: vẫn chiếm chỗ trên tay, **không đánh được**; lá Tàn Chiêu trên tay bị bỏ cuối lượt (mục 3.3).

### 4.4 Lá Song Hành [GĐ2]
- Lá có `bond: { owners: [heroId, heroId] }` thay cho `ownerId`.
- Khi tạo trận: thêm `copies` bản cho mỗi lá Song Hành có **cả hai** owner trong đội, theo thứ tự trong `cards.json`, id `bond01`, `bond02`… (mỗi bản một `instanceId` riêng, mục 2).
- Luật giải quyết: mục 5.4.

### 4.5 Chi phí
```
chiPhíThựcTế = max(0, cost + các điều chỉnh)
```
Các điều chỉnh (cộng dồn):
- **[Nguyệt Luân mới]** Ưu Đãi Pha: lá mang `tag` được ưu đãi của pha hiện tại **−1** Nguyệt Lực (tối thiểu 0) — bảy pha giảm giá, pha Trăng Non không có ưu đãi giá (mục 7.1). Modifier lệnh `costModifierForTag` (nếu lệnh đang có hiệu lực) cộng dồn theo cùng quy tắc.
- Sau các điều chỉnh theo pha: M06 dạng thăng cấp *Vô Nguyệt* (`firstOwnCardDiscount`) — lá riêng **đầu tiên của Tô Dạ** đánh trong mỗi lượt giảm thêm `amount` (tối thiểu 0, xem mục 8). Không áp cho lá Song Hành.
- **[GĐ7]** `turnDiscount` (Thiên Cơ): cộng thêm vào phần giảm sau cùng, chỉ trong lượt (mục 3.1 bước 11). `tagDiscountOwnCards` (Tự Do): lá của Hero có nội tại đó và mang `tag` khớp −`amount` (tối thiểu 0).

### 4.6 Lá tạo ra [GĐ7]
- Effect `createCard { cardId }` (chỉ trên lá bài và `levelUp.onLevelUp`; luôn vào tay, không có trường `to`): tạo card instance mới của lá `cardId`, chủ là Hero đang giải quyết effect, `instanceId` = `prefixedId` `t<n>` theo bộ đếm `PlayerState.createdCards` — PvE `t1`, `t2`…; nhiều người chơi `p<i>_t<n>` (`02` §2).
- Tay đầy (≥ `handLimit`, mục 4.2) → lá không được tạo, phát `cardCreated { instanceId: null }`.
- Lá được tạo bắt buộc `CardDef.token: true`: không nằm trong pool Hero, không xếp được vào deck, không xuất hiện ở thưởng lượt chơi, không phải lá "+" hay Song Hành. Trong trận nó là lá thường: chiếm chỗ tay, đánh được, thành Tàn Chiêu khi chủ ngã, vào chồng bỏ khi bị bỏ — và **không bao giờ** quay lại chồng rút.

---

## 5. Đánh một lá

### 5.1 Điều kiện hợp lệ
Hành động `playCard` bị **từ chối** (trả về lỗi, state không đổi) nếu:
- Không phải lượt người chơi, hoặc trận đã kết thúc.
- Lá không có trên tay.
- Lá là Tàn Chiêu, hoặc chủ của lá đang Đóng Băng (lá Song Hành: **bất kỳ** owner nào đang Đóng Băng).
- Lá có `requiresBloodMoon: true` và `bloodMoonRounds = 0` **[GĐ2]** (lỗi `"requires blood moon"`).
- `moonPower < chiPhíThựcTế`.
- Mục tiêu không hợp lệ với `target` của lá:

| `target` của lá | Mục tiêu hợp lệ |
|---|---|
| `none` | Không truyền `targetId` |
| `enemy` | 1 kẻ địch còn sống, **không Ẩn Thân** (PvP: cũng nhận Linh Thú còn sống của đối thủ, mục 17.3) |
| `ally` | 1 Hero còn sống (kể cả chính chủ lá) |
| `fallenAlly` **[GĐ7]** | 1 Hero **đã ngã**, chưa từng được Hồi Hồn, của chính người đánh (mục 5.6) |

### 5.2 Giải quyết
1. Trừ `moonPower`.
2. Chuyển lá từ tay sang **vùng đang giải quyết**.
3. Thực hiện lần lượt từng `Effect` trong danh sách (mục 5.3). Sau **mỗi** effect: kiểm tra Hero/kẻ địch ngã, kiểm tra thăng cấp, kiểm tra thắng/thua. Nếu trận kết thúc: **dừng ngay**, bỏ qua effect còn lại.
   - **[GĐ2]** Nếu một đơn vị hành động của lá ngã giữa chừng (ví dụ do Phản Đòn, mục 10.5): **dừng ngay**, bỏ qua các hit và effect còn lại, rồi làm tiếp bước 4–5.
4. Nếu lá có `type: "attack"`:
   - Gỡ **Tích Lực** của chủ lá (nếu có).
   - Gỡ **Ẩn Thân** của chủ lá (nếu có). *Tấn công làm lộ vị trí.*
   - Lá Song Hành: "chủ lá" ở bước này là mọi owner làm đơn vị hành động của ít nhất một effect `damage` trong định nghĩa lá (kể cả trong nhánh `conditional`), xác định từ dữ liệu, không phụ thuộc nhánh đã chạy.
4b. **[GĐ3]** Kích hoạt hook Kỳ Vật `cardPlayed` (§13).
5. Chuyển lá vào `discardPile`.
6. `cardsPlayedThisTurn += 1` (Liên Hoàn, mục 5.3) **[GĐ4b]** — sau hook `cardPlayed`, nên lá đang đánh không tự đếm mình. **[Nguyệt Lệnh]** Nếu lá `type: "attack"` thì `attackCardsThisTurn += 1` (Liên Kích, mục 7.5) — lá đang đánh cũng được đếm, nên hit của lá tấn công **thứ nhất** trong lượt không được cộng bonus.

### 5.3 Tham chiếu mục tiêu trong effect
**Đơn vị hành động** của một effect: chủ lá (Hero), chính kẻ địch đang thực hiện chiêu, hoặc với lá Song Hành là `owners[actor]` (mục 5.4).

| Giá trị `to` | Nghĩa |
|---|---|
| `self` | Đơn vị hành động |
| `chosen` | Mục tiêu được chọn khi đánh lá (hoặc mục tiêu của chiêu kẻ địch) |
| `allEnemies` | Mọi đối thủ còn sống của bên hành động (kể cả đang Ẩn Thân), theo vị trí |
| `allAllies` | Mọi đồng đội còn sống của bên hành động, theo vị trí |
| `owner` **[GĐ7]** | Hero chủ của Linh Thú đang giải quyết effect — chỉ hợp lệ trong `SummonDef.action` (mục 17) |
| `summon` **[GĐ7]** | Linh Thú còn sống của Hero đang giải quyết effect — chỉ hợp lệ trên lá Hero / Song Hành, không trong `SummonDef.action` |

Nếu mục tiêu `chosen` đã ngã trước khi tới effect đó: bỏ qua effect đó.

Condition `selfHpBelow`, `selfHasStatus` xét đơn vị hành động của effect `conditional`.

- **[GĐ4b]** Condition `heldTurnsAtLeast { turns }` (Tích Tụ): đúng khi `heldTurns` của bản lá đang đánh ≥ `turns`; ngoài lá bài (chiêu địch, hook Kỳ Vật) luôn sai.
- **[GĐ4b]** Condition `cardsPlayedThisTurnAtLeast { count }` (Liên Hoàn): đúng khi `cardsPlayedThisTurn ≥ count`.
- **[GĐ7]** Condition `targetSealed`: mục 5.7.

### 5.4 Giải quyết lá Song Hành [GĐ2]
- Mỗi effect có field tùy chọn `actor: 0 | 1` (mặc định 0). Đơn vị hành động của effect = `owners[actor]`. Nó quyết định: `sourceId`, `to: "self"`, phe của `allAllies`/`allEnemies`, condition `self…`, người nhận `stealBuff`, bộ đếm thăng cấp.
- Effect trong `then`/`else` không ghi `actor` thì **kế thừa** `actor` của `conditional` chứa nó.
- **Nội tại thăng cấp không áp** cho lá Song Hành (mục 8). **Bộ đếm thăng cấp vẫn tính** cho đơn vị hành động.
- Điều chỉnh chi phí theo tag của pha trăng áp bình thường.

### 5.5 Chọn Pha [GĐ7]
- Khi người chơi "nợ" Chọn Pha (mục 3.1 bước 11): `pendingChoice = { kind: "chooseMoon", options: [0, 1, 2] }` (giữ pha, tiến 1, tiến 2), event `moonChoiceOpened { options }`, `status = "choosing"`. Co-op: `status` giữ `playerTurn` — lượt đồng đội không bị khóa (mục 16.2); nếu cả hai người đều nợ, chỉ người 0 chọn.
- Action `{ type: "chooseMoon", offset }`: hợp lệ khi `pendingChoice.kind = "chooseMoon"` và `offset` thuộc `options`; `offset` ngoài `options` → `"not a choice option"`; không có lựa chọn đang chờ → `"no pending choice"`; trong khi `choosing`, Action khác bị từ chối (`"choice pending"`).
- Trả lời: `pendingChoice` và `moonChoicePending` được xóa, `status` về `playerTurn`. `offset > 0` chạy `shiftMoon(offset)` với nguồn là Hero có nội tại `chooseMoon` (`moonShifted` cause `"card"`); `offset = 0` giữ nguyên pha, không event.
- Trả lời Chiêm Bài cuối cùng cũng kiểm lại `moonChoicePending` và mở Chọn Pha nếu còn nợ (mục 3.1 bước 12).
- Hết giờ / bot: trả lời mặc định `offset: 0` (`autoChoiceAction`, `02` §3).

### 5.6 Phong Ấn, Hồi Hồn, Kéo Dài Debuff, Xuyên mục tiêu [GĐ7]

**Phong Ấn — effect `sealIntent { to }`** (chỉ trên lá bài). Đặt dấu lên một
đơn vị địch — `UnitState.sealedBy` = id Hero đánh lá.
- PvE / co-op (`to` là kẻ địch): dấu tồn tại tới hết lượt kẻ địch kế tiếp của mục
  tiêu rồi hết, dù có dùng hay không (kẻ địch bị Đóng Băng bỏ cả chuỗi vẫn hết dấu).
  Trong lượt đó, mỗi chiêu mục tiêu thi hành bị tước **mọi effect không phải
  `damage`** — chiêu chỉ còn phần damage. Mỗi chiêu bị tước ít nhất một effect phát
  `sealStripped { unitId, refId }` (`refId` = id chiêu) và +1 `intentsSealed` cho
  Hero đã đặt dấu.
- PvP (`to` là đơn vị đối thủ — Hero hoặc Linh Thú): cùng cơ chế — dấu tồn tại tới
  hết lượt kế của ghế đó; mọi lá mục tiêu (Hero bị dấu) đánh trong lượt đó chỉ còn
  effect `damage`, và hành động của Linh Thú bị dấu cũng bị tước hiệu ứng còn lại.
  Mỗi lá/hành động bị tước ít nhất một effect phát `sealStripped` (`refId` =
  `instanceId` của lá hoặc `summonId`) và +1 `intentsSealed` cho người đặt dấu.
- Nội tại `sealExtraFirstPerTurn`: lần Phong Ấn **đầu tiên mỗi lượt** của Hero có
  nội tại này còn đặt dấu lên đơn vị địch còn sống khác có vị trí nhỏ nhất — dùng
  cờ `HeroState.firstSealUsedThisTurn`, đặt lại đầu lượt người chơi.
- Nội tại `sealWeakens { amount }`: mục tiêu nhận Suy Yếu `amount` (PvP ×2 theo
  quy ước vòng/lượt mục 15.3).
- Khi thi hành lượt kẻ địch (mục 9.3): `lastIntentIds` = id các chiêu trong chuỗi đã
  lên (`plannedIntents`).

**Hồi Hồn — effect `revive { ratio; to: "chosen" | "lastFallen" }`.**
- Lá bài dùng `target: "fallenAlly"` (mục 5.1) cùng `to: "chosen"`.
- Hero được chọn sống lại với `hp = max(1, floor(ratio × maxHp))`, `armor = 0`, không
  trạng thái; giữ `leveledUp` và bộ đếm thăng cấp; đánh dấu `HeroState.revived = true`
  (chặn Hồi Hồn lần hai trong cùng trận). Event `heroRevived { heroId, hp }`.
- Các bản lá của Hero đó đã bị Tán Chiêu (`cardsPurged`, mục 10.4) được **xáo lại vào
  `drawPile`** bằng RNG của trận (`PlayerState.purged[heroId]` lưu danh sách lúc gỡ, xóa
  sau khi xáo lại); phát `deckShuffled`.
- `to: "lastFallen"` (chỉ dùng trong `levelUp.onLevelUp` / `altLevelUp.onLevelUp`, không
  trên lá bài): chọn Hero **ngã gần nhất của cùng người chơi, chưa từng được Hồi Hồn**,
  theo `PlayerState.fallenOrder` (id Hero theo thứ tự ngã).
- Không có Hero hợp lệ (`to: "chosen"` không có mục tiêu, hoặc `to: "lastFallen"` không
  tìm được ai) → effect không có tác dụng, không phát event.

**Kéo Dài Debuff — effect `extendDebuffs { amount; to }`.**
- Cộng `amount` vào **mọi debuff có thời hạn** (mục 6.3) hiện có trên mỗi mục tiêu trong
  `to` (×2 trong PvP, theo luật thời hạn chung mục 15.3). Mục tiêu không có debuff thời
  hạn nào → không có tác dụng.

**Xuyên mục tiêu.**
- "Hàng sau": kẻ địch còn sống không đứng ở vị trí nhỏ nhất trong các kẻ địch còn sống
  (PvP: "vị trí" là vị trí Hero đối thủ). Bộ đếm `backRowHits` +1 mỗi hit từ lá tấn công
  của Hero có bộ đếm đó trúng một kẻ địch hàng sau.
- Nội tại `pierceOwnAttacks`: mỗi effect `damage` với `to: "chosen"` từ lá của Hero có nội
  tại này gọi thêm `dealDamage` với **cùng `amount` gốc** lên kẻ địch còn sống có vị trí
  **ngay sau** mục tiêu chính (nếu có) — tính đơn vị "phía sau" **trước** khi hit vào mục
  tiêu chính giải quyết, để mục tiêu chính ngã không làm "người phía sau" đổi. Hệ số của
  mục tiêu mới (Suy Yếu của nguồn, Dễ Vỡ, Đánh Dấu…) vẫn áp dụng bình thường theo công
  thức mục 10.1.
- Nội tại `firstHitMarks { rounds }`: lượt damage **đầu tiên mỗi lượt** từ lá tấn công của
  Hero có nội tại này, nếu trúng một kẻ địch (còn sống sau đòn), áp Đánh Dấu `rounds` vòng
  (×2 trong PvP) lên kẻ địch đó. Dùng lại cờ "lượt damage đầu tiên trong lượt" đã có từ
  Hàn Kiếm (F03, GĐ4e, mục 8) — **không** phải trạng thái mới.

---

### 5.7 Damage theo lối chơi đặc trưng [GĐ7]

Lá của Hero hỗ trợ gây damage theo cơ chế riêng của Hero đó (playtest 7b: đội 2 support
thiếu damage).

- Effect `scaledDamage { per, amount, base?, divisor?, max?, to }`: với **mỗi** mục tiêu,
  damage gốc = `base + floor(stat × amount / divisor)` (`base` mặc định 0, `divisor` 1),
  tối đa `max` nếu có; `stat` tính **lúc hit**, rồi qua công thức damage bình thường
  (mục 10.1). Mục tiêu đã ngã bị bỏ qua. Tính là damage như `damage` (kết liễu bằng lá, Phong
  Ấn giữ lại, dọn Cường Hóa / Ẩn Thân của lá tấn công).
- `per` — chỉ số của **người chơi sở hữu đơn vị hành động**:
  - `cardsPlayedThisTurn`: số lá đã đánh **trước** lá này trong lượt (cộng `comboBonus` như Liên Hoàn).
  - `selfArmor`: giáp hiện có của đơn vị hành động.
  - `moonPower`: Nguyệt Lực hiện có của người chơi (sau khi trả cost lá này).
  - `alliesAtFullHp`: số Hero còn sống đầy HP của người chơi.
  - `targetDebuffs`: số debuff (mục 6.3) đang có trên mục tiêu.
  - `alliesArmor`: tổng giáp các Hero còn sống của người chơi.
  - `alliesRegen`: tổng Hồi Phục các Hero còn sống của người chơi.
- Condition `targetSealed`: đúng khi mục tiêu đã chọn còn sống và đang mang dấu Phong Ấn
  (`sealedBy`, mục 5.6).

### 5.8 Hủy Bài — `discardCard` [Nguyệt Lệnh]

Action `{ type: "discardCard", instanceId }` — bỏ một lá trên tay mà không đánh
để đổi lấy Nguyệt Lực.

- **Chỉ hợp lệ** khi `status = "playerTurn"`, lệnh đang có hiệu lực có
  `discardForMoonPower` (Xả Thân, mục 7.5), lá nằm trên tay người chơi đó, và
  `PlayerState.discardsThisTurn < perTurn` của lệnh. Ngược lại: từ chối, state
  không đổi.
- Kết quả: lá vào `discardPile` → `cardDiscarded { instanceIds; player? }`
  (không có trường `reason`); rồi `moonPower += moonPower` của lệnh →
  `moonPowerChanged`; `discardsThisTurn += 1` (đặt lại đầu lượt, mục 3.1).
- Lá Tàn Chiêu cũng hủy được (nó vẫn chiếm tay, mục 4.3). Xả Thân và Đoạn
  Tuyệt thuộc cùng bể lệnh của pha 5 nên **không bao giờ** đồng thời có hiệu
  lực — mỗi pha chỉ có một lệnh được bốc (mục 7.5).
- PvP / co-op: `discardCard` là hành động của **ghế đang tới lượt** (mục 15.6,
  16.2); lá phải nằm trên tay ghế đó.

### 5.9 Huyết Tế — `bloodPact` [Nguyệt Lệnh]

Action `{ type: "bloodPact", heroId }` — một lần mỗi lượt, đổi HP lấy lá.

- **Chỉ hợp lệ** khi `status = "playerTurn"`, lệnh đang có hiệu lực có
  `bloodPact { hp, draw }` (Huyết Tế, mục 7.5), `PlayerState.bloodPactUsed`
  chưa được đặt trong lượt này, `heroId` là Hero **của người chơi đó**, còn
  sống, và `hp > hp` của lệnh. Ngược lại: từ chối, state không đổi.
- Kết quả: Hero đó **mất `hp` HP** — `hpLost { cause: "bloodPact" }`: không qua
  giáp, không phải đòn tấn công, không có đơn vị nguồn (mục 10.3); rồi
  `drawCards draw` (tuân `handLimit`, mục 4.2) → `cardsDrawn`; đặt
  `bloodPactUsed` (đặt lại đầu lượt, mục 3.1).
- HP mất tính vào bộ đếm thăng cấp `damageTaken` của Hero đó (mục 8), như mọi
  mất HP khác.

## 6. Trạng thái

### 6.1 Danh sách

| ID | Tên | Loại | Hiệu ứng | Khi áp thêm |
|---|---|---|---|---|
| `stealth` | Ẩn Thân | Thời hạn | Không thể bị chọn làm mục tiêu đơn. Bị gỡ khi chủ đánh lá tấn công | Cộng thời hạn |
| `taunt` | Khiêu Khích | Thời hạn | Mọi đòn **đơn mục tiêu** của phe địch buộc phải nhắm vào đơn vị này | Cộng thời hạn |
| `weak` | Suy Yếu | Thời hạn | Damage gây ra ×0.75 | Cộng thời hạn |
| `vulnerable` | Dễ Vỡ | Thời hạn | Damage nhận vào ×1.5 | Cộng thời hạn |
| `mark` | Đánh Dấu | Thời hạn | Nhận thêm **+3** damage từ đòn tấn công của **Hero đã đánh dấu** (`sourceId`) | Cộng thời hạn, cập nhật `sourceId` |
| `burn` | Thiêu Đốt | Cộng dồn | Đầu lượt phe mình: mất HP = số tầng (**bỏ qua giáp**), rồi −1 tầng | Cộng tầng |
| `regen` | Hồi Phục | Cộng dồn | Đầu lượt phe mình: hồi HP = số tầng (áp hệ số hồi máu của lệnh đang có hiệu lực, mục 7.5), rồi −1 tầng | Cộng tầng |
| `strength` | Sức Mạnh | Giá trị vĩnh viễn | +N damage cho mọi đòn tấn công | Cộng giá trị |
| `empower` | Tích Lực | Dùng một lần | +N damage cho **mỗi lượt damage** của lá tấn công kế tiếp của chủ; gỡ sau khi lá đó giải quyết xong | Cộng giá trị |
| `freeze` | Đóng Băng | Dùng một lần | Hero: không đánh được lá của mình trong lượt người chơi kế tiếp. Kẻ địch: bỏ qua cả chuỗi chiêu trong lượt kẻ địch kế tiếp và Dự Trữ về 0 (mục 9.3) | Không có tác dụng nếu đang Đóng Băng |
| `reflect` | Phản Đòn **[GĐ2]** | Theo giáp | Khi nhận damage: nguồn gây damage mất HP = giá trị (mục 10.5). Bị gỡ **cùng lúc với giáp** (mục 6.4), không giảm theo vòng | Cộng giá trị |
| `guard` | Hộ Vệ **[GĐ7]** | Thời hạn | Đòn đơn mục tiêu nhắm Hero này chuyển sang Hero `sourceId` nếu còn sống (mục 9.3.1 bước 1b); không đặt lên chính mình | Đặt lại thay `sourceId` và thời hạn |
| `charm` | Mê Hoặc **[GĐ7]** | Số lượt (không giảm theo vòng) | Kẻ địch bị Mê Hoặc thi hành chiêu đơn mục tiêu → đánh kẻ địch khác thay vì Hero, trừ 1 lượt (mục 9.3.1 bước 0); PvP: Hero bị Mê Hoặc đánh đồng đội (mục 15.5). Không có tác dụng trên Hero trong PvE / co-op | Cộng giá trị, giữ `sourceId` (người gây Mê Hoặc) |

Trạng thái bị gỡ khi thời hạn/số tầng/giá trị về 0.

### 6.2 Thời hạn
- Thời hạn tính bằng **vòng**. Mọi trạng thái loại "Thời hạn" giảm 1 ở **cuối vòng** (mục 9.4).
- Ví dụ: áp Suy Yếu 1 lên kẻ địch trong lượt người chơi → có tác dụng trong lượt kẻ địch cùng vòng → hết ở cuối vòng.

### 6.3 Buff và debuff
- **Debuff** (bị Giải Trừ gỡ): `weak`, `vulnerable`, `burn`, `freeze`, `mark`, `charm` **[GĐ7]**.
- **Buff**: `stealth`, `taunt`, `regen`, `strength`, `empower`, `reflect`, `guard` **[GĐ7]**.

### 6.4 Giáp
- `armor` là số, không phải trạng thái.
- Giáp của Hero bị xóa ở **đầu lượt người chơi**; giáp của kẻ địch bị xóa ở **đầu lượt kẻ địch**. Phản Đòn bị gỡ cùng lúc **[GĐ2]**.
- Nhận giáp: `armor += floor(amount × hệ số giáp của lệnh đang có hiệu lực)` (lệnh Huyền Giáp, mục 7.5); không có lệnh → hệ số 1.
- **[Nguyệt Lệnh]** Lệnh **Giữ Giáp** (`keepArmor`): bỏ qua bước xóa giáp / gỡ Phản Đòn ở đầu lượt của **cả hai phe** (mục 3.1 bước 1, mục 9.3).

### 6.5 Cướp buff (`stealBuff`) [GĐ2]
- Effect `stealBuff { count }`: chuyển tối đa `count` **buff** từ mục tiêu `chosen` sang đơn vị hành động, lấy theo thứ tự trong `statuses[]` của mục tiêu.
- Với mỗi buff: gỡ khỏi mục tiêu (`statusRemoved`), rồi áp cho đơn vị hành động với cùng giá trị theo cột "Khi áp thêm" (**không** cộng thêm `stealthExtraRounds` của lệnh Bóng Mờ, mục 7.5) → `statusApplied` với giá trị sau khi gộp.
- Mục tiêu không có buff: không làm gì, không phát event.

---

## 7. Nguyệt Luân [Nguyệt Luân mới]

Mỗi trận có một **lịch trăng riêng**: pha khởi đầu được bốc ngẫu nhiên tất định
theo seed và mỗi pha mang **một Nguyệt Lệnh** được bốc trong 3 lệnh của pha đó
(mục 7.6) — không còn pha trống và không đoán trước được "vòng nào là trăng gì".

Hiệu ứng pha (ưu đãi tag + lệnh đang được bốc) áp cho **cả hai phe**, trừ khi
hiệu ứng chỉ nói về tag lá bài (vốn chỉ người chơi có). "Mỗi bên" nghĩa là: PvE /
co-op gồm người chơi (mọi ghế) và phe kẻ địch; PvP gồm từng người chơi (mục 15).

### 7.1 Các pha và Ưu Đãi Pha

| Chỉ số | ID | Tên | Ưu đãi tag (`tagBonus`, cố định) |
|---|---|---|---|
| 0 | `new` | 🌑 Trăng Non | Lá tag `assassin`: damage **×1.5** |
| 1 | `waxingCrescent` | 🌒 Lưỡi Liềm Đầu | Lá tag `scheme`: chi phí **−1** (tối thiểu 0) |
| 2 | `firstQuarter` | 🌓 Bán Nguyệt | Lá tag `control`: chi phí **−1** (tối thiểu 0) |
| 3 | `waxingGibbous` | 🌔 Trăng Khuyết Đầu | Lá tag `attack`: chi phí **−1** (tối thiểu 0) |
| 4 | `full` | 🌕 Trăng Tròn | Lá tag `harmony`: chi phí **−1** (tối thiểu 0) |
| 5 | `waningGibbous` | 🌖 Trăng Khuyết Cuối | Lá tag `forbidden`: chi phí **−1** (tối thiểu 0) |
| 6 | `lastQuarter` | 🌗 Hạ Huyền | Lá tag `ward`: chi phí **−1** (tối thiểu 0) |
| 7 | `waningCrescent` | 🌘 Lưỡi Liềm Cuối | Lá tag `moon`: chi phí **−1** (tối thiểu 0) |

- Ưu đãi tag là modifier cố định của pha (`tagBonus` trong `moon-phases.json`,
  `02` §1.7); **không còn** modifier `healMultiplier` / `armorMultiplier` /
  `stealthDurationBonus` cố định — các hiệu ứng đó chuyển thành lệnh (mục 7.5).
- Tag `heal` không có ưu đãi riêng.
- **[GĐ3]** `activeModifiers` = `phaseModifiers` (ưu đãi tag + modifier của lệnh
  đang bốc của pha hiện tại) + modifier của mọi Kỳ Vật / Nguyệt Bảo đang có
  (mục 13.4). Tra cứu qua `phaseModifiers` / `decreeModifier` / `currentDecree`
  (mục 7.6).

### 7.2 Tiến pha
- Cuối mỗi vòng: `moonIndex = (moonIndex + 1) mod 8`, rồi `enterPhase` chạy cho
  pha mới (mục 7.6 — Nguyệt Chiếu gỡ Ẩn Thân nếu vào Trăng Tròn).
- Pha khởi đầu do `rollMoon` bốc (mục 7.6), không còn cố định.

### 7.3 Đổi Vận
- Effect `shiftMoon(amount)`: `moonIndex = (moonIndex + amount) mod 8` (xử lý số âm đúng: `((i + a) % 8 + 8) % 8`).
- Có tác dụng **ngay lập tức**: các effect và lá đánh sau đó trong lượt dùng pha mới; `enterPhase` chạy cho pha mới (Nguyệt Chiếu, mục 7.5).
- Không ảnh hưởng chuỗi chiêu kẻ địch đã lên.

### 7.4 Huyết Nguyệt [GĐ2]
- `bloodMoonRounds > 0` → trận ở trạng thái Huyết Nguyệt **chồng lên** pha hiện tại (hai hiệu ứng cùng áp dụng). Trận bắt đầu với `bloodMoonRounds = 0`.
- Effect `bloodMoon(rounds)`: `bloodMoonRounds = max(hiện tại, rounds)`. Nếu giá trị đổi: phát `bloodMoonChanged { rounds, cause: "card" }`.
- **Mở khóa lá:** lá có `requiresBloodMoon: true` (chỉ hợp lệ trên lá có tag `forbidden`) chỉ đánh được khi `bloodMoonRounds > 0` (mục 5.1). Lá `forbidden` khác đánh được mọi lúc.
- **Mất HP:** đầu lượt người chơi, mỗi Hero còn sống mất 2 HP (`hpLost`, cause `"bloodMoon"`) — bước 3.1.4.
- **Giảm:** cuối vòng, sau khi tiến pha và trước khi kẻ địch lên chuỗi (mục 9.4): giảm 1, phát `bloodMoonChanged { rounds, cause: "roundEnd" }`.
- Bật Huyết Nguyệt giữa lượt **không** đổi chuỗi chiêu kẻ địch đã lên.
- Kẻ địch có thể có chiêu riêng cho Huyết Nguyệt (`bloodMoonOverride`, mục 9.1).

Ví dụ — `bloodMoon(2)` đánh trong lượt người chơi vòng N:

| Thời điểm | `bloodMoonRounds` |
|---|---|
| Sau khi đánh (vòng N) | 2 — lá cần Huyết Nguyệt đánh được ngay |
| Cuối vòng N | 1 — chuỗi vòng N+1 được lên trong Huyết Nguyệt |
| Đầu lượt vòng N+1 | 1 — mỗi Hero còn sống mất 2 HP |
| Cuối vòng N+1 | 0 — hết |

### 7.5 Nguyệt Lệnh

Mỗi pha có **đúng 3 lệnh** trong dữ liệu; lúc tạo trận `rollMoon` bốc 1 lệnh cho
mỗi pha, lưu vào `CombatState.moonDecrees` (mục 7.6). Lệnh của pha `i` có hiệu
lực khi `moonIndex = i`; các lệnh "đầu lượt" xét pha **tại thời điểm** đầu lượt
đó. Lệnh áp cho cả hai phe; mất HP do lệnh (`hpLost` cause `"decree"` /
`"bloodPact"`) không qua giáp, không phải đòn tấn công, không có đơn vị nguồn
(mục 10.3). Các loại modifier chỉ hợp lệ trong `decrees` nằm trong
`DECREE_ONLY_MODIFIERS` (`02` §1.7).

| Pha | Id | Tên | Hiệu ứng | Modifier |
|---|---|---|---|---|
| 0 Trăng Non | `am_da` | Ám Dạ | Mọi hồi máu (kể cả Hồi Phục) **×0.5**, làm tròn xuống | `healMultiplier 0.5` |
| | `bong_mo` | Bóng Mờ | Ẩn Thân được áp **+1** thời hạn | `stealthDurationBonus 1` |
| | `tap_kich` | Tập Kích | Hit damage **đầu tiên** mỗi lượt của mỗi bên **+3** (tính cả lá bài lẫn chiêu địch; đòn nhiều hit chỉ hit đầu được cộng; hit của Linh Thú tính cho ghế chủ). Theo dõi bằng `CombatState.firstHitKeys`: khóa `"p<seat>"` / `"enemy"`, xóa khóa của một bên khi bắt đầu lượt bên đó | `firstHitBonus { amount: 3 }` |
| 1 Lưỡi Liềm Đầu | `nguyet_sinh` | Nguyệt Sinh | Người chơi: quỹ đầu lượt **+1** Nguyệt Lực (mục 3.1 bước 7). Kẻ địch: chuỗi lên trong pha này có quỹ **+1** (mục 9.2) | `turnMoonPowerBonus { amount: 1 }` |
| | `khai_tri` | Khai Trí | Đầu lượt người chơi, sau rút bù: rút thêm **1** lá (tuân `handLimit`, mục 4.2) | `turnStartDraw { amount: 1 }` |
| | `mam_song` | Mầm Sống | Đầu lượt mỗi bên: mọi đơn vị còn sống bên đó (kể cả Linh Thú) hồi **2** HP — hồi phẳng, **không** nhân hệ số hồi. Người chơi: mục 3.1 bước 5; kẻ địch: mục 9.3 | `turnStartHeal { amount: 2, target: "all" }` |
| 2 Bán Nguyệt | `thien_binh` | Thiên Bình | Debuff **có thời hạn** mới được áp **+1** thời hạn (mọi nguồn) — chỉ `weak`, `vulnerable`, `mark`; PvP cộng `+1 × 2` (mục 15.3) | `debuffDurationBonus { amount: 1 }` |
| | `the_can` | Thế Cân | PvE / co-op: **một lần mỗi vòng**, đầu lượt người chơi ghế 0 — Hero còn sống HP cao nhất của **mỗi ghế** và kẻ địch còn sống HP cao nhất bị Suy Yếu 1. PvP: đầu lượt mỗi ghế, Hero HP cao nhất **của ghế đó** bị Suy Yếu 2. Hòa HP → vị trí nhỏ nhất | `turnStartStatusOnHighestHp { status: "weak", amount: 1 }` |
| | `the_thu` | Thế Thủ | Mỗi đơn vị: hit damage **đơn mục tiêu** đầu tiên nó nhận trong mỗi vòng **−3** (tối thiểu 0; trừ trước giáp). Theo dõi `UnitState.shieldUsed`, xóa cuối vòng (mục 9.4) | `firstSingleHitReduction { amount: 3 }` |
| 3 Trăng Khuyết Đầu | `lien_kich` | Liên Kích | Lá tấn công **từ lá thứ hai trở đi** trong lượt (đếm `PlayerState.attackCardsThisTurn`, mục 5.2 bước 6): mỗi hit **+2**. Kẻ địch: chiêu `attack` / `attackDefend` được **+2** mỗi hit nếu **trước nó** trong cùng chuỗi đã thi hành một chiêu `attack` / `attackDefend` (mục 9.3) | `attackChainBonus { amount: 2 }` |
| | `cuong_nguyet` | Cuồng Nguyệt | Sức Mạnh và Tích Lực được áp **gấp đôi** giá trị | `buffMultiplier { statuses: ["strength","empower"], multiplier: 2 }` |
| | `pha_giap` | Phá Giáp | Giáp nhận được **×0.5**, làm tròn xuống | `armorMultiplier 0.5` |
| 4 Trăng Tròn | `vien_nguyet` | Viên Nguyệt | Mọi hồi máu (kể cả Hồi Phục) **×2** | `healMultiplier 2` |
| | `nguyet_chieu` | Nguyệt Chiếu | Khi `moonIndex` đổi **thành** Trăng Tròn (`enterPhase`: cuối vòng, `shiftMoon`, Chọn Pha, hoặc trận bắt đầu ở Trăng Tròn): gỡ Ẩn Thân của mọi đơn vị. Trong pha: áp Ẩn Thân không có tác dụng | `stealthSuppressed` |
| | `doan_vien` | Đoàn Viên | Đầu lượt mỗi bên: đơn vị còn sống **tỉ lệ HP thấp nhất** bên đó (hòa → vị trí nhỏ nhất; tính cả Linh Thú) hồi **5** HP — hồi phẳng, không nhân hệ số hồi; cùng mốc với Mầm Sống | `turnStartHeal { amount: 5, target: "lowestRatio" }` |
| 5 Trăng Khuyết Cuối | `xa_than` | Xả Thân | Người chơi được **Hủy Bài** tối đa **2** lá trên tay mỗi lượt (action `discardCard`, mục 5.8); mỗi lá hủy **+1** Nguyệt Lực | `discardForMoonPower { perTurn: 2, moonPower: 1 }` |
| | `doan_tuyet` | Đoạn Tuyệt | Mỗi lá rời tay vào chồng bỏ **mà không được đánh** (Hủy Bài, Tàn Chiêu cuối lượt, lá tràn `handLimit`) làm đơn vị đối phương còn sống HP thấp nhất của chủ lá **mất 2 HP** (`hpLost` cause `"decree"`) | `discardDamage { amount: 2 }` |
| | `huyet_te` | Huyết Tế | Mỗi lượt 1 lần, người chơi chọn một Hero còn sống của mình có HP > 3: Hero đó mất **3** HP, người chơi rút **2** lá (action `bloodPact`, mục 5.9) | `bloodPact { hp: 3, draw: 2 }` |
| 6 Hạ Huyền | `huyen_giap` | Huyền Giáp | Giáp nhận được **×1.5** | `armorMultiplier 1.5` |
| | `phan_chan` | Phản Chấn | Phản Đòn gây **gấp đôi** (mục 10.5) | `reflectMultiplier { multiplier: 2 }` |
| | `giu_giap` | Giữ Giáp | Bước xóa giáp và gỡ Phản Đòn đầu lượt bị bỏ qua (mục 3.1 bước 1, mục 9.3) — **cả hai phe** | `keepArmor` |
| 7 Lưỡi Liềm Cuối | `chiem_tinh` | Chiêm Tinh | Mọi Chiêm Bài của người chơi xem thêm **2** lá (cùng cơ chế `chooseCardExtraLook` của nội tại) | `chooseCardExtraLook { amount: 2 }` |
| | `boi_nguyet` | Bói Nguyệt | Đầu lượt người chơi: Chiêm Bài **3** miễn phí — mở **sau** Vạn Kim và **trước** Chọn Pha (mục 3.1 bước 12, cờ `omenPending`) | `freeChooseCard { look: 3 }` |
| | `luan_hoi` | Luân Hồi | Cuối lượt người chơi (sau khi bỏ Tàn Chiêu): tối đa **2** lá **mới nhất** trong chồng bỏ về **đáy** chồng rút — lá mới nhất nằm dưới cùng → `cardsRecycled` (mục 3.3 bước 1) | `recycleDiscard { count: 2 }` |

### 7.6 Bốc lệnh và pha khởi đầu

Lúc tạo trận (`createCombat` / `createCoopCombat` / `createPvpCombat`), ngay sau
khi xáo chồng bài (`deckShuffled`), **`rollMoon`** bốc từ một **luồng RNG phụ**
tính từ `rngState` lúc gọi: `seed = (rngState ^ 0x6d2b79f5) >>> 0`, rồi lặp
`nextRandom` trên luồng phụ — mỗi lần bốc lấy `floor(value × n)`. Luồng phụ
**không** đổi `state.rngState`, nên thứ tự xáo bài và lên chuỗi kẻ địch không bị
ảnh hưởng; kết quả vẫn tất định theo seed của trận (T315).

1. Bốc pha khởi đầu: `moonIndex` (n = 8) — không còn cố định ở Lưỡi Liềm Đầu.
2. Với pha 0 → 7 theo thứ tự: bốc 1 trong 3 lệnh của pha → `state.moonDecrees`
   (8 id, theo chỉ số pha).
3. Phát event `moonDecreesRolled { moonIndex, decrees }`.
4. `enterPhase` chạy cho pha khởi đầu (Nguyệt Chiếu gỡ Ẩn Thân nếu trận bắt đầu
   ở Trăng Tròn).

**Ghi đè (Cốt truyện):** `CombatSetup.start.moonIndex` thay pha khởi đầu;
`start.decrees?: Partial<Record<MoonPhaseId, string>>` thay lệnh của các pha
được nêu. **RNG vẫn bốc đủ** rồi mới ghi đè, để thứ tự RNG không phụ thuộc có
`start` hay không.

`enterPhase(data, state, events)` chạy mỗi khi `moonIndex` đổi **thành** một pha
(cuối vòng, `shiftMoon`, Chọn Pha) hoặc ở pha khởi đầu; hiện chỉ lệnh
`stealthSuppressed` (Nguyệt Chiếu) dùng điểm này — trong pha đó áp Ẩn Thân
không có tác dụng.

Tra cứu (trong `moon.ts`): `currentDecree` → lệnh đang bốc của pha;
`phaseModifiers` → `tagBonus` của pha + `modifiers` của lệnh đó;
`decreeModifier(type)` → modifier `type` của lệnh pha hiện tại (nếu có).
`activeModifiers` (mục 13.4) đọc phần pha qua `phaseModifiers`.

---

## 8. Thăng cấp Hero

- Mỗi Hero có 1 bộ đếm, 1 ngưỡng, 1 nội tại thăng cấp (dữ liệu trong `heroes.json`).
- Khi bộ đếm ≥ ngưỡng: Hero **thăng cấp ngay** (sau effect vừa giải quyết), phát event `heroLeveledUp`. Mỗi Hero thăng cấp tối đa **1 lần/trận**. Hero đã ngã không thăng cấp.

| Hero | Bộ đếm (`counter`) | Cách tăng | Ngưỡng | Nội tại (`passive`) | Hiệu lực |
|---|---|---|---|---|---|
| M05 Hoắc Liệt | `damageTaken` | Cộng số HP **thực sự mất** từ mọi nguồn (kể cả `loseHp` tự gây, Thiêu Đốt). Phần bị giáp chặn không tính | 15 | `attackDamageBonus(3)`: mọi lượt damage từ lá tấn công của M05 +3 | Ngay lập tức |
| F04 Ôn Như Ý | `turnsWithAllyRegen` | Ở bước 3.1.2: nếu có ít nhất 1 Hero còn sống đang có `regen` → +1 | 3 | `regenSpreadsToAllAllies`: khi lá của F04 áp `regen`, áp cùng số tầng cho **mọi Hero còn sống** | Ngay lập tức |
| M06 Tô Dạ | `enemiesKilled` | +1 mỗi kẻ địch ngã do damage từ lá của M06 | 1 | `firstOwnCardDiscount(3)`: lá riêng đầu tiên của Tô Dạ mỗi lượt giảm 3 Nguyệt Lực (tối thiểu 0, áp sau giảm cost theo pha) | Từ lượt người chơi kế tiếp |
| F03 Tần Sương **[GĐ2]** | `freezesApplied` | +1 mỗi lần một effect có đơn vị hành động là F03 **thực sự áp** `freeze` lên một mục tiêu (mục tiêu đang Đóng Băng thì không tính) | 3 | `doubleDamageVsFrozen`: damage từ lá của F03 lên mục tiêu đang `freeze` **×2** (mục 10.1) | Ngay lập tức |
| F02 Diệp Linh Lung **[GĐ2]** | `buffsStolen` | +1 mỗi buff được chuyển bởi `stealBuff` có đơn vị hành động là F02; **[GĐ4b]** +1 mỗi effect Đoạt Nguyệt (`drainMoonPower` có `steal`) có đơn vị hành động là F02 lấy được ≥ 1 Nguyệt Lực (Tỏa Nguyệt không tính) | 3 | `stealBonus`: mỗi buff F02 cướp bằng lá của F02 được thêm **+1** giá trị | Ngay lập tức |
| M01 Tạ Vân Chiêu **[GĐ7]** | `schemeCardsPlayed` | +1 mỗi lá `scheme` do **bất kỳ Hero nào của người chơi** đánh (bộ đếm cả người chơi) | 7 | `cheapestCardDiscount(2)` — *Thiên Cơ*: đầu lượt, lá rẻ nhất trên tay −2 Nguyệt Lực trong lượt đó (`turnDiscount`) | Đầu lượt người chơi kế tiếp |
| M02 Lục Hàn Phong **[GĐ7]** | `hitsIntercepted` | +1 mỗi đòn đơn mục tiêu bị chuyển sang M02 qua `guard` (mục 9.3.1 bước 1b) | 3 | `armorPerTurn(4)` — *Thiết Bích*: đầu lượt nhận 4 giáp | Đầu lượt người chơi kế tiếp |
| M03 Mặc Tử Du **[GĐ7]** | `cardsChosen` | +1 mỗi lá được chọn qua Chiêm Bài của **người chơi** (bộ đếm cả người chơi) | 4 | `freeChooseCardPerTurn(look 4)` — *Vạn Kim*: đầu lượt mở Chiêm Bài 4 miễn phí (mục 3.1 bước 12) | Đầu lượt người chơi kế tiếp |
| M04 Bùi Thanh Minh **[GĐ7]** | `hpHealed` | Cộng số HP **thực sự hồi** bởi lá của M04 | 20 | `healCleanses` — *Thần Y*: sau mỗi effect hồi máu của lá M04, Hero được hồi được giải trừ (dùng lại nội tại của F04 *Tĩnh Tâm*) | Ngay lập tức |
| M07 Ninh An **[GĐ7]** | `turnsSurvived` | +1 đầu mỗi lượt người chơi khi M07 còn sống, **từ vòng 2** trở đi | 4 | `randomBuffPerTurn` — *Huyết Mạch*: đầu lượt nhận 1 buff ngẫu nhiên trong `combatConfig.levelUpRandomBuffs` (RNG có seed) | Đầu lượt người chơi kế tiếp |
| M08 Khương Tịch **[GĐ7]** | `moonShifts` | +1 mỗi lá của M08 có effect `shiftMoon` | 3 | `chooseMoon` — *Quan Tinh*: đầu lượt mở **Chọn Pha** (mục 5.5) | Đầu lượt người chơi kế tiếp |
| M10 Chu Quyết **[GĐ7]** | `studyPoints` | +1 đầu mỗi lượt người chơi khi còn sống, +1 mỗi lá `scheme` của M10 | 5 | `firstSchemeRepeats` — *Bác Học*: lá `scheme` **đầu tiên** mỗi lượt của M10 giải quyết 2 lần (lượt thứ nhất bỏ mọi effect `chooseCard`, lượt thứ hai đầy đủ) | Ngay lập tức |
| F01 Thẩm Nguyệt Hoa **[GĐ7]** | `fullMoonsSeen` | +1 đầu lượt người chơi khi pha là `full` | 1 | `none` — *Nguyệt Chủ*: nội tại trống; `levelUp.onLevelUp` = `createCard` lá *Nguyệt Hoa Chiếu Thế* vào tay (mục 4.6) | Ngay lập tức |
| F08 Phượng Chiêu Dung **[GĐ7]** | `forbiddenHpLost` | Cộng HP F08 thực mất bởi `loseHp` trong lá `forbidden` của chính F08 | 12 | `forbiddenNoSelfHpLoss` — *Huyết Phượng*: `loseHp` nhắm `self` trong lá `forbidden` của F08 bị bỏ qua | Ngay lập tức |
| F05 Hạ Chi **[GĐ7]** | `backRowHits` | +1 mỗi hit từ lá tấn công của F05 trúng kẻ địch hàng sau (mục 5.6) | 4 | `pierceOwnAttacks` — *Xuyên Vân Tiễn*: đòn đơn mục tiêu của F05 đánh thêm kẻ địch còn sống đứng ngay sau mục tiêu, cùng damage gốc | Ngay lập tức |
| F06 Lam Khê **[GĐ7]** | `charmsApplied` | +1 mỗi lần một effect có đơn vị hành động là F06 áp `charm` lên một kẻ địch | 2 | `charmMastery { extraCharges: 1, damageMultiplier: 1.5 }` — *Kinh Hồng Vũ*: Mê Hoặc do F06 gây thêm 1 lượt; đòn bị đổi mục tiêu của kẻ địch đó ×1.5 khi F06 còn sống | Ngay lập tức |
| F07 Cố Uyển **[GĐ7]** | `intentsSealed` | +1 mỗi chiêu bị tước hiệu ứng bởi dấu Phong Ấn do F07 đặt (mục 5.6) | 3 | `sealExtraFirstPerTurn` — *Sử Bút*: lần Phong Ấn đầu tiên mỗi lượt của F07 đặt dấu thêm lên 1 kẻ địch khác (vị trí nhỏ nhất) | Đầu lượt người chơi kế tiếp |
| F09 Tiểu Mãn **[GĐ7]** | `summonsMade` | +1 mỗi effect `summon` có đơn vị hành động là F09 | 7 | `awakenSummons` — *Thỏ Ngọc Thức Tỉnh*: Linh Thú của F09 dùng `awakenedId` (mục 17.1) | Ngay lập tức (Linh Thú đang sống đổi ngay) |
| F10 Liễu Tịnh Nhan **[GĐ7]** | `alliesFallen` | +1 mỗi Hero của người chơi đó ngã (kể cả chính F10) | 1 | `none` — *Nguyệt Hồn*: nội tại trống; `levelUp.onLevelUp` = `revive { ratio: 0.3, to: "lastFallen" }` (mục 5.6) | Ngay lập tức |
| M09 Đoàn Lạc **[GĐ7]** | `debuffsApplied` | +1 mỗi lần một effect có đơn vị hành động là M09 áp một debuff (mục 6.3) lên đối thủ | 6 | `debuffDurationBonus(1)` — *Vong Quốc Khúc*: debuff có thời hạn do M09 áp thêm 1 vòng thời hạn | Ngay lập tức |

*Ghi chú: GDD ghi ngưỡng F04 là 4; prototype dùng 3 vì trận ngắn. GDD ghi F02 "Cướp 3 buff"; dùng 2 sau playtest 2.8 (`09` mục 12), trả về 3 và tính thêm Đoạt Nguyệt sau playtest 4b (`playtest-notes.md`, chỉnh sau 4b).*

- **Tinh Hồn [GĐ4d]** (`14` §10; `createCombat` / `createRun` nhận tham số `loadout`):
  - **Cấp ≥ 2:** ngưỡng thăng cấp của Hero đó = `levelUp.constellationThreshold` thay
    `threshold`. Riêng M06 (`enemiesKilled`): tính cả kẻ địch ngã do Phản Đòn của M06.
  - **Cấp ≥ 4:** khi tạo trận / lượt chơi, mọi bản của lá `signature.cardId` trong deck
    của Hero đó được thay bằng `signature.plusCardId` (cùng owner, cost, `copies`). Lá "+"
    là lá riêng của Hero, chịu mọi luật lá bình thường.
  - Cấp 1, 3, 6 không đổi luật trận.
  - **Cấp 5 [GĐ4e] — dạng thăng cấp thứ hai:** khi loadout của Hero có
    `levelUpForm: "alt"` (chỉ chọn được ở Tinh Hồn ≥ 5, `14` §10.1), Hero dùng
    `heroes.json altLevelUp` thay `levelUp.name / description / passive`. Bộ đếm và
    ngưỡng **không đổi** (vẫn theo cấp 2). Nội tại mới **thay** nội tại cơ bản, có hiệu
    lực ngay khi thăng cấp; `onLevelUp` (nếu có) chạy một lần ngay sau `heroLeveledUp`,
    Hero đó là đơn vị hành động.

| Hero | Dạng thứ hai | `onLevelUp` | Nội tại (`passive`) |
|---|---|---|---|
| M05 | *Bất Diệt* | Nhận 12 giáp, Khiêu Khích 2 vòng | `armorBonusOwnCards(3)`: mỗi effect `gainArmor` từ lá của M05 +3 giáp (áp trước hệ số giáp) |
| F04 | *Tĩnh Tâm* | — | `healCleanses`: sau mỗi effect `heal` / `burstRegen` / `applyStatus regen` từ lá của F04 lên một Hero, Hero đó được **giải trừ** (như effect `cleanse`) |
| M06 | *Tàn Ảnh* | — | `firstComboCountsExtra(1)`: lá đầu tiên có từ khóa Liên Hoàn của M06 mỗi lượt tính `cardsPlayedThisTurnAtLeast` như đã đánh thêm 1 lá |
| F03 | *Hàn Kiếm* | — | `firstHitVulnerable(1)`: lượt damage đầu tiên mỗi lượt từ lá của F03 trúng kẻ địch (còn sống sau đòn) → kẻ địch đó Dễ Vỡ 1 vòng |
| F02 | *Huyết Diện* | — | `bloodMoonOwnCardDiscount(1)`: khi đang Huyết Nguyệt, lá của F02 giảm 1 Nguyệt Lực (tối thiểu 0, áp sau giảm theo pha) |
| M01 | *Định Cục* **[GĐ7]** | — | `chooseCardExtraLook(1)`: Chiêm Bài của người chơi xem thêm 1 lá |
| M02 | *Trung Can* **[GĐ7]** | — | `interceptArmor(2)`: mỗi đòn đỡ thay qua `guard`, M02 nhận 2 giáp trước khi chiêu giải quyết |
| M03 | *Phú Giáp* **[GĐ7]** | `gainMoonPowerPerTurn(1)` — nhận Dưỡng Nguyệt 1 | `none` |
| M04 | *Tâm Nhãn* **[GĐ7]** | — | `healBonusOwnCards(2)`: lá hồi máu của M04 hồi thêm 2 |
| M07 | *Huyết Nguyệt Chi Tử* **[GĐ7]** | — | `bloodMoonImmune`: M07 không mất HP vì Huyết Nguyệt |
| M08 | *Tinh Mệnh* **[GĐ7]** | — | `moonShiftWeakensEnemies(1)`: mỗi lá Đổi Vận (`shiftMoon`) của M08 áp Suy Yếu 1 lên mọi kẻ địch |
| M10 | *Trạng Nguyên* **[GĐ7]** | — | `comboAttackBonus(1)`: lá tấn công của M10 +1 damage mỗi hit cho mỗi lá đã đánh trước nó trong lượt |
| F01 | *Tự Do* **[GĐ7]** | — | `tagDiscountOwnCards(moon, 1)`: lá tag `moon` của F01 −1 Nguyệt Lực (tối thiểu 0) |
| F08 | *Phản Sư* **[GĐ7]** | — | `bloodMoonAttackBonus(3)`: khi đang Huyết Nguyệt, mọi hit của lá tấn công F08 +3 damage |
| F05 | *Biên Tái* **[GĐ7]** | — | `firstHitMarks(1)`: hit đầu mỗi lượt của lá tấn công F05, nếu trúng, áp Đánh Dấu 1 vòng lên kẻ địch đó |
| F06 | *Vũ Y* **[GĐ7]** | — | `stealthOnCharm(1)`: mỗi khi F06 gây Mê Hoặc, F06 Ẩn Thân 1 vòng |
| F07 | *Chép Sử* **[GĐ7]** | — | `sealWeakens(1)`: Phong Ấn của F07 còn áp Suy Yếu 1 lên mục tiêu |
| F09 | *Nguyệt Cung* **[GĐ7]** | — | `summonTaunts(1)`: Linh Thú của F09 vừa triệu hồi (mới hoặc lại) được Khiêu Khích 1 vòng |
| F10 | *Vong Xuyên* **[GĐ7]** | — | `armorOnAllyFall(6)`: mỗi khi đồng đội của F10 ngã, mọi Hero còn sống của người chơi đó nhận 6 giáp |
| M09 | *Nam Chiếu Hồn* **[GĐ7]** | — | `bonusVsDebuffed { minDebuffs: 2, amount: 3 }`: hit của lá tấn công M09 +3 damage vào kẻ địch có ít nhất 2 debuff |

    "Lá của Hero X" gồm lá Binh Khí X đang mang (§14.2), không gồm lá Song Hành. Bộ đếm
    "mỗi lượt" (Tàn Ảnh, Hàn Kiếm) đặt lại ở đầu lượt người chơi. Hàn Kiếm: lượt damage đầu tiên luôn
    dùng hết lượt của lượt đó (kể cả khi bị giáp chặn hết hoặc kết liễu mục tiêu — khi đó
    không áp Dễ Vỡ). Tàn Ảnh: lá Liên Hoàn = lá có từ khóa `lien_hoan`; lá đầu tiên dùng
    hết phần thưởng dù điều kiện Liên Hoàn của nó có cần hay không.
- "Lá của Hero X" trong cột Nội tại **không** gồm lá Song Hành: nội tại thăng cấp không áp cho lá Song Hành **[GĐ2]**.
- Bộ đếm tính cho **đơn vị hành động** của effect, kể cả trong lá Song Hành (mục 5.4). Riêng `enemiesKilled` tính khi kẻ địch ngã do damage từ lá có đơn vị hành động là M06; kẻ địch ngã do Phản Đòn **không** tính.

---

## 9. Lượt kẻ địch

### 9.1 Bộ chiêu
- Mỗi kẻ địch có `intents`: danh sách chiêu, mỗi chiêu là `IntentDef` kèm `cost` (số nguyên ≥ 0); và đường cong Nguyệt Lực riêng `moonPower: { start, cap }` (`perRound` dùng chung của `combatConfig`).
- **Nguyệt tính [Nguyệt Luân mới]:** có thể có `moonOverrides` — chiêu trăng của riêng loại địch đó, **thông tin công khai** (client hiển thị trong tooltip kẻ địch, `05` mục 3). Nếu **tại thời điểm lên chuỗi** pha trăng khớp, dùng chiêu thay thế (là `IntentDef`, không có `cost`).
- Có thể có `bloodMoonOverride` **[GĐ2]**: chiêu thay thế khi **tại thời điểm lên chuỗi** đang Huyết Nguyệt; ưu tiên hơn `moonOverrides`. Chiêu override luôn có cost 0 và đứng đầu chuỗi (mục 9.2).

### 9.2 Lên chuỗi
Nguyệt Lực của kẻ địch theo cùng đường cong với người chơi (`base(r)`, mục 3.1) nhưng dùng `start`/`cap` riêng của kẻ địch. Vòng 1: quỹ = `start` (chưa có Dự Trữ).

Chạy lúc tạo trận (vòng 1) và ở cuối mỗi vòng (mục 9.4, sau khi tiến pha và giảm `bloodMoonRounds`), cho từng kẻ địch còn sống theo vị trí 0 → n. Với quỹ `P = base(r) + moonReserve` **[Nguyệt Lệnh]** `+ turnMoonPowerBonus` nếu lệnh **Nguyệt Sinh** đang có hiệu lực **lúc lên chuỗi** (mục 7.5):

1. `chain = []`, `used = ∅`.
2. **Override:** nếu `bloodMoonRounds > 0` và có `bloodMoonOverride` **[GĐ2]**, hoặc có override trong `moonOverrides` khớp pha hiện tại → thêm chiêu đó vào `chain` với cost 0.
3. Lặp khi `chain.length < maxIntentsPerRound`:
   - `affordable` = chiêu trong `intents` có `cost ≤ P` và `id ∉ used`.
   - Rỗng → dừng.
   - `top` = chiêu có cost cao nhất trong `intents` (hòa: chiêu đứng trước trong data). Nếu `top ∈ affordable` **và** `top.id ∉ lastIntentIds` → chọn `top`.
   - Ngược lại bốc có seed trong `affordable`, **trọng số = cost + 1**.
   - Thêm vào `chain`, `P −= cost`, `used += id`.
4. Mỗi chiêu có `targeting` chọn mục tiêu ngay trong các Hero **còn sống và không Ẩn Thân** (có RNG nếu `random`). Nếu không có Hero hợp lệ (tất cả Ẩn Thân): chiêu vẫn vào chuỗi, mục tiêu = `null`.

| `targeting` | Cách chọn (hòa → vị trí nhỏ hơn) |
|---|---|
| `random` | Chọn ngẫu nhiên bằng RNG |
| `lowestHp` | HP hiện tại thấp nhất |
| `highestHp` | HP hiện tại cao nhất |
| `front` | Vị trí nhỏ nhất |

5. `plannedIntents = chain`, `moonPower = quỹ ban đầu`, `moonReserve = min(moonReserveMax, P)`. Phát event `intentsRevealed` (một event cho cả chuỗi; chuỗi rỗng = **Tụ Lực**). Chuỗi là nội bộ — **[GĐ7b]** kẻ địch không báo chiêu, client không hiển thị.

Thứ tự RNG trong một lần lên chuỗi của một kẻ địch: các lần bốc chiêu, rồi chọn mục tiêu theo thứ tự chuỗi.

### 9.3 Thực hiện lượt kẻ địch (theo thứ tự)
1. **Xóa giáp** và gỡ **Phản Đòn** **[GĐ2]** của mọi kẻ địch. **[Nguyệt Lệnh]** Bỏ qua bước này khi lệnh **Giữ Giáp** (`keepArmor`) có hiệu lực (mục 7.5). **[Nguyệt Lệnh]** Xóa khóa `"enemy"` trong `firstHitKeys` (Tập Kích, mục 7.5).
2. Kích hoạt Thiêu Đốt, rồi Hồi Phục của từng kẻ địch (vị trí 0 → 2). Kiểm tra thắng/thua. **[Nguyệt Lệnh]** Sau đó **Mầm Sống / Đoàn Viên** (`turnStartHeal`) cho bên kẻ địch — cùng quy tắc hồi phẳng của mục 3.1 bước 5 (gồm Linh Thú của kẻ địch nếu có).
3. Lần lượt từng kẻ địch còn sống (vị trí 0 → 2), mỗi kẻ địch thi hành `plannedIntents`:
   - Đang Đóng Băng: phát `intentSkipped` (một event cho cả chuỗi), gỡ Đóng Băng, `moonReserve = 0` (`moonReserveChanged`), bỏ cả chuỗi.
   - Ngược lại: lần lượt từng chiêu trong chuỗi — **xác định lại mục tiêu** (9.3.1) rồi thực hiện các effect của chiêu, phát `intentExecuted` / `intentFizzled` cho từng chiêu. Kiểm tra thắng/thua sau mỗi effect. Nếu kẻ địch ngã giữa chừng (do Phản Đòn): các chiêu còn lại bị hủy.
   - **[Nguyệt Lệnh]** **Liên Kích** (`attackChainBonus`): chiêu `kind` `attack` / `attackDefend` được `+amount` mỗi hit nếu **trước nó** trong cùng chuỗi của kẻ địch đó đã thi hành một chiêu `attack` / `attackDefend` (mục 7.5).
   - Kết thúc chuỗi: `lastIntentIds` = `id` các chiêu **đã lên chuỗi** (kể cả bị hủy). Trận kết thúc giữa chừng: dừng, bỏ qua phần còn lại.

#### 9.3.1 Xác định lại mục tiêu khi thực hiện
Với chiêu có mục tiêu đơn:
0. **[GĐ7]** Nếu kẻ địch đang thực hiện chiêu có `charm` (Mê Hoặc): trừ 1 lượt (về 0 → gỡ);
   mục tiêu đổi thành **kẻ địch khác còn sống có HP hiện tại cao nhất** (hòa → vị trí
   nhỏ). Không có kẻ địch khác → chiêu **thất bại**, phát `intentFizzled` (vẫn tính đã trừ
   Mê Hoặc). Damage tính như kẻ địch đánh thường (nguồn là kẻ địch bị Mê Hoặc, mục 10.1);
   **bỏ qua các bước 1–4 dưới đây**. Chiêu `to: "allEnemies"` hoặc chỉ buff bản thân không
   bị ảnh hưởng và không trừ Mê Hoặc.
1. Nếu có Hero **hoặc Linh Thú** còn sống đang **Khiêu Khích** → mục tiêu là đơn vị đó
   (nhiều đơn vị Khiêu Khích → **Hero trước, rồi Linh Thú**; hòa → vị trí nhỏ hơn).
1b. **[GĐ7]** Nếu mục tiêu kết quả có `guard` mà người hộ vệ (`sourceId`) còn sống → mục tiêu là người hộ vệ; `hitsIntercepted` của người hộ vệ +1; nếu người hộ vệ có nội tại `interceptArmor` → nhận giáp trước khi chiêu giải quyết (mục 8).
2. Nếu mục tiêu đã lên trong chuỗi còn sống và không Ẩn Thân → giữ nguyên.
3. Ngược lại → chọn lại theo cùng `targeting` (RNG nếu là `random`).
4. Không có mục tiêu hợp lệ → chiêu **thất bại**, phát event `intentFizzled`.

Effect có `to: "allEnemies"` từ phía kẻ địch đánh trúng mọi Hero còn sống, kể cả Ẩn Thân.

#### 9.3.2 `drainMoonPower` trong chiêu địch [GĐ7c]

Chiêu địch (màn Cốt truyện, `18` §4.5) được dùng `drainMoonPower { amount, to, steal? }`
với đúng nghĩa nhánh PvP của mục 15.5: rút **Dự Trữ của người chơi** một lần —
`drained = min(amount, player.moonReserve)`, phát `moonReserveChanged { side: "hero" }`
nếu đổi; `to` chỉ quyết định Hero bị nhắm như thường (quỹ Dự Trữ là của cả người chơi).
`steal` → quỹ của **kẻ địch** đang thi hành `+= drained` (nhánh `moonPowerChanged` của
người chơi không áp). Không có phần "hủy ý định" của §9.5 — người chơi không có chuỗi ý
định. Trên lá bài và trong PvP nghĩa giữ nguyên (§9.5, §15.5).

### 9.4 Cuối vòng (theo thứ tự)
1. Giảm 1 thời hạn mọi trạng thái loại "Thời hạn" của cả hai phe; gỡ trạng thái về 0. **[Nguyệt Lệnh]** Xóa `UnitState.shieldUsed` của mọi đơn vị (Thế Thủ, mục 7.5).
2. Tiến Nguyệt Luân 1 pha (mục 7.2 — `enterPhase` chạy cho pha mới). Sau đó, nếu `bloodMoonRounds > 0`: giảm 1, phát `bloodMoonChanged` **[GĐ2]** (mục 7.4).
3. `round += 1`.
4. Kẻ địch lên chuỗi mới (mục 9.2).
5. Bắt đầu lượt người chơi.

### 9.5 Tỏa Nguyệt / Đoạt Nguyệt [GĐ4b]

Effect `drainMoonPower { amount, to, steal? }` (chỉ trên lá bài; `to` chỉ `chosen` hoặc `allEnemies`), với mỗi kẻ địch còn sống trong `to`:

1. `drained = min(amount, enemy.moonPower)`; `enemy.moonPower -= drained`.
2. Trong khi tổng `cost` của `plannedIntents` > `enemy.moonPower`: bỏ chiêu **cuối** chuỗi. Các chiêu bị bỏ → một event `intentsCancelled` (theo thứ tự bị bỏ). Chiêu override (cost 0) không bao giờ làm tổng vượt quỹ nên chỉ bị bỏ khi mọi chiêu sau nó đã bị bỏ — thực tế không bao giờ.
3. `enemy.moonReserve = min(moonReserveMax, enemy.moonPower − tổng cost còn lại)`; `moonReserveChanged` nếu đổi.
4. `steal: true` (Đoạt Nguyệt): `state.moonPower += drained` (tổng các địch) → `moonPowerChanged`.

Không tiêu RNG. Địch bị Đóng Băng vẫn bị rút bình thường.

---

## 10. Damage, hồi máu, mất HP

### 10.1 Công thức damage
Tính riêng cho **mỗi lượt damage** (mỗi hit, mỗi mục tiêu):

```
1. base  = amount của effect (sau khi chọn nhánh conditional)
2. flat  = base
         + strength của bên gây
         + empower của bên gây            (chỉ khi đến từ lá tấn công của chủ empower)
         + 3 nếu mục tiêu có mark từ đúng Hero gây damage (chỉ lá tấn công)
         + bonus nội tại thăng cấp          (ví dụ M05 Liệt Hỏa +3, chỉ lá tấn công)
         + firstHitBonus của lệnh Tập Kích: hit damage đầu tiên của bên gây
           trong lượt (khóa firstHitKeys, mục 7.5)                  [Nguyệt Lệnh]
         + attackChainBonus của lệnh Liên Kích: lá tấn công khi
           attackCardsThisTurn ≥ 1; chiêu địch attack/attackDefend đứng sau
           chiêu đánh trong cùng chuỗi (mục 7.5)                    [Nguyệt Lệnh]
3. mult  = 1
         × mọi damageMultiplierForTag có hiệu lực khớp tag của lá — chỉ damage
           từ lá bài (ưu đãi pha: Trăng Non cho assassin ×1.5, mục 7.1)
         × 0.75 nếu bên gây có weak
         × 1.5 nếu mục tiêu có vulnerable
         × 2 nếu F03 đã thăng cấp, damage từ lá của F03 (không tính lá Song Hành)
             và mục tiêu có freeze                                   [GĐ2]
4. final = floor(flat × mult), tối thiểu 0
4b. Thế Thủ [Nguyệt Lệnh]: nếu hit này là **đơn mục tiêu** và mục tiêu chưa có
    `shieldUsed` trong vòng → `final = max(0, final − amount)` rồi đặt
    `shieldUsed` cho mục tiêu (mục 7.5).
5. Giáp chặn trước: blocked = min(armor, final); armor −= blocked; hp −= (final − blocked)
6. Nếu mục tiêu có reflect và final > 0: Phản Đòn (mục 10.5)       [GĐ2]
```

"Bên gây" và "chủ lá" ở trên là đơn vị hành động của effect (mục 5.3).

- Damage từ chiêu kẻ địch dùng cùng công thức (bên gây là kẻ địch; không có tag lá bài — `damageMultiplierForTag` không áp).
- Phát event `damageDealt` với `amount`, `blocked`, `hpLost`.

### 10.2 Hồi máu
```
healed = min(maxHp − hp, floor(amount × hệ số hồi máu))
```
- `hệ số hồi máu` = `healMultiplier` của lệnh đang có hiệu lực (Ám Dạ ×0.5, Viên Nguyệt ×2, mục 7.5); không có lệnh → 1. Modifier Kỳ Vật `healMultiplier` cộng dồn cùng cách (§13.4).
- Hồi phẳng từ lệnh (`turnStartHeal`: Mầm Sống / Đoàn Viên) **không** nhân hệ số.
- Không hồi cho đơn vị đã ngã. Áp cho cả effect `heal` và tick `regen`.

### 10.3 Mất HP (`loseHp`)
- Trừ thẳng HP, **bỏ qua giáp và mọi hệ số**. Thiêu Đốt cũng tính như mất HP.
- **[Nguyệt Lệnh]** `hpLost.cause` gồm: `"bloodMoon"` (mục 7.4), `"reflect"` (mục 10.5), `"decree"` (Đoạn Tuyệt — mất HP do lệnh, không có đơn vị nguồn, không phải đòn tấn công), `"bloodPact"` (Huyết Tế, mục 5.9).

### 10.4 Ngã
- `hp ≤ 0` → `hp = 0`, đơn vị **ngã**: gỡ mọi trạng thái, `armor = 0`, phát event `unitDied`.
- Hero ngã — **Tán Chiêu**: mọi bản trong `drawPile` có Hero đó trong `ownerIds` (kể cả lá Song Hành) chuyển sang `discardPile` theo thứ tự trong chồng, phát event `cardsPurged`; lá của Hero đó **trên tay** thành Tàn Chiêu (mục 4.3). Hero đã ngã không thể là mục tiêu hồi máu.
- Ghi nhận ai gây đòn kết liễu (để tính `enemiesKilled`). Ngã do Phản Đòn: kẻ kết liễu là đơn vị có Phản Đòn.

### 10.5 Phản Đòn [GĐ2]
- Kích hoạt ở **mỗi lượt damage** (mỗi hit, mỗi mục tiêu) có `final > 0` lên đơn vị có `reflect` — **kể cả khi giáp chặn hết**.
- Nguồn gây damage mất HP = giá trị `reflect` (như `loseHp`: bỏ qua giáp và mọi hệ số) **[Nguyệt Lệnh]** — nhân `reflectMultiplier` của lệnh **Phản Chấn** khi có hiệu lực (mục 7.5). Phát `hpLost { targetId: <nguồn>, cause: "reflect" }` ngay sau `damageDealt` của hit đó.
- Không kích hoạt bởi `loseHp`, Thiêu Đốt, Huyết Nguyệt hay chính Phản Đòn (không đệ quy).
- Xử lý ngã ngay sau hit đó (10.4). Nếu nguồn ngã: dừng lá (5.2 bước 3) hoặc chiêu (9.3 bước 3). Kiểm tra thắng/thua như thường.
- Hero mất HP do Phản Đòn: tính vào `damageTaken` như mọi lần mất HP.

### 10.6 Phẫn Huyết [GĐ4b]
- Effect `missingHpDamage { ratio, to, hits? }`: mỗi hit, damage gốc `floor((source.maxHp − source.hp) × ratio)` tính **lúc hit**, rồi qua công thức damage bình thường (mục 10.1: Sức Mạnh, Cường Hóa, Đánh Dấu, nội tại, pha trăng, Suy Yếu, Dễ Vỡ). Được dùng trong chiêu địch.

### 10.7 Dư Sinh [GĐ4b]
- Effect `heal` có `overflow: "armor"` (chỉ trên lá bài): `raw = floor(amount × hệ số hồi)` (mục 10.2), `healed = min(maxHp − hp, raw)`, `overflow = raw − healed`; nếu `overflow > 0`: mục tiêu nhận `floor(overflow × hệ số giáp)` giáp (`armorGained`) — hệ số giáp từ lệnh như mục 6.4.

### 10.8 Tụ Dược [GĐ4b]
- Effect `burstRegen { multiplier, to }` (chỉ trên lá bài): với mỗi mục tiêu có Hồi Phục `v`: hồi `floor(v × multiplier × hệ số hồi)` (không Dư Sinh), rồi gỡ Hồi Phục (`statusRemoved`). Không có Hồi Phục → không tác dụng.

---

## 11. Thắng / thua

- **Thắng:** mọi kẻ địch ngã → `status = "won"`.
- **Thua:** mọi Hero ngã → `status = "lost"`.
- **Thua — Cạn Bài:** đầu lượt người chơi, tay rỗng **và** `drawPile` rỗng → event `deckedOut`, rồi `status = "lost"` (mục 3.1 bước 8).
- Kiểm tra sau **mỗi effect**, mỗi tick trạng thái. Trận kết thúc thì mọi hành động sau đó bị từ chối. Không còn giới hạn số vòng trong luật (mô phỏng vẫn giữ trần an toàn, `12` §8).
- Nếu cả hai cùng xảy ra trong một effect (ví dụ damage lan): ưu tiên **thắng**.

---

## 12. Chưa có trong prototype

Crit. Không code phần này ở giai đoạn 1–2. Binh Khí và Nguyệt Bảo: §14 (GĐ 4e). Mê Hoặc,
Linh Thú (triệu hồi), hàng trước/sau: §17, §5.6, §6.1 (GĐ 7b).

---

## 13. Kỳ Vật [GĐ3]

### 13.1 Định nghĩa

```ts
interface RunRelicDef {
  id: string; name: string; text: string;
  modifiers?: MoonModifier[];
  hooks?: RunRelicHook[];
}
interface RunRelicHook {
  on: HookTrigger;
  actor: "trigger" | "each" | "lowestHp" | "front";
  every?: number;   // ≥ 2; kích hoạt khi bộ đếm của hook chia hết cho every
  effects: Effect[];
}
type HookTrigger =
  | { type: "combatStart" }
  | { type: "playerTurnStart" }
  | { type: "playerTurnEnd" }
  | { type: "cardPlayed"; tag?: CardTag; cardType?: CardType }
  | { type: "enemyKilled" }
  | { type: "heroDied" }
  | { type: "moonPhaseEntered"; phase?: MoonPhaseId }
  | { type: "bloodMoonStarted" };
```

`CombatState` thêm `runRelicIds: string[]` và `runRelicCounters: Record<string, number>`
(khóa `"<relicId>#<chỉ số hook>"`, reset mỗi trận).

### 13.2 Thời điểm kích hoạt

| Trigger | Thời điểm | Hero `trigger` |
|---|---|---|
| `combatStart` | Sau khi Đổi Bài xong (§2.1): lượt người chơi vòng 1 đã bắt đầu (đã rút bù) **và** các hook `playerTurnStart` của lượt đó đã chạy | — |
| `playerTurnStart` | Cuối bước đầu lượt (`01` §3.1), sau khi rút bù | — |
| `playerTurnEnd` | Đầu cuối lượt (`01` §3.3), trước khi bỏ lá Tàn Chiêu | — |
| `cardPlayed` | Sau bước dọn (`01` §5.2.4), trước khi lá vào chồng bỏ; chỉ khi lá khớp `tag` / `cardType` (nếu có) | Chủ lá; lá Song Hành: `owners[0]` |
| `enemyKilled` | Sau khi effect hoặc tick gây ra cái chết giải quyết xong; mỗi kẻ địch ngã một lần, theo thứ tự ngã | Hero kết liễu (`killerId` là Hero); không có → hook `trigger` không chạy |
| `heroDied` | Như trên, cho Hero ngã | Không dùng được |
| `moonPhaseEntered` | Ngay sau mỗi `moonShifted` (cuối vòng hoặc Đổi Vận); chỉ khi pha mới khớp `phase` (nếu có) | — |
| `bloodMoonStarted` | Ngay sau `bloodMoonChanged` làm `bloodMoonRounds` đi từ 0 lên > 0 | — |

Hook `combatStart` chạy ở lượt 1 nên giáp nhận được còn tới hết lượt địch đầu.

### 13.3 Đơn vị hành động của effect Kỳ Vật

- `trigger`: Hero ở cột cuối bảng trên.
- `each`: chạy toàn bộ `effects` một lần cho mỗi Hero còn sống (vị trí 0 → 2),
  Hero đó là đơn vị hành động (`to: "self"` = Hero đó). Bộ đếm `every` vẫn chỉ
  tăng **một** lần cho mỗi trigger, không phải mỗi Hero.
- `lowestHp` / `front`: một Hero còn sống (hòa → vị trí nhỏ hơn).
- Không có Hero phù hợp → hook không chạy (bộ đếm vẫn tăng).

### 13.4 Luật

- Damage từ Kỳ Vật **không phải đòn tấn công** và không đến từ lá: không cộng
  Sức Mạnh, Tích Lực, Đánh Dấu, nội tại thăng cấp; không tính `enemiesKilled`.
  Suy Yếu của đơn vị hành động và Dễ Vỡ của mục tiêu vẫn áp dụng; Phản Đòn vẫn
  kích hoạt (nguồn là Hero đơn vị hành động).
- Effect Kỳ Vật **không được** dùng `to: "chosen"`, `stealBuff`, `actor`,
  `chooseCard`, hay (lồng trong `conditional`) condition `target…`. `heroDied`
  không được dùng `actor: "trigger"`. Vi phạm → lỗi khi nạp dữ liệu.
- **[GĐ4a]** Kỳ Vật *Thanh Loan Vũ* đổi hiệu ứng: "Mỗi 2 lượt: +2 Nguyệt Lực" —
  `playerTurnStart`, `every 2`, `gainMoonPower 2` (phần không tiêu vào Dự Trữ).
- **Bộ đếm:** mỗi lần trigger khớp, bộ đếm của hook +1; hook chạy khi không có
  `every`, hoặc khi bộ đếm chia hết cho `every`.
- **Thứ tự:** các hook cùng một lần trigger chạy theo thứ tự `runRelicIds`, rồi
  thứ tự trong `hooks`. Mỗi lần chạy phát `runRelicTriggered { runRelicId }`
  trước event của các effect.
- **Không đệ quy:** trigger phát sinh bên trong effect của Kỳ Vật không kích hoạt
  hook nào.
- Sau mỗi effect vẫn xử lý ngã, thăng cấp, thắng/thua như `01` §5.2. Trận kết
  thúc → dừng ngay, bỏ qua hook còn lại.
- **Modifier:** `activeModifiers` = `phaseModifiers` của pha hiện tại (ưu đãi
  tag + modifier của Nguyệt Lệnh đang bốc, mục 7.5–7.6) + modifier của mọi Kỳ
  Vật đang có. Chi phí theo tag, damage theo tag, hệ số hồi / giáp, thưởng Ẩn
  Thân tự áp dụng; các hệ số nhân với nhau.

---

## 14. Binh Khí và Nguyệt Bảo [GĐ4e]

Nội dung: `03` §7. Sở hữu, Tinh Luyện, Cộng Minh, deck: `14` §13. Dữ liệu: `02` §1.12.

### 14.1 Vào trận

- `createCombat(data, setup, loadout?)` / `createRun(data, setup, loadout?)`: loadout
  (`14` §12) thêm `heroes[id].weaponId: string | null`, `heroes[id].refinement` (1–5; 0
  khi không có) và `relics: { id, resonance }[]` (≤ 2). Thiếu loadout = không trang bị.
- **Cấp hiệu lực:** `weaponAt(def, r)` = bản R1 (`card`, `hooks`, `signatureHooks`) rồi
  áp lần lượt `refinement[0..r−2]` (mỗi mục ghi đè các trường nó có: `card` ghi đè từng
  trường của lá, `hooks` / `signatureHooks` thay cả mảng). `relicAt(def, c)` =
  `resonance[c−1]` (mỗi cấp là bản đầy đủ).

### 14.2 Lá Binh Khí

- Mỗi Hero có vũ khí góp `card.copies` (1 hoặc 2) bản vào chồng rút lúc tạo trận, **sau**
  các lá deck và lá Song Hành, theo vị trí người mang, trước lần xáo đầu; instance id `wpn_<heroId>_<n>` (n = 1, 2),
  `cardId = weaponId`, `ownerIds = [heroId]`. Lá được coi như `CardDef` với `id =
  weaponId`, `ownerId = heroId`, các trường còn lại từ `weaponAt(...).card`.
- Là **lá riêng của người mang**: Tàn Chiêu khi người mang ngã, Đóng Băng, chi phí theo
  tag/pha, bộ đếm và nội tại thăng cấp của người mang (kể cả Tinh Hồn, dạng thứ hai),
  "lá riêng đầu tiên" của Tô Dạ. Không phải lá Song Hành. Dùng được mọi effect của lá
  (kể cả từ khóa 4b).
- Trong lượt chơi, lá Binh Khí **không** nằm trong `run.deck`: mỗi trận thêm lại từ
  `run.loadout` → không bỏ được ở Nghỉ Chân, không tính `minDeckSize` (`11` §3).

### 14.3 Nội tại vũ khí

```ts
type WeaponHook = Omit<RunRelicHook, "actor" | "on"> & {
  actor: RunRelicHook["actor"] | "wearer";
  on: HookTrigger                                              // như §13.1, thêm bộ lọc:
    | { type: "cardPlayed"; tag?: CardTag; cardType?: CardType; owner?: "wearer" }
    | { type: "enemyKilled"; killer?: "wearer" };
};
```

- Chạy trên máy hook của Kỳ Vật (§13.2–§13.4) với các khác biệt:
  - `actor: "wearer"` = người mang; `owner: "wearer"` khớp khi Hero `trigger` của
    `cardPlayed` là người mang; `killer: "wearer"` khớp khi Hero kết liễu là người mang.
    `wearer` chỉ hợp lệ trong hook vũ khí (lỗi khi nạp nếu dùng ở Kỳ Vật / Lõi /
    Nguyệt Bảo).
  - **Người mang đã ngã → mọi hook của vũ khí đó không chạy** (bộ đếm không tăng).
  - `signatureHooks` (nếu có) thay `hooks` khi người mang là `signatureHeroId`.
  - Được dùng effect "chỉ lá" như Lõi (`gainMoonPowerPerTurn`, `drainMoonPower` với
    `allEnemies`…); vẫn cấm `to: "chosen"`, `stealBuff`, `actor`, `chooseCard`,
    condition `target…`.
- Khóa bộ đếm `"<weaponId>@<heroId>#<chỉ số hook>"`. Mỗi lần chạy phát
  `weaponTriggered { weaponId, heroId }` trước event của các effect.

### 14.4 Nguyệt Bảo

- Mỗi Nguyệt Bảo trong loadout góp `relicAt(...).modifiers` vào `activeModifiers` và
  `relicAt(...).hooks` vào máy hook (ràng buộc như Lõi). Khóa bộ đếm
  `"<relicId>#<chỉ số hook>"`; mỗi lần chạy phát `relicTriggered { relicId }`.
- `costModifierForTag` thêm `while?: "bloodMoon"`: modifier chỉ có hiệu lực khi
  `bloodMoonRounds > 0` (dùng được ở mọi nguồn modifier).
- Có hiệu lực ở mọi trận của lượt chơi và ở trận lẻ.

### 14.5 Thứ tự hook

Cùng một lần trigger: Kỳ Vật và Lõi (thứ tự `runRelicIds`) → Nguyệt Bảo (thứ tự
`loadout.relics`) → vũ khí theo vị trí người mang 0 → 2; trong mỗi nguồn theo thứ tự
`hooks`. "Không đệ quy" (§13.4) áp cho mọi nguồn: trigger phát sinh trong effect của một
hook bất kỳ không kích hoạt hook nào.

---

## 15. PvP — Đấu Trường Công Bằng [GĐ5]

Trận 1v1 giữa hai người chơi (spec `17` §4). `mode = "pvp"`, `enemies` rỗng, hai seat
`players[0]`/`players[1]`; unit id và instance id có tiền tố `p0_` / `p1_` (`02` §2).

### 15.1 Tạo trận — `createPvpCombat(data, { seed, players: [PvpSide, PvpSide] })`

`PvpSide = { heroIds, deckCardIds?, loadout }` — deck của mỗi người gồm lá deck, lá Song
Hành đủ cặp của đội và lá Binh Khí như §2/§14.2. Thứ tự RNG (quan trọng cho chạy lại):

1. Bốc `firstPlayer` (0/1) một lần.
2. Với từng seat theo chỉ số 0 → 1: dựng chồng bài, xáo, Hero `hp = maxHp` theo
   `pvp-config.heroStats`.
3. `round = 1`, `bloodMoonRounds = 0`; `rollMoon` bốc pha khởi đầu và 8 Nguyệt
   Lệnh bằng luồng RNG phụ (mục 7.6 — không có `start`, không ghi đè).
4. Mỗi seat rút `handSize` lá, seat 0 trước.
5. `status = "mulligan"`: **cả hai** Đổi Bài song song (Action `mulligan` có `player`).
   Xáo lại dùng chung `rngState` theo thứ tự server nhận — thứ tự đó ghi vào nhật ký.
6. Khi cả hai xong: đầu lượt người đi trước; hook `combatStart` của cả hai chạy sau hook
   `playerTurnStart` của lượt đầu (người đi trước trước) — như §2 (T115).

### 15.2 Lượt và vòng

- Một vòng = lượt người đi trước + lượt người đi sau. Hết lượt người đi sau → cuối vòng.
- **Đầu lượt** của P: như §3.1 nhưng chỉ cho **Hero của P** (xóa giáp + Phản Đòn, bộ đếm
  đầu lượt, Thiêu Đốt / Hồi Phục, mất HP Huyết Nguyệt, rút bù, Cạn Bài của P, hook
  `playerTurnStart` của P). Nguyệt Lực của P = `base(round) + moonReserve +
  moonPowerBonus` của P.
- **Bù người đi sau:** lượt đầu tiên của người đi sau cộng `secondPlayerBonus.moonPower`
  vào quỹ; phần dư vào Dự Trữ theo luật thường (trần `moonReserveMax`).
- **Trong lượt:** chỉ P gửi Action; Action của seat kia bị từ chối `"not your turn"`.
- **Cuối lượt** của P: như §3.3 bước 0–4 cho P (hook `playerTurnEnd` của P, Tàn Chiêu,
  Tích Tụ, Dự Trữ, gỡ Đóng Băng trên Hero P). P đi trước → đầu lượt người đi sau; ngược
  lại → cuối vòng.
- **Cuối vòng:** tiến Nguyệt Luân (`enterPhase` chạy cho pha mới), giảm
  `bloodMoonRounds` (§9.4 bước 2–3). Không có bước lên chuỗi địch. Rồi đầu lượt
  người đi trước.
- Pha trăng, `moonDecrees` và Huyết Nguyệt dùng chung cho cả hai seat; lệnh "mỗi
  bên" / "đầu lượt" áp **theo ghế đang tới lượt**: quỹ đầu lượt (Nguyệt Sinh),
  rút thêm (Khai Trí), Chiêm Bài (Chiêm Tinh, Bói Nguyệt), Thế Cân (mục 7.5),
  Hủy Bài / Huyết Tế đều xét và tính cho ghế P. Khóa Tập Kích là `"p<seat>"`
  riêng từng ghế.

### 15.3 Thời hạn trạng thái

- Trạng thái loại "Thời hạn" lưu số **lượt** = `2 × thời hạn` khi áp (cộng dồn cũng
  `2 ×`); giảm 1 ở **cuối mỗi lượt** của bất kỳ người chơi nào. Hiển thị `ceil(/2)`.
- Kết quả: thời hạn 1 luôn kéo qua đúng một lượt của phía kia, bất kể ai áp.
- Trạng thái khác (cộng dồn, vĩnh viễn, một lần, Phản Đòn) giữ §6.
- Đóng Băng trên Hero P: Hero đó không đánh được lá trong **lượt kế tiếp của P**, gỡ ở
  cuối lượt đó. Không có tác dụng "bỏ chuỗi / Dự Trữ về 0" (chỉ cho kẻ địch PvE).

### 15.4 Mục tiêu

- `target: "enemy"` = Hero còn sống của **đối thủ**, không Ẩn Thân; có Hero đối thủ đang
  Khiêu Khích → bắt buộc chọn Hero đó.
- `ally`/`self`/`allAllies`/`allEnemies`: theo seat (`alliesOf`/`opponentsOf`).
- **[GĐ7]** Lá đơn mục tiêu (`target: "enemy"`) nhắm Hero đối thủ có `guard` → chuyển sang người hộ vệ theo cùng luật §9.3.1 bước 1b (người hộ vệ phải cùng phe bị nhắm và còn sống; `hitsIntercepted` +1, `interceptArmor` áp trước khi giải quyết).
- **[GĐ7]** `target: "enemy"` cũng nhận Linh Thú còn sống của đối thủ làm mục tiêu hợp lệ,
  như một Hero (mục 17.3); Linh Thú đối thủ đang Khiêu Khích ép chọn nó theo cùng thứ tự
  Hero trước / Linh Thú sau của §9.3.1 bước 1.
- Hiệu ứng pha và lệnh "cho cả hai phe" (Viên Nguyệt hồi ×2, Huyền Giáp giáp
  ×1.5, Thế Thủ…) áp cho cả hai người chơi.

### 15.5 Effect có nghĩa riêng trong PvP

| Effect | PvE | PvP |
|---|---|---|
| `drainMoonPower` (Tỏa / Đoạt Nguyệt) | Rút quỹ + hủy chiêu từng kẻ địch | Rút **Dự Trữ của đối thủ** một lần: `min(amount, opponent.moonReserve)`; `steal` → quỹ người đánh `+=`. Không có chiêu để hủy |
| Bộ đếm `enemiesKilled` (M06) | Kẻ địch ngã | Hero đối thủ ngã (vẫn "do lá của M06") |
| Hook `enemyKilled` / `heroDied` | Kẻ địch / Hero ngã | `enemyKilled` chạy hook của **người kết liễu**; `heroDied` chạy hook của **người mất Hero** |
| Hook `moonPhaseEntered`, `bloodMoonStarted` | — | Chạy hook của **cả hai**: người đang có lượt trước, rồi người kia |
| `applyStatus charm` lên Hero **[GĐ7]** | Không có tác dụng trên Hero (chỉ kẻ địch, mục 9.3.1 bước 0) | Hero bị Mê Hoặc: lá tấn công đơn mục tiêu **đầu tiên** của Hero đó trong lượt kế tiếp đánh vào **đồng đội còn sống HP cao nhất** của chính nó (không có đồng đội → đánh chính nó); trừ 1 lượt Mê Hoặc; không chuyển sang người hộ vệ (`guard`) vì đòn đã đánh vào phe mình |
| `sealIntent` (Phong Ấn) **[GĐ7]** | Đặt dấu Phong Ấn lên kẻ địch: mỗi chiêu nó thi hành trong lượt kế tiếp chỉ còn phần damage, mất mọi effect khác (mục 5.6) | Không đặt dấu (Hero không có chuỗi ý định); thay vào đó lá **đắt nhất trên tay** của đối thủ (hòa → lá đứng trước) +1 Nguyệt Lực **chỉ trong lượt kế tiếp** của đối thủ |

Mọi effect khác giữ nguyên (đơn vị hành động, `to`, công thức damage §10). **[GĐ7c]**
Chiêu địch của màn Cốt truyện dùng `drainMoonPower` với nghĩa PvP của bảng này (rút Dự
Trữ của người chơi) — mục 9.3.2.

### 15.6 Thắng / thua / hòa

- P thua khi mọi Hero của P ngã, hoặc P Cạn Bài ở đầu lượt của P.
- Cả hai phe cùng hết Hero trong một effect → **người đang có lượt thắng** (ưu tiên
  thắng, tương tự §11).
- `round > roundCap` → **hòa** (`winner = "draw"`).
- Ngoài luật (server quyết): **bỏ cuộc**, hết giờ `timeoutsToForfeit` lượt liên tiếp,
  mất kết nối quá `reconnectSeconds` — Action hệ thống `{ type: "forfeit", player,
  reason, system: true }` chỉ server tạo; client gửi bị từ chối. `winner` = seat còn lại.

### 15.7 Góc nhìn và che thông tin — `viewFor(state, player)`

| Phần | Người xem thấy |
|---|---|
| Tay, Chiêm Bài của mình | Đầy đủ |
| Tay đối thủ | Số lá; instance id `hidden_<n>` |
| Chồng rút của cả hai | Chỉ số lá (id giả `hidden_…`) |
| Chồng bỏ của cả hai | Đầy đủ |
| Pha trăng, `moonDecrees` (Nguyệt Lệnh đã bốc của mọi pha) **[Nguyệt Luân mới]** | Đầy đủ — lịch trăng là thông tin chung của trận |
| Hero, trạng thái, giáp, Nguyệt Lực, Dự Trữ | Đầy đủ |
| Trang bị, Nguyệt Bảo của đối thủ | Đầy đủ |
| `rngState` | `0` |

`redactEvents(events, player)`: event lộ lá đối thủ (`cardsDrawn`, `mulliganed`,
`choiceOpened`, `cardChosen`, `deckShuffled`) đổi thành bản chỉ có số lượng; `cardPlayed`
giữ nguyên. Client nhận `{ events, view }` sau mỗi Action (server làm authority).

---

## 16. Co-op — Liên Thủ [GĐ6]

Trận 2 người đánh chung một boss (spec `17` §8). `mode = "coop"`; `players[0..1]` mỗi
người mang **3 Hero + deck + trang bị + Nguyệt Bảo của mình** ở sức mạnh đầy đủ —
loadout như PvE (`buildLoadout`, không chuẩn hóa như PvP). `heroes` gồm 6 Hero: vị trí
0–2 của người 0, vị trí 3–5 của người 1; hai người được trùng Hero (unit id có tiền tố
`p0_`/`p1_` như PvP). Đánh **một encounter co-op** (boss Nguyệt Thực, §16.5); không có
lượt chơi roguelike co-op. HP Hero theo `heroes.json`.

### 16.1 Tạo trận — `createCoopCombat(data, { seed, players, encounterId })`

`CoopSide = { heroIds, deckCardIds, loadout }` (như `PvpSide` nhưng loadout PvE). Mỗi
người: chồng bài + Nguyệt Lực + tay riêng; `done: false` trên `players[i]` — "đã Xong
lượt này". Thứ tự RNG: dựng/xáo/rút từng seat theo chỉ số; **[Nguyệt Luân mới]**
`rollMoon` bốc pha khởi đầu và 8 Nguyệt Lệnh bằng luồng RNG phụ **trước** khi boss
lên chuỗi đầu (lệnh Nguyệt Sinh ảnh hưởng quỹ lên chuỗi, mục 9.2). State
riêng co-op (`02` §2): `comboUsed`, `playedThisTurn`, `boss { phase, reviveCountdown,
revived }`. Cả hai Đổi Bài song song như §15.1.5.

### 16.2 Lượt đồng thời

Một vòng = **lượt đồng đội** (cả hai cùng đánh) → lượt kẻ địch → cuối vòng.

1. **Đầu lượt đồng đội:** §3.1 cho **cả 6 Hero** theo vị trí 0 → 5 (xóa giáp, bộ đếm,
   Thiêu Đốt / Hồi Phục, Huyết Nguyệt); **[Nguyệt Lệnh]** lệnh hồi "mỗi bên" (Mầm Sống /
   Đoàn Viên) và Thế Cân chạy **một lần** cho bên người chơi tại mốc ghế 0 — heal áp lên
   cả 6 Hero và Linh Thú của hai người; kiểm thắng/thua; rồi với từng người 0 → 1:
   Nguyệt Lực (gồm Nguyệt Sinh), rút bù, Khai Trí, Cạn Bài (§16.6), hook
   `playerTurnStart` và Chiêm Bài lệnh (Bói Nguyệt) của người đó. Đặt
   `done = false` cả hai; `playedThisTurn = []`.
2. **Trong lượt:** **cả hai** gửi Action bất kỳ lúc nào; áp **theo thứ tự nhận**, mỗi
   Action nguyên tử (Chiêm Bài chỉ khóa người đang chọn). `endTurn` của một người =
   **Xong** (`done = true`): người đó không đánh thêm; tay giữ nguyên.
3. Cả hai `done`, hoặc hết `coop-config.turnSeconds` (45 giây — server gửi `endTurn`
   thay người chưa xong; `chooseCard` đầu tiên nếu đang chọn) → cuối lượt §3.3 cho
   người 0 rồi người 1.
4. **Lượt kẻ địch** §9.3 nhắm trong 6 Hero; `allEnemies` từ phía địch trúng cả 6.
   **Cuối vòng** §9.4 + bước boss (§16.5).

Thứ tự áp phụ thuộc thứ tự nhận → hai lần chơi có thể khác nhau, nhưng nhật ký ghi đúng
thứ tự áp nên chạy lại vẫn tất định. Mỗi người nhận event của cả hai phía (gồm lá đồng
đội đánh).

### 16.3 Đồng đội, mục tiêu, bộ đếm

| Khái niệm | Co-op |
|---|---|
| `target: "ally"` | Bất kỳ Hero còn sống trong **6** Hero (hồi máu, giáp cho đồng đội) |
| `allAllies`, hook `each`, `lowestHp`, `front` (phía mình) | 3 Hero của **chính người đánh** — Hợp Kích là ngoại lệ duy nhất (§16.4) |
| `enemy`, `allEnemies` | Kẻ địch (như PvE) |
| Bộ đếm của Hero (vd. F04 `turnsWithAllyRegen`, `regenSpreadsToAllAllies`) | Theo 3 Hero của người sở hữu Hero đó |
| Tay, Nguyệt Lực, Dự Trữ, Dưỡng Nguyệt, Liên Hoàn, Tích Tụ | Riêng mỗi người |
| Tỏa / Đoạt Nguyệt | Như PvE; Đoạt → quỹ của người đánh |
| Pha trăng, `moonDecrees`, Huyết Nguyệt, Đổi Vận | **Dùng chung** — Đổi Vận của một người đổi pha cho cả hai ngay trong lượt |
| Lệnh "đầu lượt" gắn tài nguyên riêng (Nguyệt Sinh, Khai Trí, Chiêm Tinh, Bói Nguyệt, Xả Thân, Huyết Tế, Liên Kích của lá, Đoạn Tuyệt, Luân Hồi) | Theo **ghế** — quỹ / tay / chồng bỏ của người đó |
| Lệnh "mỗi bên" gắn đơn vị (Mầm Sống, Đoàn Viên, Thế Cân, Thế Thủ, Tập Kích, Giữ Giáp, Ám Dạ, Phản Chấn…) | Bên người chơi = **cả 6 Hero** + Linh Thú; khóa Tập Kích `"p<seat>"` riêng từng ghế |
| Hook trang bị / Nguyệt Bảo | Của người sở hữu; trigger theo sự kiện của người đó (`enemyKilled`: người có Hero kết liễu) |

Chiêu địch chọn mục tiêu trong 6 Hero (§9.3.1); Khiêu Khích của Hero người B đổi mục
tiêu cả chiêu nhắm Hero người A.

### 16.4 Hợp Kích — `coop-combos.json`

`CoopComboDef { id, name, text, parts: [CardMatcher, CardMatcher], limit: { perRound: 1,
perCombat?: number }, effects: Effect[] }`. Mỗi `part` khớp một lá của **một người**;
hai lá thuộc hai người khác nhau, thứ tự không quan trọng. `CardMatcher { tag?,
ownerId?, appliesStatus?, effect?, moonPhaseAfter? }` — `appliesStatus` dò cả trong
`conditional`; `moonPhaseAfter` xét pha hiện tại **sau khi** lá kích hoạt giải quyết
xong.

- **Kích hoạt:** ngay sau khi một lá giải quyết xong (sau hook `cardPlayed`, trước khi
  vào chồng bỏ), nếu lá đó khớp một `part`, `playedThisTurn` có lá của **người kia**
  khớp `part` còn lại, và chưa quá `limit` → event `coopComboTriggered { comboId,
  cardIds }` rồi chạy `effects` (đơn vị hành động = Hero đánh lá kích hoạt).
- Mỗi lá chỉ tham gia tối đa một Hợp Kích; nhiều Hợp Kích khớp cùng lúc → theo thứ tự
  trong file. `comboUsed[comboId]` đếm vòng này / cả trận.
- Trong `effects` của Hợp Kích: `allAllies` = **cả 6 Hero** (ngoại lệ duy nhất của
  §16.3). Cho phép effect riêng `execute { threshold, to, elseEffects? }` — chỉ xuất
  hiện trong Hợp Kích: kẻ địch trong `to` có `hp ≤ floor(maxHp × threshold)` ngã ngay
  (không qua giáp; `killerId` = đơn vị hành động; tính `enemiesKilled`); không ai đủ
  ngưỡng → chạy `elseEffects`.
- Hợp Kích không phải lá: không Liên Hoàn, không hook `cardPlayed`, không cộng Sức
  Mạnh / Tích Lực (như §13.4).

### 16.5 Boss nhiều giai đoạn — Nguyệt Thực

`enemies.json` thêm `eclipse_lord` với trường `phases: BossPhaseDef[]`
(`02` §1.5); `encounters.json` thêm `enc_coop_01` `tier: "coop"` (không vào bản đồ
lượt chơi).

`BossPhaseDef { hpBelow, intents, maxIntentsPerRound?, onEnter?, bloodMoonWhileActive?,
reviveAfterRounds? }`:

- **Đổi giai đoạn:** kiểm sau mỗi effect (như thăng cấp); damage vượt ngưỡng không mất.
  Mỗi lần chỉ lên một giai đoạn; một đòn vượt nhiều ngưỡng → vào lần lượt, `onEnter`
  chạy theo thứ tự. Event `bossPhaseChanged { enemyId, phase }`. Chuỗi đã lên **không**
  đổi — bộ chiêu mới áp từ lần lên chuỗi kế tiếp; riêng Huyết Nguyệt giai đoạn 2 có
  hiệu lực ngay.
- `hpBelow` của giai đoạn 1 = 1; các giai đoạn sau giảm dần. `reviveAfterRounds` chỉ ở
  giai đoạn cuối. `alwaysPlan` trên intent = luôn có trong chuỗi khi đủ quỹ (§9.2
  planner lên nó đầu tiên).
- Giai đoạn 2 (`bloodMoonWhileActive`): Huyết Nguyệt liên tục — `bloodMoonRounds` không
  giảm dưới 1 khi còn ở giai đoạn này (lá Cấm Thuật đánh được; Hero mất HP đầu lượt);
  rời giai đoạn → giảm bình thường.
- Giai đoạn 4 (`reviveAfterRounds: 2`): `reviveCountdown` đếm cuối mỗi vòng; về 0 khi
  boss còn sống → **hồi sinh một lần**: hồi tới 50% HP, gỡ mọi debuff, về giai đoạn 3
  (`revived = true`; lần sau HP ≤ 25% chỉ đổi bộ chiêu, không đếm ngược nữa). Boss ngã
  trước khi đếm ngược về 0 là thắng luôn.
- `maxIntentsPerRound` của giai đoạn ghi đè `combatConfig` (boss đánh 4 chiêu/vòng).
- Bộ chiêu và số liệu cụ thể ở `03` §9; chỉ dùng effect đã có (`execute` không dùng cho
  địch).

### 16.6 Thắng / thua co-op

- **Thắng:** mọi kẻ địch ngã (boss đang đếm ngược hồi sinh chưa tính ngã).
- **Thua:** cả 6 Hero ngã.
- **Cạn Bài một người:** đầu lượt đồng đội, người đó hết tay và chồng → 3 Hero của
  người đó **ngã** (event `deckedOut { player }`); đồng đội đánh tiếp.
- **Bỏ cuộc / mất kết nối quá hạn:** Hero của người đó **ngã**; người còn lại đánh tiếp
  một mình (thắng vẫn thưởng). Cả hai rời → trận `void`.

---

## 17. Linh Thú [GĐ7]

Đơn vị thật do Hero triệu hồi, cùng phe Hero (`side: "hero"`), tự hành động ở cuối lượt
người chơi. Dữ liệu: `summons.json` (`SummonDef`, `02` §1.15).

### 17.1 Triệu hồi, triệu hồi lại, thức tỉnh — effect `summon { summonId }`

- Mỗi Hero tối đa 1 Linh Thú, id `prefixedId(state, seat, "summon:<ownerDefId>")` (PvE
  `summon:f09`, nhiều người chơi `p0_summon:f09`). `CombatState.summons?: SummonState[]`
  — **optional**, chỉ được tạo ở lần triệu hồi đầu tiên (state trận cũ không có trường
  này vẫn hợp lệ).
- Hero chủ chưa có Linh Thú → tạo với đủ HP (`SummonDef.maxHp` của `summonId`, hoặc của
  `awakenedId` nếu Hero chủ **đang có hiệu lực** nội tại `awakenSummons`); event
  `summoned { unitId, summonId, ownerHeroId }`.
- Đã có Linh Thú (còn sống) → hồi đầy HP, nhận **Sức Mạnh 1**.
- Hero chủ nhận nội tại `awakenSummons` khi Linh Thú đang sống (lúc thăng cấp) → Linh Thú
  đổi sang `awakenedId`, giữ tỉ lệ HP hiện tại (làm tròn xuống, tối thiểu 1); phát lại
  event `summoned` (báo `summonId` mới).
- Nội tại `summonTaunts { rounds }`: Linh Thú vừa triệu hồi (tạo mới hoặc triệu hồi lại)
  nhận Khiêu Khích `rounds` vòng (×2 trong PvP, mục 15.3).

### 17.2 Hành động cuối lượt

Bước mới trong §3.3, **ngay trước khi chuyển sang lượt kẻ địch**: từng Linh Thú còn sống
chạy `action` của `SummonDef` đang dùng, theo vị trí Hero chủ (Hero chủ đứng trước, Linh
Thú đó hành động trước). Effect `to: "chosen"` trong `action` chọn kẻ địch còn sống,
không Ẩn Thân, theo `targeting` (hòa → vị trí nhỏ); không có mục tiêu → bỏ qua effect đó.
Kiểm tra thắng/thua sau mỗi effect. Event `summonActed { unitId }` trước khi `action`
giải quyết.

Đòn của Linh Thú (`action`) là **đòn tấn công**: Sức Mạnh và Suy Yếu của Linh Thú áp dụng
như đòn thường (mục 10.1); **không có** `damageMultiplierForTag` của pha (ưu đãi đó chỉ
dành cho lá bài). **[Nguyệt Lệnh]** Hit của Linh Thú vẫn nhận thưởng lệnh theo hit như
thường và tính vào `firstHitKeys` của **ghế chủ** (Tập Kích), `attackCardsThisTurn` của
lá thì không liên quan — Liên Kích chỉ xét lá `type: "attack"`.
Linh Thú bị giết (bởi `action` hay bất kỳ nguồn nào) **không** tính vào `enemiesKilled`
trong PvP.

Co-op: sau khi **cả hai** người đã Xong lượt, Linh Thú của người 0 hành động trước, rồi
người 1. PvP: Linh Thú của người đang có lượt hành động ở cuối lượt người đó (như PvE).

### 17.3 Bị nhắm

- Chiêu đơn mục tiêu của kẻ địch chỉ nhắm Linh Thú khi Linh Thú đang **Khiêu Khích**
  (§9.3.1 bước 1: xét cả Hero và Linh Thú, nhiều đơn vị Khiêu Khích → Hero trước, rồi
  Linh Thú, hòa → vị trí nhỏ hơn).
- Lên chuỗi ý định (§9.2 bước 4) **không** chọn Linh Thú làm mục tiêu.
- Effect `to: "allEnemies"` từ phía kẻ địch trúng cả Linh Thú.
- Lá nhắm đồng minh (`target: "ally"` → `to: "chosen"`, hoặc `to: "allAllies"`) tính cả
  Linh Thú của người đánh.
- PvP: lá đơn mục tiêu (`target: "enemy"`) của đối thủ **được chọn** Linh Thú làm mục
  tiêu như một Hero; Khiêu Khích của Linh Thú ép chọn như của Hero (§15.4).

### 17.4 Vòng đời

- Xóa giáp và tick trạng thái của Linh Thú cùng lúc với Hero chủ (đầu lượt người chơi của
  người sở hữu).
- Về 0 HP → event `unitDied`, bị bỏ khỏi `summons`. Linh Thú **không bao giờ** quyết định
  thắng/thua (không tính vào điều kiện "mọi Hero ngã", mục 11 / 15.6 / 16.6).
- Hero chủ ngã → Linh Thú của Hero đó biến mất ngay (event `summonDismissed`), không tính
  là `unitDied`.
- Linh Thú không có lá, không có Nguyệt Lực, không thăng cấp, không bộ đếm; không thể bị
  Hồi Hồn (mục 5.6).

### 17.5 Góc nhìn

`viewFor` (§15.7) hiện Linh Thú của **cả hai bên** — thông tin công khai như Hero.
