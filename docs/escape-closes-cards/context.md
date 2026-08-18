# Context

## The chain

One `keydown` listener on `document`, installed in `installTopFrame` (`src/content/index.ts`,
~line 1380). Escape is handled *above* the "never hijack a key the user is typing into the
page" guard, so it fires whatever has focus — which is the point: the composer's textarea has
focus while it is open, and the settings card holds text inputs of its own.

Order after this task, innermost first:

| # | If | Then |
|---|---|---|
| 1 | a composer is open | close it |
| 2 | a tooltip is visible | hide it |
| 3 | the settings card is open | close it |
| 4 | elements are picked | drop the set, keep inspect mode |
| 5 | the panel is open | close it |
| 6 | inspect mode is on | leave it |

Each branch returns, so one press moves exactly one layer.

## Why the tooltip branch exists, and why it is not in `tooltip.ts`

`attachTooltip` used to listen for Escape on the trigger itself. A handler on the trigger runs
during the target phase, before the event reaches `document` — so by the time the chain above
looked, the tooltip was already hidden and the press fell through to the card. Measured as a
suite failure: the settings card closed under an Escape aimed at its own help tooltip, and the
next block clicked a checkbox on a card that was animating away (`element is not stable`, then
`element was detached`).

`isTooltipVisible()` exists so the chain can ask before anything hides it. The trigger-level
listener is gone; the module comment records why, because re-adding it looks like an
improvement.

## Why 4 comes before 5

The pick-set branch predates this work and its comment argues the case: a half-built set is
the thing Escape is most likely aimed at. The panel is a place you work *from* rather than a
prompt you answer, so it sits below that — but it is still above leaving inspect mode, because
closing a card is smaller than changing the tool's mode.

## Files

- `src/content/index.ts` — the chain.
- `src/content/ui/tooltip.ts` — `isTooltipVisible`, and the removed keydown listener.
- `test/e2e.mjs` — the settings block, ~line 1780.
- `README.md` — the keybinding table's `Esc` row now spells the order out.
