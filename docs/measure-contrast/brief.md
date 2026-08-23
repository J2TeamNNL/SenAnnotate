# Brief — Contrast, from colours we already resolve

## What

A WCAG contrast ratio for any element that paints its own text, shown on the hover
readout and carried into the Markdown report.

- `contrastRatio()` in `src/content/measure.ts` — pure, no DOM
- A row on the measurement readout: `3.14:1 · fails AA`
- `**Contrast:**` in the report, gated at `detailed` like `**Box:**`

## Why

`docs/measure-core/` shipped the expensive half of this without meaning to. Resolving
*what colour is this actually painted on* needs an ancestor walk — almost nothing
declares its own `background-color`, so reading the element alone answers `transparent`
on nearly everything. `effectiveBackground()` already does that walk, and
`readStyleSummary` already returns both colours.

So the ratio is arithmetic on two values that are already in hand. It is the cheapest
remaining thing that makes a report more actionable, and contrast is the one UI defect a
reviewer routinely *cannot* judge by eye — the whole point of a threshold is that human
judgement disagrees with it.

## Scope

**In**

- Relative luminance and the ratio, per WCAG 2.x
- AA / AAA verdicts, including the large-text thresholds (3:1 and 4.5:1)
- Alpha compositing: a 50%-opacity foreground is composited over its background before
  the ratio is taken, or the figure describes a colour nobody can see
- The readout row and the report line

**Out — deliberately**

- **The eyedropper.** It is an *action*, and this release adds no new surface to put one
  on. Its own decision, later.
- **Anything that suggests a fix.** Naming a colour that would pass is a design opinion;
  the report states the measurement and the threshold it missed.
- **Non-text elements.** An empty `<div>`'s `color` paints nothing, and a ratio for it is
  a number with no referent.
- **Gradients and background images.** `effectiveBackground` already reports those as
  `image` rather than sampling a pixel; a ratio against a guess is worse than none.

## Success criteria

1. Black on white reports `21:1`; white on white reports `1:1`. Both exact.
2. A 50%-alpha foreground reports the composited ratio, not the opaque one.
3. `18px bold` and `24px` are treated as large text; `18px` regular is not.
4. An element with no text of its own has no contrast line anywhere.
5. `npm run typecheck` clean, `npm test` green.
