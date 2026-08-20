# Measure Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give an annotation the numbers — box model, and the measured gap between two elements — and print them in the Markdown report.

**Architecture:** A pure, DOM-only engine (`src/content/measure.ts`) computes; a rendering class (`src/content/ui/measure-overlay.ts`) draws and owns the mode's anchor; `src/content/index.ts` gets branches and nothing else. Nothing runs in the MAIN world, so there is no bridge RPC and no manifest change.

**Tech Stack:** TypeScript `strict`, esbuild, zero runtime dependencies. No test framework — verification is `tsc --noEmit`, a new Node assertion script for the pure modules, and the Playwright e2e suite.

**Spec:** [`docs/measure-core/brief.md`](./brief.md) and [`docs/measure-core/context.md`](./context.md). Read both before starting; the ordering argument is in [`plan.md`](./plan.md).

## Global Constraints

- **Never name a third-party tool** in code, comments, docs, commits or the PR. Describe features by their standard names (box model, layout grid, page rulers). This is a standing instruction for this work.
- **No new manifest permission and no new bridge RPC.** If either seems necessary, stop — the design was wrong (`context.md`, first section).
- **Do not consult upstream `agentation`** for anything touching `content/identify.ts`, `inspector/freeze.ts` or `shared/output.ts` (`NOTICE.md`).
- **Every module opens with a banner comment explaining *why*, not what.** Match the density of the file next to it; the comments are load-bearing documentation in this repo.
- **Version lives only in `package.json`.** Do not bump it — a release is its own commit.
- **Do not hand-edit `CHANGELOG.md`.** It is generated from Conventional Commit subjects; a commit subject is a release note.
- **Branch:** `feature/measure-core` (already created). Conventional Commit subjects.
- Chrome 111 minimum; esbuild targets `chrome111`. `color-mix(in srgb, …)` is already used in `styles.css` and is safe.
- `npm test` needs `SENANNOTATE_PLAYWRIGHT_DIR` pointing at a directory whose `node_modules` holds Playwright **with browsers installed**. The repo records no default on purpose, and the obvious sibling directory does not have them.
- Round measurements to **2 decimal places, trailing zeros trimmed**. Never round to integers — a 0.5px gap is the class of bug this feature exists to surface.

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `src/shared/types.ts` | `Sides`, `BoxModel`, `GapGeometry`, `GapMeasurement`, `Measurements`; `InspectMode` gains `"measure"`; `Annotation.measurements`; `Settings.showBoxModel` | 1 |
| `src/content/measure.ts` | **new.** Pure engine: `roundPx`, `readBoxModel`, `measureGap`. No DOM writes, no state, no imports beyond types | 1 |
| `test/measure.mjs` | **new.** Node assertion script for the two pure modules, bundled through esbuild | 1, 2 |
| `src/shared/output.ts` | `formatSides`, `formatBoxModel`, the gap lines, the compact suffix | 2 |
| `src/content/ui/measure-overlay.ts` | **new.** Bands, badge, dimension lines; owns the anchor element | 3 |
| `src/content/ui/styles.css` | Eight new classes | 3 |
| `src/content/ui/toolbar.ts` | Fourth mode button, card button, `MODE_HINTS` | 4 |
| `src/content/index.ts` | Mode branches, key `4`, `Esc`, card toggle — wiring only | 4, 5 |
| `src/content/capture.ts` | `CaptureOptions.measurements` into the draft | 4 |
| `src/content/ui/measure-card.ts` | **new.** One-row card, anchored like the settings card | 5 |
| `test/fixtures/measure.html` | **new.** Whole-pixel geometry, annotated by nothing else | 6 |
| `test/e2e.mjs` | Six hint assertions updated; a new measure block | 6 |
| `wiki/*.md`, `README.md`, `docs/measure-core/changelog.md` | User-visible behaviour changed | 7 |

---

### Task 1: The measurement engine

**Files:**
- Modify: `src/shared/types.ts` (add types near `Rect`, around line 71)
- Create: `src/content/measure.ts`
- Create: `test/measure.mjs`
- Modify: `package.json` (one script)

**Interfaces:**
- Consumes: nothing.
- Produces: `roundPx(n: number): number`, `readBoxModel(el: Element): BoxModel`, `measureGap(a: RectLike, b: RectLike): GapGeometry`, and the types below. Tasks 2–6 all depend on these exact names.

- [ ] **Step 1: Add the types**

In `src/shared/types.ts`, immediately after the existing `Rect` interface:

```ts
// -----------------------------------------------------------------------------
// Measurements
// -----------------------------------------------------------------------------
//
// All figures are **layout pixels**, not on-screen pixels. `getComputedStyle` reports
// the pre-transform box while `getBoundingClientRect` reports the post-transform one,
// and mixing the two gives a badge whose width and padding describe different
// coordinate spaces. Everything here is the former, and `BoxModel.scaled` is set when
// the two disagree so a reader knows the element is not drawn at these numbers.

export interface Sides {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface BoxModel {
  /** Border box: content + padding + border. */
  width: number;
  height: number;
  content: { width: number; height: number };
  padding: Sides;
  border: Sides;
  margin: Sides;
  /** The rendered rect differs from the layout box — a transform or a zoom is in play. */
  scaled: boolean;
}

export type Containment = "none" | "b-inside-a" | "a-inside-b";

/** Pure geometry between two rects, with no idea what either element is. */
export interface GapGeometry {
  /** Empty space on each axis. Positive apart, negative overlapping, 0 touching. */
  gap: { x: number; y: number };
  /** B's edge minus A's edge. 0 means aligned. */
  edges: Sides;
  /** B's centre minus A's centre. */
  center: { x: number; y: number };
  containment: Containment;
}

export interface GapMeasurement extends GapGeometry {
  /** Human-readable name of the second element, e.g. `button "Cancel"`. */
  toElement: string;
  toSelector: string;
}

export interface Measurements {
  box?: BoxModel;
  gap?: GapMeasurement;
}
```

Then three edits elsewhere in the same file:

```ts
// 1. InspectMode — the mode group renders in this order.
export type InspectMode = "point" | "text" | "area" | "measure";

// 2. Annotation — put it directly under `elementBoundingBoxes` / `isMultiSelect`.
  /**
   * Figures the reviewer deliberately took. Absent on every annotation made outside
   * `measure` mode and on every one written before 0.9.0 — the same optional-field
   * treatment `framework` and `frame` get, for the same reason: these are per-review
   * scratch data and no migration is worth carrying.
   */
  measurements?: Measurements;

// 3. Settings — plus the DEFAULT_SETTINGS entry.
  /** Draw the box model on the hover highlight. Off: it is a second thing to read. */
  showBoxModel: boolean;
```

```ts
export const DEFAULT_SETTINGS: Settings = {
  // …existing entries unchanged…
  showBoxModel: false,
};
```

- [ ] **Step 2: Write the failing test**

Create `test/measure.mjs`:

```js
// =============================================================================
// Unit checks for the pure modules
// =============================================================================
//
// `measure.ts` and the formatters in `output.ts` are arithmetic and string building:
// the e2e suite can reach them only through a browser, a click and a clipboard read,
// which is a terrible feedback loop for a sign error. They are bundled here with the
// esbuild that already builds the extension — no test framework, no new dependency,
// the same `check()` shape `e2e.mjs` uses.
//
//   node test/measure.mjs
// =============================================================================

import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

let failures = 0;
function check(name, ok, detail = "") {
  if (ok) {
    console.log(`  ok  ${name}`);
    return;
  }
  failures++;
  console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
}

/** Bundle a TS module to ESM in a temp dir and import it. */
async function load(entry, outName) {
  const dir = mkdtempSync(join(tmpdir(), "senannotate-unit-"));
  const outfile = join(dir, outName);
  await build({
    entryPoints: [join(ROOT, entry)],
    outfile,
    bundle: true,
    format: "esm",
    platform: "neutral",
    target: "es2022",
  });
  const module = await import(pathToFileURL(outfile).href);
  rmSync(dir, { recursive: true, force: true });
  return module;
}

/** DOMRect is not in Node; the engine only needs these six fields. */
function rect(left, top, width, height) {
  return { left, top, width, height, right: left + width, bottom: top + height };
}

const { roundPx, measureGap } = await load("src/content/measure.ts", "measure.mjs");

// --- roundPx -----------------------------------------------------------------
check("roundPx trims trailing zeros", roundPx(24.0) === 24, String(roundPx(24.0)));
check("roundPx keeps a sub-pixel gap", roundPx(0.5) === 0.5, String(roundPx(0.5)));
check("roundPx goes to two places", roundPx(12.3456) === 12.35, String(roundPx(12.3456)));
check("roundPx normalises negative zero", Object.is(roundPx(-0.001), 0), String(roundPx(-0.001)));

// --- measureGap: apart --------------------------------------------------------
// A at x 0..100, B at x 124..224 — 24px of clear space, same row.
const apart = measureGap(rect(0, 0, 100, 40), rect(124, 0, 100, 40));
check("a clear horizontal gap is positive", apart.gap.x === 24, JSON.stringify(apart.gap));
check("rows on the same line have no vertical gap", apart.gap.y === -40, JSON.stringify(apart.gap));
check("aligned top edges read 0", apart.edges.top === 0, String(apart.edges.top));
check("nothing is contained", apart.containment === "none", apart.containment);

// --- measureGap: touching -----------------------------------------------------
const touching = measureGap(rect(0, 0, 100, 40), rect(100, 0, 50, 40));
check("touching edges read 0", touching.gap.x === 0, String(touching.gap.x));

// --- measureGap: overlapping --------------------------------------------------
const overlap = measureGap(rect(0, 0, 100, 40), rect(88, 0, 100, 40));
check("an overlap is negative", overlap.gap.x === -12, String(overlap.gap.x));

// --- measureGap: containment --------------------------------------------------
const inside = measureGap(rect(0, 0, 200, 100), rect(20, 10, 100, 40));
check("b inside a is detected", inside.containment === "b-inside-a", inside.containment);
check("b inside a keeps usable edges", inside.edges.left === 20, String(inside.edges.left));

const outside = measureGap(rect(20, 10, 100, 40), rect(0, 0, 200, 100));
check("a inside b is detected", outside.containment === "a-inside-b", outside.containment);

// --- measureGap: edges and centre ---------------------------------------------
const shifted = measureGap(rect(0, 0, 100, 40), rect(8, 0, 80, 40));
check("left edge delta is signed", shifted.edges.left === 8, String(shifted.edges.left));
check("right edge delta is signed", shifted.edges.right === -12, String(shifted.edges.right));
check("centre delta is computed", shifted.center.x === -2, String(shifted.center.x));

// --- sub-pixel survives end to end --------------------------------------------
const hairline = measureGap(rect(0, 0, 100, 40), rect(100.5, 0, 100, 40));
check("a 0.5px gap is not rounded away", hairline.gap.x === 0.5, String(hairline.gap.x));

console.log(failures ? `\n${failures} failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
```

- [ ] **Step 3: Run it and confirm it fails**

```bash
node test/measure.mjs
```

Expected: esbuild throws `Could not resolve "src/content/measure.ts"`. That is the correct failure — the module does not exist yet.

- [ ] **Step 4: Write the engine**

Create `src/content/measure.ts`:

```ts
// =============================================================================
// Measuring — arithmetic over rects and computed styles
// =============================================================================
//
// This file reads the DOM and nothing else. No bridge, no framework knowledge, no
// state — the same contract `identify.ts` keeps, and for the same reason: a measured
// figure has to be exactly as trustworthy on a minified production build as on a dev
// server, and it is the only part of the report that can promise that.
//
// Every figure is a **layout pixel**. See the note above `Sides` in `shared/types.ts`
// for why mixing in post-transform rects would be wrong.
// =============================================================================

import type { BoxModel, Containment, GapGeometry, Sides } from "../shared/types";

