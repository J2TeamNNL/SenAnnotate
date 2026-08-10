// =============================================================================
// Action trail — "steps to reproduce", recorded automatically
// =============================================================================
//
// Runs in the ISOLATED world: these are DOM events, and the DOM is shared, so
// there is no reason to push this into the page's heap.
//
// The one rule that shapes this whole file: **never record what a user typed.**
// A tester filling in a login form, a customer address, or a card number must not
// have those values end up in a ticket. We record that a field was edited and
// which field it was — never its value.
// =============================================================================

import type { ActionEntry, ActionKind } from "../shared/types";
import { identifyElement, isOurUi } from "./identify";
import { listen } from "./ui/dom";

const MAX_ACTIONS = 40;
/** Collapse repeated edits of the same field into one entry. */
const COALESCE_MS = 1500;

const actions: ActionEntry[] = [];
const startedAt = Date.now();

let installed = false;
let paused = false;
let lastUrl = location.href;

/**
 * Suspend recording while inspect mode is on.
 *
 * Clicking an element to annotate it is not a step towards reproducing the bug —
 * it is the tester describing the bug. Leaving it in put "Clicked button Save
 * changes" in the trail twice, once as a real step and once as the annotation.
 */
export function setActionTrailPaused(value: boolean): void {
  paused = value;
}

function since(): number {
  return Date.now() - startedAt;
}

function record(kind: ActionKind, target: string, detail?: string): void {
  // Navigations still count while paused — the page really did change.
  if (paused && kind !== "navigate") return;

  const previous = actions[actions.length - 1];

  // Typing fires input events per keystroke; one line per field is what a person
  // would actually write in a bug report.
  if (
    previous &&
    previous.kind === kind &&
    previous.target === target &&
    kind === "input" &&
    since() - previous.at < COALESCE_MS
  ) {
    previous.at = since();
    return;
  }

  actions.push({ kind, target, detail, at: since() });
  if (actions.length > MAX_ACTIONS) actions.shift();
}

/** A field's label, without its value. */
function describeField(element: Element): string {
  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy) {
    const label = document.getElementById(labelledBy)?.textContent?.trim();
    if (label) return label;
  }

  const aria = element.getAttribute("aria-label");
  if (aria) return aria;

  const id = element.getAttribute("id");
  if (id) {
    const label = document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent?.trim();
    if (label) return label;
  }

  const wrapping = element.closest("label")?.textContent?.trim();
  if (wrapping) return wrapping.slice(0, 40);

  return (
    element.getAttribute("placeholder") ||
    element.getAttribute("name") ||
    element.tagName.toLowerCase()
  );
}

export function installActionTrail(): void {
  if (installed) return;
  installed = true;

  listen(
    document,
    "click",
    (event) => {
      const target = event.target as Element | null;
      if (!target || isOurUi(target)) return;

      // Prefer the interactive ancestor: clicking the <span> inside a button is,
      // to a person, clicking the button.
      const interactive =
        target.closest?.("button, a, [role='button'], [role='link'], summary, label") ?? target;
      record("click", identifyElement(interactive).name);
    },
    { capture: true, passive: true },
  );

  listen(
    document,
    "input",
    (event) => {
      const target = event.target as Element | null;
      if (!target || isOurUi(target)) return;
      if (!target.matches("input, textarea, select, [contenteditable]")) return;

      const type = target.getAttribute("type");
      // A checkbox/radio state is a choice from a fixed set, not typed data, so
      // it is safe — and genuinely useful — to record which way it went.
      const detail =
        type === "checkbox" || type === "radio"
          ? (target as HTMLInputElement).checked
            ? "checked"
            : "unchecked"
          : undefined;
      record("input", describeField(target), detail);
    },
    { capture: true, passive: true },
  );

  listen(
    document,
    "change",
    (event) => {
      const target = event.target as HTMLSelectElement | null;
      if (!target || isOurUi(target) || target.tagName !== "SELECT") return;
      // A <select> option is chosen from a fixed list the developer wrote, so the
      // label is not user-entered data and is worth keeping.
      const chosen = target.selectedOptions?.[0]?.textContent?.trim();
      record("input", describeField(target), chosen ? `selected "${chosen.slice(0, 40)}"` : "changed");
    },
    { capture: true, passive: true },
  );

  listen(
    document,
    "submit",
    (event) => {
      const target = event.target as Element | null;
      if (!target || isOurUi(target)) return;
      record("submit", identifyElement(target).name);
    },
    { capture: true, passive: true },
  );

  listen(
    document,
    "keydown",
    (event) => {
      const keyboard = event as KeyboardEvent;
      // Only keys that mean "do the thing" — never ordinary characters.
      if (keyboard.key !== "Enter" && keyboard.key !== "Escape") return;
      const target = keyboard.target as Element | null;
      if (!target || isOurUi(target)) return;
      record("key", identifyElement(target).name, keyboard.key);
    },
    { capture: true, passive: true },
  );

  // SPA route changes go through history.pushState, which lives in the page's
  // heap — patching it from here would intercept nothing. Polling the URL is
  // crude but costs nothing and cannot miss a transition.
  window.setInterval(() => {
    if (location.href === lastUrl) return;
    const from = lastUrl;
    lastUrl = location.href;
    record("navigate", location.pathname + location.search, `from ${new URL(from).pathname}`);
  }, 400);
}

export function readActions(): ActionEntry[] {
  return actions.slice();
}

export function clearActions(): void {
  actions.length = 0;
}
