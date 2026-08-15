# Changelog

## Found by a full-codebase security pass

Requested review of the whole shipping surface. The sweep came back with no HIGH,
remotely-exploitable issues — no HTML sinks anywhere in `src/`, the `isTrusted` guard
correctly stops the page driving `chrome.*` actions, the bridge checks `event.source`,
download filenames are traversal-safe, and `publish-store.mjs` handles the service-account
key without logging it. Two MEDIUM findings surfaced; this is the one that verified as a
real, concrete exposure (confidence 8/10). The other — forged iframe drafts — verified as
PARTIAL/low and was hardened alongside the Hide-until-restart work.

## The leak

`includeProps` defaults on, and a controlled React input carries its typed text as a
`value` prop. Clicking such an input recorded the value into `chrome.storage.local`, the
JSON export, and forensic reports — past the guarantee that field values are never
recorded. Vue `modelValue` and Angular instance fields leak the same way; Svelte does not.

Verification traced every hop and confirmed storage is unconditional: detail level gates
rendering only, so even "compact" stored the value. It also confirmed the settings help
already admitted props can carry secrets — but the toggle defaults on, and the specific
case of *typed field values* was never called out.

## The fix

`inspectElement` in the detector dispatcher redacts value-bearing keys on field elements
and secret-named keys anywhere, before the props leave the MAIN world. One place, all
four detectors, every frame. The key survives as `value=[redacted]`.

## What was checked and deliberately left

- **Already-stored values are not migrated** — this scrubs on capture. Recorded in
  `context.md`.
- The redaction is a **targeted rule, not a DLP engine** — it covers the confirmed leak
  and obvious secret names, and the toggle remains the real off-switch.

## Verification

```
210/210 e2e, 9/9 upgrade
```

Two new assertions, failing first: the secret string never reaches the report via props,
and the redacted key is kept so the signal survives. A React-shaped fixture
(`react-input.html`) carries the value, matching how `react-app.html` already simulates
framework shapes hermetically.
