# Changelog — contrast

Written during the work.

## What shipped

`parseRgb`, `contrastRatio` and `contrastReport` in `content/measure.ts`; a
`ContrastReport` on `StyleSummary` and on `Measurements`; a coloured row on the readout
and a `**Contrast:**` line in the report at `detailed` and above.

Small, because `measure-core` had already paid for the hard part: resolving what colour
an element is *actually* painted on needs an ancestor walk, and `effectiveBackground`
already did it.

## Three test expectations I got wrong, and the code was right each time

Recording these because the pattern is the point — every one was me asserting a number I
had guessed rather than worked out.

1. **`rgba(0,0,0,0.5)` on white is 3.98:1, not the 5.32 I wrote.** Composited it is
   `rgb(127.5)`, luminance 0.2139, so `1.05 / 0.2639`. Worked by hand afterwards; the
   check now carries that derivation in a comment, because a number copied out of the
   implementation only asserts that the code agrees with itself.
2. **`#757575` on white is 4.61:1 and passes AA.** I picked it as "a grey that fails at
   body size and passes at large", which is exactly what it is not — it is the classic
   *just clears AA* grey. `#8a8a8a` at 3.45:1 sits in the only band where `large` changes
   the answer, which is the only band worth testing it in.
3. **The report assertion demanded a failing verdict from an annotation on `#save`**,
   which is white on `#2563eb` — 5.17:1, passes AA and misses AAA. Fixing the expectation
   rather than the code turned out to complete the set: the two readout checks cover an
   outright fail and a pass of both, so the report check now covers the middle verdict.

## The probe that tested the wrong element

The first run showed `#wrapper` — a `div` whose text lives in a `<span>` — producing a
verdict, which `hasOwnText` exists to prevent. The guard was fine. `elementFromPoint` at
the centre of the div lands on the span, and the span genuinely does have text of its own.

The fixture now gives the wrapper 24px of padding and the check hovers that, so the
pointer is over div and not child. Verified the other way too: with `hasOwnText` removed,
the check fails with `4.49:1 · fails AA` on the wrapper.

## Decisions worth keeping

**Alpha is composited before the ratio.** `rgba(0,0,0,0.5)` on white is not black on
white. Taking the ratio on the raw foreground reports 21:1 for text that is visibly grey —
a checker that errs in the *reassuring* direction is worse than no checker.

**WCAG's "large" is not the obvious threshold.** ≥ 24px, or ≥ 18.66px at weight ≥ 700.
Not 18px. Getting it wrong moves the pass mark by 1.5:1 and silently passes failing text,
so all four boundary cases have their own check.

**No suggested colours.** The report names the ratio and the threshold missed. Proposing
a replacement is a design decision and not one a number should be making.

**The verdict row is coloured outside the accent system.** Pass green, fail red and bold.
A red accent must not make a passing check look failed, so these two do not derive from
`--sa-accent` — the same exception, for the same reason, as the band colours.

## Verification

- `node test/measure.mjs` — 52 checks, up from 37.
- `npm run typecheck` — clean.
- `npm test` — **316/316** e2e, **9/9** upgrade.
- The `hasOwnText` guard was verified by deleting it and watching the wrapper check fail.
