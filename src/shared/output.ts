// =============================================================================
// The Markdown report
// =============================================================================
//
// The product's actual output. An agent reading it should never need to ask "which
// button?", so the ordering is by usefulness, not by what was easiest to collect:
// source location first, then the component chain, then a selector to grep for.
//
// Four detail levels, each a superset of the last:
//
//   compact   one line per note — for a quick "these three things"
//   standard  + source, component chain, location            (the default)
//   detailed  + selector, props, classes, box, context
//   forensic  + environment, full DOM path, computed styles, a11y, neighbours
//
// Diagnostics (console errors, failed requests, repro steps) are appended after the
// annotations, so the thing the person actually pointed at stays the headline.
// =============================================================================

import type {
  ActionEntry,
  Annotation,
  Diagnostics,
  OutputDetailLevel,
  PageFrameworkInfo,
  SourceRef,
} from "./types";

export interface OutputContext {
  pathname: string;
  href: string;
  page: PageFrameworkInfo | null;
  diagnostics?: Diagnostics | null;
  actions?: ActionEntry[];
}

// -----------------------------------------------------------------------------
// Small formatters
// -----------------------------------------------------------------------------

/** `src/components/Foo.vue:12:5`, or a grep hint when there is no path at all. */
export function formatSource(source: SourceRef | undefined | null): string | null {
  if (!source) return null;
  if (source.origin === "grep-handle") return `(no path — grep for \`[${source.file}]\`)`;

  const line = source.line ? `:${source.line}` : "";
  const column = source.line && source.column ? `:${source.column}` : "";
  return `${source.file}${line}${column}`;
}

function formatProps(props: Record<string, string> | undefined): string | null {
  const entries = Object.entries(props ?? {});
  if (!entries.length) return null;
  return entries.map(([key, value]) => `${key}=${value}`).join(", ");
}

