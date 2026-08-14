# Context — where the colour lives, and why it is four places

## The four holders

| Holder | Why it cannot read the others |
|---|---|
| `content/ui/styles.css` — `--sa-accent`, `--sa-accent-strong`, `--sa-accent-ink` (48 declarations) | Inside a shadow root; nothing outside it resolves those variables. |
| `static/popup.html` — `--accent`, `--accent-ink` | A separate document with its own stylesheet. |
| `background/index.ts` — the badge | A service worker. No document, no computed styles; `setBadgeBackgroundColor` takes a colour string. |
| `ui/shot-editor.ts` — canvas `strokeStyle` | A canvas takes a colour value; the stroke becomes pixels in a PNG. |

So the setting is one string and each holder is handed a colour. `shared/accent.ts` returns
`{ accent, strong, ink }` — values, not variable names — because two of the four use different
names for the same idea and the module has no business knowing either.

## The derivation, and the one part that is not "darken it"

- `strong` (hover, active, accent-coloured text) = `color-mix(in srgb, <accent> 82%, black)`.
- `ink` (text drawn **on** the accent) cannot be a darken: on `#0b3d91` navy, dark ink is
  invisible. It branches on the accent's relative luminance — dark ink for a light accent, light
  ink for a dark one.

`color-mix()` rather than arithmetic because the values go straight to CSS, the stylesheet
already depends on it, and mixing in the accent's own hue is what makes the ink read as "very
dark orange" rather than as grey. Chrome 111 is the extension's floor and shipped `color-mix`.

The luminance threshold is **0.3**, which looks arbitrary and is not: the default orange
measures 0.324 and its hand-picked ink (`#431407`) is dark. A rounder 0.35 would flip every
colour near the shipped one to light ink, so the derived look would contradict the shipped look
for colours a user cannot distinguish from it.

Measured luminance of the six presets: orange 0.324 and green 0.36 take dark ink; blue 0.236,
violet 0.20, pink 0.247 and red 0.227 take light ink. All six were checked before shipping the
list — which is the reason presets exist alongside the free picker rather than instead of it.

## The default is a no-op on purpose

The three oranges in the stylesheet are hand-picked and no derivation reproduces them:
`color-mix(#f97316 82%, black)` is `#d46213`, not the shipped `#ea580c`. So `setAccent` **removes**
its inline properties when the setting is the default rather than setting a derived trio, and
the shipped appearance stays identical down to the pixel. The e2e check for Reset asserts the
absence of the inline property, not just the resolved colour, because setting a derived orange
would pass a colour comparison while quietly changing every hover state.

## Reading a custom property back is not reading a colour

A custom property reads back as its own token — `getPropertyValue("--sa-accent-ink")` returns the
literal `color-mix(in srgb, #0b3d91 18%, white)`. To assert on the *colour*, the suite appends a
probe span inside the open shadow root, sets `color: var(--sa-accent-ink)` on it and reads the
computed value.

And the computed value of a mix is **`color(srgb 0.83 0.86 0.92)`**, not `rgb(…)` — channels
already 0-1. The first version of the check divided them by 255 and reported luminance `-1.00`,
which read as the feature being broken when the feature was right. Worth knowing before writing
any other assertion against a mixed colour.

## Validation

`accentColor` comes from `chrome.storage.sync`, which is not a validated store — a hand-edited
value, or one written by a future version, has to degrade rather than paint `undefined` into the
UI. `accentTheme()` returns the default trio for anything that is not `#rrggbb`, and every holder
goes through it, including the service worker.

## Related

- `upgrade-persistence/` — why a new settings field needs no migration: `loadSettings()` spreads
  over `DEFAULT_SETTINGS`, so a settings object written before this field existed gains the
  default.
- `screenshot-markup/` — the markup editor whose strokes this recolours, and why blur is
  destructive.
