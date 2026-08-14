# Hover capture — brief

## What

A key that annotates whatever the pointer is already over, without clicking it.

`C` while inspect mode is on and the pointer is over an element: the composer opens for
that element, exactly as a click would have done.

## Why

Annotating currently requires a click, and a click is the one thing that destroys the
state worth annotating. Everything that exists *because* the pointer is where it is
cannot be annotated at all:

- a dropdown or `<select>`-alike that closes on outside click,
- a hover menu — the moment you move toward the toolbar, it collapses,
- a tooltip,
- any `:hover` style: the wrong hover colour is a real design bug and there is no way
  to point at it,
- `:focus-within` panels, autocomplete popovers, combobox lists.

Freeze (`F`) does not help. It parks `requestAnimationFrame` and `setTimeout`
(`inspector/freeze.ts`), which stops *animation*; a menu that unmounts on `pointerleave`
or `blur` is driven by events, not timers, and closes anyway.

This is the cheapest large gain available: the capture path
(`beginAnnotation` → `captureDraft` → composer) is already written and already fed by a
`hoveredElement` that `content/index.ts` keeps current on `pointermove`. What is missing
is a trigger that is not a click.

## Scope

In:

- `C` (and `Enter`) captures the hovered element in `point` mode.
- The hint line says so, so the feature is discoverable — the same reasoning that
  produced the hint line in the first place (`docs/marquee-select/`: a mode nothing on
  screen mentioned went unused for three releases).
- Works with the toolbar collapsed.

Out:

- A configurable key. One more setting for a single letter is not worth it.
- Capturing hovered elements in `text` or `area` mode — both already have their own
  pointer semantics.

## Success

- Open a hover-only menu on a fixture, press `C` without moving the pointer: the
  composer opens naming an element inside the menu, and the menu is still open.
- The report is identical to what a click on the same element would have produced.
