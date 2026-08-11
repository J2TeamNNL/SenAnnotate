# Brief — collapse the toolbar

## What

Give the floating toolbar a collapsed state: one click (or the `H` key) shrinks the
pill down to a single ~30px handle, and the same gesture brings it back. The
collapsed state is a setting, so it survives a reload.

## Why

The dock sits at `bottom: 20px; right: 20px` and is roughly 330px wide once inspect
mode is on — wider with the hint line above it. Nothing on screen could hide it.
Turning inspect mode off does not help: the pill keeps its brand button, freeze and
panel buttons, so it still covers whatever the page draws in its bottom-right corner
(sticky chat widgets, cookie bars, pagination, footer actions).

That is precisely the region a tester needs to look at while reviewing a page, and
the tool that exists to help them report problems was hiding the problems.

## Scope

In:

- A collapse toggle on the toolbar, and the `H` shortcut for it.
- `toolbarCollapsed` in `Settings`, persisted through `chrome.storage.sync`.
- A visible marker on the collapsed handle when inspect mode is on.

Out:

- Hiding the annotation panel or the markers. The panel already closes with `A`,
  and markers already have a `showMarkers` setting.
- Dragging the toolbar to a different corner.
- A popup checkbox for the collapsed state. Collapsing is an in-page gesture, not a
  preference you would go to the popup to set.

## Success criteria

- The collapsed toolbar occupies a single button's worth of screen and never hides
  its own way back.
- Collapsing changes nothing else: inspect mode, freeze, markers and annotations all
  carry on, and annotating still works while collapsed.
- Reloading the page keeps the toolbar collapsed.
- The existing e2e suite stays green — 10 scenarios wait on `.toolbar` being visible.
