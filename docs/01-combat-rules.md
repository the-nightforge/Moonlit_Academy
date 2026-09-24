# 01 — Đặc tả luật chiến đấu (Prototype)

Tài liệu này mô tả **chính xác** cách một trận đấu vận hành. Code trong `packages/rules` phải tuân theo từng mục. Thuật ngữ theo `04-glossary.md`.

Phạm vi: giai đoạn 1 (PvE offline). Các mục đánh dấu **[GĐ2]** đã được định nghĩa để giữ chỗ nhưng **chưa cần code**.

---

## 1. Thành phần của trận đấu

| Thành phần | Mô tả |
|---|---|
| **Đội** | 3 Hero, vị trí 0, 1, 2 (trái sang phải). Mỗi Hero có `hp`, `maxHp`, `armor`, danh sách trạng thái, bộ đếm thăng cấp |
| **Kẻ địch** | 1–3 kẻ địch, vị trí 0, 1, 2. Mỗi kẻ địch có `hp`, `maxHp`, `armor`, trạng thái, ý định hiện tại |
| **Deck** | 15 lá (5 lá/Hero) trong prototype. Mỗi lá trong trận là một **card instance** có `instanceId` riêng |
| **Chồng bài** | `drawPile` (rút), `hand` (trên tay), `discardPile` (bỏ) |
| **Nguyệt Lực** | Tài nguyên để đánh bài, **3 mỗi lượt**, không cộng dồn sang lượt sau |
| **Nguyệt Luân** | Chỉ số pha trăng 0–7 (xem mục 7) |
| **RNG** | Trạng thái bộ sinh số ngẫu nhiên có seed, lưu trong state |

---

## 2. Bắt đầu trận

Theo thứ tự:

1. Tạo card instance cho 15 lá, xếp vào `drawPile`, **xáo bằng RNG**.
2. Mọi Hero và kẻ địch: `hp = maxHp`, `armor = 0`, không trạng thái.
3. Nguyệt Luân bắt đầu ở **pha 1 (Lưỡi Liềm Đầu)**.
4. `round = 1`.
5. **Kẻ địch công bố ý định** (mục 9.2).
6. Bắt đầu **lượt người chơi** (mục 3).

---

## 3. Lượt người chơi

### 3.1 Đầu lượt (theo thứ tự)
1. **Xóa giáp** của mọi Hero (`armor = 0`).
2. **Bộ đếm thăng cấp đầu lượt** (F04, mục 8), tính **trước** khi trạng thái kích hoạt.
3. **Kích hoạt trạng thái đầu lượt** của từng Hero theo vị trí 0 → 2: Thiêu Đốt, rồi Hồi Phục (mục 6).
4. Kiểm tra thắng/thua (mục 11).
5. Đặt `moonPower = 3`.
6. **Rút 5 lá** (mục 4.2).
7. Hero đang **Đóng Băng**: các lá của Hero đó không đánh được trong lượt này.

### 3.2 Trong lượt
Người chơi thực hiện bất kỳ số lượng hành động nào:
- `playCard(instanceId, targetId?)`: đánh 1 lá (mục 5).
- `endTurn`: kết thúc lượt.

### 3.3 Cuối lượt người chơi (theo thứ tự)
1. Bỏ toàn bộ bài trên tay vào `discardPile`.
2. Hero bị Đóng Băng trong lượt này: gỡ trạng thái Đóng Băng.
3. Chuyển sang lượt kẻ địch.

---

## 4. Bài

### 4.1 Card instance
- Mỗi lá trong trận có `instanceId` duy nhất (ví dụ `c01`…`c15`) trỏ tới `cardId` trong dữ liệu.
- Một lá **thuộc về** Hero `ownerId` của nó.

### 4.2 Rút bài
Rút từng lá một:
1. Nếu `drawPile` rỗng: xáo `discardPile` bằng RNG, chuyển thành `drawPile` mới.
2. Nếu vẫn rỗng: dừng rút.
3. Nếu trên tay đã có **10 lá**: lá rút thêm đi thẳng vào `discardPile`.

### 4.3 Tàn Chiêu
- Khi Hero **ngã**, mọi lá của Hero đó (ở bất kỳ chồng nào) trở thành **Tàn Chiêu**.
- Tàn Chiêu: vẫn được rút, vẫn chiếm chỗ trên tay, **không đánh được**, bị bỏ cuối lượt như bình thường.

### 4.4 Chi phí
```
chiPhíThựcTế = max(0, cost + các điều chỉnh)
```
Các điều chỉnh (cộng dồn):
- Pha Bán Nguyệt: lá có tag `control` **−1** (tối thiểu 0). *Ghi chú: GDD ghi "tối thiểu 1"; prototype dùng tối thiểu 0.*
- M06 dạng thăng cấp *Vô Nguyệt*: lá **đầu tiên của M06** đánh trong mỗi lượt có chi phí **0** (xem mục 8).

