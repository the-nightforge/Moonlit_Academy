# Bộ Prompt Nhân Vật — "Vọng Nguyệt Thư Viện" (v2)

Bộ 20 nhân vật gốc (10 nam, 10 nữ) cho card game gacha 2D, lấy cảm hứng từ **không khí** của Nguyệt Mộng: học viện cổ phong, ánh trăng, âm mưu triều đình, quan hệ phức tạp giữa các nhân vật. Tất cả tên, thiết kế và cốt truyện đều là **nguyên bản** — không sao chép nhân vật hay tên riêng của game gốc.

**Thay đổi ở v2:** chuyển sang phong cách *splash art game mobile cổ phong* — cận nửa người, tóc và dải lụa bay xoáy, phụ kiện ngọc trai / viền vàng cầu kỳ, lụa trong suốt nhiều lớp, render bóng mịn, nền sáng và đơn giản để nhân vật nổi bật.

---

## 1. Thế giới chung

**Bối cảnh:** Vương quốc Hằng Châu, nơi mặt trăng được thờ như thần linh. Mỗi 100 năm, "Nguyệt Thực Máu" xảy ra và chọn ra một "Nguyệt Chủ" nắm quyền thiên mệnh. Vọng Nguyệt Thư Viện là học viện tối cao, nơi con cháu quý tộc lẫn thường dân tài năng tranh giành vị trí trước kỳ Nguyệt Thực sắp tới.

**Bốn Viện (phe phái):**

| Viện | Biểu tượng | Màu chủ đạo | Chuyên môn |
|---|---|---|---|
| Thanh Loan Viện | Chim loan xanh | Xanh lam – bạc | Văn chương, mưu lược, chính sự |
| Huyền Vũ Viện | Rùa rắn đen | Đen – vàng đồng | Võ học, hộ vệ, binh pháp |
| Bạch Lộ Viện | Cò trắng | Trắng – xanh ngọc | Y thuật, âm luật, lễ nghi |
| Xích Diên Viện | Diều đỏ | Đỏ thẫm – tím | Bí thuật, thuật số, cấm thuật |

---

## 2. Config Leonardo.AI

| Thiết lập | Giai đoạn nháp | Giai đoạn chốt | Ghi chú |
|---|---|---|---|
| **Model** | AlbedoBase XL hoặc Anime XL | Như lúc nháp | Chọn 1 model, dùng cố định cả 20 nhân vật |
| **Preset Style** | Anime / None / Illustrative | Như lúc nháp | Nếu Illustrative ra nét phẳng → thử Anime hoặc None |
| **Elements** | None | None (hoặc tối đa 1, weight 0.2–0.4) | Nếu bật thì giữ y nguyên cho cả bộ |
| **Aspect Ratio** | 2:3 | 2:3 | Tỉ lệ dọc chuẩn cho card |
| **Số ảnh / lần** | 2 | 4 | Nháp ít ảnh để đỡ tốn token |
| **Contrast** | Low–Medium | Low–Medium | Contrast cao làm mất ánh sáng dịu |
| **Quality / Alchemy** | Tắt | Bật | Chỉ bật khi đã chốt prompt |
| **Prompt Enhance** | Tắt | Tắt | Để AI tự viết lại prompt sẽ làm lệch style giữa các card |
| **Seed** | Ngẫu nhiên | Cố định | Lưu seed của ảnh đẹp nhất để tái sử dụng |
| **Style Reference** | Không | Có (Low–Mid) | Chỉ dùng ảnh **do bạn gen ra**, xem lưu ý bên dưới |

**Cách ghép prompt:** `[Prompt nhân vật] + [Style block chung]`

### Style block chung (dán cuối MỌI prompt)

```
chinese mobile game splash art, gufeng anime illustration, semi-realistic anime style, highly detailed glossy rendering, dynamic flowing composition, long hair and silk ribbons swirling in the wind, translucent layered silk gauze fabric, ornate hair ornaments with pearls and gold filigree, strands of pearls draping, intricate embroidery, soft bright airy lighting, luminous skin, sharp beautiful eyes, soft pastel blurred background, floating petals, depth of field, three-quarter view, upper body to thigh shot, character fills the frame, masterpiece, best quality
```

### Negative prompt chung

```
modern clothing, glasses, text, watermark, signature, logo, extra fingers, deformed hands, blurry face, low quality, oversaturated, 3d render, photorealistic, realistic face, cropped head, duplicate character, static pose, stiff posture, full body, cluttered background, architecture, flat shading, dull colors
```

> Nếu model không có ô negative prompt, đưa ý quan trọng vào prompt chính dạng khẳng định (ví dụ `wearing traditional hanfu only`, `simple soft background`).

