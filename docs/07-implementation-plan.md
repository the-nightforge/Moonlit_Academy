# 07 — Kế hoạch code (Giai đoạn 0–4d)

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

Đặc tả: `09-phase2-spec.md`. Luật đã đưa vào `01` (các mục **[GĐ2]**), kiểu dữ liệu vào `02`, test vào `06` (T61–T95).

### Bước 2.1 — Cập nhật tài liệu
Đưa đặc tả `09` vào `01`, `02`, `04`, `05`, `06`, `07`. *(Đã xong.)*

### Bước 2.2 — Schema và dữ liệu
> Đọc `02-data-schema.md` (các mục GĐ2) và `09-phase2-spec.md` mục 1, 4.1, 5, 6. Mở rộng type trong `packages/rules/src/types/` và schema zod: tag `scheme`/`ward`/`harmony`, status `reflect`, effect `stealBuff`/`bloodMoon` + `actor`, condition `bloodMoonActive`, `CardDef.bond`/`requiresBloodMoon`, `CardInstance.ownerIds`, counter/passive mới, `EnemyDef.bloodMoonOverride`, event `bloodMoonChanged`, `hpLost.cause` mới. Thêm các kiểm tra chéo GĐ2 ở `02` mục 6. Thêm dữ liệu: F03, F02, 13 lá mới, gắn tag 4 lá cũ, `costModifierForTag` cho `full`/`lastQuarter`, boss `moon_ape`, `enc_04`, `strength 1` cho Thủ Thế. Đổi code đang dùng `ownerId` sang `ownerIds` nhưng **chưa** thêm luật mới (effect mới có thể `throw` "not implemented"). Làm test T94; toàn bộ T01–T60 vẫn pass (sửa test bị ảnh hưởng bởi Thủ Thế nếu có).

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

Đặc tả: `10-phase3-spec.md`. Luật: `01` §13 (Kỳ Vật), `11-run-rules.md` (lượt chơi). Test: `06` T96–T127. Kế hoạch chi tiết: `docs/superpowers/plans/2026-09-24-phase3-roguelike.md`.

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

Đặc tả: `12-phase4a-spec.md`. Luật đã đưa vào `01`, schema vào `02`, thuật ngữ vào `04`, test vào `06` (T128–T148). Mỗi bước gom thay đổi luật cùng phần data phụ thuộc để `pnpm test` xanh sau từng bước.

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

Đặc tả: `13-phase4b-spec.md`. Luật đã đưa vào `01` (từ khóa), `14` (hồ sơ / Tu Luyện / deck), schema vào `02`, thuật ngữ vào `04`, test vào `06` (T149–T168). Kế hoạch chi tiết: `docs/superpowers/plans/2026-09-26-phase4b-pools-mastery-decks.md`. Mỗi bước gom thay đổi luật cùng phần data phụ thuộc để `pnpm test` xanh sau từng bước.

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

Đặc tả: `15-phase4-spec.md` (§2). Luật hồ sơ / lượt chơi có xác nhận vào `14`, server và API vào `16` (mới), thuật ngữ vào `04`, test vào `06` (T173–T182). Kế hoạch chi tiết: `docs/superpowers/plans/2026-09-27-phase4c-server-accounts.md`. Thư viện đã duyệt: `fastify`, `better-sqlite3`, `@types/better-sqlite3`.

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

Đặc tả: `15-phase4-spec.md` §3. Luật vào `14` (§5–§12), `01` §8 (Tinh Hồn 2, 4), API vào `16` §4.1, thuật ngữ vào `04`, test vào `06` (T183–T196). Kế hoạch chi tiết: `docs/superpowers/plans/2026-09-28-phase4d-economy-gacha.md`. Tinh Hồn 5 (dạng thăng cấp thứ hai) dời sang 4e.

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

Đặc tả: `15-phase4-spec.md` §4. Luật: `01` §8, §14; `14` §3.1, §10.1, §12–§13; dữ liệu `02` §1.12; nội dung `03` §7; API `16` §4.2; test `06` (T197–T212). Kế hoạch chi tiết: `docs/superpowers/plans/2026-09-29-phase4e-gear.md`.

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

## Sau giai đoạn 4e

- Giai đoạn 5–6: đặc tả `17-phase5-6-spec.md` (bản nháp, chờ duyệt); các bước thêm vào đây khi duyệt.
