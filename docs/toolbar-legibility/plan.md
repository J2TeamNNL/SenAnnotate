# Plan

1. `attachTooltip` accepts `string | (() => string)`; read at show time.
2. `place()` takes its vertical anchor from `.toolbar-dock` when the trigger is inside one.
3. `toolbar.ts`: swap every button's `title:` for `attrs: { "aria-label": … }`, including the
   two dynamic labels in `applyCollapse`, then one loop attaching the tooltip to all eight.
4. Rewrite the `.tool[title^=…]` locators as `[aria-label^=…]` across the four test files.
5. `.toolbar-hint`: widen, clamp to the viewport, ellipsis. One line, deliberately.
6. Checks:
   - hovering a toolbar button names it (text asserted, not just visibility)
   - a toolbar tooltip clears the hint line, using the block's existing `clearsTheHint`
     helper with inspect mode on
7. Verify: `npm run typecheck`, full suite, upgrade check.

## Watch out

- The tooltip is one shared node, so a check that hovers must move the pointer away
  afterwards or the next block starts with a tooltip on screen.
- The Escape chain treats hover and focus tooltips differently — see
  `../escape-closes-cards/`, which is where that distinction was measured.
