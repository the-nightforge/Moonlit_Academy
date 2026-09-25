# 12 — Đặc tả Giai đoạn 4a (Kinh tế Nguyệt Lực mới)

Đặc tả cho giai đoạn 4a: đổi kinh tế trận đấu — **Nguyệt Lực tăng dần theo vòng,
Nguyệt Lực Dự Trữ, giữ bài trên tay, chồng bài theo số bản, Cạn Bài, Đổi Bài,
Chiêm Bài, địch dùng Nguyệt Lực và nhiều chiêu mỗi vòng**. Vẫn offline.

Thiết kế được chốt qua review + brainstorming (2026-09-25). Khi đưa vào tài liệu
luật (bước 4a.1): luật trận đấu vào `01`, schema vào `02`, thuật ngữ vào `04`,
test vào `06`, bước vào `07`. Khi có khác biệt, `01` là chuẩn; tài liệu này giữ
bối cảnh và lý do thiết kế.

**Trạng thái:** thiết kế đã duyệt, chưa đưa vào tài liệu luật.

---

## 0. Phạm vi

**Có:** Nguyệt Lực `min(8, 2 + vòng)` + Dự Trữ (tối đa 3); giữ tay, rút bù đủ 6;
Đổi Bài (tối đa 2 lá, đầu trận); chồng bài theo `copies`, không xáo lại chồng bỏ;
Cạn Bài là thua; Tán Chiêu khi Hero ngã; Chiêm Bài thay "rút N"; địch có Nguyệt
Lực + Dự Trữ và dùng chuỗi tối đa 3 chiêu/vòng; bộ chiêu mới cho 6 loại địch;
`combat-config.json`; đặt lại cost/`copies` cho 48 lá; deck khởi đầu 18 lá độc
nhất; client; mô phỏng + chỉnh số.

**Không có (GĐ 4b hoặc sau):** pool 12 lá/Hero và 15 lá mới; sửa 6 cặp lá trùng
cơ chế; Tu Luyện / mở khóa / hồ sơ lưu / màn xếp deck; Binh Khí; PvP; địch có
chồng bài.

**Nguyên tắc:**
- Chiêu địch và lá bài **chỉ dùng effect đã có**, trừ `chooseCard` (thay `draw`).
- Hằng số kinh tế nằm trong data (`combat-config.json`), không hardcode.
- Cost cũ **nhân đôi** cả hệ (lá, giảm cost theo pha, `gainMoonPower`) để giữ
  tương quan đã cân bằng ở GĐ 2–3; nhịp trận mới đến từ đường cong Nguyệt Lực.

**Ràng buộc thiết kế cho sau này:** PvP (chưa làm) nên kéo dài **8–12 vòng**. Trận thường
PvE cũng 8–12 vòng. Đồng hồ Cạn Bài (~16 vòng với chồng ~37 bản) được chọn dài hơn
cả hai để trận kết thúc bằng HP, Cạn Bài chỉ là giới hạn cuối — đổi `handSize`,
`copies` hay đường cong Nguyệt Lực phải giữ đồng hồ trên 12 vòng.

---

## 1. Kiến trúc

| Chỗ | Thay đổi |
|---|---|
| `packages/data/combat-config.json` | **Mới** — hằng số kinh tế (§2.1) |
| `packages/data` schema (zod) | `copies`, `chooseCard`, `intents`, `moonPower` địch, passive M06, config, ràng buộc (§2) |
| `rules/src/turn.ts` | Đầu/cuối lượt mới, Dự Trữ, rút bù, Cạn Bài, bỏ Tàn Chiêu |
| `rules/src/create-combat.ts` | Chồng bài theo `copies`, tay đầu 6, trạng thái `mulligan` |
| `rules/src/draw.ts` | Không xáo lại chồng bỏ; `chooseCard` |
| `rules/src/apply-action.ts` | Action `mulligan`, `chooseCard`; chặn Action theo `status` |
| `rules/src/intent.ts` → `enemy-plan.ts` | Lên chuỗi chiêu theo Nguyệt Lực (§4) |
| `rules/src/enemy-turn.ts` | Thi hành chuỗi, Dự Trữ địch |
| `rules/src/effects.ts` | `chooseCard`; Tán Chiêu khi Hero ngã; passive M06 |
| `rules/src/preview.ts` | `previewEnemyIntent` trả về cả chuỗi |
| `apps/client` | Đổi Bài, Chiêm Bài, tay 6, Dự Trữ, đồng hồ Cạn Bài, chuỗi ý định (§6) |

`rules` vẫn thuần: không `Math.random`, RNG trong state, `applyAction` không
mutate input.

---

## 2. Dữ liệu và trạng thái

### 2.1 `combat-config.json`

```json
{
  "moonPower": { "start": 3, "perRound": 1, "cap": 8 },
  "moonReserveMax": 3,
  "handSize": 6,
  "maxMulligan": 2,
  "maxIntentsPerRound": 3,
  "bloodMoonHpLoss": 2
}
```

Schema: mọi số nguyên ≥ 0; `moonPower.start ≤ moonPower.cap`; `handSize ≥ 1`.
`GameData` thêm `combatConfig`. `BLOOD_MOON_HP_LOSS` trong `turn.ts` bị bỏ.

### 2.2 Dữ liệu tĩnh

