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
