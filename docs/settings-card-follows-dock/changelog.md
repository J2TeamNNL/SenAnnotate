# Changelog — the settings card follows the dragged toolbar

## Written before the code

The four files were created from the approved design before any code changed. The design
was settled in chat: bounded task, no spec file — the drag, the dock and the card all
already exist here.

One question was put to the user rather than assumed: which edge the card aligns to when
the pill is floating. **Right edge**, matching the relationship the default corner already
has, rather than the left edge the dock's own `align-items: flex-start` switches to.

## Built

Checks first, then the code, in the order `plan.md` set out. The run in between failed the
three geometry checks and passed the "left to CSS" one, which is the split that says the
assertions are measuring the right thing.

Code, all four pieces as planned:

- `Toolbar.dockBox()` — the dock's rect while floating, `null` in the CSS corner.
- `ToolbarCallbacks.onDockShift`, fired from `paintPosition()` and from
  `applyPosition(null)`. Needed a stored `this.callbacks`: the class had only ever closed
  over the parameter, because until now every callback fired from inside the constructor's
  own handlers.
- `SettingsCard.anchorTo(box | null)`.
- `.toolbar-dock[data-floating="true"] ~ .settings[data-anchored="true"] { bottom: auto;
  right: auto; }` — written at that length to out-specify the two `.toolbar-dock[…] ~
  .settings` rules already in the file, which have three class-column points to this one's
  four. A bare `.settings[data-anchored="true"]` would have lost to both.

## What turned out false

**"Prefer above, flip below, clamp" was not enough.** It is what the composer does and what
`plan.md` specified, and it produced a card 335px away from its pill: this card is ~560px
tall on a 900px viewport, so with the pill in the middle neither side fits and the clamp
fallback parks it against the bottom edge. `anchorTo` now takes the roomier side and caps
the card to it with an inline `max-height` — the card already scrolls, so there was nothing
to lose. `context.md` has the numbers.

**A drag gesture whose first step leaves the pill never starts.** Two of the new checks
initially reported that the dock had not moved at all, and the code was innocent: pointer
capture is only taken *after* the drag threshold, so before that the pill only sees moves
that are still over it. `mouse.move(600, 40, { steps: 12 })` from the centre of a 44px-tall
pill puts the first interpolated step 52px above it — the pill gets no `pointermove`, the
threshold is never crossed, and the whole gesture is a no-op. The same code dragged fine
sideways, which is why the existing drag checks never hit it. The fix is a 16px nudge along
the pill before the long move; it is commented in the suite, because the next person to
write a vertical drag will hit it too.

Ruled out along the way, with instrumentation rather than argument: that the events were
not arriving (a counter on the pill's own listeners showed `pointerdown: 1`,
`pointermove: 1` — the hover before the press — and `pointerup: 0`), and that a preceding
real click was somehow required.

## Verification

`npm run typecheck` clean. `SENANNOTATE_HEADLESS=1 npm test` — 257/257 e2e, 9/9 upgrade,
with the five new checks and every check the settings and drag blocks already carried,
including "the settings card clears the hint line", which measures the untouched default
corner.

One flake seen once and not reproduced: `Vue 3 is detected and versioned` read an empty
badge on one run, then passed on the next and on every other run of the day. It is the
first check in the file and depends on the fixture having hydrated before `boot()` gives up
looking; nothing in this change touches detection.
