// =============================================================================
// Screenshot markup — draw on the shot before it is saved
// =============================================================================
//
// Three tools, and blur is the reason this exists. A tester photographing a real
// screen photographs real customer data, and a screenshot is the one channel through
// which it can leave the machine — the action trail already refuses to record field
// values, and request bodies are never captured. Redaction has to be available at
// the same point.
//
// Blur is destructive by construction: the region is resampled down and back up, so
// the information is gone from the bitmap that gets saved. A CSS filter over the top
// would be reversible by anyone holding the original, and we would be saving the
// original.
//
// The shape list is the whole model. Every repaint redraws the base bitmap and
// replays the list, which is what makes undo a `pop()` with no snapshot stack — and
// what makes undoing a blur genuinely restore the pixels.
// =============================================================================

import { h, icon, listen } from "./dom";

type Tool = "box" | "arrow" | "blur";

interface Point {
  x: number;
  y: number;
}

interface Shape {
  tool: Tool;
  from: Point;
  to: Point;
}

export interface ShotEditorCallbacks {
  /** The flattened canvas, with every shape burned in. */
  onSave(canvas: HTMLCanvasElement): void;
  onCancel(): void;
}

const TOOLS: { tool: Tool; iconName: string; label: string; title: string }[] = [
  { tool: "box", iconName: "marquee", label: "Box", title: "Draw a box" },
  { tool: "arrow", iconName: "cursor", label: "Arrow", title: "Draw an arrow" },
  { tool: "blur", iconName: "snowflake", label: "Blur", title: "Pixelate a region — destroys the pixels" },
];

const ACCENT = "#f97316";
/** Halo under every stroke, so markup stays visible on a dark *and* a light shot. */
const HALO = "rgba(255,255,255,0.9)";
const STROKE = 3;
/** Bigger blocks read as "deliberately redacted" rather than "bad screenshot". */
const PIXEL_SIZE = 12;
/** The card is a fixed-position panel; leave room for it on small viewports. */
const MAX_DISPLAY_WIDTH = 560;
const MAX_DISPLAY_HEIGHT = 420;

export class ShotEditor {
  readonly element: HTMLElement;

  private readonly base: HTMLCanvasElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly scratch = document.createElement("canvas");
  private readonly teardown: Array<() => void> = [];
  private readonly toolButtons = new Map<Tool, HTMLButtonElement>();
  private readonly undoButton: HTMLButtonElement;

  private readonly shapes: Shape[] = [];
  private tool: Tool = "box";
  private drawing: Shape | null = null;

