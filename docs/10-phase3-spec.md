# 10 — Đặc tả Giai đoạn 3 (Roguelike)

Đặc tả cho giai đoạn 3 theo `00-gdd.md` mục 8.2 và mục 12: **bản đồ nút, Kỳ
Vật, phần thưởng lá bài**. Vẫn offline, không server, không lưu lượt chơi giữa
các lần mở trang.

Thiết kế được chốt qua brainstorming (2026-09-24). Khi đưa vào tài liệu luật
(bước 3.1): luật trận đấu (hook Kỳ Vật) vào `01`, luật lượt chơi vào tài liệu mới
`11-run-rules.md`. Khi có khác biệt, `01`/`11` là chuẩn; tài liệu này giữ bối
cảnh và lý do thiết kế.

**Trạng thái:** đã đưa vào `01` §13, `11`, `02`, `04`, `05`, `06`, `07` (bước 3.1).

---

## 0. Phạm vi

**Có:** bản đồ tầng sinh theo seed; các loại nút Trận thường, Tinh Anh, Nghỉ
Chân, Kho Báu, Boss; HP mang qua các trận; lá thưởng sau trận; Kỳ Vật với hệ
thống hook trong trận.

**Không có (để sau):** nút Sự kiện, Phúc Nguyệt, Lời Nguyền, cửa hàng / tiền tệ,
Kỳ Vật tác động ngoài trận, lưu lượt chơi, Binh Khí / lá chung (deck 20 lá của
GDD). Đội vẫn là 3 trong 5 Hero hiện có.

**Nguyên tắc:** mọi nội dung mới **chỉ dùng effect và cơ chế đã có**; luật mới
chỉ gồm lượt chơi (`run/`) và hook Kỳ Vật.

---

## 1. Kiến trúc

Lượt chơi là một **state machine thuần** trong `packages/rules/src/run/`, cùng
quy tắc với trận đấu (CLAUDE.md 1–4): không Phaser/DOM, RNG có seed trong state,
hàm thuần không mutate, client chỉ gửi hành động.

```ts
createRun(data: GameData, setup: RunSetup): { run: RunState; runEvents: RunEvent[] }
applyRunAction(data: GameData, run: RunState, action: RunAction): RunActionResult
getRunActionError(data: GameData, run: RunState, action: RunAction): string | null

interface RunSetup { heroIds: [string, string, string]; seed: number }

type RunActionResult =
  | { ok: true; run: RunState; events: CombatEvent[]; runEvents: RunEvent[] }
  | { ok: false; error: string };
```

- Trận đang đánh nằm **trong** `RunState.combat`. Hành động chiến đấu đi qua
  `applyRunAction({ type: "combat", action })`, tức chuyển tiếp sang
  `applyAction`.
- `createCombat` / `applyAction` giữ nguyên API; `CombatSetup` chỉ thêm trường
  tùy chọn (mục 2.3). Chế độ **Trận lẻ** (không có lượt chơi) chạy như hiện tại
  → T01–T95 không đổi.

---

## 2. Dữ liệu và trạng thái

### 2.1 Dữ liệu tĩnh mới / mở rộng

| File | Thay đổi |
|---|---|
| `heroes.json` | Mỗi Hero thêm `rewardCardIds: string[]` (4 lá, không trùng `cardIds`, lá có `ownerId` = Hero đó) |
| `cards.json` | + 20 lá thưởng (mục 6.1) |
| `enemies.json` | + 3 kẻ địch (mục 6.3) |
| `encounters.json` | Mỗi trận thêm `tier: "normal" \| "elite" \| "boss"` và `minFloor?: number` (mặc định 1); + 4 trận |
| `run-relics.json` | **Mới:** 10 Kỳ Vật (mục 6.2) |
| `run-config.json` | **Mới:** mọi con số của lượt chơi (mục 2.4) |

`GameData` thêm `runRelics: Record<string, RunRelicDef>` và `runConfig: RunConfig`.

### 2.2 `RunState`

