# Brief — GitHub issue and PR templates

## What

`.github/` gains a pull-request template, three issue forms, a chooser config, a
`CONTRIBUTING.md` carrying the rules the PR template points at, and a `SECURITY.md`.

## Why

The repo has four workflows in `.github/` and nothing else. Every convention a
contributor has to follow is currently discoverable only by reading `CLAUDE.md` — a file
addressed to an AI agent — or by having a maintainer say it in review.

Four of those conventions are expensive to get wrong:

1. **A commit subject is a release note.** `CHANGELOG.md` is generated from Conventional
   Commit subjects between tags, so a lazy subject ships verbatim to users and cannot be
   edited afterwards without the next release overwriting it.
2. **`npm test` never runs in CI.** A green tick on a PR means typecheck + build + pack.
   A contributor who reads the tick as "tests passed" is wrong, and nothing on the page
   currently says so.
3. **Three modules may not be informed by upstream `agentation`**, which is PolyForm
   Shield rather than MIT. This is a licensing constraint, and it is invisible.
4. **Every non-trivial change needs `docs/<task-slug>/`.** Reviewers need it to have the
   context; it is the thing most likely to be skipped.

The issue side has its own problem: a bug report for this extension is nearly useless
without the version, the install route, the framework and whether the page was a
production build — and none of those occur to a reporter unprompted.

## Done when

- Opening a PR pre-fills a checklist naming all four constraints above.
- Opening an issue offers Bug / Framework detection / Feature, each asking for exactly
  what triage needs and nothing it does not.
- The labels the forms apply exist, so they are actually applied.
- Nothing in the templates contradicts `CLAUDE.md`, the wiki or the workflows.
