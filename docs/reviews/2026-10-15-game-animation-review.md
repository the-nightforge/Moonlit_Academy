# Animation chiến đấu và giao diện

Ngày: 2026-10-15. Nhánh: `codex/game-animation-polish`, tách từ `c7b7427` trên main.

Người dùng yêu cầu dùng skill `phaser-animations`, sau đó chọn làm cả chiến đấu lẫn giao diện. Phạm vi là cải thiện luồng trình bày đang có; không đổi luật, profile, kết quả trận hoặc giao thức mạng.

## Thay đổi

| Phần | Cải thiện |
| --- | --- |
| Trúng đòn | Thêm animation 12 frame ở 40 frame mỗi giây, dài 300 mili giây. Vòng xung và tia sáng mở ra rồi tan; chỉ phát một lần tại điểm chạm quyết định, kể cả đòn nhiều projectile. |
| Đỡ đòn | Dùng animation đường viền khiên riêng. Lấy trạng thái blocked thật; kỹ năng màu xanh không tự bị nhận thành đỡ đòn. |
| Cận chiến | Kiếm và thương có nhịp lấy đà 4 pixel, bước tới tối đa 36 pixel rồi hồi vị. Thời điểm va chạm giữ đồng bộ với feedback sát thương hiện có; không kéo lá nhân vật qua vùng đội hình khác. Hủy chuyển động trả vị trí cho view còn sống. |
| Tốc độ | Dùng timeScale native của từng tween thay vì chỉ chia duration/delay. Khoảng giữ, lặp, thời gian chờ hoàn tất và cấu hình từng thuộc tính cùng đổi tốc độ. Sprite dùng timeScale riêng, không sửa animation definition dùng chung. |
| Vòng đời | Runtime chờ đúng animationcomplete theo key; stop, destroy và abort đều giải phóng promise/listener. Không nhận animation vô hạn vào thao tác hữu hạn của hàng đợi. |
| Popup canvas | Fade từ độ đậm 0,6 lên 1 trong 160 mili giây, giữ nguyên vị trí, kích thước và vùng bấm. Tween được gỡ khi popup bị hủy. |
| Nút canvas dùng chung | Nhấn làm nền nút giảm nhẹ độ đậm; thả hoặc đưa con trỏ ra ngoài hồi phục trong 120 mili giây. Viền và góc bo hiện có được giữ nguyên, không tạo hit target mới. |
| Các màn DOM | Cốt Truyện, thoại truyện, Tầm Nguyệt, shop, Liên Thủ, Nhiệm vụ và Tu Luyện có fade khi vào màn 180 mili giây. Dialog mở trong 160 mili giây; nút có phản hồi nhấn 1 pixel và chuyển màu/viền ngắn. Không animate riêng ảnh hoặc thay kích thước layout. |
| Giảm chuyển động | Combat không phát frame burst mới hoặc lunge. Canvas và CSS DOM dùng chung tùy chọn đã lưu, lấy hệ điều hành làm mặc định. DOM cập nhật ngay khi thay đổi trong game, từ cửa sổ khác hoặc khi tùy chọn hệ điều hành đổi; listener được gỡ khi game đóng. |

Texture hiệu ứng được vẽ bằng code, 24 frame trên cùng một canvas, đăng ký animation một lần qua AnimationManager và phát bằng AnimationState của Sprite. Mỗi frame 192 × 192 có khoảng trống quanh đường nét để không bị cắt hoặc lẫn frame bên cạnh. Không cần tải thêm artwork hoặc thư viện. Đã materialize 379 asset LFS hiện có trong worktree để xem thử.

Áp dụng [quy tắc UI](../ui-rules.md): không thay tỷ lệ/crop ảnh, không thêm chữ hoặc control lên ảnh, giữ nút có border và bo góc, không thêm tooltip lặp lại hay thuật ngữ viết tắt. Chuyển động đi cùng container/viền, thay vì chỉ biến đổi ảnh bên trong.

## Kiểm chứng

