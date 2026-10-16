**Review tổng thể Vọng Nguyệt Thư Viện — 16/10/2026**

Phạm vi: mã nguồn, dữ liệu, tài liệu thiết kế, các báo cáo nghiệm thu và hiện vật playtest trong workspace tại `main`, commit `5ae21cd`. Đây là review sản phẩm kèm kiểm tra logic; không phải một phiên chơi trực tiếp hoặc báo cáo hiệu năng trên thiết bị thật. Không sửa luật, dữ liệu hay giao diện trong lượt review này.

**1. Nhận định chung**

Game có bản sắc chiến thuật rõ: ba nhân vật có bộ bài riêng, thăng cấp trong trận theo cách chơi, Nguyệt Luân thay đổi điều kiện thuận lợi, Song Hành tạo lý do ghép đội. Những hệ thống này có liên hệ với thế giới cổ phong, giúp nhân vật mang ý nghĩa vượt ngoài ngoại hình và chỉ số.

Điểm yếu hiện tại nằm ở việc chuyển độ sâu đó thành trải nghiệm dễ học, đáng tin và có động lực chơi lại. Nhiều tính năng đã tồn tại, trong khi một vài lời hứa với người chơi còn lệch giữa mô tả và thực thi; tiến trình có chỗ phụ thuộc vào quay trùng hoặc tìm người thật; nội dung Tầm Nguyệt mỏng hơn độ rộng danh sách nhân vật. Đợt đầu tư tiếp theo nên tập trung vào tính đúng của luật, phiên chơi đầu, tải tài nguyên và chiều sâu nội dung lặp lại.

Không chấm điểm tổng kiểu “8/10”: chưa có phiên chơi trực tiếp, dữ liệu người chơi đủ rộng hoặc phép đo thiết bị để biến nhận định đó thành con số có ý nghĩa.

**2. Quy mô thực tế**

| Hạng mục | Đã xác minh |
|---|---:|
| Hero | 23 |
| Lá thường của hero | 276: mỗi hero có 6 lá khởi đầu + 6 lá khóa |
| Định nghĩa lá tổng cộng | 309, gồm thêm 23 phiên bản chữ ký nâng cấp, 9 lá Song Hành và 1 lá sinh thêm |
| Kẻ địch | 15 định nghĩa |
| Cấu hình trận | 25: 5 thường, 2 tinh anh, 1 boss Tầm Nguyệt, 16 truyện, 1 Liên Thủ |
| Cốt Truyện | 2 chương, 16 màn |
| Binh Khí / Nguyệt Bảo | 28 / 16 |
| Kỳ Vật / Lõi trong lượt chơi | 10 / 16 |
| Hợp Kích Liên Thủ | 3 |
| Tài nguyên được liệt kê cho chiến đấu | 243 tệp, 158.581.114 byte, khoảng 158,6 MB tệp gốc |

309 định nghĩa không có nghĩa người chơi được chọn 309 lá độc lập. README còn ghi 5 hero, 68 lá và 7 kẻ địch; nên cập nhật tài liệu giới thiệu để phản ánh đúng sản phẩm. Các con số trên lấy từ `packages/data` và cách tạo manifest hiện tại.

**3. Chiến đấu: có nền tảng tốt, cần làm luật đáng tin trước**

Điểm mạnh là Nguyệt Luân thực sự tác động đến quyết định. Có tám pha, mỗi pha có ba Nguyệt Lệnh có thể được chọn lúc tạo trận, pha đầu ngẫu nhiên theo seed và những lá đổi pha. Người chơi có lý do cân nhắc thứ tự đánh bài, giữ tài nguyên và chuyển pha. Một đội thao túng trăng có thể chơi khác một đội đóng băng hoặc một đội dùng máu làm tài nguyên.

Bộ bài hữu hạn cũng là điểm nhận diện: chồng bài không xáo lại, giữ bài cuối lượt và mất quyền dùng lá khi chủ nhân ngã. Từng lá có giá trị lâu dài trong trận. Vì thế, rút nhanh hoặc loại bài không luôn là lợi ích tuyệt đối. Cần giải thích rõ điều này ở phiên đầu và lúc thất bại do Cạn Bài; người quen deckbuilder khác có thể áp dụng trực giác không phù hợp.

Ba vấn đề logic đã được tái hiện bằng probe chạy trên engine hiện tại:

| Vấn đề | Hành vi quan sát được | Ảnh hưởng | Hướng xử lý |
|---|---|---|---|
| Tần Sương, dạng Hàn Kiếm trong Đấu Trường | Đòn đầu áp Dễ Vỡ khi đánh địch ở trận thường, nhưng không áp lên hero đối thủ trong Đấu Trường | Một hình thái không cung cấp hiệu ứng được mô tả trong chế độ cạnh tranh | Xác định đối thủ theo phe/seat, rồi kiểm tra thời lượng trạng thái theo chế độ |
| Điệp Vũ, Vũ Điệp | Khi đội đã đánh hai lá trước đó, đòn tấn công đầu của Điệp Vũ được cộng 2 sát thương | Khác mô tả “các lá tấn công sau lá đầu của Điệp Vũ gây thêm 1”; người chơi có thể xây bộ sai | Chọn ý đồ thiết kế; sửa mô tả hoặc tách nội tại riêng, rồi đồng bộ số xem trước |
| Kiệt Sức trong Liên Thủ | Từ vòng 20 boss nhận mất máu Kiệt Sức, phần bắt đầu lượt chung không áp Kiệt Sức lên hero | Tạo lợi thế cho chiến thuật kéo dài trận, không khớp quy tắc chung áp cho hai bên | Chia sẻ bước Kiệt Sức hoặc thiết kế rõ một cơ chế cuồng nộ riêng cho boss |

Nguồn: [nội tại và sát thương](D:/Source/VongNguyet/packages/rules/src/effects.ts:158), [điều kiện Dễ Vỡ](D:/Source/VongNguyet/packages/rules/src/effects.ts:265), [hero Đấu Trường](D:/Source/VongNguyet/packages/rules/src/pvp/create.ts:92), [mô tả Vũ Điệp](D:/Source/VongNguyet/packages/data/heroes.json:1698), [lượt Liên Thủ](D:/Source/VongNguyet/packages/rules/src/coop/turn.ts:62), [Kiệt Sức của địch](D:/Source/VongNguyet/packages/rules/src/enemy-turn.ts:70).

Ba probe xác nhận hành vi hiện có, không phải ba regression test chứng minh game đã được sửa. Probe gọi trực tiếp logic hiệu ứng/lượt ở trạng thái kiểm soát; không thay thế trận đầy đủ qua giao diện.

**4. Nhân vật và xây bộ: đủ độ rộng để ưu tiên chiều sâu**

23 hero, hai nhánh và hai hình thái tạo nhiều không gian thử đội. Các điều kiện thăng cấp như nhận sát thương, hồi máu theo lượt, đóng băng, cướp hiệu ứng hoặc đổi pha gắn được vai trò với tính cách. Bộ khởi đầu Hoắc Liệt, Ôn Như Ý, Tô Dạ có cấu trúc dễ hiểu: chịu đòn, duy trì máu và kết liễu.

Vấn đề phiên đầu: ba hero khởi đầu có sáu lá miễn phí mỗi người, trong khi bộ cần đúng 18 lá khác nhau. Trước khi nhận hero/mở lá khác, người mới có một tập 18 lá hợp lệ. “Sao chép & sửa” hiện diện sớm nhưng chưa có nhiều lựa chọn chiến thuật thực chất. Thông báo quà tân thủ lại dẫn sang Triệu Hồi.

Nên thiết kế một chuỗi ngắn: chơi một trận được hướng dẫn vừa đủ → nhận quyền chọn một lá → thay đúng một lá trong bộ → thấy sự thay đổi ở trận kế tiếp. Sau khi người chơi hiểu giá trị của một thay đổi, các hệ thống sưu tập và nâng cấp mới có ngữ cảnh.

Nguồn: [đội khởi đầu](D:/Source/VongNguyet/packages/data/economy-config.json:2), [kiểm tra bộ bài](D:/Source/VongNguyet/packages/rules/src/meta/deck.ts:8), [thông báo tân thủ](D:/Source/VongNguyet/apps/client/src/account.ts:132).

Cần dùng những trận kiểm soát để xác nhận mỗi nhánh làm được điều nó hứa, đặc biệt khi tái sử dụng nội tại từ hero cũ. Điệp Vũ cho thấy dùng chung engine tiết kiệm công nhưng có thể tạo sai lệch ngữ nghĩa.

**5. Tầm Nguyệt: nút thắt lớn của giá trị chơi lại**

