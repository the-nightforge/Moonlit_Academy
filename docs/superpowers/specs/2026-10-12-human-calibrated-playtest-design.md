# Bot playtest để hỗ trợ buff/nerf

Ngày: 2026-10-12. Tài liệu thiết kế đi kèm plan theo yêu cầu người dùng; chưa triển khai code. Người dùng xác nhận **chưa có replay/log người thật, cần thêm bước thu thập**.

## Mục tiêu và giới hạn

Tạo hệ playtest có thể giải thích kết quả theo kỹ năng, chiến thuật, đội hình và trang bị; đối chiếu với người thật trước khi dùng để đề xuất buff/nerf. Không coi một bot mạnh nhất là đại diện cho người chơi, không coi số trận lớn là bằng chứng hết thiên lệch. Kết quả hỗ trợ quyết định và thử nghiệm bản cân bằng; không tự sửa chỉ số hoặc tự phát hành.

Ưu tiên PvP để đo Hero/card/gear, sau đó PvE/Run/Story và Liên Thủ. Không đổi luật hoặc độ khó bot đấu tập đang chạy cho người dùng trong đợt xây công cụ. Không thêm LLM/RL hoặc dịch vụ trả phí. Giữ replay luật và golden đã có.

Ba nhãn bằng chứng: `synthetic` khi chưa có dữ liệu thật; `tester-calibrated` khi qua nghiệm thu với nhóm tester độc lập; `population-calibrated` khi có mẫu và trọng số đại diện tập người chơi thực tế. Tester tiện lợi không tự động đại diện dân số người chơi.

## Vấn đề có căn cứ trong repo

- `src/bot.ts` ưu tiên giá bài và một số quy tắc tình huống, chưa tối ưu chuỗi sử dụng tài nguyên/mục tiêu trong lượt.
- `test/playtest.test.ts` có bản bot riêng: `chooseMoon` luôn offset0; hút tài nguyên đọc `plannedIntents`. Có nguy cơ kết quả khác bot chính và dùng thông tin người chơi chưa thấy.
- PvP sim gọi `pvpBot(viewFor(...))`; PvE/Story/Run và Coop có chỗ truyền toàn bộ state. View hiện có vẫn cần kiểm tra `cards` và thông tin không trực tiếp hiển thị, không chỉ che `drawPile`.
- Run bot chọn augment đầu danh sách, xóa lá rẻ nhất và chọn đội từ danh sách cố định; kết quả bị ảnh hưởng bởi chiến thuật ngoài combat.
- PvP sim chủ yếu đội ba Hero + bộ cơ bản, số trận mỗi Hero không phản ánh mức phổ biến/synergy của deck. Một số runner hết step cap nhưng chưa tách rõ khỏi hòa/thua.
- Economy PvP đặt thắng50%; Coop đặt thắng/thua theo lịch. Đây là kịch bản thu nhập, không phải sức mạnh combat đã đo.
- `MatchRoom` đã lưu setup/seed/actions vào `matches`; PvE `/runs/finish` và Story nhận actions nhưng bảng ticket chưa lưu action stream. Có thể tận dụng nguồn có sẵn thay vì tạo lại hệ replay.

## Các phương án

| Phương án | Ưu/nhược | Quyết định |
| --- | --- | --- |
| Chỉ sửa heuristic hiện có | Nhanh, giảm lỗi rõ; vẫn thiên về một cách đánh | Dùng làm bước đầu và đối chứng |
| Portfolio kỹ năng/phong cách + tìm kiếm giới hạn + hiệu chỉnh replay | Giải thích được, chạy offline, đo độ nhạy với cách đánh; cần dữ liệu thật | **Chọn** |
| RL/LLM hoặc tìm kiếm lớn ngay | Chi phí/độ phức tạp cao, chưa có dữ liệu để xác nhận giống người | Không đưa vào phạm vi |

## Kiến trúc