### Lưu ý về Style Reference
Không upload ảnh của Nguyệt Mộng (hay game khác) làm Style Reference / Image Guidance để gen asset thương mại — ảnh đó là tài sản của game gốc và càng bám sát càng dễ ra kết quả giống nhân vật của họ. Hãy:
1. Gen nhân vật đầu tiên chỉ bằng prompt + style block.
2. Chọn ảnh **của bạn** ưng nhất → dùng làm Style Reference (strength Low–Mid) cho 19 nhân vật còn lại.
3. Không dùng Character Reference (tính năng đó giữ *cùng một* nhân vật, còn bạn cần 20 người khác nhau).

### Tip cho card Legendary
Thêm vào cuối prompt: `radiant glow, floating light particles, dramatic rim light` để card trông "đắt giá" hơn.

---

## 3. Nhân vật NAM

### M01 — Tạ Vân Chiêu 謝雲昭
**Độ hiếm:** Legendary · **Viện:** Thanh Loan · **Vai trò card:** Chiến lược / Buff đồng đội

- **Tính cách:** Lạnh lùng, hoàn hảo, nói ít nhưng mỗi câu đều có ý đồ. Bên trong mệt mỏi vì gánh kỳ vọng gia tộc.
- **Thời trang:** Áo bào trắng tuyết viền bạc, áo choàng voan xanh nhạt thêu mây, mũ ngọc trắng, tua ngọc trai bên hông, tay cầm cuộn thư.
- **Bối cảnh:** Lầu cao Tàng Thư Các dưới trăng tròn.
- **Tiểu sử:** Trưởng tôn của Tể tướng, thủ khoa ba năm liền. Được định sẵn làm phò mã của công chúa Thẩm Nguyệt Hoa.
- **Quan hệ:** Hôn ước chính trị với **Thẩm Nguyệt Hoa (F01)**; kình địch âm thầm với **Hoắc Liệt (M05)**; xem thường rồi dần kính trọng **Chu Quyết (M10)**.
- **Tư tưởng:** "Trật tự là lòng nhân từ lớn nhất." Tin rằng chỉ quý tộc có học mới giữ được thiên hạ.

```
handsome aristocratic young man, cold aloof gaze looking over shoulder, long black hair half-tied with white jade crown, strands of hair and silk ribbons flowing dramatically in the wind, layered snow-white and silver hanfu with translucent pale blue gauze outer robe, silver cloud embroidery, jade and pearl tassels hanging from belt, holding a rolled scroll in one hand, other hand raised holding a sleeve, pale moonlit sky background with soft clouds, faint giant moon glow, white silver and pale blue palette
```

---

### M02 — Lục Hàn Phong 陸寒鋒
**Độ hiếm:** Epic · **Viện:** Huyền Vũ · **Vai trò card:** Tank / Hộ vệ

- **Tính cách:** Trầm lặng, trung thành tuyệt đối, vụng về trong giao tiếp nhưng rất tinh ý.
- **Thời trang:** Giáp nhẹ đen vảy rùa viền đồng trên áo vải, băng quấn cổ tay, đại đao, vết sẹo chéo trên má.
- **Bối cảnh:** Cổng đá học viện trong đêm mưa.
- **Tiểu sử:** Trẻ mồ côi chiến tranh, được nhà họ Tạ nuôi lớn để làm cận vệ cho Tạ Vân Chiêu.
- **Quan hệ:** Hộ vệ và "anh em không cùng máu" với **Tạ Vân Chiêu (M01)**; thầm thương **Hạ Chi (F05)** nhưng không dám nói.
- **Tư tưởng:** "Kiếm không cần hiểu lý lẽ, chỉ cần biết bảo vệ ai."

```
stoic handsome young swordsman, steady protective gaze, diagonal scar across cheek, dark hair in messy high tie with bronze hair cuff, black lamellar light armor with engraved bronze trim over dark robe, long black cloak and red cord tassels whipping in the wind, bandaged wrists, gripping large broadsword resting on shoulder, falling rain streaks and glowing droplets, dark misty night background with soft lantern bokeh, black bronze and deep red palette
```

---

### M03 — Mặc Tử Du 墨子游
**Độ hiếm:** Rare · **Viện:** Thanh Loan · **Vai trò card:** Hỗ trợ / Rút bài

- **Tính cách:** Phong lưu, lém lỉnh, hay đùa cợt, biết mọi tin đồn trong học viện.
- **Thời trang:** Áo lụa tím nhạt thêu mẫu đơn, đai ngọc bích, quạt giấy thủy mặc, trâm cài lệch.
- **Bối cảnh:** Cầu đá trên hồ sen dưới trăng.
- **Tiểu sử:** Con trai thương nhân giàu nhất Hằng Châu, mua được suất vào học viện. Bị quý tộc khinh là "trọc phú".
- **Quan hệ:** Bạn thân chí cốt của **Chu Quyết (M10)**; mua tin tức từ **Lam Khê (F06)**; hay trêu chọc **Cố Uyển (F07)**.
- **Tư tưởng:** "Thiên hạ vận hành bằng bạc, không phải bằng huyết thống."