Cấu trúc tám tầng dễ hiểu và phù hợp một lượt chơi gọn. Tuy nhiên tầng 4 luôn là Kho Báu, tầng 7 luôn Nghỉ Chân và tầng 8 luôn Boss. Kho trận riêng cho lượt chơi chỉ có năm trận thường, hai tinh anh và một boss. Số 25 cấu hình trận tổng thể bao gồm 16 màn truyện, không thể dùng để kết luận Tầm Nguyệt đã đa dạng.

Phần thưởng Lõi/Kỳ Vật giúp lượt chơi khác nhau, nhưng bộ bài chủ yếu giữ nguyên hoặc bị loại bớt. Người chơi ít có cơ hội xây một bộ mới ngay trong hành trình. Nguy cơ là “chọn đội ở ngoài, kiểm tra đội đó ở trong” lấn át cảm giác bộ bài phát triển qua mỗi tầng.

Một hành vi cần sửa hoặc định nghĩa lại: sau thắng, hero còn sống giữ số máu hiện tại; hero đã ngã hồi ở 40% máu tối đa. Với nhân vật tối đa 40 máu, sống sót ở 1 máu có thể kém lợi hơn ngã rồi được hồi lên 16. Trong trận đã gần chắc thắng, cố ý để đồng đội ngã có thể là quyết định tối ưu.

Nên cho người sống một mức hồi tối thiểu tương ứng, hoặc gắn chi phí/giới hạn rõ cho hồi sinh. Sau đó ưu tiên thêm boss luân phiên, sự kiện có lựa chọn và cơ hội đổi/nâng một lá có kiểm soát. Những bổ sung này tận dụng cả 23 hero hiện có.

Nguồn: [cấu trúc tầng](D:/Source/VongNguyet/packages/data/run-config.json:2), [xử lý máu sau trận](D:/Source/VongNguyet/packages/rules/src/run/run.ts:176), [phần thưởng sau trận](D:/Source/VongNguyet/packages/rules/src/run/run.ts:190).

**6. Cốt Truyện: đường dẫn tốt cho người mới, cần khả năng quay lại**

Hai chương và 16 màn có giá trị vì đưa cơ chế vào tình huống và hội thoại. Đối thủ cụ thể có thể giới thiệu rút cạn Dự Trữ, Phản Đòn, bảo vệ mục tiêu hoặc Huyết Nguyệt. Đây là nơi phù hợp để dạy game theo từng quyết định.

Tổng thưởng hoàn thành lần đầu hiện có: 800 Nguyệt Ngọc, tương đương năm lượt quay; 31 Huyền Thiết; 495 kinh nghiệm cho mỗi hero nếu dùng cùng đội xuyên suốt; hai hero thưởng chương là Chu Quyết và Diệp Linh Lung. Có đường mở đội hình chắc chắn là một điểm mạnh.

Hiện nội dung nghiêng về hoàn thành một lần; luồng chọn màn đã qua không cung cấp cách đánh lại như một hoạt động luyện đội. Phần thưởng truyện cũng chưa tự đưa cùng đội tới mốc Tu Luyện 4 là 585 kinh nghiệm. Nên cho xem lại thoại và có hình thức thử thách lại, tách quyền chơi lại khỏi phần thưởng lần đầu. Chỉ phát tiền lần đầu không có nghĩa phải khóa giá trị trải nghiệm của màn đó sau khi hoàn thành.

Nguồn: [dữ liệu truyện](D:/Source/VongNguyet/packages/data/story.json:3), [thưởng truyện](D:/Source/VongNguyet/packages/rules/src/meta/story.ts:95), [mốc Tu Luyện](D:/Source/VongNguyet/packages/data/meta-config.json:2), [giao diện màn truyện](D:/Source/VongNguyet/apps/client/src/ui/story-view.ts:83).

**7. Tiến trình, sưu tập và kinh tế: cần tăng quyền chủ động**

Tu Luyện mở bài bằng chơi là lựa chọn tốt. Bản sao không phải cách duy nhất mở lá. Mốc mở đủ sáu lá khóa là 1.245 kinh nghiệm; nếu chỉ tính mức cơ bản 130 kinh nghiệm mỗi hero cho một lượt thắng đủ tám tầng, mười lượt như vậy đủ mốc này.

