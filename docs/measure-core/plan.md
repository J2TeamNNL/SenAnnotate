# Plan — strategy

The executable, step-by-step version is written by the implementation-planning pass
and lands next to this file. This is the ordering argument.

## Shape of the release series

Measurement was scoped as three releases, ordered by how much each one serves the
report rather than by how much it costs:

1. **Measure core** — this folder. Box model, element-to-element gaps, and the
   report lines. The half that makes an annotation carry numbers.
2. **Colour and contrast** — an eyedropper and a computed foreground/background
   contrast ratio with its WCAG verdict. Also enters the report.
3. **Visual aids** — page rulers, draggable guides, a layout grid. Never enters
   the report; ranked last for that reason even though it is the cheapest of the
   three.

Each ships independently. The Measure card is built in (1) so that (2) and (3) have
somewhere to add a row without rearranging controls a user has already learned.

## Ordering within this release

**Engine before pixels.** `src/content/measure.ts` is pure and has no UI, so it can
be written and reasoned about first, and its correctness — particularly the signed
`gap` formula and the containment case — does not depend on anything rendering.

**Report before overlay.** `Annotation.measurements` and the `output.ts` lines come
before the drawing. The report is the deliverable; if the types are settled first,
the overlay has a fixed target and cannot quietly invent a second shape for the same
data.

**Overlay before mode.** `measure-overlay.ts` draws from rects it is handed, so it
can be exercised against static rects before any pointer logic exists.

**Mode wiring last, and thin.** `src/content/index.ts` gets the mode constant, the
`4` key, the pointer branch and the card toggle — and nothing else. Every piece of
state the mode needs lives in `measure-overlay.ts`. The file is already 1884 lines;
the measure of success is how little of this release is visible in it.

**The card last of all.** One row, so it is the least risky piece and the easiest to
cut if something upstream overruns.

## Verification

`npm run typecheck` after each step — it is the project's only static gate.

`npm test` once, at the end, against `test/fixtures/measure.html`, with the six known
hint-text assertions updated in the same commit that changes the hints. CI never runs
the suite, so a green CI tick proves nothing here; the run has to be done locally and
reported honestly.
