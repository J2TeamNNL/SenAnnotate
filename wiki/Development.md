# Development

```bash
git clone https://github.com/thangnm93/SenAnnotate.git
cd SenAnnotate
npm install
npm run build
```

Then `chrome://extensions` → **Developer mode** → **Load unpacked** → `dist/`.

**Zero runtime dependencies.** `esbuild` and `typescript` at build time only, targeting
`chrome111`.

---

## Commands

| | |
|---|---|
| `npm run dev` | esbuild watch → `dist/`. Reload the unpacked extension after each rebuild. |
| `npm run typecheck` | `tsc --noEmit` — **the only static gate**. |
| `npm run build` | icons + three bundles + static passthrough. |
| `npm test` | build, then `test/e2e.mjs` and `test/upgrade.mjs` against a real Chromium. |
| `npm run test:upgrade` | just the upgrade check, to iterate on it alone. |
| `npm run pack` | → `senannotate-<version>.zip` (`dist/` + `TESTER-GUIDE.md`). |
| `npm run assets` | Chrome Web Store graphics → `store/out/`. |
| `npm run wiki:assets` | the screenshots in this wiki → `wiki/images/`. |
| `npm run changelog` | regenerate `CHANGELOG.md` from tags + commit subjects. |

There is **no linter and no test framework**. TypeScript `strict` plus the e2e suite are
the whole gate.

---

## Running the test suite

The suite needs three things the package deliberately does not depend on, supplied by
environment variable so nothing machine-specific is baked in:

| Variable | Points at |
|---|---|
| `SENANNOTATE_PLAYWRIGHT_DIR` | a directory whose `node_modules` has `playwright` **and its browsers** |
| `SENANNOTATE_VUE_GLOBAL` | a `vue.global.js` dev build — only on a fresh checkout; cached once copied |
| `SENANNOTATE_PNPM_STORE` | a `node_modules/.pnpm` with `vite`, `@vitejs/plugin-vue`, `vite-plugin-vue-tracer` — only for `test/build-prod-fixtures.mjs` |

```bash
SENANNOTATE_PLAYWRIGHT_DIR=<path to playwright> npm test
```

Each is checked with an **actionable error** rather than a default guess: a hardcoded
path works on exactly one machine, and a wrong one fails later and more confusingly than
an unset variable.

### Run it without taking your screen

```bash
SENANNOTATE_PLAYWRIGHT_DIR=… SENANNOTATE_HEADLESS=1 npm test
```

Chrome's **new** headless does load extensions, run the service worker and answer
`captureVisibleTab`, so all 220-odd checks pass there. Prefer it when someone is using
the machine: the default headed window takes the screen **and the keyboard focus** for
the whole run.

It needs `channel: "chromium"` alongside `headless: true`; the three launch sites set
that themselves.

### There is no single-test filter

`test/e2e.mjs` is one sequential `main()` driving ~220 `check()` assertions across a
**shared browser context**. To iterate on one area, comment out the page blocks above it.

Extensions need a persistent context, which is why the launch is `launchPersistentContext`
and not `launch`.

### The upgrade test is separate for a reason

`test/upgrade.mjs` needs **two** launches over one profile directory, with the version in
`dist/manifest.json` bumped between them, to observe a real upgrade.

`chrome.runtime.reload()` is not a substitute: Chrome **drops** an extension loaded with
`--load-extension` when it calls that, and every later navigation fails
`ERR_BLOCKED_BY_CLIENT`.

### The two `verify-*` scripts

Kept out of the suite because each needs something it cannot guarantee.

```bash
npm run verify:sites     # needs network
npm run verify:tracer    # needs a running Nuxt dev server on :3005
```

- **`verify:sites`** drives the extension against real third-party pages (`example.com`,
  `react.dev`) and asserts the no-framework path: toolbar appears, no stack badge, and
  the copied report never says "Vue" nor carries a `Stack:` line. Assertions are loose on
  purpose — an upstream redesign should not read as a regression.
- **`verify:tracer`** confirms `file:line:column` against a **real**
  `vite-plugin-vue-tracer`, by reading the plugin's own `globalThis.__vue_tracer__` store
  out of the page. A `:12:5` in a report does not by itself prove the tracer produced it,
  and this is precisely the path the first version got wrong.

  ```bash
  # in any Nuxt project with devtools enabled
  TMPDIR=/tmp/nx ./node_modules/.bin/nuxt dev --port 3005
  ```

  The short `TMPDIR` is **required on macOS** — Nuxt's vite-node socket path otherwise
  exceeds the 104-byte limit, fails to bind silently, and every request 500s. Invoke the
  local binary rather than `npx`, which under a shell wrapper can stay alive while
  logging nothing.

---

## Traps worth knowing before you edit

### The version lives only in `package.json`

`build.mjs` stamps `dist/manifest.json` from it, so the `"version"` in
`static/manifest.json` is **dead** and will look stale. Do not "fix" it there.

### Every module opens with a banner comment explaining *why*, not what

Match that density. The comments are load-bearing documentation here, not decoration.

### The e2e suite asserts on shadow-DOM class names

`.tool--brand`, `.composer`, `.stack-badge`, `.toolbar-hint`, `.count` — **and on the
exact text of `.toolbar-hint`**. Renaming a class, or rewording a hint, in
`src/content/ui/` breaks tests that look unrelated.

### A fixture another block annotates cannot carry a count assertion

`chrome.storage.local` is shared across every page in the suite's single browser context,
and annotations are keyed on `origin + pathname` — so a page opens with whatever an
earlier block left on it. Four assertions failed exactly this way in 0.6.0. The fix is a
fixture of your own.

### Never call a permission-gated API from the extension popup in the suite

`context.grantPermissions(…, { origin: base })` covers the fixture origin, **not**
`chrome-extension://`. `navigator.clipboard.readText()` there raises a prompt nothing
answers and the suite **hangs** rather than failing. Drive the popup, observe from a
page.

### `waitForFunction` cannot observe a frozen page

Freeze parks `requestAnimationFrame` *and* `setTimeout`, so any in-page polling loop —
including Playwright's, whichever `polling` you pass — is held by the state it is waiting
for. Use a Node-side `waitForTimeout` plus one `evaluate`.

### Privacy guarantees have tests and must not regress

Field values are never recorded, request/response bodies are never recorded, and
credential-looking query params are `[redacted]` before storage. See
[[Diagnostics and Privacy]].

---

## Adding a framework detector

One new file implementing `FrameworkDetector`, plus one line in
`src/inspector/detectors/index.ts`. If it forces edits elsewhere, the abstraction has
leaked. See [[Framework Support]] and [[Architecture]].

---

## Task documentation

Every non-trivial change gets a folder in `docs/<task-slug>/` with `brief.md`,
`context.md`, `plan.md` and `changelog.md`, written **during** the work. That is where
the reasoning lives — including what went wrong. Read
[`docs/README.md`](https://github.com/thangnm93/SenAnnotate/blob/main/docs/README.md)
first.

---

## Licensing constraint

The project began as a port of
[`agentation`](https://github.com/benjitaylor/agentation), which is **PolyForm Shield** —
source-available, not open source. Three modules were reimplemented from scratch in 0.3.1
so this repo could be MIT.

> **Do not consult or copy upstream `agentation` source** when working on
> `content/identify.ts`, `inspector/freeze.ts` or `shared/output.ts`.

See [`NOTICE.md`](https://github.com/thangnm93/SenAnnotate/blob/main/NOTICE.md).
