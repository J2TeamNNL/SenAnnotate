# Marquee Select Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing drag-to-select mode discoverable and legible — a toolbar hint strip, a live preview of what the box has caught, and a selection rule worth previewing.

**Architecture:** Hit testing moves out of the drawing module into a new `src/content/ui/marquee.ts`, which measures every annotatable element once per drag into a document-coordinate snapshot and then answers "what is inside the box" with pure arithmetic on every animation frame. `src/content/index.ts` gains an rAF-throttled preview loop between `pointerdown` and `pointerup`. `Toolbar` gains a hint line with two entry points: a per-mode default set during the normal render, and a transient override written directly during a drag.

**Tech Stack:** TypeScript, no runtime dependencies. esbuild. Playwright e2e driving a real Chromium.

## Global Constraints

- **No new dependencies.** The extension ships none; this adds none.
- **No `innerHTML`.** `h()` in `src/content/ui/dom.ts` deliberately has no `html` attribute — everything rendered is a user comment or text scraped off the page. Text only.
- **Node `>=20`** (`package.json` `engines`).
- **The e2e suite is the only test infrastructure.** No unit-test runner exists and this task does not add one. Tests go in `test/e2e.mjs`.
- **`npm test` does not run in CI** and needs two environment variables plus a headed Chromium:
  `SENANNOTATE_PLAYWRIGHT_DIR` (a directory whose `node_modules` contains playwright) and
  `SENANNOTATE_VUE_GLOBAL` (path to a `vue.global.js` dev build, needed once). It is a manual gate — run it locally before calling this done.
- **`MIN_MARQUEE_SIZE = 6`** and **`MAX_MARQUEE_ELEMENTS = 30`** carry over unchanged in value.
- **Containment tolerance is 1px per edge.**
- **Existing e2e selectors must keep working:** `.toolbar`, `.tool--brand`, `.tool[title^="..."]`, `.stack-badge`, `.highlight__label`. Nine assertions across five fixtures depend on them.
- **Commit style:** Conventional Commits. No `Co-Authored-By`, no `Claude-Session` trailer.
- **Branch:** `feature/marquee-select`, already created.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/content/ui/marquee.ts` | **Create.** What is selected: snapshot, hit test, coordinate conversion. No DOM writes. |
| `src/content/ui/overlay.ts` | **Modify.** How it is drawn. Loses `elementsInRect`; `showHighlights` gains a `preview` option. |
| `src/content/ui/toolbar.ts` | **Modify.** Gains the hint strip and `setHint()`. |
| `src/content/ui/styles.css` | **Modify.** `.toolbar-dock`, `.toolbar-hint`, `.highlight--preview`. |
| `src/content/index.ts` | **Modify.** Drag orchestration: snapshot on down, rAF preview on move, annotate on up. |
| `test/fixtures/marquee.html` | **Create.** Three cards with nested children and a scroll spacer, at deterministic sizes. |
| `test/e2e.mjs` | **Modify.** A new `marquee.html` section. |
| `README.md` | **Modify.** State the selection rule in the Use table. |

---

### Task 1: The selection rule

Replace *intersects + keep the leaves* with *fully contained + keep the outermost*, in a module of its own, wired through the existing drag path. No preview yet — this task is only about which elements come back.

**Files:**
- Create: `src/content/ui/marquee.ts`
- Create: `test/fixtures/marquee.html`
- Modify: `src/content/ui/overlay.ts:98-135` (delete the hit-test section), `:33-58` (`showHighlights` signature)
- Modify: `src/content/index.ts:49` (import), `:571-621` (drag handlers)
- Test: `test/e2e.mjs`

**Interfaces:**
- Consumes: `isAnnotatable` from `src/content/identify.ts`.
- Produces, from `src/content/ui/marquee.ts`:
  - `interface DocRect { left: number; top: number; right: number; bottom: number }`
  - `interface Candidate { element: Element; rect: DocRect }`
  - `interface MarqueeHits { elements: Element[]; rects: DocRect[]; capped: boolean }`
  - `const MAX_MARQUEE_ELEMENTS: number` (30)
  - `function snapshotCandidates(): Candidate[]`
  - `function hitsInRect(candidates: Candidate[], box: DocRect): MarqueeHits`
  - `function toViewport(box: DocRect): { left: number; top: number; width: number; height: number }`
- Produces, from `src/content/ui/overlay.ts`:
  - `interface HighlightRect { left: number; top: number; width: number; height: number }`
  - `showHighlights(rects: HighlightRect[], label?: HighlightLabel, options?: { preview?: boolean }): void`

---

- [ ] **Step 1: Write the fixture**

Create `test/fixtures/marquee.html`. Sizes are fixed and the layout is flex so every coordinate is deterministic, and the bottom spacer makes the page scrollable for the mid-drag scroll test in Task 2.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Marquee fixture</title>
    <style>
      body { margin: 0; font: 14px/1.4 system-ui, sans-serif; }
      /* Pushes the grid down the page so there is room to scroll up into. */
      #spacer-top { height: 300px; }
      #grid { display: flex; gap: 40px; padding: 40px; }
      .card { width: 180px; height: 120px; box-sizing: border-box; border: 1px solid #ccc; padding: 10px; }
      .card-title { height: 20px; font-weight: 600; }
      .card-body { height: 60px; }
      #spacer-bottom { height: 1200px; }
    </style>
  </head>
  <body>
    <div id="spacer-top"></div>
    <div id="grid">
      <div class="card" id="card-a">
        <div class="card-title">Card A</div>
        <div class="card-body">Body A</div>
      </div>
      <div class="card" id="card-b">
        <div class="card-title">Card B</div>
        <div class="card-body">Body B</div>
      </div>
      <div class="card" id="card-c">
        <div class="card-title">Card C</div>
        <div class="card-body">Body C</div>
      </div>
    </div>
    <div id="spacer-bottom"></div>
  </body>
</html>
```

