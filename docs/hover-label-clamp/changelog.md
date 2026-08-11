# Changelog

## Fixed

`Overlay.clampLabel` shifts the hover label left by exactly its overflow past the viewport
edge, bounded so it never leaves on the left instead. `max-width` gained a `100vw` term for
windows narrower than the label.

## Measured

On a 1280px viewport, hovering a button at `left: 1220`:

```
before   label.left=1220  label.right=1700   420px outside the window
after    label.left=796   label.right=1276   shift=-425.6px
left edge (left: 0)       shift=0            unchanged, as it should be
```

The shift value is the proof: −425.6px is the same statement as "425.6px of this was off
screen". The left-edge row is what rules out an over-correcting fix.

`120/120` checks pass, up from 117. `npm run typecheck` clean.

## Notes

**Found while making marketing material, not from a bug report.** The first pass at the Web
Store screenshots produced a label clipped across the demo page's revenue figure, and at the
time it was worked around by pointing the screenshots at mid-canvas targets and noting the
blemish. Photographing the product honestly turned out to be a way of finding bugs in it.

**One test mistake worth recording.** The e2e helper was first called `hoverLabel`, which is
already a `const` several hundred lines earlier in the same `main()` — the suite died at
module load with `Identifier 'hoverLabel' has already been declared`. Renamed to `labelAt`.
`e2e.mjs` being one long sequential function is deliberate (it is the only regression net and
stays self-contained), and this is the cost: variable names are shared across every block in
it.

**The vertical case was already right**, via `data-flip` when the box is too near the top. This
was the horizontal half of a pattern the file already had, which is the most likely kind of gap
to sit unnoticed — the code looks like it handles edges, because it does, in one axis.
