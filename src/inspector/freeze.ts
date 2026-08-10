// =============================================================================
// Freeze animations — MAIN world only
// =============================================================================
//
// Ported from agentation's `freeze-animations.ts`, with one structural change:
// it has to live in the MAIN world. Patching `window.setTimeout` from an isolated
// content script would only patch the content script's own timers, leaving the
// app's animation loops running.
//
// Four things get frozen:
//   1. CSS animations / transitions — injected stylesheet
//   2. Web Animations API           — `document.getAnimations().pause()`
//   3. `<video>`                    — `.pause()`, remembering what was playing
//   4. JS-driven motion             — `setTimeout` / `setInterval` / `rAF` patches
// =============================================================================

import { UI_ATTR } from "../shared/protocol";

const STYLE_ID = "vuetation-freeze-styles";

/** Our own overlay must keep animating while everything else is held still. */
const NOT_OURS = `:not([${UI_ATTR}]):not([${UI_ATTR}] *)`;

/**
 * Captured before any patching. Exported because other MAIN-world modules need a
 * timer that still fires while the page is frozen.
 */
export const originalSetTimeout = window.setTimeout.bind(window);
const originalSetInterval = window.setInterval.bind(window);
const originalRAF = window.requestAnimationFrame.bind(window);

let frozen = false;
let patched = false;
let pausedAnimations: Animation[] = [];
let queuedTimeouts: Array<() => void> = [];
let queuedFrames: FrameRequestCallback[] = [];

// -----------------------------------------------------------------------------
// Timer patches — installed lazily, on the first freeze
// -----------------------------------------------------------------------------

function installPatches(): void {
  if (patched) return;
  patched = true;

  // Deferred rather than dropped: a `setTimeout` that never fires leaves promises
  // pending forever, which breaks the app once you unfreeze.
  window.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
    if (typeof handler === "string") return originalSetTimeout(handler, timeout);
    return originalSetTimeout(
      (...callbackArgs: unknown[]) => {
        if (frozen) {
          queuedTimeouts.push(() => (handler as (...a: unknown[]) => void)(...callbackArgs));
        } else {
          (handler as (...a: unknown[]) => void)(...callbackArgs);
        }
      },
      timeout,
      ...args,
    );
  }) as typeof window.setTimeout;

  // Intervals are periodic by nature — skipping a tick is the right behaviour,
  // replaying every missed tick on unfreeze would be a burst of nonsense.
  window.setInterval = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
    if (typeof handler === "string") return originalSetInterval(handler, timeout);
    return originalSetInterval(
      (...callbackArgs: unknown[]) => {
        if (!frozen) (handler as (...a: unknown[]) => void)(...callbackArgs);
      },
      timeout,
      ...args,
    );
  }) as typeof window.setInterval;

  // The wrapper still fires on the next frame; the callback is what gets held.
  // Queueing instead of re-requesting avoids spinning the CPU while frozen.
  window.requestAnimationFrame = ((callback: FrameRequestCallback) =>
    originalRAF((timestamp) => {
      if (frozen) queuedFrames.push(callback);
      else callback(timestamp);
    })) as typeof window.requestAnimationFrame;
}

// -----------------------------------------------------------------------------

function isOurs(element: Element | null): boolean {
  return !!element?.closest?.(`[${UI_ATTR}]`);
}

export function isFrozen(): boolean {
  return frozen;
}

export function freeze(): void {
  if (frozen) return;
  installPatches();
  frozen = true;
  queuedTimeouts = [];
  queuedFrames = [];

  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    (document.head ?? document.documentElement).appendChild(style);
  }
  style.textContent = `
    *${NOT_OURS},
    *${NOT_OURS}::before,
    *${NOT_OURS}::after {
      animation-play-state: paused !important;
      transition: none !important;
    }
  `;

  // Only pause animations that are actually running. Pausing a finished animation
  // makes it restart when we later call play(), which replays entrance effects.
  pausedAnimations = [];
  try {
    for (const animation of document.getAnimations()) {
      if (animation.playState !== "running") continue;
      const target = (animation.effect as KeyframeEffect | null)?.target ?? null;
      if (isOurs(target)) continue;
      animation.pause();
      pausedAnimations.push(animation);
    }
  } catch {
    // getAnimations is unavailable in some embedded contexts.
  }

  for (const video of Array.from(document.querySelectorAll("video"))) {
    if (!video.paused) {
      video.dataset.vuetationWasPlaying = "true";
      video.pause();
    }
  }
}

export function unfreeze(): void {
  if (!frozen) return;
  frozen = false;

  // Drain the timer queue asynchronously so a big backlog does not block the
  // main thread in one go. Re-check `frozen` on each: the user may have hit
  // freeze again between scheduling and execution.
  const timeouts = queuedTimeouts;
  queuedTimeouts = [];
  for (const callback of timeouts) {
    originalSetTimeout(() => {
      if (frozen) {
        queuedTimeouts.push(callback);
        return;
      }
      try {
        callback();
      } catch (error) {
        console.warn("[vuetation] queued timeout threw on replay:", error);
      }
    }, 0);
  }

  const frames = queuedFrames;
  queuedFrames = [];
  for (const callback of frames) {
    originalRAF((timestamp) => {
      if (frozen) {
        queuedFrames.push(callback);
        return;
      }
      callback(timestamp);
    });
  }

  // Resume before dropping the stylesheet — removing the CSS first can make the
  // browser swap in fresh Animation objects, orphaning the ones we hold.
  for (const animation of pausedAnimations) {
    try {
      animation.play();
    } catch {
      // The animation's element may have been removed while frozen.
    }
  }
  pausedAnimations = [];

  document.getElementById(STYLE_ID)?.remove();

  for (const video of Array.from(document.querySelectorAll("video"))) {
    if (video.dataset.vuetationWasPlaying === "true") {
      delete video.dataset.vuetationWasPlaying;
      void video.play().catch(() => {});
    }
  }
}