```
charming playful young nobleman, mischievous half-smile, playful wink, dark brown hair half-up with tilted gold and amethyst hairpin, flowing pale lavender silk hanfu with layered sheer lilac gauze, peony embroidery, jade belt with dangling gold coins and pearl strands, holding open paper fan covering half his face, sleeves and ribbons fluttering, soft lotus pond reflections and pink lotus petals in blurred background, lavender pink and gold palette
```

---

### M04 — Bùi Thanh Minh 裴清明
**Độ hiếm:** Epic · **Viện:** Bạch Lộ · **Vai trò card:** Healer

- **Tính cách:** Dịu dàng, kiên nhẫn, luôn mỉm cười nhưng có nỗi buồn sâu thẳm.
- **Thời trang:** Áo bào trắng ngà viền xanh ngọc, dải lụa trắng che mắt, túi thảo dược.
- **Bối cảnh:** Vườn dược thảo phát sáng, đom đóm.
- **Tiểu sử:** Thần y trẻ nhất học viện, tự nguyện mất thị lực để đổi lấy khả năng "nhìn thấy" bệnh tật trong kinh mạch.
- **Quan hệ:** Sư huynh và người dẫn dắt **Ôn Như Ý (F04)**; từng chữa trị cho **Tô Dạ (M06)** và là người duy nhất biết thân phận thật của hắn.
- **Tư tưởng:** "Cứu một người là cứu một thế giới." Không phân biệt địch ta.

```
gentle serene young physician, soft kind smile, long silver-white hair flowing loosely, long white silk blindfold with ends trailing in the wind, ivory hanfu with translucent jade-green gauze layers, jade leaf hair ornament with small pearls, herbal pouch and jade pendant tassels, one hand gently raised with glowing green healing light, floating fireflies and small leaves swirling around, soft pale green blurred background, ivory teal and silver palette
```

---

### M05 — Hoắc Liệt 霍烈
**Độ hiếm:** Legendary · **Viện:** Huyền Vũ · **Vai trò card:** DPS bùng nổ

- **Tính cách:** Nóng nảy, thẳng thắn, ngông cuồng nhưng cực kỳ trọng nghĩa khí.
- **Thời trang:** Võ phục đỏ đen, giáp vai đầu sói, tóc buộc đuôi ngựa cao, thương dài tua đỏ.
- **Bối cảnh:** Thao trường, lửa trại bùng cháy.
- **Tiểu sử:** Con trai Trấn Bắc Đại Tướng, bị triều đình giữ ở học viện làm "con tin" để kiềm chế cha mình.
- **Quan hệ:** Kình địch của **Tạ Vân Chiêu (M01)**; đối thủ ngang tài với **Tần Sương (F03)**; có món nợ cũ với **Phượng Chiêu Dung (F08)**.
- **Tư tưởng:** "Kẻ ngồi trên ngai vàng chưa từng thấy máu biên cương."

```
fierce rebellious young warrior, confident fierce grin, intense amber eyes, high ponytail of dark hair with long red ribbon streaming in the wind, red and black martial hanfu with gold flame embroidery, ornate silver wolf-head pauldron, red spear tassel and cloak whipping around, dynamic lunging pose thrusting long spear forward, glowing embers and sparks flying, warm orange sunset blurred background, crimson black and gold palette
```

---

### M06 — Tô Dạ 蘇夜
**Độ hiếm:** Epic · **Viện:** Không thuộc viện (Thủ thư) · **Vai trò card:** Sát thủ / Né tránh

- **Tính cách:** Bề ngoài lười biếng, buồn ngủ; bên trong lạnh lùng, tính toán chính xác.
- **Thời trang:** Áo xám tro rộng, tay áo giấu ám khí, mặt nạ nửa mặt đeo bên hông, tóc đen dài rối.
- **Bối cảnh:** Giữa kệ sách cao, ánh trăng qua song cửa.
- **Tiểu sử:** Thủ thư Tàng Thư Các, thực chất là sát thủ của tổ chức "Vô Nguyệt" được cài vào học viện.
- **Quan hệ:** Nợ ân cứu mạng **Bùi Thanh Minh (M04)**; được giao theo dõi **Thẩm Nguyệt Hoa (F01)** nhưng dần dao động; đối đầu tình báo với **Diệp Linh Lung (F02)**.
- **Tư tưởng:** "Bóng tối không có phe. Nó chỉ chờ trăng lặn."

```
mysterious languid young man, half-lidded sleepy eyes with sharp hidden glint, long messy black hair drifting, loose ash-grey hanfu with wide sleeves and translucent dark indigo gauze, silver half-face mask hanging from belt with black tassels, slender throwing knives fanned between fingers, torn pages and paper talismans swirling around, dim silver moonbeams, soft deep indigo blurred background, grey indigo and silver palette
```

