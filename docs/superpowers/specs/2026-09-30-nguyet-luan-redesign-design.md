# Nguyệt Luân mới — Nguyệt Lệnh, pha khởi đầu ngẫu nhiên, Nguyệt tính kẻ địch

**Ngày:** 2026-09-30 · **Trạng thái:** chờ duyệt spec · **Thời điểm:** sau 7c Task 5 (server Cốt truyện), **trước** 7c Task 6–7 (nội dung Arc 1–2), vì pha đầu màn và Nguyệt tính kẻ địch Cốt truyện dựa trên luật mới

## 1. Vì sao đổi

Review gameplay sau 7b cho thấy Nguyệt Luân rập khuôn:

1. **Đoán trước 100%.** Pha chỉ phụ thuộc số vòng: trận nào cũng Trăng Tròn ở vòng 4, Trăng Non ở vòng 8.
2. **4/8 pha không có hiệu ứng.**
3. **Hiệu ứng thụ động.** Chủ yếu là "tag X rẻ hơn hoặc mạnh hơn"; chỉ 2 loại địch phản ứng với trăng.
4. **Đổi Vận ít giá trị**, vì pha đích thường trống.

**Mục tiêu:** mỗi trận có một "lịch trăng" khác nhau, pha nào cũng có luật, và cả hai phe đều bị trăng ảnh hưởng. Nhờ vậy người chơi phải tính: đánh ngay hay chờ pha, đẩy trăng đi đâu, né pha mạnh của địch.

**Không đổi:**
- Cấu trúc lượt, kinh tế Nguyệt Lực gốc, và luật Cạn Bài (đã quyết định giữ).
- Huyết Nguyệt, Chọn Pha (M08), `moonPhaseIs`.
- UI màn trận, trừ các điểm ở §6.

## 2. Tổng quan

| Thành phần | Tóm tắt |
|---|---|
| **Ưu đãi tag** (cố định) | Mỗi pha ưu đãi 1 tag lá bài: −1 Nguyệt Lực, riêng Trăng Non là damage ×1.5 cho `assassin` |
| **Nguyệt Lệnh** (bốc mỗi trận) | Mỗi pha có 3 lệnh; lúc tạo trận bốc 1 lệnh cho mỗi pha bằng RNG trong state; áp cho **cả hai phe** |
| **Pha khởi đầu** | Bốc ngẫu nhiên 0–7 lúc tạo trận (trước đây luôn là 1) |
| **Nguyệt tính** | Mỗi loại địch có 1–2 chiêu trăng (`moonOverrides`), thông tin công khai |
| **Hủy Bài, Huyết Tế** | Action mới của người chơi, chỉ hợp lệ khi lệnh tương ứng có hiệu lực |

## 3. Ưu đãi tag cố định

| # | Pha | Ưu đãi | So với cũ |
|---|---|---|---|
| 0 | 🌑 Trăng Non | `assassin`: damage ×1.5 | giữ |
| 1 | 🌒 Lưỡi Liềm Đầu | `scheme` −1 Nguyệt Lực (tối thiểu 0) | mới |
| 2 | 🌓 Bán Nguyệt | `control` −1 | cũ −2 |
| 3 | 🌔 Trăng Khuyết Đầu | `attack` −1 | mới |
| 4 | 🌕 Trăng Tròn | `harmony` −1 | cũ −2 |
| 5 | 🌖 Trăng Khuyết Cuối | `forbidden` −1 | mới |
| 6 | 🌗 Hạ Huyền | `ward` −1 | cũ −2 |
| 7 | 🌘 Lưỡi Liềm Cuối | `moon` −1 | mới |

Tag `heal` không có ưu đãi riêng; Trăng Tròn có lệnh Viên Nguyệt (hồi ×2) trong bể lệnh. Modifier cũ `stealthDurationBonus` (Trăng Non), `healMultiplier ×2` (Trăng Tròn) và `armorMultiplier ×1.5` (Hạ Huyền) chuyển thành **lệnh** trong bể (§4). Chúng không còn cố định.

## 4. Nguyệt Lệnh (24 lệnh)

