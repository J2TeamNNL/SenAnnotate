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

## [`framework-detectors/`](./framework-detectors/) — 0.3.0

Extending component and source detection from Vue only to Vue, React, Svelte and
Angular, by making the detector layer pluggable first. Its `context.md` has the table
of what each framework actually exposes — the reason the design does not flatten them
into one shape, and why Angular and React 19 report no source line at all.

## [`hardening/`](./hardening/) — 0.3.2

A full-codebase security and correctness review, then the fixes. All six confirmed
defects were in the 0.3.1 clean-room rewrite; its changelog explains why the freeze
timer design had to be replaced rather than patched.

## [`ci-cd/`](./ci-cd/) — GitHub Actions

Build/typecheck on every push, and a tag-triggered GitHub Release carrying the packed
zip. Its `context.md` explains why the Playwright suite is deliberately **not** run in
CI — it borrows Playwright and Vue from sibling monorepo directories that a bare
checkout does not have.

## [`marquee-select/`](./marquee-select/) — 0.4.0

Reworking drag-select to take what the box **fully contains**, at the shallowest level
contained, instead of everything it touches — plus the hint line under the toolbar,
added because a mode nothing on screen mentioned went unused for three releases.

## [`toolbar-collapse/`](./toolbar-collapse/) — 0.5.0

Collapsing the toolbar to a single handle, because it is docked in the corner pages use
for chat widgets and cookie bars. Its `changelog.md` is worth reading for two traps: the
keyboard focus ring that only a screenshot caught, and why the collapsed handle's count
badge could not reuse the `.count` class.

## [`modal-click-leak/`](./modal-click-leak/) — 0.5.1

Our own toolbar was retargeting to the shadow host on the way out, so every site that
dismisses a modal on an outside pointer event closed it the moment the toolbar was touched —
making a modal the one thing that could not be annotated. Reported as a freeze bug; freeze
was measured and cleared. Its `changelog.md` also records why `waitForFunction` can never
observe a frozen page.

## [`modal-focus-leak/`](./modal-focus-leak/) — 0.5.1

The other half: a toolbar click took focus off the page's dialog, so a modal that closes on
focus loss was dismissed and a modal with a focus trap fought the composer for focus and won —
notes typed into it were silently dropped. Its `changelog.md` records the `fill()`
measurement that nearly hid the second bug, and the one case that stays broken with the
alternatives rejected.

## [`chrome-store-publish/`](./chrome-store-publish/) — Web Store automation

Tagging a release now also uploads the packed zip to the Chrome Web Store and submits it for
review. Its `context.md` has the setup steps and two findings worth knowing before copying
any other recipe for this: the v1.1 API stops serving on 15 October 2026, and refresh tokens
expire after seven days while the OAuth consent screen is in "Testing".

## [`hover-label-clamp/`](./hover-label-clamp/) — 0.5.3

The hover label was anchored to the highlighted element's left edge with nothing bounding it
against the right of the viewport, so hovering anything near the edge cut off the source path.
Found while shooting the Web Store screenshots rather than from a bug report — its
`changelog.md` notes what that says about photographing your own product.

## [`screenshot-markup/`](./screenshot-markup/) — 0.6.0

The screenshot was captured, cropped and downloaded — and the report printed a bare
filename no reader could resolve. Adds a markup editor (box, arrow, destructive blur)
between capture and save, and a delivery choice: a path an agent can open, or an
embedded `data:` URI. Its `changelog.md` records why the editor had to take focus, and
why blur reads from the canvas rather than the original bitmap.

## [`hover-capture/`](./hover-capture/) — 0.6.0

<kbd>C</kbd> annotates whatever the pointer is over, because a *click* is the one thing
that closes a dropdown, a hover menu or a tooltip. Its `context.md` explains why freeze
does not help and why losing the hover state to the composer's focus is survivable.

## [`annotation-triage/`](./annotation-triage/) — 0.6.0

Type (`bug`/`ui`/`copy`/`question`) and status (`open`/`done`) on an annotation, a
filter in the panel, and a JSON export/import round-trip. Its `changelog.md` records
four test failures that all had one cause — a fixture another block had already
annotated — which is a standing trap for anyone adding to the suite.

## [`session-and-frames/`](./session-and-frames/) — 0.6.0

One report covering every annotated page, and annotation *inside* iframes. Its
`changelog.md` covers the restructure `all_frames: true` forced on `content/index.ts`,
the three child-frame problems the plan did not anticipate, and a permission-gated
clipboard read that hung the suite for ten minutes instead of failing.

## [`release-changelog/`](./release-changelog/) — generated release notes

`CHANGELOG.md`, rebuilt from the tags and the Conventional Commit subjects between them,
and a release that fails before installing anything when its tag has no section. Its
`context.md` reverses the "generated release notes are enough" call made in
`ci-cd/brief.md` and says what changed to justify that.

## [`shift-multiselect/`](./shift-multiselect/) — 0.7.0

Shift-click gathers scattered elements into one annotation, for the selections a
marquee cannot draw — a label in one column and its input three columns over. Its
`changelog.md` is worth reading for the four teardown paths the state needed and the
one that is only visible if you scroll mid-selection.

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

`ci-cd/` and `release-changelog/` were written here directly and have no monorepo
counterpart.
