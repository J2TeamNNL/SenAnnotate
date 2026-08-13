# Multi-page reports and iframes — context

## Part 1 — the session report

Everything needed already exists and is not wired together:

- `listAnnotatedPages()` (`content/storage.ts:47`) reads every `senannotate:page:` key
  and returns `{ page, count }[]`, sorted by count.
- `generateOutput(annotations, context, detailLevel)` renders one page's worth.

The gap is that `OutputContext` is built from `location` and the live
`PageFrameworkInfo`, neither of which exists for a page you are not currently on. So
the session renderer degrades honestly: per-page headers carry the stored pathname, and
the framework/diagnostics lines are simply absent for every page except the one the
report was copied from — which is nowhere, since the popup is not a page.

Decision: the session report is **detail-level `standard` at most, no diagnostics**, and
says so in its own header. Diagnostics are per-load state that was never persisted;
pretending otherwise would produce a report with a "Steps to reproduce" section from
whichever page happened to be open.

The popup can write to the clipboard: it is a real document, and the copy is triggered
by a click, so `navigator.clipboard.writeText` has user activation. No content script
round-trip needed.

## Part 2 — iframes

### Why the top frame cannot do this alone

Framework metadata lives on DOM nodes in the frame's own JS heap, and
`elementFromPoint` in the top document stops at the `<iframe>` element. A same-origin
frame could in principle be reached with `iframe.contentDocument`, but a cross-origin
one cannot, and the inspector would still be in the wrong world. So the child frame has
to run the scripts itself, which is what `all_frames: true` does.

### The split

```
top frame     toolbar, panel, composer, markers, storage, badge, diagnostics
child frame   hover highlight + capture only; sends drafts up; no storage, no UI chrome
```

`window.top === window` decides which. A child frame builds a UI root — it needs its
own highlight overlay, since it cannot draw into the parent's document — but never
constructs `Toolbar`, `Panel` or `Composer`.

### Coordinate translation

A draft captured in a child frame is in that frame's coordinate space. The top frame
translates it on arrival:

```
offset = iframeElement.getBoundingClientRect()   // in the top frame's viewport
document coords = child coords + offset + topFrameScroll
```

Finding `iframeElement` from a `message` event is the one non-obvious bit:
`event.source` is the child's `Window`, and comparing it against
`iframe.contentWindow` **is permitted cross-origin** — window identity checks are not
blocked by the same-origin policy, unlike property reads. So the top frame scans its
own `document.querySelectorAll("iframe")` for the match.

### The limitation this design accepts

A pin is stored in the top document's coordinate space. If the user scrolls *inside*
the iframe afterwards, the framed element moves but the pin does not — the top frame
cannot observe a cross-origin frame's scroll position. The pin stays where the element
was when it was annotated.

This is accepted rather than solved. Solving it means a persistent per-frame channel
posting scroll offsets on every frame's scroll event, for a cosmetic gain on a
re-visit. The *report* — selector, DOM path, component, source file — is unaffected,
and the report is the product.

### Why 50×50

Tracking pixels are 1×1. Ad slots are frequently 0-sized until filled. Consent frames
and analytics beacons are routinely a few pixels. A frame that small can hold nothing a
person would annotate, and instrumenting it costs a full inspector + content script pair
— on a news site, forty of them. The check is `window.innerWidth < 50 || innerHeight < 50`
evaluated once at `document_idle`, when layout has settled.

A frame that starts small and grows (a lazily-sized embed) stays uninstrumented for that
page load. Accepted: re-evaluating would mean a `ResizeObserver` in every 1×1 tracking
frame, which is precisely the cost being avoided.

### `sandbox` frames

A frame with `sandbox` and no `allow-scripts` runs no JavaScript at all, ours included.
Nothing to detect and nothing to do — hovering it highlights the `<iframe>` element from
the top frame, which is the honest answer.

### Message security

The child→top channel is `window.postMessage`, the same transport the MAIN↔ISOLATED
bridge uses, and it is reachable by any script on any of these pages. Two guards:

- the top frame only accepts frame messages whose `event.source` matches an `<iframe>`
  in its own document — a message from an unrelated window is dropped;
- the payload is treated as untrusted data: it is rendered through `textContent` (the
  `h()` helper has no HTML sink, deliberately) and every string is truncated before
  storage.

A hostile page could forge a draft from its own iframe and get a fabricated annotation
into the panel. It could equally just call `document.write` — it owns the page. The
guard that matters is the existing one in `ui/dom.ts`: synthetic (`isTrusted: false`)
activation events are dropped, so a page cannot make the *user* save or copy anything.

## Files

| File | Change |
|---|---|
| `static/manifest.json` | `all_frames: true` on both content scripts |
| `src/content/frames.ts` | new — the child/top channel and coordinate translation |
| `src/content/index.ts` | branch at boot: top mode or child mode |
| `src/shared/protocol.ts` | frame message types |
| `src/shared/types.ts` | `Annotation.frame` |
| `src/shared/output.ts` | render the frame line; `generateSessionOutput` |
| `src/popup/*` | page list + copy session report |
