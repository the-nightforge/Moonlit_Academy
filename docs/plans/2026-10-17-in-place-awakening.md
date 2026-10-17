# Approved in-place awakening

User approved the illustrated sample on 2026-10-17: animation on the hero card,
no introduction, modal, text, fullscreen dim or camera shake. Use the generated
bronze gate, omen pages and lunar aura, with complete contained hero art.

1. Replace the production awakening panel with a 120 + 160 + 240 millisecond
   in-place transition. Reduced motion uses fades for 60 + 100 + 20 milliseconds.
   Both respect the existing runtime speed and abort lifecycle.
2. Apply the authoritative presentation event once at the end of charge. Keep
   the old portrait beneath the refreshed card's badges during the blend;
   never keep manipulating an image destroyed by the renderer.
3. Preload the common aura and roster-specific motifs for both public sides.
   Missing artwork skips optional effects and still advances presentation.
4. Make the manual preview use the production helper; verify all hero choices,
   both speeds, reduced motion and cancellation. Run client checks and request
   one fresh-context review before committing the scoped change on main.

Ruling: Work directly on main as previously authorized. Preserve the unrelated
cards.json and pvp-config.json edits. The asset-based sample is the accepted
visual specification; no new design approval is required.

Progress: complete. In-place renderer, event integration, roster preload and shared
preview implemented. Regression contracts observed failing before replacement;
focused checks pass, full client suite 60 files / 438 tests passes, typecheck
and production build pass. Existing large bundle warning remains. Independent
fresh-context review approved with no scoped findings. Native preview visually
checked for m12/f13/Hoắc Liệt, double speed, reduced motion and cancellation.
No full live server match or low-end device benchmark was performed.

Follow-up approved: the user requires one illustration AND distinct motion for
each hero, not a tinted generic aura. Implemented all 25 profiles, retaining
m12/f13 and generating 23 dedicated assets against their own portrait references.
Per-hero phases still total 520 milliseconds; reduced motion retains the unique
illustration with 180 milliseconds of fades. Art layers are inserted under the
unit HUD and detached safely across refresh. No generic fallback is used.
Final checks: 61 client test files / 443 tests, typecheck and build pass. Fresh
independent review approved without scoped findings. All 25 static compositions
were inspected; new live browser verification was blocked by webview connection.