| Kiểu | Thay đổi |
|---|---|
| `CardDef` | Thêm `copies: 1 \| 2 \| 3` (bắt buộc; designer đặt tay) |
| `Effect` | **Bỏ** `{ type: "draw" }`. Thêm `{ type: "chooseCard"; look: number }` (`look ≥ 1`) |
| Ràng buộc | `chooseCard` chỉ được là **effect cuối cùng** trong `effects` của một lá (không nằm trong `conditional`); **không** dùng trong chiêu địch hay hook Kỳ Vật |
| `EnemyDef` | `intentPattern` → `intents: EnemyIntentDef[]` (≥ 1). Thêm `moonPower: { start: number; cap: number }` (`start ≤ cap`) |
| `EnemyIntentDef` | `IntentDef & { cost: number }` (số nguyên ≥ 0). `moonOverrides[].intent` và `bloodMoonOverride` vẫn là `IntentDef` (không cost) |
| `LevelUpPassive` | `firstOwnCardFreeEachTurn` → `{ type: "firstOwnCardDiscount"; amount: number }` |

### 2.3 Trạng thái

```ts
type CombatStatus = "mulligan" | "playerTurn" | "choosing" | "enemyTurn" | "won" | "lost";

interface CombatState {
  // ... như cũ
  moonPower: number;        // quỹ hiện tại của người chơi (gốc + Dự Trữ + cộng thêm)
  moonReserve: number;      // Dự Trữ mang vào lượt này (để UI hiển thị)
  pendingChoice: { kind: "chooseCard"; options: string[] } | null;
}

interface EnemyState {
  // ... bỏ patternIndex, currentIntent
  plannedIntents: { intent: IntentDef; cost: number; targetId: string | null }[];
  lastIntentIds: string[];  // chuỗi đã thi hành vòng trước
  moonPower: number;        // quỹ của vòng đã lên chuỗi
  moonReserve: number;      // Dự Trữ sẽ mang sang vòng sau
}

interface HeroState {
  // ... freeCardActive / freeCardUsedThisTurn đổi tên theo passive mới:
  firstCardDiscountActive: boolean;
  firstCardDiscountUsedThisTurn: boolean;
}
```

### 2.4 Action

```ts
type Action =
  | { type: "mulligan"; instanceIds: string[] }
  | { type: "playCard"; instanceId: string; targetId?: string }
  | { type: "chooseCard"; instanceId: string }
  | { type: "endTurn" };
```

| `status` | Action hợp lệ | Lỗi khác |
|---|---|---|
| `mulligan` | `mulligan` | `"mulligan pending"` |
| `playerTurn` | `playCard`, `endTurn` | `mulligan` → `"mulligan already done"`; `chooseCard` → `"no pending choice"` |
| `choosing` | `chooseCard` | `"choice pending"` |
| `enemyTurn` / `won` / `lost` | — | như hiện tại |

### 2.5 Event

| Event | Thay đổi |
|---|---|
| `deckShuffled` | **Bỏ** khỏi luồng rút bài (chỉ còn khi xáo lúc tạo trận và sau Đổi Bài) |
| `mulliganed { returned: string[]; drawn: string[] }` | Mới |
| `choiceOpened { options: string[] }` | Mới |
| `cardChosen { instanceId: string; bottomed: string[] }` | Mới |
| `deckedOut` | Mới — ngay trước `combatEnded { result: "lost" }` |
| `cardsPurged { heroId: string; instanceIds: string[] }` | Mới — Tán Chiêu |
| `moonReserveChanged { side: "hero" \| "enemy"; enemyId?: string; value: number }` | Mới |
| `intentRevealed` → `intentsRevealed { enemyId; moonPower; intents: { intentId; cost; targetId }[] }` | Một event cho cả chuỗi mỗi địch; chuỗi rỗng = Tụ Lực |
| `intentExecuted`, `intentFizzled` | Giữ, một event cho mỗi chiêu trong chuỗi |
| `intentSkipped { reason: "freeze" }` | Giữ, một event cho cả chuỗi bị bỏ |

`CombatEvent` và mọi `switch` trên nó giữ kiểm tra `never` (client `debug.ts`,
`event-animator.ts`).

---

## 3. Luật trận đấu

### 3.1 Nguyệt Lực và Dự Trữ (cả hai phe)

- **Gốc của vòng** `r`: `base(r) = min(cap, start + (r − 1) × perRound)`. Người
  chơi dùng `combatConfig.moonPower`; mỗi địch dùng `start/cap` của nó, `perRound`
  dùng chung.
- **Quỹ lượt** = `base(r) + Dự Trữ`. Quỹ **được vượt** `cap` (tối đa `cap + 3`).
- **Cuối lượt:** `Dự Trữ = min(moonReserveMax, quỹ chưa tiêu)`.
- `gainMoonPower` cộng thẳng vào quỹ; phần dư cuối lượt vẫn chỉ giữ tối đa 3.
- **Bị Đóng Băng mất lượt** (địch): Dự Trữ về 0 — Nguyệt Lực vòng đó mất, không
  vào Dự Trữ.

### 3.2 Tạo trận

Thứ tự (thay `01` §2; quan trọng cho RNG):
1. Tạo chồng bài: mỗi lá trong deck (kể cả lá Song Hành tự thêm) sinh `copies`
   bản, `instanceId` riêng, theo thứ tự deck. Xáo bằng RNG (`deckShuffled`).
