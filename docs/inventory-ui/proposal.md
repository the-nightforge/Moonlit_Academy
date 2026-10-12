# Review và đề xuất UI Kho đồ

Ngày: 12/10/2026. Nhánh: `codex/inventory-ui`, tách từ `main` tại `40aa5ac`.

Đề xuất: chuyển danh sách chữ sang lưới art 4 × 3 ở bên trái, giữ một bảng chi tiết cố định bên phải. Cho người chơi tìm món, biết mình sở hữu gì và quyết định nâng cấp ngay trên cùng màn hình. Dùng lại `ArmoryScene`, hai nhóm Binh Khí / Nguyệt Bảo và toàn bộ art hiện có.

## Tham khảo từ các game tương tự

| Game / nguồn hình | Điểm đáng học | Áp dụng cho Vọng Nguyệt |
| --- | --- | --- |
| [Genshin Impact — hình Inventory trên HoYoLAB](https://www.hoyolab.com/article/27128157) | Lưới vật phẩm kết hợp phần mô tả món đang chọn; phân loại ở mức màn hình, cấp/độ hiếm ở mức từng món. | Nhận diện bằng art; tên, độ hiếm và cấp tách rõ; không thêm ATK/DEF hoặc sức chứa kho. |
| [Honkai: Star Rail — ảnh màn Light Cones](https://imgix.bustle.com/uploads/image/2023/5/9/4834c05f-88c9-40c4-87b6-6a63f23317c7-light-cones.jpg) · [bài chứa ảnh](https://www.inkl.com/news/honkai-star-rail-superimpose-guide-how-to-make-your-light-cones-more-powerful) | Lưới art trái, chi tiết phải, viền chọn rõ và vùng hành động ở đáy. | Tách duyệt kho khỏi đọc chi tiết; neo chi phí/nút nâng ở đáy; tránh đẩy nút theo chiều dài mô tả. |
| [AFK Journey — hướng dẫn và ảnh Equipment / Forge](https://www.talkandroid.com/81779-equipment-guide-afk-journey-afk2/) | Vật liệu, chi phí và tiến trình nâng được nhóm thành vùng quyết định dễ nhìn. | Đặt nguyên liệu đang có / cần dùng và lợi ích cấp kế tiếp gần nút nâng; không đưa hệ trang bị theo class vào game. |

Đây là tham khảo những ảnh UI công khai, có ảnh từ 2023–2024; không khẳng định chúng là giao diện mới nhất. Ảnh Star Rail đã được mở và quan sát trực tiếp. HoYoLAB không tải đầy đủ trong phiên này, nên quan sát Genshin dựa trên ảnh được lập chỉ mục, độ tin cậy thấp hơn. Các quyết định bên dưới được đối chiếu với code và dữ liệu của Vọng Nguyệt.

## Hiện trạng trong repo

`apps/client/src/scenes/armory-scene.ts` hiện dùng danh sách 10 dòng/trang, art nhỏ 32 × 36, preview lớn ở giữa và mô tả ở cột phải. 25 Binh Khí và 16 Nguyệt Bảo đã có đủ art. Thiếu tìm kiếm, sắp xếp, lọc sở hữu; món đầu tiên luôn được chọn mà chưa ưu tiên sở hữu. Nội dung trình bày cả 5 cấp ngay cùng một vùng; vị trí nâng cấp phụ thuộc chiều dài phần mô tả phía trên.

Rủi ro đọc và thao tác: người chơi phải quét nhiều chữ để tìm món, khó nhận ra món nào có thể nâng, và khó phân biệt hiệu ứng hiện tại với hiệu ứng tương lai. Cần đo lại các mô tả dài khi triển khai: hiện chưa có vùng cuộn/mask riêng cho chi tiết, nên cấu trúc này có nguy cơ đẩy nội dung hoặc nút ra khỏi vùng an toàn. Chưa kết luận mọi món hiện tại đều bị tràn.

## Chọn bố cục

| Phương án | Lợi ích | Đánh đổi |
| --- | --- | --- |
| **Lưới 12 món + chi tiết cố định — đề xuất** | Nhận diện art nhanh, xem nhiều món, đọc và nâng cùng màn hình. | Thumbnail nhỏ hơn màn gallery; cần cuộn phần mô tả bên phải. |
| Danh sách chữ + thumbnail lớn hơn | Ít thay đổi code, tên dài dễ đọc. | Vẫn ít tận dụng 41 art và phải đọc tuần tự. |
| Gallery toàn màn + modal chi tiết | Art lớn, nhiều ô. | Mỗi lần đọc/nâng phải mở/đóng modal, khó so sánh qua nhiều món. |

Khung mục tiêu 1280 × 720: header 48 px; bên trái rộng khoảng 612 px, bên phải khoảng 600 px; khoảng cách 20 px; lưới 4 cột × 3 hàng. Header, bộ lọc, phân trang và footer nâng cố định. Chỉ phần thông tin dài cuộn. Khi màn nhỏ, cần thiết kế theo vùng game thực tế của Phaser; CSS responsive trong mockup chỉ giúp xem tài liệu.

## Review từng phần nhỏ

| Thành phần | Vấn đề / mục đích | Đề xuất cụ thể | Ưu tiên |
| --- | --- | --- | --- |
| 1. Header | Tên màn chưa giải thích phạm vi kho. | “Kho đồ”, dòng phụ “Binh Khí & Nguyệt Bảo”; Quay lại giữ luồng Home. | P0 |
| 2. Nguyên liệu | Khó liên hệ số dư với việc nâng. | Hiện Huyền Thiết / Nguyệt Trần cạnh icon sẵn có; số dư lấy từ profile, cập nhật sau nâng. | P0 |
| 3. Hai tab nhóm | Người chơi cần biết mức hoàn thành bộ sưu tập. | “Binh Khí — 4/25 sở hữu”, “Nguyệt Bảo — 3/16 sở hữu”; đếm ID sở hữu, không đếm bản sao. Số trong mockup là minh họa. | P0 |
| 4. Tìm kiếm | Chỉ có phân trang nên tìm tên chậm. | Ô tìm tên, hỗ trợ có/không dấu, reset trang khi đổi query. | P0 |
| 5. Độ hiếm | Màu thôi chưa đủ rõ. | Bộ lọc Hiếm / Sử thi / Truyền thuyết; label chữ trong chi tiết và tooltip trên dấu màu. Không quy đổi rarity thành số sao. | P1 |
| 6. Sắp xếp | Đồ có thể dùng bị trộn với đồ chưa có. | Mặc định sở hữu trước; tùy chọn độ hiếm, cấp cao trước, tên A–Z. Dùng tie-break ổn định để món không nhảy bất ngờ. | P0 |
| 7. Lọc sở hữu | Không nhìn nhanh được việc cần làm. | Tất cả / Đã sở hữu / Nâng cấp được / Chưa sở hữu. “Nâng cấp được” = đã có, cấp < 5, đủ đúng nguyên liệu, có thể gọi API. | P0 |
| 8. Ô art | Thumbnail hiện tại quá nhỏ, art chưa trở thành công cụ nhận diện. | Toàn ô là vùng chọn; contain ảnh, không kéo méo/cắt mất mũi hoặc cán vũ khí. 12 ô/trang, nền tối giữ độ tương phản. | P0 |
| 9. Tên món | Tên dài dễ cạnh tranh với badge. | Vùng tên tối đa 2 dòng, tách vùng cấp ở dưới; tooltip/tap chi tiết cung cấp tên đầy đủ. | P0 |
| 10. Cấp sở hữu | Rarity và cấp nâng cần khác nhau về nghĩa. | Label “Tinh Luyện 3/5” hoặc “Cộng Minh 2/5”, không dùng cùng một dãy sao với rarity. | P0 |
| 11. Trạng thái ô | Người chơi cần nhận ra chưa có / tối đa / nâng được. | Badge ngắn có chữ; giảm sáng art chưa có vừa phải; cấp 5 hiện “Tối đa”; chỉ hiện “Nâng được” khi đủ điều kiện. | P0 |
| 12. Viền chọn | Hover và selected dễ bị nhầm. | Selected viền sáng 2 px và inset/khung rõ; hover nhẹ hơn; focus bàn phím riêng. Không dựa chỉ vào màu rarity. | P0 |
| 13. Phân trang | Cần biết đang ở đâu trong kho. | “25 Binh Khí · Trang 1/3”, nút trước/sau và số trang; disable đúng ranh giới. Giữ món đang xem khi chuyển trang. | P0 |
| 14. Empty state | Không có kết quả không nên thành màn trống. | “Không tìm thấy trang bị phù hợp”, gợi ý đổi tên/bỏ lọc và nút Xóa bộ lọc. Nếu giữ chi tiết cũ, label “Nằm ngoài bộ lọc”. | P0 |
| 15. Nhớ trạng thái | Đổi nhóm/reset hiện làm mất ngữ cảnh. | Lưu selection và bộ lọc riêng theo nhóm trong phiên scene; ưu tiên món sở hữu đầu tiên khi chưa có selection hợp lệ. Mockup đổi nhóm về fixture mặc định để dễ review. | P1 |
| 16. Tiêu đề chi tiết | Cần phân biệt sở hữu và đang xem trước. | Tên lớn, độ hiếm + loại nhỏ phía trên; cấp sở hữu giữ cố định. Đồ chưa có ghi rõ “Chưa sở hữu”. | P0 |
| 17. Art lớn | Muốn xem đẹp nhưng art không nên đẩy hết thông tin khỏi màn. | Preview contain; nút Xem art lớn mở overlay; giữ đầy đủ 1024 × 1536 original, Esc/Đóng để trở lại. | P1 |
| 18. Bản mệnh / vũ khí chung | Người chơi có thể hiểu nhầm vũ khí dành riêng cho một Hero. | Hiện avatar + tên bản mệnh và “Nội tại mạnh hơn khi Hero bản mệnh mang”; Hero khác vẫn có thể mang. Vũ khí chung hiển thị archetype tiếng Việt từ nhãn game hiện có. | P0 |
| 19. Nguyệt Bảo | Không phải slot trang bị toàn tài khoản. | Ghi tối đa 2 Nguyệt Bảo trong mỗi bộ bài; hiệu ứng áp dụng theo luật hiện tại. | P0 |
| 20. Tab Hiệu ứng | Toàn bộ 5 cấp hiện cùng lúc tạo gánh nặng đọc. | Mặc định hiệu ứng ở cấp sở hữu; Binh Khí tách lá bài và nội tại/bản mệnh. Lợi ích cấp kế tiếp nằm ngay phía dưới. | P0 |
| 21. Xem cấp 1–5 | Preview dễ bị hiểu là đã nâng. | Nhãn “Đang xem trước … · Cấp sở hữu giữ nguyên”; đổi preview chỉ thay nội dung, không thay giá, selection hay profile. | P1 |
| 22. Tab Các cấp | Cần theo dõi tiến trình mà không lẫn luật. | Đánh dấu cấp hiện tại/đã đạt. Binh Khí tính effective card/hooks bằng `weaponAt`; Nguyệt Bảo hiển thị `relicAt` từng cấp và nói rõ cấp sau thay thế cấp trước. | P0 |
| 23. Tooltip lá Binh Khí | Chỉ hover không thuận tiện khi dùng chạm. | Dùng renderer card hiện có; hover nhanh và tap/click mở overlay ghim có Đóng/Esc. Tiêu đề chỉ rõ cấp đang xem. | P1 |
| 24. Sử dụng trong bộ bài | Người chơi cần biết món đã được dùng ở đâu. | Từ `profile.decks`, liệt kê các bộ bài tham chiếu món và link mở sửa bộ bài. Không có nút “Trang bị toàn tài khoản”. | P1 |
| 25. Chi phí nâng | Giá/cấp kế tiếp đang xa hiệu ứng. | Footer cố định: “Nâng 3 → 4 · Huyền Thiết”, “96 / 65”, nút Nâng Cấp. Thiếu ghi chính xác thiếu bao nhiêu; không chỉ đổi màu. | P0 |
| 26. Nâng tối đa / chưa sở hữu | Nút vô hiệu chưa giải thích đầy đủ tình huống. | Cấp 5 ghi “Đã đạt cấp tối đa”; chưa có ghi “Cần sở hữu trước khi nâng”, Triệu Hồi trở thành CTA chính. | P0 |
| 27. Loading / offline / lỗi | API chậm hoặc lỗi phải giữ ngữ cảnh. | Ghi Đang nâng… và khóa thao tác gửi trùng; offline ghi cần kết nối; lỗi giữ món/lọc/trang và toast; thành công cập nhật cấp, số dư, badge và delta kế tiếp. | P0 |
| 28. Cuộn và lifecycle | Nội dung dài và callback sau khi rời scene có thể gây lỗi UI. | Mask vùng chi tiết, chỉ scroll trong vùng; cố định footer. Guard generation của scene/request trước khi render; dọn listener/tween/mask khi shutdown. | P0 |
| 29. Triệu Hồi | Dễ gây hiểu nhầm chọn món là quay ra món đó. | Chỉ mở màn Triệu Hồi sẵn có; không hứa tỉ lệ/kết quả cho món đang chọn. | P0 |
| 30. Typography / spacing | Nhiều lớp chữ ngang hàng làm khó quét. | Title 24–26 px; body khoảng 14–16 px; label 11–12 px; hiệu ứng dòng thoáng. Đồng bộ màu/bo góc/focus với màn hero vừa cải thiện. Đo lại font thực tế trong Phaser. | P0 |

## Tận dụng assets

- Đã đối chiếu đủ **25/25 Binh Khí** ở `assets/weapons/{id}.png` và **16/16 Nguyệt Bảo** ở `assets/relics/{id}.png`.
- Đây là art có cảnh nền, không phải cutout trong suốt. Preview dùng contain; lưới giữ ảnh đầy đủ để không mất hình dáng vũ khí. Nếu thumbnail vẫn khó nhận diện ở màn nhỏ, ưu tiên điều chỉnh mật độ lưới/kích thước trước.
- Dùng `cur_darkIron.webp`, `cur_moonDust.webp`, art Hero cho bản mệnh và background Home sẵn có. Icon navigation, check, lock có thể dùng từ manifest nếu phù hợp; “chưa sở hữu” cần label rõ vì icon lock thường gợi chức năng khóa bảo vệ đồ.
- Frame, viền, tab, scroll và badge vẽ bằng UI code. Không cần gen asset mới cho đề xuất này; hiện không có lỗ hổng art cần bù. Giữ renderer `equipment-art.ts` và manifest hiện có.

## Ràng buộc dữ liệu cần giữ

Mỗi trang bị có một bản ghi sở hữu/cấp, không có inventory capacity hoặc số bản sao trong kho. Binh Khí là lá bài và hooks, không phải hệ chỉ số ATK/DEF. Dùng `weaponAt` để resolve patch cấp; `relicAt` chọn toàn bộ cấp hiện tại. Nguyên liệu và giá lấy từ economy config; upgrade vẫn dùng API hiện có và server quyết định kết quả. Trang bị là cấu hình từng bộ bài; không thêm equip toàn tài khoản.

Giữ scene Home → Armory, hai nhóm Kho đồ và các API `/profile/weapons/:id/upgrade`, `/profile/relics/:id/upgrade`. Không đổi gacha, pity, schema, tỉ lệ quay hay màn Nguyệt Ước. Đề xuất phù hợp quyết định reuse Armory trong `docs/superpowers/specs/2026-10-06-nguyet-uoc-inventory-design.md`.

## Mockup ở giai đoạn đề xuất

`mockup.html` là bản tương tác độc lập; đọc định nghĩa, tên, art và giá nâng trực tiếp từ JSON trong worktree. Profile minh họa gồm 4 Binh Khí, 3 Nguyệt Bảo, 96 Huyền Thiết, 18 Nguyệt Trần và ví dụ “Đội Hoắc Liệt”. Đây không phải tài khoản người chơi. Nút nâng chỉ mở hộp xem trước, không gọi API hay tiêu nguyên liệu. Responsive HTML không phải cam kết bố cục Phaser trên mobile.

`preview.png` là ảnh mockup ở 1280 × 720. Ở giai đoạn đề xuất chỉ có tài liệu, mockup và ảnh trong `docs/inventory-ui/`; trạng thái triển khai hiện tại ghi bên dưới.

Đã kiểm tra thủ công trên trình duyệt: tìm `xich diem` trả đúng Xích Diệm Thương; kết hợp lọc chưa sở hữu ra empty state và xóa lọc khôi phục đủ danh sách; xem cấp 5 vẫn giữ sở hữu 3 và giá nâng 3 → 4 là 65 Huyền Thiết; hộp nâng minh họa đúng số dư còn 31; món cấp 5/chưa sở hữu không thể nâng; tab Nguyệt Bảo hiển thị Cộng Minh 2 → 3 giá 8 Nguyệt Trần và các cấp thay thế nhau. Chưa kiểm thử giao dịch thật/offline/busy vì mockup không nối API.

## Hướng triển khai sau khi duyệt

1. Refactor view của `armory-scene.ts` thành lưới + detail/footer; tái sử dụng style/widget, manifest, equipment art và card renderer. Chỉ tách helper trình bày nếu scene bắt đầu khó đọc.
2. Thêm state tìm/lọc/sort/page/selection theo nhóm; tính tập dữ liệu rồi render, giữ ID ổn định và xử lý empty state.
3. Render effective effects bằng rules helpers, current → next, chi phí theo profile thật; bổ sung các trạng thái offline/busy/error và guard callback lifecycle.
4. Thêm card/art overlay, cuộn có mask và navigation tới bộ bài nếu luồng hiện có hỗ trợ; ưu tiên P0 trước phần phụ P1.
5. Kiểm tra toàn bộ 41 món, tên dài và mô tả cấp 5; đủ/thiếu nguyên liệu, cấp tối đa, chưa có, tab đổi khi request đang chạy, rời/vào lại scene, keyboard/touch, assets thiếu và kích thước game thực tế. Sau đó chạy typecheck, unit tests liên quan và build; không dùng kết quả cũ để xác nhận implementation mới.

Ở lượt đề xuất, kiểm chứng giới hạn ở mockup và assets. Lượt triển khai đã chạy kiểm tra sản phẩm như ghi bên dưới.

## Triển khai trong game — 12/10/2026

Đã thay `ArmoryScene` bằng lưới 12 món/trang, tìm tên không dấu, lọc sở hữu/độ hiếm/nâng được, sắp xếp, nhớ trạng thái riêng từng nhóm, chi tiết Hiệu ứng / Các cấp / Sử dụng và footer nâng cố định. Art/card có popup đóng bằng Esc hoặc click ngoài, có bàn phím chọn món, nút cuộn và scrollbar. Tab Sử dụng lấy bộ bài thật từ profile và mở bản clone vào deck builder.

Hiệu ứng dùng `weaponAt` / `relicAt`; giá dùng `upgradeCost`; API và cơ chế trang bị giữ nguyên. Passive prose trình bày nội tại gốc kèm các thay đổi hooks theo cấp, vì mô tả refinement có thể chỉ là cập nhật một phần hoặc riêng bản mệnh. Đây là lựa chọn trình bày để giữ ngữ cảnh, không thay luật combat.

Review độc lập phát hiện phản hồi thành công sau khi rời/vào lại scene có thể để lại giá cũ. Đã giữ generation/auth guard và bổ sung observer hồ sơ/revision của scene hiện tại, đồng thời từ chối gửi thao tác dựa trên giá đang cần refresh. Kiểm tra hồi quy đã tái hiện lỗi trước khi sửa và đạt sau sửa.

Kiểm tra hình ảnh bổ sung phát hiện legacy geometry mask không che text dưới WebGL Phaser 4. Đã dùng external Mask filter theo pattern scene Hero, giữ geometry mask cho Canvas; vùng tab không đổi pixel khi cuộn text dài. Xem [Phaser Mask filter API](https://docs.phaser.io/api-documentation/class/filters-mask).

Xác minh unit: data 50, rules 810 (4 skipped), client 294, server 68 đạt; client/server/data/rules typecheck và build workspace đạt. Lượt chạy gộp ban đầu có server story T305 timeout 5 giây khi có browser chạy đồng thời; chạy lại toàn bộ server riêng đạt 68/68. Không sửa server để xử lý timeout môi trường này.

Bộ browser test trong `apps/client/e2e/armory-ui.spec.ts` dùng account trên test backend pg-mem và hồ sơ fixture để kiểm tra UI. Hai test giao dịch intercept HTTP ở ranh giới API, phản hồi đầy đủ profile/revision; không tác động tài khoản thật. Kết quả lượt cuối và ảnh UI thật được lưu sau khi chạy xong.

Lượt browser cuối trên code ổn định: **11/11 đạt** (4,5 phút), không có `pageerror`. Bao gồm search/lọc/reset/phân trang, state riêng theo nhóm, xem cấp độc lập giá nâng, max/chưa có/offline, nâng qua API/busy, callback muộn thành công/lỗi, layout chi phí, bàn phím/card popup, mở bộ bài thật, resize và pixel regression của vùng tab khi cuộn. Ảnh `production-weapons.png`, `production-relics.png`, `production-card.png`, `production-art.png` là UI Phaser thật với hồ sơ test minh họa, không phải mockup.

Branch/worktree được giữ để review, chưa merge hoặc push.
