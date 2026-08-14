# Changelog

## What shipped

⌘/Ctrl+drag in `point` mode draws a marquee and commits it on release. `area` mode, its
button and its `3` key are unchanged.

## The conflict that shaped it

⌘/Ctrl was not free. It has meant "collect this element" since 0.6.1
(`docs/multi-pick/`), so the new gesture shares a `pointerdown` with the old one and the
two are separable only by movement.

`marqueePending` holds the anchor of a modifier press that has not moved yet. Nothing is
drawn and no candidates are measured until it clears `MIN_MARQUEE_SIZE` on either axis;
below that the press stays a pick and the click that follows is left alone.

`MIN_MARQUEE_SIZE` was exported rather than duplicated. Picking a separate promotion
threshold would have created a range where a drag became a box that then selected
nothing — two numbers that can only disagree.

**Either axis, not both.** A 200×3 drag is unmistakably a drag; letting it promote and
having `hitsInRect` report an empty box is exactly what `area` mode already does, and
the hint already has words for it.

## Two things the first pass got wrong

**A helper that did not exist.** `promoteMarquee` was first written calling
`clearPickedHighlights()`, which is not a function in this codebase. Worth recording
because of what fixing it exposed rather than the slip itself: `beginMarquee` calls
`overlay.hideHighlights()`, so the carried picks would have vanished from the overlay
while still being committed — five elements annotated, two ever highlighted. That breaks
the property `test/e2e.mjs` already asserts as *"the previewed set is the annotated
set"*. `drawMarquee` now draws the carried picks with the box hits, and `marqueeHint`
takes a `carried` count.

**A grep that proved nothing.** Earlier in the same session, a build variant was
"verified" with `grep -c patchedFetch` against a minified bundle — 0 matches on both the
patched and unpatched build, because esbuild renames functions. Same lesson as
`docs/challenge-frames/`: check a minified bundle with a string literal, not an
identifier.

## Verification

Failing first, as required:

```
FAIL  the hint names the default mode and the keys for the others
FAIL  the point hint advertises the modifier drag
```

After:

```
188/188 checks passed
9/9 upgrade checks passed
```

Five new assertions: the hint copy, a modifier drag boxing two elements, the mode
surviving it, a carried pick set committing as three, and a sub-threshold drag still
picking rather than boxing.

## Open

Removing `area` mode entirely was raised and deferred, with the reasoning and the full
cost written down in `context.md`. The decision turned on discoverability, not on
capability — the capability argument for keeping it was checked and found false.
