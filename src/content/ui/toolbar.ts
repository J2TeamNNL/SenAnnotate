// =============================================================================
// Floating toolbar
// =============================================================================

import type { InspectMode, PageFrameworkInfo } from "../../shared/types";
import { h, icon } from "./dom";

export interface ToolbarState {
  active: boolean;
  mode: InspectMode;
  frozen: boolean;
  panelOpen: boolean;
  count: number;
  page: PageFrameworkInfo | null;
}

export interface ToolbarCallbacks {
  onToggleActive(): void;
  onModeChange(mode: InspectMode): void;
  onToggleFreeze(): void;
  onTogglePanel(): void;
}

const MODES: { mode: InspectMode; iconName: string; title: string }[] = [
  { mode: "point", iconName: "cursor", title: "Click an element (1)" },
  { mode: "text", iconName: "text", title: "Select text (2)" },
  { mode: "area", iconName: "marquee", title: "Drag across elements (3)" },
];

/**
 * One line of standing instruction. The mode buttons are icon-only and appear
 * only once inspect mode is on, so without this nothing on screen says a drag
 * mode exists — which is exactly how mode `area` went unused for three releases.
 */
const MODE_HINTS: Record<InspectMode, string> = {
  point: "Click an element · 2 text · 3 area",
  text: "Select text · 1 point · 3 area",
  area: "Drag across elements · 1 point · 2 text",
};

export class Toolbar {
  readonly element: HTMLElement;

  private readonly brandButton: HTMLButtonElement;
  private readonly brandLabel: HTMLElement;
  private readonly modeButtons = new Map<InspectMode, HTMLButtonElement>();
  private readonly modeGroup: HTMLElement;
  private readonly freezeButton: HTMLButtonElement;
  private readonly panelButton: HTMLButtonElement;
  private readonly countBadge: HTMLElement;
  private readonly stackBadge: HTMLElement;
  private readonly hintElement: HTMLElement;
  /** Transient text from a drag; `null` means "show the mode's own hint". */
  private hintOverride: string | null = null;
  private modeHint = MODE_HINTS.point;

  constructor(layer: HTMLElement, callbacks: ToolbarCallbacks) {
    this.brandLabel = h("span", { class: "tool__label", text: "Inspect" });
    this.brandButton = h(
      "button",
      {
        class: "tool tool--brand",
        title: "Toggle inspect mode (Alt+Shift+S)",
        attrs: { "aria-pressed": "false" },
        on: { click: () => callbacks.onToggleActive() },
      },
      icon("s", 17),
      this.brandLabel,
    );

    for (const { mode, iconName, title } of MODES) {
      const button = h("button", {
        class: "tool",
        title,
        attrs: { "aria-pressed": "false" },
        on: { click: () => callbacks.onModeChange(mode) },
      });
      button.append(icon(iconName));
      this.modeButtons.set(mode, button);
    }

    this.modeGroup = h(
      "div",
      { class: "tool-group", style: { display: "none", alignItems: "center", gap: "2px" } },
      h("span", { class: "divider" }),
      ...this.modeButtons.values(),
    );

    this.freezeButton = h(
      "button",
      {
        class: "tool",
        title: "Freeze animations (F)",
        attrs: { "aria-pressed": "false" },
        on: { click: () => callbacks.onToggleFreeze() },
      },
      icon("snowflake"),
    );

    this.countBadge = h("span", { class: "count", text: "0", style: { display: "none" } });
    this.panelButton = h(
      "button",
      {
        class: "tool",
        title: "Annotations (A)",
        attrs: { "aria-pressed": "false" },
        on: { click: () => callbacks.onTogglePanel() },
      },
      icon("list"),
      this.countBadge,
    );

    this.stackBadge = h("span", { class: "stack-badge", style: { display: "none" } });

    this.hintElement = h("div", { class: "toolbar-hint", style: { display: "none" } });

    const bar = h(
      "div",
      { class: "toolbar" },
      this.stackBadge,
      this.brandButton,
      this.modeGroup,
      h("span", { class: "divider" }),
      this.freezeButton,
      this.panelButton,
    );

    // The dock owns the fixed position; `.toolbar` stays the pill so the e2e
    // locators and every existing style keep working.
    this.element = h("div", { class: "toolbar-dock" }, this.hintElement, bar);

    layer.append(this.element);
  }

  update(state: ToolbarState): void {
    this.brandButton.setAttribute("aria-pressed", String(state.active));
    this.brandLabel.textContent = state.active ? "Inspecting" : "Inspect";
    this.modeGroup.style.display = state.active ? "flex" : "none";

    this.modeHint = MODE_HINTS[state.mode];
    this.hintElement.style.display = state.active ? "block" : "none";
    if (this.hintOverride === null) this.hintElement.textContent = this.modeHint;

    for (const [mode, button] of this.modeButtons) {
      button.setAttribute("aria-pressed", String(state.active && state.mode === mode));
    }

    this.freezeButton.setAttribute("aria-pressed", String(state.frozen));
    this.panelButton.setAttribute("aria-pressed", String(state.panelOpen));

    this.countBadge.textContent = String(state.count);
    this.countBadge.style.display = state.count > 0 ? "inline-flex" : "none";

    this.applyStackBadge(state.page);
  }

  /**
   * The badge is the honest answer to "why is my Source line missing?" — it says
   * up front when the page is a production build with no component metadata.
   */
  private applyStackBadge(page: PageFrameworkInfo | null): void {
    if (!page) {
      this.stackBadge.style.display = "none";
      return;
    }

    // No framework on the page is the ordinary case for a universal annotator, not a
    // problem worth a warning colour. The report simply carries no component data.
    if (!page.detected) {
      this.stackBadge.style.display = "none";
      delete this.stackBadge.dataset.warn;
      return;
    }

    // The detector supplies its own label, so this stays framework-agnostic.
    const label = page.flavour ?? page.framework ?? "Detected";

    this.stackBadge.style.display = "inline-flex";
    this.stackBadge.textContent = page.version ? `${label} ${page.version}` : label;

    if (!page.devMetadata) {
      this.stackBadge.dataset.warn = "true";
      this.stackBadge.title =
        "Production build — component names and file paths are stripped. Reports will fall back to selectors and DOM paths.";
    } else {
      delete this.stackBadge.dataset.warn;
      this.stackBadge.title = page.hasSourcePositions
        ? "Dev build with source positions — source lines include line and column numbers."
        : "Dev build — source lines will be file-level only. A source-position plugin (Nuxt DevTools, for instance) adds line and column numbers.";
    }
  }

  /**
   * Override the hint for the duration of a drag. Separate from `update()`
   * because the drag rewrites this at animation-frame rate, and routing that
   * through the orchestrator's `render()` would rebuild the whole toolbar
   * sixty times a second. `null` hands the line back to the current mode.
   */
  setHint(text: string | null): void {
    this.hintOverride = text;
    this.hintElement.textContent = text ?? this.modeHint;
  }

  destroy(): void {
    this.element.remove();
  }
}