- Baseline trước sửa: 367 test client đạt.
- Sau triển khai và sửa review trước merge: **391 test trong 49 file đạt**, typecheck toàn workspace đạt, production build client đạt. Build còn cảnh báo chunk lớn hơn 500 kilobyte như trước.
- Test mới đã được chạy thất bại trước bản sửa cho playback sprite, tốc độ tween, phân biệt trúng/đỡ đòn, nhịp cận chiến và lỗi kỹ năng màu xanh.
- 7 test vòng đời sprite kiểm tra completion theo key, drain, tốc độ riêng, abort, stop, destroy, listener cleanup và từ chối animation vô hạn/thiếu definition.
- 6 test tích hợp chạy **AnimationManager, AnimationState và TweenManager thật của Phaser 4.2.1 trong Node**. Chỉ bỏ renderer canvas: kiểm tra 24 frame được đăng ký một lần; tất cả 12 frame chạy ở tốc độ thường và gấp đôi; hidden/completion/drain; tween có thời gian giữ và cấu hình thuộc tính; popup/nút hoàn tất và dọn tween; giảm chuyển động không tạo tween UI.
- Test hồi quy tiếp tục kiểm tra đúng một callback va chạm, hủy trước/sau va chạm, hàng đợi và ngân sách timing hiện có.
- 6 test preference DOM xác nhận tùy chọn đã lưu tắt chuyển động dù hệ điều hành cho phép, thay đổi trong cùng cửa sổ có hiệu lực ngay, mặc định hệ điều hành, override đã lưu, cập nhật từ storage cửa sổ khác và teardown listener. Đã chạy thất bại trước bản sửa và đạt sau triển khai.
- `git diff --check` sạch. Không chạy lại các mô phỏng cân bằng dài không liên quan đến thay đổi trình bày.

### Giới hạn xác minh

Chưa xem chuyển động trực tiếp trong browser ở lượt này. Hai lần tạo tab native đều không attach được webview; thao tác đọc tab lỗi cũ bị browser security policy từ chối do protocol của trang lỗi. Đã dừng thao tác browser, không dùng cơ chế khác để đọc hoặc điều khiển tab bị chặn. Kiểm tra component Phaser trong Node không thay thế việc xác nhận hình ảnh, trải nghiệm mobile hoặc chơi thật qua mạng.

Hai lần review đầu bị giới hạn capacity. Khi chuẩn bị merge, reviewer độc lập đã chạy được và phát hiện một lỗi P2: CSS DOM bỏ qua tùy chọn giảm chuyển động đã lưu. Đã sửa bằng preference dùng chung, bổ sung 6 test hồi quy và được reviewer kiểm tra lại: không còn phát hiện cần xử lý. Reviewer rà code và test; không xác nhận hình ảnh trực tiếp trong browser.

## Xem thử thủ công

Trang xem thử dùng chính `playAttack`, AnimationRuntime, addButton, showModal và DialogueView của sản phẩm, với ảnh có sẵn. Không đăng nhập hoặc ghi tài khoản. Có 15 kiểu đòn, tốc độ thường/gấp đôi, đỡ đòn, giảm chuyển động, hủy giữa chừng, popup và thoại truyện.

```powershell
pnpm --filter client exec vite --host 127.0.0.1 --port 5317 --strictPort
```

Mở [trang xem thử](http://127.0.0.1:5317/test/animation-preview.html). Source: [animation-preview.ts](../../apps/client/test/animation-preview.ts), [animation-preview.html](../../apps/client/test/animation-preview.html). Trang này đã qua typecheck; chưa được chạy tương tác trực tiếp trong browser do giới hạn trên.

Kiểm tra thủ công còn cần làm: thử 15 kiểu đòn ở hai tốc độ; bật giảm chuyển động; hủy giữa bước lấy đà và sau va chạm; mở/đóng popup nhanh; thử màn DOM, focus bàn phím và điện thoại; xác nhận ảnh nguyên tỷ lệ và border sát hình trong chuyển động.

## Tài liệu tham khảo

Skill đã cài: [phaser-animations của GameStudio](https://github.com/bullish0x/GameStudio/tree/main/.agents/skills/phaser-animations). Đối chiếu với source Phaser đang cài và tài liệu [Animations](https://docs.phaser.io/phaser/concepts/animations), [AnimationState](https://docs.phaser.io/api-documentation/class/animations-animationstate) và [animation events](https://docs.phaser.io/api-documentation/4.0.0/namespace/animations-events).
