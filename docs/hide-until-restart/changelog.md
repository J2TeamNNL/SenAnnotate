# Changelog

## Shipped

A per-tab "Hide until restart" switch in the settings card. `sessionStorage`-backed, so
it survives the tab's own reloads, never touches another tab, and clears on close.

`HIDDEN_KEY` in `shared/protocol.ts`; `hideUntilRestart()` / `isHiddenThisSession()` in
`index.ts`; the row is a `data-action` control outside the `Settings` model because the
state is per-tab, not a synced preference.

## The one wrong turn

The first assertion — "hide-until-restart hides the whole overlay in this tab" — failed
while the two that followed it (survives a reload, other tabs unaffected) passed. That
pattern said the mechanism worked and the assertion was miscounting, not that hiding was
broken.

It was: the assertion checked `.settings` **count === 0**, but hiding sets `display:none`
on the host without removing the card node, and Playwright's `count()` counts hidden
nodes. Switched to a visibility check, which is what "hidden" actually means here. Same
class of mistake as the `.marker` one in `docs/toolbar-settings/` — a hidden element is
present, not gone.

## Verification

```
210/210 e2e, 9/9 upgrade
```

Four new assertions: hides this tab, survives its reload, leaves another tab showing the
toolbar, and clears the way closing the tab would.
