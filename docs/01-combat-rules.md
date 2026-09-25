# 01 — Đặc tả luật chiến đấu (Prototype)

Tài liệu này mô tả **chính xác** cách một trận đấu vận hành. Code trong `packages/rules` phải tuân theo từng mục. Thuật ngữ theo `04-glossary.md`.

Phạm vi: giai đoạn 1–4b (PvE offline). Các mục đánh dấu **[GĐ2]** / **[GĐ3]** / **[GĐ4a]** / **[GĐ4b]** thuộc giai đoạn 2 / 3 / 4a / 4b (bối cảnh: `09-phase2-spec.md`, `10-phase3-spec.md`, `12-phase4a-spec.md`, `13-phase4b-spec.md`). Luật lượt chơi: `11-run-rules.md`. Luật hồ sơ, Tu Luyện và deck: `14-meta-rules.md`.

---

## 1. Thành phần của trận đấu

| Thành phần | Mô tả |
|---|---|
| **Đội** | 3 Hero, vị trí 0, 1, 2 (trái sang phải). Mỗi Hero có `hp`, `maxHp`, `armor`, danh sách trạng thái, bộ đếm thăng cấp |
| **Kẻ địch** | 1–3 kẻ địch, vị trí 0, 1, 2. Mỗi kẻ địch có `hp`, `maxHp`, `armor`, trạng thái, chuỗi chiêu đã lên (`plannedIntents`), Nguyệt Lực và Dự Trữ riêng |
| **Deck** | Các lá độc nhất theo `cardId` (khởi đầu 6 lá/Hero) + 1 lá Song Hành cho mỗi cặp đủ mặt trong đội **[GĐ2]** (mục 4.4). Mỗi lá sinh `copies` bản; mỗi bản trong trận là một **card instance** có `instanceId` riêng |
| **Chồng bài** | `drawPile` (rút), `hand` (trên tay), `discardPile` (bỏ — không bao giờ xáo lại vào chồng rút) |
| **Nguyệt Lực** | Tài nguyên để đánh bài: `min(8, 2 + vòng)` mỗi lượt cộng Dự Trữ (tối đa 3) — `12` §3.1 |
| **Nguyệt Luân** | Chỉ số pha trăng 0–7 (xem mục 7) |
| **RNG** | Trạng thái bộ sinh số ngẫu nhiên có seed, lưu trong state |

---

## 2. Bắt đầu trận

`createCombat` theo thứ tự (quan trọng cho RNG):

1. Tạo chồng bài: mỗi lá trong deck (kể cả lá Song Hành tự thêm, mục 4.4) sinh `copies` bản, mỗi bản một card instance có `instanceId` riêng, theo thứ tự deck; xếp vào `drawPile`, **xáo bằng RNG** (`deckShuffled`). **[GĐ3]** Nếu `CombatSetup.deckCardIds` có: dùng danh sách đó thay cho `cardIds` của 3 Hero (chủ lá = `ownerId`, phải thuộc đội).
2. Mọi Hero và kẻ địch: `hp = maxHp`, `armor = 0`, không trạng thái. **[GĐ3]** Nếu `CombatSetup.heroes` có: `hp`/`maxHp` của Hero lấy từ đó.
3. Nguyệt Luân bắt đầu ở **pha 1 (Lưỡi Liềm Đầu)**; `round = 1`.
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
1. **Xóa giáp** của mọi Hero (`armor = 0`) và gỡ **Phản Đòn** (`reflect`) của mọi Hero **[GĐ2]**.
2. **Bộ đếm thăng cấp đầu lượt** (F04, mục 8), tính **trước** khi trạng thái kích hoạt.
3. **Kích hoạt trạng thái đầu lượt** của từng Hero theo vị trí 0 → 2: Thiêu Đốt, rồi Hồi Phục (mục 6).
4. **Huyết Nguyệt [GĐ2]:** nếu `bloodMoonRounds > 0`, từng Hero còn sống (vị trí 0 → 2) mất `bloodMoonHpLoss` HP (`combatConfig`, mặc định 2; mục 7.4); xử lý ngã và thăng cấp như tick Thiêu Đốt.
5. Kiểm tra thắng/thua (mục 11).
6. `cardsPlayedThisTurn = 0` (Liên Hoàn, mục 5.3) **[GĐ4b]**. `moonPower = base(round) + moonReserve + moonPowerBonus`; event `moonPowerChanged`. **Gốc của vòng** `r`: `base(r) = min(cap, start + (r − 1) × perRound)` theo `combatConfig.moonPower`; quỹ lượt **được vượt** `cap` (`cap + moonReserveMax`, cộng thêm `moonPowerBonus` không trần); `gainMoonPower` cộng thẳng vào quỹ. `moonPowerBonus` là quỹ cộng thêm mỗi đầu lượt từ Dưỡng Nguyệt (xem dưới) **[GĐ4b]**.
7. **Rút bù:** rút tới khi tay có `handSize` lá hoặc chồng rỗng (mục 4.2, `cardsDrawn`).
8. **Cạn Bài:** nếu tay rỗng **và** chồng rỗng → event `deckedOut`, thua (mục 11).
9. Hero đang **Đóng Băng**: các lá của Hero đó (kể cả lá Song Hành có Hero đó là owner) không đánh được trong lượt này.
10. **[GĐ3]** Kích hoạt hook Kỳ Vật `playerTurnStart` (§13).

