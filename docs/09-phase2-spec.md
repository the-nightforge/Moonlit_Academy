# 09 — Đặc tả Giai đoạn 2 (Chiều sâu)

Đặc tả cho giai đoạn 2 theo `00-gdd.md` mục 12: **3 lá Song Hành, 4 từ khóa
phe, 1 boss, Huyết Nguyệt** (thăng cấp Hero đã làm ở bước 1.8). Vẫn offline,
không server.

Phản hồi từ `playtest-notes.md` được dùng để định hướng: trận cần "phải suy
nghĩ" hơn (focus-fire, canh pha, đọc ý định) — các cơ chế mới phải tăng số
quyết định có nghĩa mỗi lượt, không chỉ tăng số liệu.

---

## 1. Từ khóa phe (4 keywords)

Mỗi từ khóa là **một tag trên lá bài** + một nhóm cơ chế nhận diện. Tag mới
thêm vào `cardTagSchema`: `scheme`, `ward`, `harmony` (`forbidden` đã có).

| Viện | Từ khóa | Tag | Cơ chế |
|---|---|---|---|
| Thanh Loan | Mưu Lược | `scheme` | Rút bài, giảm chi phí (dùng `draw`, `costModifierForTag` có sẵn) |
| Huyền Vũ | Hộ Thể | `ward` | Giáp + **Phản Đòn** (status mới `reflect`, mục 2.1) |
| Bạch Lộ | Điều Hòa | `harmony` | Hồi máu, `cleanse`, `freeze`/`weak` (làm chậm = Đóng Băng/Suy Yếu, đã có) |
| Xích Diên | Cấm Thuật | `forbidden` | Tự `loseHp` đổi hiệu ứng mạnh; mạnh hơn / mở khóa trong Huyết Nguyệt (mục 3) |

**Nguyên tắc:** từ khóa là tag, không phải luật riêng. Hiệu ứng cụ thể vẫn
nằm trong `effects` của từng lá; tag cho phép pha trăng / nội tại / lá khác
tham chiếu (ví dụ `costModifierForTag { tag: "scheme" }`).

### 1.1 Status mới: `reflect` (Phản Đòn)

- Loại: buff, có tầng (`value`), thời hạn theo `duration` như các status khác.
- Khi đơn vị có `reflect` nhận `damage` (không tính `loseHp`): nguồn đòn
  **mất HP** bằng `value` của reflect (dùng `hpLost`, không xuyên giáp — đây
  là mất HP chứ không phải damage, để không đệ quy reflect-chồng-reflect).
- Event: dùng lại `hpLost` với `cause: "reflect"` — cần mở rộng union `cause`.
- Vòng đời: giảm thời hạn cuối vòng như status Thời hạn khác (thêm vào
  `DURATION_STATUSES`).

### 1.2 Effect mới

| Effect | Nghĩa |
|---|---|
| `stealBuff(count)` | Chuyển tối đa `count` **buff** từ mục tiêu sang đơn vị hành động. Thứ tự xác định: buff đứng đầu `statuses[]` của mục tiêu. Phát `statusRemoved` + `statusApplied` (giữ nguyên `value`/`duration`/`sourceId`). |
| `bloodMoon(rounds)` | Đặt `bloodMoonRounds = max(hiện tại, rounds)`, phát `bloodMoonStarted`. |

### 1.3 Điều kiện mới cho `conditional`

| Condition | Đúng khi |
|---|---|
| `bloodMoonActive` | `state.bloodMoonRounds > 0` |

---

## 2. Huyết Nguyệt

Hiện thực đúng mục 7.4 của `01-combat-rules.md` (đã định nghĩa sẵn):

- `state.bloodMoonRounds > 0` → Huyết Nguyệt **chồng lên** pha hiện tại (hai
  hiệu ứng cùng áp dụng).
- Đầu lượt người chơi (sau bước tick trạng thái): mọi **Hero** mất 2 HP
  (`hpLost`, cause `"bloodMoon"` — thêm vào union `cause`).
- Cuối vòng: `bloodMoonRounds -= 1`; khi về 0 phát `bloodMoonEnded`.
- Lá `requiresBloodMoon: true` (field mới trên `CardDef`) chỉ đánh được khi
  đang Huyết Nguyệt; `getPlayCardError` trả lỗi "Cần Huyết Nguyệt".
- `bloodMoonRounds` đã có sẵn trong `CombatState` (prototype luôn 0).

**UI:** khi Huyết Nguyệt — nền tối đỏ, icon 🔴 thay cạnh bánh xe, đếm số lượt
còn lại. Pha hiện tại vẫn hiển thị và vẫn tiến bình thường.

**Lá kích hoạt:** thêm 1 lá Đổi Vận phe Xích Diên cho F02 (mục 4.2) dùng
`bloodMoon(2)`.

---

## 3. Song Hành (Bond)

### 3.1 Dữ liệu

`CardDef` mở rộng:

