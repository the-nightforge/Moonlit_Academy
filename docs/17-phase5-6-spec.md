# 17 — Đặc tả Giai đoạn 5–6 (PvP, Co-op, triển khai Internet)

Đặc tả cho giai đoạn 5 và 6 của lộ trình GDD (`00` §12): **Đấu Trường Công Bằng** (PvP
1v1 theo lượt) và **Liên Thủ** (co-op raid 2 người, lượt đồng thời, Hợp Kích, Boss
Nguyệt Thực). Cả hai chạy **trên server** (server là trọng tài của trận, không chỉ của
hồ sơ). Chia thành các phần, mỗi phần có bản chơi được trước khi sang phần sau:

| Phần | Nội dung | Kết quả chơi được |
|---|---|---|
| **5a** | Lõi nhiều người chơi trong `rules`: state có nhiều người chơi, PvE giữ nguyên từng bit | Mọi test cũ xanh; phiếu lượt chơi cũ chạy lại ra đúng kết quả cũ |
| **5b** | Luật PvP (hàm thuần), bảng chỉ số PvP, chuẩn hóa loadout, mô phỏng bot đấu bot | Trận PvP chạy trong test; số liệu cân bằng đạt mục tiêu §4.9 |
| **5c** | Kết nối realtime: WebSocket, phòng trận, góc nhìn che thông tin, đồng hồ, kết nối lại, Đấu Tập với máy | Hai tab trình duyệt (hoặc một tab + máy) đánh PvP qua server |
| **5d** | Hàng chờ xếp hạng, Phòng riêng, Điểm Đấu Trường (Elo), Vinh Dự, Cửa hàng Vinh Dự, client Đấu Trường | Vào hàng chờ, đánh, nhận điểm và Vinh Dự |
| **5e** | Triển khai Internet: build, HTTPS/WSS, reverse proxy, sao lưu, giới hạn tần suất | Bạn bè ngoài mạng LAN đăng ký và đấu được |
| **6a** | Luật co-op: 6 Hero, lượt đồng thời, Hợp Kích, Boss Nguyệt Thực 4 giai đoạn; mô phỏng | Trận co-op chạy trong test; mục tiêu §8.8 |
| **6b** | Co-op trên server + client + thưởng (Nguyệt Ngọc, Nguyệt Trần), đồng đội máy | Hai người (hoặc một người + máy) đánh Boss Nguyệt Thực qua mạng |

Thiết kế được chốt với người dùng (2026-09-30): kết nối realtime dùng
**`@fastify/websocket`** (gắn vào server Fastify hiện có); PvP có **Elo + Vinh Dự tối
thiểu + Cửa hàng Vinh Dự nhỏ** (chưa có mùa giải); có **đối thủ máy (Đấu Tập) và đồng
đội máy, không trao thưởng**; có **bước triển khai Internet** (5e).

Khi đưa vào tài liệu luật (bước 5a.1 / 5b.1 / … / 6a.1): luật trận PvP và co-op vào
`01` (mục mới §15 PvP, §16 co-op); luật Elo, Vinh Dự, thưởng co-op vào `14`; giao thức
WebSocket, bảng mới, triển khai vào `16`; schema vào `02`; nội dung boss / Hợp Kích vào
`03`; thuật ngữ (chuyển "Hệ thống sau này" của `04` lên phần chính) vào `04`; test vào
`06`; bước vào `07`. Khi có khác biệt, tài liệu luật là chuẩn; tài liệu này giữ bối cảnh
và lý do.

**Điều kiện trước:** GĐ 4e (`15` §4) và gói chỉnh G1 đã vào `main`.

**Trạng thái:** bản nháp, chờ duyệt — gồm mọi điểm ở §12.

**Thư viện mới cần duyệt** (CLAUDE.md): `@fastify/websocket` (kéo theo `ws`, `@types/ws`)
cho `apps/server`. Client dùng `WebSocket` có sẵn của trình duyệt. Không thêm thư viện
nào khác: hàng chờ, đồng hồ, giới hạn tần suất viết tay; file tĩnh khi triển khai do
reverse proxy (Caddy, ngoài repo) phục vụ, không cần `@fastify/static`.

---

## 0. Phạm vi

**Có:**
- 5a: `CombatState` có danh sách người chơi (`players`), mỗi người chơi giữ chồng bài,
  tay, Nguyệt Lực, Chiêm Bài, trang bị riêng; PvE = 1 người chơi, kết quả **giống hệt**
  trước (kể cả thứ tự RNG và event).
- 5b: chế độ `pvp` của `createCombat` / `applyAction`: 2 người chơi, lượt luân phiên,
  bù cho người đi sau, trạng thái thời hạn tính theo lượt; `pvp-config.json` (bảng chỉ
  số PvP, Hero thử, trang bị PvP cơ bản, đồng hồ); `buildPvpLoadout` (chuẩn hóa); góc
  nhìn che thông tin (`viewFor`, `redactEvents`); bot PvP; mô phỏng bot đấu bot.
- 5c: `@fastify/websocket`; giao thức tin nhắn (§5.2); phòng trận trong bộ nhớ server;
  đồng hồ lượt, hết giờ, bỏ cuộc, mất kết nối và kết nối lại; lưu trận vào SQLite;
  Đấu Tập (máy chạy bot PvP trên server).
- 5d: hàng chờ xếp hạng; Phòng riêng (mã 6 ký tự, không xếp hạng); Điểm Đấu Trường
  (Elo) và bậc hiển thị; Vinh Dự (tiền tệ mới) + giới hạn ngày; Cửa hàng Vinh Dự; client:
  sảnh Đấu Trường, xếp deck PvP (Hero thử, trang bị PvP), màn trận PvP, lịch sử trận.
- 5e: server phục vụ sau reverse proxy (HTTPS/WSS), cấu hình production, sao lưu DB,
  giới hạn tần suất đăng ký / đăng nhập / tin nhắn, kiểm tra `Origin`.
- 6a: chế độ `coop`: 2 người chơi × 3 Hero cùng phe, lượt đồng thời, Hợp Kích
  (`coop-combos.json`, 3 Hợp Kích theo GDD), Boss Nguyệt Thực (4 giai đoạn), mô phỏng
  2 bot.
- 6b: phòng co-op trên server (Phòng riêng + hàng chờ + đồng đội máy); thưởng co-op;
  client: sảnh Liên Thủ, màn trận 6 Hero, đồng hồ lượt, báo Hợp Kích.

**Không có (để sau):** mùa giải, reset điểm, thưởng cuối mùa, khung card / danh hiệu
(cần hệ thống hiển thị chưa có); chat tự do (chỉ có biểu cảm cố định, §7.5); xem trận của
người khác (spectate); phát lại trận trong client (chỉ lưu dữ liệu để debug); co-op quá 2
người; nhiều boss co-op (chỉ Boss Nguyệt Thực); nâng Tinh Luyện / Cộng Minh bằng Huyền
Thiết / Nguyệt Trần (đề xuất ở §12, chưa chốt); cân bằng tự động theo tỉ lệ thắng; nhiều
server / cân bằng tải (một tiến trình Node, một file SQLite).

**Nguyên tắc:**
- `packages/rules` vẫn thuần. Luật PvP và co-op là hàm thuần như PvE: `applyAction(state,
  action)` → state mới + event. Góc nhìn che thông tin và bot cũng là hàm thuần.
- **Server là trọng tài của trận** PvP / co-op: client gửi `Action`, server chạy `rules`,
  gửi event + góc nhìn cho từng người. Client **không** giữ state đầy đủ của trận mạng
  (không thấy tay đối thủ, thứ tự chồng bài, `rngState`).
- PvE (trận lẻ, lượt chơi) giữ nguyên cách chạy trên client + chạy lại trên server (GĐ 4).
- Nội dung và số liệu trong JSON (`pvp-config.json`, `coop-config.json`,
  `coop-combos.json`, boss trong `enemies.json` / `encounters.json`).
- Server nhận giờ và hẹn giờ qua tham số (`clock`, `scheduler`) để test tất định.

---

## 1. Kiến trúc

```
packages/
  rules/src/
    players.ts          PlayerState, truy cập theo người chơi (5a)
    pvp/                create-pvp.ts, turn.ts, view.ts, bot.ts (5b)
    coop/               create-coop.ts, turn.ts, combos.ts, boss.ts, bot.ts (6a)
    meta/rating.ts      Elo, bậc (5d)
    meta/honor.ts       Vinh Dự, cửa hàng Vinh Dự (5d)
    meta/coop-rewards.ts (6b)
  data/                 pvp-config.json, coop-config.json, coop-combos.json (+ schema)
apps/
  server/src/
    realtime/           socket.ts (kết nối, xác thực), protocol.ts (zod tin nhắn),
                        match-room.ts (phòng trận chung), pvp-room.ts, coop-room.ts,
                        queue.ts (hàng chờ), rooms.ts (Phòng riêng), bot-player.ts
    routes/             arena.ts (lịch sử, bảng xếp hạng, cửa hàng Vinh Dự), coop.ts
  client/src/
    net/socket.ts       WebSocket + kết nối lại + hàng đợi tin nhắn
    scenes/             arena-lobby, coop-lobby, net-combat (dùng chung renderer trận)
```

- **Một tiến trình Node**: HTTP (`/api/...`) và WebSocket (`/api/ws`) chung cổng. Phòng
  trận nằm trong bộ nhớ; khởi động lại server = mọi trận đang chơi bị hủy (§5.6).
- `buildApp(deps)` thêm `scheduler: { setTimeout, clearTimeout }` (test dùng bản giả tiến
  giờ bằng tay). Test WebSocket dùng `injectWS` của `@fastify/websocket`.
