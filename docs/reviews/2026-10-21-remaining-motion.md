# Remaining combat animation pass

Scope: the remaining 13 attack illustrations, 12 support effects and 24 hero awakenings. The approved bow, ribbon and Lam Khê sources, timing and presentation are preserved.

Each animation keeps its own illustrated source. Aseprite exports exact full-canvas frame rectangles, one presentation slice, an editable source and a checked timeline. The runtime blends neighboring source images in premultiplied color, moves the whole illustration without changing its aspect ratio and samples one elapsed-time clock for the effect, actor pose and impact or portrait refresh.

The new library uses monotone Hermite frame progression: preparation and recovery share the same tangent at the peak, and progression eases at both ends. Opacity uses a quintic envelope. Normal playback lasts 1.6 times the original duration. Double speed divides that one clock once. Reduced motion keeps one hero-specific peak image with fades, and awakening remains 180 milliseconds. A missing or invalid optional export falls back to its original effect.

The preview offers all attacks, support effects and heroes, with the three accepted samples still listed first. It loads only the selected illustrations and reports actual source-frame counts and timings. The remaining sources contain eight authored cels each; continuous blending is not additional authored frames or a measured browser frame rate.

Source-grid overlap is audited separately from padding and export integrity. All 49 sources were recovered into editable documents with all nonzero source RGBA pixels retained exactly once. Aseprite reopened and checked 54,995,646 source pixels and recovered 78,575 visible spill pixels beyond nominal source cells. Physical features were aligned only where an inspected rigid landmark justified a translation; organic cloth, foliage and expansion retain their authored motion.

Twelve corrected source sheets were generated using the original illustrations as direct references. One additional reflect candidate was rejected for joined solid motifs; all originals and candidates remain available. Full prompts, accepted/rejected status and hashes are in `docs/assets/motion-library-replacements.json`. The final recovery audit contains no strong source-sheet outer-edge contacts. Fifteen retained original sheets still have weak glow touching the original image boundary; those source limitations are recorded explicitly rather than described as restored artwork.

Final validation: all 49 editable documents and PNG/JSON sheets exported and reimported with matching pixels and phase durations. A second export preserved all 147 file hashes. All nine final galleries were visually inspected, including first, peak, last and neighboring cels. The client suite passed 625 tests across 73 files; type checking, production build and whitespace checks passed. This includes exact Aseprite rectangles/pivots, source provenance, timing at normal/double speed, exact-once impact/refresh, optional-asset fallback, cancellation cleanup and reduced-motion behavior. The build retains its existing large-chunk warning.

Browser automation is unavailable in this session. Static Aseprite inspection, native Phaser frame tests and playback lifecycle tests establish framing and synchronization; they do not measure live browser frame rate or establish equivalence to a commercial 3D game.