2. HP, giáp, trạng thái, Nguyệt Luân pha 1, `round = 1` như hiện tại.
3. Địch lên chuỗi vòng 1 (§4.2), theo vị trí 0 → n.
4. Rút tay đầu `handSize` lá (`cardsDrawn`).
5. `status = "mulligan"`.

Hook Kỳ Vật `combatStart` **giữ vị trí hiện tại**: chạy sau các hook
`playerTurnStart` của lượt 1, tức là **sau Đổi Bài** (§3.3) — để giáp đầu trận
không bị bước xóa giáp đầu lượt 1 xóa mất (T115).

### 3.3 Đổi Bài

`{ type: "mulligan", instanceIds }`:
- Hợp lệ khi `status = "mulligan"`, `instanceIds` có 0..`maxMulligan` phần tử,
  không trùng, đều đang trên tay.
- Xử lý: rút `n` lá từ đỉnh chồng **trước** (thay đúng vị trí trên tay), **rồi**
  đưa `n` lá bị đổi vào chồng và xáo lại chồng bằng RNG. Event `mulliganed`
  (+ `deckShuffled` nếu `n > 0`).
- Chồng có ít hơn `n` lá: chỉ đổi được bằng số lá có trong chồng; lá không đổi
  được ở lại tay.
- Sau đó bắt đầu lượt người chơi vòng 1 (§3.4), rồi hook `combatStart`.
- Mảng rỗng = giữ nguyên tay (không tiêu RNG).

### 3.4 Đầu lượt người chơi (thay `01` §3.1)

1. Xóa giáp và Phản Đòn của mọi Hero.
2. Bộ đếm thăng cấp đầu lượt (F04).
3. Kích hoạt trạng thái đầu lượt từng Hero (0 → 2).
4. Huyết Nguyệt: mỗi Hero còn sống mất `bloodMoonHpLoss` HP.
5. Kiểm tra thắng/thua.
6. `moonPower = base(round) + moonReserve`; event `moonPowerChanged`.
7. **Rút bù** tới khi tay có `handSize` lá hoặc chồng rỗng (`cardsDrawn`).
8. **Cạn Bài:** nếu tay rỗng **và** chồng rỗng → `deckedOut`, thua.
9. Hero đang Đóng Băng: lá của Hero đó (kể cả lá Song Hành) không đánh được lượt này.
10. Hook Kỳ Vật `playerTurnStart`.

Vòng 1 đi qua đủ các bước (bước 7 thường không rút gì vì tay đã đủ 6).

### 3.5 Trong lượt

- Đánh lá như hiện tại. Lá rời tay (vào chồng bỏ) **trước** khi effect chạy.
- **Giảm cost của M06** (`firstOwnCardDiscount`): lá riêng đầu tiên của Tô Dạ mỗi
  lượt giảm `amount` (tối thiểu 0), áp **sau** giảm cost theo pha. Không áp cho lá
  Song Hành.
- **Chiêm Bài** (`chooseCard look`): lấy `k = min(look, số lá trong chồng)` lá trên
  cùng.
  - `k = 0`: không có tác dụng.
  - `k = 1`: lá đó vào tay luôn, không dừng (`cardsDrawn`).
  - `k ≥ 2`: `pendingChoice = { options }`, `status = "choosing"`, event
    `choiceOpened`. Action `chooseCard` (phải thuộc `options`): lá đó vào tay, các lá
    còn lại **xuống đáy chồng theo thứ tự `options`**, `status = "playerTurn"`, event
    `cardChosen`. Vì `chooseCard` luôn là effect cuối, không còn effect nào chờ.
  - Tay luôn còn chỗ vì lá đang đánh đã rời tay (tay ≤ `handSize − 1`).
- Khi Chiêm Bài mở lựa chọn, phần còn lại của việc đánh lá (gỡ Cường Hóa/Ẩn Thân của lá tấn công, hook Kỳ Vật `cardPlayed`, lá vào chồng bỏ) **chạy ngay**, không chờ người chơi chọn — các bước đó không phụ thuộc lá được chọn, nên không cần lưu "phần việc còn lại".

### 3.6 Cuối lượt người chơi

1. Hook Kỳ Vật `playerTurnEnd`.
2. **Không bỏ tay.** Chỉ bỏ các lá **Tàn Chiêu** (có owner đã ngã) → `cardDiscarded`.
   Lá cần Huyết Nguyệt, lá của Hero bị Đóng Băng ở lại tay.
3. `moonReserve = min(moonReserveMax, moonPower)`; event `moonReserveChanged`.
4. Gỡ Đóng Băng của Hero; lượt địch (§4.3); cuối vòng (`01` §9.4, giữ nguyên, trừ
   phần báo ý định thay bằng lên chuỗi §4.2).

### 3.7 Chồng bài

- **Không bao giờ xáo chồng bỏ vào chồng bài.** Chồng bỏ là "nghĩa địa".
- Rút khi chồng rỗng: ngừng rút, không lỗi, không event.

### 3.8 Hero ngã — Tán Chiêu

Khi Hero ngã (xử lý ngã trong `processDeaths`): mọi bản trong **chồng bài** có
Hero đó trong `ownerIds` (kể cả lá Song Hành) chuyển sang chồng bỏ theo thứ tự
trong chồng; event `cardsPurged`. Lá của Hero đó **trên tay** thành Tàn Chiêu (không
đánh được, như hiện tại) và bị bỏ cuối lượt (§3.6).

