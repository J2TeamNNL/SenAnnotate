// =============================================================================
// Annotation panel — the list, and the copy button that is the point of it all
// =============================================================================

import { formatSource } from "../../shared/output";
import {
  OUTPUT_DETAIL_OPTIONS,
  type Annotation,
  type OutputDetailLevel,
} from "../../shared/types";
import { clear, h, icon } from "./dom";

export interface PanelCallbacks {
  onClose(): void;
  onCopy(): void;
  onClearAll(): void;
  onSelect(annotation: Annotation): void;
  onHoverChange(annotation: Annotation | null): void;
  onDetailChange(level: OutputDetailLevel): void;
}

export class Panel {
  readonly element: HTMLElement;
  private readonly list: HTMLElement;
  private readonly select: HTMLSelectElement;
  private readonly copyButton: HTMLButtonElement;
  private readonly callbacks: PanelCallbacks;

  private readonly summary: HTMLElement;

  constructor(layer: HTMLElement, callbacks: PanelCallbacks) {
    this.callbacks = callbacks;
    this.list = h("div", { class: "panel__list" });
    this.summary = h("div", { class: "capture-summary", style: { display: "none" } });

    this.select = h("select", {
      class: "select",
      title: "How much detail to include in the copied report",
      on: {
        change: () => callbacks.onDetailChange(this.select.value as OutputDetailLevel),
      },
    });
    for (const option of OUTPUT_DETAIL_OPTIONS) {
      const node = h("option", { text: `${option.label} — ${option.hint}` });
      node.value = option.value;
      this.select.append(node);
    }

    this.copyButton = h(
      "button",
      { class: "button button--primary", on: { click: () => callbacks.onCopy() } },
      icon("copy", 14),
      h("span", { text: "Copy report" }),
    );

    this.element = h(
      "div",
      { class: "card panel" },
      h(
        "div",
        { class: "card__header" },
        icon("list", 14),
        h("span", { class: "card__title", text: "Annotations" }),
        h(
          "button",
          {
            class: "icon-button",
            title: "Clear all annotations on this page",
            on: { click: () => callbacks.onClearAll() },
          },
          icon("trash", 14),
        ),
        h(
          "button",
          { class: "icon-button", title: "Close (A)", on: { click: () => callbacks.onClose() } },
          icon("close", 14),
        ),
      ),
      h("div", { class: "card__body" }, this.summary, this.list),
      h("div", { class: "card__footer" }, this.select, h("span", { class: "spacer" }), this.copyButton),
    );

    layer.append(this.element);
  }

  render(annotations: Annotation[], detailLevel: OutputDetailLevel): void {
    const { callbacks } = this;
    this.select.value = detailLevel;
    this.copyButton.disabled = annotations.length === 0;

    clear(this.list);

    if (!annotations.length) {
      this.list.append(
        h("div", {
          class: "empty",
          text: "No annotations yet. Turn on inspect mode and click something.",
        }),
      );
      return;
    }

    annotations.forEach((annotation, index) => {
      const source = formatSource(annotation.source);

      const body = h(
        "div",
        { class: "entry__body" },
        h("div", { class: "entry__element", text: annotation.element }),
        source ? h("div", { class: "entry__source", text: source }) : null,
        h("div", { class: "entry__comment", text: annotation.comment }),
      );

      this.list.append(
        h(
          "div",
          {
            class: "entry",
            on: {
              click: () => callbacks.onSelect(annotation),
              mouseenter: () => callbacks.onHoverChange(annotation),
              mouseleave: () => callbacks.onHoverChange(null),
            },
          },
          h("span", { class: "entry__number", text: String(index + 1) }),
          body,
        ),
      );
    });
  }

  /**
   * Show what the extension has collected in the background. Testers need to see
   * that errors were captured *before* they hit copy, otherwise they have no way
   * of knowing the report contains anything beyond their own notes.
   */
  renderCaptureSummary(counts: { logs: number; requests: number; actions: number }): void {
    const parts: string[] = [];
    if (counts.logs) parts.push(`${counts.logs} console error${counts.logs === 1 ? "" : "s"}`);
    if (counts.requests) {
      parts.push(`${counts.requests} failed request${counts.requests === 1 ? "" : "s"}`);
    }
    if (counts.actions) parts.push(`${counts.actions} step${counts.actions === 1 ? "" : "s"}`);

    if (!parts.length) {
      this.summary.style.display = "none";
      return;
    }

    this.summary.style.display = "flex";
    this.summary.replaceChildren(
      icon("bug", 13),
      h("span", { text: `Captured: ${parts.join(" · ")}` }),
    );
    this.summary.title = "Included automatically when you copy the report";
  }

  destroy(): void {
    this.element.remove();
  }
}
