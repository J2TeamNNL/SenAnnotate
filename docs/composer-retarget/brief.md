# Brief — move the selection after clicking

## What

With the composer open on a freshly-clicked element, the arrow keys walk the DOM:
<kbd>↑</kbd> parent, <kbd>↓</kbd> first child, <kbd>←</kbd>/<kbd>→</kbd> siblings. The
same four moves have buttons on the **Element** row. The note being typed, the chosen
type and the caret all survive the move; only the subject changes.

## Why

Clicking picks whatever is under the pointer, which is routinely one level off what
you meant. You aim at a button and get the `<span>` inside it; you aim at a card and
get the `<div>` that only wraps its padding. The report then names an anonymous
element instead of the component, and the source line points at a wrapper.

The only recovery was to cancel and click again — with better aim, at a target that
may be one pixel of visible surface. It is not always possible at all: the outer
element may have no exposed area to click.

## Scope

In:

- Arrow keys, while the note is still empty.
- Four buttons on the Element row, working at any time.
- A full re-capture per move: element name, source, component chain and props are
  properties of the element, so all of them are re-read.
- The highlight follows.

Out:

- Retargeting a **saved** annotation. Reopening a note to move what it points at is
  an edit of different weight, and it rewrites a stored record rather than a draft.
- Retargeting a **text** selection. It is anchored to a Range the new element would
  not contain.
- Retargeting a **multi-element** draft. There is no single thing to walk from.
- Moving the composer to follow the new element. See `context.md`.
- Arrow keys once the note has text. The caret needs them; the buttons cover it.

## Success criteria

- Typing in the composer is completely unaffected — arrows move the caret the moment
  there is anything to move it through.
- The page never scrolls when an arrow retargets.
- A move updates every row that depends on the element, including making rows appear
  and disappear as component data comes and goes.
- Rapid presses cannot land out of order; each move is a bridge round trip.
- Reaching `<body>`, or the end of a sibling list, says so instead of doing nothing.
