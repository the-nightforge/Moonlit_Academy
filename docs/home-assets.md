# Home & Rank Assets — `backgrounds:home`, `ui:mode_*`, `ui:rank_*`

Art for the home screen (`apps/client/src/scenes/deck-select-scene.ts`) and the
rank emblem shown inside the Home Arena tile. Files land in
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

48px display on primary mode tiles, 38px on compact tiles, gold-on-navy UI-icon
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

Shown at 76px beside the rating inside the Home Arena tile. The arena
screen (`arena-scene.ts`) can adopt them later. Heraldic badge shape, gold on
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

## P1 generation record — 2026-10-10

Generated with the built-in **imagegen** tool, one image per asset. Existing
`backgrounds/background.webp` (background) and `ui/nav_history.webp` (icons)
were inspected and used as **style references**, not edit targets. The final
prompt set below preserves the anime/cel-shaded palette and prohibits text,
watermarks and photorealistic rendering.

Final locations: `apps/client/public/assets/backgrounds/home.webp` and the
nine `mode_*` / `rank_*` WebP files named above in `apps/client/public/assets/ui/`.
The background is 1600×900 RGB; icons are 512×512 RGBA. Export uses WebP quality
94 for the background and 96 for icons, preserving generated alpha. Only
final raster files go into public assets; generation sources stay in Codex's
generated-images folder. No old asset is replaced.

The Home hierarchy iteration places rank text on the Arena tile's dark panel;
the selected-team heading keeps a navy outline over the bright moon. The
existing manifest keys and fallback selection remain in use. Arena-scene
adoption of the rank emblems remains a separate task.

### Final prompts

<details>
<summary>backgrounds/home.webp</summary>

```text
Create one brand-new full-screen menu backdrop for Vong Nguyet, polished 2D Chinese fantasy anime/gufeng illustration. The referenced image is STYLE AND PALETTE REFERENCE ONLY, not an edit target: match its clean cel-painted shapes, deep sapphire/navy night, antique gold lantern accents and ivory moon glow, never photorealistic or 3D. New scene: quiet moonlit library pavilion with tall silk scroll shelves, carved wood, an enormous silver moon visible through a round moon gate slightly right of center (around 65% image width), a few warm hanging paper lanterns and restrained gold dust. Calm dark left third with little detail for menu tiles, lower half naturally shadowed; rich luminous blue at the right focal point. No characters. No decorative image frame, no UI, no text, no writing on books or scrolls, no watermark, no baked vignette. Wide landscape 16:9, at least 1600x900, full bleed detailed anime environment painting.
```

</details>

<details>
<summary>ui/mode_arena.webp</summary>

```text
Generate ONE NEW transparent UI icon for anime gufeng fantasy game Vong Nguyet. The reference is STYLE REFERENCE ONLY, not edit target. Match its polished 2D cel-shaded raster anime icon look, bold dark-indigo outlines, warm antique gold, ivory and slight jade. Subject: Four-mode menu glyph: two crossed ornate GOLD polearms, simple spear and crescent halberd over a SMALL ivory moon disc. Compact X silhouette. Centered single glyph filling about 80% of a square 512x512 canvas with transparent padding. Clear broad shapes readable at 48 pixels; restrained ornament, simple highlight planes, NO photorealism, NO realistic metal or 3D, NO background plate or framed badge. Outside glyph entirely transparent alpha. No text, letters, numbers, watermark, UI panel, floor, cast shadow or background glow. Deliver one icon only.
```

</details>

<details>
<summary>ui/mode_run.webp</summary>

```text
Generate ONE NEW transparent UI icon for anime gufeng fantasy game Vong Nguyet. The reference is STYLE REFERENCE ONLY, not edit target. Match its polished 2D cel-shaded raster anime icon look, bold dark-indigo outlines, warm antique gold, ivory and slight jade. Subject: Four-mode menu glyph: a winding upward path of FOUR large moon-phase stepping stones leading to ONE large golden crescent at top. Distinct S-shaped silhouette, not an emblem badge. Centered single glyph filling about 80% of a square 512x512 canvas with transparent padding. Clear broad shapes readable at 48 pixels; restrained ornament, simple highlight planes, NO photorealism, NO realistic metal or 3D, NO background plate or framed badge. Outside glyph entirely transparent alpha. No text, letters, numbers, watermark, UI panel, floor, cast shadow or background glow. Deliver one icon only.
```

</details>

<details>
<summary>ui/mode_coop.webp</summary>

