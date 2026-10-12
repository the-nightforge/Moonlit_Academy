# Redesign đội `m03+f09+m08` (Lôi ảnh liên hoàn)

**Ngày:** 2026-10-12 · **Trạng thái:** §4.1 refuted → **§4.5 (liên hoàn) đã triển khai vào `packages/data`** (2026-10-12). Evidence trước triển khai: screen 128 blocks **+9.4pp (44→53%), report `ok`, review `inconclusive`** (CI 12.5pp > 10pp, Holm p=0.24). Post-merge verify: **+3.1pp** (64 blocks, `insufficient-data`, direction nhất quán). Confirm 2000 blocks + corpus người thật còn treo — evidence **synthetic**, không suy ra human-validated · **Nguồn:** `output/playtest/m03-exp/verification.md`

## 1. Bằng chứng đo được

Pool `pool_m03_f09_m08` (deck `starter`): PvE ~34–41% với profile đủ skill, so với đội tham chiếu `f06+m09+f03` ~84%. Con số 6% ở screen novice là artifact đo (novice không đánh giá được `reserve` → không bao giờ chơi lá ramp, đo 0/16 trận) — **không dùng được** làm căn cứ.

| Experiment (64 blocks, paired, f06 delta luôn +0.0pp) | Delta |
|---|---|
| `m03_tham_bao` scale 1→2 (cap 6) | −3.1pp — no-op, cap nuốt |
| `f09_tao_duoc` regen 2→3 | +3.1pp — đúng hướng, nhỏ |
| `m03_thong_bao` gain 2→3 | −3.1pp — no-op, mp tự +1/vòng→cap 8 |
| Cụm 5 patch vừa phải | +3.1pp |
| Cụm 8 patch aggressive (~×2 payoff + ×2 sustain) | **+18.8pp** → 56% |

**Kết luận đo:** khoảng cách ~46pp là structural. Cần ~×2 công suất để đạt mid-tier — đây là **redesign cơ học**, không phải buff số. Tất cả trận thua tập trung ở chết mid-game round 7–8 khi engine đã chạy (ramp avg 4.1/trận thua ≈ 4.8/trận thắng).

## 2. Chẩn đoán kit

- **Ba mini-engine rời**: m03 ramp Nguyệt Lực → payoff `scaledDamage per:"moonPower"`; f09 sustain summon/heal/regen; m08 `shiftMoon`/`conditional`. Không lá nào của hero này ăn với output của hero kia.
- **Payoff bị trần thấp**: `max` 6/6/12 trong khi HP hiệu dụng địch ~150–250; tăng trần 50% vẫn không đủ throughput.
- **Sustain tuyến tính**: heal/regen cố định, không scale cùng engine — trong khi output địch tăng theo trận.
- So sánh: `f06+m09+f03` là **một** kế hoạch (freeze/charm control nhất quán) — đội mạnh không phải vì từng lá mạnh mà vì lá cùng chỉ một hướng.

## 3. Mục tiêu redesign

Biến đội thành **một engine chéo**: sustain của f09 và thao trăng của m08 phải *đổ vào* payoff của m03 — ba hero cùng nuôi một chỉ số. Giữ nguyên identity "combo/ramp cần setup, rủi ro cao" nhưng payoff phải tỉ lệ với việc setup thành công, không phải trần cứng.

**Ràng buộc:** chỉ dùng `Effect` type đã có trong schema (không thêm type mới ở vòng spec này); mọi thay đổi qua dữ liệu JSON; giữ cost/copies trừ khi nêu rõ.

## 4. Đề xuất cụ thể

### 4.1 Trục chéo chính — `alliesRegen` làm payoff scaler (đã có trong engine) — **REFUTED 2026-10-12**

~~`scaledDamage per:"alliesRegen"` đọc tổng regen của team~~ — probe cho thấy **không hoạt động**: regen decay (3→2→1/vòng) + f09 chỉ đổ ~1–2 lá regen/trận → scaler thường đọc 0–3, trong khi `moonPower` tự đạt cap 6 miễn phí ~r4. `tham_bao` bản alliesRegen chỉ được chơi 0.5 lần/trận → payoff chéo **yếu hơn** bản gốc (+3.1pp, noise). Muốn weld theo hướng này cần: (a) pool regen dày/sticky hơn nhiều (regen không decay — schema change), hoặc (b) scaler khác (`cardsPlayedThisTurn` cho lien_hoan, `targetDebuffs` nếu m08 đổ debuff đều — m08 hiện không phải debuffer chính).

- `m03_tham_bao`: đổi `per: "moonPower"` → `per: "alliesRegen"`, amount 1, `max` 6→9. Payoff lớn khi f09 đã đổ regen — thưởng đúng thứ tự chơi.
- `m03_mau_dich`: giữ `per: "moonPower"` (vẫn cần một payoff thuần ramp), `max` 6→9.
- `m03_kim_tien`: `per: "moonPower"` giữ, `max` 12→16.

### 4.2 Sustain có scaling — f09

