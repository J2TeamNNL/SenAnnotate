# Changelog

## What shipped

Escape now closes the settings card and the annotations panel, in a chain that moves exactly
one layer per press: composer → focused tooltip → settings card → picked set → panel → inspect
mode. `README.md` and `TESTER-GUIDE.md` (both languages) say so in the keybinding tables, which
previously read only "Cancel / exit".

## The wrong turn, and what it taught

First attempt put tooltip dismissal at the top of the chain unconditionally. The suite caught
it twice, and the second failure is the interesting one.

**Failure 1 — `Escape closes the settings card — 1 cards`.** The check presses Escape right
after clicking the gear, so the pointer is still resting on the gear — and the gear now shows a
tooltip on hover (`../toolbar-legibility/`). Escape went to the tooltip and the card stayed
open. Not a test artefact: click the gear, press Escape, nothing happens, because something
invisible-by-then had claimed the key.

So the branch narrowed to tooltips shown **by focus**. A hovered tooltip is dismissed by
moving the pointer — it has no business swallowing a key aimed at the card underneath. A
focused one cannot be dismissed that way, which is the case Escape exists for.

**Failure 2 — a cascade.** With the card left open, the block's next `gear.click()` closed it
instead of opening it, and the checks after that ran against a card mid-animation:
`element is not stable`, then `element was detached from the DOM`, then a 30s timeout and a
harness error rather than a clean FAIL. Worth remembering when a suite failure looks like a
Playwright problem: two blocks down from a state bug, that is what it looks like.

## Why `tooltip.ts` lost its Escape handler

It had one on each trigger. A trigger-level handler runs during the target phase, so by the
time the document-level chain looked, the tooltip was already hidden and the press fell through
to the card — one press, two layers. `isFocusTooltipVisible()` is what the chain asks instead,
and the module comment says why re-adding the local handler would be a regression.

## Results

```
222/222 e2e checks (was 217 — five new)      9/9 upgrade checks      typecheck clean
```

New checks: Escape closes the settings card · dismissing a tooltip does not close the card
under it · Escape closes the annotations panel · plus the two from
`../toolbar-legibility/`.
