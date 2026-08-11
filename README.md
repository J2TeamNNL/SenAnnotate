# SenAnnotate

A Chrome extension that turns "fix the blue button in the sidebar" into a report
your AI coding agent can act on without guessing.

Click any element on **any** website, type a note, and copy a Markdown report
naming the element, its DOM path, a re-resolvable selector, and — with diagnostics
on — the console errors, failed requests and steps that led there. No
`npm install`, no code in your bundle: it works against local dev, staging and
production, on any stack.

When the page is built with **Vue, React, Svelte or Angular**, the report gains two
more lines for free: the component ancestry, and the source file that rendered the
element — as precisely as `src/components/BaseButton.vue:12:5` where the framework
records it. Nothing requires any of them; see [Framework support](#framework-support)
for what each one can actually give you.

The idea comes from [`agentation`](https://github.com/benjitaylor/agentation) by Benji
Taylor, which does the same job for React as an npm component you import into your app.
This project started as a Vue-oriented answer to it and has since been reimplemented —
see [`NOTICE.md`](./NOTICE.md) for the provenance, which is worth reading before
vendoring any of this.

MIT licensed. See [`LICENSE`](./LICENSE).

---

## Install

Chrome only, and unpacked either way — this is not on the Web Store. Take the
first route unless you intend to change the code.

### From a release — no Node, no build

1. Download `senannotate-<version>.zip` from the
   [latest release](https://github.com/thangnm93/SenAnnotate/releases/latest).
2. Unzip it into a folder you intend to **keep** — not `Downloads`, which gets
   swept. Chrome loads the extension off disk on every launch, so moving or
   deleting that folder breaks it.
3. Open `chrome://extensions`.
4. Turn on **Developer mode**, top-right.
5. Click **Load unpacked** and choose the unzipped folder — the one with
   `manifest.json` directly inside it.

An orange **S** appears in the toolbar. That is the whole install.

### From source — for working on the extension

```bash
npm install
npm run build
```

Then steps 3–5 above, choosing the `dist/` folder instead of an unzipped one.

### Either way

**Chrome 111 or newer** — the extension declares `world: "MAIN"` content scripts,
which earlier versions do not support.

**Chrome will nag.** A "Disable developer mode extensions" popup appears on every
launch. Click **Cancel**, not Disable. Chrome shows it for any unpacked extension;
nothing is wrong.

**To update:** replace the files in the same folder, click ⟳ on SenAnnotate's card
in `chrome://extensions`, then reload the tabs you had open — the old content
script is still running in them until you do.

Handing this to someone who does not write code? [`TESTER-GUIDE.md`](./TESTER-GUIDE.md)
covers the same install plus the reporting workflow, in English and Vietnamese.

### Getting line numbers out of a Nuxt project

One optional setting, in *your* app rather than the extension. `@nuxt/devtools`
already bundles the tracer, so there is nothing to install — just make sure
DevTools is on in `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  devtools: { enabled: true },   // often left off — check yours
})
```

With it off you still get the component ancestry and the `.vue` file, just not
the line and column.

## Use

| | |
|---|---|
| Toggle inspect mode | click **Inspect**, or <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> |
| Annotate an element | click it |
| Annotate some text | mode <kbd>2</kbd>, then select the text |
| Annotate several elements | mode <kbd>3</kbd>, then drag a box around them |
| Freeze animations | <kbd>F</kbd> |
| Open the list | <kbd>A</kbd> |
| Collapse the toolbar | <kbd>H</kbd>, or the `»` button |
| Copy the report | **Copy report** in the panel |
| Cancel / exit | <kbd>Esc</kbd> |

The line under the toolbar always names what the current mode does and which keys
switch to the others, so nothing above needs memorising.

The toolbar is docked bottom-right, which is exactly where a page tends to put its
chat widget, cookie bar or footer actions. <kbd>H</kbd> collapses it to a single dot
that still carries the annotation count, and takes an accent ring while inspect mode
is on — collapsing hides the controls and nothing else, so clicking still annotates.
The state is a setting rather than a session flag, so a reload does not put the pill
back over the corner you were looking at. <kbd>H</kbd> works whether or not inspect
mode is on, unlike the mode keys.

Dragging a box selects **everything it fully contains**, at the shallowest level
contained — draw around three cards and you get three cards, not the `<div>`s
inside them. Elements the box merely clips are left out. The selection is
highlighted live while you drag and counted in the line under the toolbar, so you
can adjust before letting go.

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

## Framework support

Annotating works on **any** page. What a framework adds is the component ancestry and
the source location — and how much of that is available differs a lot by framework,
because each records different things. Rather than flatten them to a lowest common
denominator, the report carries what is actually there:

| | Components | Source | Props |
|---|---|---|---|
| **Vue** 2, 3, Nuxt 2, 3/4 | ✅ | `file:line:col` with the tracer, filename otherwise | ✅ |
| **Svelte**, SvelteKit | ✅ from `loc.file` | ✅ `file:line:col`, no plugin needed | ❌ |
| **React**, Next.js | ✅ | `file:line:col` on React ≤18; **none on React 19** | ✅ |
| **Angular** | ✅ | ❌ none — Angular records no authoring positions | ✅ |

Detection is **per-element**, so a page mixing frameworks — a Svelte widget in a React
app, a Vue island in server-rendered markup — works. A page with no framework at all
simply reports no component data, with no badge and no warning.

On a **production build** names and paths are stripped in every framework. The toolbar
badge turns amber and says so rather than quietly emitting a weaker report; you still
get selectors, DOM paths, classes and computed styles.

<details>
<summary>How each framework is read, and why</summary>

**Vue** — four strategies, best first:

1. **`vite-plugin-vue-tracer`**, what current Nuxt DevTools (v3+) ships. Writes
   **nothing to the DOM**; positions live in a global WeakMap,
   `globalThis.__vue_tracer__.vnodeToPos`, keyed by each vnode's `props` object. Exact
   file, line and column. Requires `devtools: { enabled: true }`.
2. **`data-v-inspector`**, from the older `vite-plugin-vue-inspector`. Exact, readable
   straight off the DOM. Nuxt has since moved off it.
3. **`__file`** on the component options — any dev build of Vue 2 or 3. File-level only.
4. **Scoped-style hash** `data-v-7ba5bd90`. No path, but survives production and is a
   unique `grep -r` handle.

**Svelte** has no component instance tree on the DOM at all — there is no
`__svelteComponent` to walk. What it has, compiled with `dev: true`, is
`el.__svelte_meta.loc` giving the exact authoring file, line and char per element. That
is *better* than a component tree here, since it needs no name-to-file mapping and no
build plugin. The ancestry is recovered by walking up and collecting distinct
`loc.file` values, which for Svelte is nearly the instance tree since one file is one
component. Props are not exposed anywhere, so none are reported.

**React** attaches its fiber under a randomised key (`__reactFiber$<random>`), so it is
found by prefix scan, then `fiber.return` gives the ancestry. Source came from
`fiber._debugSource`, which **React 19 removed** — so on React 19 you get the component
chain and no source line, unless the app runs its own babel plugin. `elementType` is
preferred over `type` so `memo` and `forwardRef` wrappers report what the author wrote.

**Angular** is the only one with a documented debug API: `window.ng.getComponent(el)`,
installed outside production mode. It answers only for elements that *are* component
hosts, so the chain is built by walking up and asking about each ancestor. Angular
records no authoring positions anywhere, not even in dev, so there is no source line to
give.

</details>

## Architecture

A content script cannot see `element.__vueParentComponent`, `__reactFiber$…` or
`__svelte_meta`. Chrome gives each isolated world its own view of JS properties on DOM
nodes, and every framework writes its metadata there. So the extension is split across
three contexts:

```
┌─ MAIN world · src/inspector ─────────────┐  the page's own JS heap
│  detectors/ read framework internals     │
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

The zip is the same artifact the release workflow attaches, so testers can equally
fetch it themselves from the [latest release](https://github.com/thangnm93/SenAnnotate/releases/latest).
Either way they install it as [above](#from-a-release--no-node-no-build). The full
walkthrough — install plus the reporting workflow, in English and Vietnamese — is
[`TESTER-GUIDE.md`](./TESTER-GUIDE.md), which `npm run pack` includes in the zip.

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

The suite needs three things this package deliberately does not depend on, supplied by
environment variable so nothing machine-specific is baked in:

| Variable | Points at |
|---|---|
| `SENANNOTATE_PLAYWRIGHT_DIR` | a directory whose `node_modules` has `playwright` + browsers |
| `SENANNOTATE_VUE_GLOBAL` | a `vue.global.js` dev build (copied in once, then cached) |
| `SENANNOTATE_PNPM_STORE` | a `node_modules/.pnpm` with `vite`, `@vitejs/plugin-vue`, `vite-plugin-vue-tracer` — only for the production fixtures |

Each is checked with an actionable error rather than a default guess: a hardcoded path
works on exactly one machine, and a wrong one fails later and more confusingly than an
unset variable.

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
  # in any Nuxt project with devtools enabled
  TMPDIR=/tmp/nx ./node_modules/.bin/nuxt dev --port 3005
  ```

  The short `TMPDIR` is required on macOS — Nuxt's vite-node socket path otherwise
  exceeds the 104-byte limit, fails to bind silently, and every request 500s. Invoke
  the local binary rather than `npx`, which under a shell wrapper can stay alive
  while logging nothing.

Both write screenshots to `test/screenshots/` (gitignored) and share
`test/verify-harness.mjs`. `e2e.mjs` deliberately does not use that harness — it is
the only regression net here and stays self-contained.

### Releasing

CI runs on every push to `main` — typecheck, build, pack — and attaches the packed zip to
the run as a 14-day artifact, so any commit can be loaded into Chrome without cutting a
release. It does **not** run `npm test`; see [`docs/ci-cd/context.md`](./docs/ci-cd/context.md)
for why, and treat the suite as a manual gate before releasing.

To publish a release:

```bash
# 1. Run the full suite yourself — CI cannot.
npm test

# 2. Bump the version. package.json is the only place that matters: the build
#    stamps dist/manifest.json from it.
#    …edit "version" in package.json…
git commit -am "chore: release 0.3.0"

# 3. Push the commit first, then the tag. The tag must match package.json
#    exactly or the workflow refuses to release.
git tag v0.3.0
git push && git push --tags
```

`.github/workflows/release.yml` then builds, packs, and creates a GitHub Release with
`senannotate-<version>.zip` attached and generated release notes.

If the tag and `package.json` disagree, the workflow fails before installing anything and
creates nothing. Fix `package.json`, then delete and re-push the tag:

```bash
git tag -d v0.3.0 && git push origin :refs/tags/v0.3.0
```

## Layout

```
src/
├── shared/       types, wire protocol, Markdown generation
├── inspector/    MAIN world — freeze, diagnostics
│   └── detectors/  one file per framework + a dispatcher
├── content/      ISOLATED world — capture, storage, UI
├── background/   service worker
└── popup/        settings
```

Zero runtime dependencies. Build-time: `esbuild` and `typescript`.

## Docs

Design notes, the reasoning behind the three-world split, the licensing history, and the
full record of each release live in [`docs/`](./docs) — start with
[`docs/README.md`](./docs/README.md).