**Quy ước:**
- "Mỗi bên" nghĩa là: PvE / co-op gồm người chơi (mọi ghế) và phe kẻ địch; PvP gồm từng người chơi.
- "Đầu lượt" của phe kẻ địch là lúc bắt đầu lượt kẻ địch (§9 luật trận).
- Lệnh có hiệu lực khi pha đang là pha của lệnh. Các lệnh "đầu lượt" xét pha **tại thời điểm** đầu lượt đó.
- Lệnh cộng thêm vào modifier Kỳ Vật đang có (`01` §13), giống modifier pha cũ.

| Pha | Id lệnh | Tên | Hiệu ứng | Modifier |
|---|---|---|---|---|
| 0 Trăng Non | `am_da` | Ám Dạ | Mọi hồi máu (kể cả Hồi Phục) ×0.5, làm tròn xuống | `healMultiplier 0.5` (sẵn) |
| | `bong_mo` | Bóng Mờ | Ẩn Thân được áp +1 thời hạn | `stealthDurationBonus 1` (sẵn) |
| | `tap_kich` | Tập Kích | Hit damage **đầu tiên** mỗi lượt của mỗi bên +3 (tính cả damage từ lá bài lẫn chiêu địch; đòn nhiều hit chỉ hit đầu được cộng) | `firstHitBonus { amount: 3 }` |
| 1 Lưỡi Liềm Đầu | `nguyet_sinh` | Nguyệt Sinh | Người chơi: quỹ đầu lượt +1 Nguyệt Lực. Kẻ địch: lên chuỗi trong pha này với quỹ +1 | `turnMoonPowerBonus { amount: 1 }` |
| | `khai_tri` | Khai Trí | Đầu lượt người chơi, sau rút bù: rút thêm 1 lá (tuân `handLimit`) | `turnStartDraw { amount: 1 }` |
| | `mam_song` | Mầm Sống | Đầu lượt mỗi bên, mọi đơn vị còn sống bên đó hồi 2 HP (sau Thiêu Đốt / Hồi Phục) | `turnStartHeal { amount: 2, target: "all" }` |
| 2 Bán Nguyệt | `thien_binh` | Thiên Bình | Mọi debuff có thời hạn mới được áp +1 thời hạn (mọi nguồn) | `debuffDurationBonus { amount: 1 }` |
| | `the_can` | Thế Cân | Đầu lượt người chơi: Hero còn sống HP cao nhất và kẻ địch còn sống HP cao nhất mỗi bên bị Suy Yếu 1 (hòa → vị trí nhỏ nhất). PvP: mỗi người chơi, đầu lượt của mình | `turnStartStatusOnHighestHp { status: "weak", amount: 1 }` |
| | `the_thu` | Thế Thủ | Mỗi đơn vị: hit damage đơn mục tiêu **đầu tiên** nó nhận trong mỗi vòng −3 (tối thiểu 0; trước giáp) | `firstSingleHitReduction { amount: 3 }` |
| 3 Trăng Khuyết Đầu | `lien_kich` | Liên Kích | Lá tấn công (`type: "attack"`) đánh khi trong lượt đã có ít nhất 1 lá tấn công khác được đánh: mỗi hit +2. Kẻ địch: chiêu `kind: "attack"` đứng sau một chiêu `attack` khác trong cùng chuỗi: mỗi hit +2 | `attackChainBonus { amount: 2 }` |
| | `cuong_nguyet` | Cuồng Nguyệt | Sức Mạnh và Cường Hóa được áp gấp đôi giá trị | `buffMultiplier { statuses: ["strength", "empower"], multiplier: 2 }` |
| | `pha_giap` | Phá Giáp | Giáp nhận được ×0.5, làm tròn xuống | `armorMultiplier 0.5` (sẵn) |
| 4 Trăng Tròn | `vien_nguyet` | Viên Nguyệt | Mọi hồi máu ×2 | `healMultiplier 2` (sẵn) |
| | `nguyet_chieu` | Nguyệt Chiếu | Khi vào pha: gỡ Ẩn Thân của mọi đơn vị. Trong pha: áp Ẩn Thân không có tác dụng | `stealthSuppressed` |
| | `doan_vien` | Đoàn Viên | Đầu lượt mỗi bên: đơn vị còn sống HP thấp nhất bên đó (tỉ lệ HP; hòa → vị trí nhỏ nhất) hồi 5 HP | `turnStartHeal { amount: 5, target: "lowestRatio" }` |
| 5 Trăng Khuyết Cuối | `xa_than` | Xả Thân | Người chơi được **hủy** tối đa 2 lá trên tay mỗi lượt (action `discardCard`); mỗi lá hủy +1 Nguyệt Lực | `discardForMoonPower { perTurn: 2, moonPower: 1 }` |
| | `doan_tuyet` | Đoạn Tuyệt | Mỗi lá rời tay vào chồng bỏ **mà không được đánh** (hủy, Tàn Chiêu cuối lượt, vượt `handLimit`) gây 2 damage lên đơn vị đối phương còn sống HP thấp nhất của chủ lá (không phải đòn tấn công) | `discardDamage { amount: 2 }` |
| | `huyet_te` | Huyết Tế | Mỗi lượt 1 lần, người chơi chọn một Hero còn sống có HP > 3: Hero đó mất 3 HP (`loseHp`), người chơi rút 2 lá (action `bloodPact`) | `bloodPact { hp: 3, draw: 2 }` |
| 6 Hạ Huyền | `huyen_giap` | Huyền Giáp | Giáp nhận được ×1.5 | `armorMultiplier 1.5` (sẵn) |
| | `phan_chan` | Phản Chấn | Phản Đòn gây gấp đôi | `reflectMultiplier { multiplier: 2 }` |
| | `giu_giap` | Giữ Giáp | Bước xóa giáp và gỡ Phản Đòn đầu lượt (`01` §3.1 bước 1, và bước tương ứng của kẻ địch) bị bỏ qua | `keepArmor` |
| 7 Lưỡi Liềm Cuối | `chiem_tinh` | Chiêm Tinh | Mọi Chiêm Bài của người chơi xem thêm 2 lá | `chooseCardExtraLook { amount: 2 }` (dùng lại logic nội tại) |
| | `boi_nguyet` | Bói Nguyệt | Đầu lượt người chơi: Chiêm Bài 3 miễn phí (cùng vị trí với Vạn Kim, bước 11.2; nếu cả hai → Bói Nguyệt mở sau Vạn Kim) | `freeChooseCard { look: 3 }` (dùng lại) |
| | `luan_hoi` | Luân Hồi | Cuối lượt người chơi (sau khi bỏ Tàn Chiêu): tối đa 2 lá **mới nhất** trong chồng bỏ về **đáy** chồng rút (lá mới nhất nằm dưới cùng) | `recycleDiscard { count: 2 }` |

