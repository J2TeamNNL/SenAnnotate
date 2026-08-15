# Redact typed field values from captured component props

## What

`inspectElement` (the detector dispatcher) redacts value-bearing and secret-named props
before they leave the MAIN world.

## Why

A security pass found a confirmed, default-on data exposure. `includeProps` defaults to
`true`, and a controlled input carries its current text as a prop:

- **React** attaches host props to the DOM node, so clicking a `<input value={state}>`
  records `value=<the typed text>` — a password field records the password.
- **Vue** wrapper input components leak `modelValue`; **Angular** components leak public
  instance fields like a bound `password`.
- **Svelte** never sets `props`, so it is unaffected.

The value was written into `chrome.storage.local` at *every* detail level (detail only
gates rendering, not storage), carried verbatim into JSON exports, and printed as
`Props: value=…` in detailed/forensic reports. That contradicts the load-bearing
guarantee, stated in `README.md` and enforced elsewhere with tests, that *values typed
into fields are never recorded* — the action trail is careful to say `Edited Password`
rather than the password, and the props path walked straight past it.

## Severity

MEDIUM, confirmed (verification confidence 8/10). Not remotely exploitable and no code
execution — the exposure is a tester's own secret ending up in a report they then paste
into a ticket or share as JSON. Most likely to bite on the tool's primary target, a dev
build of your own app, where framework metadata is richest.

## Fix, and why there

One choke point: the dispatcher's `inspectElement`, which every detector funnels through
and which runs in every frame's MAIN world. Per-detector fixes would be four edits and a
standing invitation for the next detector to reintroduce it. Redacting after
`detector.inspect()` returns keeps the value from ever entering a bridge payload.

The key is kept and only the value replaced (`value=[redacted]`), so the report still
carries the useful signal without the secret.
