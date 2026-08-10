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
import type { SourceRef, VueElementInfo } from "../shared/types";

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
      origin: "inspector",
    };
  }

  const fileOnly = raw.match(/^(.*?):(\d+)$/);
  if (fileOnly) {
    return { file: fileOnly[1], line: Number(fileOnly[2]), origin: "inspector" };
  }

  return raw ? { file: raw, origin: "inspector" } : null;
}

/**
 * Pick the best available source reference for an element.
 *
 * The tracer wins outright when present: it is exact, it comes from the vnode
 * that actually rendered this element, and it is what current Nuxt DevTools
 * provides.
 *
 * Failing that, `data-v-inspector` wins on precision — but only when it agrees
 * with the component the inspector found. When they disagree (the attribute was
 * inherited from a wrapper in a *different* file) the component's own `__file` is
 * the more honest answer, so it takes precedence.
 */
export function resolveSource(element: Element, vue: VueElementInfo | null): SourceRef | null {
  if (vue?.tracer) {
    return {
      file: vue.tracer.file,
      line: vue.tracer.line,
      column: vue.tracer.column,
      origin: "tracer",
    };
  }

  const fromAttribute = readInspectorAttribute(element);
  const fromComponent = vue?.sourceFile
    ? ({ file: vue.sourceFile, origin: "__file" } as SourceRef)
    : null;

  if (fromAttribute && fromComponent) {
    const sameFile = basename(fromAttribute.file) === basename(fromComponent.file);
    return sameFile ? fromAttribute : fromComponent;
  }

  if (fromAttribute) return fromAttribute;
  if (fromComponent) return fromComponent;

  const scopeId = vue?.scopeIds?.[0];
  if (scopeId) return { file: scopeId, origin: "scope-id" };

  return null;
}

function basename(file: string): string {
  return file.split("/").pop() ?? file;
}
