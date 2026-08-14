# Plan

In two parts, like `draggable-toolbar/plan.md`: what the feature was built to, and what
the review turned it into. The second part is the interesting one — two findings were the
same bug in two guises, and both were **the composer displays one element and stores
another**, which is precisely the failure this feature exists to fix.

## Part 1 — the walk

1. **`src/content/ui/composer.ts`**
   - `RetargetDirection = "parent" | "child" | "previous" | "next"`, and
     `onRetarget?(direction)` on `ComposerCallbacks` — optional, because retargeting does
     not apply to every composer.
   - `RETARGET_CONTROLS`, one table holding the direction, its key, its glyph and its
     title, so the keys and the buttons cannot drift apart.
   - `renderMeta(data)` extracted from the constructor and rebuilt wholesale on each
     retarget: retargeting changes *which* rows exist, and destroying the composer to
     rebuild it would take the note and the focus with it.
   - `setData(meta)` — the note, the chosen type, the caret and the focus are untouched.
   - Arrow handling in the existing `keydown`, gated on the note still being empty: the
     textarea has focus from the moment the composer opens, so the arrows otherwise belong
     to the caret.

2. **`src/content/index.ts`**
   - `stepFrom(from, direction)` — skips anything `eligible` refuses, stops at
     `document.body`.
   - `retargetComposer(direction)` — recaptures the draft (element name, source, component
     chain and props all belong to the element, not the note) behind a `retargetToken` so a
     burst of presses cannot land out of order.
   - `retargetable(draft, existing)` — a fresh, single-element, non-text pick only.
   - `composerMeta(draft)` shared by the initial build and every retarget.

3. **`src/content/ui/styles.css`** — `.retarget` / `.retarget__button`, in the Element row.

4. **Verify** — `npm run typecheck`, `npm run build`, `npm test`.

5. **Document** — the shortcut row in the README, `brief.md`/`context.md`/`changelog.md`,
   and this file.

## Part 2 — what the review changed

### The two that stored the wrong thing

6. **A screenshot was silently discarded by a retarget.** `deliverScreenshot` mutates the
   Draft object it was handed; a retarget replaces that object, so click → camera → mark
   up → Save → <kbd>↑</kbd> → submit stored an annotation with no screenshot, with the PNG
   orphaned in `~/Downloads` and `persist()` already run against an array that never held
   the draft.

   Carrying the fields across in the swap was the other option and is worse: the image is a
   crop of *one element's* box, so a retarget would put a picture of the old element in a
   report about the new one. Same failure mode, quieter. **Retargeting is refused once a
   screenshot exists**, and while the markup editor is open (it is about to write into the
   same draft), with a toast that says to take the screenshot last.

7. **An in-flight retarget could resolve into a different composer.** The guard tested
   `!composer`, not that it was still the *same* composer. <kbd>↑</kbd> on element A, then
   <kbd>Esc</kbd>, then a click on B: the stale promise resolves, the token still matches
   because nothing bumped it, `composer` is truthy — and it is B's. B's composer then showed
   parent-of-A's rows, highlighted parent-of-A, and its camera screenshotted parent-of-A.

   `const owner = composer` before the await plus `composer === owner` after it, and
   `closeComposer` bumps `retargetToken`.

### The rest of the behaviour

8. **IME.** `if (keyboard.isComposing) return;` at the top of the handler. The pre-edit
   buffer is not in `textarea.value`, so with a Vietnamese, Japanese or Korean IME the
   "note is still empty" test was true while a candidate list was open, and <kbd>↓</kbd> to
   pick a candidate retargeted instead. First in the handler, so it also protects the
   **pre-existing** Escape branch, which was closing the composer and dropping the note
   when the user only meant to cancel a composition.

9. **Holding an arrow moved one level, not n.** `from` was read from `composerTargets[0]`
   before the await and only assigned after it, so at ~30Hz key repeat every press computed
   the same neighbour and the token discarded all but the last. A `retargetFrom` module
   global is set to the requested element *before* the await — step from the last
   **requested** element, not the last **confirmed** one.

10. **No `isConnected` guard**, the exact check `captureHovered` calls "the guard that
    matters". `stepFrom` succeeds on a detached subtree for `child`, and `captureDraft` then
    returns a zero-sized box and a selector resolving to nothing — an annotation that looks
    right in the panel and points nowhere.

11. **The composer was never re-clamped after `setData`.** `position()` ran only in the
    constructor and writes a fixed `top`; `.card` is `position: fixed`, `overflow: hidden`,
    no `max-height`. Retargeting a bare `<div>` near the bottom of the window onto a
    framework component adds ~54px of rows and pushed Save, the camera and delete below the
    viewport. `setData` re-clamps against the stored anchor. *Not repositioning* was always
    about not following the element; it never covered refusing to stay on screen.

### Shape

12. **`retargetable` reads the draft it is handed.** `isMultiSelect` and
    `elementBoundingBoxes` already encode the count, and the guard now also requires the
    element to belong to *this* document — which is what makes the iframe path safe by
    design rather than by `onFrameDraft` happening to clear `composerTargets` first.

13. **`live` and the dead `existing` parameter are gone.** A `composerDraft: Draft | null`
    beside `composerTargets`, cleared by the same `closeComposer`, replaces the
    `(next) => (live = next)` setter threaded down two levels — and makes finding 7's guard
    a one-liner. `retargetComposer` takes only a direction.

14. **`ComposerMeta` split out of `ComposerData`.** `initialComment` and `initialKind` are
    read once, in the constructor; `setData` takes only the meta. The promise that a
    retarget never resets the note or the chosen type is now a type error rather than
    something to verify inside `renderMeta`.

15. **`this.callbacks` is the only accessor.** `submit()` takes no parameter and the five
    constructor call sites go through the field, which is what it was added for.

16. **Sibling stepping is O(k) with no allocation.** A loop over
    `nextElementSibling`/`previousElementSibling` until `eligible` returns true is identical
    in semantics to filtering the child list — the original comment's objection applies to a
    naive single step, not to a loop — and avoids 2,000 ancestor walks per keypress in a
    2,000-row table.

### Process

17. **A `Retarget` e2e block on its own fixture**, pinning the two blocking findings first
    (they are the ones the changelog itself singled out as worth testing first, and neither
    had a test), plus the empty-note precondition, the buttons working with text present,
    and the re-clamp.

18. **`plan.md`** — this file.

19. **The README row states its precondition.** It read *"arrow keys in the composer"*
    unconditionally, while `context.md` called the empty-note gate "a hidden mode, which is
    the honest cost". Someone who typed the note, noticed the wrong element, pressed
    <kbd>↑</kbd> and watched the caret move would conclude the feature was broken.
