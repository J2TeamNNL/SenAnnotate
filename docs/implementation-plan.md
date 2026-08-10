# SenAnnotate Rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Vue-specific `others/vuetation` Chrome extension into **SenAnnotate** — a universal visual annotator that works on any website, with Vue detection demoted to an optional bonus.

**Architecture:** Unchanged. The three-world MV3 split (MAIN-world inspector reading framework internals ↔ ISOLATED-world content script owning the shadow-DOM UI and `chrome.*` ↔ service worker for `captureVisibleTab` and the badge) stays exactly as built, because Vue detection is being kept. The work is a namespace/brand sweep plus two small behaviour changes in the places that assumed a Vue-only audience.

**Tech Stack:** TypeScript, esbuild (IIFE for content scripts, ESM for service worker and popup), vanilla DOM in a shadow root, Playwright-driven headed Chromium for e2e. Zero runtime dependencies.

**Spec:** `brief.md`, `context.md`, `plan.md` (beside this file). Read `context.md` before starting — it carries the verified grep inventory of every rename surface, with file:line.

## Global Constraints

Every task's requirements implicitly include these.

- **Working directory:** `/Users/thangnm/Documents/Works/others/vuetation` until Task 8 renames it to `others/senannotate`. All paths below are relative to it.
- **Branch:** `feature/senannotate-rebrand`, created in Task 0.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`). **Never** add a `Co-Authored-By` trailer or a `Claude-Session` trailer.
- **Chrome floor:** `minimum_chrome_version: "111"` — `world: "MAIN"` content scripts need it. Do not change.
- **Module format:** MV3 content scripts are not ES modules. `src/content` and `src/inspector` must each stay a single IIFE bundle; service worker and popup stay ESM. Do not add imports that break this.
- **Dependencies:** zero runtime deps; build-time is `esbuild` + `typescript` only. Do not add a package for anything, including the icon work.
- **Icons:** Chrome rejects SVG in `manifest.icons`, hence the hand-rolled PNG encoder. Do not replace it with a library.
- **Do not rename** the `PageVueInfo` / `VueElementInfo` / `VueMajor` / `VueFlavour` types. Vue is still the only detector; a framework-neutral name would describe a generalisation that does not exist.
- **Do not remove** Vue detection, `src/inspector/vue-internals.ts`, or the MAIN world.
- **Exact accent values** (Task 5): `--sa-accent: #f97316`, `--sa-accent-strong: #ea580c`, `--sa-accent-ink: #431407`.
- **Test baseline:** `npm run test` is **45/45** before any change (measured 2026-08-10). It builds first and drives a **headed** Chromium, so it needs a desktop session. Expect **46/46** from Task 4 onward.
- **No user-facing copy may claim the tool requires Vue.**

---

### Task 0: Put the project under version control

The project has no git history at all, and Tasks 1–2 are a wide find-and-replace sweep. Without a baseline commit there is no undo. This creates a purely local repository — nothing is pushed anywhere.

**Files:**
- Create: `.git/` (via `git init`)
- Modify: none

**Interfaces:**
- Produces: a clean baseline commit every later task can be diffed and reverted against; the working branch `feature/senannotate-rebrand`.

- [ ] **Step 1: Confirm the directory is not already a repo**

Run: `git status`
Expected: `fatal: not a git repository (or any of the parent directories): .git`

If it *is* already a repo, stop and report — the rest of this task's assumptions no longer hold.

- [ ] **Step 2: Initialise and confirm the ignore rules already cover build output**

```bash
git init
git status --short
```

Expected: the listing contains `src/`, `static/manifest.json`, `test/`, `package.json`, `README.md`, `TESTER-GUIDE.md`, `scripts/`, and **must not** contain `node_modules/`, `dist/`, `static/icons/`, `test/fixtures/vendor/`, `test/fixtures/prod/`, or `vuetation-0.1.0.zip` — the existing `.gitignore` already excludes all of those.

If any of those *do* appear, stop and report rather than committing them.

- [ ] **Step 3: Commit the baseline**

```bash
git add -A
git commit -m "chore: baseline Vuetation 0.1.0 before SenAnnotate rebrand"
```

- [ ] **Step 4: Verify the baseline is clean and complete**

```bash
git log --oneline
git status --short
```

Expected: exactly one commit; `git status --short` prints nothing.

- [ ] **Step 5: Create the working branch**

```bash
git checkout -b feature/senannotate-rebrand
git branch --show-current
```

Expected: `feature/senannotate-rebrand`

---

### Task 1: Rename the namespace and consolidate the storage keys

