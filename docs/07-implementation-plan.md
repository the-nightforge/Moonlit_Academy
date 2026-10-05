# 07 — Kế hoạch code (Giai đoạn 0–7)

Mỗi bước là **một phiên làm việc** với AI. Dán prompt mẫu (chỉnh nếu cần), để AI làm xong, **tự chạy thử**, commit, rồi mới sang bước sau.

**Quy tắc vàng:**
- Mỗi bước kết thúc bằng: `pnpm test` pass, `pnpm typecheck` pass, và commit Git.
- Nếu AI sửa lung tung ngoài phạm vi bước: yêu cầu hoàn tác, nhắc lại phạm vi.
- Gặp lỗi không hiểu: dán nguyên thông báo lỗi cho AI, kèm "chỉ sửa lỗi này, không làm gì khác".

---

## Giai đoạn 0 — Khởi động

### Bước 0.1 — Dựng monorepo
> Đọc `CLAUDE.md` và `README.md`. Dựng monorepo pnpm workspaces theo cấu trúc trong `CLAUDE.md`: `packages/rules`, `packages/data`, `apps/client`. Cấu hình TypeScript strict dùng chung, Vitest cho `rules` và `data`, script `dev`, `test`, `typecheck` ở gốc. Chép các file JSON từ `data/` vào `packages/data/`. Chưa viết logic game. Thêm `.gitignore` (node_modules, dist, .env, logs) và `.gitattributes` cho Git LFS với png, jpg, webp, psd, wav, mp3.

**Xong khi:** `pnpm install`, `pnpm test` (chưa có test cũng không lỗi), `pnpm typecheck` chạy được.

### Bước 0.2 — Client "Hello"
> Trong `apps/client`, dựng Vite + Phaser. Một scene hiển thị chữ "Vọng Nguyệt Thư Viện" giữa màn hình 1280×720, scale mode FIT, nền xanh đêm. Kiểm tra font hiển thị đúng tiếng Việt.

**Xong khi:** `pnpm dev` mở trình duyệt thấy chữ tiếng Việt đúng dấu.

---

## Giai đoạn 1 — Prototype chiến đấu

### Bước 1.1 — Kiểu dữ liệu và nạp dữ liệu
> Đọc `docs/02-data-schema.md` và `docs/04-glossary.md`. Tạo các type TypeScript ở mục 1–4 trong `packages/rules/src/types/`. Trong `packages/data`, viết schema zod cho dữ liệu tĩnh và hàm `loadGameData()` trả về `GameData`, gồm đủ các kiểm tra chéo ở mục 6. Viết test: dữ liệu thật nạp thành công; dữ liệu sai (lá trỏ Hero không tồn tại, thiếu targeting…) báo lỗi rõ ràng.

### Bước 1.2 — RNG
> Viết RNG có seed theo mục 5 của `02-data-schema.md` (mulberry32) và hàm xáo Fisher–Yates dùng RNG đó, dạng hàm thuần trả về rngState mới. Test: cùng seed ra cùng dãy; xáo không làm mất hay nhân đôi phần tử.

### Bước 1.3 — Tạo trận
> Đọc `docs/01-combat-rules.md` mục 1–2 và 9.2. Viết `createCombat()` theo đúng thứ tự mục 2, bao gồm công bố ý định kẻ địch. Viết helper test `makeTestCombat(overrides)` như mô tả đầu `06-test-scenarios.md`. Làm các test T01, T02.

### Bước 1.4 — Hệ thống effect cơ bản và đánh bài
> Đọc `01-combat-rules.md` mục 4, 5, 10, 11. Viết `applyAction` cho `playCard` với kiểm tra hợp lệ và hàm `resolveEffect` xử lý: damage, heal, loseHp, gainArmor, removeArmor, draw, gainMoonPower, conditional. Chưa cần trạng thái và trăng. Viết `getEffectiveCost`, `getValidTargets`, `isCardPlayable`. Làm test T04–T06, T09, T10–T14, T20, T57, T58, T60.

### Bước 1.5 — Trạng thái
> Đọc `01-combat-rules.md` mục 6. Thêm effect applyStatus, cleanse và toàn bộ 10 trạng thái (thời hạn, cộng dồn, empower, freeze, mark với sourceId). Tích hợp weak, vulnerable, strength, empower, mark vào công thức damage mục 10.1. Gỡ empower và stealth sau khi lá tấn công giải quyết. Làm test T16, T18, T19, T37, T42.

### Bước 1.6 — Lượt kẻ địch và vòng
> Đọc `01-combat-rules.md` mục 3 và 9. Viết `applyAction(endTurn)`: cuối lượt người chơi, toàn bộ lượt kẻ địch (xóa giáp, tick trạng thái, thực hiện ý định với xác định lại mục tiêu 9.3.1), cuối vòng (giảm thời hạn, tiến pha, công bố ý định), rồi đầu lượt người chơi mới (xóa giáp, tick, rút bài). Làm test T03, T07, T08, T15, T17, T33–T36, T38–T40, T43–T45, T55, T56, T59.

