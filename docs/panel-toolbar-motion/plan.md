# Plan

1. **Read the existing motion first.** `styles.css` already has `vt-rise`, a
   `prefers-reduced-motion` block covering `*`, and a transition on `.toolbar`. Match
   them rather than introducing a second vocabulary.
2. **Check what `isVisible()` will mean afterwards** before choosing any property. This
   decides the whole approach — see `context.md`.
3. **Panel in**: `animation: vt-rise` on `.panel`. No JavaScript.
4. **Panel out**: `vt-fall` under `[data-leaving="true"]`, set by `Panel.destroy`, node
   removed on `animationend` with a timeout fallback because a cancelled animation never
   fires that event.
5. **Guard the reopen race**: the constructor clears any `.panel[data-leaving]` left in
   the layer, so closing and reopening inside the animation cannot leave two.
6. **Toolbar**: replace `display: none !important` with a `max-width` / padding /
   opacity fold ending in `visibility: hidden`; add `gap: 0` to the collapsed pill so
   folded children leave no 2px behind; extend the pill's own transition to cover
   padding, gap and border-radius.
7. **Test** the reopen race only. No timing assertions — they are brittle and would pin
   durations that are a design choice.
8. **Verify by measurement, not by eye**: sample `getComputedStyle` mid-animation.
   Screenshots are too slow to sample a 160ms transition.

## Not doing

The composer, and the mode group's own show/hide. Both are in `brief.md` and
`context.md` with the reason.