---

### M07 — Ninh An 寧安
**Độ hiếm:** Rare · **Viện:** Bạch Lộ · **Vai trò card:** Hỗ trợ may mắn

- **Tính cách:** Vui vẻ, ngây thơ, lạc quan, nói nhiều, luôn tin người.
- **Thời trang:** Đồng phục học viện trắng xanh hơi rộng, khăn quàng cam, túi vải đeo chéo.
- **Bối cảnh:** Hành lang gỗ với lồng đèn giấy, hoa đào bay.
- **Tiểu sử:** Tân sinh viên đỗ hạng thấp nhất, từ một ngôi làng hẻo lánh. Mang dòng máu bí ẩn chưa thức tỉnh.
- **Quan hệ:** Em trai kết nghĩa của **Hạ Chi (F05)**; được **Khương Tịch (M08)** chú ý đặc biệt; bạn cùng phòng với **Chu Quyết (M10)**.
- **Tư tưởng:** "Nếu ai cũng tử tế một chút, thế giới sẽ ổn thôi."

```
cheerful energetic young man, bright wide smile, fluffy short brown hair with small blue ribbon, slightly oversized white and light-blue academy hanfu with sheer sky-blue gauze sleeves, long orange scarf fluttering in the wind, cloth satchel with charms and bells, mid-jump pose with arm raised waving, peach blossom petals swirling around, soft warm pastel sky background, white sky-blue and orange palette
```

---

### M08 — Khương Tịch 姜寂
**Độ hiếm:** Legendary · **Viện:** Giáo quan Xích Diên · **Vai trò card:** Điều khiển / Thuật số

- **Tính cách:** Điềm tĩnh, bí ẩn, nói chuyện như câu đố, hiếm khi thể hiện cảm xúc.
- **Thời trang:** Áo bào đen thêu chòm sao chỉ bạc, dải lụa đỏ, la bàn tinh tú lơ lửng, tóc bạc dài.
- **Bối cảnh:** Đài quan tinh, trời sao, trăng khuyết.
- **Tiểu sử:** Giáo quan trẻ tuổi nhất lịch sử, người duy nhất tiên đoán đúng Nguyệt Thực lần trước. Tuổi thật không ai biết.
- **Quan hệ:** Sư phụ cũ của **Phượng Chiêu Dung (F08)**, người đã phản bội ông; bảo hộ bí mật cho **Ninh An (M07)**; đồng minh cổ với **Liễu Tịnh Nhan (F10)**.
- **Tư tưởng:** "Thiên mệnh không phải để tuân theo, mà để đọc hiểu."

```
enigmatic ageless young astrologer, calm half-closed silver eyes, very long silver hair flowing like a river, black hanfu robe embroidered with glowing silver constellations, translucent dark starry gauze outer layer, long crimson silk ribbons spiraling around him, ornate silver star-shaped hair crown with hanging crystal beads, floating golden celestial armillary rings orbiting his raised hand, soft deep violet night sky blurred background with sparkles, black silver and crimson palette
```

---

### M09 — Đoàn Lạc 段落
**Độ hiếm:** Epic · **Viện:** Bạch Lộ · **Vai trò card:** Debuff bằng âm luật

- **Tính cách:** U sầu, lãng mạn, kiêu hãnh ngầm, hay tự giam mình trong âm nhạc.
- **Thời trang:** Áo lụa xanh rêu phai màu từng thuộc hoàng tộc, dây buộc tóc cũ sờn, ôm cổ cầm.
- **Bối cảnh:** Đình giữa rừng trúc, sương mù, trăng mờ.
- **Tiểu sử:** Hoàng tử nước bại trận Nam Chiếu, bị đưa đến làm "khách" của học viện — thực chất là tù nhân danh dự.
- **Quan hệ:** Tri âm với **Lam Khê (F06)**; bị **Tạ Vân Chiêu (M01)** giám sát; hận triều đình của **Thẩm Nguyệt Hoa (F01)** nhưng không hận cô.
- **Tư tưởng:** "Nước mất, nhưng khúc nhạc thì không ai chiếm được."

```
melancholic elegant exiled prince, sorrowful downcast eyes, long dark hair loosely tied with a worn faded ribbon, strands drifting across his face, faded moss-green royal hanfu with pale sage gauze layers and tarnished gold embroidery, broken jade pendant on a cord, holding a guqin zither against his chest, bamboo leaves and translucent musical light ribbons swirling around, soft misty pale green blurred background, muted green grey and gold palette
```

---

### M10 — Chu Quyết 周決
**Độ hiếm:** Rare · **Viện:** Thanh Loan · **Vai trò card:** Tăng tiến theo lượt

