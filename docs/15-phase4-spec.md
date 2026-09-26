# 15 — Đặc tả Giai đoạn 4 (Server, gacha, trang bị)

Đặc tả cho giai đoạn 4 của lộ trình GDD (`00` §12): **có tài khoản, server lưu kho
đồ, gacha, xử lý trùng, Binh Khí và Nguyệt Bảo**. Chia ba phần, mỗi phần có bản
chơi được trước khi sang phần sau:

| Phần | Nội dung | Kết quả chơi được |
|---|---|---|
| **4c** | Server + tài khoản; hồ sơ lên server; server chạy lại lượt chơi để trao thưởng | Đăng nhập, chơi lượt chơi, XP Tu Luyện lưu trên server, chơi trên máy khác vẫn còn |
| **4d** | Tiền tệ, nhiệm vụ, thành tựu; gacha khung + banner Hero; sở hữu Hero; Tinh Hồn | Kiếm Nguyệt Ngọc, quay ra F02/F03, Tinh Hồn mở lá / đổi thăng cấp |
| **4e** | Binh Khí (10) + Nguyệt Bảo (8); banner Binh Khí Các / Nguyệt Bảo Các; Tinh Luyện / Cộng Minh; vật liệu trùng | Trang bị vũ khí (lá Binh Khí trong deck) và 2 Nguyệt Bảo, nâng cấp |

Thiết kế được chốt với người dùng (2026-09-26): chia 4c/4d/4e; server **Node +
Fastify + SQLite**; đăng nhập **tên + mật khẩu**; server **chạy lại** lượt chơi
(client gửi seed + chuỗi Action) trước khi trao thưởng; tài khoản mới có **3 Hero**
(M05, F04, M06), F02/F03 qua gacha; **10 Binh Khí + 8 Nguyệt Bảo**; Nguyệt Ngọc từ
**thưởng lượt chơi, nhiệm vụ ngày/tuần, thành tựu một lần**.

Khi đưa vào tài liệu luật (bước 4c.1 / 4d.1 / 4e.1): luật hồ sơ, tiền tệ, gacha,
trang bị vào `14-meta-rules.md`; API và lưu trữ vào tài liệu mới
`16-server-api.md`; luật trận (lá Binh Khí, hook trang bị) vào `01`; schema vào
`02`; thuật ngữ (chuyển các mục "Hệ thống sau này" của `04` lên phần chính) vào
`04`; test vào `06`; bước vào `07`. Khi có khác biệt, tài liệu luật là chuẩn;
tài liệu này giữ bối cảnh và lý do.

**Điều kiện trước:** GĐ 4b + Lõi (`13`, `11` §3.3) và các gói chỉnh sau 4b đã vào
`main`.

**Trạng thái:** đã duyệt (2026-09-27), gồm mọi điểm ở §11. 4c xong (bước 4c.1–4c.6).
4d: kế hoạch `docs/superpowers/plans/2026-09-28-phase4d-economy-gacha.md`; đã đưa vào
`01`, `02`, `04`, `06`, `07`, `14`, `16` (bước 4d.1). Chốt thêm 2026-09-28: Tinh Hồn 5
dời sang 4e; thành tựu Song Hành = một thành tựu mỗi lá Song Hành; quà tài khoản tự nhận
khi đăng ký hoặc đăng nhập nếu chưa nhận; lá "+" nằm trong `cards.json` (`plusOf`),
`heroes.json signature` chỉ giữ id.

**Thư viện mới cần duyệt** (CLAUDE.md: không thêm thư viện khi chưa hỏi): `fastify`,
`better-sqlite3` (+ `@types/better-sqlite3`) cho `apps/server`. Không thêm thư viện
nào khác: băm mật khẩu và sinh token dùng `node:crypto`; kiểm tra body dùng `zod`
(đã có); client gọi API bằng `fetch`; dev dùng proxy của Vite (không cần CORS).

---

## 0. Phạm vi

**Có:**
- 4c: `apps/server` (Fastify + SQLite); tài khoản, phiên đăng nhập; hồ sơ v2 lưu
  trên server; phiếu lượt chơi (server cấp seed) và xác nhận bằng chạy lại; nhập
  hồ sơ `localStorage` một lần; client: màn đăng nhập, đồng bộ hồ sơ.
- 4d: Nguyệt Ngọc, Nguyệt Tinh; thưởng lượt chơi; nhiệm vụ ngày/tuần; thành tựu;
  quà tài khoản mới; khung gacha (tỉ lệ, bảo hiểm, nhật ký quay); banner **Triệu
  Hồi Anh Hùng**; sở hữu Hero; Tinh Hồn 1–6; cửa hàng Nguyệt Tinh (bản tối thiểu);
  client: màn gacha, kho Hero, nhiệm vụ.
- 4e: 10 Binh Khí, 8 Nguyệt Bảo (nội dung + luật trận); banner **Binh Khí Các**,
  **Nguyệt Bảo Các**; Tinh Luyện R1–R5, Cộng Minh 1–5; Huyền Thiết, Nguyệt Trần;
  deck mang vũ khí + Nguyệt Bảo; client: kho đồ, trang bị trong xếp deck.

**Không có (để sau):** PvP / Đấu Trường Công Bằng và bảng chỉ số PvP (GĐ 5); co-op
và Hợp Kích (GĐ 6); banner giới hạn và 50/50 nhân vật quảng bá (chỉ chừa chỗ trong
schema, chưa dùng — mọi banner GĐ 4 là banner thường); cốt truyện; Vinh Dự; skin /
khung card / hiệu ứng lật bài (cửa hàng Nguyệt Tinh chỉ bán vé); art thật (vẫn dùng
art tạm; GDD ghi art thật ở GĐ 4 — tách thành việc riêng không chặn code); triển
khai lên Internet (server chạy local / LAN).

**Nguyên tắc:**
- `packages/rules` vẫn thuần: mọi luật meta mới (tiền tệ, gacha, Tinh Hồn, trang
  bị, nhiệm vụ) là hàm thuần trong `rules/src/meta/`, nhận `Profile` + tham số
  (seed, `now`) và trả `Profile` mới. Server chỉ gọi các hàm đó, sinh seed bằng
  `node:crypto`, đọc giờ bằng `Date.now()` rồi truyền vào.
- Server là trọng tài của mọi thứ ảnh hưởng tới kho đồ (GDD `00` §10.3): quay
  gacha, trao thưởng, nâng cấp. Client không tự sửa hồ sơ; chỉ hiển thị hồ sơ server
  trả về.
- Trận và lượt chơi vẫn chạy trên client (không trễ mạng khi đánh lá). Server chỉ
  cần kết quả khi trao thưởng, và kiểm bằng cách chạy lại.
- Nội dung và số liệu nằm trong JSON của `packages/data` (`economy-config.json`,
  `banners.json`, `missions.json`, `achievements.json`, `weapons.json`,
  `relics.json`, thêm trường trong `heroes.json`).

