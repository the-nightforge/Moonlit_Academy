# Review chi tiết màn Home — 2026-10-10

## Phạm vi và cơ sở

Bố cục tổng thể đã được người dùng duyệt. Review này tập trung vào từng thành phần, nội dung và phản hồi tương tác. Phần đánh giá bên dưới ghi lại trạng thái trước chỉnh sửa; các đề xuất cụ thể đã được triển khai sau khi người dùng duyệt “Làm đi”, xem ghi nhận triển khai ở cuối tài liệu.

Cơ sở: ảnh Home đã nghiệm thu ở 1280×720, 1280×900, 1920×1080 và mã xử lý hiện tại trong `deck-select-scene.ts`, `widgets.ts`, `card-tooltip.ts`, `theme.ts`. Nhận xét hover/offline/tooltip dựa trên mã; không chạy lại phiên tương tác trong lượt review này. Overlay và màn chọn Hero mới được rà từ mã hiện tại, chưa có ảnh mới của hai trạng thái đó.

Mục tiêu: làm Home dễ đọc ở kích thước gốc, thống nhất nét bo/viền, giải thích đúng hành động và thêm phản hồi nhẹ theo phong cách anime cổ phong navy–ivory–gold.

Ưu tiên trong tài liệu là thứ tự cải thiện UX: **A** làm trước, **B** tăng chất lượng thông tin, **C** hoàn thiện animation/art. Không phải đánh giá mức độ sự cố production.

## 1. Header tài khoản và tài nguyên — A

**Hiện tại:** tên người chơi/tên thư viện nằm trực tiếp trên nền. Ba tài nguyên dùng icon 20px và số 14px, cùng màu vàng. Nút đăng xuất dùng icon `nav_back` lật ngang, chỉ có nghĩa rõ khi hover.

**Đề xuất:**
- Đặt mỗi tài nguyên trong chip navy mờ, bo 10–12px, cao khoảng 32–36px; icon 22–24px, số 14–15px màu ivory, căn cùng baseline.
- Bảo đảm icon + số được căn theo một cụm; giá trị lớn được định dạng gọn và tooltip giữ giá trị chính xác/tên tiền tệ.
- Đổi biểu tượng đăng xuất thành cửa có mũi tên, vẫn giữ đúng hành động Đăng xuất. Tránh hình mũi tên điều hướng dễ bị hiểu là quay lại.
- Avatar nhỏ chỉ nên thêm nếu đã có nguồn avatar phù hợp; không cần phát sinh hệ thống hồ sơ mới.

## 2. Chữ, màu và đường viền — A

**Hiện tại:** mô tả chế độ 11–12px, HP/caption rank 11px, thông báo deck 12px. Viền Arena vàng, các ô khác xanh xám; tên chế độ, tên hero, tên deck và nhiều số đều vàng nên vai trò màu chưa rõ.

**Đề xuất:**
- Tiêu đề chế độ 22–24px; tên hero 16–17px; nội dung phụ có ý nghĩa 13–14px ở không gian thiết kế 1280×720. Nội dung phụ không đủ chỗ thì rút câu trước khi giảm cỡ chữ.
- Ivory cho nội dung chính, vàng cổ cho điểm nhấn/được chọn, xanh ngọc dịu cho hợp lệ, đỏ mềm cho lỗi. Màu chữ cần giữ tương phản trên nền thực tế, kể cả hover.
- Dùng cùng hệ navy và 2 cấp viền: viền nghỉ mảnh; viền hover/được chọn sáng hơn. Tránh thêm đường vàng cho mọi khung.
- Đặt lớp nền cục bộ sau chữ ở vùng sáng của tranh; giữ tranh nền hiện tại.

## 3. Bốn ô chế độ — A/B

**Hiện tại:** cấu trúc rõ. Mô tả nhỏ và có thuật ngữ lẫn Anh–Việt. Hover giảm alpha cả panel, bao gồm chữ và icon; không có nhịp nhấn riêng.

