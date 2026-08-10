// =============================================================================
// ISOLATED-world entry point — the orchestrator
// =============================================================================
//
// Owns all state, wires the UI together, and is the only place that talks to
// both the MAIN-world inspector and the service worker.
// =============================================================================

import { formatSource, generateOutput } from "../shared/output";
import type { RuntimeMessage, RuntimeResponse } from "../shared/protocol";
import {
  DEFAULT_SETTINGS,
  DETAIL_TO_COMPONENT_MODE,
  type Annotation,
  type Diagnostics,
  type InspectMode,
  type OutputDetailLevel,
  type PageFrameworkInfo,
  type Settings,
} from "../shared/types";
import {
  clearActions,
  installActionTrail,
  readActions,
  setActionTrailPaused,
} from "./actions";
import {
  clearDiagnostics,
  detectPage,
  fetchDiagnostics,
  inspectElement,
  onDiagnostics,
  setFrozen,
} from "./bridge";
import { captureDraft, resolveElement, viewportBoxes, type Draft } from "./capture";
import { copyText } from "./clipboard";
import { identifyElement, isAnnotatable, isOurUi } from "./identify";
import { cropAndDownload } from "./screenshot";
import { resolveSource } from "./source";
import {
  loadAnnotations,
  loadSettings,
  onSettingsChanged,
  saveAnnotations,
  saveSettings,
} from "./storage";
import { Composer } from "./ui/composer";
import { listen } from "./ui/dom";
import { Markers } from "./ui/markers";
import { elementsInRect, Overlay } from "./ui/overlay";
import { Panel } from "./ui/panel";
import { createUiRoot } from "./ui/root";
import { Toolbar } from "./ui/toolbar";

// Guard against a double injection (a manual `chrome.scripting` call on top of
// the declarative content script would otherwise give you two toolbars).
declare global {
  interface Window {
    __senannotateInstalled?: boolean;
  }
}
if (window.__senannotateInstalled) throw new Error("senannotate: already installed");
window.__senannotateInstalled = true;

// -----------------------------------------------------------------------------
// State
// -----------------------------------------------------------------------------

let settings: Settings = { ...DEFAULT_SETTINGS };
let annotations: Annotation[] = [];
let page: PageFrameworkInfo | null = null;
/** Mirror of the MAIN world's buffers, kept current by pushed events. */
let diagnosticsCache: Diagnostics | null = null;

let active = false;
let mode: InspectMode = "point";
let frozen = false;
let panelOpen = false;

let hoveredElement: Element | null = null;
let composer: Composer | null = null;
let marqueeStart: { x: number; y: number } | null = null;

/** Elements the composer is currently about — kept live for screenshotting. */
let composerTargets: Element[] = [];

// -----------------------------------------------------------------------------
// UI
// -----------------------------------------------------------------------------

const ui = createUiRoot();
const overlay = new Overlay(ui.overlayLayer);

const markers = new Markers(ui.markerLayer, {
  onClick: (annotation) => openEditor(annotation),
  onHoverChange: (annotation) => {
    if (composer) return;
    if (!annotation) {
      overlay.hideHighlights();
      return;
    }
    overlay.showHighlights(viewportBoxes(annotation), {
      primary: annotation.element,
      secondary: formatSource(annotation.source),
    });
  },
});

const toolbar = new Toolbar(ui.cardLayer, {
  onToggleActive: () => setActive(!active),
  onModeChange: (next) => {
    mode = next;
    overlay.hideAll();
    render();
  },
  onToggleFreeze: () => toggleFreeze(),
  onTogglePanel: () => togglePanel(),
});

let panel: Panel | null = null;

const panelCallbacks = {
  onClose: () => togglePanel(false),
  onCopy: () => copyReport(),
  onClearAll: () => clearAll(),
  onSelect: (annotation: Annotation) => {
    scrollToAnnotation(annotation);
    openEditor(annotation);
  },
  onHoverChange: (annotation: Annotation | null) => {
    if (!annotation) {
      overlay.hideHighlights();
      return;
    }
    overlay.showHighlights(viewportBoxes(annotation), {
      primary: annotation.element,
      secondary: formatSource(annotation.source),
    });
  },
  onDetailChange: (level: OutputDetailLevel) => {
    settings = { ...settings, detailLevel: level, componentMode: DETAIL_TO_COMPONENT_MODE[level] };
    void saveSettings(settings);
    render();
  },
};

