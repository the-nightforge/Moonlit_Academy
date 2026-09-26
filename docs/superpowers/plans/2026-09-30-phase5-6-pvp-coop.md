# Giai đoạn 5–6 (PvP, triển khai Internet, Co-op) — Implementation Plan

> **For agentic workers:** làm từng Task theo thứ tự; mỗi Task kết thúc bằng
> `pnpm test` + `pnpm typecheck` xanh và một commit (push lên nhánh làm việc). Steps
> dùng checkbox (`- [ ]`). Mỗi Task là một bước trong `07` — báo người dùng sau mỗi
> Task và chờ "oke" trước Task kế tiếp.

**Goal:** Hai người chơi đấu PvP 1v1 theo lượt qua server (xếp hạng Elo, Vinh Dự, Phòng
riêng, Đấu Tập với máy), chơi được qua Internet; sau đó hai người cùng đánh Boss Nguyệt
Thực trong co-op lượt đồng thời có Hợp Kích (hoặc một người + đồng đội máy).

**Spec:** `docs/17-phase5-6-spec.md` (toàn bộ; test ở §11, bước ở §14). Khi plan và spec
khác nhau về luật, spec là chuẩn; khi spec và tài liệu luật (`01`, `14`, `16`) khác nhau,
tài liệu luật là chuẩn.

**Giả định:** plan viết theo mọi đề xuất ở spec §12 (phương án "Recommended"). Task 1
(5a.1) chốt §12 với người dùng trước khi code; điểm nào người dùng đổi thì sửa spec và các
Task liên quan của plan này trong cùng commit tài liệu.

**Tech:** TypeScript strict, pnpm workspaces, Vitest. Server: Node 22, Fastify 5,
better-sqlite3, **`@fastify/websocket`** (+ `ws`, `@types/ws`; cần duyệt ở Task 1, thêm ở
Task 10). Không thêm thư viện nào khác. Triển khai: Caddy + systemd trên một VPS (ngoài
repo; chỉ file mẫu trong `deploy/`).

## Global Constraints

- `packages/rules` thuần: không mạng, không đồng hồ, không `Math.random`. Đồng hồ lượt,
  hàng chờ, kết nối là việc của server; mọi thứ ảnh hưởng kết quả trận đi vào nhật ký
  Action để chạy lại được.
- **PvE không đổi từng bit** sau 5a: cùng seed + Action → cùng event, cùng kết quả. Bộ ghi
  vàng (T213) chạy trong `pnpm test` mọi Task sau đó.
- Event PvE giữ nguyên hình dạng; trường mới (`player`…) chỉ xuất hiện khi `mode ≠ "pve"`.
- Server là trọng tài của trận mạng: client chỉ gửi Action, chỉ nhận góc nhìn
  (`viewFor`) + event đã che (`redactEvents`). Client không giữ state đầy đủ của trận mạng.
- Hồ sơ (Elo, Vinh Dự, thưởng co-op) chỉ đổi qua hàm thuần trong `rules/src/meta/`, trong
  một transaction cùng bản ghi trận.
- Test server: `buildApp({ db: openDb(":memory:"), clock, random, scheduler, data })`;
  HTTP bằng `app.inject`, WebSocket bằng `app.injectWS` — không mở cổng mạng trong test.
  `scheduler` giả tiến giờ bằng tay.
- Mã test T213–T262 (spec §11); tên test theo mã. Mô phỏng dài gắn cờ môi trường
  (`PLAYTEST_PVP=1`, `PLAYTEST_COOP=1`), không chạy trong `pnpm test` mặc định.
- Số cân bằng (HP PvP, bù người đi sau, boss, thưởng) nằm trong JSON; gói chỉnh số trình
  người dùng duyệt trước khi áp (như 4d.6, 4e.7).
- Code tiếng Anh; chữ cho người chơi tiếng Việt từ dữ liệu / `theme.ts`; thuật ngữ theo
  `04` (cập nhật ở các Task tài liệu).

---

## File Structure

