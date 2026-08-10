// =============================================================================
// Element identification
// =============================================================================
//
// Ported near-verbatim from agentation's `element-identification.ts` — none of it
// is framework-specific, and it is the part that turns a DOM node into something
// a person (and an agent) can read back. Additions for this extension:
//   - `buildSelector`, a re-resolvable unique CSS selector
//   - Vue-aware class cleaning (`data-v-*` scope attributes are not classes)
// =============================================================================

import { UI_ATTR } from "../shared/protocol";

// -----------------------------------------------------------------------------
// Shadow DOM helpers
// -----------------------------------------------------------------------------

/** Parent element, stepping out of a shadow root onto its host when needed. */
function parentOf(element: Element): Element | null {
  if (element.parentElement) return element.parentElement;
  const root = element.getRootNode();
  return root instanceof ShadowRoot ? root.host : null;
}

export function closestCrossingShadow(element: Element, selector: string): Element | null {
  let current: Element | null = element;
  while (current) {
    if (current.matches(selector)) return current;
    current = parentOf(current);
  }
  return null;
}

/** True for anything belonging to our own overlay — never annotate ourselves. */
export function isOurUi(element: Element | null): boolean {
  if (!element) return false;
  return !!closestCrossingShadow(element, `[${UI_ATTR}]`);
}

// -----------------------------------------------------------------------------
// Class-name cleaning
// -----------------------------------------------------------------------------

/** `button_primary__a1b2c` → `button_primary`. CSS-module hashes are noise. */
function stripHash(cls: string): string {
  return cls.replace(/[_-][a-zA-Z0-9]{5,}$/, "");
}

function classListOf(element: Element): string[] {
  const raw = element.getAttribute("class");
  if (!raw) return [];
  return raw.split(/\s+/).filter(Boolean);
}

function meaningfulClass(element: Element): string | null {
  return (
    classListOf(element)
      .map(stripHash)
      .find((cls) => cls.length > 2 && !/^[a-z]{1,2}$/.test(cls) && !/^data-v-/.test(cls)) ?? null
  );
}

// -----------------------------------------------------------------------------
// Paths
// -----------------------------------------------------------------------------

/** Short readable ancestry, e.g. `.sidebar > nav > .nav-link`. */
export function getElementPath(target: Element, maxDepth = 4): string {
  const parts: string[] = [];
  let current: Element | null = target;
  let depth = 0;

  while (current && depth < maxDepth) {
    const tag = current.tagName.toLowerCase();
    if (tag === "html" || tag === "body") break;

    let identifier = tag;
    if (current.id) identifier = `#${current.id}`;
    else {
      const cls = meaningfulClass(current);
      if (cls) identifier = `.${cls}`;
    }

    const next = parentOf(current);
    if (!current.parentElement && next) identifier = `⟨shadow⟩ ${identifier}`;

    parts.unshift(identifier);
    current = next;
    depth++;
  }

  return parts.join(" > ");
}

/** Full ancestry up to `<html>`, for forensic output. */
export function getFullElementPath(target: Element): string {
  const parts: string[] = [];
  let current: Element | null = target;

  while (current && current.tagName.toLowerCase() !== "html") {
    const tag = current.tagName.toLowerCase();
    let identifier = tag;

    if (current.id) identifier = `${tag}#${current.id}`;
    else {
      const cls = meaningfulClass(current);
      if (cls) identifier = `${tag}.${cls}`;
    }

    const next = parentOf(current);
    if (!current.parentElement && next) identifier = `⟨shadow⟩ ${identifier}`;

    parts.unshift(identifier);
    current = next;
  }

  return parts.join(" > ");
}

/**
 * A selector that actually re-resolves — used to re-attach markers after a reload.
 * Prefers ids and stable test hooks, falls back to `:nth-of-type` chains.
 */
