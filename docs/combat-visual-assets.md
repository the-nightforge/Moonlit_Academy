# Combat Visual Assets — Inventory

The U5 manifest for combat portraits (`docs/superpowers/plans/2026-10-03-combat-ui-layout-assets.md` Task U5).
Textures resolve as `${category}:${stem}` via `assetsManifest()` in `apps/client/vite.config.ts`, which scans
every subdir of `apps/client/public/assets` — one stem must map to exactly one file extension.

## Technical frame

- Hero/enemy portrait source: 2:3 ratio, ≥ 768×1152 PNG/WebP/JPEG; head and face inside the upper 2/3 crop zone.
- Summon source: square, ≥ 512×512; subject must not clip inside the 80×108 view.
- No baked-in text, labels, borders, mockup chrome or signatures.
- In-game slots: hero 136×196 / 100×148, summon 80×108 (rounded `coverImage` crop, cache key `key@WxH`).
- `{heroId}_up` is the shared awakened art for base/alt forms in this scope — frame and name distinguish the form.
- Style target: gufeng/anime consistent with the existing m01–m08, f01–f04, f10 set; faction colours, gold
  ornaments; awakened form adds motif/lore while keeping the identity (prompts: `docs/08-character-prompts.md`).

## Hero normals — `public/assets/heroes/{id}`

| ID | Path | Status | Source / notes |
|----|------|--------|----------------|
| m01 | heroes/m01.jpg | done | existing |
| m02 | heroes/m02.jpg | done | existing |
| m03 | heroes/m03.png | done | existing |
| m04 | heroes/m04.jpg | done | existing |
| m05 | heroes/m05.png | done | existing |
| m06 | heroes/m06.jpg | done | existing (784×1176) |
| m07 | heroes/m07.jpg | done | existing (784×1176) |
| m08 | heroes/m08.jpg | done | existing (784×1176) |
| f01 | heroes/f01.jpg | done | existing |
| f02 | heroes/f02.jpg | done | existing |
| f03 | heroes/f03.jpg | done | existing |
| f04 | heroes/f04.jpg | done | existing |
| f10 | heroes/f10.jpg | done | existing |
| m09 | heroes/m09.png | present | Đoàn Lạc — prompt `docs/08-character-prompts.md` §M09 |
| m10 | heroes/m10.png | present | Chu Quyết — §M10 |
| f05 | heroes/f05.png | present | Hạ Chi — §F05 |
| f06 | heroes/f06.png | present | Lam Khê — §F06 |
| f07 | heroes/f07.png | present | Cố Uyển — §F07 |
| f08 | heroes/f08.png | present | Phượng Chiêu Dung — §F08 |
| f09 | heroes/f09.png | present | Tiểu Mãn — §F09 |

## Hero awakened — `public/assets/heroes/{id}_up`

All 20 IDs (m01–m10, f01–f10): **present** as `heroes/{id}_up.png`. One shared `_up` art per hero
covers base/alt forms. Thirteen awakened portraits retain the existing normal hero identity;
the seven newly introduced heroes have matching anime normal/awakened pairs.

## Enemies — `public/assets/enemies/{id}`

All 15 IDs **present** as `enemies/{id}.png`: puppet_guard, shadow_fox, moon_ape, book_wraith, black_guard, fox_king,
eclipse_lord, thanh_loan_thi_quan, huyen_vu_thi_quan, bach_lo_thi_quan, khao_hach_chi_linh,
hac_y_mat_tham, vo_nguyet_am_sat, vo_nguyet_nghi_si, vo_nguyet_anh_chu. Designs follow the actual
enemy data (name, faction, intents), not invented lore.

## Summons — `public/assets/summons/{id}`

| ID | Path | Status |
|----|------|--------|
| tho_ngoc | summons/tho_ngoc.png | present |
| tho_ngoc_thuc_tinh | summons/tho_ngoc_thuc_tinh.png | present (awakened form of tho_ngoc) |

## Inventory and provenance — 2026-10-04

**57/57 required files are present**:20 hero normals +20 awakened portraits +15 enemies +2 summons.
The44 previously missing files were produced through the built-in image-generation tool. New
hero/enemy/summon designs were regenerated toward the existing Leonardo anime look after user feedback;
the13 awakened portraits based on existing normals were retained. m06–m08 original normals remain
untouched. No image-generation tool blocker remains.

Character prompt references: `docs/08-character-prompts.md`; enemy/summon prompts follow actual
definitions and established art references. Root records per-file generation prompts, references,
source/crop details and provenance in `docs/combat-generated-assets.json`. The44 generated files
were matched by SHA-256 to their native generation outputs. New hero/enemy sources are1024×1536;
summons are1254×1254. Existing normal portraits retain their original resolutions.

## QA checklist (Step 4)

- [x] `combat-assets.test.ts`:6 positive assertions green, `.fails` removed (`green-final-assets.log`).
- [x] Ordinary client/server build passes (`build-final.log`); browser texture QA is recorded separately.
- [x] Six contact sheets with136×196,100×148,80×108 centered covers stored under
      `apps/client/test-results/combat-art/`; faces, props and silhouettes inspected at game scale.
- [x] Normal vs `_up` side-by-side — identity retained and awakening motifs distinct.
- [x] No baked text seen in final images; positive inventory tests confirm no texture-key collisions.
- [x] Style comparison against original m04/f02 and overview of31 regenerated designs:
      `apps/client/test-results/combat-art/new-art-overview.png`.
