# Plan

1. **Reproduce and narrow.** Establish that the failure needs only the extension to be
   enabled — not inspect mode, not a click. That eliminates everything gated on
   `active` and leaves the two unconditional installs.
2. **Confirm the mechanism by experiment, not by reading.** Build two bundles differing
   in exactly one line and test both against the real failing page. Do not propose a fix
   until one of them verifies.
3. **Check whether the capture is used where it is installed.** Trace `diagnosticsCache`,
   `onDiagnostics` and `fetchDiagnostics` back to their call sites; if they are all
   top-frame, the fix is a restriction rather than a trade-off.
4. **Write the failing assertion first**, in the existing iframe block of `test/e2e.mjs`:
   a control that the top frame is still instrumented, and the real one that the child
   frame's four natives all report `[native code]`. Confirm it fails.
5. **Fix**: `if (window.top === window) installDiagnostics();`
6. **Verify**: `npm run typecheck`, then the full suite plus the upgrade check.
7. **Record** the gap the investigation exposed but this change does not close — the
   `captureDiagnostics` setting not gating the MAIN-world patch — in `context.md`.

## Rejected before starting

- **Make the patches look native.** Restoring `toString()` to `[native code]` to defeat
  the integrity check. Wrong side of an arms race, and it would break again on the next
  detection technique.
- **`exclude_matches` for captcha hosts.** A denylist that ages badly and misses the
  same-origin case. See `context.md`.
- **Replace fetch/XHR patching with `PerformanceObserver`.** Genuinely appealing —
  `PerformanceResourceTiming.responseStatus` exists on Chrome 109+ and needs no patching
  at all — but it drops the HTTP method from the report and is a rewrite of the network
  half of diagnostics. Worth its own task; not this one.
