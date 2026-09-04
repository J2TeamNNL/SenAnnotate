# Contributing

Thanks for looking. This file is the short version of the rules; the
[wiki's Development page](https://github.com/thangnm93/SenAnnotate/wiki/Development) is
the long one, and it carries the traps.

---

## Getting set up

```bash
npm install
npm run build          # → dist/
npm run dev            # esbuild watch; click ⟳ on the extension card after each rebuild
```

Load `dist/` at `chrome://extensions` → Developer mode → **Load unpacked**.

**Zero runtime dependencies**, and it stays that way. `esbuild` and `typescript` at build
time only, targeting `chrome111`.

---

## The four things that are expensive to get wrong

### 1. Your commit subject is a release note

`CHANGELOG.md` is **generated** — `scripts/changelog.mjs` rebuilds the whole file from
the `v*.*.*` tags and the [Conventional Commit](https://www.conventionalcommits.org/)
subjects between them.

So the subject you write ships verbatim to users, and editing the changelog by hand does
nothing: the next release overwrites it.

```
feat: screenshot markup, hover capture, triage, session reports and iframes
```

That shipped as one bullet, for five features. **Write the subject you would want to read
in the release notes.**

Prefixes: `feat:` `fix:` `refactor:` `chore:` `docs:` `test:`. Anything the generator
cannot parse lands in an `Other` section — if that appears, the fix is the commit
message, not the generator.

### 2. A green CI tick does not mean the tests passed

CI runs **typecheck + build + pack**. The Playwright suite needs a browser and browsers
supplied by environment variable, so it never runs there —
[`docs/ci-cd/context.md`](../docs/ci-cd/context.md) has the argument.

**You have to run it:**

```bash
SENANNOTATE_PLAYWRIGHT_DIR=<dir whose node_modules has playwright + browsers> npm test
```

Add `SENANNOTATE_HEADLESS=1` to run without taking your screen and keyboard for the
length of the run. Chrome's *new* headless loads extensions, runs the service worker and
answers `captureVisibleTab`, so all ~220 checks pass there.

There is **no single-test filter**. `test/e2e.mjs` is one sequential `main()` over a
shared browser context; to iterate on one area, comment out the page blocks above it.

### 3. Every non-trivial change needs `docs/<task-slug>/`

Four files — `brief.md`, `context.md`, `plan.md`, `changelog.md` — written **during** the
work, not after. The changelog is where what went wrong goes, and which assumptions
turned out false. That is the part future readers actually need.

| Change | Needed |
|---|---|
| Feature, or a bug fix of any substance | Yes |
| Refactor touching 3+ files | Yes |
| Dependency change | Yes |
| Typo, one-line fix | No |

Link the folder from your PR. Read [`docs/README.md`](../docs/README.md) for the reading
order — the existing folders are the best guide to the expected depth.

### 4. Three modules have a licensing constraint

This project began as a port of
[`agentation`](https://github.com/benjitaylor/agentation), which is **PolyForm Shield** —
source-available, **not** open source. Three modules were reimplemented from scratch in
0.3.1 so this repository could be MIT.

> **Do not consult or copy upstream `agentation` source** when working on
> `src/content/identify.ts`, `src/inspector/freeze.ts` or `src/shared/output.ts`.

[`NOTICE.md`](../NOTICE.md) is the record.

---

## Architecture, in one paragraph

A content script cannot see `element.__vueParentComponent`, `__reactFiber$…` or
`__svelte_meta` — Chrome gives each isolated world its own view of JS properties on DOM
nodes. So the extension is split across **three contexts**: `src/inspector/` in the
page's MAIN world (detectors, freeze, diagnostics), `src/content/` in the ISOLATED world
(shadow-DOM UI, storage, clipboard), and `src/background/` in the service worker.
`src/shared/` is the only code all of them import.

Almost every structural rule follows from that. Read
[Architecture](https://github.com/thangnm93/SenAnnotate/wiki/Architecture) before
changing anything across the bridge, and `CLAUDE.md` for the full set.

---

## Traps

These break tests that look unrelated to what you changed.

- **`src/content/index.ts` ends in a branch, and everything with a side effect belongs
  inside `installTopFrame()`.** Both content scripts run with `all_frames: true`; a new
  module-scope `listen(...)` puts itself in every iframe on the page — a second toolbar,
  a second owner of the annotations.
- **The e2e suite asserts on shadow-DOM class names** (`.tool--brand`, `.composer`,
  `.stack-badge`, `.count`) **and on the exact text of `.toolbar-hint`.** Renaming a
  class or rewording a hint breaks assertions elsewhere.
- **A fixture another block annotates cannot carry a count assertion.**
  `chrome.storage.local` is shared across the suite's single browser context and
  annotations are keyed on `origin + pathname`. Write your own fixture.
- **Never call a permission-gated API from the extension popup in the suite.** The grant
  covers the fixture origin, not `chrome-extension://`, and the suite *hangs* rather than
  failing.
- **`waitForFunction` cannot observe a frozen page.** Freeze parks `rAF` *and*
  `setTimeout`, so Playwright's in-page polling is held by the state it waits for. Use a
  Node-side `waitForTimeout` plus one `evaluate`.
- **The version lives only in `package.json`.** `static/manifest.json`'s copy is dead and
  will look stale — do not "fix" it.
- **Every module opens with a banner comment explaining *why*, not what.** Match that
  density; the comments here are documentation, not decoration.

---

## Privacy guarantees that must not regress

They have tests. Breaking one is not a normal test failure.

- Field **values** are never recorded — the trail says `Edited Password`, never the
  password.
- Request and response **bodies** are never recorded.
- Credential-looking query params are `[redacted]` **before** storage.

---

## Adding a framework detector

One new file implementing `FrameworkDetector`, plus one line in
`src/inspector/detectors/index.ts`. If it forces edits to `shared/output.ts`,
`content/ui/toolbar.ts` or `content/source.ts`, the abstraction has leaked — fix that
instead of working around it.

`detect()` and `inspect()` must not throw, and must return `null` when the framework does
not own the page or element, so the dispatcher can try the next one. **Returning a
mostly-empty object stops the search** — that is what would break a Vue island inside a
React page.

---

## Permissions

Adding one to `static/manifest.json` **restarts the Chrome Web Store manual review** —
days, not minutes — and needs a justification block in both
[`PRIVACY.md`](../PRIVACY.md) and `store/listing-privacy.md`. A permission without one
gets the version rejected.

It also matters while the extension is inside the Enhanced Safe Browsing trust window.
Weigh it accordingly, and say in the PR why nothing weaker would do.

---

## Pull requests

- Branch `feature/<slug>`, `fix/<slug>` or `chore/<slug>`.
- The template asks for the `docs/` folder, what you ran, and screenshots for UI changes.
  Ticking a verification box you did not run is worse than leaving it blank.
- Do **not** bump the version — releases are their own commit.
- Do **not** hand-edit `CHANGELOG.md`.
- Update [`wiki/`](../wiki) if user-visible behaviour changed. Its source lives in this
  repository, not in the wiki repo, so it is reviewed with the code.

---

## Releasing

Maintainers only, and the order matters —
[Releasing](https://github.com/thangnm93/SenAnnotate/wiki/Releasing).