Vòng 1 đi qua đủ các bước (bước 7 thường không rút gì vì tay đã đủ `handSize` lá sau Đổi Bài).

**[GĐ4b] Dưỡng Nguyệt** (effect `gainMoonPowerPerTurn { amount }`, chỉ trên lá bài): `moonPowerBonus += amount` — từ lượt sau, mỗi đầu lượt quỹ được cộng thêm `moonPowerBonus` (bước 6). Không có trần; cộng dồn qua mọi lần dùng; giữ tới hết trận.

### 3.2 Trong lượt
Người chơi thực hiện bất kỳ số lượng hành động nào:
- `playCard(instanceId, targetId?)`: đánh 1 lá (mục 5).
- `endTurn`: kết thúc lượt.
- `chooseCard(instanceId)`: chỉ khi `status = "choosing"` (Chiêm Bài, xem dưới); trong khi `choosing`, mọi Action khác bị từ chối (`"choice pending"`).

- Đánh lá như mục 5. Lá rời tay sang vùng đang giải quyết (mục 5.2) **trước** khi effect chạy.
- **Giảm cost của M06** (`firstOwnCardDiscount`): lá riêng đầu tiên của Tô Dạ mỗi lượt giảm `amount` Nguyệt Lực (tối thiểu 0), áp **sau** giảm cost theo pha (mục 4.5, mục 8). Không áp cho lá Song Hành.
- **Chiêm Bài** (effect `chooseCard look`): lấy `k = min(look, số lá trong chồng)` lá trên cùng.
  - `k = 0`: không có tác dụng.
  - `k = 1`: lá đó vào tay luôn, không dừng (`cardsDrawn`).
  - `k ≥ 2`: `pendingChoice = { options }`, `status = "choosing"`, event `choiceOpened`. Action `chooseCard` (phải thuộc `options`): lá đó vào tay, các lá còn lại **xuống đáy chồng theo thứ tự `options`**, `status = "playerTurn"`, event `cardChosen`. Vì `chooseCard` luôn là effect cuối, không còn effect nào chờ.
  - Tay luôn còn chỗ vì lá đang đánh đã rời tay (tay ≤ `handSize − 1`).
- Khi Chiêm Bài mở lựa chọn, phần còn lại của việc đánh lá (gỡ Tích Lực/Ẩn Thân của lá tấn công, hook Kỳ Vật `cardPlayed`, lá vào chồng bỏ) **chạy ngay**, không chờ người chơi chọn — các bước đó không phụ thuộc lá được chọn, nên không cần lưu "phần việc còn lại".

### 3.3 Cuối lượt người chơi (theo thứ tự)
0. **[GĐ3]** Kích hoạt hook Kỳ Vật `playerTurnEnd` (§13). Nếu trận kết thúc: dừng.
1. **Không bỏ tay.** Chỉ bỏ các lá **Tàn Chiêu** (có owner đã ngã) vào `discardPile` → `cardDiscarded`. Lá cần Huyết Nguyệt và lá của Hero bị Đóng Băng ở lại tay.
2. Mọi lá còn trên tay: `heldTurns += 1` (Tích Tụ, mục 4.1) **[GĐ4b]**.
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
- Pha Bán Nguyệt: lá có tag `control` **−2** (tối thiểu 0). *Ghi chú: GDD ghi "tối thiểu 1"; prototype dùng tối thiểu 0.*
- Pha Trăng Tròn: lá có tag `harmony` **−2** (tối thiểu 0) **[GĐ2]**.
- Pha Hạ Huyền: lá có tag `ward` **−2** (tối thiểu 0) **[GĐ2]**.
- Sau các điều chỉnh theo pha: M06 dạng thăng cấp *Vô Nguyệt* (`firstOwnCardDiscount`) — lá riêng **đầu tiên của Tô Dạ** đánh trong mỗi lượt giảm thêm `amount` (tối thiểu 0, xem mục 8). Không áp cho lá Song Hành.

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
| `enemy` | 1 kẻ địch còn sống, **không Ẩn Thân** |
| `ally` | 1 Hero còn sống (kể cả chính chủ lá) |

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
6. `cardsPlayedThisTurn += 1` (Liên Hoàn, mục 5.3) **[GĐ4b]** — sau hook `cardPlayed`, nên lá đang đánh không tự đếm mình.

