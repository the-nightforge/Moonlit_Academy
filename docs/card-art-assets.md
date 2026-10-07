# Card Art Assets — `cards:art_*`

Card-face artwork for the LoR-style card renderer (`apps/client/src/ui/combat-card-view.ts`).
Files land in `apps/client/public/assets/cards/` and resolve as `cards:<stem>` through
`assetsManifest()` — same convention as `heroes:*`, `ui:*`.

## Resolution order (first existing texture wins)

1. `cards:art_${card.art}` — explicit per-card override (`CardDef.art?`, optional)
2. `cards:${cardId}` — per-card art (e.g. `cards:m05_thuong_pha`)
3. `weapons:${cardId}` — weapon cards reuse weapon art
4. `cards:art_${card.keywords[0]}` — keyword art
5. `cards:art_${card.type}` — `art_attack` / `art_skill`
6. Procedural glow + emblem fallback (no file needed)

So `art_attack` + `art_skill` + 26 keyword arts give every one of the 270 cards artwork
without touching data. Per-card `art` / `cards:<id>` can be added later for signature cards.

## Technical frame

- Display window: **full-bleed**, `114×170` compact / `176×260` preview, cover-cropped
  centered with 7px rounded corners (baked in code — do NOT bake frames or rounded edges
  into the art).
- Source: **2:3 portrait, ≥ 768×1152** (PNG/WebP). Center-crop is symmetric, so keep the
  focal subject in the central column, slightly upper-half.
- **Safe zones:** top-left ~40px and top-right ~40px sit under the cost coin / type
  emblem — keep those corners calm. The **bottom ~35–70% is covered by a dark gradient**
  carrying the name + keyword icons + rules text, so let the lower third fall into
  shadow/quiet background; no important subject matter there.
- No baked-in text, labels, borders, UI chrome, signatures or watermarks. No opaque
  plate: the file IS the card interior.
