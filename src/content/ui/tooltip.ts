// =============================================================================
// Tooltips — the help text that used to be a paragraph
// =============================================================================
//
// The settings rows carry a sentence each explaining what the setting does. Laid out
// as body copy they made the card twice as tall as its controls; behind a `ⓘ` they
// cost nothing until asked for.
//
// The browser's own `title=` would have been free, and the toolbar buttons still use
// it — but it waits about a second before appearing and cannot be styled, and a card
// full of settings is exactly where someone is reading rather than pointing.
//
// One node, moved and refilled. Nine rows with a tooltip each would otherwise mean nine
// absolutely-positioned elements sitting in the layer doing nothing.
// =============================================================================

import { h, listen } from "./dom";

/** Clearance from the trigger, and from the viewport edge. */
const GAP = 6;
const MARGIN = 8;

let node: HTMLElement | null = null;
let host: HTMLElement | null = null;
let current: HTMLElement | null = null;
let sequence = 0;

/**
 * Where the tooltips live. Called once, from `createTopUi`.
 *
 * Kept separate from the first `attachTooltip` so the node's owner is a decision made
 * in one place rather than by whichever row happened to be built first.
 */
export function installTooltips(layer: HTMLElement): void {
  host = layer;
  node = null;

  // Anchored to a viewport rectangle measured once, so a scroll invalidates it. Hiding
  // is the honest response — following would cost a listener per frame for something
  // the next hover redraws anyway.
  listen(document, "scroll", () => hide(), { capture: true, passive: true });
}

function ensureNode(): HTMLElement | null {
  if (!host) return null;
  if (node?.isConnected) return node;

  node = h("div", {
    class: "tooltip",
    attrs: { role: "tooltip", "aria-hidden": "true" },
    style: { display: "none" },
  });
  host.append(node);
  return node;
}

function hide(): void {
  if (!node) return;
  node.style.display = "none";
  node.setAttribute("aria-hidden", "true");
  current?.removeAttribute("aria-describedby");
  current = null;
}

/**
 * Place it above the trigger, or below when there is no room above.
 *
 * Measured after the text is in and the node is displayed — an unlaid-out element has
 * no width, and centring on a width of zero puts every tooltip in the same wrong place.
 */
function place(trigger: HTMLElement): void {
  const tip = ensureNode();
  if (!tip) return;

  const anchor = trigger.getBoundingClientRect();
  const box = tip.getBoundingClientRect();

  let top = anchor.top - box.height - GAP;
  if (top < MARGIN) top = anchor.bottom + GAP;

  const left = Math.min(
    Math.max(MARGIN, anchor.left + anchor.width / 2 - box.width / 2),
    Math.max(MARGIN, window.innerWidth - box.width - MARGIN),
  );

  tip.style.top = `${Math.round(top)}px`;
  tip.style.left = `${Math.round(left)}px`;
}

function show(trigger: HTMLElement, text: string): void {
  const tip = ensureNode();
  if (!tip) return;

  tip.textContent = text;
  tip.style.display = "block";
  tip.setAttribute("aria-hidden", "false");

  // Re-run the entrance every time. Without this, moving between two rows leaves the
  // animation already finished and the second tooltip appears with no motion at all.
  tip.style.animation = "none";
  void tip.offsetWidth;
  tip.style.removeProperty("animation");

  const id = tip.id || `sa-tip-${++sequence}`;
  tip.id = id;
  trigger.setAttribute("aria-describedby", id);
  current = trigger;

  place(trigger);
}

/**
 * Make `trigger` show `text`.
 *
 * `focus` as well as `pointerenter`, and `trigger` is expected to be a `<button>` — the
 * help on a settings row is not decoration, and a keyboard cannot hover.
 *
 */
export function attachTooltip(trigger: HTMLElement, text: string): void {
  listen(trigger, "pointerenter", () => show(trigger, text));
  listen(trigger, "pointerleave", () => hide());
  listen(trigger, "focus", () => show(trigger, text));
  listen(trigger, "blur", () => hide());
  listen(trigger, "keydown", (event) => {
    if ((event as KeyboardEvent).key === "Escape") hide();
  });
}

/** Used when the card holding the triggers goes away underneath an open tooltip. */
export function hideTooltip(): void {
  hide();
}