| File | Trách nhiệm | Task |
|---|---|---|
| `docs/{01,02,03,04,06,07,14,16}.md`, `CLAUDE.md`, `17` (trạng thái) | Tài liệu | 1, 4, 9, 13, 16, 18, 19, 23 |
| `packages/rules/test/golden/*.json`, `test/golden.test.ts`, `test/golden-record.ts` | Bộ ghi vàng PvE | 2 |
| `packages/rules/src/types/state.ts` | `CombatMode`, `PlayerState`, `CombatState.players`, `HeroState.player` | 3 |
| `packages/rules/src/players.ts` (mới) | `playerOf`, `activePlayerState`, `alliesOf`, `opponentsOf`, id có tiền tố | 3 |
| `packages/rules/src/{apply-action,draw,effects,intent,preview,queries,run-relic-hooks,turn,create-combat,moon,levelup,gear}.ts` | Đọc / ghi trường người chơi qua `players` | 3 |
| `packages/rules/test/helpers.ts` + mọi test đọc `state.hand`… | Override cũ dịch sang `players[0]`; truy cập qua `p0(state)` | 3 |
| `apps/client/src/{debug.ts,scenes/combat-scene.ts,run-session.ts}` | Đọc state mới | 3 |
| `packages/data/pvp-config.json` + `src/schema.ts`, `load-game-data.ts` | Cấu hình PvP | 5 |
| `packages/rules/src/meta/{deck,loadout}.ts` | `validateDeck` chế độ pvp, `buildPvpLoadout` | 5 |
| `packages/rules/src/pvp/{create-pvp,turn,effects,end}.ts` | Luật trận PvP | 6 |
| `packages/rules/src/pvp/{view,bot}.ts`, `replay-match.ts` | Góc nhìn, che event, bot PvP, chạy lại trận | 7 |
| `packages/rules/test/pvp-sim.ts`, `pvp-sim.test.ts` | Mô phỏng bot đấu bot | 8 |
| `apps/server/src/realtime/{socket,protocol,match-room,pvp-room,rooms,bot-player,scheduler}.ts` | Kết nối, phòng, Phòng riêng, Đấu Tập | 10, 11 |
| `apps/server/src/db.ts` | Migration 3 (`matches`, `match_players`) | 10 |
| `apps/client/src/net/socket.ts`, `scenes/net-combat-scene.ts` | Kết nối, màn trận mạng | 12 |
| `packages/rules/src/meta/{rating,honor}.ts`, `types/meta.ts` (`arena`, `honor`) | Elo, Vinh Dự, cửa hàng Vinh Dự | 14 |
| `apps/server/src/realtime/queue.ts`, `routes/arena.ts` | Hàng chờ, lịch sử, bảng xếp hạng, cửa hàng Vinh Dự | 14 |
| `apps/client/src/scenes/{arena-lobby-scene,deck-builder-scene,shop-scene}.ts` | Sảnh Đấu Trường, deck PvP, cửa hàng | 15 |
| `apps/server/src/{rate-limit,backup,config}.ts`, `deploy/{Caddyfile,vong-nguyet.service,README.md}` | Production | 17 |
| `packages/data/{coop-config,coop-combos}.json`, `enemies.json` (`eclipse_lord` + `phases`), `encounters.json` (`enc_coop_01`) | Nội dung co-op | 19 |
| `packages/rules/src/coop/{create-coop,turn,targets,combos,boss,bot}.ts`, effect `execute` | Luật co-op | 20, 21, 22 |
| `packages/rules/test/coop-sim.ts`, `coop-sim.test.ts` | Mô phỏng 2 bot | 22 |
| `packages/rules/src/meta/coop-rewards.ts`, `apps/server/src/realtime/coop-room.ts`, `routes/coop.ts` | Phòng co-op, thưởng | 23 |
| `apps/client/src/scenes/{coop-lobby-scene,coop-combat-scene}.ts` | Client Liên Thủ | 24 |

---

## Phần 5a — Lõi nhiều người chơi

### Task 1: Chốt spec + tài liệu 5a (bước 5a.1)

- [ ] Hỏi người dùng các điểm spec §12 (gộp câu hỏi, tối đa 4 mỗi lượt, mỗi câu có phương
      án đề xuất); ghi kết quả vào `17` §12 và dòng **Trạng thái** ("đã duyệt …"). Sửa
      plan này nếu có điểm đổi.
- [ ] Duyệt thư viện `@fastify/websocket` (+ `ws`, `@types/ws`) → `CLAUDE.md` danh sách đã
      duyệt.
- [ ] `02`: `CombatMode`, `PlayerState`, `CombatState.mode/players/activePlayer`,
      `HeroState.player`, quy tắc id có tiền tố (spec §2.2).
- [ ] `01` §1: thành phần theo người chơi (PvE = 1 người chơi, luật không đổi).
- [ ] `06`: T213–T215. `07`: mục "Giai đoạn 5" (bước 5a.1–5e.2, trỏ spec + plan này),
      mục "Giai đoạn 6" (6a.1–6b.2). `CLAUDE.md`: giai đoạn hiện tại 5a.