### Bước 1.7 — Nguyệt Luân
> Đọc `01-combat-rules.md` mục 7 và `moon-phases.json`. Áp các modifier của pha: damage theo tag, thời hạn Ẩn Thân, chi phí theo tag, hệ số hồi máu, hệ số giáp. Thêm effect shiftMoon. Thêm moonOverrides khi công bố ý định. Làm test T21–T32, T41.

### Bước 1.8 — Thăng cấp
> Đọc `01-combat-rules.md` mục 8. Thêm 3 bộ đếm, kiểm tra thăng cấp sau mỗi effect và ở đầu lượt, 3 nội tại. Làm test T46–T54. Sau đó chạy toàn bộ test T01–T60, liệt kê test nào còn thiếu hoặc fail.

**Mốc kiểm tra:** toàn bộ 60 test pass. Đây là lúc bộ luật "đúng" và có thể dùng lại cho server sau này.

### Bước 1.9 — Màn hình chiến đấu tĩnh
> Đọc `docs/05-ui-combat-screen.md`. Trong client, tạo `CombatScene` vẽ toàn bộ bố cục mục 2 từ một `CombatState` (art tạm: hình chữ nhật + chữ). Vẽ từ state, chưa cần tương tác hay animation. Dùng `createCombat` với M05, F04, M06, `enc_01`.

### Bước 1.10 — Tương tác
> Thêm tương tác theo mục 4 của `05-ui-combat-screen.md`: click đánh bài, chế độ chọn mục tiêu dùng `getValidTargets`, nút Kết Thúc Lượt, phím E, Esc hủy. Sau mỗi hành động vẽ lại từ state mới (chưa có animation). Hiện lý do khi hành động bị từ chối.

**Mốc kiểm tra:** chơi được trọn một trận từ đầu đến thắng/thua.

### Bước 1.11 — Animation từ event
> Thêm hàng đợi event và animation theo bảng mục 5 của `05-ui-combat-screen.md`. Khóa input khi đang phát. Sau khi phát xong, vẽ lại từ state.

### Bước 1.12 — Hiển thị ý định và Nguyệt Luân
> Hoàn thiện hiển thị ý định (số damage đã tính, mục tiêu sau khi xác định lại — thêm hàm hỗ trợ trong `rules` nếu cần, không tính ở client), bánh xe Nguyệt Luân với pha kế tiếp, màu nền theo pha, tiến độ thăng cấp trên Hero.

### Bước 1.13 — Công cụ debug và chơi lại
> Thêm bảng debug theo mục 6 của `05-ui-combat-screen.md`, màn hình kết thúc trận với nút chơi lại và chọn encounter.

### Bước 1.14 — Chơi thử và ghi chú
Không cần AI. Chơi mỗi encounter vài lần, ghi vào `docs/playtest-notes.md` theo các câu hỏi trong mục 6 của `03-prototype-content.md`. Chỉnh số liệu trong JSON, chạy lại test.

**Hoàn thành giai đoạn 1 khi:** chơi được 3 encounter, trận có cảm giác "phải suy nghĩ", và bạn đã có danh sách thay đổi cho giai đoạn 2.

---

## Giai đoạn 2 — Chiều sâu

Đặc tả: `09-combat-depth-spec.md`. Luật đã đưa vào `01` (các mục **[GĐ2]**), kiểu dữ liệu vào `02`, test vào `06` (T61–T95).

### Bước 2.1 — Cập nhật tài liệu
Đưa đặc tả `09` vào `01`, `02`, `04`, `05`, `06`, `07`. *(Đã xong.)*

### Bước 2.2 — Schema và dữ liệu
> Đọc `02-data-schema.md` (các mục GĐ2) và `09-combat-depth-spec.md` mục 1, 4.1, 5, 6. Mở rộng type trong `packages/rules/src/types/` và schema zod: tag `scheme`/`ward`/`harmony`, status `reflect`, effect `stealBuff`/`bloodMoon` + `actor`, condition `bloodMoonActive`, `CardDef.bond`/`requiresBloodMoon`, `CardInstance.ownerIds`, counter/passive mới, `EnemyDef.bloodMoonOverride`, event `bloodMoonChanged`, `hpLost.cause` mới. Thêm các kiểm tra chéo GĐ2 ở `02` mục 6. Thêm dữ liệu: F03, F02, 13 lá mới, gắn tag 4 lá cũ, `costModifierForTag` cho `full`/`lastQuarter`, boss `moon_ape`, `enc_04`, `strength 1` cho Thủ Thế. Đổi code đang dùng `ownerId` sang `ownerIds` nhưng **chưa** thêm luật mới (effect mới có thể `throw` "not implemented"). Làm test T94; toàn bộ T01–T60 vẫn pass (sửa test bị ảnh hưởng bởi Thủ Thế nếu có).

### Bước 2.3 — Phản Đòn, Cướp buff, Huyết Nguyệt
> Đọc `01-combat-rules.md` mục 3.1, 5.1, 6.1, 6.4, 6.5, 7.4, 9.3, 9.4, 10.5. Thêm `reflect` (kích hoạt mỗi hit, gỡ cùng giáp, dừng lá/ý định khi nguồn ngã), `stealBuff`, `bloodMoon`, `bloodMoonActive`, mất HP đầu lượt, giảm cuối vòng, `requiresBloodMoon`. Làm test T61–T77.

