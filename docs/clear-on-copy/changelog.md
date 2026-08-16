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
