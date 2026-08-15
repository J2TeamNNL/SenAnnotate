# Hide until restart

## What

A switch in the settings card's *Behaviour* group that hides the whole overlay in the
current tab until that tab is closed. Reloads of the same tab stay hidden; other tabs are
untouched.

## Why

A demo, a screen-share, or a screenshot sometimes needs the page clean without turning
the extension off everywhere and losing it on every other tab. "Off on this one, for
now" had no control.

## The one real decision: where the flag lives

Not in `Settings` / `chrome.storage`. Those stores are the wrong shape:

- `sync` or `local` would hide the overlay in **every** tab — the opposite of the ask.
- The state is per-tab and per-session, not a preference that should follow the user.

`sessionStorage` (`HIDDEN_KEY` in `shared/protocol.ts`) is exactly this scope: one tab,
survives that tab's reloads, gone when the tab closes — which is what "restart" is taken
to mean here. The page can read and clear the key; it guards a UI preference, nothing
worth guarding.

## Behaviour

- Flipping it hides the host immediately and writes the flag.
- `installTopFrame` reads the flag before the first paint and, when set, hides the host
  and returns — so a hidden tab never builds the toolbar on reload.
- There is **no in-tab way back**, by design: bringing it back would need a visible
  control, and the whole point is that nothing is visible. Close the tab, or clear the
  `sessionStorage` key from devtools.
- The control is not in the `switches` map and is not a `Settings` key — it is a button
  wearing a switch's clothes, and flipping it hides the card it sits in, so it is never
  seen in its "on" state.