---

## 1. Kiến trúc

```
packages/
  rules/src/meta/     profile.ts (v2), deck.ts, economy.ts, gacha.ts,
                      constellation.ts, equipment.ts, missions.ts, replay.ts
  data/               economy-config.json, banners.json, missions.json,
                      achievements.json, weapons.json, relics.json (+ schema)
apps/
  server/             Fastify app, SQLite (better-sqlite3), routes, auth
    src/
      main.ts         đọc PORT / DB_PATH từ env, mở DB, chạy migration, listen
      app.ts          buildApp(db, clock, random) — dùng cho test (fastify.inject)
      db.ts           migration + truy vấn
      auth.ts         scrypt, token phiên
      routes/         auth, profile, runs, gacha, missions, equipment
  client/             api.ts (fetch + token), scenes mới (đăng nhập, gacha, kho)
```

- `buildApp(deps)` nhận `db`, `clock: () => number`, `random: (bytes) => Buffer` để
  test tất định (giờ và seed giả).
- **Phiên bản dữ liệu:** `dataVersion` = băm FNV-1a 64 bit (16 ký tự hex) của JSON
  `GameData` đã chuẩn hóa (khóa sắp xếp), hàm TypeScript thuần trong `packages/data`
  để client (trình duyệt) và server tính giống nhau, đồng bộ. Không dùng để bảo mật,
  chỉ để phát hiện lệch dữ liệu. Mọi request có header `X-Data-Version`; lệch → `409
  { error: "outdated client" }`. Phiếu lượt chơi lưu `dataVersion` lúc cấp.
- Client dev: Vite proxy `/api` → `http://localhost:8787`. Server phục vụ riêng
  (không phục vụ file client ở GĐ 4).
- `pnpm dev` chạy cả client và server (`pnpm -r --parallel dev`); `pnpm test` gồm
  test server (Vitest + `fastify.inject`, DB SQLite `:memory:`).

---

## 2. Phần 4c — Server, tài khoản, hồ sơ

### 2.1 Tài khoản và phiên

| Luật | Giá trị |
|---|---|
| Tên đăng nhập | 3–20 ký tự `[a-z0-9_]` (chuẩn hóa chữ thường), duy nhất |
| Mật khẩu | 8–72 ký tự |
| Băm | `scrypt` (`node:crypto`), salt 16 byte ngẫu nhiên, N = 2¹⁵, r = 8, p = 1, khóa 64 byte; lưu `salt:hash` hex |
| Token phiên | 32 byte ngẫu nhiên, gửi client dạng base64url; DB chỉ lưu SHA-256 của token |
| Hạn phiên | 30 ngày kể từ lần dùng cuối (trượt) |
| Gửi token | Header `Authorization: Bearer <token>` |
| Đăng nhập sai | `401 { error: "invalid credentials" }` (không phân biệt sai tên hay sai mật khẩu); sai 5 lần liên tiếp → khóa tên đó 5 phút (`429`) |

Không có quên mật khẩu (dự án cá nhân); ghi rõ trên màn đăng ký.

### 2.2 Hồ sơ v2

Hồ sơ vẫn là một JSON (cột `profile_json`), đọc/ghi bằng hàm thuần. `version: 2` gồm
toàn bộ trường của mọi phần GĐ 4 ngay từ 4c (trường chưa dùng để giá trị mặc định),
để chỉ có **một** lần chuyển đổi.

```ts
interface Profile {
  version: 2;
  heroes: Record<string, HeroProgress>;     // chỉ Hero đã sở hữu
  decks: SavedDeck[];
  currencies: { moonJade: number; moonStar: number; darkIron: number; moonDust: number };
  weapons: Record<string, { refinement: 1 | 2 | 3 | 4 | 5 }>;   // 4e
  relics: Record<string, { resonance: 1 | 2 | 3 | 4 | 5 }>;     // 4e
  pity: Record<string, PityState>;          // theo bannerId (4d)
  missions: MissionState;                   // 4d
  achievements: string[];                   // id đã nhận (4d)
  stats: ProfileStats;                      // bộ đếm cho thành tựu (4d)
  flags: { starterGiftClaimed: boolean; localImportDone: boolean };
}

interface HeroProgress {
  xp: number;
  unlockedCardIds: string[];
  constellation: 0 | 1 | 2 | 3 | 4 | 5 | 6;  // 4d
  bonusUnlocks: number;                      // lượt mở lá từ Tinh Hồn 1/3 chưa dùng (4d)
  levelUpForm: "base" | "alt";               // 4d, Tinh Hồn 5
}
```

- `createProfile(data)`: sở hữu `economyConfig.starterHeroIds` (`["m05","f04","m06"]`),
  mỗi Hero `{ xp: 0, unlockedCardIds: [], constellation: 0, bonusUnlocks: 0,
  levelUpForm: "base" }`; tiền tệ 0; còn lại rỗng / `false`.
- `pendingUnlocks` = `masteryLevel(xp) + (bonusUnlocks đã cấp) − unlockedCardIds.length`
  (định nghĩa lại ở §3.6).
- `parseProfile(data, raw)`: nhận v1 (hồ sơ 4b) hoặc v2.
  - **v1 → v2:** giữ `xp`, `unlockedCardIds`, `decks` của mọi Hero có trong v1 **và**
    thuộc `starterHeroIds`; Hero ngoài bộ khởi đầu bị bỏ khỏi hồ sơ (chưa sở hữu),
    deck dùng Hero đó vẫn giữ nhưng không hợp lệ (`unownedHero`) cho tới khi sở hữu.
  - Mọi trường v2 thiếu → mặc định; sai kiểu → reset như `14` §2.3.
- Mọi hàm meta kiểm tra sở hữu Hero: Hero không có trong `profile.heroes` → lỗi
  `"hero not owned"` (Tu Luyện, xếp deck, lượt chơi).

### 2.3 Nhập hồ sơ localStorage

Một lần mỗi tài khoản (`flags.localImportDone`), ngay sau đăng nhập đầu tiên trên
máy có hồ sơ cũ: client gửi JSON `localStorage` lên `POST /api/profile/import`.
Server chạy `parseProfile` (v1 → v2) rồi **gộp**: `xp` lấy max, `unlockedCardIds`
hợp (lọc qua luật mở lá: không vượt `masteryLevel`), deck thêm vào (bỏ phần vượt
`maxDecks`). Không nhập tiền tệ / vật phẩm. Chấp nhận rủi ro người chơi sửa XP trong
`localStorage` trước khi nhập (dự án cá nhân; một lần duy nhất).

### 2.4 Lượt chơi có xác nhận

Lượt chơi là nguồn thưởng chính (XP Tu Luyện, Nguyệt Ngọc, nhiệm vụ), nên server
kiểm bằng cách chạy lại (`rules` tất định, `01` quy tắc 2).

