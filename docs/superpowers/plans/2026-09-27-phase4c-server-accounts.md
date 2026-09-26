# Giai đoạn 4c (Server, tài khoản, hồ sơ trên server) — Implementation Plan

> **For agentic workers:** làm từng Task theo thứ tự; mỗi Task kết thúc bằng
> `pnpm test` + `pnpm typecheck` xanh và một commit. Steps dùng checkbox (`- [ ]`).

**Goal:** Người chơi đăng ký / đăng nhập; hồ sơ (Tu Luyện, deck) nằm trên server;
lượt chơi được server cấp seed, client chơi offline rồi nộp chuỗi Action, server
chạy lại bằng `rules` và trao XP.

**Spec:** `docs/15-phase4-spec.md` §1, §2, §5, §6 (phần 4c), §7 (T173–T182). Khi plan
và spec khác nhau về luật, spec là chuẩn.

**Tech:** TypeScript strict, pnpm workspaces, Vitest; server: Node 22, Fastify 5,
better-sqlite3 (đã duyệt 2026-09-27). Không thêm thư viện nào khác.

## Global Constraints

- `packages/rules` thuần như cũ. Hàm meta mới nhận `now` / seed làm tham số.
- Hồ sơ chỉ đổi qua hàm thuần trong `rules/src/meta/`; server không tự sửa JSON hồ sơ.
- Test server dùng `buildApp({ db: openDb(":memory:"), clock, random })` và
  `app.inject(...)` — không mở cổng mạng trong test.
- Mã test mới T173–T182; tên test theo mã.
- Chữ cho người chơi tiếng Việt; chuỗi lỗi API tiếng Anh (client dịch).
- Mỗi Task: `pnpm test && pnpm typecheck`, commit, file LF.

### Chạy server không cần `tsx`

`packages/*` xuất source `.ts` (import không đuôi, import JSON). Server được bundle
bằng **Vite SSR build** (Vite đã có trong repo):

```jsonc
// apps/server/package.json (scripts)
"build": "vite build --ssr src/main.ts --outDir dist",
"dev": "vite build --ssr src/main.ts --outDir dist --watch & node --watch dist/main.js",
"start": "node dist/main.js",
"test": "vitest run",
"typecheck": "tsc -p tsconfig.json"
```

`vite.config.ts` của server: `ssr.noExternal: ["rules", "data"]` (bundle workspace),
`build.rollupOptions.external: ["better-sqlite3", "fastify"]`, `target: "node22"`.
`pnpm dev` ở gốc đổi thành `pnpm -r --parallel dev`.

---

## File Structure

| File | Trách nhiệm |
|---|---|
| `docs/14-meta-rules.md`, `docs/16-server-api.md` (mới), `04`, `06`, `07`, `CLAUDE.md`, `15` (trạng thái) | Tài liệu (Task 1) |
| `packages/data/src/data-version.ts` | `dataVersion(gameData)` |
| `packages/data/meta-config.json`, `economy-config.json` (mới, chỉ `starterHeroIds` ở 4c) | Hero khởi đầu |
| `packages/rules/src/types/meta.ts` | `Profile` v2, `HeroProgress` |
| `packages/rules/src/meta/profile.ts` | `createProfile` v2, `parseProfile` v1→v2, `mergeImportedProfile`, kiểm sở hữu |
| `packages/rules/src/meta/deck.ts` | lỗi `unownedHero` |
| `packages/rules/src/meta/replay.ts` | `replayRun` |
| `apps/server/src/{main,app,db,auth,errors}.ts`, `routes/{auth,profile,runs}.ts` | Server |
| `apps/server/test/*.test.ts` | T173, T174, T176, T178–T181 |
| `apps/client/src/api.ts`, `session-store.ts` | Gọi API, token, bản sao hồ sơ |
| `apps/client/src/scenes/login-scene.ts` | Đăng nhập / đăng ký |
| `apps/client/src/{main.ts, profile-store.ts, scenes/*}` | Luồng mới |

---

### Task 1: Tài liệu (bước 4c.1)