### Bước 2.4 — Lá Song Hành
> Đọc `01-combat-rules.md` mục 4.1, 4.3, 4.4, 5.1–5.4. Dựng deck có lá Song Hành, điều kiện đánh (hai owner còn sống, không ai Đóng Băng), `actor` (kể cả kế thừa trong `conditional`), dọn sau lá tấn công, nội tại không áp cho lá Song Hành. Làm test T78–T87.

### Bước 2.5 — F03 và F02
> Đọc `01-combat-rules.md` mục 8 và 10.1. Thêm nội tại `doubleDamageVsFrozen`, `stealBonus` (không áp cho lá Song Hành). Bộ đếm `buffsStolen` (bước 2.3) và `freezesApplied` (bước 2.4) đã có. Làm test T88–T90 và T69.

### Bước 2.6 — Boss và tag theo pha
> Đọc `01-combat-rules.md` mục 4.5, 7.1, 9.1–9.2. Thêm `bloodMoonOverride` khi công bố ý định. Kiểm tra boss `enc_04` và chi phí theo tag. Làm test T91–T93. Sau đó chạy toàn bộ T01–T95.

**Mốc kiểm tra:** mọi kịch bản T01–T95 có test và pass.

### Bước 2.7 — UI giai đoạn 2
> Đọc `05-ui-combat-screen.md` (các mục GĐ2). Thêm màn chọn đội (3 trong 5 Hero + encounter), lá Song Hành, hiển thị Huyết Nguyệt, nhãn `Phản`, animation cướp buff và `bloodMoonChanged`, nút debug `bloodMoonRounds`.

### Bước 2.8 — Chơi thử giai đoạn 2
Cập nhật playtest scripted (thêm đội hình có F03/F02 và `enc_04`), chơi thử, ghi vào `docs/playtest-notes.md`, chỉnh số liệu trong JSON, chạy lại test.

**Hoàn thành giai đoạn 2 khi:** đánh thắng được `enc_04` với ít nhất 2 đội hình khác nhau, và Song Hành / Huyết Nguyệt tạo ra quyết định đáng kể theo ghi chú chơi thử.

---

## Giai đoạn 3 — Roguelike

Đặc tả: `10-roguelike-spec.md`. Luật: `01` §13 (Kỳ Vật), `11-run-rules.md` (lượt chơi). Test: `06` T96–T127. Kế hoạch chi tiết: `docs/superpowers/plans/2026-09-24-phase3-roguelike.md`.

### Bước 3.1 — Cập nhật tài liệu *(Task 1)*
### Bước 3.2 — Schema và dữ liệu *(Task 2)*
> Thêm type/schema/kiểm tra chéo cho `rewardCardIds`, `tier`/`minFloor`, Kỳ Vật, `runConfig`; thêm 20 lá thưởng, 3 kẻ địch, 4 trận, `run-relics.json`, `run-config.json`. Làm T127.
### Bước 3.3 — Trận đấu nhận dữ liệu lượt chơi và hook Kỳ Vật *(Task 3–4)*
> `CombatSetup` nhận deck/HP/Kỳ Vật; `activeModifiers`; hệ thống hook theo `01` §13. Làm T115–T126.
### Bước 3.4 — Sinh bản đồ *(Task 5)*
> `generateMap` theo `11` §2. Làm T96–T101.
### Bước 3.5 — State machine lượt chơi *(Task 6)*
> `createRun` / `applyRunAction` theo `11` §3. Làm T102–T114.
### Bước 3.6 — Client *(Task 7)*
> Chế độ Lượt chơi, màn bản đồ / thưởng / Nghỉ Chân / Kho Báu / kết thúc, thanh Kỳ Vật.
### Bước 3.7 — Playtest *(Task 8)*
> Playtest scripted trọn lượt chơi + ghi chú.

**Hoàn thành giai đoạn 3 khi:** chơi được trọn một lượt chơi trên client, T96–T127 pass, playtest cho thấy lượt chơi thắng được với ít nhất 2 đội hình.

---

## Giai đoạn 4a — Kinh tế Nguyệt Lực

Đặc tả: `12-moon-economy-spec.md`. Luật đã đưa vào `01`, schema vào `02`, thuật ngữ vào `04`, test vào `06` (T128–T148). Mỗi bước gom thay đổi luật cùng phần data phụ thuộc để `pnpm test` xanh sau từng bước.

### Bước 4a.1 — Cập nhật tài liệu
Đưa đặc tả `12` vào `00`, `01`, `02`, `04`, `06`, `07` (`12` §9). *(Đã xong.)*

### Bước 4a.2 — Thang Nguyệt Lực
> `combat-config.json`, Nguyệt Lực tăng dần + Dự Trữ người chơi, nhân đôi cost / giảm cost theo pha / `gainMoonPower`, passive M06 (T128, T129, T146, T148 config).

