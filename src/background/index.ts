// =============================================================================
// Service worker
// =============================================================================
//
// Deliberately thin. It exists for the two things a content script cannot do:
// photograph the tab, and paint the toolbar badge. Everything else — cropping,
// saving, all the state — lives in the content script.
// =============================================================================

import type { RuntimeMessage, RuntimeResponse } from "../shared/protocol";

const ACCENT = "#f97316";

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
          void chrome.action.setBadgeBackgroundColor({ tabId, color: ACCENT });
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
