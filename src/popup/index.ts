// =============================================================================
// Extension popup — status and settings
// =============================================================================

import { exportAll, importAll } from "../shared/archive";
import { generateSessionOutput } from "../shared/output";
import {
  ANNOTATION_PREFIX,
  SETTINGS_KEY,
  type RuntimeMessage,
  type RuntimeResponse,
} from "../shared/protocol";
import {
  DEFAULT_SETTINGS,
  OUTPUT_DETAIL_OPTIONS,
  type Annotation,
  type ComponentDetectionMode,
  type OutputDetailLevel,
  type ScreenshotDelivery,
  type Settings,
  type ThemePreference,
} from "../shared/types";

const COMPONENT_OPTIONS: { value: ComponentDetectionMode; label: string }[] = [
  { value: "filtered", label: "Skip framework plumbing" },
  { value: "smart", label: "Only names matching the DOM" },
  { value: "all", label: "Every component" },
  { value: "off", label: "Off (fastest)" },
];

const SCREENSHOT_OPTIONS: { value: ScreenshotDelivery; label: string }[] = [
  { value: "path", label: "Link to the saved file" },
  { value: "embed", label: "Embed in the report" },
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
const shotSelect = $<HTMLSelectElement>("shot");
const themeSelect = $<HTMLSelectElement>("theme");
const clearButton = $<HTMLButtonElement>("clear");
const pagesBox = $("pages");
const copySessionButton = $<HTMLButtonElement>("copy-session");
const exportButton = $<HTMLButtonElement>("export");
const importButton = $<HTMLButtonElement>("import");
const importInput = $<HTMLInputElement>("import-file");
const archiveHint = $("archive-hint");

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
fill(shotSelect, SCREENSHOT_OPTIONS);
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
  shotSelect.value = settings.screenshotDelivery;
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
shotSelect.addEventListener("change", () =>
  void patch({ screenshotDelivery: shotSelect.value as ScreenshotDelivery }),
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

// -----------------------------------------------------------------------------
// The session — every page that holds notes
// -----------------------------------------------------------------------------
//
// A tester walking a checkout flow annotates four screens, and until now had to
// visit each one again to copy four reports and paste them together by hand. The
// data was always here; only the button was missing.

let sessionPages: { page: string; annotations: Annotation[] }[] = [];

async function refreshPages(): Promise<void> {
  try {
    sessionPages = (await exportAll()).pages;
  } catch {
    sessionPages = [];
  }

  pagesBox.replaceChildren();
  copySessionButton.disabled = sessionPages.length === 0;

  if (!sessionPages.length) {
    const empty = document.createElement("div");
    empty.className = "page-row page-row__origin";
    empty.textContent = "No annotations stored yet.";
    pagesBox.append(empty);
    return;
  }

  for (const entry of sessionPages) {
    // The stored key is `https://host/path`. Split it so the path — the part that
    // identifies the screen — gets the width, and the origin stays legible but small.
    let origin = "";
    let path = entry.page;
    try {
      const url = new URL(entry.page);
      origin = url.host;
      path = url.pathname;
    } catch {
      // A key from an exotic scheme; show it whole rather than guessing.
    }

    const row = document.createElement("div");
    row.className = "page-row";

    const label = document.createElement("span");
    label.className = "page-row__path";
    label.textContent = path;
    label.title = entry.page;

    const host = document.createElement("span");
    host.className = "page-row__origin";
    host.textContent = origin;

    const count = document.createElement("span");
    count.className = "page-row__count";
    count.textContent = String(entry.annotations.length);

    row.append(label, host, count);
    pagesBox.append(row);
  }
}

copySessionButton.addEventListener("click", async () => {
  const markdown = generateSessionOutput(sessionPages, settings.detailLevel);
  if (!markdown) return;

  try {
    await navigator.clipboard.writeText(markdown);
    const notes = sessionPages.reduce((total, entry) => total + entry.annotations.length, 0);
    copySessionButton.textContent = `Copied ${notes} note${notes === 1 ? "" : "s"}`;
  } catch {
    copySessionButton.textContent = "Copy failed";
  }
});

// -----------------------------------------------------------------------------
// Export / import
// -----------------------------------------------------------------------------
//
// Reported in the hint line rather than an alert: the popup closes the moment focus
// leaves it, and an alert would take the focus with it.

function reportArchive(message: string, tone: "ok" | "error" = "ok"): void {
  archiveHint.textContent = message;
  archiveHint.dataset.tone = tone;
}

exportButton.addEventListener("click", async () => {
  try {
    const file = await exportAll();
    if (!file.pages.length) {
      reportArchive("Nothing to export yet.", "error");
      return;
    }

    // Blob + `<a download>`, the same permission-free route the screenshot takes.
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `senannotate-${file.exportedAt.slice(0, 10)}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);

    const notes = file.pages.reduce((total, entry) => total + entry.annotations.length, 0);
    reportArchive(`Exported ${notes} note${notes === 1 ? "" : "s"} from ${file.pages.length} page${file.pages.length === 1 ? "" : "s"}.`);
  } catch {
    reportArchive("Could not export.", "error");
  }
});

importButton.addEventListener("click", () => importInput.click());

importInput.addEventListener("change", async () => {
  const file = importInput.files?.[0];
  if (!file) return;

  try {
    const summary = await importAll(JSON.parse(await file.text()));
    if (!summary) {
      reportArchive("That is not a SenAnnotate export.", "error");
      return;
    }
    const skipped = summary.skipped ? `, ${summary.skipped} skipped` : "";
    reportArchive(
      `Imported ${summary.annotations} note${summary.annotations === 1 ? "" : "s"} across ${summary.pages} page${summary.pages === 1 ? "" : "s"}${skipped}.`,
    );
  } catch {
    reportArchive("Could not read that file.", "error");
  } finally {
    // Same file twice in a row would not fire `change` without this.
    importInput.value = "";
    await refreshStatus();
  }
});

clearButton.addEventListener("click", async () => {
  try {
    const all = await chrome.storage.local.get(null);
    const keys = Object.keys(all).filter((key) => key.startsWith(ANNOTATION_PREFIX));
    if (keys.length) await chrome.storage.local.remove(keys);
    clearButton.textContent = `Cleared ${keys.length} page${keys.length === 1 ? "" : "s"}`;
    await refreshPages();
  } catch {
    clearButton.textContent = "Could not clear";
  }
  await refreshStatus();
});

void loadSettings();
void refreshStatus();
void refreshPages();
