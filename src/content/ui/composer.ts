// =============================================================================
// Composer — the popup you type the annotation into
// =============================================================================
//
// The card header doubles as a drag handle. The rest of the card — textarea,
// kind chips, footer buttons — must all keep working normally, so the drag is
// confined to `.card__header` rather than the whole card. A 4px movement
// threshold keeps a header click from starting a drag.
//
// `applyPosition` is called after construction (with the saved position, if any)
// and on every viewport resize, following the same pattern as `Toolbar`. If no
// saved position exists the `position()` method anchors the card near its
// target element as before, so the default experience is unchanged.
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
  /**
   * Fired once, on drop — not per frame. The caller persists and re-applies the
   * position so every subsequent composer on this page opens in the same spot.
   */
  onMove(position: { x: number; y: number }): void;
}

const WIDTH = 380;
const GAP = 12;
const EDGE = 12;

/**
 * How far the pointer must travel before a header press becomes a drag.
 *
 * Matches the toolbar threshold: 4px combined travel is the platform convention
 * and is what a trackpad tap stays inside.
 */
const DRAG_THRESHOLD = 4;

export class Composer {
  readonly element: HTMLElement;
  private readonly textarea: HTMLTextAreaElement;
  private readonly teardown: Array<() => void> = [];
  private readonly kindButtons = new Map<AnnotationKind, HTMLButtonElement>();
  private kind: AnnotationKind;
  /**
   * The point last *asked* for, before clamping. `null` means "use the anchor".
   *
   * Re-clamping (on resize) starts from the request rather than from the clamped
   * result, so a spell in a narrow window never permanently walks the card to the
   * left edge.
   */
  private requested: { x: number; y: number } | null = null;
  /** Card size, measured once at the start of a drag. `null` outside one. */
  private dragSize: { width: number; height: number } | null = null;
  private readonly resizeObserver: ResizeObserver;

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

    const header = h(
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
    );

    this.element = h(
      "div",
      { class: "card composer" },
      header,
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

    this.installDrag(header, callbacks);

    // Re-clamp on card size changes (content reflowing as meta rows appear, etc.)
    // without waiting for a viewport resize.
    this.resizeObserver = new ResizeObserver(() => this.paintPosition());
    this.resizeObserver.observe(this.element);

    takeFocus(this.textarea);
  }

  /** Put the caret back after something else — the markup editor — borrowed focus. */
  focus(): void {
    takeFocus(this.textarea);
  }

  // ---------------------------------------------------------------------------
  // Dragging — header-only handle
  // ---------------------------------------------------------------------------