- `f09_tao_duoc`: regen 2→3 (lever đã đo +3.1pp — giữ làm một phần cụm).
- `f09_linh_ke` (locked): thêm `scaledDamage per:"alliesRegen"` nhỏ (amount 1, max 6) thay vì chỉ buff strength — Linh Thú đánh theo regen team đang có, khép vòng summon→regen→damage.
- `f09_nguyet_tho` (taunt): giữ nguyên — taunt summon là buffer chống chết mid-game đã đủ.

### 4.3 Liên kết trăng — m08

- `m08_doi_van` / `m08_chuyen_van`: `shiftMoon` đẩy vào pha ưu đãi `scheme` (Lưỡi Liềm Đầu, −1 cost cho tag `scheme` — hầu hết lá m03 mang tag này). **Không đổi số** — chỉ cần AI/loot ưu tiên; nhưng spec nghi việc m08 có lá payoff conditional khi đổi trăng đúng pha: `m08_huyet_chiem`/`huyet_hoa` đã có `conditional` — cân nhắc condition `moonPhaseIs` vào pha buff để thưởng việc shift đúng.

### 4.5 Trục chéo thay thế — `cardsPlayedThisTurn` (đo được +12.5pp, hướng đúng)

Scaler combo đọc chỉ số **không decay, do người chơi điều khiển** — đúng identity "liên hoàn" của deck; bot đã biết sequencing (features.ts synergy sẵn). Probe: 38→50%, vẫn thua armor-wall.

- `m03_tham_bao`: `per: "moonPower"` → `per: "cardsPlayedThisTurn"`, amount 1→2, `max` 6→9.
- `m03_mau_dich`: `per: "moonPower"` → `per: "cardsPlayedThisTurn"`, amount 1→2, `max` 6→9.
- `m03_kim_tien`: giữ `per: "moonPower"` (đa dạng payoff), `max` 12→16.
- `f09_tao_duoc`: regen 2→3.

Hệ quả thiết kế cần duyệt: deck trở thành "spam lá rẻ → payoff cuối lượt" — `tieu_loi` cost 0 và `thong_bao`/`ngoc_dao`/`trieu_hoi` cost 1 trở thành ammo. Cân nhắc nâng payoff của lá khóa (`tich_thuy`, `than_toan`) theo cùng scaler để nhánh phát triển nhất quán. **Khảo sát khi triển khai: các lá khóa m03 không chứa `scaledDamage` nào** — không có gì để nâng theo scaler này ở vòng hiện tại.

**Đã triển khai (2026-10-12):** bốn thay đổi trên vào `packages/data/cards.json` kèm text tiếng Việt mới (mẫu câu "thêm Y cho mỗi lá đã đánh trước đó trong lượt" theo quy ước m01); test T277 pin semantics payoff-không-đếm-chính-nó và cap. Golden records regen **byte-identical** — ma trận golden chỉ phủ {m05,f04,m06,f03,f02} nên không record nào đụng lá đã đổi (không phải leak; đã kiểm chứng). Post-merge verify 64 blocks paired vs snapshot trước-redesign: m03 **+3.1pp** (38→41%, n=32 — trong noise, nhất quán hướng với +9.4pp/128-block screen), f06 **+0.0pp** spillover lần thứ 7. Kẻ địch armor-wall (`enc_03`/`enc_04`) vẫn là vấn đề design-level riêng, chưa giải quyết.

### 4.4 Không làm

- Không tăng `gainMoonPower` thêm — mp tự +1/vòng→cap 8, ramp card chỉ bão hòa sớm (đo no-op).
- Không nâng scale `per:"moonPower"` — trần `max` nuốt hết.
- Không buff từng lá lẻ — đo chứng minh không di chuyển.

## 5. Kế hoạch kiểm chứng (synthetic trước, người sau)

1. ~~Viết candidate data copy theo §4~~ — **xong** (triển khai thẳng vào `packages/data` sau khi screen 128 blocks cho direction).
2. ~~Chạy lại đúng setup đo~~ — **xong**: post-merge verify 64 blocks +3.1pp, f06 +0.0pp (`insufficient-data`, smoke). Ngưỡng +20pp **không đạt** ở quy mô này — 128-block screen trước triển khai cho +9.4pp; effect size thật nằm đâu đó trong dải +3…+12pp, cần mẫu lớn để định lượng.
3. Confirm run 2000 blocks (stage `confirm`) — **chưa có**: run đầu tiên bị dừng trước khi xong, không có kết quả confirm nào tồn tại.
4. Vẫn `synthetic` → `human-check-required` cho tới khi có corpus người thật (tester protocol).

## 6. Mở

- `per:"alliesRegen"` chỉ đếm regen trên **hero** (`heroesOf` = `state.heroes`, Linh Thú nằm ở `state.summons` riêng — đã kiểm chứng `players.ts`/`summons.ts`). §4.1 đúng như viết; nhưng summon có regen sẽ không tính vào payoff — quyết định có chủ đích hay không trước khi chốt data.
- Nếu muốn synergy summon→damage, cần `per` mới (`alliesSummons`/`summonsAlive`) — **đó là schema change**, ngoài phạm vi vòng này; để option vòng sau nếu 4.1 không đủ.
