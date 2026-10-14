# Background riêng cho chi tiết Cốt Truyện

Ngày 2026-10-14, nhánh `codex/story-ui`, bổ sung sau `e9ddd4a`.

## Thay đổi

Mỗi màn trong hai chương có một cảnh mới bám nội dung trước trận trong `packages/data/story.json`. Chọn màn đổi hình tương ứng trong phần chi tiết. Cảnh được hiển thị trọn vẹn trong border riêng; tên màn, đối thủ, thưởng và nút nằm ngoài ảnh. Đối thủ lấy đúng encounter, nhóm trùng được ghi số lượng. Nếu dữ liệu của một màn mới chưa có cảnh trong manifest, renderer vẫn dùng portrait đối thủ như trước.

Đây là ảnh minh họa cảnh trong vùng chi tiết, không phủ chữ hay control lên background. Ảnh giữ chiều cao tự nhiên, `object-fit: contain`, padding bằng không và border một pixel. Mọi nút tiếp tục giữ border và góc bo. Không thêm tooltip, không viết tắt thuật ngữ người chơi.

## Bộ ảnh và prompt

Sinh bằng **built-in image_gen**, mỗi asset một lần gọi riêng. Không dùng CLI/API fallback hoặc ảnh từ game tham khảo. [Prompt đầy đủ cho 16 ảnh](story-ui/background-prompts.json) ghi cả ID, tên, nguồn dữ liệu, filename gốc và đường dẫn output. [Metadata từng ảnh](story-ui/background-assets.json) ghi kích thước và dung lượng.

Ảnh cuối lưu tại `apps/client/public/assets/story/<stage-id>.webp`. PNG gốc giữ tại thư mục generated_images của Codex. Chuyển định dạng bằng sharp, chất lượng 88, effort 6, không resize/crop: cả 16 ảnh giữ **1774 × 887**, tỉ lệ **2:1**. Tổng PNG 42.908.491 byte → WebP **5.252.384 byte**, giảm **87,76%**.

| ID | Màn | Bối cảnh |
|---|---|---|
| arc1_s01 | Nhập Học | Cổng học viện hé mở, khôi lỗi gác cổng |
| arc1_s02 | Thanh Loan Thí Luận | Sảnh văn chương và mưu lược |
| arc1_s03 | Huyền Vũ Thí Võ | Sân luyện võ, giáp đen và giá giáo |
| arc1_s04 | Bạch Lộ Thí Y | Vườn dược liệu và tiểu hồ ly bị thương |
| arc1_s05 | Cấm Địa Xích Diên | Cửa cấm địa, tro tàn và huyết nguyệt |
| arc1_s06 | Tàng Thư Các Có Ma | Giá sách, trang giấy bay và thư hồn |
| arc1_s07 | Dạ Tập | Rừng trúc ban đêm, ba ảnh hồ phục kích |
| arc1_s08 | Khảo Hạch Chi Linh | Đài khảo hạch trên cao, linh thú cổ đại |
| arc2_s01 | Thư Tín Mất Tích | Phòng thư tín, mật thám trên mái nhà |
| arc2_s02 | Mật Thám | Phòng bỏ hoang bên hồ, dây trói và thư cháy |
| arc2_s03 | Vô Nguyệt Ám Sát | Ba bóng ám sát vượt tường đêm |
| arc2_s04 | Tô Dạ Dao Động | Cuộc đối mặt tại ngưỡng cửa thư viện |
| arc2_s05 | Chợ Đêm Tin Tức | Chợ đêm đèn đỏ, giao dịch bí mật trong sương |
| arc2_s06 | Quan Tinh Đài | Đài thiên văn dưới trời sao, không có trăng |
| arc2_s07 | Hắc Vệ | Hắc giáp canh cửa đường hầm dưới phế tích |
| arc2_s08 | Vô Nguyệt Ảnh Chủ | Đại điện ngầm, bóng đen và trang bản thảo |

## Kiểm chứng mới cho bản này

- **349/349 test client**, 43 file đạt; workspace typecheck và client build đạt. Build còn cảnh báo bundle lớn như trước.
- Thêm kiểm tra DOM đi qua tất cả chương/màn bằng click native, đợi ảnh load, xác nhận 16 nguồn riêng đúng ID, chiều tự nhiên, contain, padding không và border sát tỉ lệ nội dung.
- Kiểm tra asset mới đã thất bại khi chỉ có một phần PNG tạm; đạt khi đủ 16 WebP được đăng ký trong manifest.
- **11/11 kiểm tra trình duyệt đạt** tại 375 × 667, 450 × 800, 900 × 720 và 1280 × 720. Bao gồm cảnh, quyền tiếp tục, màn khóa, focus, thưởng đã nhận, retry, portrait hội thoại, callback, border/radius và live region.
- Không tràn ngang ở bốn kích thước trên. Nút Tiếp tục ở fixture Huyền Vũ Thí Võ có đáy 639,1 pixel tại 375 × 667 và 676,7 pixel tại 450 × 800.
- Kiểm tra thêm màn cuối có tên dài và Quan Tinh Đài có hai nhóm đối thủ trên điện thoại. Cảnh, tên đầy đủ và nút khóa hiển thị trong vùng riêng, không che nhau.
- Fixture mới bắt đầu, chương hai, hoàn thành, đang tải, lỗi và chưa đăng nhập không tràn ngang; các nút hiện diện có border và góc bo.
- Review độc lập kiểm tra diff, metadata, prompt và cả 16 ảnh: không có vấn đề cần sửa.
- Lượt này kiểm tra renderer thực trong trình duyệt với fixture dữ liệu hiện có, không chạy lại trận chiến hoặc API máy chủ. Luồng scene/server không thay đổi. Kiểm chứng API/hội thoại trước đó ghi trong [review Cốt Truyện](2026-10-14-story-ui-review.md).

## Ảnh minh chứng

Bảng điều khiển fixture đã ẩn trước khi chụp.

![Desktop](story-ui/backgrounds/story-background-desktop.jpg)

![Điện thoại](story-ui/backgrounds/story-background-mobile.jpg)

![Cấm Địa Xích Diên](story-ui/backgrounds/story-background-bloodmoon.jpg)

![Quan Tinh Đài](story-ui/backgrounds/story-background-observatory.jpg)

![Quan Tinh Đài trên điện thoại](story-ui/backgrounds/story-background-observatory-mobile.jpg)
