# Brief — Marquee select that you can see

## What

Make the existing drag-to-select mode (`area`, mode **3**) discoverable and legible:

- **Live preview.** Highlight the elements the drag would take, updated as the box is
  drawn, so releasing the mouse holds no surprises.
- **A hint strip on the toolbar.** One line under the toolbar naming what the current
  mode does and which keys switch mode; during a drag it becomes the live count.
- **A selection rule worth previewing.** Change the hit test from *intersects + keep the
  leaves* to *fully contained + keep the outermost*, so dragging across three cards
  yields three cards rather than the anonymous `<div>`s inside them.

## Why

Mode `area` has shipped since 0.1.0 and is documented in `README.md`. It is also, in
practice, unusable — for two reasons that compound.

1. **Nobody finds it.** The three mode buttons are icon-only, appear only once inspect
   mode is on, and explain themselves through `title` attributes alone
   (`src/content/ui/toolbar.ts:24-28`). Nothing on screen says a drag mode exists. The
   feature was reported as missing by the person who owns the project.

2. **Drawing the box tells you nothing.** `pointermove` draws the marquee rectangle and
   nothing else (`src/content/index.ts:585-598`); the elements are computed only on
   `pointerup`. You draw a box blind, release, and find out afterwards. There is no way
   to learn the tool's behaviour by using it, and no way to correct a bad drag before
   committing to it.

Add the preview and the second problem exposes a third: the current rule selects
anything the box *touches* and then keeps only leaf elements
(`src/content/ui/overlay.ts:127,132`). Drag across two cards and you get their inner
`title`/`body` `<div>`s plus whatever sat under the box's edge — a report of five
anonymous elements instead of two named ones. Previewing that faithfully would only make
the wrong behaviour easier to see. The rule is changed in the same pass.

Two further defects surface from reading the same code, both fixed here because the new
code has to touch them anyway:

- **Scrolling mid-drag corrupts the selection.** `marqueeStart` is stored in viewport
  coordinates (`src/content/index.ts:579`) and compared against viewport coordinates at
  `pointerup`. Scroll between the two and the box is computed against a page that has
  moved underneath it.
- **The 30-element cap is silent** (`src/content/ui/overlay.ts:102,134`). A drag over 60
  elements annotates 30 of them and says nothing.

## Scope

**In:**
- New module `src/content/ui/marquee.ts` — snapshot + hit test, moved out of `overlay.ts`
- Hit test: fully-contained (1px tolerance) + outermost-wins
- Rect snapshot taken once per drag, in document coordinates
- rAF-throttled preview during `pointermove`
- `Overlay.showHighlights()` gains a `muteAll` option for uniform preview boxes
- `Toolbar` gains a hint strip: `update()` sets the per-mode default, `setHint()`
  overrides it transiently during a drag
- The element cap becomes visible in the hint strip when reached
- E2E coverage for all of it, against a new nested-card fixture — mode `area` currently
  has none

**Out (deliberately):**
- Shift-click to accumulate discrete elements into one annotation
- `[` / `]` to widen or deepen the selection after a drag
- Auto-scrolling the page when the drag reaches the viewport edge
- Correct hit testing for `position: fixed` elements — the document-coordinate snapshot
  is wrong for them if the page scrolls mid-drag. Rare, and recorded in `context.md`
  rather than solved.
- Any change to `point` or `text` mode behaviour beyond their new hint lines

## Behaviour reference

The hint strip is shown only while inspect mode is on, and reads:

| State | Text |
|---|---|
| mode `point` | `Click an element · 2 text · 3 area` |
| mode `text` | `Select text · 1 point · 3 area` |
| mode `area` | `Drag across elements · 1 point · 2 text` |
| dragging, ≥1 hit | `<n> elements selected · release to annotate` |
| dragging, exactly 1 | `1 element selected · release to annotate` |
| dragging, 0 hits | `Nothing inside the box yet` |
| dragging, cap hit | `30 elements (limit) · release to annotate` |

Constants carried over from the current implementation, unchanged:

- `MIN_MARQUEE_SIZE = 6` — a box smaller than this in either axis selects nothing, so a
  stray click in `area` mode does not open the composer.
- `MAX_MARQUEE_ELEMENTS = 30` — the cap itself stays; only its silence is fixed.

Containment uses a **1px tolerance** on each edge: an element counts as contained when
its rect sits inside the box allowing 1px of overhang per side. Sub-pixel layout means an
exact comparison rejects elements the user plainly enclosed.

## Success criteria

1. Turning on inspect mode shows a line naming the current mode and the keys for the
   other two. The drag mode is discoverable without reading `README.md`.
2. Dragging a box that fully contains two cards, while merely touching a third,
   highlights exactly those two cards live, and annotates exactly those two.
3. The highlighted set during the drag is identical to the set annotated on release.
4. Scrolling mid-drag keeps the box anchored to the page, not the viewport.
5. A drag over more than 30 eligible elements says so in the hint strip.
6. Dragging across a 3000-element page stays smooth — no per-`pointermove` DOM walk.
7. `npm run typecheck`, `npm run build` and `npm run test` all pass.
