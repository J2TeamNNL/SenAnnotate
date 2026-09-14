# Context — toolbar close (X) + icon restore

## History

PR #6 implemented the X button against 0.6.x. It was closed unmerged because PR #11
shipped "Hide until restart" (sessionStorage) in its place — the two were seen as
alternatives rather than complements.

This branch (feat/toolbar-close-x) revives the X against 0.8.4 and adds explicit
interop with `HIDDEN_KEY`, so both controls coexist correctly.

## Two hide controls with different scopes

"Hide until restart" lives in `sessionStorage` under `HIDDEN_KEY`. It is a tab-session
control: the flag survives reloads on the same tab, is invisible to other tabs, and the
only way to undo it is to close the tab. `installTopFrame()` reads it on load and
returns early if set — no toolbar is built, no message listener is registered.

The X button's hidden state is in-memory only. A reload starts fresh; the overlay
returns with no action by the user. The extension icon click also brings it back.

These two cannot fight. When "Hide until restart" is active, the tab returned from
`installTopFrame()` before building any UI — the X button does not exist in that tab.

## Why the X is in-memory, not sessionStorage

Every other display preference is persisted: `toolbarCollapsed` survives a reload so
that a reload does not put the pill back over the corner you were looking at.

The X is the opposite case. Persisted, it becomes a way to switch the extension off
that looks like a window control, sits one click from the buttons you use constantly,
and leaves no visible trace to undo — the next page would come up blank. A reload
restoring it is the property that makes a one-click, no-confirmation control safe.

"Hide until restart" is the intentional long-pause control, and it already exists.

## Why the icon restores instead of toggling

When the overlay is X-hidden, clicking the extension icon does one thing: show the
overlay. It does not immediately toggle inspect mode on top.

The mental model: the icon is "give me my extension back". Once you have it back, the
icon's existing inspect-toggle behaviour works as before. A single click that both
showed and toggled would often drop into inspect mode on a page the user only wanted
to look at, and users who hid with X did so precisely because they wanted to see the
page unobstructed.

Implementation: the `toggle-inspect` handler checks `hidden` first. If true, it calls
`setHidden(false)` and returns, sending the current (unchanged) `active` state back.
The second click toggles inspect normally.

## One attribute, not four hides

Everything the extension draws lives under one shadow host. Hiding is
`:host([data-hidden]) { display: none !important; }`, which takes the toolbar, the
panel, the markers and the highlights together.

The alternative — hiding each surface — is four things to keep in step, and the
markers are exactly the one that would be forgotten: they belong to the annotations
rather than to the toolbar, which is why neither collapsing nor dragging affects them.

An **attribute** rather than an inline `display`, because `captureScreenshot` already
owns the inline one. It sets `display: none` on the host so the overlay stays out of
the shot, then *removes the property* — which would silently undo a hide it knew
nothing about. "Hide until restart" uses the inline style; the X attribute approach
deliberately avoids it for this reason.

## Keystrokes are dead while X-hidden

The document `keydown` handler returns early. `H` is the one that matters: it sits
*above* the `active` guard by design (collapsing does not require inspect mode), so it
would otherwise keep toggling `toolbarCollapsed` on an overlay nobody can see — and
`toolbarCollapsed` **is** persisted, so the pill would return after a reload in a shape
the user never chose.

## The way back

1. Reload the page (always works — in-memory state, not stored)
2. Click the extension icon (sends `toggle-inspect`, handler unhides first)
3. Keyboard shortcut <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> (same path)
