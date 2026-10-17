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
| Thức Tỉnh | Tên nổi và lóe sáng | Ảnh Thức Tỉnh đầy đủ trong viền ôm sát; tên nhân vật, tên dạng và họa tiết theo nhóm kỹ năng. Cừ Trấn Nam dùng Cổng Đồng; Tố Nguyệt Nhi dùng trang điềm báo. Nền tối nhẹ giúp đọc rõ. |
| Nhịp Thức Tỉnh | Nhịp giữ 500 mili giây, chữ còn nổi phía sau | Vào 180, giữ 320, ra 160 mili giây: tổng 660; tốc độ gấp đôi còn 330. Giảm chuyển động dùng fade 100+240+100, không trượt/phóng/xoay. |
| Trúng đòn | Rung ngang cố định nhiều lần | Giật lùi theo hướng từ nguồn đánh, tăng theo sát thương thực tế và giới hạn tối đa 10 pixel. Đỡ hết không bị đẩy lùi; giảm chuyển động chỉ đổi độ sáng nhẹ. |
| Đòn liên tiếp | Tween trực tiếp lên lá nhân vật | Proxy có quyền sở hữu riêng, hồi đúng vị trí/độ sáng; hiệu ứng cũ không ghi đè đòn mới. Bàn giao trước gục ngã, hồi sinh, hành động tiếp theo và biến mất của Linh Thú. |
| Vào Cốt Truyện, Tầm Nguyệt, Cửa hàng | Toàn màn cùng mờ vào | Các vùng nội dung xuất hiện lệch nhau 35 mili giây, tối đa sáu vùng, mỗi vùng 220 mili giây và dịch 6 pixel. Chỉ chạy một lần lúc vào màn, không lặp khi lọc/mua/cập nhật tiến trình. |

Tận dụng các ảnh `heroes:*_up` và helper chứa toàn bộ ảnh hiện tại; thiếu ảnh thì
còn tên/dạng để đọc. Họa tiết dùng hình học dựng trong game. Không thêm tải ảnh,
video hoặc bộ xương nhân vật mới. Luật, sự kiện, dữ liệu trận, RNG và mạng giữ
nguyên; số sát thương vẫn cập nhật đúng điểm chạm. Tốc độ và hủy cảnh dùng runtime
chung; đổi sang giảm chuyển động hủy ngay các chuyển động panel đang chạy.

## Kiểm tra

- 59 tệp kiểm thử client, 430 ca đều qua trên lượt cuối.
- Kiểm tra riêng nhịp đòn, trình tự sự kiện, hủy trước/sau điểm chạm, gục ngã/hồi
  sinh, hai tốc độ, giảm chuyển động, đòn liên tiếp và bàn giao quyền chuyển động.
- Typecheck client và bản dựng production thành công. Cảnh báo gói JavaScript
  lớn sẵn có vẫn còn; chưa có phép đo tốc độ khung hình hoặc kiểm tra thiết bị yếu.
- Rà soát độc lập đã phát hiện xung đột recoil/gục ngã; sửa và kiểm tra lại, không
  còn lỗi Critical hoặc Important trong phạm vi rà soát.
- Đã mở renderer thật tại `/test/animation-preview.html` trong trình duyệt, xem
  Cừ Trấn Nam và Tố Nguyệt Nhi, kiểm tra ảnh đủ trong khung và nút mở lại sau khi
  kết thúc. Thời gian thực quan sát khoảng 706–716 mili giây ở tốc độ thường,
  bao gồm nhịp vẽ; đây không phải benchmark. Ảnh chụp Tố Nguyệt Nhi dùng chế độ
  xem chậm chỉ có trong trang thử để ghi được khung hình.
- Chưa chơi trọn trận trên máy chủ hay xác nhận trực quan mọi màn/kích thước.

Trang xem thử có lựa chọn hiệu ứng, hero, đỡ đòn, tốc độ gấp đôi, giảm chuyển động,
hủy hiệu ứng và xem chậm. Trang không thay đổi tài khoản hoặc kết quả trận.

![Khung Thức Tỉnh trong renderer thật, chế độ xem chậm](assets/2026-10-17-f13-awakening.png)
