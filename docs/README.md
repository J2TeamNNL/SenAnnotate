# Docs

Design record for SenAnnotate. Written during the work, not reconstructed afterwards —
so the changelogs include the things that went wrong, the assumptions that turned out
false, and the measurements that contradicted earlier notes.

One folder per task. The files at the top level belong to the 0.2.0 rebrand, which came
first and is the largest piece of the record.

## 0.2.0 — the rebrand (Vuetation → SenAnnotate)

Turning a Vue-specific annotator into one that works on any website.

| File | What it is |
|---|---|
| [`brief.md`](./brief.md) | What was built and why; scope in/out; success criteria |
| [`context.md`](./context.md) | Background and constraints: the verified rename inventory, why the `Vue*` types were kept, the colour and contrast reasoning, the icon geometry |
| [`plan.md`](./plan.md) | Strategy summary — the ordered approach |
| [`implementation-plan.md`](./implementation-plan.md) | The executable version: bite-sized steps with real code and a verification command per step |
| [`changelog.md`](./changelog.md) | What actually happened, including four surfaces the plan missed and the checks that had to be rewritten |

## [`ci-cd/`](./ci-cd/) — GitHub Actions

Build/typecheck on every push, and a tag-triggered GitHub Release carrying the packed
zip. Its `context.md` explains why the Playwright suite is deliberately **not** run in
CI — it borrows Playwright and Vue from sibling monorepo directories that a bare
checkout does not have.

## [`history/vuetation/`](./history/vuetation/) — the predecessor

Where the three-world architecture, the port map from
[`agentation`](https://github.com/benjitaylor/agentation), and the source-resolution
strategy were worked out, for v0.1.0. Still load-bearing; left unedited.

## Reading order

New to the project: `history/vuetation/context.md` explains **why** the extension is
split across three JavaScript contexts, which is the one non-obvious thing about it.
Then `context.md` here for what the 0.2.0 rebrand changed.

Debugging source resolution: `history/vuetation/context.md` has the four strategies
ranked best-to-worst, and the note about measuring the installed package rather than
trusting blog posts — that one cost a detour.

## Provenance

The 0.2.0 and `history/vuetation/` files were authored at the monorepo root (under
`docs/senannotate/`, `docs/vue-chrome-annotator/`, and `docs/superpowers/plans/`),
following the monorepo's task documentation convention, then copied here once the
project got its own remote. Their cross-references were rewritten to be repo-relative at
that point.

**Those monorepo copies still exist**, so the two can drift. Treat the copy in this repo
as canonical — it travels with the code it describes.

`ci-cd/` was written here directly and has no monorepo counterpart.