Tuy nhiên tiến trình Tu Luyện chủ yếu đến từ Tầm Nguyệt và thưởng truyện lần đầu. Người thích Đấu Trường hoặc Liên Thủ không được nuôi tiến trình mở bài tương ứng từ chế độ họ thích. Nên cho các chế độ chính đóng góp một phần có giới hạn, hoặc hiển thị lộ trình mở bài rõ ngay khi chọn đội.

Các số liệu kinh tế đáng xem:

| Trạng thái/nguồn | Giá trị theo dữ liệu hiện tại | Cách diễn giải |
|---|---:|---|
| Quà tân thủ | 2.400 Nguyệt Ngọc = 15 lượt quay | Không bảo đảm nhận một hero mới theo ý muốn |
| Một lượt quay | 160 Nguyệt Ngọc | Mốc so sánh với tiền kiếm được |
| Thắng Tầm Nguyệt đủ 8 tầng | 44 Nguyệt Ngọc | Thắng đầu ngày tăng thành 74 |
| Một lượt thắng/ngày trong 7 ngày, kèm những nhiệm vụ tương ứng hoàn thành được | 868 Nguyệt Ngọc ≈ 5,425 lượt quay | Chưa tính quà một lần, Liên Thủ, Đấu Trường, nhiệm vụ quay 10 |
| Bảo hiểm Legendary | Tối đa 80 lượt = 12.800 Nguyệt Ngọc từ pity 0 | Bảo đảm độ hiếm, không bảo đảm hero nổi bật |
| Hero nổi bật | Mỗi Legendary có 50% trúng mục tiêu; không có bộ nhớ “đã trượt” | Chưa có giới hạn hữu hạn để bảo đảm đúng mục tiêu |
| Nguyệt Ước binh khí | Chậm nhất Legendary thứ ba, tối đa 240 lượt = 38.400 Nguyệt Ngọc từ 0 | Có điểm kết thúc mục tiêu; Nguyệt Bảo không có cơ chế tương ứng |

Kịch bản 868 giả định mỗi ngày thắng đúng một lượt đầy đủ, nhận nhiệm vụ hoàn thành lượt và dùng ba hero, cùng hai nhiệm vụ tuần thắng/hạ boss. Nhiệm vụ 10 tầng/ngày không hoàn thành bằng một lượt tám tầng, nên không được cộng vào tổng đó. Đây là một kịch bản nguồn thu có ghi điều kiện, không phải thu nhập của mọi người chơi.

Kỳ vọng một Legendary từ rate hiện tại khoảng 34,991 lượt. Kỳ vọng hero nổi bật khoảng 69,982 lượt nếu chỉ kéo đúng mục tiêu khi mục tiêu xuất hiện. Kỳ vọng không phải bảo đảm; không quy đổi các con số đó thành số tuần chơi. Với game không nạp tiền thật, vấn đề chính là quyền thử đội hình và động lực, không phải doanh thu.

Đáng ưu tiên một con đường hữu hạn tới hero mong muốn và hình thái thứ hai. Hình thái thứ hai bị giữ ở Tinh Hồn 5, nghĩa là có hero rồi vẫn cần thêm năm bản sao. Một phần đáng kể thiết kế chiến thuật có thể ở quá xa người muốn thử nó.

Ba banner tuần của Khương Tịch, Phượng Chiêu Dung và Thất Diệp không có pool Rare, phần Common chỉ Tiểu Mãn. Khi chưa chạm pity, 85% kết quả không phải Epic/Legendary sẽ rơi vào cùng Common này. Tuần Tạ Vân Chiêu chỉ có Epic Tô Dạ, vốn là hero khởi đầu. Nên xem lại chất lượng kết quả phụ, không chỉ tỷ lệ độ hiếm.

Nguồn: [kinh tế](D:/Source/VongNguyet/packages/data/economy-config.json:2), [banner](D:/Source/VongNguyet/packages/data/banners.json:41), [quay và pity](D:/Source/VongNguyet/packages/rules/src/meta/gacha.ts:183), [hình thái thứ hai](D:/Source/VongNguyet/packages/rules/src/meta/profile.ts:306), [Tu Luyện](D:/Source/VongNguyet/packages/rules/src/meta/profile.ts:50).

Nhiệm vụ cũng nên tạo lý do thử cách chơi. “Dùng ba hero” tự hoàn thành với mọi đội hợp lệ; thắng lượt và hạ boss thường tăng cùng lúc; nhiệm vụ quay mười lượt trả 40 Nguyệt Ngọc, bằng 2,5% chi phí 1.600. Có thể thay một phần bằng mục tiêu cơ chế/đổi đội hoặc cho chọn cách hoàn thành qua nhiều chế độ. Tránh bắt dùng hero hiếm chưa sở hữu.

