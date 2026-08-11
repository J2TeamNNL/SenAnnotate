# Brief — our UI takes focus off the page's dialog

Follow-up to [`../modal-click-leak/`](../modal-click-leak/), which fixed the *pointer* half
of "the extension dismisses the page's modal" and deliberately left the *focus* half open.
The user asked for the rest.

## What was left broken

Focus is the default action of `mousedown`, so clicking a toolbar button moved
`document.activeElement` into our shadow root. Two consequences, both measured against
fixtures rather than assumed:

| Modal pattern | Before |
|---|---|
| Closes when focus leaves the dialog | dismissed by the first toolbar click |
| Focus trap that restores focus (`focus-trap`, Radix, Headless UI) | modal survived, but the trap fought the composer for focus and **won — every keystroke of the note landed in the dialog and the textarea stayed empty** |

The second one was not in the original report and is the worse of the two: the extension
looked like it worked, and silently dropped the note.

## Scope

**In**

- Toolbar interaction must take no focus at all, so neither pattern is tripped by it.
- The composer must be typeable inside a focus trap.
- Fixtures for both patterns, driven with real keystrokes.

**Out**

- Making a close-on-focus-loss modal survive *being annotated*. Not solvable — see
  `context.md`. What is guaranteed instead is that the annotation and its report are
  correct even when the dialog closes.

## Success criteria

1. Inspect, Freeze, the panel and the collapse handle leave both modals open and trip
   neither the close nor the restore listener.
2. A note typed inside a focus trap arrives in the composer, asserted with real
   keystrokes — `fill()` would pass even while the page steals focus back.
3. Annotating a close-on-focus-loss dialog still produces a report naming its element.
