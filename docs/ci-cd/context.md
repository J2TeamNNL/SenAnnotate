# Context — CI/CD

## Starting state, verified

- No `.github/` directory. This is the first CI in the project.
- No git tags. `v*` is an unused namespace, so the release trigger cannot collide with
  anything.
- `package.json` `0.2.0`, `static/manifest.json` `0.2.0` — matching, but only by hand.
- `package-lock.json` present (15.5 KB), so `npm ci` works.
- Local Node **v22.22.0**. No `engines` field, so nothing currently states a floor.
- devDependencies are only `esbuild`, `typescript`, `@types/chrome` — a fast install.

## The blocker: the e2e suite cannot run on a GitHub runner

This is the single fact that shapes the whole design, so it is worth stating precisely.

`test/e2e.mjs` deliberately does not depend on Playwright. At the time this was written it
resolved Playwright, and a Vue dev build, out of sibling directories next to the project:

```js
// test/e2e.mjs, as it stood then
const PLAYWRIGHT_HOST = resolve(ROOT, "../../<a project with playwright installed>");
const VUE_SOURCE = resolve(ROOT, "../../<a Nuxt app>/node_modules/vue/dist/vue.global.js");
```

`test/build-prod-fixtures.mjs` did the same for vite and the tracer plugin, reaching into
a sibling project's pnpm store.

A GitHub-hosted runner clones **only this repository**. Those sibling paths do not
exist, so `npm test` fails at `ensureVueFixture()` before a browser is even launched.

> Since 0.3.0 those locations come from environment variables
> (`SENANNOTATE_PLAYWRIGHT_DIR`, `SENANNOTATE_VUE_GLOBAL`, `SENANNOTATE_PNPM_STORE`)
> rather than hardcoded sibling paths. That removes the machine-specific coupling but not
> the conclusion below: a runner still has nothing to point them at.

Two further reasons it should not simply be forced to work:

- The suite requires a **headed** Chromium (`headless: false` — extensions do not load in
  the old headless shell). That needs a virtual display on a runner.
- It is the project's only regression net. Making it depend on a CI environment that
  cannot currently run it risks it quietly becoming skipped-and-forgotten.

**Decision:** CI does not run it. The suite remains the manual gate before tagging,
exactly as it is used today. The workflows verify what they *can* verify honestly —
that the code typechecks, builds, and packages.

This is a real limitation, not a preference. If someone later wants e2e in CI, the fix
is to make Playwright and Vue actual devDependencies of this repo and add
`xvfb-run` — a separate task, noted here so the reasoning is not lost.

## Version stamping

`build.mjs` has:

```js
function copyStatic() {
  cpSync(resolve(ROOT, "static"), DIST, { recursive: true });
}
```

`static/manifest.json` is copied verbatim, so its `version` is what ships. Meanwhile
`scripts/pack.mjs` names the archive from `package.json`:

```js
const { version } = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const name = `senannotate-${version}`;
```

So the zip's **filename** comes from `package.json` and the manifest **inside it** comes
from `static/manifest.json`. Nothing reconciles them. Bump one only, and you ship
`senannotate-0.3.0.zip` containing a manifest that says `0.2.0` — Chrome will show the
old version and the discrepancy is invisible until someone checks.

**Decision:** after `copyStatic()`, rewrite `dist/manifest.json`'s `version` from
`package.json`. `static/manifest.json` keeps its own value rather than being emptied, so
loading `static/` directly still yields a valid manifest; it simply stops being
authoritative for anything shipped.

## Platform notes

- `scripts/pack.mjs` shells out to two system commands: `cp` (line 37) and `zip`
  (line 40). Both are expected on `ubuntu-latest`. **`zip` is the one to confirm on the
  first CI run** rather than assume — if it is absent, the fix is one `apt-get install`
  step, or replacing the call with a Node zip implementation.
- `gh` (GitHub CLI) is pre-installed on GitHub-hosted runners, so the release step needs
  no extra action or dependency.
- **`permissions: contents: write` is required** in `release.yml`. The default workflow
  token is read-only, and creating a release without this fails with 403. This is the
  most likely first-run failure and is easy to misread as an auth problem.
- `.gitignore` already excludes `senannotate-*.zip`, so a packed artifact in the working
  tree cannot be committed by accident.

## Node version

CI will use **Node 22**, matching the local `v22.22.0`, rather than the more usual choice
of the current LTS. Reason: nothing here needs a specific version, and matching local
removes a class of "works on my machine" divergence for free. Adding
`"engines": { "node": ">=20" }` records the requirement in one place instead of only
inside a workflow file — a floor rather than a pin, because 20 genuinely suffices.

(`test/verify-harness.mjs:86` uses `fetch` and `AbortSignal.timeout`, which need Node 18+
— comfortably satisfied, and not run by CI anyway.)

## Related

The rebrand that produced 0.2.0 is documented in [`../`](../) — `brief.md`,
`context.md`, `changelog.md` at the top of `docs/`.