/** Everything with a viewport-space box. `DOMRect` satisfies it structurally. */
export interface RectLike {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/**
 * Two decimal places, trailing zeros gone, and never `-0`.
 *
 * Not `Math.round`. A browser's own inspector rounds to integers, which silently
 * turns the half-pixel seam a reviewer is pointing at into `0px` — the one figure
 * that would make them doubt their own eyes.
 */
export function roundPx(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return rounded === 0 ? 0 : rounded;
}

function px(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** `padding-top` … `padding-left`, or `border-top-width` … when `suffix` is given. */
function sides(style: CSSStyleDeclaration, prefix: string, suffix = ""): Sides {
  return {
    top: roundPx(px(style.getPropertyValue(`${prefix}-top${suffix}`))),
    right: roundPx(px(style.getPropertyValue(`${prefix}-right${suffix}`))),
    bottom: roundPx(px(style.getPropertyValue(`${prefix}-bottom${suffix}`))),
    left: roundPx(px(style.getPropertyValue(`${prefix}-left${suffix}`))),
  };
}

/**
 * The four bands, plus whether the element is drawn at these numbers.
 *
 * Chrome's computed `width`/`height` resolve to the **content** box whatever
 * `box-sizing` says, so the border box is derived rather than read — that way one
 * source of truth feeds every figure and they cannot disagree by a rounding step.
 */
export function readBoxModel(element: Element): BoxModel {
  const style = getComputedStyle(element);
  const padding = sides(style, "padding");
  const border = sides(style, "border", "-width");
  const margin = sides(style, "margin");

  const content = {
    width: roundPx(px(style.width)),
    height: roundPx(px(style.height)),
  };
  const width = roundPx(content.width + padding.left + padding.right + border.left + border.right);
  const height = roundPx(content.height + padding.top + padding.bottom + border.top + border.bottom);

  // One comparison catches transforms, page zoom and `scale()` on an ancestor alike,
  // without walking the tree: if the rendered rect is not the layout box, say so.
  const rendered = element.getBoundingClientRect();
  const scaled = Math.abs(rendered.width - width) > 0.5 || Math.abs(rendered.height - height) > 0.5;

  return { width, height, content, padding, border, margin, scaled };
}

function contains(outer: RectLike, inner: RectLike): boolean {
  return (
    inner.left >= outer.left &&
    inner.right <= outer.right &&
    inner.top >= outer.top &&
    inner.bottom <= outer.bottom
  );
}

/**
 * The space between two rects, per axis.
 *
 * One expression covers apart, touching and overlapping, with no branch to get the
 * sign wrong in: the overlap along an axis is `min(rights) - max(lefts)`, so its
 * negation is the empty space — positive when they are apart, zero when they touch,
 * negative by the overlap when they are not.
 */
export function measureGap(a: RectLike, b: RectLike): GapGeometry {
  const gap = {
    x: roundPx(-(Math.min(a.right, b.right) - Math.max(a.left, b.left))),
    y: roundPx(-(Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))),
  };

  const edges: Sides = {
    top: roundPx(b.top - a.top),
    right: roundPx(b.right - a.right),
    bottom: roundPx(b.bottom - a.bottom),
    left: roundPx(b.left - a.left),
  };

  const center = {
    x: roundPx((b.left + b.right) / 2 - (a.left + a.right) / 2),
    y: roundPx((b.top + b.bottom) / 2 - (a.top + a.bottom) / 2),
  };

  let containment: Containment = "none";
  if (contains(a, b)) containment = "b-inside-a";
  else if (contains(b, a)) containment = "a-inside-b";

  return { gap, edges, center, containment };
}
```

- [ ] **Step 5: Run the test and confirm it passes**

```bash
node test/measure.mjs
```

Expected: every line `ok`, then `all checks passed`. If `roundPx normalises negative zero` fails, the `rounded === 0` guard is missing — `-0.001` rounds to `-0` and `Object.is(-0, 0)` is `false`.

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck
```

Expected: no output. `Settings.showBoxModel` is now required, so a missing `DEFAULT_SETTINGS` entry fails here.

- [ ] **Step 7: Wire the script and commit**

In `package.json`, add the script and put it ahead of the browser suites:

```json
    "test:unit": "node test/measure.mjs",
    "test": "npm run build && node test/measure.mjs && node test/e2e.mjs && node test/upgrade.mjs",
```

```bash
node test/measure.mjs && npm run typecheck
git add src/shared/types.ts src/content/measure.ts test/measure.mjs package.json
git commit -m "feat: measure the box model and the gap between two rects"
```

---

### Task 2: The report lines

**Files:**
- Modify: `src/shared/output.ts` (formatters near `formatBox`, line 68; rendering in `renderAnnotation`, lines 199–229; the compact bullet in `renderCompact`, line 138)
- Modify: `test/measure.mjs` (append a second block)
- Modify: `docs/measure-core/brief.md` (two spec corrections found in review)

**Interfaces:**
- Consumes: `Measurements`, `BoxModel`, `GapMeasurement`, `Sides` from Task 1.
- Produces: `formatSides(sides: Sides): string` and `formatBoxModel(box: BoxModel): string`, both exported so `test/measure.mjs` can reach them. `measurementLines(annotation, detail): string[]` stays private.

- [ ] **Step 1: Correct two things in the spec first**

Review of the design against the code found two problems. Fix `docs/measure-core/brief.md` before writing code so the spec and the implementation cannot disagree:

1. The example report block uses `−12px` (U+2212 MINUS SIGN). Change every one to an ASCII `-`. The report is grepped and parsed by agents; a typographic minus is a character nobody types into a search box.
2. `GapMeasurement.center` is in the type but appears in no row of the gating table — computed and never printed. Add a row so it is printed at `forensic`:

```markdown
| `**Centres:**` | | | | ✓ |
```

- [ ] **Step 2: Write the failing test**

Append to `test/measure.mjs`, above the final `console.log`:

```js
// -----------------------------------------------------------------------------
// Report formatting
// -----------------------------------------------------------------------------

const { formatSides, formatBoxModel, generateOutput } = await load(
  "src/shared/output.ts",
  "output.mjs",
);

check("four equal sides collapse to one", formatSides({ top: 1, right: 1, bottom: 1, left: 1 }) === "1px", formatSides({ top: 1, right: 1, bottom: 1, left: 1 }));
check("a vertical/horizontal pair collapses to two", formatSides({ top: 8, right: 12, bottom: 8, left: 12 }) === "8px 12px", formatSides({ top: 8, right: 12, bottom: 8, left: 12 }));
check("an odd side keeps all four", formatSides({ top: 0, right: 0, bottom: 16, left: 0 }) === "0 0 16px 0", formatSides({ top: 0, right: 0, bottom: 16, left: 0 }));

const box = {
  width: 320, height: 48,
  content: { width: 296, height: 32 },
  padding: { top: 8, right: 12, bottom: 8, left: 12 },
  border: { top: 0, right: 0, bottom: 0, left: 0 },
  margin: { top: 0, right: 0, bottom: 16, left: 0 },
  scaled: false,
};
check(
  "the box line reads as one sentence of CSS",
  formatBoxModel(box) === "320×48px · content 296×32 · padding 8px 12px · margin 0 0 16px 0",
  formatBoxModel(box),
);
check(
  "a zero band is left out entirely",
  !formatBoxModel(box).includes("border"),
  formatBoxModel(box),
);
check(
  "a scaled element says so rather than lying",
  formatBoxModel({ ...box, scaled: true }).endsWith(" · scaled"),
  formatBoxModel({ ...box, scaled: true }),
);

/** One annotation carrying a measured gap, at whichever detail level. */
function reportWith(detail) {
  return generateOutput(
    [
      {
        id: "1",
        comment: "these two are not aligned",
        timestamp: 0,
        element: 'button "Save"',
        elementPath: ".actions > button",
        selector: ".actions > button.primary",
        x: 50, y: 100, isFixed: false,
        measurements: {
          box,
          gap: {
            gap: { x: 24, y: 0 },
            edges: { top: 0, right: -12, bottom: 0, left: 8 },
            center: { x: -2, y: 0 },
            containment: "none",
            toElement: 'button "Cancel"',
            toSelector: ".actions > button.secondary",
          },
        },
      },
    ],
    { pathname: "/checkout", href: "https://example.test/checkout", page: null },
    detail,
  );
}

const standard = reportWith("standard");
check("standard names the second element", standard.includes('**Measured to:** button "Cancel"'), "");
check("standard prints the gap", standard.includes("**Gap:** 24px horizontal, 0px vertical"), "");
check("standard withholds the edges", !standard.includes("**Edges:**"), "");
check("standard withholds the box", !standard.includes("**Box:**"), "");

const detailed = reportWith("detailed");
check("detailed prints the edges", detailed.includes("**Edges:** top aligned, right -12px, bottom aligned, left +8px"), "");
check("detailed prints the box", detailed.includes("**Box:** 320×48px"), "");
check("detailed still withholds the centres", !detailed.includes("**Centres:**"), "");

const forensic = reportWith("forensic");
check("forensic prints the centres", forensic.includes("**Centres:** 2px left, aligned vertically"), "");

const compact = reportWith("compact");
check("compact appends the gap to the bullet", compact.includes("· gap 24×0px"), "");
check("compact prints no measurement block", !compact.includes("**Gap:**"), "");
```

- [ ] **Step 3: Run it and confirm it fails**

```bash
node test/measure.mjs
```

Expected: `formatSides is not a function`, or the first `formatSides` check fails. Everything in the first block must still pass.

- [ ] **Step 4: Add the formatters**

In `src/shared/output.ts`, import the new types alongside the existing ones, then add these directly under `formatBox` (line 73):

```ts
/**
 * CSS shorthand order, collapsed the way a stylesheet would write it.
 *
 * Collapsing matters more than it looks: `8px 12px` is a value a reader can paste
 * straight into a rule, while `8px 12px 8px 12px` reads as four separate numbers
 * they have to compare before they trust it.
 */
export function formatSides(sides: Sides): string {
  const unit = (value: number) => (value === 0 ? "0" : `${value}px`);
  const { top, right, bottom, left } = sides;

  if (top === right && right === bottom && bottom === left) return unit(top);
  if (top === bottom && left === right) return `${unit(top)} ${unit(right)}`;
  return `${unit(top)} ${unit(right)} ${unit(bottom)} ${unit(left)}`;
}

/** `320×48px · content 296×32 · padding 8px 12px · margin 0 0 16px 0`. */
export function formatBoxModel(box: BoxModel): string {
  const parts = [`${box.width}×${box.height}px`, `content ${box.content.width}×${box.content.height}`];

  // A band of nothing is noise. Only the ones that exist earn a place on the line.
  const nonZero = (sides: Sides) => sides.top || sides.right || sides.bottom || sides.left;
  if (nonZero(box.padding)) parts.push(`padding ${formatSides(box.padding)}`);
  if (nonZero(box.margin)) parts.push(`margin ${formatSides(box.margin)}`);
  if (nonZero(box.border)) parts.push(`border ${formatSides(box.border)}`);

  // Last, because it qualifies everything before it.
  if (box.scaled) parts.push("scaled");

  return parts.join(" · ");
}

/** `24px` apart, `12px overlap`, or a plain `0px` when the edges touch. */
function formatAxis(value: number): string {
  if (value < 0) return `${-value}px overlap`;
  return `${value}px`;
}

/** `+8px`, `-12px`, or `aligned`. ASCII minus: this line gets grepped. */
function formatDelta(value: number): string {
  if (value === 0) return "aligned";
  return value > 0 ? `+${value}px` : `${value}px`;
}

/**
 * The lines a deliberately-taken measurement earns.
 *
 * `**Gap:**` appears from `standard` while `**Box:**` waits for `detailed`, and the
 * asymmetry is the point: a gap cost the reviewer two clicks in a mode they chose,
 * so suppressing it would discard an expressed intention. The box model is passive
 * data collected alongside, which is the same standing `**Position:**` has.
 */
function measurementLines(measurements: Measurements, detail: OutputDetailLevel): string[] {
  const lines: string[] = [];
  const wantsDetail = detail === "detailed" || detail === "forensic";
  const wantsForensic = detail === "forensic";
  const { gap, box } = measurements;

  if (gap) {
    lines.push(`**Measured to:** ${gap.toElement} (\`${gap.toSelector}\`)`);

    if (gap.containment === "none") {
      lines.push(`**Gap:** ${formatAxis(gap.gap.x)} horizontal, ${formatAxis(gap.gap.y)} vertical`);
    } else {
      // One rect is wholly inside the other, so "the space between them" describes
      // nothing. The edge deltas are the whole answer, and they are printed below.
      const which =
        gap.containment === "b-inside-a"
          ? "the second element is inside the first"
          : "the first element is inside the second";
      lines.push(`**Gap:** none — ${which}`);
    }

    if (wantsDetail) {
      const { top, right, bottom, left } = gap.edges;
      lines.push(
        `**Edges:** top ${formatDelta(top)}, right ${formatDelta(right)}, ` +
          `bottom ${formatDelta(bottom)}, left ${formatDelta(left)}`,
      );
    }

