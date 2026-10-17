# Chuyển động tham khảo game gacha — 2026-10-17

Yêu cầu: tham khảo animation của các game gacha nổi tiếng về đồ họa để cải thiện
Vọng Nguyệt. Thực hiện trên main, chỉ thay phần trình bày client. Hai tệp
`packages/data/cards.json` và `packages/data/pvp-config.json` đang được chỉnh
riêng, không thuộc commit này.

## Tham khảo và lựa chọn

| Nguồn | Điều rút ra cho Vọng Nguyệt |
|---|---|
| [Epic Seven, trang giới thiệu của Smilegate](https://store.steampowered.com/app/5129800/) mô tả kỹ năng lớn bằng hoạt cảnh 2D vẽ từng khung | Dành một nhịp giới thiệu rõ danh tính và dạng Thức Tỉnh, khác với đòn thường. Vọng Nguyệt dùng nguyên ảnh hiện có và họa tiết riêng để phù hợp bộ tài nguyên hiện tại. |
| [Honkai: Star Rail — Keeping Up With Star Rail, March 7th](https://www.youtube.com/watch?v=6XBLR6cCPtI) là nguồn tham khảo trình bày nhân vật/kỹ năng | Giữ tên, màu và vật dụng nhận diện khi tạo điểm nhấn. Đây là định hướng thiết kế của bản này; không tuyên bố sao chép góc máy hay đo thời gian từng khung video. |
| [Reverse: 1999 — trang giới thiệu và dàn nhân vật chính thức](https://re1999.bluepoch.com/en/home/) | Tham chiếu cách dành không gian rõ cho tranh nhân vật. Chuyển động áp lên cả khung chứa ảnh; không biến ảnh tĩnh thành rig giả hoặc cắt khuôn mặt. |

Các thời lượng dưới đây là lựa chọn thiết kế riêng cho game, không phải số đo từ
video tham khảo. Không tải hay đưa tài nguyên của các game tham khảo vào dự án.

## Đã triển khai

| Phần | Trước | Sau |
|---|---|---|
| Thức Tỉnh | Khung giới thiệu lớn, tên nhân vật/dạng, nền tối và họa tiết dựng bằng mã | Đổi ảnh ngay trên ô hero, không mở khung giới thiệu, thêm chữ, làm tối toàn màn hay rung camera. Tên, máu và trạng thái của ô vẫn hiện ổn định phía trên ảnh. Cừ Trấn Nam dùng Cổng Đồng; Tố Nguyệt Nhi dùng trang điềm báo; các hero còn lại dùng hào quang đổi sắc theo kỹ năng. |
| Nhịp Thức Tỉnh | Giới thiệu 660 mili giây | Tụ lực 120, chuyển ảnh 160, tan sáng 240: tổng 520 mili giây; tốc độ gấp đôi còn 260. Giảm chuyển động chỉ mờ chuyển 60+100+20, tổng 180 mili giây, không dịch/phóng/xoay. |
| Trúng đòn | Rung ngang cố định nhiều lần | Giật lùi theo hướng từ nguồn đánh, tăng theo sát thương thực tế và giới hạn tối đa 10 pixel. Đỡ hết không bị đẩy lùi; giảm chuyển động chỉ đổi độ sáng nhẹ. |
| Đòn liên tiếp | Tween trực tiếp lên lá nhân vật | Proxy có quyền sở hữu riêng, hồi đúng vị trí/độ sáng; hiệu ứng cũ không ghi đè đòn mới. Bàn giao trước gục ngã, hồi sinh, hành động tiếp theo và biến mất của Linh Thú. |
| Vào Cốt Truyện, Tầm Nguyệt, Cửa hàng | Toàn màn cùng mờ vào | Các vùng nội dung xuất hiện lệch nhau 35 mili giây, tối đa sáu vùng, mỗi vùng 220 mili giây và dịch 6 pixel. Chỉ chạy một lần lúc vào màn, không lặp khi lọc/mua/cập nhật tiến trình. |

Tận dụng các ảnh `heroes:*_up`, giữ nguyên tỉ lệ và toàn bộ hình trong viền ôm sát.
Ba ảnh hiệu ứng mới có alpha trong suốt được tạo từ ảnh tham chiếu m12/f13 cùng
phong cách; thông tin nguồn và hash ở `docs/assets/awakening-effects-generated.json`.
Không dùng hình học dựng bằng mã làm vật trang trí. Chỉ tải hào quang chung và
hiệu ứng riêng tương ứng đội hình công khai của cả hai phía; ba ảnh tổng khoảng
5,55 megabyte, giữ WebP lossless và alpha gốc.

Sự kiện Thức Tỉnh cập nhật trạng thái trình bày đúng một lần sau tụ lực; ảnh cũ
được chụp lại bằng thông tin texture/kích thước, tránh giữ ảnh đã bị renderer hủy.
Ảnh chuyển nằm dưới tên/máu/trạng thái. Thiếu ảnh hoặc ô nhân vật vẫn áp dụng
sự kiện, không mở khung trống hay thay bằng chữ. Hiệu ứng tạm được dọn khi hoàn
tất, hủy cảnh hoặc kết nối lại. Luật, dữ liệu trận, RNG và mạng giữ nguyên;
số sát thương vẫn cập nhật đúng điểm chạm.

## Kiểm tra

- 60 tệp kiểm thử client, 438 ca đều qua trên lượt cuối.
- Kiểm tra riêng nhịp đòn, trình tự sự kiện, hủy trước/sau điểm chạm, gục ngã/hồi
  sinh, hai tốc độ, giảm chuyển động, đòn liên tiếp và bàn giao quyền chuyển động.
- Typecheck client và bản dựng production thành công. Cảnh báo gói JavaScript
  lớn sẵn có vẫn còn; chưa có phép đo tốc độ khung hình hoặc kiểm tra thiết bị yếu.
- Rà soát độc lập bản Thức Tỉnh tại chỗ không phát hiện lỗi Critical, Important
  hoặc Minor trong phạm vi thay đổi; hash ba asset khớp hồ sơ.
- Đã mở renderer thật tại `/test/animation-preview.html` trong trình duyệt, xem
  Cừ Trấn Nam và Tố Nguyệt Nhi, kiểm tra ảnh đủ trong khung và nút mở lại sau khi
  kết thúc. Trang này gọi cùng helper production, có đủ 25 lựa chọn hero.
  Đã kiểm tra trực quan m12, f13 và Hoắc Liệt, tốc độ gấp đôi (khoảng 324 mili
  giây thực), giảm chuyển động (khoảng 239 mili giây thực) và hủy giữa chừng.
  Các thời gian thực có nhịp vẽ, không phải benchmark. Ảnh chụp dùng chế độ
  xem chậm chỉ có trong trang thử để ghi được khung hình.
- Chưa chơi trọn trận trên máy chủ hay xác nhận trực quan mọi màn/kích thước.

Trang xem thử có lựa chọn hiệu ứng, hero, đỡ đòn, tốc độ gấp đôi, giảm chuyển động,
hủy hiệu ứng và xem chậm. Trang không thay đổi tài khoản hoặc kết quả trận.

![Thức Tỉnh tại ô nhân vật, hiệu ứng trang điềm báo](assets/2026-10-17-f13-in-place-awakening.png)
