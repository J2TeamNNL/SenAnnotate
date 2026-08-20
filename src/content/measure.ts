// =============================================================================
// Measuring — arithmetic over rects and computed styles
// =============================================================================
//
// This file reads the DOM and nothing else. No bridge, no framework knowledge, no
// state — the same contract `identify.ts` keeps, and for the same reason: a measured
// figure has to be exactly as trustworthy on a minified production build as on a dev
// server, and it is the only part of the report that can promise that.
//
// Every figure is a **layout pixel**. See the note above `Sides` in `shared/types.ts`
// for why mixing in post-transform rects would be wrong.
// =============================================================================

import type { BoxModel, Containment, GapGeometry, Sides } from "../shared/types";

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
 * Chrome's computed `width`/`height` resolve to the **content** box whatever
 * `box-sizing` says, so the border box is derived rather than read — that way one
 * source of truth feeds every figure and they cannot disagree by a rounding step.
 */
export function readBoxModel(element: Element): BoxModel {
  const style = getComputedStyle(element);
  const padding = sides(style, "padding");
  const border = sides(style, "border", "-width");
  const margin = sides(style, "margin");

  const content = {
    width: roundPx(px(style.width)),
    height: roundPx(px(style.height)),
  };
  const width = roundPx(content.width + padding.left + padding.right + border.left + border.right);
  const height = roundPx(
    content.height + padding.top + padding.bottom + border.top + border.bottom,
  );

  // One comparison catches transforms, page zoom and `scale()` on an ancestor alike,
  // without walking the tree: if the rendered rect is not the layout box, say so.
  const rendered = element.getBoundingClientRect();
  const scaled = Math.abs(rendered.width - width) > 0.5 || Math.abs(rendered.height - height) > 0.5;

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
