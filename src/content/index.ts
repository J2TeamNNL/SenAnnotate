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
  isDone,
  type Annotation,
  type AnnotationKind,
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
import {
  broadcastFrameState,
  installChildFrame,
  isFrameWorthInstrumenting,
  isLiveChildFrame,
  isTopFrame,
  onFrameDraft,
  requestFrameHoverCapture,
} from "./frames";
import { identifyElement, isAnnotatable, isOurUi } from "./identify";
import {
  canvasToBlob,
  cropToCanvas,
  downloadBlob,
  downloadPath,
  encodeForEmbed,
} from "./screenshot";
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
import {
  hitsInRect,
  MAX_MARQUEE_ELEMENTS,
  snapshotCandidates,
  toViewport,
  type Candidate,
  type MarqueeHits,
} from "./ui/marquee";
import { Overlay } from "./ui/overlay";
import { Panel } from "./ui/panel";
import { createUiRoot, type UiRoot } from "./ui/root";
import { ShotEditor } from "./ui/shot-editor";
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
/** Open only while a screenshot is being marked up, always on top of a composer. */
let shotEditor: ShotEditor | null = null;
/** Drag anchor, in document coordinates so a mid-drag scroll cannot move it. */
let marqueeStart: { x: number; y: number } | null = null;
/** Latest pointer position, document coordinates. Read by the rAF callback. */
let marqueePoint: { x: number; y: number } | null = null;
/** Measured once per drag — see `snapshotCandidates`. */
let marqueeCandidates: Candidate[] = [];
let marqueeHits: MarqueeHits = { elements: [], rects: [], capped: false };
let marqueeFrame = 0;

/** Elements the composer is currently about — kept live for screenshotting. */
let composerTargets: Element[] = [];

/**
 * Elements gathered by shift-clicking, waiting for <kbd>Enter</kbd> to become one
 * annotation. Empty the rest of the time, and emptying it is always safe — nothing
 * here has been captured yet.
 */
let pendingSelection: Element[] = [];

// -----------------------------------------------------------------------------
// UI
// -----------------------------------------------------------------------------

let ui!: UiRoot;
let overlay!: Overlay;
let markers!: Markers;
let toolbar!: Toolbar;
let panel: Panel | null = null;

/**
 * Build the chrome. Top frame only — a second toolbar inside every iframe is both
 * wrong and, unlike the rest of the child-frame path, extremely visible.
 */
