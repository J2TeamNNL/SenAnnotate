// =============================================================================
// Tooltips — the help text that used to be a paragraph
// =============================================================================
//
// The settings rows carry a sentence each explaining what the setting does. Laid out
// as body copy they made the card twice as tall as its controls; behind a `ⓘ` they
// cost nothing until asked for.
//
// The browser's own `title=` would have been free — but it waits about a second before
// appearing, cannot be styled, and on someone else's page it reads as that page's tooltip
// rather than ours. The settings card is where someone is reading rather than pointing, and
// the toolbar's buttons are icon-only, so both use this instead. `aria-label` carries the
// same text for assistive tech.
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
/**
 * Whether the visible tooltip was opened by focus rather than by hover.
 *
 * The Escape chain treats the two differently — a hover tooltip is dismissed by moving the
 * pointer, so swallowing a press aimed at the card underneath would be wrong; a focused one
 * has no such escape and must answer the key.
 */
let shownByFocus = false;
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
  shownByFocus = false;
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

  // A toolbar button clears the whole dock rather than just itself: inspect mode puts the
  // hint line directly above the pill, and a tooltip anchored to the button would land on
  // top of it. Horizontal centring still follows the button, so it still points at itself.
  const dock = trigger.closest(".toolbar-dock");
  const vertical = dock ? dock.getBoundingClientRect() : anchor;

  let top = vertical.top - box.height - GAP;
  if (top < MARGIN) top = vertical.bottom + GAP;

  const left = Math.min(
    Math.max(MARGIN, anchor.left + anchor.width / 2 - box.width / 2),
    Math.max(MARGIN, window.innerWidth - box.width - MARGIN),
  );

  tip.style.top = `${Math.round(top)}px`;
  tip.style.left = `${Math.round(left)}px`;
}

function show(trigger: HTMLElement, text: string, byFocus = false): void {
  const tip = ensureNode();
  if (!tip) return;
  shownByFocus = byFocus;

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
 * `text` may be a function, read at show time: the collapse button's label carries the
 * annotation count, which changes under it.
 *
 * Escape is deliberately *not* handled here. It used to be, and that hid the tooltip before
 * the orchestrator's Escape chain could see one was open — so a press aimed at the tooltip
 * closed the settings card underneath it as well. `isFocusTooltipVisible` exists for that
 * chain to ask first.
 */
export function attachTooltip(trigger: HTMLElement, text: string | (() => string)): void {
  const read = () => (typeof text === "function" ? text() : text);
  listen(trigger, "pointerenter", () => show(trigger, read()));
  listen(trigger, "pointerleave", () => hide());
  listen(trigger, "focus", () => show(trigger, read(), true));
  listen(trigger, "blur", () => hide());
}

/**
 * Whether a *keyboard* tooltip is on screen — the one Escape has to answer.
 *
 * Deliberately false for a hover tooltip. The pointer resting on a toolbar button is enough
 * to show one, and a press meant for the card underneath must not be spent hiding something
 * that disappears the moment the mouse moves. Measured as exactly that: with the pointer
 * still on the gear it had just clicked, Escape stopped closing the settings card.
 */
export function isFocusTooltipVisible(): boolean {
  return shownByFocus && !!node && node.isConnected && node.style.display !== "none";
}

/** Used when the card holding the triggers goes away underneath an open tooltip. */
export function hideTooltip(): void {
  hide();
}