### 3.9 Thắng / thua

Thêm Cạn Bài (§3.4 bước 8). Còn lại như `01` §11. Không còn giới hạn vòng trong
luật (mô phỏng vẫn giữ trần an toàn).

---

## 4. AI địch dùng Nguyệt Lực

### 4.1 Nguyệt Lực địch

Theo §3.1 với `start/cap` riêng. Vòng 1: quỹ = `start` (chưa có Dự Trữ).

### 4.2 Lên chuỗi

Chạy lúc tạo trận (vòng 1) và ở cuối vòng (thay báo ý định), cho từng địch còn
sống theo vị trí 0 → n. Với quỹ `P = base(r) + moonReserve`:

1. `chain = []`, `used = ∅`.
2. **Override:** nếu có Huyết Nguyệt (`bloodMoonOverride`) hoặc override theo pha
   trăng hiện tại → thêm vào `chain` với cost 0.
3. Lặp khi `chain.length < maxIntentsPerRound`:
   - `affordable` = chiêu trong `intents` có `cost ≤ P` và `id ∉ used`.
   - Rỗng → dừng.
   - `top` = chiêu có cost cao nhất trong `intents` (hòa: chiêu đứng trước trong
     data). Nếu `top ∈ affordable` **và** `top.id ∉ lastIntentIds` → chọn `top`.
   - Ngược lại bốc có seed trong `affordable`, **trọng số = cost + 1**.
   - Thêm vào `chain`, `P −= cost`, `used += id`.
4. Mỗi chiêu có `targeting` chọn mục tiêu ngay (như hiện tại, có RNG nếu `random`).
5. `plannedIntents = chain`, `moonPower = quỹ ban đầu`,
   `moonReserve = min(moonReserveMax, P)`. Event `intentsRevealed` (chuỗi rỗng =
   **Tụ Lực**).

Thứ tự RNG trong một lần lên chuỗi của một địch: các lần bốc chiêu, rồi chọn mục
tiêu theo thứ tự chuỗi.

### 4.3 Thi hành (lượt địch)

Theo vị trí 0 → n, sau bước xóa giáp/Phản Đòn và kích hoạt trạng thái (giữ nguyên):
- Địch **Đóng Băng**: `intentSkipped` (một event), gỡ Đóng Băng, `moonReserve = 0`
  (`moonReserveChanged`), bỏ cả chuỗi.
- Ngược lại lần lượt từng chiêu: chọn lại mục tiêu như `reresolveTarget` hiện tại
  (Khiêu Khích, Ẩn Thân, mục tiêu đã ngã) → `intentExecuted` / `intentFizzled`.
- Địch chết giữa chuỗi: các chiêu còn lại bị hủy.
- Kết thúc chuỗi: `lastIntentIds = id` các chiêu **đã lên chuỗi** (kể cả bị hủy).
- Trận kết thúc giữa chừng: dừng như hiện tại.

### 4.4 Xem trước

`previewEnemyIntent(data, state, enemy)` trả về
`{ skipped, intents: { intentId, cost, targetId, fizzles, damages[] }[] }`, không
tiêu RNG. Client cộng damage dự kiến từ cả chuỗi.

---

## 5. Nội dung

### 5.1 Cost và `copies` của 48 lá

Quy tắc khởi điểm: **cost mới = cost cũ × 2**, lá có `draw` (nay `chooseCard`) +1.
`copies`: cost 0–1 → 3, 2–4 → 2, 5+ → 1. Số chốt lại ở bước 4a.8.