function createTopUi(): void {
  ui = createUiRoot();
  overlay = new Overlay(ui.overlayLayer);

  markers = new Markers(ui.markerLayer, {
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

  toolbar = new Toolbar(ui.cardLayer, {
    onToggleActive: () => setActive(!active),
    onModeChange: (next) => {
      mode = next;
      clearPendingSelection();
      resetMarquee();
      overlay.hideAll();
      render();
      broadcastFrameState(active, mode);
    },
    onToggleFreeze: () => toggleFreeze(),
    onTogglePanel: () => togglePanel(),
    onToggleCollapse: () => toggleCollapsed(),
  });
}

const panelCallbacks = {
  onClose: () => togglePanel(false),
  onCopy: () => copyReport(),
  onDownload: () => downloadReport(),
  onClearAll: () => clearAll(),
  onSelect: (annotation: Annotation) => {
    scrollToAnnotation(annotation);
    openEditor(annotation);
  },
  onToggleStatus: (annotation: Annotation) => {
    annotation.status = isDone(annotation) ? "open" : "done";
    void persist();
    render();
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
  toolbar.update({
    active,
    mode,
    frozen,
    panelOpen,
    collapsed: settings.toolbarCollapsed,
    count: annotations.length,
    page,
  });
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
    clearPendingSelection();
    resetMarquee();
    overlay.hideAll();
    hoveredElement = null;
    hoverLabel = null;
    document.body.style.removeProperty("cursor");
  } else {
    document.body.style.setProperty("cursor", "crosshair", "important");
    if (settings.freezeOnInspect && !frozen) void toggleFreeze(true);
  }

  // Frames have no toolbar of their own, so this is the only way they learn that
  // inspect mode changed.
  broadcastFrameState(active, mode);
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

/**
 * The collapsed state is a setting rather than a session flag, so that a reload of
 * the page being reviewed does not put the pill back over the corner you were
 * looking at. `onSettingsChanged` carries it to the other open tabs for free.
 */
function toggleCollapsed(force?: boolean): void {
  const next = force ?? !settings.toolbarCollapsed;
  if (next === settings.toolbarCollapsed) return;

  settings = { ...settings, toolbarCollapsed: next };
  void saveSettings(settings);
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

  const framework = await inspectElement(
    element,
    settings.componentMode,
    settings.maxComponents,
    false,
  );

  // The pointer moved on while we waited — this result is stale.
  if (token !== hoverToken || hoveredElement !== element) return;

  hoverLabel = {
    primary: framework?.ownerComponent ? `<${framework.ownerComponent}>` : name,
    secondary: formatSource(resolveSource(element, framework)),
  };
  overlay.showHighlights([element.getBoundingClientRect()], hoverLabel);
}

/**
 * Annotate the hovered element, triggered by a key rather than a click.
 *
 * `isConnected` is the guard that matters. A menu that re-renders between the
 * pointer settling and the key being pressed leaves a detached node here, and
 * capturing one yields a zero-size box and a selector that resolves to nothing —
 * an annotation that looks fine in the list and points at nowhere in the report.
 *
 * Losing the hover state to the composer's focus is expected and survivable: the
 * draft is fully captured before the composer is constructed, so the report is
 * complete even if the menu closes as the textarea takes focus. That is the same
 * conclusion `docs/modal-focus-leak/` reached for dialogs.
 */
function captureHovered(): void {
  if (mode !== "point") return;

  if (hoveredElement && !hoveredElement.isConnected) hoveredElement = null;

  if (!hoveredElement) {
    ui.toast("Hover an element first", "error");
    return;
  }

  // Over an instrumented iframe the key belongs to that frame: it is the only
  // document whose `elementFromPoint` can see what the pointer is actually on.
  // Keyboard focus is usually still up here, so the top frame has to hand it over.
  if (requestFrameHoverCapture(hoveredElement)) return;

  void beginAnnotation([hoveredElement]);
}

/**
 * Where to open the composer for a draft that came out of an iframe.
 *
 * Its boxes are in this document's coordinate space by the time they arrive, so the
 * anchor is the translated box back in viewport terms — or the middle of the screen
 * if the capture carried no box at all.
 */
function frameAnchor(draft: Draft): DOMRect {
  const box = draft.boundingBox;
  if (!box) return new DOMRect(window.innerWidth / 2, window.innerHeight / 2, 0, 0);
  return new DOMRect(box.x - window.scrollX, box.y - window.scrollY, box.width, box.height);
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
      initialKind: existing?.kind,
    },
    {
      onSubmit: (comment, kind: AnnotationKind) => {
        if (existing) {
          existing.comment = comment;
          existing.kind = kind;
        } else {
          annotations = [
            ...annotations,
            { ...draft, id: newId(), comment, kind, timestamp: Date.now() } as Annotation,
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
  // The markup editor only ever exists on behalf of an open composer — the draft it
  // is decorating lives in that composer's closure. Leaving it up would strand a card
  // with nowhere to put its result.
  closeShotEditor();
  composer?.destroy();
  composer = null;
  composerTargets = [];
  overlay.hideHighlights();
}

function newId(): string {
  return `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

async function persist(): Promise<void> {
  const result = await saveAnnotations(annotations);
  if (result.droppedImages) {
    ui.toast(
      `Stored without ${result.droppedImages} embedded image${result.droppedImages === 1 ? "" : "s"} — too large to keep`,
      "error",
    );
  }
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
function buildReport(): string {
  return generateOutput(
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
}

function copyReport(): void {
  if (!annotations.length) return;

  const markdown = buildReport();

  void copyText(markdown, ui.shadow).then((copied) => {
    ui.toast(
      copied
        ? `Copied ${annotations.length} annotation${annotations.length === 1 ? "" : "s"}`
        : "Copy failed",
      copied ? "success" : "error",
    );
  });
}

/**
 * The report as a file.
 *
 * The clipboard is the wrong channel past a certain size — a forensic report with an
 * embedded screenshot is hundreds of kilobytes of base64, and pasting that into a
 * terminal or a ticket field is unpleasant at best. Same `<a download>` route as the
 * screenshot, so this still costs no `downloads` permission.
 */
function downloadReport(): void {
  if (!annotations.length) return;

  const slug = `${location.hostname}${location.pathname}`
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  const blob = new Blob([buildReport()], { type: "text/markdown" });
  const saved = downloadBlob(blob, `senannotate-${slug || "report"}.md`);
  ui.toast(saved ? "Report saved to Downloads" : "Could not save the report", saved ? "success" : "error");
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

  const canvas = await cropToCanvas(response.dataUrl, box);
  if (!canvas) {
    ui.toast("Screenshot failed", "error");
    return;
  }

  // Nothing is written to disk until the editor is saved — a cancelled markup is a
  // cancelled screenshot, not an unwanted file in Downloads.
  openShotEditor(canvas, target);
}

function openShotEditor(canvas: HTMLCanvasElement, target: Draft | Annotation): void {
  closeShotEditor();
  shotEditor = new ShotEditor(ui.cardLayer, canvas, {
    onCancel: () => closeShotEditor(),
    onSave: (edited) => {
      closeShotEditor();
      void deliverScreenshot(edited, target);
    },
  });
}

function closeShotEditor(): void {
  if (!shotEditor) return;
  shotEditor.destroy();
  shotEditor = null;
  // The editor took focus so its own Escape and ⌘Z would work; hand it back, or the
  // note the user was halfway through typing needs a click to resume.
  composer?.focus();
}

/**
 * Save the marked-up shot and record how the report should reach it.
 *
 * The file is always written — `embed` adds a second, smaller copy inside the
 * report rather than replacing the first, so switching the setting never costs
 * anyone the full-resolution image.
 */
async function deliverScreenshot(
  canvas: HTMLCanvasElement,
  target: Draft | Annotation,
): Promise<void> {
  const blob = await canvasToBlob(canvas);
  if (!blob) {
    ui.toast("Could not save screenshot", "error");
    return;
  }

  const filename = `senannotate-${Date.now()}.png`;
  if (!downloadBlob(blob, filename)) {
    ui.toast("Could not save screenshot", "error");
    return;
  }

  target.screenshot = filename;
  target.screenshotPath = downloadPath(filename);
  target.screenshotData =
    settings.screenshotDelivery === "embed" ? (encodeForEmbed(canvas) ?? undefined) : undefined;

  ui.toast("Screenshot saved to Downloads");
  void persist();
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


// -----------------------------------------------------------------------------
// Page event handling
// -----------------------------------------------------------------------------

/**
 * An `<iframe>` running our own capture is not annotatable from out here: the script
 * inside it is already highlighting the real element, and highlighting the frame as
 * well would draw two boxes for one thing. A frame we are *not* inside — sandboxed
 * without scripts, or too small to instrument — stays annotatable as an element,
 * which is the honest answer for it.
 */
function eligible(element: Element): boolean {
  return isAnnotatable(element) && !isOurUi(element) && !isLiveChildFrame(element);
}

// --- shift-click selection ---------------------------------------------------
//
// The marquee answers "annotate this region"; this answers "annotate these four
// things", which a rectangle cannot express when they are scattered — a label in
// one column and the input three columns over, two buttons at opposite ends of a
// toolbar. Same destination as a drag: one annotation covering several elements.

/**
 * Repaint the pending set, plus whatever the pointer is over.
 *
 * Deliberately unlabelled and in the marquee's `preview` style: every box here is
 * an equal member of one selection, and the drag already established that look for
 * exactly this meaning. Skipping the label also skips `updateHover`'s bridge round
 * trip on every move while a selection is being gathered.
 */
function paintPendingSelection(hovering?: Element | null): void {
  const rects = pendingSelection.map((element) => element.getBoundingClientRect());
  if (hovering && !pendingSelection.includes(hovering)) {
    rects.push(hovering.getBoundingClientRect());
  }

  overlay.showHighlights(rects, undefined, { preview: true });

  const count = pendingSelection.length;
  toolbar.setHint(
    count === MAX_MARQUEE_ELEMENTS
      ? `${count} elements (limit) · Enter to annotate · Esc to clear`
      : `${count} element${count === 1 ? "" : "s"} selected · shift-click to add · Enter to annotate`,
  );
}

/** Shift-click is a toggle, so a mis-click costs one more click and not the set. */
function togglePendingSelection(element: Element): void {
  const index = pendingSelection.indexOf(element);
  if (index >= 0) {
    pendingSelection.splice(index, 1);
  } else {
    // Same ceiling as the marquee. Past it the report stops being a report.
    if (pendingSelection.length >= MAX_MARQUEE_ELEMENTS) {
      ui.toast(`${MAX_MARQUEE_ELEMENTS} elements is the limit`, "error");
      return;
    }
    // An ancestor and its own descendant in one annotation describes the same
    // pixels twice; the marquee solves this by keeping only the outermost, and
    // clicking is explicit enough that replacing is friendlier than refusing.
    pendingSelection = pendingSelection.filter(
      (existing) => !existing.contains(element) && !element.contains(existing),
    );
    pendingSelection.push(element);
  }

  if (!pendingSelection.length) {
    clearPendingSelection();
    return;
  }
  paintPendingSelection();
}

function clearPendingSelection(): void {
  if (!pendingSelection.length) return;
  pendingSelection = [];
  overlay.hideHighlights();
  toolbar.setHint(null);
}

/** Hand the gathered set to the composer, in document order rather than click order. */
function commitPendingSelection(): void {
  const elements = pendingSelection.filter((element) => element.isConnected);
  clearPendingSelection();
  if (!elements.length) return;

  elements.sort((a, b) =>
    a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
  );
  void beginAnnotation(elements);
}



// --- marquee -----------------------------------------------------------------

function marqueeHint(hits: MarqueeHits): string {
  if (hits.capped) return `${MAX_MARQUEE_ELEMENTS} elements (limit) · release to annotate`;

  const count = hits.elements.length;
  if (count === 0) return "Nothing inside the box yet";
  return `${count} element${count === 1 ? "" : "s"} selected · release to annotate`;
}

function resetMarquee(): void {
  if (marqueeFrame) {
    cancelAnimationFrame(marqueeFrame);
    marqueeFrame = 0;
  }
  marqueeStart = null;
  marqueePoint = null;
  marqueeCandidates = [];
  marqueeHits = { elements: [], rects: [], capped: false };
  overlay.hideMarquee();
  toolbar.setHint(null);
}

/** Recompute and repaint the drag. Cheap: arithmetic over the snapshot, no DOM reads. */
function drawMarquee(): void {
  if (!marqueeStart || !marqueePoint) return;

  const box = {
    left: Math.min(marqueeStart.x, marqueePoint.x),
    top: Math.min(marqueeStart.y, marqueePoint.y),
    right: Math.max(marqueeStart.x, marqueePoint.x),
    bottom: Math.max(marqueeStart.y, marqueePoint.y),
  };

  overlay.showMarquee(toViewport(box));
  marqueeHits = hitsInRect(marqueeCandidates, box);
  overlay.showHighlights(marqueeHits.rects.map(toViewport), undefined, { preview: true });
  toolbar.setHint(marqueeHint(marqueeHits));
}


// --- keyboard ----------------------------------------------------------------


// --- viewport ----------------------------------------------------------------

let syncQueued = false;
function queueSync(): void {
  if (syncQueued) return;
  syncQueued = true;
  requestAnimationFrame(() => {
    syncQueued = false;
    markers.syncPositions();
    if (composer || !active || mode !== "point") return;

    // A pending selection outlives a scroll, so its boxes have to follow the page
    // the way the markers do — otherwise they sit where the elements used to be.
    if (pendingSelection.length) {
      paintPendingSelection(hoveredElement);
      return;
    }
    if (hoveredElement) {
      overlay.showHighlights([hoveredElement.getBoundingClientRect()], hoverLabel ?? undefined);
    }
  });
}


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

// -----------------------------------------------------------------------------
// Entry — which of the two shapes this document gets
// -----------------------------------------------------------------------------
//
// Everything above is the top frame's. A document inside an iframe runs the same
// bundle (`all_frames: true`) but must not build a second toolbar, must not answer
// the popup's status query, and must not own storage — so it takes the other branch
// and does nothing but highlight and capture. See `content/frames.ts`.

function installTopFrame(): void {
  createTopUi();

  // A capture that happened inside an iframe arrives already translated into this
  // document's coordinate space, so from here it is an ordinary draft.
  onFrameDraft((draft) => {
    composerTargets = [];
    openComposer(draft, frameAnchor(draft), null);
  });

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

  listen(
    document,
    "pointermove",
    (event) => {
      if (!active || composer || marqueeStart) return;
      if (mode !== "point") return;

      const target = document.elementFromPoint(event.clientX, event.clientY);
      if (!target || !eligible(target)) {
        if (pendingSelection.length) paintPendingSelection();
        else overlay.hideHighlights();
        hoveredElement = null;
        hoverLabel = null;
        return;
      }
      if (target === hoveredElement) return;

      // Mid-selection the hover highlight is a preview of what shift-click would
      // add, not a lookup — so it joins the set's own boxes instead of replacing
      // them, and skips the bridge call that would only feed a label nobody sees.
      if (pendingSelection.length) {
        hoveredElement = target;
        paintPendingSelection(target);
        return;
      }

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

      if (event.shiftKey) {
        togglePendingSelection(target);
        return;
      }

      // A plain click is a fresh start, the way it is everywhere else that has
      // shift-select. The set is discarded rather than annotated: nothing in it
      // has been captured, so there is no work to lose.
      clearPendingSelection();
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

  listen(
    document,
    "pointerdown",
    (event) => {
      if (!active || composer || mode !== "area") return;
      if (isOurUi(event.target as Element)) return;

      marqueeStart = { x: event.clientX + window.scrollX, y: event.clientY + window.scrollY };
      marqueePoint = marqueeStart;
      marqueeCandidates = snapshotCandidates();
      marqueeHits = { elements: [], rects: [], capped: false };
      overlay.hideHighlights();
      toolbar.setHint(marqueeHint(marqueeHits));
    },
    { capture: true },
  );

  listen(
    document,
    "pointermove",
    (event) => {
      if (!marqueeStart) return;
      marqueePoint = { x: event.clientX + window.scrollX, y: event.clientY + window.scrollY };
      // One repaint per frame however fast the pointer reports.
      if (marqueeFrame) return;
      marqueeFrame = requestAnimationFrame(() => {
        marqueeFrame = 0;
        drawMarquee();
      });
    },
    { passive: true },
  );

  listen(
    document,
    "pointerup",
    () => {
      if (!marqueeStart) return;

      // Flush a pending frame rather than dropping it, so what was annotated is
      // exactly what was highlighted when the button came up.
      if (marqueeFrame) {
        cancelAnimationFrame(marqueeFrame);
        marqueeFrame = 0;
        drawMarquee();
      }

      const hits = marqueeHits;
      resetMarquee();

      if (!hits.elements.length) {
        overlay.hideHighlights();
        return;
      }
      void beginAnnotation(hits.elements);
    },
    { capture: true },
  );

  listen(document, "keydown", (event) => {
    const keyboard = event as KeyboardEvent;

    if (keyboard.key === "Escape") {
      if (composer) {
        closeComposer();
        return;
      }
      // Before `setActive`, so Escape backs out of a half-built selection rather
      // than leaving inspect mode and taking the selection with it silently.
      if (pendingSelection.length) {
        clearPendingSelection();
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

    // Above the `active` guard on purpose: the pill covers the bottom-right corner
    // whether or not you are inspecting, so getting it out of the way must not require
    // turning inspect mode on first.
    if (keyboard.key === "h") {
      toggleCollapsed();
      return;
    }

    if (!active) return;

    // Checked before the switch, where Enter otherwise means `captureHovered()`.
    // Mid-selection the set is what you are pointing at, not whatever the pointer
    // happens to be resting on when you reach for the key.
    if (keyboard.key === "Enter" && pendingSelection.length) {
      commitPendingSelection();
      return;
    }

    switch (keyboard.key) {
      case "1":
        mode = "point";
        clearPendingSelection();
        resetMarquee();
        overlay.hideAll();
        render();
        break;
      case "2":
        mode = "text";
        clearPendingSelection();
        resetMarquee();
        overlay.hideAll();
        render();
        break;
      case "3":
        mode = "area";
        clearPendingSelection();
        resetMarquee();
        overlay.hideAll();
        render();
        break;
      // Annotate what the pointer is already over, without clicking it.
      //
      // A click is the one thing that destroys the state worth annotating: a hover
      // menu, a tooltip, a `:hover` colour, an autocomplete list all disappear the
      // moment you press the mouse or move toward the toolbar. Freeze does not help —
      // it parks timers and animation frames, and those surfaces are driven by pointer
      // events, not by time.
      case "c":
      case "C":
      case "Enter":
        captureHovered();
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

  listen(window, "scroll", queueSync, { passive: true, capture: true });
  listen(window, "resize", queueSync, { passive: true });

  void boot();
}

if (isTopFrame()) {
  installTopFrame();
} else if (isFrameWorthInstrumenting()) {
  // The child needs settings for the detail level `captureDraft` works to, and
  // nothing else — no annotations, no diagnostics, no badge.
  installChildFrame(() => settings);
  void loadSettings().then((next) => {
    settings = next;
  });
}