```ts
type RunStatus = "map" | "combat" | "reward" | "rest" | "treasure" | "won" | "lost";

interface RunState {
  status: RunStatus;
  rngState: number;
  heroes: { defId: string; hp: number; maxHp: number }[];  // theo thứ tự heroIds
  deck: string[];              // cardId, không gồm lá Song Hành
  runRelicIds: string[];       // theo thứ tự nhận
  map: RunMap;
  position: string | null;     // nút hiện tại; null = chưa vào tầng 1
  combat: CombatState | null;
  pendingReward: { cardChoices: string[]; runRelicId?: string } | null;
}
```

- Bắt đầu: `deck` = 15 lá `cardIds` của 3 Hero (theo thứ tự đội), HP đầy,
  `runRelicIds = []`, sinh bản đồ, `status = "map"`, `position = null`.
- `RunState` là JSON thuần; lưu `localStorage` để sau.

### 2.3 Nối với trận đấu

```ts
interface CombatSetup {
  heroIds: [string, string, string];
  encounterId: string;
  seed: number;
  deckCardIds?: string[];                    // mặc định: cardIds của 3 Hero
  heroes?: { hp: number; maxHp: number }[];  // mặc định: hp = maxHp của HeroDef
  runRelicIds?: string[];                    // mặc định: []
}
```

- Lá Song Hành vẫn tự thêm theo đội (`bondCardsForTeam`), không nằm trong deck.
- Instance id: `c01`, `c02`… theo thứ tự `deckCardIds`, rồi `bond01`…; xáo như cũ.
- **Seed trận** = `floor(value × 2³²)` với `value` lấy từ `nextRandom(run.rngState)` khi vào nút trận.
- Thăng cấp Hero vẫn reset mỗi trận (`01` §8).

### 2.4 `run-config.json`

```json
{
  "floors": 8,
  "floorWidth": { "min": 2, "max": 3 },
  "floorRules": [
    { "floors": [1], "type": "combat" },
    { "floors": [2, 3], "weights": { "combat": 80, "rest": 20 } },
    { "floors": [4], "type": "treasure" },
    { "floors": [5, 6], "weights": { "combat": 60, "elite": 25, "rest": 15 } },
    { "floors": [7], "type": "rest" },
    { "floors": [8], "type": "boss" }
  ],
  "restHealRatio": 0.3,
  "reviveHpRatio": 0.25,
  "rewardCardChoices": 3,
  "minDeckSize": 10
}
```

Mọi số liệu là điểm khởi đầu, chỉnh sau playtest 3.7.

---

## 3. Bản đồ

```ts
type NodeType = "combat" | "elite" | "rest" | "treasure" | "boss";
interface MapNode {
  id: string;          // "f3n1" = tầng 3, lane 1
  floor: number;       // 1..floors
  lane: number;        // 0..width-1
  type: NodeType;
  next: string[];      // id nút tầng sau, theo lane tăng dần
  encounterId?: string;// có với combat / elite / boss
}
interface RunMap { floors: MapNode[][] }  // floors[i] = tầng i+1, theo lane
```

### 3.1 Kích thước và cạnh

- Tầng 1..`floors`−1: số nút ngẫu nhiên trong `floorWidth`. Tầng cuối (boss): 1 nút.
- Giữa hai tầng liền nhau, mỗi nút nối tới một **dải liền nhau** 1–2 nút tầng
  sau. Các dải xếp theo lane: dải của nút lane `i+1` bắt đầu ở đúng cuối dải
  lane `i` hoặc ngay sau đó. Dải đầu bắt đầu ở lane 0, dải cuối kết thúc ở lane
  cuối. Hệ quả:
  - mọi nút tầng sau có ít nhất một cạnh vào;
  - **không có hai cạnh cắt nhau**;
  - mọi đường đi đều tới boss.
- Nút tầng áp chót nối hết vào nút boss.

### 3.2 Loại nút

- Theo `floorRules`: tầng có `type` → mọi nút loại đó; tầng có `weights` → chọn
  theo trọng số.
- Trên tầng có `weights`: nút `elite` hoặc `rest` **không** được có nút cha cùng
  loại; nếu trúng thì chọn lại trong các loại còn lại (theo trọng số của chúng).