### Bước 4a.3 — Tay và chồng bài
> Giữ tay, rút bù, bỏ Tàn Chiêu, `copies`, deck 6 lá/Hero, không xáo lại, Cạn Bài, Tán Chiêu (T131–T136, T148 copies).

### Bước 4a.4 — Đổi Bài
> Trạng thái `mulligan`, Action `mulligan` (T137, T138).

### Bước 4a.5 — Chiêm Bài
> Effect `chooseCard`, trạng thái `choosing`, Action `chooseCard`, Kỳ Vật Thanh Loan Vũ (T144, T145, T148 chooseCard).

### Bước 4a.6 — AI địch dùng Nguyệt Lực
> Schema `intents`/`moonPower`, bộ chiêu mới, lên chuỗi, thi hành, Dự Trữ địch, xem trước; tất định (T130, T139–T143, T147, T148 intents).

### Bước 4a.7 — Client
> Theo `12` §6: Đổi Bài, Chiêm Bài, tay 6, Dự Trữ, đồng hồ Cạn Bài, chuỗi ý định.

### Bước 4a.8 — Mô phỏng + chỉnh số
> Mô phỏng + chỉnh số (qua duyệt) + ghi kết quả vào `playtest-notes.md` (`12` §8).

---

## Giai đoạn 4b — Pool lá, Tu Luyện, xếp deck

Đặc tả: `13-card-pools-spec.md`. Luật đã đưa vào `01` (từ khóa), `14` (hồ sơ / Tu Luyện / deck), schema vào `02`, thuật ngữ vào `04`, test vào `06` (T149–T168). Kế hoạch chi tiết: `docs/superpowers/plans/2026-09-26-phase4b-pools-mastery-decks.md`. Mỗi bước gom thay đổi luật cùng phần data phụ thuộc để `pnpm test` xanh sau từng bước.

### Bước 4b.1 — Cập nhật tài liệu
Đưa đặc tả `13` vào `00`, `01`, `02`, `04`, `06`, `07` và tài liệu mới `14` (`13` §9). *(Đã xong.)*

### Bước 4b.2 — Bảy từ khóa
> 7 từ khóa trong `rules` + schema ràng buộc + `keywords.json` (T149–T157).

### Bước 4b.3 — Nội dung 60 lá + nhánh
> 60 lá Hero + lá Song Hành, `heroes.json` (`lockedCardIds`, `branches`), `text`/`keywords` (T158).

### Bước 4b.4 — Hồ sơ và Tu Luyện
> `meta-config.json`, `profile.ts`, `RunState.heroLevelUps` (T159–T163).

### Bước 4b.5 — Deck
> `deck.ts`, `RunSetup.deckCardIds`, pool lá thưởng (T164–T168).

### Bước 4b.6 — Client
> Theo `13` §6: chọn deck, xếp deck, Tu Luyện, XP cuối lượt chơi, hiển thị từ khóa.

### Bước 4b.7 — Mô phỏng + chỉnh số
> Mô phỏng + chỉnh số (qua duyệt) + ghi kết quả vào `playtest-notes.md` (`13` §8).

---

## Giai đoạn 4c — Server, tài khoản, hồ sơ trên server

Đặc tả: `15-server-gacha-spec.md` (§2). Luật hồ sơ / lượt chơi có xác nhận vào `14`, server và API vào `16` (mới), thuật ngữ vào `04`, test vào `06` (T173–T182). Kế hoạch chi tiết: `docs/superpowers/plans/2026-09-27-phase4c-server-accounts.md`. Thư viện đã duyệt: `fastify`, `better-sqlite3`, `@types/better-sqlite3`.

### Bước 4c.1 — Cập nhật tài liệu
> Đưa luật 4c vào `14`, `16`, `04`, `06`, `07`, `CLAUDE.md`.

### Bước 4c.2 — Luật thuần
> Hồ sơ v2 + `parseProfile` v1→v2, sở hữu Hero, `mergeImportedProfile`, `dataVersion`, `replayRun`. Làm T175, T176 (luật), T177, T181 (luật), T182. `run-playtest` kiểm chạy lại khớp.

### Bước 4c.3 — Server khung và tài khoản
> `apps/server` (Fastify + SQLite, bundle Vite SSR), migration, băm mật khẩu, phiên. Làm T173, T174.

### Bước 4c.4 — Route hồ sơ
> Hồ sơ, deck, mở lá, nhập hồ sơ cũ, `If-Match`. Làm T176, T180, T181 (route).

### Bước 4c.5 — Phiếu lượt chơi
> Cấp phiếu, nộp, chạy lại, trao XP. Làm T178, T179.

### Bước 4c.6 — Client
> Đăng nhập / đăng ký, `api.ts`, hồ sơ từ server, lượt chơi qua phiếu, nhập hồ sơ cũ, chế độ mất kết nối (chỉ Trận lẻ).

## Giai đoạn 4d — Tiền tệ, nhiệm vụ, gacha Hero, Tinh Hồn

