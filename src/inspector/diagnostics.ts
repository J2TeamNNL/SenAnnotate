// =============================================================================
// Diagnostics capture — MAIN world only
// =============================================================================
//
// This has to run in the page's own JS heap, and it has to run first:
//
//   - An isolated-world content script has its own `window`. Uncaught errors
//     thrown by page scripts never reach its `error` / `unhandledrejection`
//     handlers, so listening from there records nothing.
//   - Likewise `fetch` and `XMLHttpRequest`: patching the isolated world's copies
//     intercepts only our own traffic.
//
// The inspector content script is declared `run_at: document_start`, which is
// before any page script executes — so the patches below are in place for the
// very first request and the very first error.
//
// Two hard rules, because this output gets pasted into tickets:
//   1. Never capture request or response bodies.
//   2. Redact sensitive-looking query parameters from URLs.
// =============================================================================

import type { Diagnostics, LogEntry, NetworkEntry } from "../shared/types";

const MAX_LOGS = 60;
const MAX_NETWORK = 60;
/** Cap on any single stored string, so one giant stack cannot blow up storage. */
const MAX_TEXT = 2000;

const logs: LogEntry[] = [];
const network: NetworkEntry[] = [];

let installed = false;
const startedAt = Date.now();

function since(): number {
  return Date.now() - startedAt;
}

function truncate(value: string, max = MAX_TEXT): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

let onChange: (() => void) | null = null;

/** Notified after every recorded entry, so the content script can mirror state. */
export function setDiagnosticsListener(listener: () => void): void {
  onChange = listener;
}

function push<T>(buffer: T[], entry: T, max: number): void {
  buffer.push(entry);
  if (buffer.length > max) buffer.shift();
  try {
    onChange?.();
  } catch {
    // A broken listener must not stop us recording.
  }
}

// -----------------------------------------------------------------------------
// URL redaction
// -----------------------------------------------------------------------------

const SENSITIVE_PARAM = /^(.*(token|secret|password|passwd|signature|sig|apikey|api_key|auth|session|jwt|credential).*|key|code)$/i;

/**
 * Strip credential-ish query values. A bug report gets pasted into Jira, Slack
 * and PR descriptions, so a URL carrying a live session token would leak far
 * beyond the person who filed it.
 */
export function redactUrl(raw: string): string {
  try {
    const url = new URL(raw, location.href);
    let redacted = false;

    for (const key of Array.from(url.searchParams.keys())) {
      if (!SENSITIVE_PARAM.test(key)) continue;
      url.searchParams.set(key, "[redacted]");
      redacted = true;
    }

    // Same-origin URLs read better relative — that is how they appear in code.
    const text = url.origin === location.origin ? `${url.pathname}${url.search}` : url.href;
    return truncate(redacted ? text : text, 500);
  } catch {
    // Not a parseable URL (blob:, data:, or a relative string with no base).
    return truncate(raw.split("?")[0], 500);
  }
}

// -----------------------------------------------------------------------------
// Errors
// -----------------------------------------------------------------------------

function describe(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (value === null) return "null";
  if (value === undefined) return "undefined";

  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function installErrorCapture(): void {
  // capture:true so resource load failures (which do not bubble) are seen too.
  window.addEventListener(
    "error",
    (event: ErrorEvent) => {
      try {
        const target = event.target as (Element & { src?: string; href?: string }) | null;

        // A failed <img>/<script>/<link> fires `error` on the element, not window.
        if (target && target !== (window as unknown as EventTarget) && target.tagName) {
          const url = target.src || target.href;
          push(
            logs,
            {
              kind: "resource",
              message: `Failed to load <${target.tagName.toLowerCase()}>${url ? ` ${redactUrl(url)}` : ""}`,
              at: since(),
            },
            MAX_LOGS,
          );
          return;
        }

        push(
          logs,
          {
            kind: "error",
            message: truncate(event.message || describe(event.error)),
            stack: event.error?.stack ? truncate(String(event.error.stack)) : undefined,
            source: event.filename ? redactUrl(event.filename) : undefined,
            line: event.lineno || undefined,
            column: event.colno || undefined,
            at: since(),
          },
          MAX_LOGS,
        );
      } catch {
        // Diagnostics must never be the thing that breaks the page.
      }
    },
    true,
  );

  window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
    try {
      const reason = event.reason as { stack?: string } | undefined;
      push(
        logs,
        {
          kind: "rejection",
          message: truncate(describe(event.reason)),
          stack: reason?.stack ? truncate(String(reason.stack)) : undefined,
          at: since(),
        },
        MAX_LOGS,
      );
    } catch {
      // ignore
    }
  });

  // `console.error` is deliberate logging — often the only trace of an error the
  // app caught and handled. `console.warn` is skipped: Vue dev warnings would
  // drown out everything worth reading.
  const originalError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    try {
      push(
        logs,
        {
          kind: "console",
          message: truncate(args.map(describe).join(" ")),
          at: since(),
        },
        MAX_LOGS,
      );
    } catch {
      // ignore
    }
    originalError(...args);
  };
}

