# Changelog

## What shipped

- Toolbar buttons name themselves through the overlay's own tooltip, on hover and on focus,
  with no delay. `title=` is gone from all eight; `aria-label` carries the name.
- The tooltip anchors to the `.toolbar-dock`, so it sits above inspect mode's hint line rather
  than on top of it.
- `attachTooltip` accepts a getter, because the collapse button's label carries the annotation
  count and changes under it.
- `.toolbar-hint` no longer runs off the right edge of the screen.

## The locator sweep

37 e2e locators matched `.tool[title^="…"]`, plus one each in `upgrade.mjs`,
`verify-harness.mjs`, `verify-tracer.mjs` — and one more that was missed on the first pass and
only surfaced when `npm run assets` died 30 seconds in: `scripts/store-assets.mjs`, which
drives the same toolbar to photograph it. Anything that clicks our UI by `title` was a caller.
Worth noting for the next rename: `grep` over `test/` is not the whole search.

## Refreshed screenshots

The README's five screenshots dated from 0.6.0 and predated the toolbar settings card, the
accent colour, the markup editor and the collapse handle. All five were regenerated from
`npm run assets` and two were added — the settings card and the markup editor — bringing the
README to seven. The listing form still takes only the first five; the script's header says so.

Three takes were needed, and each mistake was one the extension's own behaviour caused:

1. **A tooltip in the frame.** The panel shot clicks the Annotations button and shoots — with
   the pointer still on the button, so the new tooltip sat across the panel's *Copy report*
   button. Parking the pointer first fixed it.
2. **The whole viewport washed in accent tint.** Parking the pointer over "empty" page canvas
   still hovers *something* — a container element — so inspect mode highlighted it and the wash
   covered the page. Parking on one of our own card headers is the fix: the overlay ignores
   itself, so the highlight clears.
3. **A stale composer in two shots.** The marquee shot releases the drag and presses Escape,
   but committing a selection is async: the Escape landed before the composer existed and
   cancelled nothing, so a three-element composer sat in the corner of both new shots — and
   the markup editor then opened on that selection rather than the cell the script clicked.
   The script now waits for the composer, cancels it, waits for it to go, and also waits out
   the 2.2s toast from the report copy.

The first take of the *inspect* shot is the pleasant surprise: it shows the whole hint line,
`… C captures hover · 2 text · 3 area`, where the 0.6.0 one had been cut short — which is the
hint fix, photographed rather than argued.

## Results

```
222/222 e2e checks      9/9 upgrade checks      typecheck clean
```

Two new checks: hovering a toolbar button names it (asserting the text, not just visibility)
· a toolbar tooltip clears the hint line.
