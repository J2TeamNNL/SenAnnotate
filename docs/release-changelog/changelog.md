# Changelog — A changelog for every release

A running log of the work, including what turned out to be wrong.

## Docs written before code

`brief.md`, `context.md`, `plan.md` written first, per the repo convention. The one
thing worth flagging up front: `docs/ci-cd/brief.md` had explicitly ruled a changelog
file out of scope. This task reverses that, and `context.md` records why rather than
leaving a future reader to find the contradiction.

## The generator

`scripts/changelog.mjs`, ~260 lines, no dependencies. Built to the plan without
surprises; three things are worth recording.

**Record separators had to be escapes, not literals.** The `git log --format` string uses
`%x1f` between fields and `%x1e` between commits, and the first draft wrote the matching
JavaScript constants as the literal control characters. They were written correctly — the
bytes were `037` and `036` — but they are invisible in an editor, survive a copy-paste
only by luck, and read as `const UNIT = "";`. Replaced with `"\x1f"` / `"\x1e"`.

**`chore: release <version>` could not be dropped wholesale.** The plan said to drop
release-bump commits as bookkeeping. `ac653df` is
`chore: release 0.6.0, with README screenshots and the Web Store link` — the bump *and*
two real changes in one subject. Dropping the commit would have silently lost them. The
rule became: strip the `release <version>` prefix, drop the commit only if nothing
survives the strip. It renders as "README screenshots and the Web Store link" under
Internal, which is right.

**The compare link for an untagged version was wrong in a way that only shows up later.**
The first version pointed the pending section at `...HEAD`, which is correct at the moment
of release — HEAD *is* the release commit — and wrong a month later, when the same link
shows a diff spanning several releases. Changed to point at `v<version>`: the tag that
does not exist yet but will within minutes, since the file is generated as the last step
before committing the bump. The link 404s only inside that window, and the heading says
`unreleased` throughout it.

## Verification

No test framework covers `scripts/`, so everything below was run and the output read.

**Every section matched `git log`.** A throwaway script parsed the generated
`CHANGELOG.md` back into `{version: [shas]}` and compared each against
`git log --no-merges --format=%h <range>`:

```
ok 0.2.0   20 entries  v0.2.0
ok 0.3.0    5 entries  v0.2.0..v0.3.0
ok 0.3.1    3 entries  v0.3.0..v0.3.1
ok 0.3.2    1 entries  v0.3.1..v0.3.2
ok 0.4.0    7 entries  v0.3.2..v0.4.0
ok 0.5.0    3 entries  v0.4.0..v0.5.0
ok 0.5.1    2 entries  v0.5.0..v0.5.1
ok 0.5.2    2 entries  v0.5.1..v0.5.2
ok 0.5.3    3 entries  v0.5.2..v0.5.3
ok 0.6.0    3 entries  v0.5.3..HEAD

entries in changelog: 49
commits in history:   49
ALL RANGES MATCH
```

49 of 49 commits placed, nothing dropped, nothing duplicated. The `Other` section — the
one that catches subjects that do not parse as Conventional Commits — is absent from
every version, which is the expected result given the whole history follows the format.

**`--extract` in five states:** `0.6.0` prints the section, exit 0; `v0.5.1` accepts the
`v` prefix; `9.9.9` prints the "no section" message to stderr, exit 1; a hand-made file
whose section holds only `_No commits recorded_` gives "section is empty", exit 1; a
missing `CHANGELOG.md` gives "run `npm run changelog`", exit 1.

**Idempotent.** Two consecutive runs produce a byte-identical file.

**The workflow shell was run locally**, since a tag push is not something to test by
pushing a tag:

- `GITHUB_REF_NAME=v0.6.0` — tag check passes, notes extracted, exit 0.
- `GITHUB_REF_NAME=v0.9.9` — no section, exit 1, nothing downstream reached. This is the
  case that matters: it is what a release with a forgotten `npm run changelog` looks like.
- `GITHUB_REF_NAME='v0.6.0; touch /tmp/PWNED'` — exit 1, no file created. The tag reaches
  the script as one argv element and is rejected by the version regex before use. The
  existing tag check documents why `$GITHUB_REF_NAME` is read as an environment variable
  rather than a `${{ }}` expression; the new step keeps that property.

**`npm run typecheck` and `npm run build` both pass.** Neither covers `.mjs`, but the
`package.json` edit could have broken the script chain and did not.

`npm test` was not run. It drives a headed Chromium against the extension UI, and this
change touches `scripts/`, `.github/`, and documentation — no file under `src/`. It stays
the manual gate before the next tag, where it will run against the release being cut.

## What a release looks like now

```bash
npm test
# edit "version" in package.json
npm run changelog
git commit -am "chore: release 0.7.0"
git tag v0.7.0 && git push && git push --tags
```

Forgetting the third line no longer produces a thin release — it produces a failed
workflow, before `npm ci`, with the fix in the error message.

## Consequence worth stating once

**A commit subject is now a release note**, published verbatim. The subject that prompted
this work — `feat: screenshot markup, hover capture, triage, session reports and iframes`
— ships as a single bullet covering five features. The generator cannot improve it; only
splitting the commit, or writing a better subject, can. That is recorded in `CLAUDE.md`
rather than only here, because it is a rule that applies to every future commit rather
than a fact about this task.