Đặc tả: `15-server-gacha-spec.md` §3. Luật vào `14` (§5–§12), `01` §8 (Tinh Hồn 2, 4), API vào `16` §4.1, thuật ngữ vào `04`, test vào `06` (T183–T196). Kế hoạch chi tiết: `docs/superpowers/plans/2026-09-28-phase4d-economy-gacha.md`. Tinh Hồn 5 (dạng thăng cấp thứ hai) dời sang 4e.

### Bước 4d.1 — Cập nhật tài liệu
### Bước 4d.2 — Kinh tế
> Quà tài khoản, thưởng lượt chơi, kỳ ngày/tuần, nhiệm vụ, thành tựu (data + luật + server). T183–T185.
### Bước 4d.3 — Gacha
> Banner Hero, bảo hiểm, bảo vệ người mới, bản trùng, nhật ký quay. T186–T191.
### Bước 4d.4 — Tinh Hồn và loadout
> Lá "+", `constellationThreshold`, `buildLoadout`, phiếu chụp loadout, cửa hàng Nguyệt Tinh. T192–T196.
### Bước 4d.5 — Client
> Tiền tệ, gacha, kho Hero, nhiệm vụ, cửa hàng.
### Bước 4d.6 — Mô phỏng kinh tế + chỉnh số

## Giai đoạn 4e — Binh Khí, Nguyệt Bảo, Tinh Luyện, Cộng Minh, Tinh Hồn 5

Đặc tả: `15-server-gacha-spec.md` §4. Luật: `01` §8, §14; `14` §3.1, §10.1, §12–§13; dữ liệu `02` §1.12; nội dung `03` §7; API `16` §4.2; test `06` (T197–T212). Kế hoạch chi tiết: `docs/superpowers/plans/2026-09-29-phase4e-gear.md`.

### Bước 4e.1 — Cập nhật tài liệu
### Bước 4e.2 — Dữ liệu
> `weapons.json`, `relics.json`, `altLevelUp`, schema + kiểm tra khi nạp. T212. (Hai banner trang bị thêm ở 4e.5 cùng `grantItem`, để server không mở banner khi chưa trao được vật phẩm.)
### Bước 4e.3 — Luật trận: lá Binh Khí, nội tại, Nguyệt Bảo
> `weaponAt` / `relicAt`, lá Binh Khí trong trận, hook `wearer`, thứ tự hook, `while: "bloodMoon"`. T198–T202.
### Bước 4e.4 — Dạng thăng cấp thứ hai
> 5 nội tại mới + `onLevelUp`. T206 (phần trận)–T211.
### Bước 4e.5 — Meta + server
> Deck có trang bị, `grantItem` vũ khí / Nguyệt Bảo + 2 banner trang bị, `buildLoadout(deck)`, lượt chơi, `setLevelUpForm` + route. T197, T203–T206.
### Bước 4e.6 — Client
> Kho đồ, xếp deck (ô vũ khí, 2 ô Nguyệt Bảo), banner trang bị, khung lá Binh Khí, tên vũ khí / Nguyệt Bảo khi hook chạy, chọn dạng thăng cấp.
### Bước 4e.7 — Mô phỏng + chỉnh số
> `run-playtest` có trang bị (từng vũ khí, từng Nguyệt Bảo, R1 và R5): không món nào làm thắng lượt tăng > 10 điểm ở R1.

## Giai đoạn 5 — PvP (Đấu Trường Công Bằng) và triển khai Internet

> Đặc tả: `17-pvp-coop-spec.md` (đã duyệt 2026-09-30). Kế hoạch chi tiết: `docs/superpowers/plans/2026-09-30-phase5-6-pvp-coop.md` (24 Task).

### Bước 5a.1 — Tài liệu + bộ ghi vàng
> Chốt spec §12; cập nhật `01`, `02`, `04`, `06`, `07`, `CLAUDE.md`. Ghi vàng ~200 trận / lượt PvE **trên code cũ** làm chuẩn so. T213–T215.

### Bước 5a.2 — `PlayerState`
> `CombatState.players[]`, `mode`, `activePlayer`; trường theo người chơi chuyển vào `PlayerState`; `players.ts` truy cập; PvE giống hệt từng bit (T213 xanh).

### Bước 5b.1–5b.5 — Luật PvP
> `pvp-config.json`, `validateDeck` pvp, `buildPvpLoadout`; `createPvpCombat`, lượt luân phiên, bù người đi sau, thời hạn theo lượt, `viewFor`/`redactEvents`, `pvpBot`; mô phỏng bot đấu bot + chỉnh số (duyệt). T216–T230.

### Bước 5c.1–5c.4 — Kết nối realtime
> `@fastify/websocket`, giao thức tin nhắn, phòng trận, Phòng riêng, đồng hồ, kết nối lại, Đấu Tập, Migration 3; client trận mạng. T231–T239.

### Bước 5d.1–5d.3 — Xếp hạng, Vinh Dự, sảnh
> Elo (K40/24, bậc khoa cử), Vinh Dự + Cửa hàng Vinh Dự, hàng chờ xếp hạng, route arena; client Đấu Trường. T240–T244.

