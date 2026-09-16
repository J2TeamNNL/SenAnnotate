# Context — SPA navigation annotation isolation

## How annotations are stored

Every annotation is an in-memory `Annotation` object inside the module-level
`annotations` array in `src/content/index.ts`. On user actions that mutate the
list (submit, delete, clear-all) the array is serialised to
`chrome.storage.local` via `saveAnnotations()`. The key is
`senannotate:page:<origin><pathname>`, computed live by `pageKey()`.

On full page load, `boot()` calls `loadAnnotations()` once, which reads the key
for the current `origin + pathname` and populates the in-memory array.

## Why SPA navigation breaks this

Chrome MV3 content scripts run once per document. A SPA changes the URL via
`history.pushState` without creating a new document, so the content script is
**not** re-executed. `boot()` is never called again. The `annotations` array
retains whatever page A left in it.

When the user annotates on page B:
- New `Annotation` objects are appended to the same array.
- `persist()` calls `saveAnnotations(annotations)`, which calls `pageKey()` —
  now returning page B's key — and writes the **entire mixed array** to page B's
  slot.
- Page A's slot is untouched; its annotations are lost when the array was first
  mixed.

The action trail (`src/content/actions.ts`) already polls `location.href` every
400 ms to record SPA navigations, but that poll only records a `navigate` entry —
it does not notify `index.ts`.

## Why `saveAnnotations` cannot target the old key

By the time `location.href` has changed, `pageKey()` returns the new path.
Saving "page A's annotations" with `saveAnnotations()` at that point would
write them to page B's key. A separate function that accepts an explicit href
is needed so the caller can target the old key deliberately.

## Action trail scoping

The action trail records user interactions as "steps to reproduce". Entries
accumulated on page A — button clicks, form edits — are not steps to reproduce a
bug on page B. They belong to a report for page A. Clearing the trail on
navigation gives page B a fresh, accurate trail, and the `navigate` entry that
the poller adds immediately after becomes the first step in page B's record.

## Diagnostics cache

The in-memory `diagnosticsCache` (network requests, console logs) spans the
whole tab session by design — it is a running buffer kept in the inspector
(MAIN world) and mirrored here. Clearing it on navigation would drop network
activity that happened between the last push event and the URL change, and the
popup "Copy session" feature intentionally attributes traffic across pages.
The cache is therefore intentionally left alone.

## `captureDiagnostics` gating

`installActionTrail()` (DOM event listeners for the action trail) is gated on
`settings.captureDiagnostics`. The URL watcher that drives SPA annotation
isolation must not share that gate — the fix is correct regardless of the
setting. Moving the URL poll into a separate `installUrlWatcher()` call, always
invoked from `boot()`, achieves this without touching the event-listener logic.
