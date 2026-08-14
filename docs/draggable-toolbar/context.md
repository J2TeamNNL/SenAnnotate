# Context — drag the toolbar anywhere

## Why the whole pill is the handle

A dedicated grip was the first design, and it loses twice. It adds width to a pill
whose entire problem is that it covers things — `toolbar-collapse/` measured the
expanded pill at 339×44px and the collapsed handle at 41×40px, and a grip makes both
numbers worse. And the collapsed handle is a *single button*, so a grip would either
not fit or would double the collapsed footprint, which defeats collapsing.

A movement threshold gives every pixel of the toolbar both meanings and costs no
space. `DRAG_THRESHOLD` is 4px of combined travel — roughly the platform convention,
and what a trackpad tap stays inside. Too small and a shaky click stops working; too
large and short drags feel dead.

## Why this does not repeat the pointer leaks

Two shipped bugs came from our pointer events reaching the page —
`docs/modal-click-leak/` (a toolbar click read as an outside click and dismissed the
page's modal) and `docs/modal-focus-leak/` (a toolbar click moved focus out of the
page's dialog). A feature that adds a *pointer-drag* to the toolbar is exactly where
those come back, so the seams already in place are worth stating.

`root.ts` stops `pointerdown`/`pointerup` on the shadow **host**, in the bubble phase.
The drag listeners are on `.toolbar`, inside the shadow root and below the host, so
they run first and the host still stops the event before `document` sees it. Nothing
new had to be opened up.

`pointermove` is deliberately *not* stopped at the host, and it is worth being precise
about what that means during a drag, because the first version of this document was
wrong about it.

**Pointer capture retargets events; it does not stop them propagating.** The moves are
*delivered* to `.toolbar` regardless of what the pointer is over, which is the property
the drag needs — but they still bubble on to `document`, so `content/index.ts`'s
`pointermove` handler runs for every one of them. During a fast drag the cursor outruns
the pill and lands on page content, and that handler would then paint a highlight there,
spend a bridge RPC per element, and leave `hoveredElement` pointing at a page element for
a following <kbd>C</kbd> to capture.

So the handler consults `toolbar.isDragging()` and returns. Page-side `document`
listeners — drag-to-reorder, canvas drawing — do still see the stream; that is inherent
to not stopping `pointermove` at the host, and stopping it there would break our own
hover path, which is the reason it was left open in the first place.

The document-level marquee handler in `content/index.ts` already returns early on
`isOurUi(event.target)`, and a shadow event retargets to the host — which carries
`UI_ATTR`. So dragging the toolbar in `area` mode does not start a marquee. This was
free, but it is the kind of thing that only stays true by accident, so it is written
down.

## `setPointerCapture`, not a document-level move listener

The obvious implementation attaches `pointermove` to `document` for the duration. Pointer
capture is better on two counts that survive the correction above: a fast drag that
outruns the pill still delivers its moves to `.toolbar`, and there is no listener to
forget to remove. What it does *not* buy is privacy from the page — see the previous
section.

The cost is remembering to release it — done in `end()`, which is bound to both
`pointerup` and `pointercancel`, because a cancelled pointer (a system gesture, a lost
device) otherwise leaves the toolbar permanently captured.

Capture is taken **after** the 4px threshold rather than at `pointerdown`, and that is
load-bearing: capture retargets the compatibility mouse events too, so capturing on
`pointerdown` would deliver every toolbar `click` to `.toolbar` instead of to the button
that was pressed, breaking all eight buttons to fix a drag.

Deferring it costs one thing, though, and it took a review to see: before the threshold
there is no implicit capture on mouse either, so a press released just off the pill's edge
never reaches `end()` and leaves `origin` set. The next plain *hover* then measures travel
against that stale origin and starts dragging with no button held. `pointermove` therefore
bails on `event.buttons === 0`, which is the only reliable witness that a press is over.

## Suppressing the click after a drag

A drag that ends over a button would also press it: let go over the collapse button
and the toolbar collapses where you dropped it.

Fixed with a capture-phase `click` listener on `.toolbar`, which runs before the
button's own listener and stops the event. The subtle part is resetting the `moved`
flag: the click handler clears it, but a drag does not always produce a click — release
outside the pill and none is dispatched. Left set, the flag swallows the *next* genuine
click. So `end()` also clears it from a `setTimeout(0)`, which lands after the click
when there is one.

## Per page, not per user

The first design put the position in `Settings`, next to `toolbarCollapsed`, and
synced it. That is wrong about what the gesture means.

The pill is moved because of what **this screen** has in the corner — a sticky order
summary on checkout, a chat widget on the marketing page, a fixed footer in the admin.
None of that is true of the next page, which would inherit a workaround it does not
need and now has the toolbar somewhere arbitrary. `toolbarCollapsed` is a genuine
preference — "the pill is too big" is true everywhere — and the position is not.

So it is keyed on `origin + pathname` and stored in `chrome.storage.local`, exactly
like the annotations and for the same reason: it describes one screen. The query
string is excluded by the same argument `storage.ts` already makes — `?page=2` is the
same screen.

Two consequences worth stating. Only customised pages get an entry, so the common case
costs nothing to store. And the cross-tab jump that syncing would have caused —
dragging here moving the pill in a background tab — cannot happen, because nothing
watches this key.

## Viewport coordinates, and the resize that justifies clamping

The position is stored as viewport pixels from the top-left rather than an offset from
the nearest corner. Corner-relative storage sounds more robust and is not: the pill is
placed against what is on screen at the time, and re-anchoring makes the same stored
value mean somewhere else on a differently-shaped window.

The honest cost is that a window narrowed since the position was saved can put the
pill off-screen. That is what `applyPosition` on `resize` is for, and it is also why
the clamp lives in `paintPosition` rather than in the drag handler — load, drag, window
resize and dock resize all go through the same one.

The position is saved on drop rather than per frame — at pointer frequency a single
drag would otherwise write sixty times a second for as long as the button is held.

### Re-clamp from the request, not from the result

`paintPosition` clamps `this.requested`, the point last *asked* for, and never overwrites
it with the clamped answer. Feeding the result back in would make every clamp permanent: a
spell in a narrow window walks the pill left one step at a time, and widening the window
again never brings it back. Storing the request also means a drop against the edge of a
narrow window reopens where it was actually put once there is room.

### The window is not the only thing that resizes

`resize` sees the viewport change. It does not see the **dock** change, and a `left`/`top`
anchored pill grows rightwards and downwards out of the viewport when it does:

- collapsing to the 41px handle, dragging it to the right edge, then expanding — the 339px
  pill now starts at `innerWidth - 49`, so every button but collapse is off-screen;
- dropping the pill near the bottom with inspect mode off, then turning it on — the hint
  line adds ~30px and pushes it below the fold;
- the stack badge arriving after framework detection.

A `ResizeObserver` on the dock covers all three, and covers each transient width of the
160ms collapse animation for free, because the last delivery uses the settled size.
Re-clamping writes `left`/`top`, which does not change the observed size, so it cannot
loop.

### The hint flip is not part of the clamp

`data-hint-below` flips the dock to `column-reverse` so the hint is not drawn off the top
of the window. It is computed **only while the hint is hidden**. Once it is drawn it is
part of the dock, so the clamp already guarantees it on screen — and recomputing it as the
pointer crosses `HINT_FLIP_TOP` mid-drag would jerk the pill ~30px under a stationary
cursor, then jerk it back on the way out. The flip exists for the case where the hint is
hidden at drag time and appears later.

## Stored positions are swept, not orphaned

Nothing prunes positions as you go: a page dragged once keeps its entry forever, at roughly
forty bytes, exactly like its annotations.

What the first version got wrong was the exit. It named the popup's "clear all pages" as
"the obvious place to sweep both" and then did not do it — so that button reported a
complete wipe while every `senannotate:dock:*` entry survived, and since this feature ships
**no reset control on purpose**, there was no way back at all. `clearAllPages` now removes
both prefixes, and its return value still counts annotated pages only, because that is what
the popup reports and a page whose sole customisation was a moved toolbar is not news.

`exportAll`/`importAll` carry them too, in an optional `docks` array. The format `version`
stays at 1: `importAll` never reads it, so an older build ignores a field it does not know,
and losing a dock position through an old importer costs nothing worth a schema bump.
