# Brief — CI/CD for SenAnnotate

## What

Two GitHub Actions workflows, plus one change to `build.mjs`:

- **`ci.yml`** — on every push and PR to `main`: install, typecheck, build, pack, and
  upload the resulting zip as a downloadable workflow artifact.
- **`release.yml`** — on pushing a `v*.*.*` tag: verify the tag matches
  `package.json`'s version, build, pack, and publish a GitHub Release with the zip
  attached.
- **`build.mjs`** — stamp `dist/manifest.json`'s `version` from `package.json`, making
  `package.json` the single source of truth for the version that actually ships.

## Why

1. **Releases are hand-delivered today.** Getting a build to a tester means running
   `npm run pack` locally and sending them a zip. A GitHub Release means they fetch it
   themselves from a URL that does not expire.
2. **Nothing currently checks a push.** There is no `.github/` directory. A commit that
   breaks `tsc` or the build reaches `main` unnoticed until someone builds by hand.
3. **The version lives in two places that nothing keeps in sync.**
   `package.json` and `static/manifest.json` both say `0.2.0` today, but only because
   they were edited together by hand. `build.mjs` copies `static/` verbatim, so bumping
   one and forgetting the other ships a zip whose filename and whose manifest disagree.

## Scope

**In:**
- The two workflows and the `build.mjs` version stamp
- Tag-vs-`package.json` mismatch is a hard failure, not a warning
- CI artifact retention: 14 days
- `"engines": { "node": ">=20" }` in `package.json`, so the Node floor is stated once
- A short "Releasing" section in `README.md` — the tag-must-match rule is a trap
  otherwise

**Out (deliberately):**
- **Running the Playwright e2e suite in CI.** It resolves Playwright and Vue 3 out of
  sibling monorepo directories that do not exist in a bare checkout — see `context.md`.
  The suite stays a manual gate before tagging, which is how it is used today.
- Chrome Web Store publishing. The distribution model is Load-unpacked-from-zip.
- A Node version matrix. One version, matching local development.
- Writing a changelog file into the repo. GitHub's generated release notes are enough.
- Branch protection rules, required status checks, or anything configured through the
  GitHub web UI rather than in the repo.

## Success criteria

1. Pushing a commit to `main` runs `ci.yml`; it goes green and the run page offers
   `senannotate-<version>.zip` for download.
2. A commit that breaks `tsc` turns `ci.yml` red.
3. `git tag v0.2.1 && git push --tags` — with `package.json` already at `0.2.1` —
   produces a GitHub Release named `v0.2.1` with the zip attached.
4. Pushing tag `v9.9.9` while `package.json` says something else fails the workflow
   **before** any release is created.
5. The `manifest.json` inside the shipped zip carries the same version as
   `package.json`, without `static/manifest.json` having been touched.