export function buildSelector(target: Element): string {
  if (target.id && document.querySelectorAll(`#${CSS.escape(target.id)}`).length === 1) {
    return `#${CSS.escape(target.id)}`;
  }

  for (const attr of ["data-testid", "data-test", "data-cy", "name"]) {
    const value = target.getAttribute(attr);
    if (!value) continue;
    const candidate = `[${attr}="${CSS.escape(value)}"]`;
    if (document.querySelectorAll(candidate).length === 1) return candidate;
  }

  const parts: string[] = [];
  let current: Element | null = target;

  while (current && current.tagName.toLowerCase() !== "html") {
    const node: Element = current;
    const tag = node.tagName.toLowerCase();

    if (node.id) {
      parts.unshift(`#${CSS.escape(node.id)}`);
      break;
    }

    const parent: Element | null = node.parentElement;
    if (!parent) {
      parts.unshift(tag);
      break;
    }

    const sameTag = Array.from(parent.children).filter((child) => child.tagName === node.tagName);
    parts.unshift(sameTag.length > 1 ? `${tag}:nth-of-type(${sameTag.indexOf(node) + 1})` : tag);
    current = parent;
  }

  return parts.join(" > ");
}

// -----------------------------------------------------------------------------
// Human-readable naming
// -----------------------------------------------------------------------------

const SVG_SHAPES = ["path", "circle", "rect", "line", "g", "ellipse", "polygon"];
const CONTAINERS = ["div", "section", "article", "nav", "header", "footer", "aside", "main"];

/** Turns an element into a phrase a person recognises on sight. */
export function identifyElement(target: Element): { name: string; path: string } {
  const path = getElementPath(target);
  const tag = target.tagName.toLowerCase();

  const dataElement = (target as HTMLElement).dataset?.element;
  if (dataElement) return { name: dataElement, path };

  if (SVG_SHAPES.includes(tag)) {
    const svg = closestCrossingShadow(target, "svg");
    const host = svg ? parentOf(svg) : null;
    if (host) return { name: `graphic in ${identifyElement(host).name}`, path };
    return { name: "graphic element", path };
  }
  if (tag === "svg") {
    const parent = parentOf(target);
    if (parent?.tagName.toLowerCase() === "button") {
      const label = parent.textContent?.trim();
      return { name: label ? `icon in "${label}" button` : "button icon", path };
    }
    return { name: "icon", path };
  }

  if (tag === "button") {
    const aria = target.getAttribute("aria-label");
    if (aria) return { name: `button [${aria}]`, path };
    const text = target.textContent?.trim();
    return { name: text ? `button "${text.slice(0, 25)}"` : "button", path };
  }
  if (tag === "a") {
    const text = target.textContent?.trim();
    if (text) return { name: `link "${text.slice(0, 25)}"`, path };
    const href = target.getAttribute("href");
    if (href) return { name: `link to ${href.slice(0, 30)}`, path };
    return { name: "link", path };
  }
  if (tag === "input") {
    const placeholder = target.getAttribute("placeholder");
    if (placeholder) return { name: `input "${placeholder}"`, path };
    const name = target.getAttribute("name");
    if (name) return { name: `input [${name}]`, path };
    return { name: `${target.getAttribute("type") || "text"} input`, path };
  }
  if (tag === "textarea") return { name: "textarea", path };
  if (tag === "select") return { name: "select", path };

  if (/^h[1-6]$/.test(tag)) {
    const text = target.textContent?.trim();
    return { name: text ? `${tag} "${text.slice(0, 35)}"` : tag, path };
  }
  if (tag === "p") {
    const text = target.textContent?.trim();
    if (text) {
      return { name: `paragraph: "${text.slice(0, 40)}${text.length > 40 ? "…" : ""}"`, path };
    }
    return { name: "paragraph", path };
  }
  if (tag === "span" || tag === "label") {
    const text = target.textContent?.trim();
    if (text && text.length < 40) return { name: `"${text}"`, path };
    return { name: tag, path };
  }
  if (tag === "li") {
    const text = target.textContent?.trim();
    if (text && text.length < 40) return { name: `list item: "${text.slice(0, 35)}"`, path };
    return { name: "list item", path };
  }
  if (tag === "blockquote") return { name: "blockquote", path };
  if (tag === "code") {
    const text = target.textContent?.trim();
    if (text && text.length < 30) return { name: `code: \`${text}\``, path };
    return { name: "code", path };
  }
  if (tag === "pre") return { name: "code block", path };

  if (tag === "img") {
    const alt = target.getAttribute("alt");
    return { name: alt ? `image "${alt.slice(0, 30)}"` : "image", path };
  }
  if (tag === "video") return { name: "video", path };
  if (tag === "canvas") return { name: "canvas", path };

  if (CONTAINERS.includes(tag)) {
    const aria = target.getAttribute("aria-label");
    if (aria) return { name: `${tag} [${aria}]`, path };
    const role = target.getAttribute("role");
    if (role) return { name: role, path };

    const words = classListOf(target)
      .map(stripHash)
      .flatMap((cls) => cls.split(/[\s_-]+/))
      .filter((word) => word.length > 2 && !/^[a-z]{1,2}$/.test(word))
      .slice(0, 2);
    if (words.length) return { name: words.join(" "), path };

    return { name: tag === "div" ? "container" : tag, path };
  }

  // Custom elements read well as-is: `<my-widget>` → `<my-widget>`.
  if (tag.includes("-")) return { name: `<${tag}>`, path };

  return { name: tag, path };
}