- [ ] **Step 2: Write the failing test**

Append a new section to `test/e2e.mjs`, immediately before the section that drives `test/fixtures/buggy.html`. The drag box fully contains cards A and B, and its right edge stops *inside* card C — so C is touched but not contained. Under the old rule this drag returned six inner `<div>`s; under the new one it returns two cards.

```js
    // -------------------------------------------------------------------------
    // Marquee — contained + outermost
    // -------------------------------------------------------------------------
    const marquee = await context.newPage();
    await marquee.goto(`${base}/marquee.html`);
    await marquee.locator(".toolbar").waitFor({ state: "visible", timeout: 10_000 });
    await marquee.locator(".tool--brand").click();
    await marquee.locator('.tool[title^="Drag"]').click();

    const cardA = await marquee.locator("#card-a").boundingBox();
    const cardC = await marquee.locator("#card-c").boundingBox();

    // Fully around A and B; the right edge lands 20px inside C.
    const dragFrom = { x: cardA.x - 10, y: cardA.y - 10 };
    const dragTo = { x: cardC.x + 20, y: cardA.y + cardA.height + 10 };

    await marquee.mouse.move(dragFrom.x, dragFrom.y);
    await marquee.mouse.down();
    await marquee.mouse.move(dragTo.x, dragTo.y, { steps: 8 });
    await marquee.mouse.up();

    const composerMeta = marquee.locator(".composer__meta");
    await composerMeta.waitFor({ state: "visible", timeout: 5_000 });
    const metaText = (await composerMeta.textContent())?.trim() ?? "";

    check(
      "a marquee selects the elements it fully contains",
      metaText.includes("2 elements"),
      `meta read "${metaText}"`,
    );
    check(
      "a marquee keeps the outermost element, not the leaves",
      metaText.includes("card"),
      `meta read "${metaText}"`,
    );

    await marquee.keyboard.press("Escape");

    // A stray click in area mode must not open the composer.
    await marquee.mouse.move(cardA.x + 40, cardA.y + 40);
    await marquee.mouse.down();
    await marquee.mouse.move(cardA.x + 42, cardA.y + 42);
    await marquee.mouse.up();
    check(
      "a drag under the minimum size selects nothing",
      (await marquee.locator(".composer__meta").count()) === 0,
    );
```

- [ ] **Step 3: Run the test and watch it fail**

```bash
npm test
```

Expected: the two marquee checks FAIL. `meta read "..."` shows `6 elements` and names `card-title`/`card-body` rather than `card` — that is the old rule, confirming the test discriminates.

- [ ] **Step 4: Create `src/content/ui/marquee.ts`**