1. **Cấp phiếu** — `POST /api/runs` `{ deckId }`:
   - Deck phải hợp lệ với hồ sơ hiện tại (`validateDeck` rỗng; Bộ cơ bản gửi
     `deckId: "starter"` + `heroIds`).
   - Sinh `seed` = số nguyên 32 bit từ `crypto.randomInt`. Tạo phiếu `{ runId, seed,
     setup, loadout, dataVersion, createdAt }`, trong đó `setup: RunSetup` (Hero, seed,
     lá) và `loadout` (trang bị, Tinh Hồn — 4d/4e) là **ảnh chụp** tại lúc cấp.
   - Mỗi tài khoản tối đa **1 phiếu mở**; cấp phiếu mới khi còn phiếu mở → phiếu cũ
     thành `abandoned` (không thưởng).
   - Trả `{ runId, setup, loadout }`; client gọi `createRun(data, setup)` (4e: kèm
     loadout) và chơi offline như hiện nay.
2. **Lưu tạm** (tùy chọn) — client giữ chuỗi `RunAction[]` trong `localStorage` theo
   `runId` để chơi tiếp sau khi tải lại trang.
3. **Nộp** — `POST /api/runs/:runId/finish` `{ actions: RunAction[] }`:
   - Phiếu phải `open`, của đúng tài khoản, `dataVersion` khớp, tuổi ≤ 7 ngày,
     `actions.length ≤ 20000`.
   - Server chạy `replayRun(data, setup, loadout, actions)` (§2.5). Lỗi → phiếu
     `rejected`, `422 { error: "replay failed", step, reason }`.
   - Hợp lệ và `run.status` là `won`/`lost` → `summarizeRun` → `applyRunResult`
     (XP, 4c) + `applyRunRewards` (tiền tệ, nhiệm vụ, thống kê, 4d) trong **một**
     transaction; phiếu `finished`; trả `{ profile, gains, rewards }`.
   - `run.status` chưa kết thúc → `422 { error: "run not finished" }` (phiếu vẫn mở).
4. **Bỏ** — `POST /api/runs/:runId/abandon`: phiếu `abandoned`.

Trận lẻ (không qua lượt chơi) không cần server và không có thưởng, như 4b.

### 2.5 `replayRun` (`rules/src/meta/replay.ts`)

```ts
function replayRun(
  data: GameData, setup: RunSetup, loadout: Loadout, actions: RunAction[],
): { ok: true; run: RunState } | { ok: false; step: number; reason: string };
```

`createRun(data, setup, loadout)`, rồi lần lượt `applyRunAction`; Action bị từ chối →
`{ ok: false, step, reason: error }`; còn Action sau khi lượt chơi kết thúc →
`{ ok: false, reason: "actions after end" }`. Hàm thuần, dùng chung client (kiểm
trước khi nộp) và server.

### 2.6 Đồng bộ hồ sơ

- Mọi thay đổi hồ sơ đi qua endpoint riêng (mở lá, lưu/xóa deck, quay, nâng cấp…);
  server áp hàm thuần tương ứng và trả hồ sơ mới. Không có endpoint "ghi đè cả hồ sơ".
- Cột `rev` (số nguyên) tăng mỗi lần ghi; client gửi `If-Match: <rev>` với mọi
  request thay đổi; lệch → `409 { error: "stale profile", profile }` (client thay hồ
  sơ cục bộ bằng bản server rồi cho người chơi thao tác lại).
- Client giữ bản sao hồ sơ trong bộ nhớ (không còn `localStorage` cho hồ sơ; chỉ
  token phiên và chuỗi Action lượt chơi đang dở).
- Mất kết nối: màn chọn deck vẫn cho **Trận lẻ**; nút **Lượt chơi**, gacha, mở lá
  báo "Cần kết nối server".

---

## 3. Phần 4d — Tiền tệ, gacha Hero, Tinh Hồn

### 3.1 `economy-config.json`

```json
{
  "starterHeroIds": ["m05", "f04", "m06"],
  "starterGift": { "moonJade": 1600 },
  "pullCost": 160,
  "runRewards": { "moonJadePerFloor": 10, "moonJadeWin": 80, "firstWinOfDay": 100 },
  "dayResetUtcHour": 21,
  "weekResetUtcDay": 0,
  "moonStarShop": [
    { "id": "shop_pull", "item": { "type": "moonJade", "amount": 160 }, "price": 10, "limitPerWeek": 5 },
    { "id": "shop_epic_hero", "item": { "type": "heroChoice", "rarity": "epic" }, "price": 120, "limitPerWeek": 1 }
  ]
}
```

- Mốc ngày/tuần: 04:00 giờ Việt Nam = 21:00 UTC hôm trước; tuần reset tối Chủ nhật
  UTC (= 04:00 sáng thứ Hai giờ Việt Nam). Server truyền `now` (ms UTC) vào hàm thuần.
- `starterGift` nhận một lần khi tạo tài khoản (= 10 lượt quay).
- `heroChoice`: chọn 1 Hero độ hiếm đó **chưa sở hữu**; không còn Hero chưa sở hữu →
  nút mua bị khóa.

### 3.2 Thưởng lượt chơi

`applyRunRewards(data, profile, result, now)`:
- `moonJade += moonJadePerFloor × floorReached + (won ? moonJadeWin : 0)`;
- `+ firstWinOfDay` nếu `won` và chưa có lượt thắng nào trong ngày hiện tại;
- cập nhật `stats` (`runsFinished`, `runsWon`, `floorsTotal`, `bossKills`,
  `heroesUsed` theo ngày/tuần) rồi tiến độ nhiệm vụ (§3.3) và thành tựu (§3.4).

Ước lượng (bot, lượt TB tầng ~6.5, thắng ~40%): ~130 Nguyệt Ngọc/lượt; 2 lượt/ngày +
nhiệm vụ ngày ≈ 450/ngày ≈ **2.8 lượt quay/ngày**. Mục tiêu GDD "Legendary mới sau vài
tuần": bảo hiểm cứng 70 lượt ≈ 25 ngày, trung bình (bảo hiểm mềm) ~16–20 ngày.

### 3.3 Nhiệm vụ ngày/tuần (`missions.json`)

```ts
interface MissionDef {
  id: string; name: string; text: string;
  period: "daily" | "weekly";
  goal: { type: "runsFinished" | "runsWon" | "floorsReached" | "bossKills"
               | "distinctHeroesUsed" | "gachaPulls" | "cardsUnlocked"; count: number };
  reward: { moonJade: number };
}
interface MissionState {
  dayKey: string; weekKey: string;          // "2026-09-27", "2026-W39" theo mốc reset
  progress: Record<string, number>;          // missionId → tiến độ trong kỳ
  claimed: string[];                         // missionId đã nhận trong kỳ
}
```