`state thật → observation hợp lệ → danh sách hành động hợp lệ → policy → action → engine applyAction`.

State thật chỉ thuộc simulator/engine. Policy nhận observation đã làm sạch; search nhận các thế giới giả định dựng từ observation, không nhận state thật. Mọi action cuối cùng được engine thật xác nhận; rejection là lỗi công cụ, không silently endTurn để che lỗi.

Bot RNG, belief RNG, sampling RNG và engine RNG độc lập. Giới hạn tìm kiếm theo số expansion, không theo thời gian máy; ghi thời gian như metric. Cùng inputs/version/seeds phải tạo cùng action stream khi chạy lại hoặc đổi số worker.

### Observation và chống đọc thông tin ẩn

- Own hand, HP/status, mana/reserve, pha trăng, trang bị công khai, discard, bài đã công bố và lựa chọn đang mở được phép đọc. Own deck composition được phép biết nếu chính người chơi biết bộ bài đã đăng ký.
- Không đọc RNG thật, thứ tự bài rút, tay/choice kín đối thủ hoặc chuỗi intent chưa được công bố. Liên Thủ giữ tay đồng đội theo luật hiện có nhưng không cho xem thứ tự bài rút hoặc choice kín của đồng đội.
- Xóa/đổi ID mapping trong `cards` có thể nối ngược sang các lá kín. Dữ liệu tương lai của draw/choice/event không được lọt vào history.
- Với intent PvE, lấy đúng mức thông tin client thực sự công bố; không mặc định xóa cả thông tin công khai. Audit UI/protocol trước khi khóa contract.
- Hai state chỉ khác phần kín phải cho cùng observation, cùng tập hành động và cùng quyết định khi policy seed giống nhau. Đây là nghiệm thu bắt buộc.

### Portfolio và kỹ năng

Ba mức `novice`, `regular`, `advanced`; bốn phong cách `aggressive`, `defensive`, `combo`, `tempo`. Mười hai profile được báo cáo riêng. Khi chưa có dữ liệu, các tỷ trọng chỉ là kịch bản và không gắn nhãn dân số thực.

Heuristic chấm lethal, chống lethal, sát thương hữu ích sau armor/shield, overkill, hồi máu hữu ích, khống chế, draw/hand cap, reserve, level-up, moon, summon và synergy. Xếp theo lợi ích của hành động, không mặc định lá đắt thắng lá rẻ. Run có policy node/rest/remove/augment theo deck và HP riêng.

Giá trị cấu hình ban đầu để benchmark, **không phải ước lượng người thật**: novice không search; regular tối đa512 expansion, depth3, beam6, 8 belief samples; advanced tối đa2048 expansion, depth6, beam12, 16 samples. Ngân sách là tổng cho một quyết định, không nhân thêm theo số mẫu/ứng viên. Noise/lỗi lựa chọn chỉ nằm trong legal actions và có seed; tỷ lệ ban đầu 0 cho cả ba, chỉ bật/hiệu chỉnh sau pilot thay vì tùy ý làm bot yếu.

Search xem thứ tự đánh/target/endTurn trong lượt, giữ các lựa chọn quan trọng. Các thế giới giả định lấy từ bộ bài/intent có thể xảy ra theo thông tin công khai; prior không dùng deck đối thủ đã được simulator biết nhưng người chơi chưa biết. Không coi một determinization là sự thật. Search này là estimator giới hạn, không tuyên bố tối ưu/Nash.

### Thí nghiệm cân bằng

Tách bốn suite: luật/replay; bot hành động hợp lệ; simulation screening; xác nhận cân bằng. CI mặc định chỉ chạy ba lớp đầu với sample nhỏ; sweep lớn opt-in.

