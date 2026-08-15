// =============================================================================
// Extension popup — status, pages, and the archive
// =============================================================================
//
// Settings used to live here and now live in the toolbar's settings card, next to the
// page they describe. What is left is the work that is genuinely *across* pages and has
// no home inside any one of them: which pages hold notes, the session report, and
// export/import.
//
// The popup still reads settings — it paints itself from `theme` and `accentColor` —
// but no longer writes any. One owner, one writer.
// =============================================================================

import { accentTheme } from "../shared/accent";
import { clearAllPages, exportAll, importAll, type ExportFile } from "../shared/archive";
import { generateSessionOutput } from "../shared/output";
import { buildShareHtml } from "../shared/share";
import { SETTINGS_KEY, type RuntimeMessage, type RuntimeResponse } from "../shared/protocol";
import { DEFAULT_SETTINGS, type Annotation, type Settings } from "../shared/types";

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const statusBox = $("status");
const statusText = $("status-text");
const statusCount = $("status-count");
const toggleButton = $<HTMLButtonElement>("toggle");
const clearButton = $<HTMLButtonElement>("clear");
const pagesBox = $("pages");
const copySessionButton = $<HTMLButtonElement>("copy-session");
const exportButton = $<HTMLButtonElement>("export");
const shareButton = $<HTMLButtonElement>("share");
const remapCheckbox = $<HTMLInputElement>("import-remap");
const importButton = $<HTMLButtonElement>("import");
const importInput = $<HTMLInputElement>("import-file");
const archiveHint = $("archive-hint");
/** Preset colour → its button, so the current one can be marked without a re-render. */

let settings: Settings = { ...DEFAULT_SETTINGS };



// -----------------------------------------------------------------------------
// Settings — read only
// -----------------------------------------------------------------------------

async function loadSettings(): Promise<void> {
  try {
    const stored = await chrome.storage.sync.get(SETTINGS_KEY);
    settings = { ...DEFAULT_SETTINGS, ...((stored[SETTINGS_KEY] as Partial<Settings>) ?? {}) };
  } catch {
    settings = { ...DEFAULT_SETTINGS };
  }

  applyAccent();
}

// -----------------------------------------------------------------------------
// Accent
// -----------------------------------------------------------------------------

/**
 * Recolour the popup itself.
 *
 * The popup is its own document with its own `--accent`, so it inherits nothing from the
 * overlay. It no longer *picks* the colour — the settings card does — but it still has
 * to wear it, or the accent you chose would stop at the edge of the page.
 */
function applyAccent(): void {
  const { accent, ink } = accentTheme(settings.accentColor);
  document.documentElement.style.setProperty("--accent", accent);
  document.documentElement.style.setProperty("--accent-ink", ink);
}

// -----------------------------------------------------------------------------
// Active tab
// -----------------------------------------------------------------------------

async function activeTabId(): Promise<number | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id ?? null;
}

/** The origin an import can be moved onto, or null on a tab that has no useful one. */
async function activeTabOrigin(): Promise<string | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    return new URL(tab?.url ?? "").origin;
  } catch {
    return null;
  }
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

/** Blob + `<a download>`, the same permission-free route the screenshot takes. */
function download(content: string, type: string, name: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function countNotes(file: ExportFile): number {
  return file.pages.reduce((total, entry) => total + entry.annotations.length, 0);
}

exportButton.addEventListener("click", async () => {
  try {
    const file = await exportAll();
    if (!file.pages.length) {
      reportArchive("Nothing to export yet.", "error");
      return;
    }

    const day = file.exportedAt.slice(0, 10);
    download(JSON.stringify(file, null, 2), "application/json", `senannotate-${day}.json`);

    const notes = countNotes(file);
    reportArchive(`Exported ${notes} note${notes === 1 ? "" : "s"} from ${file.pages.length} page${file.pages.length === 1 ? "" : "s"}.`);
  } catch {
    reportArchive("Could not export.", "error");
  }
});

// The reader of this one has no extension, so nothing about it is a round trip: it is
// the only export that is finished when it lands.
shareButton.addEventListener("click", async () => {
  try {
    const file = await exportAll();
    if (!file.pages.length) {
      reportArchive("Nothing to share yet.", "error");
      return;
    }

    const day = file.exportedAt.slice(0, 10);
    download(buildShareHtml(file), "text/html", `senannotate-review-${day}.html`);

    // Worth saying, because it is the difference between a review someone can read and
    // a list of filenames they cannot open — and it is fixed one setting away.
    const embedded = file.pages.some((entry) =>
      entry.annotations.some((annotation) => annotation.screenshotData),
    );
    const notes = countNotes(file);
    reportArchive(
      embedded
        ? `Saved ${notes} note${notes === 1 ? "" : "s"} with their screenshots.`
        : `Saved ${notes} note${notes === 1 ? "" : "s"}. No screenshots embedded — set Screenshots to embed before capturing.`,
    );
  } catch {
    reportArchive("Could not build the file.", "error");
  }
});

importButton.addEventListener("click", () => importInput.click());

importInput.addEventListener("change", async () => {
  const file = importInput.files?.[0];
  if (!file) return;

  try {
    const remapOrigin = remapCheckbox.checked ? ((await activeTabOrigin()) ?? undefined) : undefined;
    const summary = await importAll(JSON.parse(await file.text()), { remapOrigin });
    if (!summary) {
      reportArchive("That is not a SenAnnotate export.", "error");
      return;
    }
    const skipped = summary.skipped ? `, ${summary.skipped} skipped` : "";
    // Named rather than counted: which origin the notes landed on is the one thing a
    // remap can get wrong, and "3 pages moved" would not say.
    const moved = summary.remapped && remapOrigin ? `, moved onto ${remapOrigin}` : "";
    reportArchive(
      `Imported ${summary.annotations} note${summary.annotations === 1 ? "" : "s"} across ${summary.pages} page${summary.pages === 1 ? "" : "s"}${skipped}${moved}.`,
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
  const cleared = await clearAllPages();
  clearButton.textContent = `Cleared ${cleared} page${cleared === 1 ? "" : "s"}`;
  await refreshPages();
  await refreshStatus();
});

void loadSettings();
void refreshStatus();
void refreshPages();