- **Tính cách:** Tham vọng, cứng đầu, tự ti ngầm về xuất thân nhưng cực kỳ thông minh.
- **Thời trang:** Áo vải xanh đậm đã vá, ủi phẳng cẩn thận; bút lông cài sau tai; tay áo xắn.
- **Bối cảnh:** Phòng ký túc chật, đèn dầu, chồng sách.
- **Tiểu sử:** Con nông dân thi đỗ bằng thực lực, người thường dân đầu tiên lọt top 10 học viện sau 50 năm.
- **Quan hệ:** Bạn thân với **Mặc Tử Du (M03)**; đối thủ học thuật của **Tạ Vân Chiêu (M01)**; phải lòng **Cố Uyển (F07)** qua những bức thư tranh luận.
- **Tư tưởng:** "Triều đình phải thuộc về người tài, không phải người sinh ra đúng nhà."

```
determined young commoner scholar, sharp focused eyes, neatly tied black hair with simple wooden hairpin, calligraphy brush tucked behind ear, dark blue hemp hanfu with neat patches and rolled-up sleeves, simple sash with a single blue cord tassel, holding an open book, calligraphy papers with glowing ink characters flying around him, warm oil lamp glow mixed with cool moonlight, soft dark blue blurred background, deep blue and warm amber palette
```

---

## 4. Nhân vật NỮ

### F01 — Thẩm Nguyệt Hoa 沈月華
**Độ hiếm:** Legendary · **Viện:** Thanh Loan · **Vai trò card:** Nhân vật trung tâm / Ultimate

- **Tính cách:** Điềm tĩnh, cao quý, có trách nhiệm; ẩn dưới là khao khát tự do và nổi loạn.
- **Thời trang:** Hanfu nhiều lớp trắng-bạc-xanh lam, vạt áo như ánh trăng loang, trâm trăng khuyết, khăn voan mỏng.
- **Bối cảnh:** Mặt hồ phản chiếu trăng tròn, cánh hoa trắng bay.
- **Tiểu sử:** Công chúa út, được tiên tri là ứng viên Nguyệt Chủ. Vào học viện để "được giáo dưỡng", thực chất để bị giám sát.
- **Quan hệ:** Hôn ước với **Tạ Vân Chiêu (M01)**; bị **Tô Dạ (M06)** theo dõi; chị em thân thiết rồi đối đầu với **Diệp Linh Lung (F02)**.
- **Tư tưởng:** "Nếu thiên mệnh chọn ta, ta sẽ chọn lại thiên mệnh."

```
ethereal graceful princess, serene gentle gaze with hidden resolve, very long black hair flowing in waves, silver crescent moon hair crown with dangling pearls and a thin sheer veil blowing back, multi-layered white silver and pale blue hanfu with translucent moonlight gauze, silver lunar embroidery, strands of pearls draping across sleeves, one hand reaching toward a small glowing moon orb, white petals and silver light motes swirling, soft luminous pale blue blurred background with giant moon glow, white silver and pale blue palette
```

---

### F02 — Diệp Linh Lung 葉玲瓏
**Độ hiếm:** Epic · **Viện:** Xích Diên · **Vai trò card:** Lừa gạt / Đánh cắp buff

- **Tính cách:** Lanh lợi, quyến rũ, cười nhiều nhưng không bao giờ nói thật hoàn toàn.
- **Thời trang:** Hanfu đỏ hồng, tua rua vàng, hoa tai chuông nhỏ, đuôi mắt kẻ đỏ, mặt nạ cáo.
- **Bối cảnh:** Lễ hội đèn lồng đêm trăng.
- **Tiểu sử:** Con gái nuôi của Thái hậu, được đào tạo làm mật thám từ nhỏ. Kết thân với công chúa theo lệnh.
- **Quan hệ:** Chị em giả mà hóa thật với **Thẩm Nguyệt Hoa (F01)**; đấu trí với **Tô Dạ (M06)**; mua bán tin tức với **Lam Khê (F06)**.
- **Tư tưởng:** "Lời thật là thứ xa xỉ mà kẻ yếu không mua nổi."

```
sly charming young woman, playful knowing smile looking back over shoulder, red eyeliner, dark hair in elaborate double buns with gold bell hairpins and red tassels, rose-red and blush hanfu with sheer pink gauze layers and gold embroidery, long golden tassels and small bells swinging, holding a white fox mask near her face, red ribbons twirling around, glowing lantern bokeh in soft blurred background, crimson rose pink and gold palette
```

---

### F03 — Tần Sương 秦霜
**Độ hiếm:** Epic · **Viện:** Huyền Vũ · **Vai trò card:** DPS băng / Đóng băng

