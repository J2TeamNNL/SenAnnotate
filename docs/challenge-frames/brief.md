# Diagnostics must not patch natives in child frames

## What

`installDiagnostics()` runs once per frame, at `document_start`, in the page's own JS
heap. Restrict it to the top frame.

## Why

A page carrying a Cloudflare challenge could not be verified while the extension was
enabled — with inspect mode **off**, nothing clicked, nothing annotated. Simply having
SenAnnotate installed was enough.

Diagnostics capture replaces four page natives:

| Replaced | Where |
|---|---|
| `window.fetch` | `inspector/diagnostics.ts:200` |
| `XMLHttpRequest.prototype.open` | `diagnostics.ts:269` |
| `XMLHttpRequest.prototype.send` | `diagnostics.ts:278` |
| `console.error` | `diagnostics.ts:170` |

Turnstile is a browser-integrity widget. Reading `fetch.toString()` and finding
something other than `[native code]` is exactly the signal it exists to detect, and the
widget renders in an iframe that `all_frames: true` was injecting into — so the patches
were in place before Cloudflare's own script ran.

The part that makes this a plain bug rather than a trade-off: **the capture was never
read in a child frame.** `onDiagnostics` and `fetchDiagnostics` are called only inside
`installTopFrame()`, and the child branch of `content/index.ts` already documents the
intent — *"no annotations, no diagnostics, no badge"*. The MAIN world simply never got
that memo. Every iframe on every page — ad slots, embeds, captcha widgets — was paying
the cost of a buffer nobody could read.

> **Follow-up:** this fixed diagnostics and missed the other offender in the same bundle.
> `freeze.ts` was wrapping five native timer functions in every frame for the same reason
> and with the same consequence — see [`../freeze-frame-scope/`](../freeze-frame-scope/),
> issue #24. Anything added to `src/inspector/` that touches a page native needs the same
> top-frame question asked of it.

## Scope

One line in `src/inspector/index.ts`, plus two e2e assertions.

Explicitly **not** in scope: making the patches undetectable. Dressing `patchedFetch` up
as native to slip past an anti-bot check is an arms race, and the wrong side of one — a
visual annotator has no business hiding from browser-integrity checks.
