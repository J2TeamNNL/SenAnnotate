# Multi-page reports and iframes — plan

Session report first: it is independent, lower-risk, and lands value before the frame
work destabilises anything.

## Part 1 — session report

### 1. `shared/output.ts`

```ts
export interface SessionPage { page: string; annotations: Annotation[] }
export function generateSessionOutput(pages: SessionPage[], detail): string
```

Header names the page count and total note count, then one `## <pathname>` section per
page with the origin on the line below, then the same per-annotation renderer already
used — with `detail` clamped to `standard` and no diagnostics, per `context.md`.

### 2. `content/storage.ts`

`listAnnotatedPages()` gains the annotations themselves (it already reads them to count).
Returns `SessionPage[]`; the popup's existing count display derives from `.length`.

### 3. Popup

Replace the bare `Clear` row with a **Pages** section: each annotated page as a row
(pathname, origin, count), plus **Copy session report**. Rows are informational — no
navigation, which would need `tabs.create` and a reason.

## Part 2 — iframes

### 4. Manifest

`all_frames: true` on both content scripts. `inspector.js` stays MAIN /
`document_start`, `content.js` stays ISOLATED / `document_idle`.

### 5. `content/frames.ts` (new)

```ts
export function isTopFrame(): boolean
export function isFrameWorthInstrumenting(): boolean     // the 50×50 gate
// child side
export function sendDraftUp(draft: Draft): void
export function onFrameCommand(cb: (cmd: FrameCommand) => void): void
// top side
export function broadcastToFrames(cmd: FrameCommand): void
export function onFrameDraft(cb: (draft: Draft, frame: FrameRef) => void): void
export function frameOffset(source: MessageEventSource | null): { rect: DOMRect; ref: FrameRef } | null
```

`FrameRef` is `{ selector: string; url: string; label: string }` — the `<iframe>`'s
selector in the top document, its `src`, and a short label for the report.

### 6. `content/index.ts` — the boot branch

```ts
if (!isTopFrame()) {
  if (!isFrameWorthInstrumenting()) return;   // 1×1 tracking frames stop here
  bootChild();                                 // highlight + capture, nothing else
} else {
  bootTop();                                   // everything that exists today
}
```

`bootChild` reuses `createUiRoot` for the overlay layer only, and reuses the existing
`pointermove` / `click` handlers verbatim — the difference is what happens on capture:
`sendDraftUp(draft)` instead of `openComposer`.

Inspect mode in a child frame is driven by the top frame: `setActive` broadcasts
`{kind: "active", value}` to every frame.

### 7. Top-side receive

On `onFrameDraft`: resolve the offset, translate `boundingBox`,
`elementBoundingBoxes`, `x` and `y` into top-document space, attach `frame`, then open
the composer at the translated anchor. From there it is the existing path unchanged.

### 8. Report

`**Frame:** storybook-preview (iframe[src="/iframe.html?id=…"])` above `**Location:**`,
at `standard` and up.

### 9. Tests

A new fixture page embedding (a) a same-origin iframe with a button and (b) a 1×1
iframe. Assertions:

- hovering inside the same-origin frame highlights the inner element,
- clicking it opens the composer naming the inner button,
- the report carries a `**Frame:**` line,
- exactly one `.toolbar` exists in the tab (no duplication),
- the 1×1 frame has no shadow host.

The harness serves fixtures from one origin; a genuine cross-origin frame needs a second
port. `startServer()` returns one server — a second one on another port is a small
addition and worth it, since same-origin and cross-origin take different code paths in
the offset lookup.

## Verification

```bash
npm run typecheck
SENANNOTATE_PLAYWRIGHT_DIR=… npm test
npm run verify:sites     # real pages, where real ad frames live
```
