# Multi-page reports and iframes — changelog

## 0. Starting point

`copyReport()` rendered only the current `origin + pathname` key, and both content
scripts declared `all_frames: false`, so nothing inside an iframe could be annotated.

## 1. Session report

`generateSessionOutput()` in `shared/output.ts`, fed by `exportAll()` — the archive
function written for the previous task already returns exactly `{ page, annotations }[]`,
so no new storage reader was needed.

**Deviated from the plan on one point.** The plan said clamp the detail level to
`standard`, on the grounds that framework and diagnostics lines are unavailable for a
page nobody is standing on. That reasoning was wrong: those are *context*-level lines,
and every annotation carries exactly the per-element fields that were captured when it
was written. Asking for forensic here shows what is there and nothing more, which is
the same contract as on the page itself. No clamp.

What the header does instead is say plainly that console errors, failed requests and
steps to reproduce are absent because they were never stored — so nobody reads a
missing "Steps to reproduce" section as "there were no steps". The test pins that
sentence.

## 2. The restructure iframes forced

This was the real work, and the plan under-described it.

`content/index.ts` ran its whole orchestration at module scope: `createUiRoot()`, three
UI constructors, `chrome.runtime.onMessage.addListener`, nine `listen()` registrations,
and `void boot()`. With `all_frames: true` every one of those would also run inside
every instrumented iframe — a second toolbar per frame, several frames answering the
popup's `get-status`, and each frame owning its own copy of the page's annotations.

So the module-scope side effects moved into `installTopFrame()` at the foot of the
file, and `ui` / `overlay` / `markers` / `toolbar` became definite-assignment `let`s
built by `createTopUi()`. Every function between them is untouched — the diff is large
but the *logic* moved verbatim, which is why the 144 pre-existing checks stayed green
through it.

The file now ends with the only branch that matters:

```ts
if (isTopFrame()) installTopFrame();
else if (isFrameWorthInstrumenting()) installChildFrame(() => settings);
```

## 3. Three things the child frame needed that the plan did not list

**`C` arrives in the wrong document.** Hovering an iframe leaves keyboard focus in the
top frame, so the top frame's `captureHovered()` fires — and its `elementFromPoint`
returns the `<iframe>` element, not the button inside. `requestFrameHoverCapture()`
forwards the key to the frame under the pointer, which captures its own `hovered`.

**Two highlights for one element.** Both frames get `pointermove`, so the top drew a
box around the whole iframe while the child drew one around the inner button. Fixed by
having children announce themselves (`hello`) and the top exclude live child frames
from `eligible()`. A frame we are *not* inside — sandboxed without scripts, or under
50×50 — stays annotatable as an element, which is the honest answer for it.

**`hello` needs repeating.** Both frames run at `document_idle` and the child can
announce itself before the parent is listening. Sent at 0 ms, 300 ms and 1200 ms.

## 4. Scope held to depth-1 frames

`isFrameWorthInstrumenting()` requires `window.parent === window.top`. A frame nested
two deep would need its draft forwarded up through an intermediate frame, accumulating
offsets on the way; that is a real feature, not a small one, and an iframe inside an
iframe falls back to annotating the outer `<iframe>` element in the meantime.

## 5. The test hang, which is worth knowing about

The session-report check first read the clipboard from the popup page:

```js
await popup.evaluate(() => navigator.clipboard.readText())
```

`context.grantPermissions([...], { origin: base })` grants the *fixture* origin.
On `chrome-extension://…` the read raises a permission prompt that nothing in a headed
run ever answers, so the suite **hung for ten minutes instead of failing**. Reading it
back from a fixture page works — the clipboard is system-wide — and is what the suite
does now.

Rule of thumb this leaves behind: never call a permission-gated API from the popup in
this suite; drive the popup, observe from a page.

## 6. Tests

Six iframe checks (one toolbar despite three frames, the 1×1 frame is left alone,
clicking inside a frame names the inner element, the capture is translated into top
coordinates, the report carries a `**Frame:**` line, the element is fully identified)
and four session-report checks.

154/154 — green.
