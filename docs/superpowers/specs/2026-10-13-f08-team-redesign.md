# Redesign đội `f08+m07+f07` (Huyết Nguyệt — tự hại đổi sức mạnh)

**Ngày:** 2026-10-13 · **Trạng thái:** §4.1 đã triển khai (`phan_huyet` ratio 1.0 + T278); §4.4 đã triển khai (bot: estimate fix + moon unlock T329/T330 + gated keep-value T331); §4.2/§4.3 REFUTED bằng probe · f08 31→36→**41.7%**, advanced 67% · evidence **synthetic** → `human-check-required` · **Nguồn:** `output/playtest/m03-exp/verification.md` + `output/playtest/rescreen/`

## 1. Bằng chứng đo được

| Nguồn đo | Winrate pve |
|---|---|
| Screen cũ (ghim `novice-aggressive` — selfDamage/heal weight 0 → bot tự sát) | **12% — artifact đo** |
| Drill 4 profile hợp kit (32 blocks, n=16/team) | 56% |
| Re-screen đúng (8 team × 12 profile × 3, coverage đã fix) | **31%** — novice 42% / regular 8% / advanced 42% |
| Re-screen + `phan_huyet` ratio 1.0 | **36%** — advanced **67%** |

Con số 12% ban đầu đo "pilot có tự sát không", không đo deck. Nhưng khác m03: sau khi đo đúng mọi profile, deck **vẫn dưới floor** (advanced 42% < ngưỡng 55%).

**Probes đã chạy** (288 blocks, paired vs baseline `run2`, cùng manifest/seed, spillover toàn pool = +0.0pp):

| Patch | Delta | Đọc |
|---|---|---|
| `phan_menh` (18dmg, `requiresBloodMoon`) đưa vào starter thay `huyet_vuc` | **−8.3pp** | **REFUTED** — chơi 0/36 trận: gating (cost 5 + 1 copy + moon uptime 1–2 vòng) quá hẹp để fire |
| `phan_huyet` ratio 0.5→1.0 | **+5.6pp** | Lever ungated đúng: advanced 42→67% vượt floor; plays 18→21/36 |

## 2. Chẩn đoán kit

**Archetype:** f08 tự hại (forbidden "Mất X HP") → m07 sustain + gọi Huyết Nguyệt → f07 phong ấn/ramp. Synergy "f08 đốt HP → m07 hồi" có thật trong features (heal value scale theo missing HP).

**Ba lỗ hổng đo được:**

1. **Không có finisher trong starter** — `phan_menh`/`phuong_nghich` (payoff `requiresBloodMoon` thật sự) đều locked; engine gọi trăng ~2 lần/trận chỉ để buff rider nhỏ (`huyet_anh` 5→8). Starter payoff duy nhất `phan_huyet` (missingHpDamage ratio 0.5) chỉ được đánh **0.5 lần/trận**.
2. **Throughput paradox** — avgDmg 154 (cao nhì pool) nhưng trận dài nhất pool (11.8 vòng): sustain kéo game mà không kết thúc được. `f06` thắng với damage *thấp nhất* (125) nhờ control — thắng bằng cơ chế, không bằng output.
3. **Hai mode thua** — chết mid-window r7–9 (12/25 trận: tự đốt + enemy spike trước khi sustain ổn định) và attrition/stall r11+ (8/25, gồm 2 trận truncated r61 — deadlock không giết được cũng không chết).

**Bot-side:** `selfDamage` weight −0.5…−1.5 khiến combo/aggro pilots né engine (combo pilots 0/3 mọi tier); `bloodMoon` chỉ chấm `control` — không feature nào thấy "gọi trăng mở khóa payoff"; estimate `missingHpDamage` dùng `target.maxHp × ratio` thay vì missing-HP thật của caster — không chính xác.

**Armor-wall lặp lại:** `enc_elite_01` 0/5, `enc_03` 0/4 — cùng class counter deck hit-nhỏ (vấn đề chung với m03, không riêng f08).

## 3. Mục tiêu redesign

Giữ identity **"forbidden — trả giá HP lấy sức mạnh, high-skill"** nhưng đưa ceiling về vùng chơi được:

- Advanced tier ≥55% (floor sức mạnh thật)
- Overall ≥40–45%
- Chấp nhận novice thấp — deck khó chủ đích; không cần phẳng skill gradient
- Không phá trục "tự hại" — payoff phải thưởng cho việc sống sót sau khi đốt HP

