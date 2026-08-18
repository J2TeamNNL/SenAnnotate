# Context

## Tooltips already existed, for the settings card only

`src/content/ui/tooltip.ts` is one node, moved and refilled, installed by `createTopUi` into
the card layer. `attachTooltip(trigger, text)` wires `pointerenter` / `pointerleave` /
`focus` / `blur`. Its own header argued the split that this task removes: the settings card got
the styled tooltip, *"and the toolbar buttons still use [`title=`]"*.

Three things had to change to reuse it on the toolbar:

- **Dynamic text.** The collapse button's label carries the annotation count
  (`Show toolbar (H) — 3 annotations`), rewritten by `applyCollapse` on every state change. So
  `attachTooltip` now also takes `() => string`, read at show time.
- **Placement.** `place()` anchored to the trigger. Inspect mode puts the hint line directly
  above the pill, so a tooltip 6px above a *button* lands on the hint. It now takes its
  vertical anchor from the enclosing `.toolbar-dock` when there is one — above the hint, not on
  it — while keeping horizontal centring on the button so it still points at itself.
- **No double tooltip.** Ours and the native one would both appear, ours instantly and the
  browser's a second later. `title` had to go, which is why the name is now `aria-label`.

## Why `aria-label` and not "keep `title` and strip it on hover"

Stripping the attribute while the pointer is inside is the usual trick and was rejected: the
suite has **37 locators** matching `.tool[title^="…"]`, and Playwright re-resolves a locator
when a click or hover has to be retried. An attribute that disappears under the pointer is an
attribute that disappears mid-retry — a flaky suite with no single-test filter to debug it
with. `aria-label` is a better name for an icon-only button anyway (a screen reader treats
`title` as a last-resort fallback), so all 37 locators moved to `[aria-label^="…"]`, plus one
each in `upgrade.mjs`, `verify-harness.mjs` and `verify-tracer.mjs`.

`.stack-badge` keeps its `title`: it is not a button, its text is a sentence rather than a
name, and an e2e check reads the attribute directly.

## Why the hint stays one line

`.toolbar-hint` was `max-width: 340px; white-space: nowrap`, so the overflow was *visible* and
ran off the right edge — the dock is anchored `right: 20px`, so there was nowhere for it to go.

Wrapping is the obvious fix and is wrong here: the cards above are lifted by a fixed
`bottom: 104px` while inspecting (`.toolbar-dock[data-inspecting="true"] ~ .settings`, from
`docs/panel-clears-hint`), sized for a one-line hint. A second line would put the settings card
back on top of the hint — the exact bug that rule exists to fix, and one the suite checks.

So: widen to `min(520px, calc(100vw - 40px))` — the longest hint measures ~470px at 11px — and
add `overflow: hidden; text-overflow: ellipsis` for a viewport too narrow even for that.
Visibly truncated is a fair fallback; silently off screen is not.

## Files

- `src/content/ui/toolbar.ts` — `aria-label` on all eight buttons, one `attachTooltip` loop.
- `src/content/ui/tooltip.ts` — getter text, dock-anchored placement.
- `src/content/ui/styles.css` — `.toolbar-hint`.
- `test/e2e.mjs`, `test/upgrade.mjs`, `test/verify-harness.mjs`, `test/verify-tracer.mjs` —
  locators.
