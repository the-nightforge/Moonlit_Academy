# Home & Rank Assets — `backgrounds:home`, `ui:mode_*`, `ui:rank_*`

Art for the home screen (`apps/client/src/scenes/deck-select-scene.ts`) and the
rank emblem row shown above the selected deck's heroes. Files land in
`apps/client/public/assets/` and resolve as `<dir>:<stem>` through
`assetsManifest()` — same convention as `cards:*`, `heroes:*`, `ui:*`.

## `backgrounds/home.webp` — home screen backdrop

- Display: full-screen cover under the 1280×720 design space, darkened at the
  edges so UI text stays readable (gradient is baked in code — do NOT bake a
  vignette into the art).
- Source: **16:9 landscape, ≥ 1600×900** (WebP).
- Composition: quiet, atmospheric library/motif — the home screen is a menu, so
  the art should read as *place*, not action. Keep the **left third calmer**
  (the mode tiles sit there) and let any focal subject lean right, where the
  hero portraits overlay.
- Style target: same gufeng/anime look as `backgrounds/background.webp` and the
  hero set — deep navy night, warm antique gold, ivory, jewel accents.

```
Asset: full-screen menu backdrop for the Vietnamese anime fantasy card game
Vong Nguyet — the interior of a moonlit library-pavilion at night: towering
shelves of silk-bound scrolls, a round moon gate window showing a huge silver
moon, drifting paper lanterns, motes of gold dust. Authentic polished 2D anime
fantasy illustration, cel-shaded with rich color planes and glowing rim light;
palette of deep navy night, warm antique gold, ivory, faint jade accents.
Composition: calm left third for menu UI, the moon gate focal point slightly
right of center; lower half falls into readable shadow. Landscape 16:9.
No text, letters, watermarks, UI elements, borders; no realistic photography,
no 3D render look. Export WebP.
```

## `ui:mode_*` — mode tile icons (4)

96×96 display at ~48px logical size on the mode tiles, gold-on-navy UI-icon
style matching `ui:nav_*` / `ui:seal` / `ui:bolt`. Transparent background,
single glyph, no baked text.

| Key | Mode | Glyph |
|-----|------|-------|
| `ui:mode_arena` | Đấu Trường (PvP) | crossed ornate polearms over a small moon-disc arena crest |
| `ui:mode_run` | Tầm Nguyệt (roguelike run) | a winding path of moon-phase stones leading to a crescent moon |
| `ui:mode_coop` | Liên Thủ (co-op) | two interlocked jade rings / two linked silhouettes under one moon |
| `ui:mode_story` | Cốt Truyện (story) | an open scroll book with a crescent seal on the page |

```
Asset: one UI glyph icon for the Vietnamese anime fantasy card game Vong
Nguyet. Subject: <SUBJECT>. Flat vector-like emblem, gold and ivory on
transparent, subtle indigo shadow detail, readable at 48px. Chinese fantasy
elegance, ornate but iconic — single centered motif. No text, letters,
watermarks, borders, background plate. Export PNG/WebP with alpha, 512×512.
```

## `ui:rank_*` — ranked tier emblems (5)

Shown at ~96px above the hero trio on home and beside the rating on the arena
screen (`arena-scene.ts` can adopt them later). Heraldic badge shape, gold on
navy, distinct silhouette per tier — ladder from simple to ornate.

| Key | Tier (from `packages/data/pvp-config.json`) | Glyph |
|-----|----------------------------------------------|-------|
| `ui:rank_dong_sinh` | Đồng Sinh (0+) | plain bronze open book on a round badge — the student |
| `ui:rank_tu_tai` | Tú Tài (1100+) | bronze book + a budding branch — first laurels |
| `ui:rank_cu_nhan` | Cử Nhân (1250+) | silver book + ink brush crossed behind |
| `ui:rank_tien_si` | Tiến Sĩ (1400+) | gold book under a small crescent crown |
| `ui:rank_trang_nguyen` | Trạng Nguyên (1600+) | radiant gold book under a full moon, laurel wreath |

```
Asset: one ranked-tier emblem for the Vietnamese anime fantasy card game Vong
Nguyet — imperial-examination hierarchy. Subject: <SUBJECT>. Heraldic badge,
metallic <METAL> on deep navy enamel, crisp silhouette readable at 64px,
Chinese fantasy elegance. Single centered emblem on transparent background.
No text, letters, watermarks. Export PNG/WebP with alpha, 512×512.
```

Metal ramps: `dong_sinh`/`tu_tai` bronze → `cu_nhan` silver → `tien_si` gold →
`trang_nguyen` radiant gold + moon-white halo.
