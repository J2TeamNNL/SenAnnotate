// =============================================================================
// Element identification — ISOLATED world
// =============================================================================
//
// Turning a DOM node into something an agent can find again. Four descriptions, each
// for a different job:
//
//   identifyElement    a human label      `button "Save changes"`
//   buildSelector      a re-queryable CSS selector
//   getFullElementPath the whole ancestry, for forensic reports
//   getElementPath     a short ancestry, for the report's Location line
//
// Everything here reads only the DOM, so it needs no bridge round-trip and works
// identically whichever framework rendered the page — or none.
//
// Shadow DOM is handled throughout: a click inside a custom element retargets to its
// host, so `closest()` alone stops at the boundary and would misjudge both what was
// clicked and whether it belongs to us.
// =============================================================================

import { UI_ATTR } from "../shared/protocol";

/** Text longer than this is truncated in labels; enough to identify, short enough to scan. */
const MAX_LABEL_TEXT = 40;
const MAX_CONTEXT_TEXT = 60;

// -----------------------------------------------------------------------------
// Shadow-DOM aware traversal
// -----------------------------------------------------------------------------

/**
 * `closest()` that keeps going when it reaches a shadow boundary, hopping to the host
 * and continuing up the light tree.
 *
 * Plain `closest()` stops at the shadow root, so an element inside a web component would
 * never be recognised as living inside anything outside it.
 */
export function closestCrossingShadow(element: Element, selector: string): Element | null {
  let current: Element | null = element;

  while (current) {
    const found = current.closest(selector);
    if (found) return found;

    const root = current.getRootNode();
    if (!(root instanceof ShadowRoot)) return null;
    current = root.host;
  }

  return null;
}

/** True for our own overlay — the toolbar, markers, composer and panel. */
export function isOurUi(element: Element | null): boolean {
  if (!element) return false;
  if (element.hasAttribute?.(UI_ATTR)) return true;
  return !!closestCrossingShadow(element, `[${UI_ATTR}]`);
}

// -----------------------------------------------------------------------------
// Class names
// -----------------------------------------------------------------------------

/**
 * Build-tool hash suffixes, which change every build and so make useless grep targets:
 *
 *   Button_a1b2c3        CSS modules
 *   Button__a1b2c3       CSS modules, double underscore
 *   css-1q2w3e          emotion / styled-components
 *   svelte-1a2b3c       Svelte scoped styles
 *   jsx-1234567890      styled-jsx
 *
 * Deliberately conservative: a segment is only treated as a hash when it *looks* like
 * one — at least four characters mixing letters and digits, or a long digit run. A
 * human-written modifier like `base-button` or `sidebar__title` is kept intact, because
 * dropping it turns a specific class into a vague one and makes the selector worse.
 */
const HASHED_SEGMENT = /^(?=.*\d)[a-z0-9]{4,}$/i;
const WHOLLY_HASHED = /^(css|svelte|jsx|sc)-[a-z0-9]{4,}$/i;

function normaliseClass(cls: string): string | null {
  if (!cls || cls.startsWith("__")) return null;
  if (WHOLLY_HASHED.test(cls)) return null;

  // Strip a trailing hash segment, but only that — `base-button` keeps both words.
  const stripped = cls.replace(/[_-]{1,2}(?=[^_-]*$)([a-z0-9]+)$/i, (whole, tail: string) =>
    HASHED_SEGMENT.test(tail) ? "" : whole,
  );

  const result = stripped || cls;
  return result.length > 0 ? result : null;
}

/** An element's own classes, hashes removed, in source order. */
export function getElementClasses(target: Element): string {
  return meaningfulClasses(target).join(" ");
}

function meaningfulClasses(element: Element): string[] {
  const raw = element.getAttribute("class");
  if (!raw) return [];

  const out: string[] = [];
  for (const cls of raw.trim().split(/\s+/)) {
    const normalised = normaliseClass(cls);
    if (normalised && !out.includes(normalised)) out.push(normalised);
  }
  return out;
}