## 4. Đề xuất cụ thể

### 4.1 `phan_huyet` ratio 0.5 → 1.0 — **đo được +5.6pp, khuyến nghị áp dụng**

Payoff đã trong starter, không gating: damage = HP f08 đã mất — đúng identity "trả giá bằng máu". Đo: advanced 42→67% (vượt floor), plays 18→21/36, spillover 0. Single-lever, risk thấp nhất trong các options. Text cập nhật "50% số HP đã mất" → "bằng số HP đã mất".

### 4.2 Moon uptime — **REFUTED bằng probe** (`huyet_trieu`+`trieu_huyet` 1→2 vòng: −2.8pp)

Payoff gated đều `locked` → không có trong starter PvE để hưởng uptime; lever chỉ chạm conditional riders nhỏ (`huyet_anh` 5→8, `dong_huyet` 2→4) — counters xác nhận play rate flat. Uptime không phải bottleneck.

### 4.3 Finisher gated vào starter — **REFUTED ở form hiện tại**

`phan_menh` vào starter cho −8.3pp và 0 lần chơi — gating chết, không phải deck thiếu finisher theo nghĩa đơn giản. Chỉ xem lại sau khi §4.2 (uptime) và §4.4 (bot timing) có; hoặc làm payoff gated **rẻ hơn** (cost 5→3, loseHp 4→2) để cửa sổ hẹp vẫn fire được.

### 4.4 Bot-feature gaps — **đã triển khai** (commit `8cefaea`, +5.6pp đo được)

- `missingHpDamage` estimate giờ đọc missing-HP thật của caster thay `target.maxHp × ratio` — payoff được timing đúng (plays 21→19 nhưng win tăng).
- `bloodMoon` calls được chấm unlock value: +1 synergy/lá `requiresBloodMoon`, +0.5/rider `bloodMoonActive` trong tay. (Phát hiện: nhánh `bloodMoon→control` cũ là dead code — effect thiếu `to` nên không qua `selfEffects`; đã move sang resource walk.)
- "Hold" gated cards (c): `cardKeepValue` discount lá `requiresBloodMoon` khi trăng tắt — ×0.5 nếu còn caller trong decklist (`ownDeckCardIds` — draw pile bị sanitize khỏi observation), ×0.25 nếu không có caller nào; mulligan trả lá gated khi `moonAccess === "none"`. T331 pin 3 tier. Không đo được trong rescreen vì gated cards `locked` khỏi starter PvE — chuẩn bị cho run-draft/PvP loadout.
- Đo: f08 36.1→41.7% (paired run3↔cand-botfix), toàn pool +0.0pp.

### 4.5 Không làm

- Không thêm heal/sustain — deck đã prolong quá mức (11.8 vòng, 2 trận stall r61): thêm sustain làm tệ hơn.
- Không buff lẻ rider nhỏ — không đổi được mode thua.
- Không đổi `loseHp` amounts — self-cost là identity; vấn đề là payoff không chạy, không phải giá quá đắt.

## 5. Kế hoạch kiểm chứng (synthetic trước, người sau)

1. Candidate `phan_huyet` ratio 1.0 (đã có ở `output/playtest/drill-f08/cand2-data`) → nếu duyệt apply vào `packages/data` → post-merge verify paired như m03.
2. Ngưỡng đạt: advanced ≥55%, overall ≥40%, spillover pool +0.0pp.
3. Confirm 2000 blocks nếu muốn promote số liệu.
4. Vẫn `synthetic` → `human-check-required` tới khi có corpus người thật (tester protocol).

## 6. Mở

- **Design call cần người**: f08 cố ý là "hard archetype" hay nên chơi được ở regular? Advanced 67% (post-4.1) đã đủ nếu intent là deck khó; overall 36% vẫn thấp nếu intent là deck phổ thông.
- `enc_03`/`enc_elite_01` armor-wall counter cả class deck hit-nhỏ — vấn đề design-level riêng (đã note ở spec m03).
- Trận stall r61 (2 trận truncated): sustain có thể deadlock — cân nhắc rules-level stall breaker nếu pattern lặp.
- `missingHpDamage` estimate trong bot chưa chính xác (§4.4) — fix estimate có thể tự thay đổi playrate payoff, nên đo lại sau fix.
