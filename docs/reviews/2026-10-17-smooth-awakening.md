# Làm mềm Thức Tỉnh — 2026-10-17

Bản hoàn thiện tiếp theo dùng 25 atlas, hòa khung và đồng hồ pha thống nhất:
[Thức Tỉnh bằng khung hình riêng](2026-10-17-premium-awakening.md).

Phản hồi: hiệu ứng còn cứng. Nguyên nhân trong bản trước là ba tween nối tiếp
khởi động lại vận tốc ở mỗi nhịp và biên độ phóng/xoay lớn trong thời gian ngắn.

Thay bằng một đồng hồ chuyển động liên tục. Đường cong Hermite đơn điệu dùng
tiếp tuyến chung ở các mốc nên vị trí, góc và kích thước không bị ngắt vận tốc.
Chỗ đổi hướng thật sự giảm tốc tự nhiên. Giữ 65% biên độ dịch, 45% góc xoay và
35% độ biến thiên kích thước của cấu hình cũ. Độ sáng xuất hiện và tan theo
đường cong có vận tốc/gia tốc bằng không ở đầu/cuối; đỉnh sáng giảm còn 0,82.

Đủ 25 asset và 25 đường chuyển động riêng vẫn được giữ. Không thêm hình vẽ,
không cắt hoặc biến dạng tranh. Nhịp tổng vẫn 520 mili giây, tốc độ gấp đôi
260; giảm chuyển động vẫn chỉ mờ chuyển trong 180 mili giây. Sự kiện đổi dạng
vẫn áp dụng đúng một lần ở mốc tụ lực đã cấu hình. Lớp ảnh cũ mờ đi theo cùng
đồng hồ với hiệu ứng, dưới tên/máu/trạng thái, và được dọn đúng lúc.

Kiểm thử xác nhận độ liên tục vận tốc của vị trí, góc, kích thước, độ sáng và
ảnh cũ ở cả hai ranh giới cho đủ 25 hero; giới hạn biên độ, 25 đường khác nhau,
giảm chuyển động, hai tốc độ, hủy và việc lớp ảnh cũ nhận độ mờ thực sự sau
refresh. Rà soát độc lập không phát hiện lỗi quan trọng; góp ý bổ sung kiểm thử
lớp ảnh cũ đã được xử lý và chạy qua.

Đã mở renderer thật, kiểm tra Phượng Chiêu Dung và Lam Khê, tốc độ thường,
gấp đôi, giảm chuyển động và hủy. Lam Khê kết thúc khoảng 543/299/192 mili giây
tương ứng thường/gấp đôi/giảm chuyển động; đây gồm nhịp vẽ, không phải benchmark.
Chưa chơi trọn trận trực tuyến hoặc đo trên thiết bị yếu.

Ảnh dưới chụp ở chế độ xem chậm để kiểm tra hình; ảnh tĩnh không biểu diễn
độ mượt. Chuyển động xem tại `/test/animation-preview.html`.

![Hiệu ứng Lam Khê với đường chuyển động mới](assets/2026-10-17-smooth-awakening.png)