### 3.3 Gán trận

Gán ngay khi sinh bản đồ (cùng seed → cùng trận):

- `combat`: ngẫu nhiên trong các trận `tier: "normal"` có `minFloor ≤ floor`.
- `elite`: trong `tier: "elite"` có `minFloor ≤ floor`.
- `boss`: trận `tier: "boss"` (đúng 1 trận; hiện là `enc_04`).
- Với `combat`/`elite`: không trùng trận của **bất kỳ** nút cha; nếu mọi lựa chọn
  đều trùng thì bỏ qua ràng buộc này.
- UI chỉ hiện loại nút, không hiện trước trận.

### 3.4 Thứ tự dùng RNG của lượt chơi

1. `createRun`: sinh bản đồ (độ rộng từng tầng → cạnh → loại nút → trận).
2. Vào nút trận: lấy seed trận.
3. Thắng trận: rút lá thưởng, rồi (Tinh Anh) rút Kỳ Vật.
4. Vào Kho Báu: rút Kỳ Vật.

---

## 4. Vòng đời lượt chơi

### 4.1 Hành động

```ts
type RunAction =
  | { type: "chooseNode"; nodeId: string }
  | { type: "combat"; action: Action }
  | { type: "pickCard"; cardId: string | null }
  | { type: "rest"; choice: "heal" }
  | { type: "rest"; choice: "removeCard"; cardId: string }
  | { type: "continue" };
```

| Hành động | Hợp lệ khi | Kết quả |
|---|---|---|
| `chooseNode` | `map`; nút thuộc `next` của `position` (hoặc tầng 1 nếu `position = null`) | `position` = nút. `combat`/`elite`/`boss` → tạo trận (mục 2.3), `combat`. `rest` → `rest`. `treasure` → nhận 1 Kỳ Vật (mục 4.4), `treasure` |
| `combat` | `combat` | Chuyển tiếp `applyAction`; lỗi của trận trả về nguyên văn. Trận kết thúc → mục 4.2 |
| `pickCard` | `reward`; `cardId` thuộc `cardChoices` hoặc `null` | Thêm lá vào `deck` (hoặc bỏ qua), xóa `pendingReward` → `map` |
| `rest heal` | `rest` | Mỗi Hero hồi `floor(maxHp × restHealRatio)`, không quá `maxHp` → `map` |
| `rest removeCard` | `rest`; `cardId` có trong `deck`; `deck.length > minDeckSize` | Bỏ **một** bản của lá đó khỏi `deck` → `map` |
| `continue` | `treasure` | → `map` |

- Hành động không hợp lệ bị từ chối, state không đổi (lỗi tiếng Anh, như trận đấu).
- `won` / `lost`: mọi hành động bị từ chối.

### 4.2 Khi trận kết thúc

- **Thua** → `status = "lost"`.
- **Thắng:**
  1. HP: Hero còn sống giữ HP cuối trận; Hero đã ngã sống lại với
     `max(1, ceil(maxHp × reviveHpRatio))` (event `heroRevived`).
  2. Nút `boss` → `status = "won"`.
  3. Ngược lại: tạo `pendingReward` (mục 4.3), `combat = null`. Nếu không có
     lá nào để chọn và không có Kỳ Vật → thẳng `map`; ngược lại → `reward`.

### 4.3 Lá thưởng

- Pool = hợp `rewardCardIds` của 3 Hero trong đội, **trừ** lá đã có trong `deck`.
- Rút `rewardCardChoices` lá khác nhau bằng RNG của lượt chơi (ít hơn nếu pool
  không đủ). Lá đã bỏ ở Nghỉ Chân có thể xuất hiện lại.
- Nút `elite`: thêm 1 Kỳ Vật (mục 4.4) vào `pendingReward.runRelicId`, **nhận
  ngay** (event `runRelicGained`); màn thưởng chỉ hiển thị.

### 4.4 Nhận Kỳ Vật

Rút ngẫu nhiên trong các Kỳ Vật **chưa có**. Hết Kỳ Vật → không nhận gì.

