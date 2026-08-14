# Plan

## 1. `src/content/ui/root.ts` — placement

One new concern in the module that already owns the host: *where* the host lives.

- `topLayerParent()` — the last `:modal` match, or `null`. Last, because document order is
  not top-layer order and the platform exposes no way to read the real order; with the one
  modal a page actually opens it is exact.
- `place()` — append the host to that parent (or back to `documentElement`), then
  `fitToViewport()`.
- `fitToViewport()` — set `inset: 0`, measure, and if the box is not
  `documentElement.clientWidth × clientHeight` at `(0, 0)`, replace it with an explicit
  `left/top/width/height` that is. Covers a dialog with a `transform`, a `filter` or
  `contain: paint`, which becomes the containing block for our fixed host.
- Triggers, no polling:
  - a `MutationObserver` for `attributeFilter: ["open"]` over the document — `showModal()`
    and `close()` both toggle that attribute;
  - `fullscreenchange`;
  - a `childList` observer on the modal we moved into, so an app that re-renders the
    dialog's children and takes our host with it gets it back;
  - `syncPlacement()` exported on `UiRoot`, for the callers below.
- `destroy()` disconnects both observers and removes the listener.

## 2. `src/content/index.ts` — call it

`queueSync()` (scroll/resize, already rAF-throttled) calls `ui.syncPlacement()`. That covers a
dialog that resizes or animates into place after it opened.

## 3. `test/fixtures/modal-native.html`

A `showModal()` dialog. Its own fixture, not a variant of `modal.html`: the suite shares one
browser context and annotations are keyed on `origin + pathname`, so a page another block has
annotated cannot carry a count assertion (`annotation-triage/changelog.md`).

## 4. `test/e2e.mjs`

A block after the existing modal ones, asserting what the reporter could not do:

- the toolbar is clickable with the modal open (inspect toggles, `aria-pressed` flips);
- a click inside the dialog opens the composer;
- **real keystrokes** — `page.keyboard.type`, never `fill()`, which writes the value directly
  and hides exactly this class of bug (`modal-focus-leak/changelog.md`);
- submit lands, and the report names the element inside the dialog;
- the dialog is still open at the end — the 0.5.1 containment must survive being inside it.

## 5. Verify

`npm run typecheck`, `npm run build`, then the full `npm test` — the two 0.5.1 modal blocks are
the regression surface, and the whole suite shares one context, so it all has to run.
