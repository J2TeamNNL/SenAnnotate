# Context — clear after copying

## Why this is the only automatic way annotations are destroyed

This landed as the first slice of a larger batch of overlay work, and the batch
originally carried a second destructive path: a close button that also wiped the
annotations, mirroring `agentation`'s `X` — *"Clear all annotations"*.

That was cut deliberately. Annotations persist to `chrome.storage.local` and there is
no undo. A close button is pressed reflexively and often — to see the page underneath,
to get the pill off a cookie bar — and binding a reflex to an irreversible wipe of the
session's work is a trap regardless of how the button is labelled.

So the rule the rest of this batch inherits: **closing, collapsing, leaving inspect
mode and reloading all keep the annotations.** Only two things remove them — the
explicit "Clear all" in the panel, and this setting, which is off until asked for.

Worth noting `agentation` splits them the same way in practice: `Esc` closes the
toolbar, `X` clears, and they are separate keys. The upstream settings panel carries
this feature as **"Clear on copy/send" — *"Automatically clear annotations after
copying"*, default off**, which is where the name and the default come from.

## Only on a confirmed write

`copyReport()` clears inside `copyText().then()`, gated on the resolved boolean, never
before the call. This is not defensive padding: `copyText` has a fallback path for when
`navigator.clipboard` is unavailable or refuses, and it can return `false`. Clearing on
the strength of *having asked* for a copy means the one time the clipboard says no, the
session is gone and there is nothing on the clipboard to paste.

And it clears **a snapshot**, not the live list. `copyReport()` holds the array the
report was built from, and hands its ids to `wipeAnnotations(only)`; the count in the
toast comes from the same snapshot. Two things fall out of that, and both are the point:

- By the time the toast is written the list is empty, so a count read *there* would say
  `Copied 0 annotations` about a copy that had just succeeded.
- An annotation filed while the clipboard write was in flight was never in the report.
  Truncating the list would destroy work the copy never handed over — the one outcome
  this feature exists to avoid — and the toast would understate what it took. Every path
  to a new annotation runs through the composer's `onSubmit`, which *replaces*
  `annotations` rather than mutating it, so holding the array is a real snapshot.

The composer follows the same rule, and needed one piece of state to do it:
`composerEditing`, the annotation an open composer is editing, or `null` for a new draft.
An **editor** whose annotation the clear just removed has nothing to save back to, so it
closes with it. A composer holding an **unsaved draft** stays — that draft was never in
the report, and a clear that scopes itself to what it took cannot then take the one thing
it did not. The comparison is by id, not identity: a merge from the popup's import
replaces the objects in the list.

Closing the composer used to be unconditional, which quietly did one useful thing besides:
it hid the overlay highlights. The panel's hover preview is why that matters — the row the
pointer is over is about to be removed, and a removed element never sends the `mouseleave`
that would take its box off the page. So the highlights are still hidden whenever no
composer is left to own them.

The diagnostics and the action trail are cleared regardless of what survives. They
describe the report that was handed over, and the reason for dropping them — steps from
a bug already filed must not attach to the next one — does not change because something
arrived late.

## Copy only, not download

0.6.0 added `downloadReport()` — the same Markdown as a `.md` file, for reports too
large to be worth pasting. Clearing deliberately does not follow it.

The argument for including it is real: a downloaded report is just as "handed over" as
a copied one, and `agentation` names its equivalent setting **"Clear on copy/send"**,
which covers both. The argument against won: the checkbox says *Clear after copying*,
and a setting that also fires on a button it does not name is a setting that destroys
work by surprise. If download should clear too, the label has to change first — and
that is a decision about wording, not a detail to slip in behind one.

## There is no copy shortcut

This feature originally carried one — `C`, on the grounds that copying was the only
frequent action with no key. It was cut when the work was rebased onto 0.6.0, which had
meanwhile bound `C` to `captureHovered()`: annotate whatever the pointer is over,
*without* clicking, because a click is the one thing that closes the dropdown or tooltip
you were trying to report.

That is a much better use of the key. Copying already has a button that is visible
whenever the panel is open; hover-capture has no mouse equivalent at all, because using
the mouse is what destroys the state. Nothing was rebound to compensate — a second-choice
letter for an action that already has a discoverable button is not worth the collision
risk with whatever 0.7 wants next.

## Shared with the rest of the batch

`clearAll()` was split into `wipeAnnotations()` (silent) and a caller that toasts, so
copy-then-clear and clear-all cannot drift on *what* clearing means — in particular
that both drop the diagnostics buffer and the action trail alongside the annotations.
The reasoning there is unchanged and predates this work: steps and errors from a bug
you already filed would otherwise attach themselves to the next, unrelated report.