### 4.5 Event

```ts
type RunEvent =
  | { type: "nodeEntered"; nodeId: string; nodeType: NodeType }
  | { type: "cardAdded"; cardId: string }
  | { type: "cardRemoved"; cardId: string }
  | { type: "runRelicGained"; runRelicId: string }
  | { type: "heroRevived"; heroId: string; hp: number }      // heroId = defId ("m05")
  | { type: "restHealed"; heroId: string; amount: number }
  | { type: "runEnded"; result: "won" | "lost" };
```

---

## 5. Kỳ Vật trong trận (hook)

### 5.1 Định nghĩa

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

### 5.2 Thời điểm kích hoạt

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

### 5.3 Đơn vị hành động của effect Kỳ Vật

- `trigger`: Hero ở cột cuối bảng trên.
- `each`: chạy toàn bộ `effects` một lần cho mỗi Hero còn sống (vị trí 0 → 2),
  Hero đó là đơn vị hành động (`to: "self"` = Hero đó). Bộ đếm `every` vẫn chỉ
  tăng **một** lần cho mỗi trigger, không phải mỗi Hero.
- `lowestHp` / `front`: một Hero còn sống (hòa → vị trí nhỏ hơn).
- Không có Hero phù hợp → hook không chạy (bộ đếm vẫn tăng).

### 5.4 Luật

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

---

## 6. Nội dung

Số liệu là điểm khởi đầu, chỉnh sau playtest 3.7.

### 6.1 Lá thưởng (20)

| Hero | Lá (id) | Giá | Loại | Tag | Mục tiêu | Hiệu ứng |
|---|---|---|---|---|---|---|
| M05 | *Thiết Bích* (`m05_thiet_bich`) | 2 | skill | `ward` | none | M05 Khiêu Khích 1; mọi Hero còn sống nhận 4 giáp |
| M05 | *Nộ Hỏa Liên Hoàn* (`m05_no_hoa_lien_hoan`) | 2 | attack | `attack` | enemy | 4 damage × 3 hit |
| M05 | *Bất Động Như Sơn* (`m05_bat_dong_nhu_son`) | 2 | skill | `ward` | none | M05 nhận 10 giáp + Phản 3 |
| M05 | *Huyết Chiến* (`m05_huyet_chien`) | 1 | attack | `attack` | enemy | HP M05 dưới 50%: 11 damage; ngược lại 6 |
| F04 | *Hồi Xuân Tán* (`f04_hoi_xuan_tan`) | 2 | skill | `heal`, `harmony` | none | Mọi Hero còn sống hồi 4 |
| F04 | *Băng Tâm Quyết* (`f04_bang_tam_quyet`) | 1 | skill | `control`, `harmony` | enemy | Suy Yếu 2 |
| F04 | *Thanh Tâm Chú* (`f04_thanh_tam_chu`) | 1 | skill | `harmony` | none | Giải Trừ mọi Hero còn sống; rút 1 |
| F04 | *Nguyệt Lộ* (`f04_nguyet_lo`) | 0 | skill | `heal` | ally | Hồi 3; Trăng Tròn: +1 Nguyệt Lực |
| M06 | *Tàng Ảnh Thích* (`m06_tang_anh_thich`) | 1 | attack | `attack`, `assassin` | enemy | Đang Ẩn Thân: 4 damage × 3 hit; ngược lại 4 |
| M06 | *Độc Tiêu* (`m06_doc_tieu`) | 1 | skill | `control` | enemy | Dễ Vỡ 2 |
| M06 | *Ảnh Phân Thân* (`m06_anh_phan_than`) | 2 | skill | `assassin` | none | M06 Ẩn Thân 2; rút 1 |
| M06 | *Tuyệt Mệnh* (`m06_tuyet_menh`) | 3 | attack | `attack`, `assassin` | enemy | Mục tiêu HP ≤ 50%: 24 damage; ngược lại 12 |
| F03 | *Sương Giáp* (`f03_suong_giap`) | 1 | skill | `ward` | none | F03 nhận 5 giáp + Phản 2 |
| F03 | *Băng Toái* (`f03_bang_toai`) | 2 | attack | `attack` | enemy | Mục tiêu đang Đóng Băng: 16 damage; ngược lại 7 |
| F03 | *Hàn Phong* (`f03_han_phong`) | 1 | skill | `control` | enemy | Suy Yếu 1 + Dễ Vỡ 1 |
| F03 | *Tuyết Vũ* (`f03_tuyet_vu`) | 2 | attack | `attack` | none | 3 damage × 2 hit lên mọi kẻ địch |
| F02 | *Huyết Khế* (`f02_huyet_khe`) | 0 | skill | `forbidden` | none | F02 mất 3 HP; +2 Nguyệt Lực |
| F02 | *Diện Cụ* (`f02_dien_cu`) | 1 | skill | `assassin` | none | F02 Ẩn Thân 1; rút 1 |
| F02 | *Đoạt Hồn Thích* (`f02_doat_hon_thich`) | 2 | attack | `attack`, `forbidden` | enemy | F02 mất 2 HP; Huyết Nguyệt: 14 damage; ngược lại 8 |
| F02 | *Tà Nguyệt Chú* (`f02_ta_nguyet_chu`) | 0 | skill | `forbidden`, `moon` | none | F02 mất 4 HP; `bloodMoon 1` |

