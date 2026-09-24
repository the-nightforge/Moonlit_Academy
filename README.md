# Vọng Nguyệt Thư Viện — Bộ tài liệu khởi động

Bộ tài liệu để bắt đầu code **giai đoạn 0 (khởi động) và giai đoạn 1 (prototype chiến đấu offline)**.

## Cách dùng

1. Tạo repo mới, chép toàn bộ thư mục này vào gốc repo.
2. Đặt `CLAUDE.md` ở gốc repo. Nếu dùng Claude Code, file này được đọc tự động; nếu dùng chat, dán nội dung file vào đầu mỗi phiên làm việc.
3. Chép các file trong `data/` vào `packages/data/` sau khi dựng monorepo (bước 0.1 trong kế hoạch).
4. Làm theo `docs/07-implementation-plan.md`, từng bước một.

## Thứ tự đọc

| File | Nội dung | Ai cần đọc |
|---|---|---|
| `CLAUDE.md` | Quy tắc cho AI: công nghệ, cấu trúc, lệnh, điều cấm | AI (mỗi phiên) |
| `docs/00-gdd.md` | Thiết kế tổng thể toàn game | Bạn; AI khi cần bối cảnh |
| `docs/01-combat-rules.md` | **Đặc tả luật chiến đấu chính xác** | AI khi code `packages/rules` |
| `docs/02-data-schema.md` | Kiểu dữ liệu TypeScript, hệ thống hiệu ứng, API của bộ luật | AI khi code `rules` và `data` |
| `docs/03-prototype-content.md` | 3 Hero, 15 lá, 2 kẻ địch, 3 trận, 8 pha trăng (bản dễ đọc của `data/`) | Bạn để balance |
| `docs/04-glossary.md` | Thuật ngữ Việt ↔ tên trong code | AI mọi lúc |
| `docs/05-ui-combat-screen.md` | Bố cục màn hình chiến đấu, tương tác, animation | AI khi code `apps/client` |
| `docs/06-test-scenarios.md` | 40 kịch bản test có kết quả mong đợi | AI khi viết test |
| `docs/07-implementation-plan.md` | Các bước code kèm prompt mẫu | Bạn |
| `docs/08-character-prompts.md` | Lore + prompt art 20 nhân vật | Bạn khi làm art |
| `data/*.json` | Dữ liệu prototype, đúng theo schema | Nạp vào game |

## Thứ tự ưu tiên khi tài liệu mâu thuẫn

`06-test-scenarios` > `01-combat-rules` > `02-data-schema` > `03-prototype-content` > `00-gdd`

Tài liệu càng chi tiết càng được ưu tiên. Khi phát hiện mâu thuẫn, sửa tài liệu trước rồi mới sửa code.