- Nội dung khởi điểm: ngày — hoàn thành 1 lượt chơi (40), đạt tổng 10 tầng (40),
  dùng 3 Hero khác nhau (30); tuần — thắng 3 lượt chơi (200), hạ 2 boss (150),
  quay 10 lượt (100).
- Đổi `dayKey`/`weekKey` (so với `now`) → reset `progress`/`claimed` của kỳ đó trước
  khi cộng.
- Nhận thưởng thủ công (`POST /api/missions/:id/claim`): lỗi `"not complete"`,
  `"already claimed"`.

### 3.4 Thành tựu (`achievements.json`)

Như nhiệm vụ nhưng không có kỳ, tự nhận khi đạt (không cần bấm). Khởi điểm: thắng
lượt đầu (300), hạ boss lần đầu với mỗi đội có Song Hành (200), Tu Luyện cấp 6 một
Hero (300), sở hữu cả 5 Hero (500), đạt tầng 8 với Bộ cơ bản (200), mở đủ 6 lá khóa
của mọi Hero đang sở hữu (500).

### 3.5 Gacha

**Dữ liệu (`banners.json`):**

```ts
interface BannerDef {
  id: string; name: string;
  kind: "hero" | "weapon" | "relic";
  pool: Record<Rarity, string[]>;     // id theo độ hiếm; độ hiếm rỗng được phép
  featured?: string[];                 // chừa cho banner giới hạn (GĐ 4: không dùng)
}
// economy-config.json thêm:
"gacha": {
  "rates": { "legendary": 0.02, "epic": 0.13 },   // còn lại rare/common
  "epicPity": 10,
  "legendarySoftPityStart": 55, "legendarySoftPityStep": 0.06, "legendaryPity": 70,
  "newPlayerEpicHero": true
}
```

- Banner Hero khởi điểm: legendary `[m05]`, epic `[m06, f02, f03]`, rare `[f04]`,
  common `[]`.
- **Rarity rỗng:** nếu độ hiếm rút được không có id nào trong pool → hạ xuống độ hiếm
  thấp hơn gần nhất có id; không có độ hiếm thấp hơn → nâng lên gần nhất.

**Thuật toán một lượt quay** (`pull(data, profile, bannerId, rngState)` thuần; quay
10 = gọi 10 lần liên tiếp, một giao dịch):

1. `p = pity[bannerId]` (`{ sinceEpic, sinceLegendary }`, mặc định 0); tăng cả hai +1.
2. Tỉ lệ Legendary: `sinceLegendary ≥ legendaryPity` → 1; `≥ softPityStart` →
   `rates.legendary + step × (sinceLegendary − softPityStart + 1)`; ngược lại
   `rates.legendary`.
3. Rút `u ∈ [0,1)` bằng RNG seed (`packages/rules` RNG có sẵn): `u < pLeg` →
   Legendary; ngược lại nếu `sinceEpic ≥ epicPity` hoặc `u < pLeg + rates.epic` → Epic;
   ngược lại Rare/Common (chia theo pool: có cả hai → common 50% / rare 50%).
4. Legendary → `sinceLegendary = 0` **và** `sinceEpic = 0`; Epic → `sinceEpic = 0`.
5. Chọn id đều trong pool độ hiếm đó. **Bảo vệ người mới** (`newPlayerEpicHero`, chỉ
   banner Hero): khi rút Epic mà còn Hero Epic trong pool chưa sở hữu → chỉ chọn trong
   các Hero chưa sở hữu.
6. Trao vật phẩm (§3.6 cho Hero; §4.5 cho vũ khí/relic); ghi nhật ký.

- Seed: server sinh bằng `crypto.randomInt` cho mỗi giao dịch quay và lưu trong nhật
  ký (`pulls`: tài khoản, banner, seed, kết quả, giờ) — tái hiện được kết quả.
- Lỗi: `"not enough moonJade"` (trừ tiền trước, trong cùng transaction), `"unknown
  banner"`.
- Tỉ lệ và bảo hiểm hiển thị công khai trên màn gacha (GDD §6.1), kèm bộ đếm hiện tại
  của người chơi ("còn N lượt tới Epic chắc chắn").

### 3.6 Sở hữu Hero và Tinh Hồn

- Quay ra Hero chưa sở hữu → thêm vào `profile.heroes` (mặc định như `createProfile`).
- Quay ra Hero đã sở hữu, `constellation < 6` → `constellation += 1`, áp hiệu ứng cấp
  mới; `= 6` → Nguyệt Tinh theo GDD §7.4 (`economy-config.dupeMoonStar`:
  legendary 25, epic 10, rare 3, common 3).

**Hiệu ứng Tinh Hồn** (lẻ = lựa chọn, dùng được PvP sau này; chẵn = sức mạnh, chỉ
PvE — GĐ 4 chưa có PvP nên mọi cấp đều áp dụng trong lượt chơi):

| Cấp | Hiệu ứng | Luật |
|---|---|---|
| 1, 3 | Mở ngay 1 lá khóa | `bonusUnlocks += 1`; `pendingUnlocks = masteryLevel + bonusUnlocks − unlocked` (không vượt số lá khóa còn lại). Người chơi chọn lá ở màn Tu Luyện như 4b |
| 2 | Thăng cấp dễ hơn | Ngưỡng thăng cấp trong trận dùng `heroes.json levelUp.constellationThreshold` thay `threshold` (M05 15→11, F04 3→2, M06 1→1 và đếm cả kẻ địch ngã do Phản Đòn, F03 3→2, F02 3→2) |
| 4 | Lá chủ lực bản "+" | `heroes.json signature: { cardId, plusCard: CardDef }`: trong deck, lá `cardId` được thay bằng `plusCard` (cùng cost, số mạnh hơn ~25%) |
| 5 | Dạng thăng cấp thứ hai | `heroes.json altLevelUp: LevelUpDef`; chọn trước lượt chơi (`levelUpForm`), ảnh chụp vào phiếu |
| 6 | Hiển thị | Khung card / art đặc biệt (client; art tạm: viền vàng) |

**Nội dung đề xuất** (số khởi điểm, chỉnh ở mô phỏng 4d):

| Hero | Lá chủ lực (C4) | Bản "+" | Dạng thăng cấp thứ hai (C5) |
|---|---|---|---|
| M05 | Liệt Hỏa Xung Phong | 10 / HP < 50%: 15 | *Bất Diệt:* điều kiện như cũ; khi thăng cấp nhận 12 giáp và Khiêu Khích 2 vòng, lá phòng thủ của M05 +3 giáp |
| F04 | Bách Thảo Hương | Hồi Phục 4 / đã có: 6 | *Tĩnh Tâm:* điều kiện như cũ; lá hồi của F04 giải trừ mục tiêu |
| M06 | Ám Tiễn | 7 / Ẩn Thân: 12 | *Tàn Ảnh:* điều kiện như cũ; mỗi lượt lá Liên Hoàn đầu tiên tính như đã đánh thêm 1 lá |
| F03 | Sương Trảm | 6 / Đóng Băng: 10 | *Hàn Kiếm:* điều kiện như cũ; đòn đầu tiên mỗi lượt của F03 áp Dễ Vỡ 1 vòng |
| F02 | Ảnh Tập | Cướp 1 buff; 7 / HP < 50%: 12 | *Huyết Diện:* điều kiện như cũ; trong Huyết Nguyệt lá của F02 giảm 1 NL |