// -----------------------------------------------------------------------------
// Network
// -----------------------------------------------------------------------------

function recordRequest(entry: NetworkEntry): void {
  push(network, entry, MAX_NETWORK);
}

function installFetchCapture(): void {
  const originalFetch = window.fetch;
  if (typeof originalFetch !== "function") return;

  window.fetch = function patchedFetch(
    this: unknown,
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const start = Date.now();

    let method = "GET";
    let url = "";
    try {
      if (typeof input === "string") url = input;
      else if (input instanceof URL) url = input.href;
      else {
        url = input.url;
        method = input.method || method;
      }
      if (init?.method) method = init.method;
    } catch {
      // Fall through with whatever we managed to read.
    }

    return originalFetch.call(this as never, input as RequestInfo, init).then(
      (response) => {
        try {
          if (!response.ok) {
            recordRequest({
              method: method.toUpperCase(),
              url: redactUrl(url),
              status: response.status,
              statusText: response.statusText || undefined,
              durationMs: Date.now() - start,
              transport: "fetch",
              at: since(),
            });
          }
        } catch {
          // ignore
        }
        return response;
      },
      (error: unknown) => {
        try {
          recordRequest({
            method: method.toUpperCase(),
            url: redactUrl(url),
            status: 0,
            statusText: describe(error).slice(0, 120),
            durationMs: Date.now() - start,
            transport: "fetch",
            at: since(),
          });
        } catch {
          // ignore
        }
        throw error;
      },
    );
  } as typeof window.fetch;
}

interface TrackedXhr extends XMLHttpRequest {
  __senannotate?: { method: string; url: string; start: number };
}

function installXhrCapture(): void {
  const proto = XMLHttpRequest.prototype;
  const originalOpen = proto.open;
  const originalSend = proto.send;

  proto.open = function patchedOpen(this: TrackedXhr, method: string, url: string | URL, ...rest: unknown[]) {
    try {
      this.__senannotate = { method: String(method), url: String(url), start: 0 };
    } catch {
      // ignore
    }
    return (originalOpen as (...args: unknown[]) => void).call(this, method, url, ...rest);
  } as typeof proto.open;

  proto.send = function patchedSend(this: TrackedXhr, ...args: unknown[]) {
    const meta = this.__senannotate;
    if (meta) {
      meta.start = Date.now();
      this.addEventListener("loadend", () => {
        try {
          // status 0 means it never completed — network error, CORS, or abort.
          if (this.status !== 0 && this.status < 400) return;
          recordRequest({
            method: meta.method.toUpperCase(),
            url: redactUrl(meta.url),
            status: this.status,
            statusText: this.statusText || (this.status === 0 ? "network error or aborted" : undefined),
            durationMs: Date.now() - meta.start,
            transport: "xhr",
            at: since(),
          });
        } catch {
          // ignore
        }
      });
    }
    return (originalSend as (...args: unknown[]) => void).call(this, ...args);
  } as typeof proto.send;
}

// -----------------------------------------------------------------------------

export function installDiagnostics(): void {
  if (installed) return;
  installed = true;

  try {
    installErrorCapture();
    installFetchCapture();
    installXhrCapture();
  } catch (error) {
    console.warn("[senannotate] diagnostics capture failed to install:", error);
  }
}

export function readDiagnostics(): Diagnostics {
  return {
    logs: logs.slice(),
    network: network.slice(),
    unavailable: !installed,
  };
}

export function clearDiagnostics(): void {
  logs.length = 0;
  network.length = 0;
}