/** `div.layout`, `button.base-button`, or just `span` when it has no usable class. */
function describeElement(element: Element, maxClasses = 2): string {
  const tag = element.tagName.toLowerCase();
  const classes = meaningfulClasses(element).slice(0, maxClasses);
  return classes.length ? `${tag}.${classes.join(".")}` : tag;
}

// -----------------------------------------------------------------------------
// Paths
// -----------------------------------------------------------------------------

/**
 * Short ancestry for the report's Location line — the last few steps are what orient a
 * reader; the whole chain from `<body>` is noise at that length.
 */
export function getElementPath(target: Element, maxDepth = 4): string {
  const parts: string[] = [];
  let current: Element | null = target;

  while (current && parts.length < maxDepth) {
    if (current.tagName === "BODY" || current.tagName === "HTML") break;
    parts.unshift(describeElement(current, 1));
    current = parentCrossingShadow(current);
  }

  return parts.join(" > ");
}

/** The full chain from `<body>` down, with ids — the forensic view. */
export function getFullElementPath(target: Element): string {
  const parts: string[] = [];
  let current: Element | null = target;

  while (current && parts.length < 40) {
    parts.unshift(segmentWithId(current));
    if (current.tagName === "BODY") break;
    current = parentCrossingShadow(current);
  }

  return parts.join(" > ");
}

function segmentWithId(element: Element): string {
  const tag = element.tagName.toLowerCase();
  if (element.id) return `${tag}#${element.id}`;
  const classes = meaningfulClasses(element).slice(0, 2);
  return classes.length ? `${tag}.${classes.join(".")}` : tag;
}

function parentCrossingShadow(element: Element): Element | null {
  if (element.parentElement) return element.parentElement;
  const root = element.getRootNode();
  return root instanceof ShadowRoot ? root.host : null;
}

// -----------------------------------------------------------------------------
// Selector
// -----------------------------------------------------------------------------

/** Attributes put on elements specifically so tools can find them again. */
const TEST_HOOKS = ["data-testid", "data-test", "data-cy", "data-qa"];

/**
 * A selector that `document.querySelector` will actually resolve back to this element.
 *
 * That last clause is load-bearing twice over:
 *
 * - `querySelector` cannot cross a shadow boundary. For an element inside a shadow root
 *   the honest answer is a selector for its **outermost host** — the deepest thing the
 *   document can reach — rather than a plausible-looking path through the boundary that
 *   never matches anything.
 * - An id is only an anchor if it is **unique**. Real markup repeats ids constantly
 *   (three widgets, each with `id="card"`), and `#card > button` silently resolves to
 *   the first one — the wrong-element failure mode, worse than no match at all.
 *
 * Anchors are tried best-first on each ancestor: a test hook (put there precisely so
 * tools can find the element), then a verified-unique id. Failing both, the path runs to
 * `body` with `:nth-of-type` disambiguation.
 */
export function buildSelector(target: Element): string {
  // Climb out of any shadow trees first; the selector describes the light-DOM element.
  let subject = target;
  while (subject.getRootNode() instanceof ShadowRoot) {
    subject = (subject.getRootNode() as ShadowRoot).host;
  }

  const steps: string[] = [];
  let current: Element | null = subject;

  while (current && steps.length < 12) {
    const anchor = anchorFor(current);
    if (anchor) {
      steps.unshift(anchor);
      return steps.join(" > ");
    }

    if (current.tagName === "BODY") {
      steps.unshift("body");
      break;
    }

    steps.unshift(selectorStep(current));
    current = current.parentElement;
  }

  return steps.join(" > ");
}

/** A selector fragment that provably matches only this element, or null. */
function anchorFor(element: Element): string | null {
  for (const hook of TEST_HOOKS) {
    const value = element.getAttribute(hook);
    if (!value) continue;
    const candidate = `[${hook}="${value.replace(/"/g, '\\"')}"]`;
    if (element.ownerDocument.querySelectorAll(candidate).length === 1) return candidate;
  }

  if (element.id) {
    const candidate = `#${cssEscape(element.id)}`;
    if (element.ownerDocument.querySelectorAll(candidate).length === 1) return candidate;
  }

  return null;
}

