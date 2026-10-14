# Hoàn thiện màn Liên Thủ

Ngày 2026-10-14. Nhánh `codex/coop-lobby-ui`, tiếp nối review chi tiết tại `9162577`.

## Kết quả triển khai

- Hành động Tìm đồng đội nổi bật hơn hai cách chơi phụ. Bỏ ví tiền khỏi header, thu gọn thưởng và đội hình để thấy trọn nút chơi trên điện thoại. Khi chờ hoặc ở phòng riêng, vùng trạng thái và nút hủy/rời nằm trước đội hình.
- Gom ba portrait thành một nhóm, giới hạn độ rộng desktop; tên đầy đủ nằm dưới hình. Đổi/chỉnh bộ bài nằm cạnh tên đội hình. Trạng thái trống có một hành động phù hợp; deck lỗi hiện lỗi đầu tiên và cho mở toàn bộ lỗi.
- Phần thưởng phản ánh dữ liệu máy chủ: số lượt chưa biết hiển thị dấu —, thưởng đầu ngày chỉ xuất hiện khi xác nhận còn lượt và chưa thắng trong ngày. Phòng riêng/Đấu Tập ghi rõ không có thưởng. Mức 40/3 ghi “Thưởng thắng” để không ám chỉ thua cũng nhận mức đó.
- Nhập mã chuẩn hóa khoảng trắng và chữ thường trước khi kiểm tra sáu ký tự. Popup giữ mã và lỗi tại chỗ; khóa gửi lặp, đóng và Escape trong khi chờ. Chỉ đóng sau khi máy chủ nhận vào phòng hoặc trận bắt đầu.
- Phản hồi sao chép nằm ngay cạnh mã và được giữ qua render không liên quan. Hai slot người chơi thể hiện dữ liệu thật; thông báo tự bắt đầu nằm gần số người.
- Popup chọn bộ bài dùng hàng gọn, ba thumbnail đầy đủ, trạng thái đang dùng và lỗi riêng biệt. Tìm kiếm có nút xóa; desktop focus tìm kiếm, điện thoại không tự mở bàn phím.
- Popup luật gom cơ chế và bảng thưởng, dùng đúng nhãn “Xong lượt”. Nội dung popup cuộn độc lập với header.
- Renderer giữ các vùng DOM không đổi; tick chỉ cập nhật đồng hồ. Nút hủy và focus không bị thay mỗi giây.
- Toàn bộ hình dùng contain, giữ tỉ lệ và border sát hình. Nút có border/radius cả khi khóa; màu tiêu đề nút khóa được kiểm tra sau review cuối. Dùng assets hiện có và một icon bộ bài dạng SVG; không cần sinh bitmap mới.

Các hạng mục trọng tâm LT-01/04/15/16/17/22/25/28/30 và các phần đội hình, popup, phòng chờ đã triển khai. LT-10 về vai trò/trang bị tại chỗ là đề xuất tùy chọn, không thêm popup này trong lượt hoàn thiện sảnh.

## Kiểm chứng

| Kiểm tra | Kết quả |
|---|---|
| `pnpm --filter client test --maxWorkers=1` | 42 file, 344 test đạt |
| `pnpm --filter client typecheck` | Đạt |
| Workspace typecheck trong lượt triển khai | Đạt |
| `pnpm --filter client build` | Đạt; còn cảnh báo bundle lớn của Vite |
| `git diff --check` | Đạt |
| Kiểm tra DOM trên trình duyệt thật | 9/9 đạt |
| Review mã cuối | Đã sửa độ ưu tiên CSS của tiêu đề nút khóa và diễn đạt thưởng thắng; không còn vấn đề cản trở được phát hiện |

Ba kiểm tra mới về thưởng và trạng thái form đã thất bại trước khi triển khai và đạt sau khi sửa. Kiểm tra DOM ban đầu tái hiện bốn lỗi trên bản cũ; bản cuối đạt chín kiểm tra: giữ node/focus khi tick, đồng hồ, chuẩn hóa mã, giữ popup khi pending, chặn Escape/gửi lặp, giữ mã/lỗi và đóng đúng lúc được nhận.

Một lần chạy toàn bộ gặp timeout 5 giây ở test transport có dynamic import nằm trong thân test. Chạy riêng đạt và thời gian biến đổi module tăng trong lượt chạy đầy đủ. Đã chuyển tải module sang bước setup giống test NetSocket hiện có, giữ nguyên assertions và giới hạn timeout. Lần chạy toàn bộ cuối đạt 344/344.

### Bố cục và hình

- Đã xem 375 × 667, 450 × 800, 900 × 720 và 1280 × 720; không tràn ngang ở các trạng thái đã kiểm tra.
- Ở 375 × 667 với deck được chọn thực tế, nút Tìm đồng đội nằm từ khoảng 465 đến 559 pixel, thấy trọn vùng bấm ngay màn đầu. Fixture tên bộ bài tối đa 24 ký tự có đáy nút khoảng 582 pixel; ở 450 × 800 là khoảng 597 pixel.
- Khi queue trên điện thoại, đáy nút hủy khoảng 415 pixel. Phòng riêng có đáy nút rời khoảng 546 pixel.
- Nội dung ba portrait giữ tỉ lệ 2:3 sau khi trừ border thực đo; CSS không đặt vùng chữ/control lên ảnh. Nút chính và icon control có viền và góc bo 12 pixel.
- Đã kiểm tra deck rỗng/hợp lệ/lỗi, tám deck, search, tên dài, thưởng chưa biết/hết lượt, lỗi và thử lại thưởng/chuẩn bị trận bằng renderer fixture. Không coi fixture là dữ liệu tài khoản thật.

### Tương tác có máy chủ

Trong lượt triển khai đã chạy máy chủ thử nghiệm với dữ liệu dùng một lần: chọn/search tám deck, nhập mã không tồn tại, tạo phòng, sao chép mã, tìm/hủy đồng đội và hai tài khoản vào phòng để tự bắt đầu trận. Lỗi mã xuất hiện dưới input, mã được giữ và focus quay lại input. Sao chép thành công vẫn hiển thị khi mở/đóng luật và cập nhật dữ liệu.

Kiểm tra DOM mô phỏng phản hồi hết hạn để xác nhận đường lỗi dùng chung. Chưa kiểm thử riêng mọi phản hồi phòng đầy/sai chế độ trên máy chủ và chưa mở bàn phím ảo trên thiết bị điện thoại thật; không suy rộng kết quả viewport thành xác nhận các tình huống này.

## Ảnh minh chứng

Ảnh desktop, điện thoại, queue và phòng/lỗi mã lấy từ phiên thử với máy chủ. Ảnh luật và hết thưởng dùng fixture renderer, có bộ chọn trạng thái phục vụ kiểm tra.

![Desktop với đội hình đã chọn](coop-lobby-ui/polish/coop-polish-desktop.jpg)

![Điện thoại với nút chơi đầy đủ](coop-lobby-ui/polish/coop-polish-mobile.jpg)

![Lỗi mã giữ ngay trong popup](coop-lobby-ui/polish/coop-polish-room-error.jpg)

![Phòng riêng và phản hồi sao chép](coop-lobby-ui/polish/coop-polish-room-mobile.jpg)

![Hàng chờ và nút hủy](coop-lobby-ui/polish/coop-polish-queue-mobile.jpg)

![Luật và bảng thưởng — fixture](coop-lobby-ui/polish/coop-polish-rules-mobile.jpg)

![Hết lượt thưởng — fixture](coop-lobby-ui/polish/coop-polish-cap.jpg)
