// =============================================================================
// Markdown report generation
// =============================================================================
//
// The whole point of the extension. An agent reading this should never have to
// ask "which button?" — it gets the file, the component ancestry, and a selector
// it can grep for, in that order of usefulness.
// =============================================================================

import type {
  ActionEntry,
  Annotation,
  Diagnostics,
  OutputDetailLevel,
  PageFrameworkInfo,
  SourceRef,
} from "./types";

/** Rendered form for a report line: `src/components/Foo.vue:12:5`. */
export function formatSource(source: SourceRef | undefined | null): string | null {
  if (!source) return null;
  if (source.origin === "grep-handle") return `(no path — grep for \`[${source.file}]\`)`;
  if (source.line && source.column) return `${source.file}:${source.line}:${source.column}`;
  if (source.line) return `${source.file}:${source.line}`;
  return source.file;
}

function formatProps(props: Record<string, string> | undefined): string | null {
  if (!props) return null;
  const entries = Object.entries(props);
  if (!entries.length) return null;
  return entries.map(([key, value]) => `${key}=${value}`).join(", ");
}

function describeStack(page: PageFrameworkInfo | null): string | null {
  if (!page?.detected) return null;

  // The detector names itself, so adding a framework never means editing this.
  const label = page.flavour ?? page.framework ?? "detected";

  const bits = [page.version ? `${label} ${page.version}` : label];
  if (page.stateManager) bits.push(page.stateManager);
  if (!page.devMetadata) bits.push("production build — component metadata unavailable");
  return bits.join(" · ");
}

export interface OutputContext {
  pathname: string;
  href: string;
  page: PageFrameworkInfo | null;
  diagnostics?: Diagnostics | null;
  actions?: ActionEntry[];
}

/** `1240` → `+1.2s`. Relative time is what correlates a click with an error. */
function stamp(ms: number): string {
  return `+${(ms / 1000).toFixed(1)}s`;
}

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
    const verb = ACTION_VERB[action.kind];
    const detail = action.detail ? ` (${action.detail})` : "";
    lines.push(`${index + 1}. ${verb} ${action.target}${detail}  \`${stamp(action.at)}\``);
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

function renderDiagnostics(diagnostics: Diagnostics, detailLevel: OutputDetailLevel): string[] {
  const lines: string[] = [];
  const wantsStacks = detailLevel === "detailed" || detailLevel === "forensic";

  if (diagnostics.logs.length) {
    lines.push(`## Console errors (${diagnostics.logs.length})`, "");
    for (const log of diagnostics.logs) {
      const where = log.source ? ` — ${log.source}${log.line ? `:${log.line}` : ""}` : "";
      lines.push(`- \`${stamp(log.at)}\` **${LOG_LABEL[log.kind] ?? log.kind}:** ${log.message}${where}`);
      if (wantsStacks && log.stack) {
        lines.push("", "  ```", ...log.stack.split("\n").slice(0, 8).map((l) => `  ${l.trim()}`), "  ```");
      }
    }
    lines.push("");
  }

  if (diagnostics.network.length) {
    lines.push(`## Failed requests (${diagnostics.network.length})`, "");
    for (const request of diagnostics.network) {
      const status = request.status === 0 ? "failed" : String(request.status);
      const reason = request.statusText ? ` ${request.statusText}` : "";
      lines.push(
        `- \`${stamp(request.at)}\` **${status}**${reason} — ${request.method} ${request.url} (${request.durationMs}ms)`,
      );
    }
    lines.push("");
  }

  return lines;
}

