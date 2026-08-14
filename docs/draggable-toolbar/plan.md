# Plan

Written after the first implementation shipped for review, so it is in two parts: the
plan the feature was built to, and the plan the review turned it into. Both are kept —
the second only makes sense against the first.

## Part 1 — the drag

Test last rather than first, because the risk is not "does the drag work" but "does
every toolbar button still work". The pill is the drag handle, so the threshold is the
only thing separating *collapse the toolbar* from *move the toolbar*, and ten existing
scenarios click those buttons.

1. **`src/shared/protocol.ts`** — `DOCK_PREFIX = ${NS}:dock:`, beside
   `ANNOTATION_PREFIX`, and documented as *not* a setting.

2. **`src/content/storage.ts`** — `dockKey()`, `loadDockPosition()`,
   `saveDockPosition()`, keyed on `origin + pathname` in `local`. `load` discards
   anything that is not a pair of finite numbers rather than feeding `NaN` to the clamp.

3. **`src/content/ui/toolbar.ts`**
   - `onMove(position)` on `ToolbarCallbacks`, fired once on drop.
   - `installDrag(bar)`: `pointerdown` records the origin, the grab offset and the dock
     size; `pointermove` crosses `DRAG_THRESHOLD` (4px combined travel) before anything
     moves; `pointerup`/`pointercancel` end it; a capture-phase `click` listener
     swallows the click a drag would otherwise deliver to a button.
   - `moveTo(x, y)` clamps into the viewport and writes inline `left`/`top`.
   - `applyPosition(position | null)` for load and resize; `null` restores the CSS
     corner.

4. **`src/content/ui/styles.css`** — `[data-floating="true"]` releases `bottom`/`right`
   (all four otherwise apply and the dock stretches between corners),
   `[data-hint-below="true"]` flips to `column-reverse`, `[data-dragging="true"]` holds
   `cursor: grabbing` and kills the pill's transition.

5. **`src/content/index.ts`** — a `dockPosition` module global (the resize path must not
   read storage), `onMove` persists, `boot()` loads and applies, `resize` re-clamps.

6. **Verify** — `npm run typecheck`, `npm run build`, `npm test`.

7. **Document** — the *Move the toolbar* row in the README table, the prose under
   collapsing, `brief.md`/`context.md`/`changelog.md`, and this file.

## Part 2 — what the review changed

Four findings were the same class of bug: **the drag can reach a state it cannot leave,
or leave the pill somewhere unreachable.** They are fixed as one group.

8. **The press that never ends.** Capture is taken after the threshold, so a press
   released within 4px of the pill's edge never reaches `end()` and leaves `origin` set;
   the next *hover* then drags the pill with no button held. `pointermove` bails on
   `event.buttons === 0`. Capture cannot simply move to `pointerdown` — it retargets the
   compatibility mouse events too, so every toolbar `click` would land on `.toolbar`.

9. **The clamp applied its bounds in the wrong order.**
   `Math.min(Math.max(x, EDGE), limit)` returns `limit` when `limit` is negative, which
   it is on a window narrower than the pill — pushing the pill off the left edge exactly
   where the clamp exists to rescue it. Now `Math.max(EDGE, Math.min(x, limit))`.

10. **`resize` cannot see the dock's own size change.** Expanding from the collapsed
    handle, the hint line appearing with inspect mode, and the stack badge arriving after
    detection all grow a `left`/`top`-anchored pill off-screen. A `ResizeObserver` on the
    dock re-clamps, which also covers each transient width of the 160ms collapse
    animation.

11. **`paintPosition` re-clamps from the request, never from the result.** Feeding the
    clamped answer back in makes every clamp permanent — a spell in a narrow window walks
    the pill left and widening never brings it back. `this.requested` is the single
    source; the drop persists it, not the rendered box. This is also what fixes the boot
    order: `createTopUi` never renders, so `applyPosition` moved to *after* the first
    `render()`, and the `ResizeObserver` catches the collapse that follows.

Then the rest, smallest first:

12. **`touch-action: none` on `.toolbar`** — without it the browser claims the gesture
    for panning and answers `pointercancel`, so the drag does not work by touch or pen at
    all. Everything else was already touch-ready.

13. **`cursor: grab` on `.tool` as well as `.toolbar`** — `.tool` is a `<button>`, matched
    directly by `button { cursor: pointer }`, and a direct match beats an inherited value.

14. **`end()` filters on the primary button** the way `pointerdown` does, so releasing a
    second button mid-drag no longer ends it while the first is still held.
    `pointercancel` is exempt: it carries no meaningful `button`.

15. **`setPointerCapture` in a `try`/`catch`** — it throws for an inactive pointerId or a
    disconnected element, after `moved` and `data-dragging` are set and before `moveTo`,
    which would stick the grabbing cursor and swallow the next genuine click.

16. **The hint flip is computed only while the hint is hidden.** Once drawn it is part of
    the dock and the clamp already guarantees it on screen; recomputing mid-drag jerks the
    pill ~30px under a stationary cursor.

17. **The hover path returns on `toolbar.isDragging()`.** Capture retargets moves but does
    not stop them reaching `document`, so a fast drag was painting highlights across the
    page and leaving `hoveredElement` on a page element. `context.md` said the opposite and
    is corrected.

18. **`shared/archive.ts` sweeps `DOCK_PREFIX`.** "Clear all pages" reported a complete
    wipe while every position survived — and this feature ships no reset control on
    purpose, so that was the only way back. `exportAll`/`importAll` round-trip them in an
    optional `docks` array; the format `version` stays 1 because `importAll` never reads
    it.

19. **The unthrottled `resize` listener folds into the existing rAF.** It sat directly
    below a throttled one and did a forced layout plus two style writes per event. A
    `resizeQueued` flag keeps it off the `scroll` path, which shares the frame and cannot
    change the viewport.

20. **Docs** — this file (it did not exist), the two `context.md` claims about pointer
    capture, and the changelog's account of both.

21. **A `Drag` e2e scenario** on a fixture of its own, restoring what it changed. The
    profile is shared across the suite and dock positions are keyed on
    `origin + pathname`, so a block that leaves a position behind moves the toolbar for
    every later block on that page.