```ts
// =============================================================================
// Marquee hit-testing
// =============================================================================
//
// `overlay.ts` draws; this decides what is inside the box. They were one file
// until the drag gained a live preview: answering "what is selected" sixty times
// a second needs a cached snapshot, which is not a drawing concern.
// =============================================================================

import { isAnnotatable } from "../identify";

/** Nothing smaller counts as a drag, so a stray click selects nothing. */
const MIN_MARQUEE_SIZE = 6;

/** Ceiling on one selection. Reaching it is surfaced in the toolbar hint. */
export const MAX_MARQUEE_ELEMENTS = 30;

/**
 * Sub-pixel layout means an exact containment test rejects elements the user
 * plainly enclosed. One pixel of slack per edge.
 */
const CONTAIN_TOLERANCE = 1;

/** A rect in document space — viewport coordinates plus the scroll offset. */
export interface DocRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Candidate {
  element: Element;
  rect: DocRect;
}

export interface MarqueeHits {
  elements: Element[];
  /** Same order and length as `elements`, for drawing without touching the DOM. */
  rects: DocRect[];
  /** True when `MAX_MARQUEE_ELEMENTS` cut the list short. */
  capped: boolean;
}

/**
 * Measure every annotatable element once, in document coordinates.
 *
 * Called on pointerdown and never again for the life of the drag. A
 * `getBoundingClientRect()` per element forces layout; doing that on every
 * pointermove is the difference between a smooth drag and a janky one on the
 * complex pages this tool exists for. Page layout does not change while a mouse
 * button is held, and document coordinates make scrolling a non-event.
 *
 * `position: fixed` elements are the known exception — they do not move in
 * document space when the page scrolls, so a mid-drag scroll misplaces them.
 * See `docs/marquee-select/context.md`.
 */
export function snapshotCandidates(): Candidate[] {
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const candidates: Candidate[] = [];

  for (const element of Array.from(document.body.querySelectorAll("*"))) {
    // `isAnnotatable` already rejects our own UI, so there is deliberately no
    // second `isOurUi` call here the way `eligible()` has one: it is a
    // shadow-crossing ancestor walk, and this loop covers the whole document.
    if (!isAnnotatable(element)) continue;

    const box = element.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) continue;

    candidates.push({
      element,
      rect: {
        left: box.left + scrollX,
        top: box.top + scrollY,
        right: box.right + scrollX,
        bottom: box.bottom + scrollY,
      },
    });
  }

  return candidates;
}

/**
 * Every element the box swallowed whole, at the shallowest level swallowed whole.
 *
 * Two halves, both learnable from a single drag now that the result is previewed:
 *
 * *Contained*, not merely touched — a box's edge should not recruit whatever it
 * grazes, or the selection turns on pixels the user was not thinking about.
 *
 * *Outermost*, not the leaves. The rule this replaces kept leaves, reasoning that
 * ancestors "produce a report full of anonymous divs". On real markup that is
 * backwards: the card is the named element and the title/body wrappers inside it
 * are the anonymous ones, so leaves-only guarantees the anonymous layer.
 */
export function hitsInRect(candidates: Candidate[], box: DocRect): MarqueeHits {
  if (box.right - box.left < MIN_MARQUEE_SIZE || box.bottom - box.top < MIN_MARQUEE_SIZE) {
    return { elements: [], rects: [], capped: false };
  }

  const contained: Candidate[] = [];
  for (const candidate of candidates) {
    const { rect } = candidate;
    if (
      rect.left >= box.left - CONTAIN_TOLERANCE &&
      rect.top >= box.top - CONTAIN_TOLERANCE &&
      rect.right <= box.right + CONTAIN_TOLERANCE &&
      rect.bottom <= box.bottom + CONTAIN_TOLERANCE
    ) {
      contained.push(candidate);
    }
  }

  // An element is outermost when no ancestor of it was also contained. Walking
  // up against a Set is O(depth) per element; comparing every pair with
  // `contains()` would be O(n²) DOM walks, which is affordable once on
  // pointerup but not on every animation frame.
  const containedElements = new Set(contained.map(({ element }) => element));
  const outermost = contained.filter(({ element }) => {
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      if (containedElements.has(parent)) return false;
    }
    return true;
  });

  // `querySelectorAll` yields document order and every step above preserves it,
  // so the report lists elements in the order they appear on the page.
  const kept = outermost.slice(0, MAX_MARQUEE_ELEMENTS);

  return {
    elements: kept.map(({ element }) => element),
    rects: kept.map(({ rect }) => rect),
    capped: outermost.length > MAX_MARQUEE_ELEMENTS,
  };
}

/** Document-space box → viewport-space rect, for drawing. */
export function toViewport(box: DocRect): {
  left: number;
  top: number;
  width: number;
  height: number;
} {
  return {
    left: box.left - window.scrollX,
    top: box.top - window.scrollY,
    width: box.right - box.left,
    height: box.bottom - box.top,
  };
}
```

- [ ] **Step 5: Strip the hit test out of `overlay.ts`**

Delete everything from the `// Marquee hit-testing` banner comment at `src/content/ui/overlay.ts:98` to the end of the file — the two constants and `elementsInRect`. The file ends at the closing brace of `class Overlay`.

In the same file, loosen the rect type and add the `preview` option. Replace the `showHighlights` method and add the interface above the class:

```ts
/** Anything with a viewport-space box — `DOMRect` satisfies it structurally. */
export interface HighlightRect {
  left: number;
  top: number;
  width: number;
  height: number;
}
```