- Client dùng lại renderer trận hiện có (`combat` scene): nhận **góc nhìn** thay cho state
  đầy đủ; các hàm hiển thị (`getEffectiveCost`, `getValidTargets`, `isCardPlayable`, xem
  trước damage) chạy trên góc nhìn vì góc nhìn giữ nguyên mọi thứ của người xem.

---

## 2. Phần 5a — Lõi nhiều người chơi

### 2.1 Vì sao phải đổi state

`CombatState` hiện gắn chồng bài, tay, Nguyệt Lực, Chiêm Bài, trang bị với **một** người
chơi và gọi phe kia là `enemies`. PvP cần hai bộ như vậy; co-op cần hai người chơi cùng
đánh một phe địch. Làm lại một lần cho cả hai chế độ, trước khi viết luật PvP.

### 2.2 Kiểu mới

```ts
type CombatMode = "pve" | "pvp" | "coop";

interface PlayerState {
  index: number;                 // 0 hoặc 1
  heroIds: string[];             // unit id của 3 Hero của người chơi này
  drawPile: string[]; hand: string[]; discardPile: string[];
  moonPower: number; moonReserve: number; moonPowerBonus: number;
  cardsPlayedThisTurn: number;
  pendingChoice: { kind: "chooseCard"; options: string[] } | null;
  weapons: CombatWeapon[];
  relics: { id: string; resonance: number }[];
  runRelicIds: string[];         // chỉ PvE (Kỳ Vật, Lõi)
  hookCounters: Record<string, number>;
  done: boolean;                 // co-op: đã bấm Xong lượt này (§8.3)
}

interface CombatState {
  mode: CombatMode;
  status: CombatStatus;          // thêm "opponentTurn" (PvP, góc nhìn), xem §4.2
  activePlayer: number;          // PvP: người đang có lượt; PvE / co-op: 0
  round: number; moonIndex: number; bloodMoonRounds: number;
  players: PlayerState[];        // PvE: 1; PvP, co-op: 2
  heroes: HeroState[];           // mọi Hero, HeroState thêm `player: number`
  enemies: EnemyState[];         // PvP: rỗng
  cards: Record<string, CardInstance>;
  rngState: number;
  winner?: number | "draw";      // PvP
  // … các trường riêng co-op ở §8.2
}
```

- **Unit id và instance id** có tiền tố người chơi khi có 2 người chơi (`p0_m05`,
  `p1_m05`, `p1_c12`, `p1_wpn_m05_1`) để hai người chơi được chọn cùng Hero. PvE giữ id
  cũ (`m05`, `c12`…) để phiếu lượt chơi cũ (Action chứa `instanceId`, `targetId`) chạy
  lại được.
- Các trường cũ ở gốc (`hand`, `moonPower`, `runRelicIds`…) **chuyển vào**
  `players[0]`. Mọi chỗ đọc chúng trong `rules` và `client` đi qua hàm truy cập
  (`playerOf(state, heroId)`, `activePlayerState(state)`).
- "Đồng đội" và "đối thủ" của một Hero (dùng cho `allAllies`, `allEnemies`, `ally`,
  `enemy`, Khiêu Khích, Ẩn Thân) tính bằng hàm `alliesOf(state, unit)` /
  `opponentsOf(state, unit)`: PvE như cũ; PvP = Hero cùng / khác người chơi; co-op xem
  §8.4.

### 2.3 Ràng buộc bất biến

- **PvE giống hệt từng bit:** cùng seed + cùng chuỗi Action → cùng chuỗi event và cùng
  state (sau khi đổi sang kiểu mới). Kiểm bằng **bộ ghi vàng**: trước khi đổi code, ghi
  kết quả (chuỗi event dạng JSON, băm) của ~200 trận / lượt chơi bot với seed cố định
  vào `packages/rules/test/golden/`; sau khi đổi, so khớp (T213).
- `replayRun` với phiếu cũ trong DB (GĐ 4c–4e) cho ra đúng kết quả cũ (T214).
- Không đổi luật PvE, không đổi dữ liệu. Bước này không có tính năng mới cho người chơi.

---

## 3. PvP — chuẩn hóa và deck

### 3.1 `pvp-config.json`

```json
{
  "heroStats": { "m05": { "maxHp": 52 }, "f04": { "maxHp": 40 }, "m06": { "maxHp": 36 },
                 "f03": { "maxHp": 42 }, "f02": { "maxHp": 34 } },
  "trialHeroIds": ["m05", "f04", "m06", "f03", "f02"],
  "freeWeaponIds": ["w_bach_hoa_tram", "w_thiet_thuan", "w_liet_cung", "w_thanh_tam_binh"],
  "freeRelicIds": ["r_bach_lo_huong_nang", "r_huyen_vu_giap_phu", "r_tran_hon_linh"],
  "secondPlayerBonus": { "moonPower": 1 },
  "turnSeconds": 60, "mulliganSeconds": 30, "timeoutsToForfeit": 3,
  "reconnectSeconds": 60, "roundCap": 30
}
```

Số HP là **khởi điểm** (khoảng PvE × 1.3 để trận dài 8–12 vòng), chỉnh ở bước mô phỏng
(§4.9).

### 3.2 Chuẩn hóa (GDD `00` §8.4)

| Hạng mục | Trong PvP |
|---|---|
| HP Hero | `pvp-config.heroStats[id].maxHp` |
| Hero dùng được | Hero đã sở hữu + `trialHeroIds` (Hero thử; hiện có 5 Hero nên cả 5 đều thử được) |
| Lá dùng được | Hero sở hữu: lá đã mở (Tu Luyện, Tinh Hồn 1/3) như PvE. Hero thử chưa sở hữu: 6 lá khởi đầu |
| Tinh Hồn | Chỉ cấp **lẻ**: 1, 3 (lá đã mở — đã có trong hồ sơ), 5 (dạng thăng cấp thứ hai). Cấp 2 (ngưỡng dễ) và 4 (lá "+") **không** áp |
| Vũ khí | Đã sở hữu **hoặc** trong `freeWeaponIds`; mọi vũ khí về **R1** |
| Nguyệt Bảo | Đã sở hữu **hoặc** trong `freeRelicIds`; mọi Nguyệt Bảo về **Cộng Minh 1** |
| Luật deck | Như PvE (`14` §3.1): 3 Hero, 18 ô, ≥ 4 lá mỗi Hero, 1 vũ khí/Hero, ≤ 2 Nguyệt Bảo; lá Song Hành tự thêm |
| Kỳ Vật / Lõi | Không có |

- `validateDeck(data, profile, deck, { mode: "pvp" })`: như bản thường, nhưng nới "sở
  hữu" theo bảng trên. Deck không cần đánh dấu riêng: một deck hợp lệ PvP có thể không
  hợp lệ PvE (vì có Hero thử) và ngược lại.
- `buildPvpLoadout(data, profile, deck)` (`rules/src/meta/loadout.ts`): `constellation`
  = cấp lẻ lớn nhất ≤ cấp thật (0 → 0, 1–2 → 1, 3–4 → 3, 5–6 → 5); Hero thử chưa sở
  hữu = 0; `refinement = 1`, `resonance = 1`; `levelUpForm` như PvE.
  Cờ `pvp: true` trong loadout để `createCombat` bỏ ngưỡng Tinh Hồn 2 và lá "+" dù
  `constellation ≥ 2/4`. (Đặt `constellation = 1/3/5` đã đủ tắt cấp chẵn cho luật hiện
  tại; cờ để tương lai thêm cấp chẵn mới không lọt vào PvP.)
- Server dựng loadout lúc ghép trận và **chụp** vào bản ghi trận (§5.6), như phiếu lượt
  chơi.

---

## 4. PvP — luật trận

### 4.1 Tạo trận

`createPvpCombat(data, { seed, players: [PvpSide, PvpSide] })`, `PvpSide = { heroIds,
deckCardIds?, cardIds per hero, loadout }`. Thứ tự (quan trọng cho RNG):

1. **Chọn người đi trước** bằng RNG (một lần bốc 0/1) → `firstPlayer`. Người đi sau là
   `players[1 - firstPlayer]`.
2. Với từng người chơi theo **chỉ số** 0 → 1: tạo chồng bài (lá deck, lá Song Hành, lá
   Binh Khí — như `01` §2, §14.2), xáo bằng RNG; Hero `hp = maxHp` theo bảng PvP.
3. Nguyệt Luân pha 1, `round = 1`, `bloodMoonRounds = 0`.
4. Mỗi người chơi rút `handSize` lá (người 0 trước).
5. `status = "mulligan"`: **cả hai** Đổi Bài cùng lúc (Action `mulligan` có `player`).
   Thứ tự giải quyết trên server: theo thứ tự nhận; RNG xáo lại dùng chung `rngState`
   nên thứ tự nhận được ghi vào nhật ký trận (§5.6). Hết `mulliganSeconds` → giữ nguyên tay.
6. Khi cả hai xong: bắt đầu lượt của người đi trước (§4.2); hook `combatStart` của **cả
   hai** người chơi chạy sau hook `playerTurnStart` của lượt đầu tiên (người đi trước
   trước, rồi người đi sau) — cùng lý do như `01` §2 (T115).

### 4.2 Lượt và vòng

- **Một vòng = lượt người đi trước + lượt người đi sau.** Hết lượt người đi sau → cuối
  vòng.
