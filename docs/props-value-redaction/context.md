# Context

## The data flow, end to end

1. `capture.ts` passes `settings.includeProps` (default `true`) to the bridge.
2. The MAIN-world dispatcher calls `detector.inspect(element, options)`; the detector
   reads the owner's props and returns them in `info.props`.
3. `capture.ts` stores `draft.framework` — props included — **unconditionally**. Detail
   level gates only what `shared/output.ts` renders, not what is stored or exported.
4. `storage.ts` writes it to `chrome.storage.local`; `archive.ts` dumps every local key
   verbatim into the JSON export.
5. `output.ts` prints `Props: …` at detailed/forensic. Switching detail level later
   renders retroactively from the stored data, and export always carries it.

So the redaction has to happen before step 3 — before the value is stored, not just
before it is rendered. The dispatcher is the last point in the MAIN world common to all
detectors and all frames, which is why the fix lives there rather than in `capture.ts`
(content side, and only for `captureDraft` callers) or in each detector.

## The two redaction rules

- **Secret-named keys** — `password`, `secret`, `token`, `apikey`, `auth`, `jwt`, `otp`,
  `pin`, `cvv`, `ssn`, `email`, `phone`, … — are redacted wherever they appear. A prop
  literally called `password` is a secret regardless of the element.
- **Value-bearing keys** — `value`, `modelValue`, `defaultValue`, `inputValue`,
  `checked`, `defaultChecked` — are redacted only when the element is, or contains, a
  field (`input, textarea, select, [contenteditable]`). A `value` prop on a non-field
  component (a slider's numeric setting, say) is not a typed secret, so it survives; the
  field test is resolved lazily because the DOM query is not free on every hover.

This is deliberately kept *separate* from `diagnostics.ts`'s `SENSITIVE_PARAM`, which
matches loosely on substrings inside a URL query string. A whole-prop-key match wants
different anchoring, and coupling the two would make a change for one silently reshape
the other.

## What this does not do

- **Already-stored annotations keep their old values.** This redacts on capture; a note
  taken before the fix still holds whatever it recorded. There is no migration — the
  export/import path would carry old values out.
- **It is not a completeness guarantee.** A framework that exposed a secret under an
  unlisted, non-value-bearing key on a non-field element would still pass. The rule
  covers the confirmed leak (typed field values) and the obvious names; it is not a DLP
  engine. The honest framing in the settings help stays: props can carry secrets, and
  the toggle exists to turn the whole thing off.

## Verification note

The e2e fixture is React-shaped rather than a real React page, matching how
`react-app.html` already simulates fibers — it keeps the suite hermetic and lets the
exact prop shape (`value` on a host input fiber) be pinned. The assertion checks both
halves: the secret string is absent from the report, and `value=[redacted]` is present,
so a fix that dropped the prop entirely (losing the signal) would fail the second half.