- [ ] `15-phase4-spec.md`: Trạng thái → "đã duyệt 2026-09-27"; §11 ghi các điểm đã xác nhận.
- [ ] `14-meta-rules.md`: §2 hồ sơ v2 (`Profile`, `HeroProgress`, `createProfile`,
      `parseProfile` v1→v2, sở hữu Hero), §2.4 nhập hồ sơ cũ (`mergeImportedProfile`),
      §3.1 lỗi `unownedHero`, mục mới "Lượt chơi có xác nhận" (`replayRun`, luật phiếu).
      Ghi phạm vi: GĐ 4c.
- [ ] `16-server-api.md` (mới): tài khoản/phiên (spec §2.1), phiếu lượt chơi (§2.4),
      đồng bộ `If-Match` (§2.6), bảng route 4c, schema SQLite (`accounts`, `sessions`,
      `profiles`, `runs`), `dataVersion`, dạng lỗi, cách chạy server.
- [ ] `04-glossary.md`: Phiếu lượt chơi (`runTicket`), Chạy lại (`replay`), Phiên bản
      dữ liệu (`dataVersion`), Tài khoản (`account`), Phiên (`session`).
- [ ] `06-test-scenarios.md`: T173–T182 (bảng spec §7).
- [ ] `07-implementation-plan.md`: mục "Giai đoạn 4c" (bước 4c.1–4c.6), đổi "Sau giai
      đoạn 4b" thành 4d/4e/5/6.
- [ ] `CLAUDE.md`: giai đoạn hiện tại 4c; cấu trúc thêm `apps/server`; lệnh
      `pnpm --filter server dev|test`; quy tắc: kho đồ / thưởng chỉ đổi trên server,
      server chỉ gọi hàm thuần của `rules`; thư viện đã duyệt.
- [ ] Commit: `Step 4c.1: rule docs for accounts, server profile and verified runs`.

### Task 2: Luật thuần (bước 4c.2)

- [ ] `dataVersion(data: GameData): string` trong `packages/data`: `JSON.stringify` với
      khóa object sắp xếp (hàm `stableStringify` đệ quy), SHA-256 bằng `node:crypto`
      **không dùng được ở client** → dùng hàm băm thuần TS (FNV-1a 64 bit hai lượt →
      16 hex) để client và server cùng tính. **T182**.
- [ ] `types/meta.ts`: `Profile` v2 đúng spec §2.2 (trường 4d/4e có mặc định rỗng).
- [ ] `createProfile`: chỉ Hero trong `economyConfig.starterHeroIds`.
- [ ] `parseProfile`: v1 → v2 (spec §2.2); v2 kiểm kiểu từng trường, thiếu → mặc định.
      **T175**. Sửa test cũ T159–T161 (4b) dùng v1 → chấp nhận kết quả v2.
- [ ] Sở hữu: `unlockCard`, `validateDeck` (`unownedHero`), `starterDeck` từ chối Hero
      chưa sở hữu. **T181** (phần luật).
- [ ] `mergeImportedProfile(data, server, local)`: `xp` max, lá mở hợp (lọc
      `lockedCardIds`, cắt theo `masteryLevel`), deck nối thêm (cấp id mới, cắt
      `maxDecks`), đặt `flags.localImportDone`; đã `true` → lỗi `"already imported"`.
      **T176** (phần luật).
- [ ] `replayRun(data, setup, actions)` (spec §2.5; `loadout` thêm ở 4d). **T177**.
- [ ] `run-playtest.test.ts`: sau mỗi lượt mô phỏng, `replayRun` với cùng setup + chuỗi
      Action đã ghi phải cho `RunState` bằng hệt (`toEqual`).
- [ ] Commit: `Step 4c.2: profile v2, hero ownership, dataVersion, replayRun`.

### Task 3: Server khung, auth (bước 4c.3)

- [ ] `apps/server`: `package.json` (deps `fastify`, `better-sqlite3`, `rules`, `data`,
      `zod`; dev `@types/better-sqlite3`), `tsconfig.json`, `vite.config.ts` (trên).
- [ ] `db.ts`: `openDb(path)`, bảng `schema_version`, migration 1 tạo `accounts`,
      `sessions`, `profiles`, `runs` (cột theo spec §5), `PRAGMA foreign_keys = ON`,
      `journal_mode = WAL` (không áp cho `:memory:`).
- [ ] `auth.ts`: `hashPassword` / `verifyPassword` (`scrypt`, `timingSafeEqual`),
      `newToken(random)` → `{ token, tokenHash }`, `hashToken`.
