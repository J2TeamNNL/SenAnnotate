# Brief — toolbar close (X) + icon restore

## What

A `✕` at the right end of the toolbar pill that takes the entire overlay off screen —
toolbar, panel, markers and highlights — until the page is reloaded or the extension
icon brings it back. Annotations are untouched.

This is a revival of closed PR #6, rebased onto 0.8.4 and extended to interoperate
with the "Hide until restart" setting that shipped in its place (PR #11).

## Why

`toolbar-collapse/` gave the pill a smaller form, and `draggable-toolbar/` lets it
move out of the way. Neither covers the case where the extension should not be on
screen **at all**: demonstrating the page to someone, screenshotting the product
itself, or checking a layout against a design where a floating pill in the corner is
the difference.

Collapsing leaves a handle. The handle is the point of collapsing — it is how you get
back — so it cannot also be the answer to "nothing on screen, please".

The markers are the other half. They belong to the annotations rather than to the
toolbar, so neither collapsing nor dragging touches them, and a page with eight
numbered pins on it is not a page you can screenshot.

## Relationship to "Hide until restart"

Two separate controls, two separate scopes:

| Control | Scope | State | Way back |
|---|---|---|---|
| **X button** (this feature) | Page-load only | In-memory `hidden` flag | Reload, or click extension icon |
| **Hide until restart** (Settings) | Tab session | `sessionStorage` (`HIDDEN_KEY`) | Close the tab |

They cannot conflict: "Hide until restart" causes an early return from
`installTopFrame()`, so the toolbar (and therefore the X button) is never set up when
that flag is active.

## Scope

In:

- A `✕` button, last in the pill, hiding the whole shadow host via `data-hidden` attribute.
- Leaving inspect mode, closing the panel and the composer, dropping highlights on hide.
- Return via a page reload, or the extension icon (**Start inspecting** / keyboard
  shortcut) — clicking the icon when X-hidden shows the overlay without toggling inspect.
- Keystrokes dead while X-hidden (guards the `keydown` handler).

Out:

- **Persisting the hidden state.** Deliberately session-only, reset on reload.
- **Clearing annotations.** `clearAll` and clear-on-copy remain the only two controls.
- **Conflicting with "Hide until restart".** That control is respected as-is.

## Success criteria

- One press removes every trace of the extension from the page.
- The annotations survive a hide-and-reload: count unchanged.
- Clicking the extension icon when X-hidden shows the overlay (does not toggle inspect).
- Clicking the icon again then toggles inspect normally.
- While X-hidden, `H` does nothing (collapse state not mutated behind the curtain).
- "Hide until restart" still works independently.