- **Đầu lượt** của người chơi P: như `01` §3.1 nhưng chỉ cho **Hero của P** (xóa giáp +
  Phản Đòn, bộ đếm đầu lượt, Thiêu Đốt / Hồi Phục, mất HP Huyết Nguyệt, rút bù, Cạn Bài,
  hook `playerTurnStart` của P). Nguyệt Lực của P = `base(round) + moonReserve +
  moonPowerBonus`.
- **Bù người đi sau:** ở lượt đầu tiên của người đi sau, cộng thêm
  `secondPlayerBonus.moonPower` vào quỹ (không vào Dự Trữ nếu không tiêu hết — phần dư
  vẫn vào Dự Trữ theo luật thường, trần 3).
- **Trong lượt:** chỉ P gửi Action (`playCard`, `chooseCard`, `endTurn`); Action của
  người kia bị từ chối (`"not your turn"`). Luật đánh lá như `01` §5.
- **Cuối lượt** của P: như `01` §3.3 bước 0–4 cho P (hook `playerTurnEnd`, bỏ Tàn Chiêu,
  Tích Tụ, Dự Trữ, gỡ Đóng Băng của Hero P bị đóng băng trong lượt này). Sau đó: nếu P là
  người đi trước → đầu lượt người đi sau; ngược lại → cuối vòng.
- **Cuối vòng:** tiến Nguyệt Luân, giảm Huyết Nguyệt (`01` §9.4 bước 2–3). Không có bước
  lên chuỗi địch. Rồi đầu lượt người đi trước.
- Pha trăng và Huyết Nguyệt **dùng chung**; hiệu ứng pha áp cho cả hai (lá của cả hai đều
  có tag).

### 4.3 Thời hạn trạng thái

Ở PvE, thời hạn giảm cuối vòng — hợp vì phe địch luôn đi sau. Ở PvP, người đi sau áp
Suy Yếu 1 lên Hero đối thủ sẽ hết ngay cuối vòng, không bao giờ có tác dụng. Vì vậy:

- **PvP:** trạng thái loại "Thời hạn" lưu số **lượt** còn lại = `2 × thời hạn` khi áp
  (áp thêm: cộng `2 × thời hạn`); giảm 1 ở **cuối mỗi lượt** (của bất kỳ người chơi nào).
  Hiển thị số vòng = `ceil(lượt / 2)`.
- Kết quả: trạng thái thời hạn 1 luôn kéo qua đúng một lượt của phía bên kia, bất kể ai
  áp. (Khiêu Khích 1 tự áp trong lượt mình → còn qua lượt đối thủ; Suy Yếu 1 áp lên đối
  thủ → còn trong lượt kế của đối thủ.)
- Trạng thái khác (cộng dồn, vĩnh viễn, dùng một lần, Phản Đòn) giữ nguyên luật `01` §6.
- Đóng Băng: Hero bị Đóng Băng không đánh được lá của mình trong **lượt kế tiếp của chủ
  nó**, gỡ ở cuối lượt đó (như Hero PvE). Không có tác dụng "bỏ chuỗi / Dự Trữ về 0"
  (chỉ dành cho kẻ địch PvE).

### 4.4 Mục tiêu

- `target: "enemy"` = Hero còn sống của đối thủ, không Ẩn Thân; có Hero đối thủ đang
  Khiêu Khích → bắt buộc chọn Hero đó (`01` §6.1: "mọi đòn đơn mục tiêu của phe địch").
- `ally`, `self`, `allAllies`, `allEnemies`: theo người chơi (§2.2).
- Hiệu ứng pha "cho cả hai phe" (Trăng Tròn hồi ×2, Hạ Huyền giáp ×1.5…) áp cho cả hai
  người chơi.

### 4.5 Effect có nghĩa riêng trong PvP

| Effect | PvE | PvP |
|---|---|---|
| `drainMoonPower { amount, to, steal? }` (Tỏa / Đoạt Nguyệt) | Rút quỹ + hủy chiêu từng kẻ địch trong `to` | Rút **Dự Trữ** của **người chơi đối thủ** (một lần, dù `to` gồm mấy Hero): `drained = min(amount, opponent.moonReserve)`. `steal` → quỹ người đánh `+= drained`. Không có chiêu để hủy |
| Bộ đếm `enemiesKilled` (M06) | Kẻ địch ngã | Hero đối thủ ngã (cùng luật "do lá của M06") |
| Hook `enemyKilled` / `heroDied` | Kẻ địch ngã / Hero ngã | Hook của **người kết liễu**: `enemyKilled` khi Hero đối thủ ngã; hook của **người mất Hero**: `heroDied` |
| Hook `moonPhaseEntered`, `bloodMoonStarted` | — | Chạy hook của **cả hai**: người đang có lượt trước, rồi người kia |

Mọi effect khác giữ nguyên nghĩa (đơn vị hành động, `to`, công thức damage `01` §10).

### 4.6 Thắng / thua / hòa

