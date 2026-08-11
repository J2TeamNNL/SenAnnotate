// =============================================================================
// Marquee hit-testing
// =============================================================================
//
// `overlay.ts` draws; this decides what is inside the box. They were one file
// until the drag gained a live preview: answering "what is selected" sixty times
// a second needs a cached snapshot, which is not a drawing concern.
// =============================================================================

import { isAnnotatable } from "../identify";

/** Nothing smaller counts as a drag, so a stray click selects nothing. */
const MIN_MARQUEE_SIZE = 6;

/** Ceiling on one selection. Reaching it is surfaced in the toolbar hint. */
export const MAX_MARQUEE_ELEMENTS = 30;

/**
 * Sub-pixel layout means an exact containment test rejects elements the user
 * plainly enclosed. One pixel of slack per edge.
 */
const CONTAIN_TOLERANCE = 1;

/** A rect in document space — viewport coordinates plus the scroll offset. */
export interface DocRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Candidate {
  element: Element;
  rect: DocRect;
}

export interface MarqueeHits {
  elements: Element[];
  /** Same order and length as `elements`, for drawing without touching the DOM. */
  rects: DocRect[];
  /** True when `MAX_MARQUEE_ELEMENTS` cut the list short. */
  capped: boolean;
}

/**
 * Measure every annotatable element once, in document coordinates.
 *
 * Called on pointerdown and never again for the life of the drag. A
 * `getBoundingClientRect()` per element forces layout; doing that on every
 * pointermove is the difference between a smooth drag and a janky one on the
 * complex pages this tool exists for. Page layout does not change while a mouse
 * button is held, and document coordinates make scrolling a non-event.
 *
 * `position: fixed` elements are the known exception — they do not move in
 * document space when the page scrolls, so a mid-drag scroll misplaces them.
 * See `docs/marquee-select/context.md`.
 */
export function snapshotCandidates(): Candidate[] {
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const candidates: Candidate[] = [];

  for (const element of Array.from(document.body.querySelectorAll("*"))) {
    // `isAnnotatable` already rejects our own UI, so there is deliberately no
    // second `isOurUi` call here the way `eligible()` has one: it is a
    // shadow-crossing ancestor walk, and this loop covers the whole document.
    if (!isAnnotatable(element)) continue;

    const box = element.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) continue;

    candidates.push({
      element,
      rect: {
        left: box.left + scrollX,
        top: box.top + scrollY,
        right: box.right + scrollX,
        bottom: box.bottom + scrollY,
      },
    });
  }

  return candidates;
}

/**
 * Every element the box swallowed whole, at the shallowest level swallowed whole.
 *
 * Two halves, both learnable from a single drag now that the result is previewed:
 *
 * *Contained*, not merely touched — a box's edge should not recruit whatever it
 * grazes, or the selection turns on pixels the user was not thinking about.
 *
 * *Outermost*, not the leaves. The rule this replaces kept leaves, reasoning that
 * ancestors "produce a report full of anonymous divs". On real markup that is
 * backwards: the card is the named element and the title/body wrappers inside it
 * are the anonymous ones, so leaves-only guarantees the anonymous layer.
 */
export function hitsInRect(candidates: Candidate[], box: DocRect): MarqueeHits {
  if (box.right - box.left < MIN_MARQUEE_SIZE || box.bottom - box.top < MIN_MARQUEE_SIZE) {
    return { elements: [], rects: [], capped: false };
  }

  const contained: Candidate[] = [];
  for (const candidate of candidates) {
    const { rect } = candidate;
    if (
      rect.left >= box.left - CONTAIN_TOLERANCE &&
      rect.top >= box.top - CONTAIN_TOLERANCE &&
      rect.right <= box.right + CONTAIN_TOLERANCE &&
      rect.bottom <= box.bottom + CONTAIN_TOLERANCE
    ) {
      contained.push(candidate);
    }
  }

  // An element is outermost when no ancestor of it was also contained. Walking
  // up against a Set is O(depth) per element; comparing every pair with
  // `contains()` would be O(n²) DOM walks, which is affordable once on
  // pointerup but not on every animation frame.
  const containedElements = new Set(contained.map(({ element }) => element));
  const outermost = contained.filter(({ element }) => {
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      if (containedElements.has(parent)) return false;
    }
    return true;
  });

  // `querySelectorAll` yields document order and every step above preserves it,
  // so the report lists elements in the order they appear on the page.
  const kept = outermost.slice(0, MAX_MARQUEE_ELEMENTS);

  return {
    elements: kept.map(({ element }) => element),
    rects: kept.map(({ rect }) => rect),
    capped: outermost.length > MAX_MARQUEE_ELEMENTS,
  };
}

/** Document-space box → viewport-space rect, for drawing. */
export function toViewport(box: DocRect): {
  left: number;
  top: number;
  width: number;
  height: number;
} {
  return {
    left: box.left - window.scrollX,
    top: box.top - window.scrollY,
    width: box.right - box.left,
    height: box.bottom - box.top,
  };
}