Nguồn: [nhiệm vụ](D:/Source/VongNguyet/packages/data/missions.json:2), [ghi tiến độ lượt chơi](D:/Source/VongNguyet/packages/rules/src/meta/economy.ts:112).

**8. Đấu Trường: cần thống nhất định nghĩa “công bằng”**

Chuẩn hóa binh khí và Nguyệt Bảo về cấp 1, bỏ bonus Tinh Hồn chẵn và phiên bản chữ ký nâng cấp là nền tảng đúng hướng. Có năm hero dùng thử, bốn vũ khí và ba Nguyệt Bảo miễn phí.

Nhưng quyền chọn công cụ chưa ngang nhau: hero ngoài danh sách thử cần sở hữu, lá khóa cần mở, hình thái thứ hai còn yêu cầu Tinh Hồn 5. Các mốc Tinh Hồn lẻ không nên bị mô tả như bonus chỉ số trực tiếp; vấn đề ở đây chủ yếu là quyền mở lá/chọn hình thái.

Nếu ý đồ là cạnh tranh với sức mạnh trang bị chuẩn hóa, cần nói đúng điều đó. Nếu ý đồ là ai cũng có cơ hội chiến thuật ngang nhau, Đấu Trường cần mở pool lá/hình thái độc lập với tiến trình sưu tập. Hướng thứ hai đặc biệt phù hợp với một game cá nhân muốn bạn bè vào chơi cùng.

Nguồn: [chuẩn hóa loadout](D:/Source/VongNguyet/packages/rules/src/meta/loadout.ts:59), [kiểm tra quyền dùng bài](D:/Source/VongNguyet/packages/rules/src/meta/deck.ts:61), [danh sách thử](D:/Source/VongNguyet/packages/data/pvp-config.json:27).

Báo cáo mô phỏng gần hơn trong workspace ghi 512 trận, tám đội cố định phủ 20 hero; tỷ lệ thắng người đi trước 50,8%, dải hero 40,6–58,6%, trung vị 10 vòng. Đây là tiến bộ so với chính baseline của thử nghiệm đó. Tuy nhiên chỉ 37,7% trận nằm trong 8–12 vòng, mốc 90% là 25 vòng, và ba hero mới không có trong độ phủ được nêu. Không dùng số 50,8% làm kết luận cân bằng của roster 23 hero hiện tại.

Cần kiểm tra cả thứ tự ba hero, vị trí đi trước/đi sau, hình thái và tập đội; tránh chỉ tăng máu để đưa tỷ lệ thắng vào dải nhưng kéo dài đuôi trận.

Nguồn: [báo cáo mô phỏng có giới hạn](D:/Source/VongNguyet/output/playtest/pvp-verify/notes.md:4).

**9. Liên Thủ: có cơ chế phối hợp, vòng thưởng chưa phục vụ tốt nhóm nhỏ**

Sáu hero, thao tác đồng thời, cùng tác động lên trăng, hỗ trợ chéo và boss nhiều giai đoạn tạo cơ sở phối hợp thật. Nhưng chỉ có ba Hợp Kích; hai trong ba gắn với Tần Sương hoặc cặp Tô Dạ–Diệp Linh Lung. Nên mở thêm tổ hợp dựa trên tag/trạng thái để nhiều đội thể hiện được bản sắc, thay vì mọi đội mạnh phải xoay quanh vài hero.

Phòng riêng và Đấu Tập không phát thưởng. Nguồn Nguyệt Trần thường xuyên lại phụ thuộc vào Liên Thủ tìm đồng đội thật, trong khi vật liệu đó dùng nâng Nguyệt Bảo. Đây là phụ thuộc thiết kế quan trọng với game cá nhân: nếu ít người online, hoặc nhóm bạn muốn chơi phòng riêng, tiến trình sưu tập bị tách khỏi cách họ muốn chơi. Chưa có dữ liệu chứng minh game đang thiếu người; rủi ro nằm ở điều kiện phát thưởng hiện có.

Nên có nguồn solo/đổi vật liệu hiệu suất thấp, hoặc cơ chế thưởng phòng riêng/đồng đội máy có cap và kiểm soát rõ. Tách lựa chọn xã hội khỏi quyền tiếp cận vật liệu cơ bản.