  constructor(layer: HTMLElement, base: HTMLCanvasElement, callbacks: ShotEditorCallbacks) {
    this.base = base;

    this.canvas = h("canvas", { class: "shot-editor__canvas" });
    this.canvas.width = base.width;
    this.canvas.height = base.height;

    const context = this.canvas.getContext("2d");
    if (!context) throw new Error("senannotate: no 2d context for the markup editor");
    this.context = context;

    this.applyDisplaySize();

    for (const { tool, iconName, label, title } of TOOLS) {
      const button = h(
        "button",
        {
          class: "shot-tool",
          title,
          attrs: { "aria-pressed": String(tool === this.tool) },
          on: { click: () => this.selectTool(tool) },
        },
        icon(iconName, 13),
        h("span", { text: label }),
      );
      this.toolButtons.set(tool, button);
    }

    this.undoButton = h(
      "button",
      {
        class: "shot-tool",
        title: "Undo the last shape",
        on: { click: () => this.undo() },
      },
      h("span", { text: "Undo" }),
    );
    this.undoButton.disabled = true;

    this.element = h(
      "div",
      // `tabindex` so the card can hold focus and its own Escape / ⌘Z handlers fire.
      // Without it focus stays in the composer's textarea underneath, and Escape
      // closes the composer out from under the editor.
      { class: "card shot-editor", attrs: { tabindex: "-1" } },
      h(
        "div",
        { class: "card__header" },
        icon("camera", 14),
        h("span", { class: "card__title", text: "Markup" }),
        h(
          "button",
          {
            class: "icon-button",
            title: "Discard this screenshot (Esc)",
            on: { click: () => callbacks.onCancel() },
          },
          icon("close", 14),
        ),
      ),
      h(
        "div",
        { class: "card__body" },
        h("div", { class: "shot-editor__tools" }, ...this.toolButtons.values(), this.undoButton),
        h("div", { class: "shot-editor__stage" }, this.canvas),
      ),
      h(
        "div",
        { class: "card__footer" },
        h("span", { class: "hint", text: "Blur is permanent" }),
        h("span", { class: "spacer" }),
        h(
          "button",
          {
            class: "button button--ghost",
            on: { click: () => callbacks.onCancel() },
          },
          h("span", { text: "Cancel" }),
        ),
        h(
          "button",
          {
            class: "button button--primary",
            on: { click: () => callbacks.onSave(this.flatten()) },
          },
          h("span", { text: "Save" }),
        ),
      ),
    );

    layer.append(this.element);
    this.element.focus();
    this.repaint();
    this.installPointer();

    this.teardown.push(
      listen(this.element, "keydown", (event) => {
        const keyboard = event as KeyboardEvent;
        if (keyboard.key === "Escape") {
          keyboard.preventDefault();
          keyboard.stopPropagation();
          callbacks.onCancel();
        }
        // ⌘/Ctrl+Z is what a hand reaches for; the toolbar button is the discoverable
        // half of the same action.
        if (keyboard.key.toLowerCase() === "z" && (keyboard.metaKey || keyboard.ctrlKey)) {
          keyboard.preventDefault();
          this.undo();
        }
      }),
    );

    // Same containment rule the composer follows: our keystrokes are never the
    // page's keystrokes.
    for (const type of ["keydown", "keyup", "keypress"] as const) {
      this.teardown.push(listen(this.element, type, (event) => event.stopPropagation()));
    }
  }

  // ---------------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------------

  /**
   * The canvas keeps its native (device-pixel) resolution — that is what gets saved —
   * and is only *displayed* smaller. Every pointer coordinate is scaled back up on
   * the way in, so a shape drawn on a downscaled view lands on the full-size bitmap.
   */
  private applyDisplaySize(): void {
    const maxWidth = Math.min(MAX_DISPLAY_WIDTH, window.innerWidth - 80);
    const maxHeight = Math.min(MAX_DISPLAY_HEIGHT, window.innerHeight - 220);
    const scale = Math.min(1, maxWidth / this.canvas.width, maxHeight / this.canvas.height);

    this.canvas.style.width = `${Math.max(1, Math.round(this.canvas.width * scale))}px`;
    this.canvas.style.height = `${Math.max(1, Math.round(this.canvas.height * scale))}px`;
  }

  // ---------------------------------------------------------------------------
  // Tools
  // ---------------------------------------------------------------------------

  private selectTool(tool: Tool): void {
    this.tool = tool;
    for (const [candidate, button] of this.toolButtons) {
      button.setAttribute("aria-pressed", String(candidate === tool));
    }
  }

  private undo(): void {
    if (!this.shapes.length) return;
    this.shapes.pop();
    this.undoButton.disabled = this.shapes.length === 0;
    this.repaint();
  }

  // ---------------------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------------------

  private installPointer(): void {
    // `mousedown` is cancelled on the shadow host (`ui/root.ts`) so a toolbar click
    // never moves focus off the page's dialog. That suppresses the *default action*
    // only — pointer events still reach these listeners, which is why drawing works
    // inside the same containment that makes the rest of the UI safe.
    this.teardown.push(
      listen(this.canvas, "pointerdown", (event) => {
        const pointer = event as PointerEvent;
        pointer.preventDefault();
        this.canvas.setPointerCapture(pointer.pointerId);
        const at = this.toCanvas(pointer);
        this.drawing = { tool: this.tool, from: at, to: at };
      }),
    );

    this.teardown.push(
      listen(this.canvas, "pointermove", (event) => {
        if (!this.drawing) return;
        this.drawing.to = this.toCanvas(event as PointerEvent);
        this.repaint();
      }),
    );

    const finish = (event: Event) => {
      if (!this.drawing) return;
      this.drawing.to = this.toCanvas(event as PointerEvent);

      // A click with no drag is not a shape. Without this, every stray click leaves a
      // zero-size artefact that undo has to be pressed for.
      const dragged =
        Math.abs(this.drawing.to.x - this.drawing.from.x) > 4 ||
        Math.abs(this.drawing.to.y - this.drawing.from.y) > 4;

      if (dragged) {
        this.shapes.push(this.drawing);
        this.undoButton.disabled = false;
      }
      this.drawing = null;
      this.repaint();
    };

    this.teardown.push(listen(this.canvas, "pointerup", finish));
    this.teardown.push(listen(this.canvas, "pointercancel", finish));
  }

