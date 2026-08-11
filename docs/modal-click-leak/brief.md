# Brief — the toolbar dismisses the page's modal

## The report

> Trên site có modal, khi modal đang mở mà bấm Freeze thì modal của site bị tắt mất, nên
> không thể thêm note cho modal đó.

Paraphrased: with a modal open, using the extension closes the modal, making the modal
impossible to annotate — which is one of the situations the extension exists for, since a
modal is exactly the transient state you cannot photograph and file a ticket about.

## What it actually is

**Not freeze.** Freeze was measured and is innocent. The dismissal comes from *any* click
on our own toolbar, and it happens whether or not freeze is involved — the user noticed it
at Freeze because that is the button you reach for when a modal is open.

Root cause: our UI lives in a shadow root whose host hangs off `documentElement`. Mouse
events are `composed: true`, so a click on a toolbar button propagates out of the shadow
root and up to `document`, where it is **retargeted to the host**. Every site that
dismisses a modal on "a pointer event outside the dialog" — the single most common
dismissal pattern there is — sees our toolbar click as an outside click and closes.

`src/content/index.ts` already swallows page-directed clicks while inspect mode is on, but
it deliberately returns early for our own UI (`isOurUi(event.target)` → `return`), so our
own events are the ones that leak. `markers.ts` stops propagation for pin clicks and
`composer.ts` stops keystrokes; the toolbar, panel and toast were never covered.

## Scope

**In**

- Our own UI must not deliver pointer events to the page. One place: the shadow host.
- A regression test with a modal that dismisses on outside `mousedown`, driven through the
  real toolbar.

**Out**

- The composer stealing keyboard focus from a modal's focus trap. Measured, real, but a
  different mechanism with a different fix — see `context.md`.
- Any change to freeze. It was suspected and cleared.

## Success criteria

1. With a modal open, toggling inspect, freezing, opening the panel and collapsing the
   toolbar all leave the modal open.
2. The toolbar's own buttons still work — the fix must not stop propagation before our own
   handlers run.
3. Page-directed clicks are still swallowed in inspect mode (no regression in the existing
   98 checks).
