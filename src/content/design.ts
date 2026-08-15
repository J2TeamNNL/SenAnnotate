// =============================================================================
// Design edits — try the change on the page, report the delta
// =============================================================================
//
// A note says "tighten this and make it feel less heavy". Whoever reads it has to
// invent the numbers, and the person who wrote it never found out whether their
// idea was right. This module lets them try it on the real element first, and turns
// what they settled on into a list of `property: from → to` the agent can implement.
//
// Two rules shape everything here.
//
// **The page is never permanently modified.** Every override is an inline style, and
// `revert` puts back exactly what was in the `style` attribute before — including
// nothing, which is the usual case. The overlay's whole contract with the page it is
// standing on is "we do not touch it"; a preview is a loan, not an edit.
//
// **The report gets computed values, not inline ones.** `from` is what the element
// actually looked like — `16px`, `rgb(37, 99, 235)` — because an agent needs the
// state it is changing away from, and the inline style is empty on any element that
// gets its styling from a stylesheet, which is all of them.
// =============================================================================

export type DesignControl = "text" | "color" | "select";

export interface DesignField {
  /** CSS property, in the kebab-case form `getPropertyValue` speaks. */
  property: string;
  label: string;
  group: string;
  control: DesignControl;
  /** For `select`. The empty string is always first: it means "leave it alone". */
  options?: string[];
  placeholder?: string;
}

/**
 * The whole surface, as data.
 *
 * One table drives the controls, the preview, the diff and the report, so adding a
 * property is one entry rather than four edits — the same rule the framework
 * detectors follow. The set is deliberately small: these are the things a reviewer
 * actually re-types in DevTools before writing the note, and every addition costs
 * height in a 380px card.
 */
export const DESIGN_FIELDS: DesignField[] = [
  { property: "color", label: "Text", group: "Colour", control: "color" },
  { property: "background-color", label: "Background", group: "Colour", control: "color" },

  { property: "font-size", label: "Size", group: "Type", control: "text", placeholder: "16px" },
  {
    property: "font-weight",
    label: "Weight",
    group: "Type",
    control: "select",
    options: ["", "300", "400", "500", "600", "700", "800"],
  },

  { property: "padding", label: "Padding", group: "Spacing", control: "text", placeholder: "8px 12px" },
  { property: "margin", label: "Margin", group: "Spacing", control: "text", placeholder: "0 auto" },
  { property: "gap", label: "Gap", group: "Spacing", control: "text", placeholder: "8px" },

  {
    property: "display",
    label: "Display",
    group: "Layout",
    control: "select",
    options: ["", "block", "inline-block", "flex", "inline-flex", "grid", "none"],
  },
  {
    property: "flex-direction",
    label: "Direction",
    group: "Layout",
    control: "select",
    options: ["", "row", "row-reverse", "column", "column-reverse"],
  },
  {
    property: "justify-content",
    label: "Justify",
    group: "Layout",
    control: "select",
    options: ["", "flex-start", "center", "flex-end", "space-between", "space-around"],
  },
  {
    property: "align-items",
    label: "Align",
    group: "Layout",
    control: "select",
    options: ["", "flex-start", "center", "flex-end", "stretch", "baseline"],
  },

  { property: "width", label: "Width", group: "Size", control: "text", placeholder: "auto" },
  { property: "height", label: "Height", group: "Size", control: "text", placeholder: "auto" },
];

export interface DesignChange {
  property: string;
  from: string;
  to: string;
}

export interface DesignSnapshot {
  /** The `style` attribute's own value per property — usually "". */
  inline: Record<string, string>;
  /** What the element actually rendered as, before anything was touched. */
  computed: Record<string, string>;
  /** The element's text, when it is a single run this can safely replace. */
  text: string | null;
}

/**
 * Colours come back from `getComputedStyle` as `rgb(37, 99, 235)`, and
 * `<input type="color">` speaks nothing but `#rrggbb`.
 *
 * A colour with alpha is deliberately not converted: `#rrggbb` cannot hold it, and
 * silently dropping the transparency would put a wrong swatch in front of someone and
 * then report the wrong `from`. Those land on the fallback, which is a legible black.
 */
