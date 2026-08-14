# Brief — a setting for the extension's colour

## What

The accent is orange in three unrelated places and hardcoded in all three. This makes it one
setting: six presets plus a free colour picker in the popup, applied to the on-page overlay, the
toolbar icon's count badge, the strokes the screenshot markup editor draws, and the popup's own
chrome.

## Why it is not just one CSS variable

`--sa-accent` covers 48 declarations in `content/ui/styles.css`, and that is the easy third.
The other two are `background/index.ts` (the badge, painted by the service worker, which cannot
see the overlay's stylesheet) and `ui/shot-editor.ts` (a canvas `strokeStyle`, which cannot see
a CSS variable either). The popup has its own `--accent` because it is a separate document.

Two derived values make it more than a substitution: `--sa-accent-strong` (hover and active)
and `--sa-accent-ink` (text *on* the accent). Today both are hand-picked oranges. A chosen
colour has to derive them, and the ink cannot be derived by darkening — on a dark navy, dark ink
is invisible. It needs the accent's luminance.

## Scope

- `accentColor` in `Settings`, default `#f97316`, in `chrome.storage.sync` under the existing
  settings key — so it survives upgrades by the contract `upgrade-persistence/` pins.
- `shared/accent.ts`: the presets and one derivation, imported by both the popup and the content
  script, since `shared/` is the only place both may import from.
- Live: the popup writes, `onSettingsChanged` already carries it to every open tab.
- **The default look does not change.** When the setting is the default, no inline variable is
  set at all and the stylesheet's hand-tuned trio stands.

## Out of scope

- Per-annotation colours. One colour for the tool, not a palette per note.
- Recolouring screenshots already saved. The strokes are pixels in a PNG by then.
- A second colour for the "done" state or for markers. They read from the same accent today and
  keeping that is the point.

## Done when

The suite drives the real popup: a preset changes the overlay's accent and the highlight border
in an open tab, the free picker takes an arbitrary colour, Reset returns to orange, a dark
accent produces light ink rather than black-on-black, and a box drawn in the markup editor is
stroked in the chosen colour.