- [ ] Commit `Step 5a.1: docs for the multi-player combat core`.

### Task 2: Bộ ghi vàng trên code cũ (bước 5a.1, commit riêng)

Chạy **trước** khi đổi state, để có chuẩn so.

- [ ] `test/golden-record.ts`: sinh bản ghi cho
      - 100 trận lẻ bot (`playtest-bot.ts`): seed 1–100, xoay vòng 10 đội 3 Hero × các
        encounter, có / không trang bị (R1, R5), có / không loadout Tinh Hồn 6 + dạng thứ hai;
      - 100 lượt chơi bot (`run-playtest` rút gọn): seed 1001–1100, deck Bộ cơ bản và deck
        tự xếp, có trang bị.
      Mỗi bản ghi: `{ seed, setup, loadout, actions, events, final }` với `final` là
      phép chiếu **ổn định** của state (HP / giáp / trạng thái mọi unit, `cardId` theo thứ
      tự của tay / chồng rút / chồng bỏ, Nguyệt Lực, Dự Trữ, `round`, `moonIndex`,
      `bloodMoonRounds`, `status`, `rngState`) — phép chiếu viết bằng hàm truy cập nên sống
      sót qua đổi kiểu (Task 3 chỉ sửa phép chiếu, không sửa bản ghi).
- [ ] Lưu `test/golden/combats.json`, `test/golden/runs.json` (JSON gọn; nếu > 2 MB thì lưu
      băm SHA-256 của `events` + `final` đầy đủ cho 10 bản đầu, băm cho phần còn lại).
- [ ] `test/golden.test.ts` — **T213**: chạy lại từng bản ghi, so khớp `events` và `final`.
      Lệnh tái tạo bản ghi: `GOLDEN_RECORD=1 pnpm --filter rules test golden` (chỉ dùng
      khi người dùng đồng ý đổi luật PvE).
- [ ] **T214**: 3 phiếu lượt chơi mẫu (4c không loadout, 4d có Tinh Hồn, 4e có trang bị) —
      `{ setup, loadout, actions, result }` lấy từ DB dev / sinh bằng server test — lưu
      `test/fixtures/tickets/*.json`; `replayRun` ra đúng `result`.
- [ ] Commit `Step 5a.1 (golden): record PvE combats and runs before the state rework`.

### Task 3: `PlayerState` (bước 5a.2)

- [ ] `types/state.ts`: thêm `CombatMode`, `PlayerState` (spec §2.2); `CombatState` bỏ
      các trường gốc `drawPile, hand, discardPile, moonPower, moonReserve, moonPowerBonus,
      cardsPlayedThisTurn, pendingChoice, runRelicIds, runRelicCounters, weapons, relics`,
      thêm `mode`, `activePlayer`, `players`; `HeroState.player: number`. `runRelicCounters`
      đổi tên `players[i].hookCounters` (khóa giữ nguyên).
- [ ] `players.ts`: `activePlayerState(state)`, `playerOf(state, heroId)`,
      `playerOfCard(state, instanceId)`, `alliesOf(state, unit)`, `opponentsOf(state, unit)`
      (PvE: như cũ — Hero ↔ kẻ địch), `prefixedId(state, player, id)` (PvE: không tiền tố).
- [ ] Sửa từng file `rules/src` đọc trường cũ: đọc / ghi qua người chơi của **đơn vị hành
      động** hoặc `activePlayerState` (effect `draw`/`chooseCard`/`gainMoonPower`/
      `gainMoonPowerPerTurn`/`drainMoonPower` steal → người chơi của Hero hành động; Tàn
      Chiêu / Tán Chiêu → người chơi của Hero ngã; hook → người chơi sở hữu nguồn hook).
      `createCombat` / `createRun` dựng `players[0]`, `mode: "pve"`.
- [ ] Các hàm công khai (`getEffectiveCost`, `getValidTargets`, `isCardPlayable`, preview)
      nhận thêm `player?: number` (mặc định người chơi của lá / 0).
- [ ] `run/*`: lượt chơi chỉ PvE, đọc `players[0]`.
- [ ] Test: `helpers.ts` — `makeTestCombat(overrides)` nhận override cũ (`hand`,
      `moonPower`…) và đặt vào `players[0]` để thân test ít đổi; thêm `p0(state)`. Sửa test
      đọc `state.hand` → `p0(state).hand`. **Không sửa kỳ vọng số** của test cũ.
