# Triển khai màn hình Tu Luyện

Ngày 13/10/2026. Worktree `mastery-ui`, nhánh `codex/mastery-ui`.

Đã triển khai [thiết kế được duyệt](proposal.md) vào game: Hero có cuộn, sáu lá có hình, chi tiết và từ khóa luôn đọc được khi chọn; hành động mở tập trung ở cột chi tiết. Bố cục điện thoại chuyển thành thanh Hero ngang và nội dung dọc.

`mastery-presentation.ts` tính kinh nghiệm trong cấp, chọn Hero/lá hợp lệ và điều phối xác nhận/gửi. `mastery-view.ts` giữ cuộn, lựa chọn, focus, dialog; `mastery.css` chỉ tác động `.vn-mastery`; scene nối với API và thu dọn theo vòng đời Phaser. Dùng lại artwork và icon hiện có, fallback cùng `cardArtCandidates`, không thêm chi phí hoặc sửa economy/server/data.

- Xác nhận hiển thị lá, Hero, dùng một lượt và số còn lại. Kiểm tra lại điều kiện sau xác nhận; khóa gửi trùng, cập nhật theo hồ sơ máy chủ.
- Pending khóa điều khiển chọn/mở; focus chuyển về lưới có thể nhận focus. Lỗi revision cập nhật hồ sơ, giữ lá đang chọn và cho thử lại. Mất kết nối khóa nút mở và có nút cập nhật.
- Kinh nghiệm lấy mốc dữ liệu thật; cấp tối đa vẫn giữ lượt chưa tiêu. Hero không sở hữu bị loại; mô hình xử lý hồ sơ không có Hero.
- Popup dùng dialog native; ảnh luôn đủ hình và đúng tỉ lệ trong viền sát. Các nút có viền bo tròn, tên truy cập đầy đủ. Chữ máu và kinh nghiệm viết đầy đủ, không tooltip lặp lại.
- Thông báo lá đã mở và thành tựu nối cách nhau; cuộn từng Hero/lá được giữ. Rời màn loại DOM/listener, khôi phục `body.overflow`, chặn phản hồi giao diện từ scene/phiên cũ.
- Điều hướng xếp bộ bài đi đến màn chọn bộ bài hiện có; không tự thay các bộ bài đã lưu.

## Kiểm chứng

- **326 kiểm tra client / 39 tệp qua**, gồm 9 kiểm tra mới về chọn Hero/lá, kinh nghiệm trong cấp, trần lượt mở và Tinh Hồn, hồ sơ rỗng, kiểm tra lại sau xác nhận, chống gửi trùng, lỗi, mất kết nối và rời scene.
- `pnpm typecheck` và `pnpm build` toàn workspace qua. Build có cảnh báo kích thước bundle Vite, không làm build thất bại.
- `pnpm test` toàn workspace: **50 data**, **814 rules** và **326 client qua**; 4 kiểm tra rules được bỏ qua bởi cấu hình sẵn có. Benchmark portfolio đã qua trong lượt này.
- **Suite server chưa qua:** lượt toàn workspace có hai timeout 5000 mili giây, ở kiểm tra giới hạn đăng ký và tái dựng PvP replay. Chạy riêng suite server có 12 timeout; chạy lại với một worker và không song song tệp có **15 timeout / 53 kiểm tra qua**. Giữ nguyên mã và giới hạn thời gian; không khẳng định đây là lỗi có sẵn ở main hay kết luận nguyên nhân đã được giải quyết. Danh sách cuối được ghi ở [server-test-timeouts.md](server-test-timeouts.md).
- Review độc lập không còn finding quan trọng trong phạm vi đã xem sau sửa fallback focus khi nút bị disabled và cách nối thông báo thành tựu. Review không thay thế kiểm chứng HTTP và hình ảnh.
- Game thật qua máy chủ pg-mem với tài khoản thử riêng: mở Nộ Hỏa Liên Hoàn tăng số lá **1 → 2**, lượt **2 → 1**, kinh nghiệm vẫn 345, revision **2 → 3**. Máy chủ cấp 400 Nguyệt Ngọc thành tựu theo fixture sở hữu 20 Hero; đây là thưởng từ server, không phải chi phí/thu nhập UI tự đặt.
- Đã quan sát pending: Hero/lá/nút mở disabled và focus ở lưới. Hồ sơ đổi revision: lỗi hiện rõ, lá không được cấp, hồ sơ tải lại và giữ lựa chọn. Gateway kiểm thử 503: ngoại tuyến khóa nút; sau kết nối phục hồi tải được cấp tối đa và lượt còn lại.
- Đã mở ở **1280 × 720**, **900 × 650**, **450 × 800**; không tràn ngang, ảnh tải đủ, nút giữ viền và bo tròn. Điện thoại có cuộn dọc/nhóm Hero ngang; popup và hủy được kiểm tra, số lượt giữ nguyên. Rời màn: không còn `.vn-mastery`, `body.overflow` trở lại giá trị ban đầu.
- Trạng thái không có lượt được kiểm tra trên game thật. Mô hình rỗng được kiểm tra bằng unit và bản đề xuất; server chuẩn hóa fixture không có Hero thành ba Hero khởi đầu, nên không coi fixture đó là kiểm chứng màn rỗng production.

Ảnh dưới đây là client thật của worktree, dùng fixture tài khoản cục bộ; không phải mockup. Chưa kiểm tra thiết bị cảm ứng vật lý hoặc screen reader thực tế.

![Tu Luyện](implemented-ready.jpg)
![Xác nhận](implemented-confirm.jpg)
![Hồ sơ đổi revision](implemented-error.jpg)
![Ngoại tuyến](implemented-offline.jpg)
![900 × 650](implemented-narrow.jpg)
![Điện thoại](implemented-phone.jpg)
![Popup điện thoại](implemented-phone-confirm.jpg)
![Chi tiết điện thoại](implemented-phone-detail.jpg)
![Thiếu lượt mở](implemented-no-unlocks.jpg)
