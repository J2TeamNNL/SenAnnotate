# Changelog

## What shipped

⌘/Ctrl+click accumulates a pick set; a plain click adds the element it landed on and commits;
`Enter` (or `c`) commits the set as it stands; `Esc` drops it without leaving inspect mode. The
hint under the toolbar carries the state — `2 elements picked · ⌘/Ctrl+click to add · Enter to
annotate`, and `12 elements (limit) · …` at the shared cap.

One file changed: `src/content/index.ts`. Five short functions (`pickHint`, `livePicks`,
`drawPicked`, `clearPicked`, `togglePick`, `commitPicked`) and a branch in each of the six seams
that already existed — the capture-phase `click`, `c`/`Enter`, `Escape`, `pointermove`,
`queueSync`, and the mode/inspect resets. `overlay.ts`, `capture.ts`, `output.ts`, `panel.ts`,
`markers.ts` and storage are untouched, which was the design's own test of whether the feature
belonged where it was put: a pick set is a second way to build the list
`beginAnnotation(Element[])` already took for the marquee.

## Two things the design got right on paper and had to be checked

- **`preview: true` covers the pick set with no overlay change.** It was written for the marquee
  ("every box is the live selection, none muted"), and a label still lands on box 0 if one is
  passed. So `[hovered, ...picked]` draws the set as one selection while the box under the
  pointer keeps its name-and-source label. The only cost is the hover box losing its 0.07s
  position transition while picking, which is invisible in use.
- **The hovered element must be skipped when it is already picked**, or it is drawn twice — and
  the second box, being a pooled reuse, sits on top with the label. The suite asserts the box
  count with the pointer resting on a picked element for exactly this reason.

## What the enrich path would have broken

`updateHover()` draws twice: immediately from `identifyElement`, then again a bridge round-trip
later with the component name and source. The second draw is a bare
`overlay.showHighlights([one box])` and would have wiped the set roughly 100ms after every pick,
non-deterministically. Both draws now go through one `drawHover()`, which is the branch point.
Nothing in the assertions would have caught it reliably; it was found by reading the function
rather than by running it.

## Known limitations

- **Inside an iframe a ⌘+click stays a plain click.** `frames.ts` owns hit testing in a child
  document and hands finished drafts up; "add this to the parent's pending set" is a protocol
  change. `README.md` already says text selection works in frames and the marquee does not, so
  this is the third entry in that family.
- **The report names the first picked element plus `+N more`**, the same as a marquee selection —
  `captureDraft` builds the name. For a contiguous drag that reads fine; for three deliberately
  unrelated elements, listing all of them would read better. Not changed here: it is a change to
  the annotation format, shared with the marquee, and worth its own decision rather than being
  smuggled in with a selection mechanism.
- **Point mode only.** Text mode needs raw clicks to reach the page; area mode's `pointerdown` is
  the drag.

## Verified

`173/173` in the suite — the nine new checks plus every existing one — and `9/9` in
`test/upgrade.mjs`. The new fixture is `test/fixtures/pick.html`, three elements placed far
enough apart that no rectangle takes all three and nothing else, which is the case the marquee
cannot express.

Non-vacuous by construction: four of the nine assert on strings only this feature produces
(`2 elements picked`, `1 element picked`, `Selection: 3 elements`, `+2 more`), so they cannot
pass without it.