`NS` in `protocol.ts` is the only cascading rename source — it feeds the three bridge channel names plus `PROBE_ATTR` and `UI_ATTR`. The storage keys do **not** derive from it; they are declared twice, identically, in two files. A rename is exactly when two copies drift, so they move into `protocol.ts` in the same task.

**Files:**
- Modify: `src/shared/protocol.ts:17` (and add two exports)
- Modify: `src/content/storage.ts:13-16`
- Modify: `src/popup/index.ts:5-16`

**Interfaces:**
- Produces: `ANNOTATION_PREFIX: string` (`"senannotate:page:"`) and `SETTINGS_KEY: string` (`"senannotate:settings"`), both exported from `src/shared/protocol.ts`. Tasks 2–9 do not add further consumers, but nothing else may re-declare these strings.

- [ ] **Step 1: Change `NS` and add the storage-key exports**

In `src/shared/protocol.ts`, line 17:

```ts
export const NS = "senannotate";
```

Then, immediately after the existing `INSPECTOR_ATTR` declaration, add:

```ts
/**
 * Storage keys. Declared here rather than in `content/storage.ts` because the popup
 * needs the same two strings, and two copies of a namespaced key are two chances to
 * drift on the next rename.
 */
export const ANNOTATION_PREFIX = `${NS}:page:`;
export const SETTINGS_KEY = `${NS}:settings`;
```

- [ ] **Step 2: Point `content/storage.ts` at the shared constants**

Replace lines 13-16 of `src/content/storage.ts`:

```ts
import { DEFAULT_SETTINGS, type Annotation, type Settings } from "../shared/types";

const ANNOTATION_PREFIX = "vuetation:page:";
const SETTINGS_KEY = "vuetation:settings";
```

with:

```ts
import { ANNOTATION_PREFIX, SETTINGS_KEY } from "../shared/protocol";
import { DEFAULT_SETTINGS, type Annotation, type Settings } from "../shared/types";
```

- [ ] **Step 3: Point `popup/index.ts` at the shared constants**

Line 5 of `src/popup/index.ts` is currently a type-only import, so it has to become a value import with inline type specifiers. Replace:

```ts
import type { RuntimeMessage, RuntimeResponse } from "../shared/protocol";
```

with:

```ts
import {
  ANNOTATION_PREFIX,
  SETTINGS_KEY,
  type RuntimeMessage,
  type RuntimeResponse,
} from "../shared/protocol";
```

Then delete lines 15-16:

```ts
const SETTINGS_KEY = "vuetation:settings";
const ANNOTATION_PREFIX = "vuetation:page:";
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no output, exit 0.

- [ ] **Step 5: Verify there is exactly one declaration site left**

```bash
grep -rn "vuetation:page:\|vuetation:settings" src/
grep -rn "ANNOTATION_PREFIX =\|SETTINGS_KEY =" src/
```

Expected: the first command prints nothing. The second prints only the two lines in `src/shared/protocol.ts`.

- [ ] **Step 6: Run the full suite — this is the bridge-rename regression gate**

Run: `npm run test`
Expected: `45/45 checks passed`.

Both sides of the `postMessage` bridge were renamed together, so a mismatch here means one side was missed. If Vue detection has gone silent (`hover names the owning component` fails), that is the symptom.

- [ ] **Step 7: Commit**

```bash
git add src/shared/protocol.ts src/content/storage.ts src/popup/index.ts
git commit -m "refactor: rename bridge namespace to senannotate and dedupe storage keys"
```

---

### Task 2: Rename the remaining `src/` literals and the CSS token prefix

Everything left in `src/` is an independent string literal that does not derive from `NS`.

**Files:**
- Modify: `src/inspector/freeze.ts:19,134,158,189,190`
- Modify: `src/inspector/diagnostics.ts:264,274,282,318`
- Modify: `src/inspector/index.ts:107`
- Modify: `src/content/index.ts:59,62,63,413`
- Modify: `src/content/ui/styles.css:2` and every `--vt-` occurrence

- [ ] **Step 1: `src/inspector/freeze.ts`**

Line 19:

```ts
const STYLE_ID = "senannotate-freeze-styles";
```

Line 134:

```ts
      video.dataset.senannotateWasPlaying = "true";
```

Line 158:

```ts
      console.warn("[senannotate] queued timeout threw on replay:", error);
