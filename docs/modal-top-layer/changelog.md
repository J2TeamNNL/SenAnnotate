# Changelog

## Reproducing it

The report was "cannot add a note while inspecting if a modal is open", with a guess attached:
the modal's z-index covers the note box. Neither existing modal fixture reproduced anything,
which was the first useful fact — both are `div` modals. Two new fixtures were written for the
shapes the suite had never seen:

| Fixture | Result |
|---|---|
| `body { pointer-events: none }` while open (Radix / Reka UI) | Fine end to end. Composer opened, real keystrokes landed, note saved, badge went to 1. |
| `dialog.showModal()` | Broken exactly as reported. Playwright: `<dialog open> from <body> subtree intercepts pointer events`; `elementFromPoint` over our toolbar returned `<dialog>`. |

So the reporter's instinct was right about the symptom and wrong about the mechanism: our host
already carries the maximum z-index and beats every page z-index. It cannot beat the top layer.

## What did not work

Recorded because each looked obviously right first (the table in `context.md` has the
measurements):

- **`popover="manual"` + `showPopover()`** on the host. Screenshotted painting *above* the
  dialog — and still inert. `elementFromPoint` skipped it, `focus()` did not land, real
  keystrokes produced `""`. Inertness is not a paint-order problem.
- **`showModal()` on our own host.** Our UI became fully interactive, and the page's dialog
  went inert in exchange: `elementFromPoint` over the dialog's own text returned `html`. That
  trades away element identification, which is the product.

## The fix

`createUiRoot()` now owns *where* the host lives. While a `:modal` element exists the host is
appended to it, and put back on `documentElement` when it goes. Triggers are a
`MutationObserver` with `attributeFilter: ["open"]` (`showModal()` and `close()` both toggle
it), `fullscreenchange`, a `childList` observer scoped to the modal we moved into (an app that
re-renders the dialog's children would otherwise take the host with it), and `queueSync()`,
which already ran on scroll and resize.

## The part that was missed on the first pass

The first version moved the host and compensated its box back onto the viewport — and the
transformed-dialog case still failed, with no highlight drawn at all. Two symptoms, one cause:
**every piece the overlay draws is itself `position: fixed`** — `.highlight`, `.marquee`,
`.markers`, every `.card`. A fixed box resolves against the *nearest* fixed containing block,
so they all resolved against the dialog no matter what the host's own box said. Measured: the
highlight landed 398px right and 320px below the element it named, and the toolbar was dragged
into the middle of the dialog — where the hover path then correctly refused to highlight our
own UI, which is why nothing highlighted rather than something highlighting wrongly.

The fix for that is one property: `transform: translate(0)` on the host in the compensated
case, which makes the host the containing block those fixed children resolve against. Only in
that case, so the ordinary path stays byte-identical to before.

## Verified

`164/164` in the suite, ten of them new, plus `9/9` in `test/upgrade.mjs`. The new ones assert,
against `test/fixtures/modal-native.html`:

- the toolbar is clickable with a top-layer modal open (before the fix, Playwright timed out);
- the highlight lines up with the element inside the dialog — asserted on a plain dialog *and*
  on a transformed one, which is the check that caught the fixed-children mistake;
- the composer takes **real keystrokes** (`page.keyboard.type`, never `fill()`, which writes
  the value directly and would pass with the composer inert behind the dialog — the trap
  `modal-focus-leak/changelog.md` recorded in 0.5.1);
- both notes save, the count badge reads 2, and the report names both elements;
- the dialog is still open at the end, so 0.5.1's containment survives being inside it.

Also checked by hand and worth knowing: drag-select (area mode) works inside a `showModal()`
dialog now — three elements previewed, `Selection: 3 elements` in the composer — where before
the fix nothing in the overlay responded at all.

## Known limitations

- **A non-modal top-layer element still covers our cards.** An open `popover` is in the top
  layer but is not modal, so it neither inerts us nor gets picked up by `:modal`. It can hide
  the composer behind it. Not fixed here: promoting our host to a popover is a different
  mechanism with its own ordering problem (whoever shows last wins, and the page can always
  show again), and no reproduction of it exists.
- **Nested modals pick the last in document order.** The platform exposes no way to read
  top-layer order. If a page opens a second modal that is *earlier* in the document, our UI
  ends up under it.
- **A dialog that is both transformed and clips overflow will clip our overlay** to its box.
  The compensation puts our coordinates back but cannot escape an ancestor's clip.
- Inherited CSS now comes from the dialog rather than from `documentElement`. `:host` sets
  `all: initial`, which handles it — but a page rule targeting `dialog > div` outranks a
  `:host` rule, so a page could restyle our host in a way it could not before.