  /** Display pixels → canvas pixels. */
  private toCanvas(event: PointerEvent): Point {
    const box = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / (box.width || 1);
    const scaleY = this.canvas.height / (box.height || 1);
    return {
      x: (event.clientX - box.left) * scaleX,
      y: (event.clientY - box.top) * scaleY,
    };
  }

  private repaint(): void {
    const { context } = this;
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    context.drawImage(this.base, 0, 0);

    for (const shape of this.shapes) this.paint(shape);
    if (this.drawing) this.paint(this.drawing);
  }

  private paint(shape: Shape): void {
    switch (shape.tool) {
      case "blur":
        this.paintBlur(shape);
        break;
      case "arrow":
        this.paintArrow(shape);
        break;
      default:
        this.paintBox(shape);
    }
  }

  private normalise({ from, to }: Shape): { x: number; y: number; w: number; h: number } {
    return {
      x: Math.min(from.x, to.x),
      y: Math.min(from.y, to.y),
      w: Math.abs(to.x - from.x),
      h: Math.abs(to.y - from.y),
    };
  }

  private paintBox(shape: Shape): void {
    const { x, y, w, h } = this.normalise(shape);
    const { context } = this;

    context.lineJoin = "round";
    context.strokeStyle = HALO;
    context.lineWidth = STROKE + 3;
    context.strokeRect(x, y, w, h);
    context.strokeStyle = ACCENT;
    context.lineWidth = STROKE;
    context.strokeRect(x, y, w, h);
  }

  private paintArrow(shape: Shape): void {
    const { from, to } = shape;
    const { context } = this;
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const head = Math.max(12, STROKE * 5);

    const stroke = (colour: string, width: number) => {
      context.strokeStyle = colour;
      context.fillStyle = colour;
      context.lineWidth = width;
      context.lineCap = "round";
      context.lineJoin = "round";

      context.beginPath();
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
      context.stroke();

      context.beginPath();
      context.moveTo(to.x, to.y);
      context.lineTo(
        to.x - head * Math.cos(angle - Math.PI / 7),
        to.y - head * Math.sin(angle - Math.PI / 7),
      );
      context.lineTo(
        to.x - head * Math.cos(angle + Math.PI / 7),
        to.y - head * Math.sin(angle + Math.PI / 7),
      );
      context.closePath();
      context.fill();
    };

    stroke(HALO, STROKE + 3);
    stroke(ACCENT, STROKE);
  }

  /**
   * Resample the region down and back up with smoothing off on the way up.
   *
   * Reads from the live canvas rather than the base bitmap, so a blur drawn over a
   * box redacts the box too — the shape list is painted in order and each shape sees
   * what is already there.
   */
  private paintBlur(shape: Shape): void {
    const { x, y, w, h } = this.normalise(shape);
    if (w < 2 || h < 2) return;

    const small = this.scratch;
    small.width = Math.max(1, Math.round(w / PIXEL_SIZE));
    small.height = Math.max(1, Math.round(h / PIXEL_SIZE));

    const smallContext = small.getContext("2d");
    if (!smallContext) return;

    smallContext.clearRect(0, 0, small.width, small.height);
    smallContext.drawImage(this.canvas, x, y, w, h, 0, 0, small.width, small.height);

    const { context } = this;
    context.save();
    context.imageSmoothingEnabled = false;
    context.drawImage(small, 0, 0, small.width, small.height, x, y, w, h);
    context.restore();
  }

  /** The canvas as it stands, with every shape already burned in. */
  private flatten(): HTMLCanvasElement {
    this.repaint();
    return this.canvas;
  }

  destroy(): void {
    for (const off of this.teardown) off();
    this.element.remove();
  }
}