- [ ] Client (`combat-scene`, `debug`, `run-session`), server (bot test) đọc qua
      `players[0]`.
- [ ] **T215**: dựng tay một state 2 người chơi cùng Hero `m05` (qua `prefixedId`) — unit id,
      instance id, `playerOf` không va chạm.
- [ ] T213, T214 xanh (phép chiếu `final` sửa theo kiểu mới, bản ghi không đổi); toàn bộ test
      cũ xanh. Chạy thử client một trận lẻ + một lượt chơi bằng Playwright (không lỗi console).
- [ ] Commit `Step 5a.2: per-player combat state (PvE unchanged)`.

---

## Phần 5b — Luật PvP

### Task 4: Tài liệu PvP (bước 5b.1)

- [ ] `01` §15 PvP (spec §4: tạo trận, lượt/vòng, bù người đi sau, thời hạn theo lượt,
      mục tiêu, effect nghĩa riêng, thắng/thua/hòa, `forfeit`, góc nhìn).
- [ ] `14` §3.1 deck chế độ pvp; §12 `buildPvpLoadout` (spec §3.2).
- [ ] `02`: `pvp-config.json`, `PvpSide`, Action `mulligan.player`, `forfeit`; event mới
      (`turnStarted { player }`, `playerForfeited`, `playerDisconnected`) và trường `player`.
- [ ] `04`: Đấu Trường Công Bằng, Hero thử, trang bị PvP cơ bản, người đi trước / sau, bù
      người đi sau, góc nhìn (`viewFor`), Đấu Tập, Phòng riêng, bảng chỉ số PvP.
- [ ] `06` T216–T230. Commit `Step 5b.1: PvP rule docs`.

### Task 5: Cấu hình PvP, deck, loadout (bước 5b.2)

- [ ] `pvp-config.json` theo spec §3.1 (+ `tiers`, `honorShop`, `emotes` để trống / điền ở
      Task 14–15); schema zod; kiểm tra khi nạp: Hero trong `heroStats` / `trialHeroIds`
      tồn tại và đủ 5 Hero, id trang bị tồn tại, số dương. Test data đếm.
- [ ] `validateDeck(data, profile, deck, { mode: "pvp" })` (spec §3.2) — **T227**.
- [ ] `buildPvpLoadout` + cờ `pvp: true` trong `Loadout`; `createCombat` bỏ ngưỡng Tinh
      Hồn 2 và lá "+" khi `pvp` — **T226**.
- [ ] Commit `Step 5b.2: PvP config, deck rules and normalized loadout`.

### Task 6: Luật trận PvP (bước 5b.3)

- [ ] `createPvpCombat(data, { seed, players })` theo thứ tự RNG spec §4.1; HP từ
      `heroStats`; `status = "mulligan"`, mỗi người một cờ đã Đổi Bài — **T216**, **T217**.
- [ ] `applyAction` phân nhánh theo `mode`: PvP kiểm `action.player === activePlayer`
      (`"not your turn"`); `mulligan` có `player`; khi cả hai xong → đầu lượt người đi
      trước, rồi hook `combatStart` (người đi trước, rồi người đi sau) — **T218**.
- [ ] `pvp/turn.ts`: đầu lượt / cuối lượt cho Hero của người chơi P (tái dùng các bước
      PvE, lọc theo người chơi); bù người đi sau — **T219**; cuối vòng không lên chuỗi địch.
- [ ] Thời hạn theo lượt: áp = `2 × amount`, giảm cuối mỗi lượt; hiển thị `ceil(/2)` (hàm
      `displayDuration`) — **T220**; Khiêu Khích, Đóng Băng — **T221**.
- [ ] `drainMoonPower` PvP (Dự Trữ đối thủ, một lần) — **T222**; `enemiesKilled`, hook
      `enemyKilled` / `heroDied` theo người chơi, `moonPhaseEntered` cả hai — **T223**.
- [ ] Thắng / thua / hòa (`winner`), Cạn Bài, `roundCap` — **T224**; `forfeit` (chỉ nhận
      khi `action.system === true`, cờ server đặt) — **T225**.
- [ ] Commit `Step 5b.3: PvP combat rules`.

### Task 7: Góc nhìn, che event, bot PvP (bước 5b.4)

- [ ] `pvp/view.ts`: `viewFor(state, player)` theo bảng spec §4.8 — **T228**;
      `redactEvents(events, player)` — **T229**. Góc nhìn phải qua được `getValidTargets`,
      `isCardPlayable`, preview của người xem.