- **Tính cách:** Lạnh như băng, kỷ luật, ít nói, ghét sự giả tạo.
- **Thời trang:** Võ phục trắng xanh băng giá, áo choàng viền lông trắng, dải băng xanh trên tóc, song kiếm mỏng.
- **Bối cảnh:** Đỉnh núi tuyết, hoa mai đỏ, trăng lạnh.
- **Tiểu sử:** Truyền nhân cuối cùng của kiếm phái Hàn Sơn bị diệt môn. Vào học viện để tìm kẻ đã hạ lệnh.
- **Quan hệ:** Đối thủ ngang tài của **Hoắc Liệt (M05)**; nghi ngờ **Phượng Chiêu Dung (F08)** liên quan vụ diệt môn; được **Hạ Chi (F05)** làm bạn dù không muốn.
- **Tư tưởng:** "Tha thứ là việc của trời. Việc của ta là trả nợ."

```
cold stern swordswoman, icy piercing pale blue eyes, long black hair in high ponytail with long pale blue ribbon whipping in the wind, silver snowflake hair ornament with crystal beads, fitted white and ice-blue martial hanfu with translucent frost gauze layers, white fur-trimmed short cape, dual slender swords crossed in ready stance, ice crystals and red plum petals swirling together, soft cold white blurred snowy background, white ice-blue and crimson accent palette
```

---

### F04 — Ôn Như Ý 溫如意
**Độ hiếm:** Rare · **Viện:** Bạch Lộ · **Vai trò card:** Healer / Hồi phục theo thời gian

- **Tính cách:** Hiền lành, rụt rè, dễ xúc động nhưng rất kiên cường khi người khác gặp nguy.
- **Thời trang:** Hanfu xanh lá nhạt và trắng, tạp dề dược sư, giỏ tre thảo dược, hoa trà trên tóc.
- **Bối cảnh:** Gian nhà tre sắc thuốc dưới trăng.
- **Tiểu sử:** Con gái một thầy lang làng, thất bại hai lần mới đỗ vào Bạch Lộ Viện.
- **Quan hệ:** Sư muội và người ngưỡng mộ **Bùi Thanh Minh (M04)**; bạn thân **Ninh An (M07)**; từng được **Tần Sương (F03)** cứu khỏi bị bắt nạt.
- **Tư tưởng:** "Không cần mạnh nhất, chỉ cần không bỏ cuộc."

```
gentle shy young herbalist woman, soft kind eyes with a small nervous smile, light brown hair in long loose braid with white camellia flowers and tiny pearl pins, pale mint green and white hanfu with sheer green gauze sleeves, embroidered herbalist apron, holding a small bamboo basket of glowing herbs to her chest, green leaves and camellia petals floating around, soft warm cream blurred background, mint green cream and white palette
```

---

### F05 — Hạ Chi 夏枝
**Độ hiếm:** Rare · **Viện:** Huyền Vũ · **Vai trò card:** Tấn công tầm xa

- **Tính cách:** Tomboy, sảng khoái, cười to, bảo vệ người yếu, ghét lễ nghi rườm rà.
- **Thời trang:** Áo săn ngắn nâu cam, bao tay da, cung dài, tóc ngang vai buộc lệch, lông vũ trên tai.
- **Bối cảnh:** Cành cây cổ thụ, gió thổi lá bay.
- **Tiểu sử:** Con gái thợ săn biên giới, đỗ vào học viện nhờ bắn hạ thích khách ám sát quan khảo thí.
- **Quan hệ:** Chị kết nghĩa của **Ninh An (M07)**; được **Lục Hàn Phong (M02)** thầm thương (cô không biết); "làm bạn cưỡng ép" với **Tần Sương (F03)**.
- **Tư tưởng:** "Rừng không có quý tộc. Chỉ có kẻ sống sót."

```
energetic tomboyish archer woman, big confident grin, shoulder-length messy auburn hair tied to one side, feather and wooden bead ear ornament, short orange-brown hunting hanfu with leather bracers and a sheer amber gauze sash streaming behind, drawing longbow with arrow aimed forward, hair and green leaves blowing in strong wind, soft sunlit forest green blurred background, warm orange brown and forest green palette
```

---

### F06 — Lam Khê 藍溪
**Độ hiếm:** Epic · **Viện:** Bạch Lộ · **Vai trò card:** Mê hoặc / Điều khiển mục tiêu

- **Tính cách:** Dịu dàng bề ngoài, sắc sảo bên trong, kín đáo, luôn giữ khoảng cách.
- **Thời trang:** Váy múa lụa xanh lam trong suốt nhiều lớp, dải lụa dài bay, vòng bạc cổ chân, trâm hoa sen.
- **Bối cảnh:** Sân khấu gỗ giữa hồ, hoa đăng thả trôi.
- **Tiểu sử:** Vũ cơ nổi tiếng nhất kinh thành, được đặc cách vào học viện. Nắm mạng lưới tin tức khổng lồ.
- **Quan hệ:** Tri âm với **Đoàn Lạc (M09)**; bán tin cho **Mặc Tử Du (M03)** và **Diệp Linh Lung (F02)** — nhưng không trung thành với ai.
- **Tư tưởng:** "Kẻ múa trên sân khấu thấy rõ nhất khán giả."

