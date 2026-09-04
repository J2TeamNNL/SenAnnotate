# Brief — the settings card follows the dragged toolbar

## What

The settings card is anchored to the toolbar's **current** position instead of the
bottom-right corner it used to be nailed to. Drag the pill to the middle of the page and
the card opens above the pill, right edges aligned, and tracks it for the rest of the
drag. The annotations panel deliberately does not move.

## Why

`draggable-toolbar/` made the pill go anywhere and left the cards behind. Both are
`position: fixed` at `right: 20px` with a `bottom` measured from the default dock, so a
pill dragged to the top-left of the page opens its own settings card in the opposite
corner — a control 900px away from the button that opened it, pointing at nothing.

That is worse than merely untidy. The card is *the pill's* panel: it has no header
saying which toolbar it belongs to, and on a page with a fixed footer or a right-hand
drawer — exactly the pages the drag exists for — the corner it flies back to is the one
the user moved the toolbar away from.

## Scope

In:

- The settings card anchored to the dock's box whenever the toolbar has been dragged:
  above it, gap 8px, right edges aligned, flipped below when there is no room above,
  clamped to the viewport on both axes.
- Following **live** through a drag, and through every other reason the dock moves —
  a window resize re-clamping it, collapsing or expanding the pill.
- The default corner unchanged. A toolbar that has never been dragged keeps the pure-CSS
  placement it has today, inline styles absent.

Out:

- **The annotations panel.** It is pinned top *and* bottom and reads as a page-level
  list rather than a popover off the pill; the request was explicitly for the settings
  card alone. See `context.md`.
- The composer, the markup editor and the toast. The composer is already anchored to the
  element it describes, which is the right anchor for it.
- Dragging the card itself, or remembering a position for it.

## Success criteria

- Pill dragged, card opened: the card's right edge is the dock's right edge and its
  bottom edge is 8px above the dock's top edge.
- The card keeps that relationship while the pill is dragged, not only after the drop.
- Pill near the top of the viewport: the card sits below it instead of off-screen.
- Pill back in its default corner: no inline `left`/`top` on the card at all — the CSS
  path is what runs, including the clearance for the inspect-mode hint line.
- The annotations panel is where it always was, with the pill anywhere.
