// =============================================================================
// Persistence
// =============================================================================
//
// Annotations are scoped to `origin + pathname` so that reloading the page you
// were reviewing brings your notes back, while navigating elsewhere starts clean.
// The query string is deliberately excluded — `?page=2` is the same screen.
//
// Settings go in `chrome.storage.sync` so they follow the user between machines;
// annotations stay in `local`, which has room for them.
// =============================================================================

import { ANNOTATION_PREFIX, SETTINGS_KEY } from "../shared/protocol";
import { DEFAULT_SETTINGS, type Annotation, type Settings } from "../shared/types";

export function pageKey(): string {
  return `${ANNOTATION_PREFIX}${location.origin}${location.pathname}`;
}

// -----------------------------------------------------------------------------
// Annotations
// -----------------------------------------------------------------------------

export async function loadAnnotations(): Promise<Annotation[]> {
  try {
    const key = pageKey();
    const stored = await chrome.storage.local.get(key);
    const value = stored[key];
    return Array.isArray(value) ? (value as Annotation[]) : [];
  } catch {
    // Extension context invalidated (a reload while the page was open).
    return [];
  }
}

export async function saveAnnotations(annotations: Annotation[]): Promise<void> {
  try {
    const key = pageKey();
    if (!annotations.length) await chrome.storage.local.remove(key);
    else await chrome.storage.local.set({ [key]: annotations });
  } catch {
    // Nothing useful to do — the in-memory list is still intact.
  }
}

/** Every page that currently holds annotations, for the popup's overview. */
export async function listAnnotatedPages(): Promise<{ page: string; count: number }[]> {
  try {
    const all = await chrome.storage.local.get(null);
    return Object.entries(all)
      .filter(([key, value]) => key.startsWith(ANNOTATION_PREFIX) && Array.isArray(value))
      .map(([key, value]) => ({
        page: key.slice(ANNOTATION_PREFIX.length),
        count: (value as Annotation[]).length,
      }))
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.count - a.count);
  } catch {
    return [];
  }
}

export async function clearAllPages(): Promise<void> {
  try {
    const all = await chrome.storage.local.get(null);
    const keys = Object.keys(all).filter((key) => key.startsWith(ANNOTATION_PREFIX));
    if (keys.length) await chrome.storage.local.remove(keys);
  } catch {
    // ignore
  }
}

// -----------------------------------------------------------------------------
// Settings
// -----------------------------------------------------------------------------

export async function loadSettings(): Promise<Settings> {
  try {
    const stored = await chrome.storage.sync.get(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...((stored[SETTINGS_KEY] as Partial<Settings>) ?? {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  try {
    await chrome.storage.sync.set({ [SETTINGS_KEY]: settings });
  } catch {
    // sync is disabled or over quota; the session keeps working with in-memory values
  }
}

/** Fires whenever settings change, including from the extension popup. */
export function onSettingsChanged(callback: (settings: Settings) => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || !changes[SETTINGS_KEY]) return;
    callback({ ...DEFAULT_SETTINGS, ...((changes[SETTINGS_KEY].newValue as Partial<Settings>) ?? {}) });
  });
}
