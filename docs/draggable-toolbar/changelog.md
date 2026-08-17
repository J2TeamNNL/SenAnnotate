# Changelog — drag the toolbar anywhere

## What shipped

Drag the pill by any part of it, expanded or collapsed. The position is stored **per
page**, keyed on `origin + pathname` in `chrome.storage.local`; `paintPosition` clamps it
into view on load, on window resize and whenever the dock's own size changes. The hint
flips below the pill near the top of the viewport, but only while it is hidden.

Six files: `shared/protocol.ts`, `shared/archive.ts`, `content/storage.ts`,
`content/ui/toolbar.ts`, `content/ui/styles.css`, `content/index.ts`. `Settings` is
deliberately untouched.

## The global position was built first, and was wrong

The position started in `Settings` beside `toolbarCollapsed`, synced across machines.
It survived a full implementation, a review and a PR before the mistake was named:
that models moving the pill as a *preference*, when it is a fact about one screen.

You move it because *this* page has a sticky order summary, a chat widget, a fixed
footer in the corner. The next page has none of that and would inherit a workaround it
does not need — with the toolbar now somewhere arbitrary. "The pill is too big" is a
preference and is true everywhere; "the pill is over the thing I am looking at" is not.

Rekeying it to `origin + pathname` in `local`, next to the annotations, also deleted
the rough edge the first version had shipped with: syncing meant dragging in one tab
moved the toolbar in every other one. Nothing watches the new key, so that is simply
gone rather than mitigated.

`Settings` ends up untouched by this feature, which is the tell that the second design
is the right one — nothing here was ever a preference.

## Two bugs found by re-reading rather than by running

**`moved` could stick.** The capture-phase click listener that swallows the click at
the end of a drag also clears the flag — but a drag does not always produce a click.
Release outside the pill and none is dispatched, leaving the flag set to swallow the
*next* genuine click, which would read as the toolbar having died. `end()` now clears
it from a `setTimeout(0)`, which lands after the click when there is one.

**`moveTo` forced a layout per pointer move.** It read `getBoundingClientRect()` for
the pill's size on every move, to clamp against. The dock does not change size while
being dragged, so the size is now measured once at `pointerdown` and cached for the
gesture — the same reasoning `snapshotCandidates` uses for the marquee, which is where
the pattern was borrowed from.

## What did *not* need changing, which is the interesting part

This adds a pointer-drag to the toolbar, which is precisely where
`docs/modal-click-leak/` and `docs/modal-focus-leak/` would come back. Nothing in
`root.ts` had to be opened up:

- the drag listeners sit on `.toolbar`, **below** the host that stops
  `pointerdown`/`pointerup` in the bubble phase, so they run first and the host still
  contains the event
- `setPointerCapture` delivers the moves to `.toolbar` however far the cursor outruns the
  pill, which a document-level move listener would have needed a manual hit test for
  (it does **not** keep them off `document` — see the correction below)
- the marquee's document handler already returns early on `isOurUi`, so dragging in
  `area` mode does not start a selection

The last one is true by accident rather than by design, so it is written down in
`context.md` in case someone changes that guard.

## A CSS trap

`.toolbar-dock` is positioned with `bottom`/`right`. Setting inline `left`/`top` does
not replace them — all four apply, and the dock stretches between the two corners.
`[data-floating="true"]` has to release `bottom`/`right` explicitly, and flip
`align-items` with them.

## Verification

`npm run typecheck` and `npm run build` clean.

`npm test` runs, and the earlier claim that it did was premature — it was written against
a branch that had not actually been rebased and still conflicted with `main`. The real
numbers, on the real rebase onto 0.8.0:

```
225/225 checks passed
9/9 upgrade checks passed
```

212 of those are `main`'s. The 13 new ones are a `Drag` block on a fixture of its own,
covering what the first version shipped untested:

- an ordinary click on the toolbar still toggles inspect mode, both ways — the whole risk
  of making the pill its own drag handle, and the reason this assertion comes before
  anything is dragged
- a drag started **on a button** moves the dock and does not press that button
- a dragged dock is marked `data-floating`
- a press released just off the pill's edge, followed by a plain hover, does **not** drag
  it — the sticky-`origin` bug
- the dropped position survives a reload
- another page opens at the default corner
- a 320px window — narrower than the pill — still leaves it against the left edge, which
  is the clamp-order bug
- expanding a handle that was dropped at the right edge brings the whole pill back on
  screen, which is the `ResizeObserver`
- dragging the pill in `area` mode draws no marquee
- the block leaves the toolbar expanded with inspect mode off

The last one is bookkeeping and matters: this block presses <kbd>H</kbd>, and
`toolbarCollapsed` lives in `chrome.storage.sync`, shared by every page in the suite's
single context. The Collapse block above is careful about the same thing and says why.

## What the review found

Four of the fifteen findings were one class of bug — *the drag can reach a state it
cannot leave, or leave the pill somewhere unreachable* — and all four were reachable by
reading. `plan.md` has the numbered list; three are worth repeating here because the
reasoning generalises.

**The clamp had its bounds the wrong way round.** `Math.min(Math.max(x, EDGE), limit)`
returns `limit` when `limit` is negative, and it is negative on any window narrower than
the pill. So the clamp that exists to rescue an off-screen pill was the thing pushing it
off the left edge. The lower bound has to win: `Math.max(EDGE, Math.min(x, limit))`.

**`resize` is not the only thing that changes the fit.** The dock's *own* size changes
three ways `resize` cannot see — expanding from the collapsed handle, the hint line
arriving with inspect mode, the stack badge arriving after detection — and a
`left`/`top`-anchored pill grows out of the viewport when it does. A `ResizeObserver` on
the dock replaces the ad-hoc re-clamps and covers the 160ms collapse animation for free.

**Capture cannot move to `pointerdown`, which is what made the sticky `origin` subtle.**
Taking it there would fix the stale-origin path outright, but pointer capture retargets
the compatibility mouse events too, so every toolbar `click` would land on `.toolbar`
instead of the button pressed — eight buttons broken to fix one drag. `pointermove` bails
on `event.buttons === 0` instead.

And one documentation error worth its own line, because it had already misled this
changelog: **pointer capture retargets events, it does not stop them propagating.** Every
move of a drag still reached `document`, so a fast drag was painting highlights across the
page and leaving `hoveredElement` on a page element for a following <kbd>C</kbd> to
capture. The hover path now returns on `toolbar.isDragging()`, and `context.md` no longer
claims otherwise.

## Rebased onto 0.8.0

The pill gained a settings card and a hint line under it while this sat open. Both cards
are pinned to the bottom-right corner the dock used to own, and 0.8.0 pushes them up by
32px while inspect mode is on so they clear that hint line. A floating dock has left the
corner, so that clearance became a gap under the cards for nothing:
`[data-floating="true"] ~ .panel, ~ .settings` puts them back at `bottom: 20px`. It is
the one place the two features actually meet.
