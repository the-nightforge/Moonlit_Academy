# Repository instructions

For all UI work, read and follow `docs/ui-rules.md`. These rules are explicit user requirements and apply to every visual state and image/control surface, including shared renderers.

## Animation assets: Aseprite

- Use Aseprite to inspect alignment, edit animation frame layout/timing, and export sprite sheets. On this Windows machine the executable is `C:\Users\Hienq\AppData\Local\Programs\Aseprite\aseprite.exe`; allow `ASEPRITE_PATH` to override it on other machines.
- Read `docs/assets/aseprite-workflow.md` before changing animation assets. Use the existing Lua/batch export workflow for repeatable operations; check the process exit code and output files.
- Keep editable `.aseprite` sources and original reference images. Export game-ready PNG sheets together with Aseprite JSON frame metadata; use that metadata for frame rectangles instead of estimating grid cuts.
- Verify frame count/order, canvas dimensions, a consistent anchor, transparent padding, uncropped visible artwork, and phase/frame durations. Preserve original aspect ratio and authored motion; do not independently center or scale every frame by its visible bounding box.
- Inspect exported frames visually, including first/peak/last and neighboring frames. Reimport exports and verify their pixels, frame metadata, exact-once impact/refresh callbacks, cancellation cleanup, normal/double speed, and reduced-motion behavior before claiming completion.
- Artwork remains illustrated in the established game style. Aseprite is the alignment/editing/export tool; do not redraw effects as rough programmatic geometry or convert this game's illustrations to pixel art.
