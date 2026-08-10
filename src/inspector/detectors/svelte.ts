// =============================================================================
// Svelte internals reader — MAIN world only
// =============================================================================
//
// Svelte is the odd one out: it has no component *instance* tree on DOM nodes at all.
// There is no `__svelteComponent` to walk the way Vue has `__vueParentComponent`.
//
// What it does have, compiled with `dev: true`, is per-element provenance:
//
//     el.__svelte_meta = { loc: { file: 'src/lib/Button.svelte', line: 12, char: 5 } }
//
// That turns out to be *better* than a component tree for this tool's purpose, because
// it is the exact authoring position rather than a name we then have to map to a file.
// The component ancestry is recovered by walking up the DOM and collecting distinct
// `loc.file` values — a file ancestry rather than an instance ancestry, which for Svelte
// is nearly the same thing since one file is one component.
//
// Version comes from `window.__svelte.v`, a Set the compiler populates unless the app
// opts out with `discloseVersion: false`.
//
// Caveat worth knowing: `__svelte_meta` is an internal, not public API. Everything here
// is written defensively — any shape mismatch degrades to "no info" rather than throwing.
// =============================================================================

import type { ElementFrameworkInfo, PageFrameworkInfo } from "../../shared/types";
import { componentNameFromFile, relativizeFile } from "./relativize";
import {
  emptyElementInfo,
  formatComponentPath,
  type FrameworkDetector,
  type InspectOptions,
} from "./types";

interface SvelteLoc {
  file?: string;
  line?: number;
  /** Svelte calls the column `char`. */
  char?: number;
  column?: number;
}

type SvelteProbe = Element & {
  __svelte_meta?: { loc?: SvelteLoc } | null;
};

/** `window.__svelte.v` is a Set of version strings, e.g. {"5.37.0"}. */
function svelteVersions(): string[] {
  const globals = globalThis as { __svelte?: { v?: unknown } };
  const versions = globals.__svelte?.v;
  if (versions instanceof Set) return [...versions].filter((v): v is string => typeof v === "string");
  return [];
}

function readLoc(element: Element): SvelteLoc | null {
  const meta = (element as SvelteProbe).__svelte_meta;
  const loc = meta?.loc;
  if (!loc || typeof loc.file !== "string" || !loc.file) return null;
  return loc;
}

/** Scoped-style class hashes Svelte adds: `svelte-1a2b3c`. Survive minification. */
function svelteClasses(element: Element): string[] {
  const raw = element.getAttribute("class");
  if (!raw) return [];
  return raw.split(/\s+/).filter((cls) => /^svelte-[a-z0-9]+$/i.test(cls));
}

/** Any element on the page carrying dev provenance — proof `dev: true` was used. */
function hasDevMeta(): boolean {
  if (readLoc(document.body)) return true;
  // A shallow sweep: enough to answer the question without walking a huge DOM.
  const sample = document.querySelectorAll("body *");
  const limit = Math.min(sample.length, 400);
  for (let i = 0; i < limit; i++) {
    if (readLoc(sample[i])) return true;
  }
  return false;
}

function isSveltePage(devMetadata: boolean): boolean {
  if (svelteVersions().length > 0) return true;
  if (document.querySelector('[class*="svelte-"]')) return true;
  return devMetadata;
}

/**
 * SvelteKit stamps hashed globals like `__sveltekit_1a2b3c` and marks links with
 * `data-sveltekit-*`, so either is a reliable tell.
 */
function isSvelteKit(): boolean {
  if (document.querySelector("[data-sveltekit-preload-data], [data-sveltekit-reload]")) return true;
  return Object.keys(globalThis).some((key) => key.startsWith("__sveltekit_"));
}

function detectSveltePage(): PageFrameworkInfo | null {
  // Computed once: it sweeps up to 400 elements, so it must not run twice per probe.
  const devMetadata = hasDevMeta();
  if (!isSveltePage(devMetadata)) return null;

  const versions = svelteVersions();
  const version = versions[0] ?? null;
  const major = version ? Number.parseInt(version, 10) : null;
  const kit = isSvelteKit();

  return {
    detected: true,
    framework: "svelte",
    flavour: kit ? "SvelteKit" : major ? `Svelte ${major}` : "Svelte",
    version,
    devMetadata,
    // `__svelte_meta.loc` carries line and char, so positions come free with dev mode —
    // no separate build plugin, unlike Vue.
    hasSourcePositions: devMetadata,
    // Svelte stores are plain module imports with nothing on `window`, so there is
    // nothing honest to report here.
    stateManager: null,
    routePath: null,
  };
}

function inspectSvelte(element: Element, options: InspectOptions): ElementFrameworkInfo | null {
  const info = emptyElementInfo();
  info.grepHandles = svelteClasses(element);

  // Walk up collecting distinct authoring files. The nearest one owns the element; the
  // rest are its ancestry.
  let current: Element | null = element;
  let depth = 0;
  const seen: string[] = [];

  while (current && depth < 60 && seen.length < options.maxComponents) {
    const loc = readLoc(current);
    if (loc?.file) {
      const file = relativizeFile(loc.file);

      if (!info.source) {
        const line = typeof loc.line === "number" ? loc.line : undefined;
        const column = typeof loc.char === "number" ? loc.char : loc.column;
        info.source = { file, line, column, precision: "exact" };
        info.ownerComponent = componentNameFromFile(file);
      }

      const name = componentNameFromFile(file);
      if (name && seen[seen.length - 1] !== name) seen.push(name);
    }

    for (const cls of svelteClasses(current)) {
      if (!info.grepHandles.includes(cls)) info.grepHandles.push(cls);
    }

    current = current.parentElement;
    depth++;
  }

  info.components = seen;
  info.path = formatComponentPath(seen);

  // Nothing found: no dev metadata and no scoped classes anywhere up the tree. Return
  // null so the dispatcher tries another framework.
  if (!info.source && !info.grepHandles.length) return null;
  return info;
}

export const svelteDetector: FrameworkDetector = {
  id: "svelte",

  detect() {
    try {
      return detectSveltePage();
    } catch {
      return null;
    }
  },

  inspect(element, options) {
    if (options.mode === "off") return null;
    try {
      return inspectSvelte(element, options);
    } catch {
      return null;
    }
  },
};
