// =============================================================================
// Source resolution
// =============================================================================
//
// Three sources of truth, best first:
//
//   1. `data-v-inspector="src/components/Foo.vue:12:5"`
//      Emitted by `vite-plugin-vue-inspector`, which Nuxt DevTools turns on by
//      default in dev. It is exact — file, line AND column — and it is a plain DOM
//      attribute, so the isolated world can read it with no bridge round-trip.
//
//   2. `__file` off the owning component, relayed by the MAIN-world inspector.
//      File-level only, but present in any dev build of Vue 2 or 3.
//
//   3. The scoped-style hash (`data-v-7ba5bd90`). No path, but it survives
//      production builds and is a unique `grep -r` handle into the repo.
// =============================================================================

import { INSPECTOR_ATTR } from "../shared/protocol";
import type { SourceRef, ElementFrameworkInfo } from "../shared/types";

/**
 * Read `data-v-inspector` off the element or the nearest ancestor carrying one.
 *
 * The attribute lands on the outermost element of each template expression, so an
 * inner `<span>` inside a component's template inherits its parent's location —
 * which is still the right file, one or two lines off at worst.
 */
function readInspectorAttribute(element: Element): SourceRef | null {
  let current: Element | null = element;
  let depth = 0;

  while (current && depth < 30) {
    const raw = current.getAttribute(INSPECTOR_ATTR);
    if (raw) {
      const parsed = parseInspectorValue(raw);
      if (parsed) return parsed;
    }
    current = current.parentElement;
    depth++;
  }

  return null;
}

/** `src/components/Foo.vue:12:5` → `{ file, line: 12, column: 5 }`. */
export function parseInspectorValue(raw: string): SourceRef | null {
  const match = raw.match(/^(.*?):(\d+):(\d+)$/);
  if (match) {
    return {
      file: match[1],
      line: Number(match[2]),
      column: Number(match[3]),
      origin: "dom-attr",
    };
  }

  const fileOnly = raw.match(/^(.*?):(\d+)$/);
  if (fileOnly) {
    return { file: fileOnly[1], line: Number(fileOnly[2]), origin: "dom-attr" };
  }

  return raw ? { file: raw, origin: "dom-attr" } : null;
}

/**
 * Pick the best available source reference for an element.
 *
 * An `exact` position from the framework wins outright: it names the very node that
 * rendered this element, with line and column.
 *
 * Failing that, the DOM attribute wins on precision — but only when it agrees with the
 * file the framework reported. When they disagree (the attribute was inherited from a
 * wrapper in a *different* file) the framework's own answer is the more honest one, so
 * it takes precedence.
 *
 * This function knows nothing about which framework produced the info; that is the
 * point. Vue-specific ranking lives in the Vue detector.
 */
export function resolveSource(
  element: Element,
  info: ElementFrameworkInfo | null,
): SourceRef | null {
  if (info?.source?.precision === "exact") {
    return {
      file: info.source.file,
      line: info.source.line,
      column: info.source.column,
      origin: "exact",
    };
  }

  const fromAttribute = readInspectorAttribute(element);
  const fromFramework = info?.source
    ? ({ file: info.source.file, origin: "file" } as SourceRef)
    : null;

  if (fromAttribute && fromFramework) {
    const sameFile = basename(fromAttribute.file) === basename(fromFramework.file);
    return sameFile ? fromAttribute : fromFramework;
  }

  if (fromAttribute) return fromAttribute;
  if (fromFramework) return fromFramework;

  const handle = info?.grepHandles?.[0];
  if (handle) return { file: handle, origin: "grep-handle" };

  return null;
}

function basename(file: string): string {
  return file.split("/").pop() ?? file;
}
