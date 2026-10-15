# Hình nhân vật mới — 2026-10-15

Nhánh `codex/new-hero-art`, dựa trên `7b5cebe`. Thay sáu ảnh tạm của ba nhân vật
mới và bổ sung ba binh khí theo `docs/08-character-prompts.md`, `docs/19-hero-lore.md`
và định nghĩa binh khí trong dữ liệu trò chơi.

## Bộ ảnh

Các đường dẫn bên dưới tính từ `apps/client/public/assets/`.

| Nhân vật | Thường | Thức Tỉnh | Binh khí |
|---|---|---|---|
| Thất Diệp | `heroes/m11.webp` | `heroes/m11_up.webp` | `weapons/w_that_diep.webp` |
| Điệp Vũ | `heroes/f11.webp` | `heroes/f11_up.webp` | `weapons/w_nam_chieu_quat.webp` |
| Hứa Công Chúc | `heroes/f12.webp` | `heroes/f12_up.webp` | `weapons/w_thiet_but_an.webp` |

Thất Diệp dùng áo đỏ thẫm và đen, găng tay đen, phi đao lá bạc và sân thư viện.
Điệp Vũ dùng xanh rêu và vàng, tóc đuôi ngựa, song quạt lưỡi bạc, chuông và ánh bướm.
Hứa Công Chúc dùng quan phục chàm bạc kín đáo, búi tóc gọn, thiết bút, hồ sơ đen và ấn ngọc.
Dạng Thức Tỉnh giữ khuôn mặt, trang phục và binh khí nhận diện của dạng thường.

## Tạo và xuất ảnh

Dùng **built-in image_gen**, mỗi ảnh là một lần tạo/chỉnh riêng. Ảnh thường được chỉnh
theo phong cách anime của m04, f06 và f07; các ảnh tham chiếu chỉ hướng dẫn phong cách,
không thay thế danh tính mới. Đã chỉnh riêng quạt dưới của Điệp Vũ Thức Tỉnh, tua của
Thiết Bút Ấn và tua nhỏ cuối dây Nam Chiếu Tâm Quạt để các chi tiết này nằm trọn trong khung.

Tất cả ảnh cuối giữ nguyên **1024 ×1536**, tỉ lệ **2:3**, nền minh họa kín, không chữ
hay viền được vẽ sẵn. Xuất WebP chất lượng 90, effort 6, không cắt, đổi kích thước hoặc
kéo giãn. Bản PNG gốc được sao chép vào `.sdd-work/hero-wave3/masters/` trong worktree;
bản sinh ban đầu vẫn được giữ trong thư mục generated_images của Codex.

[Prompt đầy đủ, nguồn tham chiếu, đường dẫn cuối và SHA-256](../assets/hero-wave3-generated-assets.json).
Giữ nguyên mã ảnh hiện có để danh sách nhân vật, chi tiết, chiến đấu và kho đồ nạp qua
manifest tự động. Các lá bài tiếp tục dùng cơ chế hình minh họa hiện tại.

## Kiểm chứng

- Giải mã đầy đủ cả chín WebP, xác nhận kích thước và tỉ lệ giống PNG gốc.
- Chín SHA-256 khác nhau; sáu ảnh nhân vật không còn trùng bản tạm m06, f06 và f07.
- Mỗi mã ảnh có đúng một phần mở rộng trong thư mục tương ứng, tránh trùng khóa texture.
- Kiểm tra trực quan từng ảnh, cặp thường/Thức Tỉnh, khuôn mặt, bàn tay và binh khí.
- `combat-assets.test.ts`: cả chín kiểm thử đạt.
- `pnpm --filter client build`: đạt; Vite có cảnh báo kích thước bundle JavaScript.
- Cả chín đường dẫn có trong manifest đã build; SHA-256 của tệp đã build khớp tệp nguồn.
- Bảng xem toàn ảnh để đối chiếu: `.sdd-work/hero-wave3/contact-sheet.png` (mỗi hàng: thường, Thức Tỉnh, binh khí).
- Rà soát độc lập xác nhận đúng mã nhân vật/binh khí, danh tính hai dạng nhất quán và không còn chi tiết binh khí bị cắt mép sau khi chỉnh tua song quạt.

Phạm vi kiểm tra gồm ảnh đã xuất, manifest và bản dựng; chưa kiểm tra tương tác trực tiếp
trong trình duyệt ở đợt bổ sung ảnh này.