| id | Tên | Vai trò (4a) | Cost cũ | Cost mới | `copies` |
|---|---|---|---|---|---|
| `m05_liet_hoa_xung_phong` | Liệt Hỏa Xung Phong | khởi đầu | 2 | 4 | 2 |
| `m05_ho_gam` | Hổ Gầm | khởi đầu | 1 | 2 | 2 |
| `m05_thuong_pha` | Thương Phá | khởi đầu | 1 | 2 | 2 |
| `m05_tran_bac_huyet_tinh` | Trấn Bắc Huyết Tính | khởi đầu | 0 | 0 | 3 |
| `m05_bat_khuat` | Bất Khuất | khởi đầu | 2 | 4 | 2 |
| `m05_bat_dong_nhu_son` | Bất Động Như Sơn | **khởi đầu (mới)** | 2 | 4 | 2 |
| `f04_thao_duoc` | Thảo Dược | khởi đầu | 1 | 2 | 2 |
| `f04_bach_thao_huong` | Bách Thảo Hương | khởi đầu | 1 | 2 | 2 |
| `f04_linh_chi_ho_the` | Linh Chi Hộ Thể | khởi đầu | 1 | 2 | 2 |
| `f04_tinh_tam_tra` | Tịnh Tâm Trà | khởi đầu | 1 | 2 | 2 |
| `f04_nguyet_quang_dan` | Nguyệt Quang Dẫn | khởi đầu | 2 | 5 | 1 |
| `f04_hoi_xuan_tan` | Hồi Xuân Tán | **khởi đầu (mới)** | 2 | 4 | 2 |
| `m06_anh_bo` | Ảnh Bộ | khởi đầu | 1 | 2 | 2 |
| `m06_am_tien` | Ám Tiễn | khởi đầu | 1 | 2 | 2 |
| `m06_doat_menh` | Đoạt Mệnh | khởi đầu | 2 | 4 | 2 |
| `m06_nguyet_anh_an` | Nguyệt Ảnh Ấn | khởi đầu | 1 | 2 | 2 |
| `m06_song_nhan_loan_vu` | Song Nhận Loạn Vũ | khởi đầu | 2 | 4 | 2 |
| `m06_tang_anh_thich` | Tàng Ảnh Thích | **khởi đầu (mới)** | 1 | 2 | 2 |
| `f03_suong_tram` | Sương Trảm | khởi đầu | 1 | 2 | 2 |
| `f03_han_an` | Hàn Ấn | khởi đầu | 1 | 2 | 2 |
| `f03_bang_phach_lien_kich` | Băng Phách Liên Kích | khởi đầu | 2 | 4 | 2 |
| `f03_phong_tuyet_chuong` | Phong Tuyết Chướng | khởi đầu | 2 | 4 | 2 |
| `f03_tuyet_han` | Tuyệt Hàn | khởi đầu | 3 | 6 | 1 |
| `f03_tuyet_vu` | Tuyết Vũ | **khởi đầu (mới)** | 2 | 4 | 2 |
| `f02_dien_doat` | Diện Đoạt | khởi đầu | 1 | 2 | 2 |
| `f02_huyet_tram` | Huyết Trâm | khởi đầu | 1 | 2 | 2 |
| `f02_anh_tap` | Ảnh Tập | khởi đầu | 1 | 2 | 2 |
| `f02_doi_van_chu` | Đổi Vận Chú | khởi đầu | 2 | 4 | 2 |
| `f02_phe_hon` | Phệ Hồn | khởi đầu | 3 | 6 | 1 |
| `f02_huyet_khe` | Huyết Khế | **khởi đầu (mới)** | 0 | 0 | 3 |
| `bond_bang_hoa_tranh_phong` | Băng Hỏa Tranh Phong | Song Hành | 2 | 4 | 2 |
| `bond_anh_dau` | Ảnh Đấu | Song Hành | 1 | 2 | 2 |
| `bond_tuyet_trung_tong_than` | Tuyết Trung Tống Thán | Song Hành | 1 | 2 | 2 |
| `m05_thiet_bich` | Thiết Bích | thưởng | 2 | 4 | 2 |
| `m05_no_hoa_lien_hoan` | Nộ Hỏa Liên Hoàn | thưởng | 2 | 4 | 2 |
| `m05_huyet_chien` | Huyết Chiến | thưởng | 1 | 2 | 2 |
| `f04_bang_tam_quyet` | Băng Tâm Quyết | thưởng | 1 | 2 | 2 |
| `f04_thanh_tam_chu` | Thanh Tâm Chú | thưởng | 1 | 3 | 2 |
| `f04_nguyet_lo` | Nguyệt Lộ | thưởng | 0 | 0 | 3 |
| `m06_doc_tieu` | Độc Tiêu | thưởng | 1 | 2 | 2 |
| `m06_anh_phan_than` | Ảnh Phân Thân | thưởng | 2 | 5 | 1 |
| `m06_tuyet_menh` | Tuyệt Mệnh | thưởng | 3 | 6 | 1 |
| `f03_suong_giap` | Sương Giáp | thưởng | 1 | 2 | 2 |
| `f03_bang_toai` | Băng Toái | thưởng | 2 | 4 | 2 |
| `f03_han_phong` | Hàn Phong | thưởng | 1 | 2 | 2 |
| `f02_dien_cu` | Diện Cụ | thưởng | 1 | 3 | 2 |
| `f02_doat_hon_thich` | Đoạt Hồn Thích | thưởng | 2 | 4 | 2 |
| `f02_ta_nguyet_chu` | Tà Nguyệt Chú | thưởng | 0 | 0 | 3 |

Theo dõi khi chỉnh: *Huyết Khế* (0 cost, 3 bản, +4 Nguyệt Lực) có thể quá mạnh
với Dự Trữ — ứng viên đầu tiên để hạ `copies`.

### 5.2 Effect thay đổi

| Chỗ | Cũ | Mới |
|---|---|---|
| Nguyệt Quang Dẫn, Thanh Tâm Chú, Ảnh Phân Thân, Diện Cụ | `draw 1` | `chooseCard look 3` (vẫn là effect cuối); `text` đổi "Rút 1 lá" → "Chiêm Bài 3" |
| Bất Khuất (Trăng Non), Nguyệt Lộ (Trăng Tròn) | `gainMoonPower 1` | `gainMoonPower 2` |
| Huyết Khế | `gainMoonPower 2` | `gainMoonPower 4` |
| `moon-phases.json` (3 modifier `costModifierForTag`) | `amount −1` | `amount −2` (giữ `min 0`) |
| M06 thăng cấp *Vô Nguyệt* | lá đầu tiên miễn phí | `firstOwnCardDiscount 3`; mô tả "lá đầu tiên của Tô Dạ mỗi lượt giảm 3 Nguyệt Lực" |

### 5.3 Deck

`heroes.json`: mỗi Hero chuyển 1 lá từ `rewardCardIds` sang `cardIds` (bảng 5.1,
"khởi đầu (mới)") → 6 lá khởi đầu + 3 lá thưởng. Deck khởi đầu 18 lá độc nhất
(+ lá Song Hành), khớp bộ lá miễn phí GĐ 4b.

