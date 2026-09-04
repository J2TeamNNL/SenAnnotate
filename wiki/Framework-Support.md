# Framework Support

**Annotating works on any page.** What a framework adds is the component ancestry and the
source location — and how much of that exists differs a lot, because each framework
records different things.

Rather than flatten them to a lowest common denominator, the report carries what is
actually there.

---

## The matrix

| | Components | Source | Props |
|---|---|---|---|
| **Vue** 2, 3, Nuxt 2, 3/4 | ✅ | `file:line:col` with the tracer, filename otherwise | ✅ |
| **Svelte**, SvelteKit | ✅ from `loc.file` | ✅ `file:line:col`, **no plugin needed** | ❌ |
| **React**, Next.js | ✅ | `file:line:col` on React ≤18; **none on React 19** | ✅ |
| **Angular** | ✅ | ❌ none — Angular records no authoring positions | ✅ |
| **No framework** | — | — | — |

A page with no framework simply reports no component data, with no badge and no warning.
You still get the element name, a re-resolvable selector, the DOM path, classes, computed
styles, screenshots and all of [[Diagnostics and Privacy]].

---

## Mixed pages work

**Detection is per-element, by design.** A Svelte widget inside a React app, a Vue island
in server-rendered markup, a legacy Angular admin screen embedding a new React panel —
all of these report correctly, because each element is asked about individually.

The page-level answer only decides which detector to *try first*. If it says no, the next
one is asked.

---

## How each framework is read

### Vue — four strategies, best first

1. **`vite-plugin-vue-tracer`** — what current Nuxt DevTools (v3+) ships. Writes
   **nothing to the DOM**; positions live in a global WeakMap,
   `globalThis.__vue_tracer__.vnodeToPos`, keyed by each vnode's `props` object. Exact
   file, line and column. Requires `devtools: { enabled: true }`.
2. **`data-v-inspector`** — from the older `vite-plugin-vue-inspector`. Exact, and
   readable straight off the DOM. Nuxt has since moved off it.
3. **`__file`** on the component options — present in any dev build of Vue 2 or 3.
   File-level only, no line.
4. **Scoped-style hash** — `data-v-7ba5bd90`. No path, but it **survives production** and
   is a unique `grep -r` handle. Reported at Forensic detail.

### Svelte — better than a component tree, oddly

Svelte has **no component instance tree on the DOM at all** — there is no
`__svelteComponent` to walk.

What it has, compiled with `dev: true`, is `el.__svelte_meta.loc`: the exact authoring
file, line and character, **per element**. For this job that is *better* than a component
tree, because it needs no name-to-file mapping and no build plugin at all.

The ancestry is recovered by walking up and collecting distinct `loc.file` values — which
for Svelte is nearly the instance tree, since one file is one component.

Props are not exposed anywhere, so none are reported.

### React — fibers, and the React 19 regression

React attaches its fiber under a **randomised** key (`__reactFiber$<random>`), so it is
found by prefix scan. From there `fiber.return` gives the ancestry.

Source came from `fiber._debugSource`, which **React 19 removed**. On React 19 you get
the component chain and no source line, unless the app runs its own babel plugin. This is
upstream and there is nothing the extension can do about it.

`elementType` is preferred over `type`, so `memo` and `forwardRef` wrappers report what
the author actually wrote rather than the wrapper.

### Angular — the only documented debug API

`window.ng.getComponent(el)`, installed outside production mode.

It answers only for elements that **are** component hosts, so the chain is built by
walking up and asking about each ancestor in turn.

Angular records no authoring positions anywhere — not even in dev — so there is no source
line to give. This is not a gap in the detector.

---

## Production builds

**On a production build, names and paths are stripped in every framework.**

The toolbar badge turns **amber** and says so, rather than quietly emitting a weaker
report. You still get selectors, DOM paths, classes, computed styles and grep handles.

### What you actually get — measured, not assumed

`test/build-prod-fixtures.mjs` produces three minified production builds of the same app,
and the suite asserts on each.

| | stock prod | `+ __VUE_PROD_DEVTOOLS__` | `+ tracer` |
|---|---|---|---|
| Element name, selector, DOM path, classes | ✅ | ✅ | ✅ |
| Console errors, failed requests, repro steps | ✅ | ✅ | ✅ |
| Component tree `<App> <TheSidebar> <BaseButton>` | ❌ | ✅ | ✅ |
| Source filename `BaseButton.vue` | ❌ | ✅ | ✅ |
| Full path + line + column | ❌ | ❌ | ✅ |
| **Bundle cost** | — | +1.7 KB | +2.6 KB |

**The middle column is the interesting one.** `__name` — the component's real,
unminified name — is emitted by the SFC compiler in production too, and
`@vitejs/plugin-vue` re-attaches `__file` once devtools are on. In a production build it
deliberately stores only the *basename*
(`isProduction ? path.basename(filename) : filename`), so you get a filename to grep for
**without publishing your directory structure**:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  vite: { define: { __VUE_PROD_DEVTOOLS__: true } },
})
```

That is the flag Vue's own runtime checks before writing `__vnode` /
`__vueParentComponent` onto DOM nodes.

**1.7 KB for a component tree on your staging environment is a very good trade.**

### Exact line and column in production

Add the tracer — **and turn sourcemaps on**:

```ts
import VueTracer from 'vite-plugin-vue-tracer'

export default defineNuxtConfig({
  vite: {
    define: { __VUE_PROD_DEVTOOLS__: true },
    plugins: [VueTracer({ enabled: true })],
  },
  // REQUIRED. The tracer maps generated positions back through the upstream sourcemap;
  // with sourcemaps off it finds no map, transforms nothing, and fails completely
  // silently. `hidden` emits the maps it needs without referencing them from the
  // shipped bundle.
  sourcemap: { client: 'hidden' },
})
```

> ⚠️ **This exposes every source path and component name** to anyone who opens the page.
> Fine for a QA or staging host. A deliberate decision for real production.

---

## Adding a detector

`src/inspector/detectors/index.ts` is the only module that knows which frameworks exist.
Adding one should mean **one new file implementing `FrameworkDetector`, plus one line in
`DETECTORS`**.

If it forces edits to `shared/output.ts`, `content/ui/toolbar.ts` or `content/source.ts`,
the abstraction has leaked — fix that instead of working around it.

Two rules a detector must obey:

- **`detect()` and `inspect()` must not throw**, and must return `null` when the
  framework does not own the page or element, so the dispatcher can try the next one.
- **Returning a mostly-empty object stops the search.** That is exactly what would break
  a Vue island inside a React page.

See [[Architecture]] and
[`docs/framework-detectors/`](https://github.com/thangnm93/SenAnnotate/tree/main/docs/framework-detectors).
