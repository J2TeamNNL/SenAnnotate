// =============================================================================
// Shadow root host
// =============================================================================
//
// One fixed, full-viewport, `pointer-events: none` host holds the entire overlay.
// Individual pieces opt back into pointer events, so hovering the page still
// reaches the page.
//
// The host is attached to `document.documentElement`, not `body` — a Vue app that
// re-renders or replaces `body` would otherwise take the toolbar with it.
// =============================================================================

import { UI_ATTR } from "../../shared/protocol";
import type { ThemePreference } from "../../shared/types";
import styles from "./styles.css";
import { h, icon } from "./dom";

export interface UiRoot {
  host: HTMLElement;
  shadow: ShadowRoot;
  /** Hover highlight and marquee rectangle. */
  overlayLayer: HTMLElement;
  /** Numbered pins. */
  markerLayer: HTMLElement;
  /** Toolbar, composer, panel. */
  cardLayer: HTMLElement;
  setTheme(preference: ThemePreference): void;
  toast(message: string, tone?: "success" | "error"): void;
  destroy(): void;
}

export function createUiRoot(): UiRoot {
  const host = document.createElement("div");
  host.setAttribute(UI_ATTR, "");
  // Belt and braces: the stylesheet positions the host, but if the page somehow
  // wins the cascade before our styles load, these keep it out of the layout.
  host.style.setProperty("position", "fixed", "important");
  host.style.setProperty("inset", "0", "important");
  host.style.setProperty("pointer-events", "none", "important");
  host.style.setProperty("z-index", "2147483647", "important");

  const shadow = host.attachShadow({ mode: "open" });

  const sheet = new CSSStyleSheet();
  sheet.replaceSync(styles);
  shadow.adoptedStyleSheets = [sheet];

  const overlayLayer = h("div", { class: "layer layer--overlay" });
  const markerLayer = h("div", { class: "markers" });
  const cardLayer = h("div", { class: "layer layer--cards" });
  shadow.append(overlayLayer, markerLayer, cardLayer);

  document.documentElement.append(host);

  // ---------------------------------------------------------------------------
  // Containment — our clicks are not the page's clicks
  // ---------------------------------------------------------------------------
  //
  // Pointer events are `composed: true`: a click on a toolbar button leaves the shadow
  // root, reaches `document`, and is **retargeted to the host** — which hangs off
  // `documentElement`, outside every dialog on the page. Any site that dismisses on "a
  // pointer event outside the dialog", far and away the most common pattern, therefore
  // closed its modal the moment the toolbar was touched, making a modal the one thing
  // that could not be annotated.
  //
  // Bubble phase on the host is the only seam that works. The capture-phase handlers in
  // `content/index.ts` run before the event reaches our shadow root, so stopping there
  // would cancel our own buttons instead; here, our inner listeners have already run and
  // `document` has not been reached yet.
  //
  // `stopPropagation`, never `stopImmediatePropagation` — other listeners on the host are
  // also ours.
  //
  // Keyboard events are deliberately absent: `keydown` on `document` is what implements
  // f / a / h / 1-2-3, and focus sits inside this shadow root after any toolbar click, so
  // stopping keystrokes here would disable every shortcut. The composer stops its own,
  // which is the right scope. `pointermove` is absent too — not a dismissal trigger, and
  // the hover path reads `elementFromPoint` rather than the event target.
  for (const type of [
    "pointerdown",
    "pointerup",
    "mousedown",
    "mouseup",
    "click",
    "dblclick",
    "contextmenu",
    "touchstart",
    "touchend",
  ] as const) {
    host.addEventListener(type, (event) => event.stopPropagation());
  }

  // Focus is the *default action* of `mousedown`, so cancelling it there is what keeps
  // `document.activeElement` where it was — inside the page's dialog. Without this, a
  // toolbar click moves focus into this shadow root, and a modal that closes when focus
  // leaves it is dismissed exactly as if we had clicked outside.
  //
  // Text fields are exempt: the composer's textarea has to be focusable and its caret
  // placeable. `composedPath()[0]` rather than `event.target`, which retargets to the host
  // and would hide which inner element was actually hit.
  //
  // Buttons still fire `click` after a cancelled `mousedown`; the cost is that text inside
  // the panel can no longer be selected by dragging, which nothing depends on.
  host.addEventListener("mousedown", (event) => {
    const hit = event.composedPath()[0];
    if (hit instanceof Element && hit.closest("input, textarea, select, [contenteditable]")) {
      return;
    }
    event.preventDefault();
  });

  // A focus trap — `focus-trap`, Radix, Headless UI all work this way — watches `focusin`
  // on `document` and pulls focus back when it lands outside the dialog. Ours lands in
  // this shadow root and retargets to the host, so without this the page fights the
  // composer for focus and wins: measured, every keystroke of the note went to the dialog
  // and the textarea stayed empty.
  //
  // What this cannot fix: a dialog's own `focusout` fires on the dialog, not in here, so a
  // modal that closes on focus loss still closes once the composer takes focus. Typing
  // requires focus, so that one is not solvable — but the annotation is captured before
  // the composer opens, so the report is complete either way.
  for (const type of ["focusin", "focusout"] as const) {
    host.addEventListener(type, (event) => event.stopPropagation());
  }

  // ---------------------------------------------------------------------------
  // Theme
  // ---------------------------------------------------------------------------

  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  let preference: ThemePreference = "auto";

  const applyTheme = () => {
    const dark = preference === "dark" || (preference === "auto" && darkQuery.matches);
    host.setAttribute("data-theme", dark ? "dark" : "light");
  };

  darkQuery.addEventListener("change", applyTheme);
  applyTheme();

  // ---------------------------------------------------------------------------
  // Toast
  // ---------------------------------------------------------------------------

  let toastElement: HTMLElement | null = null;
  let toastTimer: number | undefined;

  const toast = (message: string, tone: "success" | "error" = "success") => {
    toastElement?.remove();
    window.clearTimeout(toastTimer);

    toastElement = h(
      "div",
      { class: "toast", dataset: { tone } },
      icon(tone === "success" ? "check" : "close", 14),
      h("span", { text: message }),
    );
    cardLayer.append(toastElement);

    toastTimer = window.setTimeout(() => {
      toastElement?.remove();
      toastElement = null;
    }, 2200);
  };

  return {
    host,
    shadow,
    overlayLayer,
    markerLayer,
    cardLayer,
    setTheme(next) {
      preference = next;
      applyTheme();
    },
    toast,
    destroy() {
      darkQuery.removeEventListener("change", applyTheme);
      window.clearTimeout(toastTimer);
      host.remove();
    },
  };
}
