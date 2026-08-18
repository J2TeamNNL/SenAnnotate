# Context

## The two halves of a focus trap, and which one we cover

`docs/modal-focus-leak/` added two guards to `createUiRoot`:

- `mousedown` → `preventDefault()` — a toolbar click no longer moves focus at all.
- `focusin` / `focusout` → `stopPropagation()` **at our host** — a trap listening on
  `document` never learns focus arrived in our shadow root.

The second guard only works for events whose propagation path includes our host. A trap has
**two** ways to notice focus leaving:

| Watches | Fires on | In our path? | Covered before this task |
|---|---|---|---|
| `focusin` (focus arrived outside) | our textarea → retargets to host | yes | ✅ stopped at the host |
| `focusout` (focus left the dialog) | **the dialog element** | no | ❌ nothing of ours to stop |

The fixture written for that task (`test/fixtures/modal-focus.html`, variant B) implements the
`focusin` half only, so the suite had no way to see the second one.

## What Reka UI actually does

`reka-ui@2.10.1/dist/FocusScope/FocusScope.js` (Nuxt UI v4's modal is Reka's `DialogRoot`;
the report's `<DialogContentImpl> <FocusScope> … <DismissableLayer>` chain is this component):

```js
function handleFocusIn(event) {
  if (focusScope.paused || !container) return;
  const target = event.target;
  if (container.contains(target)) lastFocusedElementRef.value = target;
  else focus(lastFocusedElementRef.value, { select: true });
}
function handleFocusOut(event) {
  if (focusScope.paused || !container) return;
  const relatedTarget = event.relatedTarget;
  if (relatedTarget === null) return;                       // ← the seam we use
  if (!container.contains(relatedTarget)) focus(lastFocusedElementRef.value, { select: true });
}
document.addEventListener("focusin", handleFocusIn);
document.addEventListener("focusout", handleFocusOut);
```

Radix (React) and Headless UI are the same code, ported. `focus-trap` differs — it listens
`focusin` with `capture: true` on `document`, which runs *before* the event reaches our host,
so our `focusin` guard cannot stop that one either. Noted, not addressed here: a capture-phase
`focusin` sees the host as the target, and the containment answer for it is the same seam
below, not a fourth listener.

## The sequence that loses the keystrokes

1. Reka autofocuses the first tabbable element in the dialog — a colour swatch. Its
   `handleFocusIn` records that swatch as `lastFocusedElement`.
2. We annotate; `Composer`'s constructor ends in `this.textarea.focus()`.
3. Focus leaves the swatch → `focusout` fires **on the swatch**, bubbles to `document`.
   `relatedTarget` retargets across the shadow boundary to our host, which is not inside the
   dialog, so `handleFocusOut` fires `focus(lastFocusedElement)`.
4. Focus is back on the swatch before the first keystroke. Every character goes to the
   dialog; the textarea stays empty. Our `focusin` guard is irrelevant — the theft was
   triggered by an event that never touched our host.

`relatedTarget === null` returning early is not a Reka quirk: a null `relatedTarget` means
focus left the document (tab/window switch, or Chrome removing the focused node), and every
implementation of this pattern has to ignore it or a trap would fight the browser itself.
Radix, Headless UI and `focus-trap` all carry the same guard.

## Files

- `src/content/ui/root.ts` — the containment block; all four guards live there.
- `src/content/ui/composer.ts` — `this.textarea.focus()` in the constructor, plus `focus()`
  for when the markup editor gives focus back.
- `src/content/ui/shot-editor.ts` — the other thing in the overlay that takes focus.
- `test/fixtures/modal-focus.html` — variants A and B (`focusin` half).
- `test/e2e.mjs` — the focus-trap block, ~line 990.
