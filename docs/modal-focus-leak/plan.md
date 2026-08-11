# Plan

Baseline first: both patterns measured against the current build, with real keystrokes, so
the fix has something to be measured against. Done before any code changed — the numbers are
in `context.md`.

## 1. Fixture — `test/fixtures/modal-focus.html`

Two dialogs in one file, each with the document-level listener its pattern implies:

- `#backdrop-close` — deferred `focusout` check, closes when focus is no longer inside
- `#backdrop-restore` — `focusin` check, calls `.focus()` back on the dialog

A `window.__focusLog` records which listener fired, so a failure names the mechanism.

Kept separate from `modal.html` so the pointer fixture stays about pointers, and each
variant gets its own **page** in the suite — two document-level listeners in one document
would observe each other's dialogs.

## 2. Fix — `src/content/ui/root.ts`

Extends the containment block added by the pointer half; same seam, same host.

1. `mousedown` → `preventDefault()`, skipping `input, textarea, select, [contenteditable]`
   via `composedPath()[0]`. Cancels the focus move; `click` still fires.
2. `focusin` / `focusout` → `stopPropagation()`, so a page's focus trap never learns that
   focus arrived in our composer.

## 3. Checks in `test/e2e.mjs`

Variant A: inspect, freeze and the panel each leave it open; then annotate it and assert the
**report** names the dialog's element, since the dialog itself does close at that point.

Variant B: a toolbar click trips nothing (`__focusLog` empty), the modal survives being
annotated, and a note typed with **real keystrokes** arrives in the composer. `fill()` is
explicitly not used and the reason is in the test.

## 4. Verify

Full suite, plus `npm run typecheck`. The composer and panel are downstream of a cancelled
`mousedown`, so the existing composer checks are the regression net that matters most.

## 5. Record

`changelog.md`: the before/after numbers, the `fill()` measurement that hid the real bug, the
unfixable case with the options rejected, and the accepted shortcut behaviour change.
