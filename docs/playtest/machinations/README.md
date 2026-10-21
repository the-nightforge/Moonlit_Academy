# Thiết lập Machinations cho Vọng Nguyệt

Bộ này chuẩn bị dữ liệu và thiết kế mô hình. Đã kết nối phiên Edge đăng nhập, tạo [Vong Nguyet - Hoi Phuc - v1 trên Machinations](https://my.machinations.io/d/vong-nguyet---hoi-phuc---v1/df19c4fccd1a11f189880abc5ce0dcc9) và kiểm chứng ba lần Forecast trên máy chủ ngày 2026-10-21.

Giao diện tài khoản hiện dùng tên **Agent**, **Params** và nút **Forecast**. Một số phần bên dưới dùng tên AI Builder, Custom Variables và Predict theo tài liệu cũ; hãy đối chiếu chức năng tương ứng trong giao diện.

## Dùng ngay sơ đồ đã tạo

1. Mở liên kết sơ đồ ở trên.
2. Chọn **Params** ở thanh trái, nhấp `regen_initial`, sửa ô **Formula**, rồi **Save**. `hp_initial` và `hp_max` chỉnh tương tự.
3. Ở thanh chạy dưới cùng, chọn **8 turns** và **5 plays**, rồi bấm **Forecast**. Giao diện đang dùng giữ mức tối thiểu 5 plays; nhập 1 sẽ quay lại 5. Bản thiết kế này tất định, không cần tăng số lần chạy.
4. Đọc **Results → Forecasts**. Chú ý ngày giờ và bộ tham số của lần chạy; kết quả cũ không tự cập nhật sau khi sửa Params.

Các kết quả thực đã đối chiếu (mỗi Forecast gồm 5 plays, 8 turns):

| Kết quả lưu | `regen_initial` | `hp_initial` | `hp_max` | Máu thực hồi cuối | Máu cuối |
|---|---:|---:|---:|---:|---:|
| Forecast 1 | 4 | 26 | 56 | 10 | 36 |
| Forecast 2 | 5 | 54 | 56 | 2 | 56 |
| Forecast 3 | 5 | 26 | 56 | 15 | 41 |

Đã đặt lại Params về **5 / 26 / 56**. Balancer đã được cấu hình và gửi chạy: Target **Máu thực hồi**, **Fixed Value = 10**, Influencer **regen_initial**, khoảng **2–5**, **Integer**, Accuracy **Low**. Xem tiến độ trong **History → Balancer**; kết quả tối ưu chưa được xác nhận ở thời điểm ghi chú này. Mục tiêu này là ví dụ học công cụ, không phải đề xuất giảm sức mạnh thẻ.

Muốn mở lại cấu hình tối ưu, chọn node **Máu thực hồi**, nhấp phải → **Balance this node**. Danh sách **Add Influencer** có thể cần cuộn xuống cuối mới thấy `regen_initial`.

Agent đã tạo thêm một số node phụ mang tên Bể máu tích lũy/Kho tầng hồi phục. Chúng không đại diện tài nguyên hay luật có trong game. Đánh giá mô hình bằng các chỉ số Số lượt đã qua, Số lượt hồi, Tổng hồi tiềm năng, Máu hiện tại, Máu thực hồi và Tầng Hồi Phục còn lại. Không áp dụng gợi ý tự động bổ sung vòng lặp hồi phục: mô hình này chỉ kiểm tra **một lần áp Hồi Phục**.

## Bắt đầu bằng mô hình Hồi Phục

Mục tiêu đầu tiên: kiểm tra số máu nhận được từ một lần áp Hồi Phục, sau đó thử AI Balancer với một biến. Đây là bước kiểm tra công thức trước khi dựng mô hình hai đội. Mô hình này **không đo tỉ lệ thắng, độ dài trận hoặc độ mạnh tổng thể của thẻ**.

Mỗi bước là **một đầu lượt của phe sở hữu tướng**. Hồi Phục hồi bằng số tầng hiện có, sau đó giảm một tầng. Máu không vượt mức tối đa. Ví dụ 5 tầng tạo chuỗi hồi 5, 4, 3, 2, 1. Khi không có thay đổi hệ số hoặc áp thêm, tổng tiềm năng là 15.

Máu tối đa của Ôn Như Ý trong PvP hiện là 56. Máu ban đầu 26 ở đây là giá trị thử cho tướng đã bị thương; trận thật bắt đầu với đầy máu. Không có sát thương đầu vào, pha trăng, thăng cấp, Kiệt Sức hay quyết định đánh bài trong mô hình nhỏ này.

## Tạo sơ đồ

1. Mở https://my.machinations.io/ và tạo sơ đồ mới, đặt tên `Vong Nguyet - Hoi Phuc - v1`.
2. Nếu tài khoản hiển thị **AI Builder**, chép toàn bộ `builder-prompt.txt` vào công cụ đó. Prompt đã mô tả node, liên kết, công thức và kết quả đối chiếu. Nếu công cụ không xuất hiện, làm theo bảng thủ công bên dưới.
3. Kiểm tra cấu trúc và các giá trị đối chiếu. Chỉ chạy Predict sau khi đúng.

Không cần tải JSON lên dịch vụ khác hoặc cấu hình External JSON để làm bước này. `source-snapshot.json` là tài liệu dữ liệu, **không phải định dạng import sơ đồ Machinations**. Tệp CSV cũng chỉ dùng để tham chiếu.

Gói Community dùng sơ đồ công khai theo trang giá tại ngày 2026-10-21. Bắt đầu với mô hình cơ chế nhỏ này; cân nhắc phạm vi công khai trước khi đưa toàn bộ dữ liệu game vào tài khoản. AI Builder và các lần chạy có thể tiêu hao Events theo hạn mức tài khoản; kiểm tra số còn lại trên trang.

## Dựng thủ công nếu không có AI Builder

Tạo ba Custom Variables loại Math Expression:

| Tên | Giá trị |
|---|---:|
| `regen_initial` | 5 |
| `hp_initial` | 26 |
| `hp_max` | 56 |

Tạo một Source tên **Bắt đầu lượt**, đặt Automatic, đẩy 1 tài nguyên mỗi bước đến Pool **Số lượt đã qua**. Pool bắt đầu ở 0 và chỉ nhận tài nguyên; tránh để cả Source và Pool cùng chủ động kéo/đẩy gây tăng hai lần.

Sau đó tạo các Register ở chế độ Passive (Interactive tắt). Mỗi hàng dưới dùng một **State Connection** từ node đầu vào, nhãn công thức của liên kết là `a`:

| Register | Node đầu vào | Công thức Register |
|---|---|---|
| Số lượt hồi | Số lượt đã qua | `min(a, regen_initial)` |
| Tổng hồi tiềm năng | Số lượt hồi | `a * (2 * regen_initial - a + 1) / 2` |
| Máu hiện tại | Tổng hồi tiềm năng | `min(hp_max, hp_initial + a)` |
| Máu thực hồi | Máu hiện tại | `a - hp_initial` |
| Tầng Hồi Phục còn lại | Số lượt đã qua | `max(0, regen_initial - a)` |

`a` là tên đầu vào riêng của từng Register, không phải một biến dùng chung. Bật **Show in Chart** cho số lượt, tầng còn lại, tổng hồi, máu hiện tại và máu thực hồi. Không nối tài nguyên trực tiếp vào Register.

Tổng cộng cần 7 node: 1 Source, 1 Pool, 5 Register.

## Chạy kiểm tra đầu tiên

Chạy từng bước để đối chiếu theo **giá trị Pool Số lượt đã qua** (không dựa vào vị trí hàng đầu tiên trong biểu đồ):

| Số lượt đã qua | Tầng còn lại | Tổng hồi tiềm năng | Máu hiện tại |
|---:|---:|---:|---:|
| 0 | 5 | 0 | 26 |
| 1 | 4 | 5 | 31 |
| 2 | 3 | 9 | 35 |
| 3 | 2 | 12 | 38 |
| 4 | 1 | 14 | 40 |
| 5 | 0 | 15 | 41 |
| 8 | 0 | 15 | 41 |

Kiểm tra thêm giới hạn: `hp_initial = 54`, `hp_max = 56`, `regen_initial = 5` phải kết thúc ở 56 máu, **Máu thực hồi = 2**, còn tổng hồi tiềm năng vẫn 15.

Đặt lại `hp_initial = 26`, `regen_initial = 5`. Mở **Predict**, chọn 8 bước và 1 lần chạy trước. Mô hình này tất định, nên chạy hàng nghìn lần không cung cấp thêm thông tin. Predict chạy trên máy chủ; Play dùng để kiểm tra từng bước trong giao diện. Nếu số liệu sai, kiểm tra Source/Pool có tăng đúng 1 mỗi bước và liên kết đầu vào Register có đúng nhãn `a`.

## Thử AI Balancer

Đây là bài làm quen công cụ, **không phải đề xuất giảm sức mạnh thẻ thật**:

1. Giữ `hp_initial = 26`, `hp_max = 56`, thời lượng 8 bước.
2. Chọn Register **Máu thực hồi** làm **Target**, loại **Fixed value**, giá trị **10**.
3. Chọn Custom Variable **regen_initial** làm **Influencer**, khoảng **2–5**, chỉ cho số nguyên. Trong giao diện cấu hình Influencer, kiểm tra phạm vi và không gian tìm kiếm trước khi chạy.
4. Không chọn công thức của Register làm Influencer: Balancer có thể thay cả công thức bằng một số cố định.
5. Bắt đầu với mức Accuracy thấp để thử thiết lập, chọn **Balance values** nếu gói tài khoản cho phép.
6. Kết quả đối chiếu là **regen_initial = 4**: tổng hồi 4 + 3 + 2 + 1 = 10, máu cuối 36.
7. Xem kết quả trước khi **Apply Changes to Diagram**, rồi chạy Predict lại một lần để kiểm tra. Nếu bị khóa tính năng/hết Events, vẫn có thể đổi tay `regen_initial` giữa 2, 3, 4, 5 và so biểu đồ.

Mục tiêu 10 chỉ phục vụ kiểm tra. Mục tiêu cân bằng thật phải được quyết định dựa trên độ dài trận, chi phí, số bản, chiến thuật và kèo đấu.

## Mở rộng sang sát thương và hai đội

`full-combat-brief.md` ghi phạm vi và yêu cầu cho mô hình đầy đủ. `source-snapshot.json` chứa dữ liệu hai đội cơ bản (cùng hai tướng, khác vị trí hỗ trợ), số bản lá và lá Song Hành đủ cặp. Mô hình này chưa được dựng hoặc kiểm chứng trên Machinations.

Không suy ra thắng thua từ tổng hồi hoặc tổng máu hai đội. Muốn có tỉ lệ thắng cần mô hình riêng cho từng tướng, danh tính lá trên tay, chọn mục tiêu, thứ tự effect, khả năng thăng cấp, pha trăng, chiến thuật và điều kiện kết thúc.

Chỉ đưa một thay đổi trở lại game sau khi đối chiếu cơ chế và kiểm tra trong engine thật. Bộ này không tự thay đổi `packages/data`.

## Tệp và cập nhật dữ liệu

Chạy lệnh nhẹ sau để xuất lại dữ liệu; lệnh không mô phỏng trận đấu:

```powershell
node scripts/playtest/export-machinations.mjs
```

Kết quả nằm trong `output/machinations/vong-nguyet-kit/`:

- `HUONG-DAN.md`: hướng dẫn này.
- `builder-prompt.txt`: nội dung sẵn để dán vào AI Builder nếu có.
- `source-snapshot.json`: dữ liệu nguồn kèm SHA-256 từng tệp để phát hiện thay đổi.
- `cards.csv`, `teams.csv`: bảng tham chiếu thẻ và máu PvP.
- `regen-reference.csv`: 36 hàng kết quả số học đối chiếu; không phải kết quả chạy Machinations.
- `combat-rules-reference.md`: bản chụp luật đầy đủ tại thời điểm xuất.
- `full-combat-brief.md`: yêu cầu mở rộng, chưa phải sơ đồ thực thi.

## Nguồn chính thức

- [Registers và nhãn đầu vào](https://machinations.io/docs/registers)
- [Play và Predict; Predict tính trên máy chủ](https://machinations.io/articles/the-difference-between-play-and-predict)
- [Thiết lập Target và Influencers](https://machinations.io/docs/ai-balancer-selecting-nodes-for-balancer)
- [Tránh ghi đè công thức khi áp kết quả](https://machinations.io/docs/ai-balancer-applying-the-optimized-results)
- [Giá và hạn mức](https://machinations.io/pricing)
- [Changelog có AI Builder](https://machinations.io/docs/changelog)