```ts
  /**
   * Draw a highlight around each rect.
   *
   * Normally the first one carries the label and the rest are drawn muted, which
   * is what a saved multi-element annotation looks like. `preview` is the marquee
   * case: every box is the live selection, so none of them is secondary, and the
   * position transition is dropped because a pooled box reused for a different
   * element would otherwise slide across the page at drag speed.
   */
  showHighlights(
    rects: HighlightRect[],
    label?: HighlightLabel,
    options?: { preview?: boolean },
  ): void {
    const preview = options?.preview ?? false;

    // Reuse the boxes we already have rather than thrashing the DOM on every
    // pointermove — this runs at mouse-move frequency.
    while (this.boxes.length < rects.length) {
      const box = h("div", { class: "highlight" });
      this.boxes.push(box);
      this.layer.append(box);
    }
    for (let i = rects.length; i < this.boxes.length; i++) {
      this.boxes[i].style.display = "none";
      // Cleared as well as hidden, so a class never outlives the box's use and
      // `.highlight--preview` can be counted directly.
      this.boxes[i].classList.remove("highlight--muted", "highlight--preview");
    }

    rects.forEach((rect, index) => {
      const box = this.boxes[index];
      box.style.display = "block";
      box.style.left = `${rect.left}px`;
      box.style.top = `${rect.top}px`;
      box.style.width = `${rect.width}px`;
      box.style.height = `${rect.height}px`;
      box.classList.toggle("highlight--muted", !preview && index > 0);
      box.classList.toggle("highlight--preview", preview);

      // Only the first box gets a label, and only when one was supplied.
      box.replaceChildren();
      if (index === 0 && label) box.append(this.buildLabel(rect, label));
    });
  }
```

`buildLabel` takes `rect: DOMRect` today and reads only `rect.top`. Change its parameter type to `HighlightRect`.

- [ ] **Step 6: Add the preview style**

In `src/content/ui/styles.css`, immediately after the `.highlight--muted` rule (currently line 200):

```css
/*
 * Boxes drawn while the marquee is being dragged. No transition: a pooled box
 * reused for a different element would otherwise animate across the page at
 * drag speed, which reads as the selection sliding around rather than changing.
 */
.highlight--preview {
  transition: none;
}
```

- [ ] **Step 7: Rewire the drag handlers in `index.ts`**

Change the import at `src/content/index.ts:49` from:

```ts
import { elementsInRect, Overlay } from "./ui/overlay";
```

to:

```ts
import { Overlay } from "./ui/overlay";
import {
  hitsInRect,
  snapshotCandidates,
  toViewport,
  type Candidate,
  type MarqueeHits,
} from "./ui/marquee";
```

Replace the `marqueeStart` declaration at `src/content/index.ts:80` with the drag's full state. Coordinates are now document-space:

```ts
/** Drag anchor, in document coordinates so a mid-drag scroll cannot move it. */
let marqueeStart: { x: number; y: number } | null = null;
/** Latest pointer position, document coordinates. Read by the rAF callback. */
let marqueePoint: { x: number; y: number } | null = null;
/** Measured once per drag — see `snapshotCandidates`. */
let marqueeCandidates: Candidate[] = [];
let marqueeHits: MarqueeHits = { elements: [], rects: [], capped: false };
let marqueeFrame = 0;
```

Replace the whole `// --- marquee ---` section (`src/content/index.ts:571-621`) with:

```ts
// --- marquee -----------------------------------------------------------------

function resetMarquee(): void {
  if (marqueeFrame) {
    cancelAnimationFrame(marqueeFrame);
    marqueeFrame = 0;
  }
  marqueeStart = null;
  marqueePoint = null;
  marqueeCandidates = [];
  marqueeHits = { elements: [], rects: [], capped: false };
  overlay.hideMarquee();
}

/** Recompute and repaint the drag. Cheap: arithmetic over the snapshot, no DOM reads. */
function drawMarquee(): void {
  if (!marqueeStart || !marqueePoint) return;

  const box = {
    left: Math.min(marqueeStart.x, marqueePoint.x),
    top: Math.min(marqueeStart.y, marqueePoint.y),
    right: Math.max(marqueeStart.x, marqueePoint.x),
    bottom: Math.max(marqueeStart.y, marqueePoint.y),
  };

  overlay.showMarquee(toViewport(box));
  marqueeHits = hitsInRect(marqueeCandidates, box);
  overlay.showHighlights(marqueeHits.rects.map(toViewport), undefined, { preview: true });
}

listen(
  document,
  "pointerdown",
  (event) => {
    if (!active || composer || mode !== "area") return;
    if (isOurUi(event.target as Element)) return;

    marqueeStart = { x: event.clientX + window.scrollX, y: event.clientY + window.scrollY };
    marqueePoint = marqueeStart;
    marqueeCandidates = snapshotCandidates();
    marqueeHits = { elements: [], rects: [], capped: false };
    overlay.hideHighlights();
  },
  { capture: true },
);

listen(
  document,
  "pointermove",
  (event) => {
    if (!marqueeStart) return;
    marqueePoint = { x: event.clientX + window.scrollX, y: event.clientY + window.scrollY };
    // One repaint per frame however fast the pointer reports.
    if (marqueeFrame) return;
    marqueeFrame = requestAnimationFrame(() => {
      marqueeFrame = 0;
      drawMarquee();
    });
  },
  { passive: true },
);

listen(
  document,
  "pointerup",
  () => {
    if (!marqueeStart) return;

    // Flush a pending frame rather than dropping it, so what was annotated is
    // exactly what was highlighted when the button came up.
    if (marqueeFrame) {
      cancelAnimationFrame(marqueeFrame);
      marqueeFrame = 0;
      drawMarquee();
    }

    const hits = marqueeHits;
    resetMarquee();

    if (!hits.elements.length) {
      overlay.hideHighlights();
      return;
    }
    void beginAnnotation(hits.elements);
  },
  { capture: true },
);
```