- [ ] `pvp/bot.ts`: `pvpBot(data, view, player)` dựng từ logic `playtest-bot.ts` (tách
      phần chọn lá dùng chung; Hero đối thủ = mục tiêu, không có chuỗi chiêu để né) —
      **T230** (1000 bước bot trên `viewFor` luôn ra Action hợp lệ với state thật).
- [ ] `replayMatch(data, setup, log)` (thuần): tạo trận + áp nhật ký `{ player, action }[]`.
- [ ] Commit `Step 5b.4: PvP views, event redaction and bot`.

### Task 8: Mô phỏng PvP + chỉnh số (bước 5b.5)

- [ ] `pvp-sim.ts`: 10 đội × 10 đội × N seed (N đủ để sai số ±3 điểm cho tỉ lệ người đi
      trước), Bộ cơ bản không trang bị; lượt thứ hai có trang bị PvP cơ bản ngẫu nhiên.
      In: tỉ lệ thắng người đi trước, phân bố số vòng, tỉ lệ thắng theo Hero, % hòa, lá chưa
      từng đánh.
- [ ] Đo, so mục tiêu spec §4.9; soạn gói chỉnh (`heroStats`, `secondPlayerBonus`) — **dừng,
      trình người dùng duyệt** (AskUserQuestion, gói đề xuất đứng đầu).
- [ ] Áp gói đã duyệt, đo lại; `playtest-notes.md` mục "Phase 5b"; `03` bảng chỉ số PvP.
- [ ] Commit `Step 5b.5: PvP simulation and tuning`.

---

## Phần 5c — Kết nối realtime

### Task 9: Tài liệu giao thức (bước 5c.1)

- [ ] `16` §8 mới: kết nối (`/api/ws`, `hello`, mã đóng 4000/4401/4409/4429, ping), bảng tin
      nhắn (spec §5.2), phòng trận (§5.3), Đấu Tập (§5.4), kết nối lại (§5.5), Migration 3
      (§5.6), route (§5.7 phần 5c).
- [ ] `06` T231–T239. Commit `Step 5c.1: realtime protocol docs`.

### Task 10: Kết nối + phòng trận + Phòng riêng PvP (bước 5c.2)

- [ ] `pnpm --filter server add @fastify/websocket` (+ `-D @types/ws` nếu cần); Vite SSR
      build để `@fastify/websocket`, `ws` ngoài bundle.
- [ ] `buildApp` thêm `scheduler` (mặc định `setTimeout` / `clearTimeout`); test dùng
      `fakeScheduler()` (`advance(ms)`).
- [ ] `realtime/protocol.ts`: zod cho mọi tin client → server; kiểu cho tin server → client.
- [ ] `realtime/socket.ts`: nâng cấp, chờ `hello` 10 giây, xác thực token (dùng lại
      `auth.ts`), `dataVersion`, một kết nối / tài khoản, ping/pong, 16 KB, 30 tin/giây —
      **T231**, **T236**.
- [ ] `realtime/match-room.ts` (khung chung) + `pvp-room.ts`: `seq`, quyền, `applyAction`,
      gửi `redactEvents` + `viewFor` cho từng người, `eventSeq`, kết thúc trận — **T233**.
- [ ] `realtime/rooms.ts`: Phòng riêng (mã 6 ký tự từ `random`, hạn 10 phút, deck hợp lệ
      pvp) — **T232** (hai `injectWS`, bot điều khiển cả hai phía tới hết trận).
- [ ] Migration 3 (`matches`, `match_players`); ghi `playing` khi bắt đầu, `finished` khi
      xong; khởi động → `void` — **T237** (`replayMatch` từ DB), **T238**.
- [ ] Commit `Step 5c.2: WebSocket connection, match rooms and private PvP rooms`.

### Task 11: Đồng hồ, kết nối lại, Đấu Tập (bước 5c.3)

- [ ] Đồng hồ lượt / Đổi Bài qua `scheduler`; hết giờ gửi Action thay (ghi nhật ký); đếm
      hết giờ liên tiếp → `forfeit` — **T234**.
- [ ] Mất kết nối: event `playerDisconnected`, hẹn `reconnectSeconds`; kết nối lại →
      `welcome.activeMatch` snapshot; quá hạn → `forfeit` — **T235**.
- [ ] `bot-player.ts` + `practice.start`: người chơi máy trên góc nhìn, nghĩ 600–1200 ms
      (seed trận), deck máy theo spec §5.4; không Elo / thưởng — **T239**.
