# Plan

Test first: the fixture and the assertions go in before the branch that makes them pass, so the
first run proves they fail for the right reason.

## 1. `test/fixtures/pick.html`

Three elements far enough apart that no sane rectangle contains all three and nothing else — a
header badge, a form label, a footer button. Its own fixture: the suite shares one browser
context and annotations are keyed on `origin + pathname`, so a page another block annotated
cannot carry a count assertion.

## 2. `test/e2e.mjs` — a block after the marquee one

1. ⌘+click two elements → hint reads `2 elements picked · …`, two `.highlight--preview` boxes,
   **no composer**.
2. ⌘+click the second again → back to one box, hint reads `1 element picked · …` (the toggle,
   and the singular).
3. Plain click the third → composer opens, `Selection: 3 elements`.
4. Submit → one note in the panel, and the report names all three elements.
5. `Esc` after two picks → boxes gone, hint back to the mode line, still inspecting.
6. `Enter` after two picks → composer opens on the set without a plain click.

## 3. `src/content/index.ts`

- `let picked: Element[] = []` beside the marquee state.
- `pickHint()` — `N element(s) picked · ⌘/Ctrl+click to add · Enter to annotate`, and the
  `(limit)` phrasing at `MAX_MARQUEE_ELEMENTS`.
- `drawPicked()` — filters detached nodes, then
  `overlay.showHighlights([hovered, ...picked], hoverLabel, { preview: true })`, or just the set
  when nothing eligible is hovered.
- `clearPicked()` — empties, restores the hover drawing and the hint.
- `commitPicked(extra?)` — appends `extra` if it is not already in the set, filters detached,
  clears, then `beginAnnotation(set)`.
- Branches in the three existing seams (click / `c`+`Enter` / `Escape`), plus `updateHover()` and
  `queueSync()` drawing through `drawPicked()` while a set exists, plus clearing in
  `setActive(false)` and the `1` / `2` / `3` mode cases.

## 4. Docs and README

`README.md` gains the modifier in its keybindings table; `docs/multi-pick/changelog.md` records
what the run turned up.

## 5. Verify

`npm run typecheck`, then `npm test` in full — 164 + 9 existing checks have to stay green, and
the marquee block is the one most likely to be disturbed, since both features draw preview boxes
and write the same hint line.
