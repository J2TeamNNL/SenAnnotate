# Changelog — Marquee select

## 2026-08-11

### Brainstorm & spec

Wrote `brief.md`, `context.md`.

The task arrived as "add drag-to-select, we only have click-to-select". Reading the code
first changed the task: **mode `area` already exists** — toolbar button three, keyboard
`3`, marquee drawing, hit test, and a `README.md` line advertising it. It came in with the
0.1.0 baseline (`592a9bb`) and has never been touched or tested since.

So the real defect was not a missing feature. It was a feature nobody could find and
nobody could see working. That reframing is what the spec is about.

Decisions taken:

| Question | Decision |
|---|---|
| Build drag-select from scratch? | **No** — it exists; fix discoverability and feedback |
| How to make it discoverable | Hint strip under the toolbar, per-mode, always on while inspecting |
| Alternatives rejected | Text labels on the mode buttons (widens the toolbar, teaches nothing); one-time coach mark (helps new users only, needs stored state) |
| Feedback during the drag | Live highlight of the elements that would be taken, plus a live count in the hint strip |
| Selection rule | **Fully contained + outermost**, replacing intersects + leaves |
| Depth adjustment (`[` / `]`) | Out — redrawing the box already solves it |
| Shift-click to accumulate | Out |
| Preview recomputation | Snapshot rects once on `pointerdown`, arithmetic per frame |
| Coordinate space | Document, not viewport |
| New module | `src/content/ui/marquee.ts`, splitting hit test out of `overlay.ts` |

Three things found by reading the code that shaped the spec rather than filling it in:

1. **The existing rule's stated rationale is backwards.** The comment on
   `elementsInRect` justifies keeping only leaf elements because keeping ancestors
   "produces a report full of anonymous `<div>`s". On real markup the opposite holds: the
   *card* is the named element and the `title`/`body` wrappers inside it are the anonymous
   ones, so leaves-only guarantees the anonymous layer. This is why the rule change was
   pulled into the same task as the preview instead of being deferred — previewing the
   current rule faithfully would only have made a wrong answer easier to see.

2. **Scrolling mid-drag already corrupts the selection.** `marqueeStart` is captured in
   viewport coordinates (`index.ts:579`) and compared against viewport coordinates on
   `pointerup`. Nothing anchors it to the page. Moving the snapshot to document
   coordinates — needed anyway so the per-frame hit test can reuse cached rects — repairs
   this as a side effect rather than as separate work.

3. **`eligible()` walks the ancestor chain twice per element.** It is
   `isAnnotatable(element) && !isOurUi(element)`, but `isAnnotatable` already calls
   `isOurUi`, which is a `closestCrossingShadow` walk. Irrelevant at click frequency,
   material when the snapshot pass runs it over every element in the document. The
   marquee snapshot filters on `isAnnotatable` alone; `eligible()` is left untouched
   because point and text mode share it.

One consequence accepted with eyes open, recorded in `context.md`: under *outermost*, a
box swallowing three cards **and** their `.card-grid` wrapper selects the wrapper — one
element, not three. Correct by the rule, and self-correcting only because the preview
shows it before the mouse is released. The two changes are therefore a single increment,
not two.
