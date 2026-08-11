# Changelog — Hardening

## 2026-08-11 · 0.3.2

**68 → 71 e2e.** Six confirmed defects fixed — all six in code written during the 0.3.1
clean-room rewrite, none in the code that had shipped for longer. That distribution is
exactly what the pre-rewrite test expansion predicted, and the three freeze bugs lived in
the one module whose behaviour the suite did not pin.

### The freeze timer design was wrong, not just buggy

The 0.3.1 `freeze.ts` handed out **decoy ids** for timers scheduled during a freeze and
held callbacks in a side queue. Three consequences, found independently by the review
pass and a manual read:

1. `clearTimeout` during a freeze cleared the decoy; the held callback replayed anyway —
   a debounce that cancels and reschedules fired **twice** (duplicate submit/fetch).
2. `clearInterval` during a freeze left the suspended entry behind, so a **cancelled**
   interval resurrected on unfreeze; and because the restarted interval's real id was
   discarded, the page could never clear it again. Runaway poller until reload.
3. Held timeouts replayed on unfreeze regardless of their requested delay — a 60-second
   timeout scheduled mid-freeze fired 59 seconds early.

Patching the symptoms (wrap the three cancel functions during the freeze) fixed 1 and
half of 2 but not the unclearable-resurrected-interval or the early firing, because the
decoy-id design itself was the defect. Replaced wholesale:

- Scheduling functions are wrapped **once, at `document_start`** — the same pattern
  `diagnostics.ts` already uses for `fetch`/XHR, and this script runs before the page's
  first line, so nothing schedules behind the wrapper's back.
- Ids are **real everywhere**; timers run on their real schedule. The wrapper checks
  `frozen` at *fire time*: timeouts and rAF callbacks that come due mid-freeze are parked
  by id and replayed on unfreeze; interval ticks are swallowed, not queued.
- Cancel functions stay wrapped for one narrow reason: a callback that already fired
  into the parked state looks still-pending to the page, so cancelling must remove the
  parked entry too.

Three regression checks pin this: kept-timeout replays exactly once, cancelled timeout
never fires, cancelled interval does not resurrect.

### The other rewrite defects

- **`isOurs` never recognised our own animations** — plain `closest()` stops at the
  shadow boundary and only the shadow HOST carries the UI attribute, so `freeze()`
  paused the overlay's own marker/toast animations, the exact thing the file's header
  promises not to do. Now hops shadow roots to hosts.
- **`buildSelector` emitted selectors `document.querySelector` cannot resolve** for
  shadow-DOM content, by walking through boundaries and joining with ` > `. Now climbs
  to the outermost host first — the deepest thing the document can actually reach.
- **Id anchors were not verified unique**, and the rewrite had dropped the
  test-hook preference. Real markup repeats ids; `#card > button` resolving to the
  *first* `#card` re-targets the annotation onto the wrong element, which is worse than
  no match. Anchors are now tried best-first — `data-testid`/`data-test`/`data-cy`/
  `data-qa`, then an id — each proven unique via `querySelectorAll(...).length === 1`
  before being trusted.
- **`identifyElement` could label the wrong element**: a helper claimed to find the
  element "under the pointer" but actually read `shadowRoot.activeElement` — *focus*,
  not position — so the label could describe a previously-focused input while every
  other captured field described the clicked host. Deleted.

### Hardening beyond the rewrite

- **Dropped the unused `scripting` permission.** Never called — content scripts are
  declarative. For a soon-public repo, an unused powerful permission is a review flag
  and a needless grant.
- **Synthetic clicks on the open shadow root are now ignored.** Page scripts can reach
  into an open root and dispatch clicks at our buttons — auto-triggering a screenshot
  download into the user's Downloads, or clearing their annotations. Every activation
  handler registered through the `h()` helper now drops `isTrusted: false` events.
  Real input and CDP automation (how the tests click) are unaffected — proven by the
  suite passing unchanged.
- `redactUrl` dead-branch cleanup (`redacted ? text : text`).

### Process note

The automated review and the manual read overlapped on the freeze and selector findings,
and each also found things the other missed (manual: the unused permission, the
untrusted-click exposure; automated: the early-fire delay semantics, the
unclearable resurrected interval). Neither alone was the full list.
