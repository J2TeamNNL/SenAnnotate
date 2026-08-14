# Changelog

## The report

A page using a Cloudflare challenge could not be verified while the extension was
enabled. Crucially: **inspect mode off**, nothing clicked. Installed was enough.

That single detail did most of the work. Everything in the child-frame path that
interferes with a click — the `click`, `mousedown` and `mouseup` swallowing in
`installChildFrame` — is gated on `active`, so none of it could be responsible. What
remained were the two things that run whether or not the user ever touches the toolbar:
the MAIN-world diagnostics patches at `document_start`, and the shadow host
`createUiRoot()` attaches inside any frame over 50×50.

## Confirming it, rather than assuming it

The mechanism was obvious enough on paper to be worth distrusting, so it was tested:
two builds, one line apart.

```
dist-control            inspector.js  20,836 B   contains "[redacted]", XHR capture
dist-A-no-diagnostics   inspector.js  17,994 B   diagnostics tree-shaken out
```

A first attempt to verify the difference with `grep -c patchedFetch` returned 0 on
*both* builds — esbuild minifies the function name away. The marker had to be a string
literal (`[redacted]`) that survives minification. Worth remembering: a grep for an
identifier is not a check against a minified bundle.

The challenge verified on `dist-A-no-diagnostics`. Root cause confirmed.

## The finding that changed the fix

The obvious fix would have been to exclude captcha origins in the manifest. Tracing
`diagnosticsCache` first turned up something better: it is read in exactly two places,
`content/index.ts:945` and `:952`, and both are inside `installTopFrame()`. The child
branch of the same file already says out loud what it wants — *"The child needs settings
for the detail level `captureDraft` works to, and nothing else — no annotations, no
diagnostics, no badge."*

So this was never a trade-off between diagnostics and captchas. Every iframe on every
page was having its natives replaced to fill a buffer that no code path could reach.
`all_frames: true` is on that manifest entry so the inspector can answer `inspect` for
elements inside frames; diagnostics inherited the flag by accident.

The fix is `if (window.top === window) installDiagnostics();` — an identity comparison,
so it stays legal cross-origin.

## Verification

Failing test first, in the existing iframe block of `test/e2e.mjs`, with a control
assertion beside it so a fix that disabled capture everywhere could not pass:

```
ok    the top frame is still instrumented
FAIL  a child frame's natives are left unpatched, so a captcha can still verify — innerNative=false
182/183 checks passed
```

After the fix, and confirmed by the reporter on the real site:

```
183/183 checks passed
9/9 upgrade checks passed
```

## What is still open

- **The `captureDiagnostics` setting does not gate the MAIN-world patch.** "Capture
  errors & steps" unchecked still leaves the top frame's `fetch` replaced; the setting
  only reaches the ISOLATED side. Closing it needs dynamic registration of the inspector
  — see `context.md`.
- **A same-origin Cloudflare interstitial is untouched by this change**, since it renders
  in the top document. Not reported, not reproduced, not fixed.
- **Mechanism B — the shadow host inside a challenge iframe — is unproven either way.**
  It was not needed to explain the failure, so it was left alone rather than changed
  speculatively.
