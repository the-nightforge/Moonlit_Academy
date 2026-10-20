# Aseprite animation workflow

Use the installed Aseprite application for frame alignment and sprite sheet exports. The local executable is `C:\Users\Hienq\AppData\Local\Programs\Aseprite\aseprite.exe` (1.3.18.6-dev); other machines can set `ASEPRITE_PATH`.

## Current three samples

Run `./scripts/assets/export-motion.ps1` from PowerShell. It executes `export-motion.lua` inside Aseprite in batch mode, checks the exit code and verifies output files. Normally it exports the existing editable sources in `art/animations/`, preserving saved art edits. When a source is absent, the script imports the accepted illustrated source cuts and normalizes them onto one unscaled canvas per animation. Original generated sheets remain in `art/animations/references/`; their original layouts, prompts and hashes remain in `layered-motion-generated.json`. `-RebuildFromReferences` explicitly discards editable changes and reconstructs all three sources from those references; use it only when intentionally rebuilding.

Game exports are PNG sheets and Aseprite JSON under `apps/client/public/assets/vfx/`. Frame rectangles come from that JSON. No per-frame trimming, packing rotation, duplicate removal or bounding-box recentering is permitted. Do not estimate fractional grid cuts again at runtime. Full frame dimensions and the physical anchor stay consistent, including transparent padding. Bow uses its exported `arrowhead` slice pivot; other samples use the canvas center. Do not change the motion's intended direction: the right-authored attack illustration rotates toward the actual target in combat.

The Aseprite timeline contains Preparation, Impact and Recovery tags. Normal durations are 1024 milliseconds for bow, 1328 for ribbon and 832 for Lam Khê awakening. The peak begins at 496, 544 and 208 milliseconds respectively. Integer frame durations retain these milestones and total durations; the terminal source frame has a one-millisecond editor hold. The game still samples its continuous shared clock so secondary layers, movement and the gameplay callback remain synchronized. Combat double speed is applied once by the runtime. Legacy and reduced-motion timing remain unchanged.

## Alignment and verification

1. Inspect first, peak, last and neighboring frames at a fixed canvas size and anchor; use onion skinning in Aseprite when adjusting cels. Effects intentionally change shape; bounding-box centers alone do not justify shifting them independently.
2. Check transparent padding and visible bounds. Export fails if any frame is empty or a boundary has alpha 16 or higher. Do not erase visible tips to make a boundary check pass; correct the source framing or obtain corrected art.
3. Export with no trim, rotation or duplicate merge. Reimport each exported cell and reopen the saved `.aseprite`; compare image pixels, canvas dimensions, frame count and durations. Save the audit to `aseprite-motion-audit.json` and SHA-256 output hashes to `aseprite-motion-files.json`. Timing edits require changing the game's shared clock and the export timings together; export rejects a mismatch.
4. Inspect exported sheets visually and run client asset/native-frame/playback tests. Check vertical and diagonal directions, one impact or portrait refresh, normal/double speed, reduced motion and cancellation cleanup.
5. Recheck the production animation preview after integration. A static sheet establishes framing, not real-time smoothness or frame rate.

Aseprite export/API references: [command-line interface](https://www.aseprite.org/docs/cli/), [ExportSpriteSheet](https://www.aseprite.org/api/command/ExportSpriteSheet), [image operations](https://www.aseprite.org/api/image).

## Straight, stabilized bow

The former source placed the same arrowhead feature between x=287–296 and y=114–140 in its 308 × 256 cels. `scripts/assets/stabilize-bow.lua` aligns that physical feature, pads to 317 × 282 without cutting the original cel, and separates a fixed illustrated shaft/head from the changing feathers/wake. The previous editable document remains in `art/animations/references/combat_attack_bow_flow-before-stabilization.aseprite`. The aligned head pivot is (296, 140), exported as an Aseprite slice. Normal exports preserve the saved document; a reference rebuild also runs the stabilization step automatically.

The export audit compares the rigid region pixel-for-pixel across all 20 cels. The game blends the aligned cells using premultiplied artwork compositing, so the identical rigid region stays sharp while the feathers/wake transition continuously between source images. This remains 20 authored source frames, not a claim of 60 new illustrated frames or measured 60-frame-per-second playback. Reduced motion keeps its single peak image. The arrow's path and wake axis are straight, rotation and size stay constant, and the head pivot meets the target at the single impact callback. Shorter preparation gives the flight more of the same 1024-millisecond total duration.

## Applied on October 20, 2026

All 60 frames were checked in Aseprite batch mode, exported and reimported, and their saved editable documents were reopened with matching pixels and frame durations. A second export used the saved documents without rebuilding or changing them. The three exported sheets were visually inspected. Native Phaser tests confirm a stable center origin/size and exact exported source rectangles. The client suite passed 526 tests across 71 files; type checking and the production build passed. The preview page and all three PNG assets returned HTTP 200. Live browser playback was not re-recorded in this pass.
