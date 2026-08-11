# Context — Marquee select

## The code as it stands

Mode `area` came in with the 0.1.0 baseline (`592a9bb`) and has not been touched since —
not by the rebrand, not by the detector work, not by the hardening pass. It has no test.
Everything below was read out of the current `main`.

| Concern | Where |
|---|---|
| Mode state, keyboard `1`/`2`/`3` | `src/content/index.ts:76,649-664` |
| Mode buttons (icon-only, `title` only) | `src/content/ui/toolbar.ts:24-28,56-72` |
| Drag start / move / end | `src/content/index.ts:573-621` |
| Marquee rectangle drawing | `src/content/ui/overlay.ts:80-90` |
| Hit test | `src/content/ui/overlay.ts:112-135` |
| Eligibility predicate | `src/content/index.ts:489-491` |
| Multi-element annotation | `src/content/index.ts:257-263` |

The multi-element path downstream is already sound: `beginAnnotation(elements)` takes an
array, `captureDraft` records `elementBoundingBoxes`, and the composer shows an
`elementCount`. Nothing in this task needs to change below the selection layer — the
defect is entirely in *choosing* the elements and in *saying* what was chosen.

## Why "fully contained + outermost" and not something cleverer

The rule has to be one sentence long, because the user is going to infer it from watching
the preview rather than from reading documentation. Three candidates were weighed:

**Intersects + leaves** (today). Fails on both halves. *Intersects* means the box's edge
recruits whatever it grazes, so the selection depends on pixels the user was not thinking
about. *Leaves* is the more damaging half: it deliberately discards every element that
contains another hit, on the reasoning — recorded in the current comment — that keeping
ancestors "produces a report full of anonymous `<div>`s". That reasoning is backwards.
On a card grid the *card* is the named, meaningful element and its inner `title`/`body`
wrappers are the anonymous ones. Leaves-only guarantees you get the anonymous layer.

**Contained + outermost** (chosen). Matches the marquee in every design tool anyone has
used. One sentence: *everything your box swallowed whole, at the shallowest level that
was swallowed whole.* Both halves are learnable in a single drag once the preview exists.

**Contained + outermost, with depth adjustment via `[` / `]`.** Strictly more capable and
rejected on YAGNI: it adds persistent post-drag state, two keybindings to learn, and a
fourth hint-strip mode, to solve a problem that redrawing the box already solves.

### The consequence to state plainly

Under *outermost*, a box that swallows three cards **and** the `.card-grid` wrapping them
selects the wrapper — one element, not three. This is correct by the rule and defensible
by intent (you drew a box around the whole cluster, so you are talking about the
cluster), but it will surprise someone the first time.

It is acceptable *only because the preview exists*. The user sees one highlight instead of
three while still holding the mouse button, and shrinking the box by a few pixels fixes
it. Without live preview this behaviour would be indefensible, which is why the two
changes ship together rather than as separate increments.

## Why the rect snapshot

The preview has to answer "what is inside the box" on every `pointermove`. Done naively —
by calling the existing `elementsInRect()` each time — that is a full
`document.body.querySelectorAll("*")` walk plus a `getBoundingClientRect()` per element,
at mouse-move frequency. Each `getBoundingClientRect()` after a style read forces layout;
thousands of them, sixty times a second, on a page the extension does not control, is a
janky drag on exactly the complex pages this tool exists for.

So: walk once on `pointerdown`, keep `{ element, left, top, right, bottom }`, and let
every subsequent frame do arithmetic against that array. One forced layout pass of
~10–30ms at drag start, then nothing.

The snapshot is only valid while the page's layout is static. During a click-drag that is
a safe assumption in practice — the user is holding the mouse button down and not
interacting with the page — and the one thing that *does* commonly happen, scrolling, is
handled by storing document rather than viewport coordinates.

### Document coordinates fix an existing bug for free

Storing the snapshot as `viewportRect + (scrollX, scrollY)` and the drag anchor the same
way makes scroll a non-event: page layout does not change when you scroll, so a
document-space rect stays true. Converting back for drawing is a subtraction.

This also repairs the pre-existing defect at `src/content/index.ts:579`, where
`marqueeStart` is captured in viewport space and compared at `pointerup` against viewport
space — scroll in between and the box silently refers to a different region of the page.

**The known exception:** `position: fixed` elements do not move in document space when the
page scrolls, so a snapshot taken before a mid-drag scroll places them wrongly. Left
unfixed. Fixed elements are usually headers and nav bars — chrome rather than content —
and the combination (drag, then scroll, then care about a fixed element) is rare enough
that detecting `position: fixed` on every element in the snapshot would cost more, on
every drag, than the bug costs.

## `eligible()` does its ancestor walk twice

`src/content/index.ts:489` is:

```ts
return isAnnotatable(element) && !isOurUi(element);
```

but `isAnnotatable` already calls `isOurUi` itself (`src/content/identify.ts:521`). The
second call is redundant, and `isOurUi` is not cheap — it is a `closestCrossingShadow`
ancestor walk per element (`src/content/identify.ts:54-58`). Harmless at click frequency;
paid on every element of the document in a snapshot walk.

The marquee snapshot therefore filters on `isAnnotatable` alone. Safe twice over: the
extension's UI host is attached to `document.documentElement`, not `body`
(`src/content/ui/root.ts:53`), so it is never in `document.body.querySelectorAll("*")` to
begin with — and `isAnnotatable` would reject it anyway.

`eligible()` itself is left as-is. It is the predicate for point and text mode too, and
narrowing it is not this task's business.

## Why `marquee.ts` is a new file

`overlay.ts` is a drawing module — box pooling, label placement, show/hide. `elementsInRect`
has always been a hit test living inside it, and the snapshot logic roughly doubles that
non-drawing weight. Splitting leaves two modules that each answer one question: *what is
selected* (`marquee.ts`) and *how is it drawn* (`overlay.ts`). The orchestrator in
`index.ts` already imports from both patterns, so nothing else moves.

## Toolbar: two hint APIs, not one

`update(state)` is called from `render()`, which fires on every state change and rebuilds
the whole toolbar's attributes. The drag count needs updating at rAF frequency, and
routing that through `render()` would mean a full toolbar update sixty times a second
plus threading transient drag state through the top-level `render()` path.

So the hint strip has two entry points:

- `update(state)` — sets the default hint from `state.mode`, part of the normal render
- `setHint(text | null)` — writes `textContent` only; `null` restores the mode default

The drag path calls `setHint` and never touches `render()`.

## Constraints inherited from the project

- **No dependencies.** The extension ships none and this adds none.
- **The e2e suite is the only test infrastructure.** There is no unit-test runner; the
  `test/` directory is Playwright scripts driving a real Chromium. A pure function like
  the hit test would be cheaper to unit test, but standing up a second test runner is not
  in scope for one function. Tests go in `test/e2e.mjs` against a new fixture.
- **`npm test` needs `SENANNOTATE_PLAYWRIGHT_DIR` and `SENANNOTATE_VUE_GLOBAL`,** and a
  headed Chromium. It does not run in CI — see `docs/ci-cd/context.md`. It stays a manual
  gate, so the new assertions must be run locally before this is called done.
- **Everything is inside a shadow root** with `pointer-events: none` on the host. The
  hint strip is one more element in `cardLayer` and needs no new plumbing.
