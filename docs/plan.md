# Plan — SenAnnotate

> **Executable version:** `implementation-plan.md`.
> That document is authoritative for implementation — bite-sized steps with the actual
> code, per-step verification commands, and a Task 0 (not listed here) that puts the
> project under git first, since Tasks 1–2 are a wide find-and-replace sweep with no
> other undo. This file stays as the strategy summary.

Target: `others/vuetation/` (renamed in place; the directory name itself also changes —
see step 8). Version `0.1.0` → `0.2.0`.

Ordering principle: the two **behaviour** changes (steps 3–4) land before the
mechanical rename sweep, so a failing test after step 5 points at the rename rather
than leaving two kinds of change tangled in one debugging session.

---

## 1. Namespace + storage-key consolidation

- `src/shared/protocol.ts:17` — `NS = "vuetation"` → `"senannotate"`.
- Add to `src/shared/protocol.ts`, derived from `NS`:
  ```ts
  export const ANNOTATION_PREFIX = `${NS}:page:`;
  export const SETTINGS_KEY = `${NS}:settings`;
  ```
- `src/content/storage.ts` — delete the local constants (lines 15-16), import them.
- `src/popup/index.ts` — delete the local constants (lines 15-16), import them.

**Verify:** `npm run typecheck` clean.

## 2. Remaining `src/` literals

- `src/inspector/freeze.ts` — `STYLE_ID` (19), `dataset.senannotateWasPlaying`
  (134, 189, 190), log prefix (158).
- `src/inspector/diagnostics.ts` — `__senannotate` XHR meta (264, 274, 282),
  log prefix (318).
- `src/inspector/index.ts` — log prefix (107).
- `src/content/index.ts` — `window.__senannotateInstalled` (59, 62, 63), screenshot
  filename (413).
- `src/content/ui/styles.css` — header comment (2), and `--vt-*` → `--sa-*` throughout.

**Verify:** `npm run typecheck` clean; `grep -rn "vuetation" src/` returns nothing.

## 3. No-framework behaviour — toolbar

`src/content/ui/toolbar.ts:136-174` `applyStackBadge()`: change the `!page.detected`
branch from "amber warn pill reading *No Vue detected*" to hiding the badge, matching
the existing `!page` branch. Leave the `!devMetadata` warn path untouched.

## 4. No-framework behaviour — report

`src/shared/output.ts`:
- `describeStack()` (35-51) — widen the return type to `string | null` and return `null`
  when `!page?.detected`, replacing the current `"Vue not detected"` string.
- Forensic caller (141): skip the `- Stack: …` line when null.
- Standard caller (150): when null, emit `**Viewport:** …` alone.

**Verify (3 + 4):** `npm run typecheck` clean.

## 5. Tests

- `test/e2e.mjs:443-444` — **rewrite**. Replace the `=== "No Vue detected"` assertion
  with: the badge is not visible on `plain.html`. Rename the check to something like
  `"non-Vue pages show no framework badge"`.
- Add a new check on the same page: copy the report and assert it contains **no**
  `Stack:` line and no occurrence of `Vue`.
- `test/e2e.mjs:97` — temp-profile prefix → `senannotate-e2e-`.
- `<title>` in `test/fixtures/{plain,buggy,vue2-app,vue3-app,vue3-tracer}.html` and
  `test/prod-app/index.html`; body copy at `test/fixtures/vue3-app.html:86`.
  (`test/fixtures/prod/*` regenerates from `test/prod-app/index.html`.)

**Verify:** `npm run test`. Baseline is **45/45** (measured 2026-08-10). Expect **46/46**
afterwards: 44 untouched, the rewritten badge check, and the new report check. If the
Vue-path checks at `:120-130`, `:251-252` or `:379` broke, the cause is step 1 or 2, not
this step.

## 6. Brand — colour

`src/content/ui/styles.css:13-15`:

```css
--sa-accent: #f97316;
--sa-accent-strong: #ea580c;
--sa-accent-ink: #431407;
```

