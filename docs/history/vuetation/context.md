# Context — Vuetation

## Reference source: `agentation` v3.0.2

Cloned to scratchpad for study. Key modules and what we took:

| agentation file | LOC | Ported? | Notes |
|---|---|---|---|
| `src/utils/element-identification.ts` | 615 | ✅ near-verbatim | Framework-agnostic. Shadow-DOM aware path/name/classes/a11y/computed-styles. |
| `src/utils/react-detection.ts` | 704 | ♻️ rewritten | Fiber walking → Vue instance walking. Filter/`smart`-mode ideas kept. |
| `src/utils/source-location.ts` | 904 | ♻️ rewritten (much smaller) | React needs `_debugSource` + stack-probe heuristics. Vue gives us `__file` directly, and `data-v-inspector` is exact. |
| `src/utils/freeze-animations.ts` | 266 | ✅ ported, relocated | Must run in the **MAIN** world — see below. |
| `src/utils/generate-output.ts` | 129 | ✅ ported + extended | Added Vue-specific lines. |
| `src/components/page-toolbar-css/` | 4709 | ♻️ rewritten | React → vanilla TS in a Shadow DOM. |

## Why a Chrome extension changes the architecture

`agentation` runs *inside* the app bundle, so it can read `element.__reactFiber$xxx`
directly. A content script cannot.

**Chrome isolated worlds:** a content script shares the *DOM tree* with the page but
has a separate JS heap. Expando properties the framework writes onto DOM nodes
(`__vue_app__`, `__vueParentComponent`, `__vue__`) are **not visible** from an
isolated-world content script.

So the extension is split:

```
┌─ MAIN world (src/inspector) ─────────────┐   same page, page's JS heap
│  reads __vueParentComponent / __vue__    │
│  patches setTimeout/rAF for freeze       │
└──────────────┬───────────────────────────┘
               │ window.postMessage bridge
┌──────────────┴───────────────────────────┐
│  ISOLATED world (src/content)            │   chrome.* APIs available
│  Shadow-DOM toolbar, overlays, markers   │
│  chrome.storage, chrome.runtime          │
└──────────────┬───────────────────────────┘
               │ chrome.runtime.sendMessage
┌──────────────┴───────────────────────────┐
│  service worker (src/background)         │
│  captureVisibleTab, downloads            │
└──────────────────────────────────────────┘
```

**DOM nodes cannot cross `postMessage`.** The bridge instead stamps the target with
`data-vuetation-probe="<uid>"`, sends the uid, and the MAIN-world script re-resolves
it with `querySelector`. The attribute is removed immediately after.

**Freeze must be MAIN-world.** Patching `window.setTimeout` from the isolated world
patches only the content script's own timers, not the app's. CSS injection, WAAPI
`document.getAnimations()` and `<video>.pause()` do work from either world (shared DOM)
but are kept together in MAIN for a single source of truth.

## Vue internals we rely on

### Vue 3
- `el.__vueParentComponent` → `ComponentInternalInstance`; walk `.parent` for ancestry.
- `el.__vnode` → the vnode that rendered this element.
- `el.__vue_app__` → present on the app root container only (`createApp().mount(el)`).
- Name resolution order: `type.__name` (set by `@vitejs/plugin-vue` for `<script setup>`)
  → `type.name` → `type.displayName` → basename of `type.__file`.
- `type.__file` is injected **in dev only** by `@vitejs/plugin-vue` / `vue-loader`.
- `instance.props` → the resolved props object.

### Vue 2
- `el.__vue__` → the component instance; walk `.$parent`.
- `vm.$options.name` → `vm.$options._componentTag` → basename of `vm.$options.__file`.
- `vm.$props`.

### Nuxt
- Nuxt 3/4: `window.__NUXT__`, `#__nuxt` root, `useRoute()` not reachable from outside,
  so the route is read from `window.__NUXT__.state` / `location.pathname`.
- Nuxt 2: `window.$nuxt` (a Vue 2 root instance) — also gives `$nuxt.$route.path`.

### Source location, best → worst

1. **`vite-plugin-vue-tracer`** — exact file + line + column. This is what
   `@nuxt/devtools` v3+ ships, and it **replaced** `vite-plugin-vue-inspector`.

   Critically, it writes **nothing to the DOM**. Positions go into a global store:

   ```js
   globalThis.__vue_tracer__ = {
     hasData: boolean,
     vnodeToPos: WeakMap<vnodeProps, [source, line, column]>,
     fileToVNode: Map<source, WeakSet<vnodeProps>>,
     posToVNode: Map<...>,
   }
   ```

   Resolution is `el.__vnode?.props` → `vnodeToPos.get(props)`, walking up the DOM
   until a recorded ancestor is found (see
   `vite-plugin-vue-tracer/dist/client/record.mjs`, `findTraceFromElement`).
   Paths are already project-relative — the plugin's `resolveRecordEntryPath`
   option defaults to `true`. Because the store lives in the page's heap, this has
   to be read in the MAIN world and relayed over the bridge.

   Gated on `devtools: { enabled: true }`; the plugin's own `enabled` defaults to
   `'dev'`.

2. `data-v-inspector="src/components/Foo.vue:12:5"` — the older
   `vite-plugin-vue-inspector`. Exact line+column, readable straight off the DOM
   from the isolated world. Kept for projects still on that plugin.

3. `type.__file` / `$options.__file` — absolute path, file-level only. Relativised
   by cutting at the first `/src/`, `/app/`, `/pages/`, `/components/`,
   `/layouts/` segment. Already-relative paths are passed through untouched, since
   the tail-truncation fallback would mangle them.

4. Scoped-style hash `data-v-7ba5bd90` + component name — no path, but a unique
   `grep -r` handle into the repo.

All of 1–3 are stripped in production builds. There the report degrades to
selector + classes + DOM path, which is still what `agentation`'s "compact" mode
gives you.

> **This one cost a detour.** The first version only looked for `data-v-inspector`
> and the README claimed Nuxt DevTools enabled it by default. Measuring a live
> Nuxt 4 app found **zero** such attributes — Nuxt had moved to the tracer, and
> every report was silently falling back to file-level `__file`. Read the
> installed package, not the blog posts.

## Constraints

- `world: "MAIN"` in `content_scripts` needs **Chrome 111+**. Declared as
  `minimum_chrome_version` in the manifest.
- MV3 content scripts are **not** ES modules → everything under `src/content` and
  `src/inspector` must bundle to a single IIFE each. `esbuild` with
  `format: "iife"` handles this; the service worker and popup are ESM.
- No runtime dependencies. Build-time deps are `esbuild` + `typescript` only, matching
  agentation's "zero dependencies" constraint.
- Extension icons must be raster (Chrome rejects SVG in `manifest.icons`), so
  `scripts/make-icons.mjs` rasterises the Vue mark with a dependency-free PNG encoder.

## Files that matter in this repo

- `seller_v3/` — Nuxt 4 / Vue 3 / `<script setup>` → the primary test target.
- `seller_v2/`, `admin_v2/` — Nuxt 2 / Vue 2 → the `__vue__` code path.
- `storefront_v5/` — second Vue 3 target.
