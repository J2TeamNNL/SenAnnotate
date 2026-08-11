// =============================================================================
// Shared types — the vocabulary all three worlds agree on
// =============================================================================

export type OutputDetailLevel = "compact" | "standard" | "detailed" | "forensic";

/**
 * How aggressively to filter the component ancestry.
 * - `off`      no component detection at all
 * - `filtered` drop known framework plumbing (Transition, RouterView, …) — default
 * - `smart`    `filtered`, and additionally require the component name to correlate
 *              with a CSS class on the element or one of its ancestors
 * - `all`      no filtering
 */
export type ComponentDetectionMode = "off" | "filtered" | "smart" | "all";

export type ThemePreference = "auto" | "light" | "dark";

/** What a click means while inspect mode is on. */
export type InspectMode = "point" | "text" | "area";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// -----------------------------------------------------------------------------
// Framework detection results
// -----------------------------------------------------------------------------
//
// Framework-neutral by design: one detector per framework implements
// `FrameworkDetector` (src/inspector/detectors/types.ts) and fills these in. Nothing
// outside `src/inspector/detectors/` should know which frameworks exist — display
// labels come from the detector, not from a switch elsewhere.

export type FrameworkId = "vue" | "react" | "svelte" | "angular";

/** Whole-page detection, answered once per page (and re-answered on demand). */
export interface PageFrameworkInfo {
  detected: boolean;
  framework: FrameworkId | null;
  /**
   * Display label chosen by the detector — "Vue 3", "Nuxt 3/4", "SvelteKit", "Next.js".
   * Kept as free text so adding a framework never means editing a label mapping
   * somewhere else.
   */
  flavour: string | null;
  /** Reported by the runtime when available, e.g. "3.5.13". */
  version: string | null;
  /**
   * True when the runtime exposes per-element component metadata. False for a
   * production build, where the report degrades to selectors + DOM path.
   */
  devMetadata: boolean;
  /**
   * Exact `file:line:column` is obtainable, not just a filename. True for Vue's
   * tracer or `data-v-inspector`, Svelte's `__svelte_meta`, React's pre-19
   * `_debugSource`.
   */
  hasSourcePositions: boolean;
  /** e.g. "pinia", "vuex", "redux", "ngrx". Free text for the same reason as `flavour`. */
  stateManager: string | null;
  routePath: string | null;
}

/** Where in the repo the annotated element comes from. */
export interface SourceRef {
  /** Repo-relative when we can work it out, absolute otherwise. */
  file: string;
  line?: number;
  column?: number;
  /**
   * - `exact`        line and column, straight from the framework's own records
   * - `dom-attr`     line and column, read off a build-plugin DOM attribute
   * - `file`         file-level only, from component metadata the compiler injected
   * - `grep-handle`  no path at all; an opaque but unique string to grep for
   */
  origin: "exact" | "dom-attr" | "file" | "grep-handle";
}

/** Per-element detection result. */
export interface ElementFrameworkInfo {
  /** Ancestry rendered outermost → innermost, e.g. `<App> <TheSidebar> <BaseButton>`. */
  path: string | null;
  /** Component names, innermost → outermost. */
  components: string[];
  /** The component that owns this element (innermost, unfiltered). */
  ownerComponent: string | null;
  /**
   * Best location the framework itself knows about.
   *
   * `precision` matters to `resolveSource()`: `exact` wins outright, while `file`
   * has to compete with a DOM attribute that may carry line and column but may have
   * been inherited from a wrapper in a different file.
   */
  source: {
    file: string;
    line?: number;
    column?: number;
    precision: "exact" | "file";
  } | null;
  /** Shallow, truncated snapshot of the owner component's resolved props. */
  props: Record<string, string>;
  /**
   * Opaque strings that survive minification and are unique enough to `grep -r`.
   * Vue fills this with scoped-style hashes (`data-v-7ba5bd90`); most frameworks
   * have no equivalent and leave it empty.
   */
  grepHandles: string[];
}

// -----------------------------------------------------------------------------
// Diagnostics — what turns "the button is broken" into a usable bug report
// -----------------------------------------------------------------------------

export type LogKind = "error" | "rejection" | "console" | "resource";

export interface LogEntry {
  kind: LogKind;
  message: string;
  stack?: string;
  /** Script URL / line / column, when the browser gave us one. */
  source?: string;
  line?: number;
  column?: number;
  /** Milliseconds since the page started loading. */
  at: number;
}

