# Multi-page reports and iframes — brief

## What

Two changes that both widen what one report can cover.

1. **A session report.** One Markdown document covering every page you annotated,
   copied from the popup, instead of one copy per page.
2. **Iframe support.** Annotate elements inside frames — Storybook previews, embedded
   apps, hosted checkouts — which today cannot be annotated at all.

## Why

**Session report.** Annotations are keyed by `origin + pathname`, and `copyReport()`
only ever renders the current key. A tester walking a checkout flow — cart, address,
payment, confirmation — annotates four screens and then has to visit each one again to
copy four reports and paste them together by hand, re-ordering as they go. The data is
already there: `listAnnotatedPages()` exists and the popup already calls it, purely to
decide what `Clear` will delete.

**Iframes.** The manifest declares `all_frames: false` on both content scripts, so a
frame's document has no inspector and no content script. In the top frame,
`document.elementFromPoint` over an iframe returns the `<iframe>` element itself, so the
best obtainable annotation is "iframe.preview" — the contents are unreachable. That rules
out the single most common place a front-end developer looks at a component in isolation
(Storybook, Histoire, Ladle all render into an iframe), plus embedded dashboards, hosted
payment forms, and any micro-frontend composed with frames.

## Scope

In:

- `all_frames: true`, with child frames running a **capture-only** mode: no toolbar, no
  panel, no storage, no badge.
- Frames smaller than 50×50 CSS px are skipped entirely, so ad and tracking frames cost
  nothing.
- A child frame's annotation is handed to the top frame, which owns storage and
  translates coordinates by the iframe's position.
- The report names the frame an element came from.
- Session report: gather every annotated page, render one document, copy it from the
  popup. Per-page sections in the order they were annotated.

Out:

- Markers that track scrolling *inside* a frame (see the limitation in `context.md`).
- Diagnostics per frame — console and network capture stays a top-frame concern.
- Cross-tab sessions. One tab, many pages, is the workflow being served.

## Success

- Load a page with a same-origin and a cross-origin iframe, turn on inspect mode, hover
  something inside each: it highlights. Click: the composer opens naming the inner
  element, and the report names the frame.
- A page with twenty ad iframes: no toolbar duplication, and the small frames are not
  instrumented.
- Annotate three pages, open the popup, copy the session report: one document, three
  sections, every note present.