    if (wantsForensic) {
      const horizontal =
        gap.center.x === 0 ? "aligned horizontally" : `${Math.abs(gap.center.x)}px ${gap.center.x > 0 ? "right" : "left"}`;
      const vertical =
        gap.center.y === 0 ? "aligned vertically" : `${Math.abs(gap.center.y)}px ${gap.center.y > 0 ? "down" : "up"}`;
      lines.push(`**Centres:** ${horizontal}, ${vertical}`);
    }
  }

  if (wantsDetail && box) lines.push(`**Box:** ${formatBoxModel(box)}`);

  return lines;
}

/** `gap 24×0px`, for the one-line bullet in a compact report. */
function compactGap(measurements: Measurements | undefined): string {
  const gap = measurements?.gap;
  if (!gap) return "";
  return ` · gap ${gap.gap.x}×${gap.gap.y}px`;
}
```

Add the imports at the top:

```ts
import {
  isDone,
  kindOf,
  type ActionEntry,
  type Annotation,
  type BoxModel,
  type Diagnostics,
  type Measurements,
  type OutputDetailLevel,
  type PageFrameworkInfo,
  type Sides,
  type SourceRef,
} from "./types";
```

- [ ] **Step 5: Call them**

In `renderAnnotation`, immediately after the `**Position:**` line (line 210) — the measurement belongs beside the geometry it extends, not at the bottom:

```ts
  if (annotation.measurements) {
    lines.push(...measurementLines(annotation.measurements, detail));
  }
```

In `renderCompact` (line 138 — **not** `renderDone`, which renders the "Already fixed"
list and is the easy one to hit by mistake), change the returned line to carry the suffix:

```ts
function renderCompact(annotation: Annotation, number: number): string {
  const source = formatSource(annotation.source);
  const where = source ? ` (${source})` : "";
  const quoted = annotation.selectedText ? ` — re: "${truncate(annotation.selectedText, 30)}"` : "";
  const gap = compactGap(annotation.measurements);
  return `${number}. ${tag(annotation)}**${annotation.element}**${where}${gap}: ${annotation.comment}${quoted}`;
}
```

- [ ] **Step 6: Run the test and confirm it passes**

```bash
node test/measure.mjs
```

Expected: every check `ok`. If `standard withholds the box` fails, `measurementLines` was called with the wrong gate — `**Box:**` is behind `wantsDetail`, not behind `gap`.

- [ ] **Step 7: Typecheck and commit**

```bash
npm run typecheck && node test/measure.mjs
git add src/shared/output.ts test/measure.mjs docs/measure-core/brief.md
git commit -m "feat: report the measured gap and box model"
```

---

### Task 3: Drawing — bands, badge, dimension lines

**Files:**
- Create: `src/content/ui/measure-overlay.ts`
- Modify: `src/content/ui/styles.css` (append after the `.marquee` block, around line 470)

**Interfaces:**
- Consumes: the `BoxModel`, `GapGeometry` and `Sides` **types** from Task 1, and `h` from `./dom`. It calls neither `readBoxModel` nor `measureGap` — it is handed the results, which is what keeps it testable against static rects.
- Produces: `class MeasureOverlay` with `anchor` (getter), `setAnchor(element: Element | null)`, `syncAnchor()`, `showBox(rect: Box, box: BoxModel)`, `hideBox()`, `showGap(a: Box, b: Box, geometry: GapGeometry)`, `hideGap()`, `hideAll()`. `Box` is structural, so a `DOMRect` is a valid argument. Task 4 constructs it with `ui.overlayLayer` and calls exactly these.

- [ ] **Step 1: Write the class**

Create `src/content/ui/measure-overlay.ts`:

```ts
// =============================================================================
// Measurement overlay — bands, size badge, dimension lines
// =============================================================================
//
// Kept out of `overlay.ts` deliberately. That class owns the hover highlight and the
// marquee, and `showHighlights` runs at pointermove frequency — it pools its boxes
// specifically to avoid DOM churn there. Bands, a badge and four lines are a third job
// with a different lifetime: they belong to one mode, not to every hover. Sharing the
// class would make every hover in `point` mode pay for code it never draws.
//
// The anchor lives here rather than in `content/index.ts` for the same reason the UI
// classes own their own state everywhere else in this folder: `index.ts` is 1800 lines
// and every mode that put its state there made it longer.
//
// Every node is created once, in the constructor, and moved by style writes afterwards.
// =============================================================================

import type { BoxModel, GapGeometry, Sides } from "../../shared/types";
import { h } from "./dom";

/** Viewport-space box. `DOMRect` satisfies it structurally. */
interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/** Four strips make a band; the middle is left alone so the content stays readable. */
type Strips = [HTMLElement, HTMLElement, HTMLElement, HTMLElement];

function strips(layer: HTMLElement, variant: "padding" | "margin"): Strips {
  const made = Array.from({ length: 4 }, () =>
    h("div", { class: `measure-band measure-band--${variant}`, style: { display: "none" } }),
  ) as Strips;
  layer.append(...made);
  return made;
}

function place(element: HTMLElement, left: number, top: number, width: number, height: number): void {
  // A zero-width strip is a band that is not there. Drawing it would leave a 0px line
  // of colour on the edge, which reads as a 1px border the element does not have.
  if (width <= 0 || height <= 0) {
    element.style.display = "none";
    return;
  }
  element.style.display = "block";
  element.style.left = `${left}px`;
  element.style.top = `${top}px`;
  element.style.width = `${width}px`;
  element.style.height = `${height}px`;
}

function hide(...elements: HTMLElement[]): void {
  for (const element of elements) element.style.display = "none";
}

export class MeasureOverlay {
  private readonly padding: Strips;
  private readonly margin: Strips;
  private readonly badge: HTMLElement;
  private readonly anchorBox: HTMLElement;
  private readonly lineH: HTMLElement;
  private readonly lineV: HTMLElement;
  private readonly labelH: HTMLElement;
  private readonly labelV: HTMLElement;

  /** The element a gap is measured *from*, or null before the first click. */
  private anchored: Element | null = null;

  constructor(layer: HTMLElement) {
    // Margin first so padding paints over it where they meet.
    this.margin = strips(layer, "margin");
    this.padding = strips(layer, "padding");

    this.anchorBox = h("div", { class: "measure-anchor", style: { display: "none" } });
    this.badge = h("div", { class: "measure-badge", style: { display: "none" } });
    this.lineH = h("div", { class: "measure-line", style: { display: "none" } });
    this.lineV = h("div", { class: "measure-line measure-line--v", style: { display: "none" } });
    this.labelH = h("div", { class: "measure-label", style: { display: "none" } });
    this.labelV = h("div", { class: "measure-label", style: { display: "none" } });

    layer.append(this.anchorBox, this.badge, this.lineH, this.lineV, this.labelH, this.labelV);
  }

  get anchor(): Element | null {
    // A node the page has re-rendered away measures nothing; treat it as never set.
    if (this.anchored && !this.anchored.isConnected) this.anchored = null;
    return this.anchored;
  }

  setAnchor(element: Element | null): void {
    this.anchored = element;
    if (!element) {
      hide(this.anchorBox);
      this.hideGap();
      return;
    }
    const rect = element.getBoundingClientRect();
    place(this.anchorBox, rect.left, rect.top, rect.width, rect.height);
  }

  /** Redraw the anchor outline where the element is now — after a scroll or a resize. */
  syncAnchor(): void {
    const element = this.anchor;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    place(this.anchorBox, rect.left, rect.top, rect.width, rect.height);
  }

  // ---------------------------------------------------------------------------
  // Box model
  // ---------------------------------------------------------------------------

  showBox(rect: Box, box: BoxModel): void {
    this.paintBand(this.margin, rect, box.margin, "outside");
    this.paintBand(this.padding, this.borderBox(rect, box.border), box.padding, "inside");

    this.badge.style.display = "block";
    this.badge.textContent = box.scaled
      ? `${box.width}×${box.height} (scaled)`
      : `${box.width}×${box.height}`;
    this.badge.style.left = `${rect.left}px`;
    // Under the box, unless the box is against the bottom of the viewport.
    const below = rect.bottom + 4;
    const fits = below + 18 < window.innerHeight;
    this.badge.style.top = `${fits ? below : Math.max(0, rect.top - 20)}px`;
  }

  hideBox(): void {
    hide(...this.margin, ...this.padding, this.badge);
  }

  /** The border box shrunk by its own borders — where padding actually starts. */
  private borderBox(rect: Box, border: Sides): Box {
    const left = rect.left + border.left;
    const top = rect.top + border.top;
    const width = rect.width - border.left - border.right;
    const height = rect.height - border.top - border.bottom;
    return { left, top, width, height, right: left + width, bottom: top + height };
  }

