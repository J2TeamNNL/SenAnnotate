# Plan

Ordered so each step leaves the suite green.

## 1. Extract the card exit helper

Move `Panel.destroy`'s `data-leaving` / `animationend` / timeout logic into
`dismissCard(element)` in `ui/dom.ts`; `Panel.destroy` calls it. No behaviour change,
so the suite must stay at its current count.

## 2. Tooltip

`ui/tooltip.ts` — one shared node in `ui.cardLayer`, `attachTooltip(trigger, text)`.
Shown on `pointerenter` and `focus`, hidden on `pointerleave`, `blur`, `Escape` and
scroll. Positioned above, clamped to the viewport, flipped below when there is no room.
`role="tooltip"` and `aria-describedby` both ways. Enters with `vt-rise`, no exit.
Triggers are `<button class="hint-dot">`, never a `<span>`, so the keyboard reaches them.

## 3. Settings card

`ui/settings.ts` — `SettingsCard(layer, callbacks)` with `render(settings)`, `destroy()`.
Four groups, `label + ⓘ` left and control right. A `.switch` for the four booleans, the
existing select markup for the four enums, and the accent swatches lifted from the popup.
Help text lives beside each row's definition, not in a separate table.

## 4. Wire it

In `index.ts`, inside `installTopFrame()`:

- `settingsCard: SettingsCard | null` and `toggleSettings(force?)`, mirroring
  `togglePanel` — opening closes the panel, and `togglePanel` closes settings.
- `settingsCallbacks` at module scope beside `panelCallbacks`.
- `render()` gains `settingsCard?.render(settings)` so a change from another tab lands.
- `toggleCollapsed(true)` closes it, alongside the panel.
- A `.tool--settings` gear button in `toolbar.ts` with `aria-pressed`.

## 5. Strip the popup

Delete the `Report`, `Bug reports` and `Behaviour` sections from `static/popup.html` and
their wiring from `popup/index.ts`. Keep `loadSettings` — the popup still paints itself
from `theme` and `accentColor` — and drop the writes. Add one line saying where settings
went.

## 6. Migrate the tests, then add new ones

**Migrate first, separately**, so a failure is unambiguous: every assertion that drives a
setting through the popup moves to driving the card. The accent block is the largest.
Audit rather than assume — grep the suite for popup control ids.

Then the new block, on **its own fixture**, positioned late in the run:

- the gear opens the card, and opening it closes the panel
- a toggle changes observable behaviour: `showMarkers` off → no `.marker`
- the change survives a reload
- collapsing closes the card
- the tooltip appears on hover **and** on keyboard focus, and `Escape` hides it
- **every setting the block touched is restored before it ends**

## 7. Docs, README and the tester guide

`docs/README.md` entry, plus four places that state where settings live — checked, not
assumed:

| File | Line | Says |
|---|---|---|
| `README.md` | 177 | accent is in "the popup's *Behaviour* section" |
| `README.md` | 245 | detail levels "chosen in the panel or the extension popup" |
| `README.md` | 570 | the file tree: `popup/ settings, session report, export/import` |
| `TESTER-GUIDE.md` | 90 | "The extension's popup has an **Accent colour** row" |
| `TESTER-GUIDE.md` | 236 | the same sentence **in Vietnamese** |

**`TESTER-GUIDE.md` is bilingual.** Both halves say it, and it ships inside the zip
`npm run pack` produces — a half-translated guide is the failure mode to watch for here.

## Sequencing note

Steps 1 and 6-migrate are the two that can be verified green on their own. Do them as
separate commits so the review can see that the refactor and the migration changed
nothing, before the new behaviour arrives.
