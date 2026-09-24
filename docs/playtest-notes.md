# Playtest Notes — Phase 1 (offline prototype)

Playtest scripted: `packages/rules/test/playtest.test.ts` mô phỏng mỗi
encounter bằng heuristic tham lam (đánh lá đánh được đầu tiên trên tay, mục
tiêu hợp lệ đầu tiên, kết thúc lượt khi không còn đánh được). Đây là **sàn
kỹ năng** — người chơi thật chơi tốt hơn nhờ chọn mục tiêu, timing hồi máu,
tận dụng hệ số trăng.

Đội hình: m05 + f04 + m06. Seed: 42 / 7 / 2024.

## Kết quả

| Encounter | Địch | 42 | 7 | 2024 | Nhận xét |
|-----------|------|----|---|------|----------|
| enc_01 | puppet_guard + shadow_fox | Thắng v8 | Thắng v8 | Thắng v8 | Ổn định, luôn mất ~1 Hero |
| enc_02 | shadow_fox ×3 | Thắng v11 | **Thua v9** | Thắng v7 | Biên độ lớn nhất; thua khi dàn trải damage vào 3 mục tiêu |
| enc_03 | puppet_guard ×2 | Thắng v11 | **Thua v15** | Thắng v13 | Trận dài nhất; thắng thường chỉ còn 1 Hero đứng |

7/9 trận thắng với heuristic tối thiểu. Không trận nào vượt 15 vòng, không
stalemate, không vòng lặp vô hạn — determinism giữ nguyên (mỗi seed lặp lại
y hệt).

## Quan sát

- **Độ khó tăng dần hợp lý**: enc_01 là trận mở màn an toàn; enc_02 và
  enc_03 đều có khả năng thua khi chơi cẩu thả.
- **Trận nào cũng có Hero ngã**: phần lớn do heuristic không ưu tiên phòng
  thủ/hồi máu đúng lúc. Với người chơi thật, mức độ này chấp nhận được cho
  prototype.
- **enc_03 hơi nặng tay**: 2 puppet_guard (42 HP mỗi con) kéo trận tới vòng
  11–15 và 2/3 lần thắng chỉ còn m06 sống sót. Chưa chỉnh data — heuristic
  là sàn, nhưng nếu playtest tay thấy quá khó thì giảm HP puppet_guard
  xuống ~36–38 hoặc giảm damage intent của nó.
- **enc_02 thua do dàn damage**: heuristic đánh mục tiêu đầu tiên, không
  dồn giết từng con → 3 cáo cùng sống lâu. Người chơi focus-fire sẽ dễ hơn
  nhiều; giữ nguyên data.
- Nguyệt Luân có tác động thấy rõ: pha heal ×2 (Trăng Tròn) và assassin
  ×1.5 (Lưỡi Liềm) đổi hẳn lượng số lượt cần thiết.

## Điểm cần theo dõi khi playtest tay

- [ ] enc_03 có quá khó với người chơi mới không (xem mục trên)?
- [ ] Có khi nào tay toàn Tàn Chiêu/lá không đánh được → cảm giác "bí"
      khó chịu không?
- [ ] Animation lượt địch có đủ rõ để hiểu ai đánh ai không?

## Không chỉnh data

Chưa thay đổi `data/*.json`: kết quả nằm trong ngưỡng chấp nhận được cho
prototype và heuristic không phải người chơi thật. Ghi chú trên để đối
chiếu khi chơi tay.