  private paintBand(band: Strips, rect: Box, sides: Sides, side: "inside" | "outside"): void {
    const [top, right, bottom, left] = band;
    const sign = side === "outside" ? -1 : 1;

    // Outside: the strips sit beyond the box. Inside: they sit within it.
    const outerLeft = rect.left + sign * sides.left;
    const outerTop = rect.top + sign * sides.top;
    const outerWidth = rect.width - sign * (sides.left + sides.right);
    const outerHeight = rect.height - sign * (sides.top + sides.bottom);

    const spanLeft = side === "outside" ? outerLeft : rect.left;
    const spanWidth = side === "outside" ? outerWidth : rect.width;

    place(top, spanLeft, side === "outside" ? outerTop : rect.top, spanWidth, sides.top);
    place(
      bottom,
      spanLeft,
      side === "outside" ? rect.bottom : rect.bottom - sides.bottom,
      spanWidth,
      sides.bottom,
    );
    place(
      left,
      side === "outside" ? outerLeft : rect.left,
      rect.top,
      sides.left,
      rect.height,
    );
    place(
      right,
      side === "outside" ? rect.right : rect.right - sides.right,
      rect.top,
      sides.right,
      rect.height,
    );
  }

  // ---------------------------------------------------------------------------
  // Gap
  // ---------------------------------------------------------------------------

  /**
   * Two lines at most: one per axis, and only where there is clear space to span.
   *
   * Overlapping or nested rects get no line — a dimension line drawn across an overlap
   * points at nothing a reader can act on. The badge and the two outlines already say
   * what is going on, and the report carries the edge deltas that are the real answer.
   */
  showGap(a: Box, b: Box, geometry: GapGeometry): void {
    const { gap } = geometry;

    if (gap.x > 0) {
      const left = Math.min(a.right, b.right);
      const overlapsVertically = Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top);
      const y = overlapsVertically
        ? (Math.max(a.top, b.top) + Math.min(a.bottom, b.bottom)) / 2
        : (a.top + a.bottom + b.top + b.bottom) / 4;

      place(this.lineH, left, y, gap.x, 1);
      this.label(this.labelH, `${gap.x}px`, left + gap.x / 2, y);
    } else {
      hide(this.lineH, this.labelH);
    }

    if (gap.y > 0) {
      const top = Math.min(a.bottom, b.bottom);
      const overlapsHorizontally = Math.min(a.right, b.right) > Math.max(a.left, b.left);
      const x = overlapsHorizontally
        ? (Math.max(a.left, b.left) + Math.min(a.right, b.right)) / 2
        : (a.left + a.right + b.left + b.right) / 4;

      place(this.lineV, x, top, 1, gap.y);
      this.label(this.labelV, `${gap.y}px`, x, top + gap.y / 2);
    } else {
      hide(this.lineV, this.labelV);
    }

    if (gap.x <= 0 && gap.y <= 0 && geometry.containment !== "none") {
      this.label(this.labelH, "inside", (b.left + b.right) / 2, b.top - 10);
    }
  }

  hideGap(): void {
    hide(this.lineH, this.lineV, this.labelH, this.labelV);
  }

  hideAll(): void {
    this.hideBox();
    this.hideGap();
    hide(this.anchorBox);
    this.anchored = null;
  }

  /** Centred on the point, via a transform so no layout read is needed. */
  private label(element: HTMLElement, text: string, x: number, y: number): void {
    element.style.display = "block";
    element.textContent = text;
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
  }
}
```

- [ ] **Step 2: Add the styles**

Append to `src/content/ui/styles.css`, after the `.marquee` rules:

```css
/* ---------------------------------------------------------------------------
 * Measurement overlay
 *
 * The band colours are the one place in this UI that does NOT derive from
 * `--sa-accent`. The padding band and the margin band have to be distinguishable
 * from each other, and two shades derived from an arbitrary colour the user picked
 * cannot guarantee that. Fixed green and orange, translucent enough to read the page
 * through. See `docs/measure-core/context.md`.
 * ------------------------------------------------------------------------- */

.measure-band {
  position: fixed;
  pointer-events: none;
}

.measure-band--padding {
  background: rgba(16, 185, 129, 0.28);
}

.measure-band--margin {
  background: rgba(249, 115, 22, 0.24);
}

.measure-badge {
  position: fixed;
  pointer-events: none;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--sa-accent);
  color: var(--sa-accent-ink);
  font-size: 11px;
  font-weight: 600;
  font-family: var(--sa-mono);
  white-space: nowrap;
}

/* The element a gap is measured from. Solid where the live hover is translucent, so
   the two are never mistaken for each other mid-measurement. */
.measure-anchor {
  position: fixed;
  pointer-events: none;
  border: 2px solid var(--sa-accent);
  border-radius: 3px;
  background: transparent;
}

.measure-line {
  position: fixed;
  pointer-events: none;
  background: var(--sa-accent);
}

.measure-label {
  position: fixed;
  pointer-events: none;
  /* Centred on its point without a layout read — the alternative is measuring
     offsetWidth on every pointermove. */
  transform: translate(-50%, -50%);
  padding: 0 4px;
  border-radius: 3px;
  background: var(--sa-accent);
  color: var(--sa-accent-ink);
  font-size: 10px;
  font-weight: 600;
  font-family: var(--sa-mono);
  line-height: 15px;
  white-space: nowrap;
}
```

- [ ] **Step 3: Typecheck and build**

```bash
npm run typecheck && npm run build
```

Expected: both clean. Nothing constructs `MeasureOverlay` yet, so there is nothing else to observe at this step — that is why it is one commit and not a task with its own browser check.

- [ ] **Step 4: Commit**

```bash
git add src/content/ui/measure-overlay.ts src/content/ui/styles.css
git commit -m "feat: draw box-model bands and dimension lines"
```

---

### Task 4: The mode

**Files:**
- Modify: `src/content/ui/dom.ts` (two icon paths, in `PATHS`, line 152)
- Modify: `src/content/ui/toolbar.ts` (`MODES` line 57, `MODE_HINTS` line 68, `ToolbarState`, `ToolbarCallbacks`, constructor, `update`)
- Modify: `src/content/capture.ts` (`CaptureOptions` line 23, the draft object line 71)
- Modify: `src/content/index.ts` (construction, hover, click, keys, Escape, `queueSync`)
- Modify: `test/e2e.mjs` (six hint assertions)

**Interfaces:**
- Consumes: `MeasureOverlay` (Task 3), `readBoxModel`/`measureGap` (Task 1), `Measurements` (Task 1).
- Produces: `ToolbarCallbacks.onToggleMeasure()`, `ToolbarState.measureOpen` — Task 5 supplies both.

- [ ] **Step 1: Add the two icons**

In `src/content/ui/dom.ts`, inside `PATHS`:

```ts
  // A double-headed arrow — this button measures the distance between two things.
  arrows: "M3 12h18M3 12l4-4M3 12l4 4M21 12l-4-4M21 12l-4 4",
  // A ruler with ticks, for the card that holds the measuring options.
  ruler: "M2 8h20v8H2z M6 8v3M10 8v3M14 8v3M18 8v3",
```

- [ ] **Step 2: Update the toolbar**

`MODES` gains a fourth entry — the array order is the render order:

```ts
const MODES: { mode: InspectMode; iconName: string; title: string }[] = [
  { mode: "point", iconName: "cursor", title: "Click an element (1)" },
  { mode: "text", iconName: "text", title: "Select text (2)" },
  { mode: "area", iconName: "marquee", title: "Drag across elements (3)" },
  { mode: "measure", iconName: "arrows", title: "Measure distances (4)" },
];
```

`MODE_HINTS` — **all four strings, verbatim.** The e2e suite compares these character for character:

```ts
const MODE_HINTS: Record<InspectMode, string> = {
  point: "Click an element · ⌘/Ctrl+drag across several · C captures hover · 2 text · 3 area · 4 measure",
  text: "Select text · 1 point · 3 area · 4 measure",
  area: "Drag across elements · 1 point · 2 text · 4 measure",
  measure: "Click two elements · C captures the pair · Esc clears · 1 point · 2 text · 3 area",
};
```

`ToolbarState` gains one field, next to `settingsOpen`:

```ts
  measureOpen: boolean;
```

`ToolbarCallbacks` gains one method, next to `onToggleSettings`:

```ts
  onToggleMeasure(): void;
