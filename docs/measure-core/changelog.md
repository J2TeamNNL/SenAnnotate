# Changelog — measure core

Written during the work. Records what actually happened, including the assumptions that
turned out false — not a summary of the plan.

## What shipped

A fourth inspect mode (`4`), a box-model overlay behind a toggle, a Measure card, and
three new report lines. `src/content/measure.ts` (engine), `ui/measure-overlay.ts`
(drawing + anchor state), `ui/measure-card.ts` (the card). No manifest change, no new
permission, no bridge RPC — the claim in `context.md` held.

## The engine bug the plan would have shipped

**`getComputedStyle(el).width` does not always return the content box.** The plan asserted
it does "whatever `box-sizing` says", and built `readBoxModel` on that: content from
computed `width`, border box derived by adding padding and border. It is wrong. Computed
`width` *respects* `box-sizing` — content box under `content-box`, border box under
`border-box`.

It surfaced as two e2e failures that at first looked like fixture mistakes: a badge
reading `320×48 (scaled)` on an element that is 296×32, and a dimension line reading
`48px` where 24px was expected. Measuring the fixture in a real browser rather than
reasoning about it gave the answer in one shot, and a second fact with it: **Chrome's UA
stylesheet already puts `<button>` in `border-box`**, so the fixture had been testing one
mode on its buttons and the other on its paragraph without saying so.

The consequence was not small. Over-counting the padding on every `border-box` element
means wrong figures on most of the modern web — a 296px control reported as 320px — in
the one part of the report that exists to be trusted numerically.

The fix inverts the derivation: the border box is **read from `getBoundingClientRect()`**,
which is what is actually painted, and the content box is what remains after the bands
come off it. `scaled` now compares the rect against `offsetWidth`/`offsetHeight` — the
layout border box, integer-rounded and immune to transforms — with a 1px tolerance that
is the rounding, not slack. SVG has no `offsetWidth` and is never flagged.

That also changed the file's premise. Sizes are now **rendered** pixels, which is what a
reviewer is looking at; the four bands stay layout pixels, because `getComputedStyle` has
no other kind; `scaled` marks the elements where the two genuinely differ. The banner
comment was rewritten to say that rather than the original "everything is layout pixels",
which was no longer true.

The fixture now declares `box-sizing` on every element and carries **both** modes on
purpose — `#save` and `#cancel` in `border-box`, `#note` in `content-box` — with a check
on each. An engine that trusts computed `width` gets exactly one of them wrong whichever
way it guesses, so the pair is the regression test.

## The second bug: the box described the wrong element

`currentMeasurements(target)` measured the element just clicked. But `captureDraft` makes
`elements[0]` — the **anchor** — the subject of the annotation: its name, its selector,
its `**Position:**`. So the report printed a `**Box:**` for the second element directly
beneath a `**Position:**` for the first, and the two silently disagreed. Caught by the
e2e report assertion, not by reading the code.

`box` is now read off the anchor. The second element is not lost — naming it is the whole
job of the `**Measured to:**` line.

## Two assumptions in the plan that were wrong about the code

**`pointermove` returns early on any mode but `point`** (`content/index.ts`). The plan
wired `drawMeasure` into `drawHover` and never noticed that `drawHover` is unreachable in
mode 4. The first e2e run hung waiting for a badge that could never appear. Measure now
shares the hover path with `point`, which is right in principle too: it is the same
"what is the pointer over" question with two more things drawn on top.

**Widening `InspectMode` in Task 1 breaks the build immediately.** `MODE_HINTS` is a
`Record<InspectMode, string>` in `toolbar.ts`, so adding `"measure"` to the union fails
`tsc` until the hint exists. The widening moved to Task 4, with the hint, so that every
commit on the branch typechecks on its own.

## Two deliberate deviations from the plan

**Tasks 4 and 5 were committed together.** The plan had the toolbar's Measure button in
Task 4 and the card it opens in Task 5, which would have put a button that does nothing
in the history for one commit. A reviewer cannot sensibly approve that, which is the
plan's own test for where a task boundary belongs.

**The Measure card mirrors `SettingsCard`'s real contract, not the plan's sketch.** The
plan gave it `update()`/`position(dock: DOMRect)`. The settings card actually exposes
`render()`/`anchorTo(box: DOMRect | null)`, and the `null` case matters: it means the dock
is in its default corner and the stylesheet already places the card, so the inline
placement must be *removed* rather than recomputed. The plan's version would have put the
two cards a few pixels apart. The CSS mirrors `.settings` for the same reason, including
the `data-inspecting` lift and the `data-anchored` release.

## Where `index.ts` landed

`docs/measure-core/implementation-plan.md` predicted roughly 60 added lines and treated
more as evidence that state had leaked out of `measure-overlay.ts`. It came to 186.

The state did not leak — the anchor lives in `MeasureOverlay`, and `index.ts` holds no
measurement state of its own. The estimate was simply wrong about what the plan itself had
put there: `toggleMeasureCard` and `measureCallbacks` account for ~43 lines and were
specified for `index.ts` from the start, and this repo's banner-comment density roughly
doubles any line count guessed from the code alone. The criterion was measuring the right
thing with the wrong number.

## Verification

- `node test/measure.mjs` — 31 checks. New file; also wired into `npm test` ahead of the
  browser suites, because a sign error should not need a browser to find.
- `npm run typecheck` — clean at every commit.
- `npm test` — **282/282** e2e and **9/9** upgrade, run locally with
  `SENANNOTATE_HEADLESS=1`. Six pre-existing hint assertions were updated in the same
  commit that changed the hints; that was predicted and is not a regression.

CI ran typecheck, build and pack only, as always — it never runs the suite, so its green
tick is not evidence for the line above.
