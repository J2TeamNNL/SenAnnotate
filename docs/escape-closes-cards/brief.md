# Brief — Escape closes the open card

## What

Requested: with the **settings card** open, <kbd>Esc</kbd> should close it. Then, the same for
the **annotations panel**.

Before this, Escape did three things — cancel the composer, drop a half-built pick set, leave
inspect mode — and the two cards were the only surfaces it ignored, each needing a click on the
toolbar button that opened it.

## Why it matters

The composer already closes on Escape, so the key reads as "close the thing in front of me".
A card that ignores it is not a missing feature so much as an inconsistency the user has to
learn and remember.

## Scope

- Extend the Escape chain, innermost first, so one press never closes two layers.
- Keep the existing order's reasoning intact: a half-built pick set still wins over the panel
  and over leaving inspect mode.
- One check per new branch, plus one that a press aimed at a tooltip does *not* reach the card
  underneath it.
