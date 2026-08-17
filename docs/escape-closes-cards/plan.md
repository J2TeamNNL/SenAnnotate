# Plan

1. Add the settings-card branch to the Escape chain, after the composer.
2. Add the panel branch, after the pick set.
3. Move tooltip dismissal into the chain: export `isTooltipVisible()` from `tooltip.ts`, drop
   the trigger-level keydown listener there, and ask before the card branch.
4. Checks in `test/e2e.mjs`'s settings block:
   - Escape closes the settings card
   - dismissing a tooltip does not close the card under it
   - Escape closes the annotations panel
   Each leaves the block's state as the code below it expects — the card open, since the next
   `gear.click()` is written to close it.
5. `README.md`: spell the order out in the keybinding table rather than leaving `Esc` as
   "Cancel / exit".
6. Verify: `npm run typecheck`, then the full suite plus the upgrade check.

## Not done, deliberately

**The shot editor.** It handles its own Escape (it owns focus while it is open) and closing it
hands focus back to the composer. Routing it through the chain would mean the chain knowing
about focus ownership for no behavioural gain.