```text
Generate ONE NEW transparent UI icon for anime gufeng fantasy game Vong Nguyet. The reference is STYLE REFERENCE ONLY, not edit target. Match its polished 2D cel-shaded raster anime icon look, bold dark-indigo outlines, warm antique gold, ivory and slight jade. Subject: Four-mode menu glyph: TWO thick interlocked jade rings beneath ONE ivory crescent moon, golden ring edges. The TWO clearly visible rings must dominate silhouette. Centered single glyph filling about 80% of a square 512x512 canvas with transparent padding. Clear broad shapes readable at 48 pixels; restrained ornament, simple highlight planes, NO photorealism, NO realistic metal or 3D, NO background plate or framed badge. Outside glyph entirely transparent alpha. No text, letters, numbers, watermark, UI panel, floor, cast shadow or background glow. Deliver one icon only.
```

</details>

<details>
<summary>ui/mode_story.webp</summary>

```text
Generate ONE NEW transparent UI icon for anime gufeng fantasy game Vong Nguyet. The reference is STYLE REFERENCE ONLY, not edit target. Match its polished 2D cel-shaded raster anime icon look, bold dark-indigo outlines, warm antique gold, ivory and slight jade. Subject: Four-mode menu glyph: ONE open ivory scroll-book with rolled ends and antique gold edges, ONE crescent seal in the middle. Blank pages, no writing. Centered single glyph filling about 80% of a square 512x512 canvas with transparent padding. Clear broad shapes readable at 48 pixels; restrained ornament, simple highlight planes, NO photorealism, NO realistic metal or 3D, NO background plate or framed badge. Outside glyph entirely transparent alpha. No text, letters, numbers, watermark, UI panel, floor, cast shadow or background glow. Deliver one icon only.
```

</details>

<details>
<summary>ui/rank_dong_sinh.webp</summary>

```text
Generate ONE NEW rank emblem for anime/gufeng fantasy card game Vong Nguyet imperial-examination hierarchy. Reference is STYLE REFERENCE ONLY not edit target. Match polished 2D CEL-SHADED anime illustration, confident bold indigo outlines, simple clean highlight planes. Subject: SIMPLE BRONZE open blank book on a small round deep-navy enamel medallion; NO crown or branches. Plain circular silhouette, novice rank. Metallic bronze represented with graphic cel-shading, NOT photorealistic metal, not 3D render. SINGLE centered heraldic badge filling 82% of square 512x512 canvas, consistent top-front view. Navy enamel only INSIDE the badge; outside completely transparent alpha. Strong broad silhouette and large blank book readable at 76px. Restrained ornament, minimal tiny detail. No text, letters, numbers, writing, watermark, frame around canvas, UI, floor, cast shadow, external glow. One emblem only.
```

</details>

<details>
<summary>ui/rank_tu_tai.webp</summary>

```text
Generate ONE NEW rank emblem for anime/gufeng fantasy card game Vong Nguyet imperial-examination hierarchy. Reference is STYLE REFERENCE ONLY not edit target. Match polished 2D CEL-SHADED anime illustration, confident bold indigo outlines, simple clean highlight planes. Subject: BRONZE open blank book on a round deep-navy enamel medallion with TWO small budding branches growing upward at sides. Budding leaf silhouette, restrained junior rank. Metallic bronze represented with graphic cel-shading, NOT photorealistic metal, not 3D render. SINGLE centered heraldic badge filling 82% of square 512x512 canvas, consistent top-front view. Navy enamel only INSIDE the badge; outside completely transparent alpha. Strong broad silhouette and large blank book readable at 76px. Restrained ornament, minimal tiny detail. No text, letters, numbers, writing, watermark, frame around canvas, UI, floor, cast shadow, external glow. One emblem only.
```

</details>

<details>
<summary>ui/rank_cu_nhan.webp</summary>

```text
Generate ONE NEW rank emblem for anime/gufeng fantasy card game Vong Nguyet imperial-examination hierarchy. Reference is STYLE REFERENCE ONLY not edit target. Match polished 2D CEL-SHADED anime illustration, confident bold indigo outlines, simple clean highlight planes. Subject: SILVER open blank book on a deep-navy enamel diamond-shaped badge, TWO large SILVER ink brushes crossed behind the book, clearly visible brush tips. Crisp X / diamond silhouette, scholar rank. Metallic silver represented with graphic cel-shading, NOT photorealistic metal, not 3D render. SINGLE centered heraldic badge filling 82% of square 512x512 canvas, consistent top-front view. Navy enamel only INSIDE the badge; outside completely transparent alpha. Strong broad silhouette and large blank book readable at 76px. Restrained ornament, minimal tiny detail. No text, letters, numbers, writing, watermark, frame around canvas, UI, floor, cast shadow, external glow. One emblem only.
```

