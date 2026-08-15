// =============================================================================
// Export / import — annotations as a file
// =============================================================================
//
// Lives in `shared/` rather than `content/storage.ts` because the popup is the only
// surface that offers it: it is the one with a real document to hang an
// `<input type="file">` off, and the one that already thinks cross-page. It touches
// nothing but `chrome.storage.local` and the key prefix, both of which every world
// already agrees on.
// =============================================================================

import { ANNOTATION_PREFIX, NS } from "./protocol";
import type { Annotation } from "./types";

// Annotations could previously leave only as rendered Markdown on the clipboard —
// lossy and one-way. That left no backup before `Clear all`, no way to hand a review
// to a colleague, and no way to move one between machines (settings sync; annotations
// deliberately do not). A JSON round-trip answers all three.

export const EXPORT_FORMAT = `${NS}/annotations`;

export interface ExportFile {
  format: string;
  version: number;
  exportedAt: string;
  pages: { page: string; annotations: Annotation[] }[];
}

export interface ImportSummary {
  pages: number;
  annotations: number;
  /** Entries dropped for failing the shape check. */
  skipped: number;
  /** Pages whose origin was rewritten on the way in. */
  remapped: number;
}

export interface ImportOptions {
  /**
   * Rewrite every page's origin to this one — `https://shop.example` becomes
   * `http://localhost:3000`, path kept.
   *
   * Annotations are keyed on `origin + pathname`, which is right while one person
   * reviews one deployment and wrong the moment the file crosses a machine: a review
   * captured on staging imports into a key nobody's dev server will ever open, and
   * the notes look like they were lost. The paths are the part that survives the
   * move, so only the origin is replaced.
   */
  remapOrigin?: string;
}

export async function exportAll(): Promise<ExportFile> {
  const all = await chrome.storage.local.get(null);
  const pages = Object.entries(all)
    .filter(([key, value]) => key.startsWith(ANNOTATION_PREFIX) && Array.isArray(value))
    .map(([key, value]) => ({
      page: key.slice(ANNOTATION_PREFIX.length),
      annotations: value as Annotation[],
    }))
    .filter((entry) => entry.annotations.length > 0);

  return {
    format: EXPORT_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    pages,
  };
}

/**
 * Drop every page's annotations, and say how many pages that was.
 *
 * Deliberately not a `storage.local.clear()`: settings live in `sync`, but anything
 * else that ever lands in `local` is not ours to delete.
 */
export async function clearAllPages(): Promise<number> {
  try {
    const all = await chrome.storage.local.get(null);
    const keys = Object.keys(all).filter((key) => key.startsWith(ANNOTATION_PREFIX));
    if (keys.length) await chrome.storage.local.remove(keys);
    return keys.length;
  } catch {
    return 0;
  }
}

/**
 * The shape check every imported entry has to pass.
 *
 * Nothing here is an XSS guard — the UI has no HTML sink, by design (`ui/dom.ts`
 * offers `text` and deliberately no `html`). It is a *correctness* guard: an entry
 * without a `selector` throws inside `resolveElement`, and one without an `id`
 * collides with everything in the marker map.
 */
function looksLikeAnnotation(value: unknown): value is Annotation {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.comment === "string" &&
    typeof candidate.element === "string" &&
    typeof candidate.selector === "string"
  );
}

/**
 * Move a stored page key onto another origin, keeping its path.
 *
 * A key that will not parse as a URL is left exactly as it is: it came from a scheme
 * this build does not know about, and guessing where its path starts would be worse
 * than importing it where it was.
 */
function remap(page: string, origin: string | undefined): string {
  if (!origin) return page;
  try {
    const url = new URL(page);
    return `${origin}${url.pathname}`;
  } catch {
    return page;
  }
}

/**
 * Merge an export back in.
 *
 * Merge, never replace: importing the wrong file should not be able to destroy a
 * review in progress. Where an id exists on both sides the imported copy wins —
 * that file is what the user just asked for.
 */
export async function importAll(
  data: unknown,
  options: ImportOptions = {},
): Promise<ImportSummary | null> {
  if (typeof data !== "object" || data === null) return null;
  const file = data as Partial<ExportFile>;
  if (file.format !== EXPORT_FORMAT || !Array.isArray(file.pages)) return null;

  const summary: ImportSummary = { pages: 0, annotations: 0, skipped: 0, remapped: 0 };

  for (const entry of file.pages) {
    if (!entry || typeof entry.page !== "string" || !Array.isArray(entry.annotations)) {
      summary.skipped += 1;
      continue;
    }

    const page = remap(entry.page, options.remapOrigin);
    if (page !== entry.page) summary.remapped += 1;

    const incoming = entry.annotations.filter((annotation) => {
      const ok = looksLikeAnnotation(annotation);
      if (!ok) summary.skipped += 1;
      return ok;
    });
    if (!incoming.length) continue;

    const key = `${ANNOTATION_PREFIX}${page}`;
    const stored = await chrome.storage.local.get(key);
    const existing = Array.isArray(stored[key]) ? (stored[key] as Annotation[]) : [];

    const byId = new Map(existing.map((annotation) => [annotation.id, annotation]));
    for (const annotation of incoming) byId.set(annotation.id, annotation);

    await chrome.storage.local.set({ [key]: [...byId.values()] });
    summary.pages += 1;
    summary.annotations += incoming.length;
  }

  return summary;
}

