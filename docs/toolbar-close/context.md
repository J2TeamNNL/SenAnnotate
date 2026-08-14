# Context — hide the whole overlay

## What this deliberately does not do

The request behind this was "only show the toolbar after clicking the extension
icon" — the overlay hidden by default on every page, revealed on demand.

That was cut. Making the icon a toggle means giving up `default_popup`, and 0.6.0 had
just turned the popup into a real control surface: the session report across every
annotated page, JSON export/import, the list of pages holding notes. Relocating all of
that to an `options_page` is a large change to the newest code in the repo, and it is
not what the `✕` was asked for.

So the toolbar still appears on every page, and this ships the half that stands on its
own: a way to make it go away completely. If hidden-by-default is still wanted, the
cheap version is a `Show toolbar` button in the popup plus a default of hidden — it
reuses everything here and touches nothing 0.6.0 built.

## Why hiding is session state and not a setting

Every other display preference here is persisted: `toolbarCollapsed` survives a reload
precisely so that a reload does not put the pill back over the corner you were
looking at.

The `✕` is the opposite case. Persisted, it becomes a way to switch the extension off
that looks like a window control, sits one click from the buttons you use constantly,
and leaves no visible trace to undo — the next page would come up blank and the only
route back is a popup you have no reason to open. A reload restoring it is the
property that makes a one-click, no-confirmation control safe.

That also settles what "hide" may touch: annotations are stored and come back with the
page, so hiding must not be able to remove them. `clear-on-copy/context.md` sets the
rule this inherits — only the panel's **Clear all** and the clear-on-copy setting ever
delete a note.

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
nothing about.

## The way back

Three routes, in order of how likely they are to be found: reload the page, the
popup's **Start inspecting**, and <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd>.

Both message-driven routes go through the same `toggle-inspect` handler, which now
unhides before it does anything else. Without that the popup button would appear to
do nothing — it would turn inspect mode on behind an invisible overlay.

## Keystrokes are dead while hidden

The document `keydown` handler returns early. `H` is the one that matters: it sits
*above* the `active` guard by design, so without this it would keep toggling a
collapse on an overlay nobody can see — and the state is persisted, so the pill would
come back after a reload in a shape the user never chose.
