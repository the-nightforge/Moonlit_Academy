# CLAUDE.md — Hướng dẫn cho AI

## Dự án
**Vọng Nguyệt Thư Viện**: webgame thẻ bài cổ phong 2D. Hero Deckbuilder (3 Hero + deck 20 lá), cơ chế Nguyệt Luân (8 pha trăng thay đổi luật), sau này có gacha, co-op realtime và PvP. Dự án cá nhân, không có thanh toán.

**Giai đoạn hiện tại:** 4c — server + tài khoản, hồ sơ lưu trên server, server chạy lại lượt chơi để trao thưởng (`docs/15-phase4-spec.md`, `docs/16-server-api.md`). Chưa làm gacha (4d), trang bị (4e), PvP, co-op.

## Công nghệ
- TypeScript (strict) cho toàn bộ dự án
- pnpm workspaces (monorepo)
- `apps/client`: Vite + Phaser (bản ổn định mới nhất)
- `packages/rules`: TypeScript thuần
- `packages/data`: JSON + schema zod để kiểm tra dữ liệu khi nạp
- `apps/server`: Node + Fastify + SQLite (better-sqlite3), bundle bằng Vite SSR build
- Test: Vitest

## Cấu trúc
```
vong-nguyet/
├── CLAUDE.md
├── docs/                 # tài liệu thiết kế (đọc, không sửa trừ khi được yêu cầu)
├── packages/
│   ├── rules/            # bộ luật chiến đấu
│   │   ├── src/
│   │   └── test/
│   └── data/             # heroes.json, cards.json, enemies.json, encounters.json, moon-phases.json + schema
└── apps/
    ├── client/           # Phaser: hiển thị, input, animation
    └── server/           # Fastify + SQLite: tài khoản, hồ sơ, phiếu lượt chơi
```

## Lệnh
```
pnpm install            # cài đặt
pnpm dev                # chạy client (Vite) và server song song
pnpm --filter server dev   # chỉ server (cổng 8787)
pnpm --filter server test
pnpm test               # chạy toàn bộ test
pnpm --filter rules test
pnpm typecheck
```

## QUY TẮC BẮT BUỘC

1. **`packages/rules` là code thuần logic.** Không import Phaser, DOM, `window`, network, file system. Không dùng `Math.random()`, `Date.now()`.
2. **Mọi yếu tố ngẫu nhiên dùng RNG có seed**, trạng thái RNG nằm trong `CombatState`. Cùng seed + cùng chuỗi hành động phải cho ra kết quả giống hệt.
3. **Hàm thuần, không mutate:** `applyAction(state, action)` trả về state mới + danh sách event. Không sửa state đầu vào.
4. **Client không tự tính luật.** Client chỉ gửi `Action`, nhận `CombatEvent[]` rồi phát animation theo thứ tự. Mọi con số hiển thị lấy từ state.
5. **Nội dung nằm trong dữ liệu.** Không hardcode số liệu lá bài, Hero, kẻ địch trong code. Hiệu ứng mới = thêm loại `Effect` trong schema + xử lý trong `rules` + test.
6. **Luật tuân theo `docs/01-combat-rules.md`.** Nếu tài liệu không nói rõ, DỪNG LẠI và hỏi, không tự đoán. Nếu thấy tài liệu mâu thuẫn, báo lại.
7. **Test trước khi báo xong.** Mọi thay đổi trong `rules` phải có test, ưu tiên các kịch bản trong `docs/06-test-scenarios.md` (đặt tên test theo mã, ví dụ `T11`). Chạy `pnpm test` và `pnpm typecheck` trước khi kết thúc.
8. **Làm từng bước nhỏ.** Mỗi lần chỉ làm một bước trong `docs/07-implementation-plan.md`. Không tự làm trước các giai đoạn sau (server, gacha, PvP...).
9. **Server là trọng tài của hồ sơ.** Tiến độ, thưởng, kho đồ chỉ đổi trên server, bằng cách gọi hàm thuần trong `packages/rules/src/meta/` (server truyền `now` và seed vào). Server không tự tính luật; thưởng lượt chơi chỉ trao sau khi `replayRun` xác nhận. Client không tự sửa hồ sơ.

## Quy ước
- Code, tên biến, comment: **tiếng Anh**. Chữ hiển thị cho người chơi: **tiếng Việt**, lấy từ dữ liệu.
- Thuật ngữ: theo đúng `docs/04-glossary.md`. Không tự đặt tên khác cho cùng một khái niệm.
- ID dữ liệu: `snake_case` chữ thường (`m05`, `m05_liet_hoa_xung_phong`, `puppet_guard`).
- Kiểu dữ liệu và hàm: `PascalCase` cho type, `camelCase` cho hàm/biến.
- Ưu tiên union type có trường `type` (discriminated union) cho `Effect`, `Action`, `CombatEvent`, và `switch` đầy đủ với kiểm tra `never`.
- Không thêm thư viện mới khi chưa hỏi. Đã duyệt: `fastify`, `better-sqlite3`, `@types/better-sqlite3`, `@types/node` (chỉ trong `apps/server`).

## Khi hoàn thành một bước
Báo lại ngắn gọn: đã làm gì, file nào thay đổi, test nào đã thêm, kết quả `pnpm test`, và điểm nào trong tài liệu còn mơ hồ.
