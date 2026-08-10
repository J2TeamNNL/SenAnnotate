// =============================================================================
// Detector dispatcher
// =============================================================================
//
// The only place that knows which frameworks exist. Adding one means writing a
// sibling module and adding a line to DETECTORS.
//
// Detection is deliberately per-element, not per-page: a page can host more than one
// framework — a Vue island inside a server-rendered site, a Svelte widget in a React
// app — and answering "which framework is this page" once would get those wrong. The
// page-level answer only decides which detector to *try first*.
// =============================================================================

import type { ElementFrameworkInfo, PageFrameworkInfo } from "../../shared/types";
import { angularDetector } from "./angular";
import { reactDetector } from "./react";
import type { FrameworkDetector, InspectOptions } from "./types";
import { vueDetector } from "./vue";
import { svelteDetector } from "./svelte";

/**
 * Tried in order, cheapest and most specific first.
 *
 * Vue and React lead because their probes are a direct property read on one element.
 * Angular's needs `window.ng`, also cheap. Svelte is last because it is the only one
 * whose page probe may sweep a few hundred elements looking for `__svelte_meta`, and
 * because its per-element check is the loosest — a scoped `svelte-*` class alone is
 * enough for it to claim an element, so anything with stronger evidence should win
 * first.
 */
const DETECTORS: FrameworkDetector[] = [
  vueDetector,
  reactDetector,
  angularDetector,
  svelteDetector,
];

const NOTHING_DETECTED: PageFrameworkInfo = {
  detected: false,
  framework: null,
  flavour: null,
  version: null,
  devMetadata: false,
  hasSourcePositions: false,
  stateManager: null,
  routePath: null,
};

/**
 * Whichever detector last claimed the page. Tried first on subsequent element probes,
 * because on a single-framework page — the common case — it will answer immediately.
 */
let preferred: FrameworkDetector | null = null;

export function detectPage(): PageFrameworkInfo {
  for (const detector of DETECTORS) {
    let info: PageFrameworkInfo | null = null;
    try {
      info = detector.detect();
    } catch {
      // A detector must never take the whole probe down. Skip it and try the next.
      continue;
    }

    if (info?.detected) {
      preferred = detector;
      return info;
    }
  }

  preferred = null;
  return { ...NOTHING_DETECTED };
}

export function inspectElement(
  element: Element,
  options: InspectOptions,
): ElementFrameworkInfo | null {
  if (options.mode === "off") return null;

  // Preferred first, then the rest — so an island belonging to another framework is
  // still found, without paying for a full sweep on every hover of the common case.
  const order = preferred ? [preferred, ...DETECTORS.filter((d) => d !== preferred)] : DETECTORS;

  for (const detector of order) {
    try {
      const info = detector.inspect(element, options);
      if (info) return info;
    } catch {
      continue;
    }
  }

  return null;
}
