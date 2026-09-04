// =============================================================================
// Turning DOM elements into an annotation
// =============================================================================

import type { Annotation, Measurements, Rect, Settings } from "../shared/types";
import { inspectElement } from "./bridge";
import {
  buildSelector,
  getAccessibilityInfo,
  getComputedStylesSnapshot,
  getElementClasses,
  getForensicComputedStyles,
  getFullElementPath,
  getNearbyElements,
  getNearbyText,
  identifyElement,
  isFixedPosition,
} from "./identify";
import { resolveSource } from "./source";

/** Everything an annotation needs except the comment the user has not typed yet. */
export type Draft = Omit<Annotation, "id" | "comment" | "timestamp">;

export interface CaptureOptions {
  settings: Settings;
  selectedText?: string;
  /**
   * Figures taken in `measure` mode. Passed in rather than computed here: capture runs
   * for every annotation, and re-measuring on each one would charge every mode for a
   * feature only one of them uses.
   */
  measurements?: Measurements;
}

/** Document-space rect, so it stays correct after scrolling. */
function documentRect(element: Element): Rect {
  const box = element.getBoundingClientRect();
  return {
    x: box.left + window.scrollX,
    y: box.top + window.scrollY,
    width: box.width,
    height: box.height,
  };
}

/**
 * Build a draft from one or more elements.
 *
 * With several elements the first one is the "subject": it supplies the name,
 * the component info and the forensic detail, while the rest only contribute
 * their bounding boxes for hover highlighting. That mirrors how a person thinks
 * about a marquee selection — "this row and the ones under it".
 */
export async function captureDraft(
  elements: Element[],
  options: CaptureOptions,
): Promise<Draft | null> {
  const [subject] = elements;
  if (!subject) return null;

  const { settings } = options;
  const { name, path } = identifyElement(subject);
  const box = subject.getBoundingClientRect();
  const fixed = isFixedPosition(subject);

  const framework = await inspectElement(
    subject,
    settings.componentMode,
    settings.maxComponents,
    settings.includeProps,
  );
  const source = resolveSource(subject, framework);

  const isMultiSelect = elements.length > 1;
  const detail = settings.detailLevel;
  const wantsDetail = detail === "detailed" || detail === "forensic";
  const wantsForensic = detail === "forensic";

  const draft: Draft = {
    element: isMultiSelect ? `${name} +${elements.length - 1} more` : name,
    elementPath: path,
    selector: buildSelector(subject),

    // Marker sits at the element's top-right corner. Horizontal position is kept
    // as a percentage so it tracks viewport width changes; vertical is absolute.
    x: (box.right / window.innerWidth) * 100,
    y: fixed ? box.top : box.top + window.scrollY,
    isFixed: fixed,

    boundingBox: documentRect(subject),
    elementBoundingBoxes: isMultiSelect ? elements.map(documentRect) : undefined,
    isMultiSelect: isMultiSelect || undefined,
    measurements: options.measurements,

    selectedText: options.selectedText,
    cssClasses: getElementClasses(subject) || undefined,
    framework: framework ?? undefined,
    source: source ?? undefined,
  };

  if (wantsDetail) {
    draft.nearbyText = getNearbyText(subject) || undefined;
    draft.computedStyles = wantsForensic
      ? getForensicComputedStyles(subject) || undefined
      : getComputedStylesSnapshot(subject) || undefined;
  }

  if (wantsForensic) {
    draft.fullPath = getFullElementPath(subject);
    draft.nearbyElements = getNearbyElements(subject) || undefined;
    draft.accessibility = getAccessibilityInfo(subject) || undefined;
  }

  return draft;
}

/** The parts of an annotation needed to place it back on screen. */
type Positioned = Pick<Annotation, "boundingBox" | "elementBoundingBoxes" | "isFixed">;

/** Viewport-space boxes for an annotation, used to re-highlight on hover. */
export function viewportBoxes(annotation: Positioned): DOMRect[] {
  const boxes =
    annotation.elementBoundingBoxes ?? (annotation.boundingBox ? [annotation.boundingBox] : []);

  return boxes.map((rect) => {
    const left = annotation.isFixed ? rect.x : rect.x - window.scrollX;
    const top = annotation.isFixed ? rect.y : rect.y - window.scrollY;
    return new DOMRect(left, top, rect.width, rect.height);
  });
}

/**
 * Re-resolve the live element for an annotation, preferring the stored selector
 * and falling back to hit-testing the stored box. Returns null once the element
 * is genuinely gone — the page changed under the annotation.
 */
export function resolveElement(annotation: Annotation): Element | null {
  try {
    const bySelector = document.querySelector(annotation.selector);
    if (bySelector) return bySelector;
  } catch {
    // A stored selector can become invalid; fall through to the geometric probe.
  }

  const box = annotation.boundingBox;
  if (!box) return null;

  const x = box.x - window.scrollX + box.width / 2;
  const y = box.y - window.scrollY + box.height / 2;
  if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return null;

  return document.elementFromPoint(x, y);
}