**Đề xuất:**
- Giữ kích thước/vị trí đã duyệt. Rút mô tả theo lợi ích: “Xếp hạng · Đấu tập · Phòng riêng”, “Vượt ải · Thu thập Nguyệt Bảo”, “Phối hợp 2 người”, “Khám phá chương truyện”.
- Hover tăng sáng nền/viền, icon nâng 1–2px; chữ và art giữ nguyên độ rõ. Transition khoảng 120–160ms.
- Nhấn có phản hồi ngắn: khung thu nhẹ hoặc đổi fill khoảng 70–100ms; tránh làm thay đổi vị trí hit area.
- Có thể thêm chevron nhỏ cho các ô mở màn kế tiếp. Tầm Nguyệt bắt đầu quy trình tải/vào lượt chơi nên cần phản hồi “Đang tải tài nguyên…” / “Đang tạo lượt chơi…” phù hợp giai đoạn.

## 4. Rank trong Đấu Trường — B

**Hiện tại:** emblem 76px, dòng “Đồng Sinh · 1000 điểm” 14px, caption “Xếp hạng hiện tại” 11px. Emblem có trọng lượng thị giác khá lớn so với icon chế độ 48px; caption lặp ý đã rõ từ vị trí.

**Đề xuất:**
- Emblem 60–64px, tên bậc/điểm 15–16px; dành chỗ cho một dòng tiến độ hữu ích.
- Ví dụ ở 1000 điểm: “Còn 100 điểm đến Tú Tài”, lấy mốc 1100 từ cấu hình hiện có. Không tự đặt ngưỡng. Bậc cao nhất dùng caption riêng, không vẽ thanh tiến độ vượt mốc cuối.
- Tooltip emblem chứa bậc hiện tại, điểm và mốc tiếp theo; thanh tiến độ mảnh là tùy chọn sau khi tăng chữ.
- Khi đang tải/lỗi, giữ vùng bố cục ổn định; spinner nhỏ và nút Thử lại cùng phong cách bo góc. Không hiển thị điểm giả.

## 5. Tên deck và trạng thái đội hình — A

**Hiện tại:** tên deck 23px được ellipsis ở 405px. Khác với hàng overlay, tên bị cắt trên Home chưa có tooltip đầy đủ. Bộ cơ bản dùng câu “Deck hợp lệ · Bộ cơ bản — sửa sẽ tạo bản sao”. Lỗi đầy đủ nằm dưới bộ Hero.

**Đề xuất:**
- Tooltip tên đầy đủ khi bị rút gọn; tap có thể mở bảng thông tin nhỏ nếu hỗ trợ cảm ứng.
- Dùng một trạng thái ngắn cạnh tên: “Sẵn sàng” hoặc “Cần chỉnh sửa”. Chi tiết lỗi nằm trong tooltip/popover để chỉ rõ sửa gì.
- Với Bộ cơ bản, tách chip “Bộ cơ bản” khỏi trạng thái; nút ghi “Sao chép & sửa” để báo trước hành động thật, giảm nhu cầu đọc dòng giải thích dài.
- Có thể bổ sung số lá và Nguyệt Lực trung bình từ dữ liệu deck hiện có. Đây là thông tin deck, không cần thêm backend. Không gọi là sức mạnh đội hình nếu chưa có mô hình chấm điểm.

## 6. Đổi deck và Chỉnh sửa — A

**Hiện tại:** hai nút 34px cao dùng khung chữ nhật của `addButton`, tương phản với phần lớn panel bo góc. Chúng gần như cùng độ nổi bật.

**Đề xuất:**
- Bo 8–10px, cao 38–40px cho desktop; icon deck và bút 16–18px; giữ kích thước vùng hiện tại và khoảng cách.
- Đổi deck là nút điều hướng chính của cụm; Chỉnh sửa dùng nền/viền nhẹ hơn. Tránh làm cả hai thành nút vàng đặc.
- Bộ cơ bản dùng nhãn riêng như mục 5. Dùng cùng kiểu chữ, hover, pressed, disabled cho hai nút.
- Chính sách offline phải thống nhất giữa nút và ảnh Hero: hiện nút Chỉnh sửa khóa theo `session.online`, nhưng click portrait chỉ kiểm tra `busy`, nên vẫn mở editor offline. Nếu tiếp tục khóa sửa offline thì khóa shortcut portrait tương ứng; nếu cho sửa bản nháp offline thì cả hai đường vào phải giải thích cùng một quy tắc.

