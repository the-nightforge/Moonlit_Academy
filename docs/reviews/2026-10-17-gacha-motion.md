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
| Thức Tỉnh | Khung giới thiệu lớn, rồi dùng chung hào quang cho phần lớn hero | 25 hero có 25 hình hiệu ứng và chuyển động riêng theo kỹ năng. Đổi ảnh ngay trên ô hero, không khung giới thiệu/chữ/nền tối/rung camera. Toàn bộ hiệu ứng nằm dưới tên, máu và trạng thái. |
| Nhịp Thức Tỉnh | Giới thiệu 660 mili giây | Tụ lực, chuyển ảnh và tan hiệu ứng có nhịp riêng cho từng hero, tổng 520 mili giây; tốc độ gấp đôi còn 260. Giảm chuyển động giữ hình riêng, chỉ mờ chuyển 60+100+20, tổng 180 mili giây. |
| Trúng đòn | Rung ngang cố định nhiều lần | Giật lùi theo hướng từ nguồn đánh, tăng theo sát thương thực tế và giới hạn tối đa 10 pixel. Đỡ hết không bị đẩy lùi; giảm chuyển động chỉ đổi độ sáng nhẹ. |
| Đòn liên tiếp | Tween trực tiếp lên lá nhân vật | Proxy có quyền sở hữu riêng, hồi đúng vị trí/độ sáng; hiệu ứng cũ không ghi đè đòn mới. Bàn giao trước gục ngã, hồi sinh, hành động tiếp theo và biến mất của Linh Thú. |
| Vào Cốt Truyện, Tầm Nguyệt, Cửa hàng | Toàn màn cùng mờ vào | Các vùng nội dung xuất hiện lệch nhau 35 mili giây, tối đa sáu vùng, mỗi vùng 220 mili giây và dịch 6 pixel. Chỉ chạy một lần lúc vào màn, không lặp khi lọc/mua/cập nhật tiến trình. |

Tận dụng các ảnh `heroes:*_up`, giữ nguyên tỉ lệ và toàn bộ hình trong viền ôm sát.
Giữ hai asset riêng m12/f13 và bổ sung 23 ảnh mới có alpha trong suốt, tham chiếu
trực tiếp tranh của đúng hero. Nguồn, prompt và hash ở
`docs/assets/awakening-heroes-generated.json`; hồ sơ hai asset cũ ở
`docs/assets/awakening-effects-generated.json`. Không dùng hình học dựng bằng mã
làm vật trang trí. Chỉ tải hiệu ứng của đội hình công khai hai phía; hào quang
chung cũ không còn được dùng hoặc tải vào trận. Tổng 25 ảnh khoảng 48,79 megabyte,
giữ WebP lossless, kích thước và alpha gốc. Chi tiết ở
`docs/reviews/2026-10-17-hero-awakenings.md`.

Sự kiện Thức Tỉnh cập nhật trạng thái trình bày đúng một lần sau tụ lực; ảnh cũ
được chụp lại bằng thông tin texture/kích thước, tránh giữ ảnh đã bị renderer hủy.
Ảnh chuyển nằm dưới tên/máu/trạng thái. Thiếu ảnh hoặc ô nhân vật vẫn áp dụng
sự kiện, không mở khung trống hay thay bằng chữ. Hiệu ứng tạm được dọn khi hoàn
tất, hủy cảnh hoặc kết nối lại. Luật, dữ liệu trận, RNG và mạng giữ nguyên;
số sát thương vẫn cập nhật đúng điểm chạm.

## Kiểm tra

- 61 tệp kiểm thử client, 443 ca đều qua trên lượt cuối, gồm chạy đủ 25 timeline
  và 25 hình riêng ở giảm chuyển động, kiểm tra hash không trùng và tải theo đội.
- Kiểm tra riêng nhịp đòn, trình tự sự kiện, hủy trước/sau điểm chạm, gục ngã/hồi
  sinh, hai tốc độ, giảm chuyển động, đòn liên tiếp và bàn giao quyền chuyển động.
- Typecheck client và bản dựng production thành công. Cảnh báo gói JavaScript
  lớn sẵn có vẫn còn; chưa có phép đo tốc độ khung hình hoặc kiểm tra thiết bị yếu.
- Rà soát độc lập bản 25 hiệu ứng không phát hiện lỗi Critical, Important hoặc
  Minor trong phạm vi thay đổi; hash 23 asset mới và ảnh tham chiếu khớp hồ sơ.
- Đã đối chiếu tĩnh đủ 25 ảnh hiệu ứng cạnh tranh hero. Trang thử vẫn gọi cùng
  helper production và có đủ 25 lựa chọn. Lượt mở lại trình duyệt để kiểm tra
  trực tiếp phiên bản mới bị lỗi kết nối với webview; chưa xác nhận trực quan
  chuyển động mới trong trình duyệt. Các ảnh renderer m12/f13 trước đó thuộc
  phiên bản đã được thay thế.
- Chưa chơi trọn trận trên máy chủ hay xác nhận trực quan mọi màn/kích thước.

Trang xem thử có lựa chọn hiệu ứng, hero, đỡ đòn, tốc độ gấp đôi, giảm chuyển động,
hủy hiệu ứng và xem chậm. Trang không thay đổi tài khoản hoặc kết quả trận.

![Bảng đối chiếu tĩnh 25 hiệu ứng riêng](assets/2026-10-17-25-hero-awakenings.jpg)
