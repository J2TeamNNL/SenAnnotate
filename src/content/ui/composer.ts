// =============================================================================
// Composer — the popup you type the annotation into
// =============================================================================

import { ANNOTATION_KINDS, type AnnotationKind } from "../../shared/types";
import { h, icon, listen, takeFocus } from "./dom";

export interface ComposerData {
  title: string;
  /** `src/components/Foo.vue:12:5`, when we could work it out. */
  source: string | null;
  /** `<App> <TheSidebar> <BaseButton>`. */
  components: string | null;
  props: string | null;
  selectedText?: string;
  elementCount?: number;
  initialComment?: string;
  initialKind?: AnnotationKind;
}

export interface ComposerCallbacks {
  onSubmit(comment: string, kind: AnnotationKind): void;
  onCancel(): void;
  onScreenshot(): void;
  onDelete?(): void;
}

const WIDTH = 380;
const GAP = 12;
const EDGE = 12;

export class Composer {
  readonly element: HTMLElement;
  private readonly textarea: HTMLTextAreaElement;
  private readonly teardown: Array<() => void> = [];
  private readonly kindButtons = new Map<AnnotationKind, HTMLButtonElement>();
  private kind: AnnotationKind;

  constructor(
    layer: HTMLElement,
    anchor: { left: number; top: number; right: number; bottom: number },
    data: ComposerData,
    callbacks: ComposerCallbacks,
  ) {
    this.kind = data.initialKind ?? "ui";

    this.textarea = h("textarea", {
      class: "composer__input",
      attrs: {
        placeholder: "What should change here?",
        rows: "3",
        "aria-label": "Annotation comment",
      },
    });
    this.textarea.value = data.initialComment ?? "";

    for (const { value, label, hint } of ANNOTATION_KINDS) {
      this.kindButtons.set(
        value,
        h("button", {
          class: "kind-chip",
          title: hint,
          text: label,
          dataset: { kind: value },
          attrs: { "aria-pressed": String(value === this.kind) },
          on: { click: () => this.selectKind(value) },
        }),
      );
    }

    const kinds = h("div", { class: "composer__kinds" }, ...this.kindButtons.values());

    const meta = h("div", { class: "composer__meta" });
    meta.append(this.metaRow("Element", data.title));
    if (data.elementCount && data.elementCount > 1) {
      meta.append(this.metaRow("Selection", `${data.elementCount} elements`));
    }
    if (data.source) meta.append(this.metaRow("Source", data.source, true));
    if (data.components) meta.append(this.metaRow("Component", data.components));
    if (data.props) meta.append(this.metaRow("Props", data.props));
    if (data.selectedText) meta.append(this.metaRow("Text", `"${data.selectedText}"`));

    const submit = h(
      "button",
      { class: "button button--primary", on: { click: () => this.submit(callbacks) } },
      h("span", { text: data.initialComment !== undefined ? "Save" : "Add note" }),
    );

    const footer = h(
      "div",
      { class: "card__footer" },
      h("span", { class: "hint", text: "⌘/Ctrl + Enter" }),
      h("span", { class: "spacer" }),
      callbacks.onDelete
        ? h(
            "button",
            {
              class: "button button--ghost button--danger",
              title: "Delete annotation",
              on: { click: () => callbacks.onDelete?.() },
            },
            icon("trash", 14),
          )
        : null,
      h(
        "button",
        {
          class: "button button--ghost",
          title: "Capture a screenshot of this element",
          on: { click: () => callbacks.onScreenshot() },
        },
        icon("camera", 14),
      ),
      submit,
    );

    this.element = h(
      "div",
      { class: "card composer" },
      h(
        "div",
        { class: "card__header" },
        icon("pencil", 14),
        h("span", { class: "card__title", text: "Annotation" }),
        h(
          "button",
          {
            class: "icon-button",
            title: "Cancel (Esc)",
            on: { click: () => callbacks.onCancel() },
          },
          icon("close", 14),
        ),
      ),
      h("div", { class: "card__body" }, meta, kinds, this.textarea),
      footer,
    );

    layer.append(this.element);
    this.position(anchor);

    this.teardown.push(
      listen(this.element, "keydown", (event) => {
        const keyboard = event as KeyboardEvent;
        if (keyboard.key === "Escape") {
          keyboard.preventDefault();
          keyboard.stopPropagation();
          callbacks.onCancel();
        }
        if (keyboard.key === "Enter" && (keyboard.metaKey || keyboard.ctrlKey)) {
          keyboard.preventDefault();
          this.submit(callbacks);
        }
      }),
    );

    // Keystrokes inside the composer must never reach the page's own shortcuts.
    for (const type of ["keydown", "keyup", "keypress"] as const) {
      this.teardown.push(listen(this.element, type, (event) => event.stopPropagation()));
    }

    takeFocus(this.textarea);
  }

  /** Put the caret back after something else — the markup editor — borrowed focus. */
  focus(): void {
    takeFocus(this.textarea);
  }

  private selectKind(kind: AnnotationKind): void {
    this.kind = kind;
    for (const [candidate, button] of this.kindButtons) {
      button.setAttribute("aria-pressed", String(candidate === kind));
    }
    // Picking a type is not finishing the note; put the caret back where it was.
    takeFocus(this.textarea);
  }

  private submit(callbacks: ComposerCallbacks): void {
    const comment = this.textarea.value.trim();
    if (!comment) {
      takeFocus(this.textarea);
      return;
    }
    callbacks.onSubmit(comment, this.kind);
  }

  private metaRow(key: string, value: string, accent = false): HTMLElement {
    return h(
      "div",
      { class: "meta-row" },
      h("span", { class: "meta-row__key", text: key }),
      h("span", {
        class: accent ? "meta-row__value meta-row__value--accent" : "meta-row__value",
        text: value,
      }),
    );
  }

  /** Prefer below-right of the target, then flip and clamp to stay on screen. */
  private position(anchor: { left: number; top: number; right: number; bottom: number }): void {
    const height = this.element.offsetHeight || 260;

    let left = anchor.left;
    if (left + WIDTH > window.innerWidth - EDGE) left = window.innerWidth - WIDTH - EDGE;
    if (left < EDGE) left = EDGE;

    let top = anchor.bottom + GAP;
    if (top + height > window.innerHeight - EDGE) {
      const above = anchor.top - height - GAP;
      top = above >= EDGE ? above : Math.max(EDGE, window.innerHeight - height - EDGE);
    }

    this.element.style.left = `${left}px`;
    this.element.style.top = `${top}px`;
  }

  destroy(): void {
    for (const off of this.teardown) off();
    this.element.remove();
  }
}
