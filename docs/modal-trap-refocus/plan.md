# Plan

1. **Confirm the mechanism against the library, not a guess.** Read
   `reka-ui/dist/FocusScope/FocusScope.js` in `seller_v3`'s store and find which listener can
   see us. → `handleFocusOut` on `document`, keyed on `event.relatedTarget`. ✅
2. **Reproduce it.** Variant C in `test/fixtures/modal-focus.html`: Reka's two handlers ported
   line for line, a focusable swatch inside the dialog so `lastFocusedElement` is set, and the
   dialog autofocusing it on open. Drive it with real keystrokes in a scratch script. ✅
   *Baseline: `focus log: trap:focusout related=div`, `activeElement: button#trap-swatch`,
   textarea `""`.*
3. **Fix at the source of the event, not the symptom.** `takeFocus()` in
   `src/content/ui/dom.ts`: blur whatever the page had focused, then focus ours, so the
   `focusout` the trap keys on carries `relatedTarget === null` — the one case every
   implementation is obliged to ignore.
4. **Use it everywhere the overlay takes focus from the page**: `Composer`'s constructor,
   `Composer.focus()`, `selectKind()`, the empty-note bounce in `submit()`, `ShotEditor`, and
   the `execCommand` clipboard fallback (same failure: a trap steals focus back before
   `select()` and the copy silently returns `false`).
5. **Make the check permanent** in `test/e2e.mjs`, next to variants A and B, typing with
   `keyboard.type()` and no prior click on the textarea — the bug lives entirely between the
   composer's autofocus and the first keystroke.
6. **Verify**: `npm run typecheck`, then the full suite plus the upgrade check.

## Alternatives considered

| Option | Why not |
|---|---|
| Reparent the host inside the dialog (as `modal-top-layer` does for `:modal`) | Covers both halves *and* capture-phase `focusin`, but a page's dialog routinely sets `overflow: hidden` / `contain: paint`, which would clip the toolbar and composer to the dialog box. Bigger blast radius than the bug. Kept as the answer if a capture-phase trap ever needs fixing. |
| Re-focus our textarea whenever the page steals it | Ping-pong: our focus fires the trap, the trap fires ours. No terminating state. |
| Route keystrokes to an unfocused textarea | Reimplements caret, selection and IME. Already rejected in `../modal-focus-leak/`. |
| `stopPropagation` on more event types at the host | The event never touches the host. Nothing to stop. |