## 7. Ba thẻ Hero — A/B

**Hiện tại:** art là điểm nhấn đẹp; tên 15px và HP tối đa 11px trên nameplate. Hover chỉ nhắc chạm để sửa deck, còn click một Hero thực tế sửa cả deck.

**Đề xuất:**
- Tên 16–17px, nameplate navy rõ hơn và padding ổn định; kiểm tra crop riêng từng portrait để mặt không bị mất trọng tâm. Không cần gen lại toàn bộ art.
- Dòng phụ ưu tiên hệ phái hoặc Tu Luyện vì liên quan lựa chọn đội hình. Dữ liệu `faction`, XP/mastery đã có. HP tối đa có thể chuyển vào tooltip và ghi rõ đó là HP tối đa.
- Tooltip gọn gồm tên, hệ phái/vai trò đã dịch, HP tối đa, Tinh Hồn, Tu Luyện và một câu về thăng cấp. Tên, chỉ số và mô tả phải lấy từ dữ liệu hiện có.
- Nếu giữ shortcut sửa deck, tooltip phải ghi rõ “Chỉnh sửa đội hình này”. Hướng sau có thể cho portrait mở thông tin Hero, để nút Chỉnh sửa đảm nhiệm deck; đây là thay đổi hành vi riêng cần được chọn trước khi triển khai.
- Chỉ thêm dấu số 1/2/3 nếu vị trí có ý nghĩa với người chơi; tránh badge hiếm và nhiều chỉ số cùng xuất hiện.

## 8. Thanh điều hướng dưới — A/C

**Hiện tại:** nhãn rõ; icon 32px. Hero dùng `nav_banners` (cờ), Kho Đồ dùng `nav_shop`, Tu Luyện dùng `intent_buff` (mũi tên buff). Chúng là asset tái sử dụng nên ngữ nghĩa chưa hoàn toàn khớp.

**Đề xuất:**
- Hero: chân dung/bóng người; Kho Đồ: rương/túi trang bị; Tu Luyện: sách + ánh trăng hoặc cuộn thư tu luyện. Triệu Hồi và Nhiệm Vụ có thể tiếp tục dùng art hiện tại.
- Chuẩn hóa diện tích nhìn thấy bên trong canvas, không chỉ display size: icon đồng bộ độ lớn, nét viền, navy–gold–ivory.
- Giữ nhãn 15–16px và baseline; tăng sáng viền khi hover thay vì giảm alpha cả ô.
- Khi có thưởng, badge chấm có tooltip “Có thưởng để nhận” / “Có lá mới để mở khóa”. Chỉ hiển thị số khi tính được số chính xác từ dữ liệu.
- Home là hub liên kết nên không gán giả trạng thái “tab đang chọn” cho một route khác.

## 9. Tooltip, offline, busy và lỗi — A

**Hiện tại:** tooltip văn bản và tooltip của nút disabled đi qua hai helper khác nhau. Tooltip disabled của `addButton` dùng tọa độ cục bộ như tọa độ màn hình; các nút nằm trong overlay deck có thể hiện note lệch khỏi nút. Tooltip hiện ngay trên pointerover. Các route phần lớn dùng “Đang chuẩn bị…” chung.

