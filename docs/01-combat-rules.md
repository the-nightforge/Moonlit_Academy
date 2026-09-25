# 01 — Đặc tả luật chiến đấu (Prototype)

Tài liệu này mô tả **chính xác** cách một trận đấu vận hành. Code trong `packages/rules` phải tuân theo từng mục. Thuật ngữ theo `04-glossary.md`.

Phạm vi: giai đoạn 1–3 (PvE offline). Các mục đánh dấu **[GĐ2]** / **[GĐ3]** thuộc giai đoạn 2 / 3 (bối cảnh: `09-phase2-spec.md`, `10-phase3-spec.md`). Luật lượt chơi: `11-run-rules.md`.

---

## 1. Thành phần của trận đấu

| Thành phần | Mô tả |
|---|---|
| **Đội** | 3 Hero, vị trí 0, 1, 2 (trái sang phải). Mỗi Hero có `hp`, `maxHp`, `armor`, danh sách trạng thái, bộ đếm thăng cấp |
| **Kẻ địch** | 1–3 kẻ địch, vị trí 0, 1, 2. Mỗi kẻ địch có `hp`, `maxHp`, `armor`, trạng thái, ý định hiện tại |
| **Deck** | 15 lá (5 lá/Hero) + 1 lá Song Hành cho mỗi cặp đủ mặt trong đội **[GĐ2]** (mục 4.4). Mỗi lá trong trận là một **card instance** có `instanceId` riêng |
| **Chồng bài** | `drawPile` (rút), `hand` (trên tay), `discardPile` (bỏ) |
| **Nguyệt Lực** | Tài nguyên để đánh bài, **3 mỗi lượt**, không cộng dồn sang lượt sau |
| **Nguyệt Luân** | Chỉ số pha trăng 0–7 (xem mục 7) |
| **RNG** | Trạng thái bộ sinh số ngẫu nhiên có seed, lưu trong state |

---

## 2. Bắt đầu trận

Theo thứ tự:

1. Tạo card instance cho 15 lá kỹ năng (`c01`–`c15`), rồi các lá Song Hành (`bond01`, `bond02`…, mục 4.4), xếp vào `drawPile`, **xáo bằng RNG**. **[GĐ3]** Nếu `CombatSetup.deckCardIds` có: dùng danh sách đó thay cho `cardIds` của 3 Hero (chủ lá = `ownerId`, phải thuộc đội).
2. Mọi Hero và kẻ địch: `hp = maxHp`, `armor = 0`, không trạng thái. **[GĐ3]** Nếu `CombatSetup.heroes` có: `hp`/`maxHp` của Hero lấy từ đó.
3. Nguyệt Luân bắt đầu ở **pha 1 (Lưỡi Liềm Đầu)**.
4. `round = 1`.
5. **Kẻ địch công bố ý định** (mục 9.2).
6. Bắt đầu **lượt người chơi** (mục 3).
7. **[GĐ3]** Kích hoạt hook Kỳ Vật `combatStart` (§13), sau các hook `playerTurnStart` của lượt 1.

---

## 3. Lượt người chơi

### 3.1 Đầu lượt (theo thứ tự)
1. **Xóa giáp** của mọi Hero (`armor = 0`) và gỡ **Phản Đòn** (`reflect`) của mọi Hero **[GĐ2]**.
2. **Bộ đếm thăng cấp đầu lượt** (F04, mục 8), tính **trước** khi trạng thái kích hoạt.
3. **Kích hoạt trạng thái đầu lượt** của từng Hero theo vị trí 0 → 2: Thiêu Đốt, rồi Hồi Phục (mục 6).
4. **Huyết Nguyệt [GĐ2]:** nếu `bloodMoonRounds > 0`, từng Hero còn sống (vị trí 0 → 2) mất 2 HP (mục 7.4); xử lý ngã và thăng cấp như tick Thiêu Đốt.
5. Kiểm tra thắng/thua (mục 11).
6. Đặt `moonPower = 3`.
7. **Rút 5 lá** (mục 4.2).
8. Hero đang **Đóng Băng**: các lá của Hero đó (kể cả lá Song Hành có Hero đó là owner) không đánh được trong lượt này.
9. **[GĐ3]** Kích hoạt hook Kỳ Vật `playerTurnStart` (§13).