Mỗi block có setup/engine seed/policy seeds/deck/loadout cố định; PvP có trận đổi ghế A/B. So baseline/candidate bằng cùng block và policy đã đóng băng nhưng **bot đánh lại** theo luật candidate. Không replay nguyên hành động người thật qua luật đã nerf nếu hành động trở thành bất hợp lệ. Cùng seed không đảm bảo cùng draw stream sau khi hai bên chọn hành động khác nhau.

Deck pool gồm starter, các archetype hợp lệ được gắn nhãn thủ công và deck tester đã chơi; kiểm tra ownership/loadout đúng từng mode. PvP không lấy cấp nâng gear PvE. Không trộn winrate theo kỹ năng, gear, mode hoặc meta pool nếu chưa định nghĩa weighting. Hero xuất hiện trên cả hai ghế phải có denominator theo seat appearance và không coi số lần xuất hiện là trận độc lập.

Screen128 block mỗi comparison; confirm **2000 block cố định** trên seed chưa dùng screening/calibration, chỉ chạy cho đối tượng được chọn. Không đổi số mẫu sau khi nhìn significance để làm đẹp kết quả. Nếu CI còn rộng, tạo một experiment mới với N lớn hơn được ghi trước, không nối thêm âm thầm. Roster scan phân bổ coverage; không chạy2000 block cho toàn bộ1140×1140 đội mặc định.

Outcome có `win/loss/draw/truncated/error`; truncate không là draw/thua. Guard60round/4000action cho combat, 20000action cho run, tính từ lượt khởi đầu. Rejection/error=0 để báo cáo hợp lệ; truncated rate>0.5% làm báo cáo không đủ điều kiện đề xuất.

Metric: win/draw/loss, score(win1/draw0.5/loss0), round p50/p90, deck-out, mana/reserve waste, overkill/overheal, level-up timing, card draw/play/hold, combo/summon/status uptake, matchups và first-player advantage. Card “đã đánh” liên hệ thắng không phải tác động nhân quả; report coverage và tình huống card hợp lệ nhưng không được chọn.

### Thống kê và nhãn đề xuất

Wilson95% cho tỷ lệ nhị phân độc lập; paired cluster bootstrap95% cho score và delta baseline/candidate, resample **block**, giữ trận đổi ghế và cả hai phiên bản trong cùng block. Dữ liệu người thật bootstrap theo người, đồng thời giữ toàn bộ ghế của cùng trận; không nhân decision count thành sample count. Reference xác suất/CI và thuật toán bootstrap phải có test số học.

Danh sách confirm được chốt từ screening. Holm correction cho family confirm, thể hiện CI/p-value điều chỉnh tương ứng; mục chưa đủ coverage là `insufficient-data`. Khoảng tin cậy mô phỏng chỉ đo biến thiên trong model, không bao gồm bot-model bias.

Ngưỡng đề xuất ban đầu, phải cấu hình và ghi trước chạy: delta score ít nhất3điểm phần trăm, CI95% không qua0, half-width≤3điểm; không đảo chiều nghiêm trọng giữa profile và các archetype quan trọng. Xếp `inconclusive/policy-sensitive/human-check-required/review-candidate`; không phát hành tự động. Winrate ngoài45–55% là cờ để điều tra, **không** là luật rằng mọi Hero/team phải50%.

### Thu thập và hiệu chỉnh người thật

Pilot:12tester (4/mức), ít nhất60 player-trajectories, ghi cả thắng/thua và kết thúc sớm; mục tiêu kiểm tra exporter, deck pool và hành vi, chưa chứng nhận cân bằng.

Mốc dữ liệu tối thiểu cho đánh giá calibration theo mode:30người (10/mức), 300 player-trajectories hoàn tất, ít nhất500 decision point/mức. Trajectory là một người trong một trận, không phải một trận độc lập. Split50/50 theo người, định trước bằng stable pseudonymous ID, ít nhất5 người held-out mỗi mức; đối thủ/cặp người kết nối phải ở cùng partition để tránh lọt trận giữa train/test. Nếu liên thông cả cohort, tổ chức hai cohort độc lập; không tách theo dòng action. Đây là floor, không bảo đảm CI đủ hẹp; tiếp tục thu thập nếu chưa đạt precision.