Then make a mode switch or leaving inspect mode abandon a drag in progress. In the `onModeChange` callback (`src/content/index.ts:107-111`) and in the keyboard handlers for `1`, `2` and `3` (`:649-664`), `overlay.hideAll()` is already called; add `resetMarquee()` immediately before each of those four `overlay.hideAll()` calls. Do the same in `setActive` where it calls `overlay.hideAll()` (`:113`).

- [ ] **Step 8: Typecheck and run the test**

```bash
npm run typecheck && npm test
```

Expected: all four marquee checks PASS, and every pre-existing check still passes.

- [ ] **Step 9: Commit**

```bash
git add src/content/ui/marquee.ts src/content/ui/overlay.ts src/content/ui/styles.css src/content/index.ts test/fixtures/marquee.html test/e2e.mjs
git commit -m "feat: select what the marquee contains, not what it touches

Replaces intersects + keep-the-leaves with contained + keep-the-outermost,
in a new marquee.ts split out of the drawing module. Rects are snapshotted
once per drag in document coordinates, which also fixes a mid-drag scroll
corrupting the selection. Mode area had no test; it has four now."
```

---

### Task 2: Live preview

Task 1 already draws the preview — this task proves it, and proves the document-coordinate snapshot survives a mid-drag scroll.

**Files:**
- Test: `test/e2e.mjs`

**Interfaces:**
- Consumes: `.highlight--preview` (Task 1, Step 6) and `overlay.showHighlights(..., { preview: true })` (Task 1, Step 5).
- Produces: nothing new.

---

- [ ] **Step 1: Write the failing test**

Insert into the marquee section of `test/e2e.mjs`, after the minimum-size check. The first half reads the preview *without releasing the button*; the second scrolls mid-drag.

```js
    // The preview must show exactly what releasing would annotate.
    await marquee.mouse.move(dragFrom.x, dragFrom.y);
    await marquee.mouse.down();
    await marquee.mouse.move(dragTo.x, dragTo.y, { steps: 8 });

    check(
      "the drag previews the elements it would take",
      (await marquee.locator(".highlight--preview").count()) === 2,
      `previewed ${await marquee.locator(".highlight--preview").count()}`,
    );

    await marquee.mouse.up();
    const previewMeta = (await marquee.locator(".composer__meta").textContent())?.trim() ?? "";
    check(
      "the previewed set is the annotated set",
      previewMeta.includes("2 elements"),
      `meta read "${previewMeta}"`,
    );
    await marquee.keyboard.press("Escape");

    // Scrolling mid-drag: the box is anchored to the page, not the viewport.
    const scrollBy = 200;
    await marquee.mouse.move(dragFrom.x, dragFrom.y);
    await marquee.mouse.down();
    await marquee.mouse.wheel(0, scrollBy);
    await marquee.waitForFunction((y) => window.scrollY >= y, scrollBy);
    await marquee.mouse.move(dragTo.x, dragTo.y - scrollBy, { steps: 8 });
    await marquee.mouse.up();

    const scrolledMeta = marquee.locator(".composer__meta");
    await scrolledMeta.waitFor({ state: "visible", timeout: 5_000 });
    check(
      "scrolling mid-drag keeps the box on the page, not the viewport",
      ((await scrolledMeta.textContent())?.trim() ?? "").includes("2 elements"),
      `meta read "${(await scrolledMeta.textContent())?.trim() ?? ""}"`,
    );
    await marquee.keyboard.press("Escape");
```

- [ ] **Step 2: Run the test**

```bash
npm test
```

Expected: all three PASS on Task 1's implementation. If the preview count check fails at 0, the `preview` option is not reaching the class; if the scroll check fails, coordinates are still viewport-space somewhere.

- [ ] **Step 3: Commit**

