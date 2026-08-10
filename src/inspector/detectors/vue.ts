// =============================================================================
// Vue internals reader — MAIN world only
// =============================================================================
//
// Everything here touches properties the Vue runtime writes onto DOM nodes. Those
// are invisible from an isolated-world content script, which is the whole reason
// this file runs in the page's own JS heap.
//
// Vue 3 (`@vue/runtime-core` mountElement):
//     Object.defineProperty(el, '__vnode',              { value, enumerable: false })
//     Object.defineProperty(el, '__vueParentComponent', { value, enumerable: false })
//   Written under `__DEV__ || __FEATURE_PROD_DEVTOOLS__`, and non-enumerable — so
//   `Object.keys(el)` will not find them and we must probe by direct access.
//
// Vue 2 (`vue/src/core/instance/lifecycle.js`):
//     vm.$el.__vue__ = vm
//   Only on component *root* elements, so we walk up the DOM to find the owner.
// =============================================================================

import type {
  ComponentDetectionMode,
  ElementFrameworkInfo,
  PageFrameworkInfo,
} from "../../shared/types";
import { componentNameFromFile, relativizeFile } from "./relativize";
import {
  emptyElementInfo,
  formatComponentPath,
  isEmptyElementInfo,
  type FrameworkDetector,
  type InspectOptions,
} from "./types";

type VueMajor = 2 | 3;

// -----------------------------------------------------------------------------
// Loose structural types for the runtime objects we read
// -----------------------------------------------------------------------------

interface Vue3Type {
  name?: string;
  displayName?: string;
  /** Set by @vitejs/plugin-vue for `<script setup>`: the filename base. */
  __name?: string;
  /** Absolute path, dev builds only. May carry a `?vue&type=…` query. */
  __file?: string;
  __scopeId?: string;
  render?: unknown;
  setup?: unknown;
}

interface Vue3Instance {
  uid: number;
  type: Vue3Type | ((...args: unknown[]) => unknown) | null;
  parent: Vue3Instance | null;
  props: Record<string, unknown> | null;
  vnode?: { el?: Element | null };
  appContext?: {
    app?: {
      version?: string;
      config?: { globalProperties?: Record<string, unknown> };
    };
  };
}

interface Vue2Options {
  name?: string;
  _componentTag?: string;
  __file?: string;
}

interface Vue2Instance {
  $options: Vue2Options;
  $parent: Vue2Instance | null;
  $props?: Record<string, unknown> | null;
  $el?: Element;
  $root?: Vue2Instance;
  $store?: unknown;
  $route?: { fullPath?: string; path?: string };
  $router?: unknown;
}

type Probe = Element & {
  __vueParentComponent?: Vue3Instance;
  __vnode?: { props?: object | null } | null;
  __vue_app__?: { version?: string; config?: { globalProperties?: Record<string, unknown> } };
  __vue__?: Vue2Instance;
};

// -----------------------------------------------------------------------------
// vite-plugin-vue-tracer
// -----------------------------------------------------------------------------
//
// Modern Nuxt DevTools (v3+) ships `vite-plugin-vue-tracer`, which replaced
// `vite-plugin-vue-inspector`. The difference matters: the old plugin wrote a
// `data-v-inspector` DOM attribute, the new one writes NOTHING to the DOM and
// instead records positions in a global WeakMap keyed by each vnode's `props`
// object.
//
//   globalThis.__vue_tracer__ = {
//     hasData: boolean,
//     vnodeToPos: WeakMap<vnodeProps, [source, line, column]>,
//     ...
//   }
//
// So on a current Nuxt app, looking for `data-v-inspector` finds nothing and the
// report silently degrades to file-level `__file`. Reading the tracer store gets
// the exact line and column back.
//
// Paths are already project-relative: the plugin's `resolveRecordEntryPath`
// option defaults to true.

interface TracerStore {
  hasData?: boolean;
  vnodeToPos?: WeakMap<object, [string, number, number]>;
}

function tracerStore(): TracerStore | null {
  const store = (globalThis as { __vue_tracer__?: TracerStore }).__vue_tracer__;
  return store?.vnodeToPos ? store : null;
}

export interface TracerPosition {
  file: string;
  line?: number;
  column?: number;
}

/**
 * Exact source position for an element, from the tracer store.
 *
 * Walks up the DOM because only elements the compiler instrumented carry a
 * recorded vnode — an inner element rendered by, say, `v-html` inherits its
 * nearest instrumented ancestor's position, which is still the right file.
 */
