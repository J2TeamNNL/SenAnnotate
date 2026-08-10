# Brief — Framework detectors (0.3.0)

## What

Extend component/source detection from Vue only to **Vue, React, Svelte and Angular**,
by making the detector layer pluggable first.

Two phases, both delivered:

- **Phase 0** — widen the seam. Framework-neutral types, one `FrameworkDetector` per
  framework behind a dispatcher, Vue rewritten as the first implementation. **No
  behaviour change** — 46/46 e2e unchanged.
- **Phase 1–3** — Svelte, then React, then Angular. 60/60 e2e.

## Why

The tool was rebranded to SenAnnotate in 0.2.0 on the premise that it works on any
website, and it does — but the *useful* part, the component ancestry and source file,
only ever appeared on Vue pages. On a React or Svelte app you got selectors and a DOM
path, which is what the annotation would have said anyway.

`docs/context.md` (0.2.0) deliberately deferred generalising the types under YAGNI,
recording the exact seams to widen "if a second detector is ever added". That condition
arrived.

## Scope

**In:**
- `PageFrameworkInfo` / `ElementFrameworkInfo` replacing the `Vue*` types
- `FrameworkDetector` interface, dispatcher, one module per framework
- Svelte, React and Angular detectors
- A fixture and e2e coverage per framework
- README rewritten around a capability matrix rather than Vue

**Out (deliberately):**
- Solid, Preact, Qwik, Astro, Ember. Each is another research-and-test cycle with much
  lower payoff; the seam now makes them cheap to add if ever wanted.
- Splitting the 700-line Vue detector. The goal was the seam, not restructuring Vue's
  internals.
- Migrating annotations persisted under the old `annotation.vue` key.
- Route paths for React/Svelte/Angular — none expose the route *pattern* reliably, and
  `location.pathname` is not the same thing.

## Success criteria

1. Vue behaviour identical to 0.2.0: the 46 pre-existing checks pass untouched.
2. Each new framework: detected with a version, a component ancestry in the report, and
   a source line **where and only where** that framework actually records one.
3. A page with no framework still shows no badge and no `Stack:` line.
4. `grep -rn "vue" src/` outside `detectors/vue.ts` finds nothing framework-specific —
   no consumer knows which frameworks exist.
