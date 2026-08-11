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

/** Anything with a viewport-space box — `DOMRect` satisfies it structurally. */
export interface HighlightRect {
  left: number;
  top: number;
  width: number;
  height: number;
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
   * Draw a highlight around each rect.
   *
   * Normally the first one carries the label and the rest are drawn muted, which
   * is what a saved multi-element annotation looks like. `preview` is the marquee
   * case: every box is the live selection, so none of them is secondary, and the
   * position transition is dropped because a pooled box reused for a different
   * element would otherwise slide across the page at drag speed.
   */
  showHighlights(
    rects: HighlightRect[],
    label?: HighlightLabel,
    options?: { preview?: boolean },
  ): void {
    const preview = options?.preview ?? false;

    // Reuse the boxes we already have rather than thrashing the DOM on every
    // pointermove — this runs at mouse-move frequency.
    while (this.boxes.length < rects.length) {
      const box = h("div", { class: "highlight" });
      this.boxes.push(box);
      this.layer.append(box);
    }
    for (let i = rects.length; i < this.boxes.length; i++) {
      this.boxes[i].style.display = "none";
      // Cleared as well as hidden, so a class never outlives the box's use and
      // `.highlight--preview` can be counted directly.
      this.boxes[i].classList.remove("highlight--muted", "highlight--preview");
    }

    rects.forEach((rect, index) => {
      const box = this.boxes[index];
      box.style.display = "block";
      box.style.left = `${rect.left}px`;
      box.style.top = `${rect.top}px`;
      box.style.width = `${rect.width}px`;
      box.style.height = `${rect.height}px`;
      box.classList.toggle("highlight--muted", !preview && index > 0);
      box.classList.toggle("highlight--preview", preview);

      // Only the first box gets a label, and only when one was supplied.
      box.replaceChildren();
      if (index === 0 && label) box.append(this.buildLabel(rect, label));
    });
  }

  private buildLabel(rect: HighlightRect, label: HighlightLabel): HTMLElement {
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
