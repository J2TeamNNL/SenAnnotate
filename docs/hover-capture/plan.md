# Hover capture — plan

Small enough to be one step, but the ordering below keeps each change verifiable.

## 1. The trigger

In `content/index.ts`'s `keydown` switch, alongside `f` / `a` / `1` / `2` / `3`:

```ts
case "c":
case "Enter":
  captureHovered();
  break;
```

```ts
function captureHovered(): void {
  if (mode !== "point" || !hoveredElement) return;
  if (!hoveredElement.isConnected) { hoveredElement = null; return; }
  void beginAnnotation([hoveredElement]);
}
```

`isConnected` matters: a menu that re-renders between the pointer moving and the key
being pressed leaves a detached node in `hoveredElement`, and `captureDraft` on a
detached node returns a zero-size box and a useless selector.

## 2. Discoverability

- `MODE_HINTS.point` → `"Click an element · C captures hover · 2 text · 3 area"`.
- `test/e2e.mjs:449` updated to the new string.
- `README.md` keybinding table gains a row.

## 3. Feedback when there is nothing hovered

Pressing `C` over nothing currently does nothing at all, which reads as a broken key.
Toast `"Hover an element first"` — `ui.toast` already exists and is used for freeze.

## 4. Test

A new block in `test/e2e.mjs` against a fixture with a hover-only menu:

1. hover the trigger,
2. assert the menu is visible,
3. press `C` with no pointer movement,
4. assert `.composer` opened and `.composer__meta` names an element inside the menu.

Needs a fixture addition: a `:hover`-driven menu in `test/fixtures/`. A CSS-only
`.menu:hover .menu__list { display: block }` is enough and cannot flake on timing.

## Verification

```bash
npm run typecheck
SENANNOTATE_PLAYWRIGHT_DIR=… npm test
```