| Đội | Lá độc nhất | Bản trong chồng | Cost TB |
|---|---|---|---|
| m05+f04+m06 | 18 | 36 | 2.7 |
| m05+f03+f02 | 19 | 38 | 3.1 |
| m06+f02+f03 | 19 | 37 | 3.0 |
| m05+f03+f04 | 20 | 39 | 3.1 |

Lượt chơi: `RunState.deck` giữ danh sách id (không đổi cấu trúc); lá thưởng thêm
1 id; Nghỉ Chân bỏ 1 id = bỏ mọi bản của lá đó. `minDeckSize` (10 id) giữ nguyên.

### 5.4 Kỳ Vật

| Kỳ Vật | Mới |
|---|---|
| Thanh Loan Vũ | "Mỗi 2 lượt: +2 Nguyệt Lực." — `playerTurnStart`, `every 2`, `gainMoonPower 2` (phần không tiêu vào Dự Trữ; không cần effect mới) |
| Tam Tuyệt Kiếm Phổ | `gainMoonPower 1` → `2` |
| 8 Kỳ Vật còn lại | Giữ nguyên |

### 5.5 Kẻ địch

HP giữ nguyên trừ boss. Mọi chiêu chỉ dùng effect/trạng thái đã có. Số khởi điểm,
chốt ở 4a.8. *(T)* = `targeting`.

**Ảnh Hồ `shadow_fox`** — HP 24, Nguyệt Lực 1→2. Override Trăng Tròn: *Huyễn
Nguyệt* 9 → **7**.

| id | Tên | Cost | Hiệu ứng |
|---|---|---|---|
| `twin_claw` | Song Trảo | 1 | 2 damage ×2 *(lowestHp)* |
| `illusion` | Huyễn Ảnh | 1 | Suy Yếu 2 *(highestHp)* |
| `maul` | Vồ | 1 | 5 damage *(random)* |
| `fox_vanish` | Ẩn Hình | 1 | Tự Ẩn Thân 1; 2 damage *(random)* |
| `fox_shadow_kill` | Ảnh Sát | 2 | 3 damage ×2; mục tiêu đang Suy Yếu: ×3 *(lowestHp)* |

**Khôi Lỗi `puppet_guard`** — HP 42, 1→3. Bỏ `heavy_strike_2`.

| id | Tên | Cost | Hiệu ứng |
|---|---|---|---|
| `guard_stance` | Thủ Thế | 1 | Giáp 8; Hồi Phục 2 (bản thân) |
| `heavy_strike` | Trọng Kích | 1 | 7 damage *(random)* |
| `puppet_mirror_guard` | Phản Giáp | 1 | Giáp 5; Phản Đòn 3 |
| `puppet_quake` | Chấn Địa | 2 | 3 damage mọi Hero |
| `puppet_siege` | Phá Thành | 3 | Xóa giáp mục tiêu; 11 damage *(highestHp)* |

**Thư Hồn `book_wraith`** — HP 32, 1→3.

| id | Tên | Cost | Hiệu ứng |
|---|---|---|---|
| `wraith_curse` | Nguyền | 1 | Dễ Vỡ 2 *(random)* |
| `wraith_mend` | Tự Tu | 1 | Hồi Phục 3 (bản thân) |
| `wraith_strike` | Hồn Kích | 1 | 6 damage *(lowestHp)* |
| `wraith_burn` | Thiêu Thư | 2 | Thiêu Đốt 2 mọi Hero |
| `wraith_seal` | Phong Ấn | 3 | Đóng Băng 1 Hero *(highestHp)* |

**Hắc Giáp `black_guard`** (Tinh Anh) — HP 70, 2→5.

| id | Tên | Cost | Hiệu ứng |
|---|---|---|---|
| `black_roar` | Chấn Hồn | 1 | Suy Yếu 1 mọi Hero |
| `black_bulwark` | Hắc Thuẫn | 2 | Giáp 12; Hồi Phục 3 |
| `black_rage` | Thịnh Nộ | 2 | Sức Mạnh 2 (bản thân) |
| `black_sweep` | Quét Ngang | 3 | 7 damage mọi Hero |
| `black_cleave` | Hắc Trảm | 5 | 16 damage *(lowestHp)* |

**Hồ Vương `fox_king`** (Tinh Anh) — HP 50, 2→5.

| id | Tên | Cost | Hiệu ứng |
|---|---|---|---|
| `fox_king_veil` | Ảnh Mạc | 1 | Tự Ẩn Thân 2 |
| `fox_king_howl` | Tru Hống | 2 | Suy Yếu 2 mọi Hero |
| `fox_king_feast` | Huyết Hồ | 2 | Hồi 8 HP (bản thân) |
| `fox_king_claw` | Vương Trảo | 3 | 10 damage *(highestHp)* |
| `fox_king_nine_tails` | Cửu Vĩ Trảm | 5 | 3 damage ×4; mục tiêu đang Suy Yếu: 5 ×4 *(lowestHp)* |

**Nguyệt Viên `moon_ape`** (Boss) — HP 110 (giữ nguyên; đo ở 4a.8 rồi quyết), 3→8. Giữ 3 override pha trăng
(*Tắm Nguyệt*, *Ám Nguyệt Kích*, *Kính Nguyệt Giáp*) và *Huyết Nguyệt Cuồng*.