Các dạng thăng cấp thứ hai cần kiểu `LevelUpPassive` mới (`01` §8) — mỗi kiểu một test.
Nếu không kịp, C5 có thể dời sang 4e mà không ảnh hưởng phần còn lại.

### 3.7 Loadout vào trận

```ts
interface Loadout {
  heroes: Record<string, { constellation: number; levelUpForm: "base" | "alt";
                           weaponId: string | null; refinement: number }>;
  relics: { id: string; resonance: number }[];          // ≤ 2 (4e)
}
```

- `createRun(data, setup, loadout?)` / `createCombat(data, setup, loadout?)`: thiếu
  `loadout` = mọi Hero cấp 0, không trang bị (trận lẻ, test cũ giữ nguyên).
- Loadout được **suy từ hồ sơ + deck** bằng `buildLoadout(data, profile, deck)` (thuần)
  lúc cấp phiếu; client không tự dựng.

---

## 4. Phần 4e — Binh Khí và Nguyệt Bảo

### 4.1 Luật deck

- Mỗi Hero mang tối đa 1 vũ khí; vũ khí góp **1 lá Binh Khí** chiếm 1 ô trong 18 lá,
  **không** tính vào `minCardsPerHero` (GDD §3.1; người dùng xác nhận ở 4b).
- Một vũ khí chỉ có 1 bản (trùng → Tinh Luyện), nên trong một deck mỗi vũ khí gắn
  tối đa 1 Hero.
- Đội mang tối đa 2 Nguyệt Bảo khác nhau.
- `SavedDeck` thêm `weapons: Record<heroId, weaponId | null>`, `relicIds: string[]`.
- Lỗi mới của `validateDeck`: `unownedHero`, `unownedWeapon`, `weaponTwice`,
  `unownedRelic`, `tooManyRelics`, `duplicateRelic`; `wrongSize` tính **lá Hero + lá
  Binh Khí**.

### 4.2 Lá Binh Khí và nội tại (luật trận)

```ts
interface WeaponDef {
  id: string; name: string; rarity: Rarity;
  archetype?: Archetype;                 // vũ khí chung
  signatureHeroId?: string;              // vũ khí bản mệnh
  card: Omit<CardDef, "ownerId" | "id" | "copies"> & { copies: 1 | 2 };
  hooks: WeaponHook[];                   // nội tại
  signatureHooks?: WeaponHook[];         // thay hooks khi người mang = signatureHeroId
  refinement: WeaponRefinement[];        // R2..R5, xem §4.4
}
type WeaponHook = RunRelicHook & { actor: RunRelicHook["actor"] | "wearer" };
```

- Lá Binh Khí có id instance `wpn_<heroId>` (+ số bản), `cardId = weapon.id`,
  `ownerIds = [heroId người mang]`: mọi luật lá của Hero áp dụng (Tàn Chiêu khi người
  mang ngã, Đóng Băng, tag theo pha, nội tại thăng cấp của người mang). Không phải lá
  Song Hành.
- Nội tại vũ khí chạy trên máy hook Kỳ Vật (`01` §13): thứ tự chạy **sau** Kỳ Vật /
  Lõi / Nguyệt Bảo, theo vị trí Hero 0 → 2. `actor: "wearer"` = Hero người mang (ngã →
  hook không chạy). Trigger `cardPlayed` thêm bộ lọc `owner?: "wearer"`.
- Ràng buộc effect như hook Kỳ Vật (§13.4); lá Binh Khí là **lá bài** nên được dùng
  mọi effect của lá (kể cả từ khóa 4b).

### 4.3 Nguyệt Bảo

```ts
interface RelicDef {
  id: string; name: string; rarity: Rarity;
  resonance: { text: string; modifiers?: MoonModifier[]; hooks?: RunRelicHook[] }[]; // đúng 5 cấp
}
```

- Chạy như Kỳ Vật (modifier cộng vào `activeModifiers`, hook cùng máy), nằm cả đời
  tài khoản, mang vào mọi trận của lượt chơi (và trận lẻ).
- `costModifierForTag` thêm trường tùy chọn `while?: "bloodMoon"` (cho *Huyết Ngọc
  Bội*); cần 1 test luật.

### 4.4 Tinh Luyện và Cộng Minh

Nâng cấp bằng bản trùng (quay trúng lần nữa); không có nâng cấp bằng vật liệu ở GĐ 4.

- **Tinh Luyện** R1 → R5 (`WeaponRefinement` = lá và/hoặc nội tại thay thế cho cấp
  đó, định nghĩa đầy đủ trong data): R2, R4 ≈ +15% số chính (làm tròn lên); R3 = lá
  Binh Khí −1 NL (tối thiểu 0) hoặc thêm hiệu ứng phụ; R5 = nội tại mạnh lên rõ.
- **Cộng Minh** 1 → 5: mỗi cấp một bản `resonance[i]` đầy đủ; 2–4 tăng số hoặc mở rộng
  điều kiện; 5 thêm hiệu ứng thứ hai (GDD §7.3).
- Trùng khi đã max: vũ khí → Huyền Thiết + Nguyệt Tinh; Nguyệt Bảo → Nguyệt Trần +
  Nguyệt Tinh (GDD §7.4: legendary 10 / epic 4 / rare 1 Nguyệt Tinh; Huyền Thiết,
  Nguyệt Trần 1 mỗi bản). Huyền Thiết / Nguyệt Trần GĐ 4 chỉ tích trữ (chưa có chỗ
  tiêu — nâng cấp bằng vật liệu để GĐ sau).

### 4.5 Nội dung: 10 Binh Khí

Số là R1, khởi điểm; chỉnh ở mô phỏng 4e. "Bản mệnh" = nội tại mạnh hơn trên đúng Hero.

