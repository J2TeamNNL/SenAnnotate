# Plan — toolbar close (X) + icon restore

## Files touched

| File | Change |
|---|---|
| `src/content/index.ts` | `hidden` flag, `setHidden()`, `onClose` callback, `toggle-inspect` guard, `keydown` guard |
| `src/content/ui/toolbar.ts` | `onClose` in `ToolbarCallbacks`, `closeButton` field and DOM node |
| `src/content/ui/root.ts` | `setHidden(hidden: boolean)` on `UiRoot` interface and implementation |
| `src/content/ui/styles.css` | `:host([data-hidden])` rule; `.tool--close` and `.tool--close:hover` styles |

No changes to `background/`, `popup/`, `inspector/`, or `shared/` — the message protocol
already has `toggle-inspect` and the content script handles the guard locally.

## Implementation steps

1. **`toolbar.ts`**: Add `onClose(): void` to `ToolbarCallbacks`. Add `closeButton` private
   field. Build button with class `tool tool--close`, aria-label, `icon("close", 17)`.
   Insert after `collapseButton` in the `bar`. Add to tooltip loop.

2. **`root.ts`**: Add `setHidden(hidden: boolean): void` to `UiRoot` interface. Implement as
   `host.toggleAttribute("data-hidden", hidden)`.

3. **`styles.css`**: Add `:host([data-hidden]) { display: none !important; }` after the base
   `:host` block (before dark-theme override). Add `.tool--close` (muted colour) and
   `.tool--close:hover` (red tint) after `.tool--brand[aria-pressed="true"]`.

4. **`index.ts`**:
   - Add `let hidden = false;` with explanatory comment distinguishing from `HIDDEN_KEY`.
   - Add `setHidden(next: boolean)` that deactivates inspect, closes panel/composer/overlay
     on hide; calls `ui.setHidden(hidden)` and `render()`.
   - In `createTopUi()` toolbar callbacks: add `onClose: () => setHidden(true)`.
   - In `toggle-inspect` handler: if `hidden`, call `setHidden(false)`, respond, return.
   - In `keydown` handler: if `hidden`, return early.

## Interop with "Hide until restart"

No code changes to "Hide until restart". The two controls are independent:
- `HIDDEN_KEY` path exits `installTopFrame()` before any UI is built. X never exists.
- X path uses `data-hidden` attribute; does not touch `sessionStorage`.

The only coordination point is the `toggle-inspect` handler: it already existed and
both controls feed through it, so the X guard (added in step 4) sits above the
existing `setActive(!active)` call.

## Test coverage (additions to `test/e2e.mjs`)

New checks in a dedicated fixture block (to avoid count-assertion pollution):

- `✕` button present in toolbar and clickable
- After X-click: overlay host has `data-hidden` attribute
- After X-click: `.toolbar`, `.panel` not visible in page
- After reload: overlay is visible again (no `data-hidden`)
- After X-click, icon click (simulate `toggle-inspect`): overlay visible, inspect off
- After icon-restore: second icon click toggles inspect on
- While X-hidden: `H` keydown does not change collapse state
- "Hide until restart" still hides and survives reload (regression check)
