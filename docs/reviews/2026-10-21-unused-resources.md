# Unused resource cleanup — 2026-10-21

Reviewed all 217 files in the client, server, rules and data `src` directories, plus client public assets, imports from tests/scripts, package entry points and asset export scripts. The `src` directories contain TypeScript, CSS and JSON; image assets live under `apps/client/public`.

## Removed

| File | Evidence |
| --- | --- |
| `apps/client/src/index.ts` | Empty `export {}` placeholder with no imports. The HTML entry point is `src/main.ts`. |
| `apps/client/src/ui/deck-builder-filter.ts` | `BuilderFilters` and `matchesBuilderCard` are referenced only by their own unit test. The current deck builder does not import or invoke them. |
| `apps/client/test/deck-builder-filter.test.ts` | Tests only the removed helper, with no application integration. |
| `apps/client/public/favicon-512.png` | No HTML, source, data or script reference. The page uses `favicon.ico`, `favicon.png` and `apple-touch-icon.png`. |
| `apps/client/public/assets/vfx/awakening_lunar_aura.webp` | No awakening profile or runtime effect uses this shared aura; roster-specific loading excludes it. The combat asset test mentions this name only in an in-memory fake manifest. Original generated PNGs at both paths in the generation record were verified to exist and remain untouched; that record is preserved under `retiredAssets`. |

The two unused public images total **1,842,960 bytes**. No active animation sheet, frame metadata, editable Aseprite source or reference image was changed.

## Retained after checking dynamic references

- Hero `_up` portraits and featured gacha banners use interpolated hero/banner IDs.
- Card `art_*`, keyword `kw_*`, status, intent, moon, rank and run-node icons use data-driven texture keys. For example, `status_strength` and `status_vulnerable` are used through `status_${event.status}`.
- Legacy awakening/combat images still provide supported legacy playback and loading fallbacks alongside the new motion library. Aseprite PNG/JSON pairs and source/reference files remain intact.
- All 41 equipment PNGs are original inputs to `scripts/optimize-equipment.py`; their WebP counterparts are the preferred runtime format. These originals are used by the asset workflow and were retained.
- Server development/export commands, package exports, tests and preview tools were treated as valid entry points. No other source module was found without a consumer in the import review.

## Validation

- `pnpm typecheck`: passed for all workspace packages/apps.
- `pnpm build`: client and server production builds passed. Confirmed both removed public images are absent from `dist`, while all three linked favicon/touch icons and active awakening images remain present.
- `git diff --check`: passed.
- `pnpm --filter client test`: 623 passed, 1 failed across 73 files. The initial sandbox run was blocked by Vitest temporary-cache rename permissions; the reported test results are from the rerun outside the sandbox.
- Remaining failure: `motion-library-assets.test.ts:51` expects the clock to cross frame 1 within one millisecond of the exported frame boundary. For `vfx:combat_attack_slash`, the existing clock returns `0.6696591343331845` at 52 milliseconds instead of at least `1`. Reproduced directly with Node using only the untouched `library-motion-clock.ts`, `motion-library-data.json` and `motion-library-audit.json`. The exported frame durations assume a different progression from the Hermite clock; this discrepancy is independent of the removed resources and was left outside this cleanup.