- [ ] Commit `Step 5c.3: turn timers, reconnect and practice matches`.

### Task 12: Client trận mạng (bước 5c.4)

- [ ] `net/socket.ts`: kết nối (`ws://` / `wss://` theo trang), `hello`, tự kết nối lại
      (1, 2, 4, 8… ≤ 15 giây), hàng đợi tin, lệch giờ server.
- [ ] Tách renderer trận khỏi nguồn state: `combat-scene` nhận "nguồn trận" (cục bộ PvE /
      mạng) — nguồn mạng gửi Action qua socket, nhận `{ events, view }`.
- [ ] Màn trận PvP: đối thủ ở chỗ kẻ địch, tay đối thủ úp, dải thông tin đối thủ, đồng hồ
      lượt, "Lượt đối thủ", lớp phủ kết nối lại, bảng kết thúc (spec §7.3).
- [ ] Tạm thời: nút "Đấu Trường (thử)" ở màn chính → Phòng riêng (tạo / nhập mã) + Đấu Tập
      (sảnh đầy đủ ở Task 15).
- [ ] Chạy thử Playwright: hai context trình duyệt, hai tài khoản, Phòng riêng, đánh vài
      lượt, tải lại trang một bên → vào lại trận; một trận Đấu Tập tới hết.
- [ ] Commit `Step 5c.4: client network combat`.

---

## Phần 5d — Xếp hạng, Vinh Dự, sảnh

### Task 13: Tài liệu Elo / Vinh Dự (bước 5d.1)

- [ ] `14` §14: `profile.arena`, `ratingChange`, bậc, `currencies.honor`, `applyPvpResult`,
      cửa hàng Vinh Dự (spec §6.3–§6.4). `16`: route arena + cửa hàng, hàng chờ (§6.1),
      `match.end` có `rating` / `rewards`. `04`: Điểm Đấu Trường, bậc, Vinh Dự, Cửa hàng Vinh
      Dự, hàng chờ. `06` T240–T244. Commit `Step 5d.1: rating and honor docs`.

### Task 14: Elo, Vinh Dự, hàng chờ, route (bước 5d.2)

- [ ] `types/meta.ts`: `Profile.arena`, `currencies.honor`; `parseProfile` điền mặc định.
- [ ] `meta/rating.ts` — **T240**; `meta/honor.ts` (`applyPvpResult`, `buyHonorItem`) —
      **T242**, **T243**; `pvp-config.tiers`, `honorShop`.
- [ ] `realtime/queue.ts`: ghép mỗi giây qua `scheduler`, khoảng nới theo thời gian chờ,
      tránh đối thủ gần nhất — **T241**.
- [ ] Kết thúc trận xếp hạng: Elo hai người + Vinh Dự + `match_players` trong một
      transaction; `match.end` mang `rating`, `rewards`, `profileRev` — **T244**.
- [ ] `routes/arena.ts`: `/api/arena/me`, `/history`, `/leaderboard`,
      `POST /api/shop/honor/:itemId/buy`.
- [ ] `economy-sim.ts`: thêm kiểu người chơi PvP (6 trận/ngày, thắng 50%); in tổng Nguyệt
      Ngọc quy đổi / ngày so với người chơi chỉ PvE.
- [ ] Commit `Step 5d.2: Elo, honor, ranked queue and arena routes`.

### Task 15: Client Đấu Trường (bước 5d.3)

- [ ] `arena-lobby-scene`: Điểm + bậc, thắng/thua, Vinh Dự hôm nay, chọn deck (lỗi pvp),
      Xếp hạng (đồng hồ chờ, hủy, gợi ý Đấu Tập sau 90 giây), Phòng riêng, Đấu Tập, Lịch sử,
      Bảng xếp hạng, Cửa hàng Vinh Dự. Thay nút tạm của Task 12.
- [ ] Xếp deck: công tắc "Xem theo luật PvP" (Hero "Thử", trang bị "PvP", R1 / CM1, lỗi pvp).
- [ ] `shop-scene`: tab Vinh Dự. Thanh tiền tệ hiện Vinh Dự.
- [ ] Biểu cảm (`pvp-config.emotes`, 1 lần / 3 giây, nút tắt).
- [ ] Chạy thử Playwright: hai tài khoản vào hàng chờ xếp hạng, đánh hết trận, Điểm và Vinh
      Dự đổi đúng; mua một món cửa hàng Vinh Dự.
