# Docs

Design record for SenAnnotate. Written during the work, not reconstructed afterwards —
so the changelogs include the things that went wrong, the assumptions that turned out
false, and the measurements that contradicted earlier notes.

| File | What it is |
|---|---|
| [`brief.md`](./brief.md) | What is being built and why; scope in/out; success criteria |
| [`context.md`](./context.md) | Background and constraints: the verified rename inventory, why the `Vue*` types were kept, the colour and contrast reasoning, the icon geometry |
| [`plan.md`](./plan.md) | Strategy summary — the ordered approach |
| [`implementation-plan.md`](./implementation-plan.md) | The executable version: bite-sized steps with real code and a verification command per step |
| [`changelog.md`](./changelog.md) | What actually happened, including four surfaces the plan missed and the checks that had to be rewritten |
| [`history/vuetation/`](./history/vuetation/) | The predecessor project (Vuetation, v0.1.0) — where the three-world architecture, the port map from `agentation`, and the source-resolution strategy were worked out. Still load-bearing; left unedited. |

## Reading order

New to the project: `history/vuetation/context.md` explains **why** the extension is
split across three JavaScript contexts, which is the one non-obvious thing about it.
Then `context.md` here for what the 0.2.0 rebrand changed.

Debugging source resolution: `history/vuetation/context.md` has the four strategies
ranked best-to-worst, and the note about measuring the installed package rather than
trusting blog posts — that one cost a detour.

## Provenance

These files were authored at the monorepo root under `docs/senannotate/` (and
`docs/superpowers/plans/` for the implementation plan), following the monorepo's task
documentation convention, then copied here once the project got its own remote. Their
cross-references were rewritten to be repo-relative at that point.

**The monorepo copies still exist**, so the two can drift. Treat the copy in this repo as
canonical from now on — it travels with the code it describes.