function render(): void {
  toolbar.update({ active, mode, frozen, panelOpen, count: annotations.length, page });
  markers.render(annotations, settings.showMarkers && !!annotations.length);
  panel?.render(annotations, settings.detailLevel);
  void notifyBadge();
}

// -----------------------------------------------------------------------------
// Mode switching
// -----------------------------------------------------------------------------

function setActive(next: boolean): void {
  if (active === next) return;
  active = next;
  setActionTrailPaused(active);

  // A slow SSR app may still have been hydrating when boot() gave up looking.
  if (active && !page?.detected) void ensureDetection();

  if (!active) {
    overlay.hideAll();
    hoveredElement = null;
    hoverLabel = null;
    marqueeStart = null;
    document.body.style.removeProperty("cursor");
  } else {
    document.body.style.setProperty("cursor", "crosshair", "important");
    if (settings.freezeOnInspect && !frozen) void toggleFreeze(true);
  }

  render();
}

async function toggleFreeze(force?: boolean): Promise<void> {
  const next = force ?? !frozen;
  if (next === frozen) return;
  frozen = next;
  await setFrozen(frozen);
  ui.toast(frozen ? "Animations frozen" : "Animations resumed");
  render();
}

function togglePanel(force?: boolean): void {
  const next = force ?? !panelOpen;
  panelOpen = next;

  if (panelOpen && !panel) {
    panel = new Panel(ui.cardLayer, panelCallbacks);
    refreshCaptureSummary();
  }
  if (!panelOpen && panel) {
    panel.destroy();
    panel = null;
    overlay.hideHighlights();
  }

  render();
}

function refreshCaptureSummary(): void {
  if (!panel || !settings.captureDiagnostics) return;
  panel.renderCaptureSummary({
    logs: diagnosticsCache?.logs.length ?? 0,
    requests: diagnosticsCache?.network.length ?? 0,
    actions: readActions().length,
  });
}

// -----------------------------------------------------------------------------
// Hover
// -----------------------------------------------------------------------------

let hoverToken = 0;
/** Kept so a scroll can redraw the highlight without re-querying the bridge. */
let hoverLabel: { primary: string; secondary?: string | null } | null = null;

async function updateHover(element: Element): Promise<void> {
  hoveredElement = element;
  const token = ++hoverToken;

  const { name } = identifyElement(element);

  // Draw immediately with what we already know, then enrich once the inspector
  // answers. Waiting for the bridge first would make the highlight feel laggy.
  hoverLabel = { primary: name };
  overlay.showHighlights([element.getBoundingClientRect()], hoverLabel);

  if (settings.componentMode === "off") return;

  const vue = await inspectElement(element, settings.componentMode, settings.maxComponents, false);

  // The pointer moved on while we waited — this result is stale.
  if (token !== hoverToken || hoveredElement !== element) return;

  hoverLabel = {
    primary: vue?.ownerComponent ? `<${vue.ownerComponent}>` : name,
    secondary: formatSource(resolveSource(element, vue)),
  };
  overlay.showHighlights([element.getBoundingClientRect()], hoverLabel);
}

// -----------------------------------------------------------------------------
// Creating annotations
// -----------------------------------------------------------------------------

async function beginAnnotation(elements: Element[], selectedText?: string): Promise<void> {
  const draft = await captureDraft(elements, { settings, selectedText });
  if (!draft) return;

  composerTargets = elements;
  openComposer(draft, elements[0].getBoundingClientRect(), null);
}

function openEditor(annotation: Annotation): void {
  const element = resolveElement(annotation);
  composerTargets = element ? [element] : [];

  const boxes = viewportBoxes(annotation);
  const anchor = boxes[0] ?? new DOMRect(window.innerWidth / 2, window.innerHeight / 2, 0, 0);
  openComposer(annotation, anchor, annotation);
}

