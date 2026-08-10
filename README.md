# SenAnnotate

A Chrome extension that turns "fix the blue button in the sidebar" into a report
your AI coding agent can act on without guessing.

Click any element on **any** website, type a note, and copy a Markdown report
naming the element, its DOM path, a re-resolvable selector, and — with diagnostics
on — the console errors, failed requests and steps that led there. No
`npm install`, no code in your bundle: it works against local dev, staging and
production, on any stack.

When the page happens to be a Vue app, the report gains two more lines for free:
the component ancestry and the `.vue` file that rendered the element, as precisely
as `src/components/BaseButton.vue:12:5`. Nothing requires it.

It began as a Vue-native take on
[`agentation`](https://github.com/benjitaylor/agentation), which does the same job
for React as an npm component you import into your app.

---

## Install

```bash
npm install
npm run build
```

### Getting line numbers out of a Nuxt project

Nothing to install — `@nuxt/devtools` already bundles the tracer. Just make sure
DevTools is on in `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  devtools: { enabled: true },   // seller_v3 currently has this set to false
})
```

With it off you still get the component ancestry and the `.vue` file, just not
the line and column.

Then in Chrome:

1. `chrome://extensions`
2. Turn on **Developer mode**
3. **Load unpacked** → pick the `dist/` folder

Requires Chrome 111+ (the extension needs `world: "MAIN"` content scripts).

## Use

| | |
|---|---|
| Toggle inspect mode | click **Inspect**, or <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> |
| Annotate an element | click it |
| Annotate some text | mode <kbd>2</kbd>, then select the text |
| Annotate several elements | mode <kbd>3</kbd>, then drag across them |
| Freeze animations | <kbd>F</kbd> |
| Open the list | <kbd>A</kbd> |
| Copy the report | **Copy report** in the panel |
| Cancel / exit | <kbd>Esc</kbd> |

Annotations are stored per `origin + pathname`, so they survive a reload and come
back when you return to the same screen.

## What the report looks like

```markdown
## Page feedback: /dashboard
**Stack:** Vue 3 3.5.35 · pinia  ·  **Viewport:** 1512×860

### 1. button "Save changes"
**Source:** src/components/BaseButton.vue:12:5
**Components:** <App> <TheSidebar> <BaseButton>
**Location:** .sidebar > .base-button
**Feedback:** Make this the primary action and move it above the divider.
```

Four detail levels, chosen in the panel or the extension popup:

| Level | Adds |
|---|---|
| Compact | one line per note |
| Standard | source file, component ancestry |
| Detailed | selector, props, classes, bounding box, nearby text |
| Forensic | full DOM path, computed styles, accessibility, environment |

## How it finds your source files

Four strategies, best first:

1. **`vite-plugin-vue-tracer`** — what current Nuxt DevTools (v3+) ships. It writes
   **nothing to the DOM**; positions live in a global WeakMap,
   `globalThis.__vue_tracer__.vnodeToPos`, keyed by each vnode's `props` object.
   Gives exact file, line and column. Requires `devtools: { enabled: true }`.
2. **`data-v-inspector`** — the older `vite-plugin-vue-inspector` wrote
   `data-v-inspector="src/components/Foo.vue:12:5"` onto template elements. Still
   supported for projects on the older plugin; Nuxt has since moved off it.
3. **`__file`** — the SFC compiler stamps the absolute path onto the component
   options in any dev build of Vue 2 or Vue 3. File-level, no line number. The
   path is trimmed back to the first `src/`, `app/`, `pages/`, `components/`,
   `layouts/` … segment so it is repo-relative and greppable.
4. **Scoped-style hash** — `data-v-7ba5bd90`. No path, but it survives production
   builds and is a unique `grep -r` handle.

Hover the toolbar's stack badge to see which one is active on the current page.

On a **production build** Vue strips both the names and the paths. The toolbar
badge turns amber and says so rather than quietly emitting a weaker report; you
still get selectors, DOM paths, classes and computed styles.

Annotating works on any page. The **component and source** columns above are what
Vue detection adds, and it covers Vue 3, Vue 2, Nuxt 2 and Nuxt 3/4. Detection is
per-element, so a page mixing a Vue island into other markup works fine — and a
page with no Vue at all simply reports no component data, with no badge and no
warning.

## Architecture

A content script cannot see `element.__vueParentComponent`. Chrome gives each
isolated world its own view of JS properties on DOM nodes, and those are written
by the page. So the extension is split across three contexts:

```
┌─ MAIN world · src/inspector ─────────────┐  the page's own JS heap
│  reads __vueParentComponent / __vue__    │
│  patches setTimeout/rAF to freeze motion │
└──────────────┬───────────────────────────┘
               │  window.postMessage bridge
┌──────────────┴───────────────────────────┐
│  ISOLATED world · src/content            │  chrome.* APIs
│  shadow-DOM toolbar, overlays, markers   │
│  storage, clipboard, screenshot cropping │
└──────────────┬───────────────────────────┘
               │  chrome.runtime
┌──────────────┴───────────────────────────┐
│  service worker · src/background         │
│  captureVisibleTab, toolbar badge        │
└──────────────────────────────────────────┘
```

Two details worth knowing:

- **DOM nodes cannot cross `postMessage`.** The content script stamps the target
  with `data-senannotate-probe="<id>"`, sends the id, and the inspector re-resolves
  it with `querySelector`. Stamps are reference-counted, because a hover lookup
  and a click capture can be in flight on the same element at once.
- **`world: "MAIN"` is declared in the manifest**, not injected at runtime.
  Declarative content scripts are exempt from the page's CSP, so this still works
  on apps with a strict `script-src`.

The whole overlay lives in a shadow root with `pointer-events: none`, so the
page's styles cannot reach it and it never blocks a real click.

## Handing it to testers

```bash
npm run pack     # → senannotate-<version>.zip, guide included
```

Testers install it with `chrome://extensions` → Load unpacked. Full walkthrough,
in Vietnamese, in [`TESTER-GUIDE.md`](./TESTER-GUIDE.md).

### What gets captured automatically

With `captureDiagnostics` on (the default), the report also carries:

- **Console errors** — uncaught throws, unhandled promise rejections,
  `console.error` calls, and failed resource loads, with stack traces at
  Detailed/Forensic.
- **Failed requests** — every `fetch` and `XHR` returning 4xx/5xx or failing
  outright, with method, path, status and duration.
- **Steps to reproduce** — a trail of clicks, field edits, submits and
  navigations, timestamped relative to page load.

All three are installed at `document_start` in the MAIN world, so they are in
place before the app's first line runs. Recording pauses while inspect mode is
on — annotating is not a reproduction step.

**Two things are never recorded:** values typed into fields (the trail says
*"Edited Password"*, never the password), and request or response bodies.
Credential-looking query params (`access_token`, `api_key`, `signature`, …) are
replaced with `[redacted]` before storage. Both guarantees have tests.

### What you actually get on a production build

Measured, not assumed — `test/build-prod-fixtures.mjs` produces three minified
production builds of the same app and the suite asserts on each.

| | stock prod | `+ __VUE_PROD_DEVTOOLS__` | `+ tracer` |
|---|---|---|---|
| Element name, selector, DOM path, classes | ✅ | ✅ | ✅ |
| Console errors, failed requests, repro steps | ✅ | ✅ | ✅ |
| Component tree (`<App> <TheSidebar> <BaseButton>`) | ❌ | ✅ | ✅ |
| Source filename (`BaseButton.vue`) | ❌ | ✅ | ✅ |
| Full path + line + column | ❌ | ❌ | ✅ |
| Bundle cost | — | +1.7 KB | +2.6 KB |

The middle column is the interesting one. `__name` — the component's real,
unminified name — **is emitted by the SFC compiler in production too**, and
`@vitejs/plugin-vue` re-attaches `__file` once devtools are on. In a production
build it deliberately stores only the basename
(`isProduction ? path.basename(filename) : filename`), so you get a filename to
grep for without publishing your directory structure:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  vite: { define: { __VUE_PROD_DEVTOOLS__: true } },
})
```

That is the flag Vue's own runtime checks before writing `__vnode` /
`__vueParentComponent` onto DOM nodes (`runtime-core.esm-bundler.js:1949`).

For exact `file:line:column` as well, add the tracer — **and turn sourcemaps on**:

```ts
import VueTracer from 'vite-plugin-vue-tracer'

