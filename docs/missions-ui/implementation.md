# Triển khai màn hình Nhiệm vụ

Ngày: 13/10/2026. Nhánh `codex/missions-ui`, worktree `missions-ui`.

Đã triển khai thiết kế được duyệt trong [đề xuất](proposal.md). Các tham chiếu Hearthstone và Marvel Snap, phạm vi áp dụng và nguồn gốc ảnh được ghi trong tài liệu đó.

## Thay đổi

- Ba nhóm Hằng ngày, Hằng tuần, Thành tựu; chỉ báo thưởng chờ nhận và thành tựu đã đạt. Tab chuyển sang hàng ngang trên điện thoại.
- Điều kiện, tiến độ, thưởng và hành động nằm trong từng hàng. Nhiệm vụ đủ điều kiện đứng trước; giữ thứ tự khi đang nhận thưởng và giữ vị trí cuộn từng nhóm.
- Icon điều hướng đưa đến chọn đội hình, danh sách Hero hoặc Triệu Hồi. Không thực hiện hoạt động thay người chơi.
- Nút Nhận tất cả chỉ hiện khi nhóm có ít nhất hai thưởng có thể nhận. Gửi từng yêu cầu tuần tự, kiểm tra lại hồ sơ và thời gian trước mỗi lần gửi, giữ số thưởng đã nhận nếu yêu cầu sau thất bại.
- Thành tựu sử dụng kết quả đã được máy chủ cấp, không tạo nút nhận thủ công. Bộ sưu tập lấy số Hero từ dữ liệu hiện hành; điều kiện Cộng Minh không có bộ đếm thì chỉ ghi trạng thái.
- Làm mới hồ sơ khi mở màn, trở lại cửa sổ, kết nối trở lại và đổi kỳ. Có trạng thái cập nhật, nhận thưởng, lỗi, ngoại tuyến và danh sách rỗng.
- Asset icon có sẵn được dùng lại. Ảnh hiển thị đầy đủ đúng tỉ lệ; viền sát ảnh; mọi nút có viền và bo tròn. Không có tooltip lặp lại. Tên điều khiển hỗ trợ đọc màn hình dùng đầy đủ chữ.
- Danh sách cuộn bằng trình duyệt, hỗ trợ bàn phím, khôi phục focus khi render và thu dọn DOM/listener khi rời màn. Phản hồi cũ được chặn theo scene và phiên tài khoản.

`missions-presentation.ts` chuyển dữ liệu thành hàng và điều phối nhận thưởng; `missions-view.ts` quản lý DOM, tab, cuộn và focus; `missions.css` chỉ tác động `.vn-missions`; `missions-scene.ts` nối với API và vòng đời Phaser. Không sửa máy chủ, dữ liệu nhiệm vụ, điều kiện hoặc giá trị thưởng.

## Kiểm chứng

- `pnpm --filter client test`: **317 kiểm tra / 38 tệp qua**, gồm 9 kiểm tra mới về phân loại, đổi kỳ, dữ liệu bộ sưu tập, điều kiện thành tựu, hàng đợi nhận thưởng, lỗi một phần và hủy khi rời màn. Đã quan sát trạng thái thất bại trước khi triển khai.
- `pnpm typecheck`: qua trên toàn workspace.
- `pnpm build`: qua; sau các sửa cuối đã chạy lại typecheck toàn workspace và build client. Vite cảnh báo kích thước bundle lớn, không làm build thất bại.
- `git diff --check`: qua.
- Review độc lập lần hai chấp nhận phạm vi sau khi sửa thứ tự hàng, cuộn từng tab, focus và viền ảnh trong nút Nhận tất cả.
- Trình duyệt thật tại 1280 × 720, 900 × 650 và 450 × 800: không tràn ngang; ảnh tải đầy đủ, đúng tỉ lệ; nút có viền và bo tròn; footer nằm trong viewport.
- Nhận tất cả hai nhiệm vụ ngày qua HTTP thật trên tài khoản kiểm thử cục bộ: Nguyệt Ngọc **2400 → 2440**, đúng hai nhiệm vụ được ghi nhận. Trong khi chờ, nút nhận bị vô hiệu hóa.
- Tab chuyển ngay sau khi nhận, vị trí cuộn thành tựu được giữ khi đổi nhóm và quay lại. Nút điều hướng mở Triệu Hồi và DOM nhiệm vụ được thu dọn. Rời màn khi yêu cầu nhận thưởng đang chờ không dựng lại DOM sau phản hồi trễ.
- Hồ sơ bị đổi revision trên máy chủ: nhận thưởng bị từ chối, số tiền giữ nguyên, hồ sơ cập nhật và thông báo cho phép thử lại. Phiên hết hạn chuyển về đăng nhập.

**Giới hạn kiểm chứng:** lệnh `pnpm test` toàn workspace chưa qua. Data có 50 kiểm tra qua; benchmark rules `portfolio-bench.test.ts > profiles_produce_measurable_style_differences` vượt ngưỡng 360000 mili giây (ghi nhận 752697 mili giây). Các worker benchmark còn lại được dừng sau lỗi để giải phóng CPU. Không kết luận benchmark ở main cũng thất bại; không có thay đổi rules trong nhánh này. Suite server không được chạy tiếp bởi lệnh recursive đó. Trạng thái ngoại tuyến và rỗng chưa được kiểm tra trên trình duyệt production với dữ liệu thực.

## Ảnh giao diện thật

Các ảnh dưới đây chụp client chạy từ worktree, dùng fixture tài khoản kiểm thử qua máy chủ pg-mem; không phải mockup.

![Hằng ngày](implemented-daily.jpg)
![Thành tựu](implemented-achievements.jpg)
![Màn hình 900 × 650](implemented-narrow.jpg)
![Màn hình 450 × 800](implemented-phone.jpg)
![Hồ sơ thay đổi](implemented-error.jpg)