export interface NetworkEntry {
  method: string;
  /** Query values for sensitive-looking params are redacted before storage. */
  url: string;
  /** 0 means the request never completed (network error, CORS, abort). */
  status: number;
  statusText?: string;
  durationMs: number;
  transport: "fetch" | "xhr";
  at: number;
}

export type ActionKind = "click" | "input" | "submit" | "key" | "navigate";

export interface ActionEntry {
  kind: ActionKind;
  /** Human-readable target, e.g. `button "Save changes"`. */
  target: string;
  /**
   * Extra context — a field's label, or the URL for a navigation. Never the text
   * a user typed: an action trail must not become a keystroke log.
   */
  detail?: string;
  at: number;
}

export interface Diagnostics {
  logs: LogEntry[];
  network: NetworkEntry[];
  /** Set when capture was never installed (extension loaded after the page). */
  unavailable?: boolean;
}

// -----------------------------------------------------------------------------
// Annotation
// -----------------------------------------------------------------------------

export interface Annotation {
  id: string;
  comment: string;
  timestamp: number;

  /** Human-readable element name, e.g. `button "Save changes"`. */
  element: string;
  /** Short ancestry, e.g. `.sidebar > nav > button`. */
  elementPath: string;
  /** Best-effort unique CSS selector, re-resolvable across reloads. */
  selector: string;

  /** Marker position: % of viewport width. */
  x: number;
  /** Marker position: px from the top of the document, or of the viewport if `isFixed`. */
  y: number;
  /** The element is `position: fixed|sticky`, so the marker must not scroll away. */
  isFixed: boolean;

  boundingBox?: Rect;
  /** One box per element when the annotation came from a marquee selection. */
  elementBoundingBoxes?: Rect[];
  isMultiSelect?: boolean;

  selectedText?: string;
  nearbyText?: string;
  nearbyElements?: string;
  cssClasses?: string;
  computedStyles?: string;
  accessibility?: string;
  fullPath?: string;

  /**
   * Renamed from `vue` in 0.3.0. Annotations persisted by an older build keep the old
   * key and simply lose their component line when reloaded — they are per-review
   * scratch data, so no migration is worth carrying.
   */
  framework?: ElementFrameworkInfo;
  source?: SourceRef;
  /** Filename of the PNG the user downloaded for this annotation, if any. */
  screenshot?: string;
}

// -----------------------------------------------------------------------------
// Settings
// -----------------------------------------------------------------------------

export interface Settings {
  detailLevel: OutputDetailLevel;
  componentMode: ComponentDetectionMode;
  theme: ThemePreference;
  /** Show the numbered pins on the page. */
  showMarkers: boolean;
  /** Freeze animations automatically whenever inspect mode turns on. */
  freezeOnInspect: boolean;
  /** Include the owner component's props in the report. */
  includeProps: boolean;
  /** Ceiling on how many ancestors to name. */
  maxComponents: number;
  /**
   * Record console errors, failed requests and an action trail, and attach them
   * to the report. This is the setting that makes the extension useful to a
   * tester on a built site, where component and source data are unavailable.
   */
  captureDiagnostics: boolean;
  /**
   * Shrink the toolbar to a single handle. Persisted rather than session-only so
   * that reviewing a page whose bottom-right corner matters — a chat widget, a
   * cookie bar — does not mean re-collapsing after every reload.
   */
  toolbarCollapsed: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  detailLevel: "standard",
  componentMode: "filtered",
  theme: "auto",
  showMarkers: true,
  freezeOnInspect: false,
  includeProps: true,
  maxComponents: 6,
  captureDiagnostics: true,
  toolbarCollapsed: false,
};

export const OUTPUT_DETAIL_OPTIONS: { value: OutputDetailLevel; label: string; hint: string }[] = [
  { value: "compact", label: "Compact", hint: "One line each" },
  { value: "standard", label: "Standard", hint: "Component + source" },
  { value: "detailed", label: "Detailed", hint: "+ classes, box, props" },
  { value: "forensic", label: "Forensic", hint: "Everything" },
];

/** Detail level implies how hard to work at naming components. */
export const DETAIL_TO_COMPONENT_MODE: Record<OutputDetailLevel, ComponentDetectionMode> = {
  compact: "off",
  standard: "filtered",
  detailed: "smart",
  forensic: "all",
};