**Đề xuất:**
- Một phong cách tooltip: bo 10px, padding 12–14px, chữ 13px, viền mảnh và shadow mềm; luôn nằm trên lớp nguồn.
- Neo tooltip theo bounds thế giới của nút, tính cả parentContainer và vùng camera. Kiểm tra riêng các nút Sửa/Sao chép/Xóa bị khóa trong overlay.
- Delay hover khoảng 150–250ms cho thông tin phụ; lý do disabled vẫn dễ tiếp cận. Tooltip không che tên hoặc hành động đang nhắm tới.
- Thêm focus rõ và cách mở giải thích bằng bàn phím/tap. Hiện nguồn Home chủ yếu xử lý pointer và Escape ở overlay.
- Dùng đúng giai đoạn tải thay vì phần trăm giả. Khi lỗi mạng, hiển thị lỗi trong vùng nội dung liên quan cùng đường thử lại rõ ràng.

## 10. Overlay deck và màn tạo đội hình — B

**Hiện tại, rà từ mã:** thư viện deck gồm hàng 32px, mỗi hàng ghép tên + 3 Hero + “cost TB”; vùng trạng thái riêng. Bộ cơ bản có hành động Sửa bị khóa và Sao chép. Màn chọn đội hình mới vẫn là các ô chữ nhật có tên/HP/nhánh, chưa có portrait.

**Đề xuất:**
- Rút hàng deck thành tên nổi bật + thông tin phụ gọn, selected state có dấu check cùng viền; đổi “cost TB” thành “Nguyệt Lực TB”. Nếu thêm thumbnail thì kiểm tra lại số hàng/trang, không nhét ảnh vào hàng 32px.
- Header hoặc footer giải thích rõ bộ đang chọn; nút chọn deck được ưu tiên, Sửa/Sao chép là phụ, Xóa giữ nguy hiểm.
- Dùng cùng hệ nút bo góc với Home. Tooltip khóa phải xuất hiện đúng vị trí như mục 9.
- Màn chọn 3 Hero dùng portrait nhỏ, trạng thái khóa và badge thứ tự; dòng “Đã chọn 2/3” rõ. Danh sách Song Hành dài cần wrap/ellipsis + tooltip, hiện là một dòng.
- Chụp và kiểm tra hai trạng thái này trước khi quyết định kích thước hàng/portrait; không mở rộng overlay chỉ từ suy đoán.

## 11. Animation và VFX — C

**Hiện tại:** đoạn xử lý Home được rà không có tween hover/pressed riêng; chủ yếu đổi alpha, và điều hướng qua `scene.start`.

**Đề xuất:**
- Hover 120–160ms, pressed 70–100ms như mục 3; không tween toàn bộ tranh Hero khi rê liên tục.
- Khi vào Home, fade nhẹ từng cụm khoảng 180–240ms; input sẵn sàng theo trạng thái dữ liệu, không dùng animation làm gate server.
- Emblem rank ánh nhẹ khi hover; badge thưởng pulse chậm, cường độ thấp. Ambient motes chỉ là tùy chọn sau cùng; nền đã có đủ chi tiết sáng.
- Tôn trọng setting animation/reduced-motion và sound hiện có nếu tích hợp. Không thêm chế độ cấu hình riêng chỉ cho Home.

## Thứ tự khuyến nghị

1. **A — độ rõ và nhất quán:** chữ phụ, chip tài nguyên, icon đăng xuất, nút bo góc, hover sáng hơn, tên deck đầy đủ, trạng thái Bộ cơ bản, thống nhất thao tác offline, neo tooltip đúng chỗ.
2. **B — thông tin hữu ích:** tiến độ rank, tooltip Hero, thông tin deck, rà hình ảnh overlay/picker và tinh chỉnh các trạng thái đó.
3. **C — độ hoàn thiện:** icon đúng chức năng, hiệu ứng nhấn/chuyển màn/ánh rank nhẹ. Có thể làm icon sớm hơn nếu khó nhận nghĩa của thanh dưới trong thử nghiệm.

## Tiêu chí kiểm tra khi triển khai