</details>

<details>
<summary>ui/rank_tien_si.webp</summary>

```text
Generate ONE NEW rank emblem for anime/gufeng fantasy card game Vong Nguyet imperial-examination hierarchy. Reference is STYLE REFERENCE ONLY not edit target. Match polished 2D CEL-SHADED anime illustration, confident bold indigo outlines, simple clean highlight planes. Subject: GOLD open blank book on a deep-navy enamel shield, SMALL ivory crescent moon crown above, upward golden ornamental shoulder wings. No laurel wreath or full moon. Shield and crescent silhouette, advanced rank. Metallic gold represented with graphic cel-shading, NOT photorealistic metal, not 3D render. SINGLE centered heraldic badge filling 82% of square 512x512 canvas, consistent top-front view. Navy enamel only INSIDE the badge; outside completely transparent alpha. Strong broad silhouette and large blank book readable at 76px. Restrained ornament, minimal tiny detail. No text, letters, numbers, writing, watermark, frame around canvas, UI, floor, cast shadow, external glow. One emblem only.
```

</details>

<details>
<summary>ui/rank_trang_nguyen.webp</summary>

```text
Generate ONE NEW rank emblem for anime/gufeng fantasy card game Vong Nguyet imperial-examination hierarchy. Reference is STYLE REFERENCE ONLY not edit target. Match polished 2D CEL-SHADED anime illustration, confident bold indigo outlines, simple clean highlight planes. Subject: RADIANT GOLD open blank book on deep-navy enamel ceremonial badge beneath ONE LARGE ivory FULL MOON, symmetrical golden LAUREL WREATH at sides, small star rays. Grandest rounded laurel silhouette, supreme rank. Metallic radiant gold represented with graphic cel-shading, NOT photorealistic metal, not 3D render. SINGLE centered heraldic badge filling 82% of square 512x512 canvas, consistent top-front view. Navy enamel only INSIDE the badge; outside completely transparent alpha. Strong broad silhouette and large blank book readable at 76px. Restrained ornament, minimal tiny detail. No text, letters, numbers, writing, watermark, frame around canvas, UI, floor, cast shadow, external glow. One emblem only.
```

</details>

## Verification — 2026-10-10

- `pnpm --filter client build`: exit 0 (existing large-bundle warning).
- `pnpm --filter client typecheck`: exit 0.
- `pnpm --filter client exec playwright test e2e/home.spec.ts --grep "home art" --workers=1`: **5/5 PASS**, 51.3 s, zero skips. Covers three viewport sizes, all five rank textures, and blocked-new-file fallback with no JavaScript errors.
- First viewport test failed before integration because the new texture keys were absent; it passed after delivery.
- Inspected three final Home screenshots and the navy contact sheet at 48px mode / 76px rank. No baked text/watermarks; distinct silhouettes remain visible.
- Local evidence (ignored scratch): `output/home-art/e2e-home-art.log`, `validation.json` (dimensions/alpha/SHA-256/source mapping), and `previews/` (three Home captures + icon/rank contact sheet).

| Final file under `public/assets/` | Dimensions | Format | Size (bytes) |
| --- | --- | --- | --- |
| `backgrounds/home.webp` | 1600×900 | RGB WebP | 469340 |
| `ui/mode_arena.webp` | 512×512 | RGBA WebP | 71916 |
| `ui/mode_run.webp` | 512×512 | RGBA WebP | 63218 |
| `ui/mode_coop.webp` | 512×512 | RGBA WebP | 81772 |
| `ui/mode_story.webp` | 512×512 | RGBA WebP | 78082 |
| `ui/rank_dong_sinh.webp` | 512×512 | RGBA WebP | 69898 |
| `ui/rank_tu_tai.webp` | 512×512 | RGBA WebP | 76998 |
| `ui/rank_cu_nhan.webp` | 512×512 | RGBA WebP | 79384 |
| `ui/rank_tien_si.webp` | 512×512 | RGBA WebP | 84640 |
| `ui/rank_trang_nguyen.webp` | 512×512 | RGBA WebP | 95256 |

Total new payload: **1,170,504 bytes** (~1.12 MiB). Runtime selection uses the existing Home manifest/fallback paths; no asset-loader or game-rule changes.