### 5.3 Tham chiếu mục tiêu trong effect
**Đơn vị hành động** của một effect: chủ lá (Hero), chính kẻ địch đang thực hiện chiêu, hoặc với lá Song Hành là `owners[actor]` (mục 5.4).

| Giá trị `to` | Nghĩa |
|---|---|
| `self` | Đơn vị hành động |
| `chosen` | Mục tiêu được chọn khi đánh lá (hoặc mục tiêu của chiêu kẻ địch) |
| `allEnemies` | Mọi đối thủ còn sống của bên hành động (kể cả đang Ẩn Thân), theo vị trí |
| `allAllies` | Mọi đồng đội còn sống của bên hành động, theo vị trí |

Nếu mục tiêu `chosen` đã ngã trước khi tới effect đó: bỏ qua effect đó.

Condition `selfHpBelow`, `selfHasStatus` xét đơn vị hành động của effect `conditional`.

- **[GĐ4b]** Condition `heldTurnsAtLeast { turns }` (Tích Tụ): đúng khi `heldTurns` của bản lá đang đánh ≥ `turns`; ngoài lá bài (chiêu địch, hook Kỳ Vật) luôn sai.
- **[GĐ4b]** Condition `cardsPlayedThisTurnAtLeast { count }` (Liên Hoàn): đúng khi `cardsPlayedThisTurn ≥ count`.

### 5.4 Giải quyết lá Song Hành [GĐ2]
- Mỗi effect có field tùy chọn `actor: 0 | 1` (mặc định 0). Đơn vị hành động của effect = `owners[actor]`. Nó quyết định: `sourceId`, `to: "self"`, phe của `allAllies`/`allEnemies`, condition `self…`, người nhận `stealBuff`, bộ đếm thăng cấp.
- Effect trong `then`/`else` không ghi `actor` thì **kế thừa** `actor` của `conditional` chứa nó.
- **Nội tại thăng cấp không áp** cho lá Song Hành (mục 8). **Bộ đếm thăng cấp vẫn tính** cho đơn vị hành động.
- Điều chỉnh chi phí theo tag của pha trăng áp bình thường.

---

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
| `regen` | Hồi Phục | Cộng dồn | Đầu lượt phe mình: hồi HP = số tầng (áp hệ số hồi máu của pha trăng), rồi −1 tầng | Cộng tầng |
| `strength` | Sức Mạnh | Giá trị vĩnh viễn | +N damage cho mọi đòn tấn công | Cộng giá trị |
| `empower` | Tích Lực | Dùng một lần | +N damage cho **mỗi lượt damage** của lá tấn công kế tiếp của chủ; gỡ sau khi lá đó giải quyết xong | Cộng giá trị |
| `freeze` | Đóng Băng | Dùng một lần | Hero: không đánh được lá của mình trong lượt người chơi kế tiếp. Kẻ địch: bỏ qua cả chuỗi chiêu trong lượt kẻ địch kế tiếp và Dự Trữ về 0 (mục 9.3) | Không có tác dụng nếu đang Đóng Băng |
| `reflect` | Phản Đòn **[GĐ2]** | Theo giáp | Khi nhận damage: nguồn gây damage mất HP = giá trị (mục 10.5). Bị gỡ **cùng lúc với giáp** (mục 6.4), không giảm theo vòng | Cộng giá trị |

Trạng thái bị gỡ khi thời hạn/số tầng/giá trị về 0.

### 6.2 Thời hạn
- Thời hạn tính bằng **vòng**. Mọi trạng thái loại "Thời hạn" giảm 1 ở **cuối vòng** (mục 9.4).
- Ví dụ: áp Suy Yếu 1 lên kẻ địch trong lượt người chơi → có tác dụng trong lượt kẻ địch cùng vòng → hết ở cuối vòng.