function selectorStep(element: Element): string {
  const tag = element.tagName.toLowerCase();
  const parent = element.parentElement;
  if (!parent) return tag;

  const sameTag = Array.from(parent.children).filter((c) => c.tagName === element.tagName);
  if (sameTag.length < 2) return tag;

  return `${tag}:nth-of-type(${sameTag.indexOf(element) + 1})`;
}

function cssEscape(value: string): string {
  return typeof CSS !== "undefined" && CSS.escape ? CSS.escape(value) : value;
}

// -----------------------------------------------------------------------------
// Human label
// -----------------------------------------------------------------------------

/** Elements whose visible text is the most useful thing to call them by. */
const TEXTUAL = new Set([
  "a",
  "button",
  "summary",
  "label",
  "legend",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "th",
  "td",
  "li",
  "dt",
  "dd",
  "p",
  "figcaption",
  "caption",
  "option",
]);

/**
 * A label a person would recognise, plus the short path.
 *
 * The order is deliberate: an accessible name beats visible text, which beats an
 * attribute, which beats the bare tag. That is roughly the order in which a reader
 * would identify the thing themselves.
 */
export function identifyElement(target: Element): { name: string; path: string } {
  const element = target;
  const tag = element.tagName.toLowerCase();
  const path = getElementPath(element);

  const label = accessibleName(element);
  if (label) return { name: `${tag} "${truncate(label, MAX_LABEL_TEXT)}"`, path };

  if (TEXTUAL.has(tag)) {
    const text = ownText(element);
    if (text) return { name: `${tag} "${truncate(text, MAX_LABEL_TEXT)}"`, path };
  }

  const attribute = distinguishingAttribute(element);
  if (attribute) return { name: `${tag}[${attribute}]`, path };

  const described = describeElement(element, 2);
  return { name: described, path };
}

function accessibleName(element: Element): string | null {
  const aria = element.getAttribute("aria-label")?.trim();
  if (aria) return aria;

  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy) {
    const referenced = labelledBy
      .split(/\s+/)
      .map((id) => element.ownerDocument.getElementById(id)?.textContent?.trim())
      .filter(Boolean)
      .join(" ");
    if (referenced) return referenced;
  }

  if (element instanceof HTMLImageElement && element.alt.trim()) return element.alt.trim();
  return null;
}

/** Text belonging to this element, ignoring nested block content and our own UI. */
function ownText(element: Element): string {
  const text = (element.textContent ?? "").replace(/\s+/g, " ").trim();
  return text;
}

