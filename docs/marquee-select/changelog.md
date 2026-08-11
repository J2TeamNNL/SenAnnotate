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

### Implementation

Shipped as five commits on `feature/marquee-select`. `src/content/ui/marquee.ts` is new;
`elementsInRect` is gone from `overlay.ts`. Version bumped to **0.4.0** — new user-facing
behaviour, nothing breaking.

The red step of Task 1 paid for itself immediately: the failing run printed
`Element div.card-title +5 more · Selection 6 elements`, which is the old rule stated in
its own words — six anonymous wrappers where two cards were wanted. It also exposed a
bad assertion. The check for "keeps the outermost element, not the leaves" was written as
`metaText.includes("card")`, which passes against `div.card-title` and would therefore
have passed against the *old* behaviour. Rewritten to assert the absence of `card-title`
and `card-body`, which is what actually discriminates.

Deviations from the plan:

| Plan | What was done | Why |
|---|---|---|
| Task 1 commit message says "four" new tests | Says "three" | The min-size check is one of four in the section, but only three land in Task 1 — the fourth was Task 2's |
| Task 1 Step 7 lists five `resetMarquee()` insertions | `setActive` already had `marqueeStart = null`; that line was replaced rather than added beside | Leaving both would have left the other four fields of the drag state uncleared |
| Task 2 assertions | Added `window.scrollTo(0, 0)` after the mid-drag scroll case | The next case computes coordinates from `cardA`'s original box; without the reset it drags against a scrolled page |

Task 2's checks passed without any implementation change, as the plan predicted — the
preview and the document-coordinate snapshot both land in Task 1, and Task 2 only pins
them down.

**A flake the plan created, caught in final verification.** One full run came back 81/83
where four runs either side were clean. The cause is in the test code, not the extension:
every mid-drag assertion the plan specifies reads the hint text or counts
`.highlight--preview` immediately after a `mouse.move`, but the drag repaints on
`requestAnimationFrame` — so the read can land on the frame before the one that reflects
the move. Fixed with a `nextFrame()` helper that awaits two animation frames inside the
page before each mid-drag read. Four consecutive clean runs after the fix; the race is
gone by construction rather than by luck, which is the only claim those runs support.

**Verified visually, not just by assertion.** Screenshots of a live drag confirm what no
check covers: the marquee draws dashed, cards A and B fill accent-solid, card C sits
clipped by the box edge and stays unselected, and the hint reads
`2 elements selected · release to annotate`.

Verified locally: `npm run typecheck`, `npm run build`, and `npm test` at **83/83
checks**, up from 74 before this work. The suite needs `SENANNOTATE_PLAYWRIGHT_DIR` and
`SENANNOTATE_VUE_GLOBAL` and does not run in CI, so this is the only gate the new
assertions get. Playwright resolved from `storefront_playwright_test` (1.60.0) — the copy
in `storefront_v5` (1.59.1) has no browser binaries installed.

Two success criteria carry no automated assertion, by choice:

- **The 30-element cap message.** A fixture with 31 selectable siblings would exist only
  to test a `slice`; the string lives in `marqueeHint` and is read there.
- **Drag smoothness on a heavy page.** Covered by the manual pass, not by a timer that
  would be flaky on a loaded CI-less machine.
