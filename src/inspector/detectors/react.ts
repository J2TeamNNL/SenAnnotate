// =============================================================================
// React internals reader — MAIN world only
// =============================================================================
//
// React attaches its fiber to DOM nodes under a *randomised* key, so it cannot be read
// by a fixed property name:
//
//     el.__reactFiber$<random>          React 17+
//     el.__reactInternalInstance$<...>  React 16
//     el.__reactProps$<random>          props for that node
//
// The suffix is stable within a page load but differs between loads, so the key has to
// be found by prefix scan.
//
// Walking `fiber.return` gives the ancestry. Component names come from `type.displayName`
// then `type.name` — both of which minifiers mangle, so on a production build this
// yields single letters and the filter below drops them.
//
// **Source positions are the hard part.** React had `fiber._debugSource`
// ({fileName, lineNumber, columnNumber}), populated by the JSX transform's development
// mode. React 19 REMOVED it — see facebook/react#28265 — so on React 19 there is no
// per-element source at all unless the app runs a babel plugin of its own. This detector
// reads `_debugSource` when present and otherwise reports the component chain only,
// rather than pretending to a precision it does not have.
// =============================================================================

import type { ElementFrameworkInfo, PageFrameworkInfo } from "../../shared/types";
import { relativizeFile } from "./relativize";
import {
  emptyElementInfo,
  formatComponentPath,
  type FrameworkDetector,
  type InspectOptions,
} from "./types";

interface DebugSource {
  fileName?: string;
  lineNumber?: number;
  columnNumber?: number;
}

interface FiberType {
  displayName?: string;
  name?: string;
}

interface Fiber {
  return?: Fiber | null;
  /** Host components are strings ("div"); composite ones are functions/objects. */
  elementType?: FiberType | string | null;
  type?: FiberType | string | null;
  memoizedProps?: Record<string, unknown> | null;
  /** Removed in React 19. */
  _debugSource?: DebugSource | null;
  _debugOwner?: Fiber | null;
}

const FIBER_PREFIXES = ["__reactFiber$", "__reactInternalInstance$"];
const PROPS_PREFIX = "__reactProps$";

/** React's DOM keys carry a random suffix, so they have to be found by prefix. */
function findKey(element: Element, prefixes: string[]): string | null {
  for (const key of Object.keys(element)) {
    for (const prefix of prefixes) {
      if (key.startsWith(prefix)) return key;
    }
  }
  return null;
}

function fiberOf(element: Element): Fiber | null {
  const key = findKey(element, FIBER_PREFIXES);
  if (!key) return null;
  const fiber = (element as unknown as Record<string, unknown>)[key];
  return fiber && typeof fiber === "object" ? (fiber as Fiber) : null;
}

/** Nearest element up the tree that carries a fiber, plus that fiber. */
function findOwner(element: Element): { element: Element; fiber: Fiber } | null {
  let current: Element | null = element;
  let depth = 0;
  while (current && depth < 30) {
    const fiber = fiberOf(current);
    if (fiber) return { element: current, fiber };
    current = current.parentElement;
    depth++;
  }
  return null;
}

/**
 * Component name for a fiber, or null for a host element ("div") or an unnamed one.
 *
 * `elementType` is preferred over `type`: for `React.memo` and `forwardRef` wrappers,
 * `type` is the wrapper object while `elementType` is what the author wrote.
 */
function nameOf(fiber: Fiber): string | null {
  const candidate = fiber.elementType ?? fiber.type;
  if (!candidate || typeof candidate === "string") return null; // host element
  return candidate.displayName || candidate.name || null;
}

/** React internals and HOC wrappers that say nothing about where the code lives. */
const SKIP_EXACT = new Set([
  "Fragment",
  "StrictMode",
  "Suspense",
  "SuspenseList",
  "Profiler",
  "Portal",
  "ContextProvider",
  "ContextConsumer",
  "ForwardRef",
  "Memo",
  "Lazy",
  "Offscreen",
  "Activity",
  // Next.js shell
  "AppRouter",
  "AppRouterAnnouncer",
  "RootLayout",
  "LayoutRouter",
  "RenderFromTemplateContext",
  "OuterLayoutRouter",
  "InnerLayoutRouter",
  "RedirectErrorBoundary",
  "NotFoundErrorBoundary",
  "HTTPAccessFallbackBoundary",
  "MetadataOutlet",
  "ServerRoot",
  "HotReload",
  "DevRootHTTPAccessFallbackBoundary",
  "Router",
  "ErrorBoundary",
  "ErrorBoundaryHandler",
]);

