# Review độc lập — Inventory polish

Phạm vi: từ `08c9dac`, helper commit `71bf4f0` và thay đổi chưa commit của Armory/DeckBuilder, controls, test. Reviewer mới, read-only, gpt-6-astra; không có Critical.

## Important và hướng xử lý

1. Pending qua re-entry: giữ record request theo account ngoài generation scene; `finally` mở lại thao tác khi request kết thúc. Test hold response/rời/mở lại không cho request thứ hai.
2. Preview qua deck editor: chỉ reset khi selection khởi tạo hoặc cấp authoritative đổi. Test owned TL3 xem TL5, vào slot và quay lại vẫn TL5.
3. Số dư lớn: giới hạn vùng header và vùng balance cạnh giá; full text vẫn qua tooltip khi bị rút gọn. Test MAX_SAFE_INTEGER và bounds.
4. Hook actor each + global/area effects: fallback toàn mô tả gốc, tránh tóm tắt thành chỉ một lần. Test compound hooks.

Cả bốn được tái hiện RED trước lượt sửa. Kết quả cuối: 305/305 client, 19/19 browser Kho đồ + 4/4 browser bộ bài, workspace typecheck/build đều GREEN. Không dispatch lượt review thứ hai; từng finding được kiểm chứng bằng regression và suite sau sửa.

## Minor

- Tên/delta rút gọn chỉ có full text bằng hover; thêm cách mở trên touch còn để sau.
- Assertion late-success bị thay chuỗi thành `1Cần 75` đã sửa thành balance mới đúng: đây là lỗi cập nhật test, cần sửa để kiểm chứng phản hồi server, không phải một sửa sản phẩm thêm.

## Những đánh giá reviewer để lại cho người triển khai

- Readability/visual ở cửa sổ hẹp: đã kiểm tra ảnh thực desktop và 900×650; không suy rộng sang điện thoại. Nếu cần điện thoại, layout A fit có thể cho target/chữ nhỏ.
- Phát hiện mất mạng vật lý: tiếp tục dùng `session.online` theo kiến trúc hiện có. Không thêm transport monitoring; flag có thể chưa phản ánh kịp một lần mất mạng.
- Kết quả browser: chỉ chốt bằng lượt test cuối, không dựa vào nhận định từ source.
