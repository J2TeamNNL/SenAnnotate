# Context

## Where the position comes from

`.highlight` is `position: fixed` at the element's viewport rect. `.highlight__label` is
`position: absolute; left: 0; top: -22px` inside it, so the label's viewport x is the
element's x, and it extends rightward for as far as its content needs — up to `max-width:
480px`. Nothing bounded that against the right edge.

The vertical axis was already handled: `buildLabel` sets `data-flip="true"` when
`rect.top < 26`, and CSS moves the label below the box. So the *shape* of the fix already
existed in the file; only the horizontal half was missing.

## Shift, not right-align

The obvious alternative is anchoring the label to the box's right edge (`right: 0; left:
auto`) when near the viewport edge. Rejected: a narrow element at the edge — an icon button,
say — has almost no width to anchor against, so the label still overflows. Shifting by exactly
the overflow keeps the label's left edge as close to the thing it names as the viewport allows,
which is the more useful position and is correct for any element width.

## Why measuring is affordable here

The clamp reads `element.offsetWidth`, which forces layout. That would matter if it ran at
pointermove frequency, and it does not: `showHighlights` only rebuilds the label when it is
called with one, and the point-mode hover path bails early when the hovered element has not
changed (`if (target === hoveredElement) return;`). So it is one read per hover change and per
scroll sync, not per mouse move.

The marquee preview path calls `showHighlights` without a label, so the drag — the one genuinely
hot path — does no measuring at all.

## The `max-width` term

`max-width: 480px` alone is wider than a narrow window, and no amount of shifting can bring a
label wider than the viewport fully into view. `min(480px, calc(100vw - 12px))` bounds it, and
the existing `overflow: hidden; text-overflow: ellipsis` then truncates rather than overflows.

## Proving it in one run

The check could pass vacuously — a label that never overflowed is also "inside the viewport".
So the assertion is paired: the label is inside **and** `style.left` is negative, meaning the
clamp engaged. A negative shift of *n* pixels is exactly the statement "without this, the
label was *n* pixels out", so a single run demonstrates both the bug and the fix without
needing a before-and-after build.

The left-edge case is asserted too, with the opposite expectation (`shift === 0`), so a fix
that over-corrects and pushes the label off the other side fails rather than passes.

The fixture needs no framework: `data-v-inspector` is read straight off the DOM by
`content/source.ts`, so a bare attribute produces a realistically long source line — and
therefore a wide label — on a plain HTML page.
