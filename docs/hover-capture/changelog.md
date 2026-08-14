# Hover capture — changelog

## 0. Starting point

Annotating required a click, so every hover-only surface — dropdowns, hover menus,
tooltips, `:hover` styling — was unannotatable. `hoveredElement` was already tracked;
only a non-click trigger was missing.

## 1. The trigger

Three cases in the existing `keydown` switch (`c`, `C`, `Enter`) and a `captureHovered()`
of ten lines. The `isConnected` guard earned its place immediately: a menu that
re-renders between the pointer settling and the key landing leaves a detached node
behind, and capturing one produces a zero-size box with a selector that resolves to
nothing — an annotation that looks fine in the panel and points nowhere in the report.

Pressing it over nothing now toasts `Hover an element first`. Without that the key
reads as broken.

## 2. What the plan got right

The prediction from `context.md` held: focus is the only thing that destroys the hover
state, and it does not matter, because `captureDraft()` completes before the composer
is constructed. The fixture's menu closes when the textarea takes focus and the
annotation still names `li "Billing settings"` correctly.

## 3. The hint line

`MODE_HINTS.point` became `Click an element · C captures hover · 2 text · 3 area`, and
`test/e2e.mjs` asserts that string exactly — so the assertion changed in the same
commit. Worth remembering that the e2e suite pins hint *text*, not just class names.

## 4. Tests

New fixture `test/fixtures/hover-menu.html`, CSS-only (`.menu:hover .menu__list`) so it
cannot flake on animation timing. Four checks: the menu is open with the pointer on it,
`C` annotates the item with no click, the note reaches the report intact, and `C` over
nothing explains itself.

129/129 — all green, first run.