| Id | Tên | Độ hiếm | Loại | Lá Binh Khí (cost · copies) | Nội tại (bản mệnh) |
|---|---|---|---|---|---|
| `w_xich_diem_thuong` | Xích Diệm Thương | Legendary | M05 | *Liệt Diệm* (4·2): gây 8, Thiêu Đốt 3 | Đầu trận người mang Phản Đòn 2 (M05: 3 và +1 Sức Mạnh) |
| `w_anh_nguyet_chuy` | Ảnh Nguyệt Chủy | Epic | M06 | *Ảnh Sát Chủy* (1·2): gây 3; mục tiêu ≤ 30% HP: 9 | Mỗi lá `assassin` thứ 3 của người mang: +1 NL (M06: +2) |
| `w_han_tuyet_song_kiem` | Hàn Tuyết Song Kiếm | Epic | F03 | *Song Tuyết* (4·2): gây 4 ×2; Tích Tụ 1: Đóng Băng | Đầu trận mọi kẻ địch Suy Yếu 1 vòng (F03: 2 vòng) |
| `w_thien_dien_phien` | Thiên Diện Phiến | Epic | F02 | *Phiến Ảnh* (1·2): Đoạt Nguyệt 1; Liên Hoàn 2: Cướp 1 buff | Khi Huyết Nguyệt bắt đầu: người mang +1 Sức Mạnh (F02: +1 Sức Mạnh và +2 NL) |
| `w_bach_hoa_tram` | Bách Hoa Trâm | Rare | F04 | *Trâm Hoa* (2·2): 1 Hero Hồi Phục 3; Tích Tụ 1: 5 | Cuối lượt Hero máu thấp nhất Hồi Phục 1 (F04: 2) |
| `w_thiet_thuan` | Thiết Thuẫn | Rare | Vanguard | *Thuẫn Kích* (2·2): nhận 6 giáp, Khiêu Khích 1 vòng | Đầu trận người mang 4 giáp |
| `w_liet_cung` | Liệt Cung | Rare | Striker | *Liệt Tiễn* (3·2): gây 3 ×2, Đánh Dấu 1 vòng | Người mang kết liễu kẻ địch: +1 NL |
| `w_huyen_linh_kinh` | Huyền Linh Kính | Epic | Controller | *Kính Hàn* (2·2): Tỏa Nguyệt 2, Suy Yếu 1 vòng | Khi vào Trăng Non: mọi kẻ địch Dễ Vỡ 1 vòng |
| `w_thanh_tam_binh` | Thanh Tâm Bình | Rare | Support | *Bình Lộ* (3·2): mọi Hero hồi 3 (Dư Sinh) | Đầu trận người mang Hồi Phục 2 |
| `w_tinh_ban` | Tinh Bàn | Legendary | Specialist | *Chuyển Tinh* (2·2): Đổi Vận 1 pha, Chiêm Bài 2 | Đầu trận: Dưỡng Nguyệt 1 (mỗi lượt +1 NL) |

Vũ khí chung (archetype) mang được cho **mọi** Hero; không có bản mệnh.

### 4.6 Nội dung: 8 Nguyệt Bảo

Cộng Minh 1; cấp 2–5 theo §4.4. Tên không trùng Kỳ Vật / Lõi.

| Id | Tên | Độ hiếm | Hiệu ứng (Cộng Minh 1) |
|---|---|---|---|
| `r_thien_sach` | Thiên Sách | Legendary | Khi vào Trăng Tròn: +2 NL (GDD "rút thêm 2 lá" — đổi vì 4a đã bỏ rút bài tự do) |
| `r_vong_nguyet_kinh` | Vọng Nguyệt Kính | Legendary | Mỗi lần trăng đổi pha: mọi Hero 2 giáp |
| `r_huyet_ngoc_boi` | Huyết Ngọc Bội | Epic | Trong Huyết Nguyệt: lá `forbidden` −1 NL |
| `r_loan_linh_an` | Loan Linh Ấn | Epic | Mỗi lá kỹ năng thứ 3 trong trận: +1 NL |
| `r_xich_diem_chau` | Xích Diễm Châu | Epic | Khi hạ một kẻ địch: mọi kẻ địch còn lại Thiêu Đốt 2 |
| `r_bach_lo_huong_nang` | Bạch Lộ Hương Nang | Rare | Khi vào Trăng Tròn: Hero máu thấp nhất hồi 3 |
| `r_huyen_vu_giap_phu` | Huyền Vũ Giáp Phù | Rare | Đầu trận mọi Hero 3 giáp |
| `r_tran_hon_linh` | Trấn Hồn Linh | Rare | Khi một Hero ngã: các Hero còn lại +1 Sức Mạnh |

Banner Binh Khí Các: legendary 2, epic 4, rare 4. Banner Nguyệt Bảo Các: legendary 2,
epic 3, rare 3. Tài khoản mới không có vũ khí / Nguyệt Bảo; `starterGift` không đổi
(người chơi chọn banner).

---

## 5. Server API

Mọi route dưới `/api`, JSON, lỗi dạng `{ error: string, ... }`. Body kiểm bằng zod.
Route cần đăng nhập trả `401` khi thiếu/sai token. Mọi route thay đổi hồ sơ cần
`If-Match` (§2.6) và trả `{ profile, rev, ... }`.

| Phần | Route | Mô tả |
|---|---|---|
| 4c | `POST /auth/register` `{ username, password }` | Tạo tài khoản + hồ sơ mới + phiên; `409 "username taken"` |
| 4c | `POST /auth/login` | Trả `{ token, profile, rev }` |
| 4c | `POST /auth/logout` | Xóa phiên hiện tại |
| 4c | `GET /profile` | `{ profile, rev, dataVersion }` |
| 4c | `POST /profile/import` `{ local }` | §2.3 |
| 4c | `POST /profile/unlock` `{ heroId, cardId }` | `unlockCard` |
| 4c | `PUT /profile/decks` `{ draft }` · `DELETE /profile/decks/:id` | `saveDeck` / `deleteDeck` |
| 4c | `POST /runs` · `POST /runs/:id/finish` · `POST /runs/:id/abandon` | §2.4 |
| 4d | `GET /gacha/banners` | Banner, tỉ lệ, pool, bảo hiểm của người chơi |
| 4d | `POST /gacha/:bannerId/pull` `{ count: 1 \| 10 }` | §3.5; trả kết quả từng lượt |
| 4d | `GET /gacha/history?banner=&page=` | Nhật ký quay |
| 4d | `POST /missions/:id/claim` · `POST /shop/:itemId/buy` | §3.3, §3.1 |
| 4d | `PUT /profile/heroes/:id/level-up-form` `{ form }` | Tinh Hồn 5 |
| 4e | (không thêm route: trang bị nằm trong deck — `PUT /profile/decks`) | |

**SQLite (`db.ts`, migration đánh số):**

| Bảng | Cột chính |
|---|---|
| `accounts` | `id`, `username` (unique), `password_hash`, `created_at`, `failed_logins`, `locked_until` |
| `sessions` | `token_hash` (PK), `account_id`, `last_used_at` |
| `profiles` | `account_id` (PK), `profile_json`, `rev`, `updated_at` |
| `runs` | `id`, `account_id`, `status` (`open`/`finished`/`abandoned`/`rejected`), `setup_json`, `loadout_json`, `data_version`, `created_at`, `finished_at`, `result_json` |
| `pulls` | `id`, `account_id`, `banner_id`, `seed`, `results_json`, `created_at` |

