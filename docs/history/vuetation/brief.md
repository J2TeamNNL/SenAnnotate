# Brief — Vuetation (Vue.js visual annotator, Chrome extension)

## What

A Manifest V3 Chrome extension that lets you click any element on a running Vue.js
app, attach a note, and copy a structured Markdown report that an AI coding agent
can use to find the exact source code you are pointing at.

It is the Vue equivalent of [`agentation`](https://github.com/benjitaylor/agentation)
(React-only, shipped as an npm component you must import into your app).

## Why

1. **We are a Vue shop.** `seller_v3` / `storefront_v5` are Nuxt 4 + Vue 3,
   `seller_v2` / `admin_v2` are Nuxt 2 + Vue 2. `agentation` only understands
   React fibers, so it produces zero component/source context on our apps.
2. **Zero code changes.** `agentation` requires `npm i agentation -D` and a
   `<Agentation />` mount in every app. A browser extension works on every
   environment — local dev, staging, production — with nothing shipped in the bundle.
3. **Better handoff to agents.** "Fix the blue button in the sidebar" costs an agent
   several grep rounds. `src/components/TheSidebar.vue:42` + `<App> <TheSidebar> <BaseButton>`
   costs it none.

## Deliverable

`others/vuetation/` — a loadable-unpacked MV3 extension, plus `pnpm build` to
produce `dist/`.

## Scope

In:
- Click-to-annotate, text-selection annotate, drag-marquee multi-select
- Vue 3 + Vue 2 + Nuxt component-tree detection
- Source file resolution (`data-v-inspector` → `__file` → scoped-style hash)
- Component props snapshot, Pinia/Vuex detection
- Freeze animations (CSS + WAAPI + video + page timers)
- 4 output detail levels, clipboard copy
- Per-URL persistence via `chrome.storage.local`
- Element screenshot (cropped from `captureVisibleTab`)
- Light/dark/auto theme

Out (deliberately):
- The `agentation` MCP server / multi-session sync protocol
- Design mode (drag-to-rearrange, palette editing)
- Firefox/Safari packaging

## Success criteria

On a Nuxt 4 dev server, clicking a component-rendered element yields an annotation
whose `Source` line points at the real `.vue` file, and whose `Component` line shows
the real component ancestry.