```

In the constructor, directly after `freezeButton` is built:

```ts
    this.measureButton = h(
      "button",
      {
        class: "tool tool--measure",
        attrs: { "aria-label": "Measure tools", "aria-pressed": "false" },
        on: { click: () => callbacks.onToggleMeasure() },
      },
      icon("ruler"),
    );
```

Declare the field beside `freezeButton`:

```ts
  private readonly measureButton: HTMLButtonElement;
```

Add it to the pill in the `const bar = h("div", { class: "toolbar" }, …)` call (line 208),
between `this.freezeButton` and `this.panelButton`:

```ts
      this.freezeButton,
      this.measureButton,
      this.panelButton,
```

Add it to the `attachTooltip` loop below that call as well, in the same position — every
other button in the pill has a tooltip, and an icon-only button without one has no label
at all until a screen reader reads it.

Then one line in `update()`, beside its neighbours:

```ts
    this.measureButton.setAttribute("aria-pressed", String(state.measureOpen));
```

- [ ] **Step 3: Let a draft carry measurements**

In `src/content/capture.ts`:

```ts
export interface CaptureOptions {
  settings: Settings;
  selectedText?: string;
  /**
   * Figures taken in `measure` mode. Passed in rather than computed here: capture runs
   * for every annotation, and re-measuring on each one would charge every mode for a
   * feature only one of them uses.
   */
  measurements?: Measurements;
}
```

and in the draft literal, after `isMultiSelect`:

```ts
    measurements: options.measurements,
```

Import `Measurements` from `../shared/types` alongside the existing type imports.

- [ ] **Step 4: Wire the mode into `content/index.ts`**

All of these go **inside `installTopFrame()`** or inside functions it already owns — never at module scope, or every iframe on the page gets a second copy (`CLAUDE.md`, "Both content scripts run with `all_frames: true`").

Construct it beside the other UI, right after `overlay`:

```ts
  const measureOverlay = new MeasureOverlay(ui.overlayLayer);
```

Add a helper next to `drawHover`, and call it from `drawHover`'s end:

```ts
/**
 * Bands, badge and — once an anchor is set — the dimension lines.
 *
 * Split out of `drawHover` so the cost is visible: this is the only place in the hover
 * path that calls `getComputedStyle`, which forces a style recalculation. It runs when
 * the user asked for it (the setting) or when the mode is about nothing else.
 */
function drawMeasure(element: Element): void {
  if (mode !== "measure" && !settings.showBoxModel) {
    measureOverlay.hideBox();
    return;
  }

  const rect = element.getBoundingClientRect();
  measureOverlay.showBox(rect, readBoxModel(element));

  const anchor = measureOverlay.anchor;
  if (!anchor || anchor === element) {
    measureOverlay.hideGap();
    return;
  }
  const anchorRect = anchor.getBoundingClientRect();
  measureOverlay.showGap(anchorRect, rect, measureGap(anchorRect, rect));
}
```

At the end of `drawHover`, after the existing `overlay.showHighlights(...)`:

```ts
  drawMeasure(element);
```

A helper that turns the current pair into the field a draft carries, next to `drawMeasure`:

```ts
/** What the composer will store. `null` when there is nothing measured to store. */
function currentMeasurements(target: Element): Measurements | undefined {
  const box = readBoxModel(target);
  const anchor = measureOverlay.anchor;
  if (!anchor || anchor === target) return { box };

  const anchorRect = anchor.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const { name } = identifyElement(target);

  return {
    box,
    gap: {
      ...measureGap(anchorRect, targetRect),
      toElement: name,
      toSelector: buildSelector(target),
    },
  };
}
```

`buildSelector` and `identifyElement` are already imported from `./identify`.

Commit the pair. `beginAnnotation` grows one optional argument rather than a second
function, so every existing call site is untouched:

```ts
async function beginAnnotation(
  elements: Element[],
  selectedText?: string,
  measurements?: Measurements,
): Promise<void> {
  const draft = await captureDraft(elements, { settings, selectedText, measurements });
  if (!draft) return;

  composerTargets = elements;
  openComposer(draft, elements[0].getBoundingClientRect(), null);
}
```

In the `click` handler, replace `if (mode !== "point") return;` with a measure branch
ahead of it:

```ts
      if (mode === "measure") {
        const measureTarget = document.elementFromPoint(event.clientX, event.clientY);
        if (!measureTarget || !eligible(measureTarget)) return;

        // First click anchors, second commits. Same rhythm as `point`: hover reads,
        // click writes — measure just needs two of them to have something to say.
        if (!measureOverlay.anchor) {
          measureOverlay.setAnchor(measureTarget);
          render();
          return;
        }
        const from = measureOverlay.anchor;
        const measurements = currentMeasurements(measureTarget);
        measureOverlay.setAnchor(null);
        void beginAnnotation(
          from === measureTarget ? [measureTarget] : [from, measureTarget],
          undefined,
          measurements,
        );
        return;
      }

      if (mode !== "point") return;
```

In `captureHovered`, widen the guard and pass the figures:

```ts
function captureHovered(): void {
  if (mode !== "point" && mode !== "measure") return;

  if (hoveredElement && !hoveredElement.isConnected) hoveredElement = null;

  if (!hoveredElement) {
    ui.toast("Hover an element first", "error");
    return;
  }

  if (requestFrameHoverCapture(hoveredElement)) return;

  if (mode === "measure") {
    const from = measureOverlay.anchor;
    const measurements = currentMeasurements(hoveredElement);
    const elements = from && from !== hoveredElement ? [from, hoveredElement] : [hoveredElement];
    measureOverlay.setAnchor(null);
    void beginAnnotation(elements, undefined, measurements);
    return;
  }

  void beginAnnotation([hoveredElement]);
}
```

Add the key, beside `case "3"`:

```ts
      case "4":
        mode = "measure";
        resetMarquee();
        clearPicked();
        overlay.hideAll();
        measureOverlay.hideAll();
        render();
        break;
```

and add `measureOverlay.hideAll();` to the `1`, `2` and `3` cases and to `onModeChange`
in the toolbar callbacks — leaving an anchor behind when the mode changes is the same
class of bug `clearPicked()` exists to prevent.

In the Escape chain, immediately **before** the `picked.length` branch:

```ts
      // A half-taken measurement is as likely a target for Escape as a half-built pick
      // set, and for the same reason: it is a gesture the user started and abandoned.
      if (measureOverlay.anchor) {
        measureOverlay.setAnchor(null);
        if (hoveredElement?.isConnected) void updateHover(hoveredElement);
        return;
      }
```

In `queueSync`, the early return excludes every mode but `point`, which would freeze
the bands and the anchor outline mid-scroll. Change it to:

```ts
    if (composer || !active) return;
    if (mode === "measure") {
      measureOverlay.syncAnchor();
      if (hoveredElement?.isConnected) drawHover(hoveredElement);
      return;
    }
    if (mode !== "point") return;
```

Finally, `render()` builds the `ToolbarState`; add `measureOpen: measureCard !== null`
— Task 5 introduces `measureCard`, so until then use `measureOpen: false` and change it
in Task 5.

- [ ] **Step 5: Update the six hint assertions**

In `test/e2e.mjs`, the exact strings at lines 466, 473, 480, 594, 610 and 766. Each must
match `MODE_HINTS` character for character:

```js
// 466 and 610 and 766
"Click an element · ⌘/Ctrl+drag across several · C captures hover · 2 text · 3 area · 4 measure"
// 473
"Select text · 1 point · 3 area · 4 measure"
// 480 and 594
"Drag across elements · 1 point · 2 text · 4 measure"
```

- [ ] **Step 6: Verify**

```bash
npm run typecheck && node test/measure.mjs
SENANNOTATE_PLAYWRIGHT_DIR=<path> SENANNOTATE_HEADLESS=1 npm test
```

Expected: the suite passes. If a hint assertion still fails, the string in `toolbar.ts`
and the string in `e2e.mjs` differ by a separator — they use `·` (U+00B7) with a space
either side, not a hyphen.

- [ ] **Step 7: Commit**

```bash
git add src/content/ui/dom.ts src/content/ui/toolbar.ts src/content/capture.ts src/content/index.ts test/e2e.mjs
git commit -m "feat: a measure mode that reports the gap between two elements"
```

---

### Task 5: The Measure card

**Files:**
- Create: `src/content/ui/measure-card.ts`
- Modify: `src/content/index.ts` (`toggleMeasureCard`, the toolbar callback, `render`)
- Modify: `src/content/ui/styles.css` (one width rule)

**Interfaces:**
- Consumes: `Settings`, `dismissCard`/`h`/`icon` from `./dom`.
- Produces: `class MeasureCard` with the **same method names as `SettingsCard`** — `element`, `render(settings: Settings)`, `anchorTo(dock: DOMRect)`, `destroy()` — plus `MeasureCallbacks { onClose(): void; onChange(patch: Partial<Settings>): void }`. The names matter: two cards solving the same geometry problem with different verbs is how they drift apart.

- [ ] **Step 1: Write the card**

Create `src/content/ui/measure-card.ts`. Copy the anchored-placement maths and the
`row`/`toggle` helpers from `src/content/ui/settings.ts` verbatim — they are the same
geometry problem and divergence between the two cards would be a visible bug:

```ts
// =============================================================================
// Measure card — the controls that belong to measuring, not to the report
// =============================================================================
//
// One row today. It exists at one row because the next two releases add theirs here,
// and a control a user has already learned the position of is not worth moving later
// to save a file now.
//
// Same division of labour as `settings.ts`: this class owns no state. It renders the
// `Settings` it is handed and reports changes as a patch; `content/index.ts` stays the
// only thing that owns settings and the only thing that writes them.
// =============================================================================

