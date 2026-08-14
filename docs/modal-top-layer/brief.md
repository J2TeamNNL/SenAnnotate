# Brief — a note cannot be added while a native modal is open

## What

Reported: "cannot add a note while inspecting if a modal is open." Follow-up guess from the
reporter: "maybe the modal has a higher z-index and covers the note box."

Measured: with a modal opened by **`dialog.showModal()`**, the whole overlay — toolbar,
composer, highlight — is unreachable. The toolbar cannot be clicked, so inspect mode cannot
even be toggled from it; with inspect already on, a click inside the dialog does open the
composer, but the composer is painted behind the dialog and takes neither pointer events,
focus, nor keystrokes. There is no note to save.

## Why the earlier modal fixes do not cover it

`modal-click-leak/` and `modal-focus-leak/` (0.5.1) fixed the two ways our overlay *disturbed*
the page's dialog. This is the opposite direction: the dialog disturbs us. Both fixtures those
tasks left behind (`modal.html`, `modal-focus.html`) are `div`-based modals, so nothing in the
suite exercised the browser's **top layer**.

## Root cause (confirmed, not inferred)

The reporter's z-index hypothesis is the right shape but the wrong mechanism. Our host already
carries `z-index: 2147483647` — the maximum — and sits after `body` in tree order, so it wins
every z-index comparison. It cannot win against the **top layer**, which is painted above all
z-indexes, and which `dialog.showModal()` and fullscreen enter. Worse, while a modal dialog is
open every element outside it is **inert**: not hit-tested, not focusable, no keystrokes.

## Scope

- Fix: while a `:modal` element exists, the shadow host is placed **inside** it, so it is a
  flat-tree descendant of the modal — in the top layer with it, and not inert.
- `:modal` also matches the fullscreen element, so fullscreen pages come along free.
- Out of scope: page content in the top layer that is *not* modal (an open `popover`) still
  paints over our cards. Not inert, so it can be clicked away; recorded in `changelog.md`.

## Done when

`test/fixtures/modal-native.html` — a real `showModal()` dialog — is annotated end to end by
the suite: toolbar clickable, composer typeable by real keystrokes, report names the element
inside the dialog. Everything the two 0.5.1 tasks assert still passes.
