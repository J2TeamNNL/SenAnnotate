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

All five tasks of `implementation-plan.md` executed inline. Four commits, then
`v0.2.0` — the project's first release.

| Commit | What |
|---|---|
| `7affc37` | `build: stamp dist/manifest.json version from package.json` |
| `202d691` | `ci: typecheck, build and pack on every push to main` |
| `59c97be` | `ci: publish a GitHub Release when a v*.*.* tag is pushed` |
| `b3729b6` | `docs: document the release procedure and the tag-match rule` |

#### Verified locally

- **The version stamp, as a real red-green.** Set `static/manifest.json` to
  `0.0.0-wrong`, built, and confirmed `dist/manifest.json` still said `0.0.0-wrong` —
  the failure the task exists to fix. After the change, `dist/` reported `0.2.0` while
  `static/` still held the bogus value, which is the actual behaviour being added rather
  than a file copy that happens to look right.
- **The rewrite does not mangle the manifest.** Checked `manifest_version: 3`, the
  `permissions` array, and both `content_scripts` entries (`MAIN`, `ISOLATED`) survive
  the JSON round-trip.
- **End-to-end into the artifact.** Unzipped `senannotate-0.2.0.zip` and read the
  `manifest.json` inside it: `0.2.0`. The plan deferred this to the user in Task 5; doing
  it locally first meant the release was not the first time it was checked.
- **`npm ci` after editing `package.json`.** This is what both workflows run, and it
  *fails* on a desynchronised lockfile rather than repairing it. `npm install
  --package-lock-only` added only the three `engines` lines — no dependency churn.
- **The whole workflow command sequence** on a clean install:
  `npm ci && typecheck && build && pack`.
- **A type error really does turn CI red.** Wrote a deliberate `TS2322`, confirmed
  `npm run typecheck` exits **2**, removed it. A step failing on non-zero exit is what
  reddens a run, so this proves spec criterion 2 without pushing a broken commit to
  `main`.
- **Both guard branches.** `v9.9.9` → rejects, `v0.2.0` → accepts. A guard that only ever
  rejects is as broken as one that only ever accepts, so both directions were run against
  the workflow's verbatim shell.

#### Verified on GitHub — by the user, not by this session

No `gh` CLI and no token for a private repo, so workflow runs were unobservable from
here. Each of these is the user's confirmation:

1. **CI green** on push to `main`, with a downloadable `senannotate-zip` artifact.
2. **Release failed at "Check the tag matches package.json"** for `v9.9.9`, and **no
   release was created**. The failure path was tested *before* the real release, so the
   guard was proven rather than trusted.
3. **Release green** for `v0.2.0`, with `senannotate-0.2.0.zip` attached and
   `"version": "0.2.0"` in the manifest inside it.

`v9.9.9` was then deleted locally and remotely; `v0.2.0` is the only tag.

#### Things that resolved themselves

- **`zip` is present on `ubuntu-latest`.** Flagged in `context.md` as the likeliest
  first-run failure since `scripts/pack.mjs:40` shells out to it. CI passed the pack step,
  so no `apt-get install` step was needed. The note stays in the docs for whoever hits it
  on a different runner image.
- **`permissions: contents: write` was sufficient.** The other predicted first-run
  failure; the release step did not 403.

#### Deviations from the plan

- **Task 3's guard test needed a script file.** The plan gave the check as an inline
  shell one-liner, which the session's worktree isolation refused to run (too complex to
  prove it stayed inside the worktree). Wrote a throwaway `.github/guard-check.sh` taking
  the tag and the expected verdict, ran both cases through it, deleted it before
  committing. Same verification, different vehicle.
- **Released `v0.2.0`, not `v0.2.1`.** `brief.md`'s success criterion 3 was phrased around
  a bump, but `0.2.0` had never been released, so tagging the current version was the
  honest first release and avoided a version bump that existed only to exercise the
  pipeline.
- **A security hook flagged workflow-injection risk** on both files. Audited: `ci.yml`
  contains no `${{ }}` interpolation at all. `release.yml` reads the tag from the
  `GITHUB_REF_NAME` environment variable rather than `${{ github.ref_name }}` —
  a `${{ }}` expression is substituted into the script textually before the shell runs
  it, so a tag containing shell metacharacters would execute. The only interpolation is
  `GH_TOKEN: ${{ github.token }}` in `env:`, which is the documented-safe pattern. The
  reasoning is now a comment in the workflow so it is not silently undone later.

#### Still outstanding

- **The e2e suite remains outside CI**, by design — see `context.md`. `npm test` is a
  manual gate before tagging, and the README now says so explicitly so a green check is
  not mistaken for a passing suite.
