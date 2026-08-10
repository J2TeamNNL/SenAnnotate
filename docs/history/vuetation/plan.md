# Plan — Vuetation

Target directory: `others/vuetation/`

## Layout

```
others/vuetation/
├── package.json                  esbuild + typescript only
├── tsconfig.json
├── build.mjs                     3 bundles + static copy
├── README.md
├── scripts/make-icons.mjs        dependency-free PNG rasteriser for the Vue mark
├── static/
│   ├── manifest.json
│   ├── popup.html
│   └── icons/*.png               generated
└── src/
    ├── shared/
    │   ├── types.ts              Annotation, VueComponentInfo, settings
    │   ├── protocol.ts           bridge + runtime message contracts
    │   └── output.ts             Markdown generation (4 detail levels)
    ├── inspector/index.ts        MAIN world: Vue internals + freeze
    ├── background/index.ts       service worker: capture, download, badge
    ├── popup/index.ts            settings page
    └── content/
        ├── index.ts              orchestrator + state machine
        ├── bridge.ts             postMessage RPC client
        ├── identify.ts           element identification (ported)
        ├── source.ts             data-v-inspector reader (isolated world)
        ├── storage.ts            chrome.storage per-URL persistence
        ├── ui/
        │   ├── root.ts           shadow host + theme tokens
        │   ├── toolbar.ts        floating toolbar
        │   ├── overlay.ts        hover highlight + marquee + text selection
        │   ├── composer.ts       annotation comment popup
        │   ├── markers.ts        numbered pins
        │   └── panel.ts          annotation list + copy/export
        └── styles.css            injected into the shadow root
```

## Steps

1. **Scaffold** — package.json, tsconfig, build.mjs, manifest, icon generator. Verify
   `pnpm build` emits a `dist/` Chrome will load.
2. **Shared types + protocol** — one place defining every message so the three worlds
   cannot drift.
3. **MAIN-world inspector** — Vue 3 / Vue 2 / Nuxt detection, component ancestry,
   `__file` resolution, props snapshot, freeze/unfreeze. This is the part with no
   equivalent in `agentation` and carries the most risk, so it lands early.
4. **Bridge** — probe-attribute handshake, request/response with timeout, so the
   content script degrades gracefully when the inspector is absent (e.g. a non-Vue page).
5. **Element identification** — port `element-identification.ts` near-verbatim.
6. **Isolated-world source resolution** — `data-v-inspector` walk-up, merged with the
   bridge result (inspector data wins on component names, DOM attribute wins on line numbers).
7. **UI** — shadow root, toolbar, hover overlay, marquee, composer, markers, panel.
8. **Output** — port `generate-output.ts`, add `Component:` / `Source:` / `Props:` lines.
9. **Persistence** — save/restore per `origin + pathname`, hydrate on load.
10. **Background** — `captureVisibleTab` + crop + download; badge shows annotation count.
11. **Verify** — typecheck, build, then load the unpacked extension against a real
    Nuxt app in the monorepo and confirm the Source line resolves.

## Risks

- **`world: "MAIN"` timing.** The inspector runs at `document_start`, before Vue mounts.
  It must not snapshot anything at load — only respond to requests. Handled by making
  it purely reactive.
- **CSP.** Some apps set a strict `script-src`. Declarative `content_scripts` with
  `world: "MAIN"` are exempt from page CSP (unlike a manually injected `<script>` tag),
  which is why the manifest declares it rather than injecting at runtime.
- **Production builds.** No `__file`, no `data-v-inspector`. Detect and tell the user
  in the toolbar rather than silently emitting weaker output.
- **Clipboard.** `navigator.clipboard` can be blocked by permissions policy; fall back
  to a `execCommand("copy")` on a textarea inside the shadow root.
