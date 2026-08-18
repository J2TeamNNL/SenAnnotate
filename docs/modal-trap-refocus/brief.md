# Brief — the composer takes no typing inside a Reka UI / Radix modal

## What

Reported on `localhost:3000/campaigns/ai/edit/…` (seller_v3, Nuxt UI v4 → Reka UI): with the
"Select mockup colour" modal open, clicking a swatch opens the composer as expected — element,
component chain and props are all correct — but **nothing can be typed into the textarea**.

The composer looks live and silently drops the note, which is the same shape of failure
`docs/modal-focus-leak/` fixed for one focus-trap variant. It is not the same cause.

## Why it matters

Modals are where annotation is most valuable (a dialog is hard to describe by hand), and a UI
that appears to accept a note and discards it is worse than one that refuses.

## Scope

- Root-cause the focus theft against the real library code, not a guess.
- Fix it for the `focusout`-based traps `docs/modal-focus-leak/` did not cover.
- Regression check with **real keystrokes** (`fill()` cannot see this class of bug — the
  reason is recorded in `../modal-focus-leak/changelog.md`).

Out of scope: the `close-on-focus-loss` variant, which stays deliberately broken and is
already argued in `../modal-focus-leak/changelog.md`.
