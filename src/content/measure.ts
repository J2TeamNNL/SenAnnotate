// =============================================================================
// Measuring — arithmetic over rects and computed styles
// =============================================================================
//
// This file reads the DOM and nothing else. No bridge, no framework knowledge, no
// state — the same contract `identify.ts` keeps, and for the same reason: a measured
// figure has to be exactly as trustworthy on a minified production build as on a dev
// server, and it is the only part of the report that can promise that.
//
// Sizes are **rendered** pixels — the box as it is actually painted — because that is
// what a reviewer is looking at when they say something is too small. The four bands are
// layout pixels, because `getComputedStyle` has no other kind. The two agree on every
// untransformed element, and `BoxModel.scaled` is set on the ones where they do not.
// =============================================================================

import type { BoxModel, Containment, GapGeometry, Sides, StyleSummary } from "../shared/types";

/** Everything with a viewport-space box. `DOMRect` satisfies it structurally. */
export interface RectLike {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/**
 * Two decimal places, trailing zeros gone, and never `-0`.
 *
 * Not `Math.round`. A browser's own inspector rounds to integers, which silently
 * turns the half-pixel seam a reviewer is pointing at into `0px` — the one figure
 * that would make them doubt their own eyes.
 */
export function roundPx(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return rounded === 0 ? 0 : rounded;
}

function px(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** `padding-top` … `padding-left`, or `border-top-width` … when `suffix` is given. */
function sides(style: CSSStyleDeclaration, prefix: string, suffix = ""): Sides {
  return {
    top: roundPx(px(style.getPropertyValue(`${prefix}-top${suffix}`))),
    right: roundPx(px(style.getPropertyValue(`${prefix}-right${suffix}`))),
    bottom: roundPx(px(style.getPropertyValue(`${prefix}-bottom${suffix}`))),
    left: roundPx(px(style.getPropertyValue(`${prefix}-left${suffix}`))),
  };
}

/**
 * The four bands, plus whether the element is drawn at these numbers.
 *
 * The border box is **read from the rect**, not derived from computed `width`. Computed
 * `width` respects `box-sizing`: it is the content box under `content-box` and the
 * border box under `border-box`, and Chrome's own UA stylesheet puts `<button>` in the
 * second group. Deriving from it therefore over-counts the padding on most of the
 * modern web — measured on a plain `<button>`, a 296px control reported 320px.
 *
 * So the rect is the one source of truth for the outside, and the content box is what
 * is left after the bands are taken off it.
 */
export function readBoxModel(
  element: Element,
  style: CSSStyleDeclaration = getComputedStyle(element),
): BoxModel {
  const padding = sides(style, "padding");
  const border = sides(style, "border", "-width");
  const margin = sides(style, "margin");

  const rect = element.getBoundingClientRect();
  const width = roundPx(rect.width);
  const height = roundPx(rect.height);

  const content = {
    width: roundPx(rect.width - padding.left - padding.right - border.left - border.right),
    height: roundPx(rect.height - padding.top - padding.bottom - border.top - border.bottom),
  };

  // `offsetWidth` is the layout border box, integer-rounded and immune to transforms;
  // the rect is the painted one. Comparing them catches a transform, a page zoom and a
  // scaled ancestor alike, without walking the tree. The 1px tolerance is the rounding
  // in `offsetWidth`, not slack. SVG has no `offsetWidth`, so it is never flagged.
  const layout =
    element instanceof HTMLElement
      ? { width: element.offsetWidth, height: element.offsetHeight }
      : null;
  const scaled =
    layout !== null &&
    (Math.abs(rect.width - layout.width) > 1 || Math.abs(rect.height - layout.height) > 1);

  return { width, height, content, padding, border, margin, scaled };
}

function contains(outer: RectLike, inner: RectLike): boolean {
  return (
    inner.left >= outer.left &&
    inner.right <= outer.right &&
    inner.top >= outer.top &&
    inner.bottom <= outer.bottom
  );
}

/**
 * The space between two rects, per axis.
 *
 * One expression covers apart, touching and overlapping, with no branch to get the
 * sign wrong in: the overlap along an axis is `min(rights) - max(lefts)`, so its
 * negation is the empty space — positive when they are apart, zero when they touch,
 * negative by the overlap when they are not.
 */
export function measureGap(a: RectLike, b: RectLike): GapGeometry {
  const gap = {
    x: roundPx(-(Math.min(a.right, b.right) - Math.max(a.left, b.left))),
    y: roundPx(-(Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))),
  };

  const edges: Sides = {
    top: roundPx(b.top - a.top),
    right: roundPx(b.right - a.right),
    bottom: roundPx(b.bottom - a.bottom),
    left: roundPx(b.left - a.left),
  };

  const center = {
    x: roundPx((b.left + b.right) / 2 - (a.left + a.right) / 2),
    y: roundPx((b.top + b.bottom) / 2 - (a.top + a.bottom) / 2),
  };

  let containment: Containment = "none";
  if (contains(a, b)) containment = "b-inside-a";
  else if (contains(b, a)) containment = "a-inside-b";

  return { gap, edges, center, containment };
}

// -----------------------------------------------------------------------------
// Style summary — what the overlay shows next to the box
// -----------------------------------------------------------------------------

const RGB = /^rgba?\(([^)]+)\)$/;

