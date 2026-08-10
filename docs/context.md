# Context — SenAnnotate

Predecessor docs: `history/vuetation/` — the original Vuetation design, the
port map from `benjitaylor/agentation`, and the reasoning behind the three-world
split. **Kept unedited as history.** Everything there about architecture still holds;
this document records only what the generalisation changes.

## Why the architecture does not change

The three-world split (MAIN inspector ↔ ISOLATED content ↔ service worker) exists
because a content script cannot see `element.__vueParentComponent` — Chrome gives each
isolated world its own view of expando properties on DOM nodes. That constraint is
unchanged, and Vue detection is being kept, so all three worlds stay.

What is being generalised is presentation, not capability. Verified before deciding:

| Concern | Already framework-agnostic? |
|---|---|
| `src/content/identify.ts` element naming / selector / path | ✅ ported near-verbatim from agentation |
| `src/inspector/diagnostics.ts` console, network, action trail | ✅ no Vue reference beyond a log prefix |
| `src/inspector/freeze.ts` CSS + WAAPI + video + timers | ✅ no Vue reference beyond a log prefix |
| `src/content/screenshot.ts`, `capture.ts`, `clipboard.ts` | ✅ |
| `src/shared/output.ts` | ⚠️ optional-chains every Vue field, but hardcodes `"Vue not detected"` |
| `src/content/ui/toolbar.ts` | ⚠️ warns when Vue is absent |

So the work is a rename plus two small behaviour fixes — not a rewrite.

## Decision: keep the `Vue*` type names

`PageVueInfo`, `VueElementInfo`, `VueMajor`, `VueFlavour` in `src/shared/types.ts`
stay as they are. Vue is the only detector that exists; renaming them to
`PageFrameworkInfo` etc. would name a generalisation that has not been built and would
touch `protocol.ts`, `output.ts`, `toolbar.ts` and `inspector/` for no behavioural
gain.