Then **look at it**: load the unpacked extension and check the toolbar, hover
highlight, marquee, markers, composer and panel. Specifically compare the stack badge's
warn state (visit a production Vue fixture) against the orange brand icon beside it —
if the pill no longer reads as a warning, add a `⚠` glyph to it. Do not re-tint it red.

## 7. Brand — icon

- `src/content/ui/dom.ts` — add `PATHS.s` (stroked "S"); delete the
  `if (name === "vue")` fill branch at 109-112.
- `src/content/ui/toolbar.ts:52` — `icon("vue", 17)` → `icon("s", 17)`.
- `scripts/make-icons.mjs` — replace the Vue-chevron polygons with the badge + arc-based
  "S" described in `context.md`; generalise `inside(polygon, …)` into a predicate the
  sampler calls. Keep the 4× supersampling and the existing PNG encoder untouched.

**Verify:** `npm run icons`, then open the four PNGs and look at them at actual size.
16px is the one that matters — if the S is not legible there, thicken the stroke before
moving on. Then load unpacked and confirm the browser-toolbar icon reads correctly
against both a light and a dark browser theme.

## 8. Manifest, package, docs

- `static/manifest.json` — `name` → `"SenAnnotate — visual annotator for AI coding agents"`,
  `description` (5) rewritten with no Vue claim, `action.default_title` (14),
  `commands.toggle-inspect.description` (48), `version` → `0.2.0`.
- `static/popup.html` — `<title>` (5), `<h1>` (218).
- `package.json` — `name` → `senannotate`, `description`, `version` → `0.2.0`.
  Run `npm install` to update `package-lock.json` rather than hand-editing it.
- `scripts/pack.mjs` — comment (5), `const name` (27) → `senannotate-${version}`.
- `.gitignore:4` — `senannotate-*.zip`.
- `README.md` — retitle; reframe the opening so the tool is described as working on any
  site with Vue as a bonus; update the `data-senannotate-probe` reference (137) and the
  `npm run pack` output name (150).
- `TESTER-GUIDE.md` — retitle; update the zip filename (10) and the reload instruction
  (22); **add the line telling testers that notes saved by the old Vuetation build will
  not carry over.**
- Rename the directory: `others/vuetation` → `others/senannotate`.

**Verify:** `grep -rin "vuetation" others/senannotate --exclude-dir=node_modules --exclude-dir=dist`
returns nothing but the stale `vuetation-0.1.0.zip` artefact — delete that.

## 9. Full verification

1. `npm run typecheck`
2. `npm run test`
3. `npm run build`
4. **Manual, non-Vue:** load unpacked, then on two or three real sites that are not Vue
   (one React SPA, one server-rendered page) confirm: no stack badge, annotating works,
   the copied report has no `Stack:` line and never says "Vue".
5. **Manual, Vue regression:** `storefront_v5` dev server — component ancestry and
   source file must still resolve exactly as at v0.1.0. Note the `TMPDIR` workaround
   from `history/vuetation/changelog.md`: start it as
   `TMPDIR=/tmp/short npx nuxt dev`, or Nuxt's vite-node socket path exceeds macOS's
   104-byte limit and every request 500s.
6. `npm run pack` → confirm `senannotate-0.2.0.zip`.

Record what actually happened in `changelog.md` as you go — including anything that
turned out differently from this plan.

---

## Risks

- **The icon rasteriser is the only real unknown.** Everything else is find-and-replace
  or a three-line conditional. If the arc-union approach fights back, the fallback is a
  many-vertex polygon approximation of the S, which the existing `inside()` already
  supports unchanged — worse code, same output, and it unblocks immediately.
- **`--vt-` → `--sa-` is a blind find-replace across a 600-line stylesheet.** A missed
  token silently falls back to an invalid value and the affected element loses its
  colour. After step 2, grep for `--vt-` and for `var(--sa-` count parity before
  trusting the visual check.
- **The rename touches the bridge channel names**, so a stale MAIN-world script from a
  previous load talking to a freshly built ISOLATED script will simply never answer.
  Symptom during development: no component data on a page that had it a minute ago.
  Fix: hard-reload the tab after reloading the unpacked extension — not just the
  extension.
