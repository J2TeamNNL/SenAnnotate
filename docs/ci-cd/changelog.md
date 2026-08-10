# Changelog — CI/CD

## 2026-08-10

### Brainstorm & spec

Wrote `brief.md`, `context.md`, `plan.md`.

Decisions taken:

| Question | Decision |
|---|---|
| What "release" means | GitHub Release with the packed zip attached |
| Trigger | Push a `v*.*.*` git tag |
| Run e2e in CI? | **No** — it cannot run on a bare runner (see below) |
| Tag ≠ `package.json` version | Hard failure, before install |
| Version source of truth | `package.json`; `build.mjs` stamps `dist/manifest.json` |
| CI artifact | Yes, zip uploaded on every run, 14-day retention |
| Node | 22 in CI to match local `v22.22.0`; `engines: >=20` as the recorded floor |

Two findings from reading the code that shaped the design rather than just filling it in:

1. **The e2e suite cannot run on a GitHub runner, by construction.** `test/e2e.mjs:29-30`
   resolves Playwright from `../../storefront_playwright_test` and Vue from
   `../../storefront_v5/node_modules/`, and `test/build-prod-fixtures.mjs:26` reaches for
   `../../../storefront_v5`. A runner clones only this repo, so those paths are absent and
   the suite fails before launching a browser. It also needs a *headed* Chromium. So CI
   verifies typecheck/build/pack and the suite stays a manual pre-tag gate — stated
   explicitly in `context.md` so this reads as a known limitation with a documented fix
   path, not an oversight.

2. **The version is stored twice with nothing reconciling them.** The zip's *filename*
   comes from `package.json` (`scripts/pack.mjs`), while the manifest *inside* it comes
   from `static/manifest.json`, copied verbatim by `build.mjs`'s `copyStatic()`. They
   agree at `0.2.0` today only because they were hand-edited together. Bump one and the
   shipped artifact is internally inconsistent — invisible unless someone opens the zip.
   Fixing this became part of the task rather than a follow-up, since a release pipeline
   built on top of that ambiguity would just automate shipping the wrong number.

One deviation from what was presented conversationally: Node **22**, not 20. Nothing here
requires either, and matching the local version removes a divergence class for free; the
`engines` floor stays at `>=20` because 20 genuinely suffices.

### Build

_Not started._
