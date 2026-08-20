// =============================================================================
// Measure card — the controls that belong to measuring, not to the report
// =============================================================================
//
// One row today. It exists at one row because a control whose position a user has
// already learned is not worth moving later to save a file now.
//
// Same division of labour as `settings.ts`: this class owns no state. It renders the
// `Settings` it is handed and reports changes as a patch; `content/index.ts` stays the
// only thing that owns settings and the only thing that writes them. The method names
// deliberately match `SettingsCard` — `render`, `anchorTo`, `destroy` — because two
// cards solving the same geometry problem with different verbs is how they drift apart.
// =============================================================================

import type { Settings } from "../../shared/types";
import { dismissCard, h, icon } from "./dom";

export interface MeasureCallbacks {
  onClose(): void;
  onChange(patch: Partial<Settings>): void;
}

/** Same numbers as the settings card, and for the same reasons — see its header. */
const GAP = 8;
const EDGE = 12;
/** `.measure-card` in CSS; the fallback for a card that has not been laid out yet. */
const CARD_WIDTH = 320;

export class MeasureCard {
  readonly element: HTMLElement;
  private readonly showBoxModel: HTMLInputElement;

  constructor(layer: HTMLElement, callbacks: MeasureCallbacks) {
    this.showBoxModel = h("input", {
      attrs: { type: "checkbox", "data-setting": "showBoxModel" },
      on: { change: () => callbacks.onChange({ showBoxModel: this.showBoxModel.checked }) },
    });

    this.element = h(
      "div",
      { class: "card measure-card" },
      h(
        "div",
        { class: "card__header" },
        icon("ruler", 14),
        h("span", { class: "card__title", text: "Measure" }),
        h(
          "button",
          { class: "icon-button", title: "Close", on: { click: () => callbacks.onClose() } },
          icon("close", 14),
        ),
      ),
      h(
        "div",
        { class: "card__body" },
        row(
          "Box model on hover",
          "Shades padding and margin on whatever the pointer is over, and puts the size on a badge. Mode 4 shows them regardless of this.",
          h("label", { class: "switch" }, this.showBoxModel, h("span", { class: "switch__track" })),
        ),
      ),
    );

    layer.append(this.element);
  }

  render(settings: Settings): void {
    this.showBoxModel.checked = settings.showBoxModel;
  }

  /**
   * Anchored to the dock, by the same contract as the settings card.
   *
   * `null` means the dock is in its default corner, and the stylesheet already puts the
   * card above it — so the inline placement is *removed* rather than recomputed. Setting
   * it anyway is how a card that has never been dragged ends up a few pixels off the one
   * beside it.
   *
   * This card is short, so it needs none of the settings card's flip-and-cap machinery:
   * prefer above the dock, clamp to the viewport, done.
   */
  anchorTo(box: DOMRect | null): void {
    if (!box) {
      delete this.element.dataset.anchored;
      this.element.style.removeProperty("left");
      this.element.style.removeProperty("bottom");
      this.element.style.removeProperty("top");
      return;
    }

    // Before measuring: the flag releases the `bottom`/`right` the stylesheet sets, and a
    // card still held by both edges reports a width it is about to lose.
    this.element.dataset.anchored = "true";

    const width = this.element.offsetWidth || CARD_WIDTH;
    const left = Math.min(box.left, window.innerWidth - width - EDGE);
    this.element.style.left = `${Math.max(EDGE, left)}px`;

    const above = window.innerHeight - box.top + GAP;
    const height = this.element.offsetHeight || 0;
    if (above + height < window.innerHeight - EDGE) {
      this.element.style.removeProperty("top");
      this.element.style.bottom = `${above}px`;
      return;
    }
    // No room above the pill — sit under it instead.
    this.element.style.removeProperty("bottom");
    this.element.style.top = `${Math.max(EDGE, box.bottom + GAP)}px`;
  }

  destroy(): void {
    dismissCard(this.element);
  }
}

/** The settings card's row shape, so the two cards read as one piece of UI. */
function row(label: string, help: string, control: HTMLElement): HTMLElement {
  return h(
    "div",
    { class: "settings__row" },
    h(
      "div",
      { class: "settings__text" },
      h("span", { class: "settings__label", text: label }),
      h("span", { class: "settings__help", text: help }),
    ),
    control,
  );
}
