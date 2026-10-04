# Bộ icon PNG — 2026-10-04

Đã tạo 47 icon PNG riêng bằng công cụ OpenAI image_gen tích hợp, theo phong cách anime fantasy 2D và bảng màu chàm, vàng, ngà, màu đá quý của game. Đây là minh họa mới được tạo từ prompt, không phải raster hóa SVG cũ và không dùng model Leonardo.ai.

## Thành phẩm

- Icon dùng trong game: `apps/client/public/assets/ui/*.png`, 47 file, mỗi file 256×256, có alpha trong suốt. Tổng dung lượng 3,530,969 byte.
- ZIP: [vong-nguyet-ui-icons-png.zip](../output/imagegen/vong-nguyet-ui-icons-png.zip), chứa đúng 47 PNG.
- Bảng xem trước ở cỡ 112px, 48px và 24px: [ui-icons-preview.png](../output/imagegen/ui-icons-preview.png).
- Toàn bộ prompt, nguồn ảnh tạo, kích thước và SHA-256: [ui-png-icons-2026-10-04.json](assets/ui-png-icons-2026-10-04.json).
- Ảnh QA trong trận đấu: [combat-png-icons.png](../output/imagegen/combat-png-icons.png).

Các nhóm gồm 13 trạng thái, 9 pha trăng, 6 ý đồ địch, 5 tiền tệ, 5 điểm bản đồ và 9 icon chức năng. Bản xuất dùng sharp để trim, thu ảnh vào vùng 216×216 và thêm lề alpha 20px mỗi cạnh; ảnh tạo gốc được giữ trong `.sdd-work/ui-png-icons/originals`.

## Nạp vào game

Manifest trong `apps/client/vite.config.ts` ưu tiên PNG khi có cùng tên với SVG, độc lập thứ tự đọc thư mục. Giữ khóa texture hiện có. Loader chiến đấu đã hỗ trợ PNG qua `load.image`; VFX charm dùng chiều rộng texture nguồn để giữ kích thước 14px. Các SVG gốc vẫn được giữ trong repository.

## Kiểm chứng

- 47/47 ảnh có kích thước 256×256, alpha thật ở cả nguồn và bản xuất, có vùng nhìn thấy và vùng hoàn toàn trong suốt.
- Đã xem toàn bộ bảng icon trên nền tối ở 24px, 48px và 112px; đã xem ảnh trận đấu ở 1280×720.
- `pnpm --filter client test`: 23 file, 225 test qua.
- `pnpm --filter client typecheck`: qua.
- `pnpm --filter client build`: qua; có cảnh báo bundle lớn hơn 500kB.
- `ui-png-icons.spec.ts`: 1 test trình duyệt qua. Kiểm tra manifest, phản hồi HTTP 200/image/png và texture 256×256 thực tế cho cả 47 icon, glyph trên bài 24px và hạt charm 14px.
- Test trình duyệt đầu tiên lỗi vì giả định `Image.src` chứa URL gốc; Phaser thực tế giải mã ảnh XHR qua blob URL. Đã sửa bài test để kiểm tra phản hồi mạng PNG cùng texture thực tế; không thay đổi production để né lỗi test.
- Review độc lập hai phần nạp ảnh/kích thước VFX: không phát hiện lỗi cần sửa. Báo cáo và log thô ở `.sdd-work/ui-png-icons/`.
- ZIP có đúng 47 mục PNG; `git diff --check` qua.

Không thực hiện stage, commit hoặc push trong tác vụ này.