### 4.1 Bốc lệnh và pha khởi đầu

Trong `createCombat` (và `createCoopCombat`, `createPvpCombat`), **ngay sau khi xáo chồng bài** (`deckShuffled`), dùng RNG trong state:

1. Bốc pha khởi đầu: `moonIndex = floor(nextRandom(rngState).value × 8)` (`rng.ts`).
2. Với pha 0 → 7 theo thứ tự: bốc 1 trong 3 lệnh của pha (theo thứ tự trong dữ liệu) → `state.moonDecrees: string[8]`.
3. Phát event `moonDecreesRolled { decrees, moonIndex }`.

Ghi đè (Cốt truyện): `CombatSetup.start.moonIndex` (đã có từ 7c) thay pha khởi đầu; `CombatSetup.start.decrees?: Partial<Record<MoonPhaseId, string>>` thay lệnh của các pha được nêu. **RNG vẫn bốc đủ** rồi mới ghi đè, để thứ tự RNG không phụ thuộc có `start` hay không.

Dữ liệu cũ (golden T213, phiếu cũ) sẽ khác kết quả. Chấp nhận: ghi lại golden có duyệt (người dùng đã chấp thuận hướng này), còn phiếu cũ bị từ chối với `409 outdated client` vì `dataVersion` đổi.

### 4.2 Action mới

