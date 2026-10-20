# Three layered animation samples

Implements the approved first comparison pass on `main`: bow, ribbon, and Lam Khê's awakening. Existing styles and other heroes retain their previous presentation. This is an illustrated 2D improvement, not a claim of matching Genshin's character animation or attaining a measured 60 frames per second.

| Sample | Previous source frames | New source frames | Normal duration |
| --- | ---: | ---: | ---: |
| Bow / Hạ Chi | 8 | 20 | 1024 milliseconds |
| Ribbon / Lam Khê | 8 | 24 | 1328 milliseconds |
| Lam Khê awakening | 8 | 16 | 832 milliseconds |

On October 20, normal improved playback was lengthened by 60 percent following feedback that the motion felt smooth but too fast. One shared clock stretches all authored phases, secondary movement and impact/portrait-refresh milestones together. Combat double speed still halves these durations. Legacy comparison, missing-flow fallback and reduced-motion playback retain their previous timing. The preview displays the updated configured duration. The browser observations below were captured before this timing adjustment.

The ribbon and awakening samples play discrete authored in-between images. Bow now blends its Aseprite-aligned feather/wake frames around an identical rigid shaft/head, avoiding doubled arrowheads. Two independently delayed, moving illustrated layers give each sample secondary motion: ivory/jade air and gold feather fragments for bow; azure silk and crystalline petals for ribbon and the matching awakening. Main art, secondary layers, unit motion and the one gameplay impact use the same elapsed-time clock. The source art faces right; movement and rotation follow the actual source and target, including vertical combat. Bow's physical trajectory and wake axis are straight, with a fixed arrowhead pivot and constant size.

All source artwork was generated with the built-in image generation tool using the game's own f05/f06 hero images and matching effect images as direct references. Seven new WebP files total 5,643,476 bytes: three animation sheets with 60 distinct frames and four independently illustrated layers. The original assets remain available for comparison. [Full prompts, references, hashes, dimensions and frame inspection](../assets/layered-motion-generated.json) are preserved.

The generated grid anchors required framing offsets: bow (-20, 0), ribbon (10, 32), awakening (0, 0). On October 20 those offsets were applied offline in Aseprite. Bow was then stabilized using the arrowhead feature, which previously drifted by up to 26 pixels vertically, with a separate identical rigid shaft/head in each cel. Editable sources and original reference sheets live in `art/animations/`. The game loads the exported PNG sheets and uses Aseprite JSON frame rectangles directly; it no longer repeats fractional cuts or offset corrections at runtime. The bow sheet is 1585 × 1128 with 317 × 282 cells and an exported head pivot; ribbon is 1024 × 1536 with 256 × 256 cells; awakening is 1024 × 1536 with 256 × 384 cells. At the accepted frame boundaries, alpha is below 16 out of 255 (maximum 7), so strong illustrated tips do not end at a cut. Individual layer assets remain 768 × 512. The [Aseprite workflow](../assets/aseprite-workflow.md), [alignment/reimport audit](../assets/aseprite-motion-audit.json) and [file hashes](../assets/aseprite-motion-files.json) document the conversion.

Inspection galleries show source frames, not recorded real-time playback:

The October 20 bow correction passed **530 client tests across 71 files**, type checking and the production build. Tests cover straight upward/downward/diagonal flight, constant shaft rotation/scale, the exported head pivot, fractional-frame blending, one impact, cancellation and reduced motion. A cold Aseprite rebuild in a separate temporary folder reproduced all three accepted PNGs byte-for-byte. The navy-background inspection below shows bow's first, peak and last cels with the same rigid head/shaft; it establishes alignment and clean transparency, not real-time playback quality.

![Stabilized bow first, peak and last cels](assets/2026-10-20-bow-stable-core.png)

![Bow source frame inspection](assets/2026-10-19-combat_attack_bow_flow.jpg)
![Ribbon source frame inspection](assets/2026-10-19-combat_attack_ribbon_flow.jpg)
![Lam Khê awakening source frame inspection](assets/2026-10-19-awakening_f06_flow.jpg)

## Integration and comparison

`test/animation-preview.html` offers the three sample selections and **Bản mới / Bản trước**. Its displayed source count and duration reflect the selected mode, combat speed and slow-inspection setting. The canvas uses the production playback functions, full contained portraits and the real vertical arrangement. Normal production playback uses improved assets for these two attack styles and this one hero when available.

New source or layer failures do not block entering combat when the legacy source is available; the loader reports optional failures separately and counts only successfully loaded textures. Other failures remain mandatory. The production loader filters attack/layer assets by roster and equipped weapon style; the manual preview lazily loads and releases selected sample assets.

Reduced motion retains the dedicated peak picture and fades only, with no secondary layer travel. Lam Khê's awakening remains in place, without an introductory popup, title or camera shake. Its authoritative portrait refresh still occurs once, with temporary layers detached before replacing hero children. Cancellation restores poses and destroys every temporary image.

## Verification

- Final client suite: **514 tests across 70 files passed**.
- Client type checking and production build passed; the existing large JavaScript chunk warning remains.
- Asset inventory verifies seven file hashes, frame counts, unique cell hashes, transparency and accepted boundary alpha.
- Native Phaser Frame / Texture / Size / Origin tests verify shifted, rounded, clamped source rectangles and stable virtual image dimensions/origin across both source orientations.
- Regression tests cover first/peak/last frames, exact-once impact and refresh, up/down/diagonal attacks, old-mode fallback, optional loader failures, reduced motion, independent secondary motion, and cleanup before/after impact or refresh.

Native browser checks confirmed the new bow and ribbon complete with one gameplay impact, and Lam Khê's in-place awakening completes. The old comparison mode reports eight frames and also completes. A captured active awakening finished in 532 milliseconds; other runs experienced the same background frame-delivery limit as the prior preview session (bow 17,277 milliseconds, ribbon 25,216 milliseconds).

The new inspect-only final-run meter freezes on completion/error/abort, separately from the continuing idle/live meter. A frozen normal awakening sample measured 18 delivered frames over 12,115 milliseconds, mean frame gap 658.5 milliseconds / 95th percentile 1007.0 milliseconds, with synchronous frame work mean 1.4 milliseconds / maximum 4.4 milliseconds. An old-mode run measured 15,182 milliseconds and similar one-second delivery gaps. Reduced-motion awakening at double speed completed and reported the 90-millisecond configured duration; wall time was 2107 milliseconds under the same frame-delivery limitation. Cancelling the ribbon sample returned ready controls, displayed the cancellation result, and retained the same 26 loaded texture keys. These observations do not establish a sustained 60 frames per second. Frame-work measurements are synchronous CPU observations, not GPU or mobile performance benchmarks.

The screenshots preserve the browser's normal narrow viewport. The bow screenshot records slow inspection during the impact; the awakening screenshot records the completed in-place state. Neither still image proves animation smoothness.

![Bow sample during slow inspection](assets/2026-10-19-layered-bow-preview.png)
![Completed in-place awakening sample](assets/2026-10-19-layered-awakening-preview.png)
