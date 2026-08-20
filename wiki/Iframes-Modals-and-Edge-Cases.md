# Iframes, Modals and Edge Cases

The situations where "click the element" is not straightforward, and what the extension
does about each.

---

## Iframes

Elements inside an iframe are annotated like any other — a Storybook preview, an embedded
dashboard, a hosted checkout, a payment form.

The extension runs **inside frames too**, and each frame hands its captures up to the top
frame, which owns the toolbar and the storage. The report names which frame the element
came from:

```markdown
**Frame:** Storybook preview — `https://storybook.example.com/iframe.html`
```

### What is skipped

**Frames smaller than 50×50 are not instrumented at all**, so the tracking pixels and
empty ad slots on a news page cost nothing.

### Three limits

| Limit | Effect |
|---|---|
| A pin inside a frame does not follow that frame's **own** scrolling | Visual only — the report is unaffected. |
| A frame nested **inside another frame** falls back to annotating the outer `<iframe>` | You get the outer element rather than the inner one. |
| **Drag-select stops at the frame boundary** | Click and text selection work inside frames; the marquee does not. |
| **Freeze does not reach inside a frame** | <kbd>F</kbd> holds the top document still; a carousel running inside an iframe keeps moving. |

### Challenge frames are left alone

Cloudflare Turnstile, hCaptcha and similar widgets render in an iframe and **refuse to
verify if they see the page's natives patched**. The extension therefore patches no
natives inside a frame at all — not the network capture behind the diagnostics report,
and not the timer wrap behind freeze. A user who cannot get past a challenge because a
feedback tool was installed is a worse outcome than an un-annotatable widget, and it is
also why the freeze limit in the table above is a limit rather than a bug.

---

## Modals and dialogs

Annotated like anything else, including the two shapes that used to be impossible.

### `<dialog>` opened with `showModal()`

Chrome paints these in its **top layer**, above every z-index there is, and makes
everything outside them inert. An overlay that is merely `z-index: 2147483647` is still
*underneath*. The extension handles this and the composer appears above the dialog.

### Focus traps

Reka UI, Radix and Headless UI all watch `focusin` on `document` and pull focus back into
the dialog when it leaves. This **silently swallowed everything typed into the composer**
until 0.8.1 — the note looked focused and took no keystrokes.

Fixed by taking focus in a way that wins the race, and by stopping `focusin`/`focusout`
at the shadow host so the trap never sees focus leave in the first place.

### Our UI never dismisses a page's modal

A page that closes its modal on an outside click used to close it when you clicked the
toolbar — because to the page, that *was* an outside click.

Now nine pointer event types plus `focusin`/`focusout` are stopped at the shadow host,
and `mousedown` is cancelled (text fields exempted) so a click on our UI takes no focus.
Keyboard events and `pointermove` are deliberately **not** stopped, because the page
needs those to keep working normally.

### The one case that cannot be fixed

**A dialog that closes when focus leaves it will close when the composer opens**, because
typing requires focus. There is no way around this that still lets you type.

The annotation is captured *before* the composer appears, so the element, its selector,
its component chain and the report are all complete either way. You lose the dialog on
screen, not the note.

---

## Hover-only surfaces

A dropdown, a submenu, a tooltip, anything styled `:hover` — it closes the moment you
click it, which is the moment you were trying to annotate it.

**Press <kbd>C</kbd> while hovering instead.** It captures without a click, so the menu
stays open. See [[Selecting Elements]].

Freeze does **not** help here. Freeze parks timers and animation frames; a hover surface
is driven by pointer events, so there is nothing on a timer to park.

---

## Animated and moving elements

<kbd>F</kbd> freezes the page: `requestAnimationFrame` and `setTimeout` are held, so a
carousel, a toast on a timer or a mid-flight transition stops where it is.

Freeze has to run in the page's own world to work at all — patching `setTimeout` from an
isolated content script patches only that script's own timers. That patch is confined to
the **top document**, so motion inside an iframe carries on. See [[Architecture]].

*Freeze animations on inspect* in [[Settings]] makes it automatic.

---

## Single-page apps

Notes are keyed on `origin + pathname`, so a client-side route change is a different
screen and shows that screen's notes.

**A re-render can replace the element a note points at.** The note keeps everything it
recorded — element name, selector, component chain, source, your text — and simply
cannot re-highlight. Nothing is lost from the report.

---

## Pages where the extension does not run

| Where | Why |
|---|---|
| `chrome://` pages | Chrome does not run extension content scripts there. |
| The Chrome Web Store | Same — Chrome blocks extensions on its own store. |
| The PDF viewer | Not an HTML document. |
| Other extensions' pages | Same isolation rule. |

There is no toolbar on these and nothing can put one there — including for theme and
accent, which are otherwise global settings.

---

## Shadow DOM on the page

Elements inside a page's **open** shadow roots are annotated normally. Closed shadow
roots are not reachable by anything, including this extension.

---

## Very large pages

The component chain costs a bridge round trip per element. On a page with thousands of
nodes this is noticeable on hover.

Two ways out, both in [[Settings]]: set **Components → Off (fastest)**, or drop the
detail level to **Compact**, which implies the same thing.

The bridge times out at **500 ms** and resolves to "no framework data" rather than
hanging, so a page that never answers degrades to a still-useful note.