Ba trận thua cũng tiêu đủ ba lượt thưởng/ngày. Khi thắng trận thứ tư, người chơi không nhận cả bonus thắng đầu ngày. Thua vẫn có thưởng nhỏ là điểm tốt; nên tách bonus thắng đầu ngày khỏi cap trận để khuyến khích tiếp tục học boss.

Nguồn: [Hợp Kích](D:/Source/VongNguyet/packages/data/coop-combos.json:8), [cap và thưởng](D:/Source/VongNguyet/packages/rules/src/meta/coop-rewards.ts:41), [settlement theo loại phòng](D:/Source/VongNguyet/apps/server/src/realtime/match-room.ts:442), [nâng trang bị](D:/Source/VongNguyet/packages/rules/src/meta/upgrade.ts:16).

**10. Giao diện, đọc luật và điều khiển**

Những màn dùng DOM như Tu Luyện, Cốt Truyện và Liên Thủ đã có cơ sở tốt: có cuộn, phân cấp và nút native. Các ảnh cũ, ảnh mới được đối chiếu phong cách và asset dùng lại giúp game có danh tính thị giác nhất quán hơn.

Tuy vậy quy tắc chung chưa được áp dụng hết:

- Chiến đấu vẫn dùng `coverImage` cho thẻ đơn vị: scale kiểu cover, cắt nguồn ở giữa và chồng tên/thông số lên ảnh. Danh sách bộ bài và một số kết quả Triệu Hồi còn dùng đường crop khác. Việc sửa riêng thẻ hero ở Home chưa xử lý các renderer này.
- Độ hỗ trợ bàn phím khác nhau theo màn. Home có mô hình focus; chi tiết Hero và cài đặt chiến đấu còn nhiều thao tác chỉ qua con trỏ. Một nhãn lưu trong dữ liệu Phaser không tự trở thành tên truy cập cho công cụ hỗ trợ.
- Modal chung cho Enter chọn hành động cuối, và hành động xác nhận nằm cuối. Cần focus rõ ràng, đặc biệt với xóa bộ bài/bỏ trận.
- Thông báo lỗi chiến đấu chỉ chờ 900 mili giây rồi mờ trong 800 mili giây. Lỗi dài hoặc lỗi cần hành động nên tồn tại đến khi được xử lý/đóng và có thể xem lại.
- Vẫn có nút vuông ở màn kết quả chiến đấu và nút hiện mật khẩu không viền.
- Viết tắt/thuật ngữ chưa được dọn đồng bộ. Trong phần thông tin hero của Home vẫn có “HP tối đa”. Nên dùng “máu tối đa” theo quy tắc đã thống nhất.

Nguồn: [thẻ đơn vị](D:/Source/VongNguyet/apps/client/src/scenes/combat-scene.ts:1385), [renderer cover](D:/Source/VongNguyet/apps/client/src/scenes/combat-scene.ts:1849), [ảnh deck](D:/Source/VongNguyet/apps/client/src/scenes/deck-select-scene.ts:805), [kết quả quay](D:/Source/VongNguyet/apps/client/src/scenes/gacha/results.ts:171), [phím Hero](D:/Source/VongNguyet/apps/client/src/scenes/heroes-scene.ts:419), [modal Enter](D:/Source/VongNguyet/apps/client/src/ui/widgets.ts:365), [lỗi chiến đấu](D:/Source/VongNguyet/apps/client/src/scenes/combat-scene.ts:893), [nút kết quả](D:/Source/VongNguyet/apps/client/src/scenes/combat-scene.ts:2817).

Nên thống nhất primitive ảnh, nút, dialog, thông báo và focus trước khi tiếp tục polish từng scene. Thư viện hiện có đã có `framedImage` giữ toàn ảnh, `HomeControls` quản lý focus và `EquipmentControls` dùng lớp nút native có tên đầy đủ; có thể mở rộng từ các phần đã hoạt động.

Về điện thoại: README định vị desktop. Những màn canvas vẫn dựa trên bố cục 1280×720, trong khi một số màn DOM đã thích ứng màn hẹp. Nếu muốn hỗ trợ điện thoại, cần xem đó là một hạng mục riêng của Home, xây bộ và chiến đấu, không chỉ thu nhỏ cùng canvas. Chưa đo trực tiếp viewport trong review này; không coi điện thoại là lỗi chặn phát hành nếu phạm vi sản phẩm vẫn chỉ desktop.