### 3.2 Trong lượt
Người chơi thực hiện bất kỳ số lượng hành động nào:
- `playCard(instanceId, targetId?)`: đánh 1 lá (mục 5).
- `endTurn`: kết thúc lượt.

### 3.3 Cuối lượt người chơi (theo thứ tự)
0. **[GĐ3]** Kích hoạt hook Kỳ Vật `playerTurnEnd` (§13). Nếu trận kết thúc: dừng.
1. Bỏ toàn bộ bài trên tay vào `discardPile`.
2. Hero bị Đóng Băng trong lượt này: gỡ trạng thái Đóng Băng.
3. Chuyển sang lượt kẻ địch.

---

## 4. Bài

### 4.1 Card instance
- Mỗi lá trong trận có `instanceId` duy nhất (ví dụ `c01`…`c15`) trỏ tới `cardId` trong dữ liệu.
- Một lá **thuộc về** Hero `ownerId` của nó. Lá Song Hành thuộc về **cả hai** Hero trong `bond.owners` (mục 4.4). Card instance lưu `ownerIds` (1 hoặc 2 phần tử).

### 4.2 Rút bài
Rút từng lá một:
1. Nếu `drawPile` rỗng: xáo `discardPile` bằng RNG, chuyển thành `drawPile` mới.
2. Nếu vẫn rỗng: dừng rút.
3. Nếu trên tay đã có **10 lá**: lá rút thêm đi thẳng vào `discardPile`.

### 4.3 Tàn Chiêu
- Khi Hero **ngã**, mọi lá của Hero đó (ở bất kỳ chồng nào) trở thành **Tàn Chiêu**. Lá Song Hành thành Tàn Chiêu khi **một trong hai** owner ngã.
- Tàn Chiêu: vẫn được rút, vẫn chiếm chỗ trên tay, **không đánh được**, bị bỏ cuối lượt như bình thường.

### 4.4 Lá Song Hành [GĐ2]
- Lá có `bond: { owners: [heroId, heroId] }` thay cho `ownerId`.
- Khi tạo trận: thêm 1 instance cho mỗi lá Song Hành có **cả hai** owner trong đội, theo thứ tự trong `cards.json`, id `bond01`, `bond02`… sau `c01`–`c15`.
- Luật giải quyết: mục 5.4.

### 4.5 Chi phí
```
chiPhíThựcTế = max(0, cost + các điều chỉnh)
```
Các điều chỉnh (cộng dồn):
- Pha Bán Nguyệt: lá có tag `control` **−1** (tối thiểu 0). *Ghi chú: GDD ghi "tối thiểu 1"; prototype dùng tối thiểu 0.*
- Pha Trăng Tròn: lá có tag `harmony` **−1** (tối thiểu 0) **[GĐ2]**.
- Pha Hạ Huyền: lá có tag `ward` **−1** (tối thiểu 0) **[GĐ2]**.
- M06 dạng thăng cấp *Vô Nguyệt*: lá **đầu tiên của M06** đánh trong mỗi lượt có chi phí **0** (xem mục 8). Không áp cho lá Song Hành.

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

### 5.3 Tham chiếu mục tiêu trong effect
**Đơn vị hành động** của một effect: chủ lá (Hero), chính kẻ địch đang thực hiện ý định, hoặc với lá Song Hành là `owners[actor]` (mục 5.4).

| Giá trị `to` | Nghĩa |
|---|---|
| `self` | Đơn vị hành động |
| `chosen` | Mục tiêu được chọn khi đánh lá (hoặc mục tiêu của ý định kẻ địch) |
| `allEnemies` | Mọi đối thủ còn sống của bên hành động (kể cả đang Ẩn Thân), theo vị trí |
| `allAllies` | Mọi đồng đội còn sống của bên hành động, theo vị trí |

