// =============================================================================
// Composer — the popup you type the annotation into
// =============================================================================

import { ANNOTATION_KINDS, type AnnotationKind } from "../../shared/types";
import { h, icon, listen } from "./dom";

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
  initialImages?: string[];
}

export interface ComposerCallbacks {
  onSubmit(comment: string, kind: AnnotationKind, referenceImages: string[]): void;
  onCancel(): void;
  onScreenshot(): void;
  /**
   * Files the user pasted or picked. Encoding them is the orchestrator's job — this
   * layer draws, and does not know what a canvas is for.
   */
  onAttach(files: File[]): void;
  onDelete?(): void;
}

const WIDTH = 380;
const GAP = 12;
const EDGE = 12;

/**
 * Ceiling on reference images per note.
 *
 * Not a storage limit — `fitToQuota` owns that. It is a "you are describing one change"
 * limit: past three pictures the note is a mood board, and the strip stops fitting
 * across a 380px card without wrapping into something that needs a scroller.
 */
const MAX_REFERENCE_IMAGES = 3;

export class Composer {
  readonly element: HTMLElement;
  private readonly textarea: HTMLTextAreaElement;
  private readonly teardown: Array<() => void> = [];
  private readonly kindButtons = new Map<AnnotationKind, HTMLButtonElement>();
  private readonly strip: HTMLElement;
  private readonly fileInput: HTMLInputElement;
  private images: string[];
  private kind: AnnotationKind;

  constructor(
    layer: HTMLElement,
    anchor: { left: number; top: number; right: number; bottom: number },
    data: ComposerData,
    callbacks: ComposerCallbacks,
  ) {
    this.kind = data.initialKind ?? "ui";
    this.images = [...(data.initialImages ?? [])];

    this.strip = h("div", { class: "composer__images" });
    this.fileInput = h("input", {
      class: "composer__file",
      attrs: { type: "file", accept: "image/*", multiple: "" },
      on: {
        change: () => {
          callbacks.onAttach([...(this.fileInput.files ?? [])]);
          // The same file twice in a row would not fire `change` without this.
          this.fileInput.value = "";
        },
      },
    });

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
      h(
        "button",
        {
          class: "button button--ghost button--attach",
          title: "Attach a reference image — or just paste one",
          on: { click: () => this.fileInput.click() },
        },
        icon("image", 14),
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
      h("div", { class: "card__body" }, meta, kinds, this.textarea, this.strip, this.fileInput),
      footer,
    );

    this.renderImages();

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

    // Paste is the point of this feature — a screenshot from another window, a Figma
    // frame, a competitor's page — and the file picker is only the fallback for an
    // image that is already on disk. It is listened for on the whole card rather than
    // on the textarea: an image on the clipboard is not text, so wherever the caret
    // happens to be is not information.
    this.teardown.push(
      listen(this.element, "paste", (event) => {
        const items = [...((event as ClipboardEvent).clipboardData?.items ?? [])];
        const files = items
          .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
          .map((item) => item.getAsFile())
          .filter((file): file is File => file !== null);

        if (!files.length) return;
        // Only once there is an image: a plain text paste has to keep working.
        event.preventDefault();
        callbacks.onAttach(files);
      }),
    );

    // Keystrokes inside the composer must never reach the page's own shortcuts.
    for (const type of ["keydown", "keyup", "keypress"] as const) {
      this.teardown.push(listen(this.element, type, (event) => event.stopPropagation()));
    }

    this.textarea.focus();
  }

  /** Put the caret back after something else — the markup editor — borrowed focus. */
  focus(): void {
    this.textarea.focus();
  }

  /**
   * Hand back encoded images. Returns how many were kept, so the caller can say when
   * the cap swallowed some rather than leaving the user wondering.
   */
  addReferenceImages(uris: string[]): number {
    const room = MAX_REFERENCE_IMAGES - this.images.length;
    const kept = uris.slice(0, Math.max(0, room));
    this.images = [...this.images, ...kept];
    this.renderImages();
    return kept.length;
  }

  private renderImages(): void {
    this.strip.replaceChildren(
      ...this.images.map((uri, index) => {
        const thumb = h("img", {
          class: "composer__thumb",
          attrs: { src: uri, alt: `Reference image ${index + 1}` },
        });

        return h(
          "div",
          { class: "composer__image" },
          thumb,
          h(
            "button",
            {
              class: "composer__image-remove",
              title: "Remove this image",
              on: {
                click: () => {
                  this.images = this.images.filter((_, at) => at !== index);
                  this.renderImages();
                },
              },
            },
            icon("close", 10),
          ),
        );
      }),
    );
  }

  private selectKind(kind: AnnotationKind): void {
    this.kind = kind;
    for (const [candidate, button] of this.kindButtons) {
      button.setAttribute("aria-pressed", String(candidate === kind));
    }
    // Picking a type is not finishing the note; put the caret back where it was.
    this.textarea.focus();
  }

  private submit(callbacks: ComposerCallbacks): void {
    const comment = this.textarea.value.trim();
    if (!comment) {
      this.textarea.focus();
      return;
    }
    callbacks.onSubmit(comment, this.kind, this.images);
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