- Lá có điều kiện dùng `conditional` với `then`/`else` (một lượt damage, không
  cộng dồn hai effect).
- *Tà Nguyệt Chú*: `bloodMoon 1` hết ở cuối vòng này nên **không** gây mất HP ở
  lượt sau; giá 0 để *Phệ Hồn* (3) đánh được ngay trong lượt — đổi bằng 4 HP.

### 6.2 Kỳ Vật (10)

| Kỳ Vật (id) | Định nghĩa |
|---|---|
| *Nguyệt Giáp Phù* (`nguyet_giap_phu`) | `combatStart`, `each`: `gainArmor 5 self` |
| *Huyết Ấn* (`huyet_an`) | `enemyKilled`, `trigger`: `heal 4 self` |
| *Tam Tuyệt Kiếm Phổ* (`tam_tuyet_kiem_pho`) | `cardPlayed {cardType: attack}`, `every: 3`, `trigger`: `gainMoonPower 1` |
| *Ảnh Nguyệt Châu* (`anh_nguyet_chau`) | modifier `damageMultiplierForTag assassin ×1.25` |
| *Huyết Nguyệt Phù* (`huyet_nguyet_phu`) | `bloodMoonStarted`, `each`: `applyStatus strength 1 self` |
| *Thanh Loan Vũ* (`thanh_loan_vu`) | `playerTurnStart`, `every: 2`, `front`: `draw 1` |
| *Bạch Lộ Hương Túi* (`bach_lo_huong_tui`) | `moonPhaseEntered {phase: full}`, `lowestHp`: `heal 6 self` |
| *Hàn Ngọc* (`han_ngoc`) | `cardPlayed {tag: control}`, `trigger`: `gainArmor 3 self` |
| *Tàn Hồn Đăng* (`tan_hon_dang`) | `heroDied`, `each`: `heal 6 self` |
| *Tinh Hà Kính* (`tinh_ha_kinh`) | `playerTurnEnd`, `lowestHp`: `gainArmor 4 self` |

Tên tránh trùng Nguyệt Bảo trong GDD (Nguyệt Bảo là hệ thống khác, giai đoạn 4).

### 6.3 Kẻ địch mới

Status thời hạn áp trong lượt địch dùng giá trị ≥ 2 để còn tác dụng qua lượt
người chơi kế tiếp (thời hạn giảm ở cuối vòng).

**Thư Hồn** (`book_wraith`, thường, HP 32):
1. *Nguyền Thư* — `debuff`, `random`: Dễ Vỡ 2 lên mục tiêu
2. *Thư Kích* — `attack`, `lowestHp`: 8 damage
3. *Tự Tu* — `buff`: tự nhận `regen 3` (thêm nguồn buff cho F02 cướp)

