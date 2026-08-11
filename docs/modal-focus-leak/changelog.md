# Changelog

## What was found

The pointer half of this bug was fixed in [`../modal-click-leak/`](../modal-click-leak/),
which recorded the focus half as "a narrow pattern, and a partial fix at best" and left it.
Measuring it properly changed that assessment: the second variant was **worse than the
reported bug**, not narrower.

- **Close-on-focus-loss modal** — dismissed by the first toolbar click, as expected.
- **Focus trap that restores focus** — the modal survived, so it looked fine. It was not:
  the trap pulled focus back to the dialog between keystrokes, so a note typed into the
  composer went into the dialog and the textarea stayed **empty**. The extension appeared to
  work and silently dropped the user's note.

That second one is the shape real libraries use — `focus-trap`, Radix and Headless UI all
restore focus rather than close — so the pattern dismissed as narrow was in fact the common
one, and the reason it was dismissed was that it did not *look* broken.

## The measurement that nearly hid it

The first pass at variant B used Playwright's `fill()` and reported the composer holding
`"typed note"` — a pass. `fill()` sets the value over CDP in a single shot, so it is immune
to a page stealing focus between characters, which is exactly the failure. Re-measured with
`keyboard.type()`, the composer held `""`.

The regression check uses real keystrokes and carries that reason in a comment, because the
cheaper assertion is the one a future edit would reach for.

## The fix

Both parts extend the containment block in `createUiRoot`, at the same host and the same
bubble-phase seam as the pointer fix.

**`mousedown` → `preventDefault()`.** Focus is the default action of `mousedown`, so
cancelling it keeps `document.activeElement` in the page's dialog. `click` still fires, so
every button works. Text fields are exempt via `composedPath()[0]` — `event.target` is
retargeted to the host and would hide which inner element was hit — or the composer's
textarea would be neither focusable by click nor caret-placeable.

**`focusin` / `focusout` → `stopPropagation()`.** A trap watching `focusin` on `document`
never learns that focus arrived in our shadow root, so it stops fighting the composer.

## Results

```
                                    before              after
A  toolbar click                    dismissed           survives
A  annotating                       —                   dialog closes (unavoidable),
                                                        note typed, report correct
B  toolbar click                    trap fired          trap never fires
B  note typed with real keystrokes  ""                  "Typed inside a focus trap."
```

`116/116` checks pass, up from 107. `npm run typecheck` clean.

## The case that stays broken, deliberately

A modal that closes when focus leaves it **still closes when the composer opens**. The
composer autofocuses its textarea — typing the note is the point — and the dialog's own
`focusout` fires on the dialog, never travelling through our host, so there is no event of
ours to stop.

Three alternatives were considered and rejected: not autofocusing (only defers it to the
user's click, and degrades every other page), focusing without moving `activeElement` (not a
thing — one focused element per document, and a shadow-root focus reports as its host), and
hand-routing keystrokes to an unfocused textarea (reimplements caret, selection and IME to
paper over one pattern).

So the guarantee was scoped instead of faked: the annotation is captured in
`beginAnnotation()` *before* the composer opens, so element, DOM path, selector and report
are complete whether or not the dialog is still on screen. A check asserts exactly that
rather than asserting the dialog stays open, which would be a lie.

## Accepted side effect

Focus now stays wherever the page had it, so if a page had a text input focused, pressing
`f` / `a` / `h` after a toolbar click types into that input instead of firing the shortcut —
the `keydown` handler bails on form fields by design. Accepted: it is the same behaviour
`Alt`+`Shift`+`S` has always had with an input focused, the toolbar buttons cover every
shortcut, and the only workaround — blurring the page on a toolbar click — is the focus theft
this task removed.