### Bước 5e.1–5e.2 — Triển khai Internet
> Cấu hình production, giới hạn tần suất, kiểm `Origin`, sao lưu DB; `deploy/` (Caddy + systemd); triển khai thật cùng người dùng. T245.

## Giai đoạn 6 — Co-op (Liên Thủ)

### Bước 6a.1–6a.5 — Luật co-op
> Tài liệu + nội dung (3 Hợp Kích, Boss *Nguyệt Thực Ma Quân* 4 giai đoạn — duyệt); `coop-config`, `coop-combos`, `phases`, effect `execute`; `createCoopCombat`, lượt đồng thời, mục tiêu co-op; `coopBot`, mô phỏng + chỉnh số (duyệt). T246–T259. *(Đã xong.)*

### Bước 6b.1–6b.2 — Co-op trên server + client
> `coop-room`, hàng chờ / Phòng riêng / đồng đội máy, thưởng co-op (`14` §15); client Liên Thủ (sảnh, màn trận 6 Hero, banner Hợp Kích). T260–T262. *(Đã xong.)*

---

## Giai đoạn 7 — Nội dung: đủ 20 Hero, Cốt truyện, trang bị

Đặc tả: `18-content-spec.md` (khung cả giai đoạn; luật 7a đã đưa vào `01`, `02`, `04`, `06`). Kế hoạch chi tiết 7a: `docs/superpowers/plans/2026-09-28-phase7a-heroes-wave1.md` (10 Task). T213 (ghi vàng PvE) xanh sau mỗi bước.

### Phần 7a — 9 Hero đợt 1

### Bước 7a.1 — Tài liệu 7a *(Task 1)*
> Chốt các điểm làm rõ spec trong `18` §2.2; cập nhật `00`, `01`, `02`, `04`, `06`, `07`, `CLAUDE.md`. *(Đã xong.)*

### Bước 7a.2 — Cơ chế mới *(Task 2–6)*
> `guard` + `hitsIntercepted` + `armorPerTurn`/`interceptArmor`; Chọn Pha (`chooseMoon`, `moonChoicePending`, `autoChoiceAction`, server); lá tạo ra (`createCard`, `token`, `onLevelUp` dạng thường, nội tại `none`); 8 bộ đếm còn lại (2 bộ đếm của cả người chơi); 11 nội tại còn lại + `combatConfig.levelUpRandomBuffs`. T263–T275.

### Bước 7a.3 — Nội dung đợt 1 *(Task 7)*
> M01, M02, M03, M04, F01: `heroes.json`, lá, `pvp-config`, `banners` (duyệt danh sách lá trước). T276 (phần).

### Bước 7a.4 — Nội dung đợt 2 *(Task 8)*
> M07, M08, M10, F08 + 4 lá Song Hành (`18` §2.3, duyệt hiệu ứng trước). T276.

### Bước 7a.5 — Client 7a *(Task 9)*
> Khung Chọn Pha, nhãn `Hộ` + đường nối người hộ vệ, animation lá tạo ra, Hero mới ở màn chọn đội / xếp deck / kho / gacha.

### Bước 7a.6 — Bot, mô phỏng, chỉnh số *(Task 10)*
> Heuristic bot cho cơ chế mới; `run-playtest` ±10 điểm, PvP bot 40–60% / 8–12 vòng; gói chỉnh số (duyệt).

### Phần 7b — Linh Thú + 6 Hero đợt 2

Đặc tả: `18-content-spec.md` §3. Kế hoạch chi tiết:
`docs/superpowers/plans/2026-09-28-phase7b-heroes-wave2.md` (10 Task).

### Bước 7b.1 — Tài liệu 7b *(Task 1)*
> Chốt các điểm làm rõ spec trong `18` §3; cập nhật `00`, `01`, `02`, `04`, `06`, `07`,
> `CLAUDE.md`. *(Đã xong.)*

### Bước 7b.2 — Linh Thú *(Task 2–3)*
> Dữ liệu `summons.json`, `CombatState.summons?`, effect `summon`, hành động cuối lượt
> (§3.3 bước mới); bị nhắm, vòng đời, thức tỉnh, PvP, co-op, `viewFor`. T280–T286.

### Bước 7b.3 — `charm`, `sealIntent`, `revive`, xuyên mục tiêu *(Task 4–7)*
> Trạng thái `charm` + bộ đếm/nội tại M09; effect `sealIntent` + F07; effect `revive` +
> `target: "fallenAlly"` + F10; xuyên mục tiêu + F05. T287–T295.

### Bước 7b.4 — Nội dung đợt 2 *(Task 8)*
> F05, F06, F07, F09, F10, M09 (72 lá) + `summons.json` (Thỏ Ngọc) + 2 lá Song Hành
> (`18` §3.4, duyệt danh sách lá trước); banner; `pvp-config`. T296–T297.

### Bước 7b.5 — Client 7b *(Task 9)*
> Ô Linh Thú cạnh Hero chủ; Hero đã ngã chọn được cho lá Hồi Hồn; animation `summoned` /
> `summonActed` / `summonDismissed` / `heroRevived`; nhãn Mê Hoặc và mũi tên đổi mục tiêu.

