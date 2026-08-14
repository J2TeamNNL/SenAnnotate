# Annotation triage — brief

## What

Give an annotation two more fields and the collection two more verbs.

- **Type** — `bug` · `ui` · `copy` · `question`, chosen in the composer.
- **Status** — `open` / `done`, toggled from the panel.
- **Export / import** — the whole annotation set to a JSON file and back.
- **Download the report** as a `.md` file, next to the existing copy-to-clipboard.

## Why

**Type.** An annotation is currently one free-text `comment` and nothing else. A report
of nine notes reads as nine equal demands; in reality two are release-blocking bugs, five
are polish, and one is a question that needs answering before anything is written. Both
readers — the developer triaging and the agent planning an edit order — have to infer
that from prose. One field removes the guesswork, and it costs the person annotating a
single click.

**Status.** Reviewing a screen twice is the normal case: annotate, hand over, come back
after the fix. Today there is no way to record that note 3 is done, so the second pass
either re-reports fixed things or the reviewer keeps the list in their head. Only
`Clear all` exists, which is all-or-nothing and irreversible.

**Export / import.** Annotations live in `chrome.storage.local` keyed by
`origin + pathname` and can leave only through the clipboard, as rendered Markdown —
lossy and one-way. There is no backup before `Clear all`, no way to hand a review to a
colleague, and no way to move it between machines (settings sync; annotations do not,
deliberately). A JSON round-trip fixes all three at once.

**Download `.md`.** The clipboard is the wrong channel for a 40 KB forensic report with
an embedded screenshot, and it is the only channel there is.

## Scope

In:

- `kind` and `status` on `Annotation`, both optional so stored notes stay readable.
- Composer: a type chip row. Panel: status toggle, filter, and a done count.
- Markers: type colour, and a muted look once done.
- Report: type in the heading, done notes rendered under a separate closing section
  rather than dropped — a fixed thing is still context.
- Export / import JSON from the popup; download `.md` from the panel.

Out:

- Assignees, due dates, comment threads. This is a review pass, not an issue tracker.
- Custom types. Four cover it; a taxonomy editor is a settings screen nobody asked for.

## Success

- Mark a note as a bug, mark another done, copy the report: types appear in the
  headings, and the done note appears under `## Already fixed`.
- Export, `Clear all`, import: the same notes come back on the same pages, markers and
  all.
- Import refuses a file that is not ours rather than writing nonsense into storage.
