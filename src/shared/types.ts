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
// Vue-specific detection results
// -----------------------------------------------------------------------------

export type VueMajor = 2 | 3;
export type VueFlavour = "vue2" | "vue3" | "nuxt2" | "nuxt3";

/** Whole-page detection, answered once per page (and re-answered on demand). */
export interface PageVueInfo {
  detected: boolean;
  major: VueMajor | null;
  flavour: VueFlavour | null;
  /** Reported by the runtime when available, e.g. "3.5.13". */
  version: string | null;
  /**
   * True when the runtime exposes per-element component metadata. False for a
   * production build, where the report degrades to selectors + DOM path.
   */
  devMetadata: boolean;
  /** Legacy `vite-plugin-vue-inspector` is emitting `data-v-inspector`. */
  hasInspectorAttrs: boolean;
  /** `vite-plugin-vue-tracer` is recording positions — current Nuxt DevTools. */
  hasTracer: boolean;
  stateManager: "pinia" | "vuex" | null;
  routePath: string | null;
}

/** Where in the repo the annotated element comes from. */
export interface SourceRef {
  /** Repo-relative when we can work it out, absolute otherwise. */
  file: string;
  line?: number;
  column?: number;
  /**
   * - `tracer`    exact, from `vite-plugin-vue-tracer`'s global store — what
   *               current Nuxt DevTools ships (line + column)
   * - `inspector` exact, from the legacy `data-v-inspector` DOM attribute
   * - `__file`    file-level, from the component options the compiler injected
   * - `scope-id`  no path at all; a `data-v-*` hash to grep for
   */
  origin: "tracer" | "inspector" | "__file" | "scope-id";
}

/** Per-element detection result. */
export interface VueElementInfo {
  /** Ancestry rendered outermost → innermost, e.g. `<App> <TheSidebar> <BaseButton>`. */
  path: string | null;
  /** Component names, innermost → outermost. */
  components: string[];
  /** The component that owns this element (innermost, unfiltered). */
  ownerComponent: string | null;
  /** Resolved from the owner's `__file`, if the compiler injected one. */
  sourceFile: string | null;
  /** Exact position from `vite-plugin-vue-tracer`, when Nuxt DevTools is on. */
  tracer: { file: string; line?: number; column?: number } | null;
  /** Scoped-style hashes present on the element (`data-v-7ba5bd90`). */
  scopeIds: string[];
  /** Shallow, truncated snapshot of the owner component's resolved props. */
  props: Record<string, string>;
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

  vue?: VueElementInfo;
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