function readTracerPosition(element: Element): TracerPosition | null {
  const store = tracerStore();
  if (!store?.vnodeToPos) return null;

  let current: Element | null = element;
  let depth = 0;

  while (current && depth < 30) {
    const props = (current as Probe).__vnode?.props;
    if (props) {
      const position = store.vnodeToPos.get(props);
      if (position) {
        return { file: position[0], line: position[1], column: position[2] };
      }
    }
    current = current.parentElement;
    depth++;
  }

  return null;
}

// -----------------------------------------------------------------------------
// Filtering — the Vue equivalent of agentation's React internals list
// -----------------------------------------------------------------------------

/** Framework plumbing that tells you nothing about where the code lives. */
const SKIP_EXACT = new Set([
  // Vue core built-ins
  "Transition",
  "TransitionGroup",
  "BaseTransition",
  "KeepAlive",
  "Teleport",
  "Suspense",
  "Fragment",
  // vue-router
  "RouterView",
  "RouterLink",
  "RouterViewImpl",
  "RouterLinkImpl",
  // Nuxt shell
  "NuxtRoot",
  "NuxtPage",
  "NuxtLayout",
  "NuxtLoadingIndicator",
  "NuxtErrorBoundary",
  "NuxtIsland",
  "NuxtClientFallback",
  "ServerPlaceholder",
  "ClientOnly",
  "DevOnly",
  "AsyncComponentWrapper",
  "LazyHydrationWrapper",
]);

const SKIP_PATTERNS: RegExp[] = [
  /^_{1,2}/, //            __nuxt_component_0, _sfc_main
  /^Anonymous/, //         unnamed inline components
  /^VueComponent$/, //     Vue 2 constructor fallback
  /Provider$/, //          ThemeProvider and friends
  /^Async(Component)?Wrapper$/,
];

/** Names that read like something a person wrote — used in `smart` mode. */
const USER_PATTERNS: RegExp[] = [
  /Page$/,
  /View$/,
  /Screen$/,
  /Section$/,
  /Card$/,
  /List$/,
  /Item$/,
  /Form$/,
  /Modal$/,
  /Dialog$/,
  /Drawer$/,
  /Button$/,
  /Nav$/,
  /Header$/,
  /Footer$/,
  /Layout$/,
  /Panel$/,
  /Tab$/,
  /Menu$/,
  /Table$/,
  /^The[A-Z]/, //  Vue style guide: TheHeader, TheSidebar
  /^Base[A-Z]/, // Vue style guide: BaseButton, BaseInput
  /^App[A-Z]/,
];