### 6.3 Buff và debuff
- **Debuff** (bị Giải Trừ gỡ): `weak`, `vulnerable`, `burn`, `freeze`, `mark`.
- **Buff**: `stealth`, `taunt`, `regen`, `strength`, `empower`, `reflect`.

### 6.4 Giáp
- `armor` là số, không phải trạng thái.
- Giáp của Hero bị xóa ở **đầu lượt người chơi**; giáp của kẻ địch bị xóa ở **đầu lượt kẻ địch**. Phản Đòn bị gỡ cùng lúc **[GĐ2]**.
- Nhận giáp: `armor += floor(amount × hệ số giáp của pha trăng)`.

### 6.5 Cướp buff (`stealBuff`) [GĐ2]
- Effect `stealBuff { count }`: chuyển tối đa `count` **buff** từ mục tiêu `chosen` sang đơn vị hành động, lấy theo thứ tự trong `statuses[]` của mục tiêu.
- Với mỗi buff: gỡ khỏi mục tiêu (`statusRemoved`), rồi áp cho đơn vị hành động với cùng giá trị theo cột "Khi áp thêm" (**không** cộng thưởng Ẩn Thân của Trăng Non) → `statusApplied` với giá trị sau khi gộp.
- Mục tiêu không có buff: không làm gì, không phát event.

---

## 7. Nguyệt Luân

### 7.1 Các pha

| Chỉ số | ID | Tên | Hiệu ứng |
|---|---|---|---|
| 0 | `new` | 🌑 Trăng Non | Lá có tag `assassin`: damage **×1.5**. Ẩn Thân được áp: **+1** thời hạn |
| 1 | `waxingCrescent` | 🌒 Lưỡi Liềm Đầu | — |
| 2 | `firstQuarter` | 🌓 Bán Nguyệt | Lá có tag `control`: chi phí **−2** (tối thiểu 0) |
| 3 | `waxingGibbous` | 🌔 Trăng Khuyết Đầu | — |
| 4 | `full` | 🌕 Trăng Tròn | Mọi hồi máu (kể cả Hồi Phục) **×2**. Lá có tag `harmony`: chi phí **−2** (tối thiểu 0) **[GĐ2]** |
| 5 | `waningGibbous` | 🌖 Trăng Khuyết Cuối | — |
| 6 | `lastQuarter` | 🌗 Hạ Huyền | Giáp nhận được **×1.5**. Lá có tag `ward`: chi phí **−2** (tối thiểu 0) **[GĐ2]** |
| 7 | `waningCrescent` | 🌘 Lưỡi Liềm Cuối | — |

**[GĐ3]** Modifier của Kỳ Vật đang có cộng thêm vào modifier của pha hiện tại (§13).

Hiệu ứng pha áp dụng cho **cả hai phe** (trừ khi hiệu ứng chỉ nói về tag lá bài, vốn chỉ có ở Hero).

### 7.2 Tiến pha
- Cuối mỗi vòng: `moonIndex = (moonIndex + 1) mod 8`.
- Trận bắt đầu ở pha 1, nên vòng 4 là Trăng Tròn, vòng 8 là Trăng Non.

### 7.3 Đổi Vận
- Effect `shiftMoon(amount)`: `moonIndex = (moonIndex + amount) mod 8` (xử lý số âm đúng: `((i + a) % 8 + 8) % 8`).
- Có tác dụng **ngay lập tức**: các effect và lá đánh sau đó trong lượt dùng pha mới.
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
| F02 Diệp Linh Lung **[GĐ2]** | `buffsStolen` | +1 mỗi buff được chuyển bởi `stealBuff` có đơn vị hành động là F02 | 2 | `stealBonus`: mỗi buff F02 cướp bằng lá của F02 được thêm **+1** giá trị | Ngay lập tức |

*Ghi chú: GDD ghi ngưỡng F04 là 4; prototype dùng 3 vì trận ngắn. GDD ghi F02 "Cướp 3 buff"; dùng 2 sau playtest 2.8 (`09` mục 12).*

- "Lá của Hero X" trong cột Nội tại **không** gồm lá Song Hành: nội tại thăng cấp không áp cho lá Song Hành **[GĐ2]**.
- Bộ đếm tính cho **đơn vị hành động** của effect, kể cả trong lá Song Hành (mục 5.4). Riêng `enemiesKilled` tính khi kẻ địch ngã do damage từ lá có đơn vị hành động là M06; kẻ địch ngã do Phản Đòn **không** tính.

