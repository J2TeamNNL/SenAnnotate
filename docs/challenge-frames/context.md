# Context

## Why the patches exist at all

`inspector/diagnostics.ts` opens with the reasoning, and it is still correct: an
ISOLATED-world content script has its own `window`, so page errors never reach its
handlers and patching its `fetch` intercepts only our own traffic. To see what the
*page* sees, you must be in the page's heap, and you must be there first — hence
`world: "MAIN"`, `run_at: "document_start"`.

None of that argues for doing it in **every** frame. `all_frames: true` is on the
manifest entry because the inspector is also what answers `inspect` for an element
inside an iframe — framework metadata lives in that frame's heap. Diagnostics rode along
on a manifest flag that was set for an unrelated reason.

## The two mechanisms considered

With inspect mode off, exactly two things ran unconditionally in a challenge iframe:

- **A** — `installDiagnostics()` replacing natives (MAIN, `document_start`).
- **B** — `installChildFrame()` → `createUiRoot()` attaching a shadow host and a
  `MutationObserver` to `documentElement` (ISOLATED, `document_idle`). The click and
  `mousedown` swallowing in there is gated on `active`, so it was never a candidate for
  an inspect-mode-off failure; the DOM injection was.

A Turnstile widget is roughly 300×65, comfortably over `MIN_FRAME_SIZE` (50), so it
passed `isFrameWorthInstrumenting()` and got both.

**A was confirmed by experiment**, not by argument: two builds differing in one line
(`installDiagnostics()` commented out, 17,994 B vs 20,836 B of `inspector.js`), tested
against the real failing site. The challenge verified on the build without patching.

B is therefore unproven as a cause and was left alone. If a challenge surface later
turns out to object to the shadow host too, the filter to reach for is
`isFrameWorthInstrumenting()`, not another manifest flag.

## Why not `exclude_matches`

Listing `challenges.cloudflare.com` (and hCaptcha, and reCAPTCHA, and whatever ships
next quarter) in the manifest is a denylist that is wrong the moment it is written, and
it would not have covered the same-origin case at all. `window.top === window` is a
statement about where the data is *used*, which is the actual invariant.

## What this does not fix

A Cloudflare **interstitial** — the full-page "Verifying you are human…" served at the
site's own URL — renders in the top document, where diagnostics still install. If that
turns out to be a problem in practice, the fix is a different one: the `captureDiagnostics`
setting does not gate the MAIN-world patch at all today (see below), and making it do so
is the honest answer.

## Known gap: the setting does not gate the patch

`settings.captureDiagnostics` reads as "Capture errors & steps" in the popup, but it only
gates the ISOLATED side — the action trail (`content/index.ts:943`) and what goes into
the report (`:549-550`). Turning it off still leaves the page's `fetch` replaced.

Closing that needs the MAIN-world script registered dynamically
(`chrome.scripting.registerContentScripts`, which is CSP-exempt like a declarative entry
and supports `world: "MAIN"` on Chrome 111+) and torn down when the setting flips. That
adds the `scripting` permission and moves the inspector off the manifest, so it is its
own task, not a rider on this one.