import type { Settings } from "../../shared/types";
import { dismissCard, h, icon } from "./dom";

export interface MeasureCallbacks {
  onClose(): void;
  onChange(patch: Partial<Settings>): void;
}

const GAP = 8;
const EDGE = 12;
/** `.measure-card` in CSS; the fallback for a card not yet laid out. */
const CARD_WIDTH = 320;

export class MeasureCard {
  readonly element: HTMLElement;
  private readonly showBoxModel: HTMLInputElement;

  constructor(layer: HTMLElement, private readonly callbacks: MeasureCallbacks) {
    this.showBoxModel = h("input", {
      attrs: { type: "checkbox", "data-setting": "showBoxModel" },
      on: { change: () => callbacks.onChange({ showBoxModel: this.showBoxModel.checked }) },
    });

    this.element = h(
      "div",
      { class: "card measure-card" },
      h(
        "div",
        { class: "card__header" },
        icon("ruler", 14),
        h("span", { class: "card__title", text: "Measure" }),
        h(
          "button",
          { class: "icon-button", title: "Close", on: { click: () => callbacks.onClose() } },
          icon("close", 14),
        ),
      ),
      h(
        "div",
        { class: "card__body" },
        this.row(
          "Box model on hover",
          "Shades padding and margin on whatever the pointer is over, and puts the size on a badge. Mode 4 shows them regardless.",
          h("label", { class: "switch" }, this.showBoxModel, h("span", { class: "switch__track" })),
        ),
      ),
    );

    layer.append(this.element);
  }

  private row(label: string, help: string, control: HTMLElement): HTMLElement {
    return h(
      "div",
      { class: "settings__row" },
      h(
        "div",
        { class: "settings__text" },
        h("span", { class: "settings__label", text: label }),
        h("span", { class: "settings__help", text: help }),
      ),
      control,
    );
  }

  render(settings: Settings): void {
    this.showBoxModel.checked = settings.showBoxModel;
  }

  /** Anchored to the dock, exactly as the settings card is. */
  anchorTo(dock: DOMRect): void {
    const width = this.element.offsetWidth || CARD_WIDTH;
    const left = Math.min(Math.max(EDGE, dock.left), window.innerWidth - width - EDGE);
    this.element.style.left = `${left}px`;
    this.element.style.bottom = `${Math.max(EDGE, window.innerHeight - dock.top + GAP)}px`;
  }

  destroy(): void {
    dismissCard(this.element);
  }
}
```

Add one rule to `styles.css`, beside the `.settings` width rule:

```css
.measure-card {
  width: 320px;
}
```

- [ ] **Step 2: Wire it**

In `src/content/index.ts`, next to `settingsCard` and `toggleSettings`, mirroring them
exactly — including the mutual exclusion, because two anchored cards would overlap:

Declare the card beside `settingsCard` (line 218) and give it a `toggleSettings`-shaped
function — same `force?: boolean` signature, same early return, same trailing `render()`:

```ts
let measureCard: MeasureCard | null = null;

const measureCallbacks = {
  onClose: () => toggleMeasureCard(false),
  // Deliberately *not* a copy of `settingsCallbacks.onChange`: that one derives
  // `componentMode` from `detailLevel`, which no control in this card can set. Sharing it
  // would put a rule here that this card can never trigger, and the next person would
  // have to prove that before touching either.
  onChange: (patch: Partial<Settings>) => {
    settings = { ...settings, ...patch };
    void saveSettings(settings);
    render();
  },
};

function toggleMeasureCard(force?: boolean): void {
  const next = force ?? !measureCard;
  if (next === !!measureCard) return;

  if (next) {
    // Only one anchored card at a time — both hang off the same corner of the dock.
    toggleSettings(false);
    togglePanel(false);
    measureCard = new MeasureCard(ui.cardLayer, measureCallbacks);
    measureCard.render(settings);
    // After `render`, for the reason `toggleSettings` gives: a card whose rows are not
    // filled in yet measures short, and the flip depends on its height.
    measureCard.anchorTo(toolbar.dockBox());
  } else {
    measureCard?.destroy();
    measureCard = null;
  }

  render();
}
```

Four more edits, each beside its `settingsCard` equivalent:

- line 268, `onDockShift` — add `measureCard?.anchorTo(toolbar.dockBox())` next to
  `settingsCard?.anchorTo(toolbar.dockBox())`
- line 328, the `ToolbarState` — `measureOpen: !!measureCard`
- line 335 — add `measureCard?.render(settings)` next to `settingsCard?.render(settings)`
- add `onToggleMeasure: () => toggleMeasureCard()` to the `Toolbar` callbacks object

Extend the Escape chain's card branch so it closes this one too, directly after the
`settingsCard` branch:

```ts
      if (measureCard) {
        toggleMeasureCard(false);
        return;
      }
```

> The line numbers above are from `main` at 0.8.2 and will have drifted by Task 5 —
> find each one by its `settingsCard` neighbour, not by counting lines.

- [ ] **Step 3: Verify and commit**

```bash
npm run typecheck && npm run build
SENANNOTATE_PLAYWRIGHT_DIR=<path> SENANNOTATE_HEADLESS=1 npm test
git add src/content/ui/measure-card.ts src/content/ui/styles.css src/content/index.ts
git commit -m "feat: a Measure card for the box-model toggle"
```

---

### Task 6: The fixture and the browser checks

**Files:**
- Create: `test/fixtures/measure.html`
- Modify: `test/e2e.mjs` (a new block, placed after the marquee block so it inherits a page already proven to load the toolbar)

**Interfaces:**
- Consumes: everything from Tasks 1–5.
- Produces: nothing other tasks depend on.

- [ ] **Step 1: Write the fixture**

Create `test/fixtures/measure.html`. Every figure the block asserts on is fixed here, so
the numbers are arithmetic rather than whatever the default stylesheet happened to do:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Measure fixture</title>
    <style>
      /* Whole-pixel geometry on purpose: every number the suite asserts is derived
         from these rules, not from a layout the browser was free to round.
         `box-sizing` stays at the default so the declared width IS the content width,
         which is what the engine reads out of `getComputedStyle`. */
      body { margin: 0; font: 14px/1.4 system-ui, sans-serif; height: 700px; position: relative; }

      /* 296 content + 12 padding either side = 320 border box; 32 + 8 + 8 = 48 high. */
      #save {
        position: absolute; left: 40px; top: 100px;
        width: 296px; height: 32px;
        padding: 8px 12px; margin: 0 0 16px 0; border: 0;
        background: #2563eb; color: #fff;
      }

      /* Left edge 24px clear of #save's right edge (40 + 320 + 24 = 384), same top. */
      #cancel {
        position: absolute; left: 384px; top: 100px;
        width: 96px; height: 32px;
        padding: 8px 12px; margin: 0; border: 0;
        background: #e5e7eb;
      }

      /* Directly below #save with a 40px gap: 100 + 48 + 40 = 188. */
      #note { position: absolute; left: 40px; top: 188px; width: 320px; height: 24px; }
    </style>
  </head>
  <body>
    <h1 style="padding: 20px 0 0 40px">Measure fixture</h1>
    <button id="save">Save</button>
    <button id="cancel">Cancel</button>
    <p id="note">Nothing else in the suite annotates this page.</p>
  </body>
</html>
```

- [ ] **Step 2: Write the failing checks**

Add to `test/e2e.mjs`, after the marquee block closes:

