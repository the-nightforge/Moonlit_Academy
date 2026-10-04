# Chỉnh UI chiến đấu — 04/10/2026

Đã sửa trên checkout hiện tại theo bảy yêu cầu mới nhất:

- Bỏ trái tim và số HP ở góc chân dung. Giữ thanh HP hiện tại/tối đa, giáp, trạng thái và hiệu ứng chiến đấu; triệu hồi cũng có số HP trên thanh.
- Dời thanh Đổi Bài lên phần đầu màn hình, tách khỏi vùng lá bài. Chọn đổi và trạng thái chờ đồng đội vẫn hoạt động.
- Xóa nền giấy miêu tả cũ khỏi khung bài được vẽ bằng canvas. Giữ một nền giấy mới, tên chủ bài và tối đa ba dòng miêu tả trước dấu “…”.
- Thu nhỏ biểu tượng loại bài còn 24px, ảnh trong vòng còn 36px và vòng trang trí tương ứng. Số Nguyệt Lực vẫn đọc được.
- Căn tên hero và tiến độ Thức Tỉnh trên cùng hàng; dành chỗ riêng cho hai phần. Chuyển biểu tượng vũ khí lên góc trái phía trên, giữ đúng điểm hiệu ứng vũ khí.
- Tooltip hero có tên, mô tả hai dạng nâng cấp, dạng đang chọn và tiến độ theo ngưỡng thực tế. Nội dung dài có thể cuộn.
- Tạm bỏ bảng tám pha trăng. Tooltip icon hiện tại ở giữa phía trên hiển thị pha hiện tại và pha kế tiếp, cùng Nguyệt Lệnh đã được game xác định; pha cuối quay về pha đầu.

Kiểm chứng: 224/224 test client, typecheck và build pass. Hai ca trình duyệt 1280×720 và 1024×576 pass, bao gồm chọn đổi bài bằng chuột, HP triệu hồi, bố cục footer, mô tả ba dòng, tooltip hai dạng nâng cấp, pha 7→0, dọn listener cuộn và co-op. SHA256 của 110 file public không đổi.

Test pha kế tiếp có bằng chứng thất bại trước sửa và pass sau sửa. Phép kiểm tra chồng lấn có kết quả sau sửa; không có ảnh/log kiểm tra tự động chồng lấn trước sửa. Ba lỗi harness ban đầu đã được phân biệt và sửa: đo nhầm độ dài tên ngắn, fixture lặp vũ khí không hợp lệ và helper truy cập game quá sớm khi khởi động. Không thay đổi source sản phẩm sau khi chốt để chạy kiểm chứng.

Ảnh tooltip pha trăng ở 1024×576:

![Pha hiện tại và pha kế tiếp](D:/Source/VongNguyet/.sdd-work/combat-ui-refinement/moon-current-next-1024.png)

Ảnh tooltip hai dạng nâng cấp hero ở 1024×576:

![Tooltip nâng cấp hero](D:/Source/VongNguyet/.sdd-work/combat-ui-refinement/hero-alt-1024.png)

Ảnh thanh Đổi Bài đã tách khỏi lá bài:

![Đổi Bài](D:/Source/VongNguyet/.sdd-work/combat-ui-refinement/mulligan-picked-1024.png)

Ảnh footer hero nhỏ trong co-op:

![Hero co-op](D:/Source/VongNguyet/.sdd-work/combat-ui-refinement/coop-footer-1024.png)

Log và báo cáo chi tiết được lưu trong `.sdd-work/combat-ui-refinement/`. Chưa commit thay đổi.


Review độc lập: SPEC PASS / QUALITY PASS, không có lỗi sản phẩm cần sửa trong phạm vi đã review. [Báo cáo review](D:/Source/VongNguyet/.sdd-work/combat-ui-refinement/final-review.md). Hai ca kích thước màn hình pass ở các lượt chạy riêng. Kiểm tra cuộn dùng sự kiện input trong cảnh Phaser; không khẳng định đã thử chuột cuộn thực tế cho mọi miêu tả tương lai.
