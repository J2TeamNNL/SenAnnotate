# Context — why our own clicks reach the page

## The measurement

A throwaway fixture with three modals, each using a different dismissal pattern, driven
through the real extension. State recorded after every step rather than only at the end,
so the step that dismisses is unambiguous:

```
=== outside-click modal (document mousedown, !dialog.contains(target))
      1 open modal:     open=true  froze=false
      2 click Inspect:  open=false froze=false     ← dismissed here
      3 press F:        open=false froze=true
      close log: ["outside:mousedown target=div"]

=== animated modal (opacity from an animation with fill-mode: forwards)
      1 open modal:     open=true  froze=false
      2 click Inspect:  open=true  froze=false
      3 press F:        open=true  froze=true      ← survives the freeze
      4 click Freeze:   open=true  froze=false

=== focus-trap modal (closes when focus leaves the dialog)
      1 open modal:     open=true  froze=false
      2 click Inspect:  open=false froze=false     ← dismissed here too
      close log: ["focus:focusout active=div"]
```

Three things this settles:

1. **Freeze is not the cause.** Pressing `F` froze the page (`froze=true`) and dismissed
   nothing. The report named freeze because freeze is what you press with a modal open.
2. **A toolbar click is the cause.** `target=div` in the close log is our shadow host: the
   page's listener received a `mousedown` whose retargeted target is outside the dialog.
3. **The freeze stylesheet is safe for animated content.** `animation-play-state: paused`
   plus `transition-duration: 0s` left a modal whose opacity comes from a forwards-filling
   animation fully visible. This was the other plausible suspect and it is cleared —
   worth recording, because "freeze blanks animated content" is the bug this design would
   be expected to have.

## Why the events leak

The overlay is one shadow host on `documentElement` (`src/content/ui/root.ts`). Mouse,
pointer and touch events are `composed: true`: they cross the shadow boundary and continue
to `document`, retargeted to the host so the page cannot see into our internals.
Retargeting is what makes the leak *harmful* rather than merely visible — the page is told
the click happened on a `<div>` at the top of `documentElement`, which is outside every
dialog on the page.

The capture-phase handlers in `src/content/index.ts:552-586` swallow page-directed clicks
while inspect mode is on, but both begin:

```ts
if (isOurUi(event.target as Element)) return;
```

That early return is correct — those handlers must not cancel our own buttons — but it
means our own events are precisely the ones that continue to the page untouched.

`stopPropagation()` cannot be added to those handlers: they are on `document` in the
**capture** phase, which runs *before* the event reaches our shadow root, so stopping there
would kill our own buttons instead. The stop has to happen at the host in the **bubble**
phase, after the inner handlers have run and before `document` sees it.

Precedent already in the codebase: `markers.ts:49` stops propagation for pin clicks, and
`composer.ts:137` stops all keystrokes so page shortcuts never see them. The intent — our
UI is not the page's UI — was already established; the toolbar, panel and toast simply were
never covered, and `markers.ts` covers only `click`, not the `mousedown` that most
dismissal listeners actually watch.

## Which events have to be stopped

Dismissal listeners in the wild do not agree on an event:

| Pattern | Listens on |
|---|---|
| Hand-rolled "click away" | `mousedown` or `click` on `document` |
| Radix / Headless UI | `pointerdown` |
| MUI `ClickAwayListener` | `click` + `touchend` |
| Bootstrap backdrop | `click`, but on the modal container — unaffected by us |

So the set is `pointerdown`, `pointerup`, `mousedown`, `mouseup`, `click`, `dblclick`,
`contextmenu`, `touchstart`, `touchend`.

Deliberately **not** stopped:

- **`pointermove` / `mousemove`.** Not a dismissal trigger, and the hover-highlight path in
  `index.ts` uses `elementFromPoint` rather than the event target, so nothing of ours needs
  it either way. Stopping a high-frequency event for no measured reason is cost without
  benefit.
- **Keyboard events.** `keydown` on `document` is what implements `f`, `a`, `h` and `1/2/3`.
  Focus sits inside our shadow root after any toolbar click, so stopping keystrokes at the
  host would disable every shortcut the moment the toolbar was used. The composer already
  stops keystrokes locally, which is the correct scope.
- **`focusin` / `focusout`.** Stopping these at the host cannot help: when focus leaves the
  page's dialog, the `focusout` originates on the *dialog*, not inside our shadow root, so
  it never passes through our host.

## The focus-trap case, and why it is out of scope here

The third fixture — a modal that closes when focus leaves it — is dismissed by the same
toolbar click, but through focus rather than through the pointer event, so the propagation
fix does not address it. Mitigating it means not taking focus at all
(`preventDefault()` on `mousedown` over the toolbar).

That is a genuinely separate change, and it cannot be complete: the composer contains a
`<textarea>` the user has to type a note into, so annotating anything inside a
close-on-focus-loss modal will always dismiss it. Half a fix for a pattern that real focus
traps mostly implement as *restore* focus rather than *close* — `focus-trap`, Radix and
Headless UI all restore — so it is recorded here and left for its own task rather than
bundled in.

## Constraints on the fix

- It must sit at the host, in bubble phase, so our own listeners still run first.
- It must not use `stopImmediatePropagation` — sibling listeners on the host itself
  (present or future) are ours and have no reason to be cut off.
- It belongs in `createUiRoot`, the one place every piece of UI is already funnelled
  through, so a future card added to `cardLayer` inherits it without knowing this bug
  existed.
