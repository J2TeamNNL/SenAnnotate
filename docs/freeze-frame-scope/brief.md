# Brief — Scoping freeze's timer wrap to the top frame (issue #24)

`src/inspector/freeze.ts` patched five native scheduling functions at module load in
**every** frame on **every** page. `inspector.js` is registered `world: "MAIN"`,
`run_at: "document_start"`, `all_frames: true`, so the wrap landed the instant the
document started parsing, regardless of whether that frame ever froze.

That is the defect `diagnostics.ts` was already fixed for in 0.5.x: replacing a native
in the page's own heap makes `Function.prototype.toString` report tampering, and the
browser-integrity widgets that probe for it — Cloudflare Turnstile, reCAPTCHA, Stripe
Elements — render in exactly the iframes we were patching. A Turnstile challenge that
will not verify is a page the user cannot get past.

Reported by @yanacuti1121, who correctly noted that the diagnostics fix
(`if (window.top === window)`) might not transfer, because unlike diagnostics, freeze
has a *reason* to reach into child frames: a frozen screenshot of embedded content needs
that content's rAF loops and video actually paused.

## The finding that decided it

**`freeze()` cannot run in a child frame today.** Two independent facts:

- The freeze command reaches the inspector over `window.postMessage` in
  `src/content/bridge.ts:70` — same window, never cross-frame.
- Its only caller, `toggleFreeze` in `src/content/index.ts:382`, is reached from three
  places (the toolbar button, `setActive`'s `freezeOnInspect`, the keyboard handler) and
  all three are inside the `installTopFrame()` branch. `installChildFrame()` has no
  freeze path at all.

So `frozen` is false for the entire life of every child document. Every iframe on every
page was paying five monkey-patches, plus a `Map` of parked callbacks per patch, for a
flag that could not change.

That collapses the design question. The wrap is not a trade-off between screenshot
fidelity and widget compatibility — it is dead weight with a compatibility cost. Guarding
it costs nothing that currently works.

## Fix

```ts
if (window.top === window) wrapTimers();
```

Deliberately *not* the other candidate fix — deferring the wrap to the first `freeze()`
call. `wrapTimers()` has to run before the page's first line or an interval the page
already started keeps ticking straight through the freeze; that constraint is why the
0.3.2 rewrite settled on wrap-once-at-document_start
(`docs/hardening/changelog.md`). Lazy wrapping would trade a real bug for a subtler one.

## Left undone, on purpose

Freezing motion *inside* an iframe remains unimplemented — it was never implemented, and
this change does not remove it. Doing it properly means routing freeze/unfreeze down
`FRAME_CHANNEL` alongside the existing `state` and `capture-hover` commands, and wrapping
timers in the child on the arriving command rather than at module load. The guard is the
place that work attaches to; the comment there says so.

Scope kept to the filed bug.
