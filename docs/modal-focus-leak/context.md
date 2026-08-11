# Context — focus, and what cannot be fixed

## Measured before and after

Same method as the pointer half: state recorded after every step, on a fixture per pattern.

```
=== A. close-on-focus-loss              before            after
1 opened                                open=true         open=true
2 clicked Inspect                       open=FALSE        open=true      ← fixed
                                        log=[focusout]    log=[]
3 clicked an element in the dialog       —                 open=false     ← unavoidable
4 typed a note                          —                 composer holds "typed note"

=== B. restore-focus trap               before            after
1 opened                                open=true         open=true
2 clicked Inspect                       log=[focusin]     log=[]         ← fixed
3 clicked an element in the dialog       log=[focusin ×2]  log=[]
4 typed a note                          composer holds "" composer holds "typed note"   ← fixed
```

Row 4 of variant B is the one worth staring at. Before the fix the composer was empty: the
page's trap pulled focus back to the dialog between keystrokes, so the note went into the
dialog. **The first measurement of this missed it**, because it used Playwright's `fill()`,
which sets the value over CDP in one shot and passes even while the page is stealing focus.
Only real keystrokes (`keyboard.type`) show the bug — so the regression check uses them, and
says so.

## Why `mousedown` and not something else

Focus is the *default action* of `mousedown`, decided after the event finishes propagating.
So `preventDefault()` anywhere in the path — including bubble phase at our host, where the
pointer containment already lives — cancels the focus move while leaving `click` to fire
normally. This is the standard technique for a toolbar that must not steal focus.

Two details:

- **`composedPath()[0]`, not `event.target`.** A listener on the host sees the target
  retargeted *to* the host, which hides which inner element was hit. The exemption for text
  fields needs the real one.
- **Text fields are exempt.** `input, textarea, select, [contenteditable]` keep their
  default, or the composer's textarea could neither be focused by clicking nor have its
  caret placed. The only cost of the exemption is that panel text can no longer be selected
  by dragging, which nothing depends on.

## Why `focusin` / `focusout` are stopped at the host

A focus trap watches `focusin` on `document` and pulls focus back when it lands outside the
dialog. Our composer's focus lands inside the shadow root and retargets to the host — which
is outside every dialog — so the trap fires. Stopping those two events at the host means the
trap never learns, and the composer keeps focus.

This is safe because nothing in our own code listens for focus events on `document`; the
composer manages its own focus directly.

## What cannot be fixed, and why

**A modal that closes when focus leaves it still closes once the composer opens.**

The composer autofocuses its textarea, because typing a note is the entire point. That moves
focus out of the dialog, and the dialog's own `focusout` fires **on the dialog** — it never
travels through our host, so there is nothing for us to stop. The event we would need to
suppress does not pass through any code we control.

Options considered and rejected:

- **Don't autofocus the textarea.** Only defers it: the user's click into the textarea moves
  focus just the same, and every other page pays for it with a worse composer.
- **Focus the textarea without moving `document.activeElement`.** Not a thing. One focused
  element per document, and a focused node inside a shadow root reports as its host.
- **Route keystrokes to the textarea manually without focusing it.** Reimplements text
  editing — caret, selection, IME, composition — to paper over one modal pattern.

So the guarantee is scoped honestly instead: the annotation is captured in
`beginAnnotation()` *before* the composer opens, so the element, DOM path, selector and
report are all complete whether or not the dialog is still on screen. The dialog closing is
cosmetic at that point. That is what the regression check asserts.

## One accepted behaviour change

Because a toolbar click no longer takes focus, focus stays wherever the page had it. If the
page had a text input focused, pressing `f` / `a` / `h` after clicking a toolbar button now
types into that input instead of firing the shortcut — the `keydown` handler bails on
`input`/`textarea`/`select` by design ("never hijack a key the user is typing into the
page").

Accepted rather than worked around: it is the same behaviour the extension has always had
when inspect mode is toggled with `Alt`+`Shift`+`S` while an input is focused, the toolbar
buttons remain a complete alternative to every shortcut, and the alternative — blurring the
page on toolbar click — is precisely the focus theft this task removed.