export function generateOutput(
  annotations: Annotation[],
  context: OutputContext,
  detailLevel: OutputDetailLevel = "standard",
): string {
  if (!annotations.length) return "";

  const viewport = `${window.innerWidth}×${window.innerHeight}`;
  const lines: string[] = [];

  lines.push(`## Page feedback: ${context.pathname}`);

  if (detailLevel === "forensic") {
    lines.push("");
    lines.push("**Environment:**");
    lines.push(`- URL: ${context.href}`);
    const stack = describeStack(context.page);
    if (stack) lines.push(`- Stack: ${stack}`);
    if (context.page?.routePath) lines.push(`- Route: ${context.page.routePath}`);
    lines.push(`- Viewport: ${viewport}`);
    lines.push(`- Device pixel ratio: ${window.devicePixelRatio}`);
    lines.push(`- User agent: ${navigator.userAgent}`);
    lines.push(`- Captured: ${new Date().toISOString()}`);
    lines.push("");
    lines.push("---");
  } else if (detailLevel !== "compact") {
    const stack = describeStack(context.page);
    lines.push(
      stack ? `**Stack:** ${stack}  ·  **Viewport:** ${viewport}` : `**Viewport:** ${viewport}`,
    );
  }

  lines.push("");

  annotations.forEach((annotation, index) => {
    const number = index + 1;
    const source = formatSource(annotation.source);

    if (detailLevel === "compact") {
      const where = source ? ` (${source})` : "";
      const quoted = annotation.selectedText
        ? ` — re: "${truncate(annotation.selectedText, 30)}"`
        : "";
      lines.push(`${number}. **${annotation.element}**${where}: ${annotation.comment}${quoted}`);
      return;
    }

    lines.push(`### ${number}. ${annotation.element}`);

    if (detailLevel === "forensic") {
      if (annotation.isMultiSelect) {
        lines.push("*Multi-element selection — forensic detail is for the first element.*");
      }
      if (source) lines.push(`**Source:** ${source}`);
      if (annotation.framework?.path) lines.push(`**Components:** ${annotation.framework.path}`);
      if (annotation.framework?.ownerComponent) lines.push(`**Owner:** <${annotation.framework.ownerComponent}>`);
      const props = formatProps(annotation.framework?.props);
      if (props) lines.push(`**Props:** ${props}`);
      if (annotation.framework?.grepHandles.length) {
        lines.push(`**Grep handles:** ${annotation.framework.grepHandles.join(", ")}`);
      }
      lines.push(`**Selector:** \`${annotation.selector}\``);
      if (annotation.fullPath) lines.push(`**Full DOM path:** ${annotation.fullPath}`);
      if (annotation.cssClasses) lines.push(`**Classes:** ${annotation.cssClasses}`);
      if (annotation.boundingBox) lines.push(`**Position:** ${formatBox(annotation)}`);
      lines.push(
        `**Marker at:** ${annotation.x.toFixed(1)}% from left, ${Math.round(annotation.y)}px from top`,
      );
      if (annotation.selectedText) lines.push(`**Selected text:** "${annotation.selectedText}"`);
      if (annotation.nearbyText && !annotation.selectedText) {
        lines.push(`**Context:** ${truncate(annotation.nearbyText, 100)}`);
      }
      if (annotation.computedStyles) lines.push(`**Computed styles:** ${annotation.computedStyles}`);
      if (annotation.accessibility) lines.push(`**Accessibility:** ${annotation.accessibility}`);
      if (annotation.nearbyElements) lines.push(`**Nearby elements:** ${annotation.nearbyElements}`);
      if (annotation.screenshot) lines.push(`**Screenshot:** ${annotation.screenshot}`);
      lines.push(`**Feedback:** ${annotation.comment}`);
      lines.push("");
      return;
    }

    // standard + detailed
    if (source) lines.push(`**Source:** ${source}`);
    if (annotation.framework?.path) lines.push(`**Components:** ${annotation.framework.path}`);
    lines.push(`**Location:** ${annotation.elementPath}`);

    if (detailLevel === "detailed") {
      lines.push(`**Selector:** \`${annotation.selector}\``);
      const props = formatProps(annotation.framework?.props);
      if (props) lines.push(`**Props:** ${props}`);
      if (annotation.cssClasses) lines.push(`**Classes:** ${annotation.cssClasses}`);
      if (annotation.boundingBox) lines.push(`**Position:** ${formatBox(annotation)}`);
    }

    if (annotation.selectedText) lines.push(`**Selected text:** "${annotation.selectedText}"`);
    if (detailLevel === "detailed" && annotation.nearbyText && !annotation.selectedText) {
      lines.push(`**Context:** ${truncate(annotation.nearbyText, 100)}`);
    }
    if (annotation.screenshot) lines.push(`**Screenshot:** ${annotation.screenshot}`);

    lines.push(`**Feedback:** ${annotation.comment}`);
    lines.push("");
  });

  // ---------------------------------------------------------------------------
  // Diagnostics — appended so the annotations stay the headline
  // ---------------------------------------------------------------------------

  const actions = context.actions ?? [];
  const diagnostics = context.diagnostics;
  const logCount = diagnostics?.logs.length ?? 0;
  const requestCount = diagnostics?.network.length ?? 0;

  if (detailLevel === "compact") {
    // Compact stays one-line-per-thing, but silently dropping errors would be
    // the worst possible failure for a bug report — so summarise instead.
    const parts: string[] = [];
    if (logCount) parts.push(`${logCount} console error${logCount === 1 ? "" : "s"}`);
    if (requestCount) parts.push(`${requestCount} failed request${requestCount === 1 ? "" : "s"}`);
    if (parts.length) lines.push("", `_Also captured: ${parts.join(", ")} — switch off Compact to include them._`);
    return lines.join("\n").trim();
  }

  if (actions.length || logCount || requestCount) {
    lines.push("---", "");
    lines.push(...renderActions(actions));
    if (diagnostics) lines.push(...renderDiagnostics(diagnostics, detailLevel));
  }

  if (diagnostics?.unavailable) {
    lines.push(
      "_Console and network capture was not active on this page — reload with the extension enabled to collect them._",
    );
  }

  return lines.join("\n").trim();
}

function formatBox(annotation: Annotation): string {
  const box = annotation.boundingBox!;
  return `x:${Math.round(box.x)}, y:${Math.round(box.y)} (${Math.round(box.width)}×${Math.round(box.height)}px)`;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}
