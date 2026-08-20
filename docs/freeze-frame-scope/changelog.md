# Changelog — freeze frame scope

## What changed

- `src/inspector/freeze.ts` — `wrapTimers()` is now called only when
  `window.top === window`. Header banner, the section-4 preamble and the comment inside
  `freeze()` updated to say which of the four motion sources is top-frame-scoped and why.
- `test/e2e.mjs` — two checks added to the existing iframe block, next to the diagnostics
  natives check that covers the same failure class:
  - a child frame's `setTimeout` / `clearTimeout` / `setInterval` /
    `requestAnimationFrame` / `cancelAnimationFrame` all report `[native code]`
  - the top frame's do **not** — the guard must not take freeze with it

The second assertion is the one worth keeping. A guard that silently disabled freeze
everywhere would have passed a child-frame-only test.

## Verification

- `npm run typecheck` — clean
- `npm test` — 270/270 e2e checks, 9/9 upgrade checks, headless Chromium
  (`SENANNOTATE_HEADLESS=1`)

Test-first: the child-frame check failed at 269/270 (`innerTimersNative=false`) before
the guard, and the top-frame check passed both before and after.

## What went wrong on the way

Nothing, but the investigation nearly took a wrong turn worth recording. The issue frames
this as a scoping *decision* — how much cross-frame reach should freeze have? — which
invites designing the FRAME_CHANNEL plumbing first and then guarding. Reading
`bridge.ts`'s `send()` before designing anything showed the request is same-window, and
that turned a design question into a one-line guard with a test.

The order that paid off: trace who can actually call the thing, before deciding what it
should do.