- `discardCard { instanceId; player? }`:
  - Hợp lệ khi `status = playerTurn`, lệnh hiện tại là `xa_than`, lá nằm trên tay người chơi đó, và số lần hủy trong lượt < `perTurn`.
  - Kết quả: lá vào chồng bỏ (event `cardDiscarded { reason: "discard" }`), rồi `moonPower += moonPower` (của modifier).
  - Đếm bằng `PlayerState.discardsThisTurn`, đặt lại đầu lượt.
- `bloodPact { heroId; player? }`:
  - Hợp lệ khi lệnh hiện tại là `huyet_te`, chưa dùng trong lượt (`PlayerState.bloodPactUsed`), Hero thuộc người chơi, còn sống, `hp > hp của modifier`.
  - Kết quả: Hero mất HP (`hpLost cause "bloodPact"`), rồi `drawCards 2`.
- Server: `combatActionSchema` và schema action của realtime (PvP / co-op) thêm hai action này.

## 5. Nguyệt tính kẻ địch

Dùng `moonOverrides` sẵn có: khi địch lên chuỗi trong pha đó, chiêu thay thế được thêm **miễn phí, đứng đầu chuỗi** (`01` §9.2). Chỉ số là giá trị khởi điểm.

| Kẻ địch | Pha | Id chiêu | Tên | Hiệu ứng |
|---|---|---|---|---|
| `puppet_guard` | `waxingGibbous` | `puppet_moon_hammer` | Nguyệt Chùy | 8 damage → `highestHp` |
| | `waningCrescent` | `puppet_ward_order` | Canh Thư Lệnh | Mọi kẻ địch +6 giáp |
| `shadow_fox` | `full` | `moon_illusion` | Huyễn Nguyệt | giữ |
| | `waningGibbous` | `fox_blood_sip` | Hồ Hút Huyết | 4 damage → `lowestHp`, tự hồi 4 |
| `book_wraith` | `waxingCrescent` | `wraith_open_book` | Mở Sách | Dễ Vỡ 1 → mọi Hero |
| | `waningCrescent` | `wraith_burn_page` | Thiêu Trang | Thiêu Đốt 3 → mọi Hero |
| `black_guard` | `waxingGibbous` | `black_moon_cleave` | Hắc Nguyệt Trảm | 10 damage → `lowestHp` |
| | `waningGibbous` | `black_blood_shield` | Huyết Thuẫn | Tự +10 giáp, Sức Mạnh 1 |
| `fox_king` | `new` | `fox_king_shadow` | Vương Ảnh | Ẩn Thân 1 (tự), 6 damage → `lowestHp` |
| | `waningGibbous` | `fox_king_blood_feast` | Huyết Yến | Tự hồi 6, Suy Yếu 1 → mọi Hero |
| `moon_ape` | `full` / `new` / `lastQuarter` | (giữ) | | giữ |
| | `waxingCrescent` | `ape_moon_rise` | Nguyệt Khởi | Tự Sức Mạnh 1 |
| | `waningCrescent` | `ape_fading_roar` | Tàn Nguyệt Hống | 4 damage → mọi Hero |
| `eclipse_lord` | — | — | — | không đổi (co-op có giai đoạn riêng) |

- Kẻ địch mới của Cốt truyện (7c) mỗi con có 1–2 Nguyệt tính, viết cùng nội dung Arc.
- **Bot:** `knownIntents` (công khai) gộp thêm chiêu trăng của pha kế tiếp (tính từ bộ chiêu, không đọc chuỗi ẩn).

## 6. Giao diện

**Giữ nguyên:** bố cục màn trận, thanh 8 biểu tượng trăng, lá bài, bảng kẻ địch.

**Thay đổi:**
1. **Tooltip pha trăng:** di chuột / chạm biểu tượng pha trên thanh trăng → tooltip (cùng kiểu `ui/card-tooltip.ts`):
   - tên pha, tên + hiệu ứng Nguyệt Lệnh của pha trong trận này, ưu đãi tag;
   - dòng "Đang diễn ra" nếu là pha hiện tại.

   Chữ lấy từ dữ liệu (`name`, `text` của lệnh; `tagBonusText` của pha).
