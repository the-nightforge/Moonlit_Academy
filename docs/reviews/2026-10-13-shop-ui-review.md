# Rà soát và cải thiện hai màn Cửa hàng

Ngày rà soát: 2026-10-13. Phạm vi: Cửa hàng Nguyệt Tinh, Cửa hàng Vinh Dự, chọn Hero/Nguyệt Bảo, xác nhận mua và các trạng thái giới hạn, thiếu tiền, hết Hero, lỗi kết nối. Triển khai trên worktree `codex/shop-ui`.

## Tham khảo

- [Marvel Snap — Shop Update](https://marvelsnap.com/patch-notes-april-29-2025/) và [Snap Packs](https://marvelsnap.com/mv93gh47z20g/): tham khảo cách phân khu cửa hàng, cho thấy loại tài nguyên và phần thưởng có thể nhận. Chỉ mượn nguyên tắc phân cấp thông tin; không sao chép bố cục hoặc kinh tế của game.
- [Genshin Impact — Paimon's Bargains](https://wiki.hoyolab.com/pc/genshin/entry/11371?lang=en-us): tham khảo việc trình bày giá và số lượng có thể đổi trong kỳ ngay cạnh từng vật phẩm.

## Rà soát từng phần

| Thành phần | Vấn đề ở UI cũ | Thay đổi đã làm |
| --- | --- | --- |
| Đầu trang và hai tab | Hai cửa hàng chia sẻ scene nhưng tiêu đề và hàng văn bản tốn chỗ; khó so sánh số dư. | Dùng cùng một khung, ba số dư có biểu tượng; tab Nguyệt Tinh/Vinh Dự nổi bật và giữ vị trí ổn định. |
| Khối tiền đang dùng | Nguồn nhận và số dư nằm trong một dòng chữ dài. | Số dư lớn đi với biểu tượng tiền, nguồn nhận nằm ở dòng phụ ngắn. |
| Thẻ vật phẩm | Hàng ngang chỉ có chữ, giá và giới hạn chen nhau; Nguyệt Bảo có nhiều nút tên đặt trực tiếp trong hàng. | Mỗi phần thưởng có ảnh đại diện, tên, giá, lượt còn và một hành động; danh sách lựa chọn mở trong hộp riêng. |
| Ảnh và icon | Vật phẩm không có ảnh ở shop cũ. | Tái sử dụng icon Nguyệt Ngọc, Hero, Kho Đồ, tiền, giới hạn, hành động; portrait Hero và ảnh Nguyệt Bảo có sẵn. Ảnh giữ đúng tỉ lệ, hiện toàn bộ và viền sát ảnh. Không cần sinh asset mới. |
| Nút và trạng thái | Lý do không thể mua phụ thuộc tooltip; tình trạng sở hữu hết Hero không rõ trong cùng hàng. | Nút bo tròn và có viền ở mọi trạng thái; lý do “Hết lượt”, “Thiếu …”, “Đã có đủ Hero” hiện ngay trên nút. Tên truy cập đầy đủ được giữ cho icon. |
| Chọn Hero/Nguyệt Bảo | Lựa chọn Hero là hàng nút chữ; Nguyệt Bảo xếp nhiều nút trong hàng mua. | Hộp chọn cuộn, ảnh và tên tách vùng, chỉ Hero chưa sở hữu; Nguyệt Bảo cho biết chưa sở hữu, Cộng Minh kế tiếp hoặc phần bù khi tối đa. |
| Xác nhận | Giá và kết quả sau mua chưa được nhìn cùng lựa chọn cuối. | Hộp xác nhận có vật phẩm đã chọn, giá, số dư sau mua và giới hạn còn lại; phải chọn xong mới bật nút Mua. |
| Dữ liệu và lỗi | Dữ liệu đang xem có thể cũ khi nhiều phiên cùng dùng tài khoản. | Làm mới hồ sơ khi vào shop và quay lại tab; kiểm tra lại giá, lượt, lựa chọn trước khi gửi. Lỗi hồ sơ cũ được làm mới, trạng thái ngoại tuyến khóa giao dịch và có nút cập nhật lại. |
| Màn hẹp | Hàng cố định theo tọa độ không đủ chỗ cho nội dung dài. | Thẻ chuyển thành một cột; danh sách và hộp chọn cuộn độc lập; popup giữ nút quyết định trong khung nhìn. |

Không thêm tooltip lặp lại thông tin. Các nhãn “Epic”, “Rare” là tên bậc phẩm chất trong dữ liệu game, không phải chữ viết tắt. Các thông tin không thể diễn đạt chính xác bằng icon như giá, lượt còn và số dư vẫn dùng chữ đầy đủ.

## Ảnh kiểm tra

- [Nguyệt Tinh đủ điều kiện mua](shop-ui/moon-ready.png)
- [Thiếu tiền](shop-ui/low-balance.png)
- [Hết lượt Vinh Dự](shop-ui/soldout-honor.png)
- [Ngoại tuyến](shop-ui/offline.png)
- [Danh sách trên điện thoại](shop-ui/phone-ready.png)
- [Hộp chọn Nguyệt Bảo trên điện thoại](shop-ui/phone-choice.png)

Kiểm tra trực tiếp ở 1280×720 và 450×800 bằng máy chủ thử nghiệm cục bộ: mua Nguyệt Ngọc, mua Nguyệt Bảo trùng để tăng Cộng Minh, hủy chọn Hero, lỗi hồ sơ cũ, hết lượt, thiếu tiền và ngoại tuyến. Ở 450×800 không có tràn ngang; ảnh trong hộp chọn giữ toàn bộ ảnh gốc và viền sát mép; mọi nút (kể cả vô hiệu hóa) có bo góc và viền.