**If a second detector is ever added**, these are the seams to widen:
- `src/shared/types.ts:33-88` — the `Vue*` result types
- `src/shared/protocol.ts:50-51` — `BridgeResult` `detect` / `inspect` variants
- `src/inspector/vue-internals.ts` — the only file that reads framework internals
  (55 of the file's Vue references live here; nothing else touches them)
- `src/shared/output.ts:35-51` `describeStack()` and `:175-181` the `**Components:**`
  / `**Owner:**` / `**Props:**` / `**Scope IDs:**` lines

## Rename surfaces — verified by grep, not assumed

`NS` in `src/shared/protocol.ts:17` is the only cascading source. Everything else is an
independent literal.

### Derived from `NS` (one edit)

`src/shared/protocol.ts:17` — `export const NS = "vuetation"` feeds:
- `BRIDGE_REQUEST` / `BRIDGE_RESPONSE` / `BRIDGE_EVENT` channel strings
- `PROBE_ATTR` → `data-vuetation-probe`
- `UI_ATTR` → `data-vuetation-ui`

### Independent literals in `src/` (8 files, 18 lines)

| File | Lines | What |
|---|---|---|
| `content/storage.ts` | 15, 16 | `ANNOTATION_PREFIX`, `SETTINGS_KEY` |
| `popup/index.ts` | 15, 16 | **the same two constants, duplicated** |
| `inspector/freeze.ts` | 19 | `STYLE_ID = "vuetation-freeze-styles"` |
| `inspector/freeze.ts` | 134, 189, 190 | `video.dataset.vuetationWasPlaying` |
| `inspector/freeze.ts` | 158 | `console.warn` prefix |
| `inspector/diagnostics.ts` | 264, 274, 282 | `__vuetation` XHR meta property |
| `inspector/diagnostics.ts` | 318 | `console.warn` prefix |
| `inspector/index.ts` | 107 | `console.warn` prefix |
| `content/index.ts` | 59, 62, 63 | `window.__vuetationInstalled` |
| `content/index.ts` | 413 | screenshot filename `vuetation-<ts>.png` |
| `content/ui/styles.css` | 2 | header comment |
| `content/ui/styles.css` | throughout | `--vt-*` token prefix |

### Outside `src/`

- `static/manifest.json` — `name` (3), `description` (5), `action.default_title` (14),
  `commands.toggle-inspect.description` (48)
- `static/popup.html` — `<title>` (5), `<h1>` (218)
- `package.json`, `package-lock.json` (2 occurrences)
- `scripts/pack.mjs` — comment (5), `const name` (27)
- `.gitignore` — `vuetation-*.zip` (line 4)
- `README.md` (1, 137, 150), `TESTER-GUIDE.md` (1, 10, 22)
- Test fixtures, `<title>` only: `test/fixtures/{plain,buggy,vue2-app,vue3-app,vue3-tracer}.html`,
  `test/prod-app/index.html`. `test/fixtures/vue3-app.html:86` also has body copy.
- `test/e2e.mjs:97` — temp-profile directory prefix

`test/fixtures/prod/{stock,devtools,tracer}/index.html` are **generated** from
`test/prod-app/index.html` by `test/build-prod-fixtures.mjs` and are gitignored —
fixing the source fixes all three on rebuild.

### Consolidation fix (in scope)

The storage-key constants are declared identically in `src/content/storage.ts:15-16`
and `src/popup/index.ts:15-16`. A rename is exactly the moment two copies drift, so
they move to `src/shared/protocol.ts`, derived from `NS`, and both call sites import
them.

The remaining literals (`dataset.*`, `window.__*Installed`, `STYLE_ID`) stay literals:
deriving a `dataset` property name from `NS` means fighting the camelCase ↔ kebab-case
mangling for no real benefit.

## Storage keys: rename, do not migrate

`vuetation:page:*` → `senannotate:page:*`, `vuetation:settings` → `senannotate:settings`.
Existing stored annotations become orphaned and are **not** carried over. Annotations
are per-review-session scratch data; a one-shot migration path would be temporary code
someone has to remember to delete. `TESTER-GUIDE.md` gains one line telling testers
their old notes will not appear after updating.

Orphaned `vuetation:*` keys are left in `chrome.storage.local` rather than deleted —
deleting keys under the old namespace would mean shipping exactly the throwaway
migration code this decision avoids. They are a few KB and invisible.

## Brand

### Colour

Current tokens, `src/content/ui/styles.css:13-15`:

```css
--vt-accent: #41b883;        /* Vue green */
--vt-accent-strong: #35a372; /* hover, stack-badge text */
--vt-accent-ink: #04150d;    /* text/icons ON accent */
```

New:

```css
--sa-accent: #f97316;        /* orange-500 */
--sa-accent-strong: #ea580c; /* orange-600 */
--sa-accent-ink: #431407;    /* orange-950 — 5.48:1 on accent, passes WCAG AA */
```

White was rejected for `accent-ink`: white on `#f97316` is 2.85:1, which fails AA.
`#431407` computes to 5.48:1.

Rationale for orange over another hue: most web UI is blue, so orange markers and
highlights stay legible as *the tool's* chrome rather than blending into the page
being reviewed.

**Known adjacency to verify visually.** The stack badge's warning state
(`styles.css:166-172`) uses amber — `#f59e0b` at 18% as background, `#b45309` text,
`#fbbf24` in dark mode. With an orange accent, `--sa-accent-strong` (`#ea580c`) and
that amber sit close in hue. They differ structurally (the warn state has a background
tint, the normal state does not) and the badge only ever renders one state at a time,
but the badge is adjacent to the orange brand icon in the toolbar. If the warn pill
stops reading as a warning during step 6 of the plan, the fix is to differentiate by
**form, not hue** — add a `⚠` glyph to the pill. Do not re-tint it red; `#e5484d` is
already the destructive colour (`styles.css:450-452`, `630`) and a stripped production
build is a degraded capability, not an error.

### Icon

Two independent surfaces.

**In-page toolbar SVG** — `src/content/ui/dom.ts`. Add an `s` entry to `PATHS` as a
stroked path matching the rest of the set (the `icon()` helper already applies
`stroke-width: 1.8`, `stroke-linecap: round`). `src/content/ui/toolbar.ts:52` changes
`icon("vue", 17)` → `icon("s", 17)`. The `if (name === "vue")` fill special-case at
`dom.ts:109-112` is deleted — with the Vue mark gone, nothing needs it.

**Extension PNGs** — `scripts/make-icons.mjs`. This is the only non-mechanical part of
the whole task. The existing rasteriser is a scanline fill over a ray-casting
`inside(polygon, x, y)` test with 4× supersampling, driven by the `OUTER` / `INNER`
polygon arrays of the Vue chevron. An "S" is curved, so polygons are the wrong
primitive.

Generalise the sampler from `inside(polygon, …)` to a predicate
`(x, y) => [r,g,b,a] | null`, then express the mark as:

- **Badge**: rounded square inset by `PADDING_RATIO`, corner radius ≈ 22% of size,
  filled `#f97316`. A badge rather than a bare glyph because a hairline S on
  transparent disappears at 16px against both light and dark browser chrome.
- **Glyph**: an "S" in `#431407`, built as the union of two circular arcs —
  - glyph height `H` ≈ 56% of the badge, width ≈ 0.62·`H`, stroke `w` ≈ 0.15·`H`
  - upper arc: centre `(cx, cy − r)`, lower arc: centre `(cx, cy + r)`, `r = H/4`
  - an arc contributes where `|distance(p, centre) − r| ≤ w/2` **and** the angle falls
    in that arc's kept range (upper opens toward the lower-right, lower toward the
    upper-left)
  - round caps: union with discs of radius `w/2` at each of the four arc endpoints

  Exact angle ranges need visual tuning at 16px; treat the numbers above as the
  starting point, not the answer.

