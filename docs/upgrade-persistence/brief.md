# Brief — notes and settings must survive an upgrade

## What was asked

"Every time the extension is upgraded, the settings and the notes taken before must be kept."

## What was already true

Measured before writing anything: this holds today, and has since 0.2.0.

- Chrome keeps `chrome.storage.local` and `chrome.storage.sync` across an update. Storage is
  keyed by extension id, and an update does not change it.
- The two keys have never moved. Extracting `content.js` from every shipped zip and resolving
  the namespace constant gives `NS = "senannotate"` in 0.2.0, 0.4.0, 0.5.1, 0.5.2 and today —
  so `senannotate:page:<origin><pathname>` and `senannotate:settings` in all of them.
- `loadSettings()` spreads over `DEFAULT_SETTINGS`, so a settings object written by an older
  version gains new fields as defaults instead of breaking.
- Every `Annotation` field added after 0.2.0 is optional, with the two behavioural ones
  documented as "absent means" (`kind` → `ui`, `status` → `open`). `git show v0.2.0` confirms
  the required set is unchanged.

So there was nothing to fix. What there was, was nothing stopping a future release from
breaking it — a renamed key, or a field promoted to required, and every installed copy's notes
become unreachable with no error anywhere.

## Scope

Pin it: a test that performs a **real** version upgrade and asserts the notes and settings come
through, including a note in the 0.2.0 shape.

## Out of scope, and why

- **A migration framework.** Nothing needs migrating; the contract holds. A migration written
  now would be dead code guarding a rename nobody has proposed.
- **Uninstall / reinstall, and side-loaded → Web Store.** Both are new extension ids, so Chrome
  gives them empty storage; no code can reach across. The popup's export / import already
  covers moving notes deliberately, and that path has its own tests.

## Done when

`npm test` runs the upgrade check as part of the gate and it passes from a clean checkout.