```
graceful elegant dancer, calm mysterious smile with half-lowered eyes, long dark hair flowing in arcs, silver lotus hair ornament with hanging aquamarine beads, translucent layered azure and teal silk dance hanfu, extremely long sheer ribbons spiraling around her body in mid-spin, silver bracelets with tiny bells, water droplets and floating lotus lanterns glowing around, soft shimmering blue water reflections in blurred background, azure teal and silver palette
```

---

### F07 — Cố Uyển 顧婉
**Độ hiếm:** Rare · **Viện:** Thanh Loan · **Vai trò card:** Rút bài / Phong ấn kỹ năng

- **Tính cách:** Thông thái, nghiêm túc, hơi cứng nhắc, vụng về trong tình cảm, cực kỳ mê sách.
- **Thời trang:** Hanfu xanh xám nhạt đơn giản, tay áo dính mực, bút lông cài búi tóc, ôm chồng sách.
- **Bối cảnh:** Bậc thang thư viện, giấy thư pháp bay như bướm.
- **Tiểu sử:** Hậu duệ nhà sử quan, đang bí mật chép lại "phần lịch sử bị xóa" về các Nguyệt Chủ trước.
- **Quan hệ:** Tranh luận thư từ với **Chu Quyết (M10)** (không biết đó là anh); bị **Mặc Tử Du (M03)** trêu chọc; phát hiện bí mật liên quan **Khương Tịch (M08)**.
- **Tư tưởng:** "Lịch sử bị viết bởi kẻ thắng, nên ta sẽ viết lại."

```
serious intellectual young scholar woman, focused thoughtful eyes glancing up from a book, dark hair in neat bun with calligraphy brush hairpin and small silver bookmark charms, grey-blue hanfu with sheer pale grey gauze layers and ink-stained sleeves, holding an open ancient book with glowing ink characters rising from the pages, calligraphy papers fluttering around like butterflies, soft parchment-toned blurred background, grey-blue parchment and black ink palette
```

---

### F08 — Phượng Chiêu Dung 鳳昭容
**Độ hiếm:** Legendary · **Viện:** Xích Diên (Trưởng viện sinh) · **Vai trò card:** Boss / Cấm thuật

- **Tính cách:** Kiêu ngạo, tàn nhẫn, quyến rũ, có lý tưởng méo mó nhưng kiên định.
- **Thời trang:** Hanfu đỏ thẫm và đen họa tiết phượng lửa, mũ phượng vàng, móng giáp vàng, lửa tím trong tay.
- **Bối cảnh:** Trận pháp đỏ, trăng máu.
- **Tiểu sử:** Đệ tử thiên tài nhất của Khương Tịch, phản sư để tu luyện cấm thuật "Huyết Nguyệt" nhằm tự mình trở thành Nguyệt Chủ.
- **Quan hệ:** Phản bội sư phụ **Khương Tịch (M08)**; mục tiêu báo thù của **Tần Sương (F03)**; đối lập định mệnh với **Thẩm Nguyệt Hoa (F01)**; nắm điểm yếu của **Hoắc Liệt (M05)**.
- **Tư tưởng:** "Thiên mệnh là xiềng xích. Ta sẽ đốt nó."

```
imperious beautiful sorceress, proud cold smirk, red eyeshadow and sharp crimson eyes, long black hair flowing upward, ornate golden phoenix crown with ruby drops and long hanging gold chains, deep crimson and black hanfu with fiery phoenix embroidery and translucent dark red gauze layers, long golden nail guards, violet flames swirling from her raised palm, glowing red rune circles and burning feathers floating around, soft dark red blurred background with blood-red moon glow, crimson black gold and violet palette
```

---

### F09 — Tiểu Mãn 小滿
**Độ hiếm:** Common → có thể nâng cấp thành Epic · **Viện:** Bạch Lộ · **Vai trò card:** Triệu hồi linh thú

- **Tính cách:** Hồn nhiên, tò mò, hơi vụng, nói chuyện được với động vật. (Tân sinh viên, đã trưởng thành.)
- **Thời trang:** Hanfu vàng nhạt và trắng, túi thơm hình thỏ, tóc hai búi tròn, thỏ ngọc phát sáng trên vai.
- **Bối cảnh:** Đồng cỏ đêm, linh thú nhỏ phát sáng.
- **Tiểu sử:** Được tìm thấy khi còn bé trong đêm trăng tròn bên một con thỏ ngọc — linh thú tưởng đã tuyệt chủng.
- **Quan hệ:** Được **Liễu Tịnh Nhan (F10)** bảo hộ từ nhỏ; bạn thân **Ninh An (M07)** và **Ôn Như Ý (F04)**; khiến **Phượng Chiêu Dung (F08)** chú ý vì con thỏ ngọc.
- **Tư tưởng:** "Mọi sinh linh đều có tiếng nói, chỉ là ta chưa lắng nghe."

