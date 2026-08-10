# Changelog — Framework detectors

## 2026-08-10

Delivered as 0.3.0. **46/46 → 60/60 e2e.**

| Commit | What |
|---|---|
| `test:` | locate the monorepo by walking up, not by counting `../` |
| `refactor:` | make framework detection pluggable, Vue as the first detector |
| `feat:` | detect React, Svelte and Angular alongside Vue |

### The suite could not run at all from a worktree

Found before writing any code, by checking rather than assuming. `test/e2e.mjs` located
Playwright with a **fixed** number of `../` segments, which resolves correctly only from
the project root — from a git worktree under `.claude/worktrees/` it landed two levels
wrong and the suite died before launching a browser. The only regression net for a wide
refactor was unavailable in the environment the refactor had to happen in.

Fixed by searching upward for a known anchor directory instead of counting segments.
**The first attempt was wrong**: the anchor chosen was a name that existed *twice* in the
tree, and the upward search found the nearer one — which had no `node_modules`. Only
running it surfaced that; re-anchored on a name that is unique.

> Superseded in the same release: these locations now come from environment variables
> (`SENANNOTATE_PLAYWRIGHT_DIR`, `SENANNOTATE_VUE_GLOBAL`, `SENANNOTATE_PNPM_STORE`), so
> there is no path search left to get wrong. The episode is kept because the lesson —
> a fixed-depth relative path is a latent bug the moment the cwd can change — is what led
> there.

### Phase 0 — the seam

No behaviour change; 46/46 unchanged throughout. Details of the two real decisions —
`inspect()` returning `null`, and merging Vue's two source fields behind a `precision`
flag — are in `context.md`, because both are load-bearing for every later phase.

The 0.2.0 note recording where to cut proved accurate. `vue-internals.ts` exported three
functions, so the interface was already the right shape.

### Phases 1–3 — Svelte, React, Angular

Order was deliberate: Svelte first, as the simplest possible second detector, to prove
the abstraction before React's peculiarities could bend it. It held — neither React nor
Angular needed the interface changed.

Checked the current Svelte docs via Context7 rather than trusting recall, since Svelte 5
reworked internals. It confirmed `dev: true` adds "debugging information" and that
`discloseVersion` writes the version to `window`, which is what `__svelte_meta` and
`window.__svelte.v` rest on. `__svelte_meta` itself is an internal and undocumented, so
the detector reads it defensively and the fixture pins the shape.

### Two bugs the tests caught that reading the code did not

1. **React reported every dev build as production.** `devMetadata` checked whether *one*
   fiber had a readable name — but a root fiber is usually a *host* fiber (`"div"`), which
   has no name at all. Every React page came out `devMetadata: false`. Fixed by walking up
   to the nearest composite. Surfaced only because a test asserted on the badge text.

2. **A test assertion was wrong, not the code.** The first version asserted that an
   element with no `_debugSource` of its own reports no source. It actually walks up to an
   ancestor that has one — which is correct, and matches what Vue's tracer and Svelte's
   `__svelte_meta` already do. Rewrote the assertion to pin the walk-up, and added a
   separate branch to the fixture whose *entire* chain has no `_debugSource`, so the
   genuine React 19 case is tested rather than assumed.

Also: the three new fixtures first used `class="toolbar"`, which collides with the
extension's own toolbar — Playwright pierces shadow DOM, so every locator matched two
elements. Renamed to `.app-bar`.

And the test helper had to clear stored annotations between visits: `react-app.html` is
visited three times in one browser profile, and annotations persist per origin+pathname,
so the second visit's report still contained the first visit's annotation. The same
artefact bit the 0.2.0 hand-test.

### Still outstanding

- **The three new detectors have never been run against a real app** — only against
  fixtures reproducing documented shapes. `verify:tracer` does this for Vue against a real
  Nuxt server; the equivalent for React/Svelte/Angular needs real apps to point at, and
  the monorepo has none. This is the honest gap: the detectors are proven correct *about
  the shapes*, not proven complete about every version in the wild.
- Solid, Preact, Qwik, Astro deliberately not attempted. The seam makes each a
  one-file addition now.
