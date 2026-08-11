# Plan

1. **`Overlay.clampLabel`** — after appending the label, read `offsetWidth`, compute the
   overflow past `innerWidth - LABEL_EDGE`, and shift by `-min(overflow, rect.left - EDGE)`
   so the right edge is fixed without pushing the left edge out.
2. **CSS** — `max-width: min(480px, calc(100vw - 12px))`, for a window narrower than the
   label.
3. **Fixture** `test/fixtures/label-edge.html` — one button flush right, one flush left, both
   carrying a long `data-v-inspector` so the label is wide. No framework needed: that
   attribute is read straight off the DOM.
4. **Checks** — right edge inside the viewport, the shift actually happened, left edge not
   shifted. The middle one is what stops the first from passing vacuously.
5. **Verify** — full suite, `npm run typecheck`.
