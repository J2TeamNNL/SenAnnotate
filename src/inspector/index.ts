// =============================================================================
// MAIN-world entry point
// =============================================================================
//
// Runs at `document_start`, before Vue has mounted, so it must not snapshot
// anything at load. It is purely reactive: it sits on the bridge and answers.
//
// Declaring `world: "MAIN"` in the manifest (rather than injecting a <script> tag
// at runtime) matters — declarative content scripts are exempt from the page's
// own CSP, so this still works on apps with a strict `script-src`.
// =============================================================================

import {
  BRIDGE_EVENT,
  BRIDGE_REQUEST,
  BRIDGE_RESPONSE,
  PROBE_ATTR,
  isBridgeEnvelope,
  type BridgeEvent,
  type BridgeRequest,
  type BridgeResult,
} from "../shared/protocol";
import {
  clearDiagnostics,
  installDiagnostics,
  readDiagnostics,
  setDiagnosticsListener,
} from "./diagnostics";
import { freeze, originalSetTimeout, unfreeze } from "./freeze";
import { detectPage, inspectElement } from "./detectors";

// Installed immediately, not on demand: this script runs at `document_start`, and
// the whole point is to be in place before the page's first request or first
// error. Waiting for the content script to ask would miss everything on load.
//
// Top frame only, and that is a correctness fix rather than an optimisation.
// Capture replaces `fetch`, `XMLHttpRequest.prototype.open/send` and `console.error`
// in the page's own heap, so a browser-integrity check that reads `fetch.toString()`
// sees tampering: a Cloudflare Turnstile widget, which renders in an iframe we were
// instrumenting, then refuses to verify and the user cannot get past the challenge.
//
// Nothing was gained for it. The ISOLATED side only ever reads this in the top frame —
// `onDiagnostics` and `fetchDiagnostics` are both inside `installTopFrame()`, and the
// child branch of `content/index.ts` says so itself: "no annotations, no diagnostics,
// no badge". Every iframe on every page was being patched for a buffer nobody read.
//
// `window.top === window` is an identity comparison, so it stays legal across origins.
// The rest of this file must still run in child frames: that is where `inspect` answers
// from, and it is the whole reason the frame is instrumented at all.
if (window.top === window) installDiagnostics();

function emit(payload: BridgeEvent): void {
  window.postMessage({ channel: BRIDGE_EVENT, payload }, "*");
}

// Coalesce bursts — an error loop can fire hundreds of times a second, and the
// content script only needs the latest snapshot. `originalSetTimeout` because the
// patched one is held back while animations are frozen.
let flushQueued = false;
setDiagnosticsListener(() => {
  if (flushQueued) return;
  flushQueued = true;
  originalSetTimeout(() => {
    flushQueued = false;
    emit({ kind: "diagnostics", diagnostics: readDiagnostics() });
  }, 250);
});

function respond(id: number, payload: BridgeResult): void {
  // "*" rather than the document origin: sandboxed iframes and file:// pages have
  // an opaque ("null") origin, which postMessage rejects as a target. Delivery is
  // still confined to this window, and the receiver checks `event.source`.
  window.postMessage({ channel: BRIDGE_RESPONSE, id, payload }, "*");
}

function handle(request: BridgeRequest): BridgeResult {
  switch (request.kind) {
    case "detect":
      return { kind: "detect", page: detectPage() };

    case "inspect": {
      // The content script stamped the element for us; it clears the attribute
      // as soon as this call returns.
      const element = document.querySelector(`[${PROBE_ATTR}="${CSS.escape(request.probeId)}"]`);
      if (!element) return { kind: "inspect", info: null };
      return {
        kind: "inspect",
        info: inspectElement(element, {
          mode: request.mode,
          maxComponents: request.maxComponents,
          includeProps: request.includeProps,
        }),
      };
    }

    case "freeze":
      freeze();
      return { kind: "ack" };

    case "unfreeze":
      unfreeze();
      return { kind: "ack" };

    case "diagnostics":
      return { kind: "diagnostics", diagnostics: readDiagnostics() };

    case "clear-diagnostics":
      clearDiagnostics();
      return { kind: "ack" };
  }
}

window.addEventListener("message", (event: MessageEvent) => {
  // Only same-window traffic on our channel; ignore anything cross-origin.
  if (event.source !== window) return;
  if (!isBridgeEnvelope<BridgeRequest>(event.data, BRIDGE_REQUEST)) return;

  const { id, payload } = event.data;
  try {
    respond(id, handle(payload));
  } catch (error) {
    console.warn("[senannotate] inspector failed:", error);
    respond(id, { kind: "ack" });
  }
});