function openComposer(draft: Draft, anchor: DOMRect, existing: Annotation | null): void {
  composer?.destroy();
  overlay.showHighlights(
    existing ? viewportBoxes(existing) : composerTargets.map((el) => el.getBoundingClientRect()),
    { primary: draft.element, secondary: formatSource(draft.source) },
  );

  const props = draft.framework?.props
    ? Object.entries(draft.framework.props)
        .slice(0, 4)
        .map(([key, value]) => `${key}=${value}`)
        .join(", ")
    : "";

  composer = new Composer(
    ui.cardLayer,
    anchor,
    {
      title: draft.element,
      source: formatSource(draft.source),
      components: draft.framework?.path ?? null,
      props: props || null,
      selectedText: draft.selectedText,
      elementCount: draft.elementBoundingBoxes?.length,
      initialComment: existing?.comment,
    },
    {
      onSubmit: (comment) => {
        if (existing) {
          existing.comment = comment;
        } else {
          annotations = [
            ...annotations,
            { ...draft, id: newId(), comment, timestamp: Date.now() } as Annotation,
          ];
        }
        closeComposer();
        void persist();
        render();
        ui.toast(existing ? "Annotation updated" : "Annotation added");
      },
      onCancel: () => closeComposer(),
      onScreenshot: () => void captureScreenshot(existing ?? draft),
      onDelete: existing
        ? () => {
            annotations = annotations.filter((item) => item.id !== existing.id);
            closeComposer();
            void persist();
            render();
            ui.toast("Annotation deleted");
          }
        : undefined,
    },
  );
}

function closeComposer(): void {
  composer?.destroy();
  composer = null;
  composerTargets = [];
  overlay.hideHighlights();
}

