# Context

## What is being moved

Nine settings, in the popup's four existing groups — kept as they are so nobody has to
re-learn where anything lives.

| Group | Setting | Control after |
|---|---|---|
| Report | `detailLevel`, `componentMode`, `screenshotDelivery` | select |
| Report | `includeProps` | **toggle** |
| Bug reports | `captureDiagnostics` | **toggle** |
| Behaviour | `showMarkers`, `freezeOnInspect` | **toggle** |
| Appearance | `theme` | select |
| Appearance | `accentColor` | swatches + picker + Reset, unchanged |

`maxComponents` and `toolbarCollapsed` are in `Settings` but were never in the popup;
they stay out.

## Rules this must not break

- **Everything with a side effect belongs inside `installTopFrame()`.** The card
  constructor, the gear wiring and `toggleSettings` all have side effects. A module-scope
  `listen(...)` here puts a settings card in every iframe on the page.
- **`popup/` must never import from `content/`.** Removing settings from the popup makes
  this easier, not harder — but `shared/accent.ts` still has to return colours rather
  than variable names, because the popup keeps painting itself from the accent and calls
  them `--accent*` where the overlay calls them `--sa-accent*`.
- **Our UI must never deliver pointer events or focus to the page.** The tooltip lives
  inside the same shadow host, so it inherits the guards `createUiRoot` already installs.
- **Settings live in `chrome.storage.sync`**, keys in `shared/protocol.ts`. Unchanged.

## The trap most likely to cost a day

`chrome.storage.sync` is shared across every page in the suite's single browser context.
The collapse block already documents this and restores itself at the end:

> `toolbarCollapsed` lives in chrome.storage.sync, so a collapsed state left behind
> would follow every other page in this profile and break their `.tool--brand` clicks.

The new block flips real settings. Turning `showMarkers` off and leaving it off breaks
every later block that counts `.marker`. **Every setting the block touches must be put
back before it ends**, and the block should be positioned late in the run for the same
reason the collapse block is.

The annotation-count hazard applies too: a fixture another block annotates cannot carry
a count assertion, so this block needs a fixture of its own.

## Playwright semantics that constrain the CSS

`opacity: 0` counts as **visible**; only `display: none`, `visibility: hidden` or a
zero-sized box read as hidden. This already shaped the toolbar fold
(`docs/panel-toolbar-motion/`) and applies again to the settings card's exit and to the
tooltip — a tooltip that merely fades to transparent is still "visible" to a test.

## Why `Panel.destroy`'s exit logic gets extracted

`Panel.destroy` marks the node `data-leaving`, removes it on `animationend`, and carries
a timeout because a cancelled animation never fires that event. The settings card needs
exactly that. Copying it would produce two versions of a rule whose whole point is the
non-obvious fallback, so it moves to a shared helper in `ui/dom.ts` first.

## Toolbar knock-on

The gear is a new direct child of `.toolbar`, so it is picked up by the collapse fold
rule (`.toolbar > :not(.tool--collapse)`) with no change. `MODE_HINTS` is untouched —
the gear is not a mode. Collapsing closes the settings card, matching
`docs/collapse-dismisses/`.
