# Changelog

## What was actually wrong

`docs/modal-focus-leak/` fixed one half of the focus-trap problem and — reading its own
conclusion again — described the other half as unfixable: *"a dialog's own `focusout` fires on
the dialog, not in here, so there is no event of ours to stop."* That sentence is true, and
the conclusion drawn from it was wrong. It assumed the only thing a page does on `focusout` is
**close**. Reka UI, Radix and Headless UI use it to **restore focus**, which is the failure the
user reported: composer open, element and component chain correct, textarea takes no typing.

Measured, before the fix:

```
focus log:  trap:focusout related=div      ← our host, retargeted across the shadow boundary
activeElement after the composer opened:  button#trap-swatch
textarea holds ""
```

The trap fires once, before the first keystroke, and every character then goes to the dialog.

## The seam

Every implementation of this pattern carries the same early return:

```js
if (relatedTarget === null) return;
```

It has to: a null `relatedTarget` means focus left the document — a tab switch, or Chrome
removing the focused node — and a trap that fought that would fight the browser. So instead of
stopping an event we cannot reach, `takeFocus()` changes which event the page sees: blur the
page's element first, *then* focus ours. The page's element receives the same `blur` it was
going to receive anyway; only `relatedTarget` differs, and that one difference is the one the
trap is obliged to ignore.

After:

```
focus log:  (empty — the trap never fires)
activeElement:  div (our host)
textarea holds "Typed inside a focusout trap."
```

## Where it is used

`Composer` (constructor, `focus()`, `selectKind()`, the empty-note bounce), `ShotEditor`, and
`copyText`'s `execCommand` fallback. That last one is the same bug with a quieter symptom: a
trap steals focus back between `focus()` and `select()`, `execCommand("copy")` returns `false`,
and the report silently fails to copy on exactly the pages where the clipboard API was already
unavailable.

## Results

```
217/217 e2e checks (was 212 — five new)      9/9 upgrade checks      typecheck clean
```

The five new ones are variant C of `test/fixtures/modal-focus.html`: Reka's two handlers
ported line for line, including the swatch that gives `lastFocusedElement` a value, since
without it `focus(null)` is a no-op and the bug does not reproduce.

The typing check deliberately does **not** click the textarea first, unlike variant B's: the
composer autofocuses, and the whole bug lives between that autofocus and the first keystroke.
Clicking would paper over it by re-focusing after the theft.

## What is still not covered, and what would cover it

`focus-trap` (the library) listens `focusin` with `capture: true` on `document`. A capture-phase
listener runs *before* the event reaches our host, so the `focusin` guard in `createUiRoot`
cannot stop that one either — and blurring first does not help, because the theft is keyed on
our arrival rather than on the page's departure.

The answer for that variant is not a fifth listener: it is to make our host a DOM descendant of
the dialog, exactly as `docs/modal-top-layer/` already does for `dialog.showModal()`, so
`container.contains(target)` is simply true. It was not done here because a page's dialog
routinely sets `overflow: hidden` or `contain: paint`, which would clip the toolbar and the
composer to the dialog box — a worse bug than the one being fixed, shipped to every page that
has a modal. Deferred with the reason recorded rather than guessed at again later.

## Note for the next reader

The reason the suite could not see this for two releases is that its fixture implemented the
`focusin` half only. A fixture that reproduces "a focus trap" in general does not exist —
there are two triggers, and a trap can use either.