**11. Tải game, tính ổn định và bằng chứng nghiệm thu**

Lần đo trên tệp hiện tại cho thấy danh sách preload chiến đấu có 243 tệp, khoảng 158,6 MB. Riêng binh khí và Nguyệt Bảo là 117,3 MB, gần 74% tổng này. Nhiều ảnh món đồ vẫn là PNG khoảng 2,8–3,2 MB. Hiện `combatTextureEntries` liệt kê tất cả hero, địch, bài và trang bị trong các nhóm; `prepareCombatAssets` đợi cả danh sách.

Đây là dung lượng tệp nguồn được chọn bởi manifest, không phải số byte thực truyền sau cache/nén và không phải phép đo thời gian/FPS trên thiết bị. Dù vậy, nó chỉ ra chỗ tối ưu cụ thể: xuất WebP giữ nguyên bố cục/tỉ lệ từ nguồn có sẵn; nạp tập cần cho trận hiện tại; chuẩn bị trước phần còn lại có giới hạn; cung cấp tiến độ tải và thử lại. Nên đo cold start và lượt vào lại sau cache bằng số liệu riêng.

Nguồn: [danh sách ảnh chiến đấu](D:/Source/VongNguyet/apps/client/src/ui/combat-assets.ts:9), [đợi nạp ảnh](D:/Source/VongNguyet/apps/client/src/ui/combat-assets.ts:43), [gate tại Home](D:/Source/VongNguyet/apps/client/src/scenes/deck-select-scene.ts:226).

Các nền tảng kỹ thuật tốt gồm luật tất định dùng chung, server chạy lại lượt chơi trước trao thưởng, phiên bản dữ liệu, lưu loadout khi bắt đầu và thứ tự hành động mạng theo từng người. Đây là cơ sở hữu ích để bắt lỗi, điều chỉnh cân bằng và chống kết quả giả; không đồng nghĩa đã được kiểm toán đầy đủ.

Nguồn: [snapshot/replay lượt chơi](D:/Source/VongNguyet/apps/server/src/routes/runs.ts:104), [server gắn người thực hiện và kiểm tra thứ tự](D:/Source/VongNguyet/apps/server/src/realtime/match-room.ts:179).

Một giới hạn vận hành cần đưa vào kịch bản thử: phòng realtime đang sống được giữ trong Map của tiến trình; có ghi action log vào database, nhưng hub không có luồng dựng lại các phòng đó khi tạo mới. Mất mạng người chơi và khởi động lại server cần được coi là hai tình huống khác nhau. Nên xác định khả năng phục hồi/hoàn trả/không tính thua sau restart, trước khi hứa một mức đảm bảo cho trận dài. Đây là quan sát kiến trúc, chưa được thử bằng restart server trong review này.

Nguồn: [các Map phòng trận](D:/Source/VongNguyet/apps/server/src/realtime/hub.ts:40), [ghi lịch sử hành động](D:/Source/VongNguyet/apps/server/src/realtime/match-room.ts:276).

Tài liệu kiểm thử còn ghi các lỗi nghiệm thu cũ về playback Liên Thủ và reload Đấu Trường. Các thay đổi animation sau đó có thể đã ảnh hưởng tới hành vi; không khẳng định các lỗi cũ còn tái hiện hôm nay. Cần chạy lại và khép nghiệm thu trận thật, thay vì coi test unit hoặc ảnh sảnh là bằng chứng một trận multiplayer hoàn chỉnh đã ổn.

Nguồn: [lịch sử lỗi nghiệm thu](D:/Source/VongNguyet/docs/testing.md:84), [phạm vi nghiệm thu animation](D:/Source/VongNguyet/docs/reviews/2026-10-15-game-animation-review.md).

**12. Cân bằng: có công cụ tốt, cần bằng chứng phù hợp**

Việc có seed, replay, bộ mô phỏng, cặp đi trước/đi sau và ghi dữ liệu theo phiên bản là điểm mạnh. Tuy nhiên hiện vật calibration được xem trong workspace có `passed:false`, phạm vi rỗng và ghi “replays 2 < 8”. Điều này chỉ nói hiện vật đó không đủ điều kiện, không chứng minh chưa từng có phiên chơi người thật khác.