// -----------------------------------------------------------------------------
// Surrounding context
// -----------------------------------------------------------------------------

export function getNearbyText(element: Element): string {
  const texts: string[] = [];

  const own = element.textContent?.trim();
  if (own && own.length < 100) texts.push(own);

  const previous = element.previousElementSibling?.textContent?.trim();
  if (previous && previous.length < 50) texts.unshift(`[before: "${previous.slice(0, 40)}"]`);

  const next = element.nextElementSibling?.textContent?.trim();
  if (next && next.length < 50) texts.push(`[after: "${next.slice(0, 40)}"]`);

  return texts.join(" ");
}

export function getNearbyElements(element: Element): string {
  const parent = parentOf(element);
  if (!parent) return "";

  const siblings = Array.from(element.parentElement?.children ?? parent.children).filter(
    (child) => child !== element,
  );
  if (!siblings.length) return "";

  const described = siblings.slice(0, 4).map((sibling) => {
    const tag = sibling.tagName.toLowerCase();
    const cls = meaningfulClass(sibling);
    const suffix = cls ? `.${cls}` : "";

    if (tag === "button" || tag === "a") {
      const text = sibling.textContent?.trim().slice(0, 15);
      if (text) return `${tag}${suffix} "${text}"`;
    }
    return `${tag}${suffix}`;
  });

  const parentCls = meaningfulClass(parent);
  const parentId = parentCls ? `.${parentCls}` : parent.tagName.toLowerCase();
  const total = parent.children.length;
  const overflow = total > described.length + 1 ? ` (${total} total in ${parentId})` : "";

  return described.join(", ") + overflow;
}

export function getElementClasses(target: Element): string {
  const classes = classListOf(target)
    .map(stripHash)
    .filter((cls, index, all) => all.indexOf(cls) === index);
  return classes.join(", ");
}

// -----------------------------------------------------------------------------
// Computed styles
// -----------------------------------------------------------------------------

const DEFAULT_VALUES = new Set([
  "none",
  "normal",
  "auto",
  "0px",
  "rgba(0, 0, 0, 0)",
  "transparent",
  "static",
  "visible",
]);