- [ ] `app.ts`: `buildApp({ db, clock, random, data })`; hook `onRequest` kiểm
      `X-Data-Version` (trừ `/api/health`); decorator `requireAccount(req)` đọc Bearer,
      kiểm hạn 30 ngày trượt, cập nhật `last_used_at`; `setErrorHandler` → `{ error }`.
- [ ] `routes/auth.ts`: register / login / logout (spec §2.1; khóa 5 lần sai / 5 phút).
- [ ] `main.ts`: `PORT` (mặc định 8787), `DB_PATH` (mặc định `./data/vong-nguyet.db`).
- [ ] Test **T173**, **T174** (đồng hồ giả).
- [ ] Commit: `Step 4c.3: server skeleton with SQLite, accounts and sessions`.

### Task 4: Route hồ sơ (bước 4c.4)

- [ ] Hàm `mutateProfile(db, accountId, ifMatch, fn)` — transaction: đọc `profile_json`
      + `rev`, lệch `If-Match` → `409 stale profile` kèm hồ sơ; `fn(profile)` trả hồ sơ
      mới hoặc lỗi luật (`400 { error }`); ghi `rev + 1`.
- [ ] `GET /profile`, `POST /profile/unlock`, `PUT /profile/decks`,
      `DELETE /profile/decks/:id`, `POST /profile/import`.
- [ ] Test **T176** (route), **T180**, **T181** (route).
- [ ] Commit: `Step 4c.4: profile, deck, unlock and import routes`.

### Task 5: Phiếu lượt chơi (bước 4c.5)

- [ ] `POST /runs` `{ deckId }` hoặc `{ deckId: "starter", heroIds }`: kiểm deck, seed
      `random` 4 byte → uint32, bỏ phiếu mở cũ, lưu phiếu.
- [ ] `POST /runs/:id/finish` `{ actions }` (zod: mảng ≤ 20000 phần tử; từng Action
      kiểm cấu trúc bằng schema union): `replayRun` → `summarizeRun` →
      `applyRunResult` trong `mutateProfile`; phiếu `finished` + `result_json`.
- [ ] `POST /runs/:id/abandon`.
- [ ] Test **T178**, **T179** (dùng chuỗi Action sinh bằng heuristic của `run-playtest`
      tách thành `test/helpers/bot.ts` dùng chung).
- [ ] Commit: `Step 4c.5: run tickets, server replay and XP rewards`.

### Task 6: Client (bước 4c.6)

- [ ] `api.ts`: `request(method, path, body?)` thêm `Authorization`, `X-Data-Version`,
      `If-Match`; lỗi → `ApiError(status, code, payload)`; thông báo tiếng Việt theo
      `code` (bảng trong `theme.ts`).
- [ ] `session-store.ts`: token (`localStorage` khóa `vong-nguyet.token`), bản sao
      `profile` + `rev`; `profile-store.ts` chỉ còn đọc hồ sơ cũ để nhập.
- [ ] `login-scene.ts`: tên, mật khẩu (ô nhập HTML `<input>` đặt trên canvas bằng
      `this.add.dom` — Phaser DOM element, cần `dom: { createContainer: true }`), nút
      Đăng nhập / Đăng ký, lỗi; vào thẳng màn chọn deck nếu token còn hạn.
- [ ] Màn chọn deck / xếp deck / Tu Luyện: gọi route thay vì `saveProfile`.
- [ ] Lượt chơi: `POST /runs` trước khi dựng `createRun`; ghi Action vào
      `localStorage` (`vong-nguyet.run.<runId>`); kết thúc → `finish`, màn cuối hiện
      `gains` từ server; tải lại trang giữa lượt → hỏi Tiếp tục (chạy lại Action cục
      bộ) / Bỏ.
- [ ] Nhập hồ sơ cũ: sau đăng nhập, có `vong-nguyet.profile` và
      `!flags.localImportDone` → hộp thoại "Nhập tiến độ trên máy này?".
- [ ] Mất kết nối: chỉ Trận lẻ; nút khác báo "Cần kết nối server".
- [ ] Vite proxy `/api` → `http://localhost:8787`.
- [ ] Chạy thử: `pnpm dev`, đăng ký, chơi 1 lượt, kiểm XP trên server, đăng nhập trình
      duyệt khác thấy cùng hồ sơ (Playwright chụp màn hình).
- [ ] Commit: `Step 4c.6: client login, server profile sync and verified runs`.
