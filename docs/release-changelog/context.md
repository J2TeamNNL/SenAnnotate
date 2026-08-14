# Context — A changelog for every release

## Where release notes come from today

`.github/workflows/release.yml` fires on `push: tags: ["v*.*.*"]` and ends with:

```yaml
run: gh release create "$GITHUB_REF_NAME" senannotate-*.zip --generate-notes
```

`--generate-notes` asks GitHub to write the body: the merged pull requests and the
commits between this tag and the previous one, plus a "New Contributors" block. It is
built for a repo where work arrives as PRs with descriptive titles.

This repo is the opposite case. There are no PRs; commits land on `main` directly, and
a release's work is squashed into one or two of them. `v0.6.0` was never tagged, so no
release was generated for it — but the commit range it would have covered is the whole
argument:

```
0aba247 feat: screenshot markup, hover capture, triage, session reports and iframes
ac653df chore: release 0.6.0, with README screenshots and the Web Store link
```

Two lines, one of which is bookkeeping, for a release that added screenshot markup,
hover capture, annotation triage, session reports and iframe support — five features
the reader has to already know about to recognise in that sentence.

## Why the earlier decision went the other way

`docs/ci-cd/brief.md` lists, under "Out (deliberately)":

> Writing a changelog file into the repo. GitHub's generated release notes are enough.

That was written before 0.3.0, when the repo had eight commits and the distribution
model was "hand a tester a zip". Two things changed since:

1. **The extension is on the Chrome Web Store** (`docs/chrome-store-publish/`). A Store
   listing has a "What's new" field, and `store/` material has to be written from
   *something*. Right now that something is `git log`, read by hand.
2. **Releases got bigger.** 0.2.0 → 0.3.0 was three commits. 0.5.3 → 0.6.0 was two
   commits carrying five features and a docs rewrite.

The decision is reversed on those grounds, not because the reasoning was wrong at the
time.

## What makes generation viable here

Every one of the 49 commits in the history parses as a Conventional Commit:

```
$ git log --oneline --reverse | head -3
592a9bb chore: baseline Vuetation 0.1.0 before SenAnnotate rebrand
63c7630 refactor: rename bridge namespace to senannotate and dedupe storage keys
8c3bb53 refactor: rename remaining vuetation literals and CSS token prefix
```

`CLAUDE.md` (user-level) mandates the format, and it has been followed since the first
commit. So a backfill to 0.2.0 needs nothing but `git log`, and future releases stay
correct for free as long as the rule holds.

Two quirks the parser has to survive:

- **A trailing version suffix.** Several subjects end with `; <version>` — the commit
  that also bumped `package.json`:
  `fix: keep the hover label inside the viewport; 0.5.3`. That suffix is noise in a
  section already headed by the version, so it gets stripped.
- **`chore: release <version>` commits.** Pure bookkeeping. `ac653df` is
  `chore: release 0.6.0, with README screenshots and the Web Store link` — note it also
  carries real work in the same subject, so dropping the whole commit would lose the
  README and Store-link changes. The rule is to drop only a subject that is *nothing
  but* the release bump, and to strip the `release <version>` prefix off the rest.

## The tags

Nine, all lightweight (`%(objecttype)` is `commit`, not `tag`), so there is no tag
message to read and no tagger date distinct from the commit date:

```
v0.2.0 2026-08-10   v0.3.2 2026-08-11   v0.5.1 2026-08-11
v0.3.0 2026-08-10   v0.4.0 2026-08-11   v0.5.2 2026-08-11
v0.3.1 2026-08-10   v0.5.0 2026-08-11   v0.5.3 2026-08-11
```

`package.json` says `0.6.0` and there is no `v0.6.0` tag — the release commit landed but
the tag was never pushed. That is the shape the generator has to handle for every future
release too: the top section is always "the version in `package.json`, from the newest
tag to `HEAD`". Whether it is labelled released or unreleased follows from whether a tag
of that name exists.

Tag ordering cannot come from `creatordate` — `v0.3.1` and `v0.3.2` were created minutes
apart and a rebase or a re-push would reorder them. Sort by parsed semver instead.

## Constraints inherited from the repo

- **Zero runtime dependencies, and build-time dependencies are `esbuild` + `typescript`
  only.** `scripts/pack.mjs` shells out to the system `zip` rather than add a zip
  library; the changelog generator shells out to `git` for the same reason. No
  `conventional-changelog`, no `semantic-release`.
- **`package.json` is the single source of truth for the version.** `build.mjs` stamps
  `dist/manifest.json` from it. The generator reads it, never writes it.
- **Scripts are `.mjs` and are not typechecked.** `npm run typecheck` is `tsc --noEmit`
  over `src/`. Verification for this work is running the thing and reading the output.
- **Every module opens with a banner comment explaining why.** `scripts/pack.mjs` is the
  model to match.

## Repository facts the generator needs

- Remote: `git@github.com:thangnm93/SenAnnotate.git` → compare links are
  `https://github.com/thangnm93/SenAnnotate/compare/<a>...<b>`.
- Tag naming: `v` prefix, `v*.*.*`. `release.yml`'s existing guard already strips it
  with `${GITHUB_REF_NAME#v}`.
- `release.yml` reads the tag through `$GITHUB_REF_NAME`, not `${{ github.ref_name }}`,
  so a tag containing shell metacharacters is a value rather than something the shell
  executes. The new step has to keep that property.
