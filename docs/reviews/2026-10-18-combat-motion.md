# Illustrated combat motion

Continues the approved awakening animation approach for attacks and combat effects. Work is on `main` as requested. This is a polished illustrated 2D pass, not a claim of matching a fully animated 3D production such as Honkai: Star Rail.

## Artwork and presentation

- Fifteen dedicated attack sheets: sword, spear, darts, bow, herbs, fan, ink, music, ribbon, fire, stars, moon, talismans, blood and spells.
- Twelve support sheets: hit, guard, healing, armor, broken armor, applying/removing statuses, death, Blood Moon, casting, moon phase change and reflection.
- Each sheet contains eight distinct transparent authored frames in a four-by-two layout. All twenty-seven sheets are 1536 × 1024, with 384 × 512 cells: 216 frames total.
- Three small authored utility textures replace generated glow/star/vignette surfaces. Total size of the thirty WebP files is 48,790,312 bytes. Lossless encoding preserves alpha.
- Generation used the game's existing hero and awakening images as direct references. Full prompts, references, original output paths, file hashes and per-cell validation are recorded in [combat-motion-generated.json](../assets/combat-motion-generated.json).

The contact sheets below show source frames in chronological order. They are artwork inspection sheets, not screenshots of running combat:

![Attack frames, first group](assets/2026-10-17-combat-frames-1.jpg)
![Attack and support frames, second group](assets/2026-10-17-combat-frames-2.jpg)
![Support frames, third group](assets/2026-10-17-combat-frames-3.jpg)

## Motion and integration

Attacks share one elapsed-time clock for frame interpolation, anticipation, movement, impact and recovery. Each style has its own timing and trajectory. The gameplay impact occurs once at its authored peak; the promise includes the visual tail. Cancellation restores owned poses and destroys temporary images without repeating gameplay events. Pose ownership prevents an old attack tail from overwriting a newer hit or death pose.

The preview uses the actual combat functions, with the player below and opponent above. Direction derives from the real source and target, so right-facing source artwork rotates upward, downward or diagonally as appropriate. Source atlas orientation is not the battlefield attack direction. Full hero portraits remain intact and uniformly contained inside close-fitting borders.

[Earlier vertical portrait layout check](assets/2026-10-17-vertical-combat-preview.png) records the portrait arrangement before this effect pass; it is not proof of the final effects in motion.

Adjacent authored frames are combined into a transparent offscreen surface and composited once onto the battlefield. Linear premultiplied RGBA blending avoids the opacity dip caused by overlapping two ordinary alpha-faded images, while preserving dark ink. The same correction applies to awakening sheets. This compositor draws existing images; it does not synthesize effect artwork.

Reduced-motion mode keeps the dedicated peak illustration at the target, fades it and disables attack travel, lunge and shake. The selected hero's awakening remains an in-place image change without an introduction or popup.

Combat loading selects attack styles from the public hero/enemy roster and equipped weapons, with spell, sword and summon-moon fallbacks. It does not eagerly load every attack sheet. Support effects remain shared by their gameplay category. This reduces loading but is not a measured mobile memory budget.

Legacy non-attack intent beams and flat trigger flashes also use authored status/armor/cast cues. Routine unit feedback changes the existing portrait's tint or Canvas opacity and restores the original state, including cancellation and overlapping cues. Event order and existing short holds remain intact.

## Verification and limits

Final verification after the legacy cue cleanup: **493 tests passed across 68 client test files**. Type checking and the production build passed. The build retains its existing warning about JavaScript chunks larger than 500 kB. A sandboxed test attempt could not rename Windows temporary cache files and ran no tests; rerunning outside that restriction produced the passing result above.

Tests cover all fifteen attack styles, exact-once impact, up/down/diagonal rotation, uniform sizing, reduced motion, cancellation before and after impact, competing pose ownership, cast cleanup, asset filtering, native Phaser timing and the native Canvas/WebGL blend configuration. The asset inventory checks the encoded sheets against their recorded hashes and distinct transparent cells.

During native preview checks, the in-app browser delivered roughly one frame per second even while idle: 1003–1004 ms between frames, with about 0.5–0.8 ms of synchronous frame work and a recorded maximum of 14.3 ms. The page reported itself visible and produced no console warnings/errors. It also failed screenshot capture. Phaser's large-gap smoothing explains why a short preview took 14–21 seconds, or about 92 seconds in slow inspection mode. A native timing probe reproduced approximately 98 seconds for a 640 ms tween at 0.2 speed with one delivered frame per second.

This evidence identifies frame delivery in this preview session as a constraint; it does not establish a device-wide frame-rate or GPU benchmark. Final real-time visual smoothness and mobile performance require an active rendering surface. No production timing was changed merely to compensate for the preview environment.

For repeatable diagnosis, `test/animation-preview.html?inspect=1` exposes DOM-visible frame interval and synchronous frame-work measurements. The ordinary preview hides these measurements.