function distinguishingAttribute(element: Element): string | null {
  for (const name of ["placeholder", "name", "type", "role", "href", "title"]) {
    const value = element.getAttribute(name);
    if (value) return `${name}="${truncate(value, 30)}"`;
  }
  return null;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

// -----------------------------------------------------------------------------
// Surroundings
// -----------------------------------------------------------------------------

/**
 * The element's text with its neighbours' text bracketing it.
 *
 * The brackets matter: "Save changes" on its own is ambiguous when a page has three of
 * them, and knowing what sits either side is usually what disambiguates.
 */
export function getNearbyText(element: Element): string {
  const own = truncate(ownText(element), MAX_CONTEXT_TEXT);
  const before = siblingText(element, "previousElementSibling");
  const after = siblingText(element, "nextElementSibling");

  const parts: string[] = [];
  if (before) parts.push(`[before: "${before}"]`);
  if (own) parts.push(own);
  if (after) parts.push(`[after: "${after}"]`);

  return parts.join(" ");
}

function siblingText(element: Element, direction: "previousElementSibling" | "nextElementSibling"): string {
  let sibling = element[direction];
  let hops = 0;
  while (sibling && hops < 3) {
    if (!isOurUi(sibling)) {
      const text = ownText(sibling);
      if (text) return truncate(text, 30);
    }
    sibling = sibling[direction];
    hops++;
  }
  return "";
}

/** Siblings named the way the report names elements, with their text when they have any. */
export function getNearbyElements(element: Element): string {
  const parent = parentCrossingShadow(element);
  if (!parent) return "";

  const out: string[] = [];
  for (const sibling of Array.from(parent.children)) {
    if (sibling === element || isOurUi(sibling)) continue;
    if (out.length >= 4) break;

    const described = describeElement(sibling, 1);
    const text = ownText(sibling);
    out.push(text ? `${described} "${truncate(text, 24)}"` : described);
  }

  return out.join(", ");
}

// -----------------------------------------------------------------------------
// Computed styles
// -----------------------------------------------------------------------------

/** The properties most often relevant to "this looks wrong". */
const SNAPSHOT_PROPERTIES = [
  "color",
  "background-color",
  "font-size",
  "font-weight",
  "padding",
  "margin",
  "display",
];

const FORENSIC_PROPERTIES = [
  "color",
  "background-color",
  "border-color",
  "font-size",
  "font-weight",
  "font-family",
  "text-align",
  "width",
  "height",
  "padding",
  "margin",
  "border",
  "border-radius",
  "display",
  "flex-direction",
  "justify-content",
  "align-items",
  "position",
  "z-index",
  "opacity",
  "overflow",
];

function declarations(target: Element, properties: string[]): string {
  const computed = getComputedStyle(target);
  const out: string[] = [];

  for (const property of properties) {
    const value = computed.getPropertyValue(property).trim();
    if (!value || value === "none" || value === "normal" || value === "auto") continue;
    // A font stack is unreadable in a report; its first family is the useful part.
    const rendered = property === "font-family" ? value.split(",")[0].replace(/["']/g, "") : value;
    out.push(`${property}: ${rendered}`);
  }

  return out.join("; ");
}

export function getComputedStylesSnapshot(target: Element): string {
  return declarations(target, SNAPSHOT_PROPERTIES);
}

export function getForensicComputedStyles(target: Element): string {
  return declarations(target, FORENSIC_PROPERTIES);
}

// -----------------------------------------------------------------------------
// Accessibility
// -----------------------------------------------------------------------------

const NATIVELY_FOCUSABLE = new Set(["a", "button", "input", "select", "textarea", "summary"]);

/**
 * The accessibility facts worth putting in a bug report: the explicit ARIA surface, and
 * whether a keyboard user can reach the thing at all — which is the one most often wrong.
 */
export function getAccessibilityInfo(target: Element): string {
  const parts: string[] = [];

  const role = target.getAttribute("role");
  if (role) parts.push(`role="${role}"`);

  for (const attribute of Array.from(target.attributes)) {
    if (attribute.name.startsWith("aria-")) parts.push(`${attribute.name}="${attribute.value}"`);
  }

  const tag = target.tagName.toLowerCase();
  const tabIndex = target.getAttribute("tabindex");
  const disabled = target.hasAttribute("disabled");
  const focusable = !disabled && (NATIVELY_FOCUSABLE.has(tag) || (!!tabIndex && tabIndex !== "-1"));

  parts.push(focusable ? "focusable" : "not focusable");
  if (disabled) parts.push("disabled");
  if (tabIndex) parts.push(`tabindex="${tabIndex}"`);

  return parts.join(", ");
}

// -----------------------------------------------------------------------------
// Predicates
// -----------------------------------------------------------------------------

/**
 * True when the element or any ancestor is taken out of the scroll flow.
 *
 * Markers on such elements must be positioned against the viewport instead of the
 * document, or they drift away as soon as the page scrolls.
 */
export function isFixedPosition(target: Element): boolean {
  let current: Element | null = target;
  let depth = 0;

  while (current && depth < 40) {
    const position = getComputedStyle(current).position;
    if (position === "fixed" || position === "sticky") return true;
    current = parentCrossingShadow(current);
    depth++;
  }

  return false;
}

const NOT_ANNOTATABLE = new Set(["HTML", "BODY", "HEAD", "SCRIPT", "STYLE", "META", "LINK", "TITLE"]);

/** Whether it makes sense to pin a note to this node at all. */
export function isAnnotatable(element: Element | null): element is Element {
  if (!element || !(element instanceof Element)) return false;
  if (NOT_ANNOTATABLE.has(element.tagName)) return false;
  if (isOurUi(element)) return false;
  return true;
}
