# Plan

1. **Establish what is already true** before changing anything: resolve the storage keys out of
   every shipped zip, and read the 0.2.0 `Annotation` shape out of the tag. If the keys ever
   moved, this task is a migration; if they did not, it is a test. (They did not.)

2. **`test/fixtures/upgrade.html`** — its own page, because the check counts annotations and
   `chrome.storage.local` is shared across every page in a run.

3. **`test/upgrade.mjs`** — two launches over one profile, version bumped between them:
   - launch 1: annotate through the real flow, seed a note in the 0.2.0 shape from the popup
     (the only context with `chrome.storage`), set `theme` and `detail` through the popup's own
     controls;
   - bump `dist/manifest.json`;
   - launch 2: assert the id is unchanged, the running manifest is the bumped version, both
     settings held, both notes are on the page, the report contains both, and the toolbar count
     agrees;
   - restore the manifest in `finally`, whatever happened.

4. **`package.json`** — `npm test` runs it after `e2e.mjs`, so the release gate stays one
   command; `npm run test:upgrade` for iterating on it alone.

5. **`e2e.mjs`** — a comment where the check would otherwise have gone, recording that the
   upgrade is asserted elsewhere and why `chrome.runtime.reload()` cannot stand in for it.

6. **`CLAUDE.md`** — the commands table and the how-to-run section, since `npm test` now runs
   two files.