- Style target: same gufeng/anime look as the hero set — rich navy night, warm antique
  gold, ivory, jewel accents; Chinese fantasy elegance. Card art is a *scene/motif*,
  not a portrait: dramatic object, spell effect, or tableau — no full character body
  required (faces optional, avoid detailed portraits so cards don't look like hero dupes).

## Prompt template (OpenAI image_gen)

```
Asset: one card artwork (card interior, full-bleed) for the Vietnamese anime fantasy
card game Vong Nguyet. Subject: <SUBJECT>. Mood: <MOOD>. Authentic polished 2D anime
fantasy illustration, cel-shaded with rich color planes and glowing rim light; palette
of deep navy night, warm antique gold, ivory and one jewel accent color <ACCENT>.
Chinese fantasy elegance, ornate but readable at small size. Composition: strong single
focal motif in the central column slightly above center; the lower third dissolves into
dark shadow and haze for UI text overlay; top corners keep only soft ambience (no bright
detail in the top-left and top-right 15%). Portrait 2:3. No text, letters, numbers,
watermarks, borders, card frames, UI elements, signatures; no realistic photography,
no 3D render look. Export PNG.
```

## Keys to generate

### Type art — required (covers all 48 keyword-less cards + final fallback)

| Key | Cards* | Subject |
|-----|--------|---------|
| `art_attack` | 66 | A decisive strike frozen mid-swing: a crescent blade arc of golden light cutting through indigo mist, embers scattering |
| `art_skill` | 204 | A scholar's talisman releasing a swirl of ink and moonlight, jade paper slips orbiting a glowing seal |

\* fallback reach — keyword cards try their keyword art first.

### Keyword art — priority order (by `keywords[0]` usage)

| Key | Uses | Name | Subject suggestion |
|-----|------|------|--------------------|
| `art_huyet_nguyet` | 21 | Huyết Nguyệt | A huge blood-red full moon eclipsing a night sky, crimson light spilling over dark clouds, crimson accent |
| `art_chiem_bai` | 19 | Chiêm Bài | An open divination scroll with fanned oracle cards glowing faintly over a bronze mirror, violet accent |
| `art_suy_yeu` | 18 | Suy Yếu | A warrior's silhouette buckling under ghostly grey-green chains of fading light, desaturated green accent |
| `art_tich_tu` | 17 | Tích Tụ | A jade vessel slowly filling with swirling golden light pooling upward, amber accent |
| `art_lien_hoan` | 15 | Liên Hoàn | A chain of echoing sword strikes — one blade multiplied into a ribbon of afterimages, cyan accent |
| `art_hoi_phuc` | 15 | Hồi Phục | Falling jade-green petals knitting into a glowing mending sigil, soft green accent |
| `art_me_hoac` | 14 | Mê Hoặc | A fox-spirit's hypnotic eyes and drifting pink petals over a mirror-like pond, magenta accent |
| `art_linh_thu` | 9 | Linh Thú | A spectral spirit-beast (moon-rabbit/fox) leaping from a summoning seal, teal accent |
| `art_du_sinh` | 8 | Dư Sinh | Overflowing vitality: light spilling past a vessel's rim and hardening into a translucent golden shell |
| `art_an_than` | 8 | Ẩn Thân | An assassin's cloak dissolving into moonlit mist, only a dagger edge catching light, steel-blue accent |
| `art_toa_nguyet` | 8 | Tỏa Nguyệt | A small caged crescent moon wrapped in silver chains, lunar light dimming, silver accent |
| `art_phong_an` | 8 | Phong Ấn | A talisman slamming onto a dark seal array, chains of paper slips locking a glowing sigil, purple accent |
| `art_duong_nguyet` | 7 | Dưỡng Nguyệt | A budding moon-flower blooming under crescent light, dew turning to pearls of light, soft gold accent |
| `art_danh_dau` | 7 | Đánh Dấu | A glowing vermilion mark branded onto a dark scroll/forehead silhouette, red accent |
| `art_dong_bang` | 7 | Đóng Băng | A struck figure frozen inside a blooming ice crystal, frost feathers spreading, ice-blue accent |
| `art_doat_nguyet` | 7 | Đoạt Nguyệt | A hand siphoning a thread of moonlight from a dimming crescent into a glowing orb, violet-gold accent |
| `art_khieu_khich` | 5 | Khiêu Khích | A defiant figure striking a war drum, crimson challenge banners whipping, red accent |
| `art_ho_ve` | 5 | Hộ Vệ | A broad shield-bearer stepping forward, golden barrier arc flaring before an ally, bronze accent |
| `art_cuong_hoa` | 4 | Cường Hóa | A blade wrapped in spiraling gold script igniting edge-first, ember-gold accent |
| `art_phan_huyet` | 4 | Phẫn Huyết | A wounded fighter's blood igniting into a furious crimson aura blade, deep red accent |
| `art_tu_duoc` | 4 | Tụ Dược | A medicine gourd uncorked, jade elixir light bursting into a protective bloom, jade accent |
| `art_hoi_hon` | 4 | Hồi Hồn | A pale spirit rising back into a fallen body, soul-moths of white light descending, pale-blue accent |
| `art_phan_don` | 3 | Phản Đòn | A strike rebounding off a hexagonal mirror-barrier back toward the attacker, mirror-silver accent |
| `art_suc_manh` | 2 | Sức Mạnh | A fist coiled in dense golden pressure rings, ground cracking under the stance, amber accent |
| `art_de_vo` | 2 | Dễ Vỡ | A porcelain armor plate spider-webbing with luminous cracks, pale-gold accent |
| `art_thieu_dot` | 1 | Thiêu Đốt | Embers crawling along a talisman edge, smoldering script igniting, orange accent |

`keo_dai` (Kéo Dài, 0 first-keyword uses — only ever secondary): optional
`art_keo_dai` — an hourglass whose falling sand slows and stretches into ribbons of time.

### Naming

`apps/client/public/assets/cards/art_<key>.webp` (or `.png`/`.jpg` — one file per stem).
Example: `apps/client/public/assets/cards/art_huyet_nguyet.webp` → texture `cards:art_huyet_nguyet`.

## Keyword icons — `ui:kw_*` (same batch if convenient)

27 small square icons, **same spec as `docs/assets/ui-png-icons.json`** (transparent PNG,
subject 78–84% of canvas, indigo outlines, navy/gold/ivory, display 15–22px so very bold
silhouettes). Files: `apps/client/public/assets/ui/kw_<id>.webp`. Fallback chain already
works (`status_*` → `seal`), so these are pure upgrades. Motifs:

| `kw_<id>` | Icon motif |
|-----------|-----------|
| tich_tu | a filling jade vessel / stacking rings |
| lien_hoan | two echoing slash arcs |
| toa_nguyet | chained crescent |
| doat_nguyet | crescent being drawn into a hand |
| duong_nguyet | moon-flower bud |
| phan_huyet | blood-drop igniting |
| du_sinh | overflowing heart/vial |
| tu_duoc | medicine gourd |
| chiem_bai | fanned oracle cards / eye over cards |
| an_than | cloaked eye / dissolving figure |
| khieu_khich | war drum / pointing gauntlet |
| ho_ve | raised shield |
| suy_yeu | downward cracked arrow |
| de_vo | cracked porcelain plate |
| danh_dau | vermilion target mark |
| thieu_dot | flame drop |
| hoi_phuc | leaf + plus |
| suc_manh | flexed gauntlet |
| cuong_hoa | blade with spark |
| dong_bang | snowflake crystal |
| phan_don | mirrored hex barrier |
| huyet_nguyet | blood moon disc |
| me_hoac | spiral eye / fox-eye |
| phong_an | paper talisman over sigil |
| hoi_hon | rising soul moth |
| linh_thu | spirit paw / beast silhouette |
| keo_dai | stretching hourglass |