Nếu mục tiêu `chosen` đã ngã trước khi tới effect đó: bỏ qua effect đó.

Condition `selfHpBelow`, `selfHasStatus` xét đơn vị hành động của effect `conditional`.

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
| `freeze` | Đóng Băng | Dùng một lần | Hero: không đánh được lá của mình trong lượt người chơi kế tiếp. Kẻ địch: bỏ qua ý định trong lượt kẻ địch kế tiếp | Không có tác dụng nếu đang Đóng Băng |
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
| 2 | `firstQuarter` | 🌓 Bán Nguyệt | Lá có tag `control`: chi phí **−1** (tối thiểu 0) |
| 3 | `waxingGibbous` | 🌔 Trăng Khuyết Đầu | — |
| 4 | `full` | 🌕 Trăng Tròn | Mọi hồi máu (kể cả Hồi Phục) **×2**. Lá có tag `harmony`: chi phí **−1** (tối thiểu 0) **[GĐ2]** |
| 5 | `waningGibbous` | 🌖 Trăng Khuyết Cuối | — |
| 6 | `lastQuarter` | 🌗 Hạ Huyền | Giáp nhận được **×1.5**. Lá có tag `ward`: chi phí **−1** (tối thiểu 0) **[GĐ2]** |
| 7 | `waningCrescent` | 🌘 Lưỡi Liềm Cuối | — |

**[GĐ3]** Modifier của Kỳ Vật đang có cộng thêm vào modifier của pha hiện tại (§13).

Hiệu ứng pha áp dụng cho **cả hai phe** (trừ khi hiệu ứng chỉ nói về tag lá bài, vốn chỉ có ở Hero).

### 7.2 Tiến pha
- Cuối mỗi vòng: `moonIndex = (moonIndex + 1) mod 8`.
- Trận bắt đầu ở pha 1, nên vòng 4 là Trăng Tròn, vòng 8 là Trăng Non.

### 7.3 Đổi Vận
- Effect `shiftMoon(amount)`: `moonIndex = (moonIndex + amount) mod 8` (xử lý số âm đúng: `((i + a) % 8 + 8) % 8`).
- Có tác dụng **ngay lập tức**: các effect và lá đánh sau đó trong lượt dùng pha mới.
- Không ảnh hưởng ý định kẻ địch đã công bố.

### 7.4 Huyết Nguyệt [GĐ2]
- `bloodMoonRounds > 0` → trận ở trạng thái Huyết Nguyệt **chồng lên** pha hiện tại (hai hiệu ứng cùng áp dụng). Trận bắt đầu với `bloodMoonRounds = 0`.
- Effect `bloodMoon(rounds)`: `bloodMoonRounds = max(hiện tại, rounds)`. Nếu giá trị đổi: phát `bloodMoonChanged { rounds, cause: "card" }`.
- **Mở khóa lá:** lá có `requiresBloodMoon: true` (chỉ hợp lệ trên lá có tag `forbidden`) chỉ đánh được khi `bloodMoonRounds > 0` (mục 5.1). Lá `forbidden` khác đánh được mọi lúc.
- **Mất HP:** đầu lượt người chơi, mỗi Hero còn sống mất 2 HP (`hpLost`, cause `"bloodMoon"`) — bước 3.1.4.
- **Giảm:** cuối vòng, sau khi tiến pha và trước khi công bố ý định (mục 9.4): giảm 1, phát `bloodMoonChanged { rounds, cause: "roundEnd" }`.
- Bật Huyết Nguyệt giữa lượt **không** đổi ý định kẻ địch đã công bố.
- Kẻ địch có thể có ý định riêng cho Huyết Nguyệt (`bloodMoonOverride`, mục 9.2).

Ví dụ — `bloodMoon(2)` đánh trong lượt người chơi vòng N:

