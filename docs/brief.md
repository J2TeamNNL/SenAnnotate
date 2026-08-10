# Brief — SenAnnotate (universal visual annotator, Chrome extension)

## What

Rebrand and generalise the existing `others/vuetation` extension into **SenAnnotate**:
a Manifest V3 Chrome extension that works on **any** website, not just Vue apps.

Click any element on any page, attach a note, copy a structured Markdown report that
an AI coding agent can act on. When the page happens to be a Vue app, the report
additionally carries the component ancestry and source file — but nothing about the
tool assumes, requires, or advertises Vue.

## Why

`others/vuetation` already works on every site technically — `manifest.json` declares
`<all_urls>`, every Vue-derived field in the report is optional-chained, and the e2e
suite has a passing plain-HTML fixture. What is wrong is the **framing**:

1. **The name and copy promise a Vue tool.** "Vuetation — Vue.js visual annotator"
   tells a tester it is not for the site they are testing, when in fact it is.
2. **The toolbar cries wolf.** `src/content/ui/toolbar.ts:142-149` shows an amber
   warning badge reading *"No Vue detected"*. On a universal tool that fires on most
   of the web, where it reads as breakage rather than as expected.
3. **Every report on a non-Vue site says "Vue not detected".**
   `src/shared/output.ts:36` emits that string into the `**Stack:**` line, which is
   noise an agent has to skim past.

The underlying capability — element identification, console/network/action capture,
freeze animations, screenshots, four detail levels — was never Vue-specific.

## Deliverable

The existing `others/vuetation/` project, rebranded to SenAnnotate v0.2.0 and moved to
`others/senannotate/`, plus `npm run pack` producing `senannotate-0.2.0.zip`.

## Scope

**In:**
- Rename every `vuetation` / `Vuetation` surface to `senannotate` / `SenAnnotate`
- New brand: orange accent (`#f97316` family), "S" monogram icon replacing the Vue mark
- Dedupe the storage-key constants that are currently declared twice
- Fix the no-framework UX: hide the stack badge, omit the `Stack:` report line
- Rewrite the one e2e assertion that encodes the old badge behaviour, add new ones
- Task docs, written at the monorepo root and later copied into this repo as `docs/`

**Out (deliberately):**
- Removing Vue detection. It stays exactly as-is, as an optional enhancement.
- Renaming the `PageVueInfo` / `VueElementInfo` / `VueMajor` / `VueFlavour` types to
  something framework-neutral. Vue is still the only detector, so a generic name
  would describe a generalisation that does not exist. See `context.md`.
- Adding React / Angular / Svelte detectors.
- Migrating existing stored annotations to the new storage keys.
- Firefox / Safari packaging; Chrome Web Store submission.

## Success criteria

1. On a non-Vue site (plain HTML or a React app), the toolbar shows **no** stack badge,
   annotating works, and the copied report contains no `Stack:` line and no mention
   of Vue.
2. On a Vue dev build (`storefront_v5`), behaviour is unchanged from v0.1.0: component
   ancestry and source file still resolve.
3. `npm run typecheck`, `npm run test` and `npm run build` all pass.
4. `grep -rin vuetation others/senannotate --exclude-dir=node_modules --exclude-dir=dist`
   returns nothing. `history/vuetation/` keeps its references — it is history.
