# Thức Tỉnh bằng khung hình riêng — 2026-10-17

Yêu cầu: tiếp tục nâng chất lượng chuyển động theo định hướng các game gacha,
đặc biệt Honkai: Star Rail, đồng thời giữ Thức Tỉnh ngay trên ô hero.

Tham khảo hình thức trình diễn từ [showcase Feixiao chính thức](https://hsr.hoyoverse.com/en-us/news/125699).
Trang chính thức trả nội dung động khi truy cập; không coi đây là phép đo timing
hay bằng chứng đã phân tích từng khung hình. Không sao chép hình của game tham khảo.

## Thành phẩm

- Đủ 25 bộ hiệu ứng mới, mỗi bộ tám khung thay đổi hình dáng vật thể và chi tiết phụ:
  cánh phượng, lụa, phù chú, lá thuốc, cổng đồng, trang sách, dây đàn và các chủ đề riêng.
- 200 khung trên 25 ảnh WebP lossless, mỗi ảnh 1536 × 1024, lưới bốn cột hai hàng.
  Tổng dung lượng 50.074.332 byte. Nền alpha giữ nguyên qua chuyển đổi.
- Phát hai khung kề nhau với độ mờ bổ sung, kết hợp đường chuyển động Hermite
  liên tục. Hạn chế dịch, xoay và phóng quá mạnh; xuất hiện và tan mềm.
- Chỉ một đồng hồ tween điều khiển cả chuyển động, đổi hero và mờ ảnh cũ.
  Không còn timer riêng có thể lệch một khung so với tween của Phaser.
- Nhịp nội tại 520 mili giây, gấp đôi 260; giảm chuyển động 180 với hình riêng
  của hero và mờ chuyển tại chỗ. Thời gian thực tế có sai số theo nhịp vẽ/khởi tạo tween.
- Giữ toàn bộ tranh hero đúng tỉ lệ, viền sát hình, tên/máu/trạng thái trên hiệu ứng.
  Không thêm popup, giới thiệu, chữ tên dạng, lớp tối toàn màn hay rung máy.
- Nếu atlas thiếu hoặc sai định dạng, dùng minh họa riêng đã có của chính hero.
- Trận đấu tải hiệu ứng theo danh sách hero công khai của cả hai bên. Trang xem thử
  tải theo lựa chọn, chặn phát khi đang tải và giải phóng texture hero cũ sau khi thay ảnh.
- Lỗi trong callback cập nhật tween được chuyển thành promise bị từ chối; tween bị
  gỡ và các lớp ảnh tạm được dọn. Hủy trước/sau đổi dạng không áp dụng sự kiện lần hai.

## Tài nguyên

Dùng công cụ image_gen tích hợp với tranh Thức Tỉnh và hiệu ứng riêng đang có của
từng hero làm tham chiếu trực tiếp. Prompt, nguồn, đường dẫn đích, mã SHA-256 và
kiểm tra alpha của từng khung nằm trong
[hồ sơ tạo hình](../assets/awakening-flipbooks-generated.json).

Đã tạo lại bộ bút mực f12 vì một khung cũ có nét mực che giữa hero. Bản được nhận
có alpha tại tâm bằng không ở cả tám khung. Cả 25 bộ có tám khung khác nhau,
alpha tối thiểu bằng không và alpha tại điểm tâm dưới 32. Đây là kiểm tra số học
bổ sung cho việc xem hình, không thay thế đánh giá nghệ thuật toàn vùng mặt.

![Đối chiếu 25 bộ hiệu ứng cùng tranh của từng hero](assets/2026-10-17-motion-contact.jpg)

## Kiểm tra

- Toàn bộ client: 64 tập, 457 trường hợp qua.
- Typecheck qua. Production build qua; cảnh báo kích thước bundle hiện có vẫn còn.
- Kiểm tra Phaser thật tại 30 khung hình mỗi giây, hai tốc độ: đổi dạng và kết thúc
  ảnh cũ cùng đồng hồ; lỗi refresh không thoát khỏi vòng cập nhật hoặc treo playback.
- Kiểm tra đủ 25 đường chuyển động, liên tục tại các mốc, hòa khung, thiếu hình,
  giảm chuyển động, hủy và sự kiện đúng một lần trong chiến đấu thường, đối kháng, liên thủ.
- Mở renderer thật: cánh phượng ở chế độ chậm kết thúc khoảng 2610 mili giây;
  cổng đồng thường khoảng 550; Ninh An gấp đôi khoảng 269; Tố Nguyệt Nhi giảm
  chuyển động khoảng 190. Đây là quan sát thủ công, không phải benchmark.
- Hủy bút mực trong chế độ chậm trả điều khiển và dọn hiệu ứng.
- Chuyển từ cổng đồng sang cánh phượng rồi quay lại tải cổng đồng vẫn phát và
  kết thúc bình thường (khoảng 542 mili giây); lựa chọn được khóa trong lúc tải
  để các bộ hình cũ không quay lại bộ nhớ sau khi đã dọn.
- Rà soát độc lập phát hiện lệch timer/tween và nhánh lỗi callback; cả hai đã sửa,
  có kiểm tra hồi quy và được rà lại không còn phát hiện cần xử lý.

Chưa đo thiết bị yếu hoặc chơi trọn trận trực tuyến. Chất lượng hiện tại là
hiệu ứng minh họa hai chiều; chưa có cơ sở khẳng định đạt ngang toàn bộ chất lượng
hoạt cảnh ba chiều của Honkai: Star Rail.

Xem chuyển động tại `/test/animation-preview.html`. Ảnh tĩnh dưới đây chỉ xác nhận
bố cục và lớp hình tại thời điểm chụp, không chứng minh độ mượt.

![Cánh phượng phát ngay trên hero trong renderer thật](assets/2026-10-17-premium-awakening.png)