Nhãn kỹ năng trước trận từ kinh nghiệm/đánh giá pilot, không suy kỹ năng từ kết quả trận đang đo. Phân tách human-human/human-bot, mode, data version, deck/loadout, surrender/timeout/disconnect. Không loại các trận thua hoặc chơi xấu để làm dữ liệu giống bot. Tách system action khỏi quyết định con người; vẫn báo tỷ lệ kết thúc sớm và tác động của nó lên outcome.

Export dùng `matches.setup_json/actions_json/data_version/result_json` và pseudonymous cohort mapping. PvE/Story bổ sung capture action stream đã được server replay-validate khi finish; ticket chưa finish vẫn được thống kê dropout. Không mở endpoint công khai đọc state kín của trận đang diễn ra. Không export token/password/username; seed/state đầy đủ ở nguồn offline phục vụ replay, không được gửi vào policy.

Đánh giá held-out theo matchup/skill/gear/version tương thích: MAE winrate point estimate≤10điểm, upper95% bound≤15điểm; MAE chuẩn hóa≤0.25 cho nhóm hành vi (mana waste, cards/turn, combo uptake, held turns, overheal), upper95% bound≤0.40. Với metric phương sai người≈0, dùng scale floor1 theo đơn vị tự nhiên và báo riêng. Hành động khác nhưng cùng lợi ích được coi tương đương; exact-action agreement là metric phụ. Các ngưỡng là quyết định nghiệm thu của dự án, không phải số liệu khoa học chứng minh bot giống người.

Hiệu chỉnh weights/noise/search budget trên train; không tune theo held-out hoặc theo việc bot cho Hero cụ thể winrate đẹp. Nếu sai tương tác/deck, sửa policy hoặc mở rộng cohort, không sửa sức mạnh card để che lỗi bot. Đóng băng model/pool/weights rồi chạy một bộ confirm mới. Mỗi update data/engine/policy làm nhãn calibration cũ mất hiệu lực nếu chưa được xác nhận lại cho phạm vi thay đổi.

## Nghiệm thu và rollout

P0: xóa bot trùng và đường đọc state kín; mọi simulation dùng adapter hợp lệ; golden replay vẫn qua. P1: portfolio, search, runner và report chạy deterministic; không sửa bot sản phẩm mặc định. P2: exporter/capture/pilot/calibration held-out; mở nhãn tester-calibrated theo mode đã đủ chứng cứ. P3: chạy bản cân bằng candidate, review nguyên nhân và tổ chức A/B tester đối với top candidates, kiểm tra tác động ngoài mục tiêu rồi mới quyết định patch.

Chỉ tạo plan/spec trong lượt hiện tại; không thu thập dữ liệu thật, không thay sản phẩm, không commit/push. Dữ liệu/bản model lớn và report để output; chỉ fixture nhỏ, schema, configs, code và docs vào Git.

## Cơ sở phương pháp

- [NIST — Wilson confidence interval](https://itl.nist.gov/div898/handbook/prc/section2/prc241.htm): lựa chọn CI tỷ lệ; không dùng công thức Wald đơn giản ở sample nhỏ hoặc0/100%.
- [SciPy — bootstrap, paired resampling](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.bootstrap.html): tham khảo cách giữ ghép cặp khi resample; dự án triển khai TypeScript, không thêm dependency SciPy.
- [Cowling, Powley, Whitehouse — Information Set Monte Carlo Tree Search](https://eprints.whiterose.ac.uk/id/eprint/75048/1/CowlingPowleyWhitehouse2012.pdf): cơ sở thận trọng với search trên thông tin không đầy đủ; không sao chép thuật toán hoặc cam kết ISMCTS trong P1.