### Bước 7b.6 — Bot, mô phỏng, chỉnh số *(Task 10)*
> Heuristic bot cho Linh Thú / Mê Hoặc / Phong Ấn / Hồi Hồn; `run-playtest` ±10 điểm, PvP
> bot 40–60% / 8–12 vòng; gói chỉnh số (duyệt).

### Phần 7c — Cốt truyện Arc 1–2

Đặc tả: `18-content-spec.md` §4. Kế hoạch chi tiết:
`docs/superpowers/plans/2026-09-30-phase7c-story.md` (9 Task).

### Bước 7c.1 — Tài liệu 7c *(Task 1)*
> Chốt các điểm làm rõ spec trong `18` §4 (tier `story`, `CombatSetup.start`,
> `applyStoryResult(setup)`, lỗi route, thưởng lần đầu, `drainMoonPower` trong chiêu
> địch, mục tiêu độ khó); cập nhật `01`, `02`, `03`, `04`, `06`, `07`, `14`, `16`,
> `CLAUDE.md`. *(Đã xong.)*

### Bước 7c.2 — Schema + luật thuần + hồ sơ *(Task 2–4)*
> `story.json` (`StoryArcDef` / `StoryStageDef` / `DialogueLine`, kiểm chéo T300);
> `CombatSetup.start` + `createStoryCombat` / `replayStoryCombat` (T301–T302);
> `profile.story`, `storyStageUnlocked` / `unlockedStageIds`, `applyStoryResult` +
> `StoryRewards` (T303–T304, T307).

### Bước 7c.3 — Server *(Task 5)*
> Migration 4 (`story_tickets`); 4 route `/api/story` (xem `16` §9), `MAX_STORY_ACTIONS
> = 2000`. T305–T306.

### Bước 7c.4 — Nội dung Arc 1 *(Task 6)*
> Kẻ địch mới + boss *Khảo Hạch Chi Linh*, 8 encounter `tier: "story"`, lời thoại
> `before` / `after`, `firstClear` — duyệt bảng trước khi viết JSON.

### Bước 7c.5 — Nội dung Arc 2 *(Task 7)*
> Tương tự Arc 1 + boss *Vô Nguyệt Ảnh Chủ* (duyệt).

### Bước 7c.6 — Client Cốt truyện *(Task 8)*
> Màn Cốt Truyện (arc → màn → thưởng lần đầu), màn Hội Thoại, phiếu + ghi action trên
> client, nối `CombatScene`.

### Bước 7c.7 — Chơi thử và chỉnh độ khó *(Task 9)*
> Bot + tay theo mục tiêu `18` §4.5 (Arc 1 ≥ 80% / boss ≥ 60%; Arc 2 55–75% / boss
> 40–60%; mỗi màn Arc 2 ≥ 60% với đội tốt nhất trong 3 đội mẫu). *(Đã xong —
> phần chơi tay treo, xem `docs/playtest-notes.md` Phase 7c.)*

### Phần 7d — Trang bị bản mệnh + nâng cấp vật liệu

**Giai đoạn 7 đã xong — `docs/18-content-spec.md` đã hoàn thành.**

Đặc tả: `18-content-spec.md` §5. Kế hoạch chi tiết:
`docs/superpowers/plans/2026-09-30-phase7d-gear-materials.md` (7 Task).

### Bước 7d.1 — Tài liệu 7d *(Task 1)*
> Chốt các điểm làm rõ spec trong `18` §5 (`upgradeCost[kind][rarity][level − 1]`,
> `upgradeItem` trả `{ ok, profile, level, spent }` / mã lỗi, `runRewards.darkIron*`,
> route trả `{ profile, rev, level, spent }`, vũ khí F09 Rare); cập nhật `02`, `03`,
> `04`, `06`, `07`, `14`, `16`, `18`, `CLAUDE.md`. *(Đã xong.)*

### Bước 7d.2 — `upgradeItem`, giá nâng cấp, Huyền Thiết từ Lượt chơi, route *(Task 2–3)*
> `rules/src/meta/upgrade.ts` (`upgradeCost`, `upgradeItem`, `UpgradeKind`);
> `economy-config.json` (`upgradeCost`, `runRewards.darkIron*`); `RunRewards.darkIron`;
> `POST /api/profile/weapons/:id/upgrade` và `POST /api/profile/relics/:id/upgrade` qua
> `mutateProfile` (`If-Match` / 428 / 409 / 400). T308–T312.

### Bước 7d.3 — 15 vũ khí bản mệnh *(Task 4)*
> Đề xuất trong `03` §7 trước (duyệt), rồi `weapons.json`: một vũ khí bản mệnh cho mỗi
> Hero 7a/7b, độ hiếm = Hero (F09 → Rare); có *Ngọc Bút* của M01.

### Bước 7d.4 — 8 Nguyệt Bảo + banner *(Task 5)*
> Đề xuất trước (duyệt), rồi `relics.json` + `banners.json` (pool đủ 25 vũ khí / 16
> Nguyệt Bảo). T313.

