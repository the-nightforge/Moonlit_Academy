# Yêu cầu mô hình hai đội — chưa triển khai trên Machinations

Mục tiêu: kiểm tra tương tác sát thương, hồi phục và độ dài trận trong PvP, bắt đầu với cùng hai tướng nền và một vị trí khác nhau. Không dùng kết quả mô hình Hồi Phục riêng lẻ để suy ra tỉ lệ thắng.

## Dữ liệu

Nguồn là `source-snapshot.json`, xuất từ dữ liệu đang có trong workspace, kèm hash. Không mặc định workspace này đã được commit hoặc giống bản production.

- Đội A: Hoắc Liệt (`m05`), Ôn Như Ý (`f04`), Tô Dạ (`m06`).
- Đội B: Hoắc Liệt (`m05`), tướng `m10`, Tô Dạ (`m06`). Tên và máu cụ thể nằm trong snapshot.
- Bộ cơ bản: `cardIds` từng tướng theo đúng thứ tự; mỗi định nghĩa nhân theo `copies`.
- Thêm lá Song Hành có đủ cả hai chủ trong đội, đúng số bản.
- Không trang bị, Kỳ Vật hoặc nâng cung. Máu PvP lấy từ `pvp-config.heroStats`, không lấy `heroes.maxHp` của PvE.
- Đây là một cặp đội hình để kiểm tra, không đại diện toàn bộ meta. Hoắc Liệt cũng có hồi máu: không gắn nhãn đội B là đội không có hồi máu.

## Cơ chế bắt buộc

1. Sáu tướng có máu, giáp, trạng thái, thăng cấp và sống/ngã riêng. Không gộp cả đội vào một thanh máu.
2. Lượt đi trước/đi sau, bù Nguyệt Lực cho lượt đầu người đi sau, rút bù, đổi bài, giữ bài, giới hạn tay và Dự Trữ theo luật.
3. Danh tính từng lá, chủ sở hữu, số bản, thứ tự chồng rút, tay, chồng bỏ. Không trộn chồng bỏ lại chồng rút. Xử lý Tàn Chiêu khi chủ ngã.
4. Trạng thái đầu lượt: Hồi Phục hồi theo tầng rồi giảm 1. Thiêu Đốt, Kiệt Sức, Huyết Nguyệt và kiểm tra ngã đúng thứ tự engine. Luật và engine hiện có thể khác nhau ở chi tiết; đối chiếu `packages/rules/src/turn.ts` khi kiểm chứng, không âm thầm chọn một diễn giải.
5. Bách Thảo Hương: nếu mục tiêu đã có Hồi Phục thì cộng 5, nếu chưa có thì cộng 3; sau đó gây sát thương theo tổng Hồi Phục trên cả đội theo dữ liệu. Không thay bằng hồi tức thời.
6. Hồi Xuân Tán: giữ đủ một lượt thì áp 4 Hồi Phục, nếu chưa đủ thì 2; áp cho mọi đồng minh còn sống; sát thương theo tổng Hồi Phục thực hiện sau đó.
7. Nội tại Bách Thảo lan Hồi Phục sau thăng cấp đúng điều kiện. Áp effect và kiểm tra ngã/thắng sau từng effect. Giới hạn hồi máu, giáp và trạng thái theo engine.
8. Pha trăng, Nguyệt Lệnh, hệ số hồi, giảm giá, chi phí thực tế và thứ tự làm tròn phải rõ ràng. Một thử nghiệm cố định pha/hệ số phải được ghi nhãn là thử nghiệm cô lập.
9. Kiệt Sức từ vòng cấu hình, Cạn Bài, hết đội và hòa khi vượt roundCap. Hòa phải được báo riêng.

## Chiến thuật và số đo

Phải mô tả cách chọn lá, thứ tự đánh và mục tiêu. Khởi đầu bằng chính sách rõ ràng và lặp lại được: tìm kết liễu hợp lệ, tránh ngã ngay khi có phương án cứu, rồi đánh lá hợp lệ theo điểm hiệu quả; hòa điểm theo thứ tự cố định. Chính sách này chỉ là baseline, chưa tương đương bot hiện có hoặc người chơi.

So nhiều chính sách thiên tấn công/phòng thủ/hồi phục. Đảo bên đi trước, thay mẫu xáo bài, báo riêng tỉ lệ thắng/thua/hòa, số mẫu, độ bất định, số vòng, sát thương và hồi thực tế, hồi dư, lá dùng và Nguyệt Lực không dùng. Không đưa tỉ lệ thắng vào mô hình như một hằng số đầu vào rồi tối ưu chính nó.

Vòng đầu chỉ mở một tham số trong một lá của Ôn Như Ý, giữ nguyên các biến còn lại. Đối chiếu chiến thuật và tác động ngoài mục tiêu trước khi đề xuất patch. Không chỉnh trực tiếp dữ liệu game bằng kết quả Balancer.

## Điều kiện chấp nhận

- Các tình huống nhỏ khớp engine thật: hồi gần đầy máu, cộng tầng trước/sau tick, Tích Tụ, chủ lá ngã, hồi lan sau thăng cấp, cạn bài, bù người đi sau.
- Mô hình phải báo rõ cơ chế chưa hỗ trợ. Không im lặng xấp xỉ thành lượng sát thương/hồi trung bình rồi gọi là mô phỏng luật thật.
- Sau khi các tình huống đã khớp, so diễn tiến một số trận mẫu trước khi dùng thống kê lớn.
- Chỉ công bố mô hình đã chạy sau khi có sơ đồ Machinations được lưu và kết quả thực từ Predict.