---

## 9. Lượt kẻ địch

### 9.1 Bộ chiêu
- Mỗi kẻ địch có `intents`: danh sách chiêu, mỗi chiêu là `IntentDef` kèm `cost` (số nguyên ≥ 0); và đường cong Nguyệt Lực riêng `moonPower: { start, cap }` (`perRound` dùng chung của `combatConfig`).
- Có thể có `moonOverrides`: nếu **tại thời điểm lên chuỗi** pha trăng khớp, dùng chiêu thay thế (là `IntentDef`, không có `cost`).
- Có thể có `bloodMoonOverride` **[GĐ2]**: chiêu thay thế khi **tại thời điểm lên chuỗi** đang Huyết Nguyệt; ưu tiên hơn `moonOverrides`. Chiêu override luôn có cost 0 và đứng đầu chuỗi (mục 9.2).

### 9.2 Lên chuỗi
Nguyệt Lực của kẻ địch theo cùng đường cong với người chơi (`base(r)`, mục 3.1) nhưng dùng `start`/`cap` riêng của kẻ địch. Vòng 1: quỹ = `start` (chưa có Dự Trữ).

Chạy lúc tạo trận (vòng 1) và ở cuối mỗi vòng (mục 9.4, sau khi tiến pha và giảm `bloodMoonRounds`), cho từng kẻ địch còn sống theo vị trí 0 → n. Với quỹ `P = base(r) + moonReserve`:

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

5. `plannedIntents = chain`, `moonPower = quỹ ban đầu`, `moonReserve = min(moonReserveMax, P)`. Phát event `intentsRevealed` (một event cho cả chuỗi; chuỗi rỗng = **Tụ Lực**).

Thứ tự RNG trong một lần lên chuỗi của một kẻ địch: các lần bốc chiêu, rồi chọn mục tiêu theo thứ tự chuỗi.

### 9.3 Thực hiện lượt kẻ địch (theo thứ tự)
1. **Xóa giáp** và gỡ **Phản Đòn** **[GĐ2]** của mọi kẻ địch.
2. Kích hoạt Thiêu Đốt, rồi Hồi Phục của từng kẻ địch (vị trí 0 → 2). Kiểm tra thắng/thua.
3. Lần lượt từng kẻ địch còn sống (vị trí 0 → 2), mỗi kẻ địch thi hành `plannedIntents`:
   - Đang Đóng Băng: phát `intentSkipped` (một event cho cả chuỗi), gỡ Đóng Băng, `moonReserve = 0` (`moonReserveChanged`), bỏ cả chuỗi.
   - Ngược lại: lần lượt từng chiêu trong chuỗi — **xác định lại mục tiêu** (9.3.1) rồi thực hiện các effect của chiêu, phát `intentExecuted` / `intentFizzled` cho từng chiêu. Kiểm tra thắng/thua sau mỗi effect. Nếu kẻ địch ngã giữa chừng (do Phản Đòn): các chiêu còn lại bị hủy.
   - Kết thúc chuỗi: `lastIntentIds` = `id` các chiêu **đã lên chuỗi** (kể cả bị hủy). Trận kết thúc giữa chừng: dừng, bỏ qua phần còn lại.

#### 9.3.1 Xác định lại mục tiêu khi thực hiện
Với chiêu có mục tiêu đơn:
1. Nếu có Hero còn sống đang **Khiêu Khích** → mục tiêu là Hero đó (nhiều Hero khiêu khích → vị trí nhỏ hơn).
2. Nếu mục tiêu đã lên trong chuỗi còn sống và không Ẩn Thân → giữ nguyên.
3. Ngược lại → chọn lại theo cùng `targeting` (RNG nếu là `random`).
4. Không có mục tiêu hợp lệ → chiêu **thất bại**, phát event `intentFizzled`.

Effect có `to: "allEnemies"` từ phía kẻ địch đánh trúng mọi Hero còn sống, kể cả Ẩn Thân.

### 9.4 Cuối vòng (theo thứ tự)
1. Giảm 1 thời hạn mọi trạng thái loại "Thời hạn" của cả hai phe; gỡ trạng thái về 0.
2. Tiến Nguyệt Luân 1 pha (mục 7.2). Sau đó, nếu `bloodMoonRounds > 0`: giảm 1, phát `bloodMoonChanged` **[GĐ2]** (mục 7.4).
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
3. mult  = 1
         × 1.5 nếu pha Trăng Non và lá có tag assassin
         × 0.75 nếu bên gây có weak
         × 1.5 nếu mục tiêu có vulnerable
         × 2 nếu F03 đã thăng cấp, damage từ lá của F03 (không tính lá Song Hành)
             và mục tiêu có freeze                                   [GĐ2]
