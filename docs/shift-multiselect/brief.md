# Brief — shift-click to select several

## What

In `point` mode, shift-clicking gathers elements into a pending selection instead of
opening the composer. <kbd>Enter</kbd> turns the set into one annotation;
<kbd>Esc</kbd> discards it. Shift-clicking an element already in the set removes it.

## Why

Multi-element annotation already exists, but only through the marquee — and a
rectangle can only express selections that happen to be rectangular. The cases that
send people back to writing four separate notes are exactly the ones a box cannot
draw: a label in one column and the input three columns over, two buttons at opposite
ends of a toolbar, three rows of a table that are not adjacent.

Dragging a box around those either misses them or swallows half the page with them.

## Scope

In:

- Shift-click toggles an element in the pending set, in `point` mode only.
- <kbd>Enter</kbd> commits the set, in document order rather than click order.
- <kbd>Esc</kbd> clears it, ahead of Esc's existing meaning.
- A live hint under the toolbar with the count, matching the marquee's.
- The same `MAX_MARQUEE_ELEMENTS` ceiling the marquee uses.

Out:

- Shift-drag, or adding a marquee's hits to an existing set. Two selection gestures
  that compose is a bigger idea than the one being asked for here.
- Shift-click in `text` or `area` mode. In `text` the browser's own shift-click
  extends a selection, which is the behaviour the mode exists to use.
- Shift-click inside iframes. `frames.ts` has its own click path; it can gain this
  later without changing anything here.
- Editing the set once the composer is open. That is what the retarget work is for.

## Success criteria

- A plain click still opens the composer immediately, exactly as before. This is the
  common path and shift-select must be invisible to it.
- Elements can be added and removed in any order, and the set survives scrolling.
- An ancestor and its own descendant never both end up in the set.
- Leaving inspect mode, switching mode, or committing all leave the set empty.