- [ ] Commit `Step 5d.3: arena lobby, PvP deck view, honor shop`.

---

## Phần 5e — Triển khai Internet

### Task 16: Tài liệu triển khai (bước 5e.1, phần tài liệu)

- [ ] `16` §7: biến môi trường production, giới hạn tần suất, `Origin`, sao lưu / khôi phục,
      log, cấu trúc VPS + Caddy + systemd; `06` T245. Commit cùng Task 17.

### Task 17: Production (bước 5e.1)

- [ ] `config.ts`: đọc `NODE_ENV`, `TRUST_PROXY`, `ALLOWED_ORIGINS`, `BACKUP_DIR` (kiểm bằng
      zod, lỗi rõ khi thiếu ở production).
- [ ] `rate-limit.ts` (cửa sổ trượt trong bộ nhớ, theo IP): đăng ký, đăng nhập, kết nối
      WebSocket; kiểm `Origin` khi nâng cấp và route đổi hồ sơ — **T245**.
- [ ] `backup.ts`: `db.backup()` mỗi 6 giờ qua `scheduler`, giữ 14 bản.
- [ ] Client: `VITE_API_BASE`, tự chọn `wss://`.
- [ ] `deploy/Caddyfile`, `deploy/vong-nguyet.service`, `deploy/README.md` (cài Node 22,
      build, chạy, sao lưu / khôi phục) — không chứa bí mật / tên miền thật.
- [ ] Hỏi người dùng chọn nhà cung cấp VPS và tên miền (không tự tạo tài khoản dịch vụ).
- [ ] Commit `Step 5e.1: production config, rate limits, backups and deploy templates`.

### Task 18: Triển khai thật (bước 5e.2, cùng người dùng)

- [ ] Làm theo `deploy/README.md` cùng người dùng (người dùng chạy lệnh trên VPS; Claude
      hướng dẫn / sửa cấu hình). `GET /api/health` qua HTTPS.
- [ ] Kiểm tra sau triển khai (spec §10): 2 tài khoản từ 2 mạng, một trận xếp hạng, một
      Đấu Tập, tải lại trang giữa trận.
- [ ] Ghi kết quả + sự cố vào `playtest-notes.md` mục "Phase 5e"; `CLAUDE.md` giai đoạn 6a.
- [ ] Commit `Step 5e.2: deployment notes`.

---

## Phần 6a — Luật co-op

### Task 19: Tài liệu + nội dung co-op (bước 6a.1)

- [ ] `01` §16 co-op (spec §8.1–§8.7), `02` (`coop-config`, `CoopComboDef`, `CardMatcher`,
      `BossPhaseDef`, effect `execute`, event `coopComboTriggered`, `bossPhaseChanged`,
      `deckedOut.player`), `04` (Liên Thủ, lượt đồng đội, Xong, Hợp Kích, Boss Nguyệt Thực,
      giai đoạn boss), `06` T246–T259.
- [ ] `03`: 3 Hợp Kích (spec §8.5) + Boss *Nguyệt Thực Ma Quân*: bộ chiêu 4 giai đoạn,
      HP ~210, Nguyệt Lực `start 4 cap 12` — **Claude soạn, trình người dùng duyệt** trước
      khi commit.
- [ ] Commit `Step 6a.1: co-op rule docs and eclipse boss content`.

### Task 20: Dữ liệu co-op (bước 6a.2)

- [ ] `coop-config.json`, `coop-combos.json`, `eclipse_lord` (`phases`), `enc_coop_01`
      (`tier: "coop"`, không vào bản đồ lượt chơi); schema + kiểm tra khi nạp (`execute`
      chỉ trong Hợp Kích; `CardMatcher` trỏ Hero / tag / trạng thái / pha tồn tại; `phases`
      `hpBelow` giảm dần, giai đoạn 1 = 1; `reviveAfterRounds` chỉ ở giai đoạn cuối).
- [ ] Test data đếm. Commit `Step 6a.2: co-op data`.

### Task 21: Lượt đồng thời + mục tiêu co-op (bước 6a.3)

- [ ] `createCoopCombat(data, { seed, players, encounterId })`: 6 Hero (vị trí 0–5,
      `player`), chồng bài / Nguyệt Lực riêng, pha trăng chung, boss lên chuỗi — **T246**.
- [ ] Lượt đồng đội (spec §8.3): đầu lượt cho 6 Hero rồi từng người chơi; Action của cả hai
      khi chưa `done`; `endTurn` = Xong; cả hai Xong → cuối lượt 0 → 1 → lượt địch → cuối
      vòng — **T247**; hết giờ do server gửi `endTurn` (Action có `system`) — **T259**.