| Thời điểm | `bloodMoonRounds` |
|---|---|
| Sau khi đánh (vòng N) | 2 — lá cần Huyết Nguyệt đánh được ngay |
| Cuối vòng N | 1 — ý định vòng N+1 công bố trong Huyết Nguyệt |
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
| M06 Tô Dạ | `enemiesKilled` | +1 mỗi kẻ địch ngã do damage từ lá của M06 | 1 | `firstOwnCardFreeEachTurn`: lá đầu tiên của M06 mỗi lượt có chi phí 0 | Từ lượt người chơi kế tiếp |
| F03 Tần Sương **[GĐ2]** | `freezesApplied` | +1 mỗi lần một effect có đơn vị hành động là F03 **thực sự áp** `freeze` lên một mục tiêu (mục tiêu đang Đóng Băng thì không tính) | 3 | `doubleDamageVsFrozen`: damage từ lá của F03 lên mục tiêu đang `freeze` **×2** (mục 10.1) | Ngay lập tức |
| F02 Diệp Linh Lung **[GĐ2]** | `buffsStolen` | +1 mỗi buff được chuyển bởi `stealBuff` có đơn vị hành động là F02 | 2 | `stealBonus`: mỗi buff F02 cướp bằng lá của F02 được thêm **+1** giá trị | Ngay lập tức |

*Ghi chú: GDD ghi ngưỡng F04 là 4; prototype dùng 3 vì trận ngắn. GDD ghi F02 "Cướp 3 buff"; dùng 2 sau playtest 2.8 (`09` mục 12).*

- "Lá của Hero X" trong cột Nội tại **không** gồm lá Song Hành: nội tại thăng cấp không áp cho lá Song Hành **[GĐ2]**.
- Bộ đếm tính cho **đơn vị hành động** của effect, kể cả trong lá Song Hành (mục 5.4). Riêng `enemiesKilled` tính khi kẻ địch ngã do damage từ lá có đơn vị hành động là M06; kẻ địch ngã do Phản Đòn **không** tính.

---

## 9. Lượt kẻ địch

### 9.1 Mẫu ý định
- Mỗi kẻ địch có `intentPattern` (danh sách ý định) và `patternIndex`.
- Có thể có `moonOverrides`: nếu **tại thời điểm công bố** pha trăng khớp, dùng ý định thay thế.
- Có thể có `bloodMoonOverride` **[GĐ2]**: ý định thay thế khi **tại thời điểm công bố** đang Huyết Nguyệt.

### 9.2 Công bố ý định
Xảy ra khi bắt đầu trận và ở cuối mỗi vòng (sau khi tiến pha và giảm `bloodMoonRounds`):
1. Chọn ý định theo thứ tự ưu tiên: `bloodMoonOverride` nếu `bloodMoonRounds > 0` **[GĐ2]**; nếu không, override trong `moonOverrides` khớp pha hiện tại; nếu không, `intentPattern[patternIndex % length]`.
2. `patternIndex += 1` (kể cả khi dùng override).
3. Nếu ý định có mục tiêu đơn: chọn mục tiêu theo `targeting` trong các Hero **còn sống và không Ẩn Thân**:

| `targeting` | Cách chọn (hòa → vị trí nhỏ hơn) |
|---|---|
| `random` | Chọn ngẫu nhiên bằng RNG |
| `lowestHp` | HP hiện tại thấp nhất |
| `highestHp` | HP hiện tại cao nhất |
| `front` | Vị trí nhỏ nhất |

4. Nếu không có Hero hợp lệ (tất cả Ẩn Thân): ý định vẫn công bố, mục tiêu = `null`.
5. Phát event `intentRevealed`.

### 9.3 Thực hiện lượt kẻ địch (theo thứ tự)
1. **Xóa giáp** và gỡ **Phản Đòn** **[GĐ2]** của mọi kẻ địch.
2. Kích hoạt Thiêu Đốt, rồi Hồi Phục của từng kẻ địch (vị trí 0 → 2). Kiểm tra thắng/thua.
3. Lần lượt từng kẻ địch còn sống (vị trí 0 → 2):
   - Đang Đóng Băng: bỏ qua ý định, gỡ Đóng Băng.
   - Ngược lại: **xác định lại mục tiêu** (9.3.1) rồi thực hiện các effect của ý định. Kiểm tra thắng/thua sau mỗi effect. Nếu kẻ địch ngã giữa chừng (do Phản Đòn): dừng ý định, bỏ qua các hit và effect còn lại.