---

## 5. Đánh một lá

### 5.1 Điều kiện hợp lệ
Hành động `playCard` bị **từ chối** (trả về lỗi, state không đổi) nếu:
- Không phải lượt người chơi, hoặc trận đã kết thúc.
- Lá không có trên tay.
- Lá là Tàn Chiêu, hoặc chủ của lá đang Đóng Băng.
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
4. Nếu lá có `type: "attack"`:
   - Gỡ **Tích Lực** của chủ lá (nếu có).
   - Gỡ **Ẩn Thân** của chủ lá (nếu có). *Tấn công làm lộ vị trí.*
5. Chuyển lá vào `discardPile`.

### 5.3 Tham chiếu mục tiêu trong effect
| Giá trị `to` | Nghĩa |
|---|---|
| `self` | Chủ của lá (Hero) hoặc chính kẻ địch đang hành động |
| `chosen` | Mục tiêu được chọn khi đánh lá (hoặc mục tiêu của ý định kẻ địch) |
| `allEnemies` | Mọi đối thủ còn sống của bên hành động (kể cả đang Ẩn Thân), theo vị trí |
| `allAllies` | Mọi đồng đội còn sống của bên hành động, theo vị trí |

Nếu mục tiêu `chosen` đã ngã trước khi tới effect đó: bỏ qua effect đó.

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

Trạng thái bị gỡ khi thời hạn/số tầng/giá trị về 0.

### 6.2 Thời hạn
- Thời hạn tính bằng **vòng**. Mọi trạng thái loại "Thời hạn" giảm 1 ở **cuối vòng** (mục 9.4).
- Ví dụ: áp Suy Yếu 1 lên kẻ địch trong lượt người chơi → có tác dụng trong lượt kẻ địch cùng vòng → hết ở cuối vòng.

### 6.3 Buff và debuff
- **Debuff** (bị Giải Trừ gỡ): `weak`, `vulnerable`, `burn`, `freeze`, `mark`.
- **Buff**: `stealth`, `taunt`, `regen`, `strength`, `empower`.

### 6.4 Giáp
- `armor` là số, không phải trạng thái.
- Giáp của Hero bị xóa ở **đầu lượt người chơi**; giáp của kẻ địch bị xóa ở **đầu lượt kẻ địch**.
- Nhận giáp: `armor += floor(amount × hệ số giáp của pha trăng)`.

---

## 7. Nguyệt Luân

### 7.1 Các pha

| Chỉ số | ID | Tên | Hiệu ứng |
|---|---|---|---|
| 0 | `new` | 🌑 Trăng Non | Lá có tag `assassin`: damage **×1.5**. Ẩn Thân được áp: **+1** thời hạn |
| 1 | `waxingCrescent` | 🌒 Lưỡi Liềm Đầu | — |
| 2 | `firstQuarter` | 🌓 Bán Nguyệt | Lá có tag `control`: chi phí **−1** (tối thiểu 0) |
| 3 | `waxingGibbous` | 🌔 Trăng Khuyết Đầu | — |
| 4 | `full` | 🌕 Trăng Tròn | Mọi hồi máu (kể cả Hồi Phục) **×2** |
| 5 | `waningGibbous` | 🌖 Trăng Khuyết Cuối | — |
| 6 | `lastQuarter` | 🌗 Hạ Huyền | Giáp nhận được **×1.5** |
| 7 | `waningCrescent` | 🌘 Lưỡi Liềm Cuối | — |

Hiệu ứng pha áp dụng cho **cả hai phe** (trừ khi hiệu ứng chỉ nói về tag lá bài, vốn chỉ có ở Hero).

### 7.2 Tiến pha
- Cuối mỗi vòng: `moonIndex = (moonIndex + 1) mod 8`.
- Trận bắt đầu ở pha 1, nên vòng 4 là Trăng Tròn, vòng 8 là Trăng Non.

### 7.3 Đổi Vận
- Effect `shiftMoon(amount)`: `moonIndex = (moonIndex + amount) mod 8` (xử lý số âm đúng: `((i + a) % 8 + 8) % 8`).
- Có tác dụng **ngay lập tức**: các effect và lá đánh sau đó trong lượt dùng pha mới.
- Không ảnh hưởng ý định kẻ địch đã công bố.

### 7.4 Huyết Nguyệt [GĐ2]
- `bloodMoonRounds > 0` → trận ở trạng thái Huyết Nguyệt **chồng lên** pha hiện tại.
- Hiệu ứng: mở khóa lá có tag `forbidden` cần Huyết Nguyệt; mọi Hero mất 2 HP đầu lượt người chơi.
- Giảm 1 ở cuối vòng.

---

## 8. Thăng cấp Hero

