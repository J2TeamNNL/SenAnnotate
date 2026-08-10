// =============================================================================
// Hover highlight + marquee rectangle
// =============================================================================

import { h } from "./dom";

export interface HighlightLabel {
  /** Human-readable element name, or the component name when we know it. */
  primary: string;
  /** Source reference, rendered in mono next to the name. */
  secondary?: string | null;
}

export class Overlay {
  private readonly boxes: HTMLElement[] = [];
  private readonly marquee: HTMLElement;
  private readonly layer: HTMLElement;

  constructor(layer: HTMLElement) {
    this.layer = layer;
    this.marquee = h("div", { class: "marquee", style: { display: "none" } });
    layer.append(this.marquee);
  }

  // ---------------------------------------------------------------------------
  // Highlight
  // ---------------------------------------------------------------------------

  /**
   * Draw a highlight around each rect. The first one carries the label; the rest
   * are drawn muted, which is what a marquee selection looks like.
   */
  showHighlights(rects: DOMRect[], label?: HighlightLabel): void {
    // Reuse the boxes we already have rather than thrashing the DOM on every
    // pointermove — this runs at mouse-move frequency.
    while (this.boxes.length < rects.length) {
      const box = h("div", { class: "highlight" });
      this.boxes.push(box);
      this.layer.append(box);
    }
    for (let i = rects.length; i < this.boxes.length; i++) {
      this.boxes[i].style.display = "none";
    }

    rects.forEach((rect, index) => {
      const box = this.boxes[index];
      box.style.display = "block";
      box.style.left = `${rect.left}px`;
      box.style.top = `${rect.top}px`;
      box.style.width = `${rect.width}px`;
      box.style.height = `${rect.height}px`;
      box.classList.toggle("highlight--muted", index > 0);

      // Only the first box gets a label, and only when one was supplied.
      box.replaceChildren();
      if (index === 0 && label) box.append(this.buildLabel(rect, label));
    });
  }

  private buildLabel(rect: DOMRect, label: HighlightLabel): HTMLElement {
    const element = h(
      "div",
      { class: "highlight__label" },
      h("span", { text: label.primary }),
      label.secondary ? h("span", { class: "highlight__source", text: label.secondary }) : null,
    );
    // Flip below the box when there is no room above it.
    if (rect.top < 26) element.dataset.flip = "true";
    return element;
  }

  hideHighlights(): void {
    for (const box of this.boxes) box.style.display = "none";
  }

  // ---------------------------------------------------------------------------
  // Marquee
  // ---------------------------------------------------------------------------

  showMarquee(rect: { left: number; top: number; width: number; height: number }): void {
    this.marquee.style.display = "block";
    this.marquee.style.left = `${rect.left}px`;
    this.marquee.style.top = `${rect.top}px`;
    this.marquee.style.width = `${rect.width}px`;
    this.marquee.style.height = `${rect.height}px`;
  }

  hideMarquee(): void {
    this.marquee.style.display = "none";
  }

  hideAll(): void {
    this.hideHighlights();
    this.hideMarquee();
  }
}

// -----------------------------------------------------------------------------
// Marquee hit-testing
// -----------------------------------------------------------------------------

const MAX_MARQUEE_ELEMENTS = 30;
const MIN_MARQUEE_SIZE = 6;

/**
 * Every element whose box intersects the marquee, keeping only the deepest ones.
 *
 * Without the ancestor pass you select the element AND every wrapper around it,
 * which produces a report full of anonymous `<div>`s. Dropping any element that
 * contains another hit leaves exactly the leaves the user drew across.
 */
export function elementsInRect(
  rect: { left: number; top: number; right: number; bottom: number },
  isEligible: (element: Element) => boolean,
): Element[] {
  if (rect.right - rect.left < MIN_MARQUEE_SIZE || rect.bottom - rect.top < MIN_MARQUEE_SIZE) {
    return [];
  }

  const hits: Element[] = [];

  for (const element of Array.from(document.body.querySelectorAll("*"))) {
    if (!isEligible(element)) continue;

    const box = element.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) continue;
    const intersects =
      box.left < rect.right && box.right > rect.left && box.top < rect.bottom && box.bottom > rect.top;
    if (intersects) hits.push(element);
  }

  const leaves = hits.filter((element) => !hits.some((other) => other !== element && element.contains(other)));

  return leaves.slice(0, MAX_MARQUEE_ELEMENTS);
}
