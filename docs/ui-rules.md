# UI rules

These rules apply to every UI change and every state, including selected, disabled, loading, empty, error, narrow viewport and popup.

1. Preserve each image's original aspect ratio. Show the entire image inside its border. Use contain sizing with inner padding. Do not crop, stretch, cover-fit, or obscure any part with labels or controls. Keep image and text regions separate; use neutral space when aspect ratios differ.
2. Every button and clickable image has a visible border in all states. Focus/selected styling supplements the border; it must not replace it with a borderless hit target.
3. Prefer recognizable existing icons to repeated action labels. Keep an explicit, complete accessible name for every icon control. Retain full wording for information an icon cannot communicate accurately.
4. Remove tooltips that merely repeat information already visible. Keep tooltips only when they add useful information, such as an explanation of a mechanic or the complete value/text otherwise unavailable.
5. Do not abbreviate player-facing terms. Write “Tinh Luyện”, “Cộng Minh”, “máu”, “hình trang bị” in full; do not use “TL”, “CM”, “HP” or “art”. Numeric levels/counts and mathematical symbols are allowed.
6. Verify the same rules for all item categories, owned/unowned/max-level/upgrade preview states, popups, keyboard/touch controls, and tested viewport sizes.

User instruction on 2026-10-12 takes precedence over earlier UI design proposals that recommended cropping, full-bleed text over art, abbreviated tile levels, or redundant hover labels.
