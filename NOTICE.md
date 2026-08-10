# Provenance

SenAnnotate is licensed under the [MIT License](./LICENSE). This file records how it got
there, because the history is not simple and pretending otherwise would be worse than
explaining it.

## The short version

The project began in 2026 as **Vuetation**, a Vue-oriented answer to
[`agentation`](https://github.com/benjitaylor/agentation) by Benji Taylor. Three files
were **ported from it** at that time, one of them close to verbatim.

`agentation` is distributed under the **PolyForm Shield License 1.0.0** — source-available,
not open source, and carrying a clause prohibiting use of the software to provide a
competing product or service.

That made MIT unavailable and made publication risky. So in **0.3.1** the ported files were
**reimplemented from scratch**, and MIT applies to the result.

## What was ported, and what replaced it

The original port is recorded in
[`docs/history/vuetation/context.md`](./docs/history/vuetation/context.md), which listed:

| Upstream file | Then | Now |
|---|---|---|
| `src/utils/element-identification.ts` | ported, close to verbatim | rewritten as `src/content/identify.ts` |
| `src/utils/freeze-animations.ts` | ported | rewritten as `src/inspector/freeze.ts` |
| `src/utils/generate-output.ts` | ported and extended | rewritten as `src/shared/output.ts` |
| `src/utils/react-detection.ts` | rewritten for Vue at the time | since replaced entirely by `src/inspector/detectors/` |
| `src/utils/source-location.ts` | rewritten at the time | superseded by the detector layer |
| `src/components/page-toolbar-css/` | rewritten at the time | unchanged since |

## How the rewrite was done

Written against the **public API** each module had to keep and its **observable
behaviour**, which was captured from a real report and then pinned by tests — 8 new e2e
checks were added covering every export of the identification module *before* it was
touched, because it previously had almost none.

The upstream source was not consulted during the rewrite. The behaviour is intentionally
similar in places, because both solve the same problem against the same DOM APIs; the code
is not.

One behaviour deliberately **changed** rather than being reproduced: class names are no
longer truncated at their last hyphenated segment. The old code turned `base-button` into
`base` and `sidebar__title` into `sidebar_`, treating author-written modifiers as build
hashes. Only segments that actually look like hashes are stripped now.

## What is still owed to `agentation`

The idea, and the shape of the problem. `agentation` established that a visual annotation
layer feeding structured context to a coding agent is worth building, and this project
would not exist without having seen it. That is credited in the README and here.

No `agentation` code remains, to the best of our understanding.

## If you are relying on this

**This is a good-faith account, not legal advice.** If the licensing history matters to
your use — vendoring it, shipping it in a product, redistributing it — get your own advice
rather than taking this file's word for it.