| id | Tên | Cost | Hiệu ứng |
|---|---|---|---|
| `ape_guard` | Viên Thủ | 2 | Giáp 8; Hồi Phục 1 |
| `ape_rage` | Cuồng Nộ | 2 | Sức Mạnh 2 (bản thân) |
| `ape_crush` | Nguyệt Chùy | 4 | 12 damage *(lowestHp)* |
| `ape_roar` | Gầm Vang | 4 | 6 damage mọi Hero |
| `ape_heaven_strike` | Thiên Nguyệt Kích | 8 | 20 damage; Dễ Vỡ 2 *(highestHp)* |

Trận thường 8–12 vòng dài hơn hiện tại (5–8) trong khi Nguyệt Lực người chơi gần
gấp đôi → HP địch thường nhiều khả năng phải tăng; chốt ở 4a.8.

Nguyên tắc chỉnh: damage mỗi vòng của địch **đầu trận thấp hơn**, **giữa trận
tương đương**, **cuối trận cao hơn** hiện tại — soi gương đường cong Nguyệt Lực
người chơi.

---

## 6. UI (client)

- **Đổi Bài:** khi `status = "mulligan"`: tay 6 lá, chạm chọn/bỏ chọn tối đa 2,
  nút "Đổi (n)" / "Giữ nguyên" → gửi `mulligan`.
- **Chiêm Bài:** khi `status = "choosing"`: lớp phủ hiện `options`, chạm 1 lá →
  `chooseCard`. Không có nút hủy.
- **Tay 6 lá:** bố trí lại hàng lá trong `combat-scene.ts` vừa khung 1280.
- **Nguyệt Lực:** chấm gốc + chấm Dự Trữ (màu khác), dạng "6 + 2"; nút Kết thúc
  lượt ghi số sẽ giữ ("Giữ 2").
- **Đồng hồ Cạn Bài:** số lá trong chồng hiển thị lớn; ≤ 6 đổi màu cảnh báo; kèm
  số lá chồng bỏ.
- **Địch:** chấm Nguyệt Lực + Dự Trữ; chuỗi tối đa 3 biểu tượng ý định có cost;
  biểu tượng "Tụ Lực"; damage dự kiến từ `previewEnemyIntent` cả chuỗi.
- **Animation:** `mulliganed`, `choiceOpened`, `cardChosen`, `deckedOut`,
  `cardsPurged`, `moonReserveChanged`, `intentsRevealed`; bỏ `deckShuffled` giữa
  trận. `debug.ts`: thêm case, công cụ debug "+Nguyệt Lực" giữ nguyên.
- Mọi chữ tiếng Việt lấy từ data hoặc hằng số UI; client không tính luật (cost
  hiển thị từ `getEffectiveCost`, chuỗi từ `plannedIntents`).

---

## 7. Test

Mã mới từ **T128** (đưa vào `06` ở bước 4a.1). Test luật dùng fixture cố định
(`strike9Intent`, v.v.), không phụ thuộc số cân bằng. Helper `setIntent` →
`setPlan(state, pos, plan)`.

| Mã | Kịch bản |
|---|---|
| T128 | Nguyệt Lực gốc 3, 4, … 8, 8 theo vòng |
| T129 | Dự Trữ = min(3, dư); quỹ vượt trần (8 + 3 = 11); `gainMoonPower` dư cũng tối đa 3 |
| T130 | Địch Đóng Băng: bỏ cả chuỗi, Dự Trữ về 0 |
| T131 | Giữ tay qua lượt; rút bù đủ 6; chồng hết thì rút được bao nhiêu hay bấy nhiêu |
| T132 | Cuối lượt chỉ bỏ Tàn Chiêu; lá Hero bị Đóng Băng và lá cần Huyết Nguyệt ở lại |
| T133 | Chồng bài có đúng `copies` bản mỗi lá (kể cả Song Hành), `instanceId` duy nhất |
| T134 | Không xáo lại chồng bỏ; không có `deckShuffled` giữa trận |
| T135 | Cạn Bài: tay rỗng + chồng rỗng đầu lượt → thua; tay còn lá → chưa thua |
| T136 | Tán Chiêu: Hero ngã → mọi bản trong chồng (kể cả Song Hành) sang chồng bỏ; lá trên tay bị bỏ cuối lượt |
| T137 | Đổi Bài: rút thay trước rồi xáo; lá đổi không quay lại tay; mảng rỗng không tiêu RNG |
| T138 | Đổi Bài: > 2 lá, lá không trên tay, trùng, đổi lần 2 → bị từ chối; `playCard`/`endTurn` bị chặn khi `mulligan` |
| T139 | Chuỗi: ưu tiên chiêu đắt nhất khi đủ tiền và vòng trước chưa dùng; tối đa 3; mỗi chiêu 1 lần/vòng |
| T140 | Chuỗi: bốc có trọng số theo seed — cùng seed ra cùng chuỗi |
| T141 | Tụ Lực: không đủ tiền → chuỗi rỗng, quỹ vào Dự Trữ (tối đa 3) |
| T142 | Override pha trăng / Huyết Nguyệt đứng đầu chuỗi, cost 0, vẫn chọn thêm chiêu |
| T143 | Địch chết giữa chuỗi → chiêu còn lại bị hủy; Khiêu Khích / Ẩn Thân chọn lại mục tiêu từng chiêu |
| T144 | Chiêm Bài: `choosing`, `chooseCard` hợp lệ, 2 lá xuống đáy theo thứ tự; Action khác bị chặn |
| T145 | Chiêm Bài: chồng 1 lá → lấy luôn; chồng rỗng → không tác dụng |
| T146 | M06 thăng cấp: lá riêng đầu tiên −3 (tối thiểu 0), sau giảm theo pha; không áp lá Song Hành |
| T147 | Tất định: cùng seed + cùng chuỗi Action (có Đổi Bài, Chiêm Bài) → cùng state và event |
| T148 | Schema: `copies` ∈ {1,2,3}; `intents` ≥ 1, cost ≥ 0; `start ≤ cap`; `chooseCard` chỉ ở cuối lá; config hợp lệ |

