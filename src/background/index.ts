// =============================================================================
// Service worker
// =============================================================================
//
// Deliberately thin. It exists for the two things a content script cannot do:
// photograph the tab, and paint the toolbar badge. Everything else — cropping,
// saving, all the state — lives in the content script.
// =============================================================================

import { DEFAULT_ACCENT, accentTheme } from "../shared/accent";
import { SETTINGS_KEY, type RuntimeMessage, type RuntimeResponse } from "../shared/protocol";
import type { Settings } from "../shared/types";

/**
 * The badge colour, read at paint time rather than cached.
 *
 * The badge is repainted on every count change, so there is nothing to invalidate and no
 * listener to keep in sync — and a service worker is torn down between events anyway, so
 * a cache would mostly be cold. `SETTINGS_KEY` comes from `shared/protocol` because the
 * worker may not import from `content/`; that is the whole reason the key lives there.
 */
async function badgeColor(): Promise<string> {
  try {
    const stored = await chrome.storage.sync.get(SETTINGS_KEY);
    const settings = stored[SETTINGS_KEY] as Partial<Settings> | undefined;
    return accentTheme(settings?.accentColor ?? DEFAULT_ACCENT).accent;
  } catch {
    return DEFAULT_ACCENT;
  }
}

chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage, sender, sendResponse: (response: RuntimeResponse) => void) => {
    switch (message.kind) {
      case "capture": {
        const windowId = sender.tab?.windowId;
        chrome.tabs
          .captureVisibleTab(windowId ?? chrome.windows.WINDOW_ID_CURRENT, { format: "png" })
          .then((dataUrl) => sendResponse({ ok: true, dataUrl }))
          .catch((error: unknown) => sendResponse({ ok: false, error: String(error) }));
        return true; // keep the channel open for the async reply
      }

      case "badge": {
        const tabId = sender.tab?.id;
        if (tabId !== undefined) {
          void chrome.action.setBadgeText({ tabId, text: message.count ? String(message.count) : "" });
          void badgeColor().then((color) => chrome.action.setBadgeBackgroundColor({ tabId, color }));
        }
        sendResponse({ ok: true });
        return false;
      }

      default:
        return false;
    }
  },
);

// -----------------------------------------------------------------------------
// Keyboard command
// -----------------------------------------------------------------------------

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-inspect") return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) return;

  try {
    await chrome.tabs.sendMessage(tab.id, { kind: "toggle-inspect" } satisfies RuntimeMessage);
  } catch {
    // No content script on this tab — a chrome:// page, the web store, or a PDF.
  }
});