export function rgbToHex(value: string): string {
  const parts = value.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  if (!parts) return "#000000";

  const hex = parts
    .slice(1, 4)
    .map((channel) => Number(channel).toString(16).padStart(2, "0"))
    .join("");
  return `#${hex}`;
}

/**
 * Whether this element's text can be replaced without destroying anything.
 *
 * One text node and nothing else. A `<p>` containing a `<strong>` is refused: setting
 * `textContent` on it would delete the element the emphasis lives in, which is not an
 * edit anyone asked for and is not recoverable by putting a string back.
 */
export function editableText(element: Element): string | null {
  if (element.childNodes.length !== 1) return null;
  const only = element.childNodes[0];
  if (only.nodeType !== Node.TEXT_NODE) return null;

  const text = only.textContent ?? "";
  return text.trim() ? text : null;
}

export function readDesign(element: Element): DesignSnapshot {
  const computedStyle = getComputedStyle(element);
  const inlineStyle = (element as HTMLElement).style;

  const inline: Record<string, string> = {};
  const computed: Record<string, string> = {};

  for (const field of DESIGN_FIELDS) {
    inline[field.property] = inlineStyle.getPropertyValue(field.property);
    computed[field.property] = computedStyle.getPropertyValue(field.property);
  }

  return { inline, computed, text: editableText(element) };
}

/**
 * Show one property's new value on the page.
 *
 * `important`, because the point of a preview is that it is visible: a stylesheet
 * rule carrying `!important` would otherwise beat the inline value and the control
 * would appear to do nothing. `revert` removes the property outright, so the priority
 * leaves no trace either.
 *
 * An empty value means "stop overriding this one", which is how a control returns to
 * its untouched state without a separate reset button.
 */
export function previewDesign(element: Element, property: string, value: string): void {
  const style = (element as HTMLElement).style;
  if (!value) {
    style.removeProperty(property);
    return;
  }
  style.setProperty(property, value, "important");
}

export function previewText(element: Element, text: string): void {
  const only = element.childNodes[0];
  if (only?.nodeType === Node.TEXT_NODE) only.textContent = text;
}

/** Put the element back exactly as it was found — including the text. */
export function revertDesign(element: Element, snapshot: DesignSnapshot): void {
  const style = (element as HTMLElement).style;

  for (const field of DESIGN_FIELDS) {
    const before = snapshot.inline[field.property];
    style.removeProperty(field.property);
    if (before) style.setProperty(field.property, before);
  }

  if (snapshot.text !== null) previewText(element, snapshot.text);

  // `removeProperty` empties the attribute but leaves it in place, and an element that
  // gained a bare `style=""` has still been modified — visibly so in devtools, and to
  // any code the page runs that looks for the attribute. Nothing left behind means
  // nothing left behind.
  if (element.getAttribute("style") === "") element.removeAttribute("style");
}

/**
 * What actually changed, in the order the fields are declared.
 *
 * A value equal to what was already computed is dropped rather than reported: typing
 * `16px` into a box that already reads `16px` is not a change, and a report full of
 * no-ops is one an agent has to check line by line before it can trust any of it.
 */
export function diffDesign(
  snapshot: DesignSnapshot,
  values: Record<string, string>,
): DesignChange[] {
  const changes: DesignChange[] = [];

  for (const field of DESIGN_FIELDS) {
    const to = values[field.property] ?? "";
    if (!to) continue;

    // Colours are compared and reported in the notation the control speaks. The
    // computed side is `rgb(37, 99, 235)` and the picker only ever produces
    // `#2563eb`, so without this every colour reads as changed and the report puts
    // two notations for the same colour on one line.
    const raw = snapshot.computed[field.property] ?? "";
    const from = field.control === "color" ? rgbToHex(raw) : raw;
    if (from === to) continue;

    changes.push({ property: field.property, from, to });
  }

  return changes;
}