Mọi thao tác "đọc hồ sơ → hàm thuần → ghi hồ sơ + bảng phụ" chạy trong một
transaction đồng bộ của better-sqlite3 (không có race trong một tiến trình).

---

## 6. Client

- **4c:** màn Đăng nhập / Đăng ký (tên, mật khẩu, báo lỗi tiếng Việt); `api.ts`
  (fetch, token trong `localStorage`, xử lý `401` → về màn đăng nhập, `409 stale` →
  tải lại hồ sơ); `profile-store.ts` thay bằng bản sao hồ sơ từ server; Lượt chơi
  lấy phiếu trước khi vào bản đồ, nộp Action khi kết thúc, màn cuối lượt hiện XP do
  server trả; hộp thoại nhập hồ sơ cũ một lần.
- **4d:** thanh tiền tệ trên màn chọn deck; màn **Gacha** (chọn banner, tỉ lệ công khai,
  bộ đếm bảo hiểm, quay 1/10, hiệu ứng lật card bằng tween theo độ hiếm); **Kho Hero**
  (Hero sở hữu, Tinh Hồn, chọn dạng thăng cấp); màn Tu Luyện dùng `pendingUnlocks` mới;
  màn **Nhiệm vụ** (ngày/tuần/thành tựu, nút nhận); xếp deck khóa Hero chưa sở hữu.
- **4e:** **Kho đồ** (vũ khí / Nguyệt Bảo, cấp, xem lá Binh Khí và nội tại từng cấp);
  xếp deck: ô vũ khí mỗi Hero, 2 ô Nguyệt Bảo, bộ đếm 18 lá tính lá Binh Khí; trong
  trận lá Binh Khí có khung riêng; animator hiện tên vũ khí / Nguyệt Bảo khi hook chạy.

Mọi chữ hiển thị tiếng Việt lấy từ data hoặc `theme.ts`; client không tự tính luật.

---

## 7. Test

Mã mới từ **T173**. Test luật dùng fixture; test server dùng `buildApp` với DB
`:memory:`, đồng hồ và nguồn ngẫu nhiên giả.

| Mã | Phần | Nội dung |
|---|---|---|
| T173 | 4c | Đăng ký / đăng nhập / đăng xuất; sai mật khẩu 5 lần → khóa 5 phút; token chỉ lưu dạng băm |
| T174 | 4c | Phiên hết hạn sau 30 ngày không dùng; dùng thì gia hạn |
| T175 | 4c | `parseProfile` v1 → v2: giữ XP/lá mở của Hero khởi đầu, bỏ Hero chưa sở hữu, deck giữ nguyên |
| T176 | 4c | `/profile/import` gộp một lần (`xp` max, lá mở hợp, không vượt Tu Luyện), lần hai `409` |
| T177 | 4c | `replayRun`: chuỗi hợp lệ → cùng `RunState` như client; Action bị từ chối → `step`/`reason`; Action sau khi kết thúc bị từ chối |
| T178 | 4c | Phiếu: một phiếu mở/tài khoản, cấp mới bỏ phiếu cũ, hết hạn 7 ngày, `dataVersion` lệch → `409` |
| T179 | 4c | Nộp lượt chơi hợp lệ trao XP đúng `applyRunResult` trong một transaction; nộp lại phiếu đã xong bị từ chối |
| T180 | 4c | `If-Match` lệch → `409 stale profile` kèm hồ sơ mới |
| T181 | 4c | `validateDeck` / cấp phiếu từ chối Hero chưa sở hữu (`unownedHero`) |
| T182 | 4c | `dataVersion` tất định: cùng data → cùng hash; đổi 1 số → hash khác |
| T183 | 4d | `applyRunRewards`: công thức Nguyệt Ngọc, `firstWinOfDay` một lần/ngày theo mốc 21:00 UTC |
| T184 | 4d | Nhiệm vụ: cộng tiến độ, reset khi đổi `dayKey`/`weekKey`, nhận thưởng, lỗi `not complete`/`already claimed` |
| T185 | 4d | Thành tựu tự nhận đúng một lần |
| T186 | 4d | Gacha tất định: cùng seed + hồ sơ → cùng kết quả; quay 10 = 10 lần liên tiếp |
| T187 | 4d | Bảo hiểm Epic: lượt thứ 10 không có Epic+ → chắc chắn Epic+; Legendary reset cả hai bộ đếm |
| T188 | 4d | Bảo hiểm Legendary: lượt 70 chắc chắn; tỉ lệ mềm từ lượt 55 đúng công thức |
| T189 | 4d | Độ hiếm rỗng hạ/nâng đúng; bảo vệ người mới chọn Hero Epic chưa sở hữu |
| T190 | 4d | Không đủ Nguyệt Ngọc → lỗi, hồ sơ không đổi; trừ tiền và trao đồ cùng transaction |
| T191 | 4d | Hero mới → sở hữu; trùng → Tinh Hồn +1; Tinh Hồn 6 + trùng → Nguyệt Tinh theo độ hiếm |
| T192 | 4d | Tinh Hồn 1/3: `bonusUnlocks` cộng vào `pendingUnlocks`, không vượt số lá khóa |
| T193 | 4d | Tinh Hồn 2: trận dùng `constellationThreshold` |
| T194 | 4d | Tinh Hồn 4: lá chủ lực trong deck thành bản "+" |
| T195 | 4d | Tinh Hồn 5: dạng thăng cấp thứ hai từ loadout; mỗi `LevelUpPassive` mới một test |
| T196 | 4d | Cửa hàng Nguyệt Tinh: giới hạn tuần, `heroChoice` chỉ Hero chưa sở hữu |
| T197 | 4e | Lá Binh Khí vào chồng bài với `ownerIds` = người mang, tính vào 18 lá, không tính tối thiểu Hero |
| T198 | 4e | Lá Binh Khí thành Tàn Chiêu khi người mang ngã; bị khóa khi người mang Đóng Băng |
| T199 | 4e | Nội tại vũ khí: `actor: "wearer"`, bộ lọc `owner: "wearer"`, thứ tự sau Kỳ Vật/Lõi/Nguyệt Bảo |
| T200 | 4e | Bản mệnh: `signatureHooks` thay `hooks` khi đúng Hero |
| T201 | 4e | Nguyệt Bảo: modifier + hook như Kỳ Vật, tối đa 2 |
| T202 | 4e | `costModifierForTag.while = "bloodMoon"` chỉ áp trong Huyết Nguyệt |
| T203 | 4e | `validateDeck` lỗi trang bị: `unownedWeapon`, `weaponTwice`, `unownedRelic`, `tooManyRelics`, `duplicateRelic` |
| T204 | 4e | Tinh Luyện / Cộng Minh: trùng → cấp +1, dùng bản dữ liệu cấp đó trong trận; max + trùng → vật liệu + Nguyệt Tinh |
| T205 | 4e | `buildLoadout` suy đúng từ hồ sơ + deck; phiếu chụp loadout, đổi trang bị sau khi cấp phiếu không ảnh hưởng lượt đang chơi |
| T206 | 4e | Data: 10 vũ khí, 8 Nguyệt Bảo, mỗi Nguyệt Bảo đúng 5 cấp, mỗi vũ khí R2–R5, id không trùng Kỳ Vật/Lõi/lá |