/** `TheSideNav` → `the-side-nav`, so it can be matched against CSS classes. */
function kebab(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

function collectAncestorClasses(element: Element, maxDepth = 10): Set<string> {
  const classes = new Set<string>();
  let current: Element | null = element;
  let depth = 0;

  while (current && depth < maxDepth) {
    const raw = current.getAttribute("class");
    if (raw) {
      for (const cls of raw.split(/\s+/)) {
        // Strip CSS-module hashes: `button_primary__a1b2c` → `button_primary`
        const normalized = cls.replace(/[_-][a-zA-Z0-9]{5,}$/, "").toLowerCase();
        if (normalized.length > 1) classes.add(normalized);
      }
    }
    current = current.parentElement;
    depth++;
  }

  return classes;
}

function correlatesWithDom(name: string, domClasses: Set<string>): boolean {
  const normalized = kebab(name);
  const nameWords = normalized.split("-").filter((w) => w.length > 2);

  for (const cls of domClasses) {
    if (cls === normalized) return true;
    const classWords = cls.split(/[-_]/).filter((w) => w.length > 2);
    for (const n of nameWords) {
      for (const c of classWords) {
        if (n === c || n.includes(c) || c.includes(n)) return true;
      }
    }
  }
  return false;
}

/** Single-letter / two-letter names are minifier output, not real components. */
function isMinified(name: string): boolean {
  if (name.length <= 2) return true;
  return name.length <= 3 && name === name.toLowerCase();
}

function shouldInclude(
  name: string,
  mode: ComponentDetectionMode,
  domClasses: Set<string> | null,
): boolean {
  if (mode === "all") return true;
  if (SKIP_EXACT.has(name)) return false;
  if (SKIP_PATTERNS.some((p) => p.test(name))) return false;
  if (mode === "filtered") return true;

  // smart: keep only names that look user-authored or echo a class on the page
  if (domClasses && correlatesWithDom(name, domClasses)) return true;
  return USER_PATTERNS.some((p) => p.test(name));
}

// -----------------------------------------------------------------------------
// Source file resolution
// -----------------------------------------------------------------------------

// `relativizeFile` and `basename` moved to ./relativize.ts — every detector needs them.

// -----------------------------------------------------------------------------
// Name resolution
// -----------------------------------------------------------------------------

function nameFromVue3Type(type: Vue3Instance["type"]): string | null {
  if (!type) return null;

  // Functional components are plain functions.
  if (typeof type === "function") {
    const fn = type as { displayName?: string; name?: string };
    return fn.displayName || fn.name || null;
  }

  // `__name` is what @vitejs/plugin-vue injects for `<script setup>` blocks and is
  // the most faithful to the filename, so it wins over an explicit `name`.
  if (type.__name) return type.__name;
  if (type.name) return type.name;
  if (type.displayName) return type.displayName;
  if (type.__file) return componentNameFromFile(type.__file);
  return null;
}

function nameFromVue2(vm: Vue2Instance): string | null {
  const options = vm.$options || {};
  if (options.name) return options.name;
  if (options._componentTag) return options._componentTag;
  if (options.__file) return componentNameFromFile(options.__file);
  return null;
}

// -----------------------------------------------------------------------------
// Owner lookup — the component instance that rendered a given element
// -----------------------------------------------------------------------------

/** Vue 3 tags every element it renders, but `v-html` content is untagged. */
function findVue3Owner(element: Element): Vue3Instance | null {
  let current: Element | null = element;
  let depth = 0;
  while (current && depth < 50) {
    const instance = (current as Probe).__vueParentComponent;
    if (instance) return instance;
    current = current.parentElement;
    depth++;
  }
  return null;
}

/** Vue 2 only tags component root elements, so a walk up is always needed. */
function findVue2Owner(element: Element): Vue2Instance | null {
  let current: Element | null = element;
  let depth = 0;
  while (current && depth < 50) {
    const vm = (current as Probe).__vue__;
    if (vm) return vm;
    current = current.parentElement;
    depth++;
  }
  return null;
}

// -----------------------------------------------------------------------------
// Props snapshot
// -----------------------------------------------------------------------------

const MAX_PROPS = 12;
const MAX_PROP_LENGTH = 120;

function summarizeValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";

  switch (typeof value) {
    case "string":
      return value.length > MAX_PROP_LENGTH
        ? `"${value.slice(0, MAX_PROP_LENGTH)}…"`
        : `"${value}"`;
    case "number":
    case "boolean":
      return String(value);
    case "function":
      return "ƒ()";
    case "symbol":
      return value.toString();
    default:
      break;
  }

  if (Array.isArray(value)) return `Array(${value.length})`;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Element) return `<${value.tagName.toLowerCase()}>`;

  try {
    const json = JSON.stringify(value);
    if (!json) return "Object";
    return json.length > MAX_PROP_LENGTH ? `${json.slice(0, MAX_PROP_LENGTH)}…` : json;
  } catch {
    // Circular, or a reactive proxy that throws on serialisation.
    return "Object";
  }
}

function snapshotProps(props: Record<string, unknown> | null | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!props) return result;

  let count = 0;
  for (const key of Object.keys(props)) {
    if (count >= MAX_PROPS) break;
    try {
      result[key] = summarizeValue(props[key]);
    } catch {
      result[key] = "<unreadable>";
    }
    count++;
  }
  return result;
}

// -----------------------------------------------------------------------------
// Scoped-style ids
// -----------------------------------------------------------------------------

/** `data-v-7ba5bd90` on the element — a unique grep handle even in prod builds. */
function scopeIdsOf(element: Element): string[] {
  const ids: string[] = [];
  for (const attr of Array.from(element.attributes)) {
    if (/^data-v-[0-9a-f]{6,}$/i.test(attr.name)) ids.push(attr.name);
  }
  return ids;
}

// -----------------------------------------------------------------------------
// Page-level detection
// -----------------------------------------------------------------------------

/**
 * Probe a handful of likely mount points rather than crawling the whole document.
 * Returns the first element carrying Vue metadata, and which major version it is.
 */
