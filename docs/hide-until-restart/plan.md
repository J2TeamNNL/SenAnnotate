# Plan

1. **Settle where the flag lives before writing anything** — it is the only real
   decision. Per-tab, reload-surviving, auto-clearing → `sessionStorage`, not
   `chrome.storage`.
2. **Write the failing e2e first**: hiding removes the overlay from this tab; the hide
   survives a reload of the same tab; a different tab still shows the toolbar; and the
   flag can be cleared the way closing the tab would.
3. **Add `HIDDEN_KEY`** to `shared/protocol.ts`, beside the other storage keys, with the
   reasoning for the different store.
4. **Add the row** to the settings card as a non-`Settings` action (`onHideUntilRestart`,
   `data-action`), in the *Behaviour* group.
5. **Wire it** in `index.ts`: `hideUntilRestart()` writes the flag and hides the host;
   `isHiddenThisSession()` reads it; `installTopFrame` checks it before the first paint
   and returns early when set.
6. **Verify** the whole suite plus upgrade.

## Rejected

- A `chrome.tabs`-scoped or in-memory flag (see `context.md`).
- An in-tab un-hide control — it contradicts the feature.