```

Lines 189-190:

```ts
    if (video.dataset.senannotateWasPlaying === "true") {
      delete video.dataset.senannotateWasPlaying;
```

- [ ] **Step 2: `src/inspector/diagnostics.ts`**

Line 264:

```ts
  __senannotate?: { method: string; url: string; start: number };
```

Line 274:

```ts
      this.__senannotate = { method: String(method), url: String(url), start: 0 };
```

Line 282:

```ts
    const meta = this.__senannotate;
```

Line 318:

```ts
    console.warn("[senannotate] diagnostics capture failed to install:", error);
```

- [ ] **Step 3: `src/inspector/index.ts` line 107**

```ts
    console.warn("[senannotate] inspector failed:", error);
```

- [ ] **Step 4: `src/content/index.ts`**

Line 59:

```ts
    __senannotateInstalled?: boolean;
```

Lines 62-63:

```ts
if (window.__senannotateInstalled) throw new Error("senannotate: already installed");
window.__senannotateInstalled = true;
```

Line 413:

```ts
  const filename = `senannotate-${Date.now()}.png`;
```

- [ ] **Step 5: `src/content/ui/styles.css`**

Line 2 header comment:

```css
   SenAnnotate overlay styles — injected into a shadow root
```

Then rename every custom-property prefix `--vt-` → `--sa-` throughout the file. This covers both the definitions in the `:host` / `:host([data-theme="dark"])` blocks and every `var(--vt-…)` reference.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no output, exit 0.

- [ ] **Step 7: Verify the sweep left nothing behind**

```bash
grep -rni "vuetation" src/
grep -c -- "--vt-" src/content/ui/styles.css
```

Expected: the first prints nothing. The second prints `0`.

A missed `--vt-` token does not error — it silently resolves to nothing and the element loses its colour — so this grep matters more than it looks.

- [ ] **Step 8: Run the suite**

Run: `npm run test`
Expected: `45/45 checks passed`.

- [ ] **Step 9: Commit**

```bash
git add src/
git commit -m "refactor: rename remaining vuetation literals and CSS token prefix"
```

---

### Task 3: Hide the stack badge on pages with no framework

Currently `applyStackBadge` shows an **amber warning** pill reading "No Vue detected". For a universal annotator that fires on most of the web, where it reads as breakage. The absent-framework case carries no actionable information, so the badge should simply not appear. The amber state survives only for its real meaning: a framework *was* found but its metadata is stripped, which the user can actually fix.

**Files:**
- Modify: `test/e2e.mjs:443-444`
- Modify: `src/content/ui/toolbar.ts:142-149`

- [ ] **Step 1: Rewrite the failing test**

In `test/e2e.mjs`, replace lines 443-444:

```js
    const plainBadge = (await plain.locator(".stack-badge").textContent())?.trim() ?? "";
    check("non-Vue pages say so", plainBadge === "No Vue detected", `badge read "${plainBadge}"`);
```

with:

```js
    const plainBadgeVisible = await plain.locator(".stack-badge").isVisible();
    check(
      "non-framework pages show no stack badge",
      !plainBadgeVisible,
      `badge visible: ${plainBadgeVisible}`,
    );
```

The element is always in the DOM — the constructor creates it — and is hidden with `style.display = "none"`, which `isVisible()` correctly reports as false.

- [ ] **Step 2: Run the suite to verify the new check fails**

Run: `npm run test`
Expected: `44/45`, with `FAIL non-framework pages show no stack badge — badge visible: true`.

- [ ] **Step 3: Hide the badge**

In `src/content/ui/toolbar.ts`, replace the `!page.detected` branch at lines 142-149:

```ts
    if (!page.detected) {
      this.stackBadge.style.display = "inline-flex";
      this.stackBadge.dataset.warn = "true";
      this.stackBadge.textContent = "No Vue detected";
      this.stackBadge.title =
        "No Vue runtime found on this page. Annotations still work, but there will be no component or source information.";
      return;
    }
```

with:

```ts
    // No framework on the page is the ordinary case for a universal annotator, not a
    // problem worth a warning colour. The report simply carries no component data.
    if (!page.detected) {
      this.stackBadge.style.display = "none";
      delete this.stackBadge.dataset.warn;
      return;
    }
```

Leave the `!page.devMetadata` warn path below it untouched — a stripped production build *is* worth warning about.

- [ ] **Step 4: Run the suite to verify it passes**

Run: `npm run test`
Expected: `45/45 checks passed`.

The Vue-path badge checks at `:120-122`, `:126-130`, `:251-252` and `:379` must still pass — they exercise `page.detected === true`, which this change does not touch.

- [ ] **Step 5: Commit**

```bash
git add test/e2e.mjs src/content/ui/toolbar.ts
git commit -m "feat: hide the stack badge on pages with no detected framework"
```

---

### Task 4: Omit the `Stack:` report line when nothing is detected

`describeStack()` returns the literal `"Vue not detected"`, and both callers emit it unconditionally. On a non-Vue site that is noise in every single report.

**Files:**
- Modify: `test/e2e.mjs` (append after the existing `non-Vue pages still annotate` check, currently ending line 453)
- Modify: `src/shared/output.ts:35-51,141,150`

- [ ] **Step 1: Write the failing test**

In `test/e2e.mjs`, immediately after the `check("non-Vue pages still annotate", …)` block that ends around line 453 — and before the closing `} finally {` — add:

```js
    await plain.locator(".composer__input").fill("Make this button wider.");
    await plain.locator(".composer .button--primary").click();
    await plain.locator(".composer").waitFor({ state: "detached", timeout: 5_000 });

    await plain.locator('.tool[title^="Annotations"]').click();
    await plain.locator(".panel").waitFor({ state: "visible", timeout: 5_000 });
    await plain.locator(".panel .button--primary").click();
    const plainReport = await plain.evaluate(() => navigator.clipboard.readText());

    check(
      "non-framework reports omit the Stack line and never mention Vue",
      !plainReport.includes("Stack:") && !/Vue/.test(plainReport),
      plainReport.slice(0, 300),
    );
```

Clipboard permissions are already granted for this origin at `:107` — every fixture is served from the same local server — so no extra setup is needed.

- [ ] **Step 2: Run the suite to verify the new check fails**

Run: `npm run test`
Expected: `45/46`, with `FAIL non-framework reports omit the Stack line and never mention Vue`, and the detail excerpt showing `**Stack:** Vue not detected`.

- [ ] **Step 3: Make `describeStack` return `null` when nothing is detected**

In `src/shared/output.ts`, change the signature and the guard at lines 35-36:

```ts
function describeStack(page: PageVueInfo | null): string | null {
  if (!page?.detected) return null;
```

Leave the rest of the function body unchanged.

- [ ] **Step 4: Update the forensic caller**

At line 141, replace:

```ts
    lines.push(`- Stack: ${describeStack(context.page)}`);
```

with:

```ts
    const stack = describeStack(context.page);
    if (stack) lines.push(`- Stack: ${stack}`);
```

- [ ] **Step 5: Update the standard caller**

At line 150, replace:

```ts
    lines.push(`**Stack:** ${describeStack(context.page)}  ·  **Viewport:** ${viewport}`);
```

with:

```ts
    const stack = describeStack(context.page);
    lines.push(
      stack ? `**Stack:** ${stack}  ·  **Viewport:** ${viewport}` : `**Viewport:** ${viewport}`,
    );
```

Note both callers now declare a `const stack` — they are in sibling branches of the same `if`/`else if`, so the two declarations do not collide. If TypeScript disagrees, rename the second to `stackLabel`.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no output, exit 0.

- [ ] **Step 7: Run the suite to verify it passes**

Run: `npm run test`
Expected: `46/46 checks passed`.

The existing `report names the stack` check on the Vue 3 fixture must still pass — it exercises the `stack !== null` path.

- [ ] **Step 8: Commit**

```bash
git add test/e2e.mjs src/shared/output.ts
git commit -m "feat: omit the Stack report line when no framework is detected"
```

---

### Task 5: Swap the accent palette to orange

**Files:**
- Modify: `src/content/ui/styles.css:13-15`

- [ ] **Step 1: Replace the three accent tokens**

In the `:host` block, replace:

```css
  --sa-accent: #41b883;
  --sa-accent-strong: #35a372;
  --sa-accent-ink: #04150d;
```

with:

```css
  --sa-accent: #f97316;
  --sa-accent-strong: #ea580c;
  --sa-accent-ink: #431407;
```

(The property names are already `--sa-*` from Task 2; only the values change.)

`#431407` on `#f97316` computes to 5.48:1, which passes WCAG AA. White would be 2.85:1 and fails — do not use it.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: four bundles emitted, no errors.

- [ ] **Step 3: Look at it**

Load the unpacked extension from `dist/` at `chrome://extensions` (Developer mode → Load unpacked), then open any page and check: toolbar, hover highlight, marquee, numbered markers, composer, panel. Nothing should still be green.

- [ ] **Step 4: Check the warn-pill adjacency specifically**

Visit a production Vue fixture so the amber warning state renders — `npm run test` leaves them built under `test/fixtures/prod/stock/index.html`; serve that directory or reuse the test's own server. With an orange brand icon now sitting beside it, confirm the amber pill still reads as a *warning*.

If it does not, differentiate by **form, not hue**: prefix the pill's text with `⚠ `. Do **not** re-tint it red — `#e5484d` is already the destructive colour (`styles.css:450-452`, `:630`), and a stripped production build is a degraded capability, not an error.

- [ ] **Step 5: Commit**

```bash
git add src/content/ui/styles.css
git commit -m "feat: replace the Vue-green accent with orange"
```

---

### Task 6: Replace the Vue mark in the toolbar with an "S" monogram

**Files:**
- Modify: `src/content/ui/dom.ts` (the `PATHS` map, and the `icon()` fill special-case at 109-112)
- Modify: `src/content/ui/toolbar.ts:52`

- [ ] **Step 1: Swap the path**

In `src/content/ui/dom.ts`, delete the `vue` entry from `PATHS`:

```ts
  vue: "M2 4h4l6 10 6-10h4L12 21z M8 4h3l1 2 1-2h3l-4 7z",
```

and add, keeping the map's existing ordering style:

```ts
  s: "M15.03 6.75A3.5 3.5 0 1 0 12 12A3.5 3.5 0 1 1 8.97 17.25",
```

That is two 240° arcs of radius 3.5 on externally tangent circles centred `(12, 8.5)` and `(12, 15.5)`, meeting at `(12, 12)` — a stroked "S" that matches the rest of the set rather than a filled logo.

- [ ] **Step 2: Delete the fill special-case**

Still in `dom.ts`, remove these lines from `icon()` (109-112) — the Vue mark was the only filled icon:

```ts
  if (name === "vue") {
    path.setAttribute("fill", "currentColor");
    path.setAttribute("stroke", "none");
  }
```

- [ ] **Step 3: Point the toolbar at the new icon**

In `src/content/ui/toolbar.ts`, line 52:

```ts
      icon("s", 17),
```

- [ ] **Step 4: Typecheck and build**

```bash
npm run typecheck
npm run build
```

Expected: both clean.

- [ ] **Step 5: Verify the suite still passes**

Run: `npm run test`
Expected: `46/46 checks passed`.

No check asserts on the brand icon, so a failure here means something else broke.

- [ ] **Step 6: Look at it**

Reload the unpacked extension, hard-reload a test page, and confirm the toolbar's leftmost button shows a legible "S" at 17px with the same stroke weight as the mode icons beside it.

- [ ] **Step 7: Commit**

```bash
git add src/content/ui/dom.ts src/content/ui/toolbar.ts
git commit -m "feat: replace the Vue toolbar mark with an S monogram"
```

---

### Task 7: Regenerate the extension PNGs as an "S" badge

The only non-mechanical task in the plan. The existing generator rasterises the Vue chevron via a ray-casting `inside(polygon, x, y)` test. An "S" is curved, so polygons are the wrong primitive — the sampler needs to take a predicate instead.

Keep untouched: `composite()`, `CRC_TABLE`, `crc32()`, `chunk()`, `encodePng()`, `SIZES`, `SUPERSAMPLE`, `OUT_DIR`, and the write loop at the bottom.

**Files:**
- Modify: `scripts/make-icons.mjs` (header comment, the geometry constants block, `inside()` → predicates, `renderIcon()`)

- [ ] **Step 1: Replace the header comment's Vue reference**

Lines 5-6:

```js
// Chrome rejects SVG in `manifest.icons`, so the SenAnnotate mark is rasterised here
// with a hand-rolled PNG encoder (zlib is the only thing we need, and it ships with Node).
```

- [ ] **Step 2: Replace the geometry block**

Delete `GREEN`, `NAVY`, `OUTER`, `INNER`, `LOGO_W`, `LOGO_H`, `PADDING_RATIO` and the `inside()` function. Keep `SIZES` and `SUPERSAMPLE`. In their place:

```js
// The SenAnnotate mark: an "S" monogram in a rounded-square badge. Everything is
// expressed in a unit square (0..1) so one set of predicates renders at every size.
const ORANGE = [249, 115, 22, 255]; // #f97316
const INK = [67, 20, 7, 255]; //      #431407

const MARGIN = 0.06; // clear space around the badge
const CORNER = 0.24; // badge corner radius, as a fraction of the icon size

const GLYPH_H = 0.56; //          "S" height
const ARC_R = GLYPH_H / 4; //     two tangent circles stacked make that height
const STROKE = GLYPH_H * 0.19; // pen width

/** Rounded rect: clamp into the corner-centre rect, then one radius check covers all cases. */
function inRoundedRect(x, y, x0, y0, x1, y1, r) {
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

/** Degrees from +x, increasing downward — image coordinates, not maths coordinates. */
function angleAt(x, y, cx, cy) {
  return (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
}

function onArc(x, y, cx, cy, keep) {
  if (Math.abs(Math.hypot(x - cx, y - cy) - ARC_R) > STROKE / 2) return false;
  return keep(angleAt(x, y, cx, cy));
}

function nearPoint(x, y, px, py) {
  return Math.hypot(x - px, y - py) <= STROKE / 2;
}

/**
 * The "S" as two externally tangent arcs, each sweeping 240°:
 *
 *   upper bowl  from the top-right terminal (-30°), anticlockwise over the top and
 *               down the left side, to the tangent point at +90°
 *   lower bowl  from the tangent point (-90°), clockwise round the right side and
 *               along the bottom, to the bottom-left terminal at +150°
 *
 * They meet exactly at the centre: two circles of radius r whose centres are 2r
 * apart touch midway.
 */
function inGlyph(x, y) {
  const upperY = 0.5 - ARC_R;
  const lowerY = 0.5 + ARC_R;

  if (onArc(x, y, 0.5, upperY, (deg) => deg <= -30 || deg >= 90)) return true;
  if (onArc(x, y, 0.5, lowerY, (deg) => deg >= -90 && deg <= 150)) return true;

  // Round caps on the two visible terminals.
  const rad = Math.PI / 180;
  const upperTip = [0.5 + ARC_R * Math.cos(-30 * rad), upperY + ARC_R * Math.sin(-30 * rad)];
  const lowerTip = [0.5 + ARC_R * Math.cos(150 * rad), lowerY + ARC_R * Math.sin(150 * rad)];
  return nearPoint(x, y, upperTip[0], upperTip[1]) || nearPoint(x, y, lowerTip[0], lowerTip[1]);
}

// Painted in order, back to front.
const LAYERS = [
  {
    color: ORANGE,
    hit: (x, y) => inRoundedRect(x, y, MARGIN, MARGIN, 1 - MARGIN, 1 - MARGIN, CORNER),
  },
  { color: INK, hit: inGlyph },
];
```

- [ ] **Step 3: Replace `renderIcon`**

```js
function renderIcon(size) {
  const rgba = new Uint8Array(size * size * 4); // transparent

  const step = 1 / SUPERSAMPLE;
  const samplesPerPixel = SUPERSAMPLE * SUPERSAMPLE;
  const hits = new Array(LAYERS.length).fill(0);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      hits.fill(0);

      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const ux = (x + (sx + 0.5) * step) / size;
          const uy = (y + (sy + 0.5) * step) / size;
          for (let i = 0; i < LAYERS.length; i++) {
            if (LAYERS[i].hit(ux, uy)) hits[i]++;
          }
        }
      }

      let painted = false;
      for (const count of hits) {
        if (count > 0) {
          painted = true;
          break;
        }
      }
      if (!painted) continue;

      const offset = (y * size + x) * 4;
      for (let i = 0; i < LAYERS.length; i++) {
        if (hits[i] > 0) composite(rgba, offset, LAYERS[i].color, hits[i] / samplesPerPixel);
      }
    }
  }

  return rgba;
}
```

- [ ] **Step 4: Generate the icons**

Run: `npm run icons`
Expected: four lines, `icon-16.png` through `icon-128.png`, each a non-trivial byte count.

- [ ] **Step 5: Look at all four at actual size**

Open `static/icons/icon-16.png`, `icon-32.png`, `icon-48.png`, `icon-128.png`.

**16px is the one that decides this.** If the S is not clearly an S there, tune in this order and re-run `npm run icons` after each: raise `STROKE` toward `GLYPH_H * 0.24`; then raise `GLYPH_H` toward `0.62`; then reduce `MARGIN` toward `0.04`. The angle ranges (`-30`, `90`, `-90`, `150`) are the last thing to touch — they set the terminals, and moving them changes which way the letter opens.

- [ ] **Step 6: Confirm it reads in the browser toolbar**

Reload the unpacked extension and look at the toolbar icon against both a light and a dark browser theme. The badge is opaque orange, so it should hold up in both — that is why it is a badge rather than a bare glyph.

- [ ] **Step 7: Commit**

```bash
git add scripts/make-icons.mjs
git commit -m "feat: rasterise an S badge instead of the Vue mark"
```

`static/icons/` is gitignored and regenerated by `npm run build`, so the PNGs themselves are not committed.

---

### Task 8: Rebrand the manifest, package, docs, and directory name

**Files:**
- Modify: `static/manifest.json:3,5,14,48` and `version`
- Modify: `static/popup.html:5,218`
- Modify: `package.json` (`name`, `description`, `version`)
- Modify: `package-lock.json` (via npm, not by hand)
- Modify: `scripts/pack.mjs:5,27`
- Modify: `.gitignore:4`
- Modify: `README.md:1,137,150` and the opening description
- Modify: `TESTER-GUIDE.md:1,10,22` plus one new line
- Modify: `test/e2e.mjs:97`
- Modify: `test/fixtures/{plain,buggy,vue2-app,vue3-app,vue3-tracer}.html` (`<title>`), `test/fixtures/vue3-app.html:86`, `test/prod-app/index.html:5`
- Delete: `vuetation-0.1.0.zip`
- Rename: the project directory itself

- [ ] **Step 1: `static/manifest.json`**

```json
  "name": "SenAnnotate — visual annotator",
  "version": "0.2.0",
  "description": "Click any element on any page, add a note, and copy structured Markdown that points your AI coding agent at exactly what to change.",
```

`action.default_title` (line 14) → `"SenAnnotate"`.
`commands.toggle-inspect.description` (line 48) → `"Toggle SenAnnotate inspect mode"`.

Leave `minimum_chrome_version`, `permissions`, `host_permissions` and both `content_scripts` entries alone.

- [ ] **Step 2: `static/popup.html`**

Line 5 `<title>SenAnnotate</title>`, line 218 `<h1>SenAnnotate</h1>`.

- [ ] **Step 3: `package.json`, then regenerate the lockfile**

```json
  "name": "senannotate",
  "version": "0.2.0",
  "description": "Chrome extension: click any element on any website, annotate it, and hand an AI coding agent the exact element, DOM path and diagnostics. Adds Vue component and source data when the page is a Vue app.",
```

Then, rather than hand-editing the lockfile:

```bash
npm install --package-lock-only
```

`--package-lock-only` so this cannot quietly bump a dependency; it only rewrites the lock's own name/version fields.

- [ ] **Step 4: `scripts/pack.mjs`**

Line 5 comment → `senannotate-<version>.zip`. Line 27:

```js
const name = `senannotate-${version}`;
```

- [ ] **Step 5: `.gitignore` line 4**

```
senannotate-*.zip
```

- [ ] **Step 6: `test/e2e.mjs:97`**

```js
  const profile = mkdtempSync(join(tmpdir(), "senannotate-e2e-"));
```

- [ ] **Step 7: Fixture titles**

Change `Vuetation` → `SenAnnotate` in the `<title>` of each: `test/fixtures/plain.html:5`, `buggy.html:5`, `vue2-app.html:5`, `vue3-app.html:5`, `vue3-tracer.html:5`, and `test/prod-app/index.html:5`. Also `test/fixtures/vue3-app.html:86`:

```html
              <p class="intro">A fixture page for the SenAnnotate extension.</p>
```

`test/fixtures/prod/{stock,devtools,tracer}/index.html` are generated from `test/prod-app/index.html` and gitignored — they pick this up on the next rebuild, so do not edit them.

- [ ] **Step 8: `README.md`**

Replace the title and opening (lines 1-13, down to but not including the `---`) with:

```markdown
# SenAnnotate

A Chrome extension that turns "fix the blue button in the sidebar" into a report your
AI coding agent can act on without guessing.

Click any element on **any** website, type a note, and copy structured Markdown naming
the element, its DOM path, a re-resolvable selector, and — with diagnostics on — the
console errors, failed requests and steps that led there. No `npm install`, no code in
your bundle: it works on local dev, staging and production, on any stack.

When the page happens to be a Vue app, the report gains two more lines for free: the
component ancestry and the `.vue` file that rendered the element. Nothing requires it.

It began as a Vue-native take on [`agentation`](https://github.com/benjitaylor/agentation),
which does the same job for React as an npm component you import into your app.
```

Then update the bridge attribute reference at line 137 to `data-senannotate-probe`, and the `npm run pack` output name at line 150 to `senannotate-<version>.zip`.

Keep the architecture section, the source-resolution strategy table, and the production-build measurements table — all still accurate. In the "Supported" line, reframe Vue 2/3 and Nuxt 2/3/4 as what the *component detection* supports, not what the extension supports.

- [ ] **Step 9: `TESTER-GUIDE.md`**

Retitle line 1 to `# SenAnnotate — hướng dẫn cho tester`. Update the zip filename at line 10 to `senannotate.zip` and the extension name in the reload instruction at line 22.

Then add this note near the install section:

```markdown
> **Nếu bạn đã cài bản Vuetation cũ:** các note đã lưu sẽ không hiện lại sau khi cập
> nhật, vì extension đổi namespace lưu trữ. Copy report bạn cần giữ ra ngoài trước khi
> cập nhật. Từ bản này trở đi các note vẫn được giữ qua reload như bình thường.
```

- [ ] **Step 10: Delete the stale artefact**

```bash
rm vuetation-0.1.0.zip
```

- [ ] **Step 11: Verify nothing is left**

```bash
grep -rni "vuetation" . --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git
```

Expected: no output.

- [ ] **Step 12: Full check, then commit before the directory move**

```bash
npm run typecheck
npm run test
npm run build
```

Expected: clean, `46/46 checks passed`, four bundles.

```bash
git add -A
git commit -m "chore: rebrand manifest, package and docs to SenAnnotate 0.2.0"
```

- [ ] **Step 13: Rename the directory**

```bash
cd /Users/thangnm/Documents/Works/others
mv vuetation senannotate
cd senannotate
git log --oneline | head -3
```

Expected: the history is intact — `.git` lives inside the directory and moves with it.

**From here on the project path is `others/senannotate`.**

---

### Task 9: Manual verification against real sites

The suite proves the fixtures work. It cannot prove the tool behaves sensibly on the actual web, which is the whole point of this change.

**Files:**
- Modify: `changelog.md` (at the monorepo root, not in the project)

- [ ] **Step 1: Rebuild and reload**

```bash
npm run build
```

Then reload the unpacked extension at `chrome://extensions` and **hard-reload** any open tab. The bridge channel names changed in Task 1, so a stale MAIN-world script from an earlier load will never answer a freshly built content script — the symptom is component data silently vanishing on a page that had it.

- [ ] **Step 2: Verify on two or three real non-Vue sites**

Pick one React SPA and one plain server-rendered page. On each, confirm:
- no stack badge in the toolbar
- hover highlights elements and clicking opens the composer
- the copied report contains **no** `Stack:` line and the string `Vue` appears nowhere
- element name, `Location:` DOM path and `Feedback:` are all present and correct

- [ ] **Step 3: Verify the Vue path has not regressed**

Start `storefront_v5`:

```bash
cd /Users/thangnm/Documents/Works/storefront_v5
TMPDIR=/tmp/short npx nuxt dev
```

The `TMPDIR` override is required, not optional: Nuxt's vite-node unix socket path otherwise exceeds macOS's 104-byte limit, the socket silently fails to bind, and every request 500s.

Then annotate an element and confirm the report still resolves a real `.vue` file and the component ancestry — matching v0.1.0 behaviour.

- [ ] **Step 4: Produce the distributable**

```bash
cd /Users/thangnm/Documents/Works/others/senannotate
npm run pack
ls *.zip
```

Expected: `senannotate-0.2.0.zip`.

- [ ] **Step 5: Record what actually happened**

Fill in the `### Build` section of `changelog.md` — replacing the `_Not started._` placeholder — with what was done, what the final check count was, and **anything that turned out differently from this plan**, including any icon-geometry tuning and whether the warn pill needed the `⚠` glyph.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "docs: record the SenAnnotate rebrand build log"
```

Note the task docs sat at the monorepo root, outside this git repository, so they were not covered by that commit — merely saved.

> Superseded after the fact: once the project gained a GitHub remote, those docs were copied in beside this file and their cross-references rewritten to be repo-relative. See `README.md` in this directory.

---

## Risks

- **The icon rasteriser is the only real unknown.** Everything else is find-and-replace or a small conditional. If the arc-union approach fights back, the fallback is to approximate the "S" as a many-vertex polygon and keep the original `inside()` test — worse code, same output, unblocks immediately.
- **`--vt-` → `--sa-` is a blind sweep across a ~640-line stylesheet.** A missed token does not error; it resolves to nothing and the element silently loses its colour. Task 2 step 7 greps for exactly this.
- **Renaming the bridge channels breaks stale loads.** During development, always hard-reload the page after reloading the extension, not just the extension.
- **The e2e suite needs a headed Chromium**, so it cannot run on a headless box. If `npm run test` cannot launch, do not proceed past Task 1 on trust — that suite is the only regression net this project has.