function probePage(): { element: Probe | null; major: VueMajor | null } {
  const candidates: Element[] = [];

  const pushIf = (el: Element | null) => {
    if (el) candidates.push(el);
  };

  pushIf(document.querySelector("[data-v-app]"));
  pushIf(document.getElementById("__nuxt"));
  pushIf(document.getElementById("app"));
  pushIf(document.getElementById("root"));
  pushIf(document.getElementById("q-app"));
  if (document.body) {
    candidates.push(document.body);
    // A Vue app mounted into an unusual container still lives near the top.
    for (const child of Array.from(document.body.children)) {
      candidates.push(child);
      for (const grandchild of Array.from(child.children)) candidates.push(grandchild);
    }
  }

  for (const candidate of candidates) {
    const probe = candidate as Probe;
    if (probe.__vue_app__ || probe.__vueParentComponent) return { element: probe, major: 3 };
    if (probe.__vue__) return { element: probe, major: 2 };
  }

  return { element: null, major: null };
}

/**
 * Walk a bounded slice of the subtree looking for per-element dev metadata.
 *
 * The mount container itself is NOT a reliable signal: `#__nuxt` gets `__vue_app__`
 * (which the runtime sets unconditionally, prod included) but never gets
 * `__vueParentComponent`, because Vue did not render it. Testing the container was
 * why a live Nuxt dev server used to be reported as a production build.
 *
 * `__vueParentComponent` on a rendered element, by contrast, is written only under
 * `__DEV__ || __FEATURE_PROD_DEVTOOLS__` — exactly the condition we care about.
 */
const METADATA_SCAN_LIMIT = 400;

function hasVue3ElementMetadata(root: Element): boolean {
  const queue: Element[] = [root];
  let seen = 0;

  while (queue.length && seen < METADATA_SCAN_LIMIT) {
    const element = queue.shift()!;
    seen++;
    if ((element as Probe).__vueParentComponent) return true;
    for (const child of Array.from(element.children)) queue.push(child);
  }

  return false;
}

/** Vue 2 always exposes `$options`; only a dev build fills in `name`/`__file`. */
function hasVue2ElementMetadata(root: Element): boolean {
  const queue: Element[] = [root];
  let seen = 0;

  while (queue.length && seen < METADATA_SCAN_LIMIT) {
    const element = queue.shift()!;
    seen++;
    const vm = (element as Probe).__vue__;
    if (vm?.$options && (vm.$options.name || vm.$options.__file || vm.$options._componentTag)) {
      return true;
    }
    for (const child of Array.from(element.children)) queue.push(child);
  }

  return false;
}

function globalProperties3(instance: Vue3Instance | null, root: Probe | null): Record<string, unknown> {
  return (
    instance?.appContext?.app?.config?.globalProperties ??
    root?.__vue_app__?.config?.globalProperties ??
    {}
  );
}

function detectVuePage(): PageFrameworkInfo | null {
  const { element, major } = probePage();

  // Not a Vue page at all — let the dispatcher try the next detector rather than
  // claiming the page with a `detected: false` result.
  if (!element || !major) return null;

  const nuxt = "__NUXT__" in window || !!document.getElementById("__nuxt");
  const hasInspectorAttrs = !!document.querySelector("[data-v-inspector]");
  const hasTracer = !!tracerStore()?.hasData;
  let version: string | null = null;
  let stateManager: string | null = null;
  let routePath: string | null = null;
  let devMetadata = false;

  if (major === 3) {
    const instance = element.__vueParentComponent ?? null;
    const globals = globalProperties3(instance, element);
    version = element.__vue_app__?.version ?? instance?.appContext?.app?.version ?? null;

    if (globals.$pinia) stateManager = "pinia";
    else if (globals.$store) stateManager = "vuex";

    const router = globals.$router as
      | { currentRoute?: { value?: { fullPath?: string } } }
      | undefined;
    routePath = router?.currentRoute?.value?.fullPath ?? null;

    devMetadata = hasVue3ElementMetadata(element);
  } else {
    const vm = element.__vue__ ?? null;
    const globalVue = (window as { Vue?: { version?: string } }).Vue;
    version = globalVue?.version ?? null;

    if (vm?.$store) stateManager = "vuex";
    routePath = vm?.$route?.fullPath ?? vm?.$route?.path ?? null;
    devMetadata = hasVue2ElementMetadata(element);
  }

  return {
    detected: true,
    framework: "vue",
    // The label the toolbar and the report show. Kept here rather than mapped
    // elsewhere so a new framework never means editing a switch in output.ts.
    flavour: nuxt ? (major === 3 ? "Nuxt 3/4" : "Nuxt 2") : major === 3 ? "Vue 3" : "Vue 2",
    version,
    devMetadata,
    hasSourcePositions: hasTracer || hasInspectorAttrs,
    stateManager,
    routePath,
  };
}

