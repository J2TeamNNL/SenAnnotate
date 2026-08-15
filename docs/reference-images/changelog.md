# Changelog — reference images

## What shipped

`Annotation.referenceImages?: string[]`, filled from a paste into the composer or from
the new attach button, capped at three, rendered as thumbnails with a remove control and
restored when a note is reopened.

`encodeSuppliedImage` in `content/screenshot.ts` puts them through the same 900px JPEG
re-encode as a captured screenshot. `fitToQuota` sheds them only after every screenshot
is gone. The report gives them their own heading — *Reference — how it should look, not
how it looks now* — and a line telling the agent to use the project's own tokens rather
than the values it can read off the picture.

Eight files: `shared/types.ts`, `shared/output.ts`, `content/screenshot.ts`,
`content/storage.ts`, `content/index.ts`, `content/ui/composer.ts`, `content/ui/dom.ts`
(one icon), `content/ui/styles.css`, plus `test/e2e.mjs` and a fixture.

## What the first cut got wrong

**Encoding in the composer.** The first version imported `encodeForEmbed` into
`ui/composer.ts` and did the canvas work there. It typechecked and it worked, and it put
image processing inside the layer whose entire job is to draw — the composer would have
been the second module in `ui/` to know what a `data:` URI is for. Moved behind an
`onAttach(files)` callback, which is also what made the encode failure path (`Could not
read that image`) land in the one place that already owns toasts.

**Storing `[]`.** Submitting with no images wrote `referenceImages: []` onto every new
note, changing the stored shape of annotations that have nothing to do with this feature
and making the upgrade fixture's "0.2.0 shape still renders" check a slightly different
question. It is `undefined` when empty.

## Rejected

**One `images` array with a `kind` field.** Loses the quota ordering (see `context.md`)
and moves the "which of these is the target" question from the type system into a
runtime filter, in a report where getting it wrong means implementing the bug.

**Marking up a reference.** The markup editor exists to blur customer data out of a
photograph of our own page. A pasted Figma frame is someone else's artefact.

## Verification

`npm run typecheck` and `npm run build` clean. `npm test`: **218 e2e checks and 9 upgrade
checks pass** — six new, in their own fixture (`reference.html`) because the report
assertions read whatever the page holds:

- an attached image appears in the composer *(real `setInputFiles`)*
- a pasted image joins the attached one *(synthetic `ClipboardEvent` — see `context.md`)*
- an image can be taken back out
- the report says the reference is a target, not the current state
- the reference image itself travels in the report
- reopening a note brings its reference images back

Not covered: `fitToQuota` shedding references last. Reaching 4 MB of images needs a page
with dozens of photographed notes, which is minutes of a suite that runs in one context.
