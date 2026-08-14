# Context

## The constraint that shaped every choice: `isVisible()`

Playwright treats `opacity: 0` as **visible**. Only `display: none`, `visibility: hidden`
or a zero-sized box read as hidden. The suite asserts `!isVisible()` on `.tool--brand`
and `.toolbar-hint` after a collapse, so a fade that ends at `opacity: 0` would leave
those assertions passing while meaning nothing.

The fold therefore ends at `max-width: 0` *and* `visibility: hidden` — zero-sized twice
over. `visibility` also closes a real gap rather than a test one: a zero-width button
with `opacity: 0` is still in the tab order.

It is transitioned as `visibility 0s linear 0.16s` in the collapsed rule and `0s` in the
base rule, so it lands after the fold on the way out and is instant on the way back.

## Why the `!important` had to survive

The old rule carried `display: none !important`, with a comment explaining that
`toolbar.ts` writes `display` into the style attribute for the mode group, the hint and
the badges — and only an author `!important` outranks a normal declaration there. The
replacement inherits the same problem and the same `!important`, transition included.

## What still snaps, and why it is not a bug in this change

Collapsing now turns inspect mode off (`docs/collapse-dismisses/`), so `render()` sets
`display: none` on the mode group in the same tick. Measured across a collapse:

| t | `.toolbar` width | `.tool--brand` width | computed `max-width` |
|---|---|---|---|
| expanded | 339px | 101px | 240px |
| 30ms | 194px | 80px | 215.5px |
| 90ms | 124px | 43px | 42.5px |
| 210ms | 41px | 0px | 0px |

The 339 → 194 inside the first 30ms is the mode group leaving instantly. The rest folds.

That snap is not new and is not caused by this work: the mode group has always appeared
and disappeared instantly when inspect mode toggles. It is simply now visible *during* a
collapse, because a collapse toggles inspect mode. Animating it means moving
`toolbar.ts` off inline `display` for those three elements — a separate change, with the
`isVisible()` audit above to redo.

## Measuring animation, and how not to

The first attempt sampled the collapse with `element.screenshot()` at 60ms and concluded
it snapped — the frame was already fully collapsed. `screenshot()` itself costs tens of
milliseconds (it measures, scrolls and encodes), so it cannot sample a 160ms animation.

`getComputedStyle` through `page.evaluate` can, and produced the table above. The
conclusion from the screenshots was simply wrong; the transition had been working the
whole time.
