# Changelog — SenAnnotate

## 2026-08-10

### Brainstorm & spec

Reviewed `Blaked84/agentation-vue` (the Vue port of `agentation`, packaged as an NPM
component plus its own Chrome extension) at the user's request, then pivoted: the goal
is a Chrome extension that works on **every** website with no framework assumption.

Found that `others/vuetation` — built 2026-08-07, documented in
`history/vuetation/` — already satisfies that technically:

- `static/manifest.json` declares `<all_urls>` for both content scripts
- every Vue-derived field in `src/shared/output.ts` is optional-chained
- `test/e2e.mjs` already drives a `plain.html` no-framework fixture, and it passes

So this is a rebrand plus two behaviour fixes, not a rebuild. Decided **against**
starting a new project or stripping Vue detection out.

Decisions taken during the brainstorm:

| Question | Decision |
|---|---|
| New project or generalise in place? | Generalise `others/vuetation` in place |
| Remove Vue detection? | No — keep it as an optional enhancement, 3-world architecture intact |
| Name | **SenAnnotate** (from Vuetation) |
| Icon | "S" monogram replacing the Vue mark |
| Accent colour | Orange `#f97316` family, replacing Vue green `#41b883` |
| CSS token prefix | `--vt-*` → `--sa-*` |
| Storage keys | Rename; **no** migration, old annotations are dropped |
| `Vue*` type names | Keep — Vue is still the only detector (YAGNI) |
| Version | 0.2.0 |

Two findings during the design pass that changed the shape of the work:

1. **The storage-key constants are declared twice** — `src/content/storage.ts:15-16`
   and `src/popup/index.ts:15-16` hold identical literals. A rename is precisely when
   two copies drift, so consolidating them into `shared/protocol.ts` (derived from `NS`)
   became part of the task rather than a nice-to-have.

2. **An existing e2e assertion encodes the behaviour being changed.**
   `test/e2e.mjs:444` asserts `plainBadge === "No Vue detected"`. Since the plan hides
   that badge on non-framework pages, "all checks still pass" is the wrong success
   condition — that check has to be rewritten, not preserved. Caught before writing the
   plan rather than during implementation.

Ran the suite to establish the baseline rather than trusting the old note: **45/45 pass**
at v0.1.0. `history/vuetation/changelog.md` records "20/20", which was true on
2026-08-07 but the suite has grown since. Spec corrected to 45.

Also noted, and deliberately accepted: with an orange accent, `--sa-accent-strong`
(`#ea580c`) sits close in hue to the stack badge's amber warning state (`#f59e0b` /
`#b45309`). They differ structurally and never render simultaneously, but the badge is
adjacent to the orange brand icon. Flagged as a visual check in plan step 6 with a
form-based fix (`⚠` glyph) rather than pre-emptively re-tinting anything.

Wrote `brief.md`, `context.md`, `plan.md`. `history/vuetation/` left unedited as
history.

> Neither `Works` nor `others/vuetation` is a git repository, so none of this is
> committed — the files are simply written.

### Build

Executed `implementation-plan.md` inline. Project is
now `others/senannotate`, version 0.2.0, on branch `feature/senannotate-rebrand`.

Put the project under git first (it had no version control at all) so a wide
find-and-replace sweep had an undo. Baseline commit `592a9bb`, then eight commits.

**Test suite: 45/45 → 46/46.** One check rewritten by design (`non-Vue pages say so` →
`non-framework pages show no stack badge`), one added (`non-framework reports omit the
Stack line and never mention Vue`). Both written failing first.

#### Four surfaces the plan missed

Found while executing, all fixed:

1. **The accent green lived in three places, not one.** `styles.css` is only the
   shadow-root UI. `src/background/index.ts:12` had its own `ACCENT` for the Chrome
   action badge, and `static/popup.html:8-9` its own `--accent` / `--accent-ink` — the
   popup is a separate document, not in the shadow root.
2. **The Vue logo was also inlined in the popup header** as raw chevron `<path>` data
   (`popup.html:214-217`), independent of the `PATHS` map in `dom.ts`.
3. **`Alt+Shift+V`** — the `V` stood for Vuetation. Changed to `Alt+Shift+S` across the
   manifest's `suggested_key`, the toolbar tooltip and the popup hint. Safe to change:
   it is a *suggested* key users can rebind, and testers get a fresh install anyway
   since their stored notes are already being dropped.
4. **`TESTER-GUIDE.md` described the icon** as "Icon chữ V màu xanh" — a green V.

The generated `test/fixtures/prod/*/index.html` also still carried the old `<title>`.
They rebuild from `test/prod-app/index.html` only when `prod/tracer/app.js` is absent,
so they were patched in place rather than regenerated.

#### The warn pill did need the ⚠ glyph

The adjacency risk flagged in `context.md` turned out to be real. Screenshotted the
toolbar against a stock production Vue fixture: with an orange brand icon beside it, the
amber pill reads as a neutral info chip rather than a warning. Applied the planned fix —
differentiate by form, not hue.