- Giữ bố cục Home và ba viewport đã duyệt.
- Text và icon vẫn rõ ở trạng thái nghỉ/hover/disabled; giá trị tiền lớn không chồng chip bên cạnh.
- Tên deck dài xem được đầy đủ; Bộ cơ bản giải thích đúng tạo bản sao; nút và shortcut không mâu thuẫn offline.
- Rank cuối/loading/lỗi không phá bố cục; retry không kích hoạt tile.
- Tooltip overlay có anchor/depth đúng, bàn phím/tap có phản hồi; chuột rời nguồn thì đóng đúng.
- Animation không cản gate asset/server, không tồn tại sau shutdown và không chạy liên tục nếu bị giảm chuyển động.

## Tham chiếu thiết kế

Các số đo/hiệu ứng đề xuất là lựa chọn thiết kế cho màn này. W3C được dùng để tham chiếu tương phản và tương tác, không kết luận cả game đã/không đạt WCAG:

- [W3C — Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html): chữ thường nên đạt tối thiểu 4,5:1, cần kiểm tra nền render thực tế.
- [W3C — Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html): tham chiếu kích thước vùng nhấn và khoảng cách; nút hiện tại không tự động vi phạm chỉ vì cao 34px.
- [W3C — Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html): người dùng bàn phím cần thấy vị trí focus.

## Ghi nhận triển khai — 2026-10-10

- Giữ vị trí/kích thước các cụm Home đã duyệt. Tăng cỡ chữ phụ, phân vai ivory/gold/jade, đưa tài nguyên vào chip có tooltip giá trị chính xác.
- Nút Home/overlay bo góc cao 40px; hover làm sáng nền/viền, pressed phản hồi nhẹ, vùng nhấn ổn định. Tab/mũi tên di chuyển focus; Enter/Space kích hoạt, kể cả mở giải thích trên điều khiển bị khóa. Focus của overlay được giữ qua cập nhật nền.
- Rank dùng emblem 64px, điểm và mốc tiếp theo lấy từ cấu hình; bậc cuối có caption riêng. Ánh nhẹ khi hover, lỗi giữ đường Thử lại.
- Deck hiển thị sẵn sàng/cần chỉnh sửa, số lá, Nguyệt Lực trung bình. Tên dài, lỗi đội hình và Song Hành bị cắt mở tooltip bằng chuột, tap hoặc bàn phím. Bộ cơ bản dùng “Sao chép & sửa”.
- Hero dùng tên 17px và hệ phái; tooltip chứa HP tối đa, Tinh Hồn, Tu Luyện, mô tả thăng cấp đúng dạng Hero. Shortcut sửa đội hình khóa offline/busy giống nút Chỉnh sửa.
- Footer có icon PNG mới đúng nghĩa Hero/Kho Đồ/Tu Luyện/Đăng xuất; badge thưởng có giải thích. Prompt và file trong `docs/home-assets.md`.
- Busy hiển thị riêng giai đoạn tải tài nguyên/tạo lượt chơi. Tooltip 13px, bo góc, neo theo bounds thực, nổi trên overlay. Sửa cả tọa độ tooltip disabled của helper dùng chung.
- Overlay có hàng bo góc, dấu chọn, tooltip và điều hướng bàn phím. Picker có portrait, thứ tự chọn, số Hero đã chọn và trạng thái chưa sở hữu.
- Fade vào Home 220ms, hover 140ms, pressed 90ms, badge thưởng pulse chậm; tuân thủ reduced-motion hiện có và hủy timer/tween khi đối tượng bị xóa.

Các lựa chọn tùy ý chưa bổ sung: avatar, chevron mọi tile, thanh tiến độ rank, thumbnail trong hàng deck 32px, ambient motes và đổi portrait thành route thông tin Hero. Những mục này không cần cho bản polish đã duyệt.

Nghiệm thu: **256 unit**, **41 Home/online E2E**, typecheck/build đạt; **4 ca disabled/picker** đạt lại sau tinh chỉnh độ đặc nền cuối. Đã xem ảnh ba viewport, overlay, picker, tooltip và focus; xem log/ảnh ở `output/home-ui-details/` và ghi nhận tại `docs/testing.md`. Build còn cảnh báo bundle lớn có sẵn. Review độc lập hai lỗi bàn phím đã được sửa và xác nhận lại.
