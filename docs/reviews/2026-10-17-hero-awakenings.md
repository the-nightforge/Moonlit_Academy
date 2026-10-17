# Thức Tỉnh riêng cho 25 hero — 2026-10-17

Mỗi hero có một hình hiệu ứng và một cấu hình chuyển động riêng. Giữ Cổng Đồng
của Cừ Trấn Nam và trang điềm báo của Tố Nguyệt Nhi; tạo thêm 23 ảnh mới từ
tranh Thức Tỉnh của đúng hero. Không còn dùng hào quang chung rồi đổi màu.

Hình nhận diện bám kỹ năng: thương lửa, thảo dược, ám khí bóng tối, băng kiếm,
hồ diện, phù Thiên Cơ, thiết bích, quạt và kim tiền, bình thuốc và sen, nguyệt
hoa, huyết mạch, tinh bàn, sách học thuật, huyết phượng, xuyên vân tiễn, lụa
múa, sử bút, thỏ ngọc, hồn đăng, dây đàn, phi diệp, hồ điệp và thiết bút.

Mỗi cấu hình có nhịp tụ lực/chuyển ảnh/tan riêng cùng vị trí, góc xoay, độ bung
và đường chuyển động phù hợp hình đó. Tổng thời lượng là 520 mili giây, hoặc
260 ở tốc độ gấp đôi. Giảm chuyển động dùng đúng hình riêng nhưng chỉ mờ chuyển
trong 180 mili giây. Mã chỉ điều khiển các ảnh minh họa, không vẽ vật trang trí.

Hiệu ứng chạy trong ô nhân vật, dưới tên/máu/trạng thái, giữ nguyên ảnh hero
trong viền ôm sát. Trước khi renderer làm lại các phần tử của ô, lớp hiệu ứng
được tách ra rồi gắn lại dưới các thông số. Mất ảnh hoặc hủy giữa chừng vẫn
không làm kẹt hàng đợi, nhân đôi sự kiện hoặc để ảnh rơi về góc màn hình.

`awakening-profiles.ts` là danh mục bắt buộc cho đủ 25 hero. Thêm hero mới mà
chưa có hiệu ứng sẽ làm kiểm thử độ phủ thất bại. Kiểm thử còn so sánh hash
nội dung 25 ảnh, so sánh 25 timeline thực sự gửi vào runtime, và xác nhận giảm
chuyển động/tốc độ/hủy/tải theo đội hình hai phía. Cả 443 kiểm thử client, kiểm
tra kiểu dữ liệu và bản dựng đều qua. Rà soát độc lập không phát hiện lỗi trong
phạm vi thay đổi.

23 ảnh mới tổng 44.829.882 byte; cùng hai ảnh cũ là 48.794.448 byte. Giữ kích
thước gốc, alpha và mã hóa WebP lossless. Trận chỉ tải hiệu ứng của các hero có
trong đội hình công khai; trang xem thử tải cả bộ để chọn xem từng người.
Hồ sơ tạo ảnh, prompt, nguồn và hash: `docs/assets/awakening-heroes-generated.json`.

Đã kiểm tra toàn bộ ảnh nguồn và bảng ghép tĩnh dưới đây. Bản làm mềm chuyển
động tiếp theo đã kiểm tra lại trong renderer thật với Phượng Chiêu Dung và
Lam Khê; chi tiết ở `2026-10-17-smooth-awakening.md`. Chưa chơi trọn trận trực
tuyến hoặc đo hiệu năng trên thiết bị yếu.

![Đối chiếu tĩnh đủ 25 hero và hiệu ứng riêng](assets/2026-10-17-25-hero-awakenings.jpg)
