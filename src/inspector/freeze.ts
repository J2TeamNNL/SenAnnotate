// =============================================================================
// Freeze motion — MAIN world only
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

/** True for animations belonging to our own overlay, which must keep running. */
function isOurs(animation: Animation): boolean {
  const target = (animation.effect as KeyframeEffect | null)?.target;
  if (!(target instanceof Element)) return false;
  return !!target.closest(`[${UI_ATTR}]`);
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
// Timers are *held*, not dropped: callbacks queued during a freeze run on unfreeze, so a
// paused animation loop resumes rather than dying. Dropping them would leave apps in a
// half-finished state — a spinner that never stops, a queue that never drains.
//
// rAF callbacks are held the same way and replayed with a fresh timestamp, since the one
// they would have received is long stale by then.

type Held = { run: () => void };

const heldTimeouts: Held[] = [];
const heldFrames: Held[] = [];

/** Intervals cannot be held — replaying a backlog would fire them in a burst. */
const suspendedIntervals = new Map<number, { handler: TimerHandler; delay: number; args: unknown[] }>();

function patchTimers(): void {
  window.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
    if (!frozen) return originalSetTimeout(handler, delay, ...args);
    // Handed back a real id so callers can clearTimeout it; the callback is queued.
    const id = originalSetTimeout(() => {}, 0);
    heldTimeouts.push({ run: () => invoke(handler, args) });
    return id;
  }) as typeof window.setTimeout;

  window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    if (!frozen) return originalRequestAnimationFrame(callback);
    const id = originalRequestAnimationFrame(() => {});
    heldFrames.push({ run: () => callback(performance.now()) });
    return id;
  }) as typeof window.requestAnimationFrame;

  window.setInterval = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
    if (!frozen) return originalSetInterval(handler, delay, ...args);
    // Registered but never started while frozen; started for real on unfreeze.
    const id = originalSetTimeout(() => {}, 0);
    suspendedIntervals.set(id, { handler, delay: delay ?? 0, args });
    return id;
  }) as typeof window.setInterval;
}

function restoreTimers(): void {
  window.setTimeout = originalSetTimeout as typeof window.setTimeout;
  window.setInterval = originalSetInterval as typeof window.setInterval;
  window.requestAnimationFrame = originalRequestAnimationFrame;
}

function invoke(handler: TimerHandler, args: unknown[]): void {
  if (typeof handler === "function") handler(...args);
  // A string handler is `eval`-equivalent; deliberately not replayed.
}

/**
 * Drain the held queues. Each callback is isolated: one throwing must not strand the
 * rest, or a single bad animation loop takes the whole page's motion with it.
 *
 * The arrays are emptied before draining, because a replayed callback commonly schedules
 * the next frame and would otherwise append to the array being iterated.
 */
function replayHeld(): void {
  const timeouts = heldTimeouts.splice(0);
  const frames = heldFrames.splice(0);

  for (const held of [...timeouts, ...frames]) {
    try {
      held.run();
    } catch (error) {
      console.warn("[senannotate] held callback threw on replay:", error);
    }
  }

  for (const [, spec] of suspendedIntervals) {
    try {
      originalSetInterval(spec.handler, spec.delay, ...spec.args);
    } catch (error) {
      console.warn("[senannotate] suspended interval threw on restart:", error);
    }
  }
  suspendedIntervals.clear();
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

export function freeze(): void {
  if (frozen) return;
  frozen = true;

  patchTimers();
  injectFreezeStyles();
  pauseWebAnimations();
  pauseVideos();
}

export function unfreeze(): void {
  if (!frozen) return;
  frozen = false;

  restoreTimers();
  removeFreezeStyles();
  resumeWebAnimations();
  resumeVideos();
  replayHeld();
}