```js
    // -------------------------------------------------------------------------
    // Measure — box model, and the gap between two elements
    // -------------------------------------------------------------------------
    const measure = await context.newPage();
    await measure.goto(`${base}/measure.html`);
    await measure.locator(".toolbar").waitFor({ state: "visible", timeout: 10_000 });
    await measure.locator(".tool--brand").click();

    await measure.locator('.tool[aria-label^="Measure distances"]').click();
    const measureHint = measure.locator(".toolbar-hint");
    check(
      "the hint explains that measuring takes two clicks",
      ((await measureHint.textContent())?.trim() ?? "") ===
        "Click two elements · C captures the pair · Esc clears · 1 point · 2 text · 3 area",
      `hint read "${(await measureHint.textContent())?.trim() ?? ""}"`,
    );

    const save = await measure.locator("#save").boundingBox();
    const cancel = await measure.locator("#cancel").boundingBox();

    // Hovering alone draws the badge — reading a size must not cost an annotation.
    await measure.mouse.move(save.x + save.width / 2, save.y + save.height / 2);
    const badge = measure.locator(".measure-badge");
    await badge.waitFor({ state: "visible", timeout: 5_000 });
    check(
      "the badge reports the layout border box",
      ((await badge.textContent()) ?? "").trim() === "320×48",
      `badge read "${((await badge.textContent()) ?? "").trim()}"`,
    );
    check(
      "the padding band is drawn on all four sides",
      (await measure.locator(".measure-band--padding").count()) === 4,
    );
    check(
      "hovering alone creates no annotation",
      (await measure.locator(".marker").count()) === 0,
    );

    // First click anchors.
    await measure.mouse.click(save.x + save.width / 2, save.y + save.height / 2);
    check(
      "the first click anchors rather than annotating",
      (await measure.locator(".measure-anchor").isVisible()) &&
        (await measure.locator(".composer").count()) === 0,
    );

    // Hovering the second element draws the dimension line.
    await measure.mouse.move(cancel.x + cancel.width / 2, cancel.y + cancel.height / 2);
    const gapLabel = measure.locator(".measure-label").first();
    await gapLabel.waitFor({ state: "visible", timeout: 5_000 });
    check(
      "the dimension line carries the measured gap",
      ((await gapLabel.textContent()) ?? "").trim() === "24px",
      `label read "${((await gapLabel.textContent()) ?? "").trim()}"`,
    );

    // Escape abandons a half-taken measurement without leaving the mode.
    await measure.keyboard.press("Escape");
    check(
      "Escape clears the anchor",
      !(await measure.locator(".measure-anchor").isVisible()),
    );
    check(
      "Escape does not leave the mode",
      (await measure.locator('.tool[aria-label^="Measure distances"]').getAttribute("aria-pressed")) === "true",
    );

    // Take it again and commit it.
    await measure.mouse.click(save.x + save.width / 2, save.y + save.height / 2);
    await measure.mouse.click(cancel.x + cancel.width / 2, cancel.y + cancel.height / 2);
    const measureComposer = measure.locator(".composer");
    await measureComposer.waitFor({ state: "visible", timeout: 5_000 });
    await measure.locator(".composer__input").fill("these two are not aligned");
    await measure.locator(".composer .button--primary").click();
    await measureComposer.waitFor({ state: "detached", timeout: 5_000 });

    // Detailed, so the box and the edges are in scope.
    await measure.locator('.tool[aria-label^="Settings"]').click();
    await measure.locator('.settings select[data-setting="detailLevel"]').selectOption("detailed");
    await measure.keyboard.press("Escape");

    await measure.locator('.tool[aria-label^="Annotations"]').click();
    await measure.locator(".panel").waitFor({ state: "visible", timeout: 5_000 });
    await measure.locator(".panel .button--primary").click();
    const measureReport = await measure.evaluate(() => navigator.clipboard.readText());

    check(
      "the report names the element measured to",
      measureReport.includes("**Measured to:**") && measureReport.includes("#cancel"),
      measureReport.slice(0, 400),
    );
    check(
      "the report carries the gap",
      measureReport.includes("**Gap:** 24px horizontal"),
      measureReport.slice(0, 400),
    );
    check(
      "the report carries the box model",
      measureReport.includes("**Box:** 320×48px · content 296×32 · padding 8px 12px"),
      measureReport.slice(0, 400),
    );
    check(
      "aligned edges say so rather than printing 0px",
      measureReport.includes("top aligned"),
      measureReport.slice(0, 400),
    );
```

- [ ] **Step 3: Run it and confirm it fails, then passes**

```bash
SENANNOTATE_PLAYWRIGHT_DIR=<path> SENANNOTATE_HEADLESS=1 npm test
```

Two failure modes worth recognising before assuming a real bug:

- **`badge read "320×48 (scaled)"`** — the fixture's `box-sizing` was overridden, or the
  browser is at a zoom other than 100%. The engine is right; the environment is not.
- **The suite hangs rather than failing.** Something drove a permission-gated API from the
  extension popup. `context.grantPermissions(…, { origin: base })` covers the fixture
  origin, not `chrome-extension://`. Drive the popup, observe from a page.

- [ ] **Step 4: Commit**

```bash
git add test/fixtures/measure.html test/e2e.mjs
git commit -m "test: cover the box model, the gap and the anchor lifecycle"
```

---

### Task 7: Documentation

**Files:**
- Modify: `wiki/Toolbar-and-Modes.md`, `wiki/Keyboard-Reference.md`, `wiki/The-Report.md`, `wiki/Settings.md`
- Modify: `README.md` (the keybindings table and the feature list)
- Modify: `docs/measure-core/changelog.md`

**Interfaces:** none.

- [ ] **Step 1: The wiki**

`CLAUDE.md` requires the wiki updated when user-visible behaviour changes; four pages
describe surfaces this release changed.

- `Toolbar-and-Modes.md` — a fourth mode in the mode table, and the Measure card button.
  Describe the two-click rhythm and that hover alone reads.
- `Keyboard-Reference.md` — `4` selects the mode, `C` commits the pair, `Esc` clears the
  anchor without leaving the mode.
- `The-Report.md` — the three new lines and the level each appears at. Copy the gating
  table out of `docs/measure-core/brief.md` rather than re-deriving it.
- `Settings.md` — `Box model on hover`, and that it lives in the Measure card rather than
  in Settings, because it is switched during a review rather than configured once.

- [ ] **Step 2: `README.md`**

Add the mode to the keybindings table and one bullet to the feature list. Do **not**
touch the production-build measurements section — nothing here changes those.

- [ ] **Step 3: Fill in the changelog**

`docs/measure-core/changelog.md` is the point of the whole folder. Record what actually
happened: which of this plan's assumptions turned out false, what the first attempt at
the band geometry got wrong, and anything the e2e run surfaced that the plan did not
predict. A changelog that only restates the plan is worth nothing to the next reader.

- [ ] **Step 4: Verify and commit**

```bash
npm run typecheck && node test/measure.mjs
SENANNOTATE_PLAYWRIGHT_DIR=<path> SENANNOTATE_HEADLESS=1 npm test
git add wiki README.md docs/measure-core/changelog.md
git commit -m "docs: measure mode in the wiki and the readme"
```

---

## Opening the pull request

Start from the template on purpose — `gh pr create --body` bypasses it, which is exactly
the path an agent takes:

```bash
gh pr create --body-file .github/PULL_REQUEST_TEMPLATE.md   # then edit
```

Keep every heading and checklist item. Tick a verification box **only** after running the
command: CI is typecheck + build + pack and never runs `npm test`, so a green tick is not
evidence the suite passed. Reference `docs/measure-core/` in the body.

---

## Definition of done

The five success criteria in `brief.md`, and the command that proves each. A criterion
with no command beside it is an opinion.

| Criterion | Proved by |
|---|---|
| 1. Two elements 24px apart put `**Gap:** 24px` in the report | Task 6, "the report carries the gap" |
| 2. A 0.5px gap reports as `0.5px`, not `0px` | Task 1, "a 0.5px gap is not rounded away" |
| 3. Typecheck clean, suite green including the six known-broken hints | `npm run typecheck && npm test` |
| 4. No new manifest permission, no new bridge RPC | `git diff main -- static/manifest.json src/inspector` is empty |
| 5. `index.ts` grows by the wiring and no more | `git diff --stat main -- src/content/index.ts` — expect roughly 60 added lines. Materially more means state that belongs in `measure-overlay.ts` leaked into it |
