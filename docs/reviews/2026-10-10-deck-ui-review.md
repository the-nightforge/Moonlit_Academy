# Đề xuất UI modal đổi deck và editor Sao chép & sửa

Ngày: 2026-10-10. Phạm vi: review và đề xuất thiết kế cho hai luồng đã có; đây không phải plan triển khai.

## Cơ sở tham khảo

Rà `deck-select-scene.ts`, `deck-builder-scene.ts`, `widgets.ts`, luật lưu/kiểm tra deck và cấu hình hiện tại. Ảnh modal nghiệm thu ngày 10/10; ảnh builder ngày 08/10 được đối chiếu lại với mã builder hiện tại. Chưa chạy một phiên browser mới trong lượt review này. Nguồn game dưới đây là các tính năng đã được hãng công bố, không phải tuyên bố đã kiểm tra mọi màn UI của bản game mới nhất năm 2026.

| Game / nguồn chính thức | Điểm tham khảo có bằng chứng | Áp dụng cho Vọng Nguyệt |
| --- | --- | --- |
| [Hearthstone — Managing the Collection Manager, 2018](https://hearthstone.blizzard.com/en-gb/news/21790299/managing-the-collection-manager) | Tìm theo tên/nội dung và lọc mana, loại, độ hiếm, sở hữu; kết hợp bộ lọc | Tìm/lọc lá theo Hero, nhánh, Nguyệt Lực, đã mở; trình bày bằng điều khiển dễ nhận biết |
| [Legends of Runeterra — Patch 2.17, 2021](https://playruneterra.com/en-sg/news/game-updates/patch-2-17-0-notes/) | Deck yêu thích lên đầu collection; bìa deck dùng hình Champion/skin | Nhận diện deck bằng portrait; ưu tiên deck đang dùng, sau đó có thể bổ sung yêu thích |
| [Marvel Snap — Patch 10/04/2024](https://marvelsnap.com/patch-notes-april-10-2024/) | Làm rõ lá đã thêm bằng trạng thái dimmed trong collection; sửa khả năng bỏ lá khi chỉnh deck | Trạng thái chọn/bỏ rõ, thao tác ổn định, kiểm tra lỗi trực tiếp tại vị trí liên quan |

Các bố cục/kích thước bên dưới là đề xuất riêng cho game này, suy ra từ nhu cầu và không gian hiện tại; không sao chép nguyên bố cục hay hệ luật của game tham khảo.

## 1. Modal đổi deck

### Vấn đề hiện tại

- Hàng cao 32px ghép tên deck, ba tên Hero và Nguyệt Lực trung bình vào một dòng; toàn bộ là chữ nên các deck tương tự khó phân biệt.
- Không có vùng xem trước. Tên dài và chi tiết lỗi phải hover mới đọc được.
- Cùng một hàng có dấu chọn bên trái và dấu hợp lệ bên phải; đều là dấu check nên dễ nhầm ý nghĩa.
- Năm nút Sửa / Sao chép / Xóa / Deck mới / Chọn deck này nằm cùng hàng, khá đều trọng lượng.
- Click hàng đã cập nhật `session.selectedDeckId`; nút “Chọn deck này” chỉ đóng modal. Esc cũng giữ lựa chọn vừa click. Hành vi này không khớp kỳ vọng về nút xác nhận.
- Điều khiển đóng chỉ qua Escape/nền; cần nút × trực tiếp trong header. Bộ cơ bản hiện hai hành động khóa, làm footer bận.

### Hướng đề xuất: danh sách + xem trước

Khung khoảng 1080×600–624 trong không gian 1280×720. Nền navy đặc, bo 16px, viền mảnh; scrim đủ tối để modal là vùng tập trung. Các số đo cần xác nhận bằng mockup ở ba viewport đã dùng cho Home.

**Bên trái khoảng 40%:**

- Header “Đổi đội hình”; tìm tên deck hoặc Hero.
- Khoảng 6 hàng cao 60–68px, cuộn nội bộ. Mỗi hàng có ba portrait nhỏ, tên deck 16px và một dòng phụ 13px.
- Dòng phụ ưu tiên “18/18 ô · Sẵn sàng” hoặc “Cần chỉnh sửa”; thông tin Nguyệt Lực chi tiết chuyển sang preview.
- Deck đang dùng có chip “Đang dùng”; hàng đang xem có nền/viền sáng riêng. Bộ cơ bản có chip “Bộ cơ bản”. Trạng thái hợp lệ dùng chữ + biểu tượng khác dấu chọn.
- Nút “+ Deck mới” đặt cạnh header danh sách, không cạnh nút xác nhận.

**Bên phải khoảng 60%:**

- Tên đầy đủ, ba portrait Hero, hệ phái và thứ tự.
- Tóm tắt: số ô deck, số bản trong chồng bài, Nguyệt Lực trung bình, vũ khí và Nguyệt Bảo.
- Trạng thái theo luật thường/PvP nếu khác nhau; lỗi ghi rõ thiếu bao nhiêu hoặc Hero nào chưa đủ lá.
- Lỗi liên quan có đường “Chỉnh sửa” ngay trong preview.

**Footer:**

- Primary “Dùng deck này” ở phải. Chọn hàng chỉ đổi preview; xác nhận mới áp dụng đội hình. Esc/× đóng và giữ đội hình trước khi mở.
- Secondary “Chỉnh sửa” và “Sao chép & sửa” gắn với deck đang xem. Bộ cơ bản chỉ hiện hành động phù hợp “Sao chép & sửa”.
- Xóa chuyển vào menu ⋯ và giữ xác nhận có tên deck. Không dùng nút đỏ lớn cạnh hành động chọn thường xuyên.
- Không tự chặn deck PvP chỉ vì không hợp lệ theo luật thường; hiển thị khả năng sử dụng theo chế độ thực tế.

## 2. Màn Sao chép & sửa

### Vấn đề hiện tại

- Ba cột theo Hero có ý nghĩa tốt, nhưng mỗi cột là danh sách chữ, hàng 26px, ít art và không có công cụ tìm/lọc.
- Tên Hero đi cùng số `(6)` chưa giải thích đang đếm gì; thiếu nhắc tối thiểu 4 lá mỗi Hero.
- “×3” nhỏ ở cuối hàng dễ bị hiểu là số lượng có thể tăng/giảm. Đây là số bản cố định của định nghĩa lá khi tạo chồng bài.
- Dãy “Cost 0–8: …” cần người chơi tự diễn giải. Chỉ hiện lỗi đầu tiên ở cuối màn, khó biết còn lỗi nào khác.
- Header 26px có tên bản sao dài dễ tranh chỗ với Back và nút luật PvP; Đổi tên lại nằm xa dưới footer.
- Vũ khí / Nguyệt Bảo là nút chữ rộng, trong khi đã có equipment art. Gear picker cũng chủ yếu là hàng chữ.
- Nút Lưu luôn bật, không có trạng thái đang lưu. Luật backend hiện cho phép lưu draft chưa hợp lệ; không nên thêm chặn Lưu theo `validateDeck` một cách máy móc.

### Hướng đề xuất: giữ ba Hero, thêm sidebar tổng quan

Ở 1280×720, vùng nội dung khoảng 1208px: ba cột Hero khoảng 904px, khoảng cách 24px, sidebar 280px. Footer cố định theo khu vực thiết kế; các danh sách lá cuộn bên trong, header Hero và slot vũ khí giữ vị trí.

**Header:**

- “Chỉnh sửa deck”; trường tên ngắn ngay bên cạnh, có bút đổi tên và giới hạn 24 ký tự.
- Với id mới: badge “Bản sao mới · Chưa lưu”; lần tạo bản sao không sửa deck gốc.
- Quy tắc đổi thành lựa chọn “Thường / PvP”, kèm giải thích đây là cách kiểm tra/xem chỉ số, không thay đổi dữ liệu nâng cấp tài khoản.
- Tìm theo tên hoặc mô tả lá; bộ lọc Nguyệt Lực, đã mở, đang trong deck. Các nhóm Hero/nhánh đã có vẫn là trục chính.

**Mỗi cột Hero:**

- Portrait nhỏ, tên 17px, hệ phái và “6 lá · Tối thiểu 4”. Khi thiếu, hiện “3/4 — thiếu 1 lá” tại chính header Hero.
- Nhánh là nhóm có thể thu gọn hoặc lọc; tránh bắt người chơi đọc mọi lá đã khóa trước khi tìm lá dùng được.
- Hàng 38–44px: thumbnail art, huy hiệu Nguyệt Lực, tên 14–15px, trạng thái đã chọn và thao tác thêm/bỏ.
- “×3 bản” có tooltip giải thích số bản trong chồng bài; chọn/bỏ toàn bộ lá bằng một thao tác, không thêm bộ tăng/giảm số bản.
- Lá khóa dùng nền đủ đặc, tên đọc được, biểu tượng khóa và lý do mở qua Tu Luyện. Khóa tương tác không làm mất thông tin.
- Preview lá mở bằng hover có delay, click/focus để ghim; đặt trong vùng an toàn, không che hàng đang thao tác. Tooltip/preview dùng lại hệ full art hiện có.

**Sidebar:**

- Tách “18/18 ô deck” và “54 bản trong chồng bài”. Vũ khí chiếm ô deck và số bản vũ khí cũng tính vào chồng bài.
- Đường cong Nguyệt Lực dạng cột, nhãn rõ đang đếm số bản trong chồng bài; tính cả vũ khí. Chi phí cao gom vào nhóm cuối nếu cần, không bỏ mất dữ liệu ngoài 0–8.
- Danh sách lỗi gọn, có số lượng; click lỗi đưa tới Hero/lá/slot cần chỉnh. Trạng thái hợp lệ dùng jade, warning đỏ mềm.
- Hai ô Nguyệt Bảo dùng art, tên, cấp cộng hưởng; slot trống có dấu +. Vũ khí dùng art trong slot của Hero tương ứng.

**Lưu / rời màn:**

- Deck dùng được: primary “Lưu và dùng”; lưu thành công giữ hành vi chọn deck vừa lưu.
- Deck chưa hợp lệ: “Lưu bản nháp”; vẫn lưu được, báo “Đã lưu bản nháp”, giữ đội hình đang dùng và tiếp tục cho chỉnh sửa.
- Đang lưu: “Đang lưu…”, chặn gửi lặp. Lỗi mạng giữ bản chỉnh sửa và có thử lại.
- Tên trống/quá dài, offline và busy có trạng thái khóa với lý do. Không dùng deck hợp lệ làm điều kiện bắt buộc cho mọi kiểu lưu.
- Badge “Có thay đổi chưa lưu”; giữ xác nhận bỏ thay đổi đã có. Ctrl+S có thể bổ sung cùng focus/Enter/Space sau khi luồng chính đã rõ.

## 3. Art, animation và picker trang bị

- Navy–ivory–gold như Home; jade cho hợp lệ, đỏ mềm cho lỗi; bo nút 8–10px, panel 14–16px. Không phủ vàng lên mọi hàng đã chọn.
- Portrait và card art là các điểm nhận diện chính. Tải ảnh đang hiển thị, giữ fallback; không cần gen lại toàn bộ bộ bài để làm redesign này.
- Modal fade/small-scale 160–200ms; preview crossfade 100–140ms; thêm/bỏ lá highlight 100–150ms và cập nhật số ô nhẹ. Reduced-motion dùng trạng thái tĩnh.
- Gear picker có art tile, tên và R/CM, đánh dấu đang trang bị; preview bên cạnh, “Bỏ trang bị” rõ. Không đặt tooltip khổng lồ sát cạnh màn rồi che danh sách.
- Âm thanh nhấn/chọn nhỏ theo volume hiện có; không thêm ambient VFX dày cho editor.

## 4. Thứ tự thực hiện đề xuất

**P0 — làm rõ hành vi và trạng thái:** preview khác đội hình đang dùng, xác nhận áp dụng, nút đóng, phân cấp hành động; bản sao/chưa lưu; phân biệt ô deck và số bản; lỗi ngay Hero liên quan; busy/offline khi lưu, giữ khả năng lưu bản nháp.

**P1 — redesign hình ảnh và công cụ:** modal hai vùng, portrait deck, hàng lá có art, ba cột + sidebar, đường cong, tìm/lọc, equipment art picker, thống nhất bo góc/hover/focus.

**P2 — tiện ích:** yêu thích deck, hoàn tác thao tác gần nhất, phím tắt, đổi Hero trong editor với thông báo lá/trang bị bị ảnh hưởng. Cần thiết kế riêng cho dữ liệu mới hoặc thay đổi đội hình; không gộp vào một lần chỉnh màu/nút.

## Tiêu chí nghiệm thu khi triển khai

- 1280×720, 1280×900, 1920×1080; modal chứa tên dài và thư viện 30 deck; không đè footer hoặc tooltip nguồn.
- Mở modal → xem deck khác → Escape không thay đội hình; xác nhận dùng mới đổi. Sửa/sao chép áp dụng đúng deck đang xem.
- Bộ cơ bản không sửa trực tiếp; bản sao lưu với id mới. Lưu bản nháp lỗi không làm mất hoặc thay deck đang dùng.
- Thêm vũ khí vào 18 lá báo 19/18; bỏ một lá phù hợp trở về 18/18. Nguyệt Bảo không chiếm ô deck.
- Cảnh báo tối thiểu 4 lá của từng Hero; không có điều khiển chỉnh số bản cố định. Curve/copies gồm vũ khí và có nhãn định nghĩa rõ.
- Hợp lệ PvP khác luật thường được giải thích; offline, save pending, save failure, modal tên, gear picker và dirty exit hoạt động nhất quán.
- Tìm/lọc không làm mất chọn bài; bàn phím/tap mở được thông tin và các lý do khóa; reduced-motion hủy/giảm tween đúng.
