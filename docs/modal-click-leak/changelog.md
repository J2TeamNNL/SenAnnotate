# Changelog

## The report, and the wrong suspect

Reported as "with a modal open, pressing Freeze closes the modal". Freeze was the obvious
place to look, and it was wrong. Two freeze mechanisms were plausible enough to be worth
ruling out rather than reasoning about:

- `transition-duration: 0s !important` + `animation-play-state: paused !important` blanking
  a dialog whose visibility comes from a forwards-filling animation
- `pauseWebAnimations()` catching a modal library's entrance animation mid-flight

Both were measured with a three-modal fixture, recording state after *every* step instead of
only at the end. Freeze dismissed nothing. The step that dismissed was **clicking the
Inspect button** — one step earlier than the report said, and reachable without freeze
existing at all:

```
1 open modal:     open=true  froze=false
2 click Inspect:  open=false froze=false     ← here
3 press F:        open=true* froze=true      (*on the variant that survived step 2)
close log: ["mousedown target=div"]
```

`target=div` is our shadow host. Because pointer events are `composed: true` and retarget
to the host on the way out, every site that dismisses on a pointer event outside the dialog
saw our toolbar as an outside click. The user named Freeze because Freeze is the button you
reach for with a modal open — the same leak fires from Inspect, the panel, the collapse
handle and the marker pins.

Recording the cleared suspects on purpose: "freeze blanks animated content" is the failure
this design would be *expected* to have, and it does not — that is now pinned by a check
(`a frozen modal is still visible`) so a future change to the freeze stylesheet cannot
quietly introduce it.

## The fix

Nine pointer event types, `stopPropagation()`, bubble phase, on the host, in
`createUiRoot`. Four things that fell out of the investigation and constrain it:

- **Not in `content/index.ts`.** Those handlers are on `document` in the *capture* phase,
  which runs before the event reaches our shadow root, so stopping there cancels our own
  buttons. Bubble-at-the-host is the only seam where our listeners have already run and
  `document` has not been reached.
- **Not keyboard.** Focus sits inside the shadow root after any toolbar click, and
  `document` keydown is what implements `f` / `a` / `h` / `1-2-3`; stopping keystrokes at
  the host disables every shortcut the moment the toolbar is used.
- **Not `pointermove`.** Not a dismissal trigger, and the hover path uses
  `elementFromPoint`, not the event target.
- **Not `stopImmediatePropagation`.** Other listeners on the host are ours.

`markers.ts` already stopped propagation for pin clicks and `composer.ts` for keystrokes,
so the principle was established — it just had never been applied where every piece of UI
passes through, and `markers.ts` covered only `click`, not the `mousedown` most dismissal
listeners actually watch. Putting it in `createUiRoot` means a card added to `cardLayer`
later inherits it without knowing this bug existed.

## Two test failures that were the test's fault

The dismissal checks went green immediately; two others did not, and both turned out to be
artefacts worth writing down.

**`waitForFunction` cannot observe a frozen page.** The check for "the page really is
frozen" timed out while the page was, in fact, frozen. Playwright's `waitForFunction` polls
on `requestAnimationFrame` by default — and freeze parks rAF callbacks. Passing
`polling: <ms>` does not help either: freeze parks `setTimeout` too. **Any in-page polling
loop is held by the very state it is waiting to observe.** The only way to read a frozen
page is a Node-side sleep plus a single `evaluate`, neither of which goes through a page
timer. This is a property of the freeze design, not a bug, and it will trap the next person
who writes a test around freeze.

**The dialog was caught mid-fade.** "A frozen modal is still visible" read an opacity below
1 because the block froze the page within the dialog's 250 ms entrance animation, and freeze
correctly paused it partway. The check now waits for the animation to settle first, so it
asserts what it claims to: that freezing a settled dialog leaves it visible.

Neither was a product defect, and neither would have been understood by retrying — the
first one in particular looks exactly like "freeze is broken".

## Verified

- `107/107` checks pass, up from 98. The nine new ones fail on the pre-fix build; five of
  them with `closed by: mousedown target=div`.
- `npm run typecheck` clean.
- The marquee block, which drives raw `mouse.down`/`move`/`up` across the page, and the
  composer and panel buttons, which are now downstream of a `stopPropagation`, are
  unaffected.

## Left open

**Focus-trap modals.** A modal that closes when focus leaves the dialog is still dismissed
by a toolbar click — through focus, not through the pointer event, so this fix does not
reach it. Mitigating it means `preventDefault()` on `mousedown` over the toolbar so the
click never moves focus, and even then it cannot be complete: the composer has a
`<textarea>` the user must type into, so annotating inside a close-on-focus-loss modal will
always dismiss it.

Left for its own task rather than bundled here, because real focus traps — `focus-trap`,
Radix, Headless UI — restore focus rather than close, which makes this a narrow pattern and
a partial fix. The reproduction fixture for it is in `context.md`.