/**
 * `rgb(37, 99, 235)` → `#2563eb`. Eight digits when it is not opaque, the word
 * `transparent` when it is not there at all.
 *
 * Anything this cannot parse is returned unchanged rather than guessed at: Chrome has
 * begun answering some declarations in `color(srgb …)`, and a wrong swatch is worse
 * than an unfamiliar string the reader can still look up.
 */
export function toHex(value: string): string {
  const match = RGB.exec(value.trim());
  if (!match) return value;

  const parts = match[1].split(",").map((part) => Number.parseFloat(part));
  if (parts.length < 3 || parts.some((part) => !Number.isFinite(part))) return value;

  const alpha = parts.length > 3 ? parts[3] : 1;
  if (alpha === 0) return "transparent";

  const pair = (channel: number) =>
    Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, "0");
  const hex = `#${pair(parts[0])}${pair(parts[1])}${pair(parts[2])}`;
  return alpha === 1 ? hex : `${hex}${pair(alpha * 255)}`;
}

/**
 * The first background actually painted behind this element.
 *
 * Most elements declare none, so a swatch showing the element's own `background-color`
 * says `transparent` on nearly everything — true, and useless. Walking up until
 * something opaque appears is what a reader means by "what colour is it on".
 *
 * A gradient or an image cannot be reduced to one swatch, so it is reported as a flag
 * rather than sampled. Sampling a pixel is the eyedropper's job, not this one's.
 */
function effectiveBackground(element: Element): { color: string; inherited: boolean; image: boolean } {
  let current: Element | null = element;
  let inherited = false;

  while (current) {
    const style = getComputedStyle(current);
    if (style.backgroundImage !== "none") {
      return { color: toHex(style.backgroundColor), inherited, image: true };
    }
    const color = toHex(style.backgroundColor);
    if (color !== "transparent") return { color, inherited, image: false };

    current = current.parentElement;
    inherited = true;
  }

  return { color: "transparent", inherited: false, image: false };
}

/**
 * `style` is threaded in so the caller can share one declaration with `readBoxModel`.
 * Reading a property off it is what forces the style recalculation, and this runs at
 * pointermove frequency.
 */
export function readStyleSummary(
  element: Element,
  style: CSSStyleDeclaration = getComputedStyle(element),
): StyleSummary {
  const background = effectiveBackground(element);
  // A whole font stack does not fit and does not help; the first family is the answer.
  const family = style.fontFamily.split(",")[0].replace(/["']/g, "").trim();
  const radius = style.borderRadius;

  return {
    fontSize: style.fontSize,
    lineHeight: style.lineHeight,
    fontFamily: family,
    fontWeight: style.fontWeight,
    color: toHex(style.color),
    background: background.color,
    backgroundInherited: background.inherited,
    backgroundIsImage: background.image,
    display: style.display,
    radius: radius === "0px" ? "" : radius,
  };
}