Implemented as a `::before` pseudo-element rather than by prefixing `textContent`,
because three e2e assertions read that text (`e2e.mjs:122`, `:252`, `:398`). Keeps the
warning presentational and the assertions untouched.

#### Icon geometry needed no tuning

The two-tangent-arc construction worked at the first set of values
(`GLYPH_H 0.56`, `STROKE 0.19·H`, `MARGIN 0.06`, `CORNER 0.24`). Verified by decoding
the generated PNGs and upscaling them nearest-neighbour — 16px reads unambiguously as an
S. The plan's fallback (polygon approximation) was not needed.

#### Verification

Beyond the suite, two throwaway Playwright scripts drove the built extension in a real
headed Chromium (kept in the session scratchpad, not committed):

- **Real websites, 9/9 checks.** `example.com` (plain HTML) and `react.dev` (React, with
  its own CSP): toolbar injects, **no** stack badge, annotating works, and the report is
  `**Viewport:** 1280×800` with no `Stack:` line and no occurrence of "Vue". This is the
  actual claim of the rebrand, so it was worth automating rather than eyeballing.
- **Real Vue app — no regression.** Checked against a **seller_v3** dev server
  (Nuxt 4 / Vue 3) that was already running on `:3000`, rather than booting
  `storefront_v5` as the plan said — a second Nuxt was unnecessary. Result:
  badge `Nuxt 3/4 3.5.40` (no warning), `**Source:** app/layouts/auth.vue`,
  `**Components:** <nuxt-root> <LayoutLoader> <auth>`, `**Stack:** … · pinia`, plus
  repro steps and console capture. No line/column, which is expected: seller_v3 runs
  `devtools: { enabled: false }`, so the tracer is absent.

`npm run pack` → `senannotate-0.2.0.zip` (33.8 KB).

#### `file:line:column` confirmed against the real tracer

Followed up on `storefront_v5` (Nuxt 4.4.7 / Vue 3.5.35, `devtools: { enabled: true }`,
`vite-plugin-vue-tracer@1.3.0`). **6/6 checks.** This is the path v0.1.0 originally got
wrong — it looked for `data-v-inspector` attributes that current Nuxt no longer emits and
fell back to file-level silently — so it was verified by reading the plugin's actual
global store from the page, not just by pattern-matching the output:

```
globalThis.__vue_tracer__ → { hasData: true, vnodeToPos, fileToVNode(37 files), posToVNode, events }

hover:  <SImage>layers/02.baseComponent/components/s/image.vue:68:4
report: **Source:** layers/02.baseComponent/components/s/image.vue:68:4
        **Components:** <index> <BaseProductCarousel> <EmblaCarousel> <BaseProductItem> <NuxtLink> <SImage>
```

Strictly better than the v0.1.0 result recorded above in
`history/vuetation/changelog.md`, which reached only `components/s/image.vue`
with no line or column.

Two operational notes worth keeping:

- **The earlier boot failure was not the `TMPDIR` bug.** `npx nuxt dev` under the RTK
  shell wrapper stayed alive while writing nothing to its log. Invoking the local binary
  directly — `TMPDIR=/tmp/nx ./node_modules/.bin/nuxt dev --port 3005` — booted in ~20s.
  The `TMPDIR` override is still required; it just was not the cause that time.
- **`sourcemap: { client: false }` does not break the tracer in dev.** The README's
  sourcemap requirement applies to *production* builds only, where the tracer maps
  generated positions back through the upstream map. Dev works without it, as proven by
  the `:68:4` above.

#### The verify scripts are now part of the repo

Promoted out of the scratchpad into `test/`, commit `39b013f`:

| Script | npm script | Needs | Result from its new home |
|---|---|---|---|
| `test/verify-real-sites.mjs` | `verify:sites` | network | 8/8 |
| `test/verify-tracer.mjs` | `verify:tracer` | a running Nuxt dev server | 7/7 |

Sharing `test/verify-harness.mjs`. Both were re-run **after** the move, not just
copied — they had absolute paths baked in, including a session-scoped screenshot
directory that would have vanished. Paths now resolve relative to the file, the way
`e2e.mjs` does it. Screenshots go to `test/screenshots/` (gitignored).

Deliberately **not** wired into `npm test`, which must stay hermetic and always-green;
and `e2e.mjs` deliberately does not use the new harness — it is the only regression net
in the project and stays self-contained rather than gaining a dependency on a module
written for scripts that need network and a dev server.

Two robustness fixes applied during the move: `verify-tracer` now fails with a legible
message when the dev server is unreachable (rather than a bare `ECONNREFUSED`) or when
no candidate element is hoverable, and asserts the tracer recorded more than one file so
an empty store cannot pass.

`npm test` re-confirmed at 46/46 afterwards.

#### Still outstanding

- **Nobody has looked at the extension in a browser they were driving by hand.** Every
  visual check in this log was a screenshot from an automated run. Worth a few minutes of
  real clicking before handing the zip to testers.

Branch `feature/senannotate-rebrand` was merged fast-forward into `main` (46/46 on the
merged tree) and deleted. There is no remote.
