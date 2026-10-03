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
| m09 | heroes/m09 | **missing** | Đoàn Lạc — prompt `docs/08-character-prompts.md` §M09 |
| m10 | heroes/m10 | **missing** | Chu Quyết — §M10 |
| f05 | heroes/f05 | **missing** | Hạ Chi — §F05 |
| f06 | heroes/f06 | **missing** | Lam Khê — §F06 |
| f07 | heroes/f07 | **missing** | Cố Uyển — §F07 |
| f08 | heroes/f08 | **missing** | Phượng Chiêu Dung — §F08 |
| f09 | heroes/f09 | **missing** | Tiểu Mãn — §F09 |

## Hero awakened — `public/assets/heroes/{id}_up`

All 20 IDs (m01–m10, f01–f10): **missing**. One shared `_up` art per hero covers base/alt forms; add
motif/lore over the normal art while keeping identity, palette and facing.

## Enemies — `public/assets/enemies/{id}`

All 15 IDs **missing**: puppet_guard, shadow_fox, moon_ape, book_wraith, black_guard, fox_king,
eclipse_lord, thanh_loan_thi_quan, huyen_vu_thi_quan, bach_lo_thi_quan, khao_hach_chi_linh,
hac_y_mat_tham, vo_nguyet_am_sat, vo_nguyet_nghi_si, vo_nguyet_anh_chu. Designs follow the actual
enemy data (name, faction, intents), not invented lore.

## Summons — `public/assets/summons/{id}`

| ID | Path | Status |
|----|------|--------|
| tho_ngoc | summons/tho_ngoc | **missing** |
| tho_ngoc_thuc_tinh | summons/tho_ngoc_thuc_tinh | **missing** (awakened form of tho_ngoc) |

## Blocker

U5 Step 3 requires an image-generation/editing tool. None is installed in this environment — the
character prompts target an external generator (Leonardo.AI) which the CLI cannot drive. Per the plan
("giữ task chưa hoàn thành và ghi đúng blocker, không coi silhouette là đủ U5") the inventory stays
open: `apps/client/test/combat-assets.test.ts` marks the four missing-asset assertions `it.fails` —
they flip to XPASS when the files land, at which point `.fails` must be removed.

**Remaining to close U5:** 7 hero normals + 20 `_up` + 15 enemies + 2 summons = 44 files
(m06–m08 normals already exist at 784×1176, satisfying the 2:3 ≥768×1152 bar).

## QA checklist (Step 4, once art lands)

- [ ] `pnpm --filter client exec vitest run test/combat-assets.test.ts` green with `.fails` removed.
- [ ] `pnpm --filter client build` — no texture load errors.
- [ ] Contact sheet + per-asset crop at 136×196, 100×148, 80×108 stored under
      `test-results/combat-visual/assets/`; faces/hands/weapons checked at game scale.
- [ ] Normal vs `_up` side-by-side — identity kept, motif upgraded.
- [ ] No leftover text in images, no texture-key collisions.
