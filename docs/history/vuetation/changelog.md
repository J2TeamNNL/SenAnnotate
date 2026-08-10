# Changelog — Vuetation

## 2026-08-07

### Research

- Studied `benjitaylor/agentation` v3.0.2 (cloned to a scratchpad). Mapped which
  modules port over and which need rewriting for Vue — see `context.md`.
- Wrote `brief.md`, `context.md`, `plan.md`.

### Build

Created `others/vuetation/` — a Manifest V3 extension, zero runtime dependencies,
built with esbuild.

- **Scaffold** — `package.json`, `tsconfig.json`, `build.mjs` (three bundles:
  two IIFE content scripts, an ESM service worker, an IIFE popup), MV3 manifest.
- **`scripts/make-icons.mjs`** — Chrome rejects SVG in `manifest.icons`, so the Vue
  mark is rasterised by a hand-rolled PNG encoder (scanline polygon fill with 4×
  supersampling, CRC32 + `zlib.deflateSync`). No image dependency.
- **`src/inspector/`** (MAIN world) — Vue 3 / Vue 2 / Nuxt detection, component
  ancestry, `__file` resolution and relativisation, props snapshot, scoped-style
  ids, plus the animation freeze (ported from agentation, relocated to the MAIN
  world because patching `setTimeout` from an isolated world patches nothing the
  app can see).
- **`src/content/`** (ISOLATED world) — bridge client, element identification
  (ported near-verbatim), `data-v-inspector` source resolution, per-URL storage,
  screenshot cropping, and the whole shadow-DOM UI: toolbar, hover overlay,
  marquee, composer, numbered markers, annotation panel.
- **`src/background/`** — `captureVisibleTab` and the toolbar badge, nothing else.
- **`src/popup/`** — status and settings.
- **`src/shared/output.ts`** — the Markdown report, four detail levels, extended
  from agentation's with `Source` / `Components` / `Props` lines.

### Verification

`test/e2e.mjs` loads the built extension into a real Chromium and drives it
against three fixtures (Vue 3 via the real runtime, a Vue 2 instance-shape
simulation, and a plain HTML page). It asserts on the rendered UI and on the
actual clipboard contents. **20/20 checks pass.**

Also verified by hand against a live Nuxt 4 app in this monorepo
(`storefront_v5`, Nuxt 4.4.7 / Vue 3.5.35). It correctly reported
`components/s/image.vue` and the ancestry
`<default> <index> <BaseHomePageBannerCarousel> <EmblaCarousel> <NuxtLink> <SImage>`.

> Note: `storefront_v5`'s dev server fails to boot with the default `TMPDIR` on
> macOS — Nuxt's vite-node unix socket path exceeds the 104-byte limit, so the
> socket silently fails to bind and every request 500s. `TMPDIR=/tmp/short npx
> nuxt dev` works around it. Unrelated to this extension, but it costs an hour if
> you have not seen it before.

### Bugs found and fixed during verification

1. **Clicks swallowed right after hover.** `isAnnotatable` rejected any element
   carrying the bridge's `data-vuetation-probe` attribute. Since a hover lookup
   stamps that attribute for the duration of the round trip, clicking an element
   quickly after the pointer reached it did nothing at all. Removed the check.
2. **Concurrent probes clobbering each other.** A hover lookup and a click capture
   can be in flight on the same element simultaneously; the first one's cleanup
   removed the attribute the second one depended on. Probe stamps are now
   reference-counted and share one id per element.
3. **"No Vue detected" on real server-rendered apps.** Detection ran at
   `document_idle` with a single 1.5s retry, which is well before a Nuxt app
   hydrating against a dev server has finished. Replaced with a backoff schedule
   (~15s total) plus a re-check when inspect mode is switched on.
4. **Dev builds reported as production.** `devMetadata` tested the mount container
   for `__vueParentComponent`, but Vue never sets that on the container — only on
   elements it rendered. Every real app therefore looked like a production build.
   Now scans a bounded slice of the subtree for elements Vue actually rendered.
5. **Panel layout.** `.card__body` did not flex, so the panel footer floated in the
   middle with dead space beneath it.
