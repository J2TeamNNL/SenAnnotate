// =============================================================================
// The shareable review — every annotation as one self-contained HTML file
// =============================================================================
//
// The Markdown report is written for an agent, and the JSON export is written for
// another copy of this extension. Neither is written for a person who has neither:
// a designer signing off, a PM reading on a phone, anyone outside the repo. That
// reader wants to *look* at what was reported, and the screenshots are the report.
//
// So: one file, no external references, opens anywhere. Screenshots are already
// `data:` URIs when the delivery setting is `embed`, so the whole thing is built
// from what storage already holds — nothing is fetched and no file is read.
//
// This is the only module in the project that produces HTML from page-derived
// strings. `ui/dom.ts` offers `text` and deliberately no `html` precisely so that
// the overlay can never grow an injection sink; this file is the exception, and it
// pays for it with `esc()` on every single interpolation. There is no shortcut here
// for "this field is safe" — an element name is scraped off someone else's page.
// =============================================================================

import type { ExportFile } from "./archive";
import { formatSource } from "./output";
import { isDone, kindOf, type Annotation } from "./types";

/**
 * Escape for text and for a double-quoted attribute in one pass.
 *
 * `&` first or it would double-escape the entities the others introduce.
 */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * `data:` URIs only.
 *
 * A screenshot that is a *path* names a file on the annotator's machine, which the
 * recipient does not have; rendering it as an `<img>` would show a broken icon in a
 * document whose whole point is that it always renders. The path is still printed —
 * as text, for the developer who does have the file.
 */
function isEmbeddable(value: string | undefined): value is string {
  return typeof value === "string" && value.startsWith("data:image/");
}

function row(label: string, value: string): string {
  return `<div class="row"><span class="row__label">${esc(label)}</span><span class="row__value">${esc(value)}</span></div>`;
}

function renderAnnotation(annotation: Annotation, number: number): string {
  const kind = kindOf(annotation);
  const done = isDone(annotation);
  const parts: string[] = [];

  parts.push(
    `<header class="note__head">` +
      `<span class="note__number">${number}</span>` +
      `<h3 class="note__title">${esc(annotation.element)}</h3>` +
      `<span class="chip chip--${esc(kind)}">${esc(kind)}</span>` +
      (done ? `<span class="chip chip--done">fixed</span>` : "") +
      `</header>`,
  );

  parts.push(`<p class="note__comment">${esc(annotation.comment)}</p>`);

  const source = formatSource(annotation.source);
  const meta: string[] = [];
  if (source) meta.push(row("Source", source));
  if (annotation.framework?.path) meta.push(row("Components", annotation.framework.path));
  if (annotation.frame) meta.push(row("Frame", annotation.frame.label));
  meta.push(row("Location", annotation.elementPath));
  if (annotation.selectedText) meta.push(row("Selected text", `"${annotation.selectedText}"`));
  parts.push(`<div class="note__meta">${meta.join("")}</div>`);

  if (isEmbeddable(annotation.screenshotData)) {
    parts.push(
      `<img class="note__shot" src="${esc(annotation.screenshotData)}" alt="${esc(annotation.element)}" loading="lazy" />`,
    );
  } else {
    const path = annotation.screenshotPath ?? annotation.screenshot;
    if (path) {
      parts.push(
        `<p class="note__shot-missing">Screenshot saved as <code>${esc(path)}</code> on the reporter's machine — not embedded.</p>`,
      );
    }
  }

  return `<article class="note${done ? " note--done" : ""}">${parts.join("")}</article>`;
}

function renderPage(entry: { page: string; annotations: Annotation[] }): string {
  const notes = entry.annotations.map((annotation, index) => renderAnnotation(annotation, index + 1));
  return (
    `<section class="page">` +
    `<h2 class="page__title">${esc(entry.page)}</h2>` +
    notes.join("") +
    `</section>`
  );
}

/**
 * Everything the recipient's browser needs, inline.
 *
 * Both colour schemes, because there is no settings surface in a file someone was
 * emailed — it follows their system and that is the end of it. No script at all: a
 * document that arrives by email and runs nothing is one nobody has to trust.
 */
const STYLES = `
:root { color-scheme: light dark; --bg: #ffffff; --card: #f7f8fa; --fg: #1c2530; --muted: #64748b; --line: rgba(20,30,45,0.12); --accent: #ea580c; }
@media (prefers-color-scheme: dark) {
  :root { --bg: #0d1117; --card: #161b22; --fg: #e6edf3; --muted: #8b949e; --line: rgba(240,246,252,0.14); --accent: #f97316; }
}
* { box-sizing: border-box; }
body { margin: 0; padding: 32px 20px 64px; background: var(--bg); color: var(--fg); font: 15px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
main { max-width: 820px; margin: 0 auto; }
h1 { margin: 0 0 4px; font-size: 22px; }
.sub { margin: 0 0 32px; color: var(--muted); font-size: 13px; }
.page__title { margin: 40px 0 12px; padding-bottom: 6px; border-bottom: 1px solid var(--line); font-size: 14px; font-weight: 600; color: var(--muted); word-break: break-all; }
.note { margin: 0 0 16px; padding: 16px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); }
.note--done { opacity: 0.62; }
.note__head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
.note__number { display: inline-flex; align-items: center; justify-content: center; min-width: 22px; height: 22px; padding: 0 6px; border-radius: 11px; background: var(--accent); color: #fff; font-size: 12px; font-weight: 700; }
.note__title { margin: 0; font-size: 15px; font-weight: 600; }
.chip { padding: 1px 7px; border-radius: 999px; border: 1px solid var(--line); color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
.chip--done { border-color: var(--accent); color: var(--accent); }
.note__comment { margin: 0 0 12px; white-space: pre-wrap; }
.note__meta { display: grid; gap: 3px; margin-bottom: 12px; font-size: 12.5px; }
.row { display: flex; gap: 8px; }
.row__label { flex: 0 0 96px; color: var(--muted); }
.row__value { word-break: break-word; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }
.note__shot { display: block; width: 100%; height: auto; border: 1px solid var(--line); border-radius: 8px; }
.note__shot-missing { margin: 0; color: var(--muted); font-size: 12.5px; }
code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }
footer { margin-top: 48px; color: var(--muted); font-size: 12px; text-align: center; }
`.trim();

/**
 * Build the document.
 *
 * Takes the same `ExportFile` the JSON export produces rather than reading storage
 * itself, so the two formats can never disagree about what "everything" is.
 */
export function buildShareHtml(file: ExportFile): string {
  const pages = file.pages.filter((entry) => entry.annotations.length > 0);
  const notes = pages.reduce((total, entry) => total + entry.annotations.length, 0);
  const when = file.exportedAt.slice(0, 10);
  const title = `SenAnnotate review — ${notes} note${notes === 1 ? "" : "s"}`;

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<title>${esc(title)}</title>`,
    `<style>${STYLES}</style>`,
    "</head>",
    "<body><main>",
    `<h1>${esc(title)}</h1>`,
    `<p class="sub">${pages.length} page${pages.length === 1 ? "" : "s"} · exported ${esc(when)}</p>`,
    pages.map(renderPage).join(""),
    "<footer>Generated by SenAnnotate. Screenshots are embedded; nothing is loaded from the network.</footer>",
    "</main></body>",
    "</html>",
  ].join("\n");
}
