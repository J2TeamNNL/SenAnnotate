# Changelog — clear after copying

## What shipped

`clearOnCopy` in `Settings` (default off) with a toggle in the toolbar's settings card,
under **Behaviour**. A
successful copy with the setting on empties the page's annotations, trail and
diagnostics, and toasts `Copied 3 annotations · cleared`.

Three files: `shared/types.ts`, `content/index.ts`, `content/ui/settings.ts`.

## The one non-obvious bug this had

`copyReport()` read `annotations.length` **inside** the clipboard callback, twice, to
build its toast. Clearing in that same callback empties the list first, so the message
would have read `Copied 0 annotations · cleared` — a false statement about the action
that had just succeeded. The count is now captured before the copy starts.

Nothing caught this; it was visible only from reading the callback with the new
mutation in place. Worth remembering that the toast reads state that the same callback
is now allowed to destroy.

## Two decisions taken here that bind the rest of the batch

**No destructive close.** The batch originally included a close button that also
cleared, copied from `agentation`'s `X`. Cut — annotations persist with no undo, and a
close button is pressed reflexively. `context.md` has the argument. The rule the
remaining PRs inherit: closing, collapsing, leaving inspect mode and reloading all keep
the annotations.

**No key was rebound for copy.** See below — the shortcut this shipped with was cut on
rebase, and nothing replaced it.

## Written against 0.5.3, rebased onto 0.6.0, and what that cost

The work was done before 0.6.0 merged upstream, then rebased onto it. Four conflicts;
two were mechanical, two were not.

**`C` was already taken.** This feature added `C` for copy. 0.6.0 had meanwhile bound
`C` (and `Enter`) to `captureHovered()` — annotate what the pointer is over without
clicking, because clicking closes the hover menu you are trying to report. Shipping
this rebase unresolved would have silently replaced a feature whose entire premise is
that the mouse cannot be used. The shortcut was dropped, along with its README row and
the panel button's `title`. `context.md` records why nothing was rebound in its place.

Worth noting the conflict markers did **not** land on the `case "c":` line — 0.6.0 had
moved the whole keyboard handler inside `installTopFrame()`, so git offered a clean
"both sides added a listener" resolution, and taking it would have registered a second
document-level `keydown` handler alongside the real one. The collision was only visible
by reading the incoming side, not the diff.

**`copyReport()` had been split.** 0.6.0 extracted `buildReport()` so that
`downloadReport()` could share it. The `count` capture had to move into the new
`copyReport()`, and the report-building half discarded. A textual merge left `count`
referenced but undeclared — caught by `tsc`, which is exactly the kind of thing the
one static gate exists for.

## Refactor

`clearAll()` split into a silent `wipeAnnotations()` plus a toasting caller, so the two
clear paths cannot drift on what clearing includes. No behaviour change to `clearAll()`.

## Verification — incomplete, and why

`npm run typecheck` clean, `npm run build` clean. Both required `npm install` first;
this was a fresh checkout with no `node_modules`.

**`npm test` was not run.** The suite needs `SENANNOTATE_PLAYWRIGHT_DIR` pointing at a
directory whose `node_modules` contains playwright, and the path recorded in
`CLAUDE.md` (`/Users/thangnm/Documents/Works/storefront_playwright_test`) does not
exist on this machine — it belongs to a different user account. There is no playwright
in the global npm prefix and no sibling checkout carrying one. The browsers themselves
are present in `~/Library/Caches/ms-playwright`, so only the node module and a
`vue.global.js` are missing; `test/fixtures/vendor/` is also unpopulated, so
`SENANNOTATE_VUE_GLOBAL` would be needed on the first run too.

**No e2e check was written for this feature.** Writing an assertion that cannot be
executed is worse than recording the gap: it would ship looking like coverage. What
such a check needs to pin, when the suite can next be run:

- setting off → copy leaves the count unchanged (the default path, most important)
- setting on → copy leaves `.count` hidden and the panel list empty
- the toast names the pre-clear count, not zero
- setting on → **download** leaves the annotations alone

0.6.0 grew `test/e2e.mjs` by 375 lines, so the suite is now the larger part of the
verification story and skipping it is a bigger gap than it was when this was written.

---

## 2026-08-18 — audited, and the e2e gap above closed

The feature was re-read against its own brief and then driven in a real browser. It
behaves as its label says: `clearOnCopy` fires on the panel's *Copy report* only, only
after `copyText` resolves `true`, and takes the annotations, the diagnostics buffer and
the action trail with it, in storage as well as on screen.

Two runs were needed, because one criterion cannot be reached from inside the suite.

