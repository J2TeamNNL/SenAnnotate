# Brief — SPA navigation annotation isolation

**Status:** implemented  
**Branch:** `fix/spa-page-annotations`

## Problem

SPA navigation does not refresh the in-memory `annotations` array.

When a user annotates elements on page A, SPA-navigates to page B (same tab, no
reload), annotates elements on page B, and copies the report:

- The report header correctly shows page B's URL (read live from `location`).
- But the annotation list includes **both** page A and page B annotations — they
  were never separated.
- On `persist()`, the mixed array is written under page B's storage key.

## Root cause

`src/content/index.ts` calls `loadAnnotations()` once in `boot()`. The
module-level `annotations` variable is **never refreshed** on URL change.

`src/content/actions.ts` polls `location.href` every 400 ms and records a
`navigate` action, but it does not notify `index.ts`.

`src/content/storage.ts` `saveAnnotations()` derives the storage key from
`location.origin + location.pathname` at call time — already correct — but the
call only happens when the user explicitly saves a note or copies the report.
There is no call that says "save page A first, then load page B".

## Fix summary

1. **`actions.ts`** — add `onUrlChange(callback)` and a separate
   `installUrlWatcher()` that fires the callback before recording the navigate
   action. Separated from `installActionTrail()` so the watcher runs even when
   the user has "Capture diagnostics" disabled.
2. **`storage.ts`** — add `saveAnnotationsForUrl(annotations, href)` that
   writes to the key derived from an explicit href rather than `location`.
3. **`index.ts`** — register the URL-change callback in `installTopFrame()`;
   always call `installUrlWatcher()` in `boot()`; the callback saves page A's
   annotations to page A's key, loads page B's, clears the action trail, and
   re-renders.
