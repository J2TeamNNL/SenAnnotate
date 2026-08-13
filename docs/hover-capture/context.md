# Hover capture — context

## The existing hover path

`content/index.ts` already maintains everything needed:

```ts
let hoveredElement: Element | null = null;   // set on pointermove, point mode only
```

`pointermove` → `document.elementFromPoint(clientX, clientY)` → `eligible()` →
`updateHover(target)`, which sets `hoveredElement` and paints the highlight. On a
non-eligible target it clears `hoveredElement` back to `null`.

So the trigger is three lines in the existing `keydown` handler. The work in this task
is not the capture — it is everything around the capture that has to keep the page's
hover state alive.

## What can destroy the hover state

**1. Moving the pointer.** Out of our control, and the point of the feature: the user
does not move it. Nothing to do.

**2. Focus.** The composer's `textarea` calls `.focus()` in its constructor. A menu
held open by `:focus-within` on the trigger collapses at that moment.

This one is already understood in this codebase — `docs/modal-focus-leak/changelog.md`
records the same problem for dialogs and the conclusion that matters here:

> Typing requires focus, so that one is not solvable — but the annotation is captured
> before the composer opens, so the report is complete either way.

That holds exactly as well for a menu. `captureDraft()` runs to completion — name,
selector, DOM path, computed styles, component ancestry, bounding box — **before** the
composer is constructed. If the menu evaporates when the textarea takes focus, the
annotation still describes the menu item correctly. The only visible loss is the
highlight, which is drawn from stored boxes and will point at where the menu *was*.

**3. Our own keydown handler.** `keydown` is listened for on `document` with no
`capture`, and the handler does not `preventDefault()`. A page that treats `c` as a
shortcut would act on it too. Guarded the same way the existing keys are: the handler
already returns early for `input`/`textarea`/`select`/`contenteditable` targets and for
any modifier combination. Beyond that, a single letter colliding with a page shortcut
while inspect mode is explicitly on is an acceptable, visible outcome — and `Enter` is
offered as the alternative.

## Why `C`, and why also `Enter`

The taken keys are `1`, `2`, `3`, `f`, `a`, `h`, `Escape`. `c` is free, mnemonic
("capture"), and adjacent to nothing destructive.

`Enter` is added because it is what a person tries first, and because it costs one more
`case`. It is *not* offered while the composer is open — the composer stops its own
keyboard events (`ui/composer.ts:136`), so there is no conflict with ⌘/Ctrl+Enter.

## The hint line

`ui/toolbar.ts` holds:

```ts
const MODE_HINTS: Record<InspectMode, string> = {
  point: "Click an element · 2 text · 3 area",
  …
```

`test/e2e.mjs:449` asserts that string **exactly**:

```js
((await hint.textContent())?.trim() ?? "") === "Click an element · 2 text · 3 area"
```

So changing the hint means changing that assertion in the same commit. Noted here
because the CLAUDE.md warning about the e2e suite asserting on shadow-DOM class names
applies to its text content too.

New hint: `Click an element · C captures hover · 2 text · 3 area`.

## A limitation worth stating

`document.elementFromPoint` returns the **topmost** element at the pointer. Inside an
open dropdown that is the dropdown item, which is what we want. But for a tooltip
rendered in a portal *offset* from the pointer, the pointer is over the trigger, not the
tooltip — pressing `C` annotates the trigger. That is defensible (the trigger is what
owns the tooltip) and there is no better answer without a "pick from stack" UI, which is
out of scope.