- P thua khi mọi Hero của P ngã, hoặc P Cạn Bài ở đầu lượt của P.
- Cả hai phe cùng hết Hero trong một effect → **người đang có lượt thắng** (tương tự "ưu
  tiên thắng" của `01` §11).
- `round > roundCap` (an toàn, lý thuyết không tới vì Cạn Bài ~16 vòng) → **hòa**.
- Thắng / thua ngoài luật (server quyết, đưa vào state bằng Action hệ thống): **bỏ cuộc**
  (`resign`), **hết giờ `timeoutsToForfeit` lượt liên tiếp**, **mất kết nối quá
  `reconnectSeconds`** (§5.5). Action hệ thống `{ type: "forfeit", player, reason }` chỉ
  server tạo; client gửi thì bị từ chối.

### 4.7 Đồng hồ

- Mỗi lượt `turnSeconds`; hết giờ → server gửi thay người chơi: nếu đang `choosing` →
  `chooseCard` lá đầu tiên trong `options`; rồi `endTurn`. Đổi Bài hết `mulliganSeconds`
  → `mulligan []`.
- Đếm lượt hết giờ **liên tiếp** của mỗi người; một lượt có ít nhất một Action của chính
  người đó thì đặt lại 0.
- Đồng hồ là việc của server (không nằm trong `rules`); Action do hết giờ được ghi vào
  nhật ký như Action thường (§5.6), nên chạy lại trận cho ra đúng kết quả.

### 4.8 Góc nhìn và che thông tin

`viewFor(state, player): CombatState` (hàm thuần, `rules/src/pvp/view.ts`):

| Phần | Người xem thấy |
|---|---|
| Tay, Chiêm Bài của mình | Đầy đủ |
| Tay đối thủ | Số lá; instance id thay bằng `hidden_<n>` (không lộ `cardId`) |
| Chồng rút của cả hai | Chỉ số lá (mảng id giả `hidden_…`, không lộ thứ tự) |
| Chồng bỏ của cả hai | Đầy đủ (lá đã đánh là công khai) |
| Hero, trạng thái, giáp, Nguyệt Lực, Dự Trữ của cả hai | Đầy đủ |
| Trang bị, Nguyệt Bảo của đối thủ | Đầy đủ (công khai từ đầu trận) |
| `rngState` | `0` |

`redactEvents(events, player)`: event lộ lá đối thủ (`cardsDrawn`, `mulliganed`,
`choiceOpened`, `cardChosen`, `deckShuffled`) đổi thành bản chỉ có số lượng; event đánh lá
(`cardPlayed`) giữ nguyên (lá lộ khi đánh). Client nhận `{ events, view }` sau mỗi Action.

### 4.9 Bot PvP và mô phỏng (bước 5b cuối)

- `pvpBot(data, view, player)`: chọn Action chỉ từ **góc nhìn** của nó (không gian lận).
  Dựng từ bot playtest hiện có (`playtest-bot.ts`): coi Hero đối thủ như kẻ địch không có
  chuỗi chiêu.
- `packages/rules/test/pvp-sim.ts` (+ test gắn cờ `PLAYTEST_PVP=1`): mọi tổ hợp 3 Hero
  (10 đội) × 10 đội × N seed, deck Bộ cơ bản, không trang bị; thêm lượt đo có trang bị
  PvP cơ bản.
- **Mục tiêu:**
  - Tỉ lệ thắng người đi trước **47–53%** (chỉnh `secondPlayerBonus`).
  - Số vòng trung vị **8–12** (`12` ràng buộc thiết kế; chỉnh `heroStats`).
  - Tỉ lệ thắng từng Hero (tính trên các đội có Hero đó) **40–60%**.
  - Hòa do `roundCap` < 1%.
- Gói chỉnh số trình người dùng duyệt trước khi áp (như 4d.6, 4e.7); ghi `playtest-notes.md`
  mục 5b.

---

## 5. Kết nối realtime (5c)

### 5.1 Kết nối

- `GET /api/ws` nâng cấp WebSocket (`@fastify/websocket`). Tin nhắn đầu tiên phải là
  `hello { token, dataVersion }` trong 10 giây; sai token → đóng với mã `4401`
  (`unauthorized`); lệch `dataVersion` → `4409` (`outdated client`). Token không đi trong
  URL (không lọt vào log proxy).
- **Một kết nối mỗi tài khoản:** kết nối mới cùng tài khoản đóng kết nối cũ (`4000
  "replaced"`) và nhận lại trận đang chơi (§5.5).
- Server gửi `ping` mỗi 20 giây; client trả `pong`; không trả lời 2 lần → coi là mất kết
  nối.
- Tin nhắn là JSON, tối đa 16 KB; kiểm bằng zod (`realtime/protocol.ts`); sai cấu trúc →
  `error { error: "bad message" }`, không đóng kết nối. Quá 30 tin / giây → đóng `4429`.

### 5.2 Tin nhắn

Client → server:

| Tin | Nội dung | Ghi chú |
|---|---|---|
| `hello` | `{ token, dataVersion }` | Bắt buộc đầu tiên |
| `queue.join` | `{ mode: "ranked" \| "coop", deckId }` | Vào hàng chờ (5d / 6b) |
| `queue.leave` | — | |
| `room.create` | `{ mode: "pvp" \| "coop", deckId }` | Phòng riêng → trả mã |
| `room.join` | `{ code, deckId }` | |
| `room.leave` | — | Chủ phòng rời → hủy phòng |
| `practice.start` | `{ mode: "pvp" \| "coop", deckId }` | Đấu Tập / đồng đội máy (§5.4) |
| `match.action` | `{ matchId, seq, action }` | `seq` = số Action người này đã gửi được chấp nhận + 1 |
| `match.resign` | `{ matchId }` | |
| `match.emote` | `{ matchId, emoteId }` | §7.5 |
| `pong` | — | |

Server → client:

| Tin | Nội dung |
|---|---|
| `welcome` | `{ account: { id, username }, activeMatch?: MatchSnapshot }` |
| `queue.status` | `{ mode, waitingSeconds }` |
| `room.created` / `room.updated` | `{ code, mode, players: { username, ready }[] }` |
| `match.start` | `MatchSnapshot` = `{ matchId, mode, you: number, opponents/partner: { username, rating? }[], view, deadline, eventSeq }` |
| `match.events` | `{ matchId, eventSeq, events, view, deadline }` — sau mỗi Action được chấp nhận (của bất kỳ ai) |
| `match.rejected` | `{ matchId, seq, reason }` — Action bị luật từ chối, state không đổi |
| `match.end` | `{ matchId, result: "won" \| "lost" \| "draw", reason, rating?: { before, after }, rewards?, profileRev? }` |
| `match.emote` | `{ matchId, from, emoteId }` |
| `error` | `{ error }` |
| `ping` | — |

- `eventSeq` tăng dần mỗi lần gửi `match.events`; client thấy lỗ hổng (mất tin) → chờ
  snapshot kế tiếp hoặc kết nối lại.
- `deadline` là thời điểm hết lượt (ms UTC server) để client vẽ đồng hồ; client bù lệch
  giờ bằng `serverTime` gửi kèm `welcome`.

### 5.3 Phòng trận (`match-room.ts`)

- Giữ `state` đầy đủ, nhật ký Action, đồng hồ, kết nối của từng người.
- Nhận `match.action`: kiểm `seq` (trùng → bỏ qua im lặng; nhảy cóc → `rejected "bad
  seq"`), kiểm người gửi có quyền (PvP: đúng lượt; co-op: chưa `done`), rồi `applyAction`.
  Lỗi luật → `match.rejected`. Thành công → ghi nhật ký, gửi mỗi người
  `redactEvents(events, i)` + `viewFor(state, i)`, đặt lại đồng hồ nếu đổi lượt.
- Trận kết thúc (`status` won/lost hoặc `winner`) → ghi bản ghi trận, cập nhật hồ sơ
  (Elo, Vinh Dự, thưởng co-op) trong **một transaction**, gửi `match.end`, xóa phòng khỏi
  bộ nhớ sau 60 giây.
- Mọi Action trong một phòng xử lý tuần tự (Node đơn luồng; không `await` giữa đọc state
  và ghi state).

### 5.4 Đấu Tập và đồng đội máy

- `practice.start`: server tạo phòng với một người chơi máy (`bot-player.ts`) dùng
  `pvpBot` / `coopBot` trên **góc nhìn** của nó. Máy "nghĩ" 600–1200 ms mỗi Action (hẹn
  giờ qua `scheduler`) để người xem theo kịp.
- Deck máy: PvP — một đội ngẫu nhiên (seed của trận) trong 10 đội 3 Hero, Bộ cơ bản,
  trang bị PvP cơ bản ngẫu nhiên; co-op — đội bù Hero người chơi thiếu vai trò (ưu tiên
  Hero không trùng), Bộ cơ bản.
- **Không trao thưởng**, không tính Elo, không tính nhiệm vụ / thành tựu. Bản ghi trận
  vẫn lưu (`mode: "practice"`).

### 5.5 Mất kết nối và kết nối lại

- Mất kết nối giữa trận: phòng giữ nguyên, đồng hồ lượt **vẫn chạy** (hết giờ xử lý như
  §4.7). Người kia nhận `match.events` với event `playerDisconnected`.
- Kết nối lại trong `reconnectSeconds` (tính từ lúc mất): `welcome.activeMatch` mang
  snapshot đầy đủ (góc nhìn + `eventSeq` + `deadline`); client dựng lại màn trận.
- Quá `reconnectSeconds` → Action hệ thống `forfeit { reason: "disconnect" }` (PvP: người
  mất kết nối thua; co-op: xem §8.7).
- Tải lại trang = kết nối lại (token trong `localStorage`).

### 5.6 Lưu trận (SQLite)

**Migration 3:**

| Bảng | Cột |
|---|---|
| `matches` | `id TEXT PK`, `mode TEXT` (`ranked`/`private`/`practice`/`coop`/`coop_private`/`coop_practice`), `data_version TEXT`, `seed INTEGER`, `setup_json TEXT` (loadout + deck mỗi người), `actions_json TEXT` (nhật ký `{ player, action }[]` theo thứ tự áp), `status TEXT` (`playing`/`finished`/`void`), `result_json TEXT`, `created_at`, `finished_at` |
| `match_players` | `match_id → matches`, `account_id → accounts` (null với máy), `slot INTEGER`, `result TEXT`, `rating_before INTEGER`, `rating_after INTEGER`; PK `(match_id, slot)`; chỉ mục `(account_id, match_id)` |

- Ghi `matches` khi trận bắt đầu (`playing`) và khi kết thúc (`finished`). Server khởi
  động: mọi trận `playing` → `void` (không Elo, không thưởng).
- `replayMatch(data, setup, actions)` (hàm thuần) dựng lại trận để debug và cho test
  (T237). Client chưa có màn xem lại.

### 5.7 Route HTTP mới

| Route | Kết quả |
|---|---|
| `GET /api/arena/me` | `{ rating, tier, wins, losses, draws, honorToday }` |
| `GET /api/arena/history?page=` | 20 trận gần nhất: `{ matchId, mode, opponent, result, ratingDelta, createdAt }[]` |
| `GET /api/arena/leaderboard` | Top 50 theo Điểm Đấu Trường (≥ 5 trận xếp hạng) |
| `POST /api/shop/honor/:itemId/buy` | `buyHonorItem` (§6.4) → `{ profile, rev }`, cần `If-Match` |
| `GET /api/coop/me` | `{ clearsToday, rewardClaimsLeft }` (6b) |

---

## 6. Hàng chờ và phòng (5d)

### 6.1 Hàng chờ xếp hạng

- Vào hàng chờ cần deck hợp lệ PvP (`validateDeck` chế độ pvp; lỗi → `error "invalid
  deck"` kèm `errors`). Không vào được khi đang ở phòng / trận khác.
- Mỗi giây ghép cặp: cặp có chênh Điểm Đấu Trường nhỏ nhất trong khoảng cho phép; khoảng
  = `±100 + 50 × (số giây chờ của người chờ lâu hơn / 10)`. Không ghép lại cùng đối thủ
  của 2 trận xếp hạng gần nhất trong 10 phút (tránh cày điểm hai tài khoản).
- Chờ quá 90 giây: client gợi ý Đấu Tập (người chơi vẫn ở hàng chờ tới khi tự rời).

### 6.2 Phòng riêng

- Mã 6 ký tự `[A-Z2-9]` (bỏ chữ dễ nhầm), sống 10 phút khi chưa đủ người. Trận Phòng
  riêng **không** tính Elo, **không** trao Vinh Dự / thưởng (tránh tự đấu hai tài khoản
  để lấy thưởng), có tính vào lịch sử.
- PvP: hai người đủ và cả hai có deck hợp lệ → bắt đầu. Co-op: như trên, 2 người.

### 6.3 Điểm Đấu Trường (Elo) — `rules/src/meta/rating.ts`

- `profile.arena = { rating: 1000, wins: 0, losses: 0, draws: 0, rankedGames: 0 }` (hồ sơ
  thêm trường, `parseProfile` điền mặc định cho hồ sơ cũ).
- `ratingChange(a, b, score)` với `score` 1 / 0.5 / 0: `expected = 1 / (1 + 10^((b − a) /
  400))`, `delta = round(K × (score − expected))`; `K = 40` khi `rankedGames < 10`, sau đó
  `24`. Điểm không dưới 0. Hàm thuần; server gọi cho cả hai người trong một transaction.
- **Bậc** (chỉ hiển thị, theo `pvp-config.tiers`, tên theo khoa cử của Thư Viện — đề
  xuất, chờ duyệt ở §12):

| Điểm | Bậc |
|---|---|
| < 1100 | Đồng Sinh |
| 1100–1249 | Tú Tài |
| 1250–1399 | Cử Nhân |
| 1400–1599 | Tiến Sĩ |
| ≥ 1600 | Trạng Nguyên |

### 6.4 Vinh Dự và Cửa hàng Vinh Dự — `rules/src/meta/honor.ts`

- `currencies.honor` (Vinh Dự). Trận xếp hạng: thắng **+20**, thua **+8**, hòa **+12**;
  tối đa **120 Vinh Dự / kỳ ngày** (`dayKey`, `14` §6); vượt trần → trận vẫn tính Elo,
  không thêm Vinh Dự. Bỏ cuộc / thua do mất kết nối trước vòng 3 → 0 Vinh Dự.
- `applyPvpResult(data, profile, { result, now, ratingDelta })` cập nhật `arena` và
  `honor`, ghi tiến độ nhiệm vụ (nếu có nhiệm vụ PvP, §12).
- Cửa hàng Vinh Dự (`pvp-config.honorShop`, giới hạn theo kỳ tuần như cửa hàng Nguyệt Tinh):

| Món | Giá | Giới hạn |
|---|---|---|
| 160 Nguyệt Ngọc (1 lượt quay) | 150 Vinh Dự | 2 / tuần |
| Vé chọn Hero Epic | 600 Vinh Dự | 1 / tháng |
| Vé chọn Nguyệt Bảo Rare (chọn 1 trong các Nguyệt Bảo Rare) | 250 Vinh Dự | 1 / tuần |

  Nhịp đề xuất: người chơi PvP đều đặn (~6 trận/ngày, thắng 50%) ≈ 84 Vinh Dự/ngày ≈
  1 lượt quay mỗi 2 ngày — **không** vượt nhịp thưởng PvE (gói J). Số khởi điểm, đo bằng
  mô phỏng kinh tế (thêm một kiểu người chơi PvP vào `economy-sim.ts`).
- Vé chọn Nguyệt Bảo đi qua `grantItem` (trùng → Cộng Minh +1 như gacha).

---

## 7. Client PvP (5d)

### 7.1 Sảnh Đấu Trường

- Nút mới "Đấu Trường" ở màn chính (`deck-select`). Sảnh: Điểm + bậc, thắng/thua, Vinh Dự
  hôm nay (x/120), chọn deck (chỉ deck hợp lệ PvP; lỗi hiện như xếp deck), các nút
  **Xếp hạng**, **Phòng riêng** (tạo / nhập mã), **Đấu Tập**, **Lịch sử**, **Bảng xếp
  hạng**, **Cửa hàng Vinh Dự**.
- Đang chờ: đồng hồ chờ, nút hủy; quá 90 giây gợi ý Đấu Tập.
- Offline (không kết nối được server): nút Đấu Trường khóa.

### 7.2 Xếp deck PvP

- Màn xếp deck thêm công tắc **"Xem theo luật PvP"**: Hero thử hiện với nhãn "Thử", vũ
  khí / Nguyệt Bảo PvP cơ bản hiện với nhãn "PvP", mọi cấp hiện R1 / CM1, lỗi deck theo
  chế độ pvp. Deck lưu chung danh sách với deck PvE.

### 7.3 Màn trận mạng

- Dùng renderer trận hiện có, dựng từ `view`. Phe đối thủ vẽ ở chỗ kẻ địch (3 Hero đối
  thủ + trang bị), tay đối thủ là mặt sau lá (số lá), không có chuỗi chiêu. Dải trên: tên,
  bậc, Nguyệt Lực + Dự Trữ của đối thủ.
- Đồng hồ lượt (vòng tròn quanh nút Kết Thúc Lượt); 10 giây cuối đổi màu. Lượt đối thủ:
  nút khóa, chữ "Lượt đối thủ".
- Animation: phát `events` theo thứ tự như PvE; khi đang phát animation mà có tin mới thì
  xếp hàng.
- Mất kết nối: lớp phủ "Đang kết nối lại…", tự thử lại (1, 2, 4, 8… tối đa 15 giây).
- Kết thúc: bảng kết quả (thắng/thua, lý do, Điểm trước → sau, Vinh Dự), nút Về sảnh.

### 7.4 Cửa hàng Vinh Dự, lịch sử, bảng xếp hạng

- Cửa hàng: như cửa hàng Nguyệt Tinh (`shop` scene) — tab mới. Lịch sử: 20 trận / trang.
  Bảng xếp hạng: top 50, dòng của mình tô sáng.

### 7.5 Biểu cảm

- 6 câu cố định trong dữ liệu (`pvp-config.emotes`, ví dụ "Chào đạo hữu", "Hay lắm",
  "Đa tạ chỉ giáo"…), tối đa 1 lần / 3 giây; có nút tắt biểu cảm của đối thủ. Không chat tự do.

---

## 8. Phần 6a — Co-op (Liên Thủ): luật trận

Tên chế độ đề xuất: **Liên Thủ** (chờ duyệt, §12). GDD: `00` §8.3.

### 8.1 Thiết lập

- 2 người chơi, mỗi người **3 Hero + deck + trang bị + Nguyệt Bảo** của mình, **sức mạnh
  đầy đủ** (Tinh Hồn mọi cấp, R5, Cộng Minh 5) — loadout như PvE (`buildLoadout`).
- 6 Hero cùng một phe, vị trí 0–2 (người 0) và 3–5 (người 1). Hai người được chọn trùng
  Hero (unit id có tiền tố).
- Đánh **một encounter co-op** (6a: Boss Nguyệt Thực, §8.6). Không có lượt chơi roguelike
  co-op.
- HP Hero theo `heroes.json` (không bảng riêng).

### 8.2 State riêng co-op

`mode: "coop"`, `players[0..1]`, `heroes` 6 Hero, `enemies` = boss (+ phần sau nếu có).
Thêm:
- `comboUsed: Record<comboId, number>` — số lần mỗi Hợp Kích đã dùng (vòng này / trận).
- `playedThisTurn: { player, instanceId, cardId }[]` — lá đã đánh trong lượt đồng đội này
  (để dò Hợp Kích), xóa đầu mỗi lượt.
- `boss: { phase: 1 | 2 | 3 | 4, reviveCountdown: number | null, revived: boolean }`.

### 8.3 Lượt đồng thời

Một vòng: **lượt đồng đội** (cả hai cùng đánh) → lượt kẻ địch → cuối vòng.

1. **Đầu lượt đồng đội:** các bước `01` §3.1 cho **cả 6 Hero** theo vị trí 0 → 5 (xóa
   giáp, bộ đếm, Thiêu Đốt / Hồi Phục, Huyết Nguyệt); kiểm tra thắng/thua; rồi với từng
   người chơi 0 → 1: Nguyệt Lực, rút bù, Cạn Bài (§8.7), hook `playerTurnStart` của người đó.
   `done = false` cho cả hai; `playedThisTurn = []`.
2. **Trong lượt:** **cả hai** gửi Action bất kỳ lúc nào; server áp **theo thứ tự nhận**,
   mỗi Action đầy đủ và nguyên tử (Chiêm Bài chỉ khóa người đang chọn). `endTurn` của một
   người = **Xong** (`done = true`): người đó không đánh thêm; lá trên tay vẫn giữ.
3. Khi **cả hai `done`**, hoặc hết `coop-config.turnSeconds` (45 giây; server gửi `endTurn`
   thay người chưa xong, `chooseCard` đầu tiên nếu đang chọn): cuối lượt `01` §3.3 cho
   người 0 rồi người 1.
4. **Lượt kẻ địch** (`01` §9.3) với mục tiêu trong 6 Hero; `allEnemies` từ phía địch trúng
   cả 6 Hero. **Cuối vòng** (`01` §9.4) + bước boss (§8.6).

- Thứ tự áp phụ thuộc thứ tự nhận → không tất định giữa hai lần chơi, nhưng **nhật ký**
  ghi đúng thứ tự áp nên chạy lại vẫn tất định.
- Client của mỗi người nhận event của cả hai (gồm lá đồng đội đánh) để phối hợp.

### 8.4 Đồng đội, mục tiêu, bộ đếm

| Khái niệm | Co-op |
|---|---|
| `target: "ally"` | Bất kỳ Hero còn sống trong **6** Hero (hồi máu, giáp cho đồng đội) |
| `allAllies`, hook `each`, `lowestHp`, `front` | 3 Hero của **chính người chơi** đó (giữ cân bằng lá AoE; Hợp Kích là ngoại lệ, §8.5) |
| `enemy`, `allEnemies` | Kẻ địch (như PvE) |
| F04 `turnsWithAllyRegen`, `regenSpreadsToAllAllies` | Theo 3 Hero của người chơi F04 |
| Tay, Nguyệt Lực, Dự Trữ, Dưỡng Nguyệt, Liên Hoàn, Tích Tụ | Riêng mỗi người |
| Tỏa / Đoạt Nguyệt | Như PvE; Đoạt → quỹ của người đánh |
| Pha trăng, Huyết Nguyệt, Đổi Vận | **Dùng chung** (Đổi Vận của một người đổi pha cho cả hai) |
| Hook trang bị | Của người sở hữu trang bị; trigger theo sự kiện của người đó (`enemyKilled`: người có Hero kết liễu) |

### 8.5 Hợp Kích — `coop-combos.json`

```ts
interface CoopComboDef {
  id: string; name: string; text: string;
  parts: [CardMatcher, CardMatcher];  // một lá của mỗi người, thứ tự không quan trọng
  limit: { perRound: 1; perCombat?: number };
  effects: Effect[];                  // đơn vị hành động: Hero đánh lá hoàn thành Hợp Kích
}
interface CardMatcher {
  tag?: CardTag; ownerId?: string;        // Hero (defId) sở hữu lá
  appliesStatus?: StatusId;               // lá có effect applyStatus status này (kể cả trong conditional)
  effect?: EffectType;                    // lá có effect loại này
  moonPhaseAfter?: MoonPhaseId;           // sau khi lá giải quyết, pha hiện tại là pha này
}
```

- **Kích hoạt:** ngay sau khi một lá của người A giải quyết xong (sau hook `cardPlayed`,
  trước khi vào chồng bỏ — cùng chỗ với `01` §5.2.4b), nếu lá đó khớp một `part` và
  `playedThisTurn` có lá của **người B** khớp `part` còn lại, và chưa quá `limit` → chạy
  `effects`, event `coopComboTriggered { comboId, cardIds }` trước event của effect. Mỗi lá
  chỉ dùng cho tối đa một Hợp Kích; nhiều Hợp Kích khớp cùng lúc → theo thứ tự trong file.
- Trong `effects` của Hợp Kích, `allAllies` = **cả 6 Hero**; được dùng effect mới
  `execute { threshold, to }`: kẻ địch trong `to` có `hp ≤ floor(maxHp × threshold)` ngã
  ngay (không qua giáp; `killerId` = đơn vị hành động; tính `enemiesKilled`).
- Hợp Kích không phải lá: không tính Liên Hoàn, không kích hoạt hook `cardPlayed`, không
  cộng Sức Mạnh / Tích Lực (như `01` §13.4).

Nội dung (theo GDD, ánh xạ vào dữ liệu hiện có — số khởi điểm):

| Hợp Kích | Người A | Người B | Hiệu ứng | Giới hạn |
|---|---|---|---|---|
| *Băng Nguyệt Kế* | Lá tag `scheme` (Mưu Lược) | Lá của F03 áp `freeze` | Đóng Băng mọi kẻ địch (boss: bỏ cả chuỗi vòng này, `01` §9.3) | 1 / vòng, 1 / trận |
| *Ám Ảnh Tuyệt Sát* | Lá của M06 áp `stealth` | Lá của F02 áp debuff (`weak`/`vulnerable`/`mark`/`burn`) | `execute { threshold: 0.25, to: "allEnemies" }`; không ai ngã → 8 damage lên mọi kẻ địch | 1 / vòng |
| *Nguyệt Quang Phổ Chiếu* | Lá `shiftMoon` làm pha thành Trăng Tròn (`moonPhaseAfter: "full"`) | Lá có effect `heal` | Hồi 6 HP cho cả 6 Hero (Trăng Tròn ×2 → 12) | 1 / vòng |

*Ghi chú:* GDD ghi "Lá Mưu Lược (Thanh Loan)"; hiện chưa có Hero Thanh Loan, lá `scheme`
đang thuộc F02 — Hợp Kích dùng tag nên tự áp dụng cho Hero Thanh Loan sau này.

### 8.6 Boss Nguyệt Thực

Dữ liệu: `enemies.json` thêm `eclipse_lord` (tên đề xuất: *Nguyệt Thực Ma Quân*) với
trường mới `phases` (schema `02`); `encounters.json` thêm `enc_coop_01`, `tier: "coop"`.

```ts
interface BossPhaseDef {
  hpBelow: number;              // tỉ lệ HP để vào giai đoạn (1 cho giai đoạn 1)
  intents: EnemyIntentDef[];    // thay bộ chiêu từ lần lên chuỗi kế tiếp
  maxIntentsPerRound?: number;  // ghi đè combatConfig (boss co-op đánh nhiều chiêu hơn)
  onEnter?: Effect[];           // chạy ngay khi vào giai đoạn (đơn vị hành động: boss)
  bloodMoonWhileActive?: true;  // giai đoạn 2
  reviveAfterRounds?: number;   // giai đoạn 4
}
```

| Giai đoạn | Vào khi | Luật |
|---|---|---|
| 1 — Trăng Khuyết | Đầu trận | Bộ chiêu thường; `maxIntentsPerRound` 4 |
| 2 — Huyết Nguyệt | HP ≤ 75% | `onEnter`: Sức Mạnh 2. **Huyết Nguyệt liên tục** khi còn ở giai đoạn 2 (`bloodMoonRounds` không giảm dưới 1; lá Cấm Thuật đánh được; Hero mất HP đầu lượt như `01` §7.4). Rời giai đoạn → giảm bình thường |
| 3 — Nguyệt Ấn | HP ≤ 50% | Mỗi chuỗi có chiêu *Thực Nguyệt Trảm* (18 damage, `targeting: random`) nhắm **một Hero** — hiện rõ ở ý định; đồng đội bảo vệ bằng Khiêu Khích (đổi mục tiêu, `01` §9.3.1), giáp lên Hero đó (`ally`), hoặc Ẩn Thân |
| 4 — Nguyệt Thực | HP ≤ 25% | `reviveCountdown = 2`. Cuối mỗi vòng −1; về 0 khi boss còn sống → **hồi sinh một lần**: hồi tới 50% HP, gỡ mọi debuff, quay lại giai đoạn 3 (`revived = true`, không vào lại giai đoạn 4 lần hai — lần sau HP ≤ 25% chỉ đổi bộ chiêu, không đếm ngược) |

- **Đổi giai đoạn:** kiểm sau mỗi effect (như thăng cấp); damage vượt ngưỡng không mất.
  Mỗi lần chỉ lên một giai đoạn; nhiều ngưỡng trong một đòn → vào lần lượt, chạy `onEnter`
  theo thứ tự. Event `bossPhaseChanged { enemyId, phase }`. Chuỗi đã lên **không** đổi
  (bộ chiêu mới áp từ lần lên chuỗi kế tiếp), trừ Huyết Nguyệt có hiệu lực ngay.
- HP boss khởi điểm ~ 2.2 × boss PvE (`moon_ape` 94) ≈ **210**; Nguyệt Lực `start 4, cap
  12`. Chiêu cụ thể soạn ở `03` bước 6a.1 (Claude soạn, người dùng duyệt), chỉ dùng effect
  đã có + `execute` không dùng cho địch.

### 8.7 Thắng / thua co-op

- **Thắng:** mọi kẻ địch ngã (boss hồi sinh một lần không tính là ngã khi đang đếm ngược —
  boss ngã trước khi đếm ngược về 0 là thắng).
- **Thua:** cả 6 Hero ngã.
- **Cạn Bài của một người:** đầu lượt đồng đội, người đó hết tay và chồng → 3 Hero của
  người đó **ngã** (event `deckedOut { player }`), đồng đội đánh tiếp.
- **Bỏ cuộc / mất kết nối quá hạn** của một người: Hero của người đó **ngã**; người còn
  lại đánh tiếp một mình (có thể thắng; thưởng như thường). Cả hai rời → trận `void`.

### 8.8 Bot co-op và mô phỏng

- `coopBot(data, view, player)`: bot playtest + ưu tiên hoàn thành Hợp Kích khi đồng
  đội đã đánh lá khớp; ưu tiên bảo vệ Hero bị *Thực Nguyệt Trảm* nhắm.
- `packages/rules/test/coop-sim.ts` (cờ `PLAYTEST_COOP=1`): 2 bot, mọi cặp đội, Bộ cơ
  bản, không trang bị và có trang bị R1.
- **Mục tiêu:** tỉ lệ thắng Bộ cơ bản không trang bị **35–50%**; có trang bị R5 + Tinh Hồn
  6 ≤ 85%; số vòng trung vị **10–14**; mỗi Hợp Kích được kích hoạt ở ≥ 30% trận có đủ điều
  kiện đội hình; boss vào giai đoạn 4 ở ≥ 60% trận thắng.

---

## 9. Phần 6b — Co-op trên server, thưởng, client

### 9.1 Phòng co-op

- Dùng lại khung phòng (§5.3) với `coop-room.ts`: chấp nhận Action của **cả hai** người
  trong lượt đồng đội (người đã `done` bị từ chối `"already done"`); đồng hồ lượt đồng đội
  45 giây; góc nhìn co-op: thấy **tay đồng đội** (hợp tác, không cần che), không thấy thứ
  tự chồng rút / `rngState`.
- Hàng chờ co-op: ghép 2 người bất kỳ theo thứ tự vào; Phòng riêng co-op; đồng đội máy
  (§5.4).

### 9.2 Thưởng co-op — `rules/src/meta/coop-rewards.ts`

`coop-config.json`:

```json
{
  "turnSeconds": 45,
  "rewards": { "win": { "moonJade": 40, "moonDust": 3 }, "loss": { "moonJade": 10, "moonDust": 1 },
               "firstWinOfDay": { "moonJade": 40 } },
  "rewardedMatchesPerDay": 3
}
```

- Trận co-op qua hàng chờ (không phải Phòng riêng, không phải đồng đội máy) trao thưởng
  cho **mỗi** người; tối đa `rewardedMatchesPerDay` trận có thưởng mỗi kỳ ngày; trận sau
  đó vẫn chơi được, không thưởng.
- Bị xử thua do bỏ cuộc / mất kết nối → không thưởng. Người còn lại thắng một mình → thưởng
  thắng.
- Nguyệt Trần hiện chỉ tích trữ (`14` §13.1) — đề xuất chỗ tiêu ở §12.
- Số khởi điểm, đo bằng `economy-sim.ts` (thêm người chơi co-op 1 trận/ngày): tổng Nguyệt
  Ngọc / ngày không vượt quá +20% so với người chơi chỉ PvE (gói J).

### 9.3 Client co-op

- Nút "Liên Thủ" ở màn chính; sảnh như Đấu Trường (hàng chờ, Phòng riêng, đồng đội máy,
  lượt thưởng còn lại hôm nay).
- Màn trận: 6 Hero ở hàng dưới (3 của mình bên trái, 3 đồng đội bên phải, khung màu khác),
  boss ở trên với thanh HP chia 4 mốc giai đoạn và đồng hồ hồi sinh ở giai đoạn 4. Tay
  đồng đội thu nhỏ phía trên tay mình (xem, không đánh). Nguyệt Lực của cả hai.
- Nút **Xong** (thay Kết Thúc Lượt) + trạng thái "Đồng đội: đang đánh / đã xong"; đồng hồ
  45 giây chung.
- Lá của mình khớp một nửa Hợp Kích mà đồng đội đã đánh nửa kia trong lượt → viền sáng
  và dòng gợi ý trong tooltip. Hợp Kích kích hoạt → banner tên Hợp Kích + animation.
- Biểu cảm co-op (`coop-config.emotes`: "Ta lo boss", "Cứu ta", "Chờ ta Đổi Vận"…).

---

## 10. Phần 5e — Triển khai Internet

- **Cấu trúc:** một máy chủ (VPS) chạy `node apps/server/dist/main.js` (systemd hoặc
  Docker), **Caddy** trước mặt: HTTPS tự động (Let's Encrypt), phục vụ file tĩnh của
  `apps/client/dist`, chuyển `/api/*` (gồm WebSocket `/api/ws`) tới `127.0.0.1:8787`.
  Chọn nhà cung cấp VPS ở bước 5e (hỏi người dùng); SQLite cần ổ đĩa bền nên chỉ một máy.
- **Server:** biến môi trường mới `NODE_ENV=production`, `TRUST_PROXY=1` (lấy IP thật từ
  `X-Forwarded-For` của Caddy), `ALLOWED_ORIGINS` (kiểm `Origin` khi nâng cấp WebSocket và
  với route đổi hồ sơ), `BACKUP_DIR`.
- **Giới hạn tần suất** (viết tay, trong bộ nhớ, theo IP): đăng ký 5 / giờ, đăng nhập 20 /
  phút (ngoài khóa tài khoản sẵn có), WebSocket 30 tin / giây mỗi kết nối, 3 kết nối / IP
  trong 10 giây.
- **Sao lưu:** `db.backup()` của better-sqlite3 mỗi 6 giờ vào `BACKUP_DIR`, giữ 14 bản;
  script khôi phục trong `apps/server/README`.
- **Log:** Fastify logger dạng JSON ra stdout (không log token, mật khẩu, body tin nhắn
  trận).
- **Build client production:** `VITE_API_BASE` rỗng (cùng origin); client tự chọn `wss://`
  khi trang chạy `https://`.
- **Kiểm tra sau triển khai:** `GET /api/health`; đăng ký 2 tài khoản từ 2 mạng khác nhau,
  đánh một trận xếp hạng và một trận co-op đồng đội máy.
- Tài liệu vận hành (lệnh cài, cấu hình Caddy mẫu, systemd unit, sao lưu / khôi phục) vào
  `16` §7 mới; file cấu hình mẫu trong `deploy/` (không chứa bí mật).

---

## 11. Test

Mã test tiếp theo sau T212.

| Mã | Phần | Kịch bản |
|---|---|---|
| T213 | 5a | Bộ ghi vàng: 200 trận / lượt chơi bot PvE, event và state cuối khớp bản ghi trước khi đổi |
| T214 | 5a | Phiếu lượt chơi GĐ 4c/4d/4e (mẫu trong test) chạy lại ra đúng `result` cũ |
| T215 | 5a | Hai người chơi cùng Hero: unit id / instance id có tiền tố, không va chạm |
| T216 | 5b | `createPvpCombat`: người đi trước từ RNG; cùng seed → cùng người đi trước và cùng tay |
| T217 | 5b | Đổi Bài hai người, thứ tự nhận khác nhau → RNG khác, chạy lại theo nhật ký ra giống |
| T218 | 5b | Lượt luân phiên: Action sai lượt bị từ chối `"not your turn"`; đầu lượt chỉ xóa giáp Hero của người đó |
| T219 | 5b | Bù người đi sau: lượt đầu của người đi sau có quỹ `base(1) + 1` |
| T220 | 5b | Thời hạn PvP: Suy Yếu 1 người đi sau áp lên đối thủ còn tác dụng trong lượt kế của đối thủ, hết sau lượt đó |
| T221 | 5b | Khiêu Khích 1 tự áp còn qua lượt đối thủ; Đóng Băng khóa lượt kế của chủ, gỡ cuối lượt đó |
| T222 | 5b | Tỏa / Đoạt Nguyệt PvP rút Dự Trữ đối thủ một lần dù `allEnemies` |
| T223 | 5b | M06 `enemiesKilled` tính Hero đối thủ; hook `enemyKilled` của người kết liễu, `heroDied` của người mất Hero |
| T224 | 5b | Thắng khi mọi Hero đối thủ ngã; cả hai phe cùng hết → người đang có lượt thắng; Cạn Bài thua |
| T225 | 5b | `forfeit` chỉ nhận từ server; bỏ cuộc → đối thủ thắng |
| T226 | 5b | `buildPvpLoadout`: Tinh Hồn 4 → 3, 6 → 5; vũ khí R5 → R1; Nguyệt Bảo CM5 → CM1; không có lá "+" và ngưỡng cấp 2 |
| T227 | 5b | `validateDeck` pvp: Hero thử + lá khởi đầu hợp lệ; trang bị PvP cơ bản không sở hữu hợp lệ; trang bị khác không sở hữu → lỗi |
| T228 | 5b | `viewFor`: không lộ `cardId` tay đối thủ, thứ tự chồng rút, `rngState`; giữ đủ phần của người xem |
| T229 | 5b | `redactEvents`: `cardsDrawn` của đối thủ chỉ còn số lượng; `cardPlayed` giữ nguyên |
| T230 | 5b | `pvpBot` chỉ đọc góc nhìn (chạy trên `viewFor` ra Action hợp lệ ở state thật) |
| T231 | 5c | `hello` sai token → đóng 4401; lệch `dataVersion` → 4409; tin sai cấu trúc → `bad message` |
| T232 | 5c | Phòng riêng PvP qua `injectWS`: hai kết nối, đánh hết trận bằng bot, cả hai nhận `match.end` đúng kết quả |
| T233 | 5c | `seq` trùng bị bỏ qua, `seq` nhảy cóc bị từ chối |
| T234 | 5c | Hết giờ (scheduler giả): tự `endTurn`; 3 lượt liên tiếp → xử thua |
| T235 | 5c | Mất kết nối: kết nối lại trong hạn nhận snapshot; quá hạn → xử thua |
| T236 | 5c | Kết nối thứ hai cùng tài khoản thay kết nối đầu (`4000 replaced`) |
| T237 | 5c | `replayMatch(setup, actions)` từ bản ghi DB ra đúng kết quả đã lưu |
| T238 | 5c | Khởi động lại server: trận `playing` thành `void`, không Elo |
| T239 | 5c | Đấu Tập: trận với máy chạy hết, không Elo, không Vinh Dự |
| T240 | 5d | `ratingChange`: cùng điểm thắng +20 (K 40), +12 (K 24); điểm không âm |
| T241 | 5d | Hàng chờ: ghép chênh điểm nhỏ nhất; khoảng nới theo thời gian chờ; không ghép lại đối thủ gần nhất |
| T242 | 5d | Vinh Dự: thắng/thua/hòa; trần 120 / kỳ ngày; bỏ cuộc trước vòng 3 → 0 |
| T243 | 5d | Cửa hàng Vinh Dự: giá, giới hạn tuần / tháng, vé Nguyệt Bảo qua `grantItem` |
| T244 | 5d | Trận xếp hạng qua server: Elo hai người cập nhật trong một transaction; Phòng riêng không đổi Elo |
| T245 | 5e | Giới hạn tần suất đăng ký / đăng nhập theo IP (`TRUST_PROXY`); `Origin` lạ bị từ chối nâng cấp WebSocket |
| T246 | 6a | `createCoopCombat`: 6 Hero vị trí 0–5, chồng bài / Nguyệt Lực riêng, pha trăng chung |
| T247 | 6a | Lượt đồng thời: Action của hai người xen kẽ đều được áp; người đã Xong bị từ chối; cả hai Xong → lượt địch |
| T248 | 6a | `ally` chọn Hero đồng đội; `allAllies` chỉ 3 Hero của người đánh |
| T249 | 6a | Đổi Vận của người A đổi pha cho người B ngay trong lượt |
| T250 | 6a | Chiêu địch chọn mục tiêu trong 6 Hero; Khiêu Khích của Hero người B đổi mục tiêu chiêu nhắm Hero người A |
| T251 | 6a | Hợp Kích *Băng Nguyệt Kế*: A đánh lá `scheme`, B đánh lá F03 áp `freeze` → mọi kẻ địch Đóng Băng; lần 2 trong trận không kích hoạt |
| T252 | 6a | Hợp Kích không kích hoạt khi cả hai lá cùng một người; mỗi lá chỉ dùng cho một Hợp Kích |
| T253 | 6a | *Ám Ảnh Tuyệt Sát*: địch ≤ 25% HP ngã (`execute`), không ai đủ ngưỡng → 8 damage |
| T254 | 6a | *Nguyệt Quang Phổ Chiếu*: hồi cho cả 6 Hero, Trăng Tròn ×2 |
| T255 | 6a | Boss: vào giai đoạn 2 ở 75% (Sức Mạnh, Huyết Nguyệt không giảm dưới 1); rời giai đoạn 2 → Huyết Nguyệt giảm bình thường |
| T256 | 6a | Boss: một đòn vượt hai ngưỡng → vào lần lượt, `onEnter` đúng thứ tự |
| T257 | 6a | Boss giai đoạn 4: sau 2 vòng còn sống → hồi 50%, về giai đoạn 3; lần sau ≤ 25% không đếm ngược |
| T258 | 6a | Cạn Bài của một người → 3 Hero người đó ngã, đồng đội đánh tiếp |
| T259 | 6a | Hết giờ lượt đồng đội: server gửi `endTurn` thay người chưa Xong |
| T260 | 6b | Phòng co-op qua `injectWS`: 2 kết nối, đánh hết trận bằng bot, thưởng mỗi người, trần 3 trận / ngày |
| T261 | 6b | Co-op: một người bỏ cuộc → Hero người đó ngã, người còn lại thắng một mình được thưởng; người bỏ cuộc không thưởng |
| T262 | 6b | Góc nhìn co-op thấy tay đồng đội, không thấy chồng rút / `rngState` |

---

## 12. Điểm cần duyệt

1. **Thư viện:** `@fastify/websocket` (+ `ws`, `@types/ws`). Không thêm gì khác (Caddy chạy
   ngoài repo khi triển khai).
2. **Làm lại state (5a) trước PvP**, với bộ ghi vàng bảo đảm PvE không đổi. Phương án khác
   (dựng PvP như một lớp bọc quanh state PvE, coi Hero đối thủ là "kẻ địch") rẻ hơn lúc đầu
   nhưng hỏng nội tại / bộ đếm của Hero phía phòng thủ và không dùng được cho co-op.
3. **PvP luân phiên** (không đồng thời như co-op), người đi trước bốc RNG, **bù người đi
   sau +1 Nguyệt Lực lượt đầu** (chỉnh bằng mô phỏng).
4. **Thời hạn trạng thái PvP tính theo lượt** (`2 × thời hạn`, giảm cuối mỗi lượt) — khác
   PvE; không đổi PvE.
5. **Tỏa / Đoạt Nguyệt trong PvP** rút Dự Trữ của đối thủ (một lần mỗi effect).
6. **Hero thử = cả 5 Hero** (chỉ 6 lá khởi đầu nếu chưa sở hữu). **Trang bị PvP cơ bản =
   4 vũ khí Rare + 3 Nguyệt Bảo Rare**. Đề xuất khác: cho dùng **mọi** vũ khí / Nguyệt Bảo
   ở R1 / CM1 (công bằng tuyệt đối, gacha trang bị không ảnh hưởng PvP).
7. **HP PvP khởi điểm ≈ PvE × 1.3**, chỉnh bằng mô phỏng tới 8–12 vòng.
8. **Elo K 40 / 24, bậc theo khoa cử** (Đồng Sinh → Trạng Nguyên). Chưa có mùa giải.
9. **Vinh Dự:** 20 / 8 / 12 mỗi trận xếp hạng, trần 120 / ngày; cửa hàng 3 món (§6.4).
   Phòng riêng và Đấu Tập không thưởng.
10. **Tên chế độ co-op "Liên Thủ"**, boss *Nguyệt Thực Ma Quân*.
11. **Co-op: `ally` chọn được Hero đồng đội; `allAllies` chỉ 3 Hero của mình** (Hợp Kích
    mới trúng cả 6).
12. **Boss giai đoạn 4:** đọc GDD "tự hồi sinh 1 lần nếu không bị kết liễu trong 2 lượt"
    là **đếm ngược 2 vòng từ khi vào giai đoạn 4; hết giờ mà boss còn sống → hồi 50% HP,
    về giai đoạn 3, một lần**. Cách hiểu khác: boss ngã ở giai đoạn 4 thì sống lại một lần
    trừ khi bị Hợp Kích kết liễu.
13. **Giai đoạn 3** dùng cơ chế sẵn có (chiêu mạnh nhắm một Hero, bảo vệ bằng Khiêu Khích /
    giáp / Ẩn Thân) thay vì trạng thái "đánh dấu" mới.
14. **Cạn Bài / bỏ cuộc của một người trong co-op** → chỉ Hero người đó ngã, đồng đội đánh
    tiếp.
15. **Thưởng co-op** 40 NN + 3 Nguyệt Trần thắng, 10 + 1 thua, +40 thắng đầu ngày, 3 trận có
    thưởng / ngày.
16. **Chỗ tiêu Nguyệt Trần / Huyền Thiết** (GDD: nâng Nguyệt Bảo / vũ khí): đề xuất để
    **sau GĐ 6** (bước riêng: đổi vật liệu lấy +1 Cộng Minh / Tinh Luyện, giá theo độ hiếm).
    Trong GĐ 6, Nguyệt Trần từ co-op vẫn chỉ tích trữ. Hoặc làm luôn ở 6b.
17. **Nhiệm vụ PvP / co-op:** đề xuất thay 1 nhiệm vụ tuần hiện có bằng "Đánh 3 trận Đấu
    Trường hoặc Liên Thủ" (không tăng tổng Nguyệt Ngọc). Hoặc chưa thêm.
18. **Triển khai:** VPS + Caddy + systemd, một máy, SQLite; nhà cung cấp chọn ở bước 5e.
19. **Thứ tự:** PvP (5a–5e) trước co-op (6a–6b) như GDD; triển khai (5e) trước co-op để
    PvP chơi được với bạn bè sớm.

---

## 13. Tài liệu cần cập nhật

| Bước | Tài liệu |
|---|---|
| 5a.1 | `02` (PlayerState, `CombatState.mode/players`), `01` §1 (thành phần theo người chơi), `06` T213–T215, `07` GĐ 5, `CLAUDE.md` giai đoạn 5 + thư viện đã duyệt |
| 5b.1 | `01` §15 (PvP: §4 ở đây), `14` §3.1 (deck pvp), §12 (`buildPvpLoadout`), `02` (`pvp-config`), `04` (thuật ngữ PvP), `06` T216–T230 |
| 5c.1 | `16` §8 (WebSocket, tin nhắn, phòng, Migration 3), `06` T231–T239 |
| 5d.1 | `14` §14 (Elo, Vinh Dự, cửa hàng Vinh Dự), `16` route mới, `04`, `06` T240–T244 |
| 5e.1 | `16` §7 (triển khai), `06` T245 |
| 6a.1 | `01` §16 (co-op, Hợp Kích, boss), `02` (`coop-combos`, `phases`, `execute`), `03` (Hợp Kích, boss), `04`, `06` T246–T259 |
| 6b.1 | `14` §15 (thưởng co-op), `16` (phòng co-op, route), `06` T260–T262 |

---

## 14. Kế hoạch bước

Mỗi phần có kế hoạch chi tiết riêng (`docs/superpowers/plans/…`) viết khi bắt đầu phần đó.

| Bước | Nội dung |
|---|---|
| 5a.1 | Tài liệu 5a; bộ ghi vàng (chạy trên code **cũ**, commit riêng) |
| 5a.2 | `PlayerState`, chuyển trường vào `players[0]`, hàm truy cập; `rules` + `client` + `server` biên dịch; T213–T215 |
| 5b.1 | Tài liệu PvP |
| 5b.2 | `pvp-config.json` + schema; `validateDeck` pvp, `buildPvpLoadout` (T226–T227) |
| 5b.3 | `createPvpCombat`, lượt luân phiên, thời hạn theo lượt, effect PvP, thắng/thua (T216–T225) |
| 5b.4 | `viewFor`, `redactEvents`, `pvpBot` (T228–T230) |
| 5b.5 | `pvp-sim` + gói chỉnh số (duyệt) + `playtest-notes` mục 5b |
| 5c.1 | Tài liệu giao thức; thêm `@fastify/websocket` |
| 5c.2 | Kết nối, `hello`, ping, giới hạn tin; khung phòng trận; Phòng riêng PvP; Migration 3 (T231–T233, T236–T238) |
| 5c.3 | Đồng hồ, hết giờ, kết nối lại, Đấu Tập (T234–T235, T239) |
| 5c.4 | Client: `net/socket.ts`, màn trận mạng từ góc nhìn, Phòng riêng + Đấu Tập; chạy thử Playwright hai tab |
| 5d.1 | Tài liệu Elo / Vinh Dự |
| 5d.2 | `rating.ts`, `honor.ts`, hàng chờ, route arena + cửa hàng Vinh Dự (T240–T244); mô phỏng kinh tế thêm người chơi PvP |
| 5d.3 | Client: sảnh Đấu Trường, xếp deck PvP, lịch sử, bảng xếp hạng, cửa hàng Vinh Dự, biểu cảm |
| 5e.1 | Cấu hình production, giới hạn tần suất, `Origin`, sao lưu (T245); `deploy/` mẫu; hỏi chọn nhà cung cấp |
| 5e.2 | Triển khai thật + kiểm tra sau triển khai (cùng người dùng) |
| 6a.1 | Tài liệu co-op; nội dung boss + Hợp Kích (`03`, Claude soạn, người dùng duyệt) |
| 6a.2 | `coop-config`, `coop-combos`, `phases`, `execute` + schema + kiểm tra khi nạp |
| 6a.3 | `createCoopCombat`, lượt đồng thời, mục tiêu co-op, Cạn Bài một người (T246–T250, T258–T259) |
| 6a.4 | Hợp Kích (T251–T254); Boss Nguyệt Thực (T255–T257) |
| 6a.5 | `coopBot`, `coop-sim` + gói chỉnh số (duyệt) + `playtest-notes` mục 6a |
| 6b.1 | Phòng co-op, hàng chờ co-op, đồng đội máy, thưởng co-op (T260–T262); mô phỏng kinh tế |
| 6b.2 | Client Liên Thủ: sảnh, màn trận 6 Hero, nút Xong, gợi ý + banner Hợp Kích, thanh giai đoạn boss; chạy thử Playwright hai tab |