Nên đưa ba nhóm người qua cùng một bộ kịch bản: người mới hoàn toàn, người quen game thẻ bài, người đã biết game. Chọn các đội khởi đầu, khống chế, triệu hồi/rút bài và Cấm Thuật. Ghi lại lý do chọn lá, chỗ không hiểu, thời gian suy nghĩ, thời gian chờ animation, nguồn gây thất bại và mong muốn chơi lại. Đối chiếu độ khó với độ dễ hiểu trước khi chỉnh chỉ số hàng loạt.

Nguồn: [artifact calibration được kiểm tra](D:/Source/VongNguyet/output/playtest/calibration-artifact.json:5), [ngưỡng bằng chứng](D:/Source/VongNguyet/docs/playtest/calibration.v1.json:14).

**13. Thứ tự làm đề xuất**

| Đợt | Công việc | Tiêu chí nghiệm thu |
|---|---|---|
| A — Đúng luật và đúng lời giải thích | Tần Sương Đấu Trường, Vũ Điệp, Kiệt Sức Liên Thủ; rà cùng nhóm nội tại xuyên chế độ | Các ca nhỏ được tái hiện, sửa và giữ regression; mô tả/số xem trước/kết quả khớp nhau |
| B — Vào chơi và điều khiển | Tối ưu tập preload; hoàn tất quy tắc ảnh/nút; focus và modal; thông báo lỗi bền | Vào được trận đầu, thao tác trọn luồng bằng chuột và bàn phím; ảnh đúng quy tắc trong mọi trạng thái liên quan |
| C — Phiên đầu có quyết định | Hướng dẫn ngắn, quyền chọn lá đầu tiên, sửa một lá trong bộ; lộ trình Tu Luyện rõ | Người mới tự giải thích được vì sao sửa bộ và dùng sự thay đổi đó ở trận kế tiếp |
| D — Công bằng và tiến trình | Chốt định nghĩa Arena; đường hữu hạn tới mục tiêu; nguồn vật liệu cho người solo/nhóm nhỏ; cap Liên Thủ | Không có lựa chọn chiến thuật bị hiểu nhầm là đã chuẩn hóa; người chơi thấy mục tiêu và nguồn tiến trình phù hợp |
| E — Chơi lại và kiểm chứng | Boss/sự kiện Tầm Nguyệt, thử thách lại truyện, Hợp Kích rộng; playtest người thật; nghiệm thu lại multiplayer | Đội khác dẫn tới quyết định khác, lượt sau có biến đổi đáng kể, trận mạng đầy đủ có bằng chứng kết thúc/khôi phục |

Các đợt là thứ tự ưu tiên, không phải ước lượng số ngày thực hiện. Chốt phạm vi và bằng chứng sau mỗi đợt để tránh thêm tính năng mà chưa biết tác động.

**14. Bằng chứng và giới hạn của lượt review**

- Đọc dữ liệu và triển khai hiện tại, ba mảng rà soát độc lập: chiến đấu, tiến trình/kinh tế và UI.
- Ba probe nhỏ chạy trên engine hiện tại đã xác nhận: Tần Sương áp Dễ Vỡ ở trận thường nhưng không ở Đấu Trường; Vũ Điệp cộng theo số lá của cả seat; Liên Thủ có Kiệt Sức cho địch nhưng không cho hero ở bước được kiểm tra.
- Lệnh: `pnpm exec vitest run --root .sdd-work/game-overall-review observed-behaviors.test.ts --maxWorkers=1`; kết quả 3/3 probe đạt vì chúng kiểm tra hành vi quan sát được, không kiểm tra rằng các lỗi đã được sửa.
- Probe lưu ở [observed-behaviors.test.ts](D:/Source/VongNguyet/.sdd-work/game-overall-review/observed-behaviors.test.ts), nằm trong thư mục ignored; không thêm vào bộ test sản phẩm.
- Đếm asset theo quy tắc chọn tệp của manifest hiện tại, không cộng trùng các phần mở rộng dưới cùng một texture key.
- Không chạy toàn bộ suite hoặc các mô phỏng dài; không chơi trực tiếp, đo FPS, đo thời gian tải qua mạng hoặc tái hiện trận multiplayer trong lượt này.
- Các số mô phỏng và lỗi nghiệm thu lịch sử luôn được ghi phạm vi/thời điểm. Nhận định nhịp chơi, giữ chân và độ khó cần kiểm chứng bằng người thật.
- Không sửa source, dữ liệu, tài nguyên hoặc các tệp playtest chưa được theo dõi của người dùng. Chỉ bổ sung báo cáo này và probe cục bộ phục vụ review.

