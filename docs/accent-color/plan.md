# Plan

## 1. `src/shared/accent.ts` (new)

- `DEFAULT_ACCENT = "#f97316"`.
- `ACCENT_PRESETS` — six `{ value, label }`, checked against the ink rule below.
- `accentTheme(color)` → `{ accent, strong, ink }`:
  - invalid input (anything not `#rrggbb`) returns the default trio, because the value comes out
    of storage and storage can hold anything;
  - `strong` = `color-mix(in srgb, <color> 82%, black)`;
  - `ink` = `color-mix(in srgb, <color> 22%, black)` when the colour's relative luminance is
    above 0.3, else `color-mix(in srgb, <color> 18%, white)`. The threshold is set so the
    default orange (0.324) keeps dark ink, the way the hand-picked `#431407` does.

Values rather than variable names: the overlay's variables are `--sa-accent*` and the popup's are
`--accent*`, so the module returns colours and each caller names them.

## 2. `src/shared/types.ts`

`accentColor: string` on `Settings`, `DEFAULT_ACCENT` in `DEFAULT_SETTINGS`.

## 3. `src/content/ui/root.ts`

`setAccent(color)` on `UiRoot`: when the colour is the default, remove the three inline
properties and let the stylesheet stand; otherwise set `--sa-accent`, `--sa-accent-strong`,
`--sa-accent-ink` inline on the host.

## 4. `src/content/index.ts`

`ui.setAccent(settings.accentColor)` everywhere `ui.setTheme` is already called (boot,
`refreshSettings`, the settings-changed message), and pass the colour into `new ShotEditor(...)`.

## 5. `src/content/ui/shot-editor.ts`

Take the accent as a constructor argument instead of the module constant; keep the halo and
stroke width as they are.

## 6. `src/background/index.ts`

Read `SETTINGS_KEY` from `chrome.storage.sync` when painting the badge, falling back to the
default. It repaints on every count change, so reading at paint time needs no listener.

## 7. `static/popup.html` + `src/popup/index.ts`

A `.field` row in *Behaviour*: swatch buttons, `<input type="color">`, and a Reset button.
Swatches are rendered from `ACCENT_PRESETS`, the current one marked `aria-pressed`. All three
controls go through the existing `patch()`. The popup also recolours itself by setting
`--accent` / `--accent-ink` on `documentElement`.

## 8. `test/e2e.mjs`

Driven through the real popup, observed from a fixture page (never read a permission-gated API
from the popup — the suite hangs rather than fails):

1. a preset swatch changes `--sa-accent` on the host and the `.highlight` border colour;
2. the free picker takes an arbitrary colour;
3. a dark colour yields light ink — computed `--sa-accent-ink` resolves nearer white than black;
4. Reset removes the inline variables and the default orange is back;
5. a box drawn in the markup editor puts the chosen colour into the canvas pixels.

## 9. Verify

`npm run typecheck`, then all of `npm test`. The screenshot-markup and popup blocks are the
regression surface.