4. final = floor(flat × mult), tối thiểu 0
5. Giáp chặn trước: blocked = min(armor, final); armor −= blocked; hp −= (final − blocked)
6. Nếu mục tiêu có reflect và final > 0: Phản Đòn (mục 10.5)       [GĐ2]
```

"Bên gây" và "chủ lá" ở trên là đơn vị hành động của effect (mục 5.3).

- Damage từ chiêu kẻ địch dùng cùng công thức (bên gây là kẻ địch; không có tag lá bài).
- Phát event `damageDealt` với `amount`, `blocked`, `hpLost`.

### 10.2 Hồi máu
```
healed = min(maxHp − hp, floor(amount × hệ số hồi máu của pha))
```
- Không hồi cho đơn vị đã ngã. Áp cho cả effect `heal` và tick `regen`.

### 10.3 Mất HP (`loseHp`)
- Trừ thẳng HP, **bỏ qua giáp và mọi hệ số**. Thiêu Đốt cũng tính như mất HP.

### 10.4 Ngã
- `hp ≤ 0` → `hp = 0`, đơn vị **ngã**: gỡ mọi trạng thái, `armor = 0`, phát event `unitDied`.
- Hero ngã — **Tán Chiêu**: mọi bản trong `drawPile` có Hero đó trong `ownerIds` (kể cả lá Song Hành) chuyển sang `discardPile` theo thứ tự trong chồng, phát event `cardsPurged`; lá của Hero đó **trên tay** thành Tàn Chiêu (mục 4.3). Hero đã ngã không thể là mục tiêu hồi máu.
- Ghi nhận ai gây đòn kết liễu (để tính `enemiesKilled`). Ngã do Phản Đòn: kẻ kết liễu là đơn vị có Phản Đòn.

### 10.5 Phản Đòn [GĐ2]
- Kích hoạt ở **mỗi lượt damage** (mỗi hit, mỗi mục tiêu) có `final > 0` lên đơn vị có `reflect` — **kể cả khi giáp chặn hết**.
- Nguồn gây damage mất HP = giá trị `reflect` (như `loseHp`: bỏ qua giáp và mọi hệ số). Phát `hpLost { targetId: <nguồn>, cause: "reflect" }` ngay sau `damageDealt` của hit đó.
- Không kích hoạt bởi `loseHp`, Thiêu Đốt, Huyết Nguyệt hay chính Phản Đòn (không đệ quy).
- Xử lý ngã ngay sau hit đó (10.4). Nếu nguồn ngã: dừng lá (5.2 bước 3) hoặc chiêu (9.3 bước 3). Kiểm tra thắng/thua như thường.
- Hero mất HP do Phản Đòn: tính vào `damageTaken` như mọi lần mất HP.

### 10.6 Phẫn Huyết [GĐ4b]
- Effect `missingHpDamage { ratio, to, hits? }`: mỗi hit, damage gốc `floor((source.maxHp − source.hp) × ratio)` tính **lúc hit**, rồi qua công thức damage bình thường (mục 10.1: Sức Mạnh, Cường Hóa, Đánh Dấu, nội tại, pha trăng, Suy Yếu, Dễ Vỡ). Được dùng trong chiêu địch.

### 10.7 Dư Sinh [GĐ4b]
- Effect `heal` có `overflow: "armor"` (chỉ trên lá bài): `raw = floor(amount × hệ số hồi)`, `healed = min(maxHp − hp, raw)`, `overflow = raw − healed`; nếu `overflow > 0`: mục tiêu nhận `floor(overflow × hệ số giáp)` giáp (`armorGained`).

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

Crit, Binh Khí, Nguyệt Bảo, Mê Hoặc, triệu hồi, hàng trước/sau. Không code các phần này ở giai đoạn 1–2.

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
- **Modifier:** `activeMoonModifiers` đổi thành `activeModifiers` = modifier của
  pha trăng + modifier của mọi Kỳ Vật đang có. Chi phí theo tag, damage theo tag,
  hệ số hồi / giáp, thưởng Ẩn Thân tự áp dụng; các hệ số nhân với nhau.
