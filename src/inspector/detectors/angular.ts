// =============================================================================
// Angular internals reader — MAIN world only
// =============================================================================
//
// Angular is the only one of the four with a *documented* debug API, exposed on
// `window.ng` when the app is not built in production mode:
//
//     ng.getComponent(el)      nearest component instance owning el
//     ng.getOwningComponent(el) component whose template declared el
//     ng.getDirectives(el)     directives applied to el
//     ng.getContext(el)        template context
//
// Component *names* come from the instance's constructor, which a production build
// mangles — same problem as React. There is no source-position information at all:
// Angular's compiler records nothing analogous to Vue's tracer or Svelte's
// `__svelte_meta`, so this detector reports the component chain and nothing more, rather
// than inventing a file path.
//
// Ancestry: `ng.getComponent` only answers for elements that *are* component hosts, so
// the chain is recovered by walking up the DOM and asking about each ancestor — the same
// shape as the Vue 2 code path.
// =============================================================================

import type { ElementFrameworkInfo, PageFrameworkInfo } from "../../shared/types";
import {
  emptyElementInfo,
  formatComponentPath,
  type FrameworkDetector,
  type InspectOptions,
} from "./types";

interface AngularDebugApi {
  getComponent?: (element: Element) => object | null;
  getOwningComponent?: (element: Element) => object | null;
  getDirectives?: (element: Element) => object[] | null;
  getContext?: (element: Element) => object | null;
}

function debugApi(): AngularDebugApi | null {
  const api = (globalThis as { ng?: AngularDebugApi }).ng;
  return api && typeof api.getComponent === "function" ? api : null;
}

/** `__ngContext__` is present on Angular-rendered nodes in any build, dev or prod. */
function hasNgContext(element: Element): boolean {
  return "__ngContext__" in element;
}

function findNgRoot(): Element | null {
  // Angular marks the bootstrapped host with `ng-version` in every build.
  const versioned = document.querySelector("[ng-version]");
  if (versioned) return versioned;

  if (hasNgContext(document.body)) return document.body;
  const sample = document.querySelectorAll("body *");
  const limit = Math.min(sample.length, 200);
  for (let i = 0; i < limit; i++) {
    if (hasNgContext(sample[i])) return sample[i];
  }
  return null;
}

/** Constructor name of a component instance — mangled on a production build. */
function instanceName(instance: object | null | undefined): string | null {
  if (!instance) return null;
  const name = instance.constructor?.name;
  if (!name || name === "Object" || name === "Function") return null;
  return name;
}

function isMinified(name: string): boolean {
  if (name.length <= 2) return true;
  return /^[a-z]{1,3}[0-9]*$/.test(name);
}

const SKIP_PATTERNS: RegExp[] = [/^_/, /^Anonymous/, /^RouterOutlet$/, /^NgIf$/, /^NgForOf$/];

function shouldInclude(name: string): boolean {
  return !SKIP_PATTERNS.some((pattern) => pattern.test(name));
}

/**
 * Public, non-function instance fields — Angular's nearest equivalent to props.
 *
 * Angular has no runtime record of which fields are `@Input()`s, so this is a shallow
 * snapshot of the instance rather than a true prop list, and internal fields prefixed
 * with `_` are skipped.
 */
function snapshotInputs(instance: object | null): Record<string, string> {
  if (!instance) return {};
  const out: Record<string, string> = {};
  let count = 0;

  for (const [key, value] of Object.entries(instance)) {
    if (count >= 12) break;
    if (key.startsWith("_") || key.startsWith("ng")) continue;
    if (typeof value === "function") continue;

    let rendered: string;
    if (value === null) rendered = "null";
    else if (value === undefined) continue;
    else if (typeof value === "object") rendered = Array.isArray(value) ? `[${value.length}]` : "{…}";
    else rendered = String(value);

    out[key] = rendered.length > 60 ? `${rendered.slice(0, 60)}…` : rendered;
    count++;
  }

  return out;
}

function detectAngularPage(): PageFrameworkInfo | null {
  const root = findNgRoot();
  if (!root) return null;

  const version = document.querySelector("[ng-version]")?.getAttribute("ng-version") ?? null;
  const major = version ? Number.parseInt(version, 10) : null;
  const api = debugApi();

  // `window.ng` is only installed outside production mode, which makes its presence a
  // direct answer to "are component names readable here".
  let devMetadata = false;
  if (api?.getComponent) {
    try {
      const name = instanceName(api.getComponent(root));
      devMetadata = !!name && !isMinified(name);
    } catch {
      devMetadata = false;
    }
  }

  const ngrx = "__STORE_DEVTOOLS_EXTENSION__" in globalThis || "__NGRX_STORE__" in globalThis;

  return {
    detected: true,
    framework: "angular",
    flavour: major ? `Angular ${major}` : "Angular",
    version,
    devMetadata,
    // Angular records no authoring positions anywhere — not in dev either.
    hasSourcePositions: false,
    stateManager: ngrx ? "ngrx" : null,
    routePath: null,
  };
}

function inspectAngular(element: Element, options: InspectOptions): ElementFrameworkInfo | null {
  const api = debugApi();
  if (!api?.getComponent) {
    // Without the debug API there is nothing readable — `__ngContext__` alone gives no
    // names. Returning null lets another detector try.
    return null;
  }

  const info = emptyElementInfo();

  let current: Element | null = element;
  let depth = 0;
  let ownerInstance: object | null = null;

  while (current && depth < 60 && info.components.length < options.maxComponents) {
    let instance: object | null = null;
    try {
      instance = api.getComponent(current) ?? null;
    } catch {
      instance = null;
    }

    const name = instanceName(instance);
    if (name && !isMinified(name) && shouldInclude(name)) {
      if (!info.ownerComponent) {
        info.ownerComponent = name;
        ownerInstance = instance;
      }
      if (info.components[info.components.length - 1] !== name) info.components.push(name);
    }

    current = current.parentElement;
    depth++;
  }

  if (options.includeProps) info.props = snapshotInputs(ownerInstance);

  info.path = formatComponentPath(info.components);
  if (!info.path) return null;
  return info;
}

export const angularDetector: FrameworkDetector = {
  id: "angular",

  detect() {
    try {
      return detectAngularPage();
    } catch {
      return null;
    }
  },

  inspect(element, options) {
    if (options.mode === "off") return null;
    try {
      return inspectAngular(element, options);
    } catch {
      return null;
    }
  },
};