**Hắc Giáp Vệ** (`black_guard`, Tinh Anh, HP 70):
1. *Hắc Trảm* — `attack`, `lowestHp`: 14 damage
2. *Hắc Thuẫn* — `defend`: tự nhận 12 giáp + `regen 3`
3. *Hoành Tảo* — `attack`: 7 damage `allEnemies`

**Hồ Vương** (`fox_king`, Tinh Anh, HP 50):
1. *Huyễn Ảnh* — `buff`: tự Ẩn Thân 2
2. *Vương Trảo* — `attack`, `highestHp`: 10 damage
3. *Hồ Khiếu* — `debuff`: Suy Yếu 2 lên `allEnemies`

### 6.4 Trận

| Trận | Tên | Tier | `minFloor` | Kẻ địch |
|---|---|---|---|---|
| `enc_01`–`enc_03` | (như cũ) | normal | 1 | như cũ |
| `enc_05` | Thư Lâu Tầng Hai | normal | 3 | Khôi Lỗi + Thư Hồn |
| `enc_06` | Mê Cung Sách Cấm | normal | 5 | Thư Hồn ×2 + Ảnh Hồ |
| `enc_elite_01` | Cổng Hắc Giáp | elite | 5 | Hắc Giáp Vệ |
| `enc_elite_02` | Hang Hồ Vương | elite | 5 | Hồ Vương + Ảnh Hồ |
| `enc_04` | Vọng Nguyệt Đài | boss | 8 | Thần Viên Trấn Nguyệt |

---

## 7. UI (client)

- **Màn chọn đội**: thêm chế độ **Lượt chơi** (mới, mặc định) và **Trận lẻ**
  (như hiện tại, giữ để debug). Lượt chơi ẩn phần chọn trận.
- **Màn bản đồ**: tầng xếp từ dưới lên; biểu tượng nút ⚔ trận thường, ☠ Tinh
  Anh, 🏮 Nghỉ Chân, 🎁 Kho Báu, 🌕 boss; cạnh vẽ bằng đường thẳng; nút hiện tại
  đánh dấu, nút đi được sáng lên. Thanh trên: HP 3 Hero, thanh Kỳ Vật (hover:
  tên + mô tả), nút xem deck.
- **Màn chiến đấu**: như hiện tại + thanh Kỳ Vật; biểu tượng chớp khi có
  `runRelicTriggered`. Hết trận → màn tương ứng (thưởng / kết thúc).
- **Màn thưởng**: 3 lá (render như lá trên tay) + nút "Bỏ qua"; hiện Kỳ Vật vừa
  nhận nếu có.
- **Màn Nghỉ Chân**: "Hồi máu" (hiện số HP mỗi Hero sẽ hồi) hoặc "Bỏ 1 lá" (danh
  sách deck; khóa khi deck = `minDeckSize`).
- **Màn Kho Báu**: Kỳ Vật nhận được + "Tiếp tục".
- **Màn kết thúc lượt chơi**: thắng / thua, tầng đạt được → về màn chọn đội.
- Client chỉ gửi `RunAction` và vẽ lại từ `RunState`; không sinh bản đồ, phần
  thưởng hay tính HP. Số HP hồi ở Nghỉ Chân lấy từ hàm hỗ trợ trong `rules`.

---

## 8. Test

Kịch bản đưa vào `06-test-scenarios.md` ở bước 3.1 (mã tạm, có thể đánh lại).
Test bản đồ kiểm tra **tính chất** trên nhiều seed (ví dụ seed 1–50).

### 8.1 Bản đồ

| Mã | Kiểm tra |
|---|---|
| T96 | Tầng 1–7 có 2–3 nút; tầng 8 có đúng 1 nút `boss` |
| T97 | Mọi nút (trừ boss) có ≥1 `next`; mọi nút từ tầng 2 có ≥1 cạnh vào; mọi nút đi tới được từ tầng 1 |
| T98 | Không cạnh cắt nhau: với hai nút cùng tầng lane a < b, lane lớn nhất trong `next` của a ≤ lane nhỏ nhất trong `next` của b |
| T99 | Loại nút đúng `floorRules`; trên tầng trộn, không nút `elite`/`rest` nào có cha cùng loại |
| T100 | Trận gán đúng tier và `minFloor`; không trùng trận của nút cha (khi còn lựa chọn khác) |
| T101 | Cùng seed → bản đồ giống hệt; 10 seed khác nhau cho ra ít nhất 2 bản đồ khác nhau |

