# UI rules

These rules apply to every UI change and every state, including selected, disabled, loading, empty, error, narrow viewport and popup.

1. Preserve each image's original aspect ratio. Show the entire image inside its border. Use contain sizing and fit the visible border to the displayed image, with at most one pixel of inner spacing per side. Do not crop, stretch or cover-fit. Names, stats, labels and controls may appear over artwork; keep them readable and keep any unused layout space outside the image border.
2. Every button has rounded corners and a visible border in all states. Clickable artwork also has a visible border that hugs the image. Focus/selected styling supplements the border; it must not replace it with a borderless hit target.
3. Prefer recognizable existing icons to repeated action labels. Keep an explicit, complete accessible name for every icon control. Retain full wording for information an icon cannot communicate accurately.
4. Remove tooltips that merely repeat information already visible. Keep tooltips only when they add useful information, such as an explanation of a mechanic or the complete value/text otherwise unavailable.
5. Do not abbreviate player-facing terms. Write “Tinh Luyện”, “Cộng Minh”, “máu”, “hình trang bị” in full; do not use “TL”, “CM”, “HP” or “art”. Numeric levels/counts and mathematical symbols are allowed.
6. Verify the same rules for all item categories, owned/unowned/max-level/upgrade preview states, popups, keyboard/touch controls, and tested viewport sizes.
7. Newly generated artwork must match the existing artwork for its category. Inspect existing hero or item images and use them as direct visual style references in generation/editing. Match linework, face proportions, shading, palette, materials and background treatment; a generic anime prompt is insufficient. Keep the new subject's identity and lore, then compare the result beside the existing set before accepting it.

User instructions on 2026-10-12 and 2026-10-16 take precedence over earlier UI design proposals. The 2026-10-16 instruction permits text and controls over artwork; full-image sizing, tight borders, rounded bordered buttons, useful icons and complete wording still apply.
