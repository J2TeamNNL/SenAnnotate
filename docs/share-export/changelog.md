# Changelog — share export and origin remap

## What shipped

`shared/share.ts` (new): `buildShareHtml(ExportFile)` → one self-contained document, both
colour schemes, screenshots inlined from `screenshotData`, no script and no external
reference.

`shared/archive.ts`: `importAll` takes an `ImportOptions` second argument with
`remapOrigin`, and `ImportSummary` gains `remapped`.

Popup: a **Save .html** button, an **Import onto this site** checkbox, and `download()`
extracted from the JSON export so both formats share one blob-and-anchor path.

Five files: `shared/share.ts`, `shared/archive.ts`, `popup/index.ts`, `static/popup.html`,
`test/e2e.mjs`.

## The one that would have shipped broken

The remap reads the **active tab's** origin. In the e2e suite the popup is an ordinary tab,
so the first version of the check clicked the checkbox — which made the popup itself the
active tab, and the origin came back as `chrome-extension://<id>`. The assertion passed the
wrong thing for the right-looking reason: notes were remapped, just onto the extension.

The check now sets the checkbox through `evaluate` and calls `bringToFront()` on the page
under review, and asserts the origin **by name** in the hint line rather than counting
remapped pages. `3 pages moved` cannot tell you they moved somewhere useless.

## Rejected

**Offering the remap automatically** when the file's origins differ from the current tab.
The popup closes the moment focus leaves it, so there is nowhere to ask — the same
constraint that put import results in the hint line instead of an `alert`.

**A per-page origin table.** The case that exists is one deployment moving to one dev
server. A mapping UI for the case that does not is a screen nobody asked for.

**Rendering screenshot *paths* as `<img>`.** They point at the reporter's Downloads folder.
In a document whose entire promise is that it always renders, a broken image icon is worse
than a sentence saying where the file is.

## Verification

`npm run typecheck` and `npm run build` clean. `npm test`: **218 e2e checks and 9 upgrade
checks pass** — six of them new:

- the popup saves a shareable HTML file
- the shared file carries the notes
- the shared file loads nothing from the network *(no `<script>`, no non-`data:` src/href)*
- an element name cannot close a tag in the shared file *(the escaping guard)*
- a remapped import says which origin it landed on
- a note captured on another origin arrives on this one

Not covered, and worth knowing: nothing asserts how the document **looks**. The check that
it parses as HTML is that a browser opens it, which is a human step.
