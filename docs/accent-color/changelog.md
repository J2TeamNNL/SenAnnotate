# Changelog

## What shipped

`accentColor` in `Settings` (default `#f97316`), a row in the popup's *Behaviour* section with
six preset swatches, a free `<input type="color">` and a Reset, and the colour reaching all four
holders: the overlay's shadow stylesheet, the popup's own document, the toolbar badge painted by
the service worker, and the markup editor's canvas strokes.

New file: `src/shared/accent.ts` — `DEFAULT_ACCENT`, `ACCENT_PRESETS`, and `accentTheme(color)`
returning `{ accent, strong, ink }`. Touched: `shared/types.ts`, `content/ui/root.ts`
(`setAccent`), `content/index.ts`, `content/ui/shot-editor.ts`, `background/index.ts`,
`static/popup.html`, `src/popup/index.ts`.

Live in open tabs with no new plumbing: the popup writes settings, and `onSettingsChanged` was
already carrying theme changes to every tab.

## Two things found while doing it

- **`onModeChange` did not clear the pick set.** Not this feature's code — the toolbar's mode
  buttons go through that callback while the keyboard's `1`/`2`/`3` go through the keydown
  switch, and `multi-pick/` had only covered the second. Switching mode with the toolbar left a
  set alive in a mode that cannot commit it. Fixed here because it was found here.
- **Three call sites were about to drift.** `ui.setTheme(settings.theme)` appeared at boot, in
  the `storage.onChanged` handler and in `refreshSettings`, and the accent needed the same three.
  Replaced by one `applyAppearance()`, so a third appearance setting cannot be added to two of
  them.

## The assertion that lied

The dark-accent check failed on the first run:

```
FAIL  a dark accent gets light ink rather than black on black
      — accent rgb(11, 61, 145), ink color(srgb 0.827765 0.863059 0.922353) (luminance -1.00)
```

The ink was correct — 0.83/0.86/0.92 is nearly white, exactly what navy should get. The *test*
was wrong: a `color-mix()` result computes to `color(srgb …)` with channels already in 0-1, and
the parser assumed `rgb(…)` and divided by 255. Recorded because the failure read as a broken
feature, and because any future assertion on a mixed colour will hit it.

## Deliberate calls

- **The default sets nothing.** `setAccent` removes its inline properties for the shipped orange
  instead of writing a derived trio, because no derivation reproduces the hand-picked
  `#ea580c`/`#431407`. The Reset check asserts the inline property is *absent*, not merely that
  the colour resolves to orange — otherwise a derived orange would pass while changing every
  hover state.
- **The ink branches on luminance at 0.3.** Set from the default orange's own 0.324, so colours
  indistinguishable from the shipped one keep the shipped one's dark ink. `context.md` has the
  measurement for all six presets.
- **Screenshots already saved keep their old strokes.** They are pixels in a PNG by then. Only
  new markup takes the new colour.
- **The badge reads the setting at paint time.** No cache and no listener: it repaints on every
  count change, and a service worker is torn down between events anyway.

## Verified

`181/181` in the suite — seven new checks — and `9/9` in `test/upgrade.mjs`. The new fixture is
`test/fixtures/accent.html`. Each of the four holders is checked where it lands: the resolved
`--sa-accent` and the `.highlight` border in a live tab, the popup's own `--accent`, the canvas
pixels after drawing a box (scanned for the exact colour), and
`chrome.action.getBadgeBackgroundColor` evaluated **inside the service worker**, which is the only
context that can read the badge back. The block resets to the default at the end so every later
block runs in the shipped colour.
