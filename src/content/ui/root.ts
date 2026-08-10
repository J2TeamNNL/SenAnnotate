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
