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

Dùng **built-in image_gen**, mỗi ảnh là một lần tạo/chỉnh riêng. Theo phản hồi
“Ảnh gen mới phải có phong cách giống các art cũ”, cả chín ảnh đã được vẽ lại:

- Chân dung lấy m06, f06 và f07 làm tham chiếu phong cách trực tiếp; giữ danh tính riêng của ba nhân vật mới.
- Binh khí lấy `w_bach_ngan_cham`, `w_kinh_hong_phien` và `w_ngoc_but` làm tham chiếu trực tiếp.
- Nét viền rõ, mắt anime, da phẳng, mảng sáng tối gọn, màu trong và nền vẽ sáng; giảm hoa văn li ti và chất liệu gần ảnh thật.
- Dạng Thức Tỉnh dùng cả ảnh cũ cùng loại và chân dung thường vừa chỉnh; giữ khuôn mặt, màu trang phục và binh khí nhận diện.
- Đã chỉnh riêng vị trí hai quạt của Điệp Vũ, tua Thiết Bút Ấn và nhóm bảy phi đao của Thất Diệp Thức Tỉnh.

Tất cả ảnh cuối giữ nguyên **1024 ×1536**, tỉ lệ **2:3**, nền minh họa kín, không chữ
hay viền được vẽ sẵn. Xuất WebP chất lượng 90, effort 6, không cắt, đổi kích thước hoặc
kéo giãn. Bản PNG gốc hiện tại được sao chép vào `.sdd-work/hero-wave3/style-masters/` trong worktree;
bản sinh ban đầu vẫn được giữ trong thư mục generated_images của Codex.

[Prompt đầy đủ, nguồn tham chiếu, đường dẫn cuối và SHA-256](../assets/hero-wave3-generated-assets.json).
Mục `styleRevision` ghi nguồn và mã kiểm tra của 17 ảnh tham chiếu/ảnh sửa; bản chụp
đầu vào lưu trong `.sdd-work/hero-wave3/style-inputs/`. Mục `revisions` giữ thông tin
bộ ảnh trước khi chỉnh phong cách tại commit `d44b420`.
Giữ nguyên mã ảnh hiện có để danh sách nhân vật, chi tiết, chiến đấu và kho đồ nạp qua
manifest tự động. Các lá bài tiếp tục dùng cơ chế hình minh họa hiện tại.

## Kiểm chứng

- Giải mã đầy đủ cả chín WebP, xác nhận kích thước và tỉ lệ giống PNG gốc.
- Chín SHA-256 khác nhau; sáu ảnh nhân vật không còn trùng bản tạm m06, f06 và f07.
- Mỗi mã ảnh có đúng một phần mở rộng trong thư mục tương ứng, tránh trùng khóa texture.
- Kiểm tra trực quan từng ảnh, cặp thường/Thức Tỉnh, khuôn mặt, bàn tay và binh khí.
- Đối chiếu phong cách chân dung: `.sdd-work/hero-wave3/hero-style-comparison.png` (mỗi hàng: tham chiếu cũ, thường, Thức Tỉnh).
- Đối chiếu phong cách binh khí: `.sdd-work/hero-wave3/weapon-style-comparison.png` (mỗi hàng: tham chiếu cũ, ảnh mới).
- `combat-assets.test.ts`: chín kiểm thử đạt sau khi xuất bộ ảnh chỉnh phong cách.
- `pnpm --filter client build`: đạt; Vite có cảnh báo kích thước bundle JavaScript.
- Cả chín đường dẫn có trong manifest đã build; SHA-256 của tệp đã build khớp tệp nguồn.
- Rà soát độc lập cả chín ảnh và hai bảng so sánh không còn phát hiện cần xử lý về phong cách, danh tính hoặc bố cục binh khí; xác nhận đủ bảy phi đao ở chân dung Thất Diệp Thức Tỉnh và ảnh binh khí.

Phạm vi kiểm tra gồm ảnh đã xuất, manifest và bản dựng; chưa kiểm tra tương tác trực tiếp
trong trình duyệt ở đợt bổ sung ảnh này.
