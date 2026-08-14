# Brief — drag the toolbar anywhere

## What

The pill can be dragged to any point in the viewport. The position is remembered
**per page**, keyed on `origin + pathname` like the annotations, and clamped back into
view on load and on resize. Any part of the pill is the handle, buttons included; a
press that travels past a small threshold moves the toolbar instead of activating
what it started on.

## Why

`toolbar-collapse/` fixed half of this problem: the dock sits at `bottom: 20px;
right: 20px`, which is where pages put chat widgets, cookie bars and footer actions,
so <kbd>H</kbd> shrinks it to a single handle.

That is enough when the toolbar is merely in the way. It is not enough when the
bottom-right corner is **the thing being reviewed** — the collapsed handle is still
there, still on top of the chat widget you are trying to annotate, and the one
gesture available (collapse) has already been spent.

Moving it is the answer that always works, and it also covers the cases collapsing
never addressed: a fixed footer, a right-hand drawer, a viewport where the composer
opens over the pill.

## Scope

In:

- Drag by any part of the pill, expanded or collapsed.
- The position stored per page in `chrome.storage.local`, under its own key prefix.
  Only pages that were actually customised get an entry.
- Clamping to the viewport with a margin, on drop, on load and on resize.
- The hint line flips below the pill when it is dragged near the top, where there
  is no room above it.

Out:

- A reset-to-default control. Clamping guarantees the pill is always on screen and
  therefore always draggable back; a button for it is a second way to do something
  the first way already does.
- Snapping to corners or edges. Free placement is simpler and no worse.
- Moving the panel or the composer. They are anchored to their own logic and neither
  is what covers the corner.
- A global position. It was the first design and was wrong — see `context.md`.

## Success criteria

- Clicking any toolbar button still works exactly as before — this is the risk, and
  a threshold that fires too eagerly breaks every button at once.
- A drag that ends over a button does not also press it.
- The pill cannot be dragged out of reach, including after the window is resized
  smaller than it was when the position was saved.
- A page never inherits a position dragged on a different page.
- Dragging never reaches the page: no modal dismissed, no marquee started, no focus
  moved. See `context.md` — this is the constraint that shaped the implementation.
