# Plan

1. **Confirm the leak by reading the data flow**, not by assuming it: props read →
   bridge → storage → export → report. Establish that storage is unconditional and
   detail level gates only rendering, because that decides where the fix must sit.
2. **Confirm which detectors are affected** — React (clicked input's own host props),
   Vue 2/3 (wrapper `modelValue`/`$props`), Angular (public instance fields). Svelte is
   clean. This is what makes the dispatcher the right altitude.
3. **Write the failing assertion first** on a React-shaped fixture carrying a `value`
   prop that must never ship, at forensic detail so props render.
4. **Fix in `inspectElement`**: sanitize `info.props` after the detector returns, with
   the secret-name and value-on-field rules. Keep the key, redact the value.
5. **Verify** the whole suite plus the existing privacy assertions still pass.

## Rejected

- **Per-detector redaction.** Four sites, and the next detector reintroduces the leak.
- **Content-side (`capture.ts`).** Misses non-`captureDraft` consumers and lets the
  value cross the bridge before it is scrubbed.
- **Dropping the prop entirely.** Loses the signal that a value exists; `value=[redacted]`
  is more useful and the second assertion pins it.
- **A migration for already-stored values.** Out of scope for the leak fix; noted in
  `context.md` as a known residue.
