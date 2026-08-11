# Plan

Test first: the fixture and its checks must fail against the current build for the
documented reason before anything is changed, or the fix is unverified by construction.

## 1. Fixture — `test/fixtures/modal.html`

A plain page (no framework: this is a DOM-level bug and a framework would only add noise)
with one modal that dismisses on a `document` `mousedown` landing outside the dialog — the
most common pattern, and the one measured as the trigger.

The dialog holds an annotatable target so the test can prove the modal is not merely
*present* but still usable. A `window.__closeLog` records what dismissed it, so a failure
says why rather than just "closed".

## 2. Checks in `test/e2e.mjs`

Added as their own page block, following the existing style (`check(name, condition, detail)`,
one browser context, sequential). Order matters — the modal has to be opened while inspect
mode is **off**, because inspect mode correctly swallows page clicks:

1. open the modal → it is open
2. click **Inspect** → still open ← fails today
3. press `F` → still open, and the page really is frozen
4. click **Annotations** (opens the panel) → still open
5. press `H` (collapse) → still open
6. annotate an element **inside** the dialog → the composer opens and the report names it

(6) is the check that encodes the user's actual goal; (2) is the one that fails first today.

## 3. Fix — `src/content/ui/root.ts`

In `createUiRoot`, after the shadow root exists, attach one bubble-phase listener per
pointer event type to the **host**, each calling `stopPropagation()`. Bubble phase at the
host runs after our inner handlers and before `document`, which is exactly the seam.

Event set and the reasoning for the exclusions are in `context.md`. Registered on the host
rather than the shadow root so anything later appended outside the three layers is still
covered.

## 4. Verify

- The new checks pass.
- The full suite passes — particularly the marquee block, which drives raw
  `mouse.down`/`move`/`up` over the page and must be unaffected, and the composer/panel
  buttons, which are the ones now downstream of a `stopPropagation`.
- `npm run typecheck`.

## 5. Record

`changelog.md` gets what was measured, including freeze being cleared as a suspect, and the
focus-trap case left open with its reasoning.
