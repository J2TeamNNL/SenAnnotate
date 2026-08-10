// =============================================================================
// Bridge client — ISOLATED world side of the postMessage RPC
// =============================================================================

import {
  BRIDGE_REQUEST,
  BRIDGE_RESPONSE,
  PROBE_ATTR,
  isBridgeEnvelope,
  isBridgeEventMessage,
  type BridgeRequest,
  type BridgeResult,
} from "../shared/protocol";
import type {
  ComponentDetectionMode,
  Diagnostics,
  PageVueInfo,
  VueElementInfo,
} from "../shared/types";

const TIMEOUT_MS = 500;

let nextId = 1;
const pending = new Map<number, (result: BridgeResult | null) => void>();

let diagnosticsListener: ((diagnostics: Diagnostics) => void) | null = null;

/** Subscribe to pushed diagnostics snapshots. */
export function onDiagnostics(listener: (diagnostics: Diagnostics) => void): void {
  diagnosticsListener = listener;
}

window.addEventListener("message", (event: MessageEvent) => {
  if (event.source !== window) return;

  if (isBridgeEventMessage(event.data)) {
    if (event.data.payload?.kind === "diagnostics") {
      diagnosticsListener?.(event.data.payload.diagnostics);
    }
    return;
  }

  if (!isBridgeEnvelope<BridgeResult>(event.data, BRIDGE_RESPONSE)) return;

  const resolve = pending.get(event.data.id);
  if (!resolve) return;
  pending.delete(event.data.id);
  resolve(event.data.payload);
});

/**
 * Send a request to the MAIN-world inspector.
 *
 * Resolves to `null` if nothing answers in time — which is the normal outcome on
 * a page where the inspector could not load. Callers degrade rather than fail.
 */
function send(payload: BridgeRequest): Promise<BridgeResult | null> {
  return new Promise((resolve) => {
    const id = nextId++;
    let settled = false;

    const finish = (result: BridgeResult | null) => {
      if (settled) return;
      settled = true;
      pending.delete(id);
      resolve(result);
    };

    pending.set(id, finish);
    window.setTimeout(() => finish(null), TIMEOUT_MS);
    window.postMessage({ channel: BRIDGE_REQUEST, id, payload }, "*");
  });
}

// -----------------------------------------------------------------------------
// Typed wrappers
// -----------------------------------------------------------------------------

export async function detectPage(): Promise<PageVueInfo | null> {
  const result = await send({ kind: "detect" });
  return result?.kind === "detect" ? result.page : null;
}

// -----------------------------------------------------------------------------
// Probe attribute
// -----------------------------------------------------------------------------
//
// DOM nodes cannot travel over postMessage, so an element is stamped with a
// one-shot attribute the inspector resolves by selector.
//
// Two lookups can be in flight on the same element at once — a hover lookup and
// the capture triggered by clicking it. They are reference-counted and share one
// id, so the second call cannot overwrite the first call's stamp and the first
// call's cleanup cannot pull the attribute out from under the second.

let probeCounter = 0;
const probeIds = new WeakMap<Element, string>();
const probeDepth = new WeakMap<Element, number>();

function acquireProbe(element: Element): string {
  let id = probeIds.get(element);
  if (!id) {
    id = `p${probeCounter++}`;
    probeIds.set(element, id);
  }
  probeDepth.set(element, (probeDepth.get(element) ?? 0) + 1);
  element.setAttribute(PROBE_ATTR, id);
  return id;
}

function releaseProbe(element: Element): void {
  const remaining = (probeDepth.get(element) ?? 1) - 1;
  if (remaining > 0) {
    probeDepth.set(element, remaining);
    return;
  }
  probeDepth.delete(element);
  element.removeAttribute(PROBE_ATTR);
}

/** Ask the inspector about an element. */
export async function inspectElement(
  element: Element,
  mode: ComponentDetectionMode,
  maxComponents: number,
  includeProps: boolean,
): Promise<VueElementInfo | null> {
  if (mode === "off") return null;

  const probeId = acquireProbe(element);
  try {
    const result = await send({ kind: "inspect", probeId, mode, maxComponents, includeProps });
    return result?.kind === "inspect" ? result.info : null;
  } finally {
    releaseProbe(element);
  }
}

export async function setFrozen(value: boolean): Promise<void> {
  await send({ kind: value ? "freeze" : "unfreeze" });
}

export async function fetchDiagnostics(): Promise<Diagnostics | null> {
  const result = await send({ kind: "diagnostics" });
  return result?.kind === "diagnostics" ? result.diagnostics : null;
}

export async function clearDiagnostics(): Promise<void> {
  await send({ kind: "clear-diagnostics" });
}