- [ ] `alliesOf` / `opponentsOf` co-op theo bảng spec §8.4 — **T248**; Đổi Vận chung —
      **T249**; chiêu địch trên 6 Hero + Khiêu Khích chéo người chơi — **T250**.
- [ ] Cạn Bài một người → Hero người đó ngã (`deckedOut { player }`); `forfeit` co-op → Hero
      người đó ngã — **T258**.
- [ ] Commit `Step 6a.3: co-op simultaneous turns and targeting`.

### Task 22: Hợp Kích, Boss, bot, mô phỏng (bước 6a.4–6a.5)

- [ ] `coop/combos.ts`: `playedThisTurn`, khớp `CardMatcher` (dò effect trong `conditional`,
      `moonPhaseAfter` xét sau khi lá giải quyết), giới hạn vòng / trận, mỗi lá một Hợp Kích,
      `allAllies` = 6 Hero trong effect Hợp Kích; effect `execute` — **T251–T254**.
- [ ] `coop/boss.ts`: đổi giai đoạn sau mỗi effect, nhiều ngưỡng lần lượt, `onEnter`,
      Huyết Nguyệt giai đoạn 2, `maxIntentsPerRound` theo giai đoạn, đếm ngược + hồi sinh
      giai đoạn 4 — **T255–T257**.
- [ ] Commit `Step 6a.4: coop combos and the eclipse boss`.
- [ ] `coop/bot.ts` (`coopBot` trên góc nhìn co-op: hoàn thành Hợp Kích, bảo vệ Hero bị nhắm).
- [ ] `coop-sim.ts`: mọi cặp đội, Bộ cơ bản, không trang bị / R1 / R5 + Tinh Hồn 6; in tỉ lệ
      thắng, số vòng, tần suất Hợp Kích, % trận thắng qua giai đoạn 4 (spec §8.8).
- [ ] Gói chỉnh boss / Hợp Kích — **trình người dùng duyệt**; áp; `playtest-notes.md` mục
      "Phase 6a"; `03` cập nhật số.
- [ ] Commit `Step 6a.5: co-op bot, simulation and tuning`.

---

## Phần 6b — Co-op trên server + client

### Task 23: Phòng co-op + thưởng (bước 6b.1)

- [ ] Tài liệu: `14` §15 thưởng co-op, `16` phòng co-op + `/api/coop/me`, `06` T260–T262
      (commit chung Task này).
- [ ] `coop-room.ts` trên khung `match-room`: Action của cả hai trong lượt đồng đội
      (`"already done"`), đồng hồ 45 giây, góc nhìn co-op (thấy tay đồng đội, che chồng rút /
      `rngState`) — **T262**.
- [ ] Hàng chờ co-op (ghép theo thứ tự vào), Phòng riêng co-op, đồng đội máy (`coopBot`).
- [ ] `meta/coop-rewards.ts`: thưởng thắng / thua / thắng đầu ngày, trần 3 trận / kỳ ngày,
      không thưởng khi bỏ cuộc — **T260**, **T261**; `routes/coop.ts`.
- [ ] `economy-sim.ts`: người chơi co-op 1 trận/ngày; kiểm ≤ +20% Nguyệt Ngọc so với chỉ PvE.
- [ ] Commit `Step 6b.1: co-op rooms and rewards`.

### Task 24: Client Liên Thủ (bước 6b.2)

- [ ] `coop-lobby-scene`: hàng chờ, Phòng riêng, đồng đội máy, lượt thưởng còn lại hôm nay.
- [ ] `coop-combat-scene` (dùng renderer trận): 6 Hero (khung màu theo người chơi), boss với
      thanh HP 4 mốc + đồng hồ hồi sinh, tay đồng đội thu nhỏ, Nguyệt Lực cả hai, nút Xong +
      trạng thái đồng đội, đồng hồ 45 giây, viền gợi ý Hợp Kích, banner Hợp Kích, biểu cảm
      co-op.
- [ ] Chạy thử Playwright: hai tài khoản Phòng riêng co-op, kích hoạt ít nhất một Hợp Kích;
      một trận với đồng đội máy tới hết; tải lại trang giữa trận.
- [ ] `CLAUDE.md`: giai đoạn hiện tại "6 xong"; `07` đánh dấu xong; `17` trạng thái.
- [ ] Commit `Step 6b.2: co-op client`.