function newId(): string {
  return `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

async function persist(): Promise<void> {
  await saveAnnotations(annotations);
}

function scrollToAnnotation(annotation: Annotation): void {
  const element = resolveElement(annotation);
  if (element) {
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  if (!annotation.isFixed) {
    window.scrollTo({ top: Math.max(0, annotation.y - window.innerHeight / 2), behavior: "smooth" });
  }
}

// -----------------------------------------------------------------------------
// Report + screenshot
// -----------------------------------------------------------------------------

/**
 * Deliberately synchronous up to the clipboard call.
 *
 * `navigator.clipboard.writeText` needs the click's transient user activation,
 * and an `await` before it throws that away — the write then fails silently and
 * the user gets whatever was on their clipboard before. That is why diagnostics
 * are mirrored via a pushed event rather than fetched here.
 */
function copyReport(): void {
  if (!annotations.length) return;

  const markdown = generateOutput(
    annotations,
    {
      pathname: location.pathname,
      href: location.href,
      page,
      diagnostics: settings.captureDiagnostics ? diagnosticsCache : null,
      actions: settings.captureDiagnostics ? readActions() : [],
    },
    settings.detailLevel,
  );

  void copyText(markdown, ui.shadow).then((copied) => {
    ui.toast(
      copied
        ? `Copied ${annotations.length} annotation${annotations.length === 1 ? "" : "s"}`
        : "Copy failed",
      copied ? "success" : "error",
    );
  });
}

async function captureScreenshot(target: Draft | Annotation): Promise<void> {
  const element = composerTargets[0];
  const box = element ? element.getBoundingClientRect() : viewportBoxes(target)[0];
  if (!box || box.width === 0 || box.height === 0) {
    ui.toast("Nothing to capture", "error");
    return;
  }

  // captureVisibleTab photographs whatever is on screen, our overlay included —
  // so it has to step out of the shot first.
  ui.host.style.setProperty("display", "none", "important");
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  let response: RuntimeResponse | null = null;
  try {
    response = await sendRuntime({ kind: "capture" });
  } finally {
    ui.host.style.removeProperty("display");
  }

  if (!response?.ok || !response.dataUrl) {
    ui.toast("Screenshot failed", "error");
    return;
  }

  const filename = `senannotate-${Date.now()}.png`;
  const saved = await cropAndDownload(response.dataUrl, box, filename);

  if (saved) {
    target.screenshot = filename;
    ui.toast("Screenshot saved to Downloads");
    void persist();
  } else {
    ui.toast("Could not save screenshot", "error");
  }
}

function clearAll(): void {
  if (!annotations.length) return;
  annotations = [];
  closeComposer();
  // Clear the trail too: keeping steps and errors from a bug you already filed
  // would attach them to the next, unrelated report.
  clearActions();
  diagnosticsCache = null;
  void clearDiagnostics();
  void persist();
  render();
  ui.toast("All annotations cleared");
}

// -----------------------------------------------------------------------------
// Runtime messaging
// -----------------------------------------------------------------------------

async function sendRuntime(message: RuntimeMessage): Promise<RuntimeResponse | null> {
  try {
    return (await chrome.runtime.sendMessage(message)) as RuntimeResponse;
  } catch {
    // The service worker restarted, or the extension was reloaded.
    return null;
  }
}

async function notifyBadge(): Promise<void> {
  await sendRuntime({ kind: "badge", count: annotations.length });
}

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message.kind === "toggle-inspect") {
    setActive(!active);
    sendResponse({ ok: true, active });
    return true;
  }
  if (message.kind === "get-status") {
    sendResponse({ ok: true, count: annotations.length, active });
    return true;
  }
  if (message.kind === "settings-changed") {
    void refreshSettings();
    sendResponse({ ok: true });
    return true;
  }
  return false;
});

async function refreshSettings(): Promise<void> {
  settings = await loadSettings();
  ui.setTheme(settings.theme);
  render();
}

// -----------------------------------------------------------------------------
// Page event handling
// -----------------------------------------------------------------------------

function eligible(element: Element): boolean {
  return isAnnotatable(element) && !isOurUi(element);
}

listen(
  document,
  "pointermove",
  (event) => {
    if (!active || composer || marqueeStart) return;
    if (mode !== "point") return;

    const target = document.elementFromPoint(event.clientX, event.clientY);
    if (!target || !eligible(target)) {
      overlay.hideHighlights();
      hoveredElement = null;
      hoverLabel = null;
      return;
    }
    if (target === hoveredElement) return;
    void updateHover(target);
  },
  { passive: true },
);

listen(
  document,
  "click",
  (event) => {
    if (!active || composer) return;
    if (isOurUi(event.target as Element)) return;

    // In text mode a click is how you finish a selection, so let it through.
    if (mode === "text") return;

    event.preventDefault();
    event.stopPropagation();

    if (mode !== "point") return;
    const target = document.elementFromPoint(event.clientX, event.clientY);
    if (!target || !eligible(target)) return;
    void beginAnnotation([target]);
  },
  { capture: true },
);

// Swallow the mousedown/mouseup pair too, so the page never sees a half-click.
for (const type of ["mousedown", "mouseup"] as const) {
  listen(
    document,
    type,
    (event) => {
      if (!active || composer || mode === "text") return;
      if (isOurUi(event.target as Element)) return;
      event.preventDefault();
      event.stopPropagation();
    },
    { capture: true },
  );
}

// --- text selection ----------------------------------------------------------

listen(document, "mouseup", () => {
  if (!active || composer || mode !== "text") return;

  // Let the browser settle the selection before reading it.
  window.setTimeout(() => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (!selection || !text) return;

    const container = selection.getRangeAt(0).commonAncestorContainer;
    const element =
      container.nodeType === Node.ELEMENT_NODE
        ? (container as Element)
        : container.parentElement;

    if (!element || !eligible(element)) return;
    void beginAnnotation([element], text);
  }, 0);
});

// --- marquee -----------------------------------------------------------------

listen(
  document,
  "pointerdown",
  (event) => {
    if (!active || composer || mode !== "area") return;
    if (isOurUi(event.target as Element)) return;
    marqueeStart = { x: event.clientX, y: event.clientY };
    overlay.hideHighlights();
  },
  { capture: true },
);

listen(
  document,
  "pointermove",
  (event) => {
    if (!marqueeStart) return;
    overlay.showMarquee({
      left: Math.min(marqueeStart.x, event.clientX),
      top: Math.min(marqueeStart.y, event.clientY),
      width: Math.abs(event.clientX - marqueeStart.x),
      height: Math.abs(event.clientY - marqueeStart.y),
    });
  },
  { passive: true },
);

listen(
  document,
  "pointerup",
  (event) => {
    if (!marqueeStart) return;
    const start = marqueeStart;
    marqueeStart = null;
    overlay.hideMarquee();

    const rect = {
      left: Math.min(start.x, event.clientX),
      top: Math.min(start.y, event.clientY),
      right: Math.max(start.x, event.clientX),
      bottom: Math.max(start.y, event.clientY),
    };

    const hits = elementsInRect(rect, eligible);
    if (!hits.length) return;
    void beginAnnotation(hits);
  },
  { capture: true },
);

// --- keyboard ----------------------------------------------------------------

listen(document, "keydown", (event) => {
  const keyboard = event as KeyboardEvent;

  if (keyboard.key === "Escape") {
    if (composer) {
      closeComposer();
      return;
    }
    if (active) {
      setActive(false);
      return;
    }
  }

  if (composer) return;

  // Never hijack a key the user is typing into the page.
  const target = keyboard.target as HTMLElement | null;
  if (target?.isContentEditable) return;
  if (target && /^(input|textarea|select)$/i.test(target.tagName)) return;
  if (keyboard.metaKey || keyboard.ctrlKey || keyboard.altKey) return;

  if (!active) return;

  switch (keyboard.key) {
    case "1":
      mode = "point";
      overlay.hideAll();
      render();
      break;
    case "2":
      mode = "text";
      overlay.hideAll();
      render();
      break;
    case "3":
      mode = "area";
      overlay.hideAll();
      render();
      break;
    case "f":
      void toggleFreeze();
      break;
    case "a":
      togglePanel();
      break;
    default:
      break;
  }
});

// --- viewport ----------------------------------------------------------------

let syncQueued = false;
function queueSync(): void {
  if (syncQueued) return;
  syncQueued = true;
  requestAnimationFrame(() => {
    syncQueued = false;
    markers.syncPositions();
    if (!composer && hoveredElement && active && mode === "point") {
      overlay.showHighlights([hoveredElement.getBoundingClientRect()], hoverLabel ?? undefined);
    }
  });
}

listen(window, "scroll", queueSync, { passive: true, capture: true });
listen(window, "resize", queueSync, { passive: true });

// -----------------------------------------------------------------------------
// Boot
// -----------------------------------------------------------------------------

/**
 * Poll for the Vue runtime until it shows up.
 *
 * The content script runs at `document_idle`, which on a server-rendered Nuxt app
 * is well before hydration finishes — especially against a dev server compiling
 * modules on demand. A single retry was not enough: real pages took longer than
 * that, and the toolbar sat there claiming "No Vue detected" while per-element
 * inspection was working perfectly. The schedule below backs off to ~15s total
 * and then stops, because by then the page genuinely has no Vue on it.
 */
const DETECT_DELAYS_MS = [0, 400, 1000, 2000, 4000, 8000];

let detecting = false;

async function ensureDetection(): Promise<void> {
  if (detecting || page?.detected) return;
  detecting = true;

  try {
    for (const delay of DETECT_DELAYS_MS) {
      if (delay) await new Promise((resolve) => window.setTimeout(resolve, delay));

      const result = await detectPage();
      if (!result) continue;

      // Render even on a negative result — that is what paints the "No Vue
      // detected" badge, and the version string can arrive on a later pass.
      page = result;
      render();
      if (result.detected) return;
    }
  } finally {
    detecting = false;
  }
}

async function boot(): Promise<void> {
  settings = await loadSettings();
  ui.setTheme(settings.theme);
  annotations = await loadAnnotations();

  onSettingsChanged((next) => {
    settings = next;
    ui.setTheme(settings.theme);
    render();
  });

  if (settings.captureDiagnostics) {
    installActionTrail();
    onDiagnostics((diagnostics) => {
      diagnosticsCache = diagnostics;
      refreshCaptureSummary();
    });
    // Seed the mirror: anything recorded before this listener was attached (the
    // inspector starts at document_start, we start at document_idle) has already
    // been pushed and missed.
    diagnosticsCache = await fetchDiagnostics();
  }

  render();
  await ensureDetection();
}

void boot();
