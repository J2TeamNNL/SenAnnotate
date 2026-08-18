# Plan — the settings card follows the dragged toolbar

Test-first, in the order the e2e suite can observe the change: the assertions go in
before the behaviour, so a run in between proves they are measuring something real.

## 1. Checks first, in the drag block

`test/e2e.mjs`, against `test/fixtures/drag.html`, which already has a drag helper and a
dock to drag. All geometry read from the shadow root in one `evaluate`, comparing
`getBoundingClientRect()` of `.toolbar-dock` and `.settings`:

- after a drag: card right edge == dock right edge (±1px for subpixel), card bottom ==
  dock top − 8
- mid-drag, before the pointer is released: the same relationship
- pill dragged near the top: card top > dock bottom (it flipped below)
- the annotations panel with the pill moved: still at `right: 20px`, i.e. *not* following
- pill returned to the default corner: `.settings` carries no inline `left`/`top`

Run the suite. The first four must fail; the last must pass. Anything else means the
checks are wrong, not the code.

## 2. `Toolbar.dockBox()`

Returns `this.element.getBoundingClientRect()` when `dataset.floating === "true"`, else
`null`. No state of its own — the DOM is already the source of truth, and a cached box
would go stale on every resize.

## 3. `Toolbar` callback `onDockShift`

Optional in `ToolbarCallbacks`. Fired at the end of `paintPosition()` and from the
`applyPosition(null)` branch, so returning to the corner is a shift too.

## 4. `SettingsCard.anchorTo(box: DOMRect | null)`

Mirrors `Composer.position()`: `EDGE = 12`, `GAP = 8`.

- `null` → remove `data-anchored`, remove inline `left`/`top`, return.
- otherwise → `left = box.right - width`, clamped to `[EDGE, innerWidth - width - EDGE]`;
  `top = box.top - height - GAP`, and if that is above `EDGE`, try `box.bottom + GAP`,
  clamping to keep the card on screen. Set `data-anchored="true"` before writing, so the
  released `bottom`/`right` are in effect when the box is measured.

## 5. CSS

```css
.settings[data-anchored="true"] { bottom: auto; right: auto; }
```

and switch the inspect-mode clearance off for the anchored case.

## 6. Wire it up in `index.ts`

- `toggleSettings(true)`: after `settingsCard.render(settings)`, call
  `settingsCard.anchorTo(toolbar.dockBox())`.
- `onDockShift`: `settingsCard?.anchorTo(toolbar.dockBox())`.

## 7. Run the suite

All new checks pass, and the 252 that were passing still do — in particular the settings
block's "the settings card clears the hint line", which measures the default corner.

## 8. Docs

`changelog.md` as the work happens, including anything that turned out false. Register the
folder in `docs/README.md`.
