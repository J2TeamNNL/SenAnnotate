# Settings move into the toolbar

## What

A gear button in the toolbar opens a `Settings` card holding all nine settings. The
popup loses them entirely and keeps the work that is genuinely cross-page.

## Why

Changing a setting meant leaving the page: click the extension icon, change it, dismiss
the popup, look at the page again to see what it did. Every setting here is *about* what
you are looking at — the detail level of the report you are about to copy, whether pins
show, whether animations freeze. The control belonged next to the thing it changes.

## Decisions taken, and what they cost

| Decision | Rejected alternative | Why |
|---|---|---|
| Settings move **entirely**; popup keeps status, Pages, session report, Export/Import | Mirroring them in both | Two UIs for one state means syncing both ways and adding every future setting twice |
| A **separate card** opened by a gear | A tab inside the Annotations panel; a small popover | The card reuses `.card` chrome and the exit animation already written; nine controls plus a colour picker is too much for a popover |
| A **hand-built tooltip** | The browser's `title=` | `title` is free and accessible but waits about a second and cannot be styled |
| `content/ui/settings.ts`, one card class | A `settings/` folder per section; a declarative schema shared with the popup | The schema's payoff was a second consumer, and the popup is losing its settings — the payoff evaporates and only the abstraction is left |
| Accept the `chrome://` hole | Keeping theme and accent in the popup | One home beats a defensible-but-split one; a page the extension cannot run on is a page with nothing to annotate |

## Known cost of the last one

On `chrome://` pages, the Chrome Web Store and the PDF viewer there is no toolbar, so
there is no way to change any setting — including `theme` and `accentColor`, which are
global rather than per-page. The popup will say where settings went. Accepted knowingly.

## Two duplications, deliberately kept

- **The panel keeps its own detail-level select.** It sits next to Copy, which is the
  moment the setting matters. Both read one `settings` object owned by `index.ts`, so
  staying in step is free — this is not the popup↔overlay duplication `CLAUDE.md`
  warns about.
- **`componentMode` remains independently settable** while `detailLevel` still moves it
  to a preset. The preset suggests; it does not lock.