// -----------------------------------------------------------------------------
// Element-level inspection
// -----------------------------------------------------------------------------

/**
 * Source breadcrumbs Vue leaves on the element itself, independent of whether a
 * component owner was found: the tracer position, and any scoped-style hashes.
 */
function emptyInfo(element: Element): ElementFrameworkInfo {
  const info = emptyElementInfo();
  const tracer = readTracerPosition(element);
  if (tracer) {
    info.source = { ...tracer, precision: "exact" };
  }
  info.grepHandles = scopeIdsOf(element);
  return info;
}

/**
 * Record a file-level path, but never over an exact one.
 *
 * `emptyInfo` may already have set an exact tracer position, which outranks any
 * `__file`. The guard is what preserves the old precedence now that both live in the
 * same field.
 */
function recordFile(info: ElementFrameworkInfo, file: string | undefined): void {
  if (info.source || !file) return;
  info.source = { file: relativizeFile(file), precision: "file" };
}

function inspectVue3(element: Element, options: InspectOptions): ElementFrameworkInfo | null {
  const owner = findVue3Owner(element);
  if (!owner) return null;

  const info = emptyInfo(element);
  const domClasses = options.mode === "smart" ? collectAncestorClasses(element) : null;

  info.ownerComponent = nameFromVue3Type(owner.type);

  const ownerType = typeof owner.type === "object" ? owner.type : null;
  recordFile(info, ownerType?.__file);
  if (ownerType?.__scopeId && !info.grepHandles.includes(ownerType.__scopeId)) {
    info.grepHandles.push(ownerType.__scopeId);
  }
  if (options.includeProps) info.props = snapshotProps(owner.props);

  let current: Vue3Instance | null = owner;
  let depth = 0;
  while (current && depth < 60 && info.components.length < options.maxComponents) {
    const name = nameFromVue3Type(current.type);
    if (name && !isMinified(name) && shouldInclude(name, options.mode, domClasses)) {
      // Guard against a component rendering itself recursively into a long run.
      if (info.components[info.components.length - 1] !== name) info.components.push(name);
    }
    // Fall back to the nearest ancestor's file when the owner had none of its own.
    const type = typeof current.type === "object" ? current.type : null;
    recordFile(info, type?.__file);
    current = current.parent;
    depth++;
  }

  info.path = formatComponentPath(info.components);
  return info;
}

function inspectVue2(element: Element, options: InspectOptions): ElementFrameworkInfo | null {
  const owner = findVue2Owner(element);
  if (!owner) return null;

  const info = emptyInfo(element);
  const domClasses = options.mode === "smart" ? collectAncestorClasses(element) : null;

  info.ownerComponent = nameFromVue2(owner);
  recordFile(info, owner.$options?.__file);
  if (options.includeProps) info.props = snapshotProps(owner.$props);

  let current: Vue2Instance | null = owner;
  let depth = 0;
  while (current && depth < 60 && info.components.length < options.maxComponents) {
    const name = nameFromVue2(current);
    if (name && !isMinified(name) && shouldInclude(name, options.mode, domClasses)) {
      if (info.components[info.components.length - 1] !== name) info.components.push(name);
    }
    recordFile(info, current.$options?.__file);
    current = current.$parent;
    depth++;
  }

  info.path = formatComponentPath(info.components);
  return info;
}

export const vueDetector: FrameworkDetector = {
  id: "vue",

  detect() {
    try {
      return detectVuePage();
    } catch {
      return null;
    }
  },

  inspect(element, options) {
    if (options.mode === "off") return null;

    try {
      const owned = inspectVue3(element, options) ?? inspectVue2(element, options);
      if (owned) return owned;

      // No component owner on this element. Vue may still have left breadcrumbs — a
      // tracer position or a scoped-style hash — which are worth reporting. If it left
      // nothing, return null so the dispatcher tries the next framework instead of
      // this detector silently claiming every element on the page.
      const breadcrumbs = emptyInfo(element);
      return isEmptyElementInfo(breadcrumbs) ? null : breadcrumbs;
    } catch {
      // A corrupted instance tree must never take the toolbar down with it.
      return null;
    }
  },
};
