// =============================================================================
// Numbered pins
// =============================================================================
//
// The marker layer is `position: fixed`, so pins are placed in viewport space and
// re-offset by `scrollY` on every scroll. Storing document coordinates (rather
// than viewport ones) is what lets them survive a reload.
// =============================================================================

import type { Annotation } from "../../shared/types";
import { h } from "./dom";

export interface MarkerCallbacks {
  onClick(annotation: Annotation): void;
  onHoverChange(annotation: Annotation | null): void;
}

export class Markers {
  private readonly layer: HTMLElement;
  private readonly callbacks: MarkerCallbacks;
  private readonly pins = new Map<string, HTMLElement>();
  private annotations: Annotation[] = [];
  private visible = true;

  constructor(layer: HTMLElement, callbacks: MarkerCallbacks) {
    this.layer = layer;
    this.callbacks = callbacks;
  }

  render(annotations: Annotation[], visible: boolean): void {
    this.annotations = annotations;
    this.visible = visible;

    const live = new Set(annotations.map((annotation) => annotation.id));
    for (const [id, pin] of this.pins) {
      if (!live.has(id)) {
        pin.remove();
        this.pins.delete(id);
      }
    }

    annotations.forEach((annotation, index) => {
      let pin = this.pins.get(annotation.id);
      if (!pin) {
        pin = h("button", {
          class: "marker",
          on: {
            click: (event) => {
              event.stopPropagation();
              this.callbacks.onClick(annotation);
            },
            mouseenter: () => this.callbacks.onHoverChange(annotation),
            mouseleave: () => this.callbacks.onHoverChange(null),
          },
        });
        pin.append(h("span", { class: "marker__dot" }));
        this.pins.set(annotation.id, pin);
        this.layer.append(pin);
      }

      const dot = pin.firstElementChild as HTMLElement;
      dot.textContent = String(index + 1);
      pin.title = annotation.comment;
      pin.style.display = visible ? "flex" : "none";
    });

    this.syncPositions();
  }

  /** Cheap enough to run on every scroll frame: a transform write per pin. */
  syncPositions(): void {
    if (!this.visible) return;

    for (const annotation of this.annotations) {
      const pin = this.pins.get(annotation.id);
      if (!pin) continue;

      const left = (annotation.x / 100) * window.innerWidth;
      const top = annotation.isFixed ? annotation.y : annotation.y - window.scrollY;

      // Keep off-screen pins in the DOM but out of the way, so scrolling back
      // does not have to rebuild them.
      const offscreen = top < -40 || top > window.innerHeight + 40;
      pin.style.visibility = offscreen ? "hidden" : "visible";
      pin.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
    }
  }

  destroy(): void {
    for (const pin of this.pins.values()) pin.remove();
    this.pins.clear();
  }
}