  /**
   * Install a drag on the card header.
   *
   * The whole header is the handle, not a dedicated grip: the header has room and
   * already looks like chrome. The textarea must NOT be the handle — dragging would
   * select text rather than moving the card. Kind chips and the cancel button are
   * inside the header; a 4px threshold separates their clicks from a drag, following
   * the same reasoning as `docs/draggable-toolbar/context.md`.
   *
   * Pointer events rather than mouse events for `setPointerCapture`, so a fast drag
   * that outruns the card still delivers its moves to the header.
   */
  private installDrag(header: HTMLElement, callbacks: ComposerCallbacks): void {
    let origin: { x: number; y: number } | null = null;
    let grab = { dx: 0, dy: 0 };
    let moved = false;

    const forget = () => {
      origin = null;
      this.dragSize = null;
    };

    this.teardown.push(
      listen(header, "pointerdown", (event) => {
        const pe = event as PointerEvent;
        if (pe.button !== 0) return;

        const box = this.element.getBoundingClientRect();
        origin = { x: pe.clientX, y: pe.clientY };
        grab = { dx: pe.clientX - box.left, dy: pe.clientY - box.top };
        // Measured once per drag — re-reading per frame is a forced layout at
        // pointer frequency and the size does not change while dragging.
        this.dragSize = { width: box.width, height: box.height };
        moved = false;
      }),
    );

    this.teardown.push(
      listen(header, "pointermove", (event) => {
        const pe = event as PointerEvent;
        if (!origin) return;

        // A press released within 4px of the header — pointer off before travelling
        // far enough — never reaches the end handler and leaves `origin` set. A later
        // plain *hover* would then cross the threshold with no button held and drag the
        // card. `buttons` is the only reliable witness that the press is over.
        if (pe.buttons === 0) {
          forget();
          return;
        }

        if (!moved) {
          const travelled =
            Math.abs(pe.clientX - origin.x) + Math.abs(pe.clientY - origin.y);
          if (travelled < DRAG_THRESHOLD) return;
          moved = true;
          this.element.dataset.dragging = "true";
          try {
            header.setPointerCapture(pe.pointerId);
          } catch {
            /* keep dragging uncaptured */
          }
        }

        this.moveTo(pe.clientX - grab.dx, pe.clientY - grab.dy);
      }),
    );

    const end = (event: Event) => {
      const pe = event as PointerEvent;
      if (!origin) return;
      // End only on the primary button release. A second button released mid-drag
      // must not freeze the card. `pointercancel` carries no meaningful `button`
      // and must always end the drag.
      if (pe.type === "pointerup" && pe.button !== 0) return;

      const wasDragging = moved;
      forget();
      if (!wasDragging) return;

      delete this.element.dataset.dragging;
      if (header.hasPointerCapture(pe.pointerId)) header.releasePointerCapture(pe.pointerId);

      // Persist the requested point, not the clamped one, so a drop against a narrow
      // window edge restores where the card was actually put when the window widens.
      if (this.requested) callbacks.onMove(this.requested);

      // A drag does not always produce a click (release outside the card dispatches
      // none), so `moved` must be reset via setTimeout rather than relying on the click
      // handler — otherwise the next genuine click on the card is swallowed.
      window.setTimeout(() => {
        moved = false;
      }, 0);
    };

    this.teardown.push(listen(header, "pointerup", end));
    this.teardown.push(listen(header, "pointercancel", end));

    // Prevent a drag-end that lands on a button inside the header from also pressing
    // the button. Capture phase so this runs before the button's own listener.
    this.teardown.push(
      listen(
        header,
        "click",
        (event) => {
          if (!moved) return;
          moved = false;
          event.preventDefault();
          event.stopPropagation();
        },
        { capture: true },
      ),
    );
  }

  /** Ask for a viewport position. Stored unclamped; painted clamped. */
  private moveTo(x: number, y: number): void {
    this.requested = { x, y };
    this.paintPosition();
  }

  /**
   * Draw the card at the requested position, clamped to keep it on screen.
   *
   * `Math.max(EDGE, Math.min(x, limit))` — same ordering as the toolbar: when the
   * window is narrower than the card the upper bound goes negative, and
   * `Math.min(≥EDGE, -27)` returns `-27`, pushing the card off-screen. The lower
   * bound must win.
   *
   * Called from `moveTo`, the `ResizeObserver`, and `applyPosition`.
   */
  private paintPosition(): void {
    if (!this.requested) return;

    const box = this.dragSize ?? this.element.getBoundingClientRect();
    const left = Math.max(
      EDGE,
      Math.min(this.requested.x, window.innerWidth - box.width - EDGE),
    );
    const top = Math.max(
      EDGE,
      Math.min(this.requested.y, window.innerHeight - box.height - EDGE),
    );

    this.element.dataset.floating = "true";
    this.element.style.left = `${left}px`;
    this.element.style.top = `${top}px`;
  }

  /**
   * Apply a stored position, or fall back to the anchor-based default.
   *
   * Called after construction (with the page's saved position) and on every
   * viewport resize, so a window narrowed since the card was placed cannot
   * permanently hide it.
   *
   * Passing `null` is a no-op: the card was already positioned by `position()`
   * in the constructor and there is nothing to override.
   */
  applyPosition(position: { x: number; y: number } | null): void {
    if (!position) return;
    this.requested = position;
    this.paintPosition();
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
    this.resizeObserver.disconnect();
    for (const off of this.teardown) off();
    this.element.remove();
  }
}