const SKIP_PATTERNS: RegExp[] = [
  /^_{1,2}/,
  /^Anonymous/,
  /Provider$/,
  /Consumer$/,
  /^ForwardRef\(/,
  /^Memo\(/,
  /^Unknown$/,
];

/** Minified names — single letters, or short all-consonant runs a bundler produced. */
function isMinified(name: string): boolean {
  if (name.length <= 2) return true;
  return /^[a-z]{1,3}[0-9]*$/.test(name);
}

function shouldInclude(name: string): boolean {
  if (SKIP_EXACT.has(name)) return false;
  return !SKIP_PATTERNS.some((pattern) => pattern.test(name));
}

function snapshotProps(props: Record<string, unknown> | null | undefined): Record<string, string> {
  if (!props) return {};
  const out: Record<string, string> = {};
  let count = 0;

  for (const [key, value] of Object.entries(props)) {
    if (count >= 12) break;
    // `children` is a React element tree, and refs/handlers are noise in a report.
    if (key === "children" || key === "ref" || key === "key") continue;
    if (typeof value === "function") continue;

    let rendered: string;
    if (value === null) rendered = "null";
    else if (typeof value === "object") rendered = Array.isArray(value) ? `[${value.length}]` : "{…}";
    else rendered = String(value);

    out[key] = rendered.length > 60 ? `${rendered.slice(0, 60)}…` : rendered;
    count++;
  }

  return out;
}

function readDebugSource(fiber: Fiber): DebugSource | null {
  // Present up to React 18; removed in 19. Walk a little way up, because the element's
  // own fiber is often a host node whose source lives on its owner.
  let current: Fiber | null | undefined = fiber;
  let depth = 0;
  while (current && depth < 10) {
    const source = current._debugSource;
    if (source?.fileName) return source;
    current = current._debugOwner ?? current.return;
    depth++;
  }
  return null;
}

/** React 19 stopped writing `_debugSource`; anything else means dev-mode JSX. */
function pageHasDebugSource(): boolean {
  const sample = document.querySelectorAll("body *");
  const limit = Math.min(sample.length, 200);
  for (let i = 0; i < limit; i++) {
    const fiber = fiberOf(sample[i]);
    if (fiber && readDebugSource(fiber)) return true;
  }
  return false;
}

/** True when any composite fiber up the chain still carries an unmangled name. */
function hasReadableName(fiber: Fiber): boolean {
  let current: Fiber | null | undefined = fiber;
  let depth = 0;
  while (current && depth < 30) {
    const name = nameOf(current);
    if (name && !isMinified(name)) return true;
    current = current.return;
    depth++;
  }
  return false;
}

function reactVersion(): string | null {
  const hook = (globalThis as {
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: { renderers?: Map<number, { version?: string }> };
  }).__REACT_DEVTOOLS_GLOBAL_HOOK__;

  const renderers = hook?.renderers;
  if (renderers?.size) {
    for (const renderer of renderers.values()) {
      if (renderer?.version) return renderer.version;
    }
  }
  return null;
}

function detectReactPage(): PageFrameworkInfo | null {
  // A fiber anywhere is the only reliable tell — the DevTools hook is installed by the
  // extension, not the app, so its mere presence proves nothing.
  const root =
    document.querySelector("#root, #__next, [data-reactroot]") ?? document.body;
  const hasFiber = !!findOwner(root) || !!findOwner(document.body);
  if (!hasFiber) return null;

  const next = "__NEXT_DATA__" in globalThis || !!document.getElementById("__next");
  const nextAppRouter = Object.keys(globalThis).some((k) => k.startsWith("__next_f"));
  const version = reactVersion();
  const major = version ? Number.parseInt(version, 10) : null;

  // A readable component name means names survived minification — i.e. not a production
  // build. The root's own fiber is usually a *host* fiber ("div"), which has no name at
  // all, so this has to walk up to the nearest composite rather than checking one node.
  const owner = findOwner(root) ?? findOwner(document.body);
  const devMetadata = owner ? hasReadableName(owner.fiber) : false;

  const redux = "__REDUX_DEVTOOLS_EXTENSION__" in globalThis;

  return {
    detected: true,
    framework: "react",
    flavour: next || nextAppRouter ? "Next.js" : major ? `React ${major}` : "React",
    version,
    devMetadata,
    hasSourcePositions: pageHasDebugSource(),
    stateManager: redux ? "redux" : null,
    routePath: null,
  };
}

function inspectReact(element: Element, options: InspectOptions): ElementFrameworkInfo | null {
  const owner = findOwner(element);
  if (!owner) return null;

  const info = emptyElementInfo();

  const source = readDebugSource(owner.fiber);
  if (source?.fileName) {
    info.source = {
      file: relativizeFile(source.fileName),
      line: source.lineNumber,
      column: source.columnNumber,
      precision: "exact",
    };
  }

  if (options.includeProps) {
    const propsKey = findKey(owner.element, [PROPS_PREFIX]);
    const fromDom = propsKey
      ? ((owner.element as unknown as Record<string, unknown>)[propsKey] as Record<string, unknown>)
      : null;
    info.props = snapshotProps(fromDom ?? owner.fiber.memoizedProps);
  }

  let current: Fiber | null | undefined = owner.fiber;
  let depth = 0;
  while (current && depth < 80 && info.components.length < options.maxComponents) {
    const name = nameOf(current);
    if (name && !isMinified(name) && shouldInclude(name)) {
      if (!info.ownerComponent) info.ownerComponent = name;
      if (info.components[info.components.length - 1] !== name) info.components.push(name);
    }
    current = current.return;
    depth++;
  }

  info.path = formatComponentPath(info.components);

  // A fiber with no usable name and no source is not worth claiming — let another
  // detector have a go at the element.
  if (!info.path && !info.source) return null;
  return info;
}

export const reactDetector: FrameworkDetector = {
  id: "react",

  detect() {
    try {
      return detectReactPage();
    } catch {
      return null;
    }
  },

  inspect(element, options) {
    if (options.mode === "off") return null;
    try {
      return inspectReact(element, options);
    } catch {
      return null;
    }
  },
};
