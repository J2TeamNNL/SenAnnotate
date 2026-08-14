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
  settingsOpen: boolean;
  /** Shrunk to a single handle, so the pill stops covering the page. */
  collapsed: boolean;
  count: number;
  page: PageFrameworkInfo | null;
}

export interface ToolbarCallbacks {
  onToggleActive(): void;
  onModeChange(mode: InspectMode): void;
  onToggleFreeze(): void;
  onTogglePanel(): void;
  onToggleSettings(): void;
  onToggleCollapse(): void;
  /** Fired once, on drop — not per frame. The drag itself needs no persistence. */
  onMove(position: { x: number; y: number }): void;
}

/**
 * How far the pointer must travel before a press stops being a click.
 *
 * The whole pill is the drag handle, buttons included, so this number is the only
 * thing separating "collapse the toolbar" from "move the toolbar". Too small and a
 * shaky click stops working; too large and short drags feel dead. 4px is roughly the
 * platform convention and is what a trackpad tap stays inside.
 */
const DRAG_THRESHOLD = 4;

/** Kept between the pill and the viewport edge, so it can always be grabbed again. */
const DOCK_EDGE = 8;

/** Below this, a top-anchored dock has no room to draw its hint above itself. */
const HINT_FLIP_TOP = 40;

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
  point: "Click an element · ⌘/Ctrl+drag across several · C captures hover · 2 text · 3 area",
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
  private readonly settingsButton: HTMLButtonElement;
  private readonly collapseButton: HTMLButtonElement;
  private readonly countBadge: HTMLElement;
  /**
   * The count again, on the collapsed handle. A separate node rather than a moved
   * one: `.count` is read by an e2e assertion, and two elements sharing that class
   * would make the locator ambiguous.
   */
  private readonly handleCount: HTMLElement;
  private readonly stackBadge: HTMLElement;
  private readonly hintElement: HTMLElement;
  /** Transient text from a drag; `null` means "show the mode's own hint". */
  private hintOverride: string | null = null;
  /** Dock size, measured once at the start of a drag. `null` outside one. */
  private dragSize: { width: number; height: number } | null = null;
  /**
   * The point last *asked* for, before clamping. `null` means the CSS corner.
   *
   * Re-clamping has to start from the request rather than from the clamped result, or a
   * spell in a narrow window walks the pill left one clamp at a time and widening the
   * window again never brings it back.
   */
  private requested: { x: number; y: number } | null = null;
  /**
   * Whether the hint line is currently drawn, which decides whether the dock needs to
   * flip it below the pill. Mirrored here because the flip is recomputed from
   * `paintPosition`, which has no `ToolbarState` to hand.
   */
  private hintVisible = false;
  private readonly resizeObserver: ResizeObserver;
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

    this.settingsButton = h(
      "button",
      {
        class: "tool tool--settings",
        title: "Settings",
        attrs: { "aria-pressed": "false" },
        on: { click: () => callbacks.onToggleSettings() },
      },
      icon("gear"),
    );

    this.stackBadge = h("span", { class: "stack-badge", style: { display: "none" } });

    // Both icons live in the button and the stylesheet picks one. `update()` runs on
    // every state change — panel toggles, hover-driven counts — and swapping an SVG
    // node there would be needless churn for a button that only has two faces.
    const collapseIcon = icon("chevron");
    collapseIcon.classList.add("tool__icon--collapse");
    const expandIcon = icon("s", 17);
    expandIcon.classList.add("tool__icon--expand");

    this.handleCount = h("span", { class: "handle-count", text: "0", style: { display: "none" } });

    this.collapseButton = h(
      "button",
      {
        class: "tool tool--collapse",
        title: "Collapse toolbar (H)",
        attrs: { "aria-expanded": "true" },
        on: { click: () => callbacks.onToggleCollapse() },
      },
      collapseIcon,
      expandIcon,
      this.handleCount,
    );

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
      this.settingsButton,
      this.collapseButton,
    );

    // The dock owns the fixed position; `.toolbar` stays the pill so the e2e
    // locators and every existing style keep working.
    this.element = h("div", { class: "toolbar-dock" }, this.hintElement, bar);

    layer.append(this.element);
    this.installDrag(bar, callbacks);

    // A floating dock is anchored by its top-left, so it grows rightwards and downwards
    // out of the viewport whenever it gets bigger — and it changes size for three reasons
    // `resize` cannot see: expanding from the collapsed handle, the hint line appearing
    // with inspect mode, and the stack badge arriving after detection. Re-clamping from
    // the requested point covers all three, including each transient width of the 160ms
    // collapse animation, because the last delivery uses the settled size.
    //
    // Writing `left`/`top` does not change the observed size, so this cannot loop.
    this.resizeObserver = new ResizeObserver(() => this.paintPosition());
    this.resizeObserver.observe(this.element);
  }

  // ---------------------------------------------------------------------------
  // Dragging
  // ---------------------------------------------------------------------------

  /**
   * Make the whole pill a drag handle, buttons included.
   *
   * A dedicated grip was the first design and was dropped: it adds width to a pill
   * whose entire problem is that it covers things, and it leaves the collapsed
   * handle — a single button — with nothing to grab. A movement threshold gives
   * every pixel of the toolbar both meanings and costs no space.
   *
   * Pointer events rather than mouse events, for `setPointerCapture`: without it a
   * fast drag outruns the pill, the pointer ends up over the page, and the moves
   * stop arriving.
   *
   * Capture **retargets** those moves; it does not stop them propagating. `root.ts`
   * deliberately lets `pointermove` through the host, so every move of a drag still
   * reaches `document` and the page's own listeners — which is why the hover path
   * consults `isDragging()` rather than assuming it cannot fire mid-drag.
   */
  private installDrag(bar: HTMLElement, callbacks: ToolbarCallbacks): void {
    let origin: { x: number; y: number } | null = null;
    let grab = { dx: 0, dy: 0 };
    let moved = false;

    /** Abandon a press without persisting anything or ending a drag that never began. */
    const forget = () => {
      origin = null;
      this.dragSize = null;
    };

    bar.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;

      const box = this.element.getBoundingClientRect();
      origin = { x: event.clientX, y: event.clientY };
      grab = { dx: event.clientX - box.left, dy: event.clientY - box.top };
      // Measured once per drag. The dock's size does not change while it is being
      // dragged, and re-reading it per move is a forced layout at pointer frequency.
      this.dragSize = { width: box.width, height: box.height };
      moved = false;
    });

    bar.addEventListener("pointermove", (event) => {
      if (!origin) return;

      // Capture is only taken *after* the threshold, so a press released within a few
      // pixels of the pill's edge — pointer off `.toolbar` before it has travelled far
      // enough — never reaches `end()` and leaves `origin` set. A later plain *hover*
      // would then measure travel against that stale origin, cross the threshold at
      // once, and drag the pill under a cursor with no button held. `buttons` is the
      // only reliable witness that the press is already over.
      if (event.buttons === 0) {
        forget();
        return;
      }

      if (!moved) {
        const travelled =
          Math.abs(event.clientX - origin.x) + Math.abs(event.clientY - origin.y);
        if (travelled < DRAG_THRESHOLD) return;
        moved = true;
        this.element.dataset.dragging = "true";
        // Throws `NotFoundError` when the pointerId is no longer active and
        // `InvalidStateError` when the element is disconnected. Neither is worth
        // wedging the drag for: `moved` and `data-dragging` are already set, and an
        // uncaught throw here would skip the `moveTo` below, stick the grabbing
        // cursor, and leave the capture-phase `click` handler swallowing the next
        // genuine toolbar click. Without capture the drag simply stops tracking
        // once the pointer outruns the pill — degraded, not broken.
        try {
          bar.setPointerCapture(event.pointerId);
        } catch {
          /* keep dragging uncaptured */
        }
      }

      this.moveTo(event.clientX - grab.dx, event.clientY - grab.dy);
    });

    const end = (event: PointerEvent) => {
      if (!origin) return;
      // `pointerdown` starts a drag on the primary button only, and the same test is
      // needed here: releasing a *second* button mid-drag would otherwise end the drag
      // while the first is still held — position persisted half-way, the pill frozen
      // because every later move returns early, and the real `pointerup` a no-op.
      // `pointercancel` carries no meaningful `button` and must always end the drag.
      if (event.type === "pointerup" && event.button !== 0) return;

      const wasDragging = moved;
      forget();
      if (!wasDragging) return;

      delete this.element.dataset.dragging;
      if (bar.hasPointerCapture(event.pointerId)) bar.releasePointerCapture(event.pointerId);

      // The requested point, not the clamped one: a drop against the edge of a narrow
      // window would otherwise be *stored* clamped, and re-opening the page wide would
      // not restore where the pill was actually put.
      if (this.requested) callbacks.onMove(this.requested);

      // The click below normally clears this, but a drag does not always produce
      // one — release outside the pill and none is dispatched. Left set, it would
      // swallow the next genuine click. A timeout rather than an immediate reset
      // because the click, when it comes, comes first.
      window.setTimeout(() => {
        moved = false;
      }, 0);
    };

    bar.addEventListener("pointerup", end);
    bar.addEventListener("pointercancel", end);

    // A drag that ends on a button would otherwise also press it — let go over the
    // collapse button and the toolbar collapses where you dropped it. Capture phase,
    // so this runs before the button's own listener rather than after.
    bar.addEventListener(
      "click",
      (event) => {
        if (!moved) return;
        moved = false;
        event.preventDefault();
        event.stopPropagation();
      },
      { capture: true },
    );
  }

  /** Ask for a viewport point. Stored unclamped; painted clamped. */
  private moveTo(x: number, y: number): void {
    this.requested = { x, y };
    this.paintPosition();
  }

  /**
   * Draw the dock at the requested point, clamped so it can never be lost off-screen.
   *
   * `Math.max(EDGE, Math.min(x, limit))` and not the other way round: on a window
   * narrower than the pill the upper bound goes *negative*, and `Math.min(≥EDGE, -27)`
   * returns `-27` — pushing the pill off the left edge exactly where the clamp exists to
   * rescue it. The lower bound has to win.
   */
  private paintPosition(): void {
    if (!this.requested) return;

    const box = this.dragSize ?? this.element.getBoundingClientRect();
    const left = Math.max(
      DOCK_EDGE,
      Math.min(this.requested.x, window.innerWidth - box.width - DOCK_EDGE),
    );
    const top = Math.max(
      DOCK_EDGE,
      Math.min(this.requested.y, window.innerHeight - box.height - DOCK_EDGE),
    );

    this.element.dataset.floating = "true";
    this.element.style.left = `${left}px`;
    this.element.style.top = `${top}px`;

    // The hint sits above the pill by default and would be off-screen up there — but
    // only when it is *hidden* is that a prediction worth making. Once it is drawn it is
    // part of the dock, so the clamp above already guarantees it on screen, and flipping
    // as the pointer crosses `HINT_FLIP_TOP` mid-drag would jerk the pill ~30px under a
    // stationary cursor and jerk it back on the way out.
    this.element.dataset.hintBelow = String(!this.hintVisible && top < HINT_FLIP_TOP);
  }

  /**
   * Apply a stored position, or fall back to the CSS dock.
   *
   * Called on load and on every resize: a window narrowed since the position was
   * saved can leave the pill outside the viewport, and re-clamping is what makes the
   * stored coordinates safe to keep in viewport space at all. Changes to the dock's
   * *own* size are handled by the `ResizeObserver` in the constructor instead.
   */
  applyPosition(position: { x: number; y: number } | null): void {
    this.requested = position;
    if (!position) {
      delete this.element.dataset.floating;
      delete this.element.dataset.hintBelow;
      this.element.style.removeProperty("left");
      this.element.style.removeProperty("top");
      return;
    }
    this.paintPosition();
  }

  /**
   * True between the drag threshold and the drop.
   *
   * Read by the hover path: pointer capture retargets the moves but does not stop them
   * reaching `document`, so without this a fast drag paints highlights across the page
   * and leaves `hoveredElement` pointing at whatever the cursor outran the pill onto.
   */
  isDragging(): boolean {
    return this.element.dataset.dragging === "true";
  }

  update(state: ToolbarState): void {
    this.applyCollapse(state);

    this.brandButton.setAttribute("aria-pressed", String(state.active));
    this.brandLabel.textContent = state.active ? "Inspecting" : "Inspect";
    this.modeGroup.style.display = state.active ? "flex" : "none";

    this.modeHint = MODE_HINTS[state.mode];
    this.hintVisible = state.active;
    this.hintElement.style.display = state.active ? "block" : "none";
    if (this.hintOverride === null) this.hintElement.textContent = this.modeHint;

    for (const [mode, button] of this.modeButtons) {
      button.setAttribute("aria-pressed", String(state.active && state.mode === mode));
    }

    this.freezeButton.setAttribute("aria-pressed", String(state.frozen));
    this.panelButton.setAttribute("aria-pressed", String(state.panelOpen));
    this.settingsButton.setAttribute("aria-pressed", String(state.settingsOpen));

    this.countBadge.textContent = String(state.count);
    this.countBadge.style.display = state.count > 0 ? "inline-flex" : "none";

    this.applyStackBadge(state.page);
  }

  /**
   * Collapsing takes inspect mode and the panel with it — see `toggleCollapsed`. The
   * annotations and the freeze carry on.
   *
   * `data-inspecting` therefore no longer needs to make an armed handle legible; that
   * state cannot occur. It stays because it is the one readable signal of `active` on
   * the dock, which is what the e2e suite reads inspect mode off.
   */
  private applyCollapse({ collapsed, active, count }: ToolbarState): void {
    this.element.dataset.collapsed = String(collapsed);
    this.element.dataset.inspecting = String(active);
    this.collapseButton.setAttribute("aria-expanded", String(!collapsed));

    // The handle carries the count so that collapsing does not cost you the one
    // number worth knowing at a glance: how much you have already noted.
    this.handleCount.textContent = String(count);
    this.handleCount.style.display = collapsed && count > 0 ? "inline-flex" : "none";

    if (!collapsed) {
      this.collapseButton.title = "Collapse toolbar (H)";
      return;
    }
    this.collapseButton.title = count
      ? `Show toolbar (H) — ${count} annotation${count === 1 ? "" : "s"}`
      : "Show toolbar (H)";
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
    this.resizeObserver.disconnect();
    this.element.remove();
  }
}
