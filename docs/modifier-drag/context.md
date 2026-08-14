# Context

## Why `area` mode was kept

Removing it was considered, at the user's request. Two findings decided it.

**The capability argument for keeping it turned out to be false.** The assumption was
that `area` mode is the only place you can drag across links and buttons safely, because
it swallows `mousedown`. It is not: the top frame's `mousedown`/`mouseup` handlers are
gated on `!active || composer || mode === "text"`, so `point` mode swallows them too.
⌘/Ctrl+drag over a link was already safe. The button is an affordance, not a capability.

**But the affordance is the point.** `toolbar.ts` carries this comment above
`MODE_HINTS`, and it is the reason the hints exist at all:

> The mode buttons are icon-only and appear only once inspect mode is on, so without
> this nothing on screen says a drag mode exists — which is exactly how mode `area` went
> unused for three releases.

Replacing a visible button with an invisible modifier-drag is that failure again, with
less to recover from: no button, and no hint either. So the button stays, and the
`point` hint now advertises the gesture:

```
Click an element · ⌘/Ctrl+drag across several · C captures hover · 2 text · 3 area
```

Removing `area` later remains open. It would cost the `InspectMode` union, `MODES`,
three `MODE_HINTS` strings (two asserted verbatim in `test/e2e.mjs`), the `3` key, the
`mode === "area"` branch, comments in `frames.ts`, and a rewrite of the e2e block that
drives `.tool[title^="Drag"]`.

## The suppressed click

`pointerup` → `click` always fires after a drag. Before this change nothing needed to
care, because the click handler returns early once a composer is open. That guard cannot
be relied on here: `beginAnnotation` is `async` and `void`-ed, so the composer usually
does not exist yet when the click arrives, and the modifier branch would run and pick
one more element onto a set that had just been committed.

Hence `suppressNextClick`, armed on the `pointerup` that commits and spent by the next
click. It is also cleared on `pointerdown`, so a drag that ends off-document cannot
leave a flag armed to swallow an unrelated click later.

## Why the preview had to change too

The merge decision has a visual consequence that is easy to miss. If ⌘/Ctrl+click
collected three elements and the box then catches two more, committing five while the
overlay only ever highlighted two would open a composer holding more than was shown —
the one outcome the drag preview exists to rule out (`test/e2e.mjs`, *"the previewed set
is the annotated set"*). So `drawMarquee` draws the carried picks alongside the box hits,
skipping any the box also caught, and `marqueeHint` takes a `carried` count. With no
picks in play, `carried` is 0 and every existing hint string is byte-identical.

## Where the cost went

`snapshotCandidates()` measures every candidate on the page and used to run on the
`area` mode `pointerdown`. It now runs in `beginMarquee`, which a modifier press reaches
only after it has moved — so a ⌘/Ctrl+click never pays for a measurement it discards.
`area` mode still measures at press time, because there the press *is* the drag.
