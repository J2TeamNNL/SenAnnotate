# Context — what constrains the contrast work

Read [`docs/measure-core/context.md`](../measure-core/context.md) first. Everything it
says about the engine applies here unchanged: DOM-only, no bridge, no permission, and the
same rule that a figure must be as trustworthy on a production build as on a dev server.

## What is already built

| Already there | Where |
|---|---|
| `toHex()` — computed `rgb()/rgba()` → `#rrggbb` / `#rrggbbaa` / `transparent` | `content/measure.ts` |
| `effectiveBackground()` — walks ancestors to the first painted background, flags `inherited` and `image` | `content/measure.ts` |
| `readStyleSummary()` — returns both colours, the font size and the weight | `content/measure.ts` |
| The readout that will carry the row | `content/ui/measure-overlay.ts` |
| `Measurements` on the annotation, and its report block | `shared/types.ts`, `shared/output.ts` |

The only genuinely new code is the luminance formula and the thresholds.

## Constraints

**`toHex` is lossy for this purpose.** It returns a string, and contrast needs the
channels. The parse is currently inside `toHex`; it comes out into a shared `parseRgb`
so both callers use one parser rather than one parsing the other's output back.

**Alpha has to be composited, not ignored.** `rgba(0,0,0,0.5)` on white is not black on
white. Taking the ratio on the raw foreground reports 21:1 for text that is visibly grey,
which is the opposite of useful — a checker that is wrong in the *safe-looking* direction
is worse than no checker.

**The large-text thresholds are a trap worth stating.** WCAG's "large" is ≥ 18.66px when
bold and ≥ 24px otherwise — not 18px, and the bold cut-off is font-weight ≥ 700. Getting
this wrong moves the pass mark by 1.5:1 and silently passes text that fails.

**Only elements with their own text.** `color` on a wrapper paints nothing. The test is a
direct child text node with non-whitespace content — not `textContent`, which would
inherit every descendant's words and give a contrast figure for a whole page section.

**No suggested fixes.** The report says what the ratio is and what the threshold was.
Proposing a colour that would pass is a design decision, and one the reader is better
placed to make than a number is.

## The traps from `measure-core` that still apply

- **A presence assertion is not a rendering assertion.** Nine checks stayed green while an
  entire block of stylesheet was missing. Anything drawn here gets a computed-style check.
- **Verify a regression test by breaking the fix.** Two checks in the last release passed
  against broken builds until they were watched failing.
- **The e2e fixture must be its own** — `chrome.storage.local` is shared across the suite.
  This work extends `test/fixtures/measure.html`, which nothing else annotates.
