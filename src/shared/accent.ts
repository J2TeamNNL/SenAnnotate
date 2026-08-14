// =============================================================================
// The accent colour
// =============================================================================
//
// One chosen colour has to reach four places that cannot see each other's styles:
// the overlay's shadow stylesheet, the popup's own document, the toolbar icon's badge
// (painted by the service worker) and a canvas `strokeStyle` in the markup editor. So
// this module returns *colours*, not variable names — the overlay calls them
// `--sa-accent*` and the popup calls them `--accent*`, and neither knowledge belongs
// here.
//
// It lives in `shared/` because the popup and the content script both need it, and that
// is the only directory both may import from.
// =============================================================================

export const DEFAULT_ACCENT = "#f97316";

/**
 * The one-click choices. Every one is checked against the ink rule below, so none of
 * them lands on unreadable text — which a hand-typed colour still can, and which is why
 * the free picker is the second option rather than the only one.
 */
export const ACCENT_PRESETS: { value: string; label: string }[] = [
  { value: DEFAULT_ACCENT, label: "Orange (default)" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#8b5cf6", label: "Violet" },
  { value: "#10b981", label: "Green" },
  { value: "#ec4899", label: "Pink" },
  { value: "#ef4444", label: "Red" },
];

export interface AccentTheme {
  /** The colour itself. */
  accent: string;
  /** Hover and active states, and accent-coloured text on a normal background. */
  strong: string;
  /** Text drawn *on* the accent. */
  ink: string;
}

const HEX = /^#[0-9a-f]{6}$/i;

/** One sRGB channel, linearised — the inner half of the relative luminance formula. */
function linear(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance, 0 (black) to 1 (white). */
function luminance(hex: string): number {
  const red = linear(parseInt(hex.slice(1, 3), 16));
  const green = linear(parseInt(hex.slice(3, 5), 16));
  const blue = linear(parseInt(hex.slice(5, 7), 16));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/**
 * Above this, the accent is light enough to carry dark text.
 *
 * 0.3 rather than a rounder number on purpose: the default orange measures 0.324, and its
 * hand-picked ink (`#431407`) is dark. A threshold above that would flip every colour
 * near the default to light ink and make the derived look disagree with the shipped one.
 */
const LIGHT_ENOUGH_FOR_DARK_INK = 0.3;

/**
 * The three colours a chosen accent implies.
 *
 * `color-mix()` rather than arithmetic here: the values are handed to CSS anyway, the
 * stylesheet already relies on it (Chrome 111, the extension's floor), and letting the
 * engine do it keeps the mix in the accent's own hue — which is what makes the ink read
 * as "very dark orange" rather than as grey.
 *
 * Anything that is not `#rrggbb` gets the default trio. The value arrives from
 * `chrome.storage.sync`, which is not a validated store: a hand-edited or future-version
 * value must degrade to the shipped colour rather than paint `undefined` into the UI.
 */
export function accentTheme(color: string): AccentTheme {
  const accent = HEX.test(color) ? color : DEFAULT_ACCENT;
  const dark = luminance(accent) > LIGHT_ENOUGH_FOR_DARK_INK;

  return {
    accent,
    strong: `color-mix(in srgb, ${accent} 82%, black)`,
    ink: dark
      ? `color-mix(in srgb, ${accent} 22%, black)`
      : `color-mix(in srgb, ${accent} 18%, white)`,
  };
}