2. **Bỏ dòng "→ kế tiếp: …"** cạnh thanh trăng.
3. **Tooltip kẻ địch** thêm dòng "Nguyệt tính: <tên pha> — <tên chiêu>, <text>" cho mỗi `moonOverride` / `bloodMoonOverride`.
4. **Nút tối thiểu:**
   - Khi `xa_than` có hiệu lực: nút "Hủy" nhỏ trên mỗi lá trên tay kèm số lần còn lại.
   - Khi `huyet_te` có hiệu lực: nút "Huyết Tế" rồi chọn Hero (dùng lại luồng chọn mục tiêu ally).

**Không làm:** lá sáng theo pha, cảnh báo Nguyệt tính, khung giới thiệu đầu trận.

## 7. Dữ liệu

`moon-phases.json` — mỗi pha:

```jsonc
{
  "index": 2, "id": "firstQuarter", "name": "Bán Nguyệt", "icon": "🌓",
  "tagBonus": [{ "type": "costModifierForTag", "tag": "control", "amount": -1, "min": 0 }],
  "tagBonusText": "Lá control: −1 Nguyệt Lực",
  "decrees": [
    { "id": "thien_binh", "name": "Thiên Bình", "text": "Debuff mới được áp +1 thời hạn.",
      "modifiers": [{ "type": "debuffDurationBonus", "amount": 1 }] },
    { "id": "the_can", "name": "Thế Cân", "text": "…", "modifiers": [ … ] },
    { "id": "the_thu", "name": "Thế Thủ", "text": "…", "modifiers": [ … ] }
  ]
}
```

- Trường `modifiers` cũ của pha bị bỏ.
- Schema: `decrees` đúng 3 phần tử, id lệnh duy nhất toàn file.
- `moonModifierSchema` thêm các loại ở §4 (cột Modifier). Mỗi loại chỉ hợp lệ trong `decrees`, trừ các loại sẵn có (vẫn dùng được cho Kỳ Vật như trước).
- `CombatState.moonDecrees: string[]` (8 id), bắt buộc với trận mới.
- `PlayerState.discardsThisTurn?`, `bloodPactUsed?`: optional, chỉ gán khi dùng.
- Hàm tra cứu duy nhất `activeMoonModifiers(data, state, player)` trả `tagBonus` + `modifiers` của lệnh pha hiện tại + modifier Kỳ Vật. Mọi hàm `moon*` trong `moon.ts` đọc qua hàm này.

## 8. Ảnh hưởng và tài liệu

| Mục | Việc |
|---|---|
| `01` | Viết lại §7 (Nguyệt Luân: ưu đãi, Nguyệt Lệnh, bốc lệnh, pha khởi đầu); §2 bước tạo trận; §3.1 (Khai Trí, Mầm Sống/Đoàn Viên, Thế Cân, Bói Nguyệt, Giữ Giáp, Nguyệt Sinh); §3.3 (Luân Hồi); §5 (Hủy Bài, Huyết Tế); §9 (Nguyệt Sinh, Liên Kích, Mầm Sống cho kẻ địch); §10 (Tập Kích, Thế Thủ, Liên Kích, Phản Chấn, Phá Giáp); §15 / §16 (PvP, co-op: áp theo ghế) |
| `02` | Schema `moon-phases.json`, modifier mới, `moonDecrees`, action mới |
| `00` | GDD §3.3 bảng pha |
| `03` | Nguyệt tính kẻ địch |
| `04` | Nguyệt Lệnh, Ưu Đãi Pha, Nguyệt Tính, Hủy Bài, Huyết Tế |
| `05` | Tooltip pha, bỏ "kế tiếp", nút Hủy / Huyết Tế |
| `06` | Test (§9) |
| `16` | Schema action server / realtime |
| Lá bài | Rà text lá / từ khóa nhắc tới "−2 ở Bán Nguyệt"… và chỉ số giả định Trăng Tròn luôn ở vòng 4 |
| Kế hoạch 7c | Task 6–7 (nội dung Arc): viết `start` và Nguyệt tính kẻ địch mới theo luật này; mặc định pha khởi đầu không còn là 1 |

## 9. Test (T314–T325)

T300–T307 đã thuộc 7c, T308–T313 thuộc 7d (`18` §6), nên Nguyệt Luân mới dùng T314–T325.