```bash
git add test/e2e.mjs
git commit -m "test: pin the marquee preview to the annotated set

Asserts the highlight count mid-drag, that releasing annotates that same
set, and that a mid-drag scroll leaves the box anchored to the page."
```

---

### Task 3: The hint strip

**Files:**
- Modify: `src/content/ui/toolbar.ts:24-28` (mode table), `:100-112` (structure), `:114-130` (`update`)
- Modify: `src/content/ui/styles.css:69-87` (`.toolbar`)
- Test: `test/e2e.mjs`

**Interfaces:**
- Consumes: `InspectMode` from `src/shared/types.ts` — `"point" | "text" | "area"`.
- Produces: `Toolbar.setHint(text: string | null): void`. Passing `null` restores the current mode's default. Task 4 calls it.

**Placement note:** the toolbar is fixed to the bottom-right, so the hint sits *above* the pill — below it would be off-screen. The pill keeps its `.toolbar` class and its own styles; a new `.toolbar-dock` wrapper takes over the fixed positioning. Existing e2e locators for `.toolbar` are unaffected.

---

- [ ] **Step 1: Write the failing test**

Insert into the marquee section of `test/e2e.mjs`, directly after the `.tool--brand` click that turns inspect mode on and *before* the area-mode click:

```js
    const hint = marquee.locator(".toolbar-hint");
    await hint.waitFor({ state: "visible", timeout: 5_000 });
    check(
      "the hint names the default mode and the keys for the others",
      ((await hint.textContent())?.trim() ?? "") === "Click an element · 2 text · 3 area",
      `hint read "${(await hint.textContent())?.trim() ?? ""}"`,
    );

    await marquee.locator('.tool[title^="Select text"]').click();
    check(
      "the hint follows the mode",
      ((await hint.textContent())?.trim() ?? "") === "Select text · 1 point · 3 area",
      `hint read "${(await hint.textContent())?.trim() ?? ""}"`,
    );
```

and directly after the existing area-mode click:

```js
    check(
      "the hint says the drag mode is a drag",
      ((await hint.textContent())?.trim() ?? "") === "Drag across elements · 1 point · 2 text",
      `hint read "${(await hint.textContent())?.trim() ?? ""}"`,
    );
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test
```

Expected: FAIL — `.toolbar-hint` never becomes visible and `waitFor` times out.

- [ ] **Step 3: Add the hint to `Toolbar`**

In `src/content/ui/toolbar.ts`, add below the `MODES` table:

```ts
/**
 * One line of standing instruction. The mode buttons are icon-only and appear
 * only once inspect mode is on, so without this nothing on screen says a drag
 * mode exists — which is exactly how mode `area` went unused for three releases.
 */
const MODE_HINTS: Record<InspectMode, string> = {
  point: "Click an element · 2 text · 3 area",
  text: "Select text · 1 point · 3 area",
  area: "Drag across elements · 1 point · 2 text",
};
```

Add two fields to the class, beside the existing private members:

```ts
  private readonly hintElement: HTMLElement;
  /** Transient text from a drag; `null` means "show the mode's own hint". */
  private hintOverride: string | null = null;
  private modeHint = MODE_HINTS.point;
```

Replace the `this.element = h("div", { class: "toolbar" }, ...)` assignment and the `layer.append` that follows it (`src/content/ui/toolbar.ts:100-111`) with:

```ts
    this.hintElement = h("div", { class: "toolbar-hint", style: { display: "none" } });

    const bar = h(
      "div",
      { class: "toolbar" },
      this.stackBadge,
      this.brandButton,
      this.modeGroup,
      h("span", { class: "divider" }),
      this.freezeButton,
      this.panelButton,
    );

    // The dock owns the fixed position; `.toolbar` stays the pill so the e2e
    // locators and every existing style keep working.
    this.element = h("div", { class: "toolbar-dock" }, this.hintElement, bar);

    layer.append(this.element);
```

In `update()`, after the `this.modeGroup.style.display` line:

```ts
    this.modeHint = MODE_HINTS[state.mode];
    this.hintElement.style.display = state.active ? "block" : "none";
    if (this.hintOverride === null) this.hintElement.textContent = this.modeHint;
```

Add the second entry point as a public method, above `destroy()`:

```ts
  /**
   * Override the hint for the duration of a drag. Separate from `update()`
   * because the drag rewrites this at animation-frame rate, and routing that
   * through the orchestrator's `render()` would rebuild the whole toolbar
   * sixty times a second. `null` hands the line back to the current mode.
   */
  setHint(text: string | null): void {
    this.hintOverride = text;
    this.hintElement.textContent = text ?? this.modeHint;
  }
```

- [ ] **Step 4: Restructure the toolbar styles**

In `src/content/ui/styles.css`, replace the `.toolbar` rule (line 69) with a dock plus the pill, and add the hint:

```css
.toolbar-dock {
  position: fixed;
  bottom: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  pointer-events: none;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 5px;
  border-radius: 14px;
  background: var(--sa-bg);
  backdrop-filter: blur(16px) saturate(1.4);
  -webkit-backdrop-filter: blur(16px) saturate(1.4);
  border: 1px solid var(--sa-border);
  box-shadow: var(--sa-shadow);
  pointer-events: auto;
  user-select: none;
  transition: transform 0.18s ease, opacity 0.18s ease;
}

/*
 * Sits above the pill, not below it — the toolbar is pinned to the bottom of
 * the viewport, so there is nothing below it to sit in.
 */
.toolbar-hint {
  max-width: 340px;
  padding: 3px 9px;
  border-radius: 8px;
  background: var(--sa-bg);
  backdrop-filter: blur(16px) saturate(1.4);
  -webkit-backdrop-filter: blur(16px) saturate(1.4);
  border: 1px solid var(--sa-border);
  color: var(--sa-fg-muted);
  font-size: 11px;
  white-space: nowrap;
  user-select: none;
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npm run typecheck && npm test
```

Expected: the three hint checks PASS. The screenshot flow hides the whole shadow host (`src/content/index.ts:403`), so the new element cannot leak into a capture — but confirm the existing screenshot check still passes.

- [ ] **Step 6: Commit**

```bash
git add src/content/ui/toolbar.ts src/content/ui/styles.css test/e2e.mjs
git commit -m "feat: give the toolbar a hint line naming the current mode

The mode buttons are icon-only and only appear once inspect mode is on,
so nothing on screen said a drag mode existed. A dock wrapper takes the
fixed positioning; .toolbar stays the pill so existing selectors hold."
```

---

### Task 4: The live count

**Files:**
- Modify: `src/content/index.ts` — the marquee section from Task 1
- Test: `test/e2e.mjs`

**Interfaces:**
- Consumes: `Toolbar.setHint(text: string | null)` (Task 3), `MarqueeHits` and `MAX_MARQUEE_ELEMENTS` (Task 1).
- Produces: nothing beyond the module.

---

- [ ] **Step 1: Write the failing test**

Insert into the marquee section of `test/e2e.mjs`, inside the mid-drag block from Task 2 — directly beside the `.highlight--preview` count check, before `mouse.up()`:

```js
    check(
      "the hint counts the selection while dragging",
      ((await hint.textContent())?.trim() ?? "") === "2 elements selected · release to annotate",
      `hint read "${(await hint.textContent())?.trim() ?? ""}"`,
    );
```

And add a separate empty-box case after the mid-drag scroll block:

```js
    // A box over empty page area: the hint says so rather than going blank.
    const emptyY = cardA.y + cardA.height + 60;
    await marquee.mouse.move(cardA.x, emptyY);
    await marquee.mouse.down();
    await marquee.mouse.move(cardA.x + 120, emptyY + 60, { steps: 4 });
    check(
      "an empty box says nothing is inside it",
      ((await hint.textContent())?.trim() ?? "") === "Nothing inside the box yet",
      `hint read "${(await hint.textContent())?.trim() ?? ""}"`,
    );
    await marquee.mouse.up();

    check(
      "the hint returns to the mode line after a drag",
      ((await hint.textContent())?.trim() ?? "") === "Drag across elements · 1 point · 2 text",
      `hint read "${(await hint.textContent())?.trim() ?? ""}"`,
    );
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test
```

Expected: FAIL — the hint still reads `Drag across elements · 1 point · 2 text` mid-drag, because nothing calls `setHint` yet.

- [ ] **Step 3: Write the hint text builder**

In `src/content/index.ts`, add above `resetMarquee()`:

```ts
function marqueeHint(hits: MarqueeHits): string {
  if (hits.capped) return `${MAX_MARQUEE_ELEMENTS} elements (limit) · release to annotate`;

  const count = hits.elements.length;
  if (count === 0) return "Nothing inside the box yet";
  return `${count} element${count === 1 ? "" : "s"} selected · release to annotate`;
}
```

Extend the import from `./ui/marquee` added in Task 1 to include the constant:

```ts
import {
  hitsInRect,
  MAX_MARQUEE_ELEMENTS,
  snapshotCandidates,
  toViewport,
  type Candidate,
  type MarqueeHits,
} from "./ui/marquee";
```

- [ ] **Step 4: Wire it into the three drag handlers**

In `drawMarquee()`, append after the `overlay.showHighlights(...)` call:

```ts
  toolbar.setHint(marqueeHint(marqueeHits));
```

In `resetMarquee()`, append after `overlay.hideMarquee()`:

```ts
  toolbar.setHint(null);
```

In the `pointerdown` handler, append after `overlay.hideHighlights()`:

```ts
    toolbar.setHint(marqueeHint(marqueeHits));
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npm run typecheck && npm test
```

Expected: all three new checks PASS, along with everything from Tasks 1–3.

- [ ] **Step 6: Commit**

```bash
git add src/content/index.ts test/e2e.mjs
git commit -m "feat: count the marquee selection in the toolbar hint

Says how many elements the box has caught while it is being drawn, says
so when the box is empty, and names the 30-element cap when it is hit
instead of truncating in silence."
```

---

### Task 5: Documentation and release

**Files:**
- Modify: `README.md` (the Use table)
- Modify: `docs/marquee-select/changelog.md`
- Modify: `package.json` (version)

**Interfaces:**
- Consumes: everything above.
- Produces: nothing.

---

- [ ] **Step 1: State the rule in the README**

In `README.md`, replace the Use-table row:

```markdown
| Annotate several elements | mode <kbd>3</kbd>, then drag across them |
```

with:

```markdown
| Annotate several elements | mode <kbd>3</kbd>, then drag a box around them |
```

and add immediately below the Use table:

```markdown
Dragging a box selects **everything it fully contains**, at the shallowest level
contained — draw around three cards and you get three cards, not the `<div>`s
inside them. Elements the box merely clips are left out. The selection is
highlighted live while you drag and counted in the line under the toolbar, so
you can adjust before letting go.
```

- [ ] **Step 2: Bump the version**

`package.json`: `0.3.2` → `0.4.0`. New user-facing behaviour, no breaking change. `build.mjs` stamps `dist/manifest.json` from this, so nothing else needs editing.

- [ ] **Step 3: Record what shipped**

Append to `docs/marquee-select/changelog.md`:

```markdown
### Implementation

Shipped as five commits on `feature/marquee-select`. `src/content/ui/marquee.ts`
is new; `elementsInRect` is gone from `overlay.ts`.

Deviations from the spec, and why:

- (none — record any here, with the reason, before opening the PR)

Verified locally: `npm run typecheck`, `npm run build`, `npm test` — the suite
needs `SENANNOTATE_PLAYWRIGHT_DIR` and `SENANNOTATE_VUE_GLOBAL` and does not run
in CI, so this is the only gate the new assertions get.
```

Replace the `(none …)` line with the real list if anything diverged.

- [ ] **Step 4: Full verification**

```bash
npm run typecheck && npm run build && npm test
```

Expected: typecheck clean, build clean, every check `ok` — the pre-existing ones and the twelve new marquee checks.

Then load `dist/` unpacked in Chrome and confirm by hand on a real site, because no assertion covers how it *feels*: the hint line reads correctly, the preview keeps up with the pointer without stutter on a heavy page, and a box swallowing a whole section selects the section.

- [ ] **Step 5: Commit and open the PR**

```bash
git add README.md package.json docs/marquee-select/changelog.md
git commit -m "docs: document the marquee selection rule; 0.4.0"
git push -u origin feature/marquee-select
```

PR description must reference `docs/marquee-select/`.

---

## Self-Review

**Spec coverage** — every `brief.md` success criterion maps to a task:

| Criterion | Covered by |
|---|---|
| 1. Mode discoverable without the README | Task 3 |
| 2. Contains two, touches a third → two | Task 1, Step 2 |
| 3. Previewed set == annotated set | Task 2, Step 1 |
| 4. Mid-drag scroll stays anchored | Task 2, Step 1 |
| 5. Cap is announced | Task 4, Step 3 (`marqueeHint`) |
| 6. No per-`pointermove` DOM walk | Task 1, Steps 4 and 7 (snapshot + rAF) |
| 7. typecheck, build, test pass | Task 5, Step 4 |

Every `brief.md` "Behaviour reference" hint string appears verbatim in `MODE_HINTS` (Task 3) or `marqueeHint` (Task 4). `MIN_MARQUEE_SIZE`, `MAX_MARQUEE_ELEMENTS` and the 1px tolerance are all in Task 1, Step 4.

**Known gap:** criterion 5's cap message has no e2e assertion — a fixture with 31 selectable siblings would exist only to test a `slice`, and the string is asserted by reading `marqueeHint`. Criterion 6 likewise has no automated assertion; it is covered by the manual pass in Task 5, Step 4.

**Type consistency:** `MarqueeHits` is `{ elements, rects, capped }` everywhere it appears — Task 1 defines it, Tasks 1 and 4 consume it. `showHighlights(rects, label?, options?)` has one signature, defined in Task 1 Step 5 and called with `{ preview: true }` in Task 1 Step 7. `setHint(text: string | null)` is defined in Task 3 Step 3 and called in Task 4 Step 4. `toViewport` returns `{left, top, width, height}`, which is what both `showMarquee` and `showHighlights` accept.