6. **Toast collided with the Copy button** it was reporting on. Moved to the
   bottom-left, away from both the toolbar and the panel.

Bugs 1 and 4 have regression checks in the suite.

### Follow-up: `vite-plugin-vue-tracer` support

Triggered by "what do we need for seller_v3?". Investigating that turned up a
wrong assumption baked into the first version.

- **Nuxt DevTools no longer emits `data-v-inspector`.** v3+ ships
  `vite-plugin-vue-tracer` instead, which writes nothing to the DOM and records
  positions in `globalThis.__vue_tracer__.vnodeToPos`, a WeakMap keyed by vnode
  `props`. That is why the live `storefront_v5` check measured **0**
  `data-v-inspector` attributes and quietly degraded to file-level `__file`.
- Added tracer support in the MAIN-world inspector (`readTracerPosition`, walking
  up the DOM to the nearest recorded ancestor) and put it at the top of the
  source-resolution order. Extended `SourceRef.origin` with `"tracer"` and
  `PageVueInfo` with `hasTracer`.
- Fixed `relativizeFile` to pass already-relative paths through untouched — the
  tracer hands over project-relative paths, and the absolute-path tail logic was
  truncating them.
- Toolbar badge tooltip now tells you which resolver is live, and how to get line
  numbers when none is.