#### 9.3.1 Xác định lại mục tiêu khi thực hiện
Với ý định có mục tiêu đơn:
1. Nếu có Hero còn sống đang **Khiêu Khích** → mục tiêu là Hero đó (nhiều Hero khiêu khích → vị trí nhỏ hơn).
2. Nếu mục tiêu đã công bố còn sống và không Ẩn Thân → giữ nguyên.
3. Ngược lại → chọn lại theo cùng `targeting` (RNG nếu là `random`).
4. Không có mục tiêu hợp lệ → ý định **thất bại**, phát event `intentFizzled`.

Effect có `to: "allEnemies"` từ phía kẻ địch đánh trúng mọi Hero còn sống, kể cả Ẩn Thân.

### 9.4 Cuối vòng (theo thứ tự)
1. Giảm 1 thời hạn mọi trạng thái loại "Thời hạn" của cả hai phe; gỡ trạng thái về 0.
2. Tiến Nguyệt Luân 1 pha (mục 7.2). Sau đó, nếu `bloodMoonRounds > 0`: giảm 1, phát `bloodMoonChanged` **[GĐ2]** (mục 7.4).
3. `round += 1`.
4. Kẻ địch công bố ý định mới (9.2).
5. Bắt đầu lượt người chơi.

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

- Damage từ ý định kẻ địch dùng cùng công thức (bên gây là kẻ địch; không có tag lá bài).
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
- Hero ngã: các lá của Hero thành Tàn Chiêu (4.3), không thể là mục tiêu hồi máu.
- Ghi nhận ai gây đòn kết liễu (để tính `enemiesKilled`). Ngã do Phản Đòn: kẻ kết liễu là đơn vị có Phản Đòn.

### 10.5 Phản Đòn [GĐ2]
- Kích hoạt ở **mỗi lượt damage** (mỗi hit, mỗi mục tiêu) có `final > 0` lên đơn vị có `reflect` — **kể cả khi giáp chặn hết**.
- Nguồn gây damage mất HP = giá trị `reflect` (như `loseHp`: bỏ qua giáp và mọi hệ số). Phát `hpLost { targetId: <nguồn>, cause: "reflect" }` ngay sau `damageDealt` của hit đó.
- Không kích hoạt bởi `loseHp`, Thiêu Đốt, Huyết Nguyệt hay chính Phản Đòn (không đệ quy).
- Xử lý ngã ngay sau hit đó (10.4). Nếu nguồn ngã: dừng lá (5.2 bước 3) hoặc ý định (9.3 bước 3). Kiểm tra thắng/thua như thường.
- Hero mất HP do Phản Đòn: tính vào `damageTaken` như mọi lần mất HP.

---

## 11. Thắng / thua

- **Thắng:** mọi kẻ địch ngã → `status = "won"`.
- **Thua:** mọi Hero ngã → `status = "lost"`.
- Kiểm tra sau **mỗi effect**, mỗi tick trạng thái. Trận kết thúc thì mọi hành động sau đó bị từ chối.
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
| `combatStart` | Cuối `createCombat`: sau khi lượt người chơi đầu tiên đã bắt đầu (đã rút bài) **và** sau các hook `playerTurnStart` của lượt đó | — |
| `playerTurnStart` | Cuối bước đầu lượt (`01` §3.1), sau khi rút bài | — |
| `playerTurnEnd` | Đầu cuối lượt (`01` §3.3), trước khi bỏ bài | — |
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
- Effect Kỳ Vật **không được** dùng `to: "chosen"`, `stealBuff`, `actor`, hay
  (lồng trong `conditional`) condition `target…`. `heroDied` không được dùng
  `actor: "trigger"`. Vi phạm → lỗi khi nạp dữ liệu.
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