### 8.2 Lượt chơi

| Mã | Thiết lập | Hành động | Kết quả mong đợi |
|---|---|---|---|
| T102 | `createRun` M05/F04/M06, seed 42 | — | `map`, deck 15 lá, HP đầy, không Kỳ Vật, `position = null` |
| T103 | Lượt chơi mới | `chooseNode` một nút tầng 2; rồi một nút tầng 1 | Nút tầng 2 bị từ chối, state không đổi; nút tầng 1 hợp lệ |
| T104 | F04 HP 20/30 trong `RunState` | Vào nút trận | `combat`; F04 trong trận HP 20; deck trận = `run.deck` |
| T105 | Thắng trận, F04 đã ngã, M05 còn 25/40 | (trận kết thúc) | M05 25/40; F04 sống lại **8**/30; `reward` với 3 lá từ pool đội, không lá nào đã có trong deck |
| T106 | `reward` | `pickCard` lá đầu; lượt khác `pickCard(null)` | Deck 16 → `map`; deck 15 → `map` |
| T107 | `reward` | `pickCard` lá không nằm trong `cardChoices` | Bị từ chối |
| T108 | Thắng Tinh Anh | (trận kết thúc) | Nhận 1 Kỳ Vật chưa có (`runRelicGained`) + 3 lá |
| T109 | `rest`, M05 20/40 | `rest heal` | M05 32/40 (+12); Hero đầy máu không vượt `maxHp` |
| T110 | `rest`, deck 11 lá | `removeCard` lá có trong deck; lượt khác deck 10 lá | Deck 10 → `map`; deck 10 thì bị từ chối |
| T111 | Vào Kho Báu | `continue` | Nhận 1 Kỳ Vật khi vào; `continue` → `map` |
| T112 | Thắng boss / thua một trận | Bất kỳ hành động sau đó | `won` / `lost`, `runEnded`; mọi hành động bị từ chối |
| T113 | Hai lượt chơi cùng seed | Cùng chuỗi hành động (có trận, thưởng, Nghỉ Chân) | `RunState` và event giống hệt |
| T114 | Deck đã có 11/12 lá thưởng của đội | Thắng trận | `cardChoices` có 1 lá; pool rỗng và không có Kỳ Vật → thẳng `map` |

### 8.3 Hook Kỳ Vật (trận với `runRelicIds`)

| Mã | Kỳ Vật | Kết quả mong đợi |
|---|---|---|
| T115 | Nguyệt Giáp Phù | Sau `createCombat`: mọi Hero 5 giáp, còn trong lượt người chơi đầu và đỡ đòn lượt địch đầu |
| T116 | Thanh Loan Vũ | Lượt 1: tay 5 lá; lượt 2: tay 6 lá; lượt 3: 5 lá |
| T117 | Tam Tuyệt Kiếm Phổ | Lá tấn công thứ 3 trong trận cho +1 Nguyệt Lực; lá kỹ năng không đếm |
| T118 | Hàn Ngọc | Đánh Nguyệt Ảnh Ấn (`control`) → M06 +3 giáp; lá Song Hành `control` → `owners[0]` nhận giáp |
| T119 | Huyết Ấn | Hero kết liễu bằng lá hồi 4; kẻ địch ngã vì Thiêu Đốt → không ai hồi |
| T120 | Tàn Hồn Đăng | Một Hero ngã → hai Hero còn lại hồi 6 |
| T121 | Bạch Lộ Hương Túi | Vào Trăng Tròn qua cuối vòng **và** qua Đổi Vận: Hero máu thấp nhất hồi 6 (×2 nhờ Trăng Tròn = 12) |
| T122 | Huyết Nguyệt Phù | Đổi Vận Chú: mọi Hero `strength 1`; gia hạn Huyết Nguyệt đang bật: không kích hoạt |
| T123 | Ảnh Nguyệt Châu | Ám Tiễn ở Trăng Non: floor(6 × 1.5 × 1.25) = 11 |
| T124 | Kỳ Vật test: `combatStart`, `front`: 5 damage `allEnemies` | Hero có `strength 3`: mỗi kẻ địch mất 5 (không cộng Sức Mạnh) |
| T125 | Kỳ Vật test: `enemyKilled`, `front`: 99 damage `allEnemies` | Chỉ một lượt `runRelicTriggered` (không đệ quy) |
| T126 | Hai Kỳ Vật cùng `combatStart` | `runRelicTriggered` theo thứ tự `runRelicIds` |
| T127 | Dữ liệu Kỳ Vật dùng `to: "chosen"` / `stealBuff` / `actor` / `heroDied` + `trigger` | Mỗi trường hợp lỗi khi nạp |