| Mã | Nội dung |
|---|---|
| T314 | Nạp `moon-phases.json`: mỗi pha đúng 3 lệnh, id duy nhất; modifier mới chỉ trong `decrees` |
| T315 | Bốc lệnh + pha khởi đầu tất định theo seed; `start.moonIndex` / `start.decrees` ghi đè sau khi đã bốc đủ (RNG không đổi) |
| T316 | Ưu đãi tag −1 theo pha; Trăng Non `assassin` ×1.5; lệnh cộng với modifier Kỳ Vật |
| T317 | Ám Dạ ×0.5, Viên Nguyệt ×2, Phá Giáp ×0.5, Huyền Giáp ×1.5, Bóng Mờ, Phản Chấn |
| T318 | Tập Kích (hit đầu mỗi lượt mỗi bên), Thế Thủ (hit đơn đầu mỗi đơn vị mỗi vòng), Liên Kích (lá và chuỗi địch) |
| T319 | Nguyệt Sinh (người chơi + quỹ địch), Khai Trí (`handLimit`), Mầm Sống, Đoàn Viên, Thế Cân |
| T320 | Thiên Bình (+1 thời hạn mọi nguồn, ×2 PvP), Cuồng Nguyệt, Nguyệt Chiếu (gỡ khi vào pha, chặn áp) |
| T321 | `discardCard` (Xả Thân: hợp lệ / sai pha / quá 2 lần / NL), Đoạn Tuyệt (hủy, Tàn Chiêu, vượt `handLimit`) |
| T322 | `bloodPact` (1 lần/lượt, HP > 3, rút 2), Giữ Giáp, Luân Hồi (thứ tự đáy chồng) |
| T323 | Chiêm Tinh (+2 lá), Bói Nguyệt (thứ tự với Vạn Kim và Chọn Pha) |
| T324 | Nguyệt tính: chiêu trăng mới lên đầu chuỗi đúng pha; bot `knownIntents` gộp chiêu trăng pha kế tiếp |
| T325 | PvP / co-op: lệnh áp theo ghế; `viewFor` có `moonDecrees`; server chấp nhận / từ chối `discardCard`, `bloodPact` qua replay |

T213 ghi lại **một lần** sau khi mọi cơ chế xong (có duyệt).

## 10. Cân bằng

- **Bot** dạy thêm:
  - Xả Thân: hủy lá không đánh được hoặc cost cao nhất khi tay ≥ 5 lá.
  - Huyết Tế: dùng khi có Hero HP ≥ 60% và tay < 5 lá.
  - Đổi Vận: tránh đưa trăng vào pha có Nguyệt tính của địch còn sống. Đánh giá pha đích bằng lệnh thay vì modifier cũ.
- **Mô phỏng lại:** PvE 80 seed (12 đội × 6 loại deck), PvP mẫu 4000, co-op.
- **Mục tiêu giữ như trước:**
  - Bot Bộ cơ bản tổng 35–45%.
  - PvP: mỗi Hero 40–60%, vòng TB 8–12, đi trước thắng 47–53%.
  - Co-op: như `17` §8.8.
- **Đo thêm tỉ lệ thắng theo lệnh:** lệnh nào lệch > 10 điểm so với trung bình pha của nó thì chỉnh số (duyệt).

## 11. Thứ tự làm (sẽ thành kế hoạch riêng)

1. Tài liệu luật (§8).
2. Dữ liệu + schema + `activeMoonModifiers`, chuyển 3 modifier cũ thành lệnh, bốc lệnh / pha khởi đầu (T314–T316).
3. Lệnh modifier số học và đầu lượt (T317–T320).
4. Hủy Bài, Huyết Tế, Đoạn Tuyệt, Luân Hồi, Chiêm Tinh, Bói Nguyệt; server / realtime (T321–T323, T325).
5. Nguyệt tính kẻ địch + bot (T324).
6. Client: tooltip pha, bỏ "kế tiếp", tooltip địch, nút Hủy / Huyết Tế.
7. Ghi lại golden (duyệt), mô phỏng, chỉnh số (duyệt), `playtest-notes.md`.