Keeps the "zero runtime **and** zero build dependencies beyond esbuild + typescript"
constraint — `node:zlib` is still all the encoder needs.

## Behaviour change: no-framework pages

Two call sites, both currently assuming a Vue-only audience.

**`src/content/ui/toolbar.ts:136-174` `applyStackBadge(page)`** — today:
`!page` hides the badge; `!page.detected` shows an amber warn pill reading
"No Vue detected"; otherwise a label, warned if `!devMetadata`.

New: `!page.detected` **hides the badge entirely**. The absent-framework case is now
the common case and carries no actionable information — the report simply has no
`Components:` line. The amber warn state survives only for its real meaning: a
framework *was* found but its metadata is stripped, so the user has a concrete fix
(turn devtools on).

**`src/shared/output.ts:35-51` `describeStack()`** — returns `"Vue not detected"`
when nothing is found, and callers at `:141` (forensic `- Stack:`) and `:150`
(standard `**Stack:** … · **Viewport:** …`) always emit it. New: when nothing is
detected, omit the `Stack:` line and keep `Viewport`. The standard-detail line becomes
`**Viewport:** 1512×860` alone.

## Constraints carried over

- `world: "MAIN"` content scripts need **Chrome 111+** (`minimum_chrome_version`).
- MV3 content scripts are not ES modules — `src/content` and `src/inspector` each
  bundle to a single IIFE via esbuild; service worker and popup are ESM.
- Chrome rejects SVG in `manifest.icons`, hence the PNG generator.
- Neither the surrounding workspace nor the project itself is a git repository,
  so nothing in this task can be committed. Docs are written, not committed.

## Test baseline

`npm run test` builds, then drives a **headed** Chromium against the fixtures.
Measured on 2026-08-10 before any change: **45/45 checks pass**.

(`history/vuetation/changelog.md` says "20/20" — true when written on 2026-08-07,
but the suite has grown since. Verified by running it, not by reading the old note.)

Prerequisites, all present and confirmed: `node_modules`, Playwright with its browsers,
a Vue 3 global build (vendored into `test/fixtures/vendor/`), and the generated
`test/fixtures/prod/*` bundles. The runner builds the prod fixtures itself on first run.
None of the three are dependencies of this package — see `test/e2e.mjs` for how they are
supplied.

One check encodes the behaviour being deliberately changed:

```js
// test/e2e.mjs:443-444
const plainBadge = (await plain.locator(".stack-badge").textContent())?.trim() ?? "";
check("non-Vue pages say so", plainBadge === "No Vue detected", `badge read "${plainBadge}"`);
```

That assertion must be **rewritten**, not preserved. "All 45 still pass" is therefore
not the right success condition — see `plan.md` step 5.

Untouched by the badge change, and must keep passing as-is:
`e2e.mjs:120-122` (Vue 3 detected + versioned), `:126-130` (dev build not mislabelled
production), `:251-252` (Vue 2 detected), `:379` (production-variant badges).
