# Changelog — SPA navigation annotation isolation

## What was implemented

`fix: isolate annotations per page on SPA navigation`

- `src/content/actions.ts` — extracted `installUrlWatcher()` from
  `installActionTrail()`; added `onUrlChange(callback)` that fires before the
  "navigate" action is recorded, so the orchestrator can flush the old page
  before the trail is reset.
- `src/content/storage.ts` — added `saveAnnotationsForUrl(annotations, href)`
  that targets the storage key derived from the explicit href rather than
  `location`, because `pageKey()` has already advanced to the new URL by the
  time the URL-change callback fires.
- `src/content/index.ts` — registered the URL-change callback in
  `installTopFrame()`; added an unconditional `installUrlWatcher()` call in
  `boot()` ahead of the `captureDiagnostics` gate.
- `test/fixtures/spa-nav.html` — new fixture with two virtual "pages" navigated
  by `history.pushState`.
- `test/e2e.mjs` — new "SPA navigation" block with 8 `check()` calls covering
  isolation, preservation, and bidirectional navigation.

## What went wrong / false assumptions

**Assumption: `installActionTrail()` gates the URL watcher**
The first implementation put `onUrlChange` registration inside the
`if (settings.captureDiagnostics)` block alongside `installActionTrail()`. The
URL watcher was already part of `installActionTrail()`, so it seemed natural.
The bug: annotation isolation must work whether or not the user has "Capture
diagnostics" turned on. SPA navigation would silently mix annotations for users
who never enable diagnostics. Fixed by splitting the URL polling into
`installUrlWatcher()` and calling it unconditionally in `boot()`.

**Assumption: `saveAnnotations()` can target the old page**
The first sketch used `saveAnnotations(annotations)` in the callback, expecting
it to use the old URL. Wrong: by the time the 400 ms poller fires,
`location.href` has already changed, and `pageKey()` returns the new path.
Introduced `saveAnnotationsForUrl(annotations, href)` to take explicit ownership
of the key.

**Action trail order**
It was not obvious at first that `urlChangeCallback` should fire *before*
`record("navigate", ...)`. Firing it after would put the navigate entry into
the array that `clearActions()` then wipes — page B would have no "navigated
from A" step. Firing it before means `clearActions()` wipes page A's steps and
the navigate entry opens page B's clean trail.

**Composer close on navigation**
The initial fix forgot to call `closeComposer()` in the URL-change callback.
An in-flight composer started on page A's element would remain open on page B;
submitting it would create a note with page A's element metadata stored under
page B's key — a subtle re-introduction of the original bug. Added the close.