### Bước 7d.5 — Client nâng cấp *(Task 6)*
> Nút Nâng Cấp trong Kho đồ (`ArmoryScene`): hiện giá, vật liệu đang có, cấp sau nâng;
> chữ lỗi trong `theme.ts`; hiện Huyền Thiết thưởng Lượt chơi.

### Bước 7d.6 — Mô phỏng, chỉnh số, đóng GĐ 7 *(Task 7)*
> `run-playtest` có trang bị (R1 ≤ +10 điểm thắng); `economy-sim` vật liệu + Cốt truyện
> (Epic R1→R5 ~3–4 tuần, Legendary ~6–8 tuần — `18` §5.5); gói chỉnh (duyệt);
> `playtest-notes.md` mục Phase 7d; đóng GĐ 7. *(Đã xong — kết quả và điểm mở xem
> `docs/playtest-notes.md` Phase 7d.)*

---

## Nguyệt Luân mới — Nguyệt Lệnh, pha khởi đầu ngẫu nhiên, Nguyệt tính

**Giai đoạn hiện tại.** Đặc tả:
`docs/superpowers/specs/2026-09-30-nguyet-luan-redesign-design.md`; kế hoạch chi tiết:
`docs/superpowers/plans/2026-09-30-nguyet-luan-redesign.md`. Đứng sau 7c Task 5
(server Cốt truyện), trước nội dung Arc 1–2 (7c.4–7c.5) — pha đầu màn và Nguyệt tính
kẻ địch Cốt truyện viết theo luật mới.

**Tóm tắt:** pha khởi đầu ngẫu nhiên tất định theo seed (không còn cố định pha 1);
mỗi pha một Ưu Đãi Pha cố định (tag −1, Trăng Non `assassin` ×1.5) + đúng **một
Nguyệt Lệnh** bốc trong 3 lệnh của pha bằng luồng RNG phụ (không đổi `rngState`,
`01` §7.6); `CombatSetup.start.moonIndex` / `start.decrees` ghi đè **sau khi đã bốc
đủ**; Nguyệt tính kẻ địch công khai; hai action mới Hủy Bài / Huyết Tế.

### Bước M.1 — Tài liệu luật
> Viết lại `01` §7 (Nguyệt Luân) + các mục liên quan (§2, §3, §5.8–5.9, §9, §10,
> §15, §16); `02` (schema pha + lệnh, `moonDecrees`, action/event mới); `00` §3.3;
> `03` (Nguyệt tính); `04`, `05`, `06` (T314–T325), `16`, `CLAUDE.md`. *(Đã xong —
> commit tài liệu luật.)*

### Bước M.2 — Dữ liệu + schema + tra cứu
> `moon-phases.json`: `tagBonus` + `decrees` (3 lệnh/pha, id duy nhất); bỏ
> `modifiers` cũ của pha; `moonModifierSchema` thêm loại lệnh +
> `DECREE_ONLY_MODIFIERS`; `rollMoon` (luồng RNG phụ), `enterPhase`,
> `currentDecree` / `phaseModifiers` / `decreeModifier`; `CombatState.moonDecrees`,
> `CombatStart.decrees`. T314–T316.

### Bước M.3 — Lệnh modifier số học và đầu lượt
> Ám Dạ, Viên Nguyệt, Phá Giáp, Huyền Giáp, Bóng Mờ, Phản Chấn, Tập Kích
> (`firstHitKeys`), Thế Thủ (`shieldUsed`), Liên Kích (`attackCardsThisTurn` +
> neo chuỗi địch), Nguyệt Sinh, Khai Trí, Mầm Sống, Đoàn Viên, Thế Cân, Thiên
> Bình, Cuồng Nguyệt, Nguyệt Chiếu, Giữ Giáp. T317–T320.

### Bước M.4 — Action mới + server
> `discardCard` / `bloodPact` trong `rules`; Đoạn Tuyệt (`discardDamage`), Luân
> Hồi (`recycleDiscard`), Chiêm Tinh, Bói Nguyệt; schema `combatActionSchema` và
> realtime (`16` §); `viewFor` giữ `moonDecrees`. T321–T323, T325.

### Bước M.5 — Nguyệt tính kẻ địch + bot
> `moonOverrides` mới theo bảng spec §5; `knownIntents` gộp chiêu trăng pha kế
> tiếp; bot: Xả Thân, Huyết Tế, Đổi Vận né pha mạnh của địch. T324.

### Bước M.6 — Client
> Tooltip pha (ưu đãi + lệnh của trận), bỏ dòng "kế tiếp", tooltip kẻ địch có
> Nguyệt tính, nút Hủy Bài / Huyết Tế theo lệnh có hiệu lực (`05`).

### Bước M.7 — Golden, mô phỏng, chỉnh số
> Ghi lại golden T213 một lần (có duyệt — kết quả cũ đổi vì pha khởi đầu ngẫu
> nhiên); phiếu cũ từ chối bằng `409 outdated client` (`dataVersion` đổi);
> mô phỏng lại PvE / PvP / co-op theo mục tiêu spec §10; `playtest-notes.md`.
