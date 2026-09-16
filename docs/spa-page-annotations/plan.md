# Plan — SPA navigation annotation isolation

## Constraints

- TypeScript strict; zero runtime dependencies.
- `buildReport()` / `copyReport()` must not acquire an `await` before the
  clipboard call — user activation is consumed by the first await.
- `onUrlChange` callback fires from a `setInterval` (not a user gesture), so
  async ops there are safe.
- `saveAnnotationsForUrl` must not reuse `pageKey()` — the URL has already
  advanced to the new page.
- Side effects must remain inside `installTopFrame()`.
- `installUrlWatcher()` must be idempotent (guarded flag), because
  `installActionTrail()` also calls it.

## Files changed

| File | Change |
|---|---|
| `src/content/actions.ts` | Add `onUrlChange`, `installUrlWatcher`; move interval there |
| `src/content/storage.ts` | Add `saveAnnotationsForUrl` |
| `src/content/index.ts` | Import new exports; call `installUrlWatcher()` in `boot()`; register `onUrlChange` callback in `installTopFrame()` |
| `test/fixtures/spa-nav.html` | New fixture: two-route SPA via `history.pushState` |
| `test/e2e.mjs` | New "SPA navigation" block (8 `check()` calls) |

## Implementation steps

1. **`actions.ts`**: declare `urlWatcherInstalled` flag and `urlChangeCallback`;
   export `onUrlChange`; extract `installUrlWatcher()` with the interval loop;
   `installActionTrail()` calls `installUrlWatcher()` first then installs event
   listeners.

2. **`storage.ts`**: implement `saveAnnotationsForUrl(annotations, href)` — parse
   `href` with `new URL()`, build key from `origin + pathname`, reuse
   `fitToQuota`.

3. **`index.ts`**:
   - Import `installUrlWatcher`, `onUrlChange`, `saveAnnotationsForUrl`.
   - In `boot()`, call `installUrlWatcher()` before the `captureDiagnostics`
     block.
   - In `installTopFrame()`, register `onUrlChange(async (fromHref) => { ... })`
     that saves page A, loads page B, clears actions, closes any open composer,
     re-renders.

4. **`test/fixtures/spa-nav.html`**: two `<section>` elements toggled by JS;
   two buttons calling `history.pushState`; `#para-a`, `#para-b`, `#go-b`,
   `#go-a` ids for Playwright to target.

5. **`test/e2e.mjs`**: new block after "clear-on-copy"; opens fresh page,
   annotates page A, navigates, asserts 0 markers, annotates page B, navigates
   back, asserts 1 marker (page A preserved).
