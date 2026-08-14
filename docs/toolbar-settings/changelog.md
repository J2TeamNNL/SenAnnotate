# Changelog

## Shipped

A gear in the toolbar opens a `Settings` card holding all nine settings. The popup keeps
status, the page list, the session report and Export/Import, and no longer writes any
setting — it still *reads* them, because it paints itself from `theme` and `accentColor`.

Built in the order `plan.md` set out, each step green before the next:

1. `dismissCard` extracted from `Panel.destroy` — 191/191, unchanged.
2. `ui/tooltip.ts`, one shared node.
3. `ui/settings.ts`, the card.
4. Wiring: `toggleSettings`, mutual exclusion with the panel, collapse closing it.
5. The popup stripped.
6. Tests migrated, then the new block added.
7. Docs.

## Three things the plan did not predict

**The card had no addressable controls.** Four `<select>`s shared one class, so no test —
and no person reading the DOM to work out which row was misbehaving — could tell them
apart. Every control now carries `data-setting="<key>"`. Found by needing it in
`upgrade.mjs`, which is a poor way to find an API gap but better than not finding it.

**`upgrade.mjs` drove the popup too.** The plan's audit covered `e2e.mjs` and stopped
there. That check sets `theme` and `detailLevel` on one version and reads them back on
the next, through the real controls on purpose — so it moved to driving the card, and
its `waitFor("#theme")` became `waitFor("#pages")`, since `#theme` no longer exists.

**A full-height card looked broken.** `.settings` first copied the panel's `bottom: 72px`
and came out two-thirds empty. The panel is a list that grows and wants the height; this
is a fixed set of rows. `max-height` instead, overflow to the body.

## The wrong turn

Two assertions failed: turning off numbered pins left `.marker` at 1, and the setting did
not appear to survive a reload. The obvious reading was that the toggle was not writing
anything, and the hunt went through `guarded()` in `dom.ts` (which passes `change`
through untouched), the host's `stopPropagation` handlers (all bubble-phase, so they
cannot pre-empt an inner listener) and the `mousedown` cancel (which exempts `input`).

A probe settled it: the checkbox went `true → false` and stayed there, with no console
error. The implementation was correct throughout.

`markers.ts:64` sets `pin.style.display = "none"` rather than removing the node, and
Playwright's `count()` counts hidden elements perfectly well. The assertions wanted
`.marker:visible`. **The test was wrong, not the code** — and the twenty minutes spent
reading event plumbing is the cost of assuming otherwise.

## Fixed in passing

`README.md`'s keybinding table never learned about ⌘/Ctrl+drag, which shipped two commits
earlier. A miss from that work, corrected here along with the new gear row and the note
that collapsing now leaves inspect mode.

## Verification

```
204/204 checks passed
9/9 upgrade checks passed
```

Twelve new assertions: the gear opens the card, the panel and the card close each other
both ways, the tooltip appears on hover *and* on keyboard focus and `Escape` dismisses
it, a toggle changes the page rather than just the checkbox, the change survives a
reload, collapsing closes the card, and — its own assertion, because a silent failure
here poisons every later block — the block restores `showMarkers` before it ends.

The card also renders correctly, which was checked by looking at it rather than inferred
from green tests.

## Known and accepted

On `chrome://` pages, the Web Store and the PDF viewer there is no toolbar and therefore
no way to reach any setting, including the two that are global rather than per-page.
The popup says where they went. Decided knowingly — `brief.md` has the alternative that
was rejected and why.
