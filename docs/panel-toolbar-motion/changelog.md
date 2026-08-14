# Changelog

## Shipped

- `.panel` enters with `vt-rise`, leaves with a new `vt-fall`, removed on `animationend`
  with a 400ms fallback.
- `Panel`'s constructor clears a stale `[data-leaving]` panel, so close-then-reopen
  inside the animation cannot leave two.
- The collapsed toolbar folds its children — `max-width`, padding, border width, opacity,
  ending at `visibility: hidden` — instead of `display: none`. `gap: 0` on the collapsed
  pill; the pill itself now transitions padding, gap and border-radius too.

## The wrong turn worth keeping

The collapse was first checked by screenshotting the dock 60ms into the animation. The
frame came back fully collapsed, and the obvious reading was that the fold had not
worked at all — leading to a hunt through `prefers-reduced-motion`, `!important`
precedence and inline styles, none of which was the problem.

`element.screenshot()` measures, scrolls and encodes; it costs tens of milliseconds, so
it cannot sample a 160ms animation. `getComputedStyle` through `page.evaluate` can:

| t | `.toolbar` width | `.tool--brand` width | computed `max-width` |
|---|---|---|---|
| expanded | 339px | 101px | 240px |
| 30ms | 194px | 80px | 215.5px |
| 90ms | 124px | 43px | 42.5px |
| 210ms | 41px | 0px | 0px |

The transition had been working the whole time. **To check motion, measure it — do not
photograph it.**

That measurement also answered a worry from the design: `max-width: 240px` is well above
the widest child, so the fold should have had a dead lead-in while `max-width` fell from
240 to the natural width. It does not, because padding transitions alongside it — the
button is already 101 → 80 at 30ms.

## Honest limitation

339 → 194 inside the first 30ms is the mode group leaving instantly, because collapsing
now turns inspect mode off and `toolbar.ts` sets its `display` inline. That snap predates
this change and happens on any inspect toggle; it is only newly visible during a
collapse. Fixing it means moving three elements off inline `display`, and redoing the
`isVisible()` audit in `context.md`. Not attempted here.

## Verification

```
191/191 checks passed
9/9 upgrade checks passed
```

One new assertion — closing and reopening the panel inside the exit animation leaves
exactly one. No timing assertions: pinning a duration in a test makes a design choice
expensive to revisit, and the suite already proves the end states.

Motion itself was verified out of band, by the measurement above and by a frame captured
70ms into a panel close showing it part-faded rather than gone.