- Three new regression checks (fixture `test/fixtures/vue3-tracer.html` reproduces
  the plugin's exact store shape). **23/23 pass.**

Verified against **seller_v3** (Nuxt 4.5.1 / Vue 3.5.40) with `devtools.enabled`
flipped on temporarily — reports came back as `app/pages/auth/login.vue:287:6`,
`app/layouts/auth.vue:16:10`. The config change was reverted; seller_v3 is
untouched.

**Recommendation for seller_v3:** nothing to install. `@nuxt/devtools` and
`vite-plugin-vue-tracer@1.4.0` are already in its dependency tree. It just needs
`devtools: { enabled: true }` in `nuxt.config.ts` (currently `false`) to get line
and column numbers.

### Follow-up: tester mode (diagnostics capture)

Goal: hand the extension to testers running against a **built** site, where all
component and source metadata is gone, and still get a useful bug report.

- **Console capture** — uncaught errors, unhandled rejections, `console.error`,
  and failed resource loads. `console.warn` is deliberately excluded; Vue dev
  warnings would bury everything worth reading.
- **Network capture** — patched `fetch` and `XMLHttpRequest`, recording 4xx/5xx
  and outright failures. Method, path, status, duration. **Never bodies.**
- **Action trail** — clicks, field edits, selects, submits, Enter/Escape, and SPA
  navigations, rendered as "Steps to reproduce" with relative timestamps.

All three live in the **MAIN world** and install at `document_start`. This is not
optional: an isolated-world content script has its own `window`, so page errors
never reach its handlers and patching its `fetch` intercepts only our own traffic.

Privacy is enforced, not just documented:
- Typed values are never recorded — the trail names the *field*, not its contents.
- Credential-shaped query params are rewritten to `[redacted]` before storage.
- Both have assertions in the suite (`the raw token never appears`,
  `typed input values never appear`).

`npm run pack` produces a zip with the guide inside; `TESTER-GUIDE.md` is the
Vietnamese walkthrough for Load-unpacked install.

**Bugs found while building this:**

7. **Copying silently broke.** Adding `await fetchDiagnostics()` to `copyReport`
   cost the click's transient user activation, so `navigator.clipboard.writeText`
   stopped working — and because the fallback also failed, the user would have
   pasted whatever was on their clipboard beforehand. Caught only because the test
   asserts on clipboard *contents*: it came back holding output from an earlier
   manual run against seller_v3. Fixed by mirroring diagnostics into the content
   script via a pushed `BRIDGE_EVENT`, leaving `copyReport` synchronous up to the
   clipboard call.
8. **Annotating polluted the repro steps.** Clicking an element to annotate it was
   recorded as a user action. The trail now pauses while inspect mode is on.

Suite is at **38/38**.

### Follow-up: measuring production builds

Question: can QA get devtools-grade information from the extension on production?

Rather than reason about it, `test/build-prod-fixtures.mjs` now produces three
**real minified production builds** of the same app (vite + @vitejs/plugin-vue,
resolved out of the monorepo, no new dependencies) and the suite drives the
extension against each.

| | stock | `+__VUE_PROD_DEVTOOLS__` | `+tracer` |
|---|---|---|---|
| element / selector / DOM path | ✅ | ✅ | ✅ |
| diagnostics (errors, network, steps) | ✅ | ✅ | ✅ |
| component tree, real names | ❌ | ✅ | ✅ |
| file + line + column | ❌ | ❌ | ✅ |
| bundle | 61.6 KB | 63.2 KB | 64.2 KB |

**The finding that matters:** `__name` is emitted by `@vue/compiler-sfc` in
production as well as dev (verified by calling `compileScript` with
`isProd: true`). So `__VUE_PROD_DEVTOOLS__: true` alone — one flag, +1.7 KB —
restores the entire component tree with unminified names, while leaking **no**
source paths. That is a far better trade than the "you need a dev build" answer.

**A wrong claim in the previous README, now corrected.** It stated that
`VueTracer({ enabled: true })` restores `file:line:col` in a production build.
It does not, on its own. The plugin maps generated positions back through the
upstream sourcemap; with `build.sourcemap: false` it finds no map and transforms
**nothing**, with no warning — the plugin looks installed and is inert. It needs
`sourcemap: 'hidden'` at minimum. Found by building the fixture and noticing the
tracer variant was byte-identical to the devtools one.

Suite is at **44/44**.

### Follow-up: enabling it on seller_v3's `develop` deploy

Requested: turn `__VUE_PROD_DEVTOOLS__` on for seller_v3, dev environment only.

**Files changed in `seller_v3/`:**

1. `nuxt.config.ts` — `vite.vue.features.prodDevtools`, driven by
   `process.env.VUE_DEVTOOLS === 'true'`. Nuxt forwards `vite.vue` straight into
   `@vitejs/plugin-vue` (`vuePlugin(clientConfig.vue)` in @nuxt/vite-builder), and
   the plugin turns that option into `define: { __VUE_PROD_DEVTOOLS__ }` itself —
   so this is the supported API rather than a raw define that something could
   overwrite. Verified that neither Nuxt nor Vite sets this flag on its own.
2. `Dockerfile` — `ARG VUE_DEVTOOLS=false` / `ENV` in the **build** stage, before
   `npm run build`. Defaults off.
3. `bitbucket-pipelines.yml` — `--build-arg VUE_DEVTOOLS=true` on the `develop`
   step only.

**Why a new build arg instead of the existing `APP_ENV`:** the pipeline already
passes `--build-arg APP_ENV=dev`, but it passes it on `test-deploy-production`
too — a step that builds the **production** image (`seller-v3-prod`). Gating on
`APP_ENV` would have shipped devtools metadata to production. (`APP_ENV` is also
currently consumed by nothing: no `ARG APP_ENV` in the Dockerfile, no reference in
the app. Flagged to the user, deliberately not changed.)

**Verified by building seller_v3 twice, for real:**

| | `__vueParentComponent` in client bundle |
|---|---|
| `VUE_DEVTOOLS=true` | 4 occurrences |
| unset | **0** |

Then served the flag-on production output and drove the extension against it:
`<nuxt-root> <LayoutLoader> <auth> <UApp> <UToaster> <login>` — real component
names off a minified production build.

**Correction to the previous entry.** It claimed `__VUE_PROD_DEVTOOLS__` yields no
source file. It does yield one: `@vitejs/plugin-vue` re-attaches `__file` when
devtools are enabled, but stores only the basename in production
(`isProduction ? path.basename(filename) : filename`). So the middle tier gives
`login.vue` — a grep target — without exposing the directory layout. README table
and two e2e checks corrected.

Suite is at **45/45**.

### Deliberately out of scope

The agentation MCP server and its multi-session sync protocol, design mode
(drag-to-rearrange, palette editing), and Firefox/Safari packaging.
