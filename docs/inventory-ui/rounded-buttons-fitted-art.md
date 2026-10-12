# Rounded buttons and fitted artwork

User correction, 2026-10-12: buttons must visibly round their corners; artwork borders must fit the displayed image without side gutters.

The canvas rectangles now use Phaser's native rounded geometry for shared buttons, tabs, inventory actions, selection/focus borders, hero controls and draggable scroll thumbs. Hover, selection and disabled fills retain the same rounded shape.

Image scaling still contains the complete source. The visible artwork border follows the fitted dimensions with one pixel of spacing on each side. The detail image's click target follows those dimensions too. Removed the extra fixed-size detail frame and hero artwork frame. Cached artwork leaves unused layout space transparent and draws its border against the image, while caption space remains separate.

Verification: regression tests first reproduced square canvas buttons and oversized image borders. Final checks:

- Full client suite: 308 tests passed in 37 files.
- 18 distinct browser cases passed across inventory, hero collection, deck previews and combat at widths 1280, 1024 and 900; includes WebGL and Canvas tooltip scrolling. Two initial scene-load timeouts passed on isolated rerun.
- Workspace typecheck and production build passed. The existing bundle-size warning remains.
- Reviewed the six updated screenshots for image fit, full-source visibility and rounded button borders.

The initial workspace-wide unit run was stopped while the rules simulations were still running; its data package completed 50 tests. The full client suite above is the completed unit verification for this UI correction. Logs remain under `.superpowers/sdd/2026-10-12-ui-rules`.
