// =============================================================================
// Extension popup — status and settings
// =============================================================================

import type { RuntimeMessage, RuntimeResponse } from "../shared/protocol";
import {
  DEFAULT_SETTINGS,
  OUTPUT_DETAIL_OPTIONS,
  type ComponentDetectionMode,
  type OutputDetailLevel,
  type Settings,
  type ThemePreference,
} from "../shared/types";

const SETTINGS_KEY = "vuetation:settings";
const ANNOTATION_PREFIX = "vuetation:page:";

const COMPONENT_OPTIONS: { value: ComponentDetectionMode; label: string }[] = [
  { value: "filtered", label: "Skip framework plumbing" },
  { value: "smart", label: "Only names matching the DOM" },
  { value: "all", label: "Every component" },
  { value: "off", label: "Off (fastest)" },
];

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "auto", label: "Match system" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

// -----------------------------------------------------------------------------

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const statusBox = $("status");
const statusText = $("status-text");
const statusCount = $("status-count");
const toggleButton = $<HTMLButtonElement>("toggle");
const detailSelect = $<HTMLSelectElement>("detail");
const componentSelect = $<HTMLSelectElement>("components");
const propsCheckbox = $<HTMLInputElement>("props");
const diagnosticsCheckbox = $<HTMLInputElement>("diagnostics");
const markersCheckbox = $<HTMLInputElement>("markers");
const freezeCheckbox = $<HTMLInputElement>("freeze");
const themeSelect = $<HTMLSelectElement>("theme");
const clearButton = $<HTMLButtonElement>("clear");

let settings: Settings = { ...DEFAULT_SETTINGS };

function fill(select: HTMLSelectElement, options: { value: string; label: string }[]): void {
  for (const option of options) {
    const node = document.createElement("option");
    node.value = option.value;
    node.textContent = option.label;
    select.append(node);
  }
}

fill(
  detailSelect,
  OUTPUT_DETAIL_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
);
fill(componentSelect, COMPONENT_OPTIONS);
fill(themeSelect, THEME_OPTIONS);

// -----------------------------------------------------------------------------
// Settings
// -----------------------------------------------------------------------------

async function loadSettings(): Promise<void> {
  try {
    const stored = await chrome.storage.sync.get(SETTINGS_KEY);
    settings = { ...DEFAULT_SETTINGS, ...((stored[SETTINGS_KEY] as Partial<Settings>) ?? {}) };
  } catch {
    settings = { ...DEFAULT_SETTINGS };
  }

  detailSelect.value = settings.detailLevel;
  componentSelect.value = settings.componentMode;
  propsCheckbox.checked = settings.includeProps;
  diagnosticsCheckbox.checked = settings.captureDiagnostics;
  markersCheckbox.checked = settings.showMarkers;
  freezeCheckbox.checked = settings.freezeOnInspect;
  themeSelect.value = settings.theme;
}

async function patch(update: Partial<Settings>): Promise<void> {
  settings = { ...settings, ...update };
  try {
    await chrome.storage.sync.set({ [SETTINGS_KEY]: settings });
  } catch {
    // sync unavailable — the change still applies for this session via the
    // storage.onChanged path, which simply will not fire. Nothing to recover.
  }
}

detailSelect.addEventListener("change", () =>
  void patch({ detailLevel: detailSelect.value as OutputDetailLevel }),
);
componentSelect.addEventListener("change", () =>
  void patch({ componentMode: componentSelect.value as ComponentDetectionMode }),
);
propsCheckbox.addEventListener("change", () => void patch({ includeProps: propsCheckbox.checked }));
diagnosticsCheckbox.addEventListener("change", () =>
  void patch({ captureDiagnostics: diagnosticsCheckbox.checked }),
);
markersCheckbox.addEventListener("change", () => void patch({ showMarkers: markersCheckbox.checked }));
freezeCheckbox.addEventListener("change", () =>
  void patch({ freezeOnInspect: freezeCheckbox.checked }),
);
themeSelect.addEventListener("change", () =>
  void patch({ theme: themeSelect.value as ThemePreference }),
);

// -----------------------------------------------------------------------------
// Active tab
// -----------------------------------------------------------------------------

async function activeTabId(): Promise<number | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id ?? null;
}

async function askTab(message: RuntimeMessage): Promise<RuntimeResponse | null> {
  const tabId = await activeTabId();
  if (tabId === null) return null;
  try {
    return (await chrome.tabs.sendMessage(tabId, message)) as RuntimeResponse;
  } catch {
    // No content script here — a chrome:// page, the Web Store, or a PDF viewer.
    return null;
  }
}

async function refreshStatus(): Promise<void> {
  const response = await askTab({ kind: "get-status" });

  if (!response?.ok) {
    statusBox.dataset.detected = "false";
    statusText.textContent = "Not available on this page";
    statusCount.textContent = "";
    toggleButton.disabled = true;
    return;
  }

  statusBox.dataset.detected = "true";
  statusText.textContent = response.active ? "Inspect mode is on" : "Ready";
  statusCount.textContent = response.count ? `${response.count} note${response.count === 1 ? "" : "s"}` : "";
  toggleButton.disabled = false;
  toggleButton.textContent = response.active ? "Stop inspecting" : "Start inspecting";
}

toggleButton.addEventListener("click", async () => {
  await askTab({ kind: "toggle-inspect" });
  await refreshStatus();
  window.close();
});

clearButton.addEventListener("click", async () => {
  try {
    const all = await chrome.storage.local.get(null);
    const keys = Object.keys(all).filter((key) => key.startsWith(ANNOTATION_PREFIX));
    if (keys.length) await chrome.storage.local.remove(keys);
    clearButton.textContent = `Cleared ${keys.length} page${keys.length === 1 ? "" : "s"}`;
  } catch {
    clearButton.textContent = "Could not clear";
  }
  await refreshStatus();
});

void loadSettings();
void refreshStatus();
