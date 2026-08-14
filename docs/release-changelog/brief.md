# Brief — A changelog for every release

## What

A generated `CHANGELOG.md` at the repo root, and a release that refuses to happen
without the section covering its tag.

- **`scripts/changelog.mjs`** — rebuilds `CHANGELOG.md` from the `v*.*.*` tags and the
  Conventional Commit subjects between them. A second mode, `--extract <version>`,
  prints one version's section to stdout.
- **`npm run changelog`** — the command a release runs before committing the bump.
- **`release.yml`** — replaces `gh release create --generate-notes` with
  `--notes-file`, fed from `--extract "$TAG"`. An empty or missing section fails the
  workflow before anything is published.
- **`CHANGELOG.md`** — backfilled across 0.2.0 → 0.6.0 in the same pass, since every
  commit in the repo's 49-commit history already follows the convention.

## Why

1. **The current release notes carry almost no information.** `--generate-notes` lists
   commits and merged PRs since the previous tag. This repo commits straight to `main`
   and squashes a release's work into one or two commits — 0.6.0 is a single commit
   reading "screenshot markup, hover capture, triage, session reports and iframes". The
   generated notes reproduce that line and stop.
2. **Nothing anywhere states what a version changed.** The per-task
   `docs/<slug>/changelog.md` files are the real record, but they are keyed on tasks,
   not versions, and a reader has to know which task landed in which release.
3. **The Chrome Web Store listing and testers both need a version history**, and today
   that only exists in `git log`.

`docs/ci-cd/brief.md` put "writing a changelog file into the repo" explicitly out of
scope, on the grounds that generated notes were enough. Three releases of practice say
they are not — see `context.md`.

## Scope

**In:**
- The generator, its two modes, and the `npm run changelog` script
- `CHANGELOG.md`, backfilled to 0.2.0 and committed
- The `release.yml` swap, including the missing-section hard failure
- The release procedure in `CLAUDE.md` and `README.md`

**Out (deliberately):**
- **Hand-written release notes.** The commit subjects in this repo are already written
  as prose ("keep the hover label inside the viewport"), so generation loses little,
  and a file nobody is forced to edit is a file that goes stale.
- **A changelog-lint step on `ci.yml`.** The gate that matters is at release time, and
  it is already there.
- **Committing `CHANGELOG.md` from CI.** A tag build pushing to `main` is a loop nobody
  wants to debug. The file is regenerated locally and committed with the version bump.
- Any dependency. The generator is `node:child_process` + `git`, like `pack.mjs`.

## Success criteria

1. `npm run changelog` rewrites `CHANGELOG.md` with a section per released version plus
   one for the version in `package.json` that has no tag yet.
2. Each section's entries match `git log <prev-tag>..<tag>` for that range, grouped by
   Conventional Commit type.
3. `node scripts/changelog.mjs --extract 0.6.0` prints that section and exits 0.
4. `node scripts/changelog.mjs --extract 9.9.9` prints nothing and exits non-zero.
5. Pushing a tag whose version has no section in the committed `CHANGELOG.md` fails
   `release.yml` before `gh release create` runs.
6. A release created through the new path has notes listing what changed, grouped, not
   a bare commit list.