---

## 8. Mô phỏng và chỉnh số

- **4c:** không đổi cân bằng. Chạy lại toàn bộ `run-playtest` qua `replayRun` (mọi lượt
  chạy lại phải khớp) — kiểm tất định trên 480 lượt.
- **4d:** mô phỏng kinh tế (script test, không cần server): người chơi ảo 2 lượt/ngày
  + nhiệm vụ ngày/tuần trong 60 ngày × 200 seed → phân bố ngày có đủ 5 Hero, ngày có
  Legendary đầu tiên, Tinh Hồn TB. Mục tiêu: 90% có đủ 5 Hero trước ngày 7; Legendary
  mới TB 16–25 ngày. Đo lại thắng lượt với Tinh Hồn 0 / 2 / 4 / 6: chênh ≤ 15 điểm giữa
  C0 và C6.
- **4e:** `run-playtest` thêm loại deck có trang bị (mỗi vũ khí, mỗi Nguyệt Bảo, R1 và
  R5): không trang bị nào làm thắng lượt tăng > 10 điểm ở R1; "lá chưa từng được đánh"
  gồm cả lá Binh Khí.
- Gói chỉnh phải được người dùng duyệt trước khi áp (như 4a/4b).

---

## 9. Tài liệu cần cập nhật

- `00-gdd.md` §5, §6, §7, §9, §10: ghi chú lựa chọn GĐ 4 (Fastify + SQLite, chưa
  Colyseus; Thiên Sách đổi hiệu ứng; vũ khí chung theo archetype).
- `01-combat-rules.md`: lá Binh Khí, `actor: "wearer"`, bộ lọc `owner`, thứ tự hook,
  `costModifierForTag.while`, Tinh Hồn 2/4/5 trong trận, `LevelUpPassive` mới.
- `02-data-schema.md`: `economy-config`, `banners`, `missions`, `achievements`,
  `weapons`, `relics`, trường mới của `heroes.json`, `SavedDeck`, `Loadout`.
- `04-glossary.md`: chuyển mục "Hệ thống sau này" lên phần chính; thêm Phiếu lượt
  chơi (`runTicket`), Chạy lại (`replay`), Nhiệm vụ (`mission`), Thành tựu
  (`achievement`), Bảo vệ người mới (`newPlayerProtection`), Dạng thăng cấp thứ hai
  (`altLevelUp`), Lá chủ lực (`signatureCard`).
- `06-test-scenarios.md`: T173–T206.
- `07-implementation-plan.md`: các bước dưới đây.
- `14-meta-rules.md`: hồ sơ v2, tiền tệ, nhiệm vụ, gacha, Tinh Hồn, trang bị, deck.
- `16-server-api.md` (mới): §2.1, §2.4, §2.6, §5.
- `CLAUDE.md`: giai đoạn hiện tại, `apps/server`, lệnh chạy server, quy tắc "chỉ
  server sửa kho đồ".

---

## 10. Kế hoạch bước

| Bước | Nội dung |
|---|---|
| 4c.1 | Tài liệu (`14` hồ sơ v2, `16`, `04`, `06` T173–T182, `07`, `CLAUDE.md`) |
| 4c.2 | `dataVersion`; hồ sơ v2 + `parseProfile` v1→v2; `replayRun` (T175, T177, T182) |
| 4c.3 | `apps/server`: Fastify + SQLite, migration, auth, phiên (T173, T174) |
| 4c.4 | Route hồ sơ, deck, mở lá, nhập hồ sơ, `If-Match` (T176, T180, T181) |
| 4c.5 | Phiếu lượt chơi + nộp + chạy lại + trao XP (T178, T179); `run-playtest` qua `replayRun` |
| 4c.6 | Client: đăng nhập, `api.ts`, luồng lượt chơi qua server, nhập hồ sơ cũ |
| 4d.1 | Tài liệu (`14`, `02`, `04`, `06` T183–T196) |
| 4d.2 | `economy-config`, thưởng lượt chơi, nhiệm vụ, thành tựu (T183–T185) |
| 4d.3 | Gacha + banner Hero + nhật ký (T186–T190) |
| 4d.4 | Sở hữu Hero, Tinh Hồn 1–6, loadout, cửa hàng (T191–T196) |
| 4d.5 | Client: gacha, kho Hero, nhiệm vụ, tiền tệ |
| 4d.6 | Mô phỏng kinh tế + chỉnh số (duyệt) |
| 4e.1 | Tài liệu (`01`, `02`, `14`, `06` T197–T206) |
| 4e.2 | Luật trận: lá Binh Khí, nội tại, Nguyệt Bảo, `while` (T197–T202) |
| 4e.3 | Nội dung 10 vũ khí + 8 Nguyệt Bảo, R1–R5, Cộng Minh 1–5; 2 banner (T206) |
| 4e.4 | Deck + trang bị + Tinh Luyện / Cộng Minh + vật liệu (T203–T205) |
| 4e.5 | Client: kho đồ, trang bị trong xếp deck, lá Binh Khí trong trận |
| 4e.6 | Mô phỏng theo trang bị + chỉnh số (duyệt) |

---

## 11. Điểm đã xác nhận (2026-09-27)

1. **Thư viện:** `fastify`, `better-sqlite3`, `@types/better-sqlite3`.
2. **Số kinh tế** (§3.1–§3.2): quà 1600 Nguyệt Ngọc, ~130/lượt chơi, nhiệm vụ ngày ~110,
   tuần ~450 — nhịp "Legendary mới sau ~3 tuần".
3. **Bảo vệ người mới** (§3.5 bước 5): đảm bảo Epic đầu tiên trên banner Hero ra Hero
   chưa sở hữu — lệch nhẹ khỏi GDD, để có đủ 5 Hero sớm.
4. **Tinh Hồn chẵn trong lượt chơi:** GĐ 4 áp mọi cấp (chưa có PvP); khi có PvP (GĐ 5)
   chỉ cấp lẻ.
5. **Thiên Sách** đổi "rút thêm 2 lá" → "+2 NL" (luật 4a đã bỏ rút tự do).
6. **Nội dung đề xuất** ở §3.6 (lá "+", dạng thăng cấp thứ hai) và §4.5–§4.6 (vũ khí,
   Nguyệt Bảo) — số khởi điểm, chỉnh sau mô phỏng.
7. **Art thật** (GDD ghi GĐ 4) tách khỏi các bước code; làm song song khi có art.
