# Releasing

## CI is not the gate

`.github/workflows/ci.yml` runs **typecheck + build + pack** on every push to `main` and
attaches the zip as a 14-day artifact, so any commit can be loaded into Chrome without
cutting a release.

It deliberately does **not** run `npm test`. A runner has nothing to point the env vars
at, and the suite needs a browser. **`npm test` is a manual gate before tagging** — see
[`docs/ci-cd/context.md`](https://github.com/thangnm93/SenAnnotate/blob/main/docs/ci-cd/context.md)
for the full argument.

---

## The four steps

```bash
# 1. Run the full suite yourself — CI cannot.
npm test

# 2. Bump the version. package.json is the ONLY place that matters:
#    the build stamps dist/manifest.json from it.
#    …edit "version" in package.json…

# 3. Regenerate the changelog for the version you just bumped to.
#    The release refuses to publish without a section for its tag.
npm run changelog

git commit -am "chore: release 0.8.3"

# 4. Push the commit FIRST, then the tag.
git tag v0.8.3
git push && git push --tags
```

`release.yml` then builds, packs, and creates a GitHub Release with
`senannotate-<version>.zip` attached and the notes taken from `CHANGELOG.md` — and, once
the Chrome Web Store credentials are configured, uploads that same zip to the Store and
submits it for review. Until they are, that step skips itself rather than failing the
release.

---

## The two refusals

Both happen **before `npm ci`**, so a mistake costs seconds and publishes nothing.

### 1. The tag and `package.json` disagree

Fix `package.json`, then delete and re-push the tag:

```bash
git tag -d v0.8.3 && git push origin :refs/tags/v0.8.3
```

### 2. `CHANGELOG.md` has no section for the tag

`node scripts/changelog.mjs --extract "$TAG"` exits non-zero. This is what catches a
forgotten step 3 — and it costs a deleted tag, not a bad release.

---

## `CHANGELOG.md` is generated — never edit it

`scripts/changelog.mjs` rebuilds the **whole file** from the `v*.*.*` tags and the
[Conventional Commit](https://www.conventionalcommits.org/) subjects between them,
grouped into Added / Fixed / Changed / Documentation / Internal, with breaking changes
first.

A hand edit survives until the next release and no longer.

### The consequence worth internalising

> **A commit subject is a release note.**

`feat: screenshot markup, hover capture, triage, session reports and iframes` ships
verbatim, as one bullet, for five features. **Write the subject you would want to read in
the release.**

The generator strips two kinds of bookkeeping from subjects — a trailing `; 0.5.3`, and a
`release <version>` prefix on a `chore:` — and drops a commit whose subject is *only* the
version bump.

Anything it cannot parse lands in an **`Other`** section. If that section ever appears,
**the fix is the commit message, not the generator.**

---

## Conventions

| | |
|---|---|
| Branches | `feature/<slug>`, `fix/<slug>`, `chore/<slug>` |
| Commits | Conventional Commits — `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:` |
| PRs | Reference the `docs/<task-slug>/` folder so reviewers have the context |

---

## Publishing to the Chrome Web Store

Publishing through the API still means **submitted for review**, and the `<all_urls>`
host permission makes that review a **manual** one — days, not minutes. Plan releases
accordingly.

Setup and the two traps worth knowing are in
[`docs/chrome-store-publish/context.md`](https://github.com/thangnm93/SenAnnotate/blob/main/docs/chrome-store-publish/context.md).

### Store assets

```bash
SENANNOTATE_PLAYWRIGHT_DIR=… npm run assets     # → store/out/
```

Generated rather than drawn, by driving the **built extension** against `store/demo.html`
— so the source paths, component chains, diagnostics and report text in the listing are
all real output. A listing made of mockups drifts from the product silently; this one
cannot.

---

## After a release: Enhanced Safe Browsing

A newly published extension shows *"This extension is not trusted by Enhanced Safe
Browsing"* until it has been in the Store for roughly three months with a clean developer
record. Nothing in the manifest changes it and there is no appeal — see
[[Troubleshooting]].

**Adding a new permission restarts the manual review**, and is worth weighing against
that clock.