```ts
ownerId?: HeroId;                 // bắt buộc với lá thường
bond?: { owners: [HeroId, HeroId] }; // có mặt → đây là lá Song Hành
```

Đúng một trong hai: `ownerId` XOR `bond`. Lá Song Hành có `owners` 2 Hero.

### 3.2 Dựng deck

- Deck = 15 lá kỹ năng (5 lá × 3 Hero được chọn) **+ 1 lá Song Hành cho mỗi
  cặp bond đủ mặt trong đội**.
- Instance id: `bond01`, `bond02`, … đặt sau `c01`–`c15`.

### 3.3 Luật trong trận

- Chỉ đánh được khi **cả hai** `owners` còn sống; một người ngã → Tàn Chiêu.
- `getPlayCardError`/`isCardPlayable` kiểm tra cả hai.
- **Đơn vị hành động:** mỗi effect có field tùy chọn `actor: 0 | 1` (index
  vào `owners`, mặc định 0) — quyết định `sourceId` cho damage, Tích Lực,
  Đánh Dấu, bộ đếm thăng cấp và cleanup "sau lá tấn công".
- Nội tại per-owner (M06 free card…) **không** áp cho lá Song Hành — lá
  thuộc về cặp, không thuộc một Hero.

### 3.4 Ba lá Song Hành giai đoạn 2

Roster mở rộng thêm **F03 Tần Sương** và **F02 Diệp Linh Lung** (mục 4) →
đội hình chọn 3 trong 5 Hero.

| Lá | Cặp | Giá | Hiệu ứng (đề xuất) |
|---|---|---|---|
| *Băng Hỏa Tranh Phong* | M05 + F03 | 2 | Mục tiêu: gây 8 damage (actor 0). Nếu mục tiêu đang `burn` → áp `freeze` 1 lượt; nếu đang `freeze` → +6 damage. *(Điều chỉnh từ GDD vì chưa có crit.)* |
| *Ảnh Đấu* | M06 + F02 | 1 | `stealBuff(1)` lên mục tiêu địch (actor 1), sau đó M06 nhận `stealth` 1 lượt (actor 0). |
| *Ôn Hỏa Hộ Tế* **[đề xuất mới]** | M05 + F04 | 1 | M05 nhận `taunt` 1 lượt + `regen` 2 tầng (actor 0); rút 1 lá. *(GDD không có cặp cho F04 — cần duyệt.)* |

---

## 4. Hero mới (2)

### 4.1 F03 Tần Sương — Epic, Huyền Vũ, Striker

- HP 32. Bộ đếm `freezesApplied` (+1 mỗi lần lá của F03 áp `freeze`), ngưỡng 3.
- Nội tại `doubleDamageVsFrozen`: damage từ lá của F03 ×2 lên mục tiêu đang
  `freeze` (áp sau Vulnerable, trước khi floor).
- 5 lá (đề xuất, cân bằng sau playtest):

| Lá | Giá | Tag | Hiệu ứng |
|---|---|---|---|
| *Sương Trảm* | 1 | attack | 5 damage; nếu mục tiêu đang freeze: +3 |
| *Hàn Ấn* | 1 | control | freeze 1 lượt (không damage) |
| *Băng Phách Liên Kích* | 2 | attack | 2 hit × 4 |
| *Phong Tuyết Chướng* | 2 | ward | armor 6 + reflect 2 (1 lượt) |
| *Tuyệt Hàn* | 3 | attack | 9 damage; conditional bloodMoonActive: +freeze 1 |

### 4.2 F02 Diệp Linh Lung — Epic, Xích Diên, Specialist

- HP 26. Bộ đếm `buffsStolen` (+1 mỗi buff `stealBuff` cướp được), ngưỡng 3.
- Nội tại `stealBonus`: mỗi lần F02 cướp buff, nhận thêm 1 tầng status đó.
  *(Đơn giản hóa từ GDD "sao chép lá của địch" — lá địch là intent, không
  phải lá; cần duyệt.)*
- 5 lá (đề xuất):

| Lá | Giá | Tag | Hiệu ứng |
|---|---|---|---|
| *Diện Đoạt* | 1 | — | stealBuff(1) |
| *Huyết Trâm* | 1 | forbidden | loseHp 2 (tự), gây 9 damage |
| *Ảnh Tập* | 1 | attack, assassin | 6 damage; conditional selfHasStatus stealth: +4 |
| *Đổi Vận Chú* | 2 | moon | bloodMoon(2) + shiftMoon(+1) |
| *Phệ Hồn* | 3 | forbidden, requiresBloodMoon | loseHp 3 (tự), gây 16 damage |

*(Lá `forbidden` không `requiresBloodMoon` vẫn đánh được mọi lúc — đúng 7.4:
chỉ lá "cần Huyết Nguyệt" mới bị khóa.)*

---

## 5. Boss — Thần Viên Trấn Nguyệt **[đề xuất mới, cần duyệt tên/lore]**

