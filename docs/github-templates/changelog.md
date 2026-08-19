# Changelog

## Written

Four issue forms + a PR template + `CONTRIBUTING.md` + `SECURITY.md`.

Content came out of the repo rather than from a generic template: the commit-subject rule
from `scripts/changelog.mjs` and the release section of `README.md`, the CI gap from
`.github/workflows/ci.yml` and `docs/ci-cd/context.md`, the e2e traps and the licensing
constraint from `CLAUDE.md`, the permission cost from `store/listing-privacy.md`, and the
framework matrix from the wiki.

## Labels had to be created first

A YAML issue form's `labels:` are applied **only if the label already exists**. A name
that does not exist is dropped silently — the issue opens with no label and nothing says
why.

The repo had GitHub's nine defaults and had never applied one. `framework` and
`needs-triage` created; `bug` and `enhancement` reused.

## YAML validated locally

`pyyaml` is not installed on this machine, so validation went through Ruby's bundled
`YAML` instead. Worth doing rather than pushing and looking: GitHub renders a malformed
form as a plain textarea with an error banner, which is easy to miss until someone files
an issue with it.

All four parse. Required fields: `bug_report` six, `framework_detection` five,
`feature_request` two.

`ruby -e` with `.tally` failed first — the bundled Ruby on this machine predates it.
Rewritten without.

## Deliberately absent

- **`CODE_OF_CONDUCT.md`** — one maintainer, no community yet. Adding the Contributor
  Covenant now would be furniture rather than policy; it earns its place when there is a
  second regular contributor.
- **Dependabot** — two devDependencies, zero runtime dependencies. The noise would exceed
  the value.

## CLAUDE.md points at the templates

Added *Opening an issue or a pull request*, because the templates only work if they are
opened. An agent that writes its own PR body never asks itself the question it did not
think of, and `CLAUDE.md` is the file it reads first.

One correction while writing it: the first draft said `gh pr create` does not pick up the
PR template. That is wrong — it pre-fills its editor from it, **interactively**. The real
gap is that `--body` and `--body-file` bypass the template entirely, and that is exactly
the path an agent takes. The section now says that instead, and tells the agent to start
from the file deliberately.

The four expensive rules are restated inline rather than only linked, because an agent
reading `CLAUDE.md` may act without opening `.github/`.
