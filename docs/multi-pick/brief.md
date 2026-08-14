# Brief — pick several elements one at a time

## What

⌘/Ctrl+click accumulates elements into one selection; a plain click adds the element under the
pointer and opens the composer for the whole set; `Enter` (or `c`) commits the set as it stands;
`Esc` drops it. One note, several elements — the same annotation shape a marquee already
produces.

## Why it is not the marquee

Drag-select (area mode, `3`) has taken elements since 0.4.0, but only what one rectangle fully
contains. The things a review actually groups are often nowhere near each other: a label in a
form, a button in the footer, a badge in the header — "these three all use the wrong grey".
A box around them takes half the page with it.

Asked for after the reporter went looking for multi-select and found only the marquee. Worth
noting that the marquee *was* invisible to them for a second reason, fixed in
`modal-top-layer/`: inside a `showModal()` dialog nothing in the overlay responded at all.

## Scope

- Point mode, top document.
- Reuses the multi-element annotation that already exists: `beginAnnotation(Element[])` →
  `captureDraft` → `isMultiSelect`, `elementBoundingBoxes`, `Selection: N elements`. Nothing in
  the report, the panel, the markers or storage changes.
- Cap shared with the marquee (`MAX_MARQUEE_ELEMENTS`).

## Out of scope, deliberately

- **Across iframes.** A ⌘+click inside an instrumented frame stays a plain click — the child
  frame owns its own hit testing and hands finished drafts up, so accumulating across frames is
  a protocol change, not a feature flag.
- **A toolbar button.** Considered and dropped: seven tools already sit in the corner, and the
  hint line carries the state.
- **Changing point mode's default hint.** It is asserted verbatim by the suite, and the feature
  announces itself in the hint as soon as one element is picked.

## Done when

The suite drives it end to end on a fixture of three separated elements: two picks show two
boxes and no composer, a repeat pick removes one, a plain click on a third opens the composer
reading `Selection: 3 elements`, the report names all three under one note, `Esc` clears, and
the `Enter` path commits without a plain click.
