# Context — Framework detectors

## The seam, as it was left in 0.2.0

`docs/context.md` from the rebrand recorded exactly where to cut, and it held up:

> **If a second detector is ever added**, these are the seams to widen:
> `shared/types.ts` — the `Vue*` result types · `shared/protocol.ts` — the `BridgeResult`
> variants · `inspector/vue-internals.ts` — the only file that reads framework internals
> · `shared/output.ts` `describeStack()` and the `**Components:**` lines

`vue-internals.ts` turned out to export just three functions — `relativizeFile`,
`detectPage`, `inspectElement` — so the interface was already the right shape. Phase 0
was mostly renaming plus two genuine behaviour decisions (below).

## What each framework actually exposes

This is the whole reason the design does not flatten them into one shape.

| | Instance tree on DOM | Source positions | Props | Version |
|---|---|---|---|---|
| **Vue** | `__vueParentComponent` / `__vue__` | tracer WeakMap, or `data-v-inspector`, or file-level `__file` | `instance.props` | `__vue_app__.version` |
| **Svelte** | **none at all** | `__svelte_meta.loc` — file, line, char, dev only, no plugin | none | `window.__svelte.v` (a Set) |
| **React** | `__reactFiber$<random>` → `.return` | `_debugSource`, **removed in React 19** | `__reactProps$<random>` | DevTools hook renderer |
| **Angular** | `ng.getComponent(el)`, dev only | **none, ever** | instance fields (no `@Input()` record) | `[ng-version]` |

Two consequences worth stating plainly:

- **Svelte has no component tree**, but its per-element `loc` is *better* for this tool
  than a tree would be: it is the exact authoring position, needing no name-to-file
  mapping and no build plugin. Ancestry is recovered from distinct `loc.file` values
  walking up — a file ancestry, which for Svelte is nearly the instance tree since one
  file is one component.
- **Angular and React 19 can give no source line at all.** The detectors report the
  component chain and omit `**Source:**` rather than degrading to a guess. Both cases
  are covered by a test asserting the *absence*.

## Two behaviour decisions in Phase 0

**1. `inspect()` must return `null` when it finds nothing.**

The old `inspectElement` ended with `?? emptyInfo(element)` — it never returned null. With
a dispatcher, a non-null answer stops the search, so Vue would have claimed every element
on every page and no other detector would ever run. Changed to return `null` unless the
framework left something usable, with Vue keeping a middle case: no component owner but a
tracer position or scoped-style hash is still worth reporting.

This is what makes per-element detection work across mixed pages, which the README has
advertised since 0.1.0.

**2. Vue's two source fields merged, with a `precision` flag.**

Vue had `tracer` (exact) and `sourceFile` (file-level) as separate fields, and
`resolveSource()` ranked them differently: tracer won outright, `sourceFile` had to
compete with the DOM attribute on basename. Collapsing to one field would have lost that.
`source.precision: "exact" | "file"` carries the distinction generically, so
`resolveSource()` no longer knows what Vue is — and Svelte's `loc` and React's
`_debugSource` slot in as `exact` for free.

## Known abstraction leak, accepted

`INSPECTOR_ATTR = "data-v-inspector"` still lives in `shared/protocol.ts` and is read by
`content/source.ts` — Vue-specific knowledge outside `detectors/`.

It stays there deliberately: it is a plain DOM attribute, so the isolated world can read
it with no bridge round-trip, which is the entire reason that path exists. Moving it into
the Vue detector would add a round-trip to every hover to recover purity. Success
criterion 4 in `brief.md` is therefore met *except* for this one constant, which is
better stated than quietly ignored.

## Fixtures simulate, they do not load

`react-app.html`, `svelte-app.html` and `angular-app.html` reproduce each framework's DOM
shapes by hand rather than loading the real runtime — the same approach `vue2-app.html`
has always taken.

Two reasons, one practical and one that turned out to matter more:

- The monorepo is a Vue shop. There is no React, Svelte or Angular install to borrow
  from, and adding three runtimes as devDependencies would break the project's
  zero-dependency constraint for the sake of test data.
- It lets *absences* be tested. A React 19 build with no `_debugSource` anywhere, or an
  element with no `__svelte_meta` of its own, are states a real dev build will not
  produce on demand. The fixtures produce them exactly.

**The honest limitation:** these prove the detectors read the documented shapes correctly.
They do not prove the shapes match every real version in the wild. `verify:tracer` covers
that for Vue against a real Nuxt app; the equivalent for the other three would need real
apps to point at.

## Related

- Rebrand to SenAnnotate, and the seam this task widened: [`../`](../)
- Predecessor architecture, three-world split: [`../history/vuetation/`](../history/vuetation/)