/** `1240` → `+1.2s`. Relative time is what correlates a click with an error. */
function stamp(ms: number): string {
  return `+${(ms / 1000).toFixed(1)}s`;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function formatBox(annotation: Annotation): string {
  const box = annotation.boundingBox;
  if (!box) return "";
  const round = Math.round;
  return `x:${round(box.x)}, y:${round(box.y)} (${round(box.width)}×${round(box.height)}px)`;
}

/**
 * One line describing the framework, or null when none was detected.
 *
 * The label comes from the detector, never from a mapping here — that is what keeps
 * adding a framework to one file.
 */
function describeStack(page: PageFrameworkInfo | null): string | null {
  if (!page?.detected) return null;

  const label = page.flavour ?? page.framework ?? "detected";
  const parts = [page.version ? `${label} ${page.version}` : label];
  if (page.stateManager) parts.push(page.stateManager);
  if (!page.devMetadata) parts.push("production build — component metadata unavailable");
  return parts.join(" · ");
}

// -----------------------------------------------------------------------------
// Header
// -----------------------------------------------------------------------------

function renderHeader(context: OutputContext, detail: OutputDetailLevel): string[] {
  const viewport = `${window.innerWidth}×${window.innerHeight}`;
  const stack = describeStack(context.page);
  const lines = [`## Page feedback: ${context.pathname}`];

  if (detail === "forensic") {
    lines.push("", "**Environment:**", `- URL: ${context.href}`);
    if (stack) lines.push(`- Stack: ${stack}`);
    if (context.page?.routePath) lines.push(`- Route: ${context.page.routePath}`);
    lines.push(
      `- Viewport: ${viewport}`,
      `- Device pixel ratio: ${window.devicePixelRatio}`,
      `- User agent: ${navigator.userAgent}`,
      `- Captured: ${new Date().toISOString()}`,
      "",
      "---",
    );
  } else if (detail !== "compact") {
    // Omitted entirely rather than saying "not detected": on a page with no framework
    // that line is noise in every single report.
    lines.push(stack ? `**Stack:** ${stack}  ·  **Viewport:** ${viewport}` : `**Viewport:** ${viewport}`);
  }

  lines.push("");
  return lines;
}

// -----------------------------------------------------------------------------
// Annotations
// -----------------------------------------------------------------------------

function renderCompact(annotation: Annotation, number: number): string {
  const source = formatSource(annotation.source);
  const where = source ? ` (${source})` : "";
  const quoted = annotation.selectedText ? ` — re: "${truncate(annotation.selectedText, 30)}"` : "";
  return `${number}. **${annotation.element}**${where}: ${annotation.comment}${quoted}`;
}

function renderAnnotation(
  annotation: Annotation,
  number: number,
  detail: OutputDetailLevel,
): string[] {
  const lines = [`### ${number}. ${annotation.element}`];
  const source = formatSource(annotation.source);
  const wantsDetail = detail === "detailed" || detail === "forensic";
  const wantsForensic = detail === "forensic";

  if (wantsForensic && annotation.isMultiSelect) {
    lines.push("*Multi-element selection — forensic detail is for the first element.*");
  }

  // Most useful first.
  if (source) lines.push(`**Source:** ${source}`);
  if (annotation.framework?.path) lines.push(`**Components:** ${annotation.framework.path}`);
  if (wantsForensic && annotation.framework?.ownerComponent) {
    lines.push(`**Owner:** <${annotation.framework.ownerComponent}>`);
  }

  const props = formatProps(annotation.framework?.props);
  if (wantsDetail && props) lines.push(`**Props:** ${props}`);
  if (wantsForensic && annotation.framework?.grepHandles.length) {
    lines.push(`**Grep handles:** ${annotation.framework.grepHandles.join(", ")}`);
  }

  // Forensic replaces the short Location line with a selector and the full path.
  if (wantsForensic) {
    lines.push(`**Selector:** \`${annotation.selector}\``);
    if (annotation.fullPath) lines.push(`**Full DOM path:** ${annotation.fullPath}`);
  } else {
    lines.push(`**Location:** ${annotation.elementPath}`);
    if (detail === "detailed") lines.push(`**Selector:** \`${annotation.selector}\``);
  }

  if (wantsDetail && annotation.cssClasses) lines.push(`**Classes:** ${annotation.cssClasses}`);
  if (wantsDetail && annotation.boundingBox) lines.push(`**Position:** ${formatBox(annotation)}`);
  if (wantsForensic) {
    lines.push(
      `**Marker at:** ${annotation.x.toFixed(1)}% from left, ${Math.round(annotation.y)}px from top`,
    );
  }

  if (annotation.selectedText) lines.push(`**Selected text:** "${annotation.selectedText}"`);
  // Context duplicates the quoted selection, so it is skipped when there is one.
  if (wantsDetail && annotation.nearbyText && !annotation.selectedText) {
    lines.push(`**Context:** ${truncate(annotation.nearbyText, 100)}`);
  }

  if (wantsForensic) {
    if (annotation.computedStyles) lines.push(`**Computed styles:** ${annotation.computedStyles}`);
    if (annotation.accessibility) lines.push(`**Accessibility:** ${annotation.accessibility}`);
    if (annotation.nearbyElements) lines.push(`**Nearby elements:** ${annotation.nearbyElements}`);
  } else if (detail === "detailed" && annotation.computedStyles) {
    lines.push(`**Computed styles:** ${annotation.computedStyles}`);
  }

  if (annotation.screenshot) lines.push(`**Screenshot:** ${annotation.screenshot}`);
  lines.push(`**Feedback:** ${annotation.comment}`, "");
  return lines;
}

// -----------------------------------------------------------------------------
// Diagnostics
// -----------------------------------------------------------------------------

const ACTION_VERB: Record<ActionEntry["kind"], string> = {
  click: "Clicked",
  input: "Edited",
  submit: "Submitted",
  key: "Pressed",
  navigate: "Navigated to",
};

function renderActions(actions: ActionEntry[]): string[] {
  if (!actions.length) return [];

  const lines = ["## Steps to reproduce", ""];
  actions.forEach((action, index) => {
    const detail = action.detail ? ` (${action.detail})` : "";
    lines.push(
      `${index + 1}. ${ACTION_VERB[action.kind]} ${action.target}${detail}  \`${stamp(action.at)}\``,
    );
  });
  lines.push("");
  return lines;
}

const LOG_LABEL: Record<string, string> = {
  error: "Uncaught",
  rejection: "Unhandled rejection",
  console: "console.error",
  resource: "Resource",
};

function renderLogs(logs: Diagnostics["logs"], withStacks: boolean): string[] {
  if (!logs.length) return [];

  const lines = [`## Console errors (${logs.length})`, ""];
  for (const log of logs) {
    const where = log.source ? ` — ${log.source}${log.line ? `:${log.line}` : ""}` : "";
    lines.push(`- \`${stamp(log.at)}\` **${LOG_LABEL[log.kind] ?? log.kind}:** ${log.message}${where}`);

    if (withStacks && log.stack) {
      // Eight frames is enough to place the throw without burying the report.
      const frames = log.stack.split("\n").slice(0, 8).map((frame) => `  ${frame.trim()}`);
      lines.push("", "  ```", ...frames, "  ```");
    }
  }
  lines.push("");
  return lines;
}

function renderNetwork(network: Diagnostics["network"]): string[] {
  if (!network.length) return [];

  const lines = [`## Failed requests (${network.length})`, ""];
  for (const request of network) {
    const status = request.status === 0 ? "failed" : String(request.status);
    const reason = request.statusText ? ` ${request.statusText}` : "";
    lines.push(
      `- \`${stamp(request.at)}\` **${status}**${reason} — ${request.method} ${request.url} (${request.durationMs}ms)`,
    );
  }
  lines.push("");
  return lines;
}

// -----------------------------------------------------------------------------
// Entry point
// -----------------------------------------------------------------------------

export function generateOutput(
  annotations: Annotation[],
  context: OutputContext,
  detailLevel: OutputDetailLevel = "standard",
): string {
  if (!annotations.length) return "";

  const lines = renderHeader(context, detailLevel);

  annotations.forEach((annotation, index) => {
    if (detailLevel === "compact") lines.push(renderCompact(annotation, index + 1));
    else lines.push(...renderAnnotation(annotation, index + 1, detailLevel));
  });

  const actions = context.actions ?? [];
  const diagnostics = context.diagnostics;
  const logCount = diagnostics?.logs.length ?? 0;
  const requestCount = diagnostics?.network.length ?? 0;

  if (detailLevel === "compact") {
    // Compact stays one line per thing, but silently dropping captured errors would be
    // the worst possible failure for a bug report — so it says what it is withholding.
    const withheld: string[] = [];
    if (logCount) withheld.push(`${logCount} console error${logCount === 1 ? "" : "s"}`);
    if (requestCount) withheld.push(`${requestCount} failed request${requestCount === 1 ? "" : "s"}`);
    if (withheld.length) {
      lines.push("", `_Also captured: ${withheld.join(", ")} — switch off Compact to include them._`);
    }
    return lines.join("\n").trim();
  }

  if (actions.length || logCount || requestCount) {
    lines.push("---", "", ...renderActions(actions));
    if (diagnostics) {
      const withStacks = detailLevel === "detailed" || detailLevel === "forensic";
      lines.push(...renderLogs(diagnostics.logs, withStacks), ...renderNetwork(diagnostics.network));
    }
  }

  if (diagnostics?.unavailable) {
    lines.push(
      "_Console and network capture was not active on this page — reload with the extension enabled to collect them._",
    );
  }

  return lines.join("\n").trim();
}