Các test hiện có dựa vào bỏ tay / rút 5 / Nguyệt Lực 3 / `currentIntent` được viết
lại theo luật mới (giữ mã cũ nếu kịch bản còn nghĩa).

---

## 8. Mô phỏng và mục tiêu (bước 4a.8)

Heuristic (cả `playtest.test.ts` và `run-playtest.test.ts`):
- **Đổi Bài:** đổi tối đa 2 lá có cost > 5.
- **Đánh bài:** đánh lá đắt nhất còn đủ Nguyệt Lực trước; mục tiêu như heuristic
  khôn hiện tại (địch ít HP nhất, đồng minh thấp % nhất). Phần dư tự vào Dự Trữ.
- **Chiêm Bài:** lấy lá đắt nhất có cost ≤ `base(round + 1) + 3`.
- Bản đồ / thưởng / Nghỉ Chân: như heuristic khôn hiện tại.
- Trần an toàn 60 vòng/trận vẫn giữ trong mô phỏng.

Chỉ số: tỉ lệ thắng từng trận và cả lượt chơi; số vòng trận thường / Tinh Anh /
boss; % trận thua vì Cạn Bài; % lượt kẹt tay (tay 6 lá, không lá nào đánh được);
Dự Trữ trung bình; số chiêu địch mỗi vòng.

| Mục tiêu | Ngưỡng |
|---|---|
| Trận thường và Tinh Anh | 8–12 vòng |
| Boss | Đo và báo cáo (số vòng, tỉ lệ thắng, Cạn Bài); người dùng quyết mục tiêu sau |
| Thua vì Cạn Bài | < 10% số trận |
| Kẹt tay | < 10% số lượt |
| Thắng lượt chơi (heuristic khôn) | 25–40% |

Chỉnh bằng ablation như GĐ 3; mọi thay đổi data trình duyệt trước khi áp. Kết quả
ghi vào `playtest-notes.md` mục "Phase 4a".

---

## 9. Tài liệu cần cập nhật (bước 4a.1)

- `00-gdd.md` §3.1–3.2 (deck 18 kể cả Binh Khí sau này, lượt mới), §8.2 ("deck 20
  lá" → 18).
- `01-combat-rules.md`: §1 (Nguyệt Lực), §2 bắt đầu trận (Đổi Bài), §3 lượt người chơi, §4.2 rút bài, §4.3 Tàn Chiêu, §4.5 chi phí,
  §9 lượt kẻ địch (mẫu ý định → chuỗi chiêu), §10.4 ngã (Tán Chiêu), §11 thắng thua, §13 hook Kỳ Vật.
- `02-data-schema.md`: §2.
- `04-glossary.md`: Nguyệt Lực Dự Trữ (`moonReserve`), Đổi Bài (`mulligan`), Chiêm
  Bài (`chooseCard`), Cạn Bài (`deckedOut`), Tán Chiêu (`cardsPurged`), Tụ Lực (chuỗi
  rỗng).
- `06-test-scenarios.md`: T128–T148.
- `07-implementation-plan.md`: mục Giai đoạn 4a (§10).

---

## 10. Kế hoạch bước

| Bước | Nội dung |
|---|---|
| 4a.1 | Cập nhật tài liệu (§9) |
| 4a.2 | Thang Nguyệt Lực: `combat-config.json`, Nguyệt Lực tăng dần + Dự Trữ người chơi, nhân đôi cost / giảm cost theo pha / `gainMoonPower`, passive M06 (T128, T129, T146, T148 config) |
| 4a.3 | Tay và chồng bài: giữ tay, rút bù, bỏ Tàn Chiêu, `copies`, deck 6 lá/Hero, không xáo lại, Cạn Bài, Tán Chiêu (T131–T136, T148 copies) |
| 4a.4 | Đổi Bài: trạng thái `mulligan`, Action (T137, T138) |
| 4a.5 | Chiêm Bài: effect, trạng thái `choosing`, Action, Kỳ Vật Thanh Loan Vũ (T144, T145, T148 chooseCard) |
| 4a.6 | AI địch: schema `intents`/`moonPower`, bộ chiêu mới, lên chuỗi, thi hành, Dự Trữ địch, xem trước; tất định (T130, T139–T143, T147, T148 intents) |
| 4a.7 | Client (§6) |
| 4a.8 | Mô phỏng + chỉnh số (qua duyệt) + `playtest-notes.md` |

Mỗi bước gom thay đổi luật cùng phần data phụ thuộc để `pnpm test` xanh sau từng bước.
