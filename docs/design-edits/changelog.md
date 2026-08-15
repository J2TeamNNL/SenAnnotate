# Changelog — design edits

## What shipped

`content/design.ts` (new): `DESIGN_FIELDS` — thirteen properties across Colour, Type,
Spacing, Layout and Size — plus `readDesign`, `previewDesign`, `previewText`,
`revertDesign` and `diffDesign`.

`content/ui/design-panel.ts` (new): the collapsed section inside the composer, generated
entirely from that table, with a badge carrying the pending count so a shut section
cannot hide edits.

`Annotation` gains `designChanges?: DesignChange[]` and `textChange?: { from, to }`. The
report prints a `| Property | From | To |` table and the text swap, under a line asking
the agent to express them in the project's own tokens.

Nine files: `content/design.ts`, `content/ui/design-panel.ts`, `content/index.ts`,
`content/ui/composer.ts`, `content/ui/styles.css`, `shared/types.ts`, `shared/output.ts`,
plus `test/e2e.mjs` and a fixture.

## Two things the tests caught

**`style=""` is not "left alone".** The revert cleared every property and passed its own
check — the element rendered identically — but the `style` attribute stayed on the node,
empty. It shows in devtools, and page code that tests for the attribute sees it. The
check that failed was `and leaves no inline style attribute behind`, which was written
expecting `null` for exactly this reason; the fix is one line at the end of
`revertDesign`.

**`.card` is our class too.** The fixture used `<div class="card">`, and `.card` is the
overlay's own card. Playwright's strict mode caught it as an ambiguous locator rather
than silently clicking the panel — the fixture element is now `.tile`. Worth knowing
before writing the next fixture: the suite queries page and shadow DOM through the same
locators.

## Rejected

**Keeping the preview after save.** The reference tool does. It would mean the reviewer
testing the app against a change that exists in their tab and in no codebase, until a
reload takes it away unannounced. `context.md` has the full argument — it is the one rule
here that could not bend.

**Letting the panel apply the styles.** Ten lines shorter and it would own an element
reference, leaving the revert — which must fire on paths the panel never hears about — to
reach back into it.

**A free-text CSS box.** It is the easiest control to build and the worst to consume: an
agent handed a CSS blob has to guess which declarations were deliberate.

## Verification

`npm run typecheck` and `npm run build` clean. `npm test`: **224 e2e checks and 9 upgrade
checks pass** — twelve new, in their own fixture:

- the design section is collapsed until it is asked for
- a typed value shows on the real element straight away
- rewriting the text replaces it on the page
- the collapsed section would still show how many properties are pending
- saving the note takes the preview back off the page
- and leaves no inline style attribute behind
- the report carries the deltas as a table
- the report carries the rewritten text with what it replaced
- the report tells the agent to use the project's own tokens
- reopening a note restores the edits it was saved with
- escaping out of an edit also puts the element back
- a multi-element note gets no design controls

Not covered: the `!important` priority actually beating a stylesheet rule that carries
one, and the alpha-colour fallback. Both are single expressions with no branch the suite
can reach without a fixture built solely to prove them.

The absent-controls rule was going to be checked through a *text selection*, which is the
other case it covers. Driving one turned out to need a real mouse gesture the suite has
no precedent for — `selectText()` sets a selection without the `mouseup` the extension
waits for — so the multi-element path stands in. Same branch, one condition.