### 8.4 Playtest scripted

Chạy trọn lượt chơi bằng heuristic (chọn nút đi được đầu tiên, lá thưởng đầu
tiên, Nghỉ Chân: hồi nếu tổng HP < 60% còn lại bỏ lá rẻ nhất) cho 4 đội × nhiều
seed. Ghi: tỉ lệ thắng, tầng đạt được, số trận, kích thước deck, Kỳ Vật đã có.

---

## 9. Tài liệu cần cập nhật (bước 3.1)

| Tài liệu | Nội dung |
|---|---|
| `01-combat-rules.md` | §2: HP/deck/Kỳ Vật từ `CombatSetup`; §3.1, §3.3, §5.2, §7: điểm kích hoạt hook; mục mới **Kỳ Vật** (mục 5 ở trên); §7: `activeModifiers` |
| `11-run-rules.md` | **Mới:** mục 2–4 ở trên (trạng thái, bản đồ, hành động, phần thưởng, HP) |
| `02-data-schema.md` | `rewardCardIds`, `tier`/`minFloor`, `RunRelicDef`, `RunConfig`, `RunState`, `RunAction`, `RunEvent`, `CombatSetup` mở rộng, `CombatState.runRelicIds/Counters`, event `runRelicTriggered`, kiểm tra khi nạp |
| `04-glossary.md` | Bản đồ `map`, Nút `node`, Tầng `floor`, Tinh Anh `elite`, Nghỉ Chân `rest`, Kho Báu `treasure`, Lá thưởng `rewardCard`, Hook `hook` (Kỳ Vật đã có: `runRelic`) |
| `05-ui-combat-screen.md` | Mục 7 ở trên (hoặc tài liệu UI lượt chơi riêng) |
| `06-test-scenarios.md` | T96–T127 |
| `07-implementation-plan.md` | Các bước mục 10 |

---

## 10. Kế hoạch bước

- **3.1** Cập nhật tài liệu (mục 9)
- **3.2** Schema + dữ liệu (20 lá, 10 Kỳ Vật, 3 kẻ địch, 4 trận, `tier`/`minFloor`, `run-config.json`) + test nạp dữ liệu (T127)
- **3.3** Trận đấu nhận deck / HP / Kỳ Vật từ `CombatSetup`; modifier Kỳ Vật; hệ thống hook + test (T115–T126)
- **3.4** Sinh bản đồ + test tính chất (T96–T101)
- **3.5** State machine lượt chơi + test (T102–T114)
- **3.6** Client: chế độ Lượt chơi, màn bản đồ / thưởng / Nghỉ Chân / Kho Báu / kết thúc, thanh Kỳ Vật
- **3.7** Playtest scripted cho trọn lượt chơi + ghi chú; chỉnh số liệu

**Hoàn thành giai đoạn 3 khi:** chơi được trọn một lượt chơi từ bản đồ tới boss
trên client, T96–T127 pass, và playtest cho thấy lượt chơi thắng được với ít
nhất 2 đội hình.