export default defineNuxtConfig({
  vite: {
    define: { __VUE_PROD_DEVTOOLS__: true },
    plugins: [VueTracer({ enabled: true })],
  },
  // REQUIRED. The tracer maps generated positions back through the upstream
  // sourcemap; with sourcemaps off it finds no map, transforms nothing, and
  // fails completely silently. `hidden` emits the maps it needs without
  // referencing them from the shipped bundle.
  sourcemap: { client: 'hidden' },
})
```

**This last one exposes every source path and component name** to anyone who opens
the page. Fine for a QA/staging host, a deliberate decision for real production.

## Development

```bash
npm run dev        # esbuild watch — reload the unpacked extension after a rebuild
npm run typecheck
npm run test       # builds, then drives a real Chromium against the fixtures
npm run build
```

`npm run test` launches Chromium with the extension loaded and asserts on the
actual rendered UI and the actual clipboard contents — see `test/e2e.mjs`.
Playwright is resolved from `storefront_playwright_test/`, where it is already
installed, rather than being duplicated here.

Fixtures under `test/fixtures/` reproduce what `@vitejs/plugin-vue` emits
(`__name`, `__file`, `data-v-inspector`) so the source-resolution path is
exercised end to end.

### The two `verify-*` scripts

`npm test` is hermetic — it serves its own fixtures and always runs. Two extra
checks cover what fixtures cannot, and are kept out of the suite because each needs
something it cannot guarantee:

```bash
npm run verify:sites     # needs network
npm run verify:tracer    # needs a running Nuxt dev server
```

- **`verify:sites`** drives the extension against real third-party pages
  (`example.com`, `react.dev`) and asserts the no-framework path: the toolbar
  appears, no stack badge, and the copied report never says "Vue" nor carries a
  `Stack:` line. Assertions are loose on purpose — an upstream redesign should not
  read as a regression.
- **`verify:tracer`** confirms `file:line:column` against a **real**
  `vite-plugin-vue-tracer`, by reading the plugin's own
  `globalThis.__vue_tracer__` store out of the page. A `:12:5` in a report does not
  by itself prove the tracer produced it, and this is precisely the path the first
  version got wrong. Start a dev server first:

  ```bash
  cd ../../storefront_v5
  TMPDIR=/tmp/nx ./node_modules/.bin/nuxt dev --port 3005
  ```

  The short `TMPDIR` is required on macOS — Nuxt's vite-node socket path otherwise
  exceeds the 104-byte limit, fails to bind silently, and every request 500s. Invoke
  the local binary rather than `npx`, which under a shell wrapper can stay alive
  while logging nothing.

Both write screenshots to `test/screenshots/` (gitignored) and share
`test/verify-harness.mjs`. `e2e.mjs` deliberately does not use that harness — it is
the only regression net here and stays self-contained.

## Layout

```
src/
├── shared/       types, wire protocol, Markdown generation
├── inspector/    MAIN world — Vue internals, freeze
├── content/      ISOLATED world — capture, storage, UI
├── background/   service worker
└── popup/        settings
```

Zero runtime dependencies. Build-time: `esbuild` and `typescript`.

## Docs

Design notes, the port map from `agentation`, and the reasoning behind the
three-world split live in `docs/vue-chrome-annotator/` at the monorepo root.
