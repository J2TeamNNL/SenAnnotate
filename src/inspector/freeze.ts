// =============================================================================
// Freeze motion — MAIN world, and (4) in the top frame only
// =============================================================================
//
// Holding a page still long enough to annotate a transient state means stopping four
// independent sources of motion. Missing any one of them leaves something moving.
//
//   1. CSS animations and transitions — an injected stylesheet
//   2. Web Animations API             — `document.getAnimations()`, paused
//   3. `<video>` playback             — paused, remembering what was playing
//   4. JS-driven motion               — `setTimeout` / `setInterval` /
//                                       `requestAnimationFrame`, held and replayed
//
// (4) is why this file has to run in the MAIN world. Patching `window.setTimeout` from
// an isolated content script patches only that script's own timers; the page's animation
// loops keep running in their own heap, untouched.
//
// It is also the one part restricted to the top frame — patching natives in a third-party
// widget's iframe reads as tampering to the widget. The reasoning is at the `wrapTimers()`
// call at the foot of this file.
//
// Our own overlay is excluded throughout: the toolbar and markers must stay responsive
// while the page under them is held still.
// =============================================================================

import { UI_ATTR } from "../shared/protocol";

const STYLE_ID = "senannotate-freeze-styles";

/** Restricts the freeze stylesheet to page content, never our own UI. */
const NOT_OURS = `:not([${UI_ATTR}]):not([${UI_ATTR}] *)`;

// Captured at module load, before anything is patched. `setTimeout` is exported because
// other MAIN-world code needs a timer that still fires while the page is frozen —
// scheduling on the patched one during a freeze would never run.
export const originalSetTimeout = window.setTimeout.bind(window);
const originalSetInterval = window.setInterval.bind(window);
const originalRequestAnimationFrame = window.requestAnimationFrame.bind(window);
const originalClearTimeout = window.clearTimeout.bind(window);
const originalCancelAnimationFrame = window.cancelAnimationFrame.bind(window);

let frozen = false;

export function isFrozen(): boolean {
  return frozen;
}

// -----------------------------------------------------------------------------
// 1. CSS animations and transitions
// -----------------------------------------------------------------------------

/**
 * `animation-play-state: paused` holds an animation at its current frame, which is what
 * we want. Transitions have no such control, so they are given a zero duration instead —
 * any in flight snap to their end state and no new one takes visible time.
 *
 * `!important` throughout, because page rules are frequently `!important` themselves.
 */
function injectFreezeStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
*${NOT_OURS}, *${NOT_OURS}::before, *${NOT_OURS}::after {
  animation-play-state: paused !important;
  transition-duration: 0s !important;
  transition-delay: 0s !important;
  scroll-behavior: auto !important;
}
`;
  (document.head || document.documentElement).appendChild(style);
}

function removeFreezeStyles(): void {
  document.getElementById(STYLE_ID)?.remove();
}

// -----------------------------------------------------------------------------
// 2. Web Animations API
// -----------------------------------------------------------------------------
//
// WAAPI animations are driven by the compositor, not by CSS, so the stylesheet above
// does not touch them. Only the ones this code paused are resumed later — an animation
// the page had already paused itself must stay paused.

const pausedAnimations = new Set<Animation>();

function pauseWebAnimations(): void {
  if (typeof document.getAnimations !== "function") return;

  for (const animation of document.getAnimations()) {
    if (animation.playState !== "running") continue;
    if (isOurs(animation)) continue;
    try {
      animation.pause();
      pausedAnimations.add(animation);
    } catch {
      // A detached or already-finished animation can throw. Nothing to do.
    }
  }
}

function resumeWebAnimations(): void {
  for (const animation of pausedAnimations) {
    try {
      animation.play();
    } catch {
      // Its element may have been removed while frozen.
    }
  }
  pausedAnimations.clear();
}

/**
 * True for animations belonging to our own overlay, which must keep running.
 *
 * The overlay lives inside an open shadow root whose HOST carries the UI attribute, and
 * plain `closest()` stops at the shadow boundary — so the walk hops from each shadow
 * root to its host, or every one of our own animations would be judged "not ours" and
 * frozen along with the page.
 */
function isOurs(animation: Animation): boolean {
  const target = (animation.effect as KeyframeEffect | null)?.target;
  if (!(target instanceof Element)) return false;

  let current: Element | null = target;
  while (current) {
    if (current.closest(`[${UI_ATTR}]`)) return true;
    const root = current.getRootNode();
    if (!(root instanceof ShadowRoot)) return false;
    current = root.host;
  }
  return false;
}

// -----------------------------------------------------------------------------
// 3. Video
// -----------------------------------------------------------------------------
//
// Only videos that were actually playing are restarted, so a paused one is not made to
// play by unfreezing. The flag lives in a WeakSet rather than a dataset attribute so it
// leaves no trace in the DOM the user might annotate.

const wasPlaying = new WeakSet<HTMLVideoElement>();

function pauseVideos(): void {
  for (const video of document.querySelectorAll("video")) {
    if (video.closest(`[${UI_ATTR}]`)) continue;
    if (video.paused) continue;
    wasPlaying.add(video);
    try {
      video.pause();
    } catch {
      // Ignore — a media element can reject a pause mid-load.
    }
  }
}

function resumeVideos(): void {
  for (const video of document.querySelectorAll("video")) {
    if (!wasPlaying.has(video)) continue;
    wasPlaying.delete(video);
    void video.play().catch(() => {
      // Autoplay policy may refuse without a user gesture. Not worth surfacing.
    });
  }
}

// -----------------------------------------------------------------------------
// 4. JS-driven motion
// -----------------------------------------------------------------------------
//
// The design constraint that shapes everything here: **the id a caller gets back must be
// a real timer id at all times**, so that `clearTimeout` / `clearInterval` /
// `cancelAnimationFrame` keep working with no correspondence table. An earlier version
// handed out decoy ids while frozen and held callbacks in a side queue — which meant a
// cancelled timer replayed anyway, a 60-second timeout fired 59 seconds early, and an
// interval cancelled by the page resurrected on unfreeze and could never be cleared
// again.
//
// So instead: the scheduling functions are wrapped ONCE, at document_start (the same
// approach diagnostics.ts takes with fetch/XHR — this script runs before the page's
// first line, so every page timer passes through the wrapper). Timers run on their real
// schedule; the wrapper checks `frozen` at *fire time*:
//
//   setTimeout   fires while frozen → the callback is parked, keyed by its real id,
//                and replayed on unfreeze. Fires while thawed → runs untouched. A
//                long timeout that comes due after unfreeze keeps its full delay.
//   rAF          same, replayed with a fresh timestamp — the original is long stale.
//   setInterval  ticks that land during a freeze are swallowed, not queued: replaying
//                a backlog would fire them in a burst, which no interval expects.
//
// The cancel functions stay wrapped for one reason only: a callback that already fired
// into the parked state looks still-pending to the page, so cancelling it must remove
// the parked entry too.

const parkedTimeouts = new Map<number, () => void>();
const parkedFrames = new Map<number, FrameRequestCallback>();

let timersWrapped = false;

function wrapTimers(): void {
  if (timersWrapped) return;
  timersWrapped = true;

  window.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
    // String handlers are eval-equivalent; passed straight through, never parked.
    if (typeof handler !== "function") return originalSetTimeout(handler, delay);

    const id: number = originalSetTimeout(() => {
      if (frozen) parkedTimeouts.set(id, () => handler(...args));
      else handler(...args);
    }, delay);
    return id;
  }) as typeof window.setTimeout;

  window.clearTimeout = ((id?: number) => {
    if (typeof id === "number") parkedTimeouts.delete(id);
    originalClearTimeout(id);
  }) as typeof window.clearTimeout;

  window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    const id: number = originalRequestAnimationFrame((timestamp) => {
      if (frozen) parkedFrames.set(id, callback);
      else callback(timestamp);
    });
    return id;
  }) as typeof window.requestAnimationFrame;

  window.cancelAnimationFrame = ((id: number) => {
    parkedFrames.delete(id);
    originalCancelAnimationFrame(id);
  }) as typeof window.cancelAnimationFrame;

  window.setInterval = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
    if (typeof handler !== "function") return originalSetInterval(handler, delay);
    // Real interval, real id — `clearInterval` needs no wrapping at all.
    return originalSetInterval(() => {
      if (!frozen) handler(...args);
    }, delay);
  }) as typeof window.setInterval;
}

/**
 * Replay everything that came due during the freeze. Each callback is isolated: one
 * throwing must not strand the rest, or a single bad animation loop takes the whole
 * page's motion with it.
 *
 * The maps are drained before iterating, because a replayed callback commonly schedules
 * the next frame and would otherwise mutate the collection being iterated.
 */
function replayParked(): void {
  const timeouts = [...parkedTimeouts.values()];
  const frames = [...parkedFrames.values()];
  parkedTimeouts.clear();
  parkedFrames.clear();

  for (const run of timeouts) {
    try {
      run();
    } catch (error) {
      console.warn("[senannotate] parked timeout threw on replay:", error);
    }
  }

  const now = performance.now();
  for (const frame of frames) {
    try {
      frame(now);
    } catch (error) {
      console.warn("[senannotate] parked frame threw on replay:", error);
    }
  }
}

// Wrapped immediately: this module is evaluated at document_start, before any page
// script runs, so no timer can be scheduled behind the wrapper's back. Deferring the
// wrap to the first `freeze()` call is not an option — an interval or a rAF loop the
// page started before that moment would keep ticking straight through the freeze.
//
// Top frame only, for the same reason `installDiagnostics()` is (see
// `inspector/index.ts`): the wrapper replaces five natives in the page's own heap, and a
// browser-integrity check reading `setTimeout.toString()` sees tampering. Turnstile and
// friends render in exactly the iframes this was patching.
//
// Nothing is lost, because `freeze()` can never run in a child frame today: the bridge
// is a same-window `postMessage` (`content/bridge.ts`), and its only caller —
// `toggleFreeze` — lives in the top-frame branch of `content/index.ts`. So every iframe
// on every page was having its timers patched for a `frozen` flag that stayed false for
// the life of the document.
//
// Freezing motion *inside* a frame therefore remains unsolved rather than regressed. It
// needs freeze routed down FRAME_CHANNEL first; when that lands, this guard is where the
// child-frame wrap belongs — driven by the arriving command, not by module load.
if (window.top === window) wrapTimers();

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

export function freeze(): void {
  if (frozen) return;
  frozen = true;

  // Timers were wrapped at module load (top frame only); the flag alone is what parks
  // their callbacks. In a child frame this call still does 1-3 and simply skips 4.
  injectFreezeStyles();
  pauseWebAnimations();
  pauseVideos();
}

export function unfreeze(): void {
  if (!frozen) return;
  frozen = false;

  removeFreezeStyles();
  resumeWebAnimations();
  resumeVideos();
  replayParked();
}
