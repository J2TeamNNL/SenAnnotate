# Brief — clear after copying

## What

A `clearOnCopy` setting: when it is on, copying the report empties the page's
annotations, so the next round starts clean. Off by default.

## Why

The report is the deliverable. Once it is on the clipboard and pasted into an agent,
the annotations behind it are spent — they describe a batch of work already handed
over. Leaving them means the next copy silently re-sends everything you already filed,
and the only way to avoid that was to remember to hit "Clear all" every single time.

## Scope

In:

- `clearOnCopy` in `Settings`, persisted through `chrome.storage.sync`, default off.
- A toggle for it in the toolbar's settings card, under **Behaviour** — it changes what
  copying does.
- Clearing wipes the diagnostics and action trail with the annotations, exactly as
  the existing "Clear all" does.

Out:

- Clearing on any other event. Closing the overlay, leaving inspect mode and
  reloading all deliberately keep the annotations. See `context.md`.
- A confirmation prompt. The setting is off by default and its label says what it
  does; a dialog on every copy would defeat the point of automating the step.
- Clearing annotations on *other* pages. `wipeAnnotations` is scoped to the current
  `origin + pathname`, same as everything else.

## Success criteria

- With the setting off, copy behaves exactly as before — this is the default path and
  it must not change.
- With it on, a successful copy leaves zero annotations, an empty trail, and a toast
  that names how many were copied.
- **A failed copy never clears.** The clipboard can refuse; losing the session to a
  write that did not land is the one outcome this feature must not produce.
- `downloadReport()` is deliberately *not* covered. See `context.md`.
