# Context

## The toolbar as it stands

`src/content/ui/toolbar.ts` builds two nodes into `ui.cardLayer`:

- `.toolbar-dock` — `position: fixed; bottom: 20px; right: 20px`, a column holding the
  hint line above the pill.
- `.toolbar` — the pill itself: stack badge, brand button, mode group (shown only
  while inspecting), divider, freeze, panel + count badge.

`Toolbar.update(state)` is called from `render()` in `src/content/index.ts` on every
state change. `Toolbar.setHint()` deliberately bypasses `render()` because a marquee
drag rewrites the hint at animation-frame rate.

## Constraints discovered while reading the code

**`.toolbar` must stay visible.** Ten e2e scenarios open with
`page.locator(".toolbar").waitFor({ state: "visible" })`. So collapsed cannot mean
"hide the pill" — the pill has to *become* the handle, with its children hidden.

**Inline styles beat the stylesheet.** `update()` sets `display` inline on the stack
badge, the mode group, the count badge and the hint (`this.hintElement.style.display
= ...`). A `[data-collapsed]` rule therefore needs `!important` to win: an author
`!important` declaration outranks a normal declaration in a `style` attribute.

**Hotkeys are gated on `active`.** The `keydown` listener in `index.ts` returns early
when inspect mode is off, so `1/2/3/f/a` only work while inspecting. Collapse must be
handled *above* that guard — the pill covers content whether or not you are
inspecting. The other guards (typing into an input/textarea/select/contentEditable,
any Cmd/Ctrl/Alt modifier, composer open) still apply.

**Settings already sync across tabs.** `onSettingsChanged` in `storage.ts` fires on
`chrome.storage.sync` changes and `index.ts` re-renders from it, so persisting the
collapsed state also propagates it to every open tab for free.

**`chevron` already exists.** `PATHS.chevron` in `ui/dom.ts` points down; CSS
`rotate(-90deg)` turns it into a `»` (down rotated counter-clockwise points right in
a y-down coordinate system). No new icon path is needed — the collapsed handle reuses
`PATHS.s`, the brand mark.

## Relevant files

| File | Change |
|---|---|
| `src/shared/types.ts` | `Settings.toolbarCollapsed` + default |
| `src/content/ui/toolbar.ts` | collapse button, `collapsed` in `ToolbarState` |
| `src/content/ui/styles.css` | `[data-collapsed]` / `[data-inspecting]` rules |
| `src/content/index.ts` | `onToggleCollapse`, the `h` key, pass state down |
| `test/e2e.mjs` | new "Collapse" scenario |
| `README.md`, `TESTER-GUIDE.md` | the `H` shortcut |