```
cheerful curious young adult woman, bright round eyes and delighted smile, dark hair in two round buns with pearl clusters and small white ribbons fluttering, pale butter-yellow and white hanfu with sheer cream gauze layers, rabbit-shaped embroidered sachet, glowing white jade rabbit spirit leaping from her shoulder, tiny glowing spirit animals and light orbs swirling around, soft pastel yellow blurred background with moon glow, pastel yellow white and soft gold palette
```

---

### F10 — Liễu Tịnh Nhan 柳淨顏
**Độ hiếm:** Legendary · **Viện:** Thánh nữ Nguyệt Thần Điện · **Vai trò card:** Hồi sinh / Bảo hộ toàn đội

- **Tính cách:** Từ bi, thanh tịnh, xa cách; mang nỗi buồn của người biết trước số mệnh.
- **Thời trang:** Áo thánh nữ trắng thuần với voan bạc, vương miện trăng khuyết, tràng hạt ngọc trai.
- **Bối cảnh:** Thần điện đổ nát, ánh trăng như thác.
- **Tiểu sử:** Thánh nữ canh giữ Nguyệt Thần Điện, đã sống qua một kỳ Nguyệt Thực. Biết rằng Nguyệt Chủ phải hy sinh người thân yêu nhất.
- **Quan hệ:** Đồng minh cổ của **Khương Tịch (M08)**; người bảo hộ **Tiểu Mãn (F09)**; âm thầm dẫn dắt **Thẩm Nguyệt Hoa (F01)**.
- **Tư tưởng:** "Ánh trăng không chọn ai để chiếu sáng — nhưng cái giá của nó thì có."

```
serene divine priestess, compassionate sorrowful eyes, very long pale silver hair flowing endlessly in the air, silver crescent moon crown with long hanging pearl strands and a sheer veil, pure white holy hanfu with many translucent silver gauze layers, soft gold lunar embroidery, pearl prayer beads wrapped around clasped praying hands, beams of moonlight falling on her, white feathers and glowing pearls floating around, soft luminous white-gold blurred background, white silver and soft gold palette
```

---

## 5. Sơ đồ quan hệ tóm tắt

| Nhân vật | Đồng minh | Đối thủ / Căng thẳng | Tình cảm / Bí mật |
|---|---|---|---|
| M01 Tạ Vân Chiêu | M02 | M05, M10 | Hôn ước F01 |
| M02 Lục Hàn Phong | M01 | — | Thầm thương F05 |
| M03 Mặc Tử Du | M10, F06 | Quý tộc | Trêu F07 |
| M04 Bùi Thanh Minh | F04 | — | Biết bí mật M06 |
| M05 Hoắc Liệt | — | M01, F03 | Nợ cũ F08 |
| M06 Tô Dạ | M04 | F02 | Dao động vì F01 |
| M07 Ninh An | F05, M10, F09 | — | Dòng máu bí ẩn (M08 biết) |
| M08 Khương Tịch | F10, M07 | F08 | Bị F07 điều tra |
| M09 Đoàn Lạc | F06 | Triều đình | — |
| M10 Chu Quyết | M03, M07 | M01 | Thư từ với F07 |
| F01 Thẩm Nguyệt Hoa | F02, F10 | F08 | Hôn ước M01 |
| F02 Diệp Linh Lung | F01, F06 | M06 | Mật thám của Thái hậu |
| F03 Tần Sương | F05, F04 | M05, F08 | Báo thù diệt môn |
| F04 Ôn Như Ý | M04, M07 | — | — |
| F05 Hạ Chi | M07, F03 | — | M02 thầm thương |
| F06 Lam Khê | M09 | — | Không trung thành với ai |
| F07 Cố Uyển | — | — | Thư từ với M10 |
| F08 Phượng Chiêu Dung | — | M08, F03, F01 | Nhắm vào F09 |
| F09 Tiểu Mãn | F10, M07, F04 | F08 | Thỏ ngọc linh thú |
| F10 Liễu Tịnh Nhan | M08, F09, F01 | — | Biết cái giá của Nguyệt Chủ |

---

## 6. Phân bổ độ hiếm (cho hệ thống gacha)

- **Legendary (6):** M01, M05, M08, F01, F08, F10 → mỗi nhân vật có thể làm 1 banner giới hạn riêng
- **Epic (7):** M02, M04, M06, M09, F02, F03, F06
- **Rare (6):** M03, M07, M10, F04, F05, F07
- **Common (1, có nâng cấp):** F09