const FORENSIC_PROPERTIES = [
  "color",
  "backgroundColor",
  "borderColor",
  "fontSize",
  "fontWeight",
  "fontFamily",
  "lineHeight",
  "letterSpacing",
  "textAlign",
  "width",
  "height",
  "padding",
  "margin",
  "border",
  "borderRadius",
  "display",
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "zIndex",
  "flexDirection",
  "justifyContent",
  "alignItems",
  "gap",
  "opacity",
  "visibility",
  "overflow",
  "boxShadow",
  "transform",
];

function toCssName(property: string): string {
  return property.replace(/([A-Z])/g, "-$1").toLowerCase();
}

/** The short version — what you want on a "detailed" report. */
export function getComputedStylesSnapshot(target: Element): string {
  const styles = window.getComputedStyle(target);
  const parts: string[] = [];

  if (styles.color && styles.color !== "rgb(0, 0, 0)") parts.push(`color: ${styles.color}`);
  if (styles.backgroundColor && !DEFAULT_VALUES.has(styles.backgroundColor)) {
    parts.push(`bg: ${styles.backgroundColor}`);
  }
  if (styles.fontSize) parts.push(`font: ${styles.fontSize}`);
  if (styles.fontWeight && styles.fontWeight !== "400") parts.push(`weight: ${styles.fontWeight}`);
  if (styles.padding && styles.padding !== "0px") parts.push(`padding: ${styles.padding}`);
  if (styles.margin && styles.margin !== "0px") parts.push(`margin: ${styles.margin}`);
  if (styles.display && styles.display !== "block" && styles.display !== "inline") {
    parts.push(`display: ${styles.display}`);
  }
  if (styles.position && styles.position !== "static") parts.push(`position: ${styles.position}`);
  if (styles.borderRadius && styles.borderRadius !== "0px") {
    parts.push(`radius: ${styles.borderRadius}`);
  }

  return parts.join(", ");
}

/** The long version — every property that could plausibly matter. */
export function getForensicComputedStyles(target: Element): string {
  const styles = window.getComputedStyle(target);
  const parts: string[] = [];

  for (const property of FORENSIC_PROPERTIES) {
    const cssName = toCssName(property);
    const value = styles.getPropertyValue(cssName);
    if (value && !DEFAULT_VALUES.has(value)) parts.push(`${cssName}: ${value}`);
  }

  return parts.join("; ");
}

export function getAccessibilityInfo(target: Element): string {
  const parts: string[] = [];

  const role = target.getAttribute("role");
  const label = target.getAttribute("aria-label");
  const describedBy = target.getAttribute("aria-describedby");
  const tabIndex = target.getAttribute("tabindex");
  const hidden = target.getAttribute("aria-hidden");

  if (role) parts.push(`role="${role}"`);
  if (label) parts.push(`aria-label="${label}"`);
  if (describedBy) parts.push(`aria-describedby="${describedBy}"`);
  if (tabIndex) parts.push(`tabindex=${tabIndex}`);
  if (hidden === "true") parts.push("aria-hidden");
  if (target.matches("a, button, input, select, textarea, [tabindex]")) parts.push("focusable");

  return parts.join(", ");
}

// -----------------------------------------------------------------------------

/** `position: fixed|sticky` anywhere up the chain means the marker must not scroll. */
export function isFixedPosition(target: Element): boolean {
  let current: Element | null = target;
  let depth = 0;
  while (current && depth < 20) {
    const position = window.getComputedStyle(current).position;
    if (position === "fixed" || position === "sticky") return true;
    current = current.parentElement;
    depth++;
  }
  return false;
}

/**
 * Elements we must never hand back as an annotation target.
 *
 * Note this deliberately does NOT reject elements carrying the bridge's probe
 * attribute. That attribute is on the element precisely because we are inspecting
 * it — an earlier version excluded it, which silently swallowed any click that
 * landed while a hover lookup was still in flight.
 */
export function isAnnotatable(element: Element | null): element is Element {
  if (!element) return false;
  if (isOurUi(element)) return false;
  const tag = element.tagName.toLowerCase();
  return tag !== "html" && tag !== "body";
}
