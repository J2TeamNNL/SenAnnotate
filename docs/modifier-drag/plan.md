# Plan

1. **Settle the gesture conflict before writing anything.** ⌘/Ctrl+click is taken. Get a
   decision on what a drag commits, and on whether an existing pick set survives it.
2. **Decide `area` mode's fate on evidence**, not on tidiness — check whether it holds
   any capability `point` mode lacks, and check the record for why it exists.
3. **Write the failing e2e first**, in the marquee block: hint copy, a modifier drag
   opening the composer with the box's elements, the mode unchanged afterwards, a
   carried pick set joining the box, and a sub-threshold drag still picking.
4. **Export `MIN_MARQUEE_SIZE`** rather than adding a second threshold constant.
5. **Factor `beginMarquee(anchor)`** out of the `area` `pointerdown` so both entry
   points share one body.
6. **Add `marqueePending`** — set on a modifier `pointerdown` in `point` mode, promoted
   by `promoteMarquee` on the first `pointermove` that clears the threshold on either
   axis, cleared on `pointerup`.
7. **Add `suppressNextClick`** — armed by the committing `pointerup`, spent by the next
   `click`, reset by any `pointerdown`.
8. **Merge carried picks** into the commit, the preview and the hint.
9. **Update the `point` hint** to advertise the gesture, and the two e2e assertions that
   pin that string.
10. **Verify**: `npm run typecheck`, then the full suite plus the upgrade check.

## Sequencing note

Steps 1 and 2 come first because both could have changed the shape of everything after
them. Step 2 in particular nearly went the other way — see `context.md`.
