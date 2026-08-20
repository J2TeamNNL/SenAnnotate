# Context — what constrains the measurement work

## Why none of this touches the MAIN world

The three-world split exists because framework metadata (`__vueParentComponent`,
`__reactFiber$…`) is a JS property on a DOM node, and each isolated world sees its
own view of those. Measurement has no such problem: `getBoundingClientRect` and
`getComputedStyle` read the *shared* DOM, and both answer identically from the
isolated world.

So this feature adds **no inspector code, no bridge RPC, no manifest change and no
permission**. It sits beside `content/identify.ts`, which already establishes the
pattern — read only the DOM, need no round trip, behave identically on a page with
no framework at all. That property is worth protecting: a measured gap must be as
reliable on a minified production build as on a dev server, and it is the only part
of the report that can promise that.

If a later change to this area needs the bridge, something has gone wrong. Re-read
this section before adding one.

## The files this lands in

| File | Why it is involved | Note |
|---|---|---|
| `src/content/measure.ts` | new — the engine | pure functions, no DOM writes, no state |
| `src/content/ui/measure-overlay.ts` | new — drawing and the mode's own state | kept out of `overlay.ts` on purpose, below |
| `src/content/ui/measure-card.ts` | new — the card | copies the anchored-placement maths from `ui/settings.ts:39-51` |
| `src/shared/types.ts` | `InspectMode`, `Annotation.measurements`, `Settings.showBoxModel` | all three worlds import this |
| `src/content/index.ts` | mode wiring, key `4`, card toggle | already 1884 lines — wiring only |
| `src/content/capture.ts` | `CaptureOptions.measurements` into the draft | ~4 lines |
| `src/content/ui/toolbar.ts` | mode button, card button, `MODE_HINTS` | breaks e2e, below |
| `src/shared/output.ts` | three report lines | `renderAnnotation`, near `**Position:**` |
| `src/content/ui/styles.css` | six new classes | |

### Why the drawing is not in `overlay.ts`

`Overlay` owns two jobs (hover highlight, marquee rectangle) and it is the hot path:
`showHighlights` runs at `pointermove` frequency and pools its boxes specifically to
avoid DOM churn there (`src/content/ui/overlay.ts:52-58`). Box-model bands, a size
badge and four dimension lines are a third job with a different lifetime — they
belong to a mode, not to every hover. Putting them in the same class means every
hover in `point` mode pays for code it never draws.

## Constraints and traps

**No reference implementation may be consulted or named.** The same rule
`NOTICE.md` states for `content/identify.ts`, `inspector/freeze.ts` and
`shared/output.ts` applies to everything here: written from the specification of
the box model and from `getComputedStyle`, not from anyone else's source. No
third-party tool is named in this folder, in the code, or in the commits — that
is a standing instruction for this task, not a licensing consequence.

**Six e2e assertions will break, by design.** `test/e2e.mjs` compares the
`.toolbar-hint` text **verbatim** at lines 466, 473, 480, 594, 610 and 766. All
three existing hints gain ` · 4 measure`, so all six fail together. This is exactly
the "renaming a hint breaks tests that look unrelated" case `CLAUDE.md` warns about;
it is listed here so the failures read as expected rather than as a regression.

**The fixture must be its own.** `chrome.storage.local` is shared across the suite's
single browser context and annotations are keyed on `origin + pathname`, so a page
another block annotates opens with that block's leftovers. Four assertions failed
this way in 0.6.0 (`docs/annotation-triage/changelog.md`). `test/fixtures/measure.html`
is new, uses `position: absolute` with whole-pixel coordinates, and nothing else
annotates it.

**rAF is safe here.** Freeze patches `setTimeout`/`setInterval`/`requestAnimationFrame`
in the **MAIN world only** — `src/inspector/freeze.ts:14-17` says why it has to. The
content script's own rAF is untouched, which is how `marqueeFrame`
(`src/content/index.ts:1704`) already throttles a drag while the page is frozen.
Throttling the box-model read the same way is therefore correct. The trap that does
apply is the test-side one: `waitForFunction` polls in the page, so a frozen page
never resolves it — use a Node-side `waitForTimeout` plus one `evaluate`.

**`transform` desynchronises the two sources.** `getBoundingClientRect` returns the
post-transform rect; `getComputedStyle` returns pre-transform padding and margin. On
a scaled element the badge's `320×48` and its `padding 8px` describe different
coordinate spaces. Detect a non-identity transform on the element or an ancestor and
mark the badge `(scaled)` rather than presenting two numbers that quietly disagree.

**Sub-pixel figures survive.** Round to two decimals and trim trailing zeros. A
0.5px gap is a real defect and the whole point of measuring is to surface it;
rounding to integers — which is what a browser's own inspector does — would hide
the class of bug this feature is best placed to catch.

## Two decisions that look arbitrary and are not

**Box-model band colours are fixed, not derived from `accentColor`.** Everything
else in the UI derives from the accent (`shared/accent.ts`), and this one thing
cannot: the padding band and the margin band must be distinguishable from each
other, and two shades derived from an arbitrary user-chosen colour do not guarantee
that. They get fixed translucent green and orange, and the file's banner comment
says so.

**`**Gap:**` prints from `standard`, `**Box:**` only from `detailed`.** A gap costs
the reviewer two deliberate clicks — it is an expressed intention, and suppressing
it because the detail level is low would discard the reason they entered the mode.
Box model is passive data collected alongside, so it sits at the same level as
`**Position:**` and `**Classes:**`, which is where a reader already expects that
kind of line.
