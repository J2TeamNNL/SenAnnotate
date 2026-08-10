// =============================================================================
// The detector contract
// =============================================================================
//
// One module per framework, each exporting a single `FrameworkDetector`. The
// dispatcher in `./index.ts` is the only thing that knows the list; nothing outside
// this folder knows which frameworks exist.
//
// Adding a framework should mean writing one file and adding one line to that list.
// If it means touching `output.ts`, `toolbar.ts` or `source.ts`, the abstraction has
// leaked and wants fixing rather than working around.
// =============================================================================

import type {
  ComponentDetectionMode,
  ElementFrameworkInfo,
  FrameworkId,
  PageFrameworkInfo,
} from "../../shared/types";

export interface InspectOptions {
  mode: ComponentDetectionMode;
  maxComponents: number;
  includeProps: boolean;
}

export interface FrameworkDetector {
  readonly id: FrameworkId;

  /**
   * Whole-page probe. Return `null` when this framework is not on the page at all —
   * the dispatcher then tries the next detector.
   *
   * Must not throw. Must not cache anything at module load: the MAIN-world script
   * runs at `document_start`, before any app has mounted.
   */
  detect(): PageFrameworkInfo | null;

  /**
   * Per-element probe. Return `null` when this framework does not own the element and
   * has left no usable breadcrumbs on it, so the dispatcher can try the next detector.
   *
   * Returning a mostly-empty object instead of `null` would stop the search, which is
   * what keeps a Vue island inside an otherwise-React page working.
   */
  inspect(element: Element, options: InspectOptions): ElementFrameworkInfo | null;
}

/** Every field empty — a starting point for detectors that build theirs up in place. */
export function emptyElementInfo(): ElementFrameworkInfo {
  return {
    path: null,
    components: [],
    ownerComponent: null,
    source: null,
    props: {},
    grepHandles: [],
  };
}

/** `["Foo", "Bar"]` (innermost → outermost) → `"<Bar> <Foo>"` (outermost → innermost). */
export function formatComponentPath(components: string[]): string | null {
  if (!components.length) return null;
  return components
    .slice()
    .reverse()
    .map((name) => `<${name}>`)
    .join(" ");
}

/** True when the info carries nothing worth reporting, so the search should continue. */
export function isEmptyElementInfo(info: ElementFrameworkInfo): boolean {
  return (
    !info.ownerComponent &&
    !info.path &&
    !info.source &&
    info.components.length === 0 &&
    info.grepHandles.length === 0
  );
}