`enc_04`: 1 boss solo, HP 140, armor mở đầu 6. Tận dụng `moonOverrides`
(đã có) để đổi hành vi theo pha — đúng GDD "Boss hành động khác nhau theo
pha".

Pattern gốc (xoay vòng):

1. `attack` 12, targeting `lowestHp`
2. `defend` — tự armor 8 + regen 1
3. `attack` 6 `allEnemies`

`moonOverrides` (ví dụ):

| Pha | Ý định thay thế |
|---|---|
| `full` | heal tự 14 + gỡ 1 debuff (`cleanse`) |
| `new` | `attack` 16, targeting `highestHp` |
| `lastQuarter` | `defend` armor 14 + reflect 3 |
| Huyết Nguyệt | `attack` 10 `allEnemies` (qua `conditional` trong effect? — **mở: `moonOverrides` hiện khớp theo `moonIndex`, Huyết Nguyệt là state riêng; cần thêm `bloodMoonIntent` trên enemy hoặc ưu tiên override khi `bloodMoonRounds>0`**) |

---

## 6. UI bổ sung (theo `05-ui-combat-screen.md` mở rộng)

- **Màn chọn đội** trước trận: chọn 3 trong 5 Hero → hiện lá Song Hành sẽ
  được thêm vào deck.
- Lá Song Hành: viền hai màu (màu chủ của cả 2 Hero), nhãn "Song Hành" nhỏ.
- Chỉ báo Huyết Nguyệt + số lượt còn lại cạnh bánh xe; nền đỏ tối.
- Chip status mới: `Phản X` cho reflect; icon steal trên event.
- Debug panel: nút bật/tắt Huyết Nguyệt, thêm Hero vào đội khi test.

---

## 7. Các thay đổi schema/rules tóm tắt

| Hạng mục | Thay đổi |
|---|---|
| `cardTagSchema` | + `scheme`, `ward`, `harmony` |
| `statusIdSchema` | + `reflect` |
| Effect | + `stealBuff(count)`, `bloodMoon(rounds)`; `actor?: 0\|1` trên effect của lá bond |
| Condition | + `bloodMoonActive` |
| `CardDef` | + `bond`, `requiresBloodMoon?` |
| `CombatEvent` | + `bloodMoonStarted`, `bloodMoonEnded`; `hpLost.cause` + `"reflect"`, `"bloodMoon"` |
| `HeroState` counter | + `freezesApplied`, `buffsStolen` |
| Passive | + `doubleDamageVsFrozen`, `stealBonus` |
| Enemy | + `bloodMoonIntent` (quyết định cơ chế boss-Huyết Nguyệt) |
| Data | `heroes.json` +F03,F02; `cards.json` +10 lá hero + 3 bond; `enemies.json` +boss; `encounters.json` +enc_04 |
| Glossary | + `reflect`=Phản Đòn, `scheme`=Mưu Lược, `ward`=Hộ Thể, `harmony`=Điều Hòa, `forbidden`=Cấm Thuật, `bloodMoonStarted/Ended` |

## 8. Kế hoạch bước (nháp, sẽ đưa vào `07-implementation-plan.md` khi duyệt)

- **2.1** Schema mở rộng (tag/status/effect/condition/bond) + test nạp dữ liệu
- **2.2** `reflect`, `stealBuff`, `bloodMoon` + `requiresBloodMoon` trong rules + test (T61+)
- **2.3** Lá Song Hành: deck construction, playability, actor, Tàn Chiêu + test
- **2.4** F03/F02: bộ đếm + nội tại mới + test
- **2.5** Boss enc_04 + cơ chế `bloodMoonIntent` + test
- **2.6** UI: chọn đội, lá bond, Huyết Nguyệt, chip reflect
- **2.7** Playtest scripted cập nhật (thêm đội hình/enc_04) + notes

## 9. Điểm cần duyệt trước khi code

1. **Cặp bond thứ 3** — GDD không định nghĩa cặp nào cho F04/m05+m06/f04+m06.
   Đề xuất *Ôn Hỏa Hộ Tế* (M05+F04). Phương án thay thế: thêm 2 Hero nữa
   (ví dụ M01+M02) để có cặp GDD sẵn — nặng content hơn nhiều.
2. **F02 nội tại** — GDD ghi "sao chép lá vừa đánh của địch"; địch không
   dùng lá nên đề xuất `stealBonus` (cướp +1 tầng). Cần duyệt.
3. **Boss** — tên/lore *Thần Viên Trấn Nguyệt* tự đặt; cơ chế ý định theo
   Huyết Nguyệt cần thêm `bloodMoonIntent` (chưa có trong schema).
4. **Băng Hỏa Tranh Phong** — GDD dùng crit (chưa có cơ chế); đề xuất
   conditional burn↔freeze.
5. Số liệu lá mới/boss (HP 140, damage…) là điểm khởi đầu — chỉnh sau
   playtest 2.7.