- Mỗi Hero có 1 bộ đếm, 1 ngưỡng, 1 nội tại thăng cấp (dữ liệu trong `heroes.json`).
- Khi bộ đếm ≥ ngưỡng: Hero **thăng cấp ngay** (sau effect vừa giải quyết), phát event `heroLeveledUp`. Mỗi Hero thăng cấp tối đa **1 lần/trận**. Hero đã ngã không thăng cấp.

| Hero | Bộ đếm (`counter`) | Cách tăng | Ngưỡng | Nội tại (`passive`) | Hiệu lực |
|---|---|---|---|---|---|
| M05 Hoắc Liệt | `damageTaken` | Cộng số HP **thực sự mất** từ mọi nguồn (kể cả `loseHp` tự gây, Thiêu Đốt). Phần bị giáp chặn không tính | 15 | `attackDamageBonus(3)`: mọi lượt damage từ lá tấn công của M05 +3 | Ngay lập tức |
| F04 Ôn Như Ý | `turnsWithAllyRegen` | Ở bước 3.1.2: nếu có ít nhất 1 Hero còn sống đang có `regen` → +1 | 3 | `regenSpreadsToAllAllies`: khi lá của F04 áp `regen`, áp cùng số tầng cho **mọi Hero còn sống** | Ngay lập tức |
| M06 Tô Dạ | `enemiesKilled` | +1 mỗi kẻ địch ngã do damage từ lá của M06 | 1 | `firstOwnCardFreeEachTurn`: lá đầu tiên của M06 mỗi lượt có chi phí 0 | Từ lượt người chơi kế tiếp |

*Ghi chú: GDD ghi ngưỡng F04 là 4; prototype dùng 3 vì trận ngắn.*

---

## 9. Lượt kẻ địch

### 9.1 Mẫu ý định
- Mỗi kẻ địch có `intentPattern` (danh sách ý định) và `patternIndex`.
- Có thể có `moonOverrides`: nếu **tại thời điểm công bố** pha trăng khớp, dùng ý định thay thế.

### 9.2 Công bố ý định
Xảy ra khi bắt đầu trận và ở cuối mỗi vòng (sau khi tiến pha):
1. Lấy `intentPattern[patternIndex % length]`; nếu có override khớp pha hiện tại thì dùng override.
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
1. **Xóa giáp** của mọi kẻ địch.
2. Kích hoạt Thiêu Đốt, rồi Hồi Phục của từng kẻ địch (vị trí 0 → 2). Kiểm tra thắng/thua.
3. Lần lượt từng kẻ địch còn sống (vị trí 0 → 2):
   - Đang Đóng Băng: bỏ qua ý định, gỡ Đóng Băng.
   - Ngược lại: **xác định lại mục tiêu** (9.3.1) rồi thực hiện các effect của ý định. Kiểm tra thắng/thua sau mỗi effect.

#### 9.3.1 Xác định lại mục tiêu khi thực hiện
Với ý định có mục tiêu đơn:
1. Nếu có Hero còn sống đang **Khiêu Khích** → mục tiêu là Hero đó (nhiều Hero khiêu khích → vị trí nhỏ hơn).
2. Nếu mục tiêu đã công bố còn sống và không Ẩn Thân → giữ nguyên.
3. Ngược lại → chọn lại theo cùng `targeting` (RNG nếu là `random`).
4. Không có mục tiêu hợp lệ → ý định **thất bại**, phát event `intentFizzled`.

Effect có `to: "allEnemies"` từ phía kẻ địch đánh trúng mọi Hero còn sống, kể cả Ẩn Thân.

### 9.4 Cuối vòng (theo thứ tự)
1. Giảm 1 thời hạn mọi trạng thái loại "Thời hạn" của cả hai phe; gỡ trạng thái về 0.
2. Tiến Nguyệt Luân 1 pha (mục 7.2). *(GĐ2: giảm `bloodMoonRounds`.)*
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
4. final = floor(flat × mult), tối thiểu 0
5. Giáp chặn trước: blocked = min(armor, final); armor −= blocked; hp −= (final − blocked)
```

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
- Ghi nhận ai gây đòn kết liễu (để tính `enemiesKilled`).

---

## 11. Thắng / thua

- **Thắng:** mọi kẻ địch ngã → `status = "won"`.
- **Thua:** mọi Hero ngã → `status = "lost"`.
- Kiểm tra sau **mỗi effect**, mỗi tick trạng thái. Trận kết thúc thì mọi hành động sau đó bị từ chối.
- Nếu cả hai cùng xảy ra trong một effect (ví dụ damage lan): ưu tiên **thắng**.

---

## 12. Chưa có trong prototype

Crit, Song Hành, Binh Khí, Nguyệt Bảo, Kỳ Vật, Huyết Nguyệt, Mê Hoặc, triệu hồi, hàng trước/sau. Không code các phần này ở giai đoạn 1.