**Added to `test/e2e.mjs`** — a block of 14 checks on its own fixture,
`test/fixtures/clear-copy.html`, placed immediately before the export/import block:

- the default path is unchanged: report on the clipboard, annotations and badge intact,
  toast reading exactly `Copied 1 annotation`
- the checkbox is off on arrival
- with it on: the report still reaches the clipboard, the toast reads
  `Copied 1 annotation · cleared`, markers and badge go to zero, the panel falls back to
  its empty state, and a reload proves the clear reached storage
- the action trail goes too — a distinctly-named click before the clear is absent from
  the next report, and that report's trail carries only the click made after it
- the next report carries only the new note
- **download does not clear** (asserted on the download event, not just the click)
- the popup's *Copy session* does not clear either, whatever the setting says
- the setting turns back off and the default path returns

The block ends with the setting off deliberately: it lives in `storage.sync`, so leaving
it on would make every copy in the blocks below wipe the page it had just copied. The
fixture is its own for the usual reason — this block counts markers and reads `.count`.

**Not in the suite: a failed copy must never clear.** Reaching it needs both clipboard
routes to refuse *inside the ISOLATED world*, and neither `navigator.clipboard` nor
`document.execCommand` can be patched from the page — each world has its own. It was
verified instead against a copy of `dist/` whose `content.js` was prefixed with a stub
making `writeText` reject and `execCommand` return `false`: the toast read `Copy failed`,
the annotation stayed on the page, and it was still there after a reload. Same shape of
reason `upgrade.mjs` sits outside `e2e.mjs` — a second bundle, so a second launch.

### What went wrong while writing it

The trail assertion failed on its first run, and the feature was not at fault. It matched
`/Stale click/` over the whole report; at **forensic** detail an entry carries
`**Nearby elements:**`, which quoted `div.row "Stale click Fresh click"` — the fixture's
own buttons, nothing to do with the trail. An earlier block leaves `detailLevel` at
forensic, so any regex over a whole report in this file is level-dependent by default.
The check now extracts the `## Steps to reproduce` section and reads only that.

### Two things worth a decision, neither changed here

- **The popup's *Copy session* never clears.** Defensible — it spans pages, and clearing
  across pages is out of scope by design — but `context.md` argues the download exclusion
  at length and never mentions this one. It is now at least pinned by a test.
- **`count` is read before the `await`, and `wipeAnnotations()` empties the whole list.**
  An annotation arriving during the clipboard round-trip — realistically only a draft
  handed up from a child frame — would be wiped uncounted, and the toast would understate
  what was destroyed. Clearing by copied id rather than by truncation would close it.

## 2026-08-18 — the clear is scoped to what was copied

The second of the two open questions above, fixed. `copyReport()` used to read the count
before the clipboard call but let `wipeAnnotations()` truncate the *live* list afterwards,
so anything filed during the round-trip was destroyed without ever having been in the
report, and the toast understated what it had taken.

It now takes one snapshot before the call — the array the report was built from — and
uses it for both halves: `count` for the toast, and the ids for
`wipeAnnotations(only?: ReadonlySet<string>)`, which removes those and leaves the rest.
`clearAll()` passes nothing and still empties everything.

Two things checked before writing it, because the fix rests on them:

- **The snapshot is real.** `annotations` is never mutated in place — every add, edit and
  delete assigns a new array (`grep 'annotations.push\|annotations.splice'` is empty), so
  holding the reference holds the list as it was.
- **Every new annotation arrives through the composer's `onSubmit`.** `captureHovered()`
  and a draft handed up from a child frame both open a composer rather than filing
  directly, which is what makes the window narrow enough to have gone unnoticed — and
  reachable at all, since a submit is one keystroke.

The diagnostics and the trail still go unconditionally; `context.md` now says why.

**No e2e check.** The window is a few milliseconds inside a promise the page cannot slow
down: `navigator.clipboard` lives in the ISOLATED world, so nothing the fixture does can
stall the write, and a fixture cannot submit a composer at a chosen point inside it. What
the suite does cover is the regression risk this change carries — that scoping the clear
leaves something behind — via "clearing empties the page" and "the clear reaches storage".
249/249 after the change.

### Still open: an unsaved draft dies with the clear

`wipeAnnotations()` calls `closeComposer()` unconditionally, and an open composer holding
an *unsaved* draft is work the copy never took either. It is reachable without any race:
open a composer, type, then hit **Copy report** in the panel with the setting on, and the
draft is gone. Left alone here deliberately — it is a different bug from the one this
entry fixes, and closing it needs the composer to record which annotation (if any) it is
editing, so it can close for a removed one and stay for a new draft.
